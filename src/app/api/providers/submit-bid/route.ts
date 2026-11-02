import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, providerId, bidPrice, deliveryDays = 3, note, milestones } = body;

    if (!sessionId || !providerId) {
      return NextResponse.json({ error: 'Missing sessionId or providerId' }, { status: 400 });
    }

    const sessionRef = doc(db, 'agentpay_chat_sessions', sessionId);
    const snap = await getDoc(sessionRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Tender session not found' }, { status: 404 });
    }

    const sessionData = snap.data();

    // CHECK RACE CONDITION: Has the client already awarded this contract to someone else?
    if (sessionData.status === 'closed_awarded') {
      const winner = sessionData.winningBid || {};
      return NextResponse.json({
        success: false,
        isLate: true,
        error: `🚫 Opportunity Closed (Late Bid): The client has already awarded this contract to ${winner.providerName || 'another specialist'} ($${winner.bidPrice || winner.amount} USD) and locked funds in PayPal Sandbox Escrow. Thank you for your interest!`
      }, { status: 409 });
    }

    const budgetCap = sessionData.spendingLimit || 200;
    const price = Number(bidPrice) || Math.round(budgetCap * 0.8) || 160;

    // ENFORCE CLIENT BUDGET CAP: Reject any bid exceeding authorized client spending limit
    if (price > budgetCap) {
      return NextResponse.json({
        success: false,
        error: `🚫 Budget Exceeded: Your proposed bid of $${price} USD exceeds the client's maximum authorized budget cap of $${budgetCap} USD. Please adjust your bid to $${budgetCap} USD or less.`
      }, { status: 400 });
    }

    const ms1 = Math.round(price / 2);
    const ms2 = price - ms1;

    // Find provider details
    let providerName = 'Specialist';
    let providerAvatar = '';
    let providerEmail = 'provider@agentpay.network';
    const targetProv = (sessionData.targetProviders || []).find((p: any) => p.id === providerId);
    if (targetProv) {
      providerName = targetProv.name;
      providerAvatar = targetProv.avatarUrl;
      providerEmail = targetProv.email;
    }

    const newBid = {
      providerId,
      providerName,
      providerAvatar,
      providerEmail,
      bidPrice: price,
      deliveryDays: Number(deliveryDays) || 3,
      note: note?.trim() || `I have verified capacity and will deliver within ${deliveryDays} days with full documentation.`,
      milestones: milestones || [
        { title: 'Milestone 1: Core Setup & Architecture', amount: ms1 },
        { title: 'Milestone 2: Final Verification & Handover', amount: ms2 }
      ],
      submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'submitted'
    };

    // Update target provider status in targetProviders array
    const updatedTargetProviders = (sessionData.targetProviders || []).map((p: any) => 
      p.id === providerId ? { ...p, status: 'bid_received', bidPrice: price } : p
    );

    // Upsert into bids array
    const currentBids = sessionData.bids || [];
    const filteredBids = currentBids.filter((b: any) => b.providerId !== providerId);
    const updatedBids = [...filteredBids, newBid];

    // Append dialogue message
    const currentDialog = sessionData.negotiationDialog || [];
    const providerDialogEntry = {
      speaker: 'provider' as const,
      speakerName: `${providerName} 👨‍💻 (Specialist Bid)`,
      message: `Submitted official bid of $${price} USD (${newBid.deliveryDays} days turnaround, 2 milestones). Note: "${newBid.note}"`,
      timestamp: newBid.submittedAt
    };

    // Also update last message's actionPayload if present
    const updatedMessages = (sessionData.messages || []).map((m: any, idx: number) => {
      if (idx === (sessionData.messages?.length || 1) - 1 && m.actionPayload) {
        return {
          ...m,
          actionPayload: {
            ...m.actionPayload,
            bids: updatedBids,
            targetProviders: updatedTargetProviders
          }
        };
      }
      return m;
    });

    await updateDoc(sessionRef, {
      bids: updatedBids,
      targetProviders: updatedTargetProviders,
      messages: updatedMessages,
      negotiationDialog: [...currentDialog, providerDialogEntry],
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Bid of $${price} USD submitted successfully!`,
      bid: newBid
    });

  } catch (err: any) {
    console.error('[Submit Bid Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit bid' }, { status: 500 });
  }
}

