import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CarouselSlide } from "./app-store-types";

interface AppStoreCarouselProps {
    slides: CarouselSlide[];
    onSelectSlide?: (slide: CarouselSlide) => void;
}

export const AppStoreCarousel: React.FC<AppStoreCarouselProps> = ({ slides, onSelectSlide }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const total = slides.length;
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const dragStartX = useRef<number | null>(null);
    const dragStartY = useRef<number | null>(null);
    const dragDeltaX = useRef<number>(0);
    const isDragging = useRef<boolean>(false);

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev === 0 ? total - 1 : prev - 1));
    };

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev === total - 1 ? 0 : prev + 1));
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        dragStartX.current = e.clientX;
        dragStartY.current = e.clientY;
        dragDeltaX.current = 0;
        isDragging.current = true;
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current || dragStartX.current === null || dragStartY.current === null) return;
        const dx = e.clientX - dragStartX.current;
        const dy = e.clientY - dragStartY.current;
        // If vertical swipe/scroll is detected, release immediately so native vertical page scrolling works smoothly
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
            isDragging.current = false;
            dragDeltaX.current = 0;
            return;
        }
        dragDeltaX.current = dx;
    };

    const handlePointerUp = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        const delta = dragDeltaX.current;
        dragStartX.current = null;
        dragStartY.current = null;
        if (delta > 50) {
            prevSlide();
        } else if (delta < -50) {
            nextSlide();
        }
        setTimeout(() => {
            dragDeltaX.current = 0;
        }, 50);
    };

    // Auto-advance every 5 seconds unless hovered
    useEffect(() => {
        if (isHovered) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(() => {
            nextSlide();
        }, 5000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [currentIndex, isHovered, total]);

    const getSlideAt = (offset: number) => {
        const index = (currentIndex + offset + total) % total;
        return { slide: slides[index], index };
    };

    const leftSlide = getSlideAt(-1);
    const centerSlide = getSlideAt(0);
    const rightSlide = getSlideAt(1);

    const handleCenterCardClick = () => {
        if (Math.abs(dragDeltaX.current) > 10) return;
        onSelectSlide?.(centerSlide.slide);
    };

    return (
        <section className="relative w-full pt-4 pb-6 select-none" aria-label="最新上线轮播" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            {/* Header: Title and Prev/Next Controls */}
            <div className="mb-4 flex min-h-8 items-center justify-between gap-4">
                <h2 className="text-xl font-medium tracking-tight text-white sm:text-2xl font-sans">最新上线</h2>
                <div className="flex shrink-0 items-center gap-1.5">
                    <button
                        type="button"
                        aria-label="上一个"
                        onClick={prevSlide}
                        className="flex size-8 items-center justify-center rounded-full text-zinc-300 bg-white/[0.06] border border-white/[0.08] shadow-sm transition-all duration-200 hover:bg-white/[0.14] hover:border-white/20 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer"
                    >
                        <ChevronLeft className="size-4" strokeWidth={2.2} />
                    </button>
                    <button
                        type="button"
                        aria-label="下一个"
                        onClick={nextSlide}
                        className="flex size-8 items-center justify-center rounded-full text-zinc-300 bg-white/[0.06] border border-white/[0.08] shadow-sm transition-all duration-200 hover:bg-white/[0.14] hover:border-white/20 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer"
                    >
                        <ChevronRight className="size-4" strokeWidth={2.2} />
                    </button>
                </div>
            </div>

            {/* 3D Coverflow Viewport (perspective: 2400px; height: 309px) */}
            <div
                className="relative w-full overflow-hidden flex items-center justify-center touch-pan-y cursor-grab active:cursor-grabbing"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                    height: "309px",
                    perspective: "2400px",
                }}
            >
                {/* Left Card (translateX(-456px) translateZ(-20px) rotateY(20deg) scale(0.9)) */}
                <div
                    onClick={() => prevSlide()}
                    className="absolute top-0 left-1/2 w-[507px] h-[285px] rounded-2xl overflow-hidden cursor-pointer select-none bg-[#0b0b0b]"
                    style={{
                        marginLeft: "-253.5px",
                        zIndex: 9,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        boxShadow: "0 24px 48px rgba(0, 0, 0, 0.45)",
                        transform: "translateX(-456px) translateZ(-20px) rotateY(20deg) scale(0.9)",
                        transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1), opacity 700ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                >
                    <img src={leftSlide.slide.bgImage} alt={leftSlide.slide.title} className="size-full object-cover filter brightness-90" />
                    {/* Darkening Scrim (opacity: 0.35) */}
                    <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: 0.35 }} />
                    {/* Bottom Scrim (solid dark translucent glass, zero gradient) */}
                    <div className="absolute inset-x-0 bottom-0 h-[45%] bg-black/70 backdrop-blur-sm pointer-events-none" />

                    <div className="absolute bottom-5 left-6 right-6 z-30">
                        <span className="inline-flex h-[22px] items-center px-2.5 rounded-full text-xs text-white/90 bg-white/[0.08] backdrop-blur-2xl border border-white/15 mb-1.5 shadow-sm">{leftSlide.slide.badge}</span>
                        <h3 className="text-lg font-bold text-white truncate">{leftSlide.slide.title}</h3>
                    </div>
                </div>

                {/* Active Center Card (scale: 1, rotateY: 0deg, zIndex: 10) */}
                <div
                    onClick={handleCenterCardClick}
                    className="absolute top-0 left-1/2 w-[507px] h-[285px] rounded-2xl overflow-hidden cursor-pointer select-none bg-[#0b0b0b] group"
                    style={{
                        marginLeft: "-253.5px",
                        zIndex: 10,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        boxShadow: "0 24px 48px rgba(0, 0, 0, 0.45)",
                        transform: "translateX(0px) translateZ(0px) rotateY(0deg) scale(1)",
                        transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1), opacity 700ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                >
                    <img src={centerSlide.slide.bgImage} alt={centerSlide.slide.title} className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                    {/* Bottom Scrim (solid dark translucent glass, zero gradient) */}
                    <div className="absolute inset-x-0 bottom-0 h-[48%] bg-black/70 backdrop-blur-sm pointer-events-none" />

                    {/* Content Overlay */}
                    <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col justify-end z-30">
                        {/* High-Fidelity Solid Frosted Glass Pill (zero gradient) */}
                        <div className="mb-2">
                            <span
                                className="relative inline-flex h-[22px] items-center px-2.5 rounded-full text-xs font-medium text-white/95 overflow-hidden"
                                style={{
                                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                                    backdropFilter: "blur(40px) saturate(140%)",
                                    border: "1px solid rgba(255, 255, 255, 0.18)",
                                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                                }}
                            >
                                <span className="relative z-10">{centerSlide.slide.badge}</span>
                            </span>
                        </div>

                        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-1 truncate drop-shadow-sm">{centerSlide.slide.title}</h3>
                        <p className="text-xs sm:text-sm text-white/70 line-clamp-1 leading-relaxed">{centerSlide.slide.subtitle}</p>
                    </div>
                </div>

                {/* Right Card (translateX(456px) translateZ(-20px) rotateY(-20deg) scale(0.9)) */}
                <div
                    onClick={() => nextSlide()}
                    className="absolute top-0 left-1/2 w-[507px] h-[285px] rounded-2xl overflow-hidden cursor-pointer select-none bg-[#0b0b0b]"
                    style={{
                        marginLeft: "-253.5px",
                        zIndex: 9,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        boxShadow: "0 24px 48px rgba(0, 0, 0, 0.45)",
                        transform: "translateX(456px) translateZ(-20px) rotateY(-20deg) scale(0.9)",
                        transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1), opacity 700ms cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                >
                    <img src={rightSlide.slide.bgImage} alt={rightSlide.slide.title} className="size-full object-cover filter brightness-90" />
                    {/* Darkening Scrim (opacity: 0.35) */}
                    <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: 0.35 }} />
                    {/* Bottom Scrim (solid dark translucent glass, zero gradient) */}
                    <div className="absolute inset-x-0 bottom-0 h-[45%] bg-black/70 backdrop-blur-sm pointer-events-none" />

                    <div className="absolute bottom-5 left-6 right-6 z-30">
                        <span className="inline-flex h-[22px] items-center px-2.5 rounded-full text-xs text-white/90 bg-white/[0.07] backdrop-blur-2xl border border-white/10 mb-1.5 shadow-sm">{rightSlide.slide.badge}</span>
                        <h3 className="text-lg font-bold text-white truncate">{rightSlide.slide.title}</h3>
                    </div>
                </div>
            </div>

            {/* Pagination Indicators (17 Dots: Inactive 4px, Active 16px) */}
            <div className="mt-3 flex items-center justify-center gap-1.5">
                {slides.map((slide, idx) => {
                    const isActive = idx === currentIndex;
                    return (
                        <button
                            key={slide.id}
                            type="button"
                            aria-label={`切换到幻灯片 ${idx + 1}`}
                            onClick={() => setCurrentIndex(idx)}
                            className="h-1 rounded-full cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
                            style={{
                                width: isActive ? "16px" : "4px",
                                backgroundColor: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.2)",
                                boxShadow: isActive ? "0 0 8px rgba(255, 255, 255, 0.6)" : "none",
                            }}
                        />
                    );
                })}
            </div>
        </section>
    );
};
