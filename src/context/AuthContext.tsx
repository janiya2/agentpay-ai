'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  spendingLimit: number;
  role: 'buyer' | 'judge' | 'admin';
  createdAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithJudgeAccount: () => Promise<void>;
  loginWithCustomEmail: (name: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Restore user from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('agentpay_active_user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch (e) {
          console.warn('Failed to parse stored user:', e);
        }
      }
      setLoading(false);
    }
  }, []);

  const saveUserSession = async (userObj: UserProfile) => {
    setUser(userObj);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('agentpay_active_user', JSON.stringify(userObj));
    }

    // Persist to Firestore agentpay_users
    try {
      await setDoc(doc(db, 'agentpay_users', userObj.id), {
        id: userObj.id,
        name: userObj.name,
        email: userObj.email,
        avatarUrl: userObj.avatarUrl,
        spendingLimit: userObj.spendingLimit,
        role: userObj.role,
        lastActive: 'Just now',
        status: 'verified',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('Failed to sync user to Firestore:', err);
    }
  };

  // 1-Click Judge Quick Access Account
  const loginWithJudgeAccount = async () => {
    const judgeUser: UserProfile = {
      id: 'usr_judge_janitha',
      name: 'Janitha Dilshan (Judge / Evaluator)',
      email: 'janithad2@gmail.com',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Janitha&backgroundColor=b6e3f4',
      spendingLimit: 250,
      role: 'judge',
      createdAt: new Date().toISOString()
    };
    await saveUserSession(judgeUser);
    setIsAuthModalOpen(false);
  };

  // Google Sign-In via Firebase
  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const fbUser = res.user;

      const profile: UserProfile = {
        id: fbUser.uid,
        name: fbUser.displayName || 'Client User',
        email: fbUser.email || 'client@agentpay.network',
        avatarUrl: fbUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fbUser.uid}`,
        spendingLimit: 250,
        role: 'buyer',
        createdAt: new Date().toISOString()
      };

      await saveUserSession(profile);
      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.warn('Google Sign-In Notice:', err?.code || err?.message);
      // If user closed or canceled the popup window, silently return without intrusive browser alerts
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return;
      }
      // Seamlessly fallback to Hackathon Judge profile so user is never blocked
      await loginWithJudgeAccount();
    }
  };

  // Custom Name & Email Login
  const loginWithCustomEmail = async (name: string, email: string) => {
    const cleanId = `usr_${Date.now()}`;
    const profile: UserProfile = {
      id: cleanId,
      name: name.trim() || 'Client User',
      email: email.trim() || 'client@agentpay.network',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name.trim())}`,
      spendingLimit: 200,
      role: 'buyer',
      createdAt: new Date().toISOString()
    };
    await saveUserSession(profile);
    setIsAuthModalOpen(false);
  };

  // Sign out
  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      // ignore
    }
    setUser(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('agentpay_active_user');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        loginWithGoogle,
        loginWithJudgeAccount,
        loginWithCustomEmail,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

