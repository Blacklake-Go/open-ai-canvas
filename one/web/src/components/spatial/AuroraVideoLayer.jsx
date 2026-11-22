'use client';

import React, { useRef, useState, useEffect } from 'react';

/**
 * AuroraVideoLayer
 * High-definition 3D volumetric fluid aurora ribbon video layer.
 * Reverse-engineered from Google Stitch.
 * Uses hardware video decoder for 60fps silky smooth motion with near-zero GPU fill-rate/CPU usage.
 */
export default function AuroraVideoLayer({
  className = '',
  opacity = 0.9,
  videoSrc = '/branding/videos/spatial-aurora.mp4',
  posterSrc = '/branding/videos/spatial-aurora-poster.jpg',
}) {
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Ensure autoplay starts reliably
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setVideoLoaded(true);
          try {
            video.playbackRate = 1.75;
          } catch {}
        })
        .catch(() => {
          // If browser restricts autoplay, fallback gracefully
          setVideoFailed(false);
        });
    }
  }, [videoSrc]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      {/* Fallback CSS Glow Layer (Subtle ambient aura to avoid brightness flare on load) */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-in-out"
        style={{
          opacity: videoFailed ? 0.5 : (videoLoaded ? 0.2 : 0.25),
          background:
            'radial-gradient(ellipse 80% 50% at 50% 65%, rgba(96, 86, 240, 0.45) 0%, rgba(64, 217, 198, 0.25) 45%, transparent 75%)',
        }}
      />

      {/* Main 3D Volumetric Fluid Video */}
      {!videoFailed && (
        <video
          ref={videoRef}
          aria-label=""
          width="1920"
          height="1080"
          preload="metadata"
          autoPlay
          loop
          muted
          playsInline
          poster={posterSrc}
          onCanPlay={(e) => {
            setVideoLoaded(true);
            try {
              e.currentTarget.playbackRate = 1.75;
            } catch {}
          }}
          onPlay={(e) => {
            try {
              e.currentTarget.playbackRate = 1.75;
            } catch {}
          }}
          onError={() => setVideoFailed(true)}
          className="h-full w-full object-cover"
          style={{
            filter: 'contrast(1.05) brightness(1.02)',
          }}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
