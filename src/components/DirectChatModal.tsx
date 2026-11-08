'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  X, Send, Bot, User, MessageSquare, ShieldCheck, Clock, 
  CreditCard, Sparkles, CheckCircle2, AlertCircle, ExternalLink, CheckCheck, Check, Mic
} from 'lucide-react';
import type { DirectMessage } from '@/types';
import { getSpecialistRealAvatar } from '@/lib/specialistAvatars';
import { formatLastSeen, isUserOnline } from '@/lib/lastSeen';
import VoiceNotePlayer from '@/components/VoiceNotePlayer';
import VoiceNoteRecorder, { VoiceNoteResult } from '@/components/VoiceNoteRecorder';

export interface DirectChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string; // Order ID or Tender Session ID
  orderTitle: string;
  currentUserRole: 'client' | 'provider';
  currentUserName: string;
  otherPartyName: string;
  otherPartyLastSeen?: string;
  isPurchasedOrder?: boolean;
  orderAmount?: number;
  escrowStatus?: string;
  bidPrice?: number;
  deliveryDays?: number;
  clientBudgetCap?: number;
  paypalOrderId?: string;
  providerId?: string;
  sessionId?: string;
}

export default function DirectChatModal({
  isOpen,
  onClose,
  channelId,
  orderTitle,
  currentUserRole,
  currentUserName,
  otherPartyName,
  otherPartyLastSeen,
  isPurchasedOrder = false,
  orderAmount,
  escrowStatus,
  bidPrice,
  deliveryDays,
  clientBudgetCap,
  paypalOrderId,
  providerId,
  sessionId
}: DirectChatModalProps) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState('');
  const [isVoiceRecorderOpen, setIsVoiceRecorderOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendVoiceNote = async (result: VoiceNoteResult) => {
    setSending(true);
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: DirectMessage = {
      id: tempId,
      orderId: channelId,
      channelId: channelId,
      providerId: providerId,
      providerName: otherPartyName,
      sessionId: sessionId,
      senderRole: currentUserRole,
      senderName: currentUserName,
      message: result.transcript,
      audioUrl: result.audioUrl,
      audioDuration: result.duration,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await fetch('/api/direct-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: channelId,
          channelId: channelId,
          providerId: providerId || '',
          providerName: currentUserRole === 'provider' ? currentUserName : otherPartyName,
          sessionId: sessionId || '',
          senderRole: currentUserRole,
          senderName: currentUserName,
          message: result.transcript,
          audioUrl: result.audioUrl,
          audioDuration: result.duration
        })
      });

      if (res.ok) {
        await fetchMessages();
      }
    } catch (err) {
      console.error('Send voice note failed:', err);
    } finally {
      setSending(false);
    }
  };

  const fetchMessages = async () => {
    if (!channelId) return;
    try {
      const params = new URLSearchParams();
      params.set('orderId', channelId);
      params.set('channelId', channelId);
      if (providerId) params.set('providerId', providerId);
      if (otherPartyName) params.set('providerName', otherPartyName);
      if (sessionId) params.set('sessionId', sessionId);

      const res = await fetch(`/api/direct-messages?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.warn('Error fetching direct messages:', err);
    }
  };

  useEffect(() => {
    if (isOpen && channelId) {
      setLoading(true);
      fetchMessages().finally(() => setLoading(false));

      // Poll every 3.5s for fresh messages while open
      const interval = setInterval(fetchMessages, 3500);
      return () => clearInterval(interval);
    }
  }, [isOpen, channelId, providerId, otherPartyName]);

  // Mark unread messages as seen when modal is open
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      const unreadMsgs = messages.filter(m => m.senderRole !== currentUserRole && !m.isSeen);
      if (unreadMsgs.length > 0) {
        fetch('/api/direct-messages', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageIds: unreadMsgs.map(m => m.id),
            seenByRole: currentUserRole
          })
        }).catch(() => {});
      }
    }
  }, [isOpen, messages, currentUserRole]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');

    // Optimistic local add
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: DirectMessage = {
      id: tempId,
      orderId: channelId,
      channelId: channelId,
      providerId: providerId,
      providerName: otherPartyName,
      sessionId: sessionId,
      senderRole: currentUserRole,
      senderName: currentUserName,
      message: text,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await fetch('/api/direct-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: channelId,
          channelId: channelId,
          providerId: providerId || '',
          providerName: currentUserRole === 'provider' ? currentUserName : otherPartyName,
          sessionId: sessionId || '',
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

  // Dynamic status computation for other party
  const latestOtherMsg = messages.filter(m => m.senderRole !== currentUserRole).slice(-1)[0];
  const lastActiveTimestamp = otherPartyLastSeen || latestOtherMsg?.timestamp || (latestOtherMsg as any)?.createdAt || (currentUserRole === 'provider' ? new Date().toISOString() : undefined);
  const isOnline = isUserOnline(lastActiveTimestamp);
  const lastSeenText = formatLastSeen(lastActiveTimestamp);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl h-[620px] flex flex-col rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-zinc-950 shadow-md ${
              isPurchasedOrder
                ? 'bg-gradient-to-tr from-emerald-400 to-teal-500'
                : 'bg-gradient-to-tr from-cyan-400 to-blue-500'
            }`}>
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Direct 1-on-1 Collaboration</h3>
                {isPurchasedOrder ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold">
                    <ShieldCheck className="h-3 w-3" />
                    Verified Escrow
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1 font-bold">
                    <Clock className="h-3 w-3" />
                    Pre-Escrow Bid Discussion
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-xs text-zinc-400">
                  Between <strong className="text-white">{currentUserName}</strong> ({currentUserRole === 'client' ? 'Client' : 'Specialist'}) and <strong className="text-cyan-300">{otherPartyName}</strong>
                </p>
                <span className="text-zinc-600 hidden sm:inline">•</span>
                <span className={`inline-flex items-center gap-1 font-mono text-[10px] ${isOnline ? 'text-emerald-400 font-semibold' : 'text-zinc-400'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                  {otherPartyName}: {lastSeenText}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUserRole === 'client' && (
              <Link
                href={`/?tab=specialists&providerId=${providerId || ''}&orderId=${channelId}&sessionId=${sessionId || ''}&providerName=${encodeURIComponent(otherPartyName)}`}
                onClick={onClose}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-cyan-300 hover:text-white text-xs font-semibold border border-cyan-500/30 transition-all cursor-pointer shadow-sm"
                title="Open full specialist chat room in main dashboard"
              >
                <span>Full Workspace</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Context Card: Clearly identifies Client status to Provider and vice versa */}
        <div className="px-5 py-3 bg-zinc-900/40 border-b border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-mono text-zinc-500 block">Project Scope</span>
            <p className="font-semibold text-zinc-200 truncate max-w-sm">{orderTitle}</p>
          </div>

          <div className="text-left sm:text-right shrink-0">
            {isPurchasedOrder ? (
              <div className="space-y-0.5 font-mono">
                <span className="text-[10px] text-zinc-500 uppercase block">Contract Value & Escrow</span>
                <span className="text-sm font-black text-emerald-400">${orderAmount} USD</span>
                <span className="text-[10px] text-zinc-400 block">
                  Status: <strong className="text-emerald-300">{escrowStatus || 'In Escrow'}</strong>
                </span>
              </div>
            ) : (
              <div className="space-y-0.5 font-mono">
                <span className="text-[10px] text-zinc-500 uppercase block">Milestone Bid Terms</span>
                <span className="text-sm font-black text-cyan-300">
                  ${bidPrice || 160} USD • {deliveryDays || 3} Days
                </span>
                {clientBudgetCap && (
                  <span className="text-[10px] text-zinc-400 block">Client Cap: ${clientBudgetCap} USD</span>
                )}
              </div>
            )}
          </div>
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
              <p className="text-zinc-300 font-medium">No direct messages in this channel yet.</p>
              <p className="text-[11px] text-zinc-500">
                You can discuss technical specs, share GitHub repository links, deliverable drafts, or refine milestone requirements directly!
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.senderRole === currentUserRole;
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
                >
                  {isMe ? (
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 bg-gradient-to-tr from-cyan-500 to-blue-600 text-zinc-950 shadow-md">
                      <User className="h-4 w-4" />
                    </div>
                  ) : (
                    <img 
                      src={getSpecialistRealAvatar(m.senderName || otherPartyName)} 
                      alt={otherPartyName} 
                      className="h-8 w-8 rounded-xl object-cover border border-zinc-700 bg-zinc-800 shrink-0 shadow-sm" 
                    />
                  )}

                  <div className={`space-y-1 max-w-[75%]`}>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 flex-wrap">
                      <span className="font-bold text-zinc-300">{m.senderName}</span>
                      {m.isAiAutoReply && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1">
                          <Bot className="h-2.5 w-2.5 text-purple-400" />
                          AI Receptionist
                        </span>
                      )}
                      <span>•</span>
                      <span suppressHydrationWarning>{new Date(m.timestamp || (m as any).createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && (
                        m.isSeen ? (
                          <span title="Seen by other party" className="ml-1 inline-flex">
                            <CheckCheck className="h-3 w-3 text-cyan-400 font-bold" />
                          </span>
                        ) : (
                          <span title="Delivered (Unread)" className="ml-1 inline-flex">
                            <Check className="h-3 w-3 text-zinc-500" />
                          </span>
                        )
                      )}
                    </div>

                    <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      isMe
                        ? 'bg-cyan-600/25 text-cyan-50 border border-cyan-500/30 rounded-tr-none'
                        : 'bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-tl-none'
                    }`}>
                      {m.audioUrl && (
                        <div className="mb-2">
                          <VoiceNotePlayer
                            audioUrl={m.audioUrl}
                            duration={m.audioDuration}
                            transcript={m.message}
                            role={isMe ? 'client' : 'provider'}
                            compact
                          />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{m.message}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div className="h-6 shrink-0" ref={messagesEndRef} />
        </div>

        {/* CyberVoice™ AI Dictation & Audio Recorder Bar */}
        {isVoiceRecorderOpen && (
          <div className="p-3 border-t border-zinc-800 bg-zinc-950">
            <VoiceNoteRecorder
              onSend={(result) => {
                sendVoiceNote(result);
                setIsVoiceRecorderOpen(false);
              }}
              onCancel={() => setIsVoiceRecorderOpen(false)}
              placeholderPrompt={`Speak voice note for ${otherPartyName}...`}
            />
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsVoiceRecorderOpen(prev => !prev)}
            className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              isVoiceRecorderOpen
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border border-zinc-700 hover:border-cyan-500/40'
            }`}
            title="Record voice note"
          >
            <Mic className="h-4 w-4" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${otherPartyName} (e.g. 'Can we adjust milestone 1 scope?' or 'Here is the GitHub repo')...`}
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
