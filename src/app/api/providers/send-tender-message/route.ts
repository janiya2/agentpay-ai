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

    try {
      await geminiRotator.loadKeysFromFirestore();
      botReplyText = await geminiRotator.executeWithRotation(async (genAI) => {
        const candidateModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-pro'];
        const prompt = `
You are AgentPay Commerce Bot 🤖, an institutional autonomous AI procurement agent representing client ${clientName}.
You are in an active RFP negotiation with specialist ${providerName} for project: "${projectScope}".
Client Budget Cap: $${budgetCap} USD.

Dialogue history:
${dialogWithProvider.map((d: any) => `${d.speakerName}: ${d.message}`).join('\n')}

Specialist ${providerName} just sent: "${message.trim()}"

Your task:
Reply to ${providerName} professionally, constructively, and concisely (1 to 3 sentences max):
- If greeting: Greet ${providerName}, specify client's $${budgetCap} USD cap, and invite them to submit their proposed milestone price and delivery days.
- If proposing price/timeline or negotiating: Evaluate against $${budgetCap} USD. If within budget, encourage them to codify it into the bid submitter form below so ${clientName} can review and authorize PayPal Milestone Escrow.
- If asking questions about scope, wireframes, or stack: Provide technical clarity and state delivery expectations.

Provide ONLY the text of your response:
        `.trim();

        for (const modelName of candidateModels) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: { temperature: 0.3, maxOutputTokens: 200 }
            });
            const res = await model.generateContent(prompt);
            const text = res.response.text();
            if (text && text.trim().length > 0) return text.trim();
          } catch (mErr: any) {
            if (mErr?.message?.includes('404')) continue;
            throw mErr;
          }
        }
        throw new Error('All models exhausted');
      });
    } catch (aiErr) {
      console.warn('[Bot Reply AI Fallback]:', aiErr);
      if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
        botReplyText = `Hello ${providerName.split(' ')[0]}! I represent ${clientName} for this ${projectScope}. Our budget cap is $${budgetCap} USD. What is your estimated turnaround and proposed price for this deliverable?`;
      } else if (lower.includes('price') || lower.includes('$') || lower.includes('budget') || lower.includes('dollar') || lower.includes('cost')) {
        botReplyText = `Understood. Our client has authorized up to $${budgetCap} USD for high quality execution. Please submit your exact milestone proposal using the bid form below so ${clientName} can compare offers and lock PayPal Escrow.`;
      } else if (lower.includes('day') || lower.includes('time') || lower.includes('week') || lower.includes('schedule')) {
        botReplyText = `A fast turnaround is highly preferred by ${clientName}. Please enter your delivery timeframe into your bid submission so it streams directly to the client's decision board.`;
      } else {
        botReplyText = `Thank you for the update, ${providerName.split(' ')[0]}. I've registered your message into the procurement ledger. Please enter your milestone terms and submit your competitive bid below to lock in this opportunity.`;
      }
    }

    const botEntry = {
      speaker: 'agent' as const,
      speakerName: 'AgentPay Commerce Bot 🤖',
      message: botReplyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const finalDialog = [...dialogWithProvider, botEntry];

    // Also update last message's negotiationDialog in messages array if present
    const updatedMessages = (sessionData.messages || []).map((m: any, idx: number) => {
      if (idx === (sessionData.messages?.length || 1) - 1 && m.actionPayload) {
        return {
          ...m,
          actionPayload: {
            ...m.actionPayload,
            negotiationDialog: finalDialog
          }
        };
      }
      return m;
    });

    await updateDoc(sessionRef, {
      negotiationDialog: finalDialog,
      messages: updatedMessages,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Dialogue updated with provider message and autonomous bot reply',
      providerEntry,
      botEntry,
      dialog: finalDialog
    });

  } catch (err: any) {
    console.error('[Send Tender Message Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to send message' }, { status: 500 });
  }
}
