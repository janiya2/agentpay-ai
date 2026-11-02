import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'AgentPay AI — Autonomous Agentic Commerce & Milestone Escrow on PayPal',
  description: 'The world\'s first autonomous AI agentic procurement & safe spending protocol powered by Google Gemini and PayPal Orders v2.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090A0F] text-zinc-100 antialiased flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
        <Providers>
          <Navbar />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
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
        </Providers>
      </body>
    </html>
  );
}
