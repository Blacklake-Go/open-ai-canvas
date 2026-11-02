import { MousePointerClick, Sparkles } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";

export function InteractionsPane() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <MousePointerClick className="h-5 w-5 text-sky-400" />
                    交互中心与状态反馈 (Interaction Feedback)
                </h2>
                <p className="text-sm text-foreground/60 leading-relaxed mt-1">
                    集中管理组件的 Hover 悬停微上浮、Pressed 按压收缩、Focus-visible 键盘焦点光环与 Disabled 防死区规范。
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">悬停反馈 (Hover Feedback)</h3>
                    <p className="text-xs text-foreground/60 leading-relaxed">
                        卡片悬停启用受限微位移 <code className="text-sky-400 font-mono">-translate-y-0.5</code>，阴影平滑过渡至 E2，媒体预览最大放大不超过 1.04x。
                    </p>
                    <div className="pt-3">
                        <button
                            type="button"
                            className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 hover:-translate-y-0.5 text-white text-xs font-medium shadow-md transition-all active:translate-y-0"
                        >
                            交互测试：悬停我感受上浮
                        </button>
                    </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">键盘焦点管理 (Focus Ring)</h3>
                    <p className="text-xs text-foreground/60 leading-relaxed">
                        Tab 键导航时严格展现 2px/4px 主色高对比 Focus Ring，鼠标点击时不产生视觉噪声，关闭弹窗时光标焦点自动返回触发器。
                    </p>
                    <div className="pt-3">
                        <input
                            type="text"
                            placeholder="点击并按 Tab 体验焦点环"
                            className="h-8 w-full max-w-xs rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:ring-2 focus:ring-sky-400 focus:outline-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
