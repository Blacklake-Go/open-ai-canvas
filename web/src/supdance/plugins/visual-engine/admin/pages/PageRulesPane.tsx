import { useState } from "react";
import { Compass, Plus, Trash2, Edit2 } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";
import type { PageRule } from "../../types";

export function PageRulesPane() {
    const draftConfig = useVisualEngineStore((state) => state.draftConfig);
    const updateDraft = useVisualEngineStore((state) => state.updateDraft);
    const rules = draftConfig.pageRules;

    const [editingRule, setEditingRule] = useState<PageRule | null>(null);

    const handleAddRule = () => {
        const newRule: PageRule = {
            id: `rule-${Date.now()}`,
            name: "新页面策略规则",
            pathPattern: "/new-path/*",
            themePresetOverride: "studio",
            motionEnabledOverride: true,
            recoveryEnabledOverride: false,
            notes: "自定义特定页面路径视觉行为",
        };
        updateDraft((d) => {
            d.pageRules.push(newRule);
        });
    };

    const handleDeleteRule = (id: string) => {
        updateDraft((d) => {
            d.pageRules = d.pageRules.filter((r) => r.id !== id);
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Compass className="h-5 w-5 text-sky-400" />
                        页面级视觉策略 (Page Rules)
                    </h2>
                    <p className="text-sm text-foreground/60 leading-relaxed mt-1">
                        为特定路由或子应用独立配置主题预设、动画开关与工作区恢复逻辑，杜绝硬编码业务页面。
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleAddRule}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-medium shadow-md transition-all active:scale-95"
                >
                    <Plus className="h-4 w-4" /> 新增页面规则
                </button>
            </div>

            {/* 规则列表 */}
            <div className="space-y-3">
                {rules.map((rule) => (
                    <div
                        key={rule.id}
                        className="rounded-xl border border-border/70 bg-card p-4 space-y-3 transition-all hover:border-foreground/20"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                    {rule.pathPattern}
                                </span>
                                <span className="text-sm font-semibold text-foreground">{rule.name}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleDeleteRule(rule.id)}
                                className="text-foreground/40 hover:text-rose-400 p-1 rounded"
                                title="删除该规则"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="text-xs text-foreground/60 leading-relaxed">
                            {rule.notes || "未填写备注"}
                        </div>

                        <div className="pt-2 border-t border-border/50 flex flex-wrap items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="text-foreground/50">主题预设：</span>
                                <span className="font-medium text-foreground">{rule.themePresetOverride || "跟随全站"}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-foreground/50">动效状态：</span>
                                <span className="font-medium text-foreground">
                                    {rule.motionEnabledOverride === undefined ? "跟随全局" : rule.motionEnabledOverride ? "强制开启" : "强制关闭"}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-foreground/50">工作区恢复动画：</span>
                                <span className="font-medium text-foreground">
                                    {rule.recoveryEnabledOverride === undefined ? "跟随全局" : rule.recoveryEnabledOverride ? "开启" : "跳过"}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
