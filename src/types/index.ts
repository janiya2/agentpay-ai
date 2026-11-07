export type ProviderCategory = 
  | 'web-development' 
  | 'ui-ux-design' 
  | 'ai-automation' 
  | 'seo-marketing' 
  | 'video-production' 
  | 'mobile-apps';

export interface ServiceProvider {
  id: string;
  name: string;
  title: string;
  category: ProviderCategory;
  hourlyRate: number;
  rating: number; // 4.7 - 5.0
  reviewCount: number;
  completedJobs: number;
  avatarUrl: string;
  bio: string;
  skills: string[];
  location: string;
  portfolioSample: {
    title: string;
    description: string;
    priceEstimate: number;
    deliveryDays: number;
  };
  contactEmail: string;
  paypalEmail?: string;
  status: 'active' | 'busy' | 'offline';
  verified: boolean;
  createdAt: string;
  // Autonomous AI Delegate Guardrails
  autoBiddingEnabled?: boolean;
  minProjectFloor?: number;
  minTurnaroundDays?: number;
  autoBidDiscountPercent?: number;
  aiAutoReplyEnabled?: boolean;
  aiAutoReplyCustomNote?: string;
  lastActive?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actionPayload?: {
    type: 'search_results' | 'negotiation_proposal' | 'paypal_checkout' | 'escrow_release' | 'inquiry_dispatched' | 'tender_dispatched' | 'escrow_success';
    matchedProviders?: ServiceProvider[];
    selectedProvider?: ServiceProvider;
    winningProvider?: ServiceProvider | any;
    inquiryStatus?: 'awaiting_provider' | 'accepted' | 'declined';
    tenderStatus?: 'tender_open' | 'closed_awarded';
    targetProviders?: Array<{
      id: string;
      name: string;
      title: string;
      email: string;
      avatarUrl: string;
      rating: number;
      hourlyRate: number;
      status: 'awaiting_bid' | 'bid_received' | 'awarded' | 'closed_late';
      bidPrice?: number;
    }>;
    bids?: Array<{
      providerId: string;
      providerName: string;
      providerAvatar?: string;
      bidPrice: number;
      deliveryDays: number;
      milestones: Array<{ title: string; amount: number }>;
      note: string;
      submittedAt: string;
      status: 'submitted' | 'awarded' | 'closed_late';
    }>;
    winningBid?: any;
    providerId?: string;
    providerName?: string;
    providerEmail?: string;
    negotiatedTerms?: {
      providerName?: string;
      providerId?: string;
      scopeTitle: string;
      finalPrice?: number;
      negotiatedPrice?: number;
      originalPrice: number;
      deliveryDays: number;
      milestones: Array<{
        title: string;
        amount: number;
      }>;
    };
    negotiationDialog?: Array<{
      speaker: 'agent' | 'provider';
      speakerName: string;
      speakerAvatar?: string;
      message: string;
      timestamp: string;
    }>;
    paypalOrderId?: string;
    amount?: number;
    currency?: string;
    isRealAI?: boolean;
    modelUsed?: string;
  };
}

export interface AgentPayOrder {
  id: string;
  sessionId?: string;
  paypalOrderId: string;
  paypalCaptureId?: string;
  buyerName: string;
  buyerEmail: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  providerAvatar?: string;
  serviceTitle: string;
  amount: number;
  currency: 'USD';
  platformFeePercentage?: number;
  platformFeeAmount?: number;
  providerPayoutAmount?: number;
  providerPaypalEmail?: string;
  payoutStatus?: 'pending' | 'partially-released' | 'disbursed';
  status: 'pending-payment' | 'in-escrow' | 'completed' | 'disputed' | 'refunded' | 'cancelled';
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  milestones: Array<{
    id: string;
    title: string;
    amount: number;
    status: 'pending' | 'in-progress' | 'verified' | 'released';
  }>;
  deliverableUrl?: string;
  deliverable?: {
    repoUrl?: string;
    liveDemoUrl?: string;
    summaryNotes?: string;
    testInstructions?: string;
    submittedAt: string;
    version?: number;
    paypalEmail?: string;
  };
  deliverableHistory?: Array<{
    version: number;
    repoUrl?: string;
    liveDemoUrl?: string;
    summaryNotes?: string;
    testInstructions?: string;
    paypalEmail?: string;
    submittedAt?: string;
    auditCertificate?: {
      version?: number;
      overallScore?: number;
      verdict?: string;
      summary?: string;
      issues?: string[];
      auditedAt?: string;
    } | null;
  }>;
  auditCertificate?: {
    version?: number;
    overallScore: number; // 0 - 100
    verdict: 'PASSED_VERIFIED' | 'CHANGES_REQUESTED' | 'FAILED';
    scopeMatch: number; // 0 - 100
    qualityScore: number; // 0 - 100
    securityScore: number; // 0 - 100
    summary: string;
    issues?: string[];
    checklist: Array<{
      item: string;
      passed: boolean;
      details?: string;
    }>;
    auditHash: string; // SHA-256
    auditedAt: string;
    recheckCount: number;
    auditedFilesCount?: number;
    techStack?: string[];
  };
  deliverableStatus?: 'awaiting_submission' | 'submitted_pending_audit' | 'audit_passed' | 'changes_requested' | 'disputed' | 'dispute_resolved';
  arbitrationRuling?: {
    caseId?: string;
    status?: 'RULING_ISSUED' | 'EXECUTED_SETTLED';
    specialistPayoutPct?: number;
    specialistPayoutAmount?: number;
    clientRefundPct?: number;
    clientRefundAmount?: number;
    title?: string;
    findings?: string[];
    precedentSummary?: string;
    rulingHash?: string;
    ruledAt?: string;
    executedAt?: string;
    paypalCaptureId?: string;
    ledgerTxId?: string;
  };
  revisionNotes?: string;
  revisionIssues?: string[];
  revisionRequestedAt?: string;
  clientReview?: {
    rating: number;
    feedback: string;
    tags?: string[];
    submittedAt: string;
    providerId: string;
    providerName: string;
  };
  providerReview?: {
    rating: number;
    feedback: string;
    tags?: string[];
    submittedAt: string;
    clientName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSettings {
  paypalClientId: string;
  paypalClientSecret: string;
  paypalMode: 'sandbox' | 'live';
  geminiKeys: string[];
  activeGeminiKeyIndex: number;
  resendApiKey: string;
  resendFromEmail: string;
  platformFeePercentage?: number;
  adminPasscode: string;
}

export interface DirectMessage {
  id: string;
  orderId?: string;
  channelId?: string;
  sessionId?: string;
  providerId?: string;
  providerName?: string;
  senderRole: 'client' | 'provider';
  senderName: string;
  senderAvatar?: string;
  message: string;
  timestamp?: string;
  createdAt?: string;
  isSeen?: boolean;
  seenAt?: string;
  status?: 'sent' | 'delivered' | 'seen';
  isAiAutoReply?: boolean;
}

export interface ChatLogEntry {
  id: string;
  timestamp: string;
  buyerName: string;
  spendingLimit: number;
  userPrompt: string;
  aiResponse: string;
  intent: 'discovery' | 'negotiation' | 'checkout_ready' | 'general_chat';
  categoryMatched?: string | null;
  providerMatched?: string | null;
  originalPrice?: number | null;
  negotiatedPrice?: number | null;
  savings?: number;
  paypalOrderId?: string | null;
  status: 'inquiry' | 'negotiated' | 'escrow_created' | 'completed';
}

export interface ChatSession {
  id: string;
  buyerName: string;
  buyerEmail: string;
  spendingLimit: number;
  messages: ChatMessage[];
  messageCount: number;
  latestPrompt: string;
  latestResponse: string;
  intent: 'discovery' | 'negotiation' | 'checkout_ready' | 'general_chat';
  categoryMatched?: string | null;
  providerMatched?: string | null;
  matchedProviders?: ServiceProvider[];
  negotiatedDeal?: {
    providerName: string;
    providerId: string;
    scopeTitle: string;
    originalPrice: number;
    negotiatedPrice: number;
    deliveryDays: number;
    milestones: Array<{ title: string; amount: number }>;
  } | null;
  originalPrice?: number | null;
  negotiatedPrice?: number | null;
  savings?: number;
  paypalOrderId?: string | null;
  orderRefId?: string | null;
  status: 'inquiry' | 'negotiated' | 'escrow_created' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface BuyerUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  spendingLimit: number;
  ordersCount: number;
  totalSpent: number;
  lastActive: string;
  status: 'active' | 'verified';
  company?: string;
  bio?: string;
  rating?: number;
  reviewCount?: number;
}

export interface ClientReview {
  id: string;
  orderId: string;
  clientEmail: string;
  clientName: string;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  rating: number; // 1 - 5
  feedback: string;
  tags?: string[];
  createdAt: string;
}

export interface PayPalPayoutRecord {
  id: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  paypalEmail: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  paypalBatchId: string;
  paypalPayoutStatus: 'SUCCESS' | 'PENDING' | 'DENIED' | 'UNCLAIMED';
  createdAt: string;
  method: 'PAYPAL_SANDBOX_PAYOUT' | 'PAYPAL_V2_PAYOUT';
  mode: 'sandbox' | 'live';
  senderBatchId?: string;
  notes?: string;
}

export interface PayPalWebhookEvent {
  id: string;
  eventType: 
    | 'CHECKOUT.ORDER.APPROVED'
    | 'PAYMENT.CAPTURE.COMPLETED'
    | 'ESCROW.MILESTONE.DISBURSED'
    | 'PAYMENT.PAYOUTSBATCH.SUCCESS'
    | 'CUSTOMER.DISPUTE.RESOLVED'
    | 'PAYMENT.CAPTURE.REFUNDED'
    | 'MERCHANT.ONBOARDING.COMPLETED';
  summary: string;
  resourceType: 'order' | 'capture' | 'disbursement' | 'payout' | 'dispute';
  orderId?: string;
  amount?: number;
  currency: 'USD';
  buyerName?: string;
  buyerEmail?: string;
  providerName?: string;
  providerEmail?: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  payoutBatchId?: string;
  timestamp: string;
  headers: {
    paypalAuthAlgo: string;
    paypalCertUrl: string;
    paypalTransmissionId: string;
    paypalTransmissionTime: string;
    paypalTransmissionSig: string;
    hmacVerificationStatus: 'VERIFIED_VALID' | 'SIGNATURE_VALID';
    httpStatusCode: number;
  };
  rawPayload: any;
}


