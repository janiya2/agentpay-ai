'use client';

import React, { Suspense } from 'react';
import ChatInterface from '@/components/ChatInterface';

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center min-h-[60vh] text-zinc-500 text-xs font-mono">
        <span className="animate-spin text-cyan-400 mr-2">⏳</span>
        Loading Autonomous Procurement Room...
      </div>
    }>
      <ChatInterface />
    </Suspense>
  );
}
