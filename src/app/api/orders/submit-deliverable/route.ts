export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, repoUrl, liveDemoUrl, summaryNotes, testInstructions, paypalEmail } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId parameter' }, { status: 400 });
    }

    if (!paypalEmail || !paypalEmail.trim() || !paypalEmail.includes('@')) {
      return NextResponse.json({ 
        error: 'A valid PayPal payout email is strictly required to route client milestone escrow disbursements.' 
      }, { status: 400 });
    }

    if (!repoUrl?.trim() && !liveDemoUrl?.trim() && !summaryNotes?.trim()) {
      return NextResponse.json({ 
        error: 'Please provide at least a GitHub repository URL, live preview link, or deliverable summary.' 
      }, { status: 400 });
    }

    const orderRef = doc(db, 'agentpay_orders', orderId);
    const snap = await getDoc(orderRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Order not found in Firestore' }, { status: 404 });
    }

    const currentData = snap.data();
    const currentVersion = currentData.deliverable?.version || 0;
    const newVersion = currentVersion + 1;

    // Archive previous deliverable in deliverableHistory array
    const history = Array.isArray(currentData.deliverableHistory) ? [...currentData.deliverableHistory] : [];
    if (currentData.deliverable) {
      history.push({
        version: currentData.deliverable.version || 1,
        repoUrl: currentData.deliverable.repoUrl || '',
        liveDemoUrl: currentData.deliverable.liveDemoUrl || '',
        summaryNotes: currentData.deliverable.summaryNotes || '',
        testInstructions: currentData.deliverable.testInstructions || '',
        paypalEmail: currentData.deliverable.paypalEmail || currentData.providerPaypalEmail || '',
        submittedAt: currentData.deliverable.submittedAt || new Date().toISOString(),
        auditCertificate: currentData.auditCertificate || null
      });
    }

    const deliverablePayload = {
      repoUrl: (repoUrl || '').trim(),
      liveDemoUrl: (liveDemoUrl || '').trim(),
      summaryNotes: (summaryNotes || '').trim(),
      testInstructions: (testInstructions || '').trim(),
      paypalEmail: (paypalEmail || '').trim(),
      submittedAt: new Date().toISOString(),
      version: newVersion
    };

    const updatePayload: Record<string, any> = {
      deliverable: deliverablePayload,
      deliverableHistory: history,
      deliverableStatus: 'submitted_pending_audit',
      deliverableUrl: deliverablePayload.repoUrl || deliverablePayload.liveDemoUrl || currentData.deliverableUrl || '',
      providerPaypalEmail: (paypalEmail || '').trim(),
      // Clear past revision requests & stale audit score for fresh evaluation
      revisionNotes: '',
      revisionIssues: [],
      auditCertificate: null,
      updatedAt: new Date().toISOString()
    };

    // If order was in 'changes_requested' or 'disputed', reset status for re-audit
    if (currentData.status === 'disputed' || currentData.deliverableStatus === 'changes_requested') {
      updatePayload.deliverableStatus = 'submitted_pending_audit';
    }

    await updateDoc(orderRef, updatePayload);

    // If providerId is linked, update provider's paypalEmail in agentpay_providers
    if (currentData.providerId) {
      try {
        const provRef = doc(db, 'agentpay_providers', currentData.providerId);
        await updateDoc(provRef, {
          paypalEmail: (paypalEmail || '').trim(),
          updatedAt: new Date().toISOString()
        });
      } catch (pErr) {
        console.warn('Silent provider profile paypal email update:', pErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `🎉 Deliverable v${newVersion} submitted successfully! Ready for Autonomous AI Code Audit.`,
      deliverable: deliverablePayload,
      deliverableHistory: history,
      deliverableStatus: 'submitted_pending_audit'
    });
  } catch (err: any) {
    console.error('Submit deliverable error:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit deliverable' }, { status: 500 });
  }
}

