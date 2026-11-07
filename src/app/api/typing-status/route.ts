import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';

export async function GET(req: NextRequest) {
  try {
    const snap = await getDocs(collection(db, 'agentpay_typing_status'));
    const now = Date.now();
    const activeTyping: { [key: string]: { isTyping: boolean; typingUser: string; role: string } } = {};

    snap.docs.forEach(d => {
      const data = d.data();
      // Consider typing active if updated within the last 4 seconds and isTyping is true
      if (data.isTyping && data.updatedAt && now - data.updatedAt < 4000) {
        activeTyping[d.id] = {
          isTyping: true,
          typingUser: data.typingUser || '',
          role: data.role || ''
        };
      }
    });

    return NextResponse.json({ success: true, typing: activeTyping });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch typing status' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetId, isTyping, typingUser, role } = body;

    if (!targetId) {
      return NextResponse.json({ error: 'Missing targetId' }, { status: 400 });
    }

    const docData = {
      targetId,
      isTyping: !!isTyping,
      typingUser: typingUser || '',
      role: role || 'client',
      updatedAt: Date.now()
    };

    await setDoc(doc(db, 'agentpay_typing_status', targetId), docData, { merge: true });

    return NextResponse.json({ success: true, data: docData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update typing status' }, { status: 500 });
  }
}

