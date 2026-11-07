'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ShieldCheck, CheckCircle2, AlertTriangle, AlertCircle, Copy, Check, 
  Sparkles, ExternalLink, Hash, Award, Github, Globe, RefreshCw, Lock,
  MessageSquare, Send, Bot, ArrowRight, CornerDownLeft, Info, FileCode, User
} from 'lucide-react';

interface AiAuditCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderTitle: string;
  buyerName: string;
  providerName: string;
  orderAmount: number;
  certificate?: {
    overallScore: number;
    verdict: 'PASSED_VERIFIED' | 'CHANGES_REQUESTED' | 'FAILED';
    scopeMatch: number;
    qualityScore: number;
    securityScore: number;
    summary: string;
    issues?: string[];
    checklist: Array<{
      item: string;
      passed: boolean;
      details?: string;
    }>;
    auditHash: string;
    auditedAt: string;
    recheckCount: number;
    auditedFilesCount?: number;
  } | null;
  deliverable?: {
    repoUrl?: string;
    liveDemoUrl?: string;
    summaryNotes?: string;
    testInstructions?: string;
    version?: number;
  };
  initialTab?: 'certificate' | 'chat';
  isAuditing?: boolean;
  onRunAudit?: () => void;
  onReleaseEscrow?: () => void;
  onRequestRevisions?: (notes?: string, issues?: string[]) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export default function AiAuditCertificateModal({
  isOpen,
  onClose,
  orderId,
  orderTitle,
  buyerName,
  providerName,
  orderAmount,
  certificate,
  deliverable,
  initialTab = 'chat',
  isAuditing = false,
  onRunAudit,
  onReleaseEscrow,
  onRequestRevisions
}: AiAuditCertificateModalProps) {
  const [activeTab, setActiveTab] = useState<'certificate' | 'chat'>(initialTab);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Chat with AI Auditor state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Revision Request Form state
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  const [revisionSuccess, setRevisionSuccess] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  // Initialize chat when modal opens
  useEffect(() => {
    if (isOpen) {
      const isPassed = certificate?.verdict === 'PASSED_VERIFIED';
      const initialGreeting: ChatMessage = {
        id: 'msg-init',
        role: 'model',
        text: certificate
          ? `Hello ${buyerName.split(' ')[0]}! I have completed the automated code audit for "${orderTitle}". 

**Audit Verdict:** ${isPassed ? '✅ PASSED & VERIFIED (Score: ' + certificate.overallScore + '/100)' : '⚠️ CHANGES REQUESTED (Score: ' + certificate.overallScore + '/100)'}
${certificate.summary}

Feel free to ask me anything about the repository code, tech stack, test instructions, or security posture. If revisions are required, I can draft a complete punch-list for ${providerName}!`
          : `Hello ${buyerName.split(' ')[0]}! I am your AI Code Inspector and Architectural Auditor for "${orderTitle}".

I have ingested the submitted deliverable details:
- **Repository**: ${deliverable?.repoUrl || 'No repo URL attached'}
- **Live Demo**: ${deliverable?.liveDemoUrl || 'None attached'}
- **Deliverable Version**: Deliverable v${deliverable?.version || 1}

Ask me anything about the codebase, code quality, security, or implementation! You can also click **"Draft Revision Request with AI"** anytime to create a punch-list for ${providerName}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([initialGreeting]);

      // Pre-fill default revision message from audit issues
      const defaultIssues = certificate?.issues && certificate.issues.length > 0
        ? certificate.issues
        : ['Ensure full adherence to milestone technical specifications and deliver functional code.'];
      
      const prefillMsg = `Dear ${providerName},\n\nOur AI Code Audit evaluated Deliverable v${deliverable?.version || 1} and identified the following items to address before PayPal Escrow can be approved:\n\n${defaultIssues.map((iss, i) => `${i + 1}. ${iss}`).join('\n')}\n\nPlease address these items in your repository and use "Fix & Submit Revision" in your Provider Workspace to submit v${(deliverable?.version || 1) + 1}.\n\nThank you,\n${buyerName}`;
      setRevisionNotes(prefillMsg);
    }
  }, [isOpen, orderId, certificate, deliverable, buyerName, providerName, orderTitle]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, activeTab, isAiTyping]);

  if (!isOpen) return null;

  const isPassed = Boolean(certificate && certificate.verdict === 'PASSED_VERIFIED');

  const renderFormattedMessage = (rawText: string, isUser: boolean) => {
    if (isUser) {
      return <p className="whitespace-pre-wrap">{rawText}</p>;
    }

    const lines = rawText.split('\n');

    return (
      <div className="space-y-1">
        {lines.map((line, lineIdx) => {
          if (!line.trim()) {
            return <div key={lineIdx} className="h-1.5" />;
          }

          const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
          const isNumbered = /^\d+\.\s/.test(line.trim());

          let content = line;
          let prefix = null;

          if (isBullet) {
            prefix = <span className="text-cyan-400 font-bold mr-1.5 select-none">•</span>;
            content = line.trim().substring(2);
          } else if (isNumbered) {
            const match = line.trim().match(/^(\d+\.)\s(.*)$/);
            if (match) {
              prefix = <span className="text-cyan-400 font-mono font-bold mr-1.5 select-none">{match[1]}</span>;
              content = match[2];
            }
          }

          // Parse tokens: **bold** and `code`
          const parts: React.ReactNode[] = [];
          const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
          let lastIndex = 0;
          let match: RegExpExecArray | null;

          while ((match = regex.exec(content)) !== null) {
            if (match.index > lastIndex) {
              parts.push(content.substring(lastIndex, match.index));
            }

            const token = match[0];
            if (token.startsWith('**') && token.endsWith('**')) {
              const boldText = token.slice(2, -2);
              // Vibrant blue highlight as requested by Janitha!
              parts.push(
                <span
                  key={`${lineIdx}-${match.index}`}
                  className="font-bold text-sky-400 bg-sky-500/15 px-1.5 py-0.5 rounded-md border border-sky-500/30 inline-block my-0.5 shadow-sm"
                >
                  {boldText}
                </span>
              );
            } else if (token.startsWith('`') && token.endsWith('`')) {
              const codeText = token.slice(1, -1);
              parts.push(
                <code
                  key={`${lineIdx}-${match.index}`}
                  className="px-1.5 py-0.5 rounded bg-zinc-950 text-cyan-300 font-mono text-[11px] border border-cyan-500/30 mx-0.5"
                >
                  {codeText}
                </code>
              );
            }

            lastIndex = regex.lastIndex;
          }

          if (lastIndex < content.length) {
            parts.push(content.substring(lastIndex));
          }

          return (
            <div key={lineIdx} className={isBullet || isNumbered ? 'flex items-start pl-1' : ''}>
              {prefix}
              <div className="flex-1">{parts.length > 0 ? parts : content}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const copyToClipboard = () => {
    if (certificate?.auditHash) {
      navigator.clipboard.writeText(certificate.auditHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2500);
    }
  };

  const handleSendChatMessage = async (userText?: string) => {
    const textToSend = (userText || chatInput).trim();
    if (!textToSend || isAiTyping) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsAiTyping(true);

    try {
      const res = await fetch('/api/orders/audit-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          userMessage: textToSend,
          chatHistory: messages.map(m => ({ role: m.role, text: m.text }))
        })
      });

      const data = await res.json();
      if (res.ok && data.reply) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'model',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || 'Failed to get AI response');
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ Error consulting AI Auditor: ${err.message}. Please try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleSubmitRevisionRequest = async () => {
    if (!revisionNotes.trim() || isSubmittingRevision) return;

    setIsSubmittingRevision(true);
    setRevisionError(null);
    try {
      const res = await fetch('/api/orders/request-revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          revisionNotes: revisionNotes.trim(),
          issues: certificate?.issues || []
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRevisionSuccess(true);
        onRequestRevisions?.(revisionNotes.trim(), certificate?.issues || []);
        setTimeout(() => {
          setShowRevisionForm(false);
          setRevisionSuccess(false);
          onClose();
        }, 1800);
      } else {
        setRevisionError(data.error || 'Failed to send revision request to specialist.');
      }
    } catch (e: any) {
      setRevisionError(`Network error: ${e.message}`);
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Holographic Gradient Top Border */}
        <div className={`h-2 w-full ${
          isPassed 
            ? 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500' 
            : 'bg-gradient-to-r from-amber-400 via-rose-500 to-orange-500'
        }`} />

        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-zinc-950 shadow-lg shrink-0 ${
              isPassed
                ? 'bg-gradient-to-tr from-emerald-400 to-teal-500 shadow-emerald-950/50'
                : certificate
                ? 'bg-gradient-to-tr from-amber-400 to-rose-500 shadow-amber-950/50'
                : 'bg-gradient-to-tr from-purple-500 to-cyan-500 shadow-purple-950/50'
            }`}>
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-white tracking-tight">
                  Autonomous AI Escrow Verification Inspector
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${
                  isPassed 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                    : certificate
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                }`}>
                  {certificate ? certificate.verdict.replace('_', ' ') : isAuditing ? 'Auditing Codebase...' : 'Deliverable Inspection Ready'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Specialist: <strong className="text-zinc-200">{providerName}</strong> • Escrow: <strong className="text-emerald-400 font-mono">${orderAmount} USD</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs: Certificate vs Interactive AI Chat */}
        <div className="px-5 pt-3 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('certificate'); setShowRevisionForm(false); }}
              className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'certificate' && !showRevisionForm
                  ? 'border-cyan-400 text-cyan-300 bg-zinc-900/80'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
              }`}
            >
              <Award className="h-3.5 w-3.5 text-cyan-400" />
              <span>Audit Certificate &amp; Scores</span>
            </button>

            <button
              onClick={() => { setActiveTab('chat'); setShowRevisionForm(false); }}
              className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'chat' && !showRevisionForm
                  ? 'border-purple-400 text-purple-300 bg-zinc-900/80'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
              }`}
            >
              <Bot className="h-3.5 w-3.5 text-purple-400" />
              <span>Ask AI Code Inspector (Interactive Chat)</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span>AgentPay AI Core</span>
              </span>
            </button>
          </div>

          {!isPassed && (
            <button
              onClick={() => setShowRevisionForm(true)}
              className="px-3 py-1.5 mb-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
            >
              <AlertTriangle className="h-3 w-3" />
              <span>Send Revision Punch-List</span>
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6">
          
          {/* VIEW 1: REVISION REQUEST FORM */}
          {showRevisionForm ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-300 font-bold">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>Official Milestone Revision Request to {providerName}</span>
                  </div>
                  <button
                    onClick={() => setShowRevisionForm(false)}
                    className="text-zinc-400 hover:text-white text-xs underline cursor-pointer"
                  >
                    Back to Audit
                  </button>
                </div>
                <p className="text-zinc-300 text-[11px] leading-relaxed">
                  The AI Code Auditor has compiled the flagged issues below into an actionable punch-list. You can edit this message or add custom instructions. When sent, {providerName} will receive an alert in their Provider Workspace and 1-on-1 chat.
                </p>
              </div>

              {/* Detected Issues Breakdown */}
              {certificate?.issues && certificate.issues.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <FileCode className="h-3.5 w-3.5 text-amber-400" />
                    <span>AI Flagged Issues from GitHub Code Ingestion</span>
                  </label>
                  <ul className="list-disc list-inside space-y-1 text-amber-200 text-xs font-mono bg-zinc-950 p-3 rounded-xl border border-amber-500/20">
                    {certificate.issues.map((issue, idx) => (
                      <li key={idx} className="leading-relaxed">{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Message to Specialist */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Revision Message to Dispatch to Specialist</span>
                </label>
                <textarea
                  rows={8}
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 leading-relaxed custom-scrollbar"
                />
              </div>

              {revisionError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{revisionError}</span>
                </div>
              )}

              {revisionSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Revision request transmitted! Provider notified in their workspace.</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRevisionForm(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitRevisionRequest}
                  disabled={isSubmittingRevision || !revisionNotes.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-950/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingRevision ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Transmitting Revision Request...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Send Revision Request to {providerName.split(' ')[0]}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : activeTab === 'chat' ? (
            /* VIEW 2: INTERACTIVE AI CODE INSPECTOR CHAT */
            <div className="flex flex-col h-[460px] space-y-3 animate-fadeIn">
              {/* Quick Prompt Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 no-scrollbar text-xs">
                <span className="text-[10px] font-mono text-zinc-500 font-bold shrink-0">Ask AI:</span>
                {[
                  "Is the GitHub repo functional & complete?",
                  "Are there any hardcoded API keys or secrets?",
                  "Does the code satisfy agreed milestones?",
                  "Draft revision punch-list for Adrian"
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendChatMessage(chip)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-purple-950/40 border border-zinc-800 hover:border-purple-500/40 text-zinc-300 hover:text-purple-200 text-[11px] whitespace-nowrap transition-all cursor-pointer shrink-0"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat Message Stream */}
              <div 
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto space-y-3 p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 custom-scrollbar"
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'model' && (
                      <div className="h-7 w-7 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 mt-0.5">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none'
                    }`}>
                      {renderFormattedMessage(msg.text, msg.role === 'user')}
                      <span className="text-[9px] font-mono opacity-50 block text-right mt-1.5">{msg.timestamp}</span>
                    </div>

                    {msg.role === 'user' && (
                      <div className="h-7 w-7 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0 mt-0.5">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}

                {isAiTyping && (
                  <div className="flex items-center gap-2 text-xs text-purple-400 font-mono animate-pulse p-2">
                    <Bot className="h-4 w-4" />
                    <span>AI Code Auditor is inspecting source files...</span>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                  placeholder="Ask AgentPay AI Auditor about the repo, code structure, or revision requirements..."
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => handleSendChatMessage()}
                  disabled={!chatInput.trim() || isAiTyping}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          ) : !certificate ? (
            /* VIEW 3A: PENDING AUDIT / CALL TO ACTION */
            <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-5 animate-fadeIn my-auto">
              <div className="h-16 w-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-lg shadow-cyan-950/50">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h4 className="text-base font-bold text-white">Deliverable Ready for AI Code Audit</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Specialist <strong className="text-zinc-200">{providerName}</strong> has submitted deliverables. Click below to run an automated deep code audit on the repository, check security, verify scope completion, and generate a cryptographic certificate.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onRunAudit}
                  disabled={isAuditing}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isAuditing ? 'animate-spin' : ''}`} />
                  <span>{isAuditing ? 'Auditing Codebase with AgentPay AI Engine...' : '⚡ Run Deep AI Code Audit Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className="px-4 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Bot className="h-4 w-4 text-purple-400" />
                  <span>Ask AI Inspector (Chat)</span>
                </button>
              </div>
            </div>
          ) : (
            /* VIEW 3: AUDIT CERTIFICATE BREAKDOWN */
            <div className="space-y-5 animate-fadeIn">
              {/* Overall Score & Verdict Banner */}
              <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                    Escrow Verification Verdict
                  </span>
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    {isPassed ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-6 w-6 text-amber-400" />
                    )}
                    <span className="text-xl font-black text-white tracking-tight">
                      {isPassed ? 'PASSED & AUDIT VERIFIED' : 'CHANGES & REVISIONS REQUESTED'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 max-w-md">{certificate.summary}</p>
                </div>

                {/* Circular / Hex Score Display */}
                <div className="flex items-center gap-3 bg-zinc-950 p-4 rounded-2xl border border-zinc-800 shrink-0">
                  <div className="text-center">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase block">Overall Score</span>
                    <span className={`text-3xl font-black font-mono ${
                      certificate.overallScore >= 80 ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {certificate.overallScore}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">/100</span>
                  </div>
                </div>
              </div>

              {/* 3 Telemetry Pillars: Scope Match, Code Quality, Security */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Scope Adherence</span>
                    <span className="font-mono font-bold text-white">{certificate.scopeMatch}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-cyan-400 h-full rounded-full transition-all" style={{ width: `${certificate.scopeMatch}%` }} />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Code Quality</span>
                    <span className="font-mono font-bold text-white">{certificate.qualityScore}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${certificate.qualityScore}%` }} />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Security &amp; Secrets</span>
                    <span className="font-mono font-bold text-white">{certificate.securityScore}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-400 h-full rounded-full transition-all" style={{ width: `${certificate.securityScore}%` }} />
                  </div>
                </div>
              </div>

              {/* Flagged Issues Section (If any) */}
              {certificate.issues && certificate.issues.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300 font-bold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <span>Flagged Audit Issues ({certificate.issues.length})</span>
                    </span>
                    <button
                      onClick={() => setShowRevisionForm(true)}
                      className="text-xs text-amber-300 hover:underline font-bold cursor-pointer"
                    >
                      Turn into Revision Request →
                    </button>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-amber-200 text-[11px] font-mono bg-zinc-950/60 p-2.5 rounded-xl border border-amber-500/20">
                    {certificate.issues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Audit Checklist */}
              {certificate.checklist && certificate.checklist.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                    Verification Checklist
                  </span>
                  <div className="space-y-1.5">
                    {certificate.checklist.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          {item.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <X className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className="font-semibold text-white">{item.item}</span>
                            {item.details && (
                              <p className="text-[11px] text-zinc-400 mt-0.5">{item.details}</p>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                          item.passed 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {item.passed ? 'PASSED' : 'FLAGGED'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cryptographic SHA-256 Proof */}
              <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-zinc-400 font-bold flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-cyan-400" />
                    <span>SHA-256 Cryptographic Verification Hash</span>
                  </span>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    {copiedHash ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
                  </button>
                </div>
                <p className="p-2.5 rounded-xl bg-zinc-950 font-mono text-[10px] text-zinc-300 break-all select-all border border-zinc-800">
                  {certificate.auditHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                </p>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1">
                  <span>Timestamp: {new Date(certificate.auditedAt || Date.now()).toUTCString()}</span>
                  <span>Audit Engine: AgentPay Autonomous AI Auditor v2.5</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-400 text-center sm:text-left">
            {isAuditing
              ? '⚡ Auditing codebase with AgentPay Autonomous AI inspector...'
              : isPassed 
              ? '✅ Deliverable satisfies 100% of agreed milestone scope. Safe to release PayPal funds.'
              : certificate
              ? '⚠️ Deliverable does not yet meet 100% of scope criteria. Revisions recommended.'
              : '🔍 Interactive AI Code Inspector ready. You can query the repository directly or run the automated audit.'}
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>

            {onRunAudit && (
              <button
                type="button"
                onClick={onRunAudit}
                disabled={isAuditing}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
                <span>{isAuditing ? 'Auditing Codebase...' : certificate ? `⚡ Re-Run AI Audit (v${deliverable?.version || 1})` : 'Run Automated Audit'}</span>
              </button>
            )}

            {!isPassed && certificate && (
              <button
                onClick={() => setShowRevisionForm(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-95 text-zinc-950 font-bold text-xs transition-all cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Request Revisions from Specialist</span>
              </button>
            )}

            {isPassed && onReleaseEscrow && (
              <button
                onClick={() => {
                  onReleaseEscrow();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-950/50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Approve &amp; Release ${orderAmount} Escrow</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
