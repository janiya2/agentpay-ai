# 🤖 AgentPay AI — Autonomous Agentic Commerce & Milestone Escrow Protocol Powered by PayPal

[![PayPal AI Hackathon 2026](https://img.shields.io/badge/PayPal_AI_Hackathon-2026_Entry-0070BA?style=for-the-badge&logo=paypal)](https://paypalaihackathon.devpost.com/)
[![Built with Gemini 2.5](https://img.shields.io/badge/Google_Gemini-2.5_Flash-8E75C2?style=for-the-badge&logo=googlegemini)](https://ai.google.dev/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15.1_App_Router-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](./LICENSE)

> **Official Submission for the PayPal AI Hackathon 2026: "Build What's Next with PayPal and AI"**  
> **Lead Architect:** Janitha Dilshan (`@janiya2` / InnoXpert Technologies)

---

## ⚡ Executive Summary

While standard e-commerce relies on users manually browsing listings, adding items to carts, and filling checkout forms, the emerging era of **Agentic Commerce** demands that autonomous AI agents act as intelligent proxies—finding services, vetting portfolios, negotiating milestone deliverables, and executing cryptographically-safe transactions within strict user-authorized boundaries.

**AgentPay AI** is an institutional-grade Autonomous Commerce & Procurement Protocol that connects buyers with 100+ verified talent providers through real-time AI negotiation and secure **PayPal Orders v2** milestone escrows.

---

## 🌟 Key Architectural Capabilities

1. **Autonomous Procurement & Discovery**:
   - Clients express requirements naturally in conversational chat or voice:  
     *e.g. "Find me a senior Next.js 15 developer under $150 with a 3-day turnaround."*
   - Powered by **Google Gemini 2.5**, the agent semantically parses skills, budget parameters, and delivery constraints.

2. **Zero-Mock Real AI Vetting & Negotiation**:
   - Real-time function calling scans 100+ active provider profiles stored in Firebase Firestore.
   - Negotiates bilateral terms and milestone deliverables directly with suppliers matching client specifications.

3. **Safe Spending Protocol (Guardrails)**:
   - Eliminates fear of AI overspending. The client defines a hard spending ceiling (e.g. $200 USD).
   - The AI agent is cryptographically restricted from executing any PayPal transaction exceeding this limit.

4. **Inline Native PayPal Smart Checkout**:
   - Seamlessly generates dynamic PayPal Orders v2 requests inline inside the chat interface via `@paypal/react-paypal-js`.
   - 1-Click approval captures funds into a secure milestone escrow ledger.

5. **Multi-Key Gemini Failover Pool**:
   - Resilient multi-key architecture supporting a pool of up to 5 Gemini API keys.
   - Automatically detects rate limits (HTTP 429) or connection timeouts and seamlessly rotates to the next available key with zero user disruption.

6. **Resend Transactional Notification Engine**:
   - Dispatches instant branded email notifications to service providers when an autonomous match and milestone proposal is created.

7. **Dedicated Portals**:
   - **/services**: Browse 100+ verified service providers across 6 commercial domains.
   - **/providers**: Dedicated workspace for providers to view assigned escrows and submit deliverables.
   - **/orders**: Real-time cryptographic ledger of all escrow transactions and PayPal capture IDs.
   - **/admin**: Security-hardened control hub with passcode authentication to configure PayPal credentials, Gemini API key failover pools, and Resend settings.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion |
| **AI Inference** | Google Gemini 2.5 Flash (`@google/generative-ai`) with dynamic Multi-Key Failover Pool |
| **Payment Gateway** | PayPal Developer Platform, Orders v2 REST API, `@paypal/react-paypal-js` Smart Buttons |
| **Database & Auth** | Firebase Firestore (Blaze Project) |
| **Email Dispatch** | Resend API v2 SDK |

---

## 🚀 Quick Start Guide

### 1. Clone & Install
```bash
git clone https://github.com/janiya2/agentpay-ai.git
cd agentpay-ai
npm install
```

### 2. Configure Environment (`.env.local`)
```env
NEXT_PUBLIC_FIREBASE_PROJECT_ID="web-b61f1"
GEMINI_API_KEY="AIzaSy..."
PAYPAL_CLIENT_ID="sb"
PAYPAL_CLIENT_SECRET=""
PAYPAL_MODE="sandbox"
RESEND_API_KEY=""
RESEND_FROM_EMAIL="onboarding@resend.dev"
ADMIN_PASSCODE="innoxpert2026"
```

### 3. Run Seeder (Seeds 100+ Providers)
```bash
npm run seed
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3005](http://localhost:3005) in your browser.

---

## 📄 License
This project is open-source under the [MIT License](./LICENSE).

