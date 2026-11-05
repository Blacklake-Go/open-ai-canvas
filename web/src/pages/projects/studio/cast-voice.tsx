import { creationOptions as _creationOptions } from "@/supdance/plugins/i18n/creation-text";
import { creationText as _creationText, useCreationLocale as _useCreationLocale } from "@/supdance/plugins/i18n/creation-text";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Select } from "antd";
import { Mic, Pause, Play, Square, Upload, X } from "lucide-react";

import { useVoiceRecording } from "@/hooks/use-voice-recording";
import { clearDramaCastVoice, setDramaCastVoice, type DramaCast } from "@/services/api/drama";
import { listVoiceProfiles } from "@/services/api/projects";
import { getResourceAccess, resolveResourceAccessURL, resourceStorageKey, uploadResourceFile } from "@/services/api/resources";

const VOICE_PROFILES_KEY = ["voice-profiles"] as const;
const MAX_SAMPLE_BYTES = 20 * 1024 * 1024;
const MAX_RECORD_SECONDS = 30;
const AUDIO_ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/flac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.webm";

/** 试听服务端的声音样本；换样本或卸载时停止播放。 */
function useSamplePlayer(resourceId: string) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);
    useEffect(() => () => audioRef.current?.pause(), []);
    useEffect(() => {
        audioRef.current?.pause();
        setPlaying(false);
    }, [resourceId]);
    const toggle = async () => {
        if (!resourceId) return;
        const audio = audioRef.current || (audioRef.current = new Audio());
        if (playing) {
            audio.pause();
            setPlaying(false);
            return;
        }
        setPlaying(true);
        try {
            audio.src = resolveResourceAccessURL((await getResourceAccess(resourceStorageKey(resourceId), "display", "playback")).url);
            audio.onended = () => setPlaying(false);
            await audio.play();
        } catch {
            setPlaying(false);
        }
    };
    return { playing, toggle };
}

/**
 * 角色声音：从声音库选一条带样本的声音，或上传 / 录制一段角色的声音。视频模型支持参考音频时，
 * 该角色开口的剧情段会带上这段样本；不支持时按声线描述生成。造型沿用所属角色的声音。
 */
export function CastVoiceField({ projectId, cast, restyle, onChanged }: { projectId: string; cast: DramaCast; restyle: boolean; onChanged: () => void }) {
    _useCreationLocale();
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const fileRef = useRef<HTMLInputElement>(null);
    const profilesQuery = useQuery({ queryKey: VOICE_PROFILES_KEY, queryFn: listVoiceProfiles, staleTime: 60_000 });
    // 只有带样本音频的声音能随视频请求发送；只有音色名的内置声音不列出。
    const profiles = (profilesQuery.data?.profiles || []).filter((profile) => profile.status === "active" && profile.sampleResourceId);
    const current = profiles.find((profile) => profile.id === cast.voiceProfileId);
    const sampleId = cast.voiceSampleResourceId || "";
    const player = useSamplePlayer(sampleId);
    // 录音 Hook 到达上限时只停止录制、不交出音频，所以上限由这里在录音仍在进行时主动结束（见下方 effect）。
    const recorder = useVoiceRecording({ maxDuration: MAX_RECORD_SECONDS * 20 });
    const finishingRef = useRef(false);
    const done = (result: { affectedSegments: number }, text: string) => {
        message.success(result.affectedSegments ? _creationText("creation.a0e033aeda422328", { value1: text, value2: result.affectedSegments }) : text);
        void queryClient.invalidateQueries({ queryKey: VOICE_PROFILES_KEY });
        onChanged();
    };
    const bind = useMutation({
        mutationFn: (input: { voiceProfileId?: string; sampleResourceId?: string; voiceName?: string }) => setDramaCastVoice(projectId, cast.id, { ...input, restyleSegments: restyle }),
        onSuccess: (result) => done(result, "已指定角色声音"),
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("creation.4f2e8764f6a34415")),
    });
    const upload = useMutation({
        mutationFn: async ({ file, name }: { file: Blob; name: string }) => {
            const resource = await uploadResourceFile(file, "audio", { fileName: name });
            return setDramaCastVoice(projectId, cast.id, { sampleResourceId: resource.id, voiceName: name.replace(/\.[^.]+$/, "").slice(0, 60), restyleSegments: restyle });
        },
        onSuccess: (result) => done(result, "已上传并指定角色声音"),
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("workbench.upload_failed")),
    });
    const clear = useMutation({
        mutationFn: () => clearDramaCastVoice(projectId, cast.id, restyle),
        onSuccess: (result) => done(result, "已清除角色声音，按声线描述生成"),
        onError: (error) => message.error(error instanceof Error ? error.message : _creationText("creation.2952f485318530a1")),
    });
    const busy = bind.isPending || upload.isPending || clear.isPending;
    const recording = recorder.state !== "idle";
    const finishRecording = async () => {
        if (finishingRef.current) return;
        finishingRef.current = true;
        try {
            const blob = await recorder.stop();
            if (!blob || !blob.size) {
                message.warning(_creationText("creation.be6854322e9c5981"));
                return;
            }
            const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
            upload.mutate({ file: blob, name: `${cast.name}录音.${extension}` });
        } finally {
            finishingRef.current = false;
        }
    };
    useEffect(() => {
        if (recorder.state === "recording" && recorder.duration >= MAX_RECORD_SECONDS) void finishRecording();
        // finishRecording 每次渲染都是新函数；只在时长到达上限时触发一次。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recorder.duration, recorder.state]);
    return (
        <div className="drama-voice">
            <div className="drama-voice-current">
                <button
                    type="button"
                    className="drama-voice-play"
                    disabled={!sampleId}
                    aria-label={
                        sampleId ? _creationText("creation.06ed4c79d7485872", { value1: player.playing ? _creationText("projects.pause") : _creationText("creation.7f0a0fda741c6220"), value2: cast.name }) : _creationText("creation.2e9c1c59a0117016")
                    }
                    onClick={() => void player.toggle()}
                >
                    {player.playing ? <Pause className="size-3.5" /> : sampleId ? <Play className="size-3.5" /> : <Mic className="size-3.5" />}
                </button>
                <span className="min-w-0 flex-1 truncate">{sampleId ? current?.name || _creationText("creation.486393489a67f8a6") : _creationText("creation.d5d118f45b2b4ef9")}</span>
                {sampleId ? <Button size="small" type="text" icon={<X className="size-3.5" />} loading={clear.isPending} disabled={busy && !clear.isPending} aria-label={_creationText("creation.14fae34ebb044e6b")} onClick={() => clear.mutate()} /> : null}
            </div>
            {recording ? (
                <div className="drama-voice-recording" role="status">
                    <span className="drama-voice-dot" aria-hidden="true" />
                    {_creationText("creation.5254d30be60fcb12")}
                    {Math.floor(recorder.duration)} / {MAX_RECORD_SECONDS}
                    {_creationText("settings.per_second")}
                    <span className="flex-1" />
                    <Button size="small" onClick={() => recorder.cancel()}>
                        {_creationText("common.cancel")}
                    </Button>
                    <Button size="small" type="primary" icon={<Square className="size-3" />} onClick={() => void finishRecording()}>
                        {_creationText("settings.channel_complete_btn")}
                    </Button>
                </div>
            ) : (
                <div className="drama-voice-actions">
                    <Select
                        size="small"
                        className="min-w-0 flex-1"
                        value={current?.id ?? null}
                        placeholder={profilesQuery.isLoading ? _creationText("creation.4170a7cf98224ef9") : profiles.length ? _creationText("creation.18adb3e9a3baa419") : _creationText("creation.9a2281147703ccf2")}
                        options={_creationOptions(profiles.map((profile) => ({ value: profile.id, label: profile.name })))}
                        disabled={busy || !profiles.length}
                        showSearch
                        optionFilterProp="label"
                        aria-label={_creationText("creation.18adb3e9a3baa419")}
                        onChange={(id: string | null) => {
                            if (id && id !== cast.voiceProfileId) bind.mutate({ voiceProfileId: id });
                        }}
                    />
                    <Button size="small" icon={<Upload className="size-3.5" />} loading={upload.isPending} disabled={busy && !upload.isPending} onClick={() => fileRef.current?.click()}>
                        {_creationText("common.upload")}
                    </Button>
                    <Button
                        size="small"
                        icon={<Mic className="size-3.5" />}
                        disabled={busy}
                        onClick={() =>
                            void recorder.start().catch(() => {
                                message.error(_creationText("creation.6b451de440652e5a"));
                            })
                        }
                    >
                        {_creationText("creation.4b6ef790032f7a87")}
                    </Button>
                </div>
            )}
            {recorder.error ? <p className="drama-voice-error">{recorder.error}</p> : null}
            <input
                ref={fileRef}
                type="file"
                accept={AUDIO_ACCEPT}
                className="hidden"
                aria-label={_creationText("creation.e338829ea31a64b1", { value1: cast.name })}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (file.size > MAX_SAMPLE_BYTES) {
                        message.warning(_creationText("creation.4264cd4d15f156cc"));
                        return;
                    }
                    upload.mutate({ file, name: file.name });
                }}
            />
        </div>
    );
}
