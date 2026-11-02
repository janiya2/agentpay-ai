'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, MessageSquare, Shield, Clock } from 'lucide-react';
import type { DirectMessage } from '@/types';

interface DirectChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderTitle: string;
  currentUserRole: 'client' | 'provider';
  currentUserName: string;
  otherPartyName: string;
}

export default function DirectChatModal({
  isOpen,
  onClose,
  orderId,
  orderTitle,
  currentUserRole,
  currentUserName,
  otherPartyName
}: DirectChatModalProps) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/direct-messages?orderId=${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.warn('Error fetching direct messages:', err);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      setLoading(true);
      fetchMessages().finally(() => setLoading(false));

      // Poll every 4s for fresh messages while open
      const interval = setInterval(fetchMessages, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen, orderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');

    try {
      const res = await fetch('/api/direct-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          senderRole: currentUserRole,
          senderName: currentUserName,
          message: text
        })
      });

      const data = await res.json();
      if (data.success) {
        await fetchMessages();
      }
    } catch (err) {
      console.error('Send message failed:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl h-[600px] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-zinc-950 font-bold">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Direct Collaboration Room</h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Escrow Protected
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Between <strong className="text-white">{currentUserName}</strong> and <strong className="text-cyan-300">{otherPartyName}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Deliverable Scope Banner */}
        <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
          <span className="truncate max-w-[350px]">Project: <strong className="text-zinc-200">{orderTitle}</strong></span>
          <span className="font-mono text-[10px] text-zinc-500">Order Ref: #{orderId.substring(0, 14)}</span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar">
          {loading ? (
            <div className="py-20 text-center text-xs text-zinc-500">
              <span className="animate-spin inline-block mr-2">⏳</span> Loading conversation thread...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-20 text-center text-xs text-zinc-500 space-y-2">
              <MessageSquare className="h-8 w-8 text-zinc-600 mx-auto" />
              <p>No messages in this collaboration channel yet.</p>
              <p className="text-[11px] text-zinc-600">Send deliverables, GitHub repo links, or discuss milestones directly!</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.senderRole === currentUserRole;
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                    isMe 
                      ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-zinc-950' 
                      : 'bg-zinc-800 border border-zinc-700 text-cyan-400'
                  }`}>
                    <User className="h-4 w-4" />
                  </div>

                  <div className={`space-y-1 max-w-[75%]`}>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      <span className="font-bold text-zinc-300">{m.senderName}</span>
                      <span>•</span>
                      <span>{new Date(m.timestamp || (m as any).createdAt || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      isMe
                        ? 'bg-cyan-600/25 text-cyan-50 border border-cyan-500/30 rounded-tr-none'
                        : 'bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-tl-none'
                    }`}>
                      <p className="whitespace-pre-wrap">{m.message}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center gap-2.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${otherPartyName} (e.g. 'Here is the GitHub repo or Figma design link')...`}
            className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 disabled:opacity-40 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            {sending ? <span className="animate-spin">⏳</span> : <Send className="h-3.5 w-3.5" />}
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
