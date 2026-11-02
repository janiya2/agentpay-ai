'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { ServiceProvider, ProviderCategory } from '@/types';
import { Search, Filter, Star, Briefcase, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

const CATEGORIES: { id: ProviderCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Services' },
  { id: 'web-development', label: 'Web Dev' },
  { id: 'ui-ux-design', label: 'UI/UX Design' },
  { id: 'ai-automation', label: 'AI Automation' },
  { id: 'seo-marketing', label: 'SEO Marketing' },
  { id: 'video-production', label: 'Video Production' },
  { id: 'mobile-apps', label: 'Mobile Apps' }
];

export default function ServicesPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ProviderCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxRate, setMaxRate] = useState(120);

  useEffect(() => {
    async function loadProviders() {
      try {
        const snap = await getDocs(collection(db, 'agentpay_providers'));
        if (!snap.empty) {
          const list = snap.docs.map(d => d.data() as ServiceProvider);
          setProviders(list);
        }
      } catch (err) {
        console.error('Failed to load providers from Firestore:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProviders();
  }, []);

  const filteredProviders = providers.filter(p => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRate = p.hourlyRate <= maxRate;
    return matchesCategory && matchesSearch && matchesRate;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white">Verified Service Providers</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-400">
              {filteredProviders.length} Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Browse our 100+ talent network or let the Autonomous AI Agent hire & negotiate on your behalf.
          </p>
        </div>

        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 font-bold text-xs hover:opacity-90 shadow-lg shadow-cyan-950/40 transition-all shrink-0"
        >
          <Sparkles className="h-4 w-4" />
          <span>Launch AI Agent to Negotiate</span>
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-3xl bg-zinc-900/60 border border-zinc-800/80 mb-8 space-y-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Rate Slider */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 border-t border-zinc-800/60">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, skill (Next.js, Figma, LangChain) or title..."
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/40"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-64 px-3 py-1.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-xs">
            <span className="text-zinc-400 shrink-0">Max Rate:</span>
            <input
              type="range"
              min="35"
              max="150"
              step="5"
              value={maxRate}
              onChange={e => setMaxRate(Number(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="font-mono font-bold text-cyan-300 shrink-0">${maxRate}/hr</span>
          </div>
        </div>
      </div>

      {/* Grid of 100+ Providers */}
      {loading ? (
        <div className="text-center py-20 text-zinc-500 text-sm">
          <span className="animate-spin inline-block mr-2">⏳</span>
          Loading 100+ verified service providers from Firestore...
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="text-center py-20 text-zinc-500 text-sm">
          No service providers match your current filter. Please adjust rate or category.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProviders.map(p => (
            <div
              key={p.id}
              className="p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 hover:border-cyan-500/40 transition-all space-y-4 flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <img src={p.avatarUrl} alt={p.name} className="h-12 w-12 rounded-2xl bg-zinc-800 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="font-bold text-white text-sm truncate group-hover:text-cyan-300 transition-colors">
                        {p.name}
                      </h3>
                      <span className="flex items-center gap-1 text-xs text-amber-400 font-mono font-bold">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {p.rating}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate">{p.title}</p>
                    <div className="flex items-center gap-1 text-[11px] text-zinc-500 mt-0.5">
                      <MapPin className="h-3 w-3 text-zinc-600" />
                      <span>{p.location}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {p.bio}
                </p>

                {/* Skills tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {p.skills.slice(0, 4).map(skill => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-[10px] text-zinc-300 font-mono"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Card Action */}
              <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Rate</span>
                  <span className="font-mono font-black text-sm text-emerald-400">${p.hourlyRate} <span className="text-[10px] text-zinc-500 font-normal">/ hr</span></span>
                </div>

                <Link
                  href={`/?hire=${encodeURIComponent(p.name)}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold text-xs border border-cyan-500/30 transition-all"
                >
                  <span>Hire with AI</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

