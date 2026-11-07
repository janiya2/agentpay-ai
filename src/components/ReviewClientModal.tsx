'use client';

import React, { useState } from 'react';
import { X, Star, ShieldCheck, CheckCircle2, User, Send, ThumbsUp } from 'lucide-react';
import { getSpecialistRealAvatar } from '@/lib/specialistAvatars';

interface ReviewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderTitle: string;
  clientName: string;
  clientEmail: string;
  orderAmount: number;
  providerName: string;
  providerId: string;
  onReviewSubmitted: (orderId: string, review: any) => void;
}

const DEFAULT_TAGS = [
  '⚡ Fast Escrow Release',
  '🎯 Clear Requirements',
  '💬 Prompt Communication',
  '🤝 Highly Recommended',
  '🛡️ Reliable Partner'
];

export default function ReviewClientModal({
  isOpen,
  onClose,
  orderId,
  orderTitle,
  clientName,
  clientEmail,
  orderAmount,
  providerName,
  providerId,
  onReviewSubmitted
}: ReviewClientModalProps) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('Janitha was fantastic to work with. Approved deliverable and released PayPal milestone escrow immediately!');
  const [selectedTags, setSelectedTags] = useState<string[]>([DEFAULT_TAGS[0], DEFAULT_TAGS[1]]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          reviewerRole: 'provider',
          rating,
          feedback: feedback.trim(),
          tags: selectedTags
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        onReviewSubmitted(orderId, {
          rating,
          feedback: feedback.trim(),
          tags: selectedTags,
          submittedAt: new Date().toISOString()
        });
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Review client error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-lg rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shadow-md">
              <Star className="h-5 w-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Endorse & Review Client</h3>
              <p className="text-xs text-zinc-400">
                Rate your collaboration experience with <strong className="text-cyan-300">{clientName}</strong>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Order Summary Strip */}
          <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-500 block">Completed Milestone</span>
              <p className="font-bold text-white truncate max-w-xs">{orderTitle}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-zinc-500 block">Contract Disbursed</span>
              <span className="font-mono font-black text-emerald-400 text-sm">${orderAmount} USD</span>
            </div>
          </div>

          {/* Star Rating Selector */}
          <div className="space-y-1.5 text-center py-2 bg-zinc-900/40 rounded-2xl border border-zinc-800/80">
            <label className="text-[11px] text-zinc-400 font-medium block">
              Overall Rating for {clientName}
            </label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setRating(st)}
                  className="p-1 transition-transform hover:scale-110 cursor-pointer"
                >
                  <Star className={`h-7 w-7 ${
                    st <= rating ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-zinc-700'
                  }`} />
                </button>
              ))}
            </div>
            <span className="text-[11px] font-mono text-amber-300 font-bold block">
              {rating === 5 ? '⭐⭐⭐⭐⭐ 5.0 (Exceptional Client)' : rating === 4 ? '⭐⭐⭐⭐ 4.0 (Great Client)' : '⭐⭐⭐ 3.0 (Satisfactory)'}
            </span>
          </div>

          {/* Tag Pills */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-zinc-400 font-medium block">Endorsement Tags</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {DEFAULT_TAGS.map((tag, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-xl text-[10.5px] font-mono font-semibold transition-all cursor-pointer ${
                    selectedTags.includes(tag)
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback Text Area */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-zinc-400 font-medium block">
              Public Review Note (Visible to other Specialists)
            </label>
            <textarea
              rows={3}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Detail payment reliability, clarity of communication, and promptness of escrow release..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-cyan-400 text-xs resize-none leading-relaxed"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-95 text-zinc-950 font-bold flex items-center gap-1.5 shadow-lg shadow-amber-950/40 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Publishing...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Review Published!</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Submit Client Endorsement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

