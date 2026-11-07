'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import JudgeGuidedTourModal, { JudgeTourFloatingLauncher, JudgeInteractiveTourBanner } from '@/components/JudgeGuidedTourModal';
import PayPalWebhooksTerminalModal from '@/components/PayPalWebhooksTerminalModal';
import SystemArchitectureMatrixModal from '@/components/SystemArchitectureMatrixModal';
import { useJudgeTour } from '@/context/JudgeTourContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { 
    isWebhooksModalOpen, 
    closeWebhooksModal,
    isArchitectureModalOpen,
    closeArchitectureModal
  } = useJudgeTour();
  const isAgentChat = pathname === '/';

  // If on Home Page ('/'): Render Full-Screen ChatGPT/Grok Style Agent Workspace (No duplicate header/footer)
  if (isAgentChat) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#090A0F] text-zinc-100 flex flex-col">
        {children}
        <AuthModal />
        <JudgeInteractiveTourBanner />
        <JudgeGuidedTourModal />
        <JudgeTourFloatingLauncher />
        <PayPalWebhooksTerminalModal 
          isOpen={isWebhooksModalOpen} 
          onClose={closeWebhooksModal} 
        />
        <SystemArchitectureMatrixModal
          isOpen={isArchitectureModalOpen}
          onClose={closeArchitectureModal}
        />
      </div>
    );
  }

  // If on other management pages (/orders, /services, /providers, /admin): Standard header + layout + footer
  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <AuthModal />
      <JudgeInteractiveTourBanner />
      <JudgeGuidedTourModal />
      <JudgeTourFloatingLauncher />
      <PayPalWebhooksTerminalModal 
        isOpen={isWebhooksModalOpen} 
        onClose={closeWebhooksModal} 
      />
      <SystemArchitectureMatrixModal
        isOpen={isArchitectureModalOpen}
        onClose={closeArchitectureModal}
      />
      <footer className="border-t border-zinc-800/80 bg-zinc-950/80 py-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-semibold text-zinc-400">AgentPay AI Protocol</span>
            <span>• Official Submission for PayPal AI Hackathon 2026</span>
          </div>
          <div className="text-zinc-600">
            Architected & Engineered by <span className="text-cyan-400 font-medium">Janitha Dilshan</span> (InnoXpert Studio)
          </div>
        </div>
      </footer>
    </div>
  );
}
