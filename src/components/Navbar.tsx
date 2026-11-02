'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, ShieldCheck, Briefcase, CreditCard, Settings, Sparkles, User, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/AuthModal';

export default function Navbar() {
  const pathname = usePathname();
  const { user, openAuthModal, logout } = useAuth();

  const navLinks = [
    { href: '/', label: 'AI Agent Chat', icon: Bot },
    { href: '/services', label: '100+ Providers', icon: Briefcase },
    { href: '/providers', label: 'Provider Portal', icon: ShieldCheck },
    { href: '/orders', label: 'Escrow Vault', icon: CreditCard },
    { href: '/admin', label: 'Admin Settings', icon: Settings },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#003087] via-[#0070BA] to-[#00CFDE] p-[1.5px] shadow-lg shadow-cyan-950/50">
              <div className="h-full w-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Bot className="h-5 w-5 text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg text-white tracking-tight">AgentPay</span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">AI</span>
              </div>
              <p className="text-[10px] text-zinc-500 font-medium">Autonomous PayPal Commerce</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-zinc-800 text-cyan-300 border border-zinc-700 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Auth & Actions */}
          <div className="flex items-center gap-2.5">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-zinc-300">PayPal Sandbox</span>
            </div>

            {user ? (
              <div className="flex items-center gap-2 pl-1">
                <Link
                  href="/orders"
                  className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-cyan-500/40 transition-all text-xs"
                >
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-7 w-7 rounded-full bg-zinc-800 border border-cyan-500/40"
                  />
                  <div className="text-left hidden sm:block">
                    <p className="text-[11px] font-bold text-white truncate max-w-[120px] leading-tight">
                      {user.name.split(' ')[0]}
                    </p>
                    <span className="text-[9px] font-mono text-cyan-400 flex items-center gap-1">
                      ${user.spendingLimit} Cap • {user.role === 'judge' ? 'Judge' : 'Client'}
                    </span>
                  </div>
                </Link>
                <button
                  onClick={() => logout()}
                  title="Sign Out"
                  className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-zinc-950 font-bold text-xs hover:opacity-95 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Client Access / Judge Demo</span>
              </button>
            )}

            <Link
              href="/"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-cyan-400 font-semibold text-xs transition-colors"
            >
              <span>Launch Chat</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Global Auth Modal */}
      <AuthModal />
    </>
  );
}
