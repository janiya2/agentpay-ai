import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, providerId, message } = body;

    if (!sessionId || !providerId || !message?.trim()) {
      return NextResponse.json({ error: 'Missing sessionId, providerId or message' }, { status: 400 });
    }

    const sessionRef = doc(db, 'agentpay_chat_sessions', sessionId);
    const snap = await getDoc(sessionRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Tender session not found' }, { status: 404 });
    }

    const sessionData = snap.data();
    const targetProv = (sessionData.targetProviders || []).find((p: any) => p.id === providerId);
    const providerName = targetProv ? targetProv.name : 'Specialist';

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newEntry = {
      speaker: 'provider' as const,
      speakerName: `${providerName} 👨‍💻 (Specialist Message)`,
      message: message.trim(),
      timestamp: timeNow
    };

    const currentDialog = sessionData.negotiationDialog || [];
    const updatedDialog = [...currentDialog, newEntry];

    // Also update last message's negotiationDialog in messages array if present
    const updatedMessages = (sessionData.messages || []).map((m: any, idx: number) => {
      if (idx === (sessionData.messages?.length || 1) - 1 && m.actionPayload) {
        return {
          ...m,
          actionPayload: {
            ...m.actionPayload,
            negotiationDialog: updatedDialog
          }
        };
      }
      return m;
    });

    await updateDoc(sessionRef, {
      negotiationDialog: updatedDialog,
      messages: updatedMessages,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Message sent successfully into tender dialogue',
      entry: newEntry
    });

  } catch (err: any) {
    console.error('[Send Tender Message Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to send message' }, { status: 500 });
  }
}
