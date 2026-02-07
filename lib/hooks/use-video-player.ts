"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const STORAGE_KEY = "videoVolume";

export function useVideoPlayer() {
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.1);
  const [stopped, setStopped] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);

  const applyToVideos = useCallback(
    (fn: (video: HTMLVideoElement) => void) => {
      [videoRef, mobileVideoRef].forEach((ref) => {
        if (ref.current) fn(ref.current);
      });
    },
    []
  );

  // Load saved volume on mount and apply on first click/tap
  useEffect(() => {
    const savedVolume = localStorage.getItem(STORAGE_KEY);
    const targetVolume = savedVolume !== null ? parseFloat(savedVolume) : 0.1;
    const isMuted = targetVolume === 0;

    // Batch state updates using a microtask to avoid cascading renders warning
    queueMicrotask(() => {
      setVolume(targetVolume || 0.1);
      setMuted(isMuted);
    });

    // If saved as muted, don't set up unmute listener
    if (isMuted) return;

    function unmute() {
      [videoRef, mobileVideoRef].forEach((ref) => {
        if (ref.current) {
          ref.current.muted = false;
          ref.current.volume = targetVolume;
        }
      });
    }
    document.addEventListener("click", unmute, { once: true });
    document.addEventListener("touchend", unmute, { once: true });
    return () => {
      document.removeEventListener("click", unmute);
      document.removeEventListener("touchend", unmute);
    };
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !muted;
    applyToVideos((v) => {
      v.muted = newMuted;
    });
    setMuted(newMuted);
    localStorage.setItem(STORAGE_KEY, newMuted ? "0" : String(volume));
  }, [muted, volume, applyToVideos]);

  const handleVolumeChange = useCallback(
    (newVolume: number) => {
      const newMuted = newVolume === 0;
      applyToVideos((v) => {
        v.volume = newVolume;
        v.muted = newMuted;
      });
      setVolume(newVolume);
      setMuted(newMuted);
      localStorage.setItem(STORAGE_KEY, String(newVolume));
    },
    [applyToVideos]
  );

  const toggleVideo = useCallback(() => {
    const newStopped = !stopped;
    applyToVideos((v) => {
      if (newStopped) {
        v.pause();
      } else {
        v.play();
      }
    });
    setStopped(newStopped);
  }, [stopped, applyToVideos]);

  return {
    muted,
    volume,
    stopped,
    videoRef,
    mobileVideoRef,
    toggleMute,
    toggleVideo,
    handleVolumeChange,
  };
}
