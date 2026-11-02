import { NextRequest, NextResponse } from 'next/server';
import { capturePayPalOrder } from '@/lib/paypal';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { sendProviderNegotiationAlert } from '@/lib/resend';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paypalOrderId, orderId } = body;

    if (!paypalOrderId || !orderId) {
      return NextResponse.json({ error: 'Missing paypalOrderId or orderId' }, { status: 400 });
    }

    // 1. Capture PayPal order on PayPal Sandbox
    const captureResult = await capturePayPalOrder(paypalOrderId);
    const captureId = captureResult.purchase_units?.[0]?.payments?.captures?.[0]?.id || '';

    // 2. Update Firestore Order to 'in-escrow'
    const orderRef = doc(db, 'agentpay_orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (orderSnap.exists()) {
      const orderData = orderSnap.data();

      await updateDoc(orderRef, {
        status: 'in-escrow',
        paypalCaptureId: captureId,
        updatedAt: new Date().toISOString()
      });

      // 3. Dispatch Resend Email Alert to Service Provider
      sendProviderNegotiationAlert({
        providerEmail: orderData.providerEmail,
        providerName: orderData.providerName,
        buyerName: orderData.buyerName,
        serviceTitle: orderData.serviceTitle,
        agreedPrice: orderData.amount,
        deliveryDays: 3,
        orderId: orderData.id
      }).catch(err => console.warn('[Resend Async Error]:', err));
    }

    return NextResponse.json({
      success: true,
      status: 'in-escrow',
      captureId
    });

  } catch (err: any) {
    console.error('[PayPal Capture Order Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to capture PayPal order' }, { status: 500 });
  }
}
