'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Shield, Sparkles, User, Mail, ArrowRight, X, Bot, CheckCircle2 } from 'lucide-react';

export default function AuthModal() {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    loginWithJudgeAccount, 
    loginWithGoogle, 
    loginWithCustomEmail 
  } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await loginWithCustomEmail(name, email);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-cyan-500/30 shadow-2xl shadow-cyan-950/40 text-left space-y-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Effects */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#003087] via-[#0070BA] to-[#00CFDE] p-[1.5px]">
              <div className="h-full w-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                <Bot className="h-5 w-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Client Access & Escrow Hub</h3>
              <p className="text-xs text-zinc-400">Save negotiations, manage milestone orders & PayPal vault</p>
            </div>
          </div>
          <button 
            onClick={closeAuthModal}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 1. Judge Quick Access (Top Hero Card) */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-purple-950/40 border border-cyan-500/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-cyan-400" />
              Recommended for Hackathon Evaluators
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              1-Click Instant
            </span>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            Instantly evaluate the autonomous agent as a verified buyer profile (<strong className="text-white">Janitha Dilshan</strong>) with pre-funded $250 escrow limit.
          </p>

          <button
            onClick={loginWithJudgeAccount}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>1-Click Hackathon Judge Sign-In</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-[1px] flex-1 bg-zinc-800" />
          <span className="text-[11px] font-mono uppercase text-zinc-500">Or continue with</span>
          <div className="h-[1px] flex-1 bg-zinc-800" />
        </div>

        {/* 2. Official Google Login Button */}
        <button
          onClick={async () => {
            setGoogleLoading(true);
            try {
              await loginWithGoogle();
            } finally {
              setGoogleLoading(false);
            }
          }}
          disabled={googleLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700/80 hover:border-zinc-600 text-zinc-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-50"
        >
          {googleLoading ? (
            <span className="animate-spin text-cyan-400">⏳</span>
          ) : (
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          )}
          <span>{googleLoading ? 'Signing In...' : 'Sign In with Google'}</span>
        </button>

        {/* 3. Custom Name & Email Form */}
        <form onSubmit={handleCustomSubmit} className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Your Name</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@company.com"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>Enter as Custom Buyer</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </form>

        <p className="text-[10px] text-zinc-500 text-center">
          Session data is securely synchronized with Firebase Firestore.
        </p>
      </div>
    </div>
  );
}

