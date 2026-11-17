import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, X, Play, Pause, Volume2, VolumeX, Maximize2, Star, Heart, Share2, Copy, Check, ArrowUpRight, ExternalLink, Sliders, Sparkles } from "lucide-react";
import { TapTvVideoItem } from "./taptv-types";
import { TAPTV_VIDEOS } from "./taptv-data";
import { useNavigate } from "react-router";
import { message } from "antd";

interface TapTvPlayerModalProps {
    video: TapTvVideoItem | null;
    onClose: () => void;
    onOpenProcess: (video: TapTvVideoItem) => void;
    onSelectRelated: (video: TapTvVideoItem) => void;
}

// Parse "MM:SS" or "HH:MM:SS" string to total seconds
function parseDurationString(str: string): number {
    const parts = str.split(":").map(Number);
    if (parts.length === 2) {
        return (parts[0] || 0) * 60 + (parts[1] || 0);
    }
    if (parts.length === 3) {
        return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    }
    return 60;
}

// Format seconds into MM:SS
function formatTime(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export const TapTvPlayerModal: React.FC<TapTvPlayerModalProps> = ({ video, onClose, onOpenProcess, onSelectRelated }) => {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const cinemaRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(60);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [quality, setQuality] = useState("1080p");
    const [copiedPrompt, setCopiedPrompt] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [hasLiked, setHasLiked] = useState(false);
    const [hasStarred, setHasStarred] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [starCount, setStarCount] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [hoverPos, setHoverPos] = useState<number | null>(null);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);

    // Initial setup on video change
    useEffect(() => {
        if (video) {
            setLikeCount(video.likes);
            setStarCount(video.stars);
            setHasLiked(false);
            setHasStarred(false);
            setCurrentTime(0);
            const initialDur = parseDurationString(video.duration);
            setDuration(initialDur);
            document.title = `${video.title} | TapTV | TapNow｜你的智能体创意画布`;

            // Auto-play the video
            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current
                    .play()
                    .then(() => {
                        setIsPlaying(true);
                    })
                    .catch(() => {
                        setIsPlaying(false);
                    });
            }
        }
        return () => {
            document.title = "TapTV | TapNow｜你的智能体创意画布";
        };
    }, [video]);

    if (!video) return null;

    const videoSource = video.videoUrl || "/welcome/charge/sequence.mp4";

    const handleTogglePlay = () => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current
                .play()
                .then(() => setIsPlaying(true))
                .catch(() => {});
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    const handleCopyPrompt = () => {
        navigator.clipboard.writeText(video.prompt);
        setCopiedPrompt(true);
        message.success("已复制正向提示词！");
        setTimeout(() => setCopiedPrompt(false), 2000);
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        message.success("已复制作品分享链接至剪贴板！");
    };

    const handleToggleFollow = () => {
        const next = !isFollowing;
        setIsFollowing(next);
        if (next) {
            message.success(`已关注作者 ${video.creator}！`);
        } else {
            message.info(`已取消关注 ${video.creator}`);
        }
    };

    const handleToggleLike = () => {
        if (hasLiked) {
            setLikeCount((c) => c - 1);
            setHasLiked(false);
        } else {
            setLikeCount((c) => c + 1);
            setHasLiked(true);
            message.success("已点赞此作品");
        }
    };

    const handleToggleStar = () => {
        if (hasStarred) {
            setStarCount((c) => c - 1);
            setHasStarred(false);
        } else {
            setStarCount((c) => c + 1);
            setHasStarred(true);
            message.success("已加入我的收藏");
        }
    };

    const handleSeek = (clientX: number) => {
        if (!progressRef.current || !videoRef.current) return;
        const rect = progressRef.current.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const effectiveDuration = duration > 0 ? duration : parseDurationString(video.duration);
        const newTime = pos * effectiveDuration;
        setCurrentTime(newTime);
        videoRef.current.currentTime = newTime;
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsDragging(true);
        handleSeek(e.clientX);
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!progressRef.current) return;
        const rect = progressRef.current.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const effectiveDuration = duration > 0 ? duration : parseDurationString(video.duration);
        setHoverPos(pos);
        setHoverTime(pos * effectiveDuration);
        if (isDragging) {
            handleSeek(e.clientX);
        }
    };

    const handlePointerLeave = () => {
        if (!isDragging) {
            setHoverPos(null);
            setHoverTime(null);
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isDragging) {
            setIsDragging(false);
            setHoverPos(null);
            setHoverTime(null);
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {}
        }
    };

    const handleToggleMute = () => {
        if (!videoRef.current) return;
        const nextMuted = !isMuted;
        videoRef.current.muted = nextMuted;
        setIsMuted(nextMuted);
    };

    const handleVolumeChange = (newVol: number) => {
        setVolume(newVol);
        if (videoRef.current) {
            videoRef.current.volume = newVol;
            videoRef.current.muted = newVol === 0;
            setIsMuted(newVol === 0);
        }
    };

    const handleToggleFullscreen = () => {
        if (!document.fullscreenElement) {
            cinemaRef.current?.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    const handleOpenInCanvas = () => {
        navigate(`/canvas?prompt=${encodeURIComponent(video.prompt)}&title=${encodeURIComponent(video.title)}`);
    };

    const relatedVideos = TAPTV_VIDEOS.filter((v) => v.id !== video.id).slice(0, 4);
    const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md flex flex-col items-center select-none" data-testid="taptv-player-modal">
            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-40 flex h-14 w-full max-w-[1500px] items-center justify-between px-4 sm:px-6 xl:px-9 bg-black/80 backdrop-blur-md border-b border-white/[0.08]">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex items-center gap-2 text-sm font-medium text-zinc-200 hover:text-white px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] hover:border-white/20 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                    <ChevronLeft className="size-5" strokeWidth={2.2} />
                    <span>返回广场</span>
                </button>

                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-block text-xs text-white/40">创作协作</span>
                    <div className="flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-xs text-zinc-300 font-medium">
                        <Sparkles className="size-3" strokeWidth={2.2} />
                        <span>TapNow × {video.toolTag}</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex size-8 items-center justify-center rounded-full bg-white/10 border border-white/15 text-zinc-200 hover:bg-white/20 hover:text-white shadow-sm active:scale-95 transition-all cursor-pointer ml-2"
                    >
                        <X className="size-4" strokeWidth={2.2} />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="w-full max-w-[1500px] px-4 sm:px-6 xl:px-9 py-6 flex flex-col gap-8">
                {/* Cinema Video Viewport (16:9) */}
                <div
                    ref={cinemaRef}
                    className="relative w-full aspect-[16/9] max-h-[72vh] rounded-2xl overflow-hidden bg-[#0a0a0a] border border-white/[0.08] flex items-center justify-center group/viewport"
                    style={{
                        boxShadow: "0 24px 64px rgba(0, 0, 0, 0.8)",
                    }}
                >
                    {/* Genuine HTML5 Video Canvas */}
                    <video
                        ref={videoRef}
                        src={videoSource}
                        poster={video.cover}
                        className="h-full w-full object-contain bg-black cursor-pointer"
                        playsInline
                        autoPlay
                        loop
                        onClick={handleTogglePlay}
                        onTimeUpdate={() => {
                            if (!isDragging && videoRef.current) {
                                setCurrentTime(videoRef.current.currentTime);
                            }
                        }}
                        onLoadedMetadata={() => {
                            if (videoRef.current && videoRef.current.duration && !isNaN(videoRef.current.duration)) {
                                setDuration(videoRef.current.duration);
                            }
                        }}
                        onDurationChange={() => {
                            if (videoRef.current && videoRef.current.duration && !isNaN(videoRef.current.duration)) {
                                setDuration(videoRef.current.duration);
                            }
                        }}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                        onVolumeChange={() => {
                            if (videoRef.current) {
                                setIsMuted(videoRef.current.muted);
                                setVolume(videoRef.current.volume);
                            }
                        }}
                    />

                    {/* Ambient Center Play State (When Paused) */}
                    {!isPlaying && (
                        <div onClick={handleTogglePlay} className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer backdrop-blur-xs">
                            <div className="flex size-16 items-center justify-center rounded-full bg-white text-black shadow-2xl transition-transform hover:scale-110">
                                <Play className="size-8 fill-black text-black ml-1" strokeWidth={2.2} />
                            </div>
                        </div>
                    )}

                    {/* Top Right Duration Pill */}
                    <div className="absolute top-4 right-4 z-20 rounded-md bg-black/80 px-2.5 py-1 text-xs font-mono text-white/90 border border-white/10">{video.duration}</div>

                    {/* Bottom Floating Control Bar */}
                    <div className="absolute bottom-0 inset-x-0 z-20 bg-black/80 backdrop-blur-md px-4 py-3 flex flex-col gap-2 border-t border-white/10">
                        {/* Interactive Scrubber Bar with Drag & Hover Seek */}
                        <div
                            ref={progressRef}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onPointerLeave={handlePointerLeave}
                            className="relative h-2 w-full bg-white/20 rounded-full cursor-pointer touch-none group/seek select-none"
                        >
                            {/* Hover Tooltip Timestamp */}
                            {hoverPos !== null && hoverTime !== null && (
                                <div className="absolute -top-7 -translate-x-1/2 rounded bg-black/90 px-1.5 py-0.5 text-[10px] font-mono text-white border border-white/20 pointer-events-none shadow-lg" style={{ left: `${hoverPos * 100}%` }}>
                                    {formatTime(hoverTime)}
                                </div>
                            )}

                            {/* Active Progress Fill */}
                            <div className="h-full bg-white rounded-full relative pointer-events-none transition-none" style={{ width: `${progressPercent}%` }}>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 size-3 bg-white rounded-full shadow-md transition-transform group-hover/seek:scale-125" />
                            </div>
                        </div>

                        {/* Controls Row */}
                        <div className="flex items-center justify-between text-xs text-white">
                            <div className="flex items-center gap-4">
                                <button type="button" onClick={handleTogglePlay} className="hover:text-white transition-colors cursor-pointer active:scale-90">
                                    {isPlaying ? <Pause className="size-4" strokeWidth={2.2} /> : <Play className="size-4 fill-white" strokeWidth={2.2} />}
                                </button>
                                <span className="font-mono text-[11px] text-white/70">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Quality Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setQuality((q) => (q === "1080p" ? "4K" : "1080p"))}
                                    className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-mono shadow-sm active:scale-95 transition-all cursor-pointer"
                                >
                                    {quality}
                                </button>

                                {/* Volume Slider & Mute Toggle */}
                                <div className="relative flex items-center gap-1.5" onMouseEnter={() => setShowVolumeSlider(true)} onMouseLeave={() => setShowVolumeSlider(false)}>
                                    <button type="button" onClick={handleToggleMute} className="hover:text-white transition-colors cursor-pointer active:scale-90">
                                        {isMuted || volume === 0 ? <VolumeX className="size-4 text-zinc-300" strokeWidth={2.2} /> : <Volume2 className="size-4" strokeWidth={2.2} />}
                                    </button>
                                    {showVolumeSlider && (
                                        <div className="flex items-center pl-1 pr-2 py-1 bg-black/90 rounded-lg border border-white/10 backdrop-blur-md shadow-lg">
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={isMuted ? 0 : volume}
                                                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                                className="w-16 h-1 accent-white bg-white/20 rounded-lg cursor-pointer"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Fullscreen */}
                                <button type="button" onClick={handleToggleFullscreen} className="hover:text-white transition-colors cursor-pointer active:scale-90" title="全屏切换">
                                    <Maximize2 className="size-4" strokeWidth={2.2} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Video Info & Interaction Row */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/[0.08] pb-6">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-200 font-medium">{video.category}</span>
                            <span className="text-xs text-zinc-500">·</span>
                            <span className="text-xs text-zinc-300 tabular-nums">{video.views.toLocaleString()} 次观看</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-50">{video.title}</h1>
                    </div>

                    {/* Creator Box + Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Creator Card */}
                        <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] px-3 py-1.5 shadow-sm">
                            <img src={video.creatorAvatar} alt={video.creator} className="size-8 rounded-full object-cover ring-1 ring-white/20" />
                            <div>
                                <p className="text-xs font-semibold text-zinc-50 leading-tight">{video.creator}</p>
                                <p className="text-[11px] text-zinc-400">{video.creatorHandle}</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleToggleFollow}
                                className={`ml-2 text-xs px-3 py-1 rounded-full font-semibold transition-all cursor-pointer active:scale-95 ${isFollowing ? "bg-white/20 text-white hover:bg-white/30 border border-white/20 shadow-sm" : "bg-white text-black hover:bg-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.3)]"}`}
                            >
                                <span className={isFollowing ? "text-white" : "text-black"}>{isFollowing ? "已关注" : "+ 关注"}</span>
                            </button>
                        </div>

                        {/* Likes */}
                        <button
                            type="button"
                            onClick={handleToggleLike}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer active:scale-95 ${
                                hasLiked
                                    ? "bg-white/[0.10] text-zinc-300 border-white/[0.14] shadow-[0_0_14px_rgba(255, 255, 255, 0.12)]"
                                    : "bg-white/[0.06] text-zinc-200 border-white/[0.08] hover:bg-white/[0.12] hover:text-white hover:border-white/20 shadow-sm"
                            }`}
                        >
                            <Heart className={`size-3.5 ${hasLiked ? "fill-white/80 text-zinc-300" : ""}`} strokeWidth={2.2} />
                            <span>{likeCount}</span>
                        </button>

                        {/* Stars */}
                        <button
                            type="button"
                            onClick={handleToggleStar}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer active:scale-95 ${
                                hasStarred
                                    ? "bg-white/[0.10] text-zinc-300 border-white/[0.14] shadow-[0_0_14px_rgba(255, 255, 255, 0.12)]"
                                    : "bg-white/[0.06] text-zinc-200 border-white/[0.08] hover:bg-white/[0.12] hover:text-white hover:border-white/20 shadow-sm"
                            }`}
                        >
                            <Star className={`size-3.5 ${hasStarred ? "fill-white/80 text-zinc-300" : ""}`} strokeWidth={2.2} />
                            <span>{starCount}</span>
                        </button>

                        {/* Share */}
                        <button
                            type="button"
                            onClick={handleShare}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.06] text-zinc-200 border border-white/[0.08] hover:bg-white/[0.12] hover:border-white/20 hover:text-white shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                            <Share2 className="size-3.5" strokeWidth={2.2} />
                            <span>分享</span>
                        </button>

                        {/* Open Creation Process CTA */}
                        <button
                            type="button"
                            onClick={() => onOpenProcess(video)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-white/90 shadow-[0_4px_16px_rgba(0,0,0,0.45),0_1px_3px_rgba(0,0,0,0.2)] active:scale-95 transition-all cursor-pointer"
                        >
                            <span className="text-black">查看创作过程</span>
                            <ArrowUpRight className="size-3.5 text-black" strokeWidth={2.2} />
                        </button>
                    </div>
                </div>

                {/* Two-Column Details & Prompts Inspector */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Synopsis & Director's Statement */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                        <div className="rounded-2xl bg-[#131316] border border-white/[0.08] p-5">
                            <h3 className="text-sm font-semibold text-zinc-50 mb-2 flex items-center gap-2">
                                <span>作品故事理念</span>
                            </h3>
                            <p className="text-xs text-zinc-300 leading-relaxed">{video.synopsis}</p>
                        </div>

                        {/* Pipeline Parameters Card */}
                        <div className="rounded-2xl bg-[#131316] border border-white/[0.08] p-5 flex flex-col gap-3">
                            <h3 className="text-sm font-semibold text-zinc-50 flex items-center gap-2">
                                <Sliders className="size-4 text-zinc-300" strokeWidth={2.2} />
                                <span>生成参数配置</span>
                            </h3>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 rounded-lg bg-black/50 border border-white/[0.06]">
                                    <span className="text-zinc-400 block text-[10px]">基础模型</span>
                                    <span className="text-zinc-100 font-medium truncate block mt-0.5">{video.parameters.model}</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-black/50 border border-white/[0.06]">
                                    <span className="text-zinc-400 block text-[10px]">采样步数 (Steps)</span>
                                    <span className="text-zinc-100 font-medium tabular-nums mt-0.5 block">{video.parameters.steps}</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-black/50 border border-white/[0.06]">
                                    <span className="text-zinc-400 block text-[10px]">采样器 (Sampler)</span>
                                    <span className="text-zinc-100 font-medium truncate block mt-0.5">{video.parameters.sampler}</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-black/50 border border-white/[0.06]">
                                    <span className="text-zinc-400 block text-[10px]">随机种子 (Seed)</span>
                                    <span className="text-zinc-100 font-mono text-[11px] tabular-nums mt-0.5 block">{video.parameters.seed}</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-black/50 border border-white/[0.06]">
                                    <span className="text-zinc-400 block text-[10px]">提示词权重 (CFG)</span>
                                    <span className="text-zinc-100 font-medium tabular-nums mt-0.5 block">{video.parameters.cfgScale}</span>
                                </div>
                                <div className="p-2.5 rounded-lg bg-black/50 border border-white/[0.06]">
                                    <span className="text-zinc-400 block text-[10px]">画幅比例</span>
                                    <span className="text-zinc-100 font-medium tabular-nums mt-0.5 block">{video.parameters.aspectRatio}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Positive & Negative Prompts + Canvas Launch */}
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        <div className="rounded-2xl bg-[#141414] border border-white/[0.08] p-5 flex flex-col gap-4">
                            {/* Positive Prompt */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
                                        <span className="size-2 rounded-full bg-white" />
                                        <span>正向提示词 (Prompt)</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleCopyPrompt}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white/[0.08] border border-white/[0.14] text-zinc-300 hover:bg-white/[0.14] hover:border-white/25 shadow-xs active:scale-95 transition-all cursor-pointer"
                                    >
                                        {copiedPrompt ? (
                                            <>
                                                <Check className="size-3 text-zinc-300" strokeWidth={2.2} />
                                                <span className="text-zinc-300">已复制到剪贴板</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="size-3" strokeWidth={2.2} />
                                                <span>一键复制提示词</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="p-3.5 rounded-xl bg-black/50 border border-white/[0.06] text-xs font-mono text-white/80 leading-relaxed select-text">{video.prompt}</div>
                            </div>

                            {/* Negative Prompt */}
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-white" />
                                    <span>负向提示词 (Negative Prompt)</span>
                                </span>
                                <div className="p-3.5 rounded-xl bg-black/50 border border-white/[0.06] text-xs font-mono text-white/60 leading-relaxed select-text">{video.negativePrompt}</div>
                            </div>

                            {/* Canvas Direct Launch CTA */}
                            <div className="pt-2 flex items-center justify-between">
                                <span className="text-xs text-white/50">支持一键将提示词与完整工作流载入智能体画布继续创作</span>
                                <button
                                    type="button"
                                    onClick={handleOpenInCanvas}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-white/90 shadow-[0_4px_16px_rgba(0, 0, 0, 0.40)] active:scale-95 transition-all cursor-pointer"
                                >
                                    <span>在画布中打开工程</span>
                                    <ExternalLink className="size-3.5" strokeWidth={2.2} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* You may also like: 4 Related Video Cards */}
                <div className="flex flex-col gap-4 border-t border-white/[0.08] pt-8">
                    <h2 className="text-lg font-bold text-white tracking-tight">你可能感兴趣的创作</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {relatedVideos.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => onSelectRelated(item)}
                                className="group relative aspect-[16/9] rounded-xl overflow-hidden bg-[#141414] border border-white/[0.08] cursor-pointer hover:border-white/20 transition-all select-none"
                            >
                                <img src={item.cover} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                                <div className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">{item.duration}</div>
                                <div className="absolute bottom-0 inset-x-0 bg-black/80 px-3 py-2 border-t border-white/10">
                                    <h4 className="text-xs font-semibold text-white truncate group-hover:text-white transition-colors">{item.title}</h4>
                                    <p className="text-[10px] text-white/50 truncate mt-0.5">{item.creatorHandle}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
