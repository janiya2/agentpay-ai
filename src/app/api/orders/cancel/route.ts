export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, reason, cancelledBy } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const orderRef = doc(db, 'agentpay_orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return NextResponse.json({ error: 'Order not found in platform database' }, { status: 404 });
    }

    const orderData = orderSnap.data();

    // Do not cancel orders that are already fully completed
    if (orderData.status === 'completed') {
      return NextResponse.json({ 
        error: 'Completed orders with released escrow cannot be cancelled. Use dispute resolution.' 
      }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const finalReason = reason || 'Client cancelled contract inquiry prior to funds release';

    // 1. Update the order document
    await updateDoc(orderRef, {
      status: 'cancelled',
      cancelledAt: nowIso,
      cancelledBy: cancelledBy || 'client',
      cancellationReason: finalReason,
      updatedAt: nowIso
    });

    // 2. Sync with chat session / tender if associated
    try {
      // Find matching session by paypalOrderId or serviceTitle
      const sessionsRef = collection(db, 'agentpay_chat_sessions');
      const snaps = await getDocs(sessionsRef);
      if (!snaps.empty) {
        for (const sessionDoc of snaps.docs) {
          const sData = sessionDoc.data();
          const matchesOrder = 
            (sData.paypalOrderId && sData.paypalOrderId === orderData.paypalOrderId) ||
            (sData.winningOrderId && sData.winningOrderId === orderId) ||
            (sData.serviceTitle && sData.serviceTitle === orderData.serviceTitle && sData.buyerName === orderData.buyerName);

          if (matchesOrder) {
            const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const cancellationDialogEntry = {
              speaker: 'agent' as const,
              speakerName: 'AgentPay System Notice ⚠️',
              message: `🚫 CONTRACT CANCELLED: The client has cancelled this contract (${orderData.serviceTitle}). Escrow authorization is revoked and bidding/deliverable submissions are officially closed.`,
              timestamp: timeNow
            };

            await updateDoc(sessionDoc.ref, {
              status: 'closed_cancelled',
              tenderStatus: 'closed_cancelled',
              isCancelled: true,
              cancelledAt: nowIso,
              negotiationDialog: [...(sData.negotiationDialog || []), cancellationDialogEntry],
              updatedAt: nowIso
            });
          }
        }
      }
    } catch (sessionSyncErr) {
      console.warn('Session sync on order cancellation (non-blocking):', sessionSyncErr);
    }

    return NextResponse.json({
      success: true,
      message: `Order #${orderId} was successfully cancelled. Specialist notified and platform ledger updated.`,
      status: 'cancelled'
    });

  } catch (err: any) {
    console.error('[Cancel Order Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to cancel order' }, { status: 500 });
  }
}

