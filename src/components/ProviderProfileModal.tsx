'use client';

import React from 'react';
import { 
  X, Star, MapPin, DollarSign, Clock, ShieldCheck, 
  Sparkles, CheckCircle2, ArrowRight, Bot, Briefcase, Award 
} from 'lucide-react';
import { ServiceProvider } from '@/types';
import { getSpecialistRealAvatar } from '@/lib/specialistAvatars';

interface ProviderProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: ServiceProvider | null;
  spendingLimit: number;
  onSelectProvider: (providerName: string) => void;
}

export default function ProviderProfileModal({
  isOpen,
  onClose,
  provider,
  spendingLimit,
  onSelectProvider
}: ProviderProfileModalProps) {
  if (!isOpen || !provider) return null;

  const handleSelect = () => {
    onSelectProvider(provider.name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Holographic Header Gradient */}
        <div className="h-2 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600" />

        {/* Top Header */}
        <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <img 
                src={getSpecialistRealAvatar(provider.name, provider.avatarUrl)} 
                alt={provider.name} 
                className="h-14 w-14 rounded-2xl bg-zinc-800 border-2 border-cyan-500/40 object-cover shadow-lg"
              />
              <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-zinc-950" title="Online & Available" />
            </div>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">{provider.name}</h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-cyan-400" />
                  Verified Specialist
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{provider.title}</p>
              
              <div className="flex items-center gap-2.5 mt-1 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1 text-amber-400 font-semibold">
                  <Star className="h-3 w-3 fill-amber-400" />
                  <span>{provider.rating}</span>
                  <span className="text-zinc-500 font-normal">({provider.reviewCount || 18} reviews)</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-zinc-400">
                  <MapPin className="h-3 w-3 text-zinc-500" />
                  <span>{provider.location || 'Global Remote'}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
          
          {/* Key Rates & SLA Strip */}
          <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 text-center">
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-500 block">Hourly Rate</span>
              <span className="font-mono font-bold text-sm text-emerald-400">${provider.hourlyRate}/hr</span>
            </div>
            <div className="border-x border-zinc-800">
              <span className="text-[10px] uppercase font-mono text-zinc-500 block">Min Project Floor</span>
              <span className="font-mono font-bold text-sm text-cyan-300">${provider.minProjectFloor || 60} USD</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-500 block">Est. Turnaround</span>
              <span className="font-mono font-bold text-sm text-amber-300">{provider.minTurnaroundDays || 2}-3 Days</span>
            </div>
          </div>

          {/* AI Delegate Status Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/20 via-zinc-900/60 to-cyan-950/20 border border-emerald-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <span>Autonomous AI Bidding Delegate</span>
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                    ONLINE
                  </span>
                </h5>
                <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                  Autonomously negotiates milestone terms and bids instantly within client budget caps.
                </p>
              </div>
            </div>
          </div>

          {/* Professional Bio */}
          <div className="space-y-1.5">
            <h5 className="font-bold text-white uppercase font-mono tracking-wider text-[11px] flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-cyan-400" />
              <span>Professional Bio & Track Record</span>
            </h5>
            <p className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-zinc-300 leading-relaxed text-xs">
              {provider.bio || `${provider.name} is a verified senior specialist specializing in ${provider.category.replace('-', ' ')} with a track record of delivering high-performance production deliverables under strict milestone SLAs.`}
            </p>
          </div>

          {/* Core Skills & Tooling */}
          <div className="space-y-2">
            <h5 className="font-bold text-white uppercase font-mono tracking-wider text-[11px] flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-cyan-400" />
              <span>Verified Skills & Tooling</span>
            </h5>
            <div className="flex flex-wrap gap-1.5">
              {provider.skills && provider.skills.length > 0 ? (
                provider.skills.map((skill, idx) => (
                  <span 
                    key={idx}
                    className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-700/80 text-zinc-200 font-mono text-[11px] hover:border-cyan-500/50 transition-colors"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-zinc-500 text-xs">Specialist verified across {provider.category}.</span>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            onClick={handleSelect}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer"
          >
            <Bot className="h-4 w-4" />
            <span>Select {provider.name.split(' ')[0]} (Budget Cap: ${spendingLimit})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

