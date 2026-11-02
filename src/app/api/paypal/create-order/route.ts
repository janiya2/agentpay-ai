import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder } from '@/lib/paypal';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency = 'USD', providerId, providerName, providerEmail, serviceTitle, buyerName, buyerEmail, milestones } = body;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valid amount is required.' }, { status: 400 });
    }

    const orderReferenceId = `ord_${Date.now()}`;

    // Create PayPal Order on PayPal Sandbox
    const paypalOrder = await createPayPalOrder({
      amount: Number(amount),
      currency,
      referenceId: orderReferenceId,
      description: `AgentPay AI Escrow: ${serviceTitle || 'Professional Services'}`
    });

    const paypalOrderId = paypalOrder.id;

    // Save pending order to Firestore
    const orderData = {
      id: orderReferenceId,
      paypalOrderId,
      amount: Number(amount),
      currency,
      buyerName: buyerName || 'Verified Client',
      buyerEmail: buyerEmail || 'client@innoxpert-agents.io',
      providerId: providerId || 'prov_unknown',
      providerName: providerName || 'Assigned Provider',
      providerEmail: providerEmail || 'provider@innoxpert-agents.io',
      serviceTitle: serviceTitle || 'Autonomous Service Deliverable',
      status: 'pending-payment',
      milestones: milestones || [
        { id: 'm1', title: 'Initial Milestone Draft', amount: Number(amount), status: 'pending' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'agentpay_orders', orderReferenceId), orderData);

    return NextResponse.json({
      success: true,
      orderId: orderReferenceId,
      paypalOrderId
    });

  } catch (err: any) {
    console.error('[PayPal Create Order Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to create PayPal order' }, { status: 500 });
  }
}
