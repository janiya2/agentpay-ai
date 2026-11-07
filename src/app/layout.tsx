import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';
import AppLayout from '@/components/AppLayout';

export const metadata: Metadata = {
  title: 'AgentPay AI — Autonomous Agentic Commerce & Milestone Escrow on PayPal',
  description: 'The world\'s first autonomous AI agentic procurement & safe spending protocol powered by Google Gemini and PayPal Orders v2.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/images/agentpay-logo.svg', type: 'image/svg+xml' },
      { url: '/images/agentpay-logo.png', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/images/agentpay-logo.png', sizes: '180x180', type: 'image/png' },
      { url: '/images/agentpay-logo.svg', type: 'image/svg+xml' }
    ]
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/images/agentpay-logo.svg" />
        <link rel="icon" type="image/png" href="/images/agentpay-logo.png" />
        <link rel="apple-touch-icon" href="/images/agentpay-logo.png" />
      </head>
      <body className="min-h-screen bg-[#090A0F] text-zinc-100 antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}

