import React from "react";
import { ArrowRight, Check } from "lucide-react";
import { RenderAppIcon } from "./app-store-icons";
import type { AppStoreItem, HotUseCase } from "./app-store-types";

interface AppCardProps {
    app: AppStoreItem;
    isInstalled?: boolean;
    onClick?: (app: AppStoreItem) => void;
}

export const AppCard: React.FC<AppCardProps> = ({ app, isInstalled, onClick }) => {
    return (
        <button
            type="button"
            onClick={() => onClick?.(app)}
            className="group flex min-h-[148px] flex-col justify-between rounded-2xl bg-[#131316] border border-white/[0.08] p-4 text-left transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 hover:bg-[#19191f] hover:border-white/[0.2] hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer select-none"
            style={{
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
                outline: "none",
            }}
        >
            {/* Top Row: 灰色线性图标 + Title + Badge + Trailing Icon */}
            <div className="flex min-w-0 items-center gap-3 w-full">
                <RenderAppIcon name={app.name} slug={app.slug} type={app.type} size="sm" />

                {/* Title and Badges */}
                <div className="min-w-0 flex-1 flex items-center gap-2">
                    <h3 className="truncate text-[15px] font-semibold tracking-[-0.015em] leading-5 text-zinc-50 font-sans">{app.name}</h3>
                    {app.badge ? <span className="shrink-0 rounded-full bg-white/[0.1] border border-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-zinc-200">{app.badge}</span> : null}
                </div>

                {/* Trailing Indicator: Arrow or Checkmark (Driven by isInstalled) */}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-zinc-300 transition-all duration-200 group-hover:bg-white/[0.1] group-hover:border-white/20 group-hover:text-white shadow-xs">
                    {isInstalled ? <Check className="size-4" strokeWidth={2.2} /> : <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.2} />}
                </span>
            </div>

            {/* Description (3 lines clamped) */}
            <div className="mt-3 flex min-h-0 flex-1 flex-col">
                <p className="line-clamp-3 text-sm leading-relaxed text-zinc-300">{app.description}</p>
            </div>
        </button>
    );
};

interface SkillCardProps {
    app: AppStoreItem;
    isInstalled?: boolean;
    onClick?: (app: AppStoreItem) => void;
}

export const OfficialSkillCard: React.FC<SkillCardProps> = ({ app, isInstalled, onClick }) => {
    return (
        <button
            type="button"
            onClick={() => onClick?.(app)}
            className="group flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-2xl p-3 text-left bg-transparent border border-transparent transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-white/[0.06] hover:border-white/[0.1] hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 select-none"
        >
            {/* 44x44 灰色线性图标 */}
            <RenderAppIcon name={app.name} slug={app.slug} type="skill" size="md" />

            {/* Content */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="block truncate text-[15px] font-semibold tracking-[-0.015em] leading-5 text-zinc-100 group-hover:text-white transition-colors duration-200">{app.name}</span>
                    {app.badge ? <span className="shrink-0 rounded-full bg-white/[0.1] border border-white/[0.08] px-1.5 py-0.2 text-[10px] font-semibold text-zinc-200">{app.badge}</span> : null}
                </div>
                <span className="mt-1 block truncate text-sm leading-5 text-zinc-400">{app.description}</span>
            </div>

            {/* Trailing Indicator: Check or Arrow */}
            {isInstalled ? (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] border border-white/[0.12] text-zinc-200 shadow-xs">
                    <Check className="size-4" strokeWidth={2.2} />
                </span>
            ) : (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-zinc-300 transition-all duration-200 group-hover:bg-white/[0.1] group-hover:border-white/20 group-hover:text-white shadow-xs">
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.2} />
                </span>
            )}
        </button>
    );
};

interface HotUseCaseCardProps {
    item: HotUseCase;
    onClick?: (item: HotUseCase) => void;
}

export const HotUseCaseCard: React.FC<HotUseCaseCardProps> = ({ item, onClick }) => {
    return (
        <button
            type="button"
            onClick={() => onClick?.(item)}
            className="group flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-2xl p-3 text-left bg-transparent border border-transparent transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-white/[0.06] hover:border-white/[0.1] hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 select-none"
        >
            {/* 44x44 灰色线性图标 */}
            <RenderAppIcon name={item.title} slug={item.appSlug} type="app" size="md" />

            {/* Content */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="block truncate text-[15px] font-semibold tracking-[-0.015em] leading-5 text-zinc-100 group-hover:text-white transition-colors duration-200">{item.title}</span>
                    {item.badge ? <span className="shrink-0 rounded-full bg-white/[0.10] border border-white/[0.12] px-1.5 py-0.2 text-[10px] font-semibold text-zinc-200">{item.badge}</span> : null}
                </div>
                <span className="mt-1 block truncate text-sm leading-5 text-zinc-400">{item.subtitle}</span>
            </div>

            {/* Arrow */}
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-zinc-300 transition-all duration-200 group-hover:bg-white/[0.1] group-hover:border-white/20 group-hover:text-white shadow-xs">
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.2} />
            </span>
        </button>
    );
};
