import { Sliders, CheckSquare, Layers, Box, Cpu } from "lucide-react";
import { ToggleField } from "../components/config-fields";
import { useVisualEngineStore } from "../../storage/visual-engine-store";

export function ComponentsPane() {
    const draftConfig = useVisualEngineStore((state) => state.draftConfig);
    const updateDraft = useVisualEngineStore((state) => state.updateDraft);
    const comp = draftConfig.components;

    const handleChange = (key: keyof typeof comp, val: number) => {
        updateDraft((d) => {
            d.components[key] = val;
        });
    };

    const geometryGroups = [
        {
            title: "控件几何高度 (Heights)",
            icon: Sliders,
            items: [
                { key: "buttonHeightRegular", label: "标准按钮高度 (Regular)", min: 28, max: 48, unit: "px" },
                { key: "buttonHeightCompact", label: "紧凑按钮高度 (Compact)", min: 24, max: 40, unit: "px" },
                { key: "buttonHeightMicro", label: "微型按钮高度 (Micro)", min: 20, max: 36, unit: "px" },
                { key: "inputHeight", label: "标准输入框高度 (Input)", min: 28, max: 48, unit: "px" },
            ],
        },
        {
            title: "圆角系统 (Corner Radii)",
            icon: Box,
            items: [
                { key: "buttonRadius", label: "按钮圆角 (Button Radius)", min: 0, max: 24, unit: "px" },
                { key: "inputRadius", label: "输入框圆角 (Input Radius)", min: 0, max: 24, unit: "px" },
                { key: "cardRadius", label: "卡片圆角 (Card Radius)", min: 0, max: 32, unit: "px" },
                { key: "overlayRadius", label: "弹窗与抽屉圆角 (Overlay Radius)", min: 0, max: 32, unit: "px" },
                { key: "menuRadius", label: "下拉菜单圆角 (Menu Radius)", min: 0, max: 20, unit: "px" },
                { key: "tagRadius", label: "徽标与标签圆角 (Tag Radius)", min: 0, max: 16, unit: "px" },
            ],
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Layers className="h-5 w-5 text-sky-400" />
                    UI 组件光学与状态管理
                </h2>
                <p className="text-sm text-foreground/60 leading-relaxed mt-1">集中管理全站按钮、输入框、下拉框、卡片及浮层组件的高精几何、状态尺寸与圆角。</p>
            </div>

            {/* 模型选择器视觉优化设置 */}
            <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-sky-400" />
                            模型下拉选择器精简视觉设置 (Model Picker Simplified Visuals)
                        </h3>
                        <p className="text-xs text-foreground/60 leading-relaxed mt-1">非侵入式前端视觉优化：左侧突出品牌，右侧参考图 2 音乐模型卡片风格呈现，保留原积分区间；隐藏渠道底层文本与调用采样统计浮窗（仅视觉隐藏，不删除任何数据与调用逻辑）。</p>
                    </div>
                    <button
                        type="button"
                        onClick={() =>
                            updateDraft((d) => {
                                d.modelPicker.simplified = !d.modelPicker.simplified;
                            })
                        }
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                            draftConfig.modelPicker.simplified ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-foreground/5 text-foreground/50 border-border"
                        }`}
                    >
                        {draftConfig.modelPicker.simplified ? "已启用精简视图" : "使用原生视图"}
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
                    <ToggleField
                        label="隐藏品牌栏渠道统计与平台标记（图 1 标记项）"
                        value={draftConfig.modelPicker.hideChannelMeta}
                        onChange={(val) =>
                            updateDraft((d) => {
                                d.modelPicker.hideChannelMeta = val;
                            })
                        }
                    />
                    <ToggleField
                        label="隐藏调用采样统计浮窗与状态指示（图 3 标记项，仅隐藏不删除组件）"
                        value={draftConfig.modelPicker.hideTelemetry}
                        onChange={(val) =>
                            updateDraft((d) => {
                                d.modelPicker.hideTelemetry = val;
                            })
                        }
                    />
                    <ToggleField
                        label="图 2 风格卡片布局与独立积分区间药丸"
                        value={draftConfig.modelPicker.cleanCardLayout}
                        onChange={(val) =>
                            updateDraft((d) => {
                                d.modelPicker.cleanCardLayout = val;
                            })
                        }
                    />
                </div>
            </div>

            <div className="space-y-6">
                {geometryGroups.map((group) => (
                    <div key={group.title} className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <group.icon className="h-4 w-4 text-sky-400" />
                            {group.title}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {group.items.map((item) => {
                                const currentVal = comp[item.key as keyof typeof comp];
                                return (
                                    <div key={item.key} className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-medium text-foreground">{item.label}</span>
                                            <span className="font-mono text-sky-400 font-bold">
                                                {currentVal}
                                                {item.unit}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="range"
                                                min={item.min}
                                                max={item.max}
                                                value={currentVal}
                                                onChange={(e) => handleChange(item.key as keyof typeof comp, parseInt(e.target.value, 10))}
                                                className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-sky-400"
                                            />
                                            <input
                                                type="number"
                                                min={item.min}
                                                max={item.max}
                                                value={currentVal}
                                                onChange={(e) => handleChange(item.key as keyof typeof comp, parseInt(e.target.value, 10) || item.min)}
                                                className="w-16 h-7 rounded border border-border bg-card px-1.5 text-xs font-mono text-foreground text-center"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
