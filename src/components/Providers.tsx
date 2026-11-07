'use client';

import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { AuthProvider } from '@/context/AuthContext';
import { JudgeTourProvider } from '@/context/JudgeTourContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  // Valid PayPal REST Client IDs start with 'A' (e.g. 'Aa...', 'AV...', 'AY...') or 'sb'
  const getSanitizedClientId = (id?: string) => {
    if (!id || id === 'sb') return 'sb';
    const trimmed = id.trim();
    if (trimmed.startsWith('A') && trimmed.length > 20) {
      return trimmed;
    }
    // If not starting with 'A', it's likely a secret or invalid key; fallback to 'sb'
    return 'sb';
  };

  const [clientId, setClientId] = useState<string>(() => 
    getSanitizedClientId(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID)
  );

  useEffect(() => {
    fetch('/api/paypal/config')
      .then(res => res.json())
      .then(data => {
        if (data?.clientId) {
          const sanitized = getSanitizedClientId(data.clientId);
          setClientId(sanitized);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <JudgeTourProvider>
        <PayPalScriptProvider 
          key={clientId}
          options={{
            clientId,
            currency: 'USD',
            intent: 'capture',
            components: 'buttons',
            enableFunding: 'card'
          }}
        >
          {children}
        </PayPalScriptProvider>
      </JudgeTourProvider>
    </AuthProvider>
  );
}
