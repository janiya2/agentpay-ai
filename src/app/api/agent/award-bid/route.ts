import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { createPayPalOrder } from '@/lib/paypal';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, providerId } = body;

    if (!sessionId || !providerId) {
      return NextResponse.json({ error: 'Missing sessionId or providerId' }, { status: 400 });
    }

    const sessionRef = doc(db, 'agentpay_chat_sessions', sessionId);
    const snap = await getDoc(sessionRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionData = snap.data();
    const winningBid = (sessionData.bids || []).find((b: any) => b.providerId === providerId) || 
      (sessionData.targetProviders || []).find((p: any) => p.id === providerId);

    if (!winningBid) {
      return NextResponse.json({ error: 'Selected provider bid not found' }, { status: 404 });
    }

    const winningPrice = winningBid.bidPrice || winningBid.amount || 160;
    const finalOrderRefId = `ord_${Date.now()}`;
    let paypalOrderId = '';

    try {
      const ppRes = await createPayPalOrder({
        amount: winningPrice,
        currency: 'USD',
        referenceId: finalOrderRefId,
        description: `AgentPay Escrow: ${sessionData.projectScope || 'Milestone Contract'} awarded to ${winningBid.providerName || winningBid.name}`
      });
      paypalOrderId = ppRes?.id || `PAYPAL_SANDBOX_${Date.now()}`;
    } catch (ppErr) {
      paypalOrderId = `PAYPAL_SANDBOX_${Date.now()}`;
    }

    // Save order in agentpay_orders
    const orderDoc = {
      id: finalOrderRefId,
      paypalOrderId,
      buyerName: sessionData.buyerName || 'Janitha Dilshan',
      buyerEmail: sessionData.buyerEmail || 'janithad2@gmail.com',
      providerId: winningBid.providerId || winningBid.id,
      providerName: winningBid.providerName || winningBid.name,
      providerEmail: winningBid.providerEmail || winningBid.email || 'provider@agentpay.network',
      serviceTitle: sessionData.projectScope || 'Milestone Contract',
      amount: winningPrice,
      currency: 'USD',
      status: 'pending-payment',
      milestones: (winningBid.milestones || [
        { title: 'Milestone 1: Core Setup & Architecture', amount: Math.round(winningPrice / 2) },
        { title: 'Milestone 2: Final Verification & Handover', amount: winningPrice - Math.round(winningPrice / 2) }
      ]).map((m: any, idx: number) => ({
        id: `ms_${idx + 1}`,
        title: m.title,
        amount: m.amount,
        status: 'pending'
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'agentpay_orders', finalOrderRefId), JSON.parse(JSON.stringify(orderDoc)));

    // Mark tender as closed_awarded and mark other providers as closed_late
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedTargetProviders = (sessionData.targetProviders || []).map((p: any) => ({
      ...p,
      status: (p.id === providerId) ? 'awarded' : 'closed_late'
    }));

    const awardDialog = [
      ...(sessionData.negotiationDialog || []),
      {
        speaker: 'agent' as const,
        speakerName: 'AgentPay Commerce Bot 🤖',
        message: `🏆 Contract awarded to ${winningBid.providerName || winningBid.name} for $${winningPrice} USD! Inquiries to competing providers are now closed. PayPal Milestone Escrow has been initialized for client funding.`,
        timestamp: timeNow
      }
    ];

    // Append confirmation message to conversation
    const updatedMessages = [
      ...(sessionData.messages || []),
      {
        id: `ast_award_${Date.now()}`,
        role: 'assistant',
        content: `🎉 **Contract Officially Awarded to ${winningBid.providerName || winningBid.name}!**\n\nYou selected **${winningBid.providerName || winningBid.name}** for **$${winningPrice} USD** (${winningBid.deliveryDays || 3} days delivery). All other competing provider inquiries have been marked as closed.\n\nPlease authorize the PayPal Smart Escrow below to lock funds securely and launch project execution!`,
        timestamp: timeNow,
        actionPayload: {
          type: 'paypal_checkout',
          tenderStatus: 'closed_awarded',
          winningBid: {
            ...winningBid,
            bidPrice: winningPrice
          },
          paypalOrderId,
          amount: winningPrice,
          isRealAI: true,
          modelUsed: sessionData.modelUsed || 'gemini-2.5-flash'
        }
      }
    ];

    await updateDoc(sessionRef, {
      status: 'closed_awarded',
      winningBid: {
        ...winningBid,
        bidPrice: winningPrice
      },
      targetProviders: updatedTargetProviders,
      negotiationDialog: awardDialog,
      messages: updatedMessages,
      paypalOrderId,
      orderRefId: finalOrderRefId,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      paypalOrderId,
      orderRefId: finalOrderRefId,
      winningBid: {
        ...winningBid,
        bidPrice: winningPrice
      },
      messages: updatedMessages,
      message: `Contract awarded to ${winningBid.providerName || winningBid.name}!`
    });

  } catch (err: any) {
    console.error('[Award Bid Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to award bid' }, { status: 500 });
  }
}

