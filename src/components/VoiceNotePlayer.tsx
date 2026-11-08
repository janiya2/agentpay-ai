'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface VoiceNotePlayerProps {
  audioUrl: string;
  duration?: number;
  transcript?: string;
  role?: 'user' | 'assistant' | 'client' | 'provider';
  compact?: boolean;
}

export default function VoiceNotePlayer({
  audioUrl,
  duration: initialDuration = 0,
  transcript,
  role = 'user',
  compact = false
}: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(initialDuration);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pseudo-random but deterministic waveform bar heights for realistic look
  const waveformBars = useRef<number[]>([
    25, 45, 75, 30, 85, 95, 60, 40, 70, 90, 100, 80,
    55, 65, 85, 45, 90, 70, 60, 80, 50, 40, 30, 20
  ]).current;

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn('Playback blocked or failed:', e);
        setIsPlaying(false);
      });
    }
  };

  const handleSeek = (index: number) => {
    if (!audioRef.current || totalDuration <= 0) return;
    const seekPct = index / waveformBars.length;
    const targetTime = seekPct * totalDuration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSpeed: 1 | 1.5 | 2 = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const isClientRole = role === 'user' || role === 'client';

  return (
    <div className={`rounded-2xl transition-all ${
      compact 
        ? 'p-2 bg-zinc-900/90 border border-zinc-800' 
        : isClientRole
        ? 'p-3 bg-gradient-to-r from-cyan-950/70 via-zinc-900/90 to-blue-950/60 border border-cyan-500/30 shadow-lg shadow-cyan-950/20'
        : 'p-3 bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 shadow-md'
    }`}>
      {/* Player Bar */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
            isPlaying
              ? 'bg-cyan-400 text-zinc-950 shadow-md shadow-cyan-400/50 scale-105'
              : 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-zinc-950 hover:opacity-90 shadow-sm'
          }`}
          title={isPlaying ? 'Pause voice message' : 'Play voice message'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-zinc-950 stroke-zinc-950" />
          ) : (
            <Play className="h-4 w-4 fill-zinc-950 stroke-zinc-950 ml-0.5" />
          )}
        </button>

        {/* Dynamic Waveform Scrubber */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div 
            className="flex items-center gap-1 sm:gap-1.5 h-7 cursor-pointer select-none group"
            title="Click to seek"
          >
            {waveformBars.map((height, idx) => {
              const barPercent = (idx / waveformBars.length) * 100;
              const hasPlayed = barPercent <= progressPercent;

              return (
                <div
                  key={idx}
                  onClick={() => handleSeek(idx)}
                  className={`flex-1 rounded-full transition-all group-hover:scale-y-110 ${
                    hasPlayed
                      ? isPlaying
                        ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]'
                        : 'bg-cyan-400/90'
                      : 'bg-zinc-700/60 hover:bg-zinc-600'
                  }`}
                  style={{
                    height: `${height}%`,
                    minHeight: '6px'
                  }}
                />
              );
            })}
          </div>

          {/* Time & Controls */}
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-1">
            <span>
              {formatSecs(currentTime)} / {formatSecs(totalDuration || initialDuration || 0)}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wider text-cyan-400/80 font-bold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Voice Note
              </span>
            </div>
          </div>
        </div>

        {/* Speed Multiplier Pill */}
        <button
          type="button"
          onClick={cycleSpeed}
          className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 font-mono text-[10px] font-bold border border-zinc-700/60 transition-colors shrink-0 cursor-pointer"
          title="Toggle playback speed (1x, 1.5x, 2x)"
        >
          {playbackSpeed}x
        </button>
      </div>

      {/* Embedded Subtitle / Transcript Expander */}
      {transcript && (
        <div className="mt-2.5 pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={() => setShowTranscript(prev => !prev)}
            className="w-full flex items-center justify-between text-[11px] font-medium text-zinc-300 hover:text-cyan-300 transition-colors cursor-pointer text-left"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-cyan-400" />
              <span>Speech-to-Text Subtitle</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-0.5">
              {showTranscript ? 'Hide' : 'Read'}
              {showTranscript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </span>
          </button>

          {showTranscript && (
            <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-zinc-800/80 text-xs text-zinc-200 leading-relaxed font-sans italic animate-fadeIn">
              &ldquo;{transcript}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
