import { Type } from "lucide-react";

export function TypographyPane() {
    const typeScales = [
        { label: "Label (微小辅助标签)", size: "11px", line: "16px", tracking: "+0.02em", weight: "500", sample: "V2.0 RELEASE" },
        { label: "Caption (注解与说明)", size: "12px", line: "18px", tracking: "0", weight: "400", sample: "最后修改于 2026-11-03 04:00" },
        { label: "UI (标准控件与菜单)", size: "13px", line: "20px", tracking: "-0.01em", weight: "500", sample: "生成电影级画卷" },
        { label: "Body (正文与内容阅读)", size: "14px", line: "22px", tracking: "-0.01em", weight: "400", sample: "影策为专业影视创作者提供全流程 AI 协作与工作台。" },
        { label: "Heading (小标题与区块)", size: "16px", line: "24px", tracking: "-0.015em", weight: "600", sample: "工作区恢复动效参数" },
        { label: "Title (页面与卡片主标题)", size: "22px", line: "30px", tracking: "-0.02em", weight: "700", sample: "SupDance Studio" },
        { label: "Display (大屏核心展示标题)", size: "32px", line: "40px", tracking: "-0.025em", weight: "800", sample: "全站视觉引擎" },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Type className="h-5 w-5 text-sky-400" />
                    字体与排版层级 (Typography Engine)
                </h2>
                <p className="text-sm text-foreground/60 leading-relaxed mt-1">严格对齐 V1.0 规范的 7 级字体梯队体系，内置 Inter、系统无衬线字体与 JetBrains Mono 等宽字体契约。</p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-5 divide-y divide-border/50">
                {typeScales.map((item) => (
                    <div key={item.label} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-foreground">{item.label}</span>
                            <div className="flex items-center gap-3 text-[11px] font-mono text-foreground/50">
                                <span>Size: {item.size}</span>
                                <span>Line: {item.line}</span>
                                <span>Weight: {item.weight}</span>
                            </div>
                        </div>
                        <div
                            className="text-foreground"
                            style={{
                                fontSize: item.size,
                                lineHeight: item.line,
                                fontWeight: item.weight,
                            }}
                        >
                            {item.sample}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
