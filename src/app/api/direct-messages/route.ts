import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, addDoc, updateDoc } from 'firebase/firestore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId') || '';
    const channelId = searchParams.get('channelId') || '';
    const providerId = searchParams.get('providerId') || '';
    const providerName = searchParams.get('providerName') || '';
    const sessionId = searchParams.get('sessionId') || '';

    if (!orderId && !channelId && !providerId && !providerName) {
      return NextResponse.json({ error: 'Missing required search parameters' }, { status: 400 });
    }

    const keySet = new Set<string>();
    if (orderId) keySet.add(orderId);
    if (channelId) keySet.add(channelId);
    if (providerId) keySet.add(providerId);

    // 1. Cross-reference with agentpay_orders for orderId or channelId if specific order ref
    const targetOrdId = orderId.startsWith('ord_') ? orderId : (channelId.startsWith('ord_') ? channelId : null);
    if (targetOrdId) {
      try {
        const ordDoc = await getDoc(doc(db, 'agentpay_orders', targetOrdId));
        if (ordDoc.exists()) {
          const od = ordDoc.data();
          if (od.providerId) keySet.add(od.providerId);
          if (od.providerName) keySet.add(od.providerName);
          if (od.sessionId) {
            keySet.add(od.sessionId);
            if (od.providerId) keySet.add(`${od.sessionId}_${od.providerId}`);
          }
        }
      } catch (e) {
        // silent
      }
    }

    // 2. If channelId looks like session_xxx_prov_yyy, extract providerId and session
    if (channelId.includes('_prov_')) {
      const pIdx = channelId.indexOf('_prov_');
      const pId = channelId.slice(pIdx + 1); // 'prov_yyy'
      const sId = channelId.slice(0, pIdx);
      if (pId) keySet.add(pId);
      if (sId) keySet.add(sId);
    }

    const uniqueKeys = Array.from(keySet).filter(Boolean);
    const messagesMap = new Map<string, any>();
    const parallelQueries: Promise<any>[] = [];

    // Query messages by orderId and channelId in parallel
    if (uniqueKeys.length > 0) {
      for (let i = 0; i < uniqueKeys.length; i += 10) {
        const chunk = uniqueKeys.slice(i, i + 10);
        
        parallelQueries.push(
          getDocs(query(collection(db, 'agentpay_direct_messages'), where('orderId', 'in', chunk)))
            .then(snap => snap.docs.forEach(d => messagesMap.set(d.id, { id: d.id, ...d.data() })))
            .catch(err => console.warn('qOrder fetch warning:', err))
        );

        parallelQueries.push(
          getDocs(query(collection(db, 'agentpay_direct_messages'), where('channelId', 'in', chunk)))
            .then(snap => snap.docs.forEach(d => messagesMap.set(d.id, { id: d.id, ...d.data() })))
            .catch(err => console.warn('qChannel fetch warning:', err))
        );
      }
    }

    // If providerName was provided, also check messages with matching providerName
    if (providerName) {
      parallelQueries.push(
        getDocs(query(collection(db, 'agentpay_direct_messages'), where('providerName', '==', providerName)))
          .then(snap => snap.docs.forEach(d => messagesMap.set(d.id, { id: d.id, ...d.data() })))
          .catch(() => {})
      );
    }

    await Promise.all(parallelQueries);

    const messages = Array.from(messagesMap.values());
    // Sort chronologically
    messages.sort((a: any, b: any) => new Date(a.createdAt || a.timestamp || 0).getTime() - new Date(b.createdAt || b.timestamp || 0).getTime());

    return NextResponse.json({ success: true, messages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      orderId, 
      channelId, 
      providerId, 
      providerName, 
      sessionId, 
      senderRole, 
      senderName, 
      senderAvatar, 
      message 
    } = body;

    const primaryKey = orderId || channelId;
    if (!primaryKey || !message || !senderRole) {
      return NextResponse.json({ error: 'Missing required message parameters' }, { status: 400 });
    }

    const docData: any = {
      orderId: orderId || channelId,
      channelId: channelId || orderId,
      senderRole, // 'client' | 'provider'
      senderName: senderName || (senderRole === 'client' ? 'Client' : 'Provider'),
      senderAvatar: senderAvatar || '',
      message: message.trim(),
      createdAt: new Date().toISOString(),
      isSeen: false,
      seenAt: null,
      status: 'sent'
    };

    if (providerId) docData.providerId = providerId;
    if (providerName) docData.providerName = providerName;
    if (sessionId) docData.sessionId = sessionId;

    // If provider details are missing, attempt lookup from agentpay_orders
    if ((!providerId || !providerName) && primaryKey.startsWith('ord_')) {
      try {
        const ordDoc = await getDoc(doc(db, 'agentpay_orders', primaryKey));
        if (ordDoc.exists()) {
          const od = ordDoc.data();
          if (!docData.providerId && od.providerId) docData.providerId = od.providerId;
          if (!docData.providerName && od.providerName) docData.providerName = od.providerName;
          if (!docData.sessionId && od.sessionId) docData.sessionId = od.sessionId;
        }
      } catch (e) {
        // silent
      }
    }

    const docRef = await addDoc(collection(db, 'agentpay_direct_messages'), docData);

    // Autonomous AI Receptionist Auto-Reply Engine (Per user request)
    // If client sent a message, check if provider has enabled AI Auto-Reply
    let autoReplyMessage: any = null;

    if (senderRole === 'client') {
      try {
        let pId = docData.providerId;
        let aiAutoReplyEnabled = true;
        let aiCustomNote = '';
        let providerAvatar = docData.senderAvatar || '';

        // If providerId wasn't passed directly, resolve from name
        if (!pId && docData.providerName) {
          try {
            const qP = query(collection(db, 'agentpay_providers'), where('name', '==', docData.providerName));
            const snapP = await getDocs(qP);
            if (!snapP.empty) {
              pId = snapP.docs[0].id;
              docData.providerId = pId;
            }
          } catch (e) {
            // fallback
          }
        }

        if (pId) {
          const provSnap = await getDoc(doc(db, 'agentpay_providers', pId));
          if (provSnap.exists()) {
            const pd = provSnap.data();
            if (pd.aiAutoReplyEnabled === false) aiAutoReplyEnabled = false;
            if (pd.aiAutoReplyCustomNote) aiCustomNote = pd.aiAutoReplyCustomNote;
            if (pd.avatarUrl) providerAvatar = pd.avatarUrl;
          }
        }

        if (aiAutoReplyEnabled) {
          const clientFirst = (docData.senderName || 'Client').split(' ')[0];
          const provFirst = (docData.providerName || 'Specialist').split(' ')[0];
          const lowerMsg = (docData.message || '').toLowerCase();

          let replyBody = '';
          if (aiCustomNote) {
            replyBody = `Hi ${clientFirst}! 👋 I am ${provFirst}'s AI Delegate. ${provFirst} is away from desk right now (${aiCustomNote}). I've queued your message and ${provFirst} will review it as soon as they're back!`;
          } else if (lowerMsg.includes('time') || lowerMsg.includes('when') || lowerMsg.includes('day') || lowerMsg.includes('deadline')) {
            replyBody = `Hi ${clientFirst}! 👋 I am ${provFirst}'s AI Receptionist Delegate. ${provFirst} received your timeline note and will review our schedule as soon as they're online. In the meantime, feel free to share any repo or Figma links!`;
          } else if (lowerMsg.includes('price') || lowerMsg.includes('budget') || lowerMsg.includes('cost') || lowerMsg.includes('$')) {
            replyBody = `Hello ${clientFirst}! 👋 I've logged your note regarding project pricing for ${provFirst}. ${provFirst} will inspect the scope and confirm terms shortly upon return!`;
          } else if (lowerMsg.includes('hi') || lowerMsg.includes('hello') || lowerMsg.includes('hey')) {
            replyBody = `Hello ${clientFirst}! 👋 I am ${provFirst}'s Autonomous AI Receptionist. ${provFirst} is currently away from direct chat, but has received your ping. Please hang tight and ${provFirst} will reply directly!`;
          } else {
            replyBody = `Hi ${clientFirst}! 👋 Thank you for your message. I am ${provFirst}'s AI Delegate — ${provFirst} is currently offline, but your message has been safely logged. ${provFirst} will review this directly upon return!`;
          }

          const autoReplyDoc = {
            orderId: docData.orderId,
            channelId: docData.channelId,
            providerId: docData.providerId,
            providerName: docData.providerName,
            sessionId: docData.sessionId,
            senderRole: 'provider',
            senderName: docData.providerName,
            senderAvatar: providerAvatar,
            message: replyBody,
            createdAt: new Date(Date.now() + 800).toISOString(),
            isSeen: false,
            isAiAutoReply: true,
            status: 'sent'
          };

          const replyRef = await addDoc(collection(db, 'agentpay_direct_messages'), autoReplyDoc);
          autoReplyMessage = { id: replyRef.id, ...autoReplyDoc };
        }
      } catch (autoErr) {
        console.warn('AI Auto-reply delegate notice:', autoErr);
      }
    }

    return NextResponse.json({
      success: true,
      messageId: docRef.id,
      data: docData,
      autoReply: autoReplyMessage
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to send message' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageIds, orderId, channelId, providerId, seenByRole } = body;
    const now = new Date().toISOString();

    // 1. If explicit messageIds provided
    if (Array.isArray(messageIds) && messageIds.length > 0) {
      const promises = messageIds.map(id => 
        updateDoc(doc(db, 'agentpay_direct_messages', id), {
          isSeen: true,
          status: 'seen',
          seenAt: now
        })
      );
      await Promise.all(promises);
      return NextResponse.json({ success: true, count: messageIds.length });
    }

    // 2. Or mark messages in thread/order as seen
    const key = orderId || channelId || providerId;
    if (key) {
      const q = query(
        collection(db, 'agentpay_direct_messages'),
        where('orderId', '==', key)
      );
      const snap = await getDocs(q);
      const updates: Promise<any>[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        if ((!seenByRole || data.senderRole !== seenByRole) && !data.isSeen) {
          updates.push(updateDoc(doc(db, 'agentpay_direct_messages', d.id), {
            isSeen: true,
            status: 'seen',
            seenAt: now
          }));
        }
      });
      await Promise.all(updates);
      return NextResponse.json({ success: true, updatedCount: updates.length });
    }

    return NextResponse.json({ error: 'Missing target parameters' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update seen status' }, { status: 500 });
  }
}
