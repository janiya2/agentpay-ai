import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type } = body;

    // 1. Test Single Google Gemini API Key
    if (type === 'gemini') {
      const { key } = body;
      if (!key || typeof key !== 'string' || key.trim().length < 10) {
        return NextResponse.json({ success: false, error: 'API key is empty or too short (must be > 10 characters).' });
      }

      const cleanKey = key.trim();
      const startTime = Date.now();

      try {
        const genAI = new GoogleGenerativeAI(cleanKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent("Ping test. Respond strictly with: PONG");
        const responseText = result.response.text();
        const latencyMs = Date.now() - startTime;

        return NextResponse.json({
          success: true,
          message: `Active & Operational! Latency: ${latencyMs}ms • Model: gemini-1.5-flash (${responseText.trim()})`,
          latencyMs
        });
      } catch (geminiErr: any) {
        const raw = geminiErr.message || '';
        let errorMsg = raw;

        if (raw.includes('leaked')) {
          errorMsg = '⚠️ Blocked: This API key was reported as leaked by Google. Please generate a fresh key in Google AI Studio (aistudio.google.com).';
        } else if (raw.includes('API_KEY_INVALID') || raw.includes('400')) {
          errorMsg = '❌ Invalid Key: API key not recognized by Google Generative AI.';
        } else if (raw.includes('429')) {
          errorMsg = '⏳ Rate Limited: Key is active but hit Google free-tier quota (HTTP 429). The Multi-Key pool will auto-failover.';
        } else if (raw.includes('404')) {
          errorMsg = '⚠️ Model Not Found for this key tier. Try gemini-1.5-flash or check API permissions.';
        }

        return NextResponse.json({ success: false, error: errorMsg });
      }
    }

    // 2. Test Entire Google Gemini Multi-Key Failover Pool
    if (type === 'gemini_pool') {
      const { keys } = body;
      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return NextResponse.json({ success: false, error: 'No keys provided in pool.' });
      }

      const results = [];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]?.trim();
        if (!k || k.length < 10) {
          results.push({ index: i, keySnippet: k ? `${k.substring(0, 6)}...` : '(empty)', status: 'empty', error: 'Empty or invalid key' });
          continue;
        }

        const startTime = Date.now();
        try {
          const genAI = new GoogleGenerativeAI(k);
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          await model.generateContent("Ping");
          const latencyMs = Date.now() - startTime;
          results.push({ index: i, keySnippet: `${k.substring(0, 8)}...`, status: 'active', latencyMs });
        } catch (err: any) {
          const raw = err.message || '';
          let errStr = 'Failed';
          if (raw.includes('leaked')) errStr = 'Leaked (Blocked)';
          else if (raw.includes('429')) errStr = 'Rate Limited (429)';
          else if (raw.includes('API_KEY_INVALID')) errStr = 'Invalid Key';
          results.push({ index: i, keySnippet: `${k.substring(0, 8)}...`, status: 'failed', error: errStr });
        }
      }

      const activeCount = results.filter(r => r.status === 'active').length;
      return NextResponse.json({
        success: true,
        poolSummary: `${activeCount}/${results.length} Keys Active & Operational`,
        activeCount,
        totalCount: results.length,
        results
      });
    }

    // 3. Test PayPal Developer Credentials (OAuth v2 Token Generation)
    if (type === 'paypal') {
      const { clientId, clientSecret, mode = 'sandbox' } = body;

      if (!clientId || !clientSecret || clientId.trim().length < 5 || clientSecret.trim().length < 5) {
        return NextResponse.json({ success: false, error: 'Please enter both valid PayPal Client ID and Client Secret.' });
      }

      const baseUrl = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
      const authString = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64');
      const startTime = Date.now();

      try {
        const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'grant_type=client_credentials'
        });

        const latencyMs = Date.now() - startTime;
        const data = await res.json();

        if (!res.ok) {
          return NextResponse.json({
            success: false,
            error: `PayPal Auth Error (${res.status}): ${data.error_description || data.error || 'Invalid Client ID or Secret'}`
          });
        }

        return NextResponse.json({
          success: true,
          message: `PayPal ${mode.toUpperCase()} OAuth v2 Token Granted! Latency: ${latencyMs}ms • Token valid for ${data.expires_in}s • Scope: ${data.scope?.substring(0, 35)}...`,
          appId: data.app_id,
          latencyMs
        });
      } catch (netErr: any) {
        return NextResponse.json({ success: false, error: `Network error connecting to PayPal API: ${netErr.message}` });
      }
    }

    // 4. Test Resend API Key
    if (type === 'resend') {
      const { apiKey } = body;
      if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('re_')) {
        return NextResponse.json({ success: false, error: 'Resend API key must start with "re_".' });
      }

      const startTime = Date.now();
      try {
        const res = await fetch('https://api.resend.com/api-keys', {
          headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
        });
        const latencyMs = Date.now() - startTime;

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return NextResponse.json({
            success: false,
            error: `Resend Auth Failed (${res.status}): ${errData.message || 'Unauthorized API key'}`
          });
        }

        return NextResponse.json({
          success: true,
          message: `Resend API Key Verified! Latency: ${latencyMs}ms • Ready for transactional alerts.`,
          latencyMs
        });
      } catch (resendErr: any) {
        return NextResponse.json({ success: false, error: `Network error: ${resendErr.message}` });
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid test type specified.' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Test execution failed' }, { status: 500 });
  }
}

