import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      providerId, 
      name, 
      title, 
      category, 
      hourlyRate, 
      bio, 
      skills, 
      contactEmail, 
      paypalEmail,
      location, 
      status 
    } = body;

    if (!providerId) {
      return NextResponse.json({ error: 'Missing providerId' }, { status: 400 });
    }

    const providerRef = doc(db, 'agentpay_providers', providerId);
    const snap = await getDoc(providerRef);

    if (!snap.exists()) {
      return NextResponse.json({ error: 'Provider not found in Firestore' }, { status: 404 });
    }

    // Build update object
    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    if (name) updatePayload.name = name.trim();
    if (title) updatePayload.title = title.trim();
    if (category) updatePayload.category = category;
    if (typeof hourlyRate === 'number' || typeof hourlyRate === 'string') {
      const parsedRate = Number(hourlyRate);
      if (!isNaN(parsedRate) && parsedRate > 0) {
        updatePayload.hourlyRate = parsedRate;
      }
    }
    if (bio !== undefined) updatePayload.bio = bio.trim();
    if (Array.isArray(skills)) {
      updatePayload.skills = skills;
    } else if (typeof skills === 'string') {
      updatePayload.skills = skills.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (contactEmail) updatePayload.contactEmail = contactEmail.trim();
    if (paypalEmail) updatePayload.paypalEmail = paypalEmail.trim();
    if (location) updatePayload.location = location.trim();
    if (status) updatePayload.status = status;

    await updateDoc(providerRef, updatePayload);

    return NextResponse.json({
      success: true,
      message: 'Provider profile updated successfully in Firestore',
      updatedProfile: {
        id: providerId,
        ...snap.data(),
        ...updatePayload
      }
    });

  } catch (err: any) {
    console.error('[Update Provider Profile Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to update profile' }, { status: 500 });
  }
}

