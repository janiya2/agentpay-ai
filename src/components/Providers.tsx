'use client';

import React from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

export default function Providers({ children }: { children: React.ReactNode }) {
  const initialOptions = {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'sb',
    currency: 'USD',
    intent: 'capture',
    components: 'buttons'
  };

  return (
    <PayPalScriptProvider options={initialOptions}>
      {children}
    </PayPalScriptProvider>
  );
}
