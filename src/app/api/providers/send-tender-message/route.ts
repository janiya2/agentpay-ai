export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { geminiRotator } from '@/lib/gemini-rotator';

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
    const clientName = sessionData.buyerName || 'Janitha Dilshan';
    const budgetCap = sessionData.spendingLimit || 200;
    const projectScope = sessionData.projectScope || 'Digital Milestone Contract';

    // Extract client's actual specifications & user prompts
    let clientRequirements = sessionData.latestPrompt || '';
    if (!clientRequirements && Array.isArray(sessionData.messages)) {
      const userMsgs = sessionData.messages.filter((m: any) => m.role === 'user');
      if (userMsgs.length > 0) {
        clientRequirements = userMsgs.map((m: any) => m.content).join('; ');
      }
    }
    if (!clientRequirements) {
      clientRequirements = `${sessionData.categoryMatched || 'custom software / design'} deliverable`;
    }

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const providerEntry = {
      speaker: 'provider' as const,
      speakerName: `${providerName} 👨‍💻 (Specialist Message)`,
      message: message.trim(),
      timestamp: timeNow
    };

    const currentDialog = sessionData.negotiationDialog || [];
    const dialogWithProvider = [...currentDialog, providerEntry];

    // Generate Autonomous Bot Reply to Provider
    let botReplyText = '';
    const lower = message.trim().toLowerCase();

    // Parse potential price numbers from provider message (e.g. "160$", "$160", "160 USD", "bid 160", "my bid 160$")
    let detectedNumber: number | null = null;
    const numWords = message.match(/\b(\d{2,4})\b/g);
    if (numWords && numWords.length > 0) {
      for (const rawNum of numWords) {
        const parsed = Number(rawNum);
        if (!isNaN(parsed) && parsed >= 30 && parsed <= 2500) {
          detectedNumber = parsed;
          break;
        }
      }
    }
    if (!detectedNumber) {
      const priceWithSign = message.match(/(?:\$|usd)?\s*(\d{2,4})\s*(?:\$|usd)?/i);
      if (priceWithSign && priceWithSign[1]) {
        const parsed = Number(priceWithSign[1]);
        if (!isNaN(parsed) && parsed >= 30 && parsed <= 2500) {
          detectedNumber = parsed;
        }
      }
    }

    // Parse potential delivery days from provider message (e.g. "4 days", "4 dyas", "5 d", "in 3 days", "3d")
    const daysMatch = message.match(/(\d{1,2})\s*(?:days?|dyas?|d\b)/i);
    let detectedDays: number | null = null;
    if (daysMatch) {
      const parsedDays = Number(daysMatch[1]);
      if (!isNaN(parsedDays) && parsedDays >= 1 && parsedDays <= 30) {
        detectedDays = parsedDays;
      }
    }

    try {
      await geminiRotator.loadKeysFromFirestore();
      botReplyText = await geminiRotator.executeWithRotation(async (genAI) => {
        const candidateModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-pro'];
        const prompt = `
You are AgentPay Commerce Bot 🤖, an institutional autonomous AI procurement agent representing client ${clientName}.
You are in an active RFP negotiation with specialist ${providerName} for project: "${projectScope}".

CLIENT'S ACTUAL PROJECT SPECIFICATION & SCOPE:
"${clientRequirements}"

CLIENT MAXIMUM BUDGET CAP: $${budgetCap} USD.

Dialogue history:
${dialogWithProvider.map((d: any) => `${d.speakerName}: ${d.message}`).join('\n')}

Specialist ${providerName} just sent: "${message.trim()}"

Your strategic negotiation instructions:
1. QUESTIONS ABOUT WHAT NEEDS TO BE DEVELOPED / SCOPE / STACK:
   - Provide a concise, accurate overview of the client's actual requirement: "${clientRequirements}".
   - Explain the key deliverables and state ${clientName}'s strict budget cap of $${budgetCap} USD.
   - Ask for their turnaround and proposed milestone terms within this cap.

2. OVER-BUDGET PROPOSALS (If ${providerName} asks for or proposes a price HIGHER than $${budgetCap} USD, e.g. $210):
   - FIRMLY DECLINE THE HIGHER RATE: State that ${clientName}'s maximum authorized budget cap is strictly $${budgetCap} USD and cannot be exceeded.
   - PERSUADE THEM TO AGREE: Counter-offer at $${budgetCap} USD (or $${Math.round(budgetCap * 0.95)} USD). Explain that ${clientName} pays promptly via secured PayPal Milestone Escrow upon completion, and urge them to accommodate $${budgetCap} USD so they do not lose the contract to competing specialists.

3. WITHIN-BUDGET PROPOSALS (If ${providerName} proposes a price AT OR BELOW $${budgetCap} USD, e.g. "160$ my bid", "$160", "$150 in 3 days"):
   - CONFIRM AND OFFICIALLY SUBMIT THE BID: Express enthusiasm and confirm that you have immediately codified and officially submitted their milestone bid of $${detectedNumber || 160} USD (${detectedDays || 3} days turnaround) directly to client ${clientName}'s live procurement decision board!
   - INFORM CLIENT NOTIFICATION: State that client ${clientName} has been alerted in real-time to review their bid and authorize PayPal Sandbox Escrow.

4. GREETINGS:
   - Greet ${providerName} warmly, state what ${clientName} is looking to procure ("${clientRequirements}"), and state the $${budgetCap} USD budget cap.

Rules:
- Speak directly to ${providerName}.
- Keep your tone sharp, polite, and persuasive (2 to 4 complete sentences).
- Do NOT say "detailed specs will be provided later". Answer with the actual client requirements: "${clientRequirements}".
- Do NOT truncate. Write the entire complete response without trailing off.

Provide ONLY the text of your response:
        `.trim();

        for (const modelName of candidateModels) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: { 
                temperature: 0.3, 
                maxOutputTokens: 1200 
              }
            });
            const res = await model.generateContent(prompt);
            const text = res.response.text();
            if (text && text.trim().length > 10) return text.trim();
          } catch (mErr: any) {
            if (mErr?.message?.includes('404')) continue;
            throw mErr;
          }
        }
        throw new Error('All models exhausted');
      });
    } catch (aiErr) {
      console.warn('[Bot Reply AI Fallback]:', aiErr);
      if (detectedNumber) {
        if (detectedNumber > budgetCap) {
          botReplyText = `I appreciate your proposal, ${providerName.split(' ')[0]}. However, our client ${clientName}'s strict budget cap is $${budgetCap} USD, so we cannot approve $${detectedNumber} USD. Could you accommodate ${clientName}'s $${budgetCap} USD cap? If you can agree to $${budgetCap} USD, please submit your bid below so we can lock in this contract for you!`;
        } else {
          botReplyText = `🎉 Official Bid of $${detectedNumber} USD Codified! I have immediately submitted your milestone proposal of $${detectedNumber} USD (${detectedDays || 3} days turnaround) directly to client ${clientName}'s decision board. The client has been alerted to review your bid and lock PayPal Escrow!`;
        }
      } else if (lower.includes('what') || lower.includes('scope') || lower.includes('develop') || lower.includes('stack')) {
        botReplyText = `Hello ${providerName.split(' ')[0]}! Client ${clientName} requires: "${clientRequirements}". The authorized budget cap is $${budgetCap} USD with escrow release upon milestone verification. Please confirm if you can deliver this within ${budgetCap} USD.`;
      } else if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
        botReplyText = `Hello ${providerName.split(' ')[0]}! I represent ${clientName} for this project ("${clientRequirements}"). Our client has an authorized budget cap of $${budgetCap} USD. What is your estimated turnaround and proposed price?`;
      } else if (lower.includes('day') || lower.includes('time') || lower.includes('week') || lower.includes('dya')) {
        botReplyText = `A fast turnaround is highly preferred by ${clientName}. Please enter your delivery timeframe and proposed price into the bid form below so it streams directly to the client's decision board.`;
      } else {
        botReplyText = `Thank you for the update, ${providerName.split(' ')[0]}. Client ${clientName} is procuring: "${clientRequirements}". Our budget cap is $${budgetCap} USD—please submit your competitive bid below to secure this contract.`;
      }
    }

    const botEntry = {
      speaker: 'agent' as const,
      speakerName: 'AgentPay Commerce Bot 🤖',
      message: botReplyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const finalDialog = [...dialogWithProvider, botEntry];

    // Auto-codify the specialist's proposed price as an active milestone bid
    let effectiveBidPrice = detectedNumber;
    if (!effectiveBidPrice) {
      for (let i = dialogWithProvider.length - 1; i >= 0; i--) {
        const d = dialogWithProvider[i];
        const match = d.message.match(/\$(\d{2,4})/);
        if (match) {
          const p = Number(match[1]);
          if (p >= 30 && p <= budgetCap) {
            effectiveBidPrice = p;
            break;
          }
        }
      }
    }

    let updatedBids = sessionData.bids || [];
    let autoBid: any = null;
    if (effectiveBidPrice && effectiveBidPrice <= budgetCap) {
      const ms1 = Math.round(effectiveBidPrice / 2);
      const ms2 = effectiveBidPrice - ms1;
      autoBid = {
        providerId,
        providerName,
        providerAvatar: targetProv?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        providerEmail: targetProv?.email || 'provider@agentpay.network',
        providerTitle: targetProv?.title || 'Verified Specialist',
        bidPrice: effectiveBidPrice,
        deliveryDays: detectedDays || 3,
        note: message.trim(),
        milestones: [
          { title: 'Milestone 1: Core Architecture & Setup', amount: ms1 },
          { title: 'Milestone 2: Final Verification & Handover', amount: ms2 }
        ],
        submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'submitted'
      };
      updatedBids = [...(sessionData.bids || []).filter((b: any) => b.providerId !== providerId), autoBid];
    }

    const updatedTargetProviders = (sessionData.targetProviders || []).map((tp: any) =>
      tp.id === providerId ? { ...tp, status: 'bid_received', bidPrice: effectiveBidPrice } : tp
    );

    // Update messages array ensuring actionPayload has latest dialog and bids
    let payloadFound = false;
    const updatedMessages = (sessionData.messages || []).map((m: any) => {
      if (m.actionPayload) {
        payloadFound = true;
        return {
          ...m,
          actionPayload: {
            ...m.actionPayload,
            negotiationDialog: finalDialog,
            bids: updatedBids
          }
        };
      }
      return m;
    });

    if (!payloadFound && updatedMessages.length > 0) {
      const last = updatedMessages[updatedMessages.length - 1];
      last.actionPayload = {
        type: 'negotiation_proposal',
        tenderStatus: 'tender_open',
        negotiationDialog: finalDialog,
        bids: updatedBids
      };
    }

    await updateDoc(sessionRef, {
      negotiationDialog: finalDialog,
      messages: updatedMessages,
      bids: updatedBids,
      targetProviders: updatedTargetProviders,
      hasUnreadMessage: true,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Dialogue updated and official bid codified to client',
      providerEntry,
      botEntry,
      aiBotReply: botEntry,
      dialog: finalDialog,
      detectedPrice: effectiveBidPrice,
      detectedDays: detectedDays || 3,
      bidSubmittedFromChat: !!autoBid,
      submittedBid: autoBid
    });

  } catch (err: any) {
    console.error('[Send Tender Message Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to send message' }, { status: 500 });
  }
}
