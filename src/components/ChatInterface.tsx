'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, User, Send, Shield, Sparkles, CheckCircle2, DollarSign, Clock, ArrowRight, ExternalLink } from 'lucide-react';
import { PayPalButtons } from '@paypal/react-paypal-js';
import type { ChatMessage, ServiceProvider } from '@/types';

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init_1',
      role: 'assistant',
      content: "Hello! I am your Autonomous AgentPay AI Commerce Agent. Tell me what service or digital deliverable you need (e.g. Next.js web application, Figma UI design, AI automation workflow, SEO, or video editing), and I will discover top-tier providers, negotiate terms, and set up your safe PayPal milestone escrow.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activePayPalOrder]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input.trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          spendingLimit
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to communicate with AI Agent.');
      }

      const decision = data.agentDecision;
      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: decision?.reply || data.fallbackReply || "I have analyzed your request.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionPayload: {
          type: data.paypalOrderId ? 'paypal_checkout' : data.matchedProviders?.length ? 'search_results' : 'negotiation_proposal',
          matchedProviders: data.matchedProviders,
          negotiatedTerms: decision?.negotiatedDeal,
          paypalOrderId: data.paypalOrderId,
          amount: decision?.negotiatedDeal?.negotiatedPrice
        }
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // If PayPal order was triggered, set it for interactive checkout
      if (data.paypalOrderId && decision?.negotiatedDeal) {
        setActivePayPalOrder({
          orderId: data.orderRefId || `ord_${Date.now()}`,
          paypalOrderId: data.paypalOrderId,
          amount: decision.negotiatedDeal.negotiatedPrice,
          providerName: decision.negotiatedDeal.providerName,
          scopeTitle: decision.negotiatedDeal.scopeTitle
        });
      }

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
    if (!activePayPalOrder) return;

    try {
      const res = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paypalOrderId,
          orderId: activePayPalOrder.orderId
        })
      });

      const captureData = await res.json();

      if (captureData.success) {
        setPaymentSuccess(true);
        setActivePayPalOrder(null);

        setMessages((prev) => [
          ...prev,
          {
            id: `sys_${Date.now()}`,
            role: 'assistant',
            content: `🎉 Payment successfully verified via PayPal Orders v2! $${captureData.amount || activePayPalOrder.amount} USD is securely locked in Milestone Escrow. A Resend notification has been dispatched to ${activePayPalOrder.providerName}.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        alert(`PayPal Capture Warning: ${captureData.error}`);
      }
    } catch (err: any) {
      console.error('Capture error:', err);
    }
  };

  return (
    <div className="flex flex-col h-[750px] w-full max-w-5xl mx-auto rounded-3xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-2xl shadow-2xl overflow-hidden">
      {/* Top Protocol Header & Spending Guardrail */}
      <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Bot className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">AgentPay Autonomous Room</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-mono">
                Real Gemini 2.5 Active
              </span>
            </div>
            <p className="text-xs text-zinc-400">Zero-Mock Multi-Turn Negotiation & PayPal Escrow</p>
          </div>
        </div>

        {/* Safe Spending Guardrail Slider */}
        <div className="w-full sm:w-72 px-4 py-2 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span>Safe Spending Limit:</span>
            </span>
            <span className="font-mono font-bold text-cyan-300">${spendingLimit} USD</span>
          </div>
          <input
            type="range"
            min="30"
            max="1000"
            step="10"
            value={spendingLimit}
            onChange={(e) => setSpendingLimit(Number(e.target.value))}
            className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                msg.role === 'user'
                  ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-zinc-950'
                  : 'bg-zinc-800 border border-zinc-700 text-cyan-400'
              }`}
            >
              {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            <div className={`space-y-3 max-w-[85%] sm:max-w-[75%]`}>
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyan-600/20 text-cyan-50 border border-cyan-500/30 rounded-tr-none'
                    : 'bg-zinc-900/90 text-zinc-200 border border-zinc-800/80 rounded-tl-none shadow-md'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <span className="block text-[10px] text-zinc-500 mt-2 text-right font-mono">{msg.timestamp}</span>
              </div>

              {/* Matched Providers Cards */}
              {msg.actionPayload?.matchedProviders && msg.actionPayload.matchedProviders.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {msg.actionPayload.matchedProviders.map((prov) => (
                    <div
                      key={prov.id}
                      className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-cyan-500/40 transition-all text-xs space-y-2 group"
                    >
                      <div className="flex items-center gap-2.5">
                        <img src={prov.avatarUrl} alt={prov.name} className="h-9 w-9 rounded-full bg-zinc-800" />
                        <div>
                          <h4 className="font-bold text-white group-hover:text-cyan-300 transition-colors">{prov.name}</h4>
                          <p className="text-[10px] text-zinc-400 truncate max-w-[150px]">{prov.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[11px]">
                        <span className="text-zinc-400">⭐ {prov.rating} ({prov.reviewCount})</span>
                        <span className="font-mono font-bold text-emerald-400">${prov.hourlyRate}/hr</span>
                      </div>
                      <button
                        onClick={() => handleSend(`I want to proceed with ${prov.name} for my project within my $${spendingLimit} budget.`)}
                        className="w-full py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30 flex items-center justify-center gap-1 transition-all"
                      >
                        <span>Select Provider</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live Active PayPal Checkout Bubble */}
        {activePayPalOrder && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-blue-950/40 border border-cyan-500/40 shadow-xl space-y-4 max-w-lg mx-auto">
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

            {/* Official PayPal Button */}
            <div className="pt-2">
              <PayPalButtons
                style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
                createOrder={async () => activePayPalOrder.paypalOrderId}
                onApprove={async (data) => {
                  await handlePayPalCapture(data.orderID);
                }}
                onError={(err) => {
                  console.error('PayPal Button Error:', err);
                }}
              />
            </div>
          </div>
        )}

        {paymentSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-bold">PayPal Milestone Escrow Active!</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Order has been committed to Firestore and provider notified via email.</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2 border-t border-zinc-800/60 bg-zinc-950/40 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar">
        <span className="text-zinc-500 shrink-0 font-medium">Try asking:</span>
        <button
          onClick={() => handleSend("I need a Next.js 15 developer to build a modern dashboard for under $120.")}
          className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 shrink-0 transition-colors"
        >
          💻 Next.js Dashboard ($120)
        </button>
        <button
          onClick={() => handleSend("Find me a Figma UI/UX designer for an e-commerce mobile app with a $80 budget.")}
          className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 shrink-0 transition-colors"
        >
          🎨 Figma Mobile App ($80)
        </button>
        <button
          onClick={() => handleSend("I want an autonomous AI automation engineer to build an n8n webhook workflow for $150.")}
          className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 shrink-0 transition-colors"
        >
          🤖 AI Automation Workflow ($150)
        </button>
      </div>

      {/* Input Bar */}
      <div className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Speak to your agent: 'Find me a Next.js dev under $150'..."
          disabled={isLoading}
          className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all disabled:opacity-50"
        />
        <button
          onClick={() => handleSend()}
          disabled={isLoading || !input.trim()}
          className="h-11 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 disabled:opacity-40 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all shrink-0"
        >
          {isLoading ? <span className="animate-spin">⏳</span> : <Send className="h-4 w-4" />}
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );
}
