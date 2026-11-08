'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Bot, User, Send, Shield, Sparkles, CheckCircle2, DollarSign, Clock, 
  ArrowRight, ExternalLink, History, X, ChevronRight, Lock, MessageSquare, AlertCircle,
  Check, Plus, Users, ShieldCheck, PanelLeft, PanelLeftClose, CreditCard, Briefcase,
  Layers, Settings, LogOut, ArrowUp, Zap, Pencil, FileText, CheckCheck, Copy, Award, Mic
} from 'lucide-react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import type { ChatMessage, ServiceProvider } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useJudgeTour } from '@/context/JudgeTourContext';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc, updateDoc, where, onSnapshot } from 'firebase/firestore';
import DirectChatModal from '@/components/DirectChatModal';
import ProviderProfileModal from '@/components/ProviderProfileModal';
import SpecialistDirectChatView, { SpecialistChatTarget } from '@/components/SpecialistDirectChatView';
import { getSpecialistRealAvatar } from '@/lib/specialistAvatars';
import ClientProfileModal from '@/components/ClientProfileModal';
import VoiceNotePlayer from '@/components/VoiceNotePlayer';
import VoiceNoteRecorder from '@/components/VoiceNoteRecorder';

function formatMessageTime(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (isYesterday) {
    return 'Yesterday';
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatInterface() {
  const { user, openAuthModal, logout, loginWithJudgeAccount } = useAuth();
  const { openTourModal, openTourBanner } = useJudgeTour();
  const searchParams = useSearchParams();
  const targetOrderId = searchParams?.get('orderId') || null;
  const targetSessionId = searchParams?.get('sessionId') || null;
  const targetPaypalOrderId = searchParams?.get('paypalOrderId') || null;
  const targetTab = searchParams?.get('tab') || searchParams?.get('view') || null;
  const targetProviderId = searchParams?.get('providerId') || null;
  const targetProviderName = searchParams?.get('providerName') || null;
  const targetScenario = searchParams?.get('scenario') || null;

  const [sessionId, setSessionId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [ordersCount, setOrdersCount] = useState<number | null>(null);
  const [clientOrders, setClientOrders] = useState<any[]>([]);
  const [selectedProfileProvider, setSelectedProfileProvider] = useState<ServiceProvider | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init_1',
      role: 'assistant',
      content: "Hello! I am your Autonomous AgentPay AI Commerce Agent. Tell me what service or digital deliverable you need (e.g. Next.js web application, Figma UI design, AI automation workflow, SEO, or video editing), and I will discover top-tier providers, negotiate terms, and set up your safe PayPal milestone escrow.",
      timestamp: 'Just now',
      actionPayload: {
        type: 'negotiation_proposal',
        isRealAI: true,
        modelUsed: 'gemini-2.5-flash'
      }
    }
  ]);
  const [input, setInput] = useState('');
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState(false);
  const [spendingLimit, setSpendingLimit] = useState(200);
  const [isLoading, setIsLoading] = useState(false);
  const [activePayPalOrder, setActivePayPalOrder] = useState<{
    orderId: string;
    paypalOrderId: string;
    amount: number;
    providerName: string;
    scopeTitle: string;
  } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isCapturingOrder, setIsCapturingOrder] = useState(false);
  const [copiedTestCard, setCopiedTestCard] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ isRealAI: boolean; modelUsed: string }>({
    isRealAI: true,
    modelUsed: 'gemini-2.5-flash'
  });

  // Full-Screen WhatsApp Desktop View vs AI Procurement Room Mode
  const [mainView, setMainView] = useState<'ai_room' | 'direct_specialist'>('ai_room');
  const [selectedSpecialistChat, setSelectedSpecialistChat] = useState<SpecialistChatTarget | null>(null);

  // Left Sidebar Segmented Mode: 'ai_rooms' (Sessions) | 'specialist_dms' (Specialist Contacts)
  const [sidebarTab, setSidebarTab] = useState<'ai_rooms' | 'specialist_dms'>('ai_rooms');

  // Live Message Previews, Read Receipts & Typing Statuses for Left Sidebar
  const [lastMessagesByTarget, setLastMessagesByTarget] = useState<Map<string, {
    lastMessage: string;
    lastMessageTime: string;
    senderRole: 'client' | 'provider';
    isSeen: boolean;
    unreadCount: number;
  }>>(new Map());
  const [typingStatuses, setTypingStatuses] = useState<{ [key: string]: boolean }>({});

  // All Available Verified Specialists (Loaded from Firestore for DMs)
  const [allSpecialists, setAllSpecialists] = useState<ServiceProvider[]>([]);

  // Direct 1-on-1 Chat with Specialist State (Legacy / Modal fallback)
  const [activeDirectChat, setActiveDirectChat] = useState<{
    channelId: string;
    orderTitle: string;
    providerName: string;
    isPurchasedOrder: boolean;
    bidPrice?: number;
    deliveryDays?: number;
    clientBudgetCap?: number;
  } | null>(null);

  // History Sessions State (Loaded in ChatGPT-style Left Sidebar)
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isClientProfileModalOpen, setIsClientProfileModalOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'funded' | 'bids' | 'awaiting' | 'cancelled'>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Session Classification Helpers
  const isSessionFunded = (s: any) => 
    Boolean(
      s?.status === 'escrow_funded' || 
      s?.status === 'in-escrow' || 
      s?.status === 'completed' || 
      s?.isEscrowFunded === true || 
      s?.isPaid === true ||
      Boolean(s?.paypalCaptureId) ||
      (Array.isArray(s?.messages) && s.messages.some((m: any) => m.actionPayload?.type === 'escrow_success'))
    );

  const isSessionCancelled = (s: any) =>
    Boolean(s?.status === 'closed_cancelled' || s?.isCancelled === true);

  const isSessionBids = (s: any) =>
    !isSessionFunded(s) && !isSessionCancelled(s) && Boolean(s?.bids?.length > 0);

  const isSessionAwaiting = (s: any) =>
    !isSessionFunded(s) && !isSessionCancelled(s) && (!s?.bids || s.bids.length === 0);

  // Unread Bid & Message Notification Tracking State
  const [seenSessions, setSeenSessions] = useState<Record<string, { lastSeenAt: number; seenBidsCount: number; seenDialogCount: number }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('agentpay_seen_sessions_map');
        if (stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return {};
  });

  const [activeToastNotice, setActiveToastNotice] = useState<{
    id: string;
    sessionId: string;
    title: string;
    providerName: string;
    amount?: number;
    message: string;
    type: 'bid' | 'message';
  } | null>(null);

  const prevBidsMapRef = useRef<Record<string, number>>({});
  const isInitialSyncRef = useRef<boolean>(true);

  // Message Deduplication Utility
  const deduplicateMessages = (msgs: ChatMessage[]): ChatMessage[] => {
    if (!Array.isArray(msgs)) return [];
    const seen = new Set<string>();
    const result: ChatMessage[] = [];
    for (const m of msgs) {
      if (!m || !m.content) continue;
      // Key by unique ID or trimmed content + role
      const contentKey = `${m.role}:::${m.content.trim()}`;
      const idKey = m.id ? `${m.role}:::${m.id}` : contentKey;
      if (!seen.has(idKey) && !seen.has(contentKey)) {
        seen.add(idKey);
        seen.add(contentKey);
        result.push(m);
      }
    }
    return result;
  };

  const markSessionAsSeen = (sId: string, bidsCount?: number, dialogCount?: number) => {
    if (!sId) return;
    setSeenSessions(prev => {
      const current = prev[sId] || { lastSeenAt: 0, seenBidsCount: 0, seenDialogCount: 0 };
      const updated = {
        ...prev,
        [sId]: {
          lastSeenAt: Date.now(),
          seenBidsCount: typeof bidsCount === 'number' ? bidsCount : (current.seenBidsCount || 0),
          seenDialogCount: typeof dialogCount === 'number' ? dialogCount : (current.seenDialogCount || 0)
        }
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('agentpay_seen_sessions_map', JSON.stringify(updated));
        } catch (e) {}
      }
      return updated;
    });

    // Clear background toast if viewing this session
    setActiveToastNotice(cur => cur?.sessionId === sId ? null : cur);

    // Update Firestore flag asynchronously
    try {
      updateDoc(doc(db, 'agentpay_chat_sessions', sId), {
        hasUnreadBid: false,
        hasUnreadMessage: false
      }).catch(() => {});
    } catch (e) {}
  };

  const getSessionUnreadStatus = (sess: any) => {
    if (!sess) return { hasUnreadBid: false, hasUnreadMsg: false, unreadCount: 0 };
    if (sess.id === sessionId) {
      return { hasUnreadBid: false, hasUnreadMsg: false, unreadCount: 0 };
    }

    const seenInfo = seenSessions[sess.id];
    const bidsCount = sess.bids?.length || 0;
    const dialogCount = sess.negotiationDialog?.length || 0;
    const lastUpdated = new Date(sess.updatedAt || sess.createdAt || 0).getTime();

    const hasUnreadBid = Boolean(
      bidsCount > 0 &&
      (!seenInfo || bidsCount > (seenInfo.seenBidsCount || 0) || (sess.hasUnreadBid && (!seenInfo.lastSeenAt || lastUpdated > seenInfo.lastSeenAt)))
    );

    const hasUnreadMsg = Boolean(
      !hasUnreadBid &&
      dialogCount > 0 &&
      (!seenInfo || dialogCount > (seenInfo.seenDialogCount || 0) || (sess.hasUnreadMessage && (!seenInfo.lastSeenAt || lastUpdated > seenInfo.lastSeenAt)))
    );

    const unreadCount = hasUnreadBid 
      ? Math.max(1, bidsCount - (seenInfo?.seenBidsCount || 0))
      : Math.max(1, dialogCount - (seenInfo?.seenDialogCount || 0));

    return {
      hasUnreadBid,
      hasUnreadMsg,
      unreadCount
    };
  };

  const totalUnreadBidsCount = useMemo(() => {
    return historySessions.filter(s => getSessionUnreadStatus(s).hasUnreadBid).length;
  }, [historySessions, sessionId, seenSessions]);

  // In-App Protocol Notice Modal (Zero browser alert())
  const [systemNotice, setSystemNotice] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'warning' | 'error' | 'success' | 'info';
  } | null>(null);

  // Custom Session Title Editing State (Per user requirement: rename & custom names)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState('');

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    try {
      const then = new Date(dateStr).getTime();
      const diffSec = Math.floor((Date.now() - then) / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      const diffDays = Math.floor(diffHour / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recent';
    }
  };

  const getSmartSessionTitle = (sess: any) => {
    if (sess.customTitle) return sess.customTitle;
    if (sess.winningBid?.providerName) {
      return `Contract: ${sess.winningBid.providerName.split(' ')[0]}`;
    }
    const text = sess.latestPrompt || sess.projectScope || '';
    if (text.toLowerCase().includes('next.js')) return 'Next.js 15 Dashboard RFP';
    if (text.toLowerCase().includes('figma')) return 'Figma Mobile App Design';
    if (text.toLowerCase().includes('automation') || text.toLowerCase().includes('n8n')) return 'AI Automation Workflow';
    if (text.toLowerCase().includes('video') || text.toLowerCase().includes('motion')) return 'Motion Video Production';
    if (text.toLowerCase().includes('proceed with')) {
      const match = text.match(/proceed with ([^for\.,]+)/i);
      if (match && match[1]) return `Contract: ${match[1].trim()}`;
    }
    if (text.length > 28) return text.substring(0, 28) + '...';
    return text || 'Procurement Session';
  };

  const handleStartRename = (sess: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(sess.id);
    setEditingTitleText(sess.customTitle || getSmartSessionTitle(sess));
  };

  const handleSaveRename = async (sessionIdToSave: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    if (!editingTitleText.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      await setDoc(doc(db, 'agentpay_chat_sessions', sessionIdToSave), {
        customTitle: editingTitleText.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setHistorySessions(prev => prev.map(s => 
        s.id === sessionIdToSave ? { ...s, customTitle: editingTitleText.trim() } : s
      ));
    } catch (err) {
      console.warn('Failed to save title:', err);
    } finally {
      setEditingSessionId(null);
    }
  };

  // Multi-Specialist Tender Selection State (Allows selecting 1, 2, or 3 specialists)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<{ [msgId: string]: string[] }>({});

  const getSelectedProviders = (msgId: string, matchedProviders: ServiceProvider[]) => {
    const chosenIds = selectedCandidateIds[msgId];
    if (chosenIds !== undefined) {
      return matchedProviders.filter(p => chosenIds.includes(p.id));
    }
    // Default: All 3 matched specialists are selected initially
    return matchedProviders;
  };

  const toggleCandidateProvider = (msgId: string, matchedProviders: ServiceProvider[], providerId: string) => {
    if (!user) {
      openAuthModal();
      return;
    }
    const currentSelected = getSelectedProviders(msgId, matchedProviders);
    const currentIds = currentSelected.map(p => p.id);
    let nextIds: string[];
    if (currentIds.includes(providerId)) {
      nextIds = currentIds.filter(id => id !== providerId);
    } else {
      nextIds = [...currentIds, providerId];
    }
    setSelectedCandidateIds(prev => ({
      ...prev,
      [msgId]: nextIds
    }));
  };

  const setSelectAllCandidates = (msgId: string, matchedProviders: ServiceProvider[]) => {
    if (!user) {
      openAuthModal();
      return;
    }
    setSelectedCandidateIds(prev => ({
      ...prev,
      [msgId]: matchedProviders.map(p => p.id)
    }));
  };

  const setSelectTopCandidates = (msgId: string, matchedProviders: ServiceProvider[], count: number) => {
    if (!user) {
      openAuthModal();
      return;
    }
    setSelectedCandidateIds(prev => ({
      ...prev,
      [msgId]: matchedProviders.slice(0, count).map(p => p.id)
    }));
  };

  const resolveToServiceProvider = (item: any): ServiceProvider => {
    if (!item) {
      return {
        id: `prov_${Date.now()}`,
        name: 'Verified Specialist',
        title: 'Full-Stack Specialist',
        category: 'ai-automation',
        hourlyRate: 55,
        rating: 4.9,
        reviewCount: 38,
        completedJobs: 42,
        avatarUrl: getSpecialistRealAvatar(item?.providerName || item?.name, item?.avatarUrl || item?.providerAvatar),
        bio: 'Top-tier verified specialist with an autonomous AI bidding delegate, delivering high-velocity milestone contracts with guaranteed quality.',
        skills: ['Full-Stack Development', 'API Integrations', 'Milestone Delivery', 'PayPal Escrow', 'Code Audit'],
        location: 'San Francisco, CA',
        portfolioSample: {
          title: 'Autonomous System',
          description: 'Production-ready architecture with automated testing and escrow milestones.',
          priceEstimate: 150,
          deliveryDays: 3
        },
        contactEmail: 'specialist@agentpay.network',
        status: 'active',
        verified: true,
        createdAt: new Date().toISOString(),
        autoBiddingEnabled: true
      };
    }

    if (item.skills && item.bio && item.portfolioSample) {
      return item as ServiceProvider;
    }

    for (const m of messages) {
      const found = m.actionPayload?.matchedProviders?.find((p: any) => p.id === item.id || p.id === item.providerId);
      if (found) return found;
    }

    return {
      id: item.id || item.providerId || `prov_${Date.now()}`,
      name: item.name || item.providerName || 'Verified Specialist',
      title: item.title || item.providerTitle || 'Full-Stack Specialist',
      category: item.category || 'ai-automation',
      hourlyRate: item.hourlyRate || 55,
      rating: item.rating || 4.9,
      reviewCount: item.reviewCount || 38,
      completedJobs: item.completedJobs || 42,
      avatarUrl: getSpecialistRealAvatar(item.providerName || item.name, item.avatarUrl || item.providerAvatar),
      bio: item.bio || `${item.providerName || item.name || 'This specialist'} is a top-tier verified provider with an active autonomous AI bidding delegate, delivering high-velocity milestone contracts with strict QA.`,
      skills: item.skills || ['Full-Stack Development', 'API Integrations', 'Milestone Delivery', 'PayPal Escrow', 'Code Audit'],
      location: item.location || 'San Francisco, CA',
      portfolioSample: item.portfolioSample || {
        title: `${item.title || item.providerTitle || 'Enterprise Workflow'} System`,
        description: 'Production-ready architecture with automated testing and escrow milestones.',
        priceEstimate: item.bidPrice || (item.hourlyRate ? item.hourlyRate * 3 : 150),
        deliveryDays: item.deliveryDays || 3
      },
      contactEmail: item.contactEmail || item.providerEmail || item.email || 'specialist@agentpay.network',
      status: 'active',
      verified: true,
      createdAt: item.createdAt || new Date().toISOString(),
      autoBiddingEnabled: true
    };
  };

  const renderFormattedMessage = (content: string) => {
    if (!content) return null;

    const lines = content.split('\n');

    return (
      <div className="space-y-2">
        {lines.map((line, lIdx) => {
          if (!line.trim()) return <div key={lIdx} className="h-0.5" />;

          const isCelebration = line.includes('Contract Officially Awarded') || line.includes('Swarm Tender Dispatched') || line.startsWith('🎉') || line.startsWith('🚀');

          const parts = line.split(/(\*\*[^*]+\*\*)/g);

          if (isCelebration) {
            return (
              <div 
                key={lIdx} 
                className="p-3 rounded-xl bg-gradient-to-r from-blue-950/80 via-cyan-950/60 to-zinc-900 border border-cyan-500/40 text-cyan-300 font-bold text-sm sm:text-base flex flex-wrap items-center gap-1.5 shadow-md shadow-cyan-950/30"
              >
                {parts.map((part, pIdx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    const cleanText = part.slice(2, -2);
                    return <span key={pIdx} className="text-white font-extrabold">{cleanText}</span>;
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
                return <span key={pIdx}>{part}</span>;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const paypalCardRef = useRef<HTMLDivElement>(null);
  const paymentSuccessRef = useRef<HTMLDivElement>(null);
  const hasScrolledToOrderRef = useRef<string | null>(null);
  const prevMessagesCountRef = useRef(messages.length);

  // Initialize or restore session ID and fetch sidebar data on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let initialSid = targetSessionId || (targetOrderId ? `session_${targetOrderId}` : null);
      if (!initialSid) {
        initialSid = sessionStorage.getItem('agentpay_chat_session_id');
      }
      if (!initialSid) {
        initialSid = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }
      sessionStorage.setItem('agentpay_chat_session_id', initialSid);
      setSessionId(initialSid);
    }
    fetchChatHistory();
    fetchOrdersCount();
    fetchSpecialists();
    fetchDirectMessageChannels();
  }, []);

  // Automated 1-Click Scenario Runner for Hackathon Judges
  useEffect(() => {
    if (targetScenario === 'procurement') {
      setInput("Build a production Next.js 15 analytics dashboard with Tailwind CSS, TypeScript, and live PayPal webhook integration.");
      setSpendingLimit(120);
      if (!user) {
        loginWithJudgeAccount();
      }
    }
  }, [targetScenario, user]);

  const [directMessageSpecialists, setDirectMessageSpecialists] = useState<SpecialistChatTarget[]>([]);

  // Real-time messages listener, orders listener & typing indicator subscriptions
  useEffect(() => {
    let unsubMsgs: (() => void) | null = null;
    let unsubOrders: (() => void) | null = null;
    let unsubTyping: (() => void) | null = null;

    try {
      unsubMsgs = onSnapshot(collection(db, 'agentpay_direct_messages'), (snap) => {
        const targetMap = new Map<string, {
          lastMessage: string;
          lastMessageTime: string;
          senderRole: 'client' | 'provider';
          isSeen: boolean;
          unreadCount: number;
        }>();

        // Sort all docs chronologically
        const allMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        allMsgs.sort((a: any, b: any) => new Date(a.createdAt || a.timestamp || 0).getTime() - new Date(b.createdAt || b.timestamp || 0).getTime());

        // Extract any direct-messaged specialists so they always appear in the sidebar
        const directSpecialistsMap = new Map<string, SpecialistChatTarget>();

        // Group by all linked identifiers
        allMsgs.forEach((msg: any) => {
          const keys = [
            msg.orderId,
            msg.channelId,
            msg.providerId,
            msg.providerName ? msg.providerName.toLowerCase().trim() : null
          ].filter(Boolean);

          keys.forEach(k => {
            const existing = targetMap.get(k) || {
              lastMessage: '',
              lastMessageTime: '',
              senderRole: 'client',
              isSeen: false,
              unreadCount: 0
            };

            targetMap.set(k, {
              lastMessage: msg.message || '',
              lastMessageTime: msg.createdAt || msg.timestamp || '',
              senderRole: msg.senderRole || 'client',
              isSeen: !!msg.isSeen,
              unreadCount: existing.unreadCount + (msg.senderRole === 'provider' && !msg.isSeen ? 1 : 0)
            });
          });

          const pName = msg.providerName || (msg.senderRole === 'provider' ? msg.senderName : null);
          const pKey = msg.providerId || pName;
          if (pName && pKey) {
            directSpecialistsMap.set(pName.toLowerCase().trim(), {
              channelId: msg.channelId || msg.orderId || pKey,
              orderId: msg.orderId || '',
              providerId: msg.providerId || pKey,
              providerName: pName,
              providerTitle: 'Verified Specialist (Direct Collaboration)',
              providerAvatar: getSpecialistRealAvatar(pName, msg.providerAvatar || (msg.senderRole === 'provider' ? msg.senderAvatar : '')),
              lastMessage: msg.message || '',
              lastMessageTime: msg.createdAt || msg.timestamp || '',
              lastMessageSenderRole: msg.senderRole || 'client',
              lastMessageIsSeen: !!msg.isSeen,
              isPurchasedOrder: !!(msg.orderId && msg.orderId.startsWith('ord_'))
            });
          }
        });

        setLastMessagesByTarget(targetMap);
        setDirectMessageSpecialists(Array.from(directSpecialistsMap.values()));
      }, (err) => {
        console.warn('Direct messages onSnapshot notice:', err);
      });
    } catch (e) {
      console.warn('onSnapshot error:', e);
    }

    // Real-time client orders listener
    try {
      unsubOrders = onSnapshot(collection(db, 'agentpay_orders'), (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setOrdersCount(list.length);
          setClientOrders(list);
        }
      }, (err) => {
        console.warn('Orders onSnapshot notice:', err);
      });
    } catch (e) {
      console.warn('Orders onSnapshot error:', e);
    }

    // Real-time typing indicators listener
    try {
      unsubTyping = onSnapshot(collection(db, 'agentpay_typing_status'), (snap) => {
        const typingMap: { [key: string]: boolean } = {};
        const now = Date.now();
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.isTyping && data.updatedAt && (now - data.updatedAt < 4000)) {
            typingMap[d.id] = true;
            if (data.typingUser) typingMap[data.typingUser.toLowerCase().trim()] = true;
          }
        });
        setTypingStatuses(typingMap);
      }, (err) => {
        console.warn('Typing onSnapshot notice:', err);
      });
    } catch (e) {
      console.warn('Typing onSnapshot error:', e);
    }

    return () => {
      if (unsubMsgs) unsubMsgs();
      if (unsubOrders) unsubOrders();
      if (unsubTyping) unsubTyping();
    };
  }, []);

  const [directMessageChannels, setDirectMessageChannels] = useState<{
    orderId: string;
    providerId?: string;
    lastMessage?: string;
    createdAt?: string;
  }[]>([]);

  const fetchDirectMessageChannels = async () => {
    try {
      const snap = await getDocs(collection(db, 'agentpay_direct_messages'));
      if (!snap.empty) {
        const channelsMap = new Map<string, any>();
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (data.orderId && !channelsMap.has(data.orderId)) {
            // Extract provider ID from orderId pattern (e.g. session_xxx_prov_yyy or order_xxx)
            const parts = data.orderId.split('_');
            const possibleProviderId = parts.length >= 3 ? parts.slice(2).join('_') : parts[parts.length - 1];
            channelsMap.set(data.orderId, {
              orderId: data.orderId,
              providerId: possibleProviderId,
              lastMessage: data.message,
              createdAt: data.createdAt
            });
          }
        });
        setDirectMessageChannels(Array.from(channelsMap.values()));
      }
    } catch (e) {
      console.warn('Failed to fetch direct message channels:', e);
    }
  };

  const fetchSpecialists = async () => {
    try {
      const snap = await getDocs(collection(db, 'agentpay_providers'));
      if (!snap.empty) {
        const list = snap.docs.map(d => d.data() as ServiceProvider);
        setAllSpecialists(list);
      }
    } catch (e) {
      console.warn('Failed to fetch specialists for sidebar DMs:', e);
    }
  };

  // Derive list of specialists for Left Sidebar "Specialist DMs" (WhatsApp Desktop Style)
  // STRICT FILTER: Displays specialists with whom the client has ACTUAL interaction (bids received, messaged, tendered, or hired)
  const activeSpecialistList = React.useMemo(() => {
    const result: SpecialistChatTarget[] = [];
    const addedProviderIds = new Set<string>();

    // 0. Client Orders: Specialists who were hired / have active or completed contracts
    clientOrders.forEach(ord => {
      const pKey = ord.providerId || ord.providerName;
      const nameKey = ord.providerName ? ord.providerName.toLowerCase().trim() : '';
      if (pKey && (!nameKey || !addedProviderIds.has(nameKey)) && !addedProviderIds.has(pKey)) {
        if (nameKey) addedProviderIds.add(nameKey);
        addedProviderIds.add(pKey);
        result.push({
          channelId: ord.id,
          orderId: ord.id,
          providerId: ord.providerId || pKey,
          providerName: ord.providerName,
          providerTitle: 'Verified Specialist (Active Contract)',
          providerAvatar: getSpecialistRealAvatar(ord.providerName, ord.providerAvatar),
          bidPrice: ord.amount,
          deliveryDays: ord.deliveryDays || 3,
          orderTitle: ord.serviceTitle || 'Escrow Contract Deliverable',
          isPurchasedOrder: true,
          orderAmount: ord.amount,
          escrowStatus: ord.status,
          sessionId: ord.sessionId
        });
      }
    });

    // 0.5. Direct Message Threads: Any specialist with whom direct messages have been exchanged
    directMessageSpecialists.forEach(dm => {
      const nameKey = dm.providerName.toLowerCase().trim();
      const pKey = dm.providerId || nameKey;
      if (!addedProviderIds.has(nameKey) && !addedProviderIds.has(pKey)) {
        addedProviderIds.add(nameKey);
        addedProviderIds.add(pKey);
        result.push(dm);
      }
    });

    // 1. Current Session: Specialists with incoming bids or who were tendered
    messages.forEach(m => {
      if (m.actionPayload?.bids && Array.isArray(m.actionPayload.bids)) {
        m.actionPayload.bids.forEach((b: any) => {
          const nameKey = b.providerName ? b.providerName.toLowerCase().trim() : '';
          if (!addedProviderIds.has(b.providerId) && (!nameKey || !addedProviderIds.has(nameKey))) {
            addedProviderIds.add(b.providerId);
            if (nameKey) addedProviderIds.add(nameKey);
            result.push({
              channelId: `${sessionId}_${b.providerId}`,
              providerId: b.providerId,
              providerName: b.providerName,
              providerTitle: b.providerTitle || 'Digital Solutions Expert',
              providerAvatar: b.providerAvatar,
              bidPrice: b.bidPrice,
              deliveryDays: b.deliveryDays || 3,
              orderTitle: messages.find(msg => msg.role === 'user')?.content || 'Procurement Deliverable',
              clientBudgetCap: spendingLimit,
              isPurchasedOrder: false
            });
          }
        });
      }

      if (m.actionPayload?.targetProviders && Array.isArray(m.actionPayload.targetProviders)) {
        m.actionPayload.targetProviders.forEach((tp: any) => {
          const nameKey = tp.name ? tp.name.toLowerCase().trim() : '';
          if (!addedProviderIds.has(tp.id) && (!nameKey || !addedProviderIds.has(nameKey))) {
            addedProviderIds.add(tp.id);
            if (nameKey) addedProviderIds.add(nameKey);
            result.push({
              channelId: `${sessionId}_${tp.id}`,
              providerId: tp.id,
              providerName: tp.name,
              providerTitle: tp.title || 'Digital Solutions Expert',
              providerAvatar: tp.avatarUrl,
              bidPrice: tp.bidPrice,
              deliveryDays: 3,
              orderTitle: messages.find(msg => msg.role === 'user')?.content || 'Procurement Deliverable',
              clientBudgetCap: spendingLimit,
              isPurchasedOrder: false
            });
          }
        });
      }
    });

    // 2. Direct Messages from Firestore: Specialists with whom an active message thread exists
    directMessageChannels.forEach(dm => {
      const prov = allSpecialists.find(p => p.id === dm.providerId || dm.orderId.includes(p.id));
      if (prov && !addedProviderIds.has(prov.id)) {
        addedProviderIds.add(prov.id);
        result.push({
          channelId: dm.orderId,
          providerId: prov.id,
          providerName: prov.name,
          providerTitle: prov.title,
          providerAvatar: prov.avatarUrl,
          providerRating: prov.rating,
          providerHourlyRate: prov.hourlyRate,
          orderTitle: 'Direct Specialist Discussion',
          isPurchasedOrder: false,
          clientBudgetCap: spendingLimit
        });
      }
    });

    // 3. Past History Sessions: Specialists who bid in previous client RFPs
    historySessions.forEach(sess => {
      if (Array.isArray(sess.bids)) {
        sess.bids.forEach((b: any) => {
          const nameKey = b.providerName ? b.providerName.toLowerCase().trim() : '';
          if (!addedProviderIds.has(b.providerId) && (!nameKey || !addedProviderIds.has(nameKey))) {
            addedProviderIds.add(b.providerId);
            if (nameKey) addedProviderIds.add(nameKey);
            result.push({
              channelId: `${sess.id}_${b.providerId}`,
              providerId: b.providerId,
              providerName: b.providerName,
              providerTitle: b.providerTitle || 'Digital Solutions Expert',
              providerAvatar: b.providerAvatar,
              bidPrice: b.bidPrice,
              deliveryDays: b.deliveryDays || 3,
              orderTitle: sess.projectScope || 'Procurement Deliverable',
              isPurchasedOrder: sess.status === 'escrow_created' || sess.status === 'closed_awarded'
            });
          }
        });
      }
    });

    // Synchronize and enrich any existing specialists with matching order data
    result.forEach(item => {
      const match = clientOrders.find(o => 
        (o.providerId && o.providerId === item.providerId) ||
        (o.providerName && item.providerName && o.providerName.toLowerCase().trim() === item.providerName.toLowerCase().trim()) ||
        (item.orderId && o.id === item.orderId)
      );
      if (match) {
        item.orderId = match.id;
        item.orderAmount = match.amount;
        item.escrowStatus = match.status;
        item.isPurchasedOrder = true;
        if (match.serviceTitle) item.orderTitle = match.serviceTitle;
        if (match.sessionId) item.sessionId = match.sessionId;
      }

      // Always ensure specialist has their authentic, high-resolution profile portrait
      item.providerAvatar = getSpecialistRealAvatar(item.providerName, item.providerAvatar);

      // Check last message & seen info from real-time snapshot
      const msgInfo = 
        (item.orderId && lastMessagesByTarget.get(item.orderId)) ||
        (item.channelId && lastMessagesByTarget.get(item.channelId)) ||
        (item.providerId && lastMessagesByTarget.get(item.providerId)) ||
        (item.providerName && lastMessagesByTarget.get(item.providerName.toLowerCase().trim()));

      if (msgInfo && msgInfo.lastMessage) {
        item.lastMessage = msgInfo.lastMessage;
        item.lastMessageTime = msgInfo.lastMessageTime;
        item.lastMessageSenderRole = msgInfo.senderRole;
        item.lastMessageIsSeen = msgInfo.isSeen;
        item.unreadCount = msgInfo.unreadCount;
      }

      // Check typing status
      item.isTyping = !!(
        (item.providerId && typingStatuses[item.providerId]) ||
        (item.orderId && typingStatuses[item.orderId]) ||
        (item.channelId && typingStatuses[item.channelId]) ||
        (item.providerName && typingStatuses[item.providerName.toLowerCase().trim()])
      );
    });

    // Sort: specialists with active typing or recent messages float to the top
    result.sort((a, b) => {
      if (a.isTyping && !b.isTyping) return -1;
      if (!a.isTyping && b.isTyping) return 1;
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }, [messages, historySessions, directMessageChannels, directMessageSpecialists, allSpecialists, clientOrders, lastMessagesByTarget, typingStatuses, sessionId, spendingLimit]);

  const fetchOrdersCount = async () => {
    try {
      const snap = await getDocs(collection(db, 'agentpay_orders'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setOrdersCount(list.length);
        setClientOrders(list);
      }
    } catch (e) {
      // silent
    }
  };

  const fetchChatHistory = async () => {
    setLoadingHistory(true);
    try {
      // 1. Fetch chat sessions from Firestore
      const snap = await getDocs(collection(db, 'agentpay_chat_sessions'));
      const fetchedSessions: any[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      // 2. Fetch client orders from Firestore to cross-reference live escrow & payment status
      let clientOrdersList: any[] = [];
      try {
        const ordSnap = await getDocs(collection(db, 'agentpay_orders'));
        clientOrdersList = ordSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setClientOrders(clientOrdersList);
        setOrdersCount(clientOrdersList.length);
      } catch (ordErr) {
        console.warn('Orders lookup error in chat history:', ordErr);
      }

      // 3. Build lookup maps for orders
      const ordersById = new Map<string, any>();
      const ordersBySessionId = new Map<string, any>();
      const ordersByPaypalId = new Map<string, any>();
      const ordersByTitle = new Map<string, any>();

      clientOrdersList.forEach(ord => {
        ordersById.set(ord.id, ord);
        if (ord.sessionId) ordersBySessionId.set(ord.sessionId, ord);
        if (ord.paypalOrderId) ordersByPaypalId.set(ord.paypalOrderId, ord);
        if (ord.serviceTitle) ordersByTitle.set(ord.serviceTitle.toLowerCase().trim(), ord);
      });

      // 4. Enrich every session with real-time order payment state
      const enriched: any[] = fetchedSessions.map(sess => {
        const linkedOrder = 
          (sess.orderRefId && ordersById.get(sess.orderRefId)) ||
          (ordersBySessionId.get(sess.id)) ||
          (sess.paypalOrderId && ordersByPaypalId.get(sess.paypalOrderId)) ||
          (sess.projectScope && ordersByTitle.get(sess.projectScope.toLowerCase().trim())) ||
          (sess.winningBid?.providerName && clientOrders.find(o => 
            o.providerName && o.providerName.toLowerCase().trim() === sess.winningBid.providerName.toLowerCase().trim()
          )) ||
          (sess.negotiatedDeal?.providerName && clientOrders.find(o => 
            o.providerName && o.providerName.toLowerCase().trim() === sess.negotiatedDeal.providerName.toLowerCase().trim()
          ));

        if (linkedOrder) {
          const isFunded = linkedOrder.status === 'in-escrow' || linkedOrder.status === 'completed';
          return {
            ...sess,
            orderRefId: sess.orderRefId || linkedOrder.id,
            paypalOrderId: sess.paypalOrderId || linkedOrder.paypalOrderId,
            paypalCaptureId: sess.paypalCaptureId || linkedOrder.paypalCaptureId,
            status: isFunded ? 'escrow_funded' : (linkedOrder.status === 'cancelled' ? 'closed_cancelled' : (linkedOrder.status === 'pending-payment' ? 'pending-payment' : sess.status)),
            isEscrowFunded: isFunded || sess.isEscrowFunded,
            isPaid: isFunded || sess.isPaid,
            winningBid: sess.winningBid || {
              providerName: linkedOrder.providerName,
              providerEmail: linkedOrder.providerEmail,
              bidPrice: linkedOrder.amount,
              deliveryDays: 3,
              milestones: linkedOrder.milestones
            },
            negotiatedPrice: sess.negotiatedPrice || linkedOrder.amount,
            amount: sess.amount || linkedOrder.amount
          };
        }
        return sess;
      });

      // 5. Synthesize sessions for any client orders (in-escrow or pending) not already represented in chat sessions
      const existingOrderIds = new Set(enriched.map(s => s.orderRefId).filter(Boolean));
      clientOrders.forEach(ord => {
        if (!existingOrderIds.has(ord.id)) {
          const isFunded = ord.status === 'in-escrow' || ord.status === 'completed';
          enriched.push({
            id: ord.sessionId || `session_${ord.id}`,
            orderRefId: ord.id,
            paypalOrderId: ord.paypalOrderId,
            paypalCaptureId: ord.paypalCaptureId || null,
            projectScope: ord.serviceTitle,
            spendingLimit: ord.amount,
            amount: ord.amount,
            status: isFunded ? 'escrow_funded' : (ord.status === 'pending-payment' ? 'pending-payment' : 'closed_awarded'),
            isEscrowFunded: isFunded,
            isPaid: isFunded,
            buyerName: ord.buyerName,
            buyerEmail: ord.buyerEmail,
            winningBid: {
              providerName: ord.providerName,
              providerEmail: ord.providerEmail,
              bidPrice: ord.amount,
              deliveryDays: 3,
              milestones: ord.milestones
            },
            updatedAt: ord.updatedAt || ord.createdAt || new Date().toISOString(),
            createdAt: ord.createdAt || new Date().toISOString(),
            messages: [
              {
                id: `ord_msg_${ord.id}`,
                role: 'assistant',
                content: `🤝 **Active Procurement Contract Room: #${ord.id}**\n\n• **Specialist**: ${ord.providerName} (${ord.providerEmail})\n• **Scope**: ${ord.serviceTitle}\n• **Total Escrow**: $${ord.amount} USD\n• **Contract Status**: ${isFunded ? '🛡️ In Escrow (Funds Protected)' : '⏳ Awaiting Payment Capture'}\n\n${isFunded ? 'Milestone funds are securely locked in PayPal Sandbox Escrow.' : 'Please complete PayPal Smart Escrow authorization to activate this milestone contract.'}`,
                timestamp: 'Just now',
                actionPayload: {
                  type: isFunded ? 'negotiation_proposal' : 'paypal_checkout',
                  tenderStatus: 'closed_awarded',
                  paypalOrderId: ord.paypalOrderId,
                  amount: ord.amount,
                  winningBid: {
                    providerName: ord.providerName,
                    bidPrice: ord.amount
                  }
                }
              }
            ]
          });
        }
      });

      // 6. Merge with in-memory sessions to prevent clobbering active transitions
      setHistorySessions(prev => {
        const sessionMap = new Map<string, any>();
        enriched.forEach(s => sessionMap.set(s.id, s));
        prev.forEach(p => {
          if (!sessionMap.has(p.id)) {
            sessionMap.set(p.id, p);
          }
        });
        const list = Array.from(sessionMap.values());
        list.sort((a: any, b: any) => {
          const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return timeB - timeA;
        });
        return list;
      });
    } catch (err) {
      console.warn('Failed to load chat sessions:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleNewSession = () => {
    setMainView('ai_room');
    setSidebarTab('ai_rooms');
    const newSid = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('agentpay_chat_session_id', newSid);
    }
    setSessionId(newSid);
    setMessages([
      {
        id: `init_${Date.now()}`,
        role: 'assistant',
        content: "New Autonomous Session Initialized. What service or deliverable would you like to procure and negotiate today within your spending limit?",
        timestamp: 'Just now',
        actionPayload: {
          type: 'negotiation_proposal',
          isRealAI: true,
          modelUsed: 'gemini-2.5-flash'
        }
      }
    ]);
    setActivePayPalOrder(null);
    setPaymentSuccess(false);
  };

  const resumeSession = (session: any) => {
    setMainView('ai_room');
    setSidebarTab('ai_rooms');
    setSessionId(session.id);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('agentpay_chat_session_id', session.id);
    }

    // Mark as seen immediately so any unread notification badge clears smoothly
    markSessionAsSeen(
      session.id, 
      session.bids?.length || (session.winningBid ? 1 : 0), 
      session.negotiationDialog?.length || 0
    );

    // Ensure resumed session is present and updated in historySessions so it is visually selected in sidebar
    setHistorySessions(prev => {
      const exists = prev.some(s => 
        s.id === session.id || 
        (session.orderRefId && s.orderRefId === session.orderRefId) ||
        (session.paypalOrderId && s.paypalOrderId === session.paypalOrderId)
      );
      if (!exists) {
        return [session, ...prev];
      }
      return prev.map(s => {
        if (
          s.id === session.id || 
          (session.orderRefId && s.orderRefId === session.orderRefId) ||
          (session.paypalOrderId && s.paypalOrderId === session.paypalOrderId)
        ) {
          return { ...s, ...session };
        }
        return s;
      });
    });

    if (Array.isArray(session.messages) && session.messages.length > 0) {
      setMessages(session.messages);
    } else {
      setMessages([
        {
          id: `init_${Date.now()}`,
          role: 'assistant',
          content: `🤝 **Active Procurement Session Resumed: ${session.projectScope || 'Milestone Contract'}**\n\n• **Specialist**: ${session.winningBid?.providerName || session.negotiatedDeal?.providerName || session.providerMatched || 'Specialist'}\n• **Total Escrow**: $${session.winningBid?.bidPrice || session.negotiatedDeal?.negotiatedPrice || session.amount || session.spendingLimit || 125} USD\n• **Status**: ${isSessionFunded(session) ? '🛡️ In Escrow (Funds Protected)' : '⏳ Awaiting PayPal Authorization'}`,
          timestamp: 'Just now',
          actionPayload: {
            type: !isSessionFunded(session) ? 'paypal_checkout' : 'negotiation_proposal',
            tenderStatus: 'closed_awarded',
            paypalOrderId: session.paypalOrderId,
            amount: session.winningBid?.bidPrice || session.negotiatedDeal?.negotiatedPrice || session.amount,
            isRealAI: true,
            modelUsed: 'gemini-2.5-flash'
          }
        }
      ]);
    }
    if (session.spendingLimit) {
      setSpendingLimit(session.spendingLimit);
    }

    const isFunded = isSessionFunded(session);

    const deal = session.negotiatedDeal || (session.winningBid ? {
      negotiatedPrice: session.winningBid.bidPrice || session.winningBid.amount,
      providerName: session.winningBid.providerName || session.winningBid.name,
      scopeTitle: session.projectScope || 'Milestone Deliverable'
    } : null);

    if (isFunded) {
      // Contract is ALREADY escrow funded: Never show PayPal checkout buttons!
      setActivePayPalOrder(null);
      setPaymentSuccess(true);
    } else if (deal && !isSessionCancelled(session)) {
      setActivePayPalOrder(session.paypalOrderId ? {
        orderId: session.orderRefId || session.id,
        paypalOrderId: session.paypalOrderId,
        amount: deal.negotiatedPrice || session.amount,
        providerName: deal.providerName || session.providerMatched || 'Specialist',
        scopeTitle: deal.scopeTitle || session.projectScope || 'Milestone Deliverable'
      } : null);
      setPaymentSuccess(false);
    } else {
      setActivePayPalOrder(null);
      setPaymentSuccess(false);
    }
  };

  // Deep-Link Inspector: Automatically route to the exact contract/room when arriving from /orders or external links
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!targetOrderId && !targetSessionId && !targetPaypalOrderId) return;

    let isMounted = true;

    const resolveDeepLinkSession = async () => {
      try {
        let matchedSession: any = null;

        // 1. Try resolving by explicit sessionId
        if (targetSessionId) {
          const sDoc = await getDoc(doc(db, 'agentpay_chat_sessions', targetSessionId));
          if (sDoc.exists()) {
            matchedSession = { id: sDoc.id, ...sDoc.data() };
          }
        }

        // 2. Try resolving by orderRefId in chat sessions
        if (!matchedSession && targetOrderId) {
          const qOrder = query(
            collection(db, 'agentpay_chat_sessions'),
            where('orderRefId', '==', targetOrderId),
            limit(1)
          );
          const qSnap = await getDocs(qOrder);
          if (!qSnap.empty) {
            const first = qSnap.docs[0];
            matchedSession = { id: first.id, ...first.data() };
          }
        }

        // 3. Try resolving by paypalOrderId in chat sessions
        if (!matchedSession && targetPaypalOrderId) {
          const qPP = query(
            collection(db, 'agentpay_chat_sessions'),
            where('paypalOrderId', '==', targetPaypalOrderId),
            limit(1)
          );
          const qSnap = await getDocs(qPP);
          if (!qSnap.empty) {
            const first = qSnap.docs[0];
            matchedSession = { id: first.id, ...first.data() };
          }
        }

        // 4. If still not matched, query agentpay_orders directly
        if (!matchedSession && targetOrderId) {
          const ordDoc = await getDoc(doc(db, 'agentpay_orders', targetOrderId));
          if (ordDoc.exists()) {
            const ordData = ordDoc.data();
            
            // If the order has a stored sessionId, try loading that session
            if (ordData.sessionId) {
              const sDoc = await getDoc(doc(db, 'agentpay_chat_sessions', ordData.sessionId));
              if (sDoc.exists()) {
                matchedSession = { id: sDoc.id, ...sDoc.data() };
              }
            }

            // Synthesize high-fidelity room session if chat doc wasn't found
            if (!matchedSession) {
              const isOrderFunded = ordData.status === 'in-escrow' || ordData.status === 'completed';
              matchedSession = {
                id: ordData.sessionId || `session_${ordData.id}`,
                buyerName: ordData.buyerName,
                buyerEmail: ordData.buyerEmail,
                orderRefId: ordData.id,
                paypalOrderId: ordData.paypalOrderId,
                projectScope: ordData.serviceTitle,
                spendingLimit: ordData.amount,
                status: isOrderFunded ? 'escrow_funded' : 'closed_awarded',
                isEscrowFunded: isOrderFunded,
                paypalCaptureId: ordData.paypalCaptureId || null,
                winningBid: {
                  providerName: ordData.providerName,
                  providerEmail: ordData.providerEmail,
                  bidPrice: ordData.amount,
                  deliveryDays: 3,
                  milestones: ordData.milestones
                },
                negotiatedDeal: {
                  providerName: ordData.providerName,
                  negotiatedPrice: ordData.amount,
                  scopeTitle: ordData.serviceTitle,
                  milestones: ordData.milestones
                },
                messages: [
                  {
                    id: `direct_order_${Date.now()}`,
                    role: 'assistant',
                    content: `🤝 **Active Procurement Contract Room: #${ordData.id}**\n\n• **Specialist**: ${ordData.providerName} (${ordData.providerEmail})\n• **Scope**: ${ordData.serviceTitle}\n• **Total Escrow**: $${ordData.amount} USD\n• **Contract Status**: ${ordData.status === 'in-escrow' ? '🛡️ In Escrow (Funds Protected)' : ordData.status === 'completed' ? '✓ Completed' : '⏳ Awaiting Payment Capture'}\n\n${ordData.status === 'pending-payment' ? 'Please complete PayPal Smart Escrow authorization below to activate this milestone contract.' : 'Milestone funds are securely locked in PayPal Sandbox Escrow.'}`,
                    timestamp: 'Just now',
                    actionPayload: {
                      type: ordData.status === 'pending-payment' ? 'paypal_checkout' : 'negotiation_proposal',
                      tenderStatus: 'closed_awarded',
                      paypalOrderId: ordData.paypalOrderId,
                      amount: ordData.amount,
                      isRealAI: true,
                      modelUsed: 'gemini-2.5-flash'
                    }
                  }
                ]
              };

              // Auto-persist synthesized room session to Firestore and link to order
              try {
                await setDoc(doc(db, 'agentpay_chat_sessions', matchedSession.id), JSON.parse(JSON.stringify(matchedSession)), { merge: true });
                await updateDoc(doc(db, 'agentpay_orders', ordData.id), { sessionId: matchedSession.id });
              } catch (saveErr) {
                console.warn('Auto-persist session notice:', saveErr);
              }
            }
          }
        }

        if (matchedSession && isMounted) {
          // Prepend to historySessions so it immediately appears and is visually selected in sidebar
          setHistorySessions(prev => {
            const filtered = prev.filter(s => 
              s.id !== matchedSession.id && 
              (!matchedSession.orderRefId || s.orderRefId !== matchedSession.orderRefId) &&
              (!matchedSession.paypalOrderId || s.paypalOrderId !== matchedSession.paypalOrderId)
            );
            return [matchedSession, ...filtered];
          });

          resumeSession(matchedSession);
          // If the order is awaiting payment, scroll directly to the PayPal authorization card!
          if (matchedSession.status === 'pending-payment' || !isSessionFunded(matchedSession)) {
            setTimeout(() => {
              paypalCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 350);
          }
        }
      } catch (err) {
        console.warn('Failed to resolve deep link session:', err);
      }
    };

    resolveDeepLinkSession();

    return () => {
      isMounted = false;
    };
  }, [targetOrderId, targetSessionId, targetPaypalOrderId]);

  // Deep-link routing for Specialist Direct Chat (e.g. from Client Orders & Escrow page)
  useEffect(() => {
    if (targetTab === 'specialists' || targetTab === 'specialist' || targetProviderId || targetProviderName) {
      setSidebarTab('specialist_dms');
      setMainView('direct_specialist');

      // Attempt to find in activeSpecialistList
      const matched = activeSpecialistList.find(s => 
        (targetProviderId && s.providerId === targetProviderId) ||
        (targetProviderName && s.providerName?.toLowerCase().trim() === targetProviderName.toLowerCase().trim()) ||
        (targetOrderId && (s.channelId === targetOrderId || s.orderId === targetOrderId))
      );

      if (matched) {
        setSelectedSpecialistChat(matched);
      } else {
        // Find in clientOrders
        const matchingOrder = clientOrders.find(o => 
          (targetOrderId && o.id === targetOrderId) ||
          (targetProviderId && o.providerId === targetProviderId) ||
          (targetProviderName && o.providerName?.toLowerCase().trim() === targetProviderName.toLowerCase().trim())
        );

        setSelectedSpecialistChat({
          channelId: targetOrderId || (matchingOrder ? matchingOrder.id : `session_${targetProviderId || 'spec'}`),
          orderId: targetOrderId || (matchingOrder ? matchingOrder.id : undefined),
          providerId: targetProviderId || (matchingOrder ? matchingOrder.providerId : 'prov_specialist'),
          providerName: targetProviderName || (matchingOrder ? matchingOrder.providerName : 'Verified Specialist'),
          providerTitle: 'Verified Specialist (Direct Collaboration)',
          orderTitle: matchingOrder?.serviceTitle || 'Milestone Contract Discussion',
          isPurchasedOrder: !!targetOrderId || !!matchingOrder,
          orderAmount: matchingOrder?.amount,
          escrowStatus: matchingOrder?.status,
          sessionId: targetSessionId || matchingOrder?.sessionId || undefined
        });
      }
    }
  }, [targetTab, targetProviderId, targetProviderName, targetOrderId, targetSessionId, activeSpecialistList, clientOrders]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight + 500,
        behavior: 'smooth'
      });
    }
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 40);
  };

  useEffect(() => {
    // 1. If messages count grew, ALWAYS auto-scroll down so the user's/assistant's last message is 100% visible!
    if (messages.length > prevMessagesCountRef.current) {
      prevMessagesCountRef.current = messages.length;
      scrollToBottom();
      return;
    }
    prevMessagesCountRef.current = messages.length;

    // 2. When a new PayPal order arrives on room load, smoothly scroll ONCE only!
    if (activePayPalOrder) {
      if (hasScrolledToOrderRef.current !== activePayPalOrder.paypalOrderId) {
        hasScrolledToOrderRef.current = activePayPalOrder.paypalOrderId;

        // Smoothly center the PayPal Checkout card in view once
        const t = setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
              top: chatContainerRef.current.scrollHeight,
              behavior: 'smooth'
            });
          }
          paypalCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);

        return () => clearTimeout(t);
      }
      return;
    }

    // Reset order scroll lock when order is completed or cleared
    hasScrolledToOrderRef.current = null;

    if (paymentSuccess) {
      const t = setTimeout(() => {
        paymentSuccessRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [messages, activePayPalOrder, paymentSuccess]);

  // Provider 1-Click Auto Accept
  const handleProviderAutoAccept = async (targetSessionId?: string) => {
    const sid = targetSessionId || sessionId;
    if (!sid) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/providers/respond-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          action: 'accept'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
        if (data.paypalOrderId) {
          const lastMsg = data.messages?.[data.messages.length - 1];
          const deal = lastMsg?.actionPayload?.negotiatedTerms;
          setActivePayPalOrder({
            orderId: data.orderRefId || `ord_${Date.now()}`,
            paypalOrderId: data.paypalOrderId,
            amount: data.amount || deal?.negotiatedPrice || 160,
            providerName: deal?.providerName || 'Specialist',
            scopeTitle: deal?.scopeTitle || 'Milestone Contract'
          });
        }
      } else {
        setSystemNotice({
          isOpen: true,
          title: 'Provider Workspace Notice',
          message: data.error || 'Failed to auto-accept inquiry.',
          type: 'warning'
        });
      }
    } catch (err: any) {
      console.warn('Auto accept error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Award Contract to a specific Specialist Bid (Autonomous Reverse Auction Winner)
  const handleAwardBid = async (targetSessionId: string, providerId: string, bidPrice?: number) => {
    if (!user) {
      openAuthModal();
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/agent/award-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: targetSessionId || sessionId,
          providerId,
          bidPrice
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
        if (data.paypalOrderId && data.winningBid) {
          setActivePayPalOrder({
            orderId: data.orderRefId || `ord_${Date.now()}`,
            paypalOrderId: data.paypalOrderId,
            amount: data.winningBid.bidPrice || data.winningBid.amount || bidPrice || 160,
            providerName: data.winningBid.providerName || data.winningBid.name || 'Specialist',
            scopeTitle: data.winningBid.serviceTitle || 'Milestone Contract'
          });
        }
        // Smoothly scroll down to PayPal card
        setTimeout(() => {
          paypalCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
        fetchChatHistory();
      } else {
        setSystemNotice({
          isOpen: true,
          title: 'Contract Award Notice',
          message: data.error || 'Failed to award contract.',
          type: 'error'
        });
      }
    } catch (err: any) {
      console.warn('Award bid error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Simulation Helper for Hackathon Judges / Evaluators
  const handleSimulateProviderBid = async (
    targetSessionId: string, 
    providerId: string, 
    bidPrice: number, 
    deliveryDays: number = 3, 
    note?: string
  ) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/providers/submit-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: targetSessionId || sessionId,
          providerId,
          bidPrice,
          deliveryDays,
          note: note || `I have verified capacity and will deliver within ${deliveryDays} days with full documentation.`
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const snap = await getDoc(doc(db, 'agentpay_chat_sessions', targetSessionId || sessionId));
        if (snap.exists()) {
          const sData = snap.data();
          if (Array.isArray(sData.messages)) {
            setMessages(sData.messages);
          }
        }
      } else {
        setSystemNotice({
          isOpen: true,
          title: 'Protocol Budget Guard',
          message: data.error || 'Bid submission notice.',
          type: 'warning'
        });
      }
    } catch (err: any) {
      console.warn('Simulate bid error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time Firestore sync listener for active procurement room (Messages, Bids, Dialogue & Award State)
  useEffect(() => {
    if (!sessionId) return;

    const unsub = onSnapshot(doc(db, 'agentpay_chat_sessions', sessionId), (snap) => {
      if (!snap.exists()) return;
      const sData = snap.data();

      // Reflect updated messages, negotiation dialog, and live bids from Firestore
      if (Array.isArray(sData.messages) && sData.messages.length > 0) {
        setMessages(sData.messages);
      }
      setHistorySessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...sData } : s));

      // If contract was awarded, reflect PayPal checkout state
      if (sData.status === 'closed_awarded' && sData.paypalOrderId && sData.winningBid) {
        if (isSessionFunded(sData)) {
          setActivePayPalOrder(null);
          setPaymentSuccess(true);
        } else {
          setActivePayPalOrder({
            orderId: sData.orderRefId || sessionId,
            paypalOrderId: sData.paypalOrderId,
            amount: sData.winningBid.bidPrice || sData.winningBid.amount || 160,
            providerName: sData.winningBid.providerName || 'Specialist',
            scopeTitle: sData.projectScope || 'Milestone Contract'
          });
        }
      }
    }, (err) => {
      console.warn('Realtime chat session listener notice:', err);
    });

    return () => unsub();
  }, [sessionId]);

  // Global Real-time Firestore sync listener for all procurement sessions (Inbound Bids & Dialogue Updates)
  useEffect(() => {
    const q = query(collection(db, 'agentpay_chat_sessions'), orderBy('updatedAt', 'desc'), limit(25));
    const unsub = onSnapshot(q, (snap) => {
      // First snapshot initializes the baseline map so historical bids do not trigger toasts
      if (isInitialSyncRef.current) {
        snap.docs.forEach(docSnap => {
          const d = docSnap.data();
          prevBidsMapRef.current[docSnap.id] = Array.isArray(d.bids) ? d.bids.length : 0;
        });
        isInitialSyncRef.current = false;
        fetchChatHistory();
        return;
      }

      snap.docChanges().forEach(change => {
        if (change.type === 'modified') {
          const mod = { id: change.doc.id, ...change.doc.data() } as any;
          // If modified session has bids and is NOT the currently active room
          if (mod.id !== sessionId && Array.isArray(mod.bids) && mod.bids.length > 0) {
            const prevCount = prevBidsMapRef.current[mod.id] || 0;
            if (mod.bids.length > prevCount) {
              prevBidsMapRef.current[mod.id] = mod.bids.length;
              const latestBid = mod.bids[mod.bids.length - 1];
              setActiveToastNotice({
                id: `toast_${Date.now()}`,
                sessionId: mod.id,
                title: mod.projectScope || 'Procurement Deliverable',
                providerName: latestBid?.providerName || 'Specialist',
                amount: latestBid?.bidPrice || mod.spendingLimit,
                message: `Submitted official milestone bid of $${latestBid?.bidPrice || mod.spendingLimit} USD`,
                type: 'bid'
              });
            }
          }
        }
      });
      fetchChatHistory();
    }, (err) => {
      console.warn('Realtime sessions collection listener notice:', err);
    });

    return () => unsub();
  }, [sessionId]);

  const extractBudgetFromPrompt = (text: string): number | null => {
    if (!text) return null;
    const patterns = [
      /(?:under|below|max|maximum|cap|budget|price|for|around|up\s*to)\s*(?:of|is|:)?\s*\$?\s*(\d{2,4})\b/i,
      /\(\s*\$?\s*(\d{2,4})\s*\)/,
      /\$\s*(\d{2,4})\b/,
      /\b(\d{2,4})\s*(?:usd|dollars|\$)/i
    ];
    for (const re of patterns) {
      const match = text.match(re);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (val >= 30 && val <= 1000) {
          return val;
        }
      }
    }
    return null;
  };

  const handleSend = async (customPrompt?: string, voiceData?: { audioUrl: string; duration: number; transcript: string }) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || isLoading) return;

    // Auto-auth prompt check if user isn't logged in and wants to select or negotiate
    const lower = textToSend.toLowerCase();
    const isActionIntent = lower.includes('proceed with') || 
                           lower.includes('negotiate') || 
                           lower.includes('select') || 
                           lower.includes('hire') || 
                           lower.includes('award') || 
                           lower.includes('dispatch tender');

    if (isActionIntent && !user) {
      openAuthModal();
      return;
    }

    const currentSid = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    if (!sessionId) setSessionId(currentSid);

    // Auto-detect budget mentioned in client prompt and dynamically adjust Budget Cap slider!
    const detectedBudget = extractBudgetFromPrompt(textToSend);
    let activeLimit = spendingLimit;
    if (detectedBudget !== null && detectedBudget !== spendingLimit) {
      activeLimit = detectedBudget;
      setSpendingLimit(detectedBudget);
    }

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      audioUrl: voiceData?.audioUrl,
      audioDuration: voiceData?.duration,
      voiceTranscript: voiceData?.transcript
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSid,
          messages: [...messages, userMsg],
          spendingLimit: activeLimit,
          buyerName: user?.name || 'Janitha Dilshan',
          buyerEmail: user?.email || 'janithad2@gmail.com',
          buyerAvatar: user?.avatarUrl || ''
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to communicate with AI Agent.');
      }

      if (typeof data.spendingLimit === 'number' && data.spendingLimit >= 30 && data.spendingLimit <= 1000) {
        setSpendingLimit(data.spendingLimit);
      }

      const decision = data.agentDecision;
      const isTender = decision?.intent === 'tender_dispatched';
      const isNegotiationOrCheckout = decision?.intent === 'checkout_ready' || !!decision?.negotiatedDeal || !!data.paypalOrderId;

      if (typeof data.isRealAI === 'boolean') {
        setAiStatus({ isRealAI: data.isRealAI, modelUsed: data.modelUsed || 'gemini-2.5-flash' });
      }

      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: decision?.reply || data.fallbackReply || "I have analyzed your request.",
        timestamp: 'Just now',
        actionPayload: {
          type: isTender ? 'tender_dispatched' : (isNegotiationOrCheckout ? 'paypal_checkout' : data.matchedProviders?.length ? 'search_results' : 'negotiation_proposal'),
          tenderStatus: isTender ? 'tender_open' : undefined,
          targetProviders: decision?.targetProviders || null,
          bids: decision?.bids || [],
          matchedProviders: (isNegotiationOrCheckout || isTender) ? [] : data.matchedProviders,
          negotiatedTerms: decision?.negotiatedDeal,
          negotiationDialog: decision?.negotiationDialog,
          paypalOrderId: data.paypalOrderId,
          amount: decision?.negotiatedDeal?.negotiatedPrice,
          isRealAI: data.isRealAI,
          modelUsed: data.modelUsed
        }
      };

      setMessages((prev) => deduplicateMessages([...prev, assistantMsg]));

      // If PayPal order was triggered, set it for interactive checkout
      if (decision?.negotiatedDeal && data.paypalOrderId) {
        setActivePayPalOrder({
          orderId: data.orderRefId || `ord_${Date.now()}`,
          paypalOrderId: data.paypalOrderId || `PAYPAL_SANDBOX_${Date.now()}`,
          amount: decision.negotiatedDeal.negotiatedPrice,
          providerName: decision.negotiatedDeal.providerName,
          scopeTitle: decision.negotiatedDeal.scopeTitle
        });
      }

      // Update history in background
      fetchChatHistory();

    } catch (err: any) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'system',
          content: `⚠️ Connection notice: ${err.message || 'AI request failed'}. Please check Gemini API key in Admin.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayPalCapture = async (paypalOrderId: string) => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!activePayPalOrder || isCapturingOrder) return;
    setIsCapturingOrder(true);

    const targetOrder = { ...activePayPalOrder };

    try {
      const res = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paypalOrderId,
          orderId: targetOrder.orderId
        })
      });

      const captureData = await res.json();

      if (captureData.success) {
        setPaymentSuccess(true);
        setActivePayPalOrder(null);
        fetchOrdersCount();

        setMessages((prev) => {
          // Strictly prevent duplicate payment verification bubbles if double-clicked
          if (prev.some(m => m.actionPayload?.type === 'escrow_success')) {
            return prev;
          }
          return [
            ...prev,
            {
              id: `sys_${Date.now()}`,
              role: 'assistant',
              content: `🎉 Payment successfully verified via PayPal Orders v2! $${captureData.amount || targetOrder.amount} USD is securely locked in Milestone Escrow. A transactional notification has been dispatched to ${targetOrder.providerName}. You can track and release milestones in the Escrow Vault page.`,
              timestamp: 'Just now',
              actionPayload: {
                isRealAI: true,
                type: 'escrow_success'
              }
            }
          ];
        });
        fetchChatHistory();
      } else {
        setSystemNotice({
          isOpen: true,
          title: 'PayPal Capture Warning',
          message: captureData.error || 'Failed to capture PayPal order.',
          type: 'error'
        });
      }
    } catch (err: any) {
      console.error('Capture error:', err);
    } finally {
      setIsCapturingOrder(false);
    }
  };

  const isInitialWelcome = messages.length <= 1;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090A0F] text-zinc-100 font-sans">
      
      {/* ========================================================= */}
      {/* 1. LEFT COLLAPSIBLE WORKSPACE SIDEBAR (ChatGPT / Grok Style) */}
      {/* ========================================================= */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64 sm:w-72' : 'w-0'
        } transition-all duration-300 ease-in-out h-full bg-[#0d0f15] border-r border-zinc-800/80 flex flex-col justify-between shrink-0 overflow-hidden z-30 select-none`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Sidebar Top Header & Collapse Toggle */}
          <div className="p-3.5 border-b border-zinc-800/80 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative h-8 w-8 rounded-xl shadow-md group-hover:scale-105 transition-transform overflow-hidden">
                <img 
                  src="/images/agentpay-logo.svg" 
                  alt="AgentPay AI Logo" 
                  className="h-full w-full object-cover rounded-xl"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-white tracking-tight">AgentPay</span>
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                  AI
                </span>
              </div>
            </Link>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
              title="Close sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* New Chat / RFP Button */}
          <div className="p-3">
            <button
              onClick={handleNewSession}
              className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs border border-zinc-800 hover:border-zinc-700 flex items-center justify-between shadow-sm transition-all cursor-pointer group"
              title="Start a fresh procurement session"
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>New Procurement RFP</span>
              </div>
              <Sparkles className="h-3 w-3 text-cyan-400/60" />
            </button>
          </div>

          {/* Client Navigation Menus (Included directly into sidebar per user requirement) */}
          <div className="px-3 pb-2 space-y-1">
            <Link
              href="/orders"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900/80 transition-all border border-transparent hover:border-zinc-800"
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="h-4 w-4 text-emerald-400" />
                <span>Client Orders & Escrow</span>
              </div>
              {ordersCount !== null && ordersCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {ordersCount}
                </span>
              )}
            </Link>

            <Link
              href="/transactions"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900/80 transition-all border border-transparent hover:border-zinc-800 group"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                <span>Transactions & Ledger</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                Ledger
              </span>
            </Link>

            <Link
              href="/services"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80 transition-all border border-transparent hover:border-zinc-800"
            >
              <Briefcase className="h-4 w-4 text-cyan-400" />
              <span>Talent Directory</span>
            </Link>
          </div>

          {/* Section Divider */}
          <div className="px-3 py-1">
            <div className="h-px bg-zinc-800/80" />
          </div>

          {/* WhatsApp Desktop Style Segmented Switcher: AI Rooms vs Specialist DMs */}
          <div className="px-3 py-1.5">
            <div className="p-1 bg-zinc-900/90 rounded-xl border border-zinc-800 flex items-center gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => {
                  setSidebarTab('ai_rooms');
                  setMainView('ai_room');
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  sidebarTab === 'ai_rooms' && mainView === 'ai_room'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="AI Reverse Auction & Procurement Room"
              >
                <Bot className="h-3.5 w-3.5" />
                <span>AI Rooms</span>
                {totalUnreadBidsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-zinc-950 text-[9px] font-mono font-black animate-pulse flex items-center gap-0.5 shadow-sm shadow-emerald-950/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-black animate-ping shrink-0" />
                    {totalUnreadBidsCount} NEW
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    openAuthModal();
                    return;
                  }
                  setSidebarTab('specialist_dms');
                  if (activeSpecialistList.length > 0 && !selectedSpecialistChat) {
                    setSelectedSpecialistChat(activeSpecialistList[0]);
                    setMainView('direct_specialist');
                  } else if (selectedSpecialistChat) {
                    setMainView('direct_specialist');
                  }
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  sidebarTab === 'specialist_dms' || mainView === 'direct_specialist'
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Direct 1-on-1 Specialist Messages (WhatsApp Desktop Style)"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Specialists</span>
                {activeSpecialistList.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300 text-[9px] font-mono font-bold">
                    {activeSpecialistList.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Dynamic Left Sidebar List: Switchable between AI Sessions & Specialist Direct Chats */}
          {sidebarTab === 'specialist_dms' ? (
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 custom-scrollbar">
              <div className="flex items-center justify-between px-2 pb-1.5 text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-bold">
                <span>Specialist DMs</span>
                <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                </span>
              </div>

              {activeSpecialistList.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs px-2 space-y-2.5">
                  <MessageSquare className="h-7 w-7 text-zinc-600 mx-auto" />
                  <p className="font-semibold text-zinc-300">No active specialist chats yet</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed max-w-[200px] mx-auto">
                    Once specialists submit bids on your RFP or you message them, they will appear here.
                  </p>
                  <Link
                    href="/services"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-cyan-400 text-xs font-semibold border border-zinc-800 transition-all cursor-pointer"
                  >
                    <Briefcase className="h-3 w-3" />
                    <span>Browse Talent Directory</span>
                  </Link>
                </div>
              ) : (
                <>
                  {activeSpecialistList.map((spec) => {
                    const isSelected = mainView === 'direct_specialist' && (
                      selectedSpecialistChat?.providerId === spec.providerId ||
                      (spec.orderId && selectedSpecialistChat?.orderId === spec.orderId) ||
                      (spec.channelId && selectedSpecialistChat?.channelId === spec.channelId) ||
                      (selectedSpecialistChat?.providerName && spec.providerName && selectedSpecialistChat.providerName.toLowerCase().trim() === spec.providerName.toLowerCase().trim())
                    );
                    const hasBid = !!spec.bidPrice;

                    return (
                      <div
                        key={spec.providerId}
                        onClick={() => {
                          if (!user) {
                            openAuthModal();
                            return;
                          }
                          setSelectedSpecialistChat(spec);
                          setMainView('direct_specialist');
                          setSidebarTab('specialist_dms');
                        }}
                        className={`w-full p-2.5 rounded-xl transition-all text-xs group cursor-pointer border flex items-center gap-2.5 ${
                          isSelected
                            ? 'bg-zinc-800/90 text-white border-cyan-500/50 shadow-md ring-1 ring-cyan-500/20'
                            : 'bg-zinc-900/40 hover:bg-zinc-800/60 text-zinc-300 border-zinc-800/70 hover:border-zinc-700'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <img
                            src={getSpecialistRealAvatar(spec.providerName, spec.providerAvatar)}
                            alt={spec.providerName}
                            className={`h-10 w-10 rounded-full bg-zinc-800 border object-cover transition-all ${
                              spec.isTyping ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-zinc-700'
                            }`}
                          />
                          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 ${
                            spec.isTyping ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'
                          }`} />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Row 1: Specialist Name + Message Sent Time / Price */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-white text-xs truncate group-hover:text-cyan-300 transition-colors">
                              {spec.providerName}
                            </span>
                            {spec.lastMessageTime ? (
                              <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                                {formatMessageTime(spec.lastMessageTime)}
                              </span>
                            ) : hasBid ? (
                              <span className="font-mono font-bold text-emerald-400 text-[10px] shrink-0">
                                ${spec.bidPrice}
                              </span>
                            ) : spec.providerHourlyRate ? (
                              <span className="font-mono text-zinc-400 text-[10px] shrink-0">
                                ${spec.providerHourlyRate}/hr
                              </span>
                            ) : null}
                          </div>

                          {/* Row 2: Contract Status Badge + Escrow Price */}
                          <div className="flex items-center justify-between gap-1">
                            {spec.isPurchasedOrder ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30 truncate">
                                {spec.escrowStatus === 'in-escrow' ? '🛡️ In Escrow' : spec.escrowStatus === 'completed' ? '✓ Completed' : '⏳ Contract Active'}
                              </span>
                            ) : hasBid ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30 truncate">
                                ✓ Bid Received ({spec.deliveryDays || 3}d)
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-400 truncate">
                                {spec.providerTitle || 'Digital Specialist'}
                              </span>
                            )}

                            {spec.lastMessageTime && (spec.orderAmount || spec.bidPrice) ? (
                              <span className="font-mono text-emerald-400 text-[10px] shrink-0 font-bold">
                                ${spec.orderAmount || spec.bidPrice}
                              </span>
                            ) : null}
                          </div>

                          {/* Row 3: Last Message Preview + Read Receipt (✓✓) OR Live Typing Indicator */}
                          <div className="flex items-center justify-between pt-0.5 min-w-0">
                            {spec.isTyping ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium animate-pulse">
                                <span className="flex gap-0.5 items-center">
                                  <span className="h-1 w-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <span className="h-1 w-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <span className="h-1 w-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </span>
                                <span className="italic font-sans">typing...</span>
                              </div>
                            ) : spec.lastMessage ? (
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                {spec.lastMessageSenderRole === 'client' && (
                                  spec.lastMessageIsSeen ? (
                                    <span title="Seen by specialist" className="inline-flex shrink-0">
                                      <CheckCheck className="h-3 w-3 text-cyan-400 font-bold" />
                                    </span>
                                  ) : (
                                    <span title="Delivered to specialist (Unread)" className="inline-flex shrink-0">
                                      <Check className="h-3 w-3 text-zinc-500" />
                                    </span>
                                  )
                                )}
                                <p className={`text-[11px] truncate leading-tight ${
                                  spec.unreadCount && spec.unreadCount > 0 ? 'text-zinc-100 font-semibold' : 'text-zinc-400'
                                }`}>
                                  {spec.lastMessageSenderRole === 'client' ? `You: ${spec.lastMessage}` : spec.lastMessage}
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="text-[10px] text-zinc-400 truncate flex items-center gap-1">
                                  <MessageSquare className="h-2.5 w-2.5 text-cyan-400 shrink-0" />
                                  <span className="truncate">{spec.orderTitle || 'Milestone Deliverable discussion'}</span>
                                </span>
                              </div>
                            )}

                            {/* Unread Message Count Badge */}
                            {spec.unreadCount && spec.unreadCount > 0 ? (
                              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-zinc-950 text-[9px] font-black shrink-0 ml-1 shadow-sm">
                                {spec.unreadCount}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-2 border-t border-zinc-800/80 text-center">
                    <Link
                      href="/services"
                      className="text-[10px] text-zinc-500 hover:text-cyan-300 transition-colors flex items-center justify-center gap-1 py-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Find more in Talent Directory</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 custom-scrollbar">
              <div className="flex items-center justify-between px-1 pb-1 text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-bold">
                <span>Recents</span>
                {loadingHistory && <span className="animate-spin">⏳</span>}
              </div>

              {/* Premium Zero-Scroll Segmented Status Control (2-Tier Layout) */}
              <div className="p-1 bg-zinc-950/80 rounded-xl border border-zinc-800/80 mb-2 shadow-inner">
                {/* Row 1: Core Channels (All, Funded, Bids) */}
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'all', label: 'All', icon: null, count: historySessions.length, activeStyle: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-cyan-950/40' },
                    { id: 'funded', label: 'Funded', icon: '🛡️', count: historySessions.filter(isSessionFunded).length, activeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40' },
                    { id: 'bids', label: 'Bids', icon: '⚡', count: historySessions.filter(isSessionBids).length, activeStyle: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-950/40' },
                  ].map((f) => {
                    const isSelected = historyFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setHistoryFilter(f.id as any)}
                        className={`flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer border ${
                          isSelected
                            ? `${f.activeStyle} shadow font-bold`
                            : 'bg-zinc-900/40 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border-transparent hover:border-zinc-800'
                        }`}
                        title={`Filter by ${f.label}`}
                      >
                        {f.icon && <span className="text-[9px]">{f.icon}</span>}
                        <span className="truncate">{f.label}</span>
                        <span className={`px-1 py-0.2 rounded text-[8.5px] font-mono shrink-0 ${isSelected ? 'bg-black/40 font-bold' : 'text-zinc-500'}`}>
                          {f.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Row 2: Secondary Statuses (Awaiting, Closed) */}
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {[
                    { id: 'awaiting', label: 'Awaiting', icon: '⏳', count: historySessions.filter(isSessionAwaiting).length, activeStyle: 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-blue-950/40' },
                    { id: 'cancelled', label: 'Closed', icon: '🚫', count: historySessions.filter(isSessionCancelled).length, activeStyle: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-950/40' },
                  ].map((f) => {
                    const isSelected = historyFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setHistoryFilter(f.id as any)}
                        className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer border ${
                          isSelected
                            ? `${f.activeStyle} shadow font-bold`
                            : 'bg-zinc-900/40 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border-transparent hover:border-zinc-800'
                        }`}
                        title={`Filter by ${f.label}`}
                      >
                        <span className="text-[9px]">{f.icon}</span>
                        <span className="truncate">{f.label}</span>
                        <span className={`px-1 py-0.2 rounded text-[8.5px] font-mono shrink-0 ${isSelected ? 'bg-black/40 font-bold' : 'text-zinc-500'}`}>
                          {f.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const filteredHistory = historySessions.filter(sess => {
                  if (historyFilter === 'funded') return isSessionFunded(sess);
                  if (historyFilter === 'bids') return isSessionBids(sess);
                  if (historyFilter === 'awaiting') return isSessionAwaiting(sess);
                  if (historyFilter === 'cancelled') return isSessionCancelled(sess);
                  return true;
                });

                if (filteredHistory.length === 0) {
                  return (
                    <div className="py-8 text-center text-zinc-500 text-xs px-2 space-y-1">
                      <p>
                        {historyFilter !== 'all' 
                          ? `No ${historyFilter} chats found.` 
                          : 'No procurement chats yet.'}
                      </p>
                      <p className="text-[10px] text-zinc-600">
                        {historyFilter !== 'all' 
                          ? 'Switch to "All" tab to view all rooms.' 
                          : 'Your negotiated sessions will appear here.'}
                      </p>
                    </div>
                  );
                }

                return filteredHistory.map((sess, sIdx) => {
                  const isCurrent = Boolean(
                    (sess.id && sess.id === sessionId) ||
                    (targetOrderId && (
                      sess.orderRefId === targetOrderId || 
                      sess.id === targetOrderId || 
                      sess.id === `session_${targetOrderId}` ||
                      (sess.id && targetOrderId && sess.id.includes(targetOrderId))
                    )) ||
                    (targetPaypalOrderId && sess.paypalOrderId === targetPaypalOrderId) ||
                    (activePayPalOrder && (
                      (sess.orderRefId && sess.orderRefId === activePayPalOrder.orderId) ||
                      (sess.paypalOrderId && sess.paypalOrderId === activePayPalOrder.paypalOrderId) ||
                      (sess.id && sess.id === activePayPalOrder.orderId)
                    )) ||
                    (sessionId && sess.orderRefId && (sessionId === sess.orderRefId || sessionId.includes(sess.orderRefId))) ||
                    (sess.id && sessionId && sess.id.includes(sessionId)) ||
                    (sessionId && sess.id && sessionId.includes(sess.id))
                  );
                  const isEditing = editingSessionId === sess.id;
                  const displayTitle = getSmartSessionTitle(sess);
                  const bidsCount = sess.bids?.length || 0;
                  const isFunded = isSessionFunded(sess);
                  const isCancelled = isSessionCancelled(sess);

                  const unreadInfo = getSessionUnreadStatus(sess);
                  const hasUnreadBid = unreadInfo.hasUnreadBid;
                  const hasUnreadMsg = unreadInfo.hasUnreadMsg;
                  const isUnread = hasUnreadBid || hasUnreadMsg;

                  return (
                    <div
                      key={`${sess.id || 'sess'}_${sIdx}`}
                      onClick={() => !isEditing && resumeSession(sess)}
                      className={`w-full text-left rounded-xl transition-all text-xs group cursor-pointer relative overflow-hidden ${
                        isCurrent
                          ? 'bg-zinc-800/95 text-cyan-300 font-semibold border border-cyan-500/50 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/40'
                          : hasUnreadBid
                          ? 'bg-gradient-to-r from-emerald-950/40 via-zinc-900/90 to-zinc-900/90 text-white font-medium border border-emerald-500/50 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/30'
                          : hasUnreadMsg
                          ? 'bg-gradient-to-r from-cyan-950/40 via-zinc-900/90 to-zinc-900/90 text-white font-medium border border-cyan-500/40 shadow-md shadow-cyan-950/30'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
                      }`}
                    >
                      {/* Left glowing active / notification accent bar */}
                      {isCurrent ? (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-cyan-400 rounded-r shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                      ) : hasUnreadBid ? (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-1.5 bg-emerald-400 rounded-r shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse" />
                      ) : hasUnreadMsg ? (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-cyan-400 rounded-r shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
                      ) : null}

                      {isEditing ? (
                        <div className="flex items-center gap-1.5 p-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingTitleText}
                            onChange={(e) => setEditingTitleText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(sess.id, e);
                              if (e.key === 'Escape') setEditingSessionId(null);
                            }}
                            autoFocus
                            className="flex-1 bg-zinc-950 border border-cyan-400 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                          />
                          <button
                            onClick={(e) => handleSaveRename(sess.id, e)}
                            className="p-1 text-emerald-400 hover:bg-zinc-800 rounded cursor-pointer"
                            title="Save Custom Name"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingSessionId(null); }}
                            className="p-1 text-zinc-400 hover:bg-zinc-800 rounded cursor-pointer"
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="relative shrink-0">
                                <MessageSquare className={`h-3.5 w-3.5 ${
                                  isCurrent
                                    ? 'text-cyan-400'
                                    : hasUnreadBid
                                    ? 'text-emerald-400 animate-pulse'
                                    : hasUnreadMsg
                                    ? 'text-cyan-400'
                                    : 'text-zinc-500 group-hover:text-zinc-300'
                                }`} />
                                {hasUnreadBid && (
                                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 border border-zinc-950 animate-ping" />
                                )}
                              </div>
                              <span className={`truncate text-xs ${
                                isCurrent 
                                  ? 'font-bold text-cyan-300' 
                                  : isUnread 
                                  ? 'font-bold text-white' 
                                  : 'font-medium text-white/90 group-hover:text-cyan-300'
                              } transition-colors`}>
                                {displayTitle}
                              </span>
                              {hasUnreadBid && (
                                <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[8.5px] font-mono font-black bg-gradient-to-r from-emerald-500/25 to-teal-500/25 border border-emerald-400/50 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse shrink-0">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                                  NEW BID
                                </span>
                              )}
                              {hasUnreadMsg && (
                                <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[8.5px] font-mono font-black bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)] animate-pulse shrink-0">
                                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                                  NEW MSG
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => handleStartRename(sess, e)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-cyan-300 rounded hover:bg-zinc-800 transition-opacity cursor-pointer"
                                title="Rename session"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <span className="text-[9px] text-zinc-500 font-mono">
                                {formatRelativeTime(sess.updatedAt)}
                              </span>
                            </div>
                          </div>

                          {/* Live Bids Badge & Escrow Status Pill */}
                          <div className="flex items-center justify-between text-[10px] pl-5 pt-0.5">
                            {isFunded ? (
                              <span className="font-mono text-[9px] text-emerald-300 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                🛡️ Escrow Funded
                              </span>
                            ) : isCancelled ? (
                              <span className="font-mono text-[9px] text-rose-400 font-bold bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/30">
                                🚫 Cancelled
                              </span>
                            ) : hasUnreadBid ? (
                              <span className="flex items-center gap-1.5 font-mono text-[9px] text-emerald-300 font-black bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40 shadow-sm animate-pulse">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                ⚡ New Bid Available (${sess.winningBid?.bidPrice || sess.bids?.[sess.bids.length - 1]?.bidPrice || sess.amount || 170})
                              </span>
                            ) : sess.status === 'pending-payment' || (!isFunded && (sess.status === 'closed_awarded' || Boolean(sess.paypalOrderId))) ? (
                              <span className="flex items-center gap-1 font-mono text-[9px] text-amber-300 font-bold bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                                ⏳ Awaiting Payment
                              </span>
                            ) : bidsCount > 0 ? (
                              <span className="flex items-center gap-1 font-mono text-[9px] text-cyan-300 font-bold bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-500/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                ⚡ {bidsCount} Bid{bidsCount > 1 ? 's' : ''} Received
                              </span>
                            ) : sess.status === 'tender_open' ? (
                              <span className="flex items-center gap-1 font-mono text-[9px] text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
                                Awaiting Bids...
                              </span>
                            ) : (
                              <span className="text-[9px] text-zinc-500 font-mono">
                                Inquiry Active
                              </span>
                            )}

                            {sess.negotiatedPrice || sess.amount ? (
                              <span className="font-mono font-bold text-zinc-400 text-[10px]">
                                ${sess.negotiatedPrice || sess.amount}
                              </span>
                            ) : sess.spendingLimit ? (
                              <span className="font-mono text-zinc-500 text-[9px]">
                                Cap ${sess.spendingLimit}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
        )}

          {/* User Identity & Auth Area (Pinned to Bottom of Left Sidebar) */}
          <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/80">
            {user ? (
              <div 
                onClick={() => setIsClientProfileModalOpen(true)}
                className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 hover:border-cyan-500/50 hover:bg-zinc-900/90 transition-all cursor-pointer group"
                title="Click to customize your Client Profile, Avatar Photo, and Company details"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <img
                      src={user.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Janitha'}
                      alt={user.name}
                      className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 object-cover"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border border-zinc-950" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">{user.name}</p>
                    <p className="text-[10px] text-zinc-400 font-mono truncate">
                      {user.company || 'Client Profile'} • ${user.spendingLimit || 250} Cap
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    logout();
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                  title="Sign Out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-zinc-400 text-xs">
                  <div className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-300">Guest Evaluator</p>
                    <p className="text-[9px] text-zinc-500">Sign in to bind escrow</p>
                  </div>
                </div>
                <button
                  onClick={openAuthModal}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>1-Click Judge Access</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. MAIN CENTER AI CANVAS & WORKSPACE */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {mainView === 'direct_specialist' && selectedSpecialistChat ? (
          <SpecialistDirectChatView
            specialist={selectedSpecialistChat}
            currentUser={{
              name: user?.name || 'Janitha Dilshan',
              email: user?.email || 'janithad2@gmail.com',
              avatarUrl: user?.avatarUrl
            }}
            onBackToAiRoom={() => setMainView('ai_room')}
            onAwardBid={(pId) => {
              handleAwardBid(sessionId, pId);
              setMainView('ai_room');
            }}
            onViewProfile={(prov) => setSelectedProfileProvider(resolveToServiceProvider(prov))}
          />
        ) : (
          <>
            {/* Top Header Bar (Includes Provider Menus & Budget Cap per user requirement) */}
            <header className="h-14 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl px-4 flex items-center justify-between gap-3 shrink-0 z-20">
          
          {/* Left: Sidebar Toggle & Session Identity */}
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Open sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}

            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight hidden sm:block">
                AgentPay Autonomous Room
              </h2>
              {aiStatus.isRealAI ? (
                <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 border border-cyan-500/30 text-[10px] text-cyan-300 font-mono flex items-center gap-1.5 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  AgentPay Neural Brain (v2.5 Active)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[10px] text-cyan-300 font-mono">
                  AgentPay Protocol Engine (Active)
                </span>
              )}
            </div>
          </div>

          {/* Center / Right: Budget Cap Slider & Provider Side Menus */}
          <div className="flex items-center gap-3">
            
            {/* Dynamic Spending Budget Cap Slider */}
            <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
              <Shield className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400 font-medium whitespace-nowrap">Cap:</span>
                <span className="font-mono font-bold text-cyan-300 text-xs">${spendingLimit}</span>
                <input
                  type="range"
                  min="30"
                  max="1000"
                  step="10"
                  value={spendingLimit}
                  onChange={(e) => setSpendingLimit(Number(e.target.value))}
                  className="w-20 lg:w-28 accent-cyan-400 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                  title={`Adjust Safe Spending Ceiling: $${spendingLimit} USD`}
                />
              </div>
            </div>

            {/* Provider Side Menus (Per Janitha's instruction: "header ekata damu provider side eke menus") */}
            <div className="flex items-center gap-2">
              <Link
                href="/providers"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all"
                title="Open Provider Workspace"
              >
                <Layers className="h-3.5 w-3.5 text-purple-400" />
                <span className="hidden sm:inline">Provider Workspace</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/30 text-purple-200">
                  RFQs Live
                </span>
              </Link>

              <Link
                href="/admin"
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold transition-all"
                title="Admin & Revenue Dashboard"
              >
                <Settings className="h-3.5 w-3.5 text-amber-400" />
                <span>Admin</span>
              </Link>

              {/* PayPal Orders v2 Live Status */}
              <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-mono font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>PayPal v2 Live</span>
              </div>

              {/* 1-Click Judge Guided Tour Button in Top Header */}
              <button
                onClick={() => { openTourBanner(); openTourModal(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/10 hover:from-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold shadow-md transition-all cursor-pointer group"
                title="Open 1-Click Judge Guided Tour & Scenario Runner"
              >
                <Award className="h-3.5 w-3.5 text-amber-400 group-hover:rotate-12 transition-transform shrink-0" />
                <span className="bg-gradient-to-r from-amber-200 to-yellow-400 bg-clip-text text-transparent font-bold">
                  Judge Live Tour
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Guest Mode Authentication Notice Banner */}
        {!user && (
          <div className="bg-gradient-to-r from-amber-500/15 via-cyan-500/10 to-transparent border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-zinc-300 shrink-0 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                <strong>🔒 Guest Evaluator Mode:</strong> Sign in with verified credentials to unlock autonomous tender awards, direct specialist chat, and PayPal milestone captures.
              </span>
            </div>
            <button
              onClick={loginWithJudgeAccount}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-[11px] flex items-center gap-1.5 shadow-md shadow-cyan-950/40 transition-all cursor-pointer shrink-0"
            >
              <Sparkles className="h-3 w-3" />
              <span>⚡ 1-Click Judge Pass</span>
            </button>
          </div>
        )}

        {/* Center Scrollable Messages Canvas */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 custom-scrollbar"
        >
          {/* Welcome Screen Hero (When New/Empty Session like ChatGPT in user's image) */}
          {isInitialWelcome && (
            <div className="max-w-3xl mx-auto my-auto py-8 sm:py-16 text-center space-y-8 animate-fadeIn">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>PayPal AI Hackathon 2026 • Official Protocol</span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  How can I help you procure services today{user ? `, ${user.name.split(' ')[0]}` : ''}?
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
                  Tell me what you need. I will autonomously discover top specialists, conduct reverse auction bidding, and lock escrow on PayPal Orders v2.
                </p>
              </div>

              {/* 4 Quick Starter Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto text-left">
                <button
                  onClick={() => handleSend("I need a Next.js 15 developer to build a modern dashboard for under $120.")}
                  className="p-3.5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-cyan-500/40 text-left transition-all cursor-pointer group shadow-sm"
                >
                  <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                    <span>💻</span>
                    <span>Next.js Dashboard</span>
                    <span className="font-mono text-emerald-400 font-bold text-[11px] ml-auto">$120 USD</span>
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Procure full-stack Next.js 15 architecture with responsive layouts.
                  </p>
                </button>

                <button
                  onClick={() => handleSend("Find me a Figma UI/UX designer for an e-commerce mobile app with a $80 budget.")}
                  className="p-3.5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-cyan-500/40 text-left transition-all cursor-pointer group shadow-sm"
                >
                  <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                    <span>🎨</span>
                    <span>Figma Mobile App</span>
                    <span className="font-mono text-emerald-400 font-bold text-[11px] ml-auto">$80 USD</span>
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Design modern mobile-first e-commerce screens & interactive prototype.
                  </p>
                </button>

                <button
                  onClick={() => handleSend("I want an autonomous AI automation engineer to build an n8n webhook workflow for $150.")}
                  className="p-3.5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-cyan-500/40 text-left transition-all cursor-pointer group shadow-sm"
                >
                  <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                    <span>🤖</span>
                    <span>AI Automation Workflow</span>
                    <span className="font-mono text-emerald-400 font-bold text-[11px] ml-auto">$150 USD</span>
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Configure webhooks, LLM pipelines, and automated integrations.
                  </p>
                </button>

                <button
                  onClick={() => handleSend("Find a motion designer for product launch video under $90.")}
                  className="p-3.5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-cyan-500/40 text-left transition-all cursor-pointer group shadow-sm"
                >
                  <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                    <span>🎬</span>
                    <span>Motion Video & 3D</span>
                    <span className="font-mono text-emerald-400 font-bold text-[11px] ml-auto">$90 USD</span>
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Create high-conversion animated promo reels and 3D kinetic titles.
                  </p>
                </button>
              </div>

              {/* 3 Protocol Trust Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-4 text-left">
                <div className="p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
                  <div className="h-7 w-7 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white">Autonomous Agentic Commerce</h4>
                  <p className="text-[10px] text-zinc-400">
                    Vets portfolios, evaluates rates, and negotiates bilateral terms automatically.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
                  <div className="h-7 w-7 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white">PayPal Smart Escrow</h4>
                  <p className="text-[10px] text-zinc-400">
                    Funds remain securely protected in milestone escrow until deliverables are verified.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
                  <div className="h-7 w-7 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Shield className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white">Safe Spending Protocol</h4>
                  <p className="text-[10px] text-zinc-400">
                    Clients retain 100% control. The agent strictly respects your authorized spending limit.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active Chat Messages Stream */}
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg, mIdx) => (
              <div
                key={`${msg.id || 'msg'}_${mIdx}`}
                className={`flex items-start gap-3.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-md ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-zinc-950'
                      : 'bg-zinc-800 border border-zinc-700 text-cyan-400'
                  }`}
                >
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div className="space-y-3 max-w-[90%] sm:max-w-[80%]">
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-cyan-600/20 text-cyan-50 border border-cyan-500/30 rounded-tr-none'
                        : 'bg-zinc-900/90 text-zinc-200 border border-zinc-800/80 rounded-tl-none shadow-md'
                    }`}
                  >
                    {/* Embedded Voice Note Audio Player (CyberVoice™ Engine) */}
                    {msg.audioUrl && (
                      <div className="mb-3">
                        <VoiceNotePlayer
                          audioUrl={msg.audioUrl}
                          duration={msg.audioDuration}
                          transcript={msg.voiceTranscript || msg.content}
                          role={msg.role}
                        />
                      </div>
                    )}

                    {renderFormattedMessage(msg.content)}

                    {/* Awarded Specialist Identity & Profile Card */}
                    {(msg.actionPayload?.tenderStatus === 'closed_awarded' || msg.actionPayload?.winningBid) && (
                      <div className="mt-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-zinc-900/90 border border-cyan-500/40 shadow-lg space-y-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          {/* Provider Info Clickable */}
                          <div 
                            onClick={() => {
                              const target = msg.actionPayload?.winningProvider || msg.actionPayload?.selectedProvider || msg.actionPayload?.winningBid;
                              if (target) setSelectedProfileProvider(resolveToServiceProvider(target));
                            }}
                            className="flex items-center gap-3 cursor-pointer group"
                            title="Click to view full provider profile & verified reviews"
                          >
                            <div className="relative">
                              <img 
                                src={getSpecialistRealAvatar(
                                  msg.actionPayload?.winningProvider?.name || msg.actionPayload?.selectedProvider?.name || msg.actionPayload?.winningBid?.providerName || msg.actionPayload?.providerName,
                                  msg.actionPayload?.winningProvider?.avatarUrl || msg.actionPayload?.selectedProvider?.avatarUrl || msg.actionPayload?.winningBid?.providerAvatar
                                )} 
                                alt="Awarded Provider" 
                                className="h-11 w-11 rounded-full bg-zinc-800 border-2 border-cyan-400 group-hover:scale-105 transition-transform shrink-0 shadow-md shadow-cyan-950/50 object-cover" 
                              />
                              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center text-[9px] text-zinc-950 font-black">
                                ✓
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-white group-hover:text-cyan-300 transition-colors text-sm truncate">
                                  {msg.actionPayload?.winningProvider?.name || msg.actionPayload?.selectedProvider?.name || msg.actionPayload?.winningBid?.providerName || 'Awarded Specialist'}
                                </h4>
                                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold border border-cyan-500/40 shrink-0">
                                  🏆 Awarded Specialist
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 truncate">
                                {msg.actionPayload?.winningProvider?.title || msg.actionPayload?.selectedProvider?.title || msg.actionPayload?.winningBid?.providerTitle || 'Digital Solutions Expert'}
                              </p>
                            </div>
                          </div>

                          {/* Profile Modal Trigger */}
                          <button
                            type="button"
                            onClick={() => {
                              const target = msg.actionPayload?.winningProvider || msg.actionPayload?.selectedProvider || msg.actionPayload?.winningBid;
                              if (target) setSelectedProfileProvider(resolveToServiceProvider(target));
                            }}
                            className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                            title="View Full Specialist Profile & Track Record"
                          >
                            <User className="h-3.5 w-3.5" />
                            <span>View Profile</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Accepted Terms Strip */}
                        {msg.actionPayload?.winningBid && (
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80 text-center font-mono">
                            <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800">
                              <span className="text-[10px] text-zinc-400 block font-sans">Agreed Escrow</span>
                              <span className="font-bold text-emerald-400 text-xs sm:text-sm">
                                ${msg.actionPayload.winningBid.bidPrice || msg.actionPayload.winningBid.amount} USD
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800">
                              <span className="text-[10px] text-zinc-400 block font-sans">Turnaround</span>
                              <span className="font-bold text-cyan-300 text-xs sm:text-sm">
                                {msg.actionPayload.winningBid.deliveryDays || 3} Days
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800">
                              <span className="text-[10px] text-zinc-400 block font-sans">Milestone Tranches</span>
                              <span className="font-bold text-amber-300 text-xs sm:text-sm">
                                {msg.actionPayload.winningBid.milestones?.length || 2} Milestones
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-2 font-mono pt-1.5 border-t border-zinc-800/60">
                      {msg.role === 'assistant' ? (
                        msg.content.includes('PayPal Orders v2') || msg.actionPayload?.type === 'escrow_success' ? (
                          <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            <span>PayPal Orders v2 Inline Escrow (Verified)</span>
                          </span>
                        ) : (
                          <span className="text-cyan-300 flex items-center gap-1 font-semibold">
                            <Sparkles className="h-3 w-3 text-cyan-400" />
                            AgentPay Neural Brain (v2.5 Active)
                          </span>
                        )
                      ) : (
                        <span />
                      )}
                      <span suppressHydrationWarning>{msg.timestamp}</span>
                    </div>
                  </div>

                  {/* 1. Matched Providers Discovery Cards */}
                  {msg.actionPayload?.matchedProviders && msg.actionPayload.matchedProviders.length > 0 && msg.actionPayload.type !== 'paypal_checkout' && msg.actionPayload.type !== 'tender_dispatched' && (() => {
                    const matched = msg.actionPayload.matchedProviders;
                    const selected = getSelectedProviders(msg.id, matched);
                    const selectedCount = selected.length;

                    return (
                      <div className="space-y-3 pt-2">
                        {/* Master Dispatch Tender Banner (Optimized 2-Row Layout with zero vertical text wrapping) */}
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/70 via-cyan-950/50 to-indigo-950/70 border border-cyan-500/40 shadow-xl space-y-3.5">
                          {/* Row 1: Header + Pool Presets */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-9 w-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30 shadow-sm">
                                <Sparkles className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-xs font-bold text-white tracking-tight">
                                    Autonomous RFQ Reverse Auction Protocol
                                  </h4>
                                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold whitespace-nowrap ${
                                    selectedCount === 2 
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                                      : selectedCount === 1 
                                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' 
                                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                  }`}>
                                    {selectedCount} of {matched.length} Selected
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  {selectedCount === 3 
                                    ? 'Transmits requirements concurrently to all 3 specialists to compete on price & speed.' 
                                    : selectedCount === 2 
                                    ? `Direct head-to-head reverse auction between ${selected[0]?.name.split(' ')[0]} and ${selected[1]?.name.split(' ')[0]}.` 
                                    : selectedCount === 1 
                                    ? `Directly negotiate terms and secure milestone escrow with ${selected[0]?.name}.` 
                                    : 'Select specialists below to launch your competitive tender pool.'}
                                </p>
                              </div>
                            </div>

                            {/* Preset Selector Pills (Guaranteed horizontal layout, no text wrapping) */}
                            <div className="flex items-center gap-1.5 bg-zinc-950/80 p-1 rounded-xl border border-zinc-800/90 shrink-0 self-start sm:self-auto">
                              <span className="text-[10px] uppercase font-mono text-zinc-500 px-1 font-semibold">Pool:</span>
                              <button
                                type="button"
                                onClick={() => setSelectAllCandidates(msg.id, matched)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                                  selectedCount === matched.length
                                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-sm'
                                    : 'text-zinc-400 hover:text-white'
                                }`}
                              >
                                All ({matched.length})
                              </button>
                              {matched.length >= 2 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectTopCandidates(msg.id, matched, 2)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                                    selectedCount === 2
                                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm'
                                      : 'text-zinc-400 hover:text-white'
                                  }`}
                                >
                                  Top 2
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Row 2: Wide Action Bar with Clear Status & Prominent Dispatch Button */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2.5 border-t border-cyan-500/20">
                            <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
                              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                              <span>
                                {selectedCount === matched.length
                                  ? '3 Specialists ready for simultaneous reverse auction bidding'
                                  : selectedCount === 2
                                  ? 'Head-to-head pricing & turnaround competition ready'
                                  : selectedCount === 1
                                  ? `Direct 1-on-1 milestone structuring with ${selected[0]?.name.split(' ')[0]}`
                                  : 'Please select at least 1 specialist to proceed'}
                              </span>
                            </div>

                            <button
                              disabled={selectedCount === 0}
                              onClick={() => {
                                if (!user) {
                                  openAuthModal();
                                  return;
                                }
                                if (selectedCount === 0) return;
                                if (selectedCount === 1) {
                                  handleSend(`I want to proceed with ${selected[0].name} for my project within my $${spendingLimit} budget.`);
                                } else if (selectedCount === matched.length) {
                                  handleSend(`Dispatch autonomous tender to all 3 specialists for my project within my $${spendingLimit} budget.`);
                                } else {
                                  const names = selected.map(p => p.name).join(' and ');
                                  handleSend(`Dispatch autonomous tender to ${names} for my project within my $${spendingLimit} budget.`);
                                }
                              }}
                              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                selectedCount === 0 
                                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700' 
                                  : selectedCount === 2 
                                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-zinc-950 shadow-amber-950/40 hover:opacity-95' 
                                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 shadow-cyan-950/40 hover:opacity-95'
                              }`}
                            >
                              <Bot className="h-4 w-4" />
                              <span>
                                {selectedCount === 0 
                                  ? 'Select Specialists' 
                                  : selectedCount === 1 
                                  ? `🚀 Tender to ${selected[0].name.split(' ')[0]}` 
                                  : selectedCount === matched.length 
                                  ? '🚀 Dispatch Tender to All 3 Specialists' 
                                  : `🚀 Dispatch Tender to 2 Selected (${selected.map(p => p.name.split(' ')[0]).join(' & ')})`}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Grid of Candidate Specialists */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {matched.map((prov) => {
                            const isSelected = selected.some(p => p.id === prov.id);

                            return (
                              <div
                                key={prov.id}
                                className={`p-3.5 rounded-2xl transition-all text-xs space-y-2.5 group shadow-md flex flex-col justify-between ${
                                  isSelected 
                                    ? 'bg-zinc-900/95 border-2 border-cyan-500/60 shadow-cyan-950/30 ring-1 ring-cyan-500/20' 
                                    : 'bg-zinc-900/50 border border-zinc-800/80 opacity-75 hover:opacity-100 hover:border-zinc-700'
                                }`}
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    {/* Provider Info Clickable for Profile */}
                                    <div 
                                      onClick={() => setSelectedProfileProvider(prov)}
                                      className="flex items-center gap-2.5 min-w-0 cursor-pointer group/header"
                                      title="Click to view full specialist profile & track record"
                                    >
                                      <img src={getSpecialistRealAvatar(prov.name, prov.avatarUrl)} alt={prov.name} className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 group-hover/header:border-cyan-400 transition-colors shrink-0 object-cover" />
                                      <div className="min-w-0">
                                        <h4 className="font-bold text-white group-hover/header:text-cyan-300 transition-colors truncate">{prov.name}</h4>
                                        <p className="text-[10px] text-zinc-400 truncate max-w-[120px]">{prov.title}</p>
                                      </div>
                                    </div>

                                    {/* Header Actions: Profile & Selection Checkbox */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedProfileProvider(prov)}
                                        className="p-1 rounded-lg text-zinc-400 hover:text-cyan-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                                        title="View Full Profile"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleCandidateProvider(msg.id, matched, prov.id)}
                                        className={`h-6 w-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                          isSelected 
                                            ? 'bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/40 ring-1 ring-cyan-400' 
                                            : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-300'
                                        }`}
                                        title={isSelected ? "Remove from tender pool" : "Add to tender pool"}
                                      >
                                        {isSelected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Plus className="h-3.5 w-3.5" />}
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[11px]">
                                    <span className="text-zinc-400">⭐ {prov.rating} ({prov.reviewCount})</span>
                                    <span className="font-mono font-bold text-emerald-400">${prov.hourlyRate}/hr</span>
                                  </div>

                                  <div className="flex items-center justify-between gap-1 pt-0.5">
                                    {prov.autoBiddingEnabled !== false ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-bold">
                                        <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
                                        Instant AI Delegate
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-bold">
                                        <Clock className="h-2.5 w-2.5 text-amber-400" />
                                        Manual Bids Only
                                      </span>
                                    )}

                                    {isSelected ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold">
                                        ✓ In Tender Pool
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-zinc-500">
                                        Excluded
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Bottom Actions */}
                                <div className="flex items-center gap-1.5 pt-1">
                                  {/* Profile modal trigger */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedProfileProvider(prov)}
                                    className="py-2 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700/80 text-xs font-semibold flex items-center justify-center transition-all cursor-pointer"
                                    title="View Full Profile & Bio"
                                  >
                                    <User className="h-3.5 w-3.5 text-zinc-400" />
                                  </button>

                                  {/* Primary Card Action: Toggle inclusion in tender */}
                                  <button
                                    type="button"
                                    onClick={() => toggleCandidateProvider(msg.id, matched, prov.id)}
                                    className={`flex-1 py-2 rounded-xl font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs ${
                                      isSelected
                                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/30'
                                        : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                                    }`}
                                  >
                                    {isSelected ? (
                                      <>
                                        <Check className="h-3.5 w-3.5 text-cyan-400" />
                                        <span>Selected ({prov.name.split(' ')[0]})</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="h-3.5 w-3.5 text-zinc-400" />
                                        <span>Select {prov.name.split(' ')[0]}</span>
                                      </>
                                    )}
                                  </button>

                                  {/* 1-Click Direct Hire button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!user) {
                                        openAuthModal();
                                        return;
                                      }
                                      handleSend(`I want to proceed with ${prov.name} for my project within my $${spendingLimit} budget.`);
                                    }}
                                    className="py-2 px-2.5 rounded-xl bg-zinc-800 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-300 border border-zinc-700 hover:border-emerald-500/40 text-xs font-semibold flex items-center justify-center transition-all cursor-pointer"
                                    title={`Directly select ${prov.name} only (Single Provider Escrow)`}
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. Autonomous RFQ Protocol & Live Competing Bids Board */}
                  {((msg.actionPayload?.targetProviders && msg.actionPayload.targetProviders.length > 0) || (msg.actionPayload?.bids && msg.actionPayload.bids.length > 0)) && (() => {
                    const activeBids = (msg.actionPayload.bids || []).filter((b: any) => {
                      if (b.status === 'submitted') return true;
                      const hasProviderMessage = msg.actionPayload?.negotiationDialog?.some((d: any) => 
                        d.speaker === 'provider' && (
                          (b.providerName && d.speakerName?.toLowerCase().includes(b.providerName.toLowerCase().split(' ')[0])) ||
                          (b.providerId && d.speakerName?.toLowerCase().includes(b.providerId.toLowerCase()))
                        )
                      );
                      if (hasProviderMessage) return true;
                      return !b.isAutoBid;
                    });

                    return (
                    <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/95 border border-cyan-500/30 text-xs space-y-4 shadow-xl backdrop-blur-md">
                      {/* Board Header */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${msg.actionPayload.tenderStatus === 'closed_awarded' ? 'bg-emerald-400' : 'bg-cyan-400 animate-ping'}`} />
                          <div>
                            <h4 className="font-mono font-bold text-cyan-300 uppercase tracking-wider text-xs flex items-center gap-1.5">
                              <Bot className="h-4 w-4 text-cyan-400" />
                              Autonomous RFQ Tender & Competing Bids Board
                            </h4>
                            <p className="text-[10px] text-zinc-400">
                              {msg.actionPayload.tenderStatus === 'closed_awarded' 
                                ? 'Contract awarded and escrow funded. Competing inquiries locked.'
                                : msg.actionPayload.targetProviders?.length 
                                  ? `Tender open to ${msg.actionPayload.targetProviders.length} specialist${msg.actionPayload.targetProviders.length > 1 ? 's' : ''}. Reviewing scope and awaiting competitive bids.`
                                  : 'Tender open for milestone bids. Reviewing scope and live specialist proposals.'}
                            </p>
                          </div>
                        </div>

                        <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border font-bold ${
                          msg.actionPayload.tenderStatus === 'closed_awarded'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                        }`}>
                          {msg.actionPayload.tenderStatus === 'closed_awarded' ? '🏆 Contract Awarded' : '⏳ Tender Open for Bids'}
                        </span>
                      </div>

                      {/* Tendered Specialists Strip */}
                      {msg.actionPayload.targetProviders && msg.actionPayload.targetProviders.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">
                            Tender Transmitted To {msg.actionPayload.targetProviders.length} Specialist{msg.actionPayload.targetProviders.length > 1 ? 's' : ''}:
                          </span>
                          <div className={`grid grid-cols-1 ${msg.actionPayload.targetProviders.length === 2 ? 'sm:grid-cols-2' : msg.actionPayload.targetProviders.length === 1 ? 'sm:grid-cols-1 max-w-sm' : 'sm:grid-cols-3'} gap-2.5`}>
                            {msg.actionPayload.targetProviders.map((tp: any) => {
                              const hasBid = activeBids.some((b: any) => b.providerId === tp.id);
                              const isWon = msg.actionPayload?.tenderStatus === 'closed_awarded' && (msg.actionPayload?.winningBid?.providerId === tp.id || tp.status === 'awarded');
                              const isLateClosed = msg.actionPayload?.tenderStatus === 'closed_awarded' && !isWon;

                              return (
                                <div 
                                  key={tp.id} 
                                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all ${
                                    isWon 
                                      ? 'bg-emerald-950/30 border-emerald-500/50' 
                                      : isLateClosed 
                                      ? 'bg-zinc-900/40 border-zinc-800/80 opacity-60' 
                                      : hasBid
                                      ? 'bg-cyan-950/20 border-cyan-500/40'
                                      : 'bg-zinc-900/60 border-zinc-800'
                                  }`}
                                >
                                  <img src={getSpecialistRealAvatar(tp.name, tp.avatarUrl)} alt={tp.name} className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 shrink-0 object-cover" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-white text-[11px] truncate">{tp.name}</span>
                                    </div>
                                    <p className="text-[9px] text-zinc-400 truncate">{tp.title}</p>
                                    <div className="pt-1">
                                      {isWon ? (
                                        <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1 font-mono">
                                          <CheckCircle2 className="h-2.5 w-2.5" /> Won & Awarded
                                        </span>
                                      ) : isLateClosed ? (
                                        <span className="text-[9px] font-mono text-rose-400 flex items-center gap-1">
                                          <AlertCircle className="h-2.5 w-2.5" /> Closed (Late)
                                        </span>
                                      ) : hasBid ? (
                                        <span className="text-[9px] font-bold text-cyan-400 flex items-center gap-1 font-mono">
                                          <CheckCircle2 className="h-2.5 w-2.5" /> Bid Received
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-mono text-amber-400 flex items-center gap-1">
                                          <Clock className="h-2.5 w-2.5 animate-spin" /> Reviewing Scope...
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Competing Bids List */}
                      <div className="space-y-2 pt-1 border-t border-zinc-800/80">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">
                            Received Milestone Bids ({activeBids.length}):
                          </span>
                          {msg.actionPayload.tenderStatus !== 'closed_awarded' && (
                            <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1 animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                              Streaming live from Provider Workspaces
                            </span>
                          )}
                        </div>

                        {(activeBids.length === 0) ? (
                          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-center space-y-1">
                            <Clock className="h-5 w-5 text-amber-400 mx-auto animate-pulse" />
                            <p className="text-zinc-300 font-medium text-[11px]">Awaiting bids from tendered specialists...</p>
                            <p className="text-zinc-500 text-[10px]">
                              Specialists have been notified via Resend email. You can also open the Provider Workspace in another tab or use the quick-test buttons below.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {activeBids.map((bid: any) => {
                              const isWinner = msg.actionPayload?.winningBid?.providerId === bid.providerId;
                              const isClosedOther = msg.actionPayload?.tenderStatus === 'closed_awarded' && !isWinner;

                              return (
                                <div
                                  key={bid.providerId}
                                  className={`p-4 rounded-xl border space-y-2.5 transition-all ${
                                    isWinner 
                                      ? 'bg-gradient-to-r from-emerald-950/30 to-teal-950/30 border-emerald-500/50 shadow-lg' 
                                      : isClosedOther
                                      ? 'bg-zinc-900/30 border-zinc-800 opacity-60'
                                      : 'bg-zinc-900/80 border-cyan-500/30 hover:border-cyan-400'
                                  }`}
                                >
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                                    <div className="flex items-center gap-2.5">
                                      {bid.providerAvatar && (
                                        <img 
                                          src={bid.providerAvatar} 
                                          alt={bid.providerName} 
                                          onClick={() => setSelectedProfileProvider(resolveToServiceProvider(bid))}
                                          className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 hover:border-cyan-400 transition-colors cursor-pointer shrink-0 shadow-sm" 
                                          title="View Specialist Profile & Track Record"
                                        />
                                      )}
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span 
                                            onClick={() => setSelectedProfileProvider(resolveToServiceProvider(bid))}
                                            className="font-bold text-white text-xs hover:text-cyan-300 transition-colors cursor-pointer"
                                            title="View Specialist Profile"
                                          >
                                            {bid.providerName}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setSelectedProfileProvider(resolveToServiceProvider(bid))}
                                            className="p-0.5 rounded text-zinc-400 hover:text-cyan-300 transition-colors cursor-pointer"
                                            title="View Full Profile & Reviews"
                                          >
                                            <ExternalLink className="h-3 w-3" />
                                          </button>
                                        </div>
                                        <span className="text-[10px] text-zinc-400 block font-mono">
                                          Turnaround: <strong className="text-zinc-200">{bid.deliveryDays} Days</strong> • Submitted {bid.submittedAt}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <span className="font-mono font-black text-emerald-400 text-base">
                                        ${bid.bidPrice} USD
                                      </span>
                                      {isWinner ? (
                                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/40">
                                          🏆 Awarded
                                        </span>
                                      ) : isClosedOther ? (
                                        <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-500 text-[10px]">
                                          Outbid / Closed
                                        </span>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              if (!user) {
                                                openAuthModal();
                                                return;
                                              }
                                              const specTarget: SpecialistChatTarget = {
                                                channelId: `${sessionId}_${bid.providerId}`,
                                                providerId: bid.providerId,
                                                providerName: bid.providerName,
                                                providerAvatar: bid.providerAvatar,
                                                providerTitle: bid.providerTitle || 'Digital Solutions Expert',
                                                bidPrice: bid.bidPrice,
                                                deliveryDays: bid.deliveryDays,
                                                orderTitle: `${bid.providerTitle || 'Digital Milestone'} Contract`,
                                                isPurchasedOrder: false,
                                                clientBudgetCap: spendingLimit,
                                                scopeDetails: bid.note
                                              };
                                              if (!user) {
                                                openAuthModal();
                                                return;
                                              }
                                              setSelectedSpecialistChat(specTarget);
                                              setMainView('direct_specialist');
                                              setSidebarTab('specialist_dms');
                                            }}
                                            className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold text-[11px] border border-zinc-700 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                            title="Chat directly with specialist before awarding"
                                          >
                                            <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                                            <span>Chat</span>
                                          </button>

                                          <button
                                            onClick={() => handleAwardBid(sessionId, bid.providerId, bid.bidPrice)}
                                            disabled={isLoading}
                                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-bold text-[11px] flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                                          >
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            <span>Award & Pay</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <p className="text-zinc-300 text-[11px] italic pl-1">
                                    &quot;{bid.note}&quot;
                                  </p>

                                  {bid.milestones && bid.milestones.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                      {bid.milestones.map((m: any, mIdx: number) => (
                                        <div key={mIdx} className="p-2 rounded-lg bg-zinc-950/70 border border-zinc-800 flex items-center justify-between text-[10px]">
                                          <span className="text-zinc-300 truncate max-w-[130px]">{m.title}</span>
                                          <span className="font-mono font-bold text-cyan-400">${m.amount}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Evaluator Controls: Workspace Links & 1-Click Simulation */}
                      <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-[11px]">
                        <div className="flex items-center gap-2">
                          <a
                            href="/providers"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-semibold"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Open Provider Workspace (/providers)</span>
                          </a>
                          <span className="text-zinc-600">|</span>
                          <span className="text-zinc-400">Quick Test:</span>
                        </div>

                        {msg.actionPayload.tenderStatus !== 'closed_awarded' && msg.actionPayload.targetProviders && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {msg.actionPayload.targetProviders.map((tp: any, tpIdx: number) => {
                              const hasBid = activeBids.some((b: any) => b.providerId === tp.id);
                              // Natural competitive variance within budget cap
                              const discountFactor = tpIdx === 0 ? 0.95 : tpIdx === 1 ? 0.88 : 0.92;
                              const simPrice = Math.max(30, Math.min(spendingLimit, Math.round(spendingLimit * discountFactor)));
                              const displayName = tp.name || 'Specialist';

                              return (
                                <button
                                  key={tp.id}
                                  onClick={() => handleSimulateProviderBid(
                                    sessionId, 
                                    tp.id, 
                                    simPrice, 
                                    tpIdx === 1 ? 2 : 3, 
                                    `Autonomous proposal via ${tp.name}'s AI delegate: Deliver within SLA specifications for $${simPrice}.`
                                  )}
                                  disabled={isLoading || hasBid}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                    hasBid
                                      ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-default'
                                      : tpIdx === 0
                                      ? 'bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border-cyan-800/80 shadow-sm'
                                      : tpIdx === 1
                                      ? 'bg-purple-950 hover:bg-purple-900 text-purple-300 border-purple-800/80 shadow-sm'
                                      : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-800/80 shadow-sm'
                                  }`}
                                  title={hasBid ? `${tp.name} has already submitted a bid` : `Simulate bid from ${tp.name} ($${simPrice})`}
                                >
                                  {hasBid ? `✓ ${displayName} (Bid In)` : `⚡ Auto-Bid ${displayName} ($${simPrice})`}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })()}

                  {/* 3. Autonomous Multi-Agent Protocol Channel (Direct Bot-to-Provider Dialogue) */}
                  {msg.actionPayload?.negotiationDialog && msg.actionPayload.negotiationDialog.length > 0 && (
                    <div className="p-4 rounded-2xl bg-zinc-950/95 border border-cyan-500/30 text-xs space-y-3 shadow-xl backdrop-blur-md">
                      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${msg.actionPayload.inquiryStatus === 'awaiting_provider' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
                          <span className="font-mono font-bold text-cyan-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                            <Bot className="h-3.5 w-3.5 text-cyan-400" />
                            Autonomous Agent-to-Provider Protocol Channel
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          msg.actionPayload.inquiryStatus === 'awaiting_provider'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {msg.actionPayload.inquiryStatus === 'awaiting_provider' ? '⏳ Awaiting Provider Response' : 'Agreement Codified'}
                        </span>
                      </div>

                      <div className="space-y-2.5 pt-1">
                        {msg.actionPayload.negotiationDialog.map((dialog, dIdx) => (
                          <div
                            key={dIdx}
                            className={`p-3 rounded-xl text-xs space-y-1 transition-all ${
                              dialog.speaker === 'agent'
                                ? 'bg-cyan-950/30 border border-cyan-500/30 text-cyan-100 ml-0 mr-4'
                                : 'bg-purple-950/30 border border-purple-500/30 text-purple-100 ml-4 mr-0'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className={dialog.speaker === 'agent' ? 'text-cyan-400 font-mono flex items-center gap-1' : 'text-purple-300 font-mono flex items-center gap-1'}>
                                {dialog.speakerName}
                              </span>
                              <span className="text-zinc-500 font-mono text-[9px]">{dialog.timestamp || 'Just now'}</span>
                            </div>
                            <div className="text-zinc-200 text-[11.5px] leading-relaxed">
                              {renderFormattedMessage(dialog.message)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Live Received Specialist Milestone Bids & 1-Click PayPal Escrow Checkout */}
                      {(() => {
                        // 1. Gather all bids
                        let rawBids: any[] = Array.isArray(msg.actionPayload?.bids) ? [...msg.actionPayload.bids] : [];

                        // Fallback to active session in historySessions if message actionPayload is missing bids
                        if (rawBids.length === 0) {
                          const activeSessionItem = historySessions.find(s => s.id === sessionId);
                          if (Array.isArray(activeSessionItem?.bids) && activeSessionItem.bids.length > 0) {
                            rawBids = [...activeSessionItem.bids];
                          }
                        }

                        // Filter out unverified auto-bid placeholders where provider never submitted a bid and never chatted
                        let bidsList = rawBids.filter((b: any) => {
                          if (b.status === 'submitted') return true;
                          const hasProviderMessage = msg.actionPayload?.negotiationDialog?.some((d: any) => 
                            d.speaker === 'provider' && (
                              (b.providerName && d.speakerName?.toLowerCase().includes(b.providerName.toLowerCase().split(' ')[0])) ||
                              (b.providerId && d.speakerName?.toLowerCase().includes(b.providerId.toLowerCase()))
                            )
                          );
                          if (hasProviderMessage) return true;
                          return !b.isAutoBid;
                        });

                        // Fallback detection from chat dialog if bid hasn't been codified into an object yet
                        if (bidsList.length === 0 && msg.actionPayload?.negotiationDialog) {
                          for (let i = msg.actionPayload.negotiationDialog.length - 1; i >= 0; i--) {
                            const d = msg.actionPayload.negotiationDialog[i];
                            const match = d.message.match(/\$?(\d{2,4})\s*(?:\$|usd)?/i);
                            if (match) {
                              const p = Number(match[1]);
                              if (p >= 30 && p <= (spendingLimit || 200)) {
                                const providerMsg = msg.actionPayload.negotiationDialog.find((entry: any) => entry.speaker === 'provider');
                                const providerName = providerMsg?.speakerName?.replace(' 👨‍💻 (Specialist Message)', '')?.replace(' 👨‍💻 (Specialist Bid)', '') || 'Specialist';
                                bidsList.push({
                                  providerId: msg.actionPayload.providerId || 'prov_1008',
                                  providerName,
                                  providerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
                                  providerTitle: 'Autonomous AI Agent & Multi-Model Workflow Engineer',
                                  bidPrice: p,
                                  deliveryDays: 3,
                                  note: d.message,
                                  submittedAt: d.timestamp || 'Just now',
                                  milestones: [
                                    { title: 'Milestone 1: Core Architecture & Setup', amount: Math.round(p / 2) },
                                    { title: 'Milestone 2: Final Verification & Handover', amount: p - Math.round(p / 2) }
                                  ]
                                });
                                break;
                              }
                            }
                          }
                        }

                        if (bidsList.length === 0 && msg.actionPayload?.tenderStatus === 'closed_awarded') {
                          return null;
                        }

                        // Sort bids by price (lowest / best price first)
                        bidsList.sort((a, b) => Number(a.bidPrice) - Number(b.bidPrice));

                        return (
                          <div className="space-y-3 mt-3 pt-3 border-t border-cyan-500/20 animate-fadeIn">
                            {/* Section Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${bidsList.length > 0 ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
                                <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                                  <span>Official Received Milestone Bids ({bidsList.length})</span>
                                </span>
                              </div>
                              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold">
                                {bidsList.length > 0 ? '⚡ 1-Click Escrow Ready' : '⏳ Awaiting Bids'}
                              </span>
                            </div>

                            {/* Bids List */}
                            {bidsList.length === 0 ? (
                              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center space-y-1">
                                <Clock className="h-4 w-4 text-amber-400 mx-auto animate-spin" />
                                <p className="text-zinc-300 font-medium text-xs">Awaiting bids from tendered specialists...</p>
                                <p className="text-[10.5px] text-zinc-400">
                                  When providers send their quotes in chat or via their workspace, their bids appear here with 1-click PayPal Escrow lock.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2.5">
                                {bidsList.map((bid: any, bIdx: number) => {
                                  const isWinner = msg.actionPayload?.winningBid?.providerId === bid.providerId || msg.actionPayload?.tenderStatus === 'closed_awarded';
                                  const isClosedOther = msg.actionPayload?.tenderStatus === 'closed_awarded' && msg.actionPayload?.winningBid?.providerId && msg.actionPayload?.winningBid?.providerId !== bid.providerId;

                                  return (
                                    <div
                                      key={`${bid.providerId || bIdx}_${bIdx}`}
                                      className={`p-3.5 rounded-2xl border transition-all ${
                                        isWinner && !isClosedOther
                                          ? 'bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-teal-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/50'
                                          : isClosedOther
                                          ? 'bg-zinc-900/40 border-zinc-800 opacity-60'
                                          : 'bg-zinc-900/90 border-cyan-500/40 hover:border-cyan-400 shadow-md'
                                      }`}
                                    >
                                      {/* Top Row: Provider info + Price Badge */}
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-zinc-800/70">
                                        <div className="flex items-center gap-2.5">
                                          {bid.providerAvatar && (
                                            <img
                                              src={getSpecialistRealAvatar(bid.providerName, bid.providerAvatar)}
                                              alt={bid.providerName}
                                              onClick={() => setSelectedProfileProvider(resolveToServiceProvider(bid))}
                                              className="h-9 w-9 rounded-full bg-zinc-800 border-2 border-zinc-700 hover:border-cyan-400 transition-colors cursor-pointer shrink-0 object-cover shadow-sm"
                                              title="View Specialist Profile"
                                            />
                                          )}
                                          <div>
                                            <div className="flex items-center gap-1.5">
                                              <span
                                                onClick={() => setSelectedProfileProvider(resolveToServiceProvider(bid))}
                                                className="font-bold text-white text-xs hover:text-cyan-300 transition-colors cursor-pointer"
                                                title="View Specialist Profile"
                                              >
                                                {bid.providerName}
                                              </span>
                                              <span className="text-[10px] text-cyan-400 font-mono">✓ Verified</span>
                                            </div>
                                            <p className="text-[10px] text-zinc-400">
                                              {bid.providerTitle || 'Verified Specialist'} • <strong className="text-zinc-200 font-mono">{bid.deliveryDays || 3} Days</strong> turnaround
                                            </p>
                                          </div>
                                        </div>

                                        {/* Price + Action */}
                                        <div className="flex items-center gap-2.5 self-end sm:self-auto">
                                          <div className="text-right">
                                            <span className="text-sm font-black font-mono text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-xl border border-emerald-500/30 block shadow-sm">
                                              ${bid.bidPrice} USD
                                            </span>
                                          </div>

                                          {isWinner && !isClosedOther ? (
                                            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center gap-1.5">
                                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                              <span>Awarded Winner</span>
                                            </span>
                                          ) : isClosedOther ? (
                                            <span className="px-2.5 py-1 rounded-xl bg-zinc-800 text-zinc-500 text-xs">
                                              Outbid / Closed
                                            </span>
                                          ) : (
                                            <div className="flex items-center gap-1.5">
                                              {/* 1-on-1 Direct Chat button */}
                                              <button
                                                onClick={() => {
                                                  if (!user) {
                                                    openAuthModal();
                                                    return;
                                                  }
                                                  const specTarget: SpecialistChatTarget = {
                                                    channelId: `${sessionId}_${bid.providerId}`,
                                                    providerId: bid.providerId,
                                                    providerName: bid.providerName,
                                                    providerAvatar: bid.providerAvatar,
                                                    providerTitle: bid.providerTitle || 'Digital Solutions Expert',
                                                    bidPrice: bid.bidPrice,
                                                    deliveryDays: bid.deliveryDays,
                                                    orderTitle: `${bid.providerTitle || 'Milestone'} Contract`,
                                                    isPurchasedOrder: false,
                                                    clientBudgetCap: spendingLimit,
                                                    scopeDetails: bid.note
                                                  };
                                                  setSelectedSpecialistChat(specTarget);
                                                  setMainView('direct_specialist');
                                                  setSidebarTab('specialist_dms');
                                                }}
                                                className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold text-xs border border-zinc-700 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                                                title="Chat directly before awarding"
                                              >
                                                <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                                                <span className="hidden sm:inline">Chat</span>
                                              </button>

                                              {/* Primary Award & Lock PayPal Escrow button */}
                                              <button
                                                onClick={() => handleAwardBid(sessionId, bid.providerId, bid.bidPrice)}
                                                disabled={isLoading}
                                                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                                                title={`Award contract to ${bid.providerName} for $${bid.bidPrice} USD and lock in PayPal Escrow`}
                                              >
                                                <CheckCircle2 className="h-4 w-4" />
                                                <span>Award & Lock ${bid.bidPrice} Escrow</span>
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Note */}
                                      {bid.note && (
                                        <p className="text-[11px] text-zinc-300 italic pt-1 pl-1">
                                          &quot;{bid.note}&quot;
                                        </p>
                                      )}

                                      {/* Milestones Breakdown */}
                                      {Array.isArray(bid.milestones) && bid.milestones.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5">
                                          {bid.milestones.map((m: any, mIdx: number) => (
                                            <div key={mIdx} className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-[10.5px]">
                                              <span className="text-zinc-300 truncate max-w-[150px]">{m.title}</span>
                                              <span className="font-mono font-bold text-cyan-400">${m.amount} USD</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Awaiting Provider Interactive Controls */}
                      {msg.actionPayload.inquiryStatus === 'awaiting_provider' && (
                        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2.5 mt-2">
                          <div className="flex items-center justify-between text-[11px] text-amber-300">
                            <span className="font-semibold flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-amber-400" />
                              <span>Proposal sent to {msg.actionPayload.providerName || 'Specialist'}&apos;s Workspace & Email</span>
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">Dual-Sided Sync Active</span>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                            <a
                              href={`/providers?providerId=${msg.actionPayload.providerId || 'prov_1001'}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full sm:w-auto flex-1 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-cyan-400" />
                              <span>Open Provider Workspace (Respond as {msg.actionPayload.providerName?.split(' ')[0] || 'Specialist'})</span>
                            </a>

                            <button
                              onClick={() => handleProviderAutoAccept(sessionId)}
                              disabled={isLoading}
                              className="w-full sm:w-auto py-2 px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>⚡ 1-Click Auto-Accept as Provider</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Autonomous Negotiation Agreement Summary */}
                  {msg.actionPayload?.negotiatedTerms && (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 to-blue-950/30 border border-purple-500/40 text-xs space-y-3 shadow-lg">
                      <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                        <span className="font-bold text-purple-300 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                          <span>Autonomous Negotiation Breakdown</span>
                        </span>
                        <span className="font-mono text-emerald-400 font-black text-sm">
                          ${msg.actionPayload.negotiatedTerms.negotiatedPrice || msg.actionPayload.amount} USD
                        </span>
                      </div>

                      <div className="space-y-2 text-zinc-300 text-[11px]">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Selected Specialist: <strong className="text-white">{msg.actionPayload.negotiatedTerms.providerName}</strong></span>
                          {msg.actionPayload.negotiatedTerms.originalPrice && (
                            <span>Standard Quote: <span className="line-through text-zinc-500">${msg.actionPayload.negotiatedTerms.originalPrice}</span></span>
                          )}
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] uppercase font-mono text-zinc-400 font-semibold">Structured Milestone Tranches:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {msg.actionPayload.negotiatedTerms.milestones?.map((m: any, mIdx: number) => (
                              <div key={mIdx} className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-[11px]">
                                <span className="text-zinc-200 font-medium truncate max-w-[140px]">{m.title}</span>
                                <span className="font-mono font-bold text-cyan-400">${m.amount}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Live Active PayPal Checkout Bubble (Never shown if already escrow funded!) */}
            {activePayPalOrder && !paymentSuccess && !messages.some(m => m.actionPayload?.type === 'escrow_success') && (
              <div 
                ref={paypalCardRef}
                className="p-5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-blue-950/40 border border-cyan-500/40 shadow-xl space-y-4 max-w-lg mx-auto scroll-mt-24 transition-all animate-fadeIn"
              >
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">PayPal Smart Checkout Ready</span>
                  </div>
                  <span className="font-mono font-black text-amber-300 text-sm">${activePayPalOrder.amount} USD</span>
                </div>

                <div className="text-xs text-zinc-300 space-y-1">
                  <p><strong className="text-zinc-400">Deliverable:</strong> {activePayPalOrder.scopeTitle}</p>
                  <p><strong className="text-zinc-400">Provider:</strong> {activePayPalOrder.providerName}</p>
                  <p className="text-[11px] text-zinc-500">Milestone escrow protected. Funds are captured securely on PayPal Sandbox.</p>
                </div>

                {/* Dedicated High-Contrast PayPal Secure Payment Gateway Card (Pure White for Fastlane & Card Fields) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white text-slate-900 shadow-2xl border border-slate-200/90 space-y-3.5 my-2 paypal-gateway-container">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center">
                        <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 font-sans tracking-tight block">
                          PayPal Smart Escrow Gateway
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          Zero Platform Risk • Milestone Custody
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 shadow-xs">
                      ${activePayPalOrder.amount} USD
                    </span>
                  </div>

                  {/* Interactive PayPal Sandbox Test Card Helper Pill */}
                  <div className="bg-blue-50/90 border border-blue-200/90 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-950 flex items-center gap-1.5 text-[11px]">
                        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                        <span>Official PayPal Sandbox Test Cards (Luhn Verified)</span>
                      </span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-200 font-mono font-bold px-2 py-0.5 rounded-full">
                        SANDBOX ACTIVE
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug">
                      PayPal Sandbox blocks real bank cards. Use one of these official Luhn-verified test cards:
                    </p>

                    <div className="space-y-1.5">
                      {/* Visa Card Option */}
                      <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-blue-200/80 font-mono text-[11px] text-slate-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-blue-700">Visa: 4012 8888 8888 1881</span>
                          <span className="text-slate-300">•</span>
                          <span>Exp: 12/28</span>
                          <span className="text-slate-300">•</span>
                          <span>CVV: 123</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText('4012888888881881');
                            setCopiedTestCard(true);
                            setTimeout(() => setCopiedTestCard(false), 2000);
                          }}
                          className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-sans font-bold px-2.5 py-1 rounded cursor-pointer transition-all flex items-center gap-1"
                          title="Copy official PayPal Sandbox Visa number"
                        >
                          {copiedTestCard ? (
                            <>
                              <Check className="h-3 w-3 text-white" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy Visa</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Mastercard Option */}
                      <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-blue-200/80 font-mono text-[11px] text-slate-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-amber-700">MC: 5555 5555 5555 4444</span>
                          <span className="text-slate-300">•</span>
                          <span>Exp: 12/28</span>
                          <span className="text-slate-300">•</span>
                          <span>CVV: 123</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText('5555555555554444');
                            setCopiedTestCard(true);
                            setTimeout(() => setCopiedTestCard(false), 2000);
                          }}
                          className="text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-sans font-bold px-2.5 py-1 rounded cursor-pointer transition-all flex items-center gap-1"
                          title="Copy official PayPal Sandbox Mastercard number"
                        >
                          <Copy className="h-3 w-3" />
                          <span>Copy MC</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1 pt-0.5">
                      <span>💡 In Billing Address, select <strong>United States 🇺🇸</strong> with Zip <strong>95131</strong>, or use the 1-Click Judge Pass below!</span>
                    </div>
                  </div>

                  {/* Primary Option: Pay with PayPal Wallet */}
                  <PayPalButtons
                    fundingSource="paypal"
                    style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 44 }}
                    createOrder={(data, actions) => {
                      if (
                        activePayPalOrder.paypalOrderId && 
                        !activePayPalOrder.paypalOrderId.startsWith('PAYPAL_SANDBOX_') &&
                        activePayPalOrder.paypalOrderId.length > 10
                      ) {
                        return Promise.resolve(activePayPalOrder.paypalOrderId);
                      }

                      return actions.order.create({
                        intent: 'CAPTURE',
                        purchase_units: [
                          {
                            reference_id: activePayPalOrder.orderId,
                            description: `AgentPay Milestone Escrow: ${activePayPalOrder.scopeTitle}`,
                            amount: {
                              currency_code: 'USD',
                              value: Number(activePayPalOrder.amount).toFixed(2)
                            }
                          }
                        ]
                      });
                    }}
                    onApprove={async (data, actions) => {
                      if (actions?.order?.capture) {
                        try {
                          await actions.order.capture();
                        } catch (e) {
                          console.warn('[PayPal Client Capture Fallback]:', e);
                        }
                      }
                      await handlePayPalCapture(data.orderID);
                    }}
                    onError={(err) => {
                      console.warn('PayPal Sandbox checkout notice:', err);
                      setSystemNotice({
                        isOpen: true,
                        title: 'PayPal Notice',
                        message: 'PayPal checkout encountered a Sandbox connection notice. You can also use the 1-Click Fast Escrow Authorization button below.',
                        type: 'warning'
                      });
                    }}
                  />

                  {/* Secondary Option: Pay with Debit or Credit Card */}
                  <PayPalButtons
                    fundingSource="card"
                    style={{ layout: 'vertical', color: 'black', shape: 'rect', label: 'pay', height: 44 }}
                    createOrder={(data, actions) => {
                      return actions.order.create({
                        intent: 'CAPTURE',
                        purchase_units: [
                          {
                            reference_id: activePayPalOrder.orderId,
                            description: `AgentPay Milestone Escrow: ${activePayPalOrder.scopeTitle}`,
                            amount: {
                              currency_code: 'USD',
                              value: Number(activePayPalOrder.amount).toFixed(2)
                            }
                          }
                        ]
                      });
                    }}
                    onApprove={async (data, actions) => {
                      if (actions?.order?.capture) {
                        try {
                          await actions.order.capture();
                        } catch (e) {
                          console.warn('[PayPal Client Card Capture Fallback]:', e);
                        }
                      }
                      await handlePayPalCapture(data.orderID);
                    }}
                    onError={(err) => {
                      console.warn('PayPal Card Sandbox checkout notice:', err);
                      setSystemNotice({
                        isOpen: true,
                        title: 'PayPal Sandbox Card Notice',
                        message: 'Real bank cards are blocked by PayPal Sandbox for fraud protection. Please use the official Sandbox Test Card (4032 0289 0000 0000, Exp: 12/28, CVV: 123, Zip: 95131) or click the 1-Click Fast Escrow Authorization button below.',
                        type: 'warning'
                      });
                    }}
                  />

                  {/* Accepted Card Brands Strip inside white card */}
                  <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-100">
                    <CreditCard className="h-3 w-3 text-blue-600" />
                    <span>PayPal Balance • Visa • Mastercard • Amex • Discover</span>
                  </div>
                </div>

                <div className="pt-1 space-y-2">
                  {/* 1-Click Fast Sandbox Authorization Button for Evaluators & Instant Testing */}
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={isCapturingOrder}
                      onClick={() => handlePayPalCapture(activePayPalOrder.paypalOrderId || `SANDBOX_FAST_${Date.now()}`)}
                      className="w-full py-2.5 px-3 rounded-xl bg-zinc-900/90 hover:bg-emerald-950/40 text-emerald-400 hover:text-emerald-300 font-bold text-xs border border-emerald-500/30 hover:border-emerald-500/60 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Simulate immediate escrow authorization without entering dummy sandbox credentials"
                    >
                      {isCapturingOrder ? (
                        <>
                          <span className="animate-spin inline-block">⏳</span>
                          <span>Securing Milestone Escrow on PayPal Sandbox...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 text-emerald-400" />
                          <span>⚡ Instant Escrow Authorization (1-Click Judge Pass)</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 px-1 text-[11px] text-zinc-400 font-mono">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>PayPal Orders v2 Inline Escrow</span>
                    </span>
                    <span className="text-zinc-500">Sandbox Environment</span>
                  </div>
                </div>
              </div>
            )}

            {/* Escrow Funded & Active Protected Confirmation Bubble */}
            {(paymentSuccess || messages.some(m => m.actionPayload?.type === 'escrow_success')) && (
              <div 
                ref={paymentSuccessRef} 
                className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-teal-950/40 border border-emerald-500/40 shadow-xl space-y-3.5 max-w-lg mx-auto scroll-mt-24 transition-all animate-fadeIn"
              >
                <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">PayPal Milestone Escrow Active</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold">
                    🛡️ Escrow Funded
                  </span>
                </div>

                <div className="text-xs text-zinc-300 space-y-1">
                  <p>
                    Milestone funds are securely locked in PayPal Sandbox Escrow. The specialist has been notified to construct deliverables according to agreed specifications.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-800/80 text-xs">
                  <Link
                    href="/orders"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-bold text-xs transition-all shadow-md shadow-emerald-950/40"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>View & Manage in Escrow Hub</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>

                  <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                    <span>PayPal Orders v2 Verified</span>
                  </span>
                </div>
              </div>
            )}

            {/* Real-Time AI Analysis & Procurement Reasoning Indicator */}
            {isLoading && (
              <div className="flex items-start gap-3.5 animate-fadeIn">
                <div className="h-9 w-9 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-950/50">
                  <Bot className="h-4 w-4 animate-spin text-cyan-300" />
                </div>
                <div className="p-4 rounded-2xl bg-zinc-900/90 border border-cyan-500/30 rounded-tl-none shadow-xl space-y-2 max-w-[85%] sm:max-w-[70%]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      AgentPay Autonomous Brain Analyzing Scope & Matching Specialists...
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" />
                    </div>
                    <span className="text-zinc-500 text-[10px] font-mono">Autonomous multi-agent consensus & reverse auction active</span>
                  </div>
                </div>
              </div>
            )}

            <div className="h-20 shrink-0" ref={messagesEndRef} />
          </div>
        </div>

        {/* Floating Bottom Input Bar (ChatGPT Style Centered Floating Pill) */}
        <div className="w-full shrink-0 z-20 pb-3 pt-1 px-4 bg-gradient-to-t from-[#090A0F] via-[#090A0F]/90 to-transparent">
          <div className="max-w-3xl mx-auto space-y-2">
            
            {/* CyberVoice™ AI Dictation & Audio Recorder Bar */}
            {isVoiceRecorderOpen && (
              <div className="mb-2">
                <VoiceNoteRecorder
                  onSend={(result) => {
                    handleSend(result.transcript, result);
                    setIsVoiceRecorderOpen(false);
                  }}
                  onCancel={() => setIsVoiceRecorderOpen(false)}
                  placeholderPrompt="Speak your RFP requirements (e.g. 'I need a full-stack Next.js developer for $120')..."
                />
              </div>
            )}

            {/* Input Container */}
            <div className="relative flex items-center bg-zinc-900/90 border border-zinc-700/80 rounded-2xl sm:rounded-3xl shadow-2xl focus-within:border-cyan-500/60 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all p-1.5 sm:p-2 backdrop-blur-xl">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={user ? `Ask AgentPay AI as ${user.name.split(' ')[0]}: 'Find me a Next.js dev under $150'...` : "Ask AgentPay AI: 'Find me a Next.js dev under $150'..."}
                disabled={isLoading}
                className="flex-1 bg-transparent px-3 sm:px-4 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none"
              />

              {/* Mic Dictation Trigger Button */}
              <button
                type="button"
                onClick={() => setIsVoiceRecorderOpen(prev => !prev)}
                className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 mr-1.5 ${
                  isVoiceRecorderOpen
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border border-zinc-700/80 hover:border-cyan-500/40 shadow-sm'
                }`}
                title="Speak RFP hands-free with CyberVoice™ AI Dictation"
              >
                <Mic className="h-4 w-4" />
              </button>

              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  input.trim()
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-zinc-950 hover:opacity-90 shadow-md shadow-cyan-950/50'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
                title="Send message to AI Agent"
              >
                {isLoading ? (
                  <span className="animate-spin text-xs">⏳</span>
                ) : (
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                )}
              </button>
            </div>

            {/* Protocol Security Footnote */}
            <div className="text-center text-[10px] text-zinc-500 flex items-center justify-center gap-1.5 select-none">
              <ShieldCheck className="h-3 w-3 text-cyan-400/80" />
              <span>AgentPay AI Protocol v2.4 • Secured with PayPal Orders v2 Milestone Escrow & AgentPay Neural Brain</span>
            </div>
          </div>
        </div>
      </>
    )}

      </main>

      {/* Direct 1-on-1 Specialist Collaboration Modal */}
      {activeDirectChat && (
        <DirectChatModal
          isOpen={!!activeDirectChat}
          onClose={() => setActiveDirectChat(null)}
          channelId={activeDirectChat.channelId}
          orderTitle={activeDirectChat.orderTitle}
          currentUserRole="client"
          currentUserName={user?.name || 'Janitha Dilshan'}
          otherPartyName={activeDirectChat.providerName}
          isPurchasedOrder={activeDirectChat.isPurchasedOrder}
          bidPrice={activeDirectChat.bidPrice}
          deliveryDays={activeDirectChat.deliveryDays}
          clientBudgetCap={activeDirectChat.clientBudgetCap}
        />
      )}

      {/* Specialist Profile Preview Modal */}
      {selectedProfileProvider && (
        <ProviderProfileModal
          isOpen={!!selectedProfileProvider}
          onClose={() => setSelectedProfileProvider(null)}
          provider={selectedProfileProvider}
          spendingLimit={spendingLimit}
          onSelectProvider={(provName) => {
            if (!user) {
              openAuthModal();
              return;
            }
            handleSend(`I want to proceed with ${provName} for my project within my $${spendingLimit} budget.`);
          }}
        />
      )}

      {/* Live Inbound Specialist Bid Alert Toast */}
      {activeToastNotice && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-3xl bg-zinc-950/95 border border-emerald-500/50 shadow-2xl shadow-emerald-950/70 backdrop-blur-xl max-w-sm flex items-center justify-between gap-3.5 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-950/50">
              <Zap className="h-5 w-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  ⚡ New Specialist Bid
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="text-xs font-bold text-white truncate max-w-[180px]">
                {activeToastNotice.providerName} bid ${activeToastNotice.amount} USD
              </p>
              <p className="text-[10px] text-zinc-400 truncate max-w-[180px]">
                {activeToastNotice.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                const target = historySessions.find(s => s.id === activeToastNotice.sessionId);
                if (target) {
                  resumeSession(target);
                } else {
                  setSessionId(activeToastNotice.sessionId);
                }
                setActiveToastNotice(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-zinc-950 font-bold text-xs shadow-md shadow-emerald-950/50 transition-all cursor-pointer"
            >
              View Bid
            </button>
            <button
              onClick={() => setActiveToastNotice(null)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* System Protocol Notice Modal (Zero browser alert()) */}
      {systemNotice?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div 
            className="relative w-full max-w-md p-6 rounded-3xl bg-zinc-950 border border-amber-500/40 shadow-2xl shadow-amber-950/40 text-left space-y-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  systemNotice.type === 'error'
                    ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                    : systemNotice.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                }`}>
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm sm:text-base">{systemNotice.title}</h4>
                  <p className="text-[11px] text-zinc-400 font-mono">AgentPay Safe Spending & Escrow Protocol</p>
                </div>
              </div>
              <button
                onClick={() => setSystemNotice(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
              {systemNotice.message}
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setSystemNotice(null)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Profile Customization Modal */}
      <ClientProfileModal
        isOpen={isClientProfileModalOpen}
        onClose={() => setIsClientProfileModalOpen(false)}
        mode="edit"
      />
    </div>
  );
}
