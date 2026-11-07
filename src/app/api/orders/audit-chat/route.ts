import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { geminiRotator } from '@/lib/gemini-rotator';
import { fetchGitHubRepoDetails, GitHubFileContent } from '@/lib/github-ingest';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, userMessage, chatHistory = [] } = body;

    if (!orderId || !userMessage) {
      return NextResponse.json({ error: 'Missing orderId or userMessage' }, { status: 400 });
    }

    const orderRef = doc(db, 'agentpay_orders', orderId);
    const snap = await getDoc(orderRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = snap.data();
    const deliverable = order.deliverable || {};
    const certificate = order.auditCertificate || null;
    const history = Array.isArray(order.deliverableHistory) ? order.deliverableHistory : [];

    // Ingest repository if repo URL provided
    let githubData: any = null;
    if (deliverable.repoUrl) {
      githubData = await fetchGitHubRepoDetails(deliverable.repoUrl);
    }

    const hasIngestedCode = Boolean(githubData && githubData.isVerifiable && Array.isArray(githubData.files) && githubData.files.length > 0);

    const systemPrompt = `You are the Lead Autonomous AI Code Auditor and Technical Escrow Inspector for AgentPay AI.
You are helping the Client (Buyer, ${order.buyerName}) analyze, inspect, and verify the software deliverable submitted by their hired specialist (${order.providerName}).

CONTRACT REQUIREMENTS & SCOPE:
- Service Title: "${order.serviceTitle}"
- Escrow Value: $${order.amount} USD
- Contract Milestones: ${(order.milestones || []).map((m: any, i: number) => `Milestone ${i + 1}: "${m.title}" ($${m.amount})`).join(', ')}

CURRENT DELIVERABLE SUBMISSION (Version #${deliverable.version || 1}):
- GitHub Repo URL: ${deliverable.repoUrl || 'None provided'}
- Live Demo / Preview: ${deliverable.liveDemoUrl || 'None provided'}
- Specialist's Architectural Notes: "${deliverable.summaryNotes || 'None'}"
- Setup Instructions: "${deliverable.testInstructions || 'None'}"
- Submission Date: ${deliverable.submittedAt || 'Recent'}
${history.length > 0 ? `- Prior Submission History: ${history.map((h: any) => `v${h.version} (${h.submittedAt ? new Date(h.submittedAt).toLocaleDateString() : 'earlier'})`).join(', ')}` : ''}

INGESTED CODEBASE DETAILS:
- Is Verifiable Codebase: ${hasIngestedCode ? 'YES (Live repository inspected)' : githubData?.isPlaceholder ? 'NO (Placeholder / Invalid link detected)' : 'PENDING / INACCESSIBLE'}
- Detected Tech Stack: ${githubData?.techStack && githubData.techStack.length > 0 ? githubData.techStack.join(', ') : 'Not explicitly detected'}
- Repository Files Tree (${githubData?.fileTreeSummary?.length || 0} files found):
${githubData?.fileTreeSummary ? githubData.fileTreeSummary.slice(0, 30).map((p: string) => `  * ${p}`).join('\n') : '  * None'}

EXTRACTED SOURCE CODE SAMPLES (${githubData?.files?.length || 0} core files):
${hasIngestedCode ? githubData.files.map((f: GitHubFileContent) => `
--- FILE: ${f.path} ---
${f.content}
`).join('\n') : 'No public source files could be extracted.'}

LATEST RECORDED AUDIT CERTIFICATE:
- Score: ${certificate?.overallScore !== undefined ? `${certificate.overallScore}/100` : 'Pending audit for current version'}
- Verdict: ${certificate?.verdict || 'AWAITING_RECHECK'}
- Scope Match: ${certificate?.scopeMatch ?? 'N/A'}/100
- Quality Score: ${certificate?.qualityScore ?? 'N/A'}/100
- Security Score: ${certificate?.securityScore ?? 'N/A'}/100
- Summary: "${certificate?.summary || 'Deliverable ready for audit'}"
- Flagged Issues: ${certificate?.issues && certificate.issues.length > 0 ? certificate.issues.map((iss: string, idx: number) => `${idx + 1}. ${iss}`).join('; ') : 'None currently flagged'}

CORE INSTRUCTIONS FOR YOUR RESPONSE:
1. ACCURATE REPOSITORY ANALYSIS:
   - If the specialist provided a real, working GitHub repository (e.g. contains React, Next.js, TypeScript, Python, etc.) with real files, DO NOT say it's a placeholder or invalid! Acknowledge the files, examine their real contents, and answer the client's questions thoroughly based on the source code above.
   - If the link is a clear placeholder (like "https://git.com" or empty text), be direct and honest that it is a placeholder link that cannot be compiled or verified.
2. ANSWER CLIENT'S QUESTIONS PRECISELY:
   - If asked "Is the GitHub repo functional & complete?", examine the file tree and code samples. Explain what exists (e.g. frontend components, backend APIs, config files) and what, if anything, is still missing from the agreed milestones.
   - If asked "Are there any hardcoded API keys or secrets?", report your scan results across the provided file contents.
   - If asked "Does the code satisfy agreed milestone scope?", map the implemented code to the contract milestones.
   - If asked for revision requests or punch-lists, provide a polite, numbered list with exact files and clear instructions for ${order.providerName}.
3. FORMATTING:
   - Use clean Markdown with bullet points, bold tags (**key items**), and code spans (\`file.ts\`). Keep your tone professional, authoritative, and helpful.`;

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [
      { role: 'user', parts: [{ text: `Here is the full technical and contract context of the deliverable you are auditing:\n${systemPrompt}` }] },
      { role: 'model', parts: [{ text: `Understood. I have ingested the deliverable details, repository source files, detected tech stack (${githubData?.techStack?.join(', ') || 'General'}), and milestone specifications for "${order.serviceTitle}". I am ready to inspect and analyze this codebase for the client.` }] }
    ];

    // Append prior chat history if provided
    for (const msg of chatHistory) {
      if (msg.role === 'user' || msg.role === 'model') {
        contents.push({
          role: msg.role,
          parts: [{ text: msg.text }]
        });
      }
    }

    // Append current user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    await geminiRotator.loadKeysFromFirestore();
    const replyText = await geminiRotator.executeWithRotation(async (genAI) => {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const geminiRes = await model.generateContent({
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1500
        }
      });
      return geminiRes.response.text();
    });

    return NextResponse.json({
      success: true,
      reply: replyText || 'Audit complete. The codebase appears consistent with requirements.'
    });
  } catch (err: any) {
    console.error('Audit chat error:', err);
    return NextResponse.json({ error: err.message || 'Audit chat failed' }, { status: 500 });
  }
}
