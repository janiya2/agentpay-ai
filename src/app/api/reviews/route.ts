import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, addDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      orderId, 
      reviewerRole, // 'provider' (reviewing client) | 'client' (reviewing provider)
      rating, // 1 - 5
      feedback, 
      tags 
    } = body;

    if (!orderId || !reviewerRole || !rating) {
      return NextResponse.json({ error: 'Missing required review fields' }, { status: 400 });
    }

    const orderRef = doc(db, 'agentpay_orders', orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderSnap.data();
    const cleanRating = Math.max(1, Math.min(5, Number(rating)));
    const cleanFeedback = (feedback || '').trim() || 'Verified completed milestone escrow.';
    const timeNow = new Date().toISOString();

    if (reviewerRole === 'provider') {
      // Specialist is rating & reviewing the Client
      const clientReviewData = {
        orderId,
        clientEmail: order.buyerEmail,
        clientName: order.buyerName,
        providerId: order.providerId,
        providerName: order.providerName,
        providerAvatar: order.providerAvatar || '',
        rating: cleanRating,
        feedback: cleanFeedback,
        tags: Array.isArray(tags) ? tags : ['Prompt Payment', 'Clear Scope'],
        createdAt: timeNow
      };

      // 1. Add to agentpay_client_reviews collection
      const reviewDoc = await addDoc(collection(db, 'agentpay_client_reviews'), clientReviewData);

      // 2. Update order document with clientReview stamp
      await updateDoc(orderRef, {
        clientReview: {
          id: reviewDoc.id,
          rating: cleanRating,
          feedback: cleanFeedback,
          tags: clientReviewData.tags,
          submittedAt: timeNow,
          providerId: order.providerId,
          providerName: order.providerName
        }
      });

      // 3. Update client user profile reputation if exists
      try {
        const userQ = query(collection(db, 'agentpay_users'), where('email', '==', order.buyerEmail));
        const userSnap = await getDocs(userQ);
        if (!userSnap.empty) {
          const uDoc = userSnap.docs[0];
          const curData = uDoc.data();
          const curReviewCount = curData.reviewCount || 0;
          const curRating = curData.rating || 5.0;
          const newReviewCount = curReviewCount + 1;
          const newRating = Math.round(((curRating * curReviewCount + cleanRating) / newReviewCount) * 10) / 10;

          await updateDoc(doc(db, 'agentpay_users', uDoc.id), {
            rating: newRating,
            reviewCount: newReviewCount
          });
        }
      } catch (e) {
        console.warn('Update user reputation warning:', e);
      }

      return NextResponse.json({
        success: true,
        reviewId: reviewDoc.id,
        message: 'Client review successfully published!'
      });
    } else {
      // Client is rating & reviewing the Provider
      const providerReviewData = {
        orderId,
        providerId: order.providerId,
        providerName: order.providerName,
        clientEmail: order.buyerEmail,
        clientName: order.buyerName,
        rating: cleanRating,
        feedback: cleanFeedback,
        tags: Array.isArray(tags) ? tags : ['Verified Delivery', 'High Quality'],
        createdAt: timeNow
      };

      // 1. Add to agentpay_provider_reviews collection
      const reviewDoc = await addDoc(collection(db, 'agentpay_provider_reviews'), providerReviewData);

      // 2. Update order document
      await updateDoc(orderRef, {
        providerReview: {
          id: reviewDoc.id,
          rating: cleanRating,
          feedback: cleanFeedback,
          tags: providerReviewData.tags,
          submittedAt: timeNow,
          clientName: order.buyerName
        }
      });

      // 3. Update provider rating if provider exists
      try {
        if (order.providerId) {
          const pRef = doc(db, 'agentpay_providers', order.providerId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const pData = pSnap.data();
            const curReviewCount = pData.reviewCount || 10;
            const curRating = pData.rating || 4.9;
            const newReviewCount = curReviewCount + 1;
            const newRating = Math.round(((curRating * curReviewCount + cleanRating) / newReviewCount) * 10) / 10;

            await updateDoc(pRef, {
              rating: newRating,
              reviewCount: newReviewCount
            });
          }
        }
      } catch (e) {
        console.warn('Update provider reputation warning:', e);
      }

      return NextResponse.json({
        success: true,
        reviewId: reviewDoc.id,
        message: 'Specialist review successfully published!'
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to submit review' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientEmail = searchParams.get('clientEmail');
    const providerId = searchParams.get('providerId');

    if (clientEmail) {
      const q = query(
        collection(db, 'agentpay_client_reviews'),
        where('clientEmail', '==', clientEmail)
      );
      const snap = await getDocs(q);
      const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return NextResponse.json({ success: true, reviews });
    }

    if (providerId) {
      const q = query(
        collection(db, 'agentpay_provider_reviews'),
        where('providerId', '==', providerId)
      );
      const snap = await getDocs(q);
      const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return NextResponse.json({ success: true, reviews });
    }

    return NextResponse.json({ success: true, reviews: [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to query reviews' }, { status: 500 });
  }
}

