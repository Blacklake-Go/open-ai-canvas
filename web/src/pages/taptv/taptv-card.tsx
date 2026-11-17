import React, { useState, useRef } from "react";
import { Play, Star, Heart, ArrowUpRight, Clock, Sparkles } from "lucide-react";
import { TapTvVideoItem } from "./taptv-types";

interface TapTvCardProps {
    video: TapTvVideoItem;
    onSelect: (video: TapTvVideoItem) => void;
    onOpenProcess: (video: TapTvVideoItem, e: React.MouseEvent) => void;
}

export const TapTvCard: React.FC<TapTvCardProps> = ({ video, onSelect, onOpenProcess }) => {
    const isOverlay = video.cardStyle === "overlay";
    const [isHovered, setIsHovered] = useState(false);
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const videoSource = video.videoUrl || "/welcome/charge/sequence.mp4";

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        setIsVideoLoaded(false);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    if (isOverlay) {
        return (
            <div
                onClick={() => onSelect(video)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="group relative flex flex-col justify-end overflow-hidden rounded-xl bg-[#141414] border border-white/[0.08] cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:border-white/20 select-none aspect-[16/9]"
                data-testid={`taptv-card-${video.id}`}
                style={{
                    boxShadow: "0 12px 24px rgba(0, 0, 0, 0.4)",
                }}
            >
                {/* High-res Cover Image as foundation */}
                <img src={video.cover} alt={video.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />

                {/* Hover Video Preview (Muted, Loop, Smooth Cross-Fade) */}
                {isHovered && (
                    <video
                        ref={videoRef}
                        src={videoSource}
                        muted
                        loop
                        playsInline
                        autoPlay
                        onLoadedData={() => setIsVideoLoaded(true)}
                        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 pointer-events-none ${isVideoLoaded ? "opacity-100" : "opacity-0"}`}
                    />
                )}

                {/* Top Left: Duration Badge (visible on hover or always subtle) */}
                <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm border border-white/10 opacity-90 group-hover:opacity-100 transition-opacity duration-300">
                    <Clock className="size-3 text-white/70" strokeWidth={2.2} />
                    <span>{video.duration}</span>
                </div>

                {/* Top Right: Badge (if present) */}
                {video.badge && (
                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-medium text-zinc-300 backdrop-blur-sm border border-white/[0.14] opacity-90 group-hover:opacity-100 transition-opacity duration-300">
                        <Sparkles className="size-3 text-zinc-300" strokeWidth={2.2} />
                        <span>{video.badge}</span>
                    </div>
                )}

                {/* Center Hover Play Icon (fades out when live video plays) */}
                <div className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-200 pointer-events-none ${isVideoLoaded ? "opacity-0" : "opacity-0 group-hover:opacity-100"}`}>
                    <div className="flex size-11 items-center justify-center rounded-full bg-black/70 text-white border border-white/20 backdrop-blur-sm shadow-xl">
                        <Play className="size-5 fill-white text-white ml-0.5" strokeWidth={2.2} />
                    </div>
                </div>

                {/* Bottom Overlay Content (Solid translucent bar, strictly NO gradients) */}
                <div className="relative z-10 w-full bg-black/75 backdrop-blur-sm px-3.5 py-2.5 border-t border-white/[0.08] flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-zinc-300 truncate">{video.creatorHandle}</p>
                        <h3 className="text-xs sm:text-sm font-semibold text-zinc-50 truncate tracking-tight group-hover:text-white transition-colors">{video.title}</h3>
                    </div>

                    {/* Right side: Star count or "查看创作过程 ↗" hover action */}
                    <div className="shrink-0 flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={(e) => onOpenProcess(video, e)}
                            className="hidden group-hover:inline-flex items-center gap-1 rounded-full bg-white text-black px-2.5 py-1 text-[11px] font-semibold transition-all hover:bg-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.4)] active:scale-95 cursor-pointer"
                        >
                            <span className="text-black">创作过程</span>
                            <ArrowUpRight className="size-3 text-black" strokeWidth={2.2} />
                        </button>
                        <div className="group-hover:hidden flex items-center gap-1 text-[11px] font-medium text-white/70">
                            <Star className="size-3.5 fill-white/20 text-zinc-300" strokeWidth={2.2} />
                            <span>{video.stars}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Standard Catalog Style
    return (
        <div
            onClick={() => onSelect(video)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="group flex flex-col overflow-hidden rounded-xl bg-[#141414] border border-white/[0.08] cursor-pointer transition-all duration-300 hover:border-white/20 select-none"
            data-testid={`taptv-card-${video.id}`}
            style={{
                boxShadow: "0 12px 24px rgba(0, 0, 0, 0.4)",
            }}
        >
            {/* 16:9 Cover Box */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/40">
                <img src={video.cover} alt={video.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />

                {/* Hover Video Preview (Muted, Loop, Smooth Cross-Fade) */}
                {isHovered && (
                    <video
                        ref={videoRef}
                        src={videoSource}
                        muted
                        loop
                        playsInline
                        autoPlay
                        onLoadedData={() => setIsVideoLoaded(true)}
                        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 pointer-events-none ${isVideoLoaded ? "opacity-100" : "opacity-0"}`}
                    />
                )}

                {/* Duration Badge Bottom Right */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm border border-white/10 opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                    <Clock className="size-3 text-white/70" strokeWidth={2.2} />
                    <span>{video.duration}</span>
                </div>

                {/* Tool Tag Top Left */}
                <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm border border-white/10 opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                    <span>{video.toolTag}</span>
                </div>

                {/* Top Right: Process Hover CTA with Protective Dark Scrim */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                    <button
                        type="button"
                        onClick={(e) => onOpenProcess(video, e)}
                        className="inline-flex items-center gap-1 rounded-md bg-white text-black px-2 py-0.5 text-[10px] font-semibold transition-all hover:bg-white/90 shadow-[0_2px_10px_rgba(0,0,0,0.6)] active:scale-95 cursor-pointer ring-1 ring-black/20"
                    >
                        <span className="text-black">创作过程</span>
                        <ArrowUpRight className="size-2.5 text-black" strokeWidth={2.2} />
                    </button>
                </div>

                {/* Center Hover Play Icon (fades out when live video plays) */}
                <div className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-200 pointer-events-none ${isVideoLoaded ? "opacity-0" : "opacity-0 group-hover:opacity-100"}`}>
                    <div className="flex size-11 items-center justify-center rounded-full bg-black/70 text-white border border-white/20 backdrop-blur-sm shadow-xl">
                        <Play className="size-5 fill-white text-white ml-0.5" strokeWidth={2.2} />
                    </div>
                </div>
            </div>

            {/* Bottom Info Bar */}
            <div className="flex items-start gap-3 p-3.5 bg-[#131316]">
                {/* Circular Creator Avatar (Photographic asset, strictly no plain emojis) */}
                <img src={video.creatorAvatar} alt={video.creator} className="size-8 rounded-full object-cover ring-1 ring-white/15 shrink-0" loading="lazy" />

                <div className="min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-semibold text-zinc-50 truncate tracking-tight group-hover:text-white transition-colors">{video.title}</h3>
                    <p className="text-[11px] font-medium text-zinc-400 truncate mt-0.5">{video.creatorHandle}</p>
                </div>

                {/* Quick Process CTA or Stats */}
                <div className="shrink-0 flex items-center gap-2.5 pt-0.5 tabular-nums">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                        <Heart className="size-3 text-zinc-400" strokeWidth={2.2} />
                        <span>{video.likes}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-300">
                        <Star className="size-3 text-zinc-300" strokeWidth={2.2} />
                        <span>{video.stars}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
