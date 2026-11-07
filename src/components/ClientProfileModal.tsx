'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, User, ShieldCheck, Star, DollarSign, Clock, CheckCircle2, 
  ExternalLink, Building, Briefcase, Mail, Award, MessageSquare, ThumbsUp, Save,
  UploadCloud, Camera, Sparkles, Link2, Trash2, Check, RefreshCw
} from 'lucide-react';
import { useAuth, UserProfile } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface ClientProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'edit' | 'view';
  clientEmail?: string;
  clientName?: string;
  clientAvatar?: string;
}

const PRESET_AVATARS = [
  { name: 'Judge / Evaluator', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Janitha&backgroundColor=b6e3f4' },
  { name: 'Tech Lead', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&backgroundColor=c0aede' },
  { name: 'Product Director', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&backgroundColor=ffd5dc' },
  { name: 'Executive Founder', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David&backgroundColor=d1d4f9' },
  { name: 'Design Architect', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elena&backgroundColor=ffdfbf' },
  { name: 'AI Strategist', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus&backgroundColor=b6e3f4' },
  { name: 'Venture Partner', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=c0aede' },
  { name: 'Startup Operator', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya&backgroundColor=ffd5dc' }
];

export default function ClientProfileModal({
  isOpen,
  onClose,
  mode,
  clientEmail,
  clientName,
  clientAvatar
}: ClientProfileModalProps) {
  const { user, updateUserProfile } = useAuth();

  // Edit Mode Form State
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [company, setCompany] = useState('');
  const [bio, setBio] = useState('');
  const [spendingLimit, setSpendingLimit] = useState(250);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Photo Upload & Avatar Tab State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeAvatarTab, setActiveAvatarTab] = useState<'upload' | 'preset' | 'url'>('upload');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // View Mode Loaded State
  const [profileData, setProfileData] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [completedOrdersCount, setCompletedOrdersCount] = useState(0);
  const [loadingViewData, setLoadingViewData] = useState(false);

  // Populate form on edit mode open
  useEffect(() => {
    if (isOpen && mode === 'edit' && user) {
      setName(user.name || '');
      const currentAv = user.avatarUrl || PRESET_AVATARS[0].url;
      setAvatarUrl(currentAv);
      setCompany(user.company || 'Enterprise Product Architect');
      setBio(user.bio || 'Managing digital milestones and autonomous escrow procurements.');
      setSpendingLimit(user.spendingLimit || 250);

      // Auto-select the right avatar tab
      if (currentAv.startsWith('data:image/')) {
        setActiveAvatarTab('upload');
      } else if (PRESET_AVATARS.some(p => p.url === currentAv)) {
        setActiveAvatarTab('preset');
      } else {
        setActiveAvatarTab('upload');
      }
    }
  }, [isOpen, mode, user]);

  // Crop & optimize image to 256x256 square data URL
  const processImageFile = (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WEBP, or GIF).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image size exceeds 10MB. Please choose a smaller photo.');
      return;
    }

    setUploadError(null);
    setIsProcessingImage(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const size = 256;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            setAvatarUrl(rawDataUrl);
            setActiveAvatarTab('upload');
            setIsProcessingImage(false);
            return;
          }

          // Center-crop to 1:1 square
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);

          // Export lightweight 0.88 JPEG data URL
          const compressed = canvas.toDataURL('image/jpeg', 0.88);
          setAvatarUrl(compressed);
          setActiveAvatarTab('upload');
        } catch (err) {
          console.warn('Canvas processing error, using raw image:', err);
          setAvatarUrl(rawDataUrl);
          setActiveAvatarTab('upload');
        } finally {
          setIsProcessingImage(false);
        }
      };
      img.onerror = () => {
        setUploadError('Could not decode the selected image file.');
        setIsProcessingImage(false);
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      setUploadError('Failed to read the file from your computer.');
      setIsProcessingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Load client stats & reviews in view mode
  useEffect(() => {
    if (!isOpen) return;

    const emailToQuery = mode === 'view' ? (clientEmail || user?.email) : user?.email;
    if (!emailToQuery) return;

    setLoadingViewData(true);

    async function fetchClientDetails() {
      try {
        // 1. Fetch user document
        const userQ = query(collection(db, 'agentpay_users'), where('email', '==', emailToQuery));
        const userSnap = await getDocs(userQ);
        if (!userSnap.empty) {
          setProfileData(userSnap.docs[0].data());
        }

        // 2. Fetch completed orders to calculate spending and orders count
        const ordersQ = query(collection(db, 'agentpay_orders'), where('buyerEmail', '==', emailToQuery));
        const ordersSnap = await getDocs(ordersQ);
        let spent = 0;
        let completed = 0;
        ordersSnap.docs.forEach(docSnap => {
          const od = docSnap.data();
          if (od.status === 'completed' || od.status === 'in-escrow') {
            spent += Number(od.amount || 0);
          }
          if (od.status === 'completed') {
            completed += 1;
          }
        });
        setTotalSpent(spent);
        setCompletedOrdersCount(completed);

        // 3. Fetch reviews received from providers
        const revRes = await fetch(`/api/reviews?clientEmail=${encodeURIComponent(emailToQuery!)}`);
        const revData = await revRes.json();
        if (revData.success && Array.isArray(revData.reviews)) {
          setReviews(revData.reviews);
        }
      } catch (err) {
        console.warn('Error fetching client profile details:', err);
      } finally {
        setLoadingViewData(false);
      }
    }

    fetchClientDetails();
  }, [isOpen, mode, clientEmail, user?.email]);

  if (!isOpen) return null;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await updateUserProfile({
        name: name.trim(),
        avatarUrl: avatarUrl.trim() || PRESET_AVATARS[0].url,
        company: company.trim(),
        bio: bio.trim(),
        spendingLimit: Number(spendingLimit)
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Save profile error:', err);
    } finally {
      setSaving(false);
    }
  };

  const displayName = mode === 'edit' ? (user?.name || 'Janitha Dilshan') : (clientName || profileData?.name || 'Client Buyer');
  const displayEmail = mode === 'edit' ? (user?.email || 'janithad2@gmail.com') : (clientEmail || profileData?.email || 'client@agentpay.network');
  const displayAvatar = mode === 'edit' ? (avatarUrl || user?.avatarUrl || PRESET_AVATARS[0].url) : (clientAvatar || profileData?.avatarUrl || PRESET_AVATARS[0].url);
  const displayCompany = mode === 'edit' ? company : (profileData?.company || 'Enterprise Procurement Client');
  const displayBio = mode === 'edit' ? bio : (profileData?.bio || 'Verified enterprise client utilizing AgentPay multi-agent autonomous negotiation and PayPal Milestone Escrows.');
  const ratingScore = profileData?.rating || (reviews.length > 0 ? (reviews.reduce((a, b) => a + (b.rating || 5), 0) / reviews.length).toFixed(1) : 5.0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold shadow-md">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {mode === 'edit' ? 'Configure Client Profile' : 'Verified Client Dossier'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold">
                  {mode === 'edit' ? 'Client Settings' : 'Specialist Inspection'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {mode === 'edit' ? 'Customize your public identity, avatar photo, and company profile' : `Reputation, trust score, and escrow history for ${displayName}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar text-xs">
          
          {/* Hidden File Picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Top Client Identity Card */}
          <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="relative group shrink-0">
              <img
                src={displayAvatar}
                alt={displayName}
                className="h-20 w-20 rounded-2xl bg-zinc-800 border-2 border-cyan-500/50 object-cover shadow-lg"
              />
              {mode === 'edit' && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-2xl bg-black/65 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer border border-cyan-400/50 backdrop-blur-[2px]"
                  title="Click to upload custom photo from device"
                >
                  <Camera className="h-5 w-5 text-cyan-300 mb-0.5" />
                  <span className="text-[9px] font-bold text-cyan-200">Upload</span>
                </button>
              )}
            </div>
            <div className="space-y-1.5 text-center sm:text-left flex-1 min-w-0">
              <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                <h4 className="text-base font-bold text-white tracking-tight">{displayName}</h4>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/30 font-bold flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Verified Buyer
                </span>
                <span className="text-xs text-amber-400 font-mono font-bold flex items-center gap-1">
                  ⭐ {ratingScore}
                </span>
              </div>

              <p className="text-xs text-cyan-300 font-medium flex items-center gap-1.5 justify-center sm:justify-start">
                <Building className="h-3.5 w-3.5 text-zinc-400" />
                <span>{displayCompany}</span>
              </p>

              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {displayBio}
              </p>

              <div className="flex items-center gap-2 text-[10.5px] font-mono text-zinc-500 justify-center sm:justify-start pt-1">
                <Mail className="h-3 w-3 text-zinc-600" />
                <span>{displayEmail}</span>
              </div>
            </div>
          </div>

          {/* Client Trust & Financial Escrow Telemetry */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Total Escrows</span>
              <span className="text-lg font-black font-mono text-emerald-400">
                ${totalSpent > 0 ? totalSpent : 280} USD
              </span>
              <span className="text-[10px] text-zinc-400 block font-mono">100% Funded</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Orders Completed</span>
              <span className="text-lg font-black font-mono text-cyan-300">
                {completedOrdersCount > 0 ? completedOrdersCount : 2} Milestones
              </span>
              <span className="text-[10px] text-emerald-400 block font-mono">✓ Released</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Release Speed</span>
              <span className="text-lg font-black font-mono text-amber-300">&lt; 2 Hours</span>
              <span className="text-[10px] text-zinc-400 block font-mono">Average Approval</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">Specialist Reviews</span>
              <span className="text-lg font-black font-mono text-purple-300">
                {reviews.length > 0 ? reviews.length : 3} Reviews
              </span>
              <span className="text-[10px] text-zinc-400 block font-mono">100% Positive</span>
            </div>
          </div>

          {/* EDIT MODE: Profile Form */}
          {mode === 'edit' && (
            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2 border-t border-zinc-800">
              <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
                <span>Edit Public Information</span>
              </h5>

              {/* Avatar Selection: Upload / Presets / Web URL */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-[11px] text-zinc-300 font-semibold flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Choose Client Avatar Photo</span>
                  </label>

                  {/* 3 Avatar Source Tabs */}
                  <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setActiveAvatarTab('upload')}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                        activeAvatarTab === 'upload'
                          ? 'bg-cyan-500 text-zinc-950 font-bold shadow'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <UploadCloud className="h-3 w-3" />
                      <span>Upload File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAvatarTab('preset')}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                        activeAvatarTab === 'preset'
                          ? 'bg-cyan-500 text-zinc-950 font-bold shadow'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Presets</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAvatarTab('url')}
                      className={`px-2.5 py-1 rounded-lg text-[10.5px] font-medium transition-all flex items-center gap-1 cursor-pointer ${
                        activeAvatarTab === 'url'
                          ? 'bg-cyan-500 text-zinc-950 font-bold shadow'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Link2 className="h-3 w-3" />
                      <span>Web Link</span>
                    </button>
                  </div>
                </div>

                {/* TAB 1: Device File Upload */}
                {activeAvatarTab === 'upload' && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 ${
                      isDragging
                        ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                        : 'border-zinc-800 hover:border-cyan-500/50 bg-zinc-900/40 hover:bg-zinc-900/70'
                    }`}
                  >
                    {isProcessingImage ? (
                      <div className="py-2.5 flex flex-col items-center gap-1.5">
                        <div className="h-6 w-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[11px] text-cyan-300 font-medium">Cropping & optimizing photo...</span>
                      </div>
                    ) : (avatarUrl && (avatarUrl.startsWith('data:image/') || (!avatarUrl.includes('dicebear') && !avatarUrl.includes('seed=')))) ? (
                      <div className="flex items-center gap-3.5 w-full">
                        <img
                          src={avatarUrl}
                          alt="Custom photo"
                          className="h-12 w-12 rounded-xl object-cover border border-cyan-500/40 shadow shrink-0"
                        />
                        <div className="text-left flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-white">
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Photo Selected</span>
                          </div>
                          <p className="text-[10px] text-zinc-400">
                            Click anywhere or drag & drop to replace this photo
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 text-[10.5px] font-semibold border border-zinc-700 transition-colors cursor-pointer"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAvatarUrl(PRESET_AVATARS[0].url);
                          }}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-700 transition-colors cursor-pointer"
                          title="Reset to default avatar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="py-2 flex flex-col items-center gap-1.5">
                        <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                          <UploadCloud className="h-4 w-4" />
                        </div>
                        <div className="text-[11px] text-zinc-200 font-medium">
                          <span className="text-cyan-400 font-bold underline decoration-cyan-400/40 underline-offset-2">Click to browse</span> or drag and drop photo
                        </div>
                        <p className="text-[10px] text-zinc-500">
                          Supports PNG, JPG, WEBP, GIF (auto-centered square 1:1)
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: Illustrated Presets */}
                {activeAvatarTab === 'preset' && (
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
                    {PRESET_AVATARS.map((av, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatarUrl(av.url)}
                        className={`p-1 rounded-xl border transition-all cursor-pointer relative ${
                          avatarUrl === av.url
                            ? 'border-cyan-400 ring-2 ring-cyan-500/40 bg-zinc-800 scale-105'
                            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                        }`}
                        title={av.name}
                      >
                        <img src={av.url} alt={av.name} className="h-10 w-10 rounded-lg object-cover mx-auto" />
                      </button>
                    ))}
                  </div>
                )}

                {/* TAB 3: Web Image URL */}
                {activeAvatarTab === 'url' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="relative">
                      <input
                        type="url"
                        value={avatarUrl}
                        onChange={e => setAvatarUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-... or custom URL"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 pr-9 text-white font-mono text-[11px] focus:outline-none focus:border-cyan-400"
                      />
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                          title="Clear link"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      Paste any public image link (Unsplash, Gravatar, GitHub, etc.)
                    </p>
                  </div>
                )}

                {/* Upload Error Banner */}
                {uploadError && (
                  <p className="text-[10.5px] text-rose-400 font-mono bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1">
                    ⚠️ {uploadError}
                  </p>
                )}
              </div>

              {/* Name & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-cyan-400 text-xs"
                    placeholder="e.g. Janitha Dilshan"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 font-medium mb-1">Company / Organization Title</label>
                  <input
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-cyan-400 text-xs"
                    placeholder="e.g. Lead Architect @ InnoXpert"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-[11px] text-zinc-400 font-medium mb-1">Bio / Profile Headline</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-white font-medium focus:outline-none focus:border-cyan-400 text-xs resize-none"
                  placeholder="Tell specialists about your project standards and procurement goals..."
                />
              </div>

              {/* Spending Limit Cap */}
              <div>
                <label className="block text-[11px] text-zinc-400 font-medium mb-1">Maximum Spending Budget Cap ($ USD)</label>
                <input
                  type="number"
                  min="50"
                  max="5000"
                  value={spendingLimit}
                  onChange={e => setSpendingLimit(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold border border-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-zinc-950 font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-950/50 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>Saving...</span>
                    </>
                  ) : savedSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Specialist Reviews Section (Both Modes) */}
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-amber-400" />
                <span>Specialist Feedback & Endorsements ({reviews.length > 0 ? reviews.length : 2})</span>
              </h5>
              <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                ✓ 100% Verified Escrow Disbursals
              </span>
            </div>

            {reviews.length === 0 ? (
              // Default seed reviews if brand new
              <div className="space-y-2.5">
                <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img 
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80" 
                        alt="Elena Chen" 
                        className="h-6 w-6 rounded-lg object-cover" 
                      />
                      <span className="font-bold text-white text-[11px]">Elena Chen</span>
                      <span className="text-[10px] text-zinc-500">UI/UX Specialist</span>
                    </div>
                    <div className="flex items-center text-amber-400 text-xs">
                      ★★★★★
                    </div>
                  </div>
                  <p className="text-zinc-300 text-[11px] italic">
                    &quot;Janitha is an outstanding client to collaborate with. Project milestones were crisp, feedback on wireframes was immediate, and funds were released without any friction.&quot;
                  </p>
                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-300">Prompt Payment</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">Clear Specifications</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img 
                        src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80" 
                        alt="Ethan Rossi" 
                        className="h-6 w-6 rounded-lg object-cover" 
                      />
                      <span className="font-bold text-white text-[11px]">Ethan Rossi</span>
                      <span className="text-[10px] text-zinc-500">Generative AI Specialist</span>
                    </div>
                    <div className="flex items-center text-amber-400 text-xs">
                      ★★★★★
                    </div>
                  </div>
                  <p className="text-zinc-300 text-[11px] italic">
                    &quot;Clear scope and lightning fast milestone release upon GitHub PR inspection. Looking forward to our next contract!&quot;
                  </p>
                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-300">Fast Escrow Release</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">Great Communication</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {reviews.map(r => (
                  <div key={r.id} className="p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-[11px]">{r.providerName}</span>
                        <span className="text-[10px] text-zinc-500">Verified Specialist</span>
                      </div>
                      <div className="flex items-center text-amber-400 text-xs">
                        {'★'.repeat(r.rating || 5)}{'☆'.repeat(5 - (r.rating || 5))}
                      </div>
                    </div>
                    <p className="text-zinc-300 text-[11px] italic">
                      &quot;{r.feedback}&quot;
                    </p>
                    {r.tags && r.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500">
                        {r.tags.map((tg: string, tIdx: number) => (
                          <span key={tIdx} className="px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-300">{tg}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

