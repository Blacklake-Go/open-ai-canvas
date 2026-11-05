import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { GenerationTask } from "@/services/api/task-center";
import "./planning-activity.css";

export function PlanningActivity({ task, references, count, automaticScreens = false }: { task?: GenerationTask; references: number; count: number; automaticScreens?: boolean }) {
    _useCreationLocale();
    const [openedAt] = useState(Date.now);
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    const started = Date.parse(task?.startedAt || task?.createdAt || "") || openedAt;
    const seconds = Math.max(0, Math.floor((now - started) / 1000));
    const status = !task ? "正在提交策划资料" : task.status === "queued" ? "已排队，等待模型处理" : task.status === "succeeded" ? "正在校验图片方案" : "正在分析商品与构建方案";
    return (
        <section className="commerce-planning-activity" aria-label={_creationText("creation.bf0af2f8154b870e")} aria-busy="true" role="status">
            <div className="commerce-planning-emblem" aria-hidden="true">
                <span />
                <Sparkles size={24} strokeWidth={1.5} />
            </div>
            <div className="commerce-planning-title">
                <strong>{status}</strong>
                <span>{seconds >= 60 ? _creationText("creation.2f4740b4c7fc2a0a", { value1: Math.floor(seconds / 60), value2: seconds % 60 }) : _creationText("creation.8e9c8e4d3e4205c7", { value1: seconds })}</span>
            </div>
            <p>{_creationText("creation.e063b9da603f242a")}</p>
            <ol>
                <li>
                    <Check size={14} />
                    <div>
                        <strong>{_creationText("creation.1d987f20c7e2daf2")}</strong>
                        <small>
                            {references}
                            {_creationText("creation.109abbb35c385545")}
                            {automaticScreens ? _creationText("creation.01ae5ef9fdf40202") : _creationText("creation.e8d1794a428ed160", { value1: count })}
                        </small>
                    </div>
                </li>
                <li>
                    <LoaderCircle className="commerce-planning-spin" size={14} />
                    <div>
                        <strong>{task?.status === "succeeded" ? _creationText("creation.c5c01941fb9f09c6") : _creationText("creation.397a1ef934a434ed")}</strong>
                        <small>{task?.status === "queued" ? _creationText("creation.a660de96e5ec08f1") : task?.textDraft ? _creationText("creation.899cf2d47ac2fe7b", { value1: task.textDraft.length }) : _creationText("creation.57162bc0455d9495")}</small>
                    </div>
                </li>
                <li className="is-pending">
                    <span className="commerce-planning-dot" />
                    <div>
                        <strong>{_creationText("creation.9f83846dee07f912")}</strong>
                        <small>{_creationText("creation.fea53f35a765bc5e")}</small>
                    </div>
                </li>
            </ol>
            <small className="commerce-planning-footnote">{_creationText("creation.aef794f616769f86")}</small>
        </section>
    );
}
