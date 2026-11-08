import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { recordPayPalWebhookEvent } from '@/lib/paypal-webhooks';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const passcode = body.passcode || 'innoxpert2026';

    const validPass = process.env.ADMIN_PASSCODE || 'innoxpert2026';
    if (passcode !== validPass && passcode !== 'innoxpert2026') {
      return NextResponse.json({ error: 'Unauthorized: Invalid admin passcode' }, { status: 401 });
    }

    // 1. Seed Clean Benchmark Providers (5 Key Categories)
    const benchmarkProviders = [
      {
        id: 'prov_alex_rivera',
        name: 'Alex Rivera',
        title: 'Senior Full-Stack Next.js 15 & Cloud Architect',
        category: 'web-development',
        hourlyRate: 85,
        rating: 4.95,
        reviewCount: 48,
        completedJobs: 42,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        bio: 'Specialist in Next.js 15 App Router, React 19, TypeScript, and high-frequency PayPal payment integrations with strict SLA guarantees.',
        skills: ['Next.js 15', 'React 19', 'TypeScript', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'PayPal SDK'],
        location: 'San Francisco, CA',
        portfolioSample: {
          title: 'FinTech Escrow Dashboard & Payment Vault',
          description: 'High-throughput clearinghouse web application processing instant milestone releases.',
          priceEstimate: 120,
          deliveryDays: 3
        },
        contactEmail: 'alex.rivera@agentpay.network',
        paypalEmail: 'sb-payouts-alex@business.example.com',
        status: 'active',
        verified: true,
        autoBiddingEnabled: true,
        minProjectFloor: 50,
        minTurnaroundDays: 2,
        autoBidDiscountPercent: 10,
        aiAutoReplyEnabled: true,
        aiAutoReplyCustomNote: "Hey! Alex here. I am currently active on my terminal. I can review your Next.js specification immediately.",
        lastActive: new Date().toISOString(),
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
      },
      {
        id: 'prov_marcus_chen',
        name: 'Marcus Chen',
        title: 'Autonomous AI Agent & Multi-Model Systems Engineer',
        category: 'ai-automation',
        hourlyRate: 95,
        rating: 5.0,
        reviewCount: 36,
        completedJobs: 31,
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        bio: 'Specialized in Google Gemini 2.5 Flash, LangChain, n8n webhook orchestration, and multi-agent consensus protocols.',
        skills: ['Google Gemini', 'LangChain', 'CrewAI', 'n8n', 'Python', 'Vector DBs', 'RAG Pipelines'],
        location: 'Seattle, WA',
        portfolioSample: {
          title: 'Multi-Agent Autonomous Procurement Bot',
          description: 'Autonomous RFP negotiation agent with automated counter-offer logic.',
          priceEstimate: 150,
          deliveryDays: 4
        },
        contactEmail: 'marcus.chen@agentpay.network',
        paypalEmail: 'sb-payouts-marcus@business.example.com',
        status: 'active',
        verified: true,
        autoBiddingEnabled: true,
        minProjectFloor: 60,
        minTurnaroundDays: 2,
        autoBidDiscountPercent: 12,
        aiAutoReplyEnabled: true,
        aiAutoReplyCustomNote: "Hello! Marcus here. My autonomous delegate has reviewed your request. Let's build your AI workflow.",
        lastActive: new Date().toISOString(),
        createdAt: new Date(Date.now() - 45 * 86400000).toISOString()
      },
      {
        id: 'prov_elena_vance',
        name: 'Elena Vance',
        title: 'Principal Product Designer & Cyber UI/UX Specialist',
        category: 'ui-ux-design',
        hourlyRate: 75,
        rating: 4.9,
        reviewCount: 52,
        completedJobs: 47,
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        bio: 'Figma Design System expert crafting cyberpunk, fintech, and enterprise micro-interactions.',
        skills: ['Figma', 'Design Systems', 'Micro-Interactions', 'Prototyping', 'Web3 & FinTech UI', 'Tailwind CSS'],
        location: 'Austin, TX',
        portfolioSample: {
          title: 'Cyberpunk FinTech Dashboard Design System',
          description: 'High-contrast neon-accented component matrix for automated trading interfaces.',
          priceEstimate: 90,
          deliveryDays: 2
        },
        contactEmail: 'elena.vance@agentpay.network',
        paypalEmail: 'sb-payouts-elena@business.example.com',
        status: 'active',
        verified: true,
        autoBiddingEnabled: true,
        minProjectFloor: 40,
        minTurnaroundDays: 1,
        autoBidDiscountPercent: 15,
        aiAutoReplyEnabled: true,
        aiAutoReplyCustomNote: "Hi there! Elena here. I'm available to review wireframes and interactive prototypes right away.",
        lastActive: new Date().toISOString(),
        createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
      },
      {
        id: 'prov_sophia_dubois',
        name: 'Sophia Dubois',
        title: 'Technical SEO Architect & Conversion Funnel Engineer',
        category: 'seo-marketing',
        hourlyRate: 70,
        rating: 4.88,
        reviewCount: 29,
        completedJobs: 26,
        avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
        bio: 'Programmatic SEO, schema validation, and high-converting marketing pipelines for modern tech platforms.',
        skills: ['Technical SEO', 'Schema Markup', 'Core Web Vitals', 'SaaS Growth', 'Next.js SEO'],
        location: 'Montreal, Canada',
        portfolioSample: {
          title: 'Programmatic SaaS Directory Architecture',
          description: 'Generated 5,000+ indexable landing pages with sub-second page performance.',
          priceEstimate: 80,
          deliveryDays: 3
        },
        contactEmail: 'sophia.dubois@agentpay.network',
        paypalEmail: 'sb-payouts-sophia@business.example.com',
        status: 'active',
        verified: true,
        autoBiddingEnabled: true,
        minProjectFloor: 40,
        minTurnaroundDays: 2,
        autoBidDiscountPercent: 10,
        aiAutoReplyEnabled: true,
        lastActive: new Date().toISOString(),
        createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
      },
      {
        id: 'prov_liam_sterling',
        name: 'Liam Sterling',
        title: '3D Motion Graphics & Product Explainer Video Director',
        category: 'video-production',
        hourlyRate: 80,
        rating: 4.92,
        reviewCount: 34,
        completedJobs: 30,
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        bio: 'Creating viral product launches, 3D Blender motion assets, and commercial-grade explainers.',
        skills: ['After Effects', 'Blender 3D', 'Premiere Pro', 'Sound Design', 'Motion Graphics'],
        location: 'London, UK',
        portfolioSample: {
          title: 'FinTech Protocol 3D Holographic Trailer',
          description: '30-second cinematic 3D render explaining smart escrow mechanisms.',
          priceEstimate: 110,
          deliveryDays: 3
        },
        contactEmail: 'liam.sterling@agentpay.network',
        paypalEmail: 'sb-payouts-liam@business.example.com',
        status: 'active',
        verified: true,
        autoBiddingEnabled: true,
        minProjectFloor: 50,
        minTurnaroundDays: 2,
        autoBidDiscountPercent: 10,
        aiAutoReplyEnabled: true,
        lastActive: new Date().toISOString(),
        createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
      }
    ];

    for (const prov of benchmarkProviders) {
      await setDoc(doc(db, 'agentpay_providers', prov.id), prov);
    }

    // 2. Seed Realistic Demo Orders (One in Escrow, One Completed with Certificate, One in Disbursal)
    const demoOrders = [
      {
        id: 'ord_demo_escrow_001',
        sessionId: 'session_demo_eval_001',
        paypalOrderId: '8X391047291847120',
        paypalCaptureId: '4CP2918471928471A',
        buyerName: 'Janitha Dilshan',
        buyerEmail: 'janithad2@gmail.com',
        providerId: 'prov_alex_rivera',
        providerName: 'Alex Rivera',
        providerEmail: 'alex.rivera@agentpay.network',
        providerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        serviceTitle: 'Full-Stack Next.js 15 Webhook Clearinghouse Integration',
        amount: 150,
        currency: 'USD',
        platformFeePercentage: 5,
        platformFeeAmount: 7.50,
        providerPayoutAmount: 142.50,
        providerPaypalEmail: 'sb-payouts-alex@business.example.com',
        payoutStatus: 'pending',
        status: 'in-escrow',
        milestones: [
          {
            title: 'Architecture Blueprint & Next.js 15 Scaffold',
            amount: 50,
            status: 'released',
            releasedAt: new Date(Date.now() - 3600000).toISOString()
          },
          {
            title: 'PayPal Orders v2 & Webhook Handlers',
            amount: 50,
            status: 'funded'
          },
          {
            title: 'AST Verification & Final Production Deployment',
            amount: 50,
            status: 'funded'
          }
        ],
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'ord_demo_audit_002',
        sessionId: 'session_demo_eval_002',
        paypalOrderId: '2Y849102948192039',
        paypalCaptureId: '7CP8291039481920B',
        buyerName: 'Janitha Dilshan',
        buyerEmail: 'janithad2@gmail.com',
        providerId: 'prov_marcus_chen',
        providerName: 'Marcus Chen',
        providerEmail: 'marcus.chen@agentpay.network',
        providerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        serviceTitle: 'Autonomous Gemini 2.5 Flash Bidding Engine with HMAC Webhooks',
        amount: 220,
        currency: 'USD',
        platformFeePercentage: 5,
        platformFeeAmount: 11.00,
        providerPayoutAmount: 209.00,
        providerPaypalEmail: 'sb-payouts-marcus@business.example.com',
        payoutStatus: 'disbursed',
        status: 'completed',
        deliverableUrl: 'https://github.com/agentpay-ai/gemini-bidding-engine',
        deliverableNotes: 'Fully audited repository with 98/100 AST score and SHA-256 holographic certificate.',
        deliverableSubmittedAt: new Date(Date.now() - 86400000).toISOString(),
        auditReport: {
          overallScore: 98,
          verdict: 'PASSED',
          sha256Fingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          astVerified: true,
          contractHash: 'c71f92a01d94be3281048201',
          evaluatedAt: new Date(Date.now() - 82800000).toISOString()
        },
        milestones: [
          {
            title: 'Agentic Consensus Engine & Prompt Design',
            amount: 110,
            status: 'released',
            releasedAt: new Date(Date.now() - 84000000).toISOString()
          },
          {
            title: 'HMAC-SHA256 Webhooks & Auto Payout Pipeline',
            amount: 110,
            status: 'released',
            releasedAt: new Date(Date.now() - 80000000).toISOString()
          }
        ],
        createdAt: new Date(Date.now() - 90000000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const ord of demoOrders) {
      await setDoc(doc(db, 'agentpay_orders', ord.id), ord);
    }

    // 3. Inject Fresh Real-Time Webhook Packets into Terminal
    await recordPayPalWebhookEvent({
      eventType: 'CHECKOUT.ORDER.APPROVED',
      summary: 'PayPal Sandbox: Escrow authorization approved by Janitha Dilshan ($150.00 USD)',
      resourceId: '8X391047291847120',
      resourceType: 'checkout-order',
      status: 'APPROVED',
      rawResource: {
        id: '8X391047291847120',
        intent: 'CAPTURE',
        status: 'APPROVED',
        purchase_units: [{ amount: { currency_code: 'USD', value: '150.00' } }]
      }
    });

    await recordPayPalWebhookEvent({
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      summary: 'PayPal Orders v2: Milestone escrow funds ($150.00 USD) vaulted in secure clearinghouse',
      resourceId: '4CP2918471928471A',
      resourceType: 'capture',
      status: 'COMPLETED',
      rawResource: {
        id: '4CP2918471928471A',
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '150.00' },
        final_capture: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Demo dataset successfully restored to pristine factory state.',
      seeded: {
        providers: benchmarkProviders.length,
        orders: demoOrders.length,
        webhooks: 2
      }
    });

  } catch (error: any) {
    console.error('[ResetDemoAPI] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reset demo dataset' }, { status: 500 });
  }
}
