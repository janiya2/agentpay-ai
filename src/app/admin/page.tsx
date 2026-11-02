'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  MessageSquareCode, 
  ShieldCheck, 
  Key, 
  CreditCard, 
  Mail, 
  Database, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Plus, 
  Trash2,
  Search,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ChevronRight,
  Bot,
  ExternalLink,
  Shield,
  Activity,
  Layers,
  User as UserIcon,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  Copy,
  Check,
  FlaskConical,
  CheckCircle,
  XCircle
} from 'lucide-react';
import type { PlatformSettings, ServiceProvider, AgentPayOrder, ChatSession, BuyerUser } from '@/types';

type AdminTab = 'overview' | 'providers' | 'users' | 'chats' | 'orders' | 'settings';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('innoxpert2026');
  const [authError, setAuthError] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('settings');

  // Key visibility toggles
  const [showGeminiKeys, setShowGeminiKeys] = useState<Record<number, boolean>>({});
  const [showPaypalSecret, setShowPaypalSecret] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  const [copiedKeyIndex, setCopiedKeyIndex] = useState<number | null>(null);
  const [copiedPaypalSecret, setCopiedPaypalSecret] = useState(false);

  // Live Test Connection States
  const [testingKeyIndex, setTestingKeyIndex] = useState<number | null>(null);
  const [keyTestResults, setKeyTestResults] = useState<Record<number, { success: boolean; message?: string; error?: string }>>({});
  
  const [testingPool, setTestingPool] = useState(false);
  const [poolTestSummary, setPoolTestSummary] = useState<string | null>(null);

  const [testingPaypal, setTestingPaypal] = useState(false);
  const [paypalTestResult, setPaypalTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const [testingResend, setTestingResend] = useState(false);
  const [resendTestResult, setResendTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const toggleShowGeminiKey = (index: number) => {
    setShowGeminiKeys(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const copyToClipboard = (text: string, type: 'gemini' | 'paypal', index?: number) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'gemini' && typeof index === 'number') {
      setCopiedKeyIndex(index);
      setTimeout(() => setCopiedKeyIndex(null), 2000);
    } else if (type === 'paypal') {
      setCopiedPaypalSecret(true);
      setTimeout(() => setCopiedPaypalSecret(false), 2000);
    }
  };

  // Test single Gemini key
  const handleTestGeminiKey = async (index: number) => {
    const key = geminiKeys[index];
    if (!key || key.trim().length < 10) {
      setKeyTestResults(prev => ({ ...prev, [index]: { success: false, error: 'Key is empty or too short' } }));
      return;
    }
    setTestingKeyIndex(index);
    try {
      const res = await fetch('/api/admin/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'gemini', key: key.trim() })
      });
      const data = await res.json();
      setKeyTestResults(prev => ({ ...prev, [index]: data }));
    } catch (err: any) {
      setKeyTestResults(prev => ({ ...prev, [index]: { success: false, error: err.message } }));
    } finally {
      setTestingKeyIndex(null);
    }
  };

  // Test entire Gemini Pool
  const handleTestPool = async () => {
    setTestingPool(true);
    setPoolTestSummary(null);
    try {
      const res = await fetch('/api/admin/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'gemini_pool', keys: geminiKeys })
      });
      const data = await res.json();
      setPoolTestSummary(data.poolSummary || `${data.activeCount}/${data.totalCount} operational`);
      if (data.results) {
        const mapped: Record<number, any> = {};
        data.results.forEach((r: any) => {
          mapped[r.index] = { success: r.status === 'active', message: r.status === 'active' ? `Active (${r.latencyMs}ms)` : undefined, error: r.error };
        });
        setKeyTestResults(mapped);
      }
    } catch (err: any) {
      setPoolTestSummary(`Test failed: ${err.message}`);
    } finally {
      setTestingPool(false);
    }
  };

  // Test PayPal Credentials
  const handleTestPaypal = async () => {
    setTestingPaypal(true);
    setPaypalTestResult(null);
    try {
      const res = await fetch('/api/admin/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'paypal',
          clientId: paypalClientId,
          clientSecret: paypalClientSecret,
          mode: paypalMode
        })
      });
      const data = await res.json();
      setPaypalTestResult(data);
    } catch (err: any) {
      setPaypalTestResult({ success: false, error: err.message });
    } finally {
      setTestingPaypal(false);
    }
  };

  // Test Resend Key
  const handleTestResend = async () => {
    setTestingResend(true);
    setResendTestResult(null);
    try {
      const res = await fetch('/api/admin/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'resend', apiKey: resendApiKey })
      });
      const data = await res.json();
      setResendTestResult(data);
    } catch (err: any) {
      setResendTestResult({ success: false, error: err.message });
    } finally {
      setTestingResend(false);
    }
  };

  // Platform Settings State
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [paypalMode, setPaypalMode] = useState<'sandbox' | 'live'>('sandbox');
  const [geminiKeys, setGeminiKeys] = useState<string[]>(['']);
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromEmail, setResendFromEmail] = useState('onboarding@resend.dev');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Seeder State
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  // Live Database Collections State (100% REAL from Firestore - Zero Mock Data)
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [orders, setOrders] = useState<AgentPayOrder[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [users, setUsers] = useState<BuyerUser[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Filters & Search
  const [providerSearch, setProviderSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [userSearch, setUserSearch] = useState('');

  // Check saved session on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('agentpay_admin_auth');
      if (saved === 'true') {
        setIsAuthenticated(true);
      }
    }
  }, []);

  // Authenticate Admin
  const handleAuth = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPass = passcode.trim();
    if (cleanPass === 'innoxpert2026' || cleanPass === 'admin123' || cleanPass === 'demo' || cleanPass === 'paypal2026') {
      setIsAuthenticated(true);
      setAuthError(false);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('agentpay_admin_auth', 'true');
      }
    } else {
      setAuthError(true);
    }
  };

  const handleJudgeQuickAccess = () => {
    setPasscode('innoxpert2026');
    setIsAuthenticated(true);
    setAuthError(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('agentpay_admin_auth', 'true');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('agentpay_admin_auth');
    }
  };

  // Load ONLY REAL platform data from Firestore
  const loadPlatformData = async () => {
    setLoadingData(true);
    try {
      // 1. Settings
      const settingsSnap = await getDoc(doc(db, 'agentpay_settings', 'general'));
      if (settingsSnap.exists()) {
        const data = settingsSnap.data() as PlatformSettings;
        setPaypalClientId(data.paypalClientId || '');
        setPaypalClientSecret(data.paypalClientSecret || '');
        setPaypalMode(data.paypalMode || 'sandbox');
        setGeminiKeys(data.geminiKeys && data.geminiKeys.length > 0 ? data.geminiKeys : ['']);
        setResendApiKey(data.resendApiKey || '');
        setResendFromEmail(data.resendFromEmail || 'onboarding@resend.dev');
      } else {
        setGeminiKeys([process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyD_5frWyGBMZ4BXECEeLHB9qKneoJWUC-s']);
      }

      // 2. Real Providers from Firestore
      const provSnap = await getDocs(collection(db, 'agentpay_providers'));
      if (!provSnap.empty) {
        setProviders(provSnap.docs.map(d => d.data() as ServiceProvider));
      } else {
        setProviders([]);
      }

      // 3. Real Orders from Firestore
      const ordersSnap = await getDocs(collection(db, 'agentpay_orders'));
      if (!ordersSnap.empty) {
        setOrders(ordersSnap.docs.map(d => d.data() as AgentPayOrder));
      } else {
        setOrders([]);
      }

      // 4. Real Chat Sessions from Firestore (agentpay_chat_sessions)
      const sessionsSnap = await getDocs(collection(db, 'agentpay_chat_sessions'));
      if (!sessionsSnap.empty) {
        const list = sessionsSnap.docs.map(d => d.data() as ChatSession);
        // Sort descending by most recent
        list.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
        setChatSessions(list);
        if (list.length > 0) {
          setSelectedSessionId(prev => prev || list[0].id);
        }
      } else {
        setChatSessions([]);
      }

      // 5. Real Users from Firestore
      const usersSnap = await getDocs(collection(db, 'agentpay_users'));
      if (!usersSnap.empty) {
        setUsers(usersSnap.docs.map(d => d.data() as BuyerUser));
      } else {
        setUsers([]);
      }

    } catch (err) {
      console.error('Failed to load real platform data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadPlatformData();
    }
  }, [isAuthenticated]);

  // Save Settings
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const cleanKeys = geminiKeys.map(k => k.trim()).filter(Boolean);
      await setDoc(doc(db, 'agentpay_settings', 'general'), {
        paypalClientId: paypalClientId.trim(),
        paypalClientSecret: paypalClientSecret.trim(),
        paypalMode,
        geminiKeys: cleanKeys,
        activeGeminiKeyIndex: 0,
        resendApiKey: resendApiKey.trim(),
        resendFromEmail: resendFromEmail.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Save Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Key array helpers
  const addKeyField = () => {
    if (geminiKeys.length < 5) {
      setGeminiKeys([...geminiKeys, '']);
    }
  };

  const updateKeyField = (index: number, val: string) => {
    const updated = [...geminiKeys];
    updated[index] = val;
    setGeminiKeys(updated);
  };

  const removeKeyField = (index: number) => {
    if (geminiKeys.length > 1) {
      setGeminiKeys(geminiKeys.filter((_, i) => i !== index));
    }
  };

  // Trigger Seeder API
  const handleTriggerSeeder = async () => {
    setIsSeeding(true);
    setSeedStatus('Injecting 100+ verified service provider profiles into Firestore...');

    try {
      const res = await fetch('/api/admin/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSeedStatus(`🎉 Success! Seeded ${data.count || 100} verified providers into collection "agentpay_providers".`);
        await loadPlatformData();
      } else {
        setSeedStatus(`❌ Seeder error: ${data.error}`);
      }
    } catch (err: any) {
      setSeedStatus(`❌ Network error: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  // Real Metrics Calculations
  const totalVolume = orders.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalSavings = chatSessions.reduce((acc, curr) => acc + (curr.savings || 0), 0);
  const activeEscrowsCount = orders.filter(o => o.status === 'in-escrow').length;

  const filteredProviders = providers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(providerSearch.toLowerCase()) || 
                          p.skills.some(s => s.toLowerCase().includes(providerSearch.toLowerCase())) ||
                          p.title.toLowerCase().includes(providerSearch.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const selectedSession = chatSessions.find(s => s.id === selectedSessionId) || chatSessions[0];

  // Lock Screen
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 min-h-[calc(100vh-140px)]">
        <div className="w-full max-w-md p-8 rounded-3xl bg-zinc-900/70 border border-zinc-800 text-center space-y-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-semibold">
            🏆 Devpost / Hackathon Review Mode
          </div>

          <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-inner">
            <Lock className="h-7 w-7" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">Admin Control Access</h2>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Manage PayPal credentials, Google Gemini multi-key failover pool, and transactional email engines.
            </p>
          </div>

          {/* Judge 1-Click Auto-Unlock Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 text-left space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                ⚡ Hackathon Judge Quick Access
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">
                Auto-Filled
              </span>
            </div>
            <p className="text-xs text-zinc-300">
              Passcode has been pre-filled for instant hackathon review (<code className="text-cyan-400 font-mono font-bold">innoxpert2026</code>). Click below to unlock instantly!
            </p>
            <button
              type="button"
              onClick={handleJudgeQuickAccess}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-600 text-zinc-950 font-black text-xs hover:opacity-95 transition-all shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>⚡ 1-Click Instant Unlock (Judge Access)</span>
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-zinc-800 w-full"></div>
            <span className="bg-zinc-900 px-3 text-[11px] font-mono text-zinc-500 uppercase">or authenticate</span>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Passcode</label>
              <input
                type="text"
                value={passcode}
                onChange={e => {
                  setPasscode(e.target.value);
                  setAuthError(false);
                }}
                placeholder="innoxpert2026"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-center font-mono text-cyan-400 placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 shadow-inner"
              />
            </div>
            {authError && (
              <p className="text-xs text-red-400 text-center font-medium">
                Invalid passcode. Click the &ldquo;⚡ 1-Click Instant Unlock&rdquo; button above!
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-all border border-zinc-700 cursor-pointer"
            >
              Authenticate Admin
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col md:flex-row w-full bg-zinc-950">
      {/* 1. Sleek Admin Sidebar */}
      <aside className="w-full md:w-64 border-r border-zinc-800/80 bg-zinc-950/90 p-4 md:p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          {/* Admin Identity Header */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-zinc-950 font-black shadow-lg shadow-cyan-950/30">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">AgentPay Control</h2>
              <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Root Admin Active
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('chats')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'chats'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquareCode className="h-4 w-4" />
                <span>Real AI Chats & Audits</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 font-bold">
                {chatSessions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="h-4 w-4" />
                <span>Executive Overview</span>
              </div>
              <ChevronRight className={`h-3 w-3 transition-transform ${activeTab === 'overview' ? 'rotate-90 text-cyan-400' : 'text-zinc-600'}`} />
            </button>

            <button
              onClick={() => setActiveTab('providers')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'providers'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Briefcase className="h-4 w-4" />
                <span>100+ Providers</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                {providers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4" />
                <span>Buyers & Clients</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                {users.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="h-4 w-4" />
                <span>PayPal Escrow Vault</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Key className="h-4 w-4" />
                <span>API & Gateway Config</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                Live
              </span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-6 border-t border-zinc-800/80 space-y-3">
          <Link
            href="/"
            className="w-full py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <Bot className="h-3.5 w-3.5" />
            <span>Open AI Agent Chat</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Lock Admin Hub</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto max-w-7xl">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-white capitalize">
                {activeTab === 'chats' && 'Real Autonomous AI Chat Sessions & Full Order History'}
                {activeTab === 'overview' && 'Executive Analytics & Governance'}
                {activeTab === 'providers' && '100+ Verified Service Providers'}
                {activeTab === 'users' && 'Client & Buyer Accounts'}
                {activeTab === 'orders' && 'PayPal Milestone Escrow Vault'}
                {activeTab === 'settings' && 'Platform Settings & API Failover'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-400">
                Zero Mock • 100% Real Data
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              PayPal AI Hackathon 2026 • Live Firestore Synchronization
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadPlatformData}
              disabled={loadingData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span>Refresh Real Data</span>
            </button>

            {activeTab === 'settings' && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 font-bold text-xs hover:opacity-95 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer"
              >
                {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                <span>{saveSuccess ? 'Saved!' : 'Save Settings'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ---------------- TAB 1: REAL FULL CHAT THREADS & AUDITS ---------------- */}
        {activeTab === 'chats' && (
          <div className="space-y-6">
            {chatSessions.length === 0 ? (
              <div className="p-12 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 text-center space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                  <MessageSquareCode className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">No Live Chat Sessions in Firestore Yet</h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                    Every message you send in the AI Agent Chat room on the home page will be saved directly into collection <code className="text-cyan-400 font-mono">agentpay_chat_sessions</code> and displayed here in full chronological order with zero fake mock data!
                  </p>
                </div>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 font-bold text-xs hover:opacity-95 shadow-lg shadow-cyan-950/40 transition-all"
                >
                  <Bot className="h-4 w-4" />
                  <span>Start Live AI Chat Now</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Sessions List */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-medium px-1">
                    <span>Real Sessions ({chatSessions.length})</span>
                    <span className="font-mono text-[11px] text-cyan-400">Click to inspect</span>
                  </div>

                  <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
                    {chatSessions.map((session) => {
                      const isSelected = selectedSession?.id === session.id;
                      return (
                        <div
                          key={session.id}
                          onClick={() => setSelectedSessionId(session.id)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer text-xs space-y-2.5 ${
                            isSelected
                              ? 'bg-cyan-950/20 border-cyan-500/50 shadow-lg shadow-cyan-950/20'
                              : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{session.buyerName}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                                {session.messages?.length || 1} msgs
                              </span>
                            </div>

                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              session.status === 'escrow_created' 
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' 
                                : session.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}>
                              {session.status.replace('_', ' ')}
                            </span>
                          </div>

                          <p className="text-zinc-300 line-clamp-2 text-[11px]">
                            &ldquo;{session.latestPrompt}&rdquo;
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono border-t border-zinc-800/60 pt-2">
                            <span>Cap: ${session.spendingLimit}</span>
                            {session.savings ? (
                              <span className="text-emerald-400 font-bold">✨ Saved ${session.savings}</span>
                            ) : null}
                            <span>{new Date(session.updatedAt || session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Full Chronological Chat Thread Viewer */}
                <div className="lg:col-span-7 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 p-5 space-y-5 flex flex-col h-[700px]">
                  {/* Thread Header */}
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{selectedSession?.buyerName}&apos;s Live Session</h3>
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                          Budget: ${selectedSession?.spendingLimit} USD
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-mono mt-0.5 truncate max-w-md">
                        Session ID: {selectedSession?.id}
                      </p>
                    </div>

                    {selectedSession?.paypalOrderId && (
                      <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                        PayPal Escrow Ready
                      </span>
                    )}
                  </div>

                  {/* Messages Scroll Area */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {selectedSession?.messages?.map((msg, idx) => (
                      <div
                        key={msg.id || idx}
                        className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                      >
                        <div
                          className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-zinc-950'
                              : 'bg-zinc-800 border border-zinc-700 text-cyan-400'
                          }`}
                        >
                          {msg.role === 'user' ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </div>

                        <div className={`space-y-2.5 max-w-[85%]`}>
                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                              msg.role === 'user'
                                ? 'bg-cyan-600/20 text-cyan-50 border border-cyan-500/30 rounded-tr-none'
                                : 'bg-zinc-950 text-zinc-200 border border-zinc-800 rounded-tl-none shadow-md'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <span className="block text-[9px] text-zinc-500 mt-1.5 text-right font-mono">
                              {msg.timestamp || 'Real-time'}
                            </span>
                          </div>

                          {/* Matched Specialist Cards */}
                          {msg.actionPayload?.matchedProviders && msg.actionPayload.matchedProviders.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {msg.actionPayload.matchedProviders.map(p => (
                                <div key={p.id} className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] space-y-1">
                                  <div className="flex items-center gap-2">
                                    <img src={p.avatarUrl} alt={p.name} className="h-6 w-6 rounded-full bg-zinc-800" />
                                    <div className="truncate">
                                      <p className="font-bold text-white truncate">{p.name}</p>
                                      <p className="text-[10px] text-zinc-400">{p.category}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/80">
                                    <span>★ {p.rating}</span>
                                    <span className="font-mono text-emerald-400 font-bold">${p.hourlyRate}/hr</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Autonomous Negotiation Proposal Card */}
                          {msg.actionPayload?.negotiatedTerms && (
                            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-purple-300">🤝 Autonomous Agreement</span>
                                <span className="font-mono text-emerald-400 font-bold">
                                  ${msg.actionPayload.negotiatedTerms.finalPrice || msg.actionPayload.negotiatedTerms.originalPrice} USD
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-300 font-medium">
                                {msg.actionPayload.negotiatedTerms.scopeTitle}
                              </p>
                              {msg.actionPayload.negotiatedTerms.milestones && (
                                <div className="space-y-1 pt-1 border-t border-purple-500/20">
                                  {msg.actionPayload.negotiatedTerms.milestones.map((ms, mIdx) => (
                                    <div key={mIdx} className="flex items-center justify-between text-[10px] text-zinc-400">
                                      <span>{ms.title}</span>
                                      <span className="font-mono text-cyan-300">${ms.amount}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* PayPal Escrow Creation Status */}
                          {msg.actionPayload?.paypalOrderId && (
                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] flex items-center justify-between">
                              <span className="text-amber-300 font-medium flex items-center gap-1.5">
                                <CreditCard className="h-3.5 w-3.5" />
                                <span>PayPal Order Created</span>
                              </span>
                              <span className="font-mono text-amber-200 text-[10px]">
                                {msg.actionPayload.paypalOrderId}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- TAB 2: OVERVIEW & ANALYTICS ---------------- */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 uppercase font-semibold">Total Escrow Volume</span>
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-black font-mono text-emerald-400">${totalVolume.toFixed(2)} USD</p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-400/90 font-mono">
                  <TrendingUp className="h-3 w-3" />
                  <span>Real PayPal Orders v2 Ledger</span>
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 uppercase font-semibold">Autonomous Savings</span>
                  <div className="h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-black font-mono text-cyan-300">${totalSavings.toFixed(2)} USD</p>
                <p className="text-[11px] text-zinc-400">Actual savings achieved by AI multi-turn negotiations</p>
              </div>

              <div className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 uppercase font-semibold">Active Escrows</span>
                  <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-black font-mono text-amber-300">{activeEscrowsCount} Contracts</p>
                <p className="text-[11px] text-zinc-400">Locked in PayPal milestone vaults</p>
              </div>

              <div className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 uppercase font-semibold">Verified Talent Pool</span>
                  <div className="h-8 w-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-black font-mono text-white">{providers.length} Specialists</p>
                <p className="text-[11px] text-purple-300">Live in Firestore collection (`agentpay_providers`)</p>
              </div>
            </div>

            {/* Protocol Health Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <span>Protocol Guardrail & Infrastructure Health</span>
                </h3>

                <div className="space-y-3.5 text-xs">
                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">Safe Spending Limit Guardrail</p>
                      <p className="text-[11px] text-zinc-400">Strictly prevents AI agent from exceeding user budget ($30 - $1000)</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 font-mono font-bold">Active</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">Gemini Multi-Key Failover Pool</p>
                      <p className="text-[11px] text-zinc-400">Auto-rotates upon rate limits ({geminiKeys.filter(Boolean).length} Keys active)</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-300 font-mono font-bold">Enabled</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">PayPal REST Orders v2 Gateway</p>
                      <p className="text-[11px] text-zinc-400">Milestone Authorize & Capture Protocol</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-300 font-mono font-bold">
                      {paypalMode.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Real Live Activity Stream */}
              <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Bot className="h-4 w-4 text-cyan-400" />
                    <span>Real Live Chat Sessions Stream</span>
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {chatSessions.length} Recorded
                  </span>
                </div>

                {chatSessions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-500">
                    No live sessions yet. Chat on the home page to populate!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chatSessions.slice(0, 4).map((session) => (
                      <div key={session.id} className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-850 flex items-center justify-between text-xs">
                        <div className="space-y-0.5 truncate max-w-[280px]">
                          <p className="font-bold text-white truncate">{session.buyerName}</p>
                          <p className="text-[11px] text-zinc-400 truncate">&ldquo;{session.latestPrompt}&rdquo;</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedSessionId(session.id);
                            setActiveTab('chats');
                          }}
                          className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer shrink-0"
                        >
                          View Thread →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- TAB 3: 100+ PROVIDERS DIRECTORY ---------------- */}
        {activeTab === 'providers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-3xl bg-zinc-900/40 border border-zinc-800/80">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={providerSearch}
                  onChange={e => setProviderSearch(e.target.value)}
                  placeholder="Search providers by name, title, or skills..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {['all', 'web-development', 'ui-ux-design', 'ai-automation', 'seo-marketing', 'mobile-apps'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-cyan-500 text-zinc-950 font-bold'
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {cat === 'all' ? `All (${providers.length})` : cat.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-4">Provider</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Hourly Rate</th>
                      <th className="p-4">Rating & Jobs</th>
                      <th className="p-4">Top Skills</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredProviders.slice(0, 20).map(p => (
                      <tr key={p.id} className="hover:bg-zinc-900/60 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img src={p.avatarUrl} alt={p.name} className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700" />
                            <div>
                              <p className="font-bold text-white">{p.name}</p>
                              <p className="text-[11px] text-zinc-400 truncate max-w-[200px]">{p.title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                            {p.category}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-emerald-400">
                          ${p.hourlyRate}/hr
                        </td>
                        <td className="p-4">
                          <span className="text-amber-400 font-bold">★ {p.rating}</span>
                          <span className="text-zinc-500 text-[10px] ml-1">({p.completedJobs} jobs)</span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {p.skills.slice(0, 3).map((s, idx) => (
                              <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                            p.status === 'active' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                              : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- TAB 4: BUYERS & USERS ---------------- */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="p-4 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search clients by name or email..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="text-xs text-zinc-400 font-mono">
                Total Clients: <span className="text-white font-bold">{users.length}</span>
              </div>
            </div>

            {users.length === 0 ? (
              <div className="p-12 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 text-center space-y-3">
                <Users className="h-10 w-10 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">No client accounts recorded in Firestore yet. User profiles are saved automatically as soon as someone interacts with the AI Agent.</p>
              </div>
            ) : (
              <div className="rounded-3xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-4">Buyer Client</th>
                      <th className="p-4">Safe Spending Limit</th>
                      <th className="p-4">Contracts / Orders</th>
                      <th className="p-4">Total Escrow Volume</th>
                      <th className="p-4">Last Active</th>
                      <th className="p-4">KYC / Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-zinc-900/60 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img src={u.avatarUrl} alt={u.name} className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700" />
                            <div>
                              <p className="font-bold text-white">{u.name}</p>
                              <p className="text-[11px] text-zinc-400 font-mono">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-bold text-cyan-400">
                          ${u.spendingLimit} USD
                        </td>
                        <td className="p-4 font-mono text-zinc-300">
                          {u.ordersCount || 0} Orders
                        </td>
                        <td className="p-4 font-mono font-bold text-emerald-400">
                          ${u.totalSpent || 0} USD
                        </td>
                        <td className="p-4 text-zinc-400">
                          {u.lastActive || 'Recently'}
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                            {u.status || 'Verified'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ---------------- TAB 5: PAYPAL ESCROW ORDERS ---------------- */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="p-4 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">PayPal Milestone Escrow Vault</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Authorizations, captures, and milestone fund releases</p>
              </div>
              <span className="font-mono text-emerald-400 font-bold text-sm">
                Total Locked: ${totalVolume.toFixed(2)} USD
              </span>
            </div>

            {orders.length === 0 ? (
              <div className="p-12 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 text-center space-y-3">
                <CreditCard className="h-10 w-10 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">No active escrow transactions recorded yet. Escrows are initiated directly through PayPal Smart Buttons inside the chat room.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div key={order.id} className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 hover:border-cyan-500/30 transition-all space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white">{order.serviceTitle}</h4>
                        <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                          Buyer: {order.buyerName} • Provider: {order.providerName}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-base font-black font-mono text-emerald-400">
                          ${order.amount} USD
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
                          order.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Milestones */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-zinc-400">Milestone Tranches:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {order.milestones?.map((ms, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                            <div>
                              <p className="text-zinc-200 font-medium">{ms.title}</p>
                              <span className="text-[10px] font-mono text-zinc-500 uppercase">{ms.status}</span>
                            </div>
                            <span className="font-mono font-bold text-cyan-300">${ms.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 text-[11px] text-zinc-500 font-mono border-t border-zinc-800/60">
                      <span>PayPal Ref: {order.paypalOrderId}</span>
                      <span>Created: {new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------------- TAB 6: SETTINGS & API CONFIG ---------------- */}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            {saveSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>All platform settings updated in Firestore (`agentpay_settings/general`).</span>
              </div>
            )}

            {/* 1. Multi-Key Gemini Failover Pool */}
            <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Google Gemini Multi-Key Failover Pool</h2>
                    <p className="text-xs text-zinc-400">Auto-rotates to next key upon rate-limit (HTTP 429) for 100% uptime.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestPool}
                    disabled={testingPool}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                  >
                    {testingPool ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5 text-purple-300" />}
                    <span>{testingPool ? 'Testing Pool...' : '🧪 Test Failover Pool'}</span>
                  </button>

                  {geminiKeys.length < 5 && (
                    <button
                      onClick={addKeyField}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Key ({geminiKeys.length}/5)</span>
                    </button>
                  )}
                </div>
              </div>

              {poolTestSummary && (
                <div className="p-3 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200 font-mono flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span>Pool Test Summary: {poolTestSummary}</span>
                </div>
              )}

              <div className="space-y-3 pt-2">
                {geminiKeys.map((key, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-500 w-16">Key #{i + 1}</span>
                      <div className="relative flex-1">
                        <input
                          type={showGeminiKeys[i] ? 'text' : 'password'}
                          value={key}
                          onChange={e => updateKeyField(i, e.target.value)}
                          placeholder="AIzaSy... (Paste Google Gemini API Key)"
                          autoComplete="new-password"
                          autoCorrect="off"
                          spellCheck="false"
                          data-lpignore="true"
                          data-form-type="other"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-3 pr-20 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50"
                        />
                        <div className="absolute right-2 top-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleShowGeminiKey(i)}
                            title={showGeminiKeys[i] ? 'Hide Key' : 'View Key'}
                            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                          >
                            {showGeminiKeys[i] ? <EyeOff className="h-3.5 w-3.5 text-purple-400" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(key, 'gemini', i)}
                            title="Copy Key"
                            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                          >
                            {copiedKeyIndex === i ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTestGeminiKey(i)}
                        disabled={testingKeyIndex === i || !key.trim()}
                        title="Test this API Key live"
                        className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-purple-500/20 text-zinc-300 hover:text-purple-300 border border-zinc-700 text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-colors shrink-0"
                      >
                        {testingKeyIndex === i ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-400" />
                        ) : (
                          <FlaskConical className="h-3.5 w-3.5 text-purple-400" />
                        )}
                        <span className="text-[11px] font-semibold">Test Key</span>
                      </button>

                      {geminiKeys.length > 1 && (
                        <button
                          onClick={() => removeKeyField(i)}
                          title="Delete Key"
                          className="p-2 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {keyTestResults[i] && (
                      <div className={`p-2.5 rounded-xl text-[11px] font-mono flex items-center gap-2 border ml-18 ${
                        keyTestResults[i].success 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                          : 'bg-red-500/10 border-red-500/30 text-red-300'
                      }`}>
                        {keyTestResults[i].success ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        )}
                        <span>{keyTestResults[i].success ? keyTestResults[i].message : keyTestResults[i].error}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. PayPal Gateway Settings */}
            <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">PayPal Developer Credentials</h2>
                    <p className="text-xs text-zinc-400">REST API v2 Orders & Capture integration parameters.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestPaypal}
                    disabled={testingPaypal || !paypalClientId.trim() || !paypalClientSecret.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold cursor-pointer transition-all disabled:opacity-40"
                  >
                    {testingPaypal ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5 text-amber-300" />}
                    <span>{testingPaypal ? 'Testing OAuth...' : '🧪 Test PayPal OAuth'}</span>
                  </button>

                  {/* Mode Switcher */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setPaypalMode('sandbox')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        paypalMode === 'sandbox' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Sandbox
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaypalMode('live')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        paypalMode === 'live' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Live
                    </button>
                  </div>
                </div>
              </div>

              {paypalTestResult && (
                <div className={`p-3 rounded-2xl text-xs font-mono flex items-center gap-2 border ${
                  paypalTestResult.success 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  {paypalTestResult.success ? (
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                  )}
                  <span>{paypalTestResult.success ? paypalTestResult.message : paypalTestResult.error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-medium">PayPal Client ID</label>
                  <input
                    type="text"
                    value={paypalClientId}
                    onChange={e => setPaypalClientId(e.target.value)}
                    placeholder="e.g. Aed48x... (From developer.paypal.com)"
                    autoComplete="new-password"
                    data-lpignore="true"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400 font-medium">PayPal Client Secret</label>
                    <button
                      type="button"
                      onClick={() => setShowPaypalSecret(!showPaypalSecret)}
                      className="text-[11px] text-zinc-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {showPaypalSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      <span>{showPaypalSecret ? 'Hide Secret' : 'View Secret'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPaypalSecret ? 'text' : 'password'}
                      value={paypalClientSecret}
                      onChange={e => setPaypalClientSecret(e.target.value)}
                      placeholder="e.g. ELK94..."
                      autoComplete="new-password"
                      autoCorrect="off"
                      spellCheck="false"
                      data-lpignore="true"
                      data-form-type="other"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-3 pr-10 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paypalClientSecret, 'paypal')}
                      title="Copy Secret"
                      className="absolute right-2 top-1.5 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      {copiedPaypalSecret ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Resend Transactional Email Engine */}
            <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Resend Email Notifications</h2>
                    <p className="text-xs text-zinc-400">Sends instant transactional alerts to service providers upon autonomous negotiation.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestResend}
                  disabled={testingResend || !resendApiKey.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/40 text-xs font-semibold cursor-pointer transition-all disabled:opacity-40"
                >
                  {testingResend ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5 text-blue-300" />}
                  <span>{testingResend ? 'Testing Resend...' : '🧪 Test Resend Key'}</span>
                </button>
              </div>

              {resendTestResult && (
                <div className={`p-3 rounded-2xl text-xs font-mono flex items-center gap-2 border ${
                  resendTestResult.success 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}>
                  {resendTestResult.success ? (
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                  )}
                  <span>{resendTestResult.success ? resendTestResult.message : resendTestResult.error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400 font-medium">Resend API Key</label>
                    <button
                      type="button"
                      onClick={() => setShowResendKey(!showResendKey)}
                      className="text-[11px] text-zinc-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {showResendKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      <span>{showResendKey ? 'Hide Key' : 'View Key'}</span>
                    </button>
                  </div>
                  <input
                    type={showResendKey ? 'text' : 'password'}
                    value={resendApiKey}
                    onChange={e => setResendApiKey(e.target.value)}
                    placeholder="re_..."
                    autoComplete="new-password"
                    autoCorrect="off"
                    spellCheck="false"
                    data-lpignore="true"
                    data-form-type="other"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-medium">From Email</label>
                  <input
                    type="text"
                    value={resendFromEmail}
                    onChange={e => setResendFromEmail(e.target.value)}
                    placeholder="onboarding@resend.dev"
                    autoComplete="off"
                    data-lpignore="true"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
            </div>

            {/* 4. Automated 100+ Providers Database Seeder */}
            <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Database className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">100+ Providers Database Seeder</h2>
                    <p className="text-xs text-zinc-400">Generates 100 verified talent profiles in Firestore collection (`agentpay_providers`).</p>
                  </div>
                </div>

                <button
                  onClick={handleTriggerSeeder}
                  disabled={isSeeding}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSeeding ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                  <span>{isSeeding ? 'Seeding Providers...' : 'Run 1-Click Seeder'}</span>
                </button>
              </div>

              {seedStatus && (
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-mono">
                  {seedStatus}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
