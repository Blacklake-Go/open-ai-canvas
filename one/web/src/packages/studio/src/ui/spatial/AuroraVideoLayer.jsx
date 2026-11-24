'use client';

import React, { useState } from 'react';

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
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      {/* Fallback CSS Glow Layer (Active before video loads or if video fails) */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-smooth ease-in-out"
        style={{
          opacity: videoLoaded ? 0.2 : 0.6,
          background:
            'radial-gradient(ellipse 80% 50% at 50% 65%, rgba(96, 86, 240, 0.45) 0%, rgba(64, 217, 198, 0.25) 45%, transparent 75%)',
        }}
      />

      {/* Main 3D Volumetric Fluid Video */}
      {!videoFailed && (
        <video
          width="2304"
          height="1440"
          preload="metadata"
          autoPlay
          loop
          muted
          playsInline
          poster={posterSrc}
          onCanPlay={() => setVideoLoaded(true)}
          onError={() => setVideoFailed(true)}
          className="pointer-events-none h-full w-full object-cover"
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
