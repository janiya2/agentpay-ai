'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Bot, ShieldCheck, Briefcase, CreditCard, Settings, Sparkles, User, LogOut, 
  Layers, ArrowRight, ShieldAlert, CheckCircle2, Award, Network 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useJudgeTour } from '@/context/JudgeTourContext';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function Navbar() {
  const pathname = usePathname();
  const { user, openAuthModal, logout } = useAuth();
  const { openTourModal, openWebhooksModal, openArchitectureModal } = useJudgeTour();
  const [ordersCount, setOrdersCount] = useState<number | null>(null);

  // Background fetch of active client orders count to highlight in header
  useEffect(() => {
    let isMounted = true;
    async function fetchOrdersCount() {
      try {
        const snap = await getDocs(collection(db, 'agentpay_orders'));
        if (!snap.empty && isMounted) {
          setOrdersCount(snap.docs.length);
        }
      } catch (e) {
        // silent fallback
      }
    }
    fetchOrdersCount();
    return () => { isMounted = false; };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-xl w-full">
      <div className="w-full max-w-[1750px] mx-auto px-3 sm:px-5 lg:px-6 h-16 flex items-center justify-between gap-3">
        
        {/* 1. Brand & Identity */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative h-9 w-9 rounded-xl shadow-md shadow-cyan-950/50 group-hover:scale-105 transition-transform overflow-hidden">
              <img 
                src="/images/agentpay-logo.svg" 
                alt="AgentPay AI Logo" 
                className="h-full w-full object-cover rounded-xl"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base sm:text-lg text-white tracking-tight leading-none">AgentPay</span>
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 uppercase tracking-wide">
                  AI
                </span>
              </div>
              <p className="text-[9px] text-zinc-400 font-medium tracking-tight hidden sm:block mt-0.5">
                Autonomous PayPal Agentic Platform
              </p>
            </div>
          </Link>
        </div>

        {/* 2. Unified Modern Navigation Capsule */}
        <nav className="hidden lg:flex items-center p-1 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-inner">
          {/* AI Procurement */}
          <Link
            href="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname === '/'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Bot className={`h-3.5 w-3.5 ${pathname === '/' ? 'text-cyan-400' : 'text-zinc-500'}`} />
            <span>AI Procurement</span>
          </Link>

          {/* Client Orders & Escrow */}
          <Link
            href="/orders"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all relative ${
              pathname === '/orders'
                ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            <CreditCard className={`h-3.5 w-3.5 ${pathname === '/orders' ? 'text-emerald-400' : 'text-zinc-400'}`} />
            <span>Orders &amp; Escrow</span>
            {ordersCount !== null && ordersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                {ordersCount}
              </span>
            )}
          </Link>

          {/* Provider Workspace */}
          <Link
            href="/providers"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname === '/providers'
                ? 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Layers className={`h-3.5 w-3.5 ${pathname === '/providers' ? 'text-purple-400' : 'text-zinc-500'}`} />
            <span>Providers</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Live
            </span>
          </Link>

          {/* Transactions Ledger */}
          <Link
            href="/transactions"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname === '/transactions'
                ? 'bg-gradient-to-r from-teal-500/20 to-emerald-500/20 text-teal-300 border border-teal-500/40 shadow-sm font-bold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
            title="Transactions & Escrow Ledger"
          >
            <ShieldCheck className={`h-3.5 w-3.5 ${pathname === '/transactions' ? 'text-teal-400' : 'text-zinc-500'}`} />
            <span className="hidden xl:inline">Transactions</span>
          </Link>

          {/* Talent Directory */}
          <Link
            href="/services"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname === '/services'
                ? 'bg-zinc-800 text-cyan-300 border border-zinc-700 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Briefcase className={`h-3.5 w-3.5 ${pathname === '/services' ? 'text-cyan-400' : 'text-zinc-500'}`} />
            <span className="hidden xl:inline">Talent</span>
          </Link>

          {/* Admin & Revenue */}
          <Link
            href="/admin"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              pathname === '/admin'
                ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Settings className={`h-3.5 w-3.5 ${pathname === '/admin' ? 'text-amber-400' : 'text-zinc-500'}`} />
            <span>Admin</span>
          </Link>
        </nav>

        {/* 3. Right Side: Judge Tour, Telemetry, Identity & Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          
          {/* ⚡ 1-Click Judge Guided Tour Button */}
          <button
            onClick={openTourModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/10 hover:from-amber-500/30 hover:to-yellow-500/20 border border-amber-500/40 hover:border-amber-400 text-amber-300 text-xs font-semibold shadow-md shadow-amber-950/40 transition-all cursor-pointer group"
            title="Open Judge 1-Click Guided Tour & 6 Scenarios"
          >
            <Award className="h-3.5 w-3.5 text-amber-400 group-hover:rotate-12 transition-transform shrink-0" />
            <span className="font-bold bg-gradient-to-r from-amber-200 to-yellow-300 bg-clip-text text-transparent">
              Judge Tour
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              12 Stages
            </span>
          </button>

          {/* 🏛️ System Architecture Blueprint Pill */}
          <button
            type="button"
            onClick={openArchitectureModal}
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/40 hover:bg-cyan-950/70 border border-cyan-500/40 hover:border-cyan-400 text-[11px] text-cyan-300 font-mono shadow-sm transition-all cursor-pointer group"
            title="Inspect 4-Tier Interactive System Architecture & Protocol Matrix"
          >
            <Network className="h-3.5 w-3.5 text-cyan-400 group-hover:rotate-45 transition-transform" />
            <span className="font-bold">Architecture</span>
          </button>

          {/* PayPal v2 Live Telemetry Trigger */}
          <button
            type="button"
            onClick={openWebhooksModal}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-500/40 hover:border-emerald-400 text-[11px] text-emerald-400 font-mono shadow-md shadow-emerald-950/40 transition-all cursor-pointer group"
            title="Inspect Live PayPal Webhooks Stream & Cryptographic HMAC Verification"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold group-hover:text-emerald-300">PayPal v2 Live</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              HMAC
            </span>
          </button>

          {/* User Identity / Auth */}
          {user ? (
            <div className="flex items-center gap-1.5 pl-0.5">
              <Link
                href="/orders"
                className="flex items-center gap-2 p-1 pr-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-cyan-500/40 transition-all text-xs group"
                title="Client Dashboard & Active Spending Cap"
              >
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-7 w-7 rounded-lg bg-zinc-800 border border-cyan-500/40 object-cover"
                />
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate max-w-[90px] leading-tight">
                    {user.name.split(' ')[0]}
                  </p>
                  <span className="text-[9px] font-mono text-cyan-400 block -mt-0.5">
                    ${user.spendingLimit} Cap
                  </span>
                </div>
              </Link>
              <button
                onClick={() => logout()}
                title="Sign Out / Switch Identity"
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 font-bold text-xs hover:opacity-95 shadow-md shadow-cyan-950/40 transition-all cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Judge Pass</span>
            </button>
          )}

          {/* Quick Action: New AI RFP */}
          <Link
            href="/?scenario=procurement"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-black text-xs shadow-md shadow-cyan-950/30 transition-all shrink-0"
            title="Launch New Autonomous RFP"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>New RFP</span>
          </Link>
        </div>
      </div>

      {/* Mobile Navigation Row (under 1024px) */}
      <div className="lg:hidden flex items-center justify-around border-t border-zinc-800/60 bg-zinc-950/90 py-2 px-3 text-xs">
        <Link
          href="/"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${pathname === '/' ? 'text-cyan-400 font-bold' : 'text-zinc-400'}`}
        >
          <Bot className="h-3.5 w-3.5" />
          <span>AI Chat</span>
        </Link>
        <Link
          href="/orders"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${pathname === '/orders' ? 'text-emerald-400 font-bold' : 'text-zinc-400'}`}
        >
          <CreditCard className="h-3.5 w-3.5" />
          <span>Orders</span>
          {ordersCount !== null && ordersCount > 0 && (
            <span className="px-1 text-[9px] font-mono bg-emerald-500/20 text-emerald-300 rounded-full font-bold">
              {ordersCount}
            </span>
          )}
        </Link>
        <Link
          href="/transactions"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${pathname === '/transactions' ? 'text-teal-400 font-bold' : 'text-zinc-400'}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Ledger</span>
        </Link>
        <Link
          href="/providers"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${pathname === '/providers' ? 'text-purple-400 font-bold' : 'text-zinc-400'}`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Providers</span>
        </Link>
        <Link
          href="/admin"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${pathname === '/admin' ? 'text-amber-400 font-bold' : 'text-zinc-400'}`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Admin</span>
        </Link>
      </div>
    </header>
  );
}
