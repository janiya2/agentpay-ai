'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getDoc, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import type { AgentPayOrder, ServiceProvider, DirectMessage, PayPalPayoutRecord } from '@/types';
import { 
  ShieldCheck, CheckCircle2, Clock, CreditCard, ExternalLink, 
  Send, Sparkles, UserCheck, MessageSquare, AlertCircle, AlertTriangle, ArrowRight, User, Ban,
  Edit3, X, Save, MapPin, Briefcase, Tag, Mail, Check, Search, Filter, Bot, DollarSign, 
  Layers, FileText, Star, ThumbsUp, RefreshCw, ChevronRight, Eye, CheckCheck,
  Lock, LogOut, ArrowLeft, EyeOff, Shield, Github, Globe, Info
} from 'lucide-react';
import DirectChatModal from '@/components/DirectChatModal';
import DeliverableSubmitModal from '@/components/DeliverableSubmitModal';
import InvoiceModal from '@/components/InvoiceModal';
import ClientProfileModal from '@/components/ClientProfileModal';
import ReviewClientModal from '@/components/ReviewClientModal';
import AiAuditCertificateModal from '@/components/AiAuditCertificateModal';
import DeliverableHistoryView from '@/components/DeliverableHistoryView';
import ProviderWalletDashboard from '@/components/ProviderWalletDashboard';
import { getSpecialistRealAvatar } from '@/lib/specialistAvatars';
import { formatLastSeen, isUserOnline } from '@/lib/lastSeen';
import { useAuth } from '@/context/AuthContext';

// Client Direct Thread Model (Unique per Client, Real Messages Only)
export interface ClientDirectThread {
  id: string; // Canonical Client Key
  channelId: string;
  associatedChannelIds: string[];
  clientName: string;
  clientEmail: string;
  clientAvatar?: string;
  serviceTitle: string;
  orderAmount?: number;
  bidPrice?: number;
  deliveryDays?: number;
  orderStatus?: string;
  isPurchasedOrder: boolean;
  orderObj?: AgentPayOrder;
  inquiryObj?: any;
  lastMessageText?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isOnline?: boolean;
}

// Fallback verified specialist roster for instant demo & resilience
const DEFAULT_SPECIALISTS: ServiceProvider[] = [
  {
    id: 'prov_1001',
    name: 'Sophia Patel',
    title: 'SaaS UX Strategist & Interactive Prototyper',
    category: 'ui-ux-design',
    hourlyRate: 42,
    rating: 4.9,
    reviewCount: 23,
    completedJobs: 23,
    avatarUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=250&auto=format&fit=crop&q=80',
    bio: 'Professional UI/UX architect specializing in conversion-focused SaaS interfaces, Figma design systems, and rapid interactive prototypes.',
    skills: ['Figma', 'UX Research', 'Design Systems', 'Interactive Prototyping', 'Design Tokens'],
    location: 'Berlin, Germany',
    portfolioSample: {
      title: 'Enterprise Figma Design System & Prototype',
      description: 'Design system with accessible UI components and mobile interactive flow.',
      priceEstimate: 120,
      deliveryDays: 3
    },
    contactEmail: 'sophia.patel@innoxpert-agents.io',
    paypalEmail: 'sophia.patel.payout@gmail.com',
    status: 'active',
    verified: true,
    createdAt: new Date().toISOString(),
    autoBiddingEnabled: true,
    minProjectFloor: 120,
    minTurnaroundDays: 3,
    autoBidDiscountPercent: 5,
    aiAutoReplyEnabled: true,
    aiAutoReplyCustomNote: 'Hi! Sophia Patel here. I am currently working on milestone sprints. I will review your requirements and respond shortly!'
  },
  {
    id: 'prov_1002',
    name: 'Ethan Rossi',
    title: 'Generative AI Specialist (Gemini & OpenAI)',
    category: 'ai-automation',
    hourlyRate: 49,
    rating: 5.0,
    reviewCount: 28,
    completedJobs: 28,
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=250&auto=format&fit=crop&q=80',
    bio: 'Professional AI automation specialist with over 6 years of verified commercial delivery. Specializing in high-performance solutions, clean code architectures, and transparent milestone communication.',
    skills: ['LangChain', 'OpenAI API', 'n8n', 'Zapier Automation', 'Python'],
    location: 'Berlin, Germany',
    portfolioSample: {
      title: 'Autonomous LLM Agent Pipeline & Webhooks',
      description: 'Multi-agent orchestration system with token rate limiting and escrow triggers.',
      priceEstimate: 120,
      deliveryDays: 3
    },
    contactEmail: 'ethan.rossi@innoxpert-agents.io',
    paypalEmail: 'ethan.rossi.payout@gmail.com',
    status: 'active',
    verified: true,
    createdAt: new Date().toISOString(),
    autoBiddingEnabled: true,
    minProjectFloor: 120,
    minTurnaroundDays: 3,
    autoBidDiscountPercent: 5,
    aiAutoReplyEnabled: true,
    aiAutoReplyCustomNote: 'Hello! Ethan Rossi here. I have received your message regarding AI workflows. Let me know your milestones!'
  },
  {
    id: 'prov_1003',
    name: 'Elena Chen',
    title: 'Full-Stack SaaS Architect & Supabase',
    category: 'web-development',
    hourlyRate: 55,
    rating: 5.0,
    reviewCount: 31,
    completedJobs: 31,
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=250&auto=format&fit=crop&q=80',
    bio: 'Senior Next.js 15 and Supabase full-stack architect with deep experience in enterprise milestone development, real-time websockets, and scalable microservices.',
    skills: ['Next.js 15', 'TypeScript', 'Tailwind CSS', 'Supabase', 'PostgreSQL'],
    location: 'Toronto, Canada',
    portfolioSample: {
      title: 'Full-Stack Next.js 15 App with Supabase Realtime',
      description: 'Production architecture with automated Playwright testing and milestone deliverables.',
      priceEstimate: 150,
      deliveryDays: 3
    },
    contactEmail: 'elena.chen@innoxpert-agents.io',
    paypalEmail: 'elena.chen.payout@gmail.com',
    status: 'active',
    verified: true,
    createdAt: new Date().toISOString(),
    autoBiddingEnabled: true,
    minProjectFloor: 150,
    minTurnaroundDays: 3,
    autoBidDiscountPercent: 5,
    aiAutoReplyEnabled: true,
    aiAutoReplyCustomNote: 'Hi Janitha! Elena Chen here. Thanks for reaching out. Yes, the agreed scope and milestones look clear.'
  }
];

// Distinct, high-quality realistic avatars for platform clients
const DISTINCT_CLIENT_AVATARS: Record<string, string> = {
  'janitha dilshan': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  'janitha': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  'sarah chen': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
  'alexander vance': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'marcus schmidt': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'mia dubois': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
  'daniel perera': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80',
  'david larsson': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
  'elena': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80'
};

const REAL_CLIENT_FALLBACK_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80'
];

function getCanonicalClientIdentity(rawName?: string, rawEmail?: string, avatar?: string) {
  const nameStr = (rawName || '').trim();
  const emailStr = (rawEmail || '').toLowerCase().trim();

  // Check if this is Janitha Dilshan (the logged-in evaluator / primary client)
  const isJanitha = 
    nameStr.toLowerCase().includes('janitha') || 
    emailStr.includes('janithad') ||
    emailStr === 'janithad2@gmail.com' ||
    (!nameStr && !emailStr);

  if (isJanitha) {
    return {
      key: 'client_janitha_dilshan',
      name: 'Janitha Dilshan (Judge / Evaluator)',
      email: 'janithad2@gmail.com',
      avatar: (avatar && !avatar.includes('seed=Janitha')) ? avatar : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
      isOnline: true
    };
  }

  // Check if explicit Sarah Chen / TechVenture client
  if (emailStr.includes('sarah') || nameStr.toLowerCase().includes('sarah')) {
    return {
      key: 'client_sarah_chen',
      name: 'Sarah Chen (TechVenture Lead)',
      email: emailStr || 'sarah.c@techventure.io',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
      isOnline: false
    };
  }

  // General client resolution
  const cleanName = nameStr.replace(/\(.*?\)/g, '').trim() || (emailStr ? emailStr.split('@')[0] : 'Verified Client');
  const cleanKey = `client_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  // Custom photo provided and not generic dicebear
  if (avatar && !avatar.includes('seed=Janitha') && !avatar.includes('api.dicebear.com/7.x/avataaars')) {
    return {
      key: cleanKey,
      name: cleanName,
      email: emailStr || `${cleanKey}@enterprise.io`,
      avatar,
      isOnline: false
    };
  }

  // Check mapped dictionary
  const lowerName = cleanName.toLowerCase();
  for (const [k, v] of Object.entries(DISTINCT_CLIENT_AVATARS)) {
    if (lowerName.includes(k) || emailStr.includes(k)) {
      return {
        key: cleanKey,
        name: cleanName,
        email: emailStr || `${cleanKey}@enterprise.io`,
        avatar: v,
        isOnline: false
      };
    }
  }

  // Distinct avatar from palette
  let hash = 0;
  for (let i = 0; i < cleanKey.length; i++) hash = (hash << 5) - hash + cleanKey.charCodeAt(i);
  const chosenAvatar = REAL_CLIENT_FALLBACK_AVATARS[Math.abs(hash) % REAL_CLIENT_FALLBACK_AVATARS.length];

  return {
    key: cleanKey,
    name: cleanName,
    email: emailStr || `${cleanKey}@enterprise.io`,
    avatar: chosenAvatar,
    isOnline: false
  };
}

function ProviderPortalPageContent() {
  const { user, loginWithJudgeAccount, openAuthModal, logout } = useAuth();
  const searchParams = useSearchParams();
  const targetScenario = searchParams?.get('scenario') || null;
  const targetTab = searchParams?.get('tab') as 'clients' | 'inquiries' | 'orders' | 'earnings' | null;
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'clients' | 'inquiries' | 'orders' | 'earnings'>('clients');
  const [orders, setOrders] = useState<AgentPayOrder[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<PayPalPayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Specialist Talent Gate Authentication State
  const [isProviderAuthenticated, setIsProviderAuthenticated] = useState<boolean>(true);
  const [showTalentGatePreview, setShowTalentGatePreview] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>('sophia.patel@innoxpert-agents.io');
  const [loginPassword, setLoginPassword] = useState<string>('••••••••••••');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [rememberSession, setRememberSession] = useState<boolean>(true);

  const [respondingSessionId, setRespondingSessionId] = useState<string | null>(null);
  const [customBidPrice, setCustomBidPrice] = useState<{ [sid: string]: number }>({});
  const [customDeliveryDays, setCustomDeliveryDays] = useState<{ [sid: string]: number }>({});
  const [customReplyNote, setCustomReplyNote] = useState<{ [sid: string]: string }>({});
  const [chatInputPerTender, setChatInputPerTender] = useState<{ [sid: string]: string }>({});
  const [isSendingMessage, setIsSendingMessage] = useState<{ [sid: string]: boolean }>({});
  const [responseNotice, setResponseNotice] = useState<string | null>(null);

  // Tab 1: Client Direct Threads State
  const [selectedClientThreadId, setSelectedClientThreadId] = useState<string | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState<'all' | 'escrow' | 'completed' | 'inquiries'>('all');
  const [clientChatInput, setClientChatInput] = useState('');
  const [isSendingClientMessage, setIsSendingClientMessage] = useState(false);
  const [allDirectMessages, setAllDirectMessages] = useState<DirectMessage[]>([]);
  const [temporaryChatTarget, setTemporaryChatTarget] = useState<any | null>(null);
  const [showContractHud, setShowContractHud] = useState<boolean>(false);
  const [showClientChatContext, setShowClientChatContext] = useState<Record<string, boolean>>({});
  const clientChatScrollRef = useRef<HTMLDivElement>(null);

  // Deliverable & Invoice Modal State
  const [activeDeliverOrder, setActiveDeliverOrder] = useState<AgentPayOrder | null>(null);
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<AgentPayOrder | null>(null);
  const [activeCertificateOrder, setActiveCertificateOrder] = useState<AgentPayOrder | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'certificate' | 'chat'>('certificate');
  const [auditingOrderId, setAuditingOrderId] = useState<string | null>(null);

  const handleRunAuditForProvider = async (orderId: string) => {
    setAuditingOrderId(orderId);
    try {
      const res = await fetch('/api/orders/audit-deliverable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success && data.certificate) {
        setOrders(prev => prev.map(o => o.id === orderId ? {
          ...o,
          auditCertificate: data.certificate,
          deliverableStatus: data.deliverableStatus
        } : o));
        const currentOrder = orders.find(o => o.id === orderId);
        if (currentOrder) {
          setActiveCertificateOrder({
            ...currentOrder,
            auditCertificate: data.certificate,
            deliverableStatus: data.deliverableStatus
          });
          setActiveModalTab('certificate');
        }
      }
    } catch (err) {
      console.error('Provider audit run error:', err);
    } finally {
      setAuditingOrderId(null);
    }
  };

  // Client Profile & Mutual Review Modals
  const [viewClientProfile, setViewClientProfile] = useState<{ email: string; name: string; avatar?: string } | null>(null);
  const [reviewingOrder, setReviewingOrder] = useState<AgentPayOrder | null>(null);

  // In-App Protocol Notice Modal (Zero browser alert())
  const [systemNotice, setSystemNotice] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'warning' | 'error' | 'success';
  } | null>(null);

  // Earnings & Payout Ledger Filters
  const [earningsFilter, setEarningsFilter] = useState<'all' | 'released' | 'escrow'>('all');
  const [earningsSearchQuery, setEarningsSearchQuery] = useState('');
  // Orders & Deliverables Filters (Tab 3: All, To Submit, Submitted, Revisions, Released)
  const [providerOrderFilter, setProviderOrderFilter] = useState<'all' | 'to_submit' | 'submitted' | 'revisions' | 'released'>('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  // AI Swarm Tender State
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [tenderFilter, setTenderFilter] = useState<'all' | 'open' | 'submitted' | 'awarded' | 'closed'>('all');
  const [tenderSearchQuery, setTenderSearchQuery] = useState('');
  const [showJudgeGuide, setShowJudgeGuide] = useState(false);
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);
  const [discoveryTargetSession, setDiscoveryTargetSession] = useState<any | null>(null);
  const [isEditingCustomBid, setIsEditingCustomBid] = useState<{ [sid: string]: boolean }>({});
  const tenderChatScrollRef = useRef<HTMLDivElement>(null);

  // Profile Editor Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    title: string;
    category: string;
    hourlyRate: number;
    contactEmail: string;
    paypalEmail: string;
    location: string;
    skills: string;
    bio: string;
    status: 'active' | 'busy' | 'offline';
    autoBiddingEnabled: boolean;
    minProjectFloor: number;
    minTurnaroundDays: number;
    autoBidDiscountPercent: number;
    aiAutoReplyEnabled: boolean;
    aiAutoReplyCustomNote: string;
  }>({
    name: '',
    title: '',
    category: 'web-development',
    hourlyRate: 50,
    contactEmail: '',
    paypalEmail: '',
    location: 'Remote',
    skills: '',
    bio: '',
    status: 'active',
    autoBiddingEnabled: true,
    minProjectFloor: 120,
    minTurnaroundDays: 3,
    autoBidDiscountPercent: 5,
    aiAutoReplyEnabled: true,
    aiAutoReplyCustomNote: ''
  });

  // Direct Chat Modal State (Fallback popup)
  const [activeChatOrder, setActiveChatOrder] = useState<{
    channelId: string;
    orderTitle: string;
    clientName: string;
    isPurchasedOrder: boolean;
    orderAmount?: number;
    escrowStatus?: string;
    bidPrice?: number;
    deliveryDays?: number;
    clientBudgetCap?: number;
  } | null>(null);

  // Synchronize cross-platform user authentication (SSO)
  useEffect(() => {
    if (user) {
      setIsProviderAuthenticated(true);
    }
  }, [user]);

  // Automated 1-Click Scenario Runner for Judges (Auto tab selection & cashout)
  useEffect(() => {
    if (targetTab && ['clients', 'inquiries', 'orders', 'earnings'].includes(targetTab)) {
      setActiveTab(targetTab);
    }
    if (targetScenario === 'cashout') {
      setActiveTab('earnings');
    }
  }, [targetTab, targetScenario]);

  useEffect(() => {
    async function loadInitialProviders() {
      let loadedProviders = DEFAULT_SPECIALISTS;
      try {
        const snap = await getDocs(collection(db, 'agentpay_providers'));
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ServiceProvider));
          if (list.length > 0) {
            loadedProviders = list;
          }
        }
      } catch (err) {
        console.warn('Error fetching providers from firestore, using defaults:', err);
      }

      // Ensure all loaded providers have a valid default PayPal sandbox payout email configured
      loadedProviders = loadedProviders.map(p => {
        if (!p.paypalEmail || !p.paypalEmail.trim() || !p.paypalEmail.includes('@')) {
          const clean = p.name ? p.name.toLowerCase().replace(/[^a-z0-9]/g, '.') : 'specialist';
          return {
            ...p,
            paypalEmail: `${clean}.payout@gmail.com`
          };
        }
        return p;
      });

      setProviders(loadedProviders);

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const provParam = urlParams.get('providerId');
        const savedSession = localStorage.getItem('agentpay_provider_session') || sessionStorage.getItem('agentpay_provider_session');

        // Check if query parameter matched any provider
        const matchingByParam = loadedProviders.find(p => 
          p.id === provParam || 
          p.id?.toLowerCase() === provParam?.toLowerCase() ||
          (provParam && p.name?.toLowerCase().includes(provParam.replace('prov_', '').toLowerCase()))
        );

        if (provParam && matchingByParam) {
          // Deep-link from client workspace automatically authenticates!
          setSelectedProviderId(matchingByParam.id);
          setIsProviderAuthenticated(true);
          localStorage.setItem('agentpay_provider_session', matchingByParam.id);
          sessionStorage.setItem('agentpay_provider_session', matchingByParam.id);
        } else if (savedSession && loadedProviders.some(p => p.id === savedSession)) {
          // Existing authenticated session found
          setSelectedProviderId(savedSession);
          setIsProviderAuthenticated(true);
        } else if (user) {
          // Platform user already authenticated via SSO
          setSelectedProviderId(loadedProviders[0].id);
          setIsProviderAuthenticated(true);
        } else {
          // Open workspace in Evaluator Mode by default
          setIsProviderAuthenticated(true);
          setSelectedProviderId(loadedProviders[0].id);
        }
      }
      setLoading(false);
    }
    loadInitialProviders();
  }, []);

  const rawActiveProvider = providers.find(p => p.id === selectedProviderId) || providers[0] || DEFAULT_SPECIALISTS[0];
  const activeProvider = {
    ...rawActiveProvider,
    paypalEmail: rawActiveProvider?.paypalEmail && rawActiveProvider.paypalEmail.includes('@')
      ? rawActiveProvider.paypalEmail
      : `${(rawActiveProvider?.name || 'specialist').toLowerCase().replace(/[^a-z0-9]/g, '.')}.payout@gmail.com`
  };

  // 1-Click Fast Evaluator Persona Login
  const handleProviderQuickLogin = async (providerId: string) => {
    setIsAuthenticating(true);
    setLoginError(null);
    try {
      if (!user) {
        await loginWithJudgeAccount();
      }
    } catch (e) {
      console.warn("Error establishing judge account:", e);
    }
    setTimeout(() => {
      setSelectedProviderId(providerId);
      setIsProviderAuthenticated(true);
      setShowTalentGatePreview(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('agentpay_provider_session', providerId);
        sessionStorage.setItem('agentpay_provider_session', providerId);
        const url = new URL(window.location.href);
        url.searchParams.set('providerId', providerId);
        window.history.replaceState({}, '', url.toString());
      }
      setIsAuthenticating(false);
    }, 350);
  };

  // Enterprise Specialist Form Login
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setLoginError(null);
    try {
      if (!user) {
        await loginWithJudgeAccount();
      }
    } catch (err) {
      console.warn("Error establishing judge account:", err);
    }

    setTimeout(() => {
      const emailLower = loginEmail.toLowerCase().trim();
      const matched = providers.find(p => 
        p.contactEmail?.toLowerCase() === emailLower ||
        p.paypalEmail?.toLowerCase() === emailLower ||
        p.name?.toLowerCase().includes(emailLower.split('@')[0].split('.')[0].toLowerCase())
      );

      const targetId = matched ? matched.id : (selectedProviderId || providers[0]?.id || 'prov_1001');
      setSelectedProviderId(targetId);
      setIsProviderAuthenticated(true);
      setShowTalentGatePreview(false);
      if (typeof window !== 'undefined' && rememberSession) {
        localStorage.setItem('agentpay_provider_session', targetId);
        sessionStorage.setItem('agentpay_provider_session', targetId);
        const url = new URL(window.location.href);
        url.searchParams.set('providerId', targetId);
        window.history.replaceState({}, '', url.toString());
      }
      setIsAuthenticating(false);
    }, 450);
  };

  // Secure Sign Out
  const handleProviderLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('agentpay_provider_session');
      sessionStorage.removeItem('agentpay_provider_session');
      const url = new URL(window.location.href);
      url.searchParams.delete('providerId');
      window.history.replaceState({}, '', url.pathname);
    }
    setIsProviderAuthenticated(false);
    setShowTalentGatePreview(false);
    await logout();
    setResponseNotice('Signed out. Switched to Guest Evaluator Mode.');
    setTimeout(() => setResponseNotice(null), 4000);
  };

  // Switch Talent perspective in Evaluator Sandbox
  const handleSwitchTalent = (newId: string) => {
    setSelectedProviderId(newId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('agentpay_provider_session', newId);
      sessionStorage.setItem('agentpay_provider_session', newId);
      const url = new URL(window.location.href);
      url.searchParams.set('providerId', newId);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Open Edit Profile Modal
  const openEditProfile = () => {
    if (!activeProvider) return;
    setEditForm({
      name: activeProvider.name || '',
      title: activeProvider.title || '',
      category: activeProvider.category || 'web-development',
      hourlyRate: activeProvider.hourlyRate || 50,
      contactEmail: activeProvider.contactEmail || '',
      paypalEmail: activeProvider.paypalEmail || '',
      location: activeProvider.location || 'Remote',
      skills: Array.isArray(activeProvider.skills) ? activeProvider.skills.join(', ') : '',
      bio: activeProvider.bio || '',
      status: activeProvider.status || 'active',
      autoBiddingEnabled: activeProvider.autoBiddingEnabled !== false,
      minProjectFloor: activeProvider.minProjectFloor || 120,
      minTurnaroundDays: activeProvider.minTurnaroundDays || 3,
      autoBidDiscountPercent: activeProvider.autoBidDiscountPercent || 5,
      aiAutoReplyEnabled: activeProvider.aiAutoReplyEnabled !== false,
      aiAutoReplyCustomNote: activeProvider.aiAutoReplyCustomNote || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProvider) return;

    if (!editForm.paypalEmail?.trim() || !editForm.paypalEmail.includes('@')) {
      setSystemNotice({
        isOpen: true,
        title: 'PayPal Payout Email Required',
        message: '⚠️ A valid PayPal payout email is required so that client milestone escrow disbursements can be deposited directly into your PayPal account.',
        type: 'warning'
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/providers/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: activeProvider.id,
          name: editForm.name,
          title: editForm.title,
          category: editForm.category,
          hourlyRate: Number(editForm.hourlyRate),
          contactEmail: editForm.contactEmail,
          paypalEmail: editForm.paypalEmail,
          location: editForm.location,
          skills: editForm.skills.split(',').map(s => s.trim()).filter(Boolean),
          bio: editForm.bio,
          status: editForm.status,
          autoBiddingEnabled: editForm.autoBiddingEnabled,
          minProjectFloor: Number(editForm.minProjectFloor),
          minTurnaroundDays: Number(editForm.minTurnaroundDays),
          autoBidDiscountPercent: Number(editForm.autoBidDiscountPercent),
          aiAutoReplyEnabled: editForm.aiAutoReplyEnabled,
          aiAutoReplyCustomNote: editForm.aiAutoReplyCustomNote
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResponseNotice(`🎉 Success: Profile for ${editForm.name} updated in Firestore!`);
        setTimeout(() => setResponseNotice(null), 6000);
        setProviders(prev => prev.map(p => p.id === activeProvider.id ? { ...p, ...data.updatedProfile } : p));
        setIsEditModalOpen(false);
      } else {
        setSystemNotice({
          isOpen: true,
          title: 'Profile Update Error',
          message: data.error || 'Failed to update profile.',
          type: 'error'
        });
      }
    } catch (err: any) {
      setSystemNotice({
        isOpen: true,
        title: 'Network Communication Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 1-Click Fast Toggle for AI Receptionist Auto-Reply
  const toggleAutoReply = async () => {
    if (!activeProvider) return;
    const newState = activeProvider.aiAutoReplyEnabled === false;
    setProviders(prev => prev.map(p => p.id === activeProvider.id ? { ...p, aiAutoReplyEnabled: newState } : p));
    try {
      await fetch('/api/providers/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: activeProvider.id,
          aiAutoReplyEnabled: newState
        })
      });
      setResponseNotice(`🤖 AI Receptionist Auto-Reply is now ${newState ? 'ENABLED' : 'DISABLED'} for ${activeProvider.name}`);
      setTimeout(() => setResponseNotice(null), 4000);
    } catch (e) {
      console.warn('Toggle auto reply error:', e);
    }
  };

  // Real-time Firestore sync listeners for Orders & Incoming Tender RFQs strictly for activeProvider
  useEffect(() => {
    if (!activeProvider?.id) {
      setOrders([]);
      setInquiries([]);
      return;
    }

    // 1. Real-time Orders Listener
    const unsubOrders = onSnapshot(collection(db, 'agentpay_orders'), (allOrdersSnap) => {
      if (!allOrdersSnap.empty) {
        const allList = allOrdersSnap.docs.map(d => ({ id: d.id, ...d.data() } as AgentPayOrder));
        const filtered = allList.filter(o => 
          (o.providerId && o.providerId === activeProvider.id) || 
          (o.providerName && o.providerName.trim().toLowerCase() === activeProvider.name.trim().toLowerCase())
        );
        setOrders(filtered);
      } else {
        setOrders([]);
      }
    }, (err) => console.warn('Real-time orders sync error:', err));

    // 2. Real-time Tenders & RFQs Listener
    const unsubSessions = onSnapshot(collection(db, 'agentpay_chat_sessions'), (sessionsSnap) => {
      if (!sessionsSnap.empty) {
        const allSessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const matching = allSessions.filter((s: any) => {
          const targets = s.targetProviders || [];
          const isInTargets = targets.some((tp: any) => tp.id === activeProvider.id || tp.name?.trim().toLowerCase() === activeProvider.name?.trim().toLowerCase());
          const isDirect = s.providerId === activeProvider.id || s.providerMatched?.trim().toLowerCase() === activeProvider.name?.trim().toLowerCase();
          return (isInTargets || isDirect) && (s.status === 'tender_open' || s.status === 'awaiting_provider' || s.status === 'closed_awarded' || s.status === 'negotiated');
        });
        setInquiries(matching);
      } else {
        setInquiries([]);
      }
    }, (err) => console.warn('Real-time sessions sync error:', err));

    // 3. Real-time Payouts Listener (agentpay_payouts)
    const unsubPayouts = onSnapshot(collection(db, 'agentpay_payouts'), (payoutsSnap) => {
      if (!payoutsSnap.empty) {
        const allPayouts = payoutsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PayPalPayoutRecord));
        const providerPayouts = allPayouts.filter(p => 
          p.providerId === activeProvider.id || 
          p.providerEmail?.toLowerCase() === (activeProvider.contactEmail || '').toLowerCase() ||
          (activeProvider.paypalEmail && p.paypalEmail?.toLowerCase() === activeProvider.paypalEmail?.toLowerCase())
        );
        providerPayouts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setPayouts(providerPayouts);
      } else {
        setPayouts([]);
      }
    }, (err) => console.warn('Real-time payouts sync error:', err));

    return () => {
      unsubOrders();
      unsubSessions();
      unsubPayouts();
    };
  }, [selectedProviderId, activeProvider?.id, activeProvider?.name]);

  // Real-time listener for ALL direct messages concerning activeProvider
  useEffect(() => {
    if (!activeProvider?.id) {
      setAllDirectMessages([]);
      return;
    }

    const unsub = onSnapshot(collection(db, 'agentpay_direct_messages'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage));
      const relevant = list.filter(m => 
        m.providerId === activeProvider.id || 
        m.providerName?.toLowerCase() === activeProvider.name.toLowerCase() ||
        orders.some(o => o.id === m.orderId || o.id === m.channelId || (m.sessionId && o.sessionId === m.sessionId)) ||
        inquiries.some(i => i.id === m.sessionId || (m.channelId && m.channelId.includes(i.id)))
      );
      relevant.sort((a, b) => new Date(a.createdAt || a.timestamp || 0).getTime() - new Date(b.createdAt || b.timestamp || 0).getTime());
      setAllDirectMessages(relevant);
    }, (err) => {
      console.warn('Direct messages snapshot error:', err);
    });

    return () => unsub();
  }, [activeProvider?.id, activeProvider?.name, orders.length, inquiries.length]);

  // Open Discovery Transcript Modal for an Active Order or Client Thread
  const handleOpenDiscoveryTranscriptForOrder = async (order: AgentPayOrder) => {
    let targetSession = inquiries.find(i => 
      (order.sessionId && i.id === order.sessionId) || 
      i.orderRefId === order.id || 
      (order.paypalOrderId && i.paypalOrderId === order.paypalOrderId) ||
      (i.buyerEmail && order.buyerEmail && i.buyerEmail.toLowerCase() === order.buyerEmail.toLowerCase())
    );

    if ((!targetSession || !targetSession.messages?.length) && order.sessionId) {
      try {
        const sSnap = await getDoc(doc(db, 'agentpay_chat_sessions', order.sessionId));
        if (sSnap.exists()) {
          targetSession = { id: sSnap.id, ...sSnap.data() };
        }
      } catch (e) {
        console.warn('Error fetching session for order transcript:', e);
      }
    }

    if (!targetSession) {
      targetSession = {
        id: order.sessionId || order.id,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        projectScope: order.serviceTitle,
        spendingLimit: order.amount,
        messages: [
          {
            role: 'user',
            content: `I want to hire a specialist for: "${order.serviceTitle}". Authorized milestone budget: $${order.amount} USD.`,
            timestamp: new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          {
            role: 'assistant',
            content: `Autonomous RFP Tender codified and awarded to ${order.providerName} for $${order.amount} USD. Funds locked in PayPal Sandbox Escrow (#${order.id}).`,
            timestamp: new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]
      };
    }

    setDiscoveryTargetSession({ ...targetSession, orderObj: order });
    setIsDiscoveryModalOpen(true);
  };

  // Guarded Deliverable Submission Modal Opener
  const handleOpenDeliverModal = (order: AgentPayOrder) => {
    if (!activeProvider?.paypalEmail || !activeProvider.paypalEmail.trim() || !activeProvider.paypalEmail.includes('@')) {
      setSystemNotice({
        isOpen: true,
        title: 'PayPal Payout Email Required',
        message: '⚠️ Action Required: Before submitting deliverables for client review and AI audit, please configure a verified PayPal payout email in your specialist profile so funds can be disbursed to you upon approval.',
        type: 'warning'
      });
      openEditProfile();
      return;
    }
    setActiveDeliverOrder(order);
  };

  // Handle Provider Submitting Bid into Autonomous AI Swarm Tender
  const handleSubmitBid = async (sessionId: string) => {
    if (!activeProvider?.paypalEmail || !activeProvider.paypalEmail.trim() || !activeProvider.paypalEmail.includes('@')) {
      setSystemNotice({
        isOpen: true,
        title: 'PayPal Payout Email Required',
        message: '⚠️ Action Required: Before submitting an official bid to the client, you must configure a verified PayPal payout email in your profile. This guarantees client milestone escrow disbursements can be routed directly to your PayPal account upon deliverable release.',
        type: 'warning'
      });
      openEditProfile();
      return;
    }

    const currentTender = inquiries.find(i => i.id === sessionId);
    const maxCap = currentTender?.spendingLimit || 200;
    const price = customBidPrice[sessionId] !== undefined 
      ? Number(customBidPrice[sessionId]) 
      : Math.round(maxCap * 0.8);

    if (price > maxCap) {
      setSystemNotice({
        isOpen: true,
        title: 'Budget Cap Exceeded',
        message: `🚫 Action Denied: Your proposed bid ($${price} USD) exceeds the client's authorized budget cap of $${maxCap} USD. Please adjust your bid to $${maxCap} USD or less to submit.`,
        type: 'warning'
      });
      return;
    }

    setRespondingSessionId(sessionId);
    try {
      const days = customDeliveryDays[sessionId] || 3;
      const note = customReplyNote[sessionId] || 'I have verified capacity and will deliver within 3 days with full code documentation.';

      const res = await fetch('/api/providers/submit-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          providerId: activeProvider.id,
          bidPrice: Number(price),
          deliveryDays: Number(days),
          note
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResponseNotice(`🎉 Success: Bid of $${price} USD submitted to client!`);
        setTimeout(() => setResponseNotice(null), 6000);
        const myNewBid = {
          providerId: activeProvider.id,
          providerName: activeProvider.name,
          bidPrice: Number(price),
          deliveryDays: Number(days),
          note,
          submittedAt: new Date().toISOString()
        };
        setInquiries(prev => prev.map(inq => {
          if (inq.id === sessionId) {
            const otherBids = (inq.bids || []).filter((b: any) => b.providerId !== activeProvider.id);
            return {
              ...inq,
              bids: [...otherBids, myNewBid]
            };
          }
          return inq;
        }));
        setIsEditingCustomBid(prev => ({ ...prev, [sessionId]: false }));
      } else {
        setSystemNotice({
          isOpen: true,
          title: 'Bid Submission Notice',
          message: data.error || 'Failed to submit bid',
          type: 'error'
        });
      }
    } catch (err: any) {
      setSystemNotice({
        isOpen: true,
        title: 'Network Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      setRespondingSessionId(null);
    }
  };

  // Handle Provider Sending Message into AI Swarm Tender (with Commerce Bot)
  const handleSendTenderMessage = async (sessionId: string) => {
    const text = chatInputPerTender[sessionId]?.trim();
    if (!text || !activeProvider) return;

    setChatInputPerTender(prev => ({ ...prev, [sessionId]: '' }));

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const optimisticProviderEntry = {
      speaker: 'provider' as const,
      speakerName: `${activeProvider.name} 👨‍💻 (Specialist Message)`,
      message: text,
      timestamp: timeNow
    };

    setInquiries(prev => prev.map(inq => {
      if (inq.id === sessionId) {
        return {
          ...inq,
          negotiationDialog: [...(inq.negotiationDialog || []), optimisticProviderEntry]
        };
      }
      return inq;
    }));

    setIsSendingMessage(prev => ({ ...prev, [sessionId]: true }));
    setTimeout(() => {
      tenderChatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const res = await fetch('/api/providers/send-tender-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          providerId: activeProvider.id,
          providerName: activeProvider.name,
          message: text
        })
      });
      const data = await res.json();
      const botReply = data.botEntry || data.aiBotReply;
      if (res.ok && data.success && botReply) {
        setInquiries(prev => prev.map(inq => {
          if (inq.id === sessionId) {
            const current = inq.negotiationDialog || [];
            const alreadyHasIt = current.some((d: any) => 
              d.speaker === botReply.speaker && d.message === botReply.message
            );
            const otherBids = data.submittedBid 
              ? (inq.bids || []).filter((b: any) => b.providerId !== activeProvider.id)
              : (inq.bids || []);
            const updatedBids = data.submittedBid ? [...otherBids, data.submittedBid] : (inq.bids || []);

            return {
              ...inq,
              negotiationDialog: alreadyHasIt ? current : [...current, botReply],
              bids: updatedBids
            };
          }
          return inq;
        }));

        if (data.bidSubmittedFromChat && data.detectedPrice) {
          setCustomBidPrice(prev => ({ ...prev, [sessionId]: data.detectedPrice }));
          if (data.detectedDays) {
            setCustomDeliveryDays(prev => ({ ...prev, [sessionId]: data.detectedDays }));
          }
          setResponseNotice(`🎉 Success: Bid of $${data.detectedPrice} USD submitted from chat directly to client decision board!`);
          setTimeout(() => setResponseNotice(null), 5000);
        }
      }
    } catch (err) {
      console.warn('Send tender message:', err);
    } finally {
      setIsSendingMessage(prev => ({ ...prev, [sessionId]: false }));
      setTimeout(() => {
        tenderChatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // =========================================================================
  // TAB 1: CLIENT DIRECT THREADS DERIVATION (STRICT 1 THREAD PER CLIENT)
  // =========================================================================
  const clientDirectThreads: ClientDirectThread[] = useMemo(() => {
    if (!activeProvider) return [];

    const clientMap = new Map<string, {
      canonicalKey: string;
      clientName: string;
      clientEmail: string;
      clientAvatar: string;
      channelId: string;
      associatedChannelIds: Set<string>;
      messages: DirectMessage[];
      orderObj?: AgentPayOrder;
      inquiryObj?: any;
      isOnline: boolean;
    }>();

    // 1. Populate strictly from REAL direct messages exchanged with this provider
    allDirectMessages.forEach(msg => {
      let rawName = '';
      let rawEmail = '';
      let rawAvatar = msg.senderAvatar;

      if (msg.senderRole === 'client') {
        rawName = msg.senderName || '';
        const matchedOrder = orders.find(o => 
          o.id === msg.orderId || 
          o.id === msg.channelId || 
          (msg.sessionId && o.sessionId === msg.sessionId) || 
          (o.buyerName && msg.senderName && o.buyerName.toLowerCase() === msg.senderName.toLowerCase())
        );
        const matchedInq = inquiries.find(i => 
          i.id === msg.sessionId || 
          i.id === msg.orderId || 
          (msg.channelId && msg.channelId.includes(i.id))
        );
        rawEmail = matchedOrder?.buyerEmail || matchedInq?.buyerEmail || (msg as any).buyerEmail || '';
        if (!rawName && matchedOrder?.buyerName) rawName = matchedOrder.buyerName;
        if (!rawName && matchedInq?.buyerName) rawName = matchedInq.buyerName;
      } else {
        // Provider sent message
        const matchedOrder = orders.find(o => o.id === msg.orderId || o.id === msg.channelId);
        const matchedInq = inquiries.find(i => i.id === msg.sessionId || i.id === msg.orderId || (msg.channelId && msg.channelId.includes(i.id)));
        rawName = matchedOrder?.buyerName || matchedInq?.buyerName || '';
        rawEmail = matchedOrder?.buyerEmail || matchedInq?.buyerEmail || (msg as any).buyerEmail || '';
      }

      const clientIdent = getCanonicalClientIdentity(rawName, rawEmail, rawAvatar);
      const cKey = clientIdent.key;

      if (!clientMap.has(cKey)) {
        // Find best matching order for this canonical client (prioritizing in-escrow, then completed)
        const matchedOrder = orders.find(o => {
          const ordIdent = getCanonicalClientIdentity(o.buyerName, o.buyerEmail);
          return ordIdent.key === cKey && o.status === 'in-escrow';
        }) || orders.find(o => {
          const ordIdent = getCanonicalClientIdentity(o.buyerName, o.buyerEmail);
          return ordIdent.key === cKey;
        });

        const matchedInq = inquiries.find(i => {
          const inqIdent = getCanonicalClientIdentity(i.buyerName, i.buyerEmail);
          return inqIdent.key === cKey;
        });

        const initialChannelId = msg.orderId || msg.channelId || matchedOrder?.id || matchedInq?.id || `dm_${cKey}`;

        clientMap.set(cKey, {
          canonicalKey: cKey,
          clientName: clientIdent.name,
          clientEmail: clientIdent.email,
          clientAvatar: clientIdent.avatar,
          channelId: initialChannelId,
          associatedChannelIds: new Set<string>(),
          messages: [],
          orderObj: matchedOrder,
          inquiryObj: matchedInq,
          isOnline: clientIdent.isOnline
        });
      }

      const entry = clientMap.get(cKey)!;
      if (msg.channelId) entry.associatedChannelIds.add(msg.channelId);
      if (msg.orderId) entry.associatedChannelIds.add(msg.orderId);
      if (msg.sessionId) entry.associatedChannelIds.add(msg.sessionId);
      entry.messages.push(msg);
    });

    // 2. If specialist explicitly initiated a chat from an order/inquiry via "Chat with Client" button
    if (temporaryChatTarget) {
      const tempIdent = getCanonicalClientIdentity(
        temporaryChatTarget.clientName,
        temporaryChatTarget.clientEmail,
        temporaryChatTarget.clientAvatar
      );
      const tempKey = tempIdent.key;

      if (!clientMap.has(tempKey)) {
        clientMap.set(tempKey, {
          canonicalKey: tempKey,
          clientName: tempIdent.name,
          clientEmail: tempIdent.email,
          clientAvatar: tempIdent.avatar,
          channelId: temporaryChatTarget.channelId || `dm_${tempKey}`,
          associatedChannelIds: new Set<string>([temporaryChatTarget.channelId].filter(Boolean)),
          messages: [],
          orderObj: temporaryChatTarget.orderObj,
          inquiryObj: temporaryChatTarget.inquiryObj,
          isOnline: tempIdent.isOnline
        });
      }
    }

    // Convert map to array of ClientDirectThread
    const list: ClientDirectThread[] = [];

    clientMap.forEach((data, cKey) => {
      data.messages.sort((a, b) => new Date(a.createdAt || a.timestamp || 0).getTime() - new Date(b.createdAt || b.timestamp || 0).getTime());
      const lastMsg = data.messages[data.messages.length - 1];
      const unreadCount = data.messages.filter(m => m.senderRole === 'client' && !m.isSeen).length;

      let primaryOrder = data.orderObj;
      if (!primaryOrder) {
        primaryOrder = orders.find(o => {
          const ordIdent = getCanonicalClientIdentity(o.buyerName, o.buyerEmail);
          return ordIdent.key === cKey;
        });
      }

      const primaryInq = data.inquiryObj;
      const channelId = primaryOrder?.id || primaryInq?.id || data.channelId;

      list.push({
        id: cKey, // Guaranteed 1 thread per client!
        channelId,
        associatedChannelIds: Array.from(data.associatedChannelIds),
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientAvatar: data.clientAvatar,
        serviceTitle: primaryOrder?.serviceTitle || primaryInq?.projectScope || 'Digital Milestone Contract',
        orderAmount: primaryOrder?.amount || primaryInq?.spendingLimit || 120,
        bidPrice: primaryOrder?.amount,
        deliveryDays: (primaryOrder as any)?.deliveryDays || 3,
        orderStatus: primaryOrder?.status || (primaryInq?.status === 'closed_awarded' ? 'closed_awarded' : 'inquiry'),
        isPurchasedOrder: !!primaryOrder,
        orderObj: primaryOrder,
        inquiryObj: primaryInq,
        lastMessageText: lastMsg ? lastMsg.message : 'Conversation initiated',
        lastMessageTime: lastMsg ? (lastMsg.createdAt || lastMsg.timestamp) : undefined,
        unreadCount,
        isOnline: data.isOnline
      });
    });

    list.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  }, [activeProvider, allDirectMessages, orders, inquiries, temporaryChatTarget]);

  const filteredClientThreads = clientDirectThreads.filter(t => {
    if (clientFilter === 'escrow' && t.orderStatus !== 'in-escrow') return false;
    if (clientFilter === 'completed' && t.orderStatus !== 'completed') return false;
    if (clientFilter === 'inquiries' && t.isPurchasedOrder) return false;
    if (clientSearchQuery.trim()) {
      const q = clientSearchQuery.toLowerCase();
      return (
        t.clientName.toLowerCase().includes(q) ||
        t.clientEmail.toLowerCase().includes(q) ||
        t.serviceTitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeClientThread = clientDirectThreads.find(t => t.id === selectedClientThreadId) || filteredClientThreads[0] || null;

  // Active messages strictly between this client and provider
  const activeClientMessages = useMemo(() => {
    if (!activeClientThread) return [];

    const threadMsgs = allDirectMessages.filter(m => {
      // 1. Associated channel / order / session IDs
      if (activeClientThread.associatedChannelIds?.some(cid => 
        cid && (m.channelId === cid || m.orderId === cid || m.sessionId === cid)
      )) {
        return true;
      }

      if (activeClientThread.channelId && (m.channelId === activeClientThread.channelId || m.orderId === activeClientThread.channelId)) {
        return true;
      }

      // 2. Direct match with canonical client identity
      const isJanitha = activeClientThread.id === 'client_janitha_dilshan';
      if (isJanitha) {
        if (m.senderName?.toLowerCase().includes('janitha')) return true;
        if ((m as any).buyerEmail?.toLowerCase() === 'janithad2@gmail.com') return true;
        if ((m as any).buyerEmail?.toLowerCase() === 'sarah.c@techventure.io') return true;
      }

      const clientNameClean = activeClientThread.clientName.toLowerCase();
      if (m.senderName && clientNameClean.includes(m.senderName.toLowerCase())) return true;
      if ((m as any).buyerEmail && (m as any).buyerEmail.toLowerCase() === activeClientThread.clientEmail.toLowerCase()) return true;

      return false;
    });

    threadMsgs.sort((a, b) => new Date(a.createdAt || a.timestamp || 0).getTime() - new Date(b.createdAt || b.timestamp || 0).getTime());
    return threadMsgs;
  }, [activeClientThread, allDirectMessages]);

  // Scroll to bottom of client chat on message update
  useEffect(() => {
    clientChatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeClientMessages.length]);

  // Handle Provider Sending Message directly to Real Client
  const handleSendDirectClientMessage = async () => {
    const text = clientChatInput.trim();
    if (!text || !activeProvider || !activeClientThread) return;

    setClientChatInput('');

    const timeNow = new Date().toISOString();
    const targetChannelId = activeClientThread.channelId || activeClientThread.id;
    const optimisticMsg: DirectMessage = {
      id: `temp_${Date.now()}`,
      orderId: targetChannelId,
      channelId: targetChannelId,
      providerId: activeProvider.id,
      providerName: activeProvider.name,
      senderRole: 'provider',
      senderName: activeProvider.name,
      senderAvatar: getSpecialistRealAvatar(activeProvider.name, activeProvider.avatarUrl),
      message: text,
      createdAt: timeNow,
      isSeen: false,
      status: 'sent'
    };

    setAllDirectMessages(prev => [...prev, optimisticMsg]);
    setIsSendingClientMessage(true);

    try {
      await fetch('/api/direct-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: targetChannelId,
          channelId: targetChannelId,
          providerId: activeProvider.id,
          providerName: activeProvider.name,
          senderRole: 'provider',
          senderName: activeProvider.name,
          senderAvatar: getSpecialistRealAvatar(activeProvider.name, activeProvider.avatarUrl),
          message: text,
          sessionId: activeClientThread.orderObj?.sessionId || activeClientThread.inquiryObj?.id,
          buyerEmail: activeClientThread.clientEmail,
          buyerName: activeClientThread.clientName
        })
      });
    } catch (err) {
      console.warn('Error sending direct client message:', err);
    } finally {
      setIsSendingClientMessage(false);
      setTimeout(() => {
        clientChatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Helper for relative timestamps ("how many times ago")
  const getTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      if (isNaN(diffMs) || diffMs < 0) return 'Just now';
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 45) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  // Helper for extracting clean, conversational project title
  const getTenderDisplayTitle = (inq: any) => {
    if (!inq) return 'Milestone Project';
    let userText = inq.latestPrompt;
    if (!userText && Array.isArray(inq.messages)) {
      const userMsgs = inq.messages.filter((m: any) => m.role === 'user');
      if (userMsgs.length > 0) {
        const descriptive = userMsgs.find((m: any) => m.content && m.content.length > 10 && !/^(hi|hello|hey|yo)/i.test(m.content));
        userText = descriptive ? descriptive.content : userMsgs[userMsgs.length - 1].content;
      }
    }

    if (userText && typeof userText === 'string') {
      let cleaned = userText
        .replace(/^dispatch\s+(autonomous\s+)?tender\s+to\s+[^]+?for\s+/i, '')
        .replace(/\s+for\s+my\s+project\s+within\s+my\s+\$\d+\s+budget\.?/i, '')
        .replace(/^i want to hire\s+/i, 'Hire ')
        .replace(/^i want to\s+/i, '')
        .replace(/^i need to\s+/i, '')
        .replace(/^please\s+/i, '')
        .replace(/^"|"$/g, '')
        .trim();

      cleaned = cleaned.replace(/^(hi|hello|hey)[,\s]+/i, '').trim();

      if (cleaned.length >= 3) {
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 55);
      }
    }

    if (inq.projectScope && !inq.projectScope.toLowerCase().includes('milestone deliverable')) {
      return inq.projectScope;
    }

    if (inq.categoryMatched) {
      const cat = inq.categoryMatched.replace(/[-_]/g, ' ');
      return `${cat.charAt(0).toUpperCase() + cat.slice(1)} Project`;
    }

    return inq.projectScope || 'Milestone Contract';
  };

  // Helper for Client Avatar with multiple robust fallbacks
  const getClientAvatar = (inq: any) => {
    if (inq?.buyerAvatar) return inq.buyerAvatar;
    if (user?.email && inq?.buyerEmail && user.email.toLowerCase() === inq.buyerEmail.toLowerCase() && user.avatarUrl) {
      return user.avatarUrl;
    }
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(inq?.buyerName || 'Client')}&backgroundColor=b6e3f4`;
  };

  // Helper to format messages with markdown bold (rendered in stylish blue without asterisks)
  const renderFormattedMessageText = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');

    return (
      <div className="space-y-1.5 leading-relaxed">
        {lines.map((line, lIdx) => {
          if (!line.trim()) return <div key={lIdx} className="h-1" />;

          const isRevisionHeader = line.includes('REVISION REQUEST FOR DELIVERABLE') || line.includes('REVISION REQUEST');
          const isHeader = !isRevisionHeader && (line.includes('Autonomous Swarm Tender Dispatched') || line.includes('Contract Officially Awarded') || line.startsWith('🚀') || line.startsWith('🎉'));

          // Split by bold **text** or italic *text*
          const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

          if (isRevisionHeader) {
            return (
              <div 
                key={lIdx} 
                className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-rose-950/90 via-amber-950/70 to-zinc-900 border border-rose-500/50 text-rose-300 font-bold text-xs sm:text-sm flex flex-wrap items-center gap-2 shadow-md my-1"
              >
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 animate-pulse" />
                <span>{line}</span>
              </div>
            );
          }

          if (isHeader) {
            return (
              <div 
                key={lIdx} 
                className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-blue-950/80 via-cyan-950/60 to-zinc-900 border border-blue-500/40 text-blue-300 font-bold text-xs sm:text-sm flex flex-wrap items-center gap-1.5 shadow-md my-1"
              >
                {parts.map((part, pIdx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    const cleanText = part.slice(2, -2);
                    return <span key={pIdx} className="text-blue-400 font-black">{cleanText}</span>;
                  }
                  if (part.startsWith('*') && part.endsWith('*')) {
                    const cleanText = part.slice(1, -1);
                    return <span key={pIdx} className="text-blue-200/90 italic font-medium">{cleanText}</span>;
                  }
                  return <span key={pIdx}>{part}</span>;
                })}
              </div>
            );
          }

          return (
            <p key={lIdx} className="leading-relaxed">
              {parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  const cleanText = part.slice(2, -2);
                  const isMoney = cleanText.includes('$');
                  if (isMoney) {
                    return (
                      <span 
                        key={pIdx} 
                        className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25 mx-0.5 inline-block"
                      >
                        {cleanText}
                      </span>
                    );
                  }
                  return (
                    <strong key={pIdx} className="text-blue-400 font-bold">
                      {cleanText}
                    </strong>
                  );
                }
                if (part.startsWith('*') && part.endsWith('*')) {
                  const cleanText = part.slice(1, -1);
                  return (
                    <span key={pIdx} className="text-purple-300 italic font-medium">
                      {cleanText}
                    </span>
                  );
                }
                return <span key={pIdx}>{part}</span>;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  // =========================================================================
  // TAB 2: AI SWARM TENDERS DIALOGUE
  // =========================================================================
  // Accurate Counts for Tender Navigation Filters
  const awaitingBidCount = useMemo(() => {
    return inquiries.filter(i => 
      (i.status === 'tender_open' || i.status === 'awaiting_provider') && 
      !(i.bids || []).some((b: any) => b.providerId === activeProvider.id)
    ).length;
  }, [inquiries, activeProvider.id]);

  const bidSubmittedCount = useMemo(() => {
    return inquiries.filter(i => 
      (i.status === 'tender_open' || i.status === 'awaiting_provider') && 
      (i.bids || []).some((b: any) => b.providerId === activeProvider.id)
    ).length;
  }, [inquiries, activeProvider.id]);

  const wonTendersCount = useMemo(() => {
    return inquiries.filter(i => 
      i.status === 'closed_awarded' && 
      (i.winningBid?.providerId === activeProvider.id || i.providerId === activeProvider.id)
    ).length;
  }, [inquiries, activeProvider.id]);

  const closedTendersCount = useMemo(() => {
    return inquiries.filter(i => 
      (i.status === 'closed_awarded' || i.status === 'cancelled') && 
      i.winningBid?.providerId !== activeProvider.id && 
      i.providerId !== activeProvider.id
    ).length;
  }, [inquiries, activeProvider.id]);

  const filteredTenders = useMemo(() => {
    const list = inquiries.filter(inq => {
      const hasMyBid = (inq.bids || []).some((b: any) => b.providerId === activeProvider.id);
      const isOpen = inq.status === 'tender_open' || inq.status === 'awaiting_provider';
      const isWinner = inq.status === 'closed_awarded' && (inq.winningBid?.providerId === activeProvider.id || inq.providerId === activeProvider.id);

      if (tenderFilter === 'open') {
        if (!isOpen || hasMyBid) return false;
      }
      if (tenderFilter === 'submitted') {
        if (!isOpen || !hasMyBid) return false;
      }
      if (tenderFilter === 'awarded') {
        if (!isWinner) return false;
      }
      if (tenderFilter === 'closed') {
        if (isOpen || isWinner) return false;
      }

      if (tenderSearchQuery.trim()) {
        const q = tenderSearchQuery.toLowerCase();
        const scope = (inq.projectScope || inq.latestPrompt || '').toLowerCase();
        const client = (inq.buyerName || '').toLowerCase();
        return scope.includes(q) || client.includes(q);
      }
      return true;
    });

    // Sort chronologically: most recent tenders on top!
    list.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return list;
  }, [inquiries, tenderFilter, tenderSearchQuery, activeProvider.id]);

  const activeTender = inquiries.find(i => i.id === selectedTenderId) || filteredTenders[0] || null;
  const modalDiscoveryTarget = discoveryTargetSession || activeTender;

  // Prepopulate custom bid price and turnaround when active tender changes
  useEffect(() => {
    if (activeTender) {
      const myBid = (activeTender.bids || []).find((b: any) => b.providerId === activeProvider.id);
      if (myBid) {
        if (customBidPrice[activeTender.id] === undefined) {
          setCustomBidPrice(prev => ({ ...prev, [activeTender.id]: myBid.bidPrice }));
        }
        if (customDeliveryDays[activeTender.id] === undefined) {
          setCustomDeliveryDays(prev => ({ ...prev, [activeTender.id]: myBid.deliveryDays || 3 }));
        }
        if (customReplyNote[activeTender.id] === undefined) {
          setCustomReplyNote(prev => ({ ...prev, [activeTender.id]: myBid.note || '' }));
        }
      } else {
        const maxCap = activeTender.spendingLimit || 200;
        if (customBidPrice[activeTender.id] === undefined) {
          setCustomBidPrice(prev => ({ ...prev, [activeTender.id]: Math.round(maxCap * 0.8) }));
        }
        if (customDeliveryDays[activeTender.id] === undefined) {
          setCustomDeliveryDays(prev => ({ ...prev, [activeTender.id]: 3 }));
        }
      }
    }
  }, [activeTender?.id, activeProvider.id]);

  // Tender Swarm Dialogue: Agent announcements + Competing Bids + Provider questions
  const combinedTenderMessages = useMemo(() => {
    if (!activeTender) return [];

    const list: Array<{
      id?: string;
      speaker: 'agent' | 'provider' | 'buyer';
      speakerName: string;
      message: string;
      timestamp: string;
    }> = [];

    // 1. Initial RFP Scope
    const clientInitialScope = activeTender.projectScope || activeTender.latestPrompt || (activeTender.messages?.find((m: any) => m.role === 'user')?.content) || 'Milestone procurement tender.';
    list.push({
      speaker: 'agent',
      speakerName: 'AgentPay Commerce Bot 🤖',
      message: `Initiating Autonomous RFP Tender to specialists for project: "${clientInitialScope}". Authorized Client Budget Cap: $${activeTender.spendingLimit || 200} USD.`,
      timestamp: activeTender.createdAt ? new Date(activeTender.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Broadcast'
    });

    // 2. Swarm Negotiation Dialog (Bot Announcements + Competing Autonomous Bids)
    if (Array.isArray(activeTender.negotiationDialog)) {
      activeTender.negotiationDialog.forEach((diag: any) => {
        list.push({
          speaker: diag.speaker,
          speakerName: diag.speakerName,
          message: diag.message,
          timestamp: diag.timestamp || ''
        });
      });
    }

    return list;
  }, [activeTender]);

  // =========================================================================
  // TAB 3: DELIVERABLE & ORDER FILTER COUNTS
  // =========================================================================
  const revisionsOrdersCount = useMemo(() => {
    return orders.filter(o => 
      o.deliverableStatus === 'changes_requested' || 
      o.status === 'disputed' || 
      o.auditCertificate?.verdict === 'CHANGES_REQUESTED' || 
      Boolean(o.revisionNotes)
    ).length;
  }, [orders]);

  const toSubmitOrdersCount = useMemo(() => {
    return orders.filter(o => 
      !o.deliverable && 
      o.status !== 'completed' && 
      o.status !== 'cancelled' && 
      o.status !== 'refunded' &&
      o.deliverableStatus !== 'changes_requested'
    ).length;
  }, [orders]);

  const submittedOrdersCount = useMemo(() => {
    return orders.filter(o => 
      Boolean(o.deliverable) && 
      o.status !== 'completed' &&
      o.deliverableStatus !== 'changes_requested' &&
      !o.revisionNotes
    ).length;
  }, [orders]);

  const releasedOrdersCount = useMemo(() => {
    return orders.filter(o => o.status === 'completed' || o.payoutStatus === 'disbursed' || (Array.isArray(o.milestones) && o.milestones.some(m => m.status === 'released'))).length;
  }, [orders]);

  const filteredProviderOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Status Filter
      if (providerOrderFilter === 'to_submit') {
        if (order.deliverable || order.status === 'completed' || order.status === 'cancelled' || order.status === 'refunded' || order.deliverableStatus === 'changes_requested') return false;
      } else if (providerOrderFilter === 'submitted') {
        if (!order.deliverable || order.status === 'completed' || order.deliverableStatus === 'changes_requested' || Boolean(order.revisionNotes)) return false;
      } else if (providerOrderFilter === 'revisions') {
        const isRevision = order.deliverableStatus === 'changes_requested' || order.status === 'disputed' || order.auditCertificate?.verdict === 'CHANGES_REQUESTED' || Boolean(order.revisionNotes);
        if (!isRevision) return false;
      } else if (providerOrderFilter === 'released') {
        const isReleased = order.status === 'completed' || order.payoutStatus === 'disbursed' || (Array.isArray(order.milestones) && order.milestones.some(m => m.status === 'released'));
        if (!isReleased) return false;
      }

      // 2. Search Query Filter
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.toLowerCase().trim();
        const titleMatch = (order.serviceTitle || '').toLowerCase().includes(q);
        const buyerMatch = (order.buyerName || '').toLowerCase().includes(q) || (order.buyerEmail || '').toLowerCase().includes(q);
        const idMatch = (order.id || '').toLowerCase().includes(q) || (order.paypalOrderId || '').toLowerCase().includes(q);
        if (!titleMatch && !buyerMatch && !idMatch) return false;
      }

      return true;
    });
  }, [orders, providerOrderFilter, orderSearchQuery]);

  const providerReceivedPayments = orders.reduce((sum, o) => {
    if (!Array.isArray(o.milestones)) {
      return o.status === 'completed' ? sum + (o.amount || 0) : sum;
    }
    const released = o.milestones
      .filter(m => m.status === 'released')
      .reduce((mSum, m) => mSum + (m.amount || 0), 0);
    return sum + released;
  }, 0);

  // Total Cashed Out via PayPal Payouts
  const providerTotalCashedOut = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Available Disbursed Balance in Vault ready for Instant PayPal Cashout
  const providerAvailableCashout = Math.max(0, providerReceivedPayments - providerTotalCashedOut);

  const providerPendingEscrowPayments = orders.reduce((sum, o) => {
    if (o.status !== 'in-escrow') return sum;
    if (!Array.isArray(o.milestones)) return sum + (o.amount || 0);
    const pending = o.milestones
      .filter(m => m.status !== 'released')
      .reduce((mSum, m) => mSum + (m.amount || 0), 0);
    return sum + pending;
  }, 0);

  const providerTransactions: Array<{
    id: string;
    orderId: string;
    type: 'released_payout' | 'locked_in_escrow';
    scopeTitle: string;
    trancheTitle: string;
    clientName: string;
    clientEmail: string;
    grossAmount: number;
    platformFee: number;
    netPayout: number;
    date: string;
    paypalCaptureId?: string;
    orderObj: AgentPayOrder;
  }> = [];

  orders.forEach(o => {
    if (Array.isArray(o.milestones) && o.milestones.length > 0) {
      o.milestones.forEach((m, idx) => {
        const isReleased = m.status === 'released';
        const gross = m.amount || 0;
        const fee = Math.round(gross * 0.05 * 100) / 100;
        const net = Math.round((gross - fee) * 100) / 100;
        providerTransactions.push({
          id: `tx_${o.id}_m${idx + 1}`,
          orderId: o.id,
          type: isReleased ? 'released_payout' : 'locked_in_escrow',
          scopeTitle: o.serviceTitle,
          trancheTitle: m.title || `Tranche #${idx + 1}`,
          clientName: o.buyerName,
          clientEmail: o.buyerEmail,
          grossAmount: gross,
          platformFee: fee,
          netPayout: net,
          date: o.createdAt || new Date().toISOString(),
          paypalCaptureId: o.paypalCaptureId,
          orderObj: o
        });
      });
    } else {
      const isCompleted = o.status === 'completed';
      const gross = o.amount || 0;
      const fee = Math.round(gross * 0.05 * 100) / 100;
      const net = Math.round((gross - fee) * 100) / 100;
      providerTransactions.push({
        id: `tx_${o.id}`,
        orderId: o.id,
        type: isCompleted ? 'released_payout' : 'locked_in_escrow',
        scopeTitle: o.serviceTitle,
        trancheTitle: 'Full Contract Scope Milestone',
        clientName: o.buyerName,
        clientEmail: o.buyerEmail,
        grossAmount: gross,
        platformFee: fee,
        netPayout: net,
        date: o.createdAt || new Date().toISOString(),
        paypalCaptureId: o.paypalCaptureId,
        orderObj: o
      });
    }
  });

  providerTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredProviderTransactions = providerTransactions.filter(tx => {
    if (earningsFilter === 'released' && tx.type !== 'released_payout') return false;
    if (earningsFilter === 'escrow' && tx.type !== 'locked_in_escrow') return false;
    if (earningsSearchQuery.trim()) {
      const q = earningsSearchQuery.toLowerCase();
      return (
        tx.scopeTitle.toLowerCase().includes(q) ||
        tx.clientName.toLowerCase().includes(q) ||
        tx.orderId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingTendersCount = inquiries.filter(i => i.status === 'tender_open' || i.status === 'awaiting_provider').length;
  const activeEscrowOrdersCount = orders.filter(o => o.status === 'in-escrow').length;

  if (loading) {
    return (
      <div className="max-w-[1550px] mx-auto px-4 sm:px-8 py-28 w-full flex flex-col items-center justify-center space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Sparkles className="h-6 w-6 animate-spin" />
        </div>
        <p className="text-zinc-400 font-mono text-xs animate-pulse">Initializing Service Provider Workspace...</p>
      </div>
    );
  }

  // =========================================================================
  // SPECIALIST TALENT GATE (OPTION 2: SLEEK AUTHENTICATION & JUDGE FAST-PASS)
  // =========================================================================
  if (showTalentGatePreview) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-8 relative overflow-hidden animate-fadeIn">
        {/* Ambient atmospheric glows */}
        <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/3 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-cyan-600/10 rounded-full blur-[130px] pointer-events-none" />

        <div className="max-w-4xl w-full mx-auto relative z-10 space-y-5">
          {/* Top Bar: Security Badge & Back Link */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 font-mono text-xs flex items-center gap-2 shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                <span>Specialist Talent Gate</span>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>TLS 1.3 256-Bit Encrypted</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTalentGatePreview(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-xs font-semibold text-purple-200 hover:text-white transition-all group cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-purple-300 group-hover:-translate-x-0.5 transition-transform" />
                <span>Return to Workspace</span>
              </button>
              <Link
                href="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white transition-all group cursor-pointer"
              >
                <span>Client Platform</span>
              </Link>
            </div>
          </div>

          {/* Main Glassmorphic Talent Card */}
          <div className="rounded-3xl border border-purple-500/30 bg-zinc-950/90 backdrop-blur-2xl p-6 sm:p-9 shadow-2xl shadow-purple-950/40 space-y-7">
            {/* Header Title */}
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <div className="h-13 w-13 rounded-2xl bg-gradient-to-tr from-purple-600/30 via-indigo-600/20 to-cyan-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 mx-auto shadow-lg shadow-purple-950/50">
                <Lock className="h-6 w-6 text-purple-400 animate-pulse" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Specialist Talent Gate
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Authorized provider workspace for autonomous AI tender negotiations, direct 1-on-1 client communications, and verified PayPal milestone escrow release.
              </p>
            </div>

            {/* Response Notice in Gate */}
            {responseNotice && (
              <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <p className="font-bold">{responseNotice}</p>
                </div>
                <button onClick={() => setResponseNotice(null)} className="text-xs text-emerald-400 hover:text-white font-mono cursor-pointer">
                  ✕
                </button>
              </div>
            )}

            {/* Section 1: ⚖️ Hackathon Evaluator Fast-Pass (1-Click Instant Persona Sign-in) */}
            <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-950/30 via-zinc-900/80 to-cyan-950/20 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-purple-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚖️</span>
                  <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                    Hackathon Evaluator Fast-Pass
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold border border-purple-500/30">
                    1-Click Access
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono">
                  Select a verified talent persona to enter workspace instantly:
                </p>
              </div>

              {/* Persona Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Persona 1: Sophia Patel */}
                <div 
                  onClick={() => handleProviderQuickLogin('prov_1001')}
                  className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-purple-400/80 hover:bg-purple-950/20 transition-all cursor-pointer group space-y-3 relative overflow-hidden shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={getSpecialistRealAvatar('Sophia Patel')}
                      alt="Sophia Patel"
                      className="h-11 w-11 rounded-xl object-cover border border-purple-400/40 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs truncate">Sophia Patel</span>
                        <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">SaaS UX Strategist</p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mt-0.5">
                        <span className="text-emerald-400 font-bold">$42/hr</span>
                        <span>•</span>
                        <span>⭐ 4.9 (23)</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-purple-300 font-mono">1 Escrow • 1 Tender</span>
                    <span className="text-zinc-400 group-hover:text-purple-300 font-bold flex items-center gap-1 transition-colors">
                      Enter →
                    </span>
                  </div>
                </div>

                {/* Persona 2: Ethan Rossi */}
                <div 
                  onClick={() => handleProviderQuickLogin('prov_1002')}
                  className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-purple-400/80 hover:bg-purple-950/20 transition-all cursor-pointer group space-y-3 relative overflow-hidden shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={getSpecialistRealAvatar('Ethan Rossi')}
                      alt="Ethan Rossi"
                      className="h-11 w-11 rounded-xl object-cover border border-purple-400/40 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs truncate">Ethan Rossi</span>
                        <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">Generative AI Specialist</p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mt-0.5">
                        <span className="text-emerald-400 font-bold">$49/hr</span>
                        <span>•</span>
                        <span>⭐ 5.0 (28)</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-cyan-300 font-mono">Won Tender ($106)</span>
                    <span className="text-zinc-400 group-hover:text-purple-300 font-bold flex items-center gap-1 transition-colors">
                      Enter →
                    </span>
                  </div>
                </div>

                {/* Persona 3: Elena Chen */}
                <div 
                  onClick={() => handleProviderQuickLogin('prov_1003')}
                  className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-purple-400/80 hover:bg-purple-950/20 transition-all cursor-pointer group space-y-3 relative overflow-hidden shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={getSpecialistRealAvatar('Elena Chen')}
                      alt="Elena Chen"
                      className="h-11 w-11 rounded-xl object-cover border border-purple-400/40 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs truncate">Elena Chen</span>
                        <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">Full-Stack SaaS Architect</p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mt-0.5">
                        <span className="text-emerald-400 font-bold">$55/hr</span>
                        <span>•</span>
                        <span>⭐ 5.0 (31)</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-emerald-300 font-mono">1-on-1 Direct Chat</span>
                    <span className="text-zinc-400 group-hover:text-purple-300 font-bold flex items-center gap-1 transition-colors">
                      Enter →
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Enterprise Specialist Sign In (Form) */}
            <div className="space-y-4 pt-1">
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-zinc-800"></div>
                <span className="flex-shrink mx-4 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold">
                  Or Sign In with Talent Account
                </span>
                <div className="flex-grow border-t border-zinc-800"></div>
              </div>

              <form onSubmit={handleManualLogin} className="max-w-md mx-auto space-y-3.5">
                {loginError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{loginError}</span>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 font-bold flex items-center justify-between">
                    <span>Specialist Work Email</span>
                    <span className="text-zinc-500 font-normal">Pre-filled for demo</span>
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 absolute left-3 top-3 text-zinc-500" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="specialist@innoxpert-agents.io"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400 transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-zinc-400 font-bold flex items-center justify-between">
                    <span>Specialist Passcode / Token</span>
                    <span className="text-purple-400 text-[10px]">Judge Mode: Any key unlocks</span>
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 absolute left-3 top-3 text-zinc-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="Enter passcode"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400 transition-colors font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Checkbox */}
                <div className="flex items-center justify-between text-xs text-zinc-400 pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberSession}
                      onChange={e => setRememberSession(e.target.checked)}
                      className="rounded bg-zinc-900 border-zinc-800 text-purple-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-[11px]">Remember session on this device</span>
                  </label>
                  <span className="text-[10px] text-zinc-500 font-mono">TLS 1.3 Certified</span>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:via-indigo-500 hover:to-cyan-500 text-white font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isAuthenticating ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-spin text-purple-200" />
                      <span>Authenticating Specialist Session...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 text-purple-200" />
                      <span>Unlock Specialist Workspace</span>
                      <ArrowRight className="h-4 w-4 text-purple-200" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Trust Guarantees */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-zinc-800/80 pt-5 text-[11px] text-zinc-400">
              <div className="flex items-start gap-2.5">
                <CreditCard className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-200 block text-xs">PayPal Escrow Custody</strong>
                  <span>Milestone funds locked in smart contracts before kickoff.</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Bot className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-200 block text-xs">Autonomous AI Delegate</strong>
                  <span>Bots auto-negotiate scopes against your price floor.</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-200 block text-xs">Instant Direct Payouts</strong>
                  <span>95% net disbursement deposited to PayPal on release.</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full overflow-hidden">
      {/* High-Tech Futuristic Cybernetic Neural & Escrow Background Image */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat opacity-35"
        style={{
          backgroundImage: `url('/images/escrow-vault-bg.jpg')`,
        }}
      />
      {/* Cyber Glow Vignette and Ambient Gradient Overlays for High-End Glassmorphism */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-[#090A0F]/85 via-[#090A0F]/65 to-[#090A0F]/95" />
      <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/25 via-transparent to-transparent" />

      {/* Main Foreground Content */}
      <div className="relative z-10 max-w-[1550px] mx-auto px-3 sm:px-6 xl:px-8 py-4 sm:py-6 w-full space-y-4 animate-fadeIn">
      {/* GUEST EVALUATOR MODE BANNER (When not authenticated as a registered user) */}
      {!user && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-950/20 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <Shield className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>🔒 Guest Evaluator Mode:</strong> Sign in with verified credentials to unlock autonomous tender bidding, direct client chat, and PayPal escrow disbursements.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                await loginWithJudgeAccount();
                setIsProviderAuthenticated(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-[11px] flex items-center gap-1.5 shadow-md shadow-cyan-950/40 transition-all cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              <span>⚡ 1-Click Judge Pass</span>
            </button>
            <button
              type="button"
              onClick={openAuthModal}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-700 text-[11px] font-semibold transition-all cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* 1. TOP HEADER WITH HACKATHON EVALUATOR SANDBOX CONTROLLER */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Service Provider Workspace</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              RFQs Live
            </span>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-[10px] font-mono font-bold text-purple-300">
              PayPal Milestone Custody
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time client 1-on-1 collaboration, autonomous AI agent tender negotiations, and PayPal escrow release.
          </p>
        </div>

        {/* Right Top Controls: Hackathon Judge Simulator + Guide Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Unified Platform Account Pill */}
          {user ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs shadow-sm">
              <img
                src={user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80'}
                alt={user.name}
                className="h-4 w-4 rounded-full object-cover border border-cyan-500/40"
              />
              <span className="text-zinc-200 font-semibold">{user.name}</span>
              <span className="text-[10px] text-zinc-500 font-mono">(${user.spendingLimit || 250} Cap)</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await loginWithJudgeAccount();
                setIsProviderAuthenticated(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-950/40 transition-all cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>⚡ 1-Click Judge Pass</span>
            </button>
          )}

          {/* Client Platform Quick Jump */}
          <Link
            href="/"
            className="px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Client Mode</span>
          </Link>

          {/* Judge Architecture Guide Toggle */}
          <button
            type="button"
            onClick={() => setShowJudgeGuide(!showJudgeGuide)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showJudgeGuide
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md'
                : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Judge Guide</span>
            <span className="text-[10px] font-mono text-zinc-500">[{showJudgeGuide ? '▲ Close' : '▼ View'}]</span>
          </button>

          {/* Hackathon Judge / Evaluator Sandbox Controller */}
          <div className="relative group">
            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-950/60 via-zinc-900 to-cyan-950/60 border border-purple-500/40 rounded-2xl px-3 py-1.5 text-xs shadow-lg shadow-purple-950/30">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-200 flex items-center gap-1">
                  <span>⚖️ EVALUATOR SANDBOX</span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold bg-purple-500/25 text-purple-200 border border-purple-400/40 hidden sm:inline">
                  FOR JUDGES
                </span>
              </div>
              <span className="text-zinc-600 font-mono text-[10px]">|</span>
              <span className="text-zinc-400 font-medium hidden lg:inline text-[11px]">Audit Talent View:</span>
              <select
                value={selectedProviderId}
                onChange={e => handleSwitchTalent(e.target.value)}
                className="bg-zinc-950/90 text-white font-bold text-xs focus:outline-none cursor-pointer px-2 py-0.5 rounded-lg border border-purple-500/30 hover:border-purple-400 transition-colors"
                title="Built for Hackathon Judges: Switch specialist perspectives to test autonomous RFP bids, milestone contracts, and live 1-on-1 chats without logging in/out"
              >
                {providers.slice(0, 20).map(p => (
                  <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                    {p.name} • {p.title.slice(0, 22)}... (${p.hourlyRate}/hr)
                  </option>
                ))}
              </select>
            </div>
            {/* Tooltip on hover */}
            <div className="absolute right-0 top-full mt-2 hidden group-hover:block p-3 rounded-2xl bg-zinc-950 border border-purple-500/40 shadow-2xl z-50 text-[11px] text-zinc-300 w-80 space-y-1.5">
              <div className="flex items-center justify-between text-purple-300 font-mono font-bold text-[10px] uppercase">
                <span>💡 For Hackathon Judges & Evaluators</span>
                <span className="text-purple-400 font-mono text-[9px] bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/30">Sandbox Mode</span>
              </div>
              <p className="text-zinc-400 leading-relaxed text-[11px]">
                In production, each specialist logs into their own isolated workspace. This sandbox switcher enables Hackathon Judges to seamlessly inspect multiple specialist perspectives (autonomous RFQ bidding, escrow milestones, and real-time client chat) without needing separate login credentials.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Response Notice Toast */}
      {responseNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/30 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="font-bold">{responseNotice}</p>
          </div>
          <button 
            onClick={() => setResponseNotice(null)}
            className="text-xs text-emerald-400 hover:text-white font-mono px-2 py-0.5 rounded cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. JUDGE & EVALUATOR ARCHITECTURE FLOW GUIDE */}
      {showJudgeGuide && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-zinc-950 via-cyan-950/25 to-zinc-950 border border-cyan-500/40 shadow-2xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs border border-cyan-500/30">
                💡
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-tight">AgentPay Two-Sided Commerce Lifecycle</h3>
                <p className="text-[10.5px] text-zinc-400">How the autonomous AI Bot mediates between Buyer (Client) and Seller (Specialist).</p>
              </div>
            </div>
            <button
              onClick={() => setShowJudgeGuide(false)}
              className="text-xs text-zinc-400 hover:text-white font-mono px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer"
            >
              Hide ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
            <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1">
              <span className="text-[9px] font-mono text-cyan-400 font-bold block uppercase">1 • Client RFP</span>
              <h4 className="font-bold text-white text-[11px]">Autonomous Broadcast</h4>
              <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                Client prompts project in AI Chat. AgentPay parses technical specifications and broadcasts tenders to top 3 verified specialists.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1">
              <span className="text-[9px] font-mono text-purple-400 font-bold block uppercase">2 • AI Swarm Bids</span>
              <h4 className="font-bold text-white text-[11px]">Reverse-Auction Matrix</h4>
              <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                Specialists negotiate with the Commerce Bot. Provider AI bidding agents inspect scope against price floors to submit competitive bids.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1">
              <span className="text-[9px] font-mono text-emerald-400 font-bold block uppercase">3 • PayPal Escrow</span>
              <h4 className="font-bold text-white text-[11px]">Milestone Vault Lock</h4>
              <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                Client authorizes funds into the PayPal Smart Escrow Vault. Specialist starts work with guaranteed payment upon milestone release.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1">
              <span className="text-[9px] font-mono text-amber-400 font-bold block uppercase">4 • Client Chat & Handoff</span>
              <h4 className="font-bold text-white text-[11px]">AI Deliverable Audit</h4>
              <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                Specialist collaborates 1-on-1 with the client, submitting deliverables (GitHub PR, Figma) which are audited by AI before escrow release.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1">
              <span className="text-[9px] font-mono text-cyan-400 font-bold block uppercase">5 • Instant Payout</span>
              <h4 className="font-bold text-white text-[11px]">PayPal Disbursement</h4>
              <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                Upon milestone approval, 95% net payout deposits directly to the specialist&apos;s PayPal email with transparent 5% platform protocol accounting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. EXECUTIVE SPECIALIST COCKPIT STRIP */}
      {activeProvider && (
        <div className="p-4 rounded-3xl bg-zinc-900/80 border border-zinc-800/90 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 backdrop-blur-xl">
          {/* Identity */}
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <img
                src={getSpecialistRealAvatar(activeProvider.name, activeProvider.avatarUrl)}
                alt={activeProvider.name}
                className="h-14 w-14 rounded-2xl object-cover bg-zinc-800 border-2 border-cyan-500/40 shadow-md"
              />
              <span
                className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-zinc-950 ${
                  activeProvider.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
                title={`Status: ${activeProvider.status}`}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight">{activeProvider.name}</h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/30 font-bold">
                  ✓ Verified Talent
                </span>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 text-[10px] font-mono border border-cyan-500/30 capitalize">
                  {activeProvider.category.replace('-', ' ')}
                </span>
                <span className="text-xs text-amber-400 font-mono font-bold flex items-center gap-0.5">
                  ⭐ {activeProvider.rating} <span className="text-zinc-500 font-normal">({activeProvider.completedJobs || 28} orders)</span>
                </span>
              </div>

              <p className="text-xs text-zinc-300 font-medium line-clamp-1">{activeProvider.title}</p>

              {/* PayPal Payout Status Pill */}
              <div className="flex items-center gap-2.5 text-xs font-mono flex-wrap pt-0.5">
                {activeProvider.paypalEmail && activeProvider.paypalEmail.includes('@') ? (
                  <button
                    type="button"
                    onClick={openEditProfile}
                    className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1.5 text-[11px] transition-colors cursor-pointer"
                    title="Click to customize or view verified PayPal Payout Email"
                  >
                    <CreditCard className="h-3 w-3 text-emerald-400" />
                    <span>PayPal: <strong>{activeProvider.paypalEmail}</strong></span>
                  </button>
                ) : (
                  <button
                    onClick={openEditProfile}
                    className="text-amber-400 bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors animate-pulse"
                  >
                    <AlertCircle className="h-3 w-3 text-amber-400" />
                    ⚠️ Setup PayPal Payout Email
                  </button>
                )}
                <span className="text-zinc-400 flex items-center gap-1 text-[11px]">
                  <Mail className="h-3 w-3 text-zinc-500" />
                  {activeProvider.contactEmail}
                </span>
              </div>
            </div>
          </div>

          {/* Center: AI Controls */}
          <div className="flex items-center gap-2 flex-wrap bg-zinc-950/80 p-2 rounded-2xl border border-zinc-800/80">
            <button
              onClick={openEditProfile}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                activeProvider.autoBiddingEnabled !== false
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
              title="Configure Autonomous AI Bidding floor"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>AI Auto-Bid: {activeProvider.autoBiddingEnabled !== false ? `ON ($${activeProvider.minProjectFloor || 120} Floor)` : 'OFF'}</span>
            </button>

            <button
              onClick={toggleAutoReply}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                activeProvider.aiAutoReplyEnabled !== false
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 hover:bg-purple-500/25'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
              title="Toggle Autonomous AI Receptionist on client messages"
            >
              <Bot className="h-3.5 w-3.5 text-purple-400" />
              <span>AI Receptionist: {activeProvider.aiAutoReplyEnabled !== false ? 'ACTIVE' : 'MUTED'}</span>
            </button>

            <button
              onClick={openEditProfile}
              className="px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5 text-cyan-400" />
              <span>Edit Profile</span>
            </button>
          </div>

          {/* Right: Telemetry Financials */}
          <div className="flex items-center gap-5 border-t lg:border-t-0 lg:border-l border-zinc-800 pt-2 lg:pt-0 lg:pl-5 text-center w-full lg:w-auto justify-between lg:justify-end">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">In Escrow Vault</span>
              <span className="text-base font-black font-mono text-cyan-300">${providerPendingEscrowPayments} USD</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Available Payout</span>
              <span className="text-base font-black font-mono text-emerald-400">${providerAvailableCashout} USD</span>
            </div>
            {providerTotalCashedOut > 0 && (
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Paid to PayPal</span>
                <span className="text-base font-black font-mono text-purple-300">${providerTotalCashedOut} USD</span>
              </div>
            )}
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Standard Rate</span>
              <span className="text-base font-black font-mono text-white">${activeProvider.hourlyRate}/hr</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. WORKSPACE SEGMENTED NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2 overflow-x-auto no-scrollbar">
        {/* TAB 1: Real Client 1-on-1 Chats */}
        <button
          onClick={() => setActiveTab('clients')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'clients'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-950/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          <MessageSquare className="h-4 w-4 text-cyan-400" />
          <span>Direct Client Chats</span>
          {clientDirectThreads.length > 0 ? (
            <span className="h-5 px-2 rounded-full bg-cyan-500 text-zinc-950 font-black text-[10px] flex items-center justify-center">
              {clientDirectThreads.length}
            </span>
          ) : (
            <span className="h-5 px-2 rounded-full bg-zinc-800 text-zinc-400 font-mono text-[10px] flex items-center justify-center">
              0
            </span>
          )}
        </button>

        {/* TAB 2: AI Swarm Tenders */}
        <button
          onClick={() => setActiveTab('inquiries')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'inquiries'
              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/40 shadow-lg shadow-purple-950/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span>Autonomous AI Swarm Tenders</span>
          {pendingTendersCount > 0 ? (
            <span className="h-5 px-2 rounded-full bg-purple-500 text-zinc-950 font-black text-[10px] flex items-center justify-center animate-pulse">
              {pendingTendersCount} Open
            </span>
          ) : (
            <span className="h-5 px-2 rounded-full bg-zinc-800 text-zinc-400 font-mono text-[10px] flex items-center justify-center">
              0
            </span>
          )}
        </button>

        {/* TAB 3: Active Escrow Orders */}
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-950/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          <CreditCard className="h-4 w-4 text-cyan-400" />
          <span>Active Escrow Orders</span>
          <span className={`h-5 px-2 rounded-full font-mono text-[10px] flex items-center justify-center ${
            orders.length > 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold' : 'bg-zinc-800 text-zinc-400'
          }`}>
            {orders.length}
          </span>
        </button>

        {/* TAB 4: Earnings & PayPal Payout Ledger */}
        <button
          onClick={() => setActiveTab('earnings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'earnings'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-950/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <span>Earnings & PayPal Payout Ledger</span>
          {providerAvailableCashout > 0 ? (
            <span className="h-5 px-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black text-[10px] flex items-center justify-center font-mono">
              ${providerAvailableCashout} USD
            </span>
          ) : providerTotalCashedOut > 0 ? (
            <span className="h-5 px-2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold text-[10px] flex items-center justify-center font-mono">
              Cashed Out
            </span>
          ) : null}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 💬 DIRECT CLIENT CHATS & CONTRACTS (CHATGPT / SLACK 2-PANE APP)   */}
      {/* ========================================================================= */}
      {activeTab === 'clients' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-cyan-400" />
              <span>Real Client 1-on-1 Communication Workspace</span>
            </h3>
            <span className="text-[11px] text-zinc-500">
              Encrypted channel between {activeProvider?.name} and Verified Buyers
            </span>
          </div>

          {clientDirectThreads.length === 0 ? (
            <div className="p-16 text-center rounded-3xl bg-zinc-900/20 border border-zinc-800/60 text-xs text-zinc-500 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                <MessageSquare className="h-6 w-6" />
              </div>
              <p className="text-white font-bold text-sm">No client direct conversations currently open for {activeProvider?.name}.</p>
              <p className="text-[11px] text-zinc-400 max-w-md mx-auto leading-relaxed">
                When a client sends a direct message or selects your bid to fund PayPal escrow, the live 1-on-1 thread will appear here instantly with full contract terms pinned at the top!
              </p>
            </div>
          ) : (
            <div className="h-[680px] w-full rounded-3xl border border-zinc-800/80 bg-zinc-950/90 shadow-2xl overflow-hidden flex flex-col md:flex-row backdrop-blur-xl">
              {/* LEFT PANE: Client Contacts List */}
              <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-zinc-800/80 bg-zinc-950/60 flex flex-col shrink-0">
                {/* Search & Filter */}
                <div className="p-3 border-b border-zinc-800/80 space-y-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search clients, scopes..."
                      value={clientSearchQuery}
                      onChange={e => setClientSearchQuery(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-[11px]">
                    {(['all', 'escrow', 'completed', 'inquiries'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setClientFilter(tab)}
                        className={`px-2.5 py-1 rounded-lg font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                          clientFilter === tab
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                        }`}
                      >
                        {tab === 'all' ? `All (${clientDirectThreads.length})` : tab === 'escrow' ? 'In Escrow' : tab === 'completed' ? 'Completed' : 'Inquiries'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clients Thread List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                  {filteredClientThreads.length === 0 ? (
                    <div className="py-12 px-3 text-center text-xs text-zinc-500 space-y-2">
                      <MessageSquare className="h-6 w-6 text-zinc-600 mx-auto" />
                      <p className="font-semibold text-zinc-400">No client messages yet</p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        When a client sends a 1-on-1 direct message, it will arrive here in real-time.
                      </p>
                    </div>
                  ) : (
                    filteredClientThreads.map(thread => {
                    const isSelected = activeClientThread?.id === thread.id;
                    const isCompleted = thread.orderStatus === 'completed';
                    const isInEscrow = thread.orderStatus === 'in-escrow';

                    return (
                      <div
                        key={thread.id}
                        onClick={() => setSelectedClientThreadId(thread.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-zinc-900/90 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/20'
                            : 'bg-zinc-950/40 border-zinc-850 hover:bg-zinc-900/50 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="relative shrink-0">
                              <img
                                src={thread.clientAvatar}
                                alt={thread.clientName}
                                className="h-8 w-8 rounded-xl bg-zinc-800 object-cover border border-zinc-700"
                              />
                              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-zinc-950" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-white text-xs truncate block">
                                {thread.clientName}
                              </span>
                              <span className="text-[10px] text-zinc-500 truncate block">
                                {thread.clientEmail}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider block ${
                              isCompleted
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : isInEscrow
                                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                                : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                            }`}>
                              {isCompleted ? '✓ Completed' : isInEscrow ? '🛡️ In Escrow' : 'Inquiry'}
                            </span>
                            {thread.orderAmount && (
                              <span className="font-mono font-bold text-emerald-400 text-[11px] block mt-0.5">
                                ${thread.orderAmount} USD
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-zinc-300 line-clamp-1 font-medium">
                          {thread.serviceTitle}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                          <span className="truncate max-w-[190px] italic">
                            {thread.lastMessageText}
                          </span>
                          {thread.unreadCount && thread.unreadCount > 0 ? (
                            <span className="h-4 px-1.5 rounded-full bg-cyan-500 text-zinc-950 font-bold text-[9px] flex items-center justify-center shrink-0">
                              {thread.unreadCount} new
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              </div>

              {/* RIGHT PANE: Direct Client Chat Room */}
              {activeClientThread ? (
                <div className="flex-1 flex flex-col h-full bg-zinc-950/40">
                  {/* Top Bar */}
                  <div className="p-3.5 sm:p-4 border-b border-zinc-800/80 bg-zinc-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img
                          src={activeClientThread.clientAvatar}
                          alt={activeClientThread.clientName}
                          className="h-10 w-10 rounded-2xl bg-zinc-800 object-cover border border-cyan-500/40 shadow-sm"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewClientProfile({ email: activeClientThread.clientEmail, name: activeClientThread.clientName, avatar: activeClientThread.clientAvatar })}
                            className="font-bold text-white hover:text-cyan-300 hover:underline text-sm flex items-center gap-1 cursor-pointer"
                            title="Click to view Client Trust Dossier & Endorsements"
                          >
                            <span>{activeClientThread.clientName}</span>
                            <ExternalLink className="h-3 w-3 text-cyan-400" />
                          </button>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-500/30">
                            Verified Client
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                          <span>{activeClientThread.clientEmail}</span>
                          <span>•</span>
                          <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Online Now
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons for this Client / Contract */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowContractHud(!showContractHud)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                          showContractHud 
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm' 
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700'
                        }`}
                        title="Toggle Contract & Milestone Escrow Details"
                      >
                        <Layers className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Contract Terms</span>
                      </button>

                      {/* View AI Discovery Transcript for this Client Thread */}
                      <button
                        type="button"
                        onClick={() => {
                          const orderObj = activeClientThread.orderObj;
                          const inqObj = activeClientThread.inquiryObj;
                          if (orderObj) {
                            handleOpenDiscoveryTranscriptForOrder(orderObj);
                          } else if (inqObj) {
                            setDiscoveryTargetSession(inqObj);
                            setIsDiscoveryModalOpen(true);
                          } else {
                            const found = inquiries.find(i => 
                              (activeClientThread.clientEmail && i.buyerEmail?.toLowerCase() === activeClientThread.clientEmail.toLowerCase()) ||
                              (activeClientThread.clientName && i.buyerName?.toLowerCase() === activeClientThread.clientName.toLowerCase())
                            );
                            if (found) {
                              setDiscoveryTargetSession(found);
                              setIsDiscoveryModalOpen(true);
                            }
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-white font-semibold text-xs border border-purple-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        title="View verbatim discovery dialogue between Client and AgentPay Commerce Bot"
                      >
                        <Bot className="h-3.5 w-3.5 text-purple-400" />
                        <span>AI Discovery Brief</span>
                      </button>

                      {(() => {
                        const linkedOrder = orders.find(o => 
                          (activeClientThread.orderObj && o.id === activeClientThread.orderObj.id) ||
                          (activeClientThread.channelId && o.id === activeClientThread.channelId) ||
                          (o.buyerEmail && activeClientThread.clientEmail && o.buyerEmail.toLowerCase() === activeClientThread.clientEmail.toLowerCase())
                        ) || activeClientThread.orderObj;

                        if (!linkedOrder) return null;

                        const isRevisionReq = linkedOrder.deliverableStatus === 'changes_requested';

                        return (
                          <>
                            <button
                              onClick={() => setActiveInvoiceOrder(linkedOrder)}
                              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold text-xs border border-zinc-700 flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <FileText className="h-3.5 w-3.5 text-cyan-400" />
                              <span>Invoice</span>
                            </button>

                            {linkedOrder.status !== 'completed' ? (
                              isRevisionReq ? (
                                <button
                                  onClick={() => handleOpenDeliverModal(linkedOrder)}
                                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-amber-600 to-orange-600 hover:opacity-95 text-white font-bold text-xs border border-rose-500/50 flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-rose-950/40 animate-pulse"
                                  title="Action required: Fix flagged issues and submit revision"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  <span>Fix &amp; Submit Revision (v{(linkedOrder.deliverable?.version || 1) + 1})</span>
                                </button>
                              ) : linkedOrder.deliverable ? (
                                <button
                                  onClick={() => handleOpenDeliverModal(linkedOrder)}
                                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 text-cyan-300 hover:text-white font-bold text-xs border border-cyan-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                                  title="Edit and update submitted milestone deliverable"
                                >
                                  <Edit3 className="h-3.5 w-3.5 text-cyan-400" />
                                  <span>Edit Deliverable</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenDeliverModal(linkedOrder)}
                                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-md"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  <span>Submit Deliverable</span>
                                </button>
                              )
                            ) : (
                              <div className="flex items-center gap-1.5">
                                {linkedOrder.deliverable && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeliverModal(linkedOrder)}
                                    className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold text-xs border border-zinc-700 flex items-center gap-1 transition-all cursor-pointer"
                                    title="View submitted deliverable details"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-cyan-400" />
                                    <span>View Deliverable</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setReviewingOrder(linkedOrder)}
                                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1 shadow-md cursor-pointer"
                                >
                                  <Star className="h-3.5 w-3.5 fill-zinc-950 text-zinc-950" />
                                  <span>Rate Client</span>
                                </button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* SLEEK SPACE-SAVING ESCROW & MILESTONE HUD STRIP (38px Compact Header)    */}
                  {/* ========================================================================= */}
                  <div className="mx-3 sm:mx-4 mt-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/90 to-purple-950/40 border border-emerald-500/30 shadow-md flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-black text-emerald-400 text-xs shrink-0">
                          🛡️ ${activeClientThread.orderAmount || activeClientThread.bidPrice || 120} USD
                        </span>
                        {orders.some(o => (o.id === activeClientThread.orderObj?.id || o.buyerEmail?.toLowerCase() === activeClientThread.clientEmail?.toLowerCase()) && (o.deliverableStatus === 'changes_requested' || Boolean(o.revisionNotes))) ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold border border-rose-500/40 shrink-0 flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="h-2.5 w-2.5 text-rose-400" />
                            <span>Revisions Requested</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30 shrink-0">
                            Escrow Secured
                          </span>
                        )}
                        <span className="text-zinc-600 font-mono hidden md:inline">|</span>
                        <span className="text-zinc-300 text-[11px] font-medium truncate hidden sm:inline">
                          {activeClientThread.serviceTitle}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowContractHud(!showContractHud)}
                        className={`px-2.5 py-1 rounded-xl font-mono text-[11px] font-semibold border flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                          showContractHud 
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                            : 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white border-zinc-700/80'
                        }`}
                        title="Toggle Milestone Tranches & Escrow Breakdown"
                      >
                        <FileText className="h-3 w-3 text-cyan-400" />
                        <span>Milestone Terms</span>
                        <span className="text-zinc-400 text-[9px]">{showContractHud ? '▲' : '▼'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const targetTenderId = activeClientThread.orderObj?.sessionId || activeClientThread.inquiryObj?.id || activeClientThread.id;
                          if (targetTenderId) setSelectedTenderId(targetTenderId);
                          setActiveTab('inquiries');
                        }}
                        className="px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-white border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        title="Inspect original AI Agent tender negotiation transcript"
                      >
                        <Bot className="h-3 w-3 text-purple-400" />
                        <span className="hidden lg:inline">Bot RFP</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* EXPANDABLE CODIFIED CONTRACT BREAKDOWN DRAWER */}
                  {showContractHud && (
                    <div className="mx-3 sm:mx-4 mt-2 p-3.5 rounded-2xl bg-zinc-900/95 border border-purple-500/40 shadow-xl space-y-3 animate-fadeIn shrink-0">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            Codified PayPal Milestone Escrow & Terms
                          </span>
                        </div>
                        <button
                          onClick={() => setShowContractHud(false)}
                          className="text-[10px] font-mono text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 cursor-pointer"
                        >
                          Close ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                          <span className="text-[10px] font-mono font-bold text-emerald-400 block uppercase">
                            Smart Escrow Custody
                          </span>
                          <p className="text-zinc-300 text-[11px]">
                            Client <strong className="text-white">{activeClientThread.clientName}</strong> authorized funds into PayPal Escrow with <strong className="text-cyan-300 font-mono">{activeClientThread.deliveryDays || 3}d</strong> delivery SLA.
                          </p>
                          <span className="text-emerald-400 font-mono font-black text-sm block pt-1">
                            ${activeClientThread.orderAmount || activeClientThread.bidPrice || 120} USD Locked
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1.5">
                          <span className="text-[10px] font-mono font-bold text-purple-300 block uppercase">
                            Structured Milestone Tranches
                          </span>
                          <div className="space-y-1">
                            {activeClientThread.orderObj?.milestones && activeClientThread.orderObj.milestones.length > 0 ? (
                              activeClientThread.orderObj.milestones.map((m, mIdx) => (
                                <div key={mIdx} className="p-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-[11px]">
                                  <span className="text-zinc-200 truncate max-w-[170px]">{m.title}</span>
                                  <span className="font-mono font-bold text-cyan-400">${m.amount} USD</span>
                                </div>
                              ))
                            ) : (
                              <>
                                <div className="p-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-[11px]">
                                  <span className="text-zinc-200">Tranche 1: Core Setup & Wireframes</span>
                                  <span className="font-mono font-bold text-cyan-400">${Math.round((activeClientThread.orderAmount || 120) * 0.5)} USD</span>
                                </div>
                                <div className="p-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-[11px]">
                                  <span className="text-zinc-200">Tranche 2: Deliverable & Docs</span>
                                  <span className="font-mono font-bold text-cyan-400">${Math.round((activeClientThread.orderAmount || 120) * 0.5)} USD</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Messages Scroll Area */}
                  <div className="flex-1 p-3 sm:p-5 overflow-y-auto space-y-3.5 custom-scrollbar">
                    {activeClientMessages.length === 0 ? (
                      <div className="py-16 text-center text-xs text-zinc-500 space-y-2">
                        <MessageSquare className="h-8 w-8 text-zinc-600 mx-auto" />
                        <p className="text-zinc-400 font-semibold">Start the 1-on-1 direct conversation with {activeClientThread.clientName}.</p>
                        <p className="text-[11px] text-zinc-500">Ask questions, share milestone progress, or confirm technical specifications.</p>
                      </div>
                    ) : (
                      activeClientMessages.map((msg, mIdx) => {
                        const isMe = msg.senderRole === 'provider';
                        const isRevisionNotice = !isMe && (
                          msg.message.includes('REVISION REQUEST') || 
                          msg.message.includes('items to address before PayPal Escrow can be approved') ||
                          msg.message.includes('Fix & Submit Revision')
                        );

                        const linkedOrder = orders.find(o => 
                          (activeClientThread.orderObj && o.id === activeClientThread.orderObj.id) ||
                          (activeClientThread.channelId && o.id === activeClientThread.channelId) ||
                          (o.buyerEmail && activeClientThread.clientEmail && o.buyerEmail.toLowerCase() === activeClientThread.clientEmail.toLowerCase())
                        ) || activeClientThread.orderObj;

                        return (
                          <div
                            key={msg.id || mIdx}
                            className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
                          >
                            <img
                              src={isMe ? getSpecialistRealAvatar(activeProvider.name, activeProvider.avatarUrl) : activeClientThread.clientAvatar}
                              alt={msg.senderName}
                              className="h-8 w-8 rounded-xl object-cover bg-zinc-800 border border-zinc-700 shrink-0 mt-0.5"
                            />

                            <div className="space-y-1 max-w-[85%] sm:max-w-[70%]">
                              <div className={`flex items-center gap-2 text-[10px] px-1 font-mono ${isMe ? 'justify-end text-cyan-300' : 'text-zinc-400'}`}>
                                <span className="font-bold">{msg.senderName}</span>
                                {msg.isAiAutoReply && (
                                  <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-mono border border-purple-500/30">
                                    AI Receptionist
                                  </span>
                                )}
                                <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                              </div>

                              <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                                isMe
                                  ? 'bg-cyan-950/40 text-cyan-50 border border-cyan-500/40 rounded-tr-none shadow-md'
                                  : isRevisionNotice
                                  ? 'bg-gradient-to-br from-zinc-900 via-rose-950/30 to-zinc-900 text-zinc-100 border border-rose-500/50 rounded-tl-none shadow-xl'
                                  : 'bg-zinc-900/90 text-zinc-200 border border-zinc-800 rounded-tl-none shadow-md'
                              }`}>
                                {renderFormattedMessageText(msg.message)}

                                {/* Interactive Revision Action Dock inside message */}
                                {isRevisionNotice && (
                                  <div className="mt-3.5 pt-3 border-t border-rose-500/30 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-1.5 font-bold text-rose-300 text-[11px]">
                                        <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 animate-pulse" />
                                        <span>Action Required: Deliverable Revision Requested</span>
                                      </div>
                                      {linkedOrder && (
                                        <span className="text-[10px] font-mono text-zinc-400 bg-black/50 px-2 py-0.5 rounded border border-rose-500/20">
                                          Order #{linkedOrder.id}
                                        </span>
                                      )}
                                    </div>

                                    <p className="text-[11px] text-zinc-300 leading-relaxed font-normal">
                                      Click below to go directly to this order in your Escrow Contracts workspace with all flagged items highlighted, or open the revision submit form now:
                                    </p>

                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                      {/* PRIMARY BUTTON: Go directly to this order in Orders Section! */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (linkedOrder) {
                                            setOrderSearchQuery(linkedOrder.id);
                                            setProviderOrderFilter('revisions');
                                            setActiveTab('orders');
                                          } else {
                                            setProviderOrderFilter('revisions');
                                            setActiveTab('orders');
                                          }
                                        }}
                                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-amber-600 to-orange-600 hover:opacity-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                                      >
                                        <Layers className="h-3.5 w-3.5" />
                                        <span>Go to Order in Escrow Workspace &rarr;</span>
                                      </button>

                                      {/* DIRECT ACTION: Fix & Submit Revision on the spot! */}
                                      {linkedOrder && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenDeliverModal(linkedOrder)}
                                          className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-300 hover:text-white border border-cyan-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                        >
                                          <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
                                          <span>Fix &amp; Submit Revision (v{(linkedOrder.deliverable?.version || 1) + 1})</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {isMe && (
                                <div className="flex justify-end text-[10px] font-mono text-zinc-500 pr-1">
                                  {msg.isSeen ? (
                                    <span className="text-cyan-400 flex items-center gap-1 font-semibold">
                                      <CheckCheck className="h-3 w-3" />
                                      <span>Seen by Client</span>
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1">
                                      <Check className="h-3 w-3" />
                                      <span>Delivered</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={clientChatScrollRef} />
                  </div>

                  {/* Bottom Action Dock: Quick Prompts & Message Input */}
                  <div className="border-t border-zinc-800/80 bg-zinc-900/60 p-3 sm:p-4 space-y-2.5 shrink-0">
                    {/* Quick Prompts */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-[11px]">
                      <span className="text-zinc-500 shrink-0 font-medium text-[10px]">Quick Prompts:</span>
                      <button
                        onClick={() => setClientChatInput(`Hi ${activeClientThread.clientName}! Confirming I have commenced work on the agreed milestones. Will keep you updated on progress!`)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white shrink-0 transition-colors cursor-pointer"
                      >
                        🚀 Confirm Start on Milestones
                      </button>
                      <button
                        onClick={() => setClientChatInput(`Milestone 1 draft is nearing completion. Would you like a preview staging link or GitHub PR branch?`)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white shrink-0 transition-colors cursor-pointer"
                      >
                        🔗 Offer Staging Preview Link
                      </button>
                      <button
                        onClick={() => setClientChatInput(`Deliverable has been officially submitted for AI Audit and your review. Looking forward to your release authorization!`)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white shrink-0 transition-colors cursor-pointer"
                      >
                        📦 Request Review & Escrow Release
                      </button>
                    </div>

                    {/* Chat Input Bar */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={clientChatInput}
                        onChange={e => setClientChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendDirectClientMessage()}
                        placeholder={`Message ${activeClientThread.clientName} (real-time synced with client screen)...`}
                        disabled={isSendingClientMessage}
                        className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition-all disabled:opacity-50"
                      />
                      <button
                        onClick={handleSendDirectClientMessage}
                        disabled={isSendingClientMessage || !clientChatInput.trim()}
                        className="h-10 px-4 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shrink-0"
                      >
                        {isSendingClientMessage ? <span className="animate-spin">⏳</span> : <Send className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">Send</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">
                  Select a client thread on the left to start collaborating.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 🤖 AUTONOMOUS AI SWARM TENDERS (COMMERCE BOT REVERSE-AUCTIONS)     */}
      {/* ========================================================================= */}
      {activeTab === 'inquiries' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span>Autonomous RFP Tender Negotiations with AgentPay Commerce Bot</span>
            </h3>
            <span className="text-[11px] text-zinc-500">
              AI Multi-Agent Swarm reverse auctions for {activeProvider?.name}
            </span>
          </div>

          {inquiries.length === 0 ? (
            <div className="p-16 text-center rounded-3xl bg-zinc-900/20 border border-zinc-800/60 text-xs text-zinc-500 space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto">
                <Bot className="h-6 w-6" />
              </div>
              <p className="text-white font-bold text-sm">No active project tenders currently open for {activeProvider?.name}.</p>
              <p className="text-[11px] text-zinc-400 max-w-md mx-auto leading-relaxed">
                When a client searches for services in AI Agent Chat and clicks &quot;Dispatch Tender&quot; or selects {activeProvider?.name.split(' ')[0]}, the tender will arrive here instantly!
              </p>
            </div>
          ) : (
            <div className="h-[680px] w-full rounded-3xl border border-zinc-800/80 bg-zinc-950/90 shadow-2xl overflow-hidden flex flex-col md:flex-row backdrop-blur-xl">
              {/* LEFT PANE: Tender List */}
              <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-zinc-800/80 bg-zinc-950/60 flex flex-col shrink-0">
                <div className="p-3 border-b border-zinc-800/80 space-y-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search tenders, scopes..."
                      value={tenderSearchQuery}
                      onChange={e => setTenderSearchQuery(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar text-[11px]">
                    {(['all', 'open', 'submitted', 'awarded', 'closed'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setTenderFilter(tab)}
                        className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer text-[11px] ${
                          tenderFilter === tab
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                        }`}
                      >
                        {tab === 'all'
                          ? `All (${inquiries.length})`
                          : tab === 'open'
                          ? `Open (${awaitingBidCount})`
                          : tab === 'submitted'
                          ? `Bid Submitted (${bidSubmittedCount})`
                          : tab === 'awarded'
                          ? `Won (${wonTendersCount})`
                          : `Closed (${closedTendersCount})`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                  {filteredTenders.map(inq => {
                    const isSelected = activeTender?.id === inq.id;
                    const isOpen = inq.status === 'tender_open' || inq.status === 'awaiting_provider';
                    const isWinner = inq.status === 'closed_awarded' && (inq.winningBid?.providerId === activeProvider.id || inq.providerId === activeProvider.id);
                    const myBid = (inq.bids || []).find((b: any) => b.providerId === activeProvider.id);
                    const title = getTenderDisplayTitle(inq);
                    const clientAvatar = getClientAvatar(inq);
                    const timeAgo = getTimeAgo(inq.updatedAt || inq.createdAt);

                    return (
                      <div
                        key={inq.id}
                        onClick={() => setSelectedTenderId(inq.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-2 relative overflow-hidden ${
                          isSelected
                            ? 'bg-zinc-900/95 border-purple-500/60 shadow-lg ring-1 ring-purple-500/30'
                            : 'bg-zinc-950/40 border-zinc-800/80 hover:bg-zinc-900/50 hover:border-zinc-700'
                        }`}
                      >
                        {/* Top Row: Client Avatar with Bot Badge + Buyer Name & Relative Timestamp */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="relative shrink-0">
                              <img
                                src={clientAvatar}
                                alt={inq.buyerName || 'Client'}
                                className="h-8 w-8 rounded-xl object-cover border border-zinc-700 bg-zinc-800 shadow-sm"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(inq.buyerName || 'Client')}&backgroundColor=b6e3f4`;
                                }}
                              />
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-md bg-purple-950 border border-purple-500/60 flex items-center justify-center text-[9px] shadow-sm" title="AgentPay Swarm Bot Tender">
                                🤖
                              </div>
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-zinc-200 text-xs truncate block max-w-[130px]">
                                {inq.buyerName || 'Client'}
                              </span>
                              <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                                <Clock className="h-2.5 w-2.5 text-zinc-400" />
                                <span>{timeAgo}</span>
                              </div>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                            isWinner
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : myBid
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                              : isOpen
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}>
                            {isWinner ? 'Won' : myBid ? 'Bid Submitted' : isOpen ? 'Open' : 'Closed'}
                          </span>
                        </div>

                        {/* Middle Row: Conversation-Matched Project Title & Budget */}
                        <div className="flex items-start justify-between gap-1.5 pt-0.5">
                          <h5 className="font-bold text-white text-xs line-clamp-1 flex-1 leading-snug" title={title}>
                            {title}
                          </h5>
                          <span className="font-mono font-black text-emerald-400 text-xs shrink-0">
                            ${inq.spendingLimit || 200}
                          </span>
                        </div>

                        {/* Bottom Row: Latest Status / Bid Badge */}
                        <div className="flex items-center justify-between text-[10.5px] pt-1 border-t border-zinc-900/90">
                          {myBid ? (
                            <span className="font-mono text-[10px] text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-950/30 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                              Bid: ${myBid.bidPrice} ({myBid.deliveryDays}d)
                            </span>
                          ) : (
                            <span className="text-[10px] text-purple-400 font-mono flex items-center gap-1">
                              <Sparkles className="h-2.5 w-2.5" />
                              Awaiting Your Bid
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-500 truncate max-w-[90px] text-right font-mono">
                            Cap: ${inq.spendingLimit || 200}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT PANE: Tender Dialogue with Commerce Bot */}
              {activeTender ? (
                <div className="flex-1 flex flex-col h-full bg-zinc-950/40">
                  <div className="p-3.5 sm:p-4 border-b border-zinc-800/80 bg-zinc-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm">
                            {activeTender.projectScope || 'Milestone Deliverable'}
                          </h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                            activeTender.status === 'closed_awarded'
                              ? activeTender.winningBid?.providerId === activeProvider.id
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}>
                            {activeTender.status === 'closed_awarded' 
                              ? activeTender.winningBid?.providerId === activeProvider.id ? '🏆 Contract Awarded to You' : '🚫 Opportunity Closed'
                              : '⏳ Tender Open for Bids'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Buyer: <strong className="text-white">{activeTender.buyerName}</strong> ({activeTender.buyerEmail})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Switch to 1-on-1 direct client chat */}
                      <button
                        onClick={() => {
                          const clientKey = (activeTender.buyerEmail || activeTender.buyerName || 'client').toLowerCase().trim();
                          setTemporaryChatTarget({
                            clientName: activeTender.buyerName || 'Client',
                            clientEmail: activeTender.buyerEmail || 'janithad2@gmail.com',
                            clientAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(activeTender.buyerName || 'Client')}&backgroundColor=b6e3f4`,
                            inquiryObj: activeTender,
                            channelId: `${activeTender.id}_${activeProvider.id}`
                          });
                          setSelectedClientThreadId(clientKey);
                          setActiveTab('clients');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 hover:text-white border border-cyan-500/40 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Direct Chat with Client</span>
                      </button>

                      <div className="text-right">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Budget Cap</span>
                        <span className="font-mono font-black text-base text-emerald-400">
                          ${activeTender.spendingLimit || 200} USD
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pinned Client Project Scope & Requirements Brief */}
                  <div className="bg-zinc-900/80 border-b border-zinc-800/80 p-3.5 sm:p-4 space-y-2.5 shrink-0">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                          <FileText className="h-3 w-3 text-cyan-400" />
                          Client Project Specification & Scope
                        </span>
                        <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline">
                          Direct inquiry from <strong className="text-white">{activeTender.buyerName}</strong>
                        </span>
                      </div>
                      
                      {/* Button to open dedicated full popup transcript modal */}
                      <button
                        type="button"
                        onClick={() => setIsDiscoveryModalOpen(true)}
                        className="px-3 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-white border border-purple-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-purple-400" />
                        <span>View Client & AI Discovery Chat Transcript 🔍</span>
                      </button>
                    </div>

                    {/* The Client's Actual Requirement Text with Client Avatar */}
                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/90 text-xs text-zinc-200 font-medium leading-relaxed flex items-start gap-3">
                      <img
                        src={getClientAvatar(activeTender)}
                        alt={activeTender.buyerName || 'Client'}
                        className="h-8 w-8 rounded-xl object-cover border border-zinc-700 bg-zinc-800 shrink-0 mt-0.5 shadow-sm"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(activeTender.buyerName || 'Client')}&backgroundColor=b6e3f4`;
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold mb-0.5 flex items-center justify-between">
                          <span>Client Deliverable Request:</span>
                          <button
                            type="button"
                            onClick={() => setIsDiscoveryModalOpen(true)}
                            className="text-purple-400 hover:text-purple-300 underline font-normal lowercase tracking-normal text-[10px] cursor-pointer"
                          >
                            open full transcript popup ↗
                          </button>
                        </div>
                        <p className="text-zinc-100 text-xs font-normal">
                          &ldquo;{activeTender.latestPrompt || activeTender.messages?.filter((m: any) => m.role === 'user').map((m: any) => m.content).join('; ') || activeTender.projectScope || 'Client is procuring custom milestone deliverables within their authorized budget.'}&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Dialogue Scroll Area */}
                  <div className="flex-1 p-3 sm:p-5 overflow-y-auto space-y-3.5 custom-scrollbar">
                    {combinedTenderMessages.map((diag, dIdx) => {
                      const isAgent = diag.speaker === 'agent';
                      const isMe = !isAgent && diag.speakerName?.toLowerCase().includes(activeProvider.name.toLowerCase());

                      return (
                        <div
                          key={dIdx}
                          className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
                        >
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-md ${
                            isAgent ? 'bg-purple-950 border border-purple-500/40 text-purple-300' : 'bg-cyan-950 border border-cyan-500/40 text-cyan-300'
                          }`}>
                            {isAgent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                          </div>

                          <div className="space-y-1 max-w-[85%] sm:max-w-[75%]">
                            <div className={`flex items-center gap-2 text-[10px] px-1 font-mono ${isMe ? 'justify-end text-cyan-300' : 'text-zinc-400'}`}>
                              <span className="font-bold">{diag.speakerName}</span>
                              <span>{diag.timestamp}</span>
                            </div>
                            <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                              isAgent
                                ? 'bg-zinc-900/90 text-zinc-200 border border-purple-500/20 rounded-tl-none shadow-md'
                                : isMe
                                ? 'bg-cyan-950/40 text-cyan-100 border border-cyan-500/40 rounded-tr-none shadow-md'
                                : 'bg-zinc-900/80 text-zinc-300 border border-zinc-700/60 rounded-tl-none shadow-md'
                            }`}>
                              {renderFormattedMessageText(diag.message)}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {isSendingMessage[activeTender.id] && (
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-xl bg-purple-950 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0">
                          <Bot className="h-4 w-4 animate-spin text-purple-300" />
                        </div>
                        <div className="p-3 rounded-2xl bg-zinc-900 border border-purple-500/30 rounded-tl-none text-xs text-zinc-400 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-purple-400 animate-ping" />
                          <span className="font-mono text-purple-300 text-[11px]">
                            AgentPay Commerce Bot is analyzing your tender response...
                          </span>
                        </div>
                      </div>
                    )}
                    <div ref={tenderChatScrollRef} />
                  </div>

                  {/* Docked Action Dock: Bot Message Input + Bidding Form */}
                  <div className="border-t border-zinc-800/80 bg-zinc-900/60 p-3 sm:p-4 space-y-3 shrink-0">
                    {activeTender.status !== 'closed_awarded' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={chatInputPerTender[activeTender.id] || ''}
                          onChange={e => setChatInputPerTender({ ...chatInputPerTender, [activeTender.id]: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && handleSendTenderMessage(activeTender.id)}
                          placeholder="Discuss scope, turnaround, or ask AgentPay Commerce Bot questions..."
                          disabled={isSendingMessage[activeTender.id]}
                          className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-2xl px-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400 transition-all disabled:opacity-50"
                        />
                        <button
                          onClick={() => handleSendTenderMessage(activeTender.id)}
                          disabled={isSendingMessage[activeTender.id] || !chatInputPerTender[activeTender.id]?.trim()}
                          className="h-9 px-4 rounded-2xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shrink-0"
                        >
                          {isSendingMessage[activeTender.id] ? <span className="animate-spin">⏳</span> : <Send className="h-3.5 w-3.5" />}
                          <span className="hidden sm:inline">Send</span>
                        </button>
                      </div>
                    )}

                    {/* Official Milestone Bid Submission & Adjustment Form */}
                    {(() => {
                      const isOpen = activeTender.status === 'tender_open' || activeTender.status === 'awaiting_provider';
                      const myExistingBid = (activeTender.bids || []).find((b: any) => b.providerId === activeProvider.id);
                      if (!isOpen) return null;

                      const isEditing = isEditingCustomBid[activeTender.id] || !myExistingBid;
                      const maxCap = activeTender.spendingLimit || 200;
                      const defaultBid = myExistingBid ? myExistingBid.bidPrice : Math.round(maxCap * 0.8);
                      const currentPrice = customBidPrice[activeTender.id] !== undefined ? customBidPrice[activeTender.id] : defaultBid;
                      const currentDays = customDeliveryDays[activeTender.id] !== undefined ? customDeliveryDays[activeTender.id] : (myExistingBid?.deliveryDays || 3);
                      const currentNote = customReplyNote[activeTender.id] !== undefined ? customReplyNote[activeTender.id] : (myExistingBid?.note || '');
                      const isOverBudget = currentPrice > maxCap;
                      const tranche1 = Math.round(currentPrice * 0.5);
                      const tranche2 = currentPrice - tranche1;

                      return (
                        <div className="space-y-2.5">
                          {/* If a bid was already codified, show summary card with Edit toggle button */}
                          {myExistingBid && (
                            <div className="space-y-2">
                              {/* Emerald Milestone Offer Codified Card */}
                              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-2 shadow-lg shadow-emerald-950/20">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
                                    <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                      Specialist Milestone Offer Codified & Live for Client
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                                      ${myExistingBid.bidPrice} USD
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setIsEditingCustomBid(prev => ({ ...prev, [activeTender.id]: !prev[activeTender.id] }))}
                                      className="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 hover:text-white border border-cyan-500/40 font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                    >
                                      <Edit3 className="h-3 w-3 text-cyan-400" />
                                      <span>{isEditingCustomBid[activeTender.id] ? 'Hide Bid Editor ▲' : '✏️ Edit / Adjust My Bid'}</span>
                                    </button>
                                  </div>
                                </div>
                                <p className="text-xs text-zinc-300">
                                  You proposed <strong className="text-white">${myExistingBid.bidPrice} USD</strong> with <strong className="text-cyan-300 font-mono">{myExistingBid.deliveryDays} Days</strong> turnaround. Client notified in live chat.
                                </p>
                              </div>

                              {/* Purple Autonomous Negotiation Breakdown Card */}
                              {!isEditing && (
                                <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-950/25 to-blue-950/25 border border-purple-500/40 text-xs space-y-2 shadow-md">
                                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-1.5">
                                    <span className="font-bold text-purple-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                                      <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                                      <span>Autonomous Negotiation Breakdown</span>
                                    </span>
                                    <span className="font-mono text-emerald-400 font-black text-xs">
                                      ${myExistingBid.bidPrice} USD
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                    <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between">
                                      <span className="text-zinc-200">Tranche 1: Core Implementation</span>
                                      <span className="font-mono font-bold text-cyan-400">${Math.round(myExistingBid.bidPrice * 0.5)} USD</span>
                                    </div>
                                    <div className="p-2 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between">
                                      <span className="text-zinc-200">Tranche 2: Complete Delivery & Review</span>
                                      <span className="font-mono font-bold text-cyan-400">${Math.round(myExistingBid.bidPrice * 0.5)} USD</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Interactive Bidding Form (When editing existing bid or submitting first bid) */}
                          {isEditing && (
                            <div className={`p-3.5 rounded-2xl bg-zinc-950/90 border transition-all space-y-2.5 text-xs ${
                              isOverBudget ? 'border-red-500/50 bg-red-950/20' : 'border-purple-500/40 shadow-xl'
                            }`}>
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-purple-300 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                                  <DollarSign className="h-4 w-4 text-purple-400" />
                                  <span>{myExistingBid ? 'Adjust / Revise Milestone Bid' : 'Submit Official Milestone Bid to Client'}</span>
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono">
                                  Max Budget Cap: <strong className="text-emerald-400 font-bold">${maxCap} USD</strong>
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div>
                                  <label className="block text-[10px] text-zinc-400 mb-1 font-semibold">Bid Price ($ USD)</label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-2 text-zinc-500 font-mono text-xs">$</span>
                                    <input
                                      type="number"
                                      value={currentPrice}
                                      onChange={e => setCustomBidPrice({ ...customBidPrice, [activeTender.id]: Number(e.target.value) })}
                                      min="30"
                                      max={maxCap}
                                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-7 pr-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-purple-400 text-xs"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] text-zinc-400 mb-1 font-semibold">Turnaround (Days)</label>
                                  <input
                                    type="number"
                                    value={currentDays}
                                    onChange={e => setCustomDeliveryDays({ ...customDeliveryDays, [activeTender.id]: Number(e.target.value) })}
                                    min="1"
                                    max="30"
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-purple-400 text-xs"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] text-zinc-400 mb-1 font-semibold">Note / Deliverable Guarantee</label>
                                  <input
                                    type="text"
                                    value={currentNote}
                                    onChange={e => setCustomReplyNote({ ...customReplyNote, [activeTender.id]: e.target.value })}
                                    placeholder="e.g. 'Full Next.js setup with test coverage'"
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-purple-400 text-xs placeholder-zinc-500"
                                  />
                                </div>
                              </div>

                              {/* Real-time Tranche Preview */}
                              <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-[11px] font-mono">
                                <span className="text-zinc-400">50% Escrow Split:</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-cyan-300">T1: ${tranche1} USD</span>
                                  <span className="text-zinc-600">•</span>
                                  <span className="text-cyan-300">T2: ${tranche2} USD</span>
                                  <span className="text-zinc-600">=</span>
                                  <span className="text-emerald-400 font-bold">${currentPrice} USD Total</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                {myExistingBid ? (
                                  <button
                                    type="button"
                                    onClick={() => setIsEditingCustomBid(prev => ({ ...prev, [activeTender.id]: false }))}
                                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                ) : <div />}

                                <button
                                  type="button"
                                  onClick={() => handleSubmitBid(activeTender.id)}
                                  disabled={isOverBudget || respondingSessionId === activeTender.id}
                                  className={`px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
                                    isOverBudget
                                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-zinc-950 hover:brightness-110'
                                  }`}
                                >
                                  {respondingSessionId === activeTender.id ? <span className="animate-spin">⏳</span> : <Sparkles className="h-3.5 w-3.5" />}
                                  <span>
                                    {isOverBudget 
                                      ? `Exceeds Cap ($${currentPrice} > $${maxCap})` 
                                      : myExistingBid 
                                      ? `Update & Save Bid ($${currentPrice} USD)` 
                                      : `Submit Official Bid ($${currentPrice} USD)`}
                                  </span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">
                  Select a tender on the left to start negotiating.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: 🛡️ ACTIVE ESCROW ORDERS & DELIVERABLE MANAGEMENT                   */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Header & Filter System Control Panel */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-cyan-400" />
                <span>Active Funded PayPal Milestone Contracts</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {orders.length} {orders.length === 1 ? 'Contract' : 'Contracts'}
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Track deliverables, submit work for client &amp; AI verification, update active submissions, and monitor released PayPal disbursements.
              </p>
            </div>

            {/* Quick Search */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Search contracts, clients, refs..."
                className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60 transition-all font-mono"
              />
              {orderSearchQuery && (
                <button
                  type="button"
                  onClick={() => setOrderSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Interactive Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {/* Filter 1: All */}
            <button
              type="button"
              onClick={() => setProviderOrderFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 ${
                providerOrderFilter === 'all'
                  ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>All Contracts</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                providerOrderFilter === 'all' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {orders.length}
              </span>
            </button>

            {/* Filter 2: To Submit / In Progress */}
            <button
              type="button"
              onClick={() => setProviderOrderFilter('to_submit')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 ${
                providerOrderFilter === 'to_submit'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>To Submit (In Progress)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                providerOrderFilter === 'to_submit' ? 'bg-amber-500/30 text-amber-200' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {toSubmitOrdersCount}
              </span>
            </button>

            {/* Filter 3: Submitted (Under Review) */}
            <button
              type="button"
              onClick={() => setProviderOrderFilter('submitted')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 ${
                providerOrderFilter === 'submitted'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <Send className="h-3.5 w-3.5 text-cyan-400" />
              <span>Submitted (Under Review)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                providerOrderFilter === 'submitted' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {submittedOrdersCount}
              </span>
            </button>

            {/* Filter 4: Revisions Needed (Action Required) */}
            <button
              type="button"
              onClick={() => setProviderOrderFilter('revisions')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 ${
                providerOrderFilter === 'revisions'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm ring-1 ring-rose-500/30'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <AlertTriangle className={`h-3.5 w-3.5 ${revisionsOrdersCount > 0 ? 'text-rose-400 animate-pulse' : 'text-zinc-400'}`} />
              <span>Revisions Needed (Action Required)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                providerOrderFilter === 'revisions' 
                  ? 'bg-rose-500/30 text-rose-200' 
                  : revisionsOrdersCount > 0
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-zinc-800 text-zinc-400'
              }`}>
                {revisionsOrdersCount}
              </span>
            </button>

            {/* Filter 5: Payment Released */}
            <button
              type="button"
              onClick={() => setProviderOrderFilter('released')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border shrink-0 ${
                providerOrderFilter === 'released'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-zinc-900/60 text-zinc-400 border-zinc-800/80 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Payment Released</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                providerOrderFilter === 'released' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {releasedOrdersCount}
              </span>
            </button>
          </div>

          {filteredProviderOrders.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-zinc-900/30 border border-zinc-800/60 text-xs text-zinc-500 space-y-2">
              <CreditCard className="h-8 w-8 text-zinc-600 mx-auto" />
              {orders.length === 0 ? (
                <>
                  <p className="font-semibold text-zinc-400">No active funded contracts currently assigned to {activeProvider?.name}.</p>
                  <p className="text-[11px] text-zinc-600">Once a client authorizes a PayPal milestone escrow, it will appear here!</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-zinc-400">
                    No contracts found matching filter &quot;{providerOrderFilter}&quot;{orderSearchQuery ? ` and search &quot;${orderSearchQuery}&quot;` : ''}.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setProviderOrderFilter('all');
                      setOrderSearchQuery('');
                    }}
                    className="text-xs text-cyan-400 hover:underline inline-block mt-1 font-semibold cursor-pointer"
                  >
                    Clear Filters &amp; Show All ({orders.length})
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredProviderOrders.map(order => {
                const hasDeliverable = Boolean(order.deliverable);
                const isCompleted = order.status === 'completed';
                const isReleased = isCompleted || order.payoutStatus === 'disbursed' || (Array.isArray(order.milestones) && order.milestones.some(m => m.status === 'released'));
                const isSubmittedPendingAudit = order.deliverableStatus === 'submitted_pending_audit';
                const isRevisionRequested = !isSubmittedPendingAudit && (
                  order.deliverableStatus === 'changes_requested' || 
                  order.status === 'disputed' || 
                  (order.auditCertificate?.verdict === 'CHANGES_REQUESTED' && (!order.deliverable?.version || order.deliverable.version <= (order.auditCertificate.version || 1))) || 
                  (Boolean(order.revisionNotes) && order.deliverableStatus !== 'submitted_pending_audit')
                );

                return (
                  <div
                    key={order.id}
                    className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 hover:border-cyan-500/40 transition-all flex flex-col justify-between gap-4 shadow-xl"
                  >
                    {/* Top Row: Meta and Actions */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-base font-bold text-white">{order.serviceTitle}</span>
                          
                          {/* Dynamic Smart Status Badge */}
                          {isReleased ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>✓ Payment Released</span>
                            </span>
                          ) : isRevisionRequested ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="h-3 w-3 text-rose-400" />
                              <span>⚠️ Action Required: Revisions Requested</span>
                            </span>
                          ) : isSubmittedPendingAudit ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 animate-pulse">
                              <Sparkles className="h-3 w-3 text-cyan-400" />
                              <span>⚡ Deliverable v{order.deliverable?.version || 1} Submitted • Ready for AI Re-Audit</span>
                            </span>
                          ) : hasDeliverable ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-cyan-400" />
                              <span>Submitted v{order.deliverable?.version || 1} • In Review</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>🛡️ In Escrow • To Submit</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-zinc-400">
                            Client:{' '}
                            <button
                              type="button"
                              onClick={() => setViewClientProfile({ email: order.buyerEmail, name: order.buyerName })}
                              className="text-cyan-300 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>{order.buyerName}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </button>{' '}
                            ({order.buyerEmail})
                          </p>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-semibold border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Online Now
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono flex-wrap">
                          <span>Order Ref: #{order.id}</span>
                          <span>•</span>
                          <span>PayPal Escrow: {order.paypalOrderId || 'Active Vault'}</span>
                        </div>
                      </div>

                      {/* Financial Value & Action Buttons */}
                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <div className="text-right pr-2 space-y-0.5">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Contract Value</span>
                          <span className="font-mono font-black text-xl text-emerald-400">${order.amount} USD</span>
                          <div className="text-[10px] font-mono text-amber-300 font-bold">
                            Net Payout: ${order.providerPayoutAmount || Number((order.amount * 0.95).toFixed(2))} USD
                          </div>
                        </div>

                        {/* Switch to Tab 1 with this order active */}
                        <button
                          onClick={() => {
                            const clientKey = (order.buyerEmail || order.buyerName || 'client').toLowerCase().trim();
                            setTemporaryChatTarget({
                              clientName: order.buyerName,
                              clientEmail: order.buyerEmail,
                              clientAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(order.buyerName)}&backgroundColor=b6e3f4`,
                              orderObj: order,
                              channelId: order.id
                            });
                            setSelectedClientThreadId(clientKey);
                            setActiveTab('clients');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs border border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                          <span>Chat with Client</span>
                        </button>

                        {/* AI Discovery Brief */}
                        <button
                          type="button"
                          onClick={() => handleOpenDiscoveryTranscriptForOrder(order)}
                          className="px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-white font-semibold text-xs border border-purple-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                          title="View verbatim discovery dialogue between Client and AgentPay Commerce Bot"
                        >
                          <Bot className="h-3.5 w-3.5 text-purple-400" />
                          <span>AI Discovery Brief</span>
                        </button>

                        {/* Invoice */}
                        <button
                          onClick={() => setActiveInvoiceOrder(order)}
                          className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold text-xs border border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5 text-cyan-400" />
                          <span>Invoice</span>
                        </button>

                        {/* Deliverable Action Button: Submit vs Edit vs Re-Audit vs Revisions vs Completed */}
                        {!isCompleted ? (
                          isRevisionRequested ? (
                            <button
                              onClick={() => handleOpenDeliverModal(order)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-rose-950/40 animate-pulse"
                              title="Address client & AI auditor comments and re-submit"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              <span>Fix &amp; Submit Revision (v{(order.deliverable?.version || 1) + 1})</span>
                            </button>
                          ) : isSubmittedPendingAudit ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleRunAuditForProvider(order.id)}
                                disabled={auditingOrderId === order.id}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-cyan-950/50 disabled:opacity-50"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${auditingOrderId === order.id ? 'animate-spin' : ''}`} />
                                <span>{auditingOrderId === order.id ? 'Auditing Codebase...' : `⚡ Run AI Re-Audit (v${order.deliverable?.version || 1})`}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCertificateOrder(order);
                                  setActiveModalTab('chat');
                                }}
                                className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white border border-purple-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Bot className="h-3.5 w-3.5 text-purple-400" />
                                <span>AI Code Inspector</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDeliverModal(order)}
                                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-300 font-semibold text-xs border border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Edit details of submitted deliverable"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>Edit Details</span>
                              </button>
                            </div>
                          ) : hasDeliverable ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleRunAuditForProvider(order.id)}
                                disabled={auditingOrderId === order.id}
                                className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 hover:text-white border border-cyan-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${auditingOrderId === order.id ? 'animate-spin' : ''}`} />
                                <span>{auditingOrderId === order.id ? 'Auditing...' : `⚡ Re-Audit (v${order.deliverable?.version || 1})`}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCertificateOrder(order);
                                  setActiveModalTab('certificate');
                                }}
                                className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 hover:text-white border border-purple-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Bot className="h-3.5 w-3.5 text-purple-400" />
                                <span>AI Certificate</span>
                              </button>
                              <button
                                onClick={() => handleOpenDeliverModal(order)}
                                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-300 hover:text-white font-bold text-xs border border-cyan-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                                title="Edit & update existing submitted deliverable"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-cyan-400" />
                                <span>Edit Deliverable</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleOpenDeliverModal(order)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span>Submit Deliverable</span>
                            </button>
                          )
                        ) : (
                          <div className="flex items-center gap-2">
                            {hasDeliverable && (
                              <button
                                type="button"
                                onClick={() => handleOpenDeliverModal(order)}
                                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white font-semibold text-xs border border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer"
                                title="View submitted deliverable details"
                              >
                                <Eye className="h-3.5 w-3.5 text-cyan-400" />
                                <span>View Submission</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setReviewingOrder(order)}
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                            >
                              <Star className="h-3.5 w-3.5 fill-zinc-950 text-zinc-950" />
                              <span>Rate Client</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Client / AI Revisions Requested Notice Card */}
                    {isRevisionRequested && (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-amber-950/30 to-zinc-950/60 border border-rose-500/40 space-y-3 animate-fadeIn">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-bold text-rose-300 text-xs">
                            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 animate-pulse" />
                            <span>Client &amp; AI Code Inspector Requested Changes on Deliverable</span>
                          </div>
                          {order.revisionRequestedAt && (
                            <span className="text-[10px] font-mono text-zinc-400">
                              Requested: {new Date(order.revisionRequestedAt).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {order.revisionNotes && (
                          <div className="p-3 rounded-xl bg-black/50 border border-rose-500/30 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider block">
                              Client Feedback &amp; Revision Instructions:
                            </span>
                            <p className="whitespace-pre-line font-mono text-xs text-zinc-200 leading-relaxed">
                              {order.revisionNotes}
                            </p>
                          </div>
                        )}

                        {((order.revisionIssues && order.revisionIssues.length > 0) || (order.auditCertificate?.issues && order.auditCertificate.issues.length > 0)) && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block">
                              Flagged Code / Repo Issues to Fix:
                            </span>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px] text-zinc-300">
                              {(order.revisionIssues || order.auditCertificate?.issues || []).map((issue, idx) => (
                                <li key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800">
                                  <span className="text-rose-400 font-bold shrink-0">✕</span>
                                  <span className="leading-tight">{issue}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="text-zinc-400 text-[11px]">
                            Fix these items in your repository and click below to resubmit.
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenDeliverModal(order)}
                            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>Open Revision Submission Form</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Deliverable Submitted Preview Card (When Deliverable Exists) */}
                    {hasDeliverable && order.deliverable && (
                      <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-zinc-950/40 -mx-5 -mb-5 p-4 rounded-b-3xl">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] font-bold flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-cyan-400" />
                            <span>Deliverable v{order.deliverable.version || 1} Live</span>
                          </span>

                          {isReleased ? (
                            <span className="text-emerald-400 font-medium text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>PayPal Escrow Released • Direct Payout Disbursed</span>
                            </span>
                          ) : (
                            <span className="text-amber-300 text-[11px] flex items-center gap-1">
                              <Clock className="h-3 w-3 text-amber-400" />
                              <span>Pending Client Audit &amp; PayPal Release Approval</span>
                            </span>
                          )}

                          {order.deliverable.summaryNotes && (
                            <span className="text-zinc-400 text-[11px] truncate max-w-xs sm:max-w-md hidden md:inline-block">
                              &ldquo;{order.deliverable.summaryNotes}&rdquo;
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {order.deliverable.repoUrl && (
                            <a
                              href={order.deliverable.repoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white flex items-center gap-1 font-mono text-[11px] transition-colors"
                            >
                              <Github className="h-3 w-3 text-cyan-400" />
                              <span>GitHub</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                            </a>
                          )}

                          {order.deliverable.liveDemoUrl && (
                            <a
                              href={order.deliverable.liveDemoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white flex items-center gap-1 font-mono text-[11px] transition-colors"
                            >
                              <Globe className="h-3 w-3 text-emerald-400" />
                              <span>Live Preview</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenDeliverModal(order)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 hover:text-white flex items-center gap-1 font-mono text-[11px] transition-colors cursor-pointer"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>{isCompleted ? 'View' : 'Edit'} Details</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Deliverable Submission & Version History Section */}
                    {(hasDeliverable || (order.deliverableHistory && order.deliverableHistory.length > 0)) && (
                      <div className="pt-2">
                        <DeliverableHistoryView
                          currentDeliverable={order.deliverable}
                          currentCertificate={order.auditCertificate}
                          history={order.deliverableHistory || []}
                          onOpenAuditModal={() => {
                            setActiveCertificateOrder(order);
                            setActiveModalTab('chat');
                          }}
                          onRunReAudit={() => handleRunAuditForProvider(order.id)}
                          isAuditing={auditingOrderId === order.id}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: 💰 EARNINGS & PAYPAL PAYOUT LEDGER                                  */}
      {/* ========================================================================= */}
      {activeTab === 'earnings' && activeProvider && (
        <ProviderWalletDashboard
          orders={orders}
          activeProvider={activeProvider}
          providerReceivedPayments={providerReceivedPayments}
          providerPendingEscrowPayments={providerPendingEscrowPayments}
          providerTotalCashedOut={providerTotalCashedOut}
          providerAvailableCashout={providerAvailableCashout}
          payouts={payouts}
          providerTransactions={providerTransactions}
          onOpenInvoice={(order) => setActiveInvoiceOrder(order)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-base">Edit Specialist Profile</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Professional Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-zinc-400 mb-1">Hourly Rate ($/hr)</label>
                  <input
                    type="number"
                    value={editForm.hourlyRate}
                    onChange={e => setEditForm({ ...editForm, hourlyRate: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Verified PayPal Payout Email (Required for Escrow)</label>
                <input
                  type="email"
                  value={editForm.paypalEmail}
                  onChange={e => setEditForm({ ...editForm, paypalEmail: e.target.value })}
                  placeholder="specialist-paypal@example.com"
                  className="w-full bg-zinc-900 border border-emerald-500/40 rounded-xl px-3 py-2 text-emerald-300 font-mono focus:outline-none focus:border-emerald-400"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Skills (Comma-separated)</label>
                <input
                  type="text"
                  value={editForm.skills}
                  onChange={e => setEditForm({ ...editForm, skills: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? <span className="animate-spin">⏳</span> : <Save className="h-4 w-4" />}
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deliverable Submission Modal */}
      {activeDeliverOrder && (
        <DeliverableSubmitModal
          key={activeDeliverOrder.id}
          isOpen={!!activeDeliverOrder}
          onClose={() => setActiveDeliverOrder(null)}
          orderId={activeDeliverOrder.id}
          orderTitle={activeDeliverOrder.serviceTitle}
          buyerName={activeDeliverOrder.buyerName}
          orderAmount={activeDeliverOrder.amount}
          providerPaypalEmail={activeProvider?.paypalEmail || ''}
          currentDeliverable={activeDeliverOrder.deliverable}
          previousIssues={activeDeliverOrder.revisionIssues || activeDeliverOrder.auditCertificate?.issues}
          revisionNotes={activeDeliverOrder.revisionNotes}
          onUpdatePaypalEmail={(email) => {
            setProviders(prev => prev.map(p => p.id === activeProvider?.id ? { ...p, paypalEmail: email } : p));
          }}
          onSuccess={(newDeliverable) => {
            setOrders(prev => prev.map(o => o.id === activeDeliverOrder.id ? {
              ...o,
              deliverable: newDeliverable,
              deliverableStatus: 'submitted_pending_audit',
              revisionNotes: undefined,
              revisionIssues: undefined,
              providerPaypalEmail: newDeliverable?.paypalEmail || activeProvider?.paypalEmail
            } : o));
            setResponseNotice('🎉 Deliverable revision successfully updated! Client & AI Auditor alerted.');
            setTimeout(() => setResponseNotice(null), 6000);
          }}
        />
      )}

      {/* Enterprise B2B Smart Tax Invoice Modal */}
      {activeInvoiceOrder && (
        <InvoiceModal
          isOpen={!!activeInvoiceOrder}
          onClose={() => setActiveInvoiceOrder(null)}
          order={activeInvoiceOrder}
        />
      )}

      {/* Institutional Notice Modal */}
      {systemNotice && systemNotice.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl p-6 text-center space-y-4">
            <div className={`h-12 w-12 rounded-2xl mx-auto flex items-center justify-center text-xl ${
              systemNotice.type === 'error'
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                : systemNotice.type === 'warning'
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
            }`}>
              {systemNotice.type === 'error' ? '🚫' : systemNotice.type === 'warning' ? '⚠️' : '✓'}
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">{systemNotice.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{systemNotice.message}</p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => setSystemNotice(null)}
                className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-white font-bold text-xs border border-zinc-700 transition-colors cursor-pointer"
              >
                Acknowledge & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Profile Modal (View Mode) */}
      {viewClientProfile && (
        <ClientProfileModal
          isOpen={!!viewClientProfile}
          onClose={() => setViewClientProfile(null)}
          mode="view"
          clientEmail={viewClientProfile.email}
          clientName={viewClientProfile.name}
          clientAvatar={viewClientProfile.avatar}
        />
      )}

      {/* Review Client Modal */}
      {reviewingOrder && (
        <ReviewClientModal
          isOpen={!!reviewingOrder}
          onClose={() => setReviewingOrder(null)}
          orderId={reviewingOrder.id}
          orderTitle={reviewingOrder.serviceTitle}
          clientName={reviewingOrder.buyerName}
          clientEmail={reviewingOrder.buyerEmail}
          orderAmount={reviewingOrder.amount}
          providerName={activeProvider.name}
          providerId={activeProvider.id}
          onReviewSubmitted={(oId, rev) => {
            setOrders(prev => prev.map(o => o.id === oId ? { ...o, clientReview: rev } : o));
            setResponseNotice(`🎉 Success: Your endorsement for ${reviewingOrder.buyerName} has been published!`);
            setTimeout(() => setResponseNotice(null), 5000);
          }}
        />
      )}

      {/* Dedicated Client & AI Discovery Chat Transcript Modal */}
      {isDiscoveryModalOpen && modalDiscoveryTarget && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
          onClick={() => {
            setIsDiscoveryModalOpen(false);
            setDiscoveryTargetSession(null);
          }}
        >
          <div 
            className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">Client & AI Discovery Transcript</h3>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold uppercase">
                      {modalDiscoveryTarget.messages?.length || 0} Messages
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Live verbatim dialogue between <strong className="text-white">{modalDiscoveryTarget.buyerName}</strong> and AgentPay Commerce Bot
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsDiscoveryModalOpen(false);
                  setDiscoveryTargetSession(null);
                }}
                className="h-8 w-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Client Project Scope Overview Pill */}
            <div className="p-3.5 bg-gradient-to-r from-cyan-950/20 via-zinc-900/40 to-purple-950/20 border-b border-zinc-800/80 flex items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={getClientAvatar(modalDiscoveryTarget)}
                  alt={modalDiscoveryTarget.buyerName || 'Client'}
                  className="h-9 w-9 rounded-xl object-cover border border-cyan-500/40 bg-zinc-800 shrink-0 shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(modalDiscoveryTarget.buyerName || 'Client')}&backgroundColor=b6e3f4`;
                  }}
                />
                <div className="min-w-0">
                  <span className="font-bold text-white block truncate">{modalDiscoveryTarget.buyerName || 'Client User'}</span>
                  <span className="text-[11px] text-zinc-400 font-mono truncate block">{modalDiscoveryTarget.buyerEmail}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Budget Cap</span>
                <span className="font-mono font-black text-emerald-400 text-sm">${modalDiscoveryTarget.spendingLimit || modalDiscoveryTarget.amount || 200} USD</span>
              </div>
            </div>

            {/* Transcript Scroll Area */}
            <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5 custom-scrollbar bg-zinc-950/60">
              {Array.isArray(modalDiscoveryTarget.messages) && modalDiscoveryTarget.messages.length > 0 ? (
                modalDiscoveryTarget.messages.map((m: any, idx: number) => {
                  const isUser = m.role === 'user';
                  return (
                    <div key={idx} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                      <div className="shrink-0 mt-0.5">
                        {isUser ? (
                          <img
                            src={getClientAvatar(modalDiscoveryTarget)}
                            alt={modalDiscoveryTarget.buyerName || 'Client'}
                            className="h-7 w-7 rounded-lg object-cover border border-cyan-500/40 bg-zinc-800"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(modalDiscoveryTarget.buyerName || 'Client')}&backgroundColor=b6e3f4`;
                            }}
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-lg bg-purple-950 border border-purple-500/40 flex items-center justify-center text-xs shadow-sm">
                            🤖
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 max-w-[85%] sm:max-w-[78%]">
                        <div className={`flex items-center gap-2 text-[10px] px-1 font-mono ${isUser ? 'justify-end text-cyan-300' : 'text-purple-300'}`}>
                          <span className="font-bold">{isUser ? modalDiscoveryTarget.buyerName : 'AgentPay Commerce AI'}</span>
                          <span className="text-zinc-500">{m.timestamp || ''}</span>
                        </div>
                        <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                          isUser
                            ? 'bg-cyan-950/40 text-cyan-100 border border-cyan-500/40 rounded-tr-none shadow-md'
                            : 'bg-zinc-900/90 text-zinc-200 border border-purple-500/20 rounded-tl-none shadow-md'
                        }`}>
                          {renderFormattedMessageText(m.content)}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-10 text-center text-zinc-500 text-xs">
                  No discovery messages recorded for this session.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-900/80 flex items-center justify-between shrink-0">
              <button
                onClick={() => {
                  setIsDiscoveryModalOpen(false);
                  setDiscoveryTargetSession(null);
                  const clientKey = (modalDiscoveryTarget.buyerEmail || modalDiscoveryTarget.buyerName || 'client').toLowerCase().trim();
                  setTemporaryChatTarget({
                    clientName: modalDiscoveryTarget.buyerName || 'Client',
                    clientEmail: modalDiscoveryTarget.buyerEmail || 'janithad2@gmail.com',
                    clientAvatar: getClientAvatar(modalDiscoveryTarget),
                    inquiryObj: modalDiscoveryTarget,
                    orderObj: modalDiscoveryTarget.orderObj,
                    channelId: modalDiscoveryTarget.orderObj?.id || `${modalDiscoveryTarget.id}_${activeProvider.id}`
                  });
                  setSelectedClientThreadId(clientKey);
                  setActiveTab('clients');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 hover:text-white border border-cyan-500/40 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                <span>Switch to Direct 1-on-1 Chat</span>
              </button>
              <button
                onClick={() => {
                  setIsDiscoveryModalOpen(false);
                  setDiscoveryTargetSession(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 font-bold text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Verification Certificate & Interactive Code Inspector Modal for Providers */}
      {activeCertificateOrder && (
        <AiAuditCertificateModal
          key={activeCertificateOrder.id + (activeCertificateOrder.auditCertificate?.auditHash || '-prov-audit')}
          isOpen={!!activeCertificateOrder}
          onClose={() => setActiveCertificateOrder(null)}
          orderId={activeCertificateOrder.id}
          orderTitle={activeCertificateOrder.serviceTitle}
          buyerName={activeCertificateOrder.buyerName || 'Client'}
          providerName={activeCertificateOrder.providerName || activeProvider.name}
          orderAmount={activeCertificateOrder.amount}
          certificate={activeCertificateOrder.auditCertificate}
          deliverable={activeCertificateOrder.deliverable}
          initialTab={activeModalTab}
          isAuditing={auditingOrderId === activeCertificateOrder.id}
          onRunAudit={() => handleRunAuditForProvider(activeCertificateOrder.id)}
        />
      )}
      </div>
    </div>
  );
}

export default function ProviderPortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#090A0F] text-zinc-400 p-8 flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        <span className="text-xs font-mono">Loading Specialist Workspace...</span>
      </div>
    }>
      <ProviderPortalPageContent />
    </Suspense>
  );
}
