import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

interface KeyHealth {
  key: string;
  failures: number;
  lastFailureTime: number;
}

class GeminiKeyRotator {
  private keys: string[] = [];
  private currentIndex: number = 0;
  private keyHealthMap: Map<string, KeyHealth> = new Map();

  constructor() {
    this.refreshKeys();
  }

  public async loadKeysFromFirestore() {
    try {
      const snap = await getDoc(doc(db, 'agentpay_settings', 'general'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.geminiKeys && Array.isArray(data.geminiKeys)) {
          const validKeys = data.geminiKeys.filter((k: string) => k && k.trim().length > 10);
          if (validKeys.length > 0) {
            this.refreshKeys(validKeys);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('[GeminiRotator] Could not load keys from Firestore:', err);
    }
  }

  public refreshKeys(customKeys?: string[]) {
    if (customKeys && customKeys.length > 0) {
      this.keys = customKeys.filter(k => k && k.trim().length > 10);
    } else {
      const defaultKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
      const poolString = process.env.GEMINI_API_KEY_POOL || '';
      
      const parsedPool = poolString
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 10);

      this.keys = parsedPool.length > 0 ? parsedPool : [defaultKey].filter(Boolean);
    }

    this.keys.forEach(key => {
      if (!this.keyHealthMap.has(key)) {
        this.keyHealthMap.set(key, { key, failures: 0, lastFailureTime: 0 });
      }
    });

    if (this.keys.length === 0) {
      console.warn('[GeminiRotator] No Gemini API keys configured!');
    }
  }

  public getActiveKey(): string {
    if (this.keys.length === 0) {
      return process.env.GEMINI_API_KEY || '';
    }
    return this.keys[this.currentIndex % this.keys.length];
  }

  public reportFailure(failedKey: string) {
    const health = this.keyHealthMap.get(failedKey);
    if (health) {
      health.failures += 1;
      health.lastFailureTime = Date.now();
    }
    // Rotate to next available key
    this.currentIndex = (this.currentIndex + 1) % Math.max(1, this.keys.length);
    console.warn(`[GeminiRotator] Key rotated. Now using key index ${this.currentIndex}`);
  }

  public async executeWithRotation<T>(
    operation: (genAI: GoogleGenerativeAI, activeKey: string) => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let attempts = 0;
    const totalKeys = Math.max(1, this.keys.length);
    const allowedAttempts = Math.min(maxRetries, totalKeys);

    while (attempts < allowedAttempts) {
      const currentKey = this.getActiveKey();
      try {
        const genAI = new GoogleGenerativeAI(currentKey);
        const result = await operation(genAI, currentKey);
        return result;
      } catch (error: any) {
        attempts++;
        console.error(`[GeminiRotator] Error with key index ${this.currentIndex}:`, error?.message || error);
        
        // Report failure and rotate
        this.reportFailure(currentKey);

        if (attempts >= allowedAttempts) {
          throw new Error(`All available Gemini API keys failed after ${attempts} attempts. Last error: ${error?.message}`);
        }
      }
    }

    throw new Error('Unexpected exit from Gemini rotation loop');
  }
}

export const geminiRotator = new GeminiKeyRotator();

