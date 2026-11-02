import { Resend } from 'resend';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

interface EmailConfig {
  apiKey: string;
  fromEmail: string;
}

export async function getEmailConfig(): Promise<EmailConfig> {
  try {
    const settingsDoc = await getDoc(doc(db, 'agentpay_settings', 'general'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      if (data.resendApiKey) {
        return {
          apiKey: data.resendApiKey,
          fromEmail: data.resendFromEmail || 'onboarding@resend.dev'
        };
      }
    }
  } catch (err) {
    console.warn('[Resend] Could not load Firestore settings, using env default', err);
  }

  return {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  };
}

export async function sendProviderNegotiationAlert(params: {
  providerEmail: string;
  providerName: string;
  buyerName: string;
  serviceTitle: string;
  agreedPrice: number;
  deliveryDays: number;
  orderId: string;
}) {
  const config = await getEmailConfig();

  if (!config.apiKey) {
    console.warn('[Resend] Skipping email dispatch: RESEND_API_KEY is not configured yet.');
    return { skipped: true };
  }

  try {
    const resend = new Resend(config.apiKey);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; background: #090A0F; color: #F3F4F6; padding: 32px; border-radius: 16px; border: 1px solid #1E2438;">
        <div style="border-bottom: 1px solid #1E2438; padding-bottom: 16px; margin-bottom: 24px;">
          <h2 style="color: #00CFDE; margin: 0;">🤖 AgentPay AI — New Autonomous Match!</h2>
          <p style="color: #9CA3AF; font-size: 14px; margin-top: 4px;">An autonomous commerce agent just negotiated an agreement on your behalf.</p>
        </div>

        <p style="font-size: 16px;">Hello <strong>${params.providerName}</strong>,</p>
        <p style="color: #D1D5DB; line-height: 1.6;">
          Client <strong>${params.buyerName}</strong> has authorized an autonomous PayPal milestone order for your service:
        </p>

        <div style="background: #111420; border: 1px solid #2A324B; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0; color: #9CA3AF; font-size: 13px;">SERVICE</p>
          <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: bold; color: #FFFFFF;">${params.serviceTitle}</p>
          
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #1E2438; padding-top: 12px;">
            <div>
              <span style="color: #9CA3AF; font-size: 13px;">MILESTONE ESCROW</span><br>
              <strong style="color: #FFC439; font-size: 20px;">$${params.agreedPrice.toFixed(2)} USD</strong>
            </div>
            <div>
              <span style="color: #9CA3AF; font-size: 13px;">ESTIMATED DELIVERY</span><br>
              <strong style="color: #FFFFFF; font-size: 16px;">${params.deliveryDays} Days</strong>
            </div>
          </div>
        </div>

        <p style="color: #9CA3AF; font-size: 14px;">
          Funds have been locked in the PayPal Smart Escrow. Please visit your <strong>AgentPay Provider Portal</strong> to review deliverables and begin execution.
        </p>

        <div style="margin-top: 32px; border-top: 1px solid #1E2438; padding-top: 16px; font-size: 12px; color: #6B7280;">
          Order ID: <code>${params.orderId}</code> • Powered by PayPal Orders v2 & Google Gemini 2.5
        </div>
      </div>
    `;

    const result = await resend.emails.send({
      from: config.fromEmail,
      to: params.providerEmail,
      subject: `🤖 [AgentPay AI] New $${params.agreedPrice} Milestone Proposal from ${params.buyerName}`,
      html: emailHtml
    });

    return { success: true, result };
  } catch (err) {
    console.error('[Resend] Failed to send email alert:', err);
    return { success: false, error: err };
  }
}
