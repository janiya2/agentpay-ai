'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Bot, ShieldCheck, Briefcase, CreditCard, Settings, Sparkles, User, LogOut, 
  Layers, ArrowRight, ShieldAlert, CheckCircle2 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/AuthModal';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function Navbar() {
  const pathname = usePathname();
  const { user, openAuthModal, logout } = useAuth();
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
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-2xl w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 h-18 flex items-center justify-between gap-4">
          
          {/* Brand & Platform Identity */}
          <div className="flex items-center gap-4 shrink-0">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#003087] via-[#0070BA] to-[#00CFDE] p-[1.5px] shadow-lg shadow-cyan-950/60 group-hover:scale-105 transition-transform">
                <div className="h-full w-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                  <Bot className="h-5 w-5 text-cyan-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-lg text-white tracking-tight">AgentPay</span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 uppercase tracking-wide">
                    AI
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 font-medium tracking-tight">Autonomous PayPal Multi-Agent Platform</p>
              </div>
            </Link>

            {/* Micro divider */}
            <div className="hidden xl:block h-6 w-px bg-zinc-800" />
          </div>

          {/* Structured Navigation Hub - Grouped by Workflow */}
          <nav className="hidden lg:flex items-center gap-2">
            
            {/* Group 1: Client Procurement & Orders */}
            <div className="flex items-center p-1 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
              <Link
                href="/"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  pathname === '/'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Bot className={`h-4 w-4 ${pathname === '/' ? 'text-cyan-400' : 'text-zinc-500'}`} />
                <span>AI Procurement</span>
              </Link>

              {/* CLIENT ORDERS & ESCROW VAULT - Prominently highlighted */}
              <Link
                href="/orders"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all relative ${
                  pathname === '/orders'
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <CreditCard className={`h-4 w-4 ${pathname === '/orders' ? 'text-emerald-400' : 'text-zinc-400'}`} />
                <span className="font-bold">Client Orders & Escrow</span>
                {ordersCount !== null && ordersCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                    {ordersCount}
                  </span>
                )}
              </Link>

              <Link
                href="/services"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  pathname === '/services'
                    ? 'bg-zinc-800 text-cyan-300 border border-zinc-700 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Briefcase className={`h-4 w-4 ${pathname === '/services' ? 'text-cyan-400' : 'text-zinc-500'}`} />
                <span>Talent Directory</span>
              </Link>
            </div>

            {/* Group 2: Provider Workspace */}
            <div className="flex items-center p-1 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
              <Link
                href="/providers"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  pathname === '/providers'
                    ? 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Layers className={`h-4 w-4 ${pathname === '/providers' ? 'text-purple-400' : 'text-zinc-500'}`} />
                <span>Provider Workspace</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  RFQs Live
                </span>
              </Link>
            </div>

            {/* Group 3: Admin & Revenue Governance */}
            <div className="flex items-center p-1 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
              <Link
                href="/admin"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  pathname === '/admin'
                    ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Settings className={`h-4 w-4 ${pathname === '/admin' ? 'text-amber-400' : 'text-zinc-500'}`} />
                <span>Admin & Revenue</span>
              </Link>
            </div>

          </nav>

          {/* User Auth, Sandbox Status & Quick Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Live PayPal Sandbox Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
              <span className="font-mono font-semibold text-emerald-400">PayPal v2 Live</span>
            </div>

            {/* Client / Judge Identity */}
            {user ? (
              <div className="flex items-center gap-2 pl-1">
                <Link
                  href="/orders"
                  className="flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-cyan-500/40 transition-all text-xs group"
                >
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-8 w-8 rounded-xl bg-zinc-800 border border-cyan-500/40 object-cover"
                  />
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate max-w-[120px] leading-tight">
                      {user.name.split(' ')[0]}
                    </p>
                    <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                      ${user.spendingLimit} Cap • <strong className="text-zinc-300">{user.role === 'judge' ? 'Judge' : 'Client'}</strong>
                    </span>
                  </div>
                </Link>
                <button
                  onClick={() => logout()}
                  title="Sign Out / Switch Identity"
                  className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-zinc-950 font-bold text-xs hover:opacity-95 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Client Access / Judge Demo</span>
              </button>
            )}

            {/* Quick Action: New AI RFP */}
            <Link
              href="/"
              className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 border border-zinc-700 text-cyan-300 font-bold text-xs transition-all shadow-md"
            >
              <Bot className="h-3.5 w-3.5 text-cyan-400" />
              <span>New AI RFP</span>
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
            <span>My Orders</span>
            {ordersCount !== null && ordersCount > 0 && (
              <span className="px-1 text-[9px] font-mono bg-emerald-500/20 text-emerald-300 rounded-full font-bold">
                {ordersCount}
              </span>
            )}
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

      {/* Global Auth Modal */}
      <AuthModal />
    </>
  );
}
