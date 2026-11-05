import { creationLabel as _creationLabel } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { CheckCircle2, Circle, Loader2, PauseCircle } from "lucide-react";

import type { DramaSummary } from "@/services/api/drama";

import { formatCount } from "../drama-shared";

/** 全剧第一集出现前的状态：让用户知道流水线在做什么，而不是面对空白页。 */
export function StudioGenesis({ summary }: { summary: DramaSummary }) {
    _useCreationLocale();
    const { production } = summary;
    const bibleDone = production.stage !== "bible";
    const paused = production.status !== "running";
    const steps = [
        { label: `读取小说 · ${formatCount(production.chapterCount)} 章 ${formatCount(production.wordCount)} 字`, done: true },
        { label: "建立作品圣经：角色、道具、场景与画面规则", done: bibleDone, active: !bibleDone },
        { label: "分集改编：每集开场钩子与结尾悬念", done: summary.episodes.length > 0, active: bibleDone && !summary.episodes.length },
        { label: "第 1 集样片：剧本、段提示词与段视频", done: false, active: false },
    ];
    return (
        <div className="drama-genesis">
            <div className="drama-genesis-card">
                {paused ? <PauseCircle className="mx-auto mb-5 size-16 text-[var(--status-warning)]" /> : <div className="drama-genesis-orb" aria-hidden />}
                <h2>{paused ? (production.status === "draft" ? _creationText("creation.ccd9d080dbf41169") : _creationText("creation.2719c5ce5ad43e3e")) : _creationText("creation.1aeebd9dc5f0c008")}</h2>
                <p>
                    {paused
                        ? _creationText("creation.5acc065cec0b5d1b", {
                              value1: production.pauseReason || _creationText("creation.94ff7c670f53f7b9"),
                              value2: production.status === "draft" ? _creationText("creation.f83f64d120f7ebf0") : _creationText("creation.435090558c77f044"),
                          })
                        : _creationText("creation.249e03a18c076412")}
                </p>
                <div className="drama-genesis-steps">
                    {steps.map((step) => (
                        <div key={step.label} className={`drama-genesis-step ${step.done ? "is-done" : step.active && !paused ? "is-active" : ""}`}>
                            {step.done ? <CheckCircle2 className="size-4 text-[var(--status-success)]" /> : step.active && !paused ? <Loader2 className="size-4 animate-spin text-[var(--workspace-accent)]" /> : <Circle className="size-4 opacity-35" />}
                            {_creationLabel(step.label)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
