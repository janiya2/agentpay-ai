import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, addDoc, collection } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, revisionNotes, issues = [] } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId parameter' }, { status: 400 });
    }

    if (!revisionNotes || !revisionNotes.trim()) {
      return NextResponse.json({ error: 'Please provide revision notes or feedback for the specialist.' }, { status: 400 });
    }

    const orderRef = doc(db, 'agentpay_orders', orderId);
    const snap = await getDoc(orderRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Order not found in Firestore' }, { status: 404 });
    }

    const orderData = snap.data();
    const deliverableVersion = orderData.deliverable?.version || 1;

    // 1. Update order status and attach revision details
    await updateDoc(orderRef, {
      deliverableStatus: 'changes_requested',
      revisionNotes: revisionNotes.trim(),
      revisionIssues: issues,
      revisionRequestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // 2. Dispatch official notification message into direct client-specialist message thread
    try {
      await addDoc(collection(db, 'agentpay_direct_messages'), {
        orderId,
        channelId: orderId,
        sessionId: orderData.sessionId || '',
        providerId: orderData.providerId || '',
        providerName: orderData.providerName || '',
        senderRole: 'client',
        senderName: orderData.buyerName || 'Client',
        senderEmail: orderData.buyerEmail || '',
        senderAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(orderData.buyerName || 'client')}&backgroundColor=b6e3f4`,
        message: `⚠️ [REVISION REQUEST FOR DELIVERABLE v${deliverableVersion}]:\n${revisionNotes.trim()}`,
        createdAt: new Date().toISOString(),
        isSeen: false,
        status: 'sent',
        isRevisionNotice: true
      });
    } catch (msgErr) {
      console.warn('Failed to insert revision direct message:', msgErr);
    }

    return NextResponse.json({
      success: true,
      message: `Revision request for Deliverable v${deliverableVersion} transmitted to ${orderData.providerName}.`,
      deliverableStatus: 'changes_requested',
      revisionNotes: revisionNotes.trim(),
      revisionIssues: issues
    });
  } catch (err: any) {
    console.error('Request revision error:', err);
    return NextResponse.json({ error: err.message || 'Failed to request revisions' }, { status: 500 });
  }
}
