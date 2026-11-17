import React, { useState } from "react";
import { FolderGit2, X, ExternalLink, Network, FileCode, Layers, Sparkles, Copy, Check, Download, ChevronRight, FileText, Bot, Image, Film, Sliders } from "lucide-react";
import { TapTvVideoItem } from "./taptv-types";
import { message } from "antd";

interface TapTvProcessModalProps {
    video: TapTvVideoItem | null;
    onClose: () => void;
}

interface PipelineNode {
    id: string;
    stepNumber: number;
    name: string;
    stageName: string;
    engine: string;
    description: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    parameters: { label: string; value: string | number }[];
    promptSnippet: string;
}

export const TapTvProcessModal: React.FC<TapTvProcessModalProps> = ({ video, onClose }) => {
    const [selectedNodeId, setSelectedNodeId] = useState<string>("node-1");
    const [copiedNode, setCopiedNode] = useState(false);

    if (!video) return null;

    const pipelineNodes: PipelineNode[] = [
        {
            id: "node-1",
            stepNumber: 1,
            name: "创意构思与提示词工程",
            stageName: "Prompt 构思",
            engine: "Claude 3.5 Sonnet / GPT-4o",
            description: "确立核心视效概念、分镜基调、正向与负向提示词词库构建以及电影级艺术风格锚定。",
            icon: FileText,
            parameters: [
                { label: "提示词权重 (CFG)", value: video.parameters.cfgScale },
                { label: "画幅比例 (Aspect Ratio)", value: video.parameters.aspectRatio },
                { label: "语言模型", value: "Claude 3.5 Sonnet" },
                { label: "风格预设", value: "Cinematic 70mm IMAX" },
            ],
            promptSnippet: video.prompt,
        },
        {
            id: "node-2",
            stepNumber: 2,
            name: "剧本结构与分镜解构",
            stageName: "LLM 剧本分镜",
            engine: "DeepSeek R1 / TapNow Storyboard Agent",
            description: "通过推理智能体将大纲拆解为逐镜头分镜脚本，规划景别、运镜轨迹、光影变换与情感曲线。",
            icon: Bot,
            parameters: [
                { label: "镜头数量 (Shots)", value: "12 个镜头" },
                { label: "运镜语法", value: "推拉摇移复合运镜" },
                { label: "连贯性策略", value: "角色矩阵状态锁定" },
                { label: "生成温标 (Temp)", value: 0.7 },
            ],
            promptSnippet: `[分镜总纲]: ${video.synopsis}\n[基调风格]: ${video.toolTag}\n[镜头连续性]: 采用同一主体人物 LoRA 权重贯穿全剧本。`,
        },
        {
            id: "node-3",
            stepNumber: 3,
            name: "影视概念与角色关键帧",
            stageName: "关键帧图像生成",
            engine: "Midjourney v6 / Flux.1 Pro",
            description: "输出 4K 高保真概念底图与角色首尾关键帧，锁定角色面部特征与光影质感。",
            icon: Image,
            parameters: [
                { label: "基础模型", value: video.parameters.model },
                { label: "采样步数 (Steps)", value: video.parameters.steps },
                { label: "采样算法 (Sampler)", value: video.parameters.sampler },
                { label: "随机种子 (Seed)", value: video.parameters.seed },
            ],
            promptSnippet: video.prompt,
        },
        {
            id: "node-4",
            stepNumber: 4,
            name: "镜头运镜与动态生成",
            stageName: "视频动态插帧",
            engine: video.toolTag,
            description: "以高清图像为首帧锚点，通过运动矢量插值与物理引擎生成逼真流体、光斑与连贯动态。",
            icon: Film,
            parameters: [
                { label: "动态引擎", value: video.toolTag },
                { label: "运动幅度 (Motion)", value: 128 },
                { label: "帧率 (Frame Rate)", value: "24 fps" },
                { label: "视频时长 (Duration)", value: video.duration },
            ],
            promptSnippet: `[动态引导]: Smooth camera motion, volumetric lighting, photorealistic textures, 8k resolution.\n[负向约束]: ${video.negativePrompt}`,
        },
        {
            id: "node-5",
            stepNumber: 5,
            name: "超分升格与声画混音",
            stageName: "影视后期合成",
            engine: "Topaz Video AI × ElevenLabs Master",
            description: "完成 4K 细节重构升格、AI 声学环境拟音与电影级胶片调色 LUT 渲染。",
            icon: Layers,
            parameters: [
                { label: "输出分辨率", value: "3840 × 2160 (4K)" },
                { label: "色彩空间", value: "Rec.709 D65 Cinematic" },
                { label: "音频通道", value: "双声道 48kHz / 24bit" },
                { label: "渲染管线状态", value: "100% 编译完成" },
            ],
            promptSnippet: `[后期配置]: AI 4K Upscale Enabled, Dynamic Sound Design Synced, Film Grain Emulation 15%.`,
        },
    ];

    const activeNode = pipelineNodes.find((n) => n.id === selectedNodeId) || pipelineNodes[0];

    const assetPackages = [
        {
            id: "asset-1",
            name: "分镜脚本与 Prompt 词典.json",
            size: "128 KB",
            type: "JSON 数据",
            description: "完整镜头脚本结构化数据、正负向提示词词典与权重标注",
            icon: FileCode,
        },
        {
            id: "asset-2",
            name: "角色连贯性 LoRA 绑定包.safetensors",
            size: "144 MB",
            type: "权重模型",
            description: "主体角色面部特征、服饰细节与镜头多角度一致性微调权重",
            icon: Layers,
        },
        {
            id: "asset-3",
            name: "4K 影视调色 LUTs 预设.cube",
            size: "4.2 MB",
            type: "色彩预设",
            description: "大师级电影感冷暖对比色调与胶片颗粒色彩映射查找表",
            icon: Sliders,
        },
        {
            id: "asset-4",
            name: "多轨拟音声学素材包.wav",
            size: "38 MB",
            type: "音频母带",
            description: "与镜头对齐的环境底噪、拟音特效与电影级配乐全轨分轨音频",
            icon: Network,
        },
    ];

    const handleCopyNodeConfig = () => {
        const textToCopy = `[Node]: ${activeNode.name}\n[Engine]: ${activeNode.engine}\n[Parameters]:\n${activeNode.parameters.map((p) => `- ${p.label}: ${p.value}`).join("\n")}\n\n[Prompt/Config]:\n${activeNode.promptSnippet}`;
        navigator.clipboard.writeText(textToCopy);
        setCopiedNode(true);
        message.success(`已复制 ${activeNode.stageName} 节点配置与提示词！`);
        setTimeout(() => setCopiedNode(false), 2000);
    };

    const handleDownloadAsset = (assetName: string) => {
        message.success(`已开始下载工程资产包：${assetName}`);
    };

    const handleCloneWorkflow = () => {
        message.success("已成功将该创作工程的多节点拓扑克隆到你的智能体工作台！可在画布中随时查看与扩展。");
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none" data-testid="taptv-process-modal" onClick={onClose}>
            <div
                className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#141414] border border-white/[0.1] p-6 shadow-2xl flex flex-col gap-6"
                onClick={(e) => e.stopPropagation()}
                style={{
                    boxShadow: "0 24px 64px rgba(0, 0, 0, 0.8)",
                }}
            >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.08] text-zinc-300 border border-white/[0.08]">
                            <FolderGit2 className="size-5" strokeWidth={2.2} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-zinc-50 tracking-tight flex items-center gap-2">
                                <span>创作过程工程管线</span>
                                <span className="text-zinc-500 font-normal">·</span>
                                <span className="text-zinc-200 font-medium truncate max-w-[320px] sm:max-w-md">{video.title}</span>
                            </h2>
                            <p className="text-xs text-zinc-400 mt-0.5">查看此作品的多节点拓扑、生成参数细节与工程资产包。</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex size-8 items-center justify-center rounded-full bg-white/[0.08] border border-white/10 text-zinc-300 hover:bg-white/[0.16] hover:border-white/20 hover:text-white shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                        <X className="size-4" strokeWidth={2.2} />
                    </button>
                </div>

                {/* Multi-Node Pipeline Topology Inspector */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                            <Network className="size-3.5 text-zinc-300" strokeWidth={2.2} />
                            <span>生成流程拓扑管线 (点击节点查看详情)</span>
                        </span>
                        <span className="text-[11px] text-zinc-400 tabular-nums">5 个流程节点 · 端到端执行</span>
                    </div>

                    {/* Horizontal Node Navigation Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {pipelineNodes.map((node, index) => {
                            const isSelected = selectedNodeId === node.id;
                            const IconComponent = node.icon;
                            return (
                                <button
                                    key={node.id}
                                    type="button"
                                    onClick={() => setSelectedNodeId(node.id)}
                                    className={`relative flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all cursor-pointer active:scale-98 ${
                                        isSelected ? "bg-white/[0.14] border-white/40 shadow-[0_4px_16px_rgba(255, 255, 255, 0.12)] ring-1 ring-white/20" : "bg-black/50 border-white/[0.08] hover:bg-white/[0.06] hover:border-white/20 shadow-xs"
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded tabular-nums ${isSelected ? "bg-white text-black font-semibold shadow-xs" : "bg-white/10 text-zinc-300"}`}>0{node.stepNumber}</span>
                                        <IconComponent className={`size-4 ${isSelected ? "text-white" : "text-zinc-400"}`} strokeWidth={2.2} />
                                    </div>
                                    <h4 className={`text-xs font-semibold mt-1 truncate w-full ${isSelected ? "text-white" : "text-zinc-200"}`}>{node.stageName}</h4>
                                    <p className="text-[10px] text-zinc-400 truncate w-full">{node.engine}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Selected Node Inspector Detail Card */}
                <div className="rounded-xl bg-black/50 border border-white/[0.08] p-4 flex flex-col gap-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/[0.08] pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-zinc-300">{React.createElement(activeNode.icon, { className: "size-4", strokeWidth: 2.2 })}</div>
                            <div>
                                <h3 className="text-sm font-bold text-zinc-50 flex items-center gap-2">
                                    <span>{activeNode.name}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08] text-zinc-300 border border-white/[0.12] font-normal">已验证完成</span>
                                </h3>
                                <p className="text-xs text-zinc-400">{activeNode.description}</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleCopyNodeConfig}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 hover:border-white/20 text-zinc-100 shadow-sm active:scale-95 transition-all cursor-pointer self-start sm:self-auto shrink-0"
                        >
                            {copiedNode ? (
                                <>
                                    <Check className="size-3 text-zinc-300" strokeWidth={2.2} />
                                    <span className="text-zinc-300">已复制配置</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="size-3 text-zinc-300" strokeWidth={2.2} />
                                    <span>复制节点配置</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Parameter Grid for Active Node */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {activeNode.parameters.map((param) => (
                            <div key={param.label} className="p-2.5 rounded-lg bg-[#131316] border border-white/[0.06]">
                                <span className="text-[10px] text-zinc-400 block truncate">{param.label}</span>
                                <span className="text-xs font-semibold text-zinc-100 mt-0.5 block truncate">{param.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Node Input / Prompt Snippet */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-medium text-zinc-300">节点输入数据 / 提示词上下文</span>
                        <div className="p-3 rounded-lg bg-[#131316] border border-white/[0.08] text-xs font-mono text-zinc-200 leading-relaxed max-h-28 overflow-y-auto select-text">{activeNode.promptSnippet}</div>
                    </div>
                </div>

                {/* Included Asset Packages Section with Download CTA */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                            <Layers className="size-3.5 text-zinc-300" strokeWidth={2.2} />
                            <span>包含工程资产包 (可独立下载)</span>
                        </span>
                        <span className="text-[11px] text-zinc-400 tabular-nums">4 个资产文件</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {assetPackages.map((asset) => {
                            const AssetIcon = asset.icon;
                            return (
                                <div key={asset.id} className="flex items-center justify-between p-3 rounded-xl bg-black/50 border border-white/[0.08] hover:border-white/20 transition-colors shadow-xs">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-zinc-200">
                                            <AssetIcon className="size-4 text-zinc-300" strokeWidth={2.2} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-semibold text-zinc-100 truncate">{asset.name}</h4>
                                            <p className="text-[10px] text-zinc-400 truncate mt-0.5">{asset.description}</p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleDownloadAsset(asset.name)}
                                        className="shrink-0 ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 hover:border-white/20 text-zinc-100 shadow-sm active:scale-95 transition-all cursor-pointer"
                                        title={`下载 ${asset.name}`}
                                    >
                                        <Download className="size-3 text-zinc-200" strokeWidth={2.2} />
                                        <span>下载</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom CTA (Keeps user inside dialog, does NOT navigate away) */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
                    <span className="text-xs text-zinc-400">支持将此拓扑流水线直接注入你的当前智能体画布继续二创。</span>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                            关闭
                        </button>
                        <button
                            type="button"
                            onClick={handleCloneWorkflow}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-white/90 shadow-[0_4px_18px_rgba(0, 0, 0, 0.40)] active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                        >
                            <Sparkles className="size-3.5 text-black" strokeWidth={2.2} />
                            <span>克隆工程到我的画布</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
