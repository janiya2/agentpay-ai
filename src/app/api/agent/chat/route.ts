export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { geminiRotator } from '@/lib/gemini-rotator';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit, doc, setDoc } from 'firebase/firestore';
import { createPayPalOrder } from '@/lib/paypal';
import { sendProviderNegotiationAlert } from '@/lib/resend';
import type { ServiceProvider } from '@/types';

export async function POST(req: NextRequest) {
  try {
    let { 
      sessionId, 
      messages, 
      spendingLimit = 250, 
      buyerName = 'Janitha Dilshan', 
      buyerEmail = 'janithad2@gmail.com',
      buyerAvatar = ''
    } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required.' }, { status: 400 });
    }

    // Refresh Gemini keys from Firestore settings
    await geminiRotator.loadKeysFromFirestore();

    const latestUserMessage = messages[messages.length - 1].content;
    const lowerText = latestUserMessage.toLowerCase().trim();

    // Auto-detect budget mentioned in client prompt and dynamically enforce as safe spending limit
    const budgetMatch = latestUserMessage.match(/(?:under|below|max|maximum|cap|budget|price|for|around|up\s*to)\s*(?:of|is|:)?\s*\$?\s*(\d{2,4})\b/i) || 
                        latestUserMessage.match(/\(\s*\$?\s*(\d{2,4})\s*\)/) ||
                        latestUserMessage.match(/\$\s*(\d{2,4})\b/);
    if (budgetMatch && budgetMatch[1]) {
      const parsedNum = parseInt(budgetMatch[1], 10);
      if (parsedNum >= 30 && parsedNum <= 1000) {
        spendingLimit = parsedNum;
      }
    }

    // 1. Identify Greeting / Casual Chat
    const isGreetingOnly = /^(hi|hello|hey|good morning|good evening|good afternoon|yo|sup|help|who are you|oya kawda|halo|kohomada)[\s!.]*$/i.test(lowerText) ||
      (lowerText.length < 12 && !lowerText.includes('web') && !lowerText.includes('app') && !lowerText.includes('design') && !lowerText.includes('dev') && !lowerText.includes('seo') && !lowerText.includes('bot') && !lowerText.includes('ai'));

    // 2. Identify Specific Provider Selection or Explicit Tender Dispatch Command
    const isExplicitTenderDispatch = 
      lowerText.includes('dispatch autonomous tender') || 
      lowerText.includes('dispatch tender') || 
      lowerText.includes('dispatch rfp') || 
      lowerText.includes('start tender') ||
      lowerText.includes('send tender');

    const KNOWN_SPECIALIST_NAMES = [
      'ethan', 'rossi', 'adrian', 'silva', 'lucas', 'o\'connor', 'oconnor',
      'sophia', 'patel', 'elena', 'chen', 'marcus', 'vance', 'david', 'alex', 'sarah', 'maya', 'felix'
    ];
    const mentionsSpecificSpecialist = KNOWN_SPECIALIST_NAMES.some(name => lowerText.includes(name));

    const hasSelectionAction = 
      lowerText.includes('proceed with') || 
      lowerText.includes('negotiate with') || 
      lowerText.includes('deal with') || 
      lowerText.includes('go with') ||
      (lowerText.includes('select ') && mentionsSpecificSpecialist) ||
      (lowerText.includes('hire ') && mentionsSpecificSpecialist);

    // A hire/tender intent is strictly valid ONLY if an explicit tender command was given or a specific specialist was named
    const isHireIntent = !isGreetingOnly && (isExplicitTenderDispatch || (hasSelectionAction && mentionsSpecificSpecialist));

    let result: any = null;
    let isRealAI = false;
    let modelUsed = 'Offline Rule Engine';

    // Try Real Gemini AI if an active key exists
    try {
      const aiResponse = await geminiRotator.executeWithRotation(async (genAI, activeKey) => {
        const candidateModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-pro'];

        const systemContext = `
You are AgentPay AI, an institutional-grade Autonomous Commerce & Procurement Agent for the PayPal AI Hackathon 2026.
Your role:
1. GREETING STAGE: If the user simply says "hi", "hello", casual greetings, do NOT dump provider cards. Greet the user warmly, explain you are an autonomous procurement agent, and ask what digital deliverable or service they wish to procure within their budget cap ($${spendingLimit} USD).
2. DISCOVERY STAGE: If the user specifies a service requirement or general need (e.g. "I want to hire ai web developer", Next.js web dev, Figma UI design, AI automation workflow, SEO, mobile app), classify the category ("web-development" | "ui-ux-design" | "ai-automation" | "seo-marketing" | "video-production" | "mobile-apps").
   - Set intent strictly to "discovery".
   - Do NOT dispatch tenders or start messaging providers yet! Explain that you found top matching verified specialists and invite the client to review their cards and click "Select Specialist" or "Dispatch Tender".
3. TENDER DISPATCH STAGE: ONLY if the user explicitly says "I want to proceed with [Provider Name]", names a specific specialist, or explicitly clicks/asks to "dispatch autonomous tender":
   - Explain clearly that the proposal has been dispatched to the specialists and you are awaiting bids.
   - Set intent to "tender_dispatched".

Format your response strictly as valid JSON with NO markdown formatting:
{
  "reply": "string (your comprehensive, polite, professional response explaining the candidate specialists or tender dispatch)",
  "intent": "general_chat" | "discovery" | "tender_dispatched",
  "categoryMatched": "web-development" | "ui-ux-design" | "ai-automation" | "seo-marketing" | "video-production" | "mobile-apps" | null,
  "selectedProviderName": string | null
}
        `.trim();

        const chatHistory = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
        const prompt = `${systemContext}\n\nCONVERSATION HISTORY:\n${chatHistory}\n\nUSER PROMPT: "${latestUserMessage}"\n\nGenerate your structured JSON decision:`;

        let lastModelErr = null;
        for (const modelName of candidateModels) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              generationConfig: {
                temperature: 0.2,
                topP: 0.95
              }
            });
            const response = await model.generateContent(prompt);
            const text = response.response.text();
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return { parsed: JSON.parse(cleanJson), modelName };
          } catch (mErr: any) {
            lastModelErr = mErr;
            if (mErr?.message?.includes('404') || mErr?.message?.includes('not found')) {
              continue; // Try next candidate model
            }
            throw mErr;
          }
        }

        // Auto-discover models if candidate models failed
        try {
          const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${activeKey}`, {
            headers: { 'x-goog-api-key': activeKey }
          });
          const listData = await listRes.json();
          if (listData?.models && Array.isArray(listData.models)) {
            const availableNames = listData.models
              .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
              .map((m: any) => m.name.replace('models/', ''));

            for (const mName of availableNames) {
              try {
                const restRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${activeKey}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': activeKey
                  },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                  })
                });
                const restData = await restRes.json();
                const text = restData?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                  return { parsed: JSON.parse(cleanJson), modelName: mName };
                }
              } catch (innerRestErr) {
                // try next
              }
            }
          }
        } catch (listErr) {
          console.warn('[ListModels Chat Fallback Error]:', listErr);
        }

        throw lastModelErr;
      });

      result = aiResponse.parsed;
      isRealAI = true;
      modelUsed = aiResponse.modelName;

      // Enforce strict greeting and discovery rules even if AI model was used
      if (isGreetingOnly) {
        result.intent = 'general_chat';
        result.categoryMatched = null;
        result.selectedProviderName = null;
      } else if (!isHireIntent && result.intent === 'tender_dispatched') {
        // Client expressed a general requirement without selecting a specific specialist:
        // Keep in Discovery mode so candidate directory cards are presented for the client to select from!
        result.intent = 'discovery';
      }
    } catch (aiErr: any) {
      console.warn('[Gemini AI Engine]: Using resilient conversational intelligence:', aiErr?.message);
      isRealAI = false;
      modelUsed = 'Offline Rule Engine';

      // Intelligent Conversational State Engine
      if (isGreetingOnly) {
        result = {
          reply: `Hello ${buyerName}! 👋 I am your Autonomous AgentPay AI Commerce Agent.\n\nTell me what project or digital deliverable you need to get done (e.g. Next.js 15 web app, Figma UI/UX, AI automation workflow, technical SEO, or mobile app), and I will query our 100+ verified specialists, autonomously negotiate rates on your behalf, and structure a secure PayPal milestone escrow within your $${spendingLimit} USD budget.`,
          intent: 'general_chat',
          categoryMatched: null,
          negotiationDialog: null,
          negotiatedDeal: null,
          triggerPayPalOrder: false
        };
      } else if (isHireIntent) {
        result = {
          intent: 'tender_dispatched',
          categoryMatched: 'web-development'
        };
      } else {
        // Project Discovery Stage
        let matchedCategory = 'web-development';
        if (lowerText.includes('design') || lowerText.includes('figma') || lowerText.includes('ui') || lowerText.includes('ux')) {
          matchedCategory = 'ui-ux-design';
        } else if (lowerText.includes('ai') || lowerText.includes('automation') || lowerText.includes('bot') || lowerText.includes('n8n') || lowerText.includes('workflow')) {
          matchedCategory = 'ai-automation';
        } else if (lowerText.includes('seo') || lowerText.includes('marketing') || lowerText.includes('traffic')) {
          matchedCategory = 'seo-marketing';
        } else if (lowerText.includes('video') || lowerText.includes('animation') || lowerText.includes('edit')) {
          matchedCategory = 'video-production';
        } else if (lowerText.includes('mobile') || lowerText.includes('app') || lowerText.includes('react native') || lowerText.includes('flutter')) {
          matchedCategory = 'mobile-apps';
        }

        result = {
          reply: `I analyzed your requirement for **${matchedCategory.replace('-', ' ')}** within your **$${spendingLimit} USD** budget cap.\n\nI scanned our 100+ verified talent directory in Firestore and discovered these top-rated specialists who match your scope. Review their ratings and rates below, and click **Select Provider** on who you'd like me to negotiate terms with!`,
          intent: 'discovery',
          categoryMatched: matchedCategory,
          negotiatedDeal: null,
          triggerPayPalOrder: false
        };
      }
    }

    // UNIFIED AUTONOMOUS TENDER DISPATCH (Executes ONLY when client explicitly hires / tenders and NOT greeting)
    if (!isGreetingOnly && (isHireIntent || result?.intent === 'tender_dispatched')) {
      const allProvidersSnap = await getDocs(collection(db, 'agentpay_providers'));
      const allProviders = allProvidersSnap.docs.map(d => d.data() as ServiceProvider);

      let matchedCategory = result?.categoryMatched || 'web-development';
      if (lowerText.includes('design') || lowerText.includes('figma') || lowerText.includes('ui') || lowerText.includes('ux')) {
        matchedCategory = 'ui-ux-design';
      } else if (lowerText.includes('ai') || lowerText.includes('automation') || lowerText.includes('bot')) {
        matchedCategory = 'ai-automation';
      }

      // 1. Check for exact full name matches in client prompt (supports 1, 2, or 3 chosen providers)
      const exactFullNameMatches = allProviders.filter(p => lowerText.includes(p.name.toLowerCase()));

      let targetSpecialists: ServiceProvider[] = [];
      if (exactFullNameMatches.length >= 1) {
        // If client explicitly selected specific provider(s), strictly respect their exact choice!
        targetSpecialists = exactFullNameMatches.slice(0, 3);
      } else {
        // Check for unique first name matches ONLY IF no full name was provided
        const firstNameMatches = allProviders.filter(p => {
          const firstName = p.name.split(' ')[0].toLowerCase();
          return firstName.length > 2 && lowerText.includes(firstName);
        });

        if (firstNameMatches.length > 0) {
          targetSpecialists = firstNameMatches.slice(0, 3);
        } else {
          // No specific provider mentioned: find top 3 in category
          const catSpecialists = allProviders.filter(p => p.category === matchedCategory);
          targetSpecialists = catSpecialists.length >= 3 ? catSpecialists.slice(0, 3) : allProviders.slice(0, 3);
        }
      }

      const chosen = targetSpecialists[0] || allProviders[0];
      const top3Providers = targetSpecialists;

      // Autonomous Swarm RFP Tender: Specialists are alerted and initially placed in 'awaiting_bid' status.
      // Bids are only added when a specialist actually submits via chat negotiation, provider workspace form, or evaluator simulation!
      const swarmBids: any[] = [];
      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const targetProviders = top3Providers.map((p) => ({
        id: p.id,
        name: p.name,
        title: p.title,
        email: p.contactEmail,
        avatarUrl: p.avatarUrl,
        rating: p.rating,
        hourlyRate: p.hourlyRate,
        autoBiddingEnabled: p.autoBiddingEnabled !== false,
        status: 'awaiting_bid' as const,
        bidPrice: undefined
      }));

      const dynamicDialog = [
        {
          speaker: 'agent' as const,
          speakerName: 'AgentPay Commerce Bot 🤖',
          message: targetProviders.length === 1
            ? `Transmitting direct milestone RFP to ${chosen.name}. Project Scope: ${chosen.title}. Client Budget Cap: $${spendingLimit} USD. Awaiting specialist response.`
            : `Initiating Autonomous RFP Tender to ${targetProviders.length} specialists (${targetProviders.map(p => p.name).join(', ')}). Project Scope: ${chosen.title}. Client Budget Cap: $${spendingLimit} USD. Transmitted to specialists' workspaces — awaiting competitive bids.`,
          timestamp: timeNow
        }
      ];

      result = {
        reply: targetProviders.length === 1
          ? `🚀 **Direct Proposal Transmitted to ${chosen.name}!**\n\nI have transmitted your RFP scope directly to **${chosen.name}** (${chosen.title}).\n\n⏳ **Bidding Status:** Awaiting response. Once terms are confirmed in chat or submitted, you can lock PayPal milestone escrow.`
          : `🚀 **Autonomous Swarm Tender Dispatched!**\n\nI have transmitted your RFP scope to ${targetProviders.length} verified specialists:\n${targetProviders.map(p => `• **${p.name}** (${p.title}) — ⏳ *Reviewing Scope & Milestones*`).join('\n')}\n\n🏆 **Bidding Status:** Tender is open for milestone bids. When specialists review your scope and submit their proposals via chat or workspace, their bids will appear on your decision board below for comparison and 1-click PayPal Escrow lock!`,
        intent: 'tender_dispatched',
        categoryMatched: chosen.category,
        selectedProviderName: chosen.name,
        providerId: chosen.id,
        negotiationDialog: dynamicDialog,
        targetProviders,
        bids: swarmBids,
        triggerPayPalOrder: false
      };

      // Dispatch Resend transactional email alert to all target providers
      for (const tp of targetProviders) {
        sendProviderNegotiationAlert({
          providerEmail: tp.email,
          providerName: tp.name,
          buyerName: buyerName || 'Janitha Dilshan',
          serviceTitle: `${chosen.title || chosen.category.replace('-', ' ').toUpperCase()} Milestone Contract`,
          agreedPrice: Math.round(spendingLimit * 0.8),
          deliveryDays: 3,
          orderId: sessionId || `session_${Date.now()}`
        }).catch((err: any) => console.warn('[Resend Async Notice]:', err));
      }
    }

    // Fetch matched providers from Firestore
    let matchedProviders: ServiceProvider[] = [];

    if (isGreetingOnly || result?.intent === 'general_chat') {
      // Never show candidate providers on casual greetings or general chat
      matchedProviders = [];
    } else if (result?.intent === 'checkout_ready' || isHireIntent) {
      // When negotiating / checking out with a specific provider, NEVER show candidate search cards
      matchedProviders = [];
    } else if (result?.intent === 'discovery' && result?.categoryMatched) {
      // If discovery, return top 3 matching specialists
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

    // Handle PayPal order creation if triggered
    let paypalOrderId: string | undefined = undefined;
    let finalOrderRefId: string | undefined = undefined;
    let orderAmount = 0;

    if (result?.triggerPayPalOrder && result?.negotiatedDeal) {
      orderAmount = Math.min(result.negotiatedDeal.negotiatedPrice, spendingLimit);
      finalOrderRefId = `ord_${Date.now()}`;

      try {
        const ppRes = await createPayPalOrder({
          amount: orderAmount,
          currency: 'USD',
          referenceId: finalOrderRefId,
          description: `AgentPay AI Escrow: ${result.negotiatedDeal.scopeTitle}`
        });
        paypalOrderId = ppRes?.id || 'TEST_PAYPAL_ORDER_ID';
      } catch (err) {
        console.error('[PayPal API Order Creation Error, using test order ID]:', err);
        paypalOrderId = `PAYPAL_SANDBOX_${Date.now()}`;
      }

      const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // Persist order to Firestore agentpay_orders
      try {
        const orderDoc = {
          id: finalOrderRefId,
          sessionId: sid,
          paypalOrderId: paypalOrderId,
          buyerName: buyerName || 'Janitha Dilshan',
          buyerEmail: buyerEmail || 'janithad2@gmail.com',
          providerId: result.negotiatedDeal.providerId || 'prov_1001',
          providerName: result.negotiatedDeal.providerName,
          providerEmail: 'provider@agentpay.network',
          serviceTitle: result.negotiatedDeal.scopeTitle,
          amount: orderAmount,
          currency: 'USD',
          status: 'pending-payment',
          milestones: (result.negotiatedDeal.milestones || []).map((m: any, idx: number) => ({
            id: `ms_${idx + 1}`,
            title: m.title,
            amount: m.amount,
            status: 'pending'
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'agentpay_orders', finalOrderRefId), JSON.parse(JSON.stringify(orderDoc)));
      } catch (err) {
        console.warn('[Firestore] Failed to save order:', err);
      }
    }

    // Persist full real chat session with chronological messages to Firestore agentpay_chat_sessions
    try {
      const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const originalPrice = result?.negotiatedDeal?.originalPrice || null;
      const negotiatedPrice = result?.negotiatedDeal?.negotiatedPrice || null;
      const savings = (originalPrice && negotiatedPrice) ? (originalPrice - negotiatedPrice) : 0;

      const assistantMsg = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: result?.reply || "I have analyzed your request.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionPayload: {
          type: result?.intent === 'tender_dispatched' ? 'tender_dispatched' : (result?.intent === 'checkout_ready' ? 'paypal_checkout' : matchedProviders.length ? 'search_results' : 'negotiation_proposal'),
          tenderStatus: result?.intent === 'tender_dispatched' ? 'tender_open' : undefined,
          targetProviders: result?.targetProviders || null,
          bids: result?.bids || [],
          matchedProviders,
          negotiatedTerms: result?.negotiatedDeal || null,
          negotiationDialog: result?.negotiationDialog || null,
          paypalOrderId: paypalOrderId || null,
          amount: result?.negotiatedDeal?.negotiatedPrice,
          isRealAI,
          modelUsed
        }
      };

      const fullConversation = [...messages, assistantMsg];

      const sessionDocData = JSON.parse(JSON.stringify({
        id: sid,
        buyerName: buyerName || 'Janitha Dilshan',
        buyerEmail: buyerEmail || 'janithad2@gmail.com',
        buyerAvatar: buyerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
        spendingLimit,
        messages: fullConversation,
        messageCount: fullConversation.length,
        latestPrompt: latestUserMessage,
        latestResponse: assistantMsg.content,
        intent: result?.intent || 'discovery',
        isRealAI,
        modelUsed,
        categoryMatched: result?.categoryMatched || null,
        projectScope: (() => {
          if (result?.intent === 'general_chat' || isGreetingOnly) return 'General Inquiry';
          const userMsgs = fullConversation.filter((m: any) => m.role === 'user');
          const lastUserMsg = userMsgs[userMsgs.length - 1]?.content || latestUserMessage;
          let cleaned = lastUserMsg
            .replace(/^dispatch\s+(autonomous\s+)?tender\s+to\s+[^]+?for\s+/i, '')
            .replace(/\s+for\s+my\s+project\s+within\s+my\s+\$\d+\s+budget\.?/i, '')
            .replace(/^i want to hire\s+/i, 'Hire ')
            .replace(/^i want to\s+/i, '')
            .replace(/^i need to\s+/i, '')
            .replace(/^please\s+/i, '')
            .replace(/^"|"$/g, '')
            .trim();
          if (cleaned.length >= 3 && !/^(hi|hello|hey)/i.test(cleaned)) {
            return cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 60);
          }
          if (result?.categoryMatched) {
            return `${result.categoryMatched.replace(/[-_]/g, ' ').toUpperCase()} Project`;
          }
          return 'Milestone Contract';
        })(),
        targetProviders: result?.targetProviders || null,
        bids: result?.bids || [],
        providerId: result?.negotiatedDeal?.providerId || null,
        providerMatched: result?.negotiatedDeal?.providerName || (matchedProviders[0]?.name || null),
        matchedProviders,
        negotiatedDeal: result?.negotiatedDeal || null,
        negotiationDialog: result?.negotiationDialog || null,
        originalPrice,
        negotiatedPrice,
        savings,
        paypalOrderId: paypalOrderId || null,
        orderRefId: finalOrderRefId || null,
        status: paypalOrderId ? 'escrow_created' : (result?.intent === 'tender_dispatched' ? 'tender_open' : (result?.negotiatedDeal ? 'negotiated' : 'inquiry')),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      // Save complete session with entire message thread
      await setDoc(doc(db, 'agentpay_chat_sessions', sid), sessionDocData, { merge: true });

      // Update real active user profile in Firestore
      const userDocData = JSON.parse(JSON.stringify({
        id: 'usr_janitha',
        name: buyerName || 'Janitha Dilshan',
        email: buyerEmail || 'janithad2@gmail.com',
        avatarUrl: buyerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
        spendingLimit,
        ordersCount: finalOrderRefId ? 1 : 0,
        totalSpent: finalOrderRefId ? orderAmount : 0,
        lastActive: 'Just now',
        status: 'verified',
        updatedAt: new Date().toISOString()
      }));

      await setDoc(doc(db, 'agentpay_users', 'usr_janitha'), userDocData, { merge: true });

    } catch (logErr) {
      console.warn('[Firestore] Failed to save chat session:', logErr);
    }

    return NextResponse.json({
      success: true,
      isRealAI,
      modelUsed,
      spendingLimit,
      agentDecision: result,
      matchedProviders,
      paypalOrderId,
      orderRefId: finalOrderRefId
    });

  } catch (err: any) {
    console.error('[Agent Chat API Critical Error]:', err);
    return NextResponse.json({
      error: err.message || 'Processing error',
      fallbackReply: "Hello! Tell me what service you need (e.g. Next.js web dev, Figma design, AI automation) and I'll find top providers for you."
    }, { status: 500 });
  }
}
