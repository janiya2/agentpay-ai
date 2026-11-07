'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './AuthContext';

export interface TourStep {
  id: number;
  title: string;
  subtitle: string;
  route: string;
  targetPageName: string;
  description: string;
  highlightAction: string;
  actionButtonLabel: string;
  scenarioKey: 'procurement' | 'audit' | 'cashout' | 'admin' | 'dispute' | 'none';
  techStack: string[];
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    title: 'Stage 1: Natural Language RFP & Gemini Scoping',
    subtitle: 'Client Flow • Step 1 of 12',
    route: '/?scenario=procurement',
    targetPageName: 'Client Procurement Room',
    description: 'Buyers describe custom digital deliverables in plain English. Google Gemini 2.5 Flash extracts requirements into structured milestone scopes, deliverables, and tech tags.',
    highlightAction: 'Notice the Next.js analytics dashboard requirement automatically injected into the chat input.',
    actionButtonLabel: '⚡ Auto-Populate RFP Prompt',
    scenarioKey: 'procurement',
    techStack: ['Google Gemini 2.5 Flash', 'Dynamic Scope Parser', 'Milestone Breakdown']
  },
  {
    id: 2,
    title: 'Stage 2: Safe Spending Ceiling & Dynamic Budget Slider',
    subtitle: 'Client Flow • Step 2 of 12',
    route: '/?scenario=procurement',
    targetPageName: 'Client Procurement Room',
    description: 'Clients retain 100% financial custody. The platform parses proposed rates and dynamically locks the maximum authorized expenditure cap slider to $120 USD.',
    highlightAction: 'Look at the top header: the Cap slider is locked at $120 USD to prevent agent overspending.',
    actionButtonLabel: '🛡️ Lock Budget Cap at $120',
    scenarioKey: 'procurement',
    techStack: ['Autonomous Budget Guardrails', 'Real-time Slider Telemetry', 'Risk Mitigation']
  },
  {
    id: 3,
    title: 'Stage 3: Autonomous Specialist Reverse-Auction Swarm',
    subtitle: 'Client Flow • Step 3 of 12',
    route: '/?scenario=procurement',
    targetPageName: 'Client Procurement Room',
    description: 'Top verified specialists deploy autonomous AI bidding delegates that evaluate RFPs concurrently, bidding down with real-time discounts and delivery SLA guarantees.',
    highlightAction: 'Compare the 3 rival bids, turnaround days, and ROI ratings from verified specialists.',
    actionButtonLabel: '🤖 View Specialist Reverse Bids',
    scenarioKey: 'procurement',
    techStack: ['Multi-Agent Swarm Protocol', 'Competitive Reverse Bidding', 'Algorithmic Matching']
  },
  {
    id: 4,
    title: 'Stage 4: PayPal Milestone Escrow Vault & Conditional Custody',
    subtitle: 'Client Flow • Step 4 of 12',
    route: '/orders',
    targetPageName: 'Client Orders & Escrow',
    description: 'Authorized funds are secured conditionally via PayPal Orders v2 API. Capital is held cryptographically in milestone escrow tranches until code is delivered and verified.',
    highlightAction: 'Inspect active milestone tranches with live PayPal Sandbox Order IDs & Capture clearing records.',
    actionButtonLabel: '🔒 View Escrow Milestones',
    scenarioKey: 'none',
    techStack: ['PayPal Orders v2 API', 'Authorized Milestone Custody', 'Multi-Tranche Clearing']
  },
  {
    id: 5,
    title: 'Stage 5: Autonomous AI Code Auditor & AST Security Scan',
    subtitle: 'Client Verification • Step 5 of 12',
    route: '/orders?scenario=audit',
    targetPageName: 'Orders & AI Audit',
    description: 'Gemini AI clones public GitHub repositories, audits package.json, inspects AST, scans for leaked API keys, and signs cryptographic proof-of-delivery certificates.',
    highlightAction: 'Explore the holographic AI Audit Certificate with Overall Score, AST checks, and SHA-256 proof hash.',
    actionButtonLabel: '🛡️ View Holographic Audit Certificate',
    scenarioKey: 'audit',
    techStack: ['GitHub REST API Ingestion', 'AST Security Scan', 'SHA-256 Proof-of-Audit']
  },
  {
    id: 6,
    title: 'Stage 6: Client Interactive Staging Test & AI Revision Punch-List',
    subtitle: 'Client Verification • Step 6 of 12',
    route: '/orders?scenario=audit&tab=inspector',
    targetPageName: 'Orders & Interactive Code Inspector',
    description: 'Clients test live demo staging links, review test instructions (npm test), and chat with the AI Inspector. If criteria fail, dispatch a 1-click technical revision punch-list to the specialist.',
    highlightAction: 'Inspect the Ask AI Code Inspector tab to ask questions or transmit punch-lists directly to the provider.',
    actionButtonLabel: '💬 Test with AI Code Inspector',
    scenarioKey: 'none',
    techStack: ['Interactive AI Code Inspector', 'Automated Punch-List Generator', 'Staging Review']
  },
  {
    id: 7,
    title: 'Stage 7: Autonomous AI Dispute Resolution Court & Binding Escrow Arbitration',
    subtitle: 'Client Protection • Step 7 of 12',
    route: '/orders?scenario=dispute',
    targetPageName: 'Autonomous AI Dispute Court',
    description: 'When disputes arise over deliverable scope or quality, AgentPay LexGuard™ neural engine acts as a neutral arbitrator under UNCITRAL rules, issuing a binding Quantum Meruit escrow split.',
    highlightAction: 'Review the binding split ruling (75% Specialist / 25% Client Refund) and click Execute Binding PayPal Settlement.',
    actionButtonLabel: '⚖️ Convene AI Dispute Court',
    scenarioKey: 'dispute',
    techStack: ['AgentPay LexGuard™ Neural Arbiter', 'UNCITRAL Model Law', 'Bilateral Quantum Meruit Split']
  },
  {
    id: 8,
    title: 'Stage 8: Specialist Talent Workspace & Live Tender Radar',
    subtitle: 'Provider Flow • Step 8 of 12',
    route: '/providers?tab=inquiries',
    targetPageName: 'Specialist Workspace • Live Tenders',
    description: 'Specialists monitor live RFQs matching their category. Autonomous bidding delegates can auto-reply, or specialists can adjust custom quotes and delivery timelines.',
    highlightAction: 'Browse incoming project tenders, buyer scopes, and specialist auto-bidding configurations.',
    actionButtonLabel: '📡 View Live Tender RFQ Radar',
    scenarioKey: 'none',
    techStack: ['Live RFQ Dispatch', 'Autonomous Specialist Delegates', 'Bid Management']
  },
  {
    id: 9,
    title: 'Stage 9: Direct 1-on-1 Specialist Chat & Client Threads',
    subtitle: 'Provider Flow • Step 9 of 12',
    route: '/providers?tab=clients',
    targetPageName: 'Specialist Workspace • Direct Messages',
    description: 'End-to-end communication hub between buyers and specialists. Supports real-time messaging, milestone discussions, typing indicators, and deliverable status updates.',
    highlightAction: 'Open direct client conversation threads and inspect bilateral milestone coordination.',
    actionButtonLabel: '💬 Inspect 1-on-1 Client Threads',
    scenarioKey: 'none',
    techStack: ['Direct Client Messaging', 'Real-time WebSocket State', 'Typing Telemetry']
  },
  {
    id: 10,
    title: 'Stage 10: Specialist Deliverable Submission & Revision Management',
    subtitle: 'Provider Flow • Step 10 of 12',
    route: '/providers?tab=orders',
    targetPageName: 'Specialist Workspace • Active Contracts',
    description: 'Specialists link GitHub repositories, deploy live preview URLs, and submit deliverables for client review and automated AI audit verification.',
    highlightAction: 'Inspect active contracts, deliverable status badges, and revision history.',
    actionButtonLabel: '📦 Inspect Active Deliverables',
    scenarioKey: 'none',
    techStack: ['Deliverable Ingestion', 'Revision Punch-Lists', 'Escrow Release Trigger']
  },
  {
    id: 11,
    title: 'Stage 11: Specialist FinTech Wallet & Real PayPal Sandbox Cashout',
    subtitle: 'Provider Flow • Step 11 of 12',
    route: '/providers?tab=earnings&scenario=cashout',
    targetPageName: 'Specialist FinTech Wallet',
    description: 'Released milestone escrow converts into specialist available balance. Specialists disburse funds instantly to PayPal Sandbox via /v1/payments/payouts with immediate ledger deduction.',
    highlightAction: 'Click Instant PayPal Cashout on the virtual card and verify real-time available balance reduction.',
    actionButtonLabel: '💳 Open PayPal Sandbox Cashout',
    scenarioKey: 'cashout',
    techStack: ['PayPal Payouts REST API v1', 'SVG Earnings Telemetry', 'Zero-Fee Disbursements']
  },
  {
    id: 12,
    title: 'Stage 12: Master Financial Clearinghouse & B2B Tax Invoicing',
    subtitle: 'Governance & Treasury • Step 12 of 12',
    route: '/admin?tab=transactions',
    targetPageName: 'Master Admin Treasury',
    description: 'Full-spectrum administrative financial ledger tracking cumulative GMV, escrow deposits, specialist payouts, 5% retained protocol fee revenue, and 1-click compliant A4 Smart Tax Invoices.',
    highlightAction: 'Inspect the unified transaction table, download Master CSV, or preview B2B Smart Tax Invoice.',
    actionButtonLabel: '📊 Open Master Treasury Ledger',
    scenarioKey: 'admin',
    techStack: ['Platform GMV Clearing', '5% Retained Protocol Revenue', 'B2B Smart Tax Invoices']
  }
];

interface JudgeTourContextType {
  isTourModalOpen: boolean;
  openTourModal: () => void;
  openTour: () => void;
  closeTourModal: () => void;
  isWebhooksModalOpen: boolean;
  openWebhooksModal: () => void;
  closeWebhooksModal: () => void;
  isArchitectureModalOpen: boolean;
  openArchitectureModal: () => void;
  closeArchitectureModal: () => void;
  isTourBannerOpen: boolean;
  openTourBanner: () => void;
  closeTourBanner: () => void;
  toggleTourBanner: () => void;
  skipTour: () => void;
  currentStepIndex: number;
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  launchQuickScenario: (scenario: 'procurement' | 'audit' | 'cashout' | 'admin' | 'dispute') => Promise<void>;
  isScenarioRunning: boolean;
  scenarioNotice: string | null;
  setScenarioNotice: (notice: string | null) => void;
  clearScenarioNotice: () => void;
}

const JudgeTourContext = createContext<JudgeTourContextType | undefined>(undefined);

export function JudgeTourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loginWithJudgeAccount } = useAuth();

  const [isTourModalOpen, setIsTourModalOpen] = useState(false);
  const [isWebhooksModalOpen, setIsWebhooksModalOpen] = useState(false);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);
  const [isTourBannerOpen, setIsTourBannerOpen] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isScenarioRunning, setIsScenarioRunning] = useState(false);
  const [scenarioNotice, setScenarioNotice] = useState<string | null>(null);

  const openTourModal = () => setIsTourModalOpen(true);
  const closeTourModal = () => setIsTourModalOpen(false);
  const openWebhooksModal = () => setIsWebhooksModalOpen(true);
  const closeWebhooksModal = () => setIsWebhooksModalOpen(false);
  const openArchitectureModal = () => setIsArchitectureModalOpen(true);
  const closeArchitectureModal = () => setIsArchitectureModalOpen(false);
  const openTourBanner = () => setIsTourBannerOpen(true);
  const closeTourBanner = () => setIsTourBannerOpen(false);
  const toggleTourBanner = () => setIsTourBannerOpen(prev => !prev);
  const skipTour = () => {
    setIsTourBannerOpen(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('agentpay_judge_tour_skipped', 'true');
    }
  };
  const clearScenarioNotice = () => setScenarioNotice(null);

  // Load saved step index from session storage on mount (without hijacking during in-app navigation)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('agentpay_judge_tour_step');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < TOUR_STEPS.length) {
          setCurrentStepIndex(parsed);
        }
      }
    }
  }, []);

  const goToStep = (index: number) => {
    if (index >= 0 && index < TOUR_STEPS.length) {
      setCurrentStepIndex(index);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('agentpay_judge_tour_step', index.toString());
      }
      const targetStep = TOUR_STEPS[index];
      if (targetStep) {
        if (targetStep.route.startsWith('/admin') && typeof window !== 'undefined') {
          sessionStorage.setItem('agentpay_admin_auth', 'true');
        }
        router.push(targetStep.route);
      }
    }
  };

  const nextStep = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      goToStep(currentStepIndex + 1);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  };

  // Launch 1-Click Interactive Scenarios
  const launchQuickScenario = async (scenario: 'procurement' | 'audit' | 'cashout' | 'admin' | 'dispute') => {
    setIsScenarioRunning(true);
    closeTourModal();

    // 1. Ensure Judge identity is active
    if (!user || user.role !== 'judge') {
      try {
        await loginWithJudgeAccount();
      } catch (e) {
        console.warn('Judge login auto-sync error:', e);
      }
    }

    if (scenario === 'procurement') {
      setCurrentStepIndex(0);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('agentpay_judge_tour_step', '0');
      }
      setScenarioNotice('🚀 Scenario 1 Active: AI Swarm Procurement. Notice the $120 Budget Cap & reverse bids!');
      router.push('/?scenario=procurement');
    } else if (scenario === 'audit') {
      setCurrentStepIndex(4);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('agentpay_judge_tour_step', '4');
      }
      setScenarioNotice('🛡️ Scenario 2 Active: Autonomous AI Code Auditor inspecting submitted GitHub deliverable.');
      router.push('/orders?scenario=audit');
    } else if (scenario === 'dispute') {
      setCurrentStepIndex(6);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('agentpay_judge_tour_step', '6');
      }
      setScenarioNotice('⚖️ Scenario Active: Autonomous AI Dispute Resolution Court & Binding Split Ruling.');
      router.push('/orders?scenario=dispute');
    } else if (scenario === 'cashout') {
      setCurrentStepIndex(10);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('agentpay_judge_tour_step', '10');
      }
      setScenarioNotice('💸 Scenario 3 Active: Specialist PayPal Sandbox Payout. Notice real-time balance deduction!');
      router.push('/providers?tab=earnings&scenario=cashout');
    } else if (scenario === 'admin') {
      setCurrentStepIndex(11);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('agentpay_judge_tour_step', '11');
      }
      setScenarioNotice('📊 Scenario 4 Active: Platform Financial Clearinghouse & Master PayPal Audit Ledger.');
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('agentpay_admin_auth', 'true');
      }
      router.push('/admin?tab=transactions');
    }

    setTimeout(() => {
      setIsScenarioRunning(false);
    }, 1200);

    setTimeout(() => {
      setScenarioNotice(null);
    }, 8000);
  };

  return (
    <JudgeTourContext.Provider
      value={{
        isTourModalOpen,
        openTourModal,
        openTour: openTourModal,
        closeTourModal,
        isWebhooksModalOpen,
        openWebhooksModal,
        closeWebhooksModal,
        isArchitectureModalOpen,
        openArchitectureModal,
        closeArchitectureModal,
        isTourBannerOpen,
        openTourBanner,
        closeTourBanner,
        toggleTourBanner,
        skipTour,
        currentStepIndex,
        goToStep,
        nextStep,
        prevStep,
        launchQuickScenario,
        isScenarioRunning,
        scenarioNotice,
        setScenarioNotice,
        clearScenarioNotice
      }}
    >
      {children}
    </JudgeTourContext.Provider>
  );
}

export function useJudgeTour() {
  const context = useContext(JudgeTourContext);
  if (!context) {
    throw new Error('useJudgeTour must be used within a JudgeTourProvider');
  }
  return context;
}

