export const dynamic = 'force-dynamic';
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

    return NextResponse.json({ 
      success: true, 
      count: providers.length
    });

  } catch (err: any) {
    console.error('Seeder API Error:', err);
    return NextResponse.json({ error: err.message || 'Seeder failed' }, { status: 500 });
  }
}

