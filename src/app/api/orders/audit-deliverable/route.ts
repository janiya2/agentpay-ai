import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { geminiRotator } from '@/lib/gemini-rotator';
import { fetchGitHubRepoDetails, GitHubFileContent } from '@/lib/github-ingest';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId parameter' }, { status: 400 });
    }

    const orderRef = doc(db, 'agentpay_orders', orderId);
    const snap = await getDoc(orderRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Order not found in Firestore' }, { status: 404 });
    }

    const orderData = snap.data();
    const deliverable = orderData.deliverable;

    if (!deliverable) {
      return NextResponse.json({ 
        error: 'No deliverable submitted yet. The specialist must first submit a repository, demo link, or deliverable summary.' 
      }, { status: 400 });
    }

    // Ingest repository if GitHub link provided
    let githubData: any = null;
    if (deliverable.repoUrl) {
      githubData = await fetchGitHubRepoDetails(deliverable.repoUrl);
    }

    const hasIngestedCode = Boolean(githubData && githubData.isVerifiable && Array.isArray(githubData.files) && githubData.files.length > 0);

    // Prepare Contract & Code context for Gemini 2.5 Flash
    const contractContext = `
================ CONTRACT REQUIREMENTS & RFP SCOPE ================
Project Service Title: ${orderData.serviceTitle || 'Digital Milestone Contract'}
Agreed Contract Escrow Value: $${orderData.amount} USD
Buyer / Client: ${orderData.buyerName} (${orderData.buyerEmail})
Specialist / Provider: ${orderData.providerName}
Agreed Milestones:
${(orderData.milestones || []).map((m: any, idx: number) => `  - Milestone ${idx + 1}: "${m.title}" ($${m.amount} USD)`).join('\n')}

================ SUBMITTED DELIVERABLES BY SPECIALIST ================
Deliverable Version: #${deliverable.version || 1}
Submitted At: ${deliverable.submittedAt || new Date().toISOString()}
GitHub Repo / PR Link: ${deliverable.repoUrl || 'None specified'}
Live Demo / Website Preview URL: ${deliverable.liveDemoUrl || 'None specified'}

Specialist Walkthrough & Technical Summary:
"${deliverable.summaryNotes || 'Deliverables submitted for milestone escrow verification.'}"

Test & Setup Instructions:
"${deliverable.testInstructions || 'Follow standard package.json scripts.'}"

================ EXTRACTED REPOSITORY CODE & ARTIFACTS ================
${hasIngestedCode ? `
Repository Structure Overview (${githubData.fileTreeSummary.length} files detected):
${githubData.fileTreeSummary.slice(0, 30).map((p: string) => `  - ${p}`).join('\n')}

Inspected Source Code Files (${githubData.files.length} core files ingested):
${githubData.files.map((f: GitHubFileContent) => `
--- FILE: ${f.path} ---
${f.content}
`).join('\n')}
` : `
Status Note: ${githubData?.error ? `GitHub ingestion notice: ${githubData.error}.` : 'No direct public GitHub repository provided.'}
Audit instruction: Conduct verification based on the specialist's submitted architectural summary, live demo/website URL, and setup instructions. If the technical walkthrough is clear, comprehensive, and satisfies the milestone scope, award appropriate marks. If critical code verification cannot be completed without a public repository, note this in the checklist and feedback.
`}
`;

    const systemPrompt = `You are the Lead Autonomous Software Auditor and Escrow Verification Judge for the AgentPay AI Platform.
Your mission is to perform a rigorous, unbiased technical audit of the specialist's submitted deliverable against the client's contract RFP requirements before funds can be released from PayPal Escrow.

Analyze the code and deliverables thoroughly across 3 dimensions:
1. SCOPE ADHERENCE (0 to 100): Does the code deliver the requested features, components, tech stack, and milestone specs?
2. CODE QUALITY & ARCHITECTURE (0 to 100): Is the code clean, modular, properly typed (TypeScript/types), following modern conventions, well-documented?
3. SECURITY & SECRETS SCAN (0 to 100): Scan for hardcoded API keys, secrets, eval(), unsafe injections, or risky dependencies.

STRICT VERIFICATION & AUDIT RULES:
- If the deliverable is a placeholder, dummy link (such as "https://git.com", dummy text like "ghfgh..."), or provides NO verifiable working code or live deployment matching the milestone RFP, score it strictly between 0 and 20. Verdict MUST be "CHANGES_REQUESTED", and list the exact reasons why in "issues".
- If overallScore >= 80: verdict MUST be "PASSED_VERIFIED"
- If overallScore < 80: verdict MUST be "CHANGES_REQUESTED"

YOU MUST RESPOND ONLY WITH VALID JSON MATCHING THIS EXACT SCHEMA (no markdown, no backticks, no extra prose):
{
  "overallScore": number,
  "verdict": "PASSED_VERIFIED" | "CHANGES_REQUESTED",
  "scopeMatch": number,
  "qualityScore": number,
  "securityScore": number,
  "summary": "2-3 concise professional sentences summarizing the audit findings and verdict",
  "issues": ["Specific issue 1 if any", "Specific issue 2 if any"],
  "checklist": [
    {
      "item": "RFP Scope & Feature Completeness",
      "passed": boolean,
      "details": "Short explanation"
    },
    {
      "item": "Tech Stack & Framework Compliance",
      "passed": boolean,
      "details": "Short explanation"
    },
    {
      "item": "Code Modularity & Clean Architecture",
      "passed": boolean,
      "details": "Short explanation"
    },
    {
      "item": "Security & Leaked Secrets Scan",
      "passed": boolean,
      "details": "Short explanation"
    },
    {
      "item": "Documentation & Setup Instructions",
      "passed": boolean,
      "details": "Short explanation"
    }
  ]
}`;

    await geminiRotator.loadKeysFromFirestore();
    const rawResponse = await geminiRotator.executeWithRotation(async (genAI) => {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 3500
        }
      });
      const geminiRes = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${contractContext}` }] }]
      });
      return geminiRes.response.text();
    });
    let auditResult: any = null;

    try {
      const cleanJson = rawResponse
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      auditResult = JSON.parse(cleanJson);
    } catch {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          auditResult = JSON.parse(jsonMatch[0]);
        } catch {}
      }
    }

    if (!auditResult) {
      console.warn('Recovering auditResult fields from Gemini text via regex...');
      const scoreMatch = rawResponse.match(/"overallScore"\s*:\s*(\d+)/);
      const verdictMatch = rawResponse.match(/"verdict"\s*:\s*"([^"]+)"/);
      const scopeMatch = rawResponse.match(/"scopeMatch"\s*:\s*(\d+)/);
      const qualityMatch = rawResponse.match(/"qualityScore"\s*:\s*(\d+)/);
      const securityMatch = rawResponse.match(/"securityScore"\s*:\s*(\d+)/);
      const summaryMatch = rawResponse.match(/"summary"\s*:\s*"([^"]+)/);

      const parsedOverall = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
      const parsedVerdict = verdictMatch ? verdictMatch[1] : (parsedOverall && parsedOverall >= 80 ? 'PASSED_VERIFIED' : 'CHANGES_REQUESTED');

      auditResult = {
        overallScore: parsedOverall ?? 10,
        verdict: parsedVerdict as any,
        scopeMatch: scopeMatch ? parseInt(scopeMatch[1], 10) : 5,
        qualityScore: qualityMatch ? parseInt(qualityMatch[1], 10) : 0,
        securityScore: securityMatch ? parseInt(securityMatch[1], 10) : 0,
        summary: summaryMatch ? summaryMatch[1].replace(/\\n/g, ' ') : 'Specialist deliverable failed audit. No verifiable source code or working deployment provided.',
        issues: [
          'No valid, working GitHub repository was provided.',
          'Specialist architectural notes contain insufficient technical details.',
          'Milestone technical specifications cannot be verified without verifiable source code.'
        ],
        checklist: [
          { item: 'RFP Scope & Feature Completeness', passed: false, details: 'Cannot verify features without valid repository code.' },
          { item: 'Tech Stack & Framework Compliance', passed: false, details: 'Dependencies unverified due to placeholder repo.' },
          { item: 'Code Modularity & Clean Architecture', passed: false, details: 'Source code not accessible.' },
          { item: 'Security & Leaked Secrets Scan', passed: false, details: 'Code audit could not be performed.' },
          { item: 'Documentation & Setup Instructions', passed: false, details: 'Placeholder or incomplete setup instructions provided.' }
        ]
      };
    }

    // Cryptographic Proof Hash (SHA-256)
    const auditTimestamp = new Date().toISOString();
    const hashData = `${orderId}:${auditTimestamp}:${auditResult.overallScore}:${auditResult.verdict}:${deliverable.repoUrl || deliverable.liveDemoUrl || 'direct_submission'}`;
    const auditHash = crypto.createHash('sha256').update(hashData).digest('hex');

    const previousRecheckCount = orderData.auditCertificate?.recheckCount || 0;
    const certificate = {
      version: deliverable.version || 1,
      overallScore: Number.isFinite(Number(auditResult.overallScore)) ? Number(auditResult.overallScore) : 0,
      verdict: auditResult.verdict || 'CHANGES_REQUESTED',
      scopeMatch: Number.isFinite(Number(auditResult.scopeMatch)) ? Number(auditResult.scopeMatch) : 0,
      qualityScore: Number.isFinite(Number(auditResult.qualityScore)) ? Number(auditResult.qualityScore) : 0,
      securityScore: Number.isFinite(Number(auditResult.securityScore)) ? Number(auditResult.securityScore) : 0,
      summary: auditResult.summary || 'Specialist deliverable requires revisions. Milestone requirements could not be verified.',
      issues: Array.isArray(auditResult.issues) ? auditResult.issues : [],
      checklist: Array.isArray(auditResult.checklist) ? auditResult.checklist : [],
      techStack: Array.isArray(githubData?.techStack) ? githubData.techStack : [],
      auditHash,
      auditedAt: auditTimestamp,
      recheckCount: previousRecheckCount + 1,
      auditedFilesCount: githubData?.files?.length || 0
    };

    const isPassed = certificate.verdict === 'PASSED_VERIFIED';

    const updatePayload: Record<string, any> = {
      auditCertificate: certificate,
      deliverableStatus: isPassed ? 'audit_passed' : 'changes_requested',
      updatedAt: auditTimestamp
    };

    // If audit passed, update milestones to verified
    if (isPassed && Array.isArray(orderData.milestones)) {
      updatePayload.milestones = orderData.milestones.map((m: any) => ({
        ...m,
        status: m.status === 'released' ? 'released' : 'verified'
      }));
    }

    await updateDoc(orderRef, updatePayload);

    return NextResponse.json({
      success: true,
      orderId,
      certificate,
      deliverableStatus: updatePayload.deliverableStatus,
      message: isPassed 
        ? '🏆 AI Code Audit Completed: Deliverable VERIFIED & PASSED. Ready for PayPal Escrow Release!'
        : '⚠️ AI Code Audit Completed: Changes Requested. Provider has been alerted to review issues.'
    });

  } catch (err: any) {
    console.error('Audit deliverable error:', err);
    return NextResponse.json({ error: err.message || 'Audit execution failed' }, { status: 500 });
  }
}

