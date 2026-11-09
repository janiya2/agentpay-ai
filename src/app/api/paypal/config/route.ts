export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getPayPalConfig } from '@/lib/paypal';

export async function GET() {
  try {
    const config = await getPayPalConfig();
    return NextResponse.json({
      clientId: config.clientId || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'sb',
      mode: config.mode || 'sandbox'
    });
  } catch (err: any) {
    return NextResponse.json({
      clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'sb',
      mode: 'sandbox'
    });
  }
}

