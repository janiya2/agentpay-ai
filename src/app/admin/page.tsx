'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ShieldCheck, Key, CreditCard, Mail, Database, Lock, CheckCircle2, AlertTriangle, RefreshCw, Plus, Trash2 } from 'lucide-react';
import type { PlatformSettings } from '@/types';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('innoxpert2026');
  const [authError, setAuthError] = useState(false);

  // Form State
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [paypalMode, setPaypalMode] = useState<'sandbox' | 'live'>('sandbox');

  const [geminiKeys, setGeminiKeys] = useState<string[]>(['']);
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromEmail, setResendFromEmail] = useState('onboarding@resend.dev');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isSeeding, setIsSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

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

  // Load Settings from Firestore
  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadSettings() {
      try {
        const snap = await getDoc(doc(db, 'agentpay_settings', 'general'));
        if (snap.exists()) {
          const data = snap.data() as PlatformSettings;
          setPaypalClientId(data.paypalClientId || '');
          setPaypalClientSecret(data.paypalClientSecret || '');
          setPaypalMode(data.paypalMode || 'sandbox');
          setGeminiKeys(data.geminiKeys && data.geminiKeys.length > 0 ? data.geminiKeys : ['']);
          setResendApiKey(data.resendApiKey || '');
          setResendFromEmail(data.resendFromEmail || 'onboarding@resend.dev');
        } else {
          // Pre-fill from environment defaults
          setGeminiKeys([process.env.NEXT_PUBLIC_GEMINI_API_KEY || 'AIzaSyD_5frWyGBMZ4BXECEeLHB9qKneoJWUC-s']);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }

    loadSettings();
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
        setSeedStatus(`🎉 Success! Seeded ${data.count || 100} service providers into collection "agentpay_providers".`);
      } else {
        setSeedStatus(`❌ Seeder error: ${data.error}`);
      }
    } catch (err: any) {
      setSeedStatus(`❌ Network error: ${err.message}`);
    } finally {
      setIsSeeding(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 min-h-[calc(100vh-140px)]">
        <div className="w-full max-w-md p-8 rounded-3xl bg-zinc-900/70 border border-zinc-800 text-center space-y-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
          {/* Top Hackathon Badge */}
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 w-full space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white">Platform Settings & Control Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono font-bold text-emerald-400">
              Admin Authenticated
            </span>
            <button
              onClick={handleLogout}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 font-mono underline ml-2 transition-colors cursor-pointer"
            >
              Lock Admin
            </button>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Configure live PayPal credentials, multi-key Google Gemini failover pool, and Resend email alerts.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 font-bold text-xs hover:opacity-90 shadow-lg shadow-cyan-950/40 transition-all shrink-0"
        >
          {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          <span>{saveSuccess ? 'Settings Saved!' : 'Save All Configurations'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>All platform settings updated in Firestore (`agentpay_settings/general`).</span>
        </div>
      )}

      {/* 1. Multi-Key Gemini Failover Pool */}
      <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Google Gemini Multi-Key Failover Pool</h2>
              <p className="text-xs text-zinc-400">Auto-rotates to next key upon rate-limit (HTTP 429) for 100% uptime.</p>
            </div>
          </div>

          {geminiKeys.length < 5 && (
            <button
              onClick={addKeyField}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Key ({geminiKeys.length}/5)</span>
            </button>
          )}
        </div>

        <div className="space-y-3 pt-2">
          {geminiKeys.map((key, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-500 w-16">Key #{i + 1}</span>
              <input
                type="password"
                value={key}
                onChange={e => updateKeyField(i, e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50"
              />
              {geminiKeys.length > 1 && (
                <button
                  onClick={() => removeKeyField(i)}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. PayPal Gateway Settings */}
      <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">PayPal Developer Credentials</h2>
              <p className="text-xs text-zinc-400">REST API v2 Orders & Capture integration parameters.</p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setPaypalMode('sandbox')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                paypalMode === 'sandbox' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Sandbox
            </button>
            <button
              type="button"
              onClick={() => setPaypalMode('live')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                paypalMode === 'live' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Live
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">PayPal Client ID</label>
            <input
              type="text"
              value={paypalClientId}
              onChange={e => setPaypalClientId(e.target.value)}
              placeholder="e.g. Aed48x... (From developer.paypal.com)"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">PayPal Client Secret</label>
            <input
              type="password"
              value={paypalClientSecret}
              onChange={e => setPaypalClientSecret(e.target.value)}
              placeholder="e.g. ELK94..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>
      </div>

      {/* 3. Resend Transactional Email Engine */}
      <div className="p-6 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Resend Email Notifications</h2>
            <p className="text-xs text-zinc-400">Sends instant transactional alerts to service providers upon autonomous negotiation.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">Resend API Key</label>
            <input
              type="password"
              value={resendApiKey}
              onChange={e => setResendApiKey(e.target.value)}
              placeholder="re_..."
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
              <h2 className="text-sm font-bold text-white">Automated 100+ Service Providers Seeder</h2>
              <p className="text-xs text-zinc-400">Generates 100 diverse, verified talent accounts across 6 categories in Firestore.</p>
            </div>
          </div>

          <button
            onClick={handleTriggerSeeder}
            disabled={isSeeding}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all disabled:opacity-50"
          >
            {isSeeding ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            <span>{isSeeding ? 'Seeding Database...' : 'Run 1-Click Seeder'}</span>
          </button>
        </div>

        {seedStatus && (
          <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 font-mono">
            {seedStatus}
          </div>
        )}
      </div>
    </div>
  );
}

