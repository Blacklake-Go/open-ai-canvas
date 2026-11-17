// AI 歌词服务：复用后端统一生成任务生命周期（创建 → /tasks/:id/text-events SSE → 结果解析）。
// 不直连供应商、不自建协议；计费、取消与任务记录都在既有后端任务内完成。
import { runBackendGenerationTask, isGenerationTaskCancelled } from "@/services/api/generation-task";
import { cancelGenerationTask } from "@/services/api/task-center";
import { buildLyricPrompt, type LyricAIActionId } from "../components/lyrics-tools";
import type { LyricAIRequest } from "../components/lyrics-editor";
import { modelCapabilityConfigFor } from "@/lib/model-capabilities";
import { resolveGenerationWorkflowExecution } from "@/lib/generation-workflow-execution";
import { selectableModelsByCapability, logicalModelIDForConfig, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

function hasCandidateTextRuntime(config: AiConfig, model: string): AiConfig | null {
    const candidateConfig: AiConfig = { ...config, model, textModel: model };
    if (!modelCapabilityConfigFor(candidateConfig, model).text) return null;
    try {
        if (logicalModelIDForConfig(candidateConfig)) return candidateConfig;
        const requestConfig = resolveModelRequestConfig(candidateConfig, model);
        return requestConfig.channelId || requestConfig.interfaceType ? candidateConfig : null;
    } catch {
        return null;
    }
}

/**
 * 解析用于 AI 歌词生成的文本模型配置（镜像后端 assertBackendRuntimeConfigured）。
 * 即便全局 config.model 当前指向生图/视频模型，也应优先回落到 config.textModel 或站点/渠道可用的文本模型；
 * 仅当没有任何可用的文本协议或工作流时返回 null，此时 UI 降级为本地起手稿。
 */
export function resolveLyricsTextConfig(config: AiConfig): AiConfig | null {
    try {
        if (resolveGenerationWorkflowExecution(config, "text")) return config;
    } catch {
        // Ignore workflow check errors and fall back to channel text models.
    }
    const textModels = selectableModelsByCapability(config, "text");
    if (!textModels.length) return null;
    const textSet = new Set(textModels);
    const ordered = [...new Set([config.model, config.textModel, ...textModels].filter((item): item is string => Boolean(item) && textSet.has(item)))];
    for (const candidate of ordered) {
        const resolved = hasCandidateTextRuntime(config, candidate);
        if (resolved) return resolved;
    }
    return null;
}

export function isLyricsAIRuntimeConfigured(config: AiConfig): boolean {
    return Boolean(resolveLyricsTextConfig(config));
}

export type LyricsAIOptions = {
    config: AiConfig;
    signal?: AbortSignal;
};

/**
 * 生成/续写/改写/押韵歌词。返回最终歌词文本（不含解释）。
 * - 传 noop onTextDelta 强制走文本 SSE 通道（任务文本流契约）。
 * - 用户中止只停止本地监听，后端任务可能继续计费，因此捕获 taskId 后补取消。
 */
export async function generateLyrics(request: LyricAIRequest, options: LyricsAIOptions): Promise<string> {
    const { config, signal } = options;
    const textConfig = resolveLyricsTextConfig(config);
    if (!textConfig) throw new Error("未配置可用的文本模型协议");
    const prompt = buildLyricPrompt({
        action: request.action as LyricAIActionId,
        topic: request.topic,
        lyrics: request.lyrics,
        selection: request.selection,
        language: request.language,
    });
    let taskId = "";
    try {
        const result = await runBackendGenerationTask({
            mode: "text",
            prompt,
            config: textConfig,
            streamText: true,
            signal,
            metadata: { source: "music-lyrics-ai", operation: request.action },
            onTextDelta: () => {
                // SSE 通道开关：增量内容由 LyricsIsland 的调用方按需消费，
                // 这里只需要一次性终态文本，因此不逐帧回传 UI。
            },
            onTaskUpdate: (task) => {
                taskId = task.id;
            },
        });
        const text = (result.text || "").trim();
        if (!text) throw new Error("歌词生成结果为空");
        return text;
    } catch (error) {
        // 中止后端任务仍在运行会继续计费：补一次取消，尽力而为，取消失败不掩盖原始中止。
        if (isGenerationTaskCancelled(error, signal) && taskId) {
            void cancelGenerationTask(taskId).catch(() => undefined);
        }
        throw error;
    }
}
