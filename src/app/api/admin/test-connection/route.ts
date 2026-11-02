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
      const candidateModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-pro'];

      const genAI = new GoogleGenerativeAI(cleanKey);
      let lastErr: any = null;
      let operationalModel = '';
      let responseText = '';

      for (const modelName of candidateModels) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent("Ping test. Respond strictly with: PONG");
          responseText = result.response.text();
          operationalModel = modelName;
          break;
        } catch (mErr: any) {
          lastErr = mErr;
          if (mErr?.message?.includes('404') || mErr?.message?.includes('not found')) {
            continue; // try next candidate model
          }
          break; // other error (400, 403, 429)
        }
      }

      if (operationalModel) {
        const latencyMs = Date.now() - startTime;
        return NextResponse.json({
          success: true,
          message: `Active & Operational! Latency: ${latencyMs}ms • Model: ${operationalModel} (${responseText.trim()})`,
          latencyMs
        });
      }

      const raw = lastErr?.message || '';
      let errorMsg = raw;

      if (raw.includes('leaked')) {
        errorMsg = '⚠️ Blocked: This API key was reported as leaked/compromised by Google. Please generate a fresh, free key at https://aistudio.google.com/app/apikey.';
      } else if (raw.includes('API_KEY_INVALID') || raw.includes('400')) {
        errorMsg = '❌ Invalid Key: API key format or credentials not recognized by Google Generative AI.';
      } else if (raw.includes('429')) {
        errorMsg = '⏳ Rate Limited: Key is active but hit Google free-tier quota (HTTP 429). The Multi-Key pool will auto-failover.';
      } else if (raw.includes('404') || raw.includes('not found')) {
        errorMsg = '❌ Google API Rejected Key: This key is not enabled for Gemini API (often a Firebase key or wrong project). Please create a fresh Gemini API key at https://aistudio.google.com/app/apikey.';
      }

      return NextResponse.json({ success: false, error: errorMsg });
    }

    // 2. Test Entire Google Gemini Multi-Key Failover Pool
    if (type === 'gemini_pool') {
      const { keys } = body;
      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return NextResponse.json({ success: false, error: 'No keys provided in pool.' });
      }

      const results = [];
      const candidateModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-pro'];

      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]?.trim();
        if (!k || k.length < 10) {
          results.push({ index: i, keySnippet: k ? `${k.substring(0, 6)}...` : '(empty)', status: 'empty', error: 'Empty or invalid key' });
          continue;
        }

        const startTime = Date.now();
        const genAI = new GoogleGenerativeAI(k);
        let activeModel = '';

        for (const mName of candidateModels) {
          try {
            const model = genAI.getGenerativeModel({ model: mName });
            await model.generateContent("Ping");
            activeModel = mName;
            break;
          } catch (mErr: any) {
            if (mErr?.message?.includes('404') || mErr?.message?.includes('not found')) {
              continue;
            }
            break;
          }
        }

        if (activeModel) {
          const latencyMs = Date.now() - startTime;
          results.push({ index: i, keySnippet: `${k.substring(0, 8)}...`, status: 'active', latencyMs });
        } else {
          results.push({ index: i, keySnippet: `${k.substring(0, 8)}...`, status: 'failed', error: 'Google rejected key (get fresh key from aistudio.google.com)' });
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

