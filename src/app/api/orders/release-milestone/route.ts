import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, milestoneIndex } = body;

    if (!orderId || typeof milestoneIndex !== 'number') {
      return NextResponse.json({ error: 'Missing orderId or milestoneIndex' }, { status: 400 });
    }

    const orderRef = doc(db, 'agentpay_orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return NextResponse.json({ error: 'Order not found in Firestore' }, { status: 404 });
    }

    const orderData = orderSnap.data();
    const milestones = orderData.milestones || [];

    if (!milestones[milestoneIndex]) {
      return NextResponse.json({ error: 'Milestone index out of bounds' }, { status: 400 });
    }

    // Mark milestone as released
    milestones[milestoneIndex].status = 'released';
    milestones[milestoneIndex].releasedAt = new Date().toISOString();

    const allReleased = milestones.every((m: any) => m.status === 'released');
    const newStatus = allReleased ? 'completed' : 'in-escrow';

    await updateDoc(orderRef, {
      milestones,
      status: newStatus,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Milestone ${milestoneIndex + 1} (${milestones[milestoneIndex].title}) released successfully!`,
      status: newStatus,
      milestones
    });

  } catch (err: any) {
    console.error('[Release Milestone Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to release milestone' }, { status: 500 });
  }
}

