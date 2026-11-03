import { useState } from "react";
import { Droplet } from "lucide-react";
import { useVisualEngineStore } from "../../storage/visual-engine-store";

export function ColorsPane() {
    const draftConfig = useVisualEngineStore((state) => state.draftConfig);
    const updateDraft = useVisualEngineStore((state) => state.updateDraft);
    const [editMode, setEditMode] = useState<"dark" | "light">("dark");

    const tokens = draftConfig.tokens[editMode];

    const handleColorChange = (key: keyof typeof tokens, val: string) => {
        updateDraft((d) => {
            d.tokens[editMode][key] = val;
        });
    };

    const colorFields: Array<{ key: keyof typeof tokens; label: string; desc: string }> = [
        { key: "canvas", label: "画板/页面底色 (Canvas)", desc: "全站基础视口背景" },
        { key: "surface", label: "表面卡片色 (Surface)", desc: "标准卡片与容器底色" },
        { key: "surfaceSubtle", label: "次级表面 (Surface Subtle)", desc: "输入框、辅助栏底色" },
        { key: "surfaceRaised", label: "凸起表面 (Surface Raised)", desc: "悬浮工具、弹窗底色" },
        { key: "primary", label: "品牌主操作色 (Primary)", desc: "主按钮、激活指示、关键行动点" },
        { key: "primaryForeground", label: "主操作文字色 (Primary FG)", desc: "主按钮内部文字与图标" },
        { key: "text", label: "主正文色 (Text)", desc: "高可读性标题与正文" },
        { key: "textMuted", label: "次级提示文字 (Text Muted)", desc: "说明、辅标签文字" },
        { key: "border", label: "边框线色 (Border)", desc: "分割线与容器描边" },
        { key: "controlFocus", label: "焦点光环色 (Focus Ring)", desc: "键盘可访问性焦点反馈" },
        { key: "selected", label: "选中项底色 (Selected)", desc: "列表项、Tab 选中状态" },
        { key: "selectedForeground", label: "选中项文字 (Selected FG)", desc: "选中状态强调文字" },
        { key: "danger", label: "危险/错误色 (Danger)", desc: "删除、拦截、报错反馈" },
        { key: "success", label: "成功反馈色 (Success)", desc: "操作完成、健康状态" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Droplet className="h-5 w-5 text-sky-400" />
                        色彩中心 (Color Tokens)
                    </h2>
                    <p className="text-sm text-foreground/60 leading-relaxed mt-1">
                        集中配置三层语义色彩令牌。深浅色模式采用独立色彩设计体系，杜绝生硬反相。
                    </p>
                </div>
                <div className="flex items-center rounded-lg border border-border p-1 bg-card">
                    <button
                        type="button"
                        onClick={() => setEditMode("dark")}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                            editMode === "dark" ? "bg-sky-500 text-white" : "text-foreground/60 hover:text-foreground"
                        }`}
                    >
                        编辑深色 (Dark)
                    </button>
                    <button
                        type="button"
                        onClick={() => setEditMode("light")}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                            editMode === "light" ? "bg-sky-500 text-white" : "text-foreground/60 hover:text-foreground"
                        }`}
                    >
                        编辑浅色 (Light)
                    </button>
                </div>
            </div>

            {/* 色彩网格表单 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {colorFields.map((field) => {
                    const value = tokens[field.key] || "#000000";
                    return (
                        <div
                            key={field.key}
                            className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-card hover:border-foreground/20 transition-all"
                        >
                            <div className="space-y-0.5 max-w-[240px]">
                                <label htmlFor={`ve-color-${editMode}-${field.key}`} className="text-xs font-semibold text-foreground block">
                                    {field.label}
                                </label>
                                <span className="text-[11px] text-foreground/50 block truncate">
                                    {field.desc}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={value.startsWith("#") ? value : "#38bdf8"}
                                    onChange={(e) => handleColorChange(field.key, e.target.value)}
                                    className="h-8 w-8 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                                />
                                <input
                                    type="text"
                                    id={`ve-color-${editMode}-${field.key}`}
                                    value={value}
                                    onChange={(e) => handleColorChange(field.key, e.target.value)}
                                    className="h-8 w-24 rounded-lg border border-border bg-background px-2 text-xs font-mono text-foreground focus:border-sky-400 focus:outline-none"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
