import { NextRequest, NextResponse } from 'next/server';
import { geminiRotator } from '@/lib/gemini-rotator';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { createPayPalOrder } from '@/lib/paypal';
import type { ServiceProvider } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { messages, spendingLimit = 250, buyerName = 'Janitha Dilshan' } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required.' }, { status: 400 });
    }

    const latestUserMessage = messages[messages.length - 1].content;

    // Run execution with Gemini Multi-Key Failover Rotator
    const result = await geminiRotator.executeWithRotation(async (genAI, activeKey) => {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.2,
          topP: 0.95
        }
      });

      // System Prompt & Knowledge Grounding
      const systemContext = `
You are AgentPay AI, an institutional-grade Autonomous Commerce & Procurement Agent for the PayPal AI Hackathon 2026.
Your role:
1. Understand the user's service requirement (e.g. Next.js web dev, Figma UI/UX, AI automation, SEO, mobile app, video production).
2. The user has set a HARD spending limit of $${spendingLimit} USD. You MUST NEVER exceed this limit.
3. Actively help the user discover top-rated service providers, evaluate their suitability, negotiate milestone pricing within their budget, and structure a secure PayPal milestone escrow.
4. When suggesting or finalizing a provider, produce structured JSON actions so the frontend can render rich interactive UI cards and PayPal checkout buttons.

Format your response as valid JSON with this structure:
{
  "reply": "Clear, professional, and friendly response to the client detailing your reasoning and progress.",
  "intent": "discovery" | "negotiation" | "checkout_ready" | "general_chat",
  "categoryMatched": "web-development" | "ui-ux-design" | "ai-automation" | "seo-marketing" | "video-production" | "mobile-apps" | null,
  "negotiatedDeal": {
    "providerName": string,
    "providerId": string,
    "scopeTitle": string,
    "originalPrice": number,
    "negotiatedPrice": number,
    "deliveryDays": number,
    "milestones": [
      { "title": string, "amount": number }
    ]
  } | null,
  "triggerPayPalOrder": boolean
}
      `.trim();

      const chatHistory = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
      const prompt = `${systemContext}\n\nCONVERSATION HISTORY:\n${chatHistory}\n\nUSER PROMPT: "${latestUserMessage}"\n\nGenerate your structured JSON decision now:`;

      const response = await model.generateContent(prompt);
      const text = response.response.text();
      
      // Clean JSON string
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    });

    // If a category was matched, fetch top matching verified providers from Firestore
    let matchedProviders: ServiceProvider[] = [];
    if (result.categoryMatched) {
      try {
        const q = query(
          collection(db, 'agentpay_providers'),
          where('category', '==', result.categoryMatched),
          limit(3)
        );
        const snap = await getDocs(q);
        matchedProviders = snap.docs.map(d => d.data() as ServiceProvider);
      } catch (err) {
        console.warn('[Firestore] Could not load matched providers:', err);
      }
    }

    // If ready for checkout and triggerPayPalOrder is true, call PayPal Orders v2
    let paypalOrderId: string | undefined = undefined;
    let finalOrderRefId: string | undefined = undefined;

    if (result.triggerPayPalOrder && result.negotiatedDeal) {
      const orderAmount = Math.min(result.negotiatedDeal.negotiatedPrice, spendingLimit);
      finalOrderRefId = `ord_${Date.now()}`;

      try {
        const ppRes = await createPayPalOrder({
          amount: orderAmount,
          currency: 'USD',
          referenceId: finalOrderRefId,
          description: `AgentPay AI Escrow: ${result.negotiatedDeal.scopeTitle}`
        });
        paypalOrderId = ppRes.id;
      } catch (err) {
        console.error('[PayPal API Order Creation Error]:', err);
      }
    }

    return NextResponse.json({
      success: true,
      agentDecision: result,
      matchedProviders,
      paypalOrderId,
      orderRefId: finalOrderRefId
    });

  } catch (err: any) {
    console.error('[Agent Chat API Error]:', err);
    return NextResponse.json({
      error: err.message || 'AI Agent processing error',
      fallbackReply: "I encountered a brief connection anomaly with the AI inference network. Please try asking again."
    }, { status: 500 });
  }
}
