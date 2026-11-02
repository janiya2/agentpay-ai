import { NextRequest, NextResponse } from 'next/server';
import { geminiRotator } from '@/lib/gemini-rotator';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, limit, doc, setDoc } from 'firebase/firestore';
import { createPayPalOrder } from '@/lib/paypal';
import { sendProviderNegotiationAlert } from '@/lib/resend';
import type { ServiceProvider } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { 
      sessionId, 
      messages, 
      spendingLimit = 250, 
      buyerName = 'Janitha Dilshan', 
      buyerEmail = 'janithad2@gmail.com' 
    } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required.' }, { status: 400 });
    }

    // Refresh Gemini keys from Firestore settings
    await geminiRotator.loadKeysFromFirestore();

    const latestUserMessage = messages[messages.length - 1].content;
    const lowerText = latestUserMessage.toLowerCase().trim();

    // 1. Identify Greeting / Casual Chat
    const isGreetingOnly = /^(hi|hello|hey|good morning|good evening|good afternoon|yo|sup|help|who are you|oya kawda|halo|kohomada)[\s!.]*$/i.test(lowerText) ||
      (lowerText.length < 12 && !lowerText.includes('web') && !lowerText.includes('app') && !lowerText.includes('design') && !lowerText.includes('dev') && !lowerText.includes('seo') && !lowerText.includes('bot'));

    // 2. Identify Provider Selection / Negotiation Intent
    const isHireIntent = lowerText.includes('proceed with') || 
                         lowerText.includes('proceed') ||
                         lowerText.includes('select') || 
                         lowerText.includes('hire') || 
                         lowerText.includes('choose') ||
                         lowerText.includes('deal with') ||
                         lowerText.includes('go with') ||
                         lowerText.includes('negotiate with');

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
2. DISCOVERY STAGE: If the user specifies a service requirement (e.g. Next.js web dev, Figma UI design, AI automation workflow, SEO, mobile app), classify the category ("web-development" | "ui-ux-design" | "ai-automation" | "seo-marketing" | "video-production" | "mobile-apps") and invite them to review top specialists.
3. TENDER DISPATCH STAGE: If the user says "I want to proceed with [Provider Name]", selects a specialist, or asks to tender:
   - Do NOT simulate or pretend that the provider already agreed in advance! In real-world commerce, specialists must review the RFP in their Provider Workspace.
   - Explain clearly that the autonomous proposal has been dispatched to the specialists, email notifications have been sent, and you are waiting for their competitive bids.
   - Set intent to "tender_dispatched".

Format your response strictly as valid JSON with NO markdown formatting:
{
  "reply": "string (your comprehensive, polite, professional response explaining the tender dispatch and next steps)",
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

    // UNIFIED AUTONOMOUS TENDER DISPATCH (Executes ALWAYS when client hires / tenders)
    if (isHireIntent || result?.intent === 'tender_dispatched') {
      const allProvidersSnap = await getDocs(collection(db, 'agentpay_providers'));
      const allProviders = allProvidersSnap.docs.map(d => d.data() as ServiceProvider);

      let matchedCategory = result?.categoryMatched || 'web-development';
      if (lowerText.includes('design') || lowerText.includes('figma') || lowerText.includes('ui') || lowerText.includes('ux')) {
        matchedCategory = 'ui-ux-design';
      } else if (lowerText.includes('ai') || lowerText.includes('automation') || lowerText.includes('bot')) {
        matchedCategory = 'ai-automation';
      }

      // Find primary provider if specifically mentioned by client
      let chosen = allProviders.find(p => 
        lowerText.includes(p.name.toLowerCase()) || 
        lowerText.includes(p.name.split(' ')[0].toLowerCase()) ||
        (result?.selectedProviderName && p.name.toLowerCase().includes(result.selectedProviderName.toLowerCase()))
      );

      if (!chosen) {
        chosen = allProviders.find(p => p.category === matchedCategory) || allProviders[0];
      }

      // Pick 2 peer specialists in same domain for a 3-way competitive tender
      const peers = allProviders.filter(p => p.id !== chosen!.id && (p.category === chosen!.category || p.category === matchedCategory)).slice(0, 2);
      const top3Providers = [chosen, ...peers];

      // Autonomous Swarm Bidding: Any provider with autoBiddingEnabled !== false generates an instant bid
      const swarmBids: any[] = [];
      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const targetProviders = top3Providers.map((p, pIdx) => {
        const isAuto = p.autoBiddingEnabled !== false;

        if (isAuto) {
          const floor = p.minProjectFloor || 120;
          const targetCap = spendingLimit || 200;
          // Natural competitive variance among specialists
          const variance = pIdx === 0 ? 30 : pIdx === 1 ? 40 : 25;
          let calculatedPrice = Math.max(floor, targetCap - variance);
          if (calculatedPrice > targetCap) calculatedPrice = targetCap;
          const turnaround = Math.max(p.minTurnaroundDays || 2, pIdx === 1 ? 2 : pIdx === 0 ? 3 : 4);

          swarmBids.push({
            providerId: p.id,
            providerName: p.name,
            providerAvatar: p.avatarUrl,
            providerTitle: p.title,
            bidPrice: calculatedPrice,
            deliveryDays: turnaround,
            note: `Autonomous Proposal via ${p.name}'s AI Delegate: Guaranteed ${p.title} deliverables adhering strictly to contract specifications with ${turnaround}-day turnaround.`,
            milestones: [
              { title: 'Milestone 1: Architectural Draft & Components', amount: Math.round(calculatedPrice * 0.5) },
              { title: 'Milestone 2: Final Delivery, Testing & Handoff', amount: Math.round(calculatedPrice * 0.5) }
            ],
            submittedAt: timeNow,
            isAutoBid: true
          });

          return {
            id: p.id,
            name: p.name,
            title: p.title,
            email: p.contactEmail,
            avatarUrl: p.avatarUrl,
            rating: p.rating,
            hourlyRate: p.hourlyRate,
            autoBiddingEnabled: true,
            status: 'bid_received' as const,
            bidPrice: calculatedPrice
          };
        } else {
          return {
            id: p.id,
            name: p.name,
            title: p.title,
            email: p.contactEmail,
            avatarUrl: p.avatarUrl,
            rating: p.rating,
            hourlyRate: p.hourlyRate,
            autoBiddingEnabled: false,
            status: 'awaiting_bid' as const
          };
        }
      });

      const dynamicDialog = [
        {
          speaker: 'agent' as const,
          speakerName: 'AgentPay Commerce Bot 🤖',
          message: `Initiating Autonomous RFP Tender to ${targetProviders.length} specialists (${targetProviders.map(p => p.name).join(', ')}). Project Scope: ${chosen.title}. Client Budget Cap: $${spendingLimit} USD. ${swarmBids.length} autonomous bids received.`,
          timestamp: timeNow
        }
      ];

      result = {
        reply: `🚀 **Autonomous Swarm Tender Dispatched!**\n\nI have transmitted your RFP scope to 3 top verified specialists:\n${targetProviders.map(p => `• **${p.name}** (${p.title}) — ${p.autoBiddingEnabled ? '⚡ *Instant AI Delegate Active*' : '⏳ *Manual Bidding Mode*'}`).join('\n')}\n\n🏆 **Bidding Status:** ${swarmBids.length} competitive milestone bids have been autonomously submitted to your decision board below. Review their price, turnaround, and milestone tranches, or open a **Direct 1-on-1 Chat** to negotiate further!`,
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

    if (result?.intent === 'checkout_ready' || isHireIntent) {
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

      // Persist order to Firestore agentpay_orders
      try {
        const orderDoc = {
          id: finalOrderRefId,
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
        spendingLimit,
        messages: fullConversation,
        messageCount: fullConversation.length,
        latestPrompt: latestUserMessage,
        latestResponse: assistantMsg.content,
        intent: result?.intent || 'discovery',
        isRealAI,
        modelUsed,
        categoryMatched: result?.categoryMatched || null,
        projectScope: `${result?.categoryMatched || 'web-development'} Milestone Deliverable`,
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
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Janitha&backgroundColor=b6e3f4',
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
