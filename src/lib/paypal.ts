import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getPayPalConfig(): Promise<PayPalConfig> {
  try {
    const settingsDoc = await getDoc(doc(db, 'agentpay_settings', 'general'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      if (data.paypalClientId && data.paypalClientSecret) {
        return {
          clientId: data.paypalClientId,
          clientSecret: data.paypalClientSecret,
          mode: data.paypalMode || 'sandbox'
        };
      }
    }
  } catch (err) {
    console.warn('[PayPal] Failed to fetch settings from Firestore, using environment defaults', err);
  }

  return {
    clientId: process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    mode: (process.env.PAYPAL_MODE as 'sandbox' | 'live') || 'sandbox'
  };
}

export function getPayPalBaseUrl(mode: 'sandbox' | 'live'): string {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

export async function getPayPalAccessToken(): Promise<string> {
  const config = await getPayPalConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error('PayPal Client ID or Secret is not configured in settings or environment.');
  }

  // Return cached token if valid for at least another 60 seconds
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const baseUrl = getPayPalBaseUrl(config.mode);
  const authString = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to authenticate with PayPal: ${errText}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000)
  };

  return cachedToken.token;
}

export async function createPayPalOrder(params: {
  amount: number;
  currency?: string;
  referenceId: string;
  description: string;
  returnUrl?: string;
  cancelUrl?: string;
}) {
  const config = await getPayPalConfig();
  const accessToken = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl(config.mode);

  const currency = params.currency || 'USD';
  const amountStr = params.amount.toFixed(2);

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: params.referenceId,
        description: params.description,
        amount: {
          currency_code: currency,
          value: amountStr
        }
      }
    ],
    application_context: {
      brand_name: 'AgentPay AI',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW'
    }
  };

  const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create PayPal order: ${errText}`);
  }

  return await res.json();
}

export async function capturePayPalOrder(paypalOrderId: string) {
  const config = await getPayPalConfig();
  const accessToken = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl(config.mode);

  const res = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to capture PayPal order: ${errText}`);
  }

  return await res.json();
}

export async function executePayPalPayout(params: {
  recipientEmail: string;
  amount: number;
  currency?: string;
  note?: string;
  senderItemId?: string;
}) {
  const config = await getPayPalConfig();
  const accessToken = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl(config.mode);

  const currency = params.currency || 'USD';
  const amountStr = Number(params.amount).toFixed(2);
  const senderBatchId = `AgentPay_Batch_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const senderItemId = params.senderItemId || `item_${Date.now()}`;

  const payload = {
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      recipient_type: 'EMAIL',
      email_subject: 'AgentPay AI: Your Escrow Milestone Payout has been Disbursed!',
      email_message: 'Congratulations! Your earnings from AgentPay AI milestone completion have been disbursed to your PayPal account.'
    },
    items: [
      {
        recipient_type: 'EMAIL',
        amount: {
          value: amountStr,
          currency: currency
        },
        note: params.note || 'AgentPay AI Milestone Escrow Disbursement',
        sender_item_id: senderItemId,
        receiver: params.recipientEmail
      }
    ]
  };

  const res = await fetch(`${baseUrl}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data.details?.[0]?.issue || data.message || data.error_description || JSON.stringify(data);
    throw new Error(`PayPal Payouts API Error (${res.status}): ${errorMsg}`);
  }

  return {
    batchId: data.batch_header?.payout_batch_id || `PAYPAL_BATCH_${Date.now()}`,
    batchStatus: (data.batch_header?.batch_status || 'PENDING') as 'SUCCESS' | 'PENDING' | 'DENIED',
    senderBatchId,
    raw: data
  };
}

