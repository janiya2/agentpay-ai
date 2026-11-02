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
  status: 'active' | 'busy' | 'offline';
  verified: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actionPayload?: {
    type: 'search_results' | 'negotiation_proposal' | 'paypal_checkout' | 'escrow_release';
    matchedProviders?: ServiceProvider[];
    selectedProvider?: ServiceProvider;
    negotiatedTerms?: {
      scopeTitle: string;
      finalPrice: number;
      originalPrice: number;
      deliveryDays: number;
      milestones: Array<{
        title: string;
        amount: number;
      }>;
    };
    paypalOrderId?: string;
    amount?: number;
    currency?: string;
  };
}

export interface AgentPayOrder {
  id: string;
  paypalOrderId: string;
  paypalCaptureId?: string;
  buyerName: string;
  buyerEmail: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  serviceTitle: string;
  amount: number;
  currency: 'USD';
  status: 'pending-payment' | 'in-escrow' | 'completed' | 'disputed' | 'refunded';
  milestones: Array<{
    id: string;
    title: string;
    amount: number;
    status: 'pending' | 'in-progress' | 'verified' | 'released';
  }>;
  deliverableUrl?: string;
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
  adminPasscode: string;
}

