'use client';

import React from 'react';
import { Ban, AlertTriangle, X, RefreshCw } from 'lucide-react';

interface CancelContractConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isCancelling: boolean;
  orderTitle: string;
  orderId: string;
}

export default function CancelContractConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isCancelling,
  orderTitle,
  orderId
}: CancelContractConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-md rounded-3xl bg-zinc-950/95 border border-rose-500/40 shadow-2xl shadow-rose-950/60 overflow-hidden text-left space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-rose-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="p-5 sm:p-6 pb-0 flex items-start justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-md">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Cancel Escrow Contract?
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Order Ref: #{orderId}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 sm:px-6 relative z-10 space-y-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 text-zinc-300 space-y-1">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block">Project Title:</span>
            <p className="font-semibold text-white">{orderTitle}</p>
          </div>

          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-200 text-xs space-y-1 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-rose-300 text-xs">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>Contract Void Notice</span>
            </div>
            <p className="text-[11px] text-zinc-300">
              This action will cancel the contract, release unspent escrow reserves according to platform policy, notify the specialist, and close deliverable submissions.
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 pt-2 bg-zinc-900/50 border-t border-zinc-800/80 flex items-center justify-end gap-2.5 relative z-10">
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Keep Active
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isCancelling}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:opacity-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/50 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isCancelling ? 'animate-spin' : ''}`} />
            <span>{isCancelling ? 'Cancelling Contract...' : 'Confirm Cancellation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

