'use client';

import React from 'react';
import ChatInterface from '@/components/ChatInterface';
import { Bot, ShieldCheck, Zap, Lock, CreditCard, Sparkles, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 sm:px-6 relative">
      {/* Background Cyber Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-600/15 via-cyan-500/10 to-transparent blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute top-1/2 right-10 w-[300px] h-[200px] bg-amber-500/10 blur-[100px] pointer-events-none rounded-full" />

      {/* Hero Header */}
      <div className="max-w-4xl mx-auto text-center space-y-4 mb-10 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          <span>PayPal AI Hackathon 2026 • Official Agentic Commerce Protocol</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
          Autonomous AI Commerce & <br />
          <span className="bg-gradient-to-r from-[#00CFDE] via-[#0070BA] to-[#FFC439] bg-clip-text text-transparent">
            Milestone Escrow on PayPal
          </span>
        </h1>

        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Tell your AI Agent what you need. It autonomously queries 100+ verified service providers, negotiates fair pricing within your safe spending limit, and structures a secure PayPal Orders v2 escrow in one click.
        </p>

        {/* Feature Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-zinc-300">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-800">
            <Lock className="h-3.5 w-3.5 text-cyan-400" />
            <span>Strict Spending Limits</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-800">
            <CreditCard className="h-3.5 w-3.5 text-amber-400" />
            <span>PayPal Orders v2 Inline</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-800">
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            <span>Multi-Key Gemini Failover</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-800">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
            <span>Resend Email Alerts</span>
          </span>
        </div>
      </div>

      {/* Main Interactive Chat Room */}
      <div className="w-full max-w-5xl z-10 mb-16">
        <ChatInterface />
      </div>

      {/* Value Proposition Highlights */}
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-6 z-10 text-left">
        <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 hover:border-cyan-500/40 transition-all space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Bot className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-white">Autonomous Agentic Commerce</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Eliminates the friction of browsing hundreds of listings. The AI Agent vets portfolios, checks rates, and negotiates bilateral terms matching your exact requirements.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 hover:border-amber-500/40 transition-all space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <CreditCard className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-white">PayPal Smart Escrow</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Funds are captured safely via PayPal Sandbox. Funds remain protected in milestone escrow until the service provider submits deliverables and work is verified.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800/80 hover:border-emerald-500/40 transition-all space-y-3">
          <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-white">Safe Spending Protocol</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Clients retain 100% control. The agent operates strictly within your authorized spending ceiling. No unexpected charges, no raw card exposure.
          </p>
        </div>
      </div>
    </div>
  );
}

