'use client';

import React, { useState } from 'react';
import { 
  Award, Zap, CheckCircle2, ArrowRight, ShieldCheck, CreditCard, 
  Bot, Lock, FileText, ChevronRight, ChevronLeft, ExternalLink, 
  Copy, Check, Sparkles, X, Layers, Database, Compass, Play, RefreshCw, Scale, Network
} from 'lucide-react';
import { useJudgeTour, TOUR_STEPS } from '@/context/JudgeTourContext';
import { useAuth } from '@/context/AuthContext';

export default function JudgeGuidedTourModal() {
  const { 
    isTourModalOpen, 
    closeTourModal, 
    openWebhooksModal,
    openArchitectureModal,
    currentStepIndex, 
    goToStep, 
    nextStep, 
    prevStep, 
    launchQuickScenario, 
    isScenarioRunning 
  } = useJudgeTour();

  const { user, loginWithJudgeAccount } = useAuth();
  const [activeTab, setActiveTab] = useState<'scenarios' | 'walkthrough' | 'credentials'>('scenarios');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isTourModalOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-amber-500/40 rounded-3xl shadow-2xl shadow-amber-950/30 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Glow Effects */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* 1. Header Bar */}
        <div className="p-5 sm:p-6 border-b border-zinc-800/80 flex items-start justify-between gap-4 bg-zinc-900/60 relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-500 to-yellow-300 p-0.5 shadow-lg shadow-amber-950/60 shrink-0">
              <div className="h-full w-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-amber-400">
                <Award className="h-6 w-6" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-white text-base sm:text-lg tracking-tight">
                  Evaluator Sandbox &amp; Judge Guided Tour
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  PayPal AI Hackathon 2026
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 font-sans">
                Experience AgentPay AI&apos;s zero-mock autonomous clearinghouse in 60 seconds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* 🏛️ Prominent Non-Scrolling Header Button for System Architecture Blueprint */}
            <button
              type="button"
              onClick={() => {
                closeTourModal();
                openArchitectureModal();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-emerald-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 hover:text-white border border-cyan-500/50 shadow-lg shadow-cyan-950/50 text-xs font-mono font-bold transition-all cursor-pointer group"
              title="Open 4-Tier Interactive System Architecture & Protocol Matrix Blueprint"
            >
              <Network className="h-4 w-4 text-cyan-400 group-hover:rotate-45 transition-transform" />
              <span className="hidden sm:inline">System Architecture Blueprint</span>
              <span className="sm:hidden">Architecture</span>
              <ArrowRight className="h-3.5 w-3.5 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={closeTourModal}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 2. Navigation Tabs (Clean 3-Tab Grid - Zero Horizontal Scrolling Needed) */}
        <div className="grid grid-cols-3 border-b border-zinc-800/80 bg-zinc-900/30 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('scenarios')}
            className={`py-3 px-2 border-b-2 font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
              activeTab === 'scenarios'
                ? 'border-amber-400 text-amber-300 bg-amber-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>⚡ 6 Live Scenarios</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('walkthrough')}
            className={`py-3 px-2 border-b-2 font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
              activeTab === 'walkthrough'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Compass className="h-3.5 w-3.5 text-cyan-400" />
            <span>🗺️ 12-Stage Tour</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`py-3 px-2 border-b-2 font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
              activeTab === 'credentials'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>🔑 Judge Persona</span>
          </button>
        </div>

        {/* 3. Modal Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* TAB 1: 1-CLICK LIVE SCENARIOS */}
          {activeTab === 'scenarios' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Evaluator Note:</strong> Click any scenario below to automatically set up the required state, authenticate the judge identity, and launch directly to that screen!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Scenario 1 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/50 transition-all space-y-3 flex flex-col justify-between group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        Scenario 1 • Client Flow
                      </span>
                      <Bot className="h-4 w-4 text-cyan-400" />
                    </div>
                    <h4 className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">
                      AI Procurement &amp; Swarm Reverse-Auction
                    </h4>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Gemini parses natural language or CyberVoice™ speech dictation, auto-adjusts budget slider to $120, and triggers 3 autonomous specialist reverse-bids with ROI comparison matrix.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => launchQuickScenario('procurement')}
                    disabled={isScenarioRunning}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950/50 transition-all cursor-pointer"
                  >
                    <span>Launch Scenario 1</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Scenario 2 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/50 transition-all space-y-3 flex flex-col justify-between group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Scenario 2 • AI Audit
                      </span>
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    </div>
                    <h4 className="font-bold text-white text-sm group-hover:text-emerald-300 transition-colors">
                      Autonomous Code Audit &amp; SHA-256 Seal
                    </h4>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Gemini AI ingests public GitHub repositories, scans AST &amp; leaked secrets, issues a holographic certificate, and unlocks interactive chat inspector.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => launchQuickScenario('audit')}
                    disabled={isScenarioRunning}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all cursor-pointer"
                  >
                    <span>Launch Scenario 2</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Scenario 3 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-purple-500/50 transition-all space-y-3 flex flex-col justify-between group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        Scenario 3 • Payouts
                      </span>
                      <CreditCard className="h-4 w-4 text-purple-400" />
                    </div>
                    <h4 className="font-bold text-white text-sm group-hover:text-purple-300 transition-colors">
                      Specialist Wallet &amp; Real PayPal Cashout
                    </h4>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Interactive SVG cashflow telemetry curve, Obsidian virtual card, and real PayPal Sandbox Payout (/v1/payments/payouts) with immediate ledger deduction.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => launchQuickScenario('cashout')}
                    disabled={isScenarioRunning}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:opacity-95 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-950/50 transition-all cursor-pointer"
                  >
                    <span>Launch Scenario 3</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Scenario 4 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-amber-500/50 transition-all space-y-3 flex flex-col justify-between group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Scenario 4 • Treasury
                      </span>
                      <Database className="h-4 w-4 text-amber-400" />
                    </div>
                    <h4 className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">
                      Platform Treasury &amp; Master Audit Ledger
                    </h4>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Unified clearinghouse of client escrow deposits, milestone releases, and specialist PayPal payouts. Real-time GMV, 5% fee revenue, and 1-click Master CSV export.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => launchQuickScenario('admin')}
                    disabled={isScenarioRunning}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/50 transition-all cursor-pointer"
                  >
                    <span>Launch Scenario 4</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Scenario 5 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-cyan-500/50 transition-all space-y-3 flex flex-col justify-between group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        Scenario 5 • AI Arbitration
                      </span>
                      <Scale className="h-4 w-4 text-cyan-400" />
                    </div>
                    <h4 className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">
                      Autonomous AI Dispute Court (LexGuard™ v2.5)
                    </h4>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      AgentPay LexGuard™ neural arbiter analyzes contract brief, GitHub deliverables, and audit scores, issuing a binding Quantum Meruit split ruling with SHA-256 seal.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => launchQuickScenario('dispute')}
                    disabled={isScenarioRunning}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950/50 transition-all cursor-pointer"
                  >
                    <span>Launch Scenario 5 (Dispute Court)</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Scenario 6 • Webhook Stream & Cryptographic HMAC Verification */}
                <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/50 transition-all space-y-3 flex flex-col justify-between group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Scenario 6 • Infrastructure
                      </span>
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    </div>
                    <h4 className="font-bold text-white text-sm group-hover:text-emerald-300 transition-colors">
                      PayPal Webhooks Stream &amp; HMAC Verifier
                    </h4>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Real-time telemetry stream capturing checkout authorizations, escrow captures, milestone disbursements, and dispute settlements with SHA256withRSA signature validation.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      closeTourModal();
                      openWebhooksModal();
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all cursor-pointer"
                  >
                    <span>Launch Scenario 6 (Webhooks Terminal)</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: 12-STAGE PROTOCOL WALKTHROUGH */}
          {activeTab === 'walkthrough' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Stage Progress Bar */}
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-1.5">
                  {TOUR_STEPS.map((step, idx) => (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => goToStep(idx)}
                      className={`h-2.5 rounded-full transition-all cursor-pointer ${
                        idx === currentStepIndex 
                          ? 'w-10 bg-cyan-400 shadow-sm shadow-cyan-400/50' 
                          : idx < currentStepIndex 
                          ? 'w-4 bg-emerald-500' 
                          : 'w-4 bg-zinc-800'
                      }`}
                      title={step.title}
                    />
                  ))}
                </div>

                <span className="text-[11px] font-mono text-zinc-400">
                  Stage <strong className="text-white">{currentStepIndex + 1}</strong> of {TOUR_STEPS.length}
                </span>
              </div>

              {/* Active Step Details */}
              <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                    {currentStep.subtitle}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-800 font-mono text-[10px] text-zinc-400">
                    Route: {currentStep.route}
                  </span>
                </div>

                <h4 className="font-bold text-white text-base leading-snug">
                  {currentStep.title}
                </h4>

                <p className="text-zinc-300 text-xs leading-relaxed">
                  {currentStep.description}
                </p>

                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-cyan-300 text-xs flex items-center gap-2">
                  <Play className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                  <span><strong>Evaluator Action:</strong> {currentStep.highlightAction}</span>
                </div>

                {/* Tech Badges */}
                <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-zinc-500 font-mono">Tech Stack:</span>
                  {currentStep.techStack.map((tech, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-mono">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Step Navigation Controls */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStepIndex === 0}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous Stage</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    closeTourModal();
                    goToStep(currentStepIndex);
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Visit Stage Screen Now</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={nextStep}
                  disabled={currentStepIndex === TOUR_STEPS.length - 1}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
                >
                  <span>Next Stage</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: JUDGE CREDENTIALS & TEST ACCOUNTS */}
          {activeTab === 'credentials' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <img 
                      src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80" 
                      alt="Janitha Dilshan" 
                      className="h-8 w-8 rounded-xl object-cover border border-cyan-500/40"
                    />
                    <div>
                      <h5 className="font-bold text-white text-xs">Janitha Dilshan (Judge / Evaluator)</h5>
                      <span className="text-[10px] text-zinc-400 font-mono">janithad2@gmail.com</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    $250 Authorized Cap
                  </span>
                </div>

                <p className="text-zinc-400 text-xs">
                  This judge persona is pre-configured with active PayPal sandbox orders and full access across all platform screens.
                </p>
              </div>

              {/* Quick Copy Credentials Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* PayPal Sandbox Buyer Account */}
                <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">PayPal Sandbox Buyer</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('sb-43aw4729384732@personal.example.com', 'buyer_email')}
                      className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 cursor-pointer"
                    >
                      {copiedKey === 'buyer_email' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-white truncate">sb-43aw4729384732@personal.example.com</p>
                  <span className="text-[10px] text-zinc-500 font-mono block">Pass: Use standard PayPal sandbox pass</span>
                </div>

                {/* Admin Access Passcode */}
                <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Admin Portal Passcode</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('innoxpert2026', 'admin_pass')}
                      className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 cursor-pointer"
                    >
                      {copiedKey === 'admin_pass' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-amber-300 font-bold">innoxpert2026</p>
                  <span className="text-[10px] text-zinc-500 font-mono block">Unlocks /admin Treasury Ledger</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* 4. Footer Dock */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">PayPal Orders v2 &amp; Payouts Active</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => {
                closeTourModal();
                openArchitectureModal();
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-300 hover:text-white font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              title="Open 4-Tier Interactive System Architecture & Protocol Matrix Blueprint"
            >
              <Network className="h-3.5 w-3.5 text-cyan-400" />
              <span>Architecture Blueprint</span>
              <ArrowRight className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={closeTourModal}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs cursor-pointer"
            >
              Close Guide
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Floating Quick Launcher Component (Visible in bottom-right when walkthrough card is minimized/skipped)
export function JudgeTourFloatingLauncher() {
  const { isTourBannerOpen, openTourBanner, openTourModal, scenarioNotice, clearScenarioNotice } = useJudgeTour();

  // If the interactive tour card is currently expanded in the bottom right, hide the launcher pill
  if (isTourBannerOpen) {
    return scenarioNotice ? (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[99995] max-w-xl w-[90%] p-3.5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border border-amber-500/50 shadow-2xl font-mono text-xs text-amber-200 flex items-center justify-between gap-3 animate-slideDown">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
          <span className="leading-snug">{scenarioNotice}</span>
        </div>
        <button
          type="button"
          onClick={clearScenarioNotice}
          className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
        >
          ✕
        </button>
      </div>
    ) : null;
  }

  return (
    <>
      {/* Active Scenario Guidance Toast */}
      {scenarioNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[99995] max-w-xl w-[90%] p-3.5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border border-amber-500/50 shadow-2xl font-mono text-xs text-amber-200 flex items-center justify-between gap-3 animate-slideDown">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
            <span className="leading-snug">{scenarioNotice}</span>
          </div>
          <button
            type="button"
            onClick={clearScenarioNotice}
            className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Floating Action Button Dock in Bottom Right */}
      <div className="fixed bottom-5 right-5 z-[99990]">
        <button
          type="button"
          onClick={openTourBanner}
          className="group flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border-2 border-amber-500 hover:border-amber-300 shadow-2xl shadow-amber-950/80 hover:shadow-amber-500/30 text-white font-black text-xs transition-all cursor-pointer hover:scale-105"
          title="Open Judge Interactive Walkthrough"
        >
          <div className="h-6 w-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 group-hover:rotate-12 transition-transform">
            <Award className="h-3.5 w-3.5" />
          </div>
          <div className="text-left hidden sm:block">
            <span className="text-[11px] block font-bold text-amber-300">⚡ 1-Click Judge Tour</span>
            <span className="text-[9px] text-zinc-400 font-mono block -mt-0.5">Interactive Protocol Walkthrough</span>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        </button>
      </div>
    </>
  );
}

// Interactive Step-by-Step On-Screen Walkthrough Card in Bottom-Right Corner (Per Janitha's exact instruction)
export function JudgeInteractiveTourBanner() {
  const { 
    isTourBannerOpen, 
    closeTourBanner, 
    skipTour,
    currentStepIndex, 
    nextStep, 
    prevStep, 
    goToStep, 
    launchQuickScenario, 
    openTourModal,
    openArchitectureModal,
    setScenarioNotice
  } = useJudgeTour();

  if (!isTourBannerOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];

  const handleAction = () => {
    if (!currentStep) return;

    if (currentStep.id === 1) {
      launchQuickScenario('procurement');
    } else if (currentStep.id === 2) {
      setScenarioNotice('🛡️ Budget Ceiling: Dynamic slider locked to $120 USD to safeguard client escrow.');
      goToStep(1);
    } else if (currentStep.id === 3) {
      setScenarioNotice('🤖 Reverse Bidding: 3 top specialists competing with SLA delivery guarantees.');
      goToStep(2);
    } else if (currentStep.id === 4) {
      setScenarioNotice('🔒 Escrow Custody: PayPal Orders v2 milestone vault holding conditional funds.');
      goToStep(3);
    } else if (currentStep.id === 5) {
      launchQuickScenario('audit');
    } else if (currentStep.id === 6) {
      setScenarioNotice('💬 Interactive Inspector: Querying Gemini AI Code Inspector & staging review.');
      goToStep(5);
    } else if (currentStep.id === 7) {
      launchQuickScenario('dispute');
    } else if (currentStep.id === 8) {
      setScenarioNotice('📡 Live Tenders: Specialists monitoring real-time RFQ broadcast radar.');
      goToStep(7);
    } else if (currentStep.id === 9) {
      setScenarioNotice('💬 Direct Chat: Bilateral client-specialist milestone conversation active.');
      goToStep(8);
    } else if (currentStep.id === 10) {
      setScenarioNotice('📦 Active Deliverables: Specialist GitHub repository & staging review.');
      goToStep(9);
    } else if (currentStep.id === 11) {
      launchQuickScenario('cashout');
    } else if (currentStep.id === 12) {
      launchQuickScenario('admin');
    } else {
      goToStep(currentStepIndex);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[99990] w-[94vw] sm:w-[450px] max-w-[460px] animate-fadeIn">
      <div className="p-4 sm:p-5 rounded-3xl bg-zinc-950/95 border-2 border-amber-500/70 shadow-2xl shadow-amber-950/90 backdrop-blur-2xl text-zinc-100 flex flex-col gap-3">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold text-[11px] flex items-center gap-1.5 shadow-sm">
              <Award className="h-3 w-3 text-amber-400" />
              <span>Stage {currentStepIndex + 1} of {TOUR_STEPS.length}</span>
            </span>

            {/* Interactive Stage Dots */}
            <div className="flex items-center gap-1 ml-1">
              {TOUR_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => goToStep(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentStepIndex
                      ? 'w-5 bg-amber-400'
                      : idx < currentStepIndex
                      ? 'w-2 bg-emerald-400'
                      : 'w-2 bg-zinc-700 hover:bg-zinc-500'
                  }`}
                  title={s.title}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={openArchitectureModal}
              className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
              title="Open 4-Tier Interactive System Architecture & Protocol Matrix Blueprint"
            >
              <Network className="h-3 w-3 text-cyan-400" />
              <span>Full Matrix</span>
            </button>
            <button
              onClick={closeTourBanner}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer text-xs"
              title="Minimize to floating pill"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs sm:text-sm font-extrabold text-white tracking-tight leading-snug">
              {currentStep.title}
            </h4>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
            {currentStep.description}
          </p>
        </div>

        {/* Primary Step Action Button */}
        <button
          onClick={handleAction}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/40 hover:opacity-95 transition-all cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5 text-zinc-950" />
          <span>{currentStep.actionButtonLabel}</span>
        </button>

        {/* Bottom Navigation & Skip Control */}
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-xs">
          <button
            onClick={skipTour}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer underline underline-offset-4 font-medium"
            title="Skip walkthrough"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 text-[11px] font-bold border border-zinc-800 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-3 w-3" />
              <span>Back</span>
            </button>

            <button
              onClick={nextStep}
              disabled={currentStepIndex === TOUR_STEPS.length - 1}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 disabled:opacity-30 text-zinc-950 font-black text-[11px] flex items-center gap-1 shadow-md shadow-cyan-950/40 cursor-pointer disabled:cursor-not-allowed transition-all"
            >
              <span>Next Stage</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

