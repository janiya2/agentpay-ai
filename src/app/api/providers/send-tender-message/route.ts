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

    // Parse potential price numbers from provider message
    const numberMatches = message.match(/\b(\d{2,4})\b/g);
    let detectedNumber: number | null = null;
    if (numberMatches && numberMatches.length > 0) {
      for (const rawNum of numberMatches) {
        const parsed = Number(rawNum);
        if (!isNaN(parsed) && parsed >= 30) {
          detectedNumber = parsed;
          break;
        }
      }
    }

    // Parse potential delivery days from provider message (e.g. "4 days", "4 dyas", "5 d", "in 3 days")
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
Client Maximum Budget Cap: $${budgetCap} USD.

Dialogue history:
${dialogWithProvider.map((d: any) => `${d.speakerName}: ${d.message}`).join('\n')}

Specialist ${providerName} just sent: "${message.trim()}"

Your strategic negotiation instructions:
1. OVER-BUDGET PROPOSALS (If ${providerName} asks for or proposes a price HIGHER than $${budgetCap} USD, e.g. $210):
   - FIRMLY DECLINE THE HIGHER RATE: State that ${clientName}'s maximum authorized budget cap is strictly $${budgetCap} USD and cannot be exceeded.
   - PERSUADE THEM TO AGREE: Counter-offer at $${budgetCap} USD (or $${Math.round(budgetCap * 0.95)} USD). Explain that ${clientName} pays promptly via secured PayPal Milestone Escrow upon completion, and urge them to accommodate $${budgetCap} USD so they do not lose the contract to competing specialists.

2. WITHIN-BUDGET PROPOSALS (If ${providerName} proposes a price AT OR BELOW $${budgetCap} USD, e.g. $170 or $160):
   - WELCOME THE OFFER: State that their proposed price fits comfortably within ${clientName}'s $${budgetCap} USD budget.
   - CALL TO ACTION: Encourage them to codify this offer into the "Submit Official Milestone Bid" form below so ${clientName} can review it on their live decision board and lock PayPal Escrow.

3. QUESTIONS ON SCOPE / WIREFRAMES / STACK:
   - Answer professionally, confirming high-quality delivery expectations and available specs, and ask for their best price within $${budgetCap} USD.

4. GREETINGS:
   - Greet ${providerName} warmly and state the $${budgetCap} USD budget cap.

Rules:
- Speak directly to ${providerName}.
- Keep your tone sharp, polite, and persuasive (2 to 4 complete sentences).
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
          botReplyText = `That sounds like a fair proposal, ${providerName.split(' ')[0]}! $${detectedNumber} USD is within ${clientName}'s $${budgetCap} USD budget. Please submit this exact amount in the bid form below so ${clientName} can review it and fund the PayPal Milestone Escrow!`;
        }
      } else if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
        botReplyText = `Hello ${providerName.split(' ')[0]}! I represent ${clientName} for this ${projectScope}. Our client has an authorized budget cap of $${budgetCap} USD. What is your estimated turnaround and proposed price for this deliverable?`;
      } else if (lower.includes('day') || lower.includes('time') || lower.includes('week') || lower.includes('dya')) {
        botReplyText = `A fast turnaround is highly preferred by ${clientName}. Please enter your delivery timeframe and proposed price into the bid form below so it streams directly to the client's decision board.`;
      } else {
        botReplyText = `Thank you for the update, ${providerName.split(' ')[0]}. I've registered your message. Our budget cap is $${budgetCap} USD—please enter your milestone terms and submit your competitive bid below to secure this contract.`;
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
      dialog: finalDialog,
      detectedPrice: detectedNumber,
      detectedDays: detectedDays
    });

  } catch (err: any) {
    console.error('[Send Tender Message Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to send message' }, { status: 500 });
  }
}
