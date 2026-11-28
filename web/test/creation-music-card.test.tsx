import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";

import { CreationMusicCard } from "@/supdance/plugins/music-generation/components/creation-music-card";
import { reconcileCreationTaskMessages } from "@/pages/create/creation-conversations";
import type { CreationConversation, CreationMessage } from "@/pages/create/creation-types";
import { CreationMediaPending, resolveCreationMusicTitle } from "@/pages/create/creation-workspace-messages";
import { historyMessagePayload } from "@/services/creation-history-payload";

const at = "2026-11-16T03:43:00.000Z";

describe("生成岛内联音乐结果与数据一致性", () => {
    test("CreationMusicCard 渲染内联波形播放器而不依赖原生 range 控件", () => {
        const html = renderToStaticMarkup(
            <CreationMusicCard messageId="msg-music-1" taskIds={["task-1"]} title="雨夜霓虹 Lo-Fi" modelLabel="suno-v6" targetDurationSeconds={180} instrumental tracks={[{ key: "res-1", url: "https://cdn.example.com/track-1.mp3", durationMs: 43000 }]} />,
        );

        expect(html).toContain("creation-music-card");
        expect(html).toContain("雨夜霓虹 Lo-Fi");
        expect(html).toContain("suno-v6");
        expect(html).toContain("纯音乐");
        expect(html).toContain("0:00 / 0:43");
        expect(html).toContain('role="slider"');
        expect(html).not.toContain('<input type="range"');
        expect(html).not.toContain("下载 MP3");
    });

    test("多音轨结果会在同一卡片内渲染每首音轨的播放与下载入口", () => {
        const html = renderToStaticMarkup(
            <CreationMusicCard
                messageId="msg-music-2"
                taskIds={["task-2"]}
                title="双轨测试"
                tracks={[
                    { key: "res-a", url: "https://cdn.example.com/a.mp3", durationMs: 65000 },
                    { key: "res-b", url: "https://cdn.example.com/b.mp3", durationMs: 72000 },
                ]}
            />,
        );

        expect(html).toContain("0:00 / 1:05");
        expect(html).toContain("0:00 / 1:12");
        expect(html).toContain("Track 1");
        expect(html).toContain("Track 2");
    });

    test("音乐结果入口使用服务端音轨序号，即使其他音轨尚未载入", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter initialEntries={["/create?conversation=music-session"]}>
                <CreationMusicCard messageId="msg-music-2" title="双轨测试" tracks={[{ key: "res-b", url: "https://cdn.example.com/b.mp3", identity: { taskId: "task-2", outputIndex: 1 } }]} />
            </MemoryRouter>,
        );
        expect(html).toContain('href="/toolbox/music/tracks/task-2/1"');
        expect(html).toContain("creation-music-song-card");
    });

    test("历史记录回放即使遗留了「图片已生成」占位文案，也会回退为用户提示词摘要", () => {
        const promptMessage: CreationMessage = {
            id: "user-1",
            role: "user",
            mode: "music",
            content: "深夜雨声与钢琴旋律\n轻柔氛围感",
            createdAt: at,
        };
        const legacyAssistant: CreationMessage = {
            id: "assistant-1",
            role: "assistant",
            mode: "music",
            content: "图片已生成",
            createdAt: at,
            status: "done",
        };

        const title = resolveCreationMusicTitle(legacyAssistant, promptMessage, "AI 生成音乐");
        expect(title).toBe("深夜雨声与钢琴旋律");
        expect(title).not.toBe("图片已生成");
    });

    test("historyMessagePayload 保留音乐设置字段以避免同步后丢失标题和参数", () => {
        const message: CreationMessage = {
            id: "assistant-2",
            role: "assistant",
            mode: "music",
            content: "音乐已生成",
            createdAt: at,
            status: "done",
            settings: {
                ratio: "1:1",
                seconds: "180",
                quality: "auto",
                videoQuality: "720",
                count: "1",
                title: "赛博城市序曲",
                duration: "180",
                instrumental: true,
                model: "CHANNEL_000002::suno-v6",
            },
        };

        const payload = historyMessagePayload(message);
        expect(payload.settings).toEqual({
            ratio: "1:1",
            seconds: "180",
            quality: "auto",
            videoQuality: "720",
            count: "1",
            title: "赛博城市序曲",
            duration: "180",
            instrumental: true,
            model: "CHANNEL_000002::suno-v6",
        });
    });

    test("reconcileCreationTaskMessages 收敛音乐任务终态时写入「音乐已生成」而非「图片已生成」", () => {
        const conversations: CreationConversation[] = [
            {
                id: "conv-1",
                title: "音乐测试",
                updatedAt: at,
                messages: [
                    {
                        id: "assistant-pending",
                        role: "assistant",
                        mode: "music",
                        content: "",
                        createdAt: at,
                        status: "pending",
                        taskIds: ["task-music-1"],
                    },
                ],
            },
        ];

        const runtime = {
            recoverCreationTextTask: () => null,
        } as unknown as typeof import("@/pages/create/creation-runtime");

        const next = reconcileCreationTaskMessages(runtime, conversations, [
            {
                id: "task-music-1",
                type: "audio",
                status: "succeeded",
                prompt: "测试音乐",
                attempts: 1,
                createdAt: at,
                updatedAt: at,
                creationResultUrls: ["https://cdn.example.com/song.mp3"],
                creationResultStorageKeys: ["resource:song-1"],
            },
        ]);

        expect(next).not.toBe(conversations);
        expect(next[0].messages[0].status).toBe("done");
        expect(next[0].messages[0].content).toBe("音乐已生成");
    });

    test("CreationMediaPending 在音乐模式下不再强制 16/6 比例而是保持紧凑卡片尺寸", () => {
        const html = renderToStaticMarkup(
            <CreationMediaPending
                item={{
                    id: "pending-music-1",
                    role: "assistant",
                    mode: "music",
                    content: "",
                    createdAt: at,
                    status: "pending",
                    taskIds: ["task-pending-1"],
                    settings: {
                        ratio: "1:1",
                        seconds: "120",
                        quality: "auto",
                        videoQuality: "720",
                        count: "1",
                        duration: "120",
                        instrumental: true,
                    },
                }}
                refreshing={false}
                onRefresh={() => {}}
                onRetry={() => {}}
            />,
        );

        expect(html).toContain("creation-media-pending is-music");
        expect(html).not.toContain("aspect-ratio:16/6");
        expect(html).not.toContain("create.mode.music");
        expect(html).toContain("音乐");
        expect(html).toContain("120 秒");
        expect(html).toContain("纯音乐");
    });
});
