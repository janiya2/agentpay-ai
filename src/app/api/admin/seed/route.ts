import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, writeBatch } from 'firebase/firestore';

const CATEGORIES = [
  'web-development',
  'ui-ux-design',
  'ai-automation',
  'seo-marketing',
  'video-production',
  'mobile-apps'
] as const;

const FIRST_NAMES = [
  'Alexander', 'Elena', 'Marcus', 'Sophia', 'Liam', 'Olivia', 'Ethan', 'Chloe',
  'David', 'Aria', 'Julian', 'Maya', 'Lucas', 'Zoe', 'Noah', 'Isabella',
  'Nathan', 'Emma', 'Daniel', 'Ava', 'Leo', 'Mia', 'Gabriel', 'Grace',
  'Adrian', 'Hannah', 'Oliver', 'Amelia', 'Ryan', 'Lily'
];

const LAST_NAMES = [
  'Vance', 'Chen', 'Schmidt', 'Morales', 'Sterling', 'Dubois', 'Kovacs', 'Patel',
  'Larsson', 'Nakamura', 'O\'Connor', 'Novak', 'Silva', 'Fischer', 'Rossi',
  'Bennett', 'Mercer', 'Blackwood', 'Alvarez', 'Sinclair', 'Perera', 'Lindstrom'
];

const SKILLS_MAP: Record<string, string[]> = {
  'web-development': ['Next.js 15', 'React 19', 'TypeScript', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'GraphQL', 'Docker'],
  'ui-ux-design': ['Figma', 'Design Systems', 'Micro-Interactions', 'Prototyping', 'Mobile UI', 'Web3 UX', 'Design Tokens'],
  'ai-automation': ['LangChain', 'OpenAI API', 'Google Gemini', 'CrewAI', 'n8n', 'Zapier Automation', 'RAG Pipelines', 'Vector DBs'],
  'seo-marketing': ['Technical SEO', 'Keyword Strategy', 'Google Search Console', 'Programmatic SEO', 'SaaS Funnels', 'Copywriting'],
  'video-production': ['After Effects', 'Premiere Pro', 'Motion Design', '3D Blender', 'Explainer Videos', 'Sound Design'],
  'mobile-apps': ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Expo', 'Mobile Security', 'In-App Purchases', 'Offline-First']
};

const TITLES_MAP: Record<string, string[]> = {
  'web-development': [
    'Senior Full-Stack Architect (Next.js & Supabase)',
    'High-Performance Frontend Engineer',
    'Enterprise Cloud & API Integration Specialist',
    'Modern React & Web Applications Developer'
  ],
  'ui-ux-design': [
    'Principal Product Designer & Figma Systems Expert',
    'SaaS UX Strategist & Interactive Prototyper',
    'Cyberpunk & High-Converting Web UI Designer',
    'Mobile-First User Experience Architect'
  ],
  'ai-automation': [
    'Autonomous AI Agent & Multi-Model Workflow Engineer',
    'Enterprise LLM Integration & RAG Architect',
    'Generative AI Specialist (Gemini & OpenAI)',
    'End-to-End Business Process Automation Developer'
  ],
  'seo-marketing': [
    'Data-Driven Growth Marketer & Technical SEO Lead',
    'Programmatic SEO & Content Funnel Architect',
    'SaaS Conversion Rate Optimization (CRO) Expert',
    'Global Organic Visibility & Backlink Strategist'
  ],
  'video-production': [
    'Commercial Motion Graphics & 3D Video Designer',
    'Product Launch & Explainer Video Producer',
    'Kinetic Typography & Social Media Video Editor',
    'High-End Promo & Visual Effects Animator'
  ],
  'mobile-apps': [
    'Cross-Platform Mobile Engineer (React Native & Flutter)',
    'Native iOS & Swift App Architect',
    'Scalable Android & Kotlin Developer',
    'Offline-First Mobile UX Engineer'
  ]
};

const CITIES = [
  'San Francisco, CA', 'New York, NY', 'Berlin, Germany', 'London, UK',
  'Toronto, Canada', 'Singapore', 'Austin, TX', 'Zurich, Switzerland',
  'Sydney, Australia', 'Colombo, Sri Lanka', 'Tallinn, Estonia', 'Tokyo, Japan'
];

export async function POST(req: NextRequest) {
  try {
    const providers = [];

    for (let i = 1; i <= 100; i++) {
      const category = CATEGORIES[i % CATEGORIES.length];
      const firstName = FIRST_NAMES[(i * 3) % FIRST_NAMES.length];
      const lastName = LAST_NAMES[(i * 7) % LAST_NAMES.length];
      const name = `${firstName} ${lastName}`;
      
      const titles = TITLES_MAP[category];
      const title = titles[i % titles.length];

      const categorySkills = SKILLS_MAP[category];
      const skills = [
        categorySkills[0],
        categorySkills[1],
        categorySkills[(i + 2) % categorySkills.length],
        categorySkills[(i + 3) % categorySkills.length]
      ];

      const hourlyRate = 35 + (i * 7) % 85;
      const rating = +(4.8 + ((i % 3) * 0.1)).toFixed(1);
      const reviewCount = 18 + (i * 3) % 115;
      const completedJobs = reviewCount + (i * 2) % 40;
      const location = CITIES[i % CITIES.length];

      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name.replace(' ', '')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
      const sampleEstimate = Math.round(hourlyRate * (6 + (i % 6)));
      const sampleDeliveryDays = 2 + (i % 5);

      const provider = {
        id: `prov_${1000 + i}`,
        name,
        title,
        category,
        hourlyRate,
        rating,
        reviewCount,
        completedJobs,
        avatarUrl,
        bio: `Professional ${category.replace('-', ' ')} specialist with over 6 years of verified commercial delivery. Specializing in high-performance solutions, clean code architectures, and transparent milestone communication. Dedicated to prompt delivery with zero technical debt.`,
        skills,
        location,
        portfolioSample: {
          title: `${category.replace('-', ' ').toUpperCase()} Complete Delivery Package`,
          description: `Full end-to-end milestone package tailored for modern startups, including source code, documentation, and 30 days warranty.`,
          priceEstimate: sampleEstimate,
          deliveryDays: sampleDeliveryDays
        },
        contactEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@innoxpert-agents.io`,
        status: i % 10 === 0 ? 'busy' : 'active',
        verified: true,
        createdAt: new Date(Date.now() - (i * 86400000)).toISOString()
      };

      providers.push(provider);
    }

    const chunkSize = 25;
    for (let i = 0; i < providers.length; i += chunkSize) {
      const chunk = providers.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      chunk.forEach(p => {
        const ref = doc(db, 'agentpay_providers', p.id);
        batch.set(ref, p);
      });

      await batch.commit();
    }

    // Seed Realistic Platform Buyers / Clients
    const sampleBuyers = [
      {
        id: 'usr_201',
        name: 'Janitha Dilshan',
        email: 'janithad2@gmail.com',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Janitha&backgroundColor=b6e3f4',
        spendingLimit: 250,
        ordersCount: 4,
        totalSpent: 480,
        lastActive: 'Just now',
        status: 'verified'
      },
      {
        id: 'usr_202',
        name: 'Sarah Connor',
        email: 'sarah.c@techventure.io',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&backgroundColor=ffd5dc',
        spendingLimit: 500,
        ordersCount: 3,
        totalSpent: 720,
        lastActive: '20 mins ago',
        status: 'verified'
      },
      {
        id: 'usr_203',
        name: 'Michael Chen',
        email: 'm.chen@hypergrowth.ai',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael&backgroundColor=c0aede',
        spendingLimit: 300,
        ordersCount: 2,
        totalSpent: 260,
        lastActive: '1 hour ago',
        status: 'active'
      },
      {
        id: 'usr_204',
        name: 'Elena Rostova',
        email: 'elena@novadesign.studio',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elena&backgroundColor=ffdfbf',
        spendingLimit: 150,
        ordersCount: 1,
        totalSpent: 120,
        lastActive: '3 hours ago',
        status: 'verified'
      },
      {
        id: 'usr_205',
        name: 'David Kim',
        email: 'dkim@nextlaunch.co',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David&backgroundColor=d1d4f9',
        spendingLimit: 400,
        ordersCount: 2,
        totalSpent: 350,
        lastActive: 'Yesterday',
        status: 'active'
      }
    ];

    const usersBatch = writeBatch(db);
    sampleBuyers.forEach(u => {
      usersBatch.set(doc(db, 'agentpay_users', u.id), u);
    });
    await usersBatch.commit();

    // Seed Sample Escrow Orders
    const sampleOrders = [
      {
        id: 'ord_1730001001',
        paypalOrderId: '9XX2847291840281H',
        paypalCaptureId: 'CAP_88194028471',
        buyerName: 'Janitha Dilshan',
        buyerEmail: 'janithad2@gmail.com',
        providerId: 'prov_1001',
        providerName: 'Alexander Vance',
        providerEmail: 'alexander.vance@agentpay.network',
        serviceTitle: 'Next.js 15 Full-Stack SaaS Architecture & Supabase Auth',
        amount: 120,
        currency: 'USD',
        status: 'in-escrow',
        milestones: [
          { id: 'ms_1', title: 'Milestone 1: Project Setup & Authentication', amount: 60, status: 'verified' },
          { id: 'ms_2', title: 'Milestone 2: Database Schema & Live API Integration', amount: 60, status: 'in-progress' }
        ],
        deliverableUrl: 'https://github.com/innoxpert-showcase/saas-core',
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'ord_1730001002',
        paypalOrderId: '7BB1948291048209K',
        paypalCaptureId: 'CAP_33910482910',
        buyerName: 'Sarah Connor',
        buyerEmail: 'sarah.c@techventure.io',
        providerId: 'prov_1002',
        providerName: 'Elena Chen',
        providerEmail: 'elena.chen@agentpay.network',
        serviceTitle: 'Figma Design System & Mobile App High-Fidelity UI',
        amount: 80,
        currency: 'USD',
        status: 'completed',
        milestones: [
          { id: 'ms_1', title: 'Milestone 1: Wireframes & UX Flow', amount: 40, status: 'released' },
          { id: 'ms_2', title: 'Milestone 2: High-Fi Interactive Figma Prototypes', amount: 40, status: 'released' }
        ],
        deliverableUrl: 'https://www.figma.com/file/demo-showcase/design-system',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'ord_1730001003',
        paypalOrderId: '3PP9482019482011M',
        paypalCaptureId: 'CAP_55029481920',
        buyerName: 'Michael Chen',
        buyerEmail: 'm.chen@hypergrowth.ai',
        providerId: 'prov_1003',
        providerName: 'Marcus Schmidt',
        providerEmail: 'marcus.schmidt@agentpay.network',
        serviceTitle: 'Autonomous Multi-LLM Webhook Pipeline via n8n & Gemini',
        amount: 150,
        currency: 'USD',
        status: 'in-escrow',
        milestones: [
          { id: 'ms_1', title: 'Milestone 1: n8n Workflow Topology & Webhook Triggers', amount: 75, status: 'verified' },
          { id: 'ms_2', title: 'Milestone 2: Failover Logic & Production Verification', amount: 75, status: 'in-progress' }
        ],
        deliverableUrl: 'https://github.com/innoxpert-showcase/ai-n8n-pipelines',
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 3).toISOString()
      }
    ];

    const ordersBatch = writeBatch(db);
    sampleOrders.forEach(o => {
      ordersBatch.set(doc(db, 'agentpay_orders', o.id), o);
    });
    await ordersBatch.commit();

    // Seed Sample AI Chat & Autonomous Negotiation Logs
    const sampleChats = [
      {
        id: 'chat_seed_101',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        buyerName: 'Janitha Dilshan',
        spendingLimit: 200,
        userPrompt: 'I need a Next.js 15 developer to build a modern dashboard for under $120.',
        aiResponse: 'I discovered Alexander Vance (5.0 rating, 48 completed jobs). Autonomously negotiated original rate of $150 down to $120 USD. Structured into 2 milestones and locked via PayPal Smart Escrow.',
        intent: 'checkout_ready',
        categoryMatched: 'web-development',
        providerMatched: 'Alexander Vance',
        originalPrice: 150,
        negotiatedPrice: 120,
        savings: 30,
        paypalOrderId: '9XX2847291840281H',
        status: 'escrow_created'
      },
      {
        id: 'chat_seed_102',
        timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
        buyerName: 'Sarah Connor',
        spendingLimit: 100,
        userPrompt: 'Find me a Figma UI/UX designer for an e-commerce mobile app with an $80 budget.',
        aiResponse: 'Matched Elena Chen (Principal UX Designer). Successfully negotiated $110 down to $80. Generated milestone payment breakdown.',
        intent: 'checkout_ready',
        categoryMatched: 'ui-ux-design',
        providerMatched: 'Elena Chen',
        originalPrice: 110,
        negotiatedPrice: 80,
        savings: 30,
        paypalOrderId: '7BB1948291048209K',
        status: 'completed'
      },
      {
        id: 'chat_seed_103',
        timestamp: new Date(Date.now() - 3600000 * 14).toISOString(),
        buyerName: 'Michael Chen',
        spendingLimit: 180,
        userPrompt: 'I want an autonomous AI automation engineer to build an n8n webhook workflow for $150.',
        aiResponse: 'Evaluated Marcus Schmidt (LLM integration expert). Secured fixed contract at $150 (saving $40 off standard quote).',
        intent: 'checkout_ready',
        categoryMatched: 'ai-automation',
        providerMatched: 'Marcus Schmidt',
        originalPrice: 190,
        negotiatedPrice: 150,
        savings: 40,
        paypalOrderId: '3PP9482019482011M',
        status: 'escrow_created'
      },
      {
        id: 'chat_seed_104',
        timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
        buyerName: 'David Kim',
        spendingLimit: 100,
        userPrompt: 'Looking for a technical SEO strategist for SaaS keyword funnels.',
        aiResponse: 'Surfaced 3 verified SEO specialists meeting your $100 spending limit. Awaiting candidate selection.',
        intent: 'discovery',
        categoryMatched: 'seo-marketing',
        providerMatched: 'Sophia Morales',
        originalPrice: 120,
        negotiatedPrice: 95,
        savings: 25,
        paypalOrderId: null,
        status: 'negotiated'
      }
    ];

    const chatsBatch = writeBatch(db);
    sampleChats.forEach(c => {
      chatsBatch.set(doc(db, 'agentpay_chat_logs', c.id), c);
    });
    await chatsBatch.commit();

    return NextResponse.json({ 
      success: true, 
      count: providers.length,
      usersCount: sampleBuyers.length,
      ordersCount: sampleOrders.length,
      chatsCount: sampleChats.length
    });

  } catch (err: any) {
    console.error('Seeder API Error:', err);
    return NextResponse.json({ error: err.message || 'Seeder failed' }, { status: 500 });
  }
}

