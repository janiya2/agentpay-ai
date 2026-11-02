import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId parameter' }, { status: 400 });
    }

    const q = query(
      collection(db, 'agentpay_direct_messages'),
      where('orderId', '==', orderId)
    );
    const snap = await getDocs(q);
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort chronologically
    messages.sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

    return NextResponse.json({ success: true, messages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, senderRole, senderName, senderAvatar, message } = body;

    if (!orderId || !message || !senderRole) {
      return NextResponse.json({ error: 'Missing required message parameters' }, { status: 400 });
    }

    const docData = {
      orderId,
      senderRole, // 'client' | 'provider'
      senderName: senderName || (senderRole === 'client' ? 'Client' : 'Provider'),
      senderAvatar: senderAvatar || '',
      message: message.trim(),
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'agentpay_direct_messages'), docData);

    return NextResponse.json({
      success: true,
      messageId: docRef.id,
      data: docData
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to send message' }, { status: 500 });
  }
}

