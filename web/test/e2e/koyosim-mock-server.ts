/**
 * Koyosim Mock Server & Fixtures
 * 
 * Simulates the fixed external API https://www.koyosim.com
 * Supports:
 * - 4 target models: Mureka V9.5, Suno v6, Google Lyria 3.5, Eleven Music v2.5
 * - Non-billing connection probe: GET /v1/ping
 * - Model capabilities discovery: GET /v1/models
 * - Asynchronous task generation: POST /v1/audio/music/generate
 * - Polling lifecycle state machine: GET /v1/audio/music/tasks/:id
 *   (submitted -> queued -> generating -> transcoding -> completed / failed)
 * - Authentic binary audio headers: MP3 (ID3v2), WAV (RIFF/WAVE), FLAC (fLaC)
 * - HMAC SHA-256 signed webhooks
 * - Configurable error injection: 400, 401, 429, 504, connection drops, SSRF redirects
 */

import { createHmac } from "node:crypto";

export const KOYOSIM_API_BASE_URL = "https://www.koyosim.com";
export const MOCK_VALID_API_KEY = "koyo_sec_live_9988aabbccddee0011223344";
export const MOCK_WEBHOOK_SECRET = "whsec_koyosim_secret_test_key_8848";

export type KoyosimModelId = "mureka-9.5" | "suno-v6" | "lyria-3.5" | "music_v2_5";

export type KoyosimTaskStage = "submitted" | "queued" | "generating" | "transcoding" | "completed" | "failed";

export type AudioFormat = "mp3" | "wav" | "flac";

export interface KoyosimModelSpec {
    id: KoyosimModelId;
    name: string;
    version: string;
    modes: ("simple" | "custom")[];
    minDuration: number;
    maxDuration: number;
    formats: AudioFormat[];
    maxPromptChars: number;
    maxLyricsChars: number;
    costPerSecondMicrocredits: number;
    vocalGenders?: ("male" | "female" | "auto")[];
    stemSeparation: boolean;
    supportedStems?: ("vocals" | "drums" | "bass" | "other")[];
    tempoBpmRange?: [number, number];
    keySignatures?: string[];
    synthIdWatermarking?: boolean;
    continuationSupported?: boolean;
    highFidelityVocal?: boolean;
}

export const KOYOSIM_MODELS: Record<KoyosimModelId, KoyosimModelSpec> = {
    "mureka-9.5": {
        id: "mureka-9.5",
        name: "Mureka V9.5",
        version: "9.5.2",
        modes: ["simple", "custom"],
        minDuration: 30,
        maxDuration: 300,
        formats: ["mp3", "wav", "flac"],
        maxPromptChars: 2000,
        maxLyricsChars: 5000,
        costPerSecondMicrocredits: 50,
        vocalGenders: ["male", "female", "auto"],
        stemSeparation: false,
    },
    "suno-v6": {
        id: "suno-v6",
        name: "Suno v6",
        version: "6.0.1",
        modes: ["simple", "custom"],
        minDuration: 15,
        maxDuration: 240,
        formats: ["mp3", "wav"],
        maxPromptChars: 1500,
        maxLyricsChars: 3000,
        costPerSecondMicrocredits: 60,
        continuationSupported: true,
        stemSeparation: false,
    },
    "lyria-3.5": {
        id: "lyria-3.5",
        name: "Google Lyria 3.5",
        version: "3.5.0",
        modes: ["simple", "custom"],
        minDuration: 10,
        maxDuration: 180,
        formats: ["mp3", "wav", "flac"],
        maxPromptChars: 1000,
        maxLyricsChars: 2000,
        costPerSecondMicrocredits: 80,
        tempoBpmRange: [40, 240],
        keySignatures: ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B", "F# Minor", "A Minor", "D Minor"],
        synthIdWatermarking: true,
        stemSeparation: false,
    },
    "music_v2_5": {
        id: "music_v2_5",
        name: "Eleven Music v2.5",
        version: "2.5.4",
        modes: ["custom"],
        minDuration: 30,
        maxDuration: 240,
        formats: ["mp3", "wav", "flac"],
        maxPromptChars: 1000,
        maxLyricsChars: 4000,
        costPerSecondMicrocredits: 100,
        highFidelityVocal: true,
        stemSeparation: true,
        supportedStems: ["vocals", "drums", "bass", "other"],
    },
};

export interface KoyosimGenerateRequest {
    model: KoyosimModelId;
    mode: "simple" | "custom";
    prompt: string;
    title?: string;
    lyrics?: string;
    instrumental?: boolean;
    duration?: number;
    format?: AudioFormat;
    vocalGender?: "male" | "female" | "auto";
    tempoBpm?: number;
    keySignature?: string;
    synthIdWatermark?: boolean;
    stems?: ("vocals" | "drums" | "bass" | "other")[];
    continuationClipId?: string;
    idempotencyNonce?: string;
}

export interface KoyosimTaskRecord {
    id: string;
    model: KoyosimModelId;
    mode: "simple" | "custom";
    prompt: string;
    title: string;
    lyrics?: string;
    instrumental: boolean;
    requestedDuration: number;
    actualDuration: number;
    format: AudioFormat;
    stemsRequested?: string[];
    synthIdWatermarked: boolean;
    stage: KoyosimTaskStage;
    pollCount: number;
    createdAt: number;
    updatedAt: number;
    audioUrl?: string;
    audioFormats?: Record<AudioFormat, string>;
    stemUrls?: Record<string, string>;
    errorReason?: string;
    failAtStage?: KoyosimTaskStage;
}

export type SimulatedErrorType =
    | "400_bad_request"
    | "401_unauthorized"
    | "429_rate_limit"
    | "504_timeout"
    | "connection_drop"
    | "ssrf_redirect"
    | null;

export class KoyosimMockServer {
    private tasks = new Map<string, KoyosimTaskRecord>();
    private idempotencyMap = new Map<string, string>();
    private errorInjection: SimulatedErrorType = null;
    private autoAdvanceStage = true;
    public totalBilledMicrocredits = 0;
    public pingCount = 0;
    public webhookSecret = MOCK_WEBHOOK_SECRET;

    constructor() {
        this.reset();
    }

    public reset(): void {
        this.tasks.clear();
        this.idempotencyMap.clear();
        this.errorInjection = null;
        this.autoAdvanceStage = true;
        this.totalBilledMicrocredits = 0;
        this.pingCount = 0;
    }

    public setSimulatedError(error: SimulatedErrorType): void {
        this.errorInjection = error;
    }

    public setAutoAdvanceStage(auto: boolean): void {
        this.autoAdvanceStage = auto;
    }

    public setTaskStage(taskId: string, stage: KoyosimTaskStage): void {
        const task = this.tasks.get(taskId);
        if (task) {
            task.stage = stage;
            task.updatedAt = Date.now();
            if (stage === "completed" && !task.audioUrl) {
                this.finalizeTask(task);
            }
        }
    }

    /**
     * Synthesizes binary audio buffer with authentic container magic headers.
     */
    public static createAudioBuffer(format: AudioFormat, durationSeconds: number = 30): Uint8Array {
        if (format === "mp3") {
            // Authentic ID3v2.4 Header + MPEG-1 Layer 3 Sync Word
            // ID3v2 header: 'ID3', version 4.0, flags 0, synchsafe size 10 bytes
            const header = [
                0x49, 0x44, 0x33, // 'I', 'D', '3'
                0x04, 0x00,       // Version 2.4
                0x00,             // Flags
                0x00, 0x00, 0x00, 0x0a, // Synchsafe header size (10 bytes)
                // ID3 dummy tag bytes (10 bytes)
                0x54, 0x49, 0x54, 0x32, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00,
                // MPEG Frame Sync (11 bits set = 0xFF 0xFB for MPEG-1 Layer 3, 128kbps, 44100Hz)
                0xff, 0xfb, 0x90, 0x64,
            ];
            const payload = new Uint8Array(256);
            payload.set(header, 0);
            return payload;
        }

        if (format === "wav") {
            // Authentic RIFF / WAVE format header
            const buffer = new ArrayBuffer(44 + 128);
            const view = new DataView(buffer);
            // 'RIFF' chunk descriptor
            view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46); // 'RIFF'
            view.setUint32(4, 36 + 128, true); // ChunkSize
            view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45); // 'WAVE'
            // 'fmt ' sub-chunk
            view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20); // 'fmt '
            view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
            view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
            view.setUint16(22, 2, true); // NumChannels (2 = Stereo)
            view.setUint32(24, 44100, true); // SampleRate
            view.setUint32(28, 44100 * 2 * 2, true); // ByteRate
            view.setUint16(32, 4, true); // BlockAlign
            view.setUint16(34, 16, true); // BitsPerSample
            // 'data' sub-chunk
            view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61); // 'data'
            view.setUint32(40, 128, true); // Subchunk2Size
            return new Uint8Array(buffer);
        }

        if (format === "flac") {
            // Authentic FLAC 4-byte stream marker 'fLaC' + STREAMINFO metadata block
            const header = [
                0x66, 0x4c, 0x61, 0x43, // 'f', 'L', 'a', 'C'
                0x80,                   // Last metadata block flag (1) + block type (0 = STREAMINFO)
                0x00, 0x00, 0x22,       // Block length (34 bytes for STREAMINFO)
                // STREAMINFO block data (34 bytes)
                0x10, 0x00, 0x10, 0x00, // Min/max block size
                0x00, 0x00, 0x00, 0x00, // Min frame size
                0x00, 0x00, 0x00, 0x00, // Max frame size
                0x0a, 0xc4, 0x42, 0xf0, // Sample rate (44100), channels (2), bps (16)
                0x00, 0x00, 0x01, 0x00, // Total samples
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            ];
            const payload = new Uint8Array(128);
            payload.set(header, 0);
            return payload;
        }

        throw new Error(`Unsupported audio format: ${format}`);
    }

    /**
     * Dispatch an opaque-box HTTP request through the Koyosim Mock Server.
     */
    public async handleRequest(url: string, init: RequestInit = {}): Promise<Response> {
        // Enforce strict Base URL verification
        if (!url.startsWith(KOYOSIM_API_BASE_URL)) {
            return new Response(JSON.stringify({
                code: 40301,
                error: "forbidden_origin",
                message: `Egress violation: Requests must target ${KOYOSIM_API_BASE_URL}`,
            }), { status: 403, headers: { "Content-Type": "application/json" } });
        }

        // Check for simulated errors
        if (this.errorInjection === "connection_drop") {
            throw new TypeError("fetch failed: connection reset by peer");
        }
        if (this.errorInjection === "504_timeout") {
            return new Response(JSON.stringify({
                code: 50401,
                error: "gateway_timeout",
                message: "Upstream Koyosim inference cluster timed out",
            }), { status: 504, headers: { "Content-Type": "application/json" } });
        }
        if (this.errorInjection === "429_rate_limit") {
            return new Response(JSON.stringify({
                code: 42901,
                error: "rate_limited",
                message: "Koyosim concurrency limit reached. Please backoff.",
            }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "10" } });
        }
        if (this.errorInjection === "ssrf_redirect") {
            return new Response(null, {
                status: 302,
                headers: { Location: "http://169.254.169.254/latest/meta-data/" },
            });
        }

        // Authorization check
        const authHeader = (init.headers as Record<string, string>)?.["Authorization"] ||
            (init.headers as Record<string, string>)?.["authorization"];
        
        if (this.errorInjection === "401_unauthorized" || !authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== MOCK_VALID_API_KEY) {
            return new Response(JSON.stringify({
                code: 40101,
                error: "unauthorized",
                message: "Missing or invalid Koyosim API Bearer token",
            }), { status: 401, headers: { "Content-Type": "application/json" } });
        }

        const path = url.slice(KOYOSIM_API_BASE_URL.length);
        const method = (init.method || "GET").toUpperCase();

        // 1. GET /v1/ping (Non-billing connection probe)
        if (method === "GET" && path === "/v1/ping") {
            this.pingCount++;
            return new Response(JSON.stringify({
                code: 0,
                status: "healthy",
                timestamp: Date.now(),
                billed: false,
                costMicrocredits: 0,
                version: "2026.10.koyosim-core",
            }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // 2. GET /v1/models (Catalog and dynamic capability discovery)
        if (method === "GET" && path === "/v1/models") {
            return new Response(JSON.stringify({
                code: 0,
                data: Object.values(KOYOSIM_MODELS),
                msg: "ok",
            }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // 3. POST /v1/audio/music/generate (Create asynchronous generation task)
        if (method === "POST" && path === "/v1/audio/music/generate") {
            if (this.errorInjection === "400_bad_request") {
                return new Response(JSON.stringify({
                    code: 40001,
                    error: "bad_request",
                    message: "Simulated invalid request parameter",
                }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            const body: KoyosimGenerateRequest = JSON.parse((init.body as string) || "{}");

            // Idempotency check
            if (body.idempotencyNonce && this.idempotencyMap.has(body.idempotencyNonce)) {
                const existingId = this.idempotencyMap.get(body.idempotencyNonce)!;
                const existingTask = this.tasks.get(existingId)!;
                return new Response(JSON.stringify({
                    code: 0,
                    data: {
                        task_id: existingTask.id,
                        status: existingTask.stage,
                        idempotent_replay: true,
                    },
                    msg: "ok",
                }), { status: 200, headers: { "Content-Type": "application/json" } });
            }

            // Model existence & validation
            const spec = KOYOSIM_MODELS[body.model];
            if (!spec) {
                return new Response(JSON.stringify({
                    code: 40002,
                    error: "unsupported_model",
                    message: `Model '${body.model}' is not supported by Koyosim`,
                }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            // Mode validation
            if (!spec.modes.includes(body.mode)) {
                return new Response(JSON.stringify({
                    code: 40003,
                    error: "unsupported_mode",
                    message: `Mode '${body.mode}' is not supported by model '${body.model}'`,
                }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            // Prompt length validation
            if (!body.prompt || body.prompt.trim().length === 0) {
                return new Response(JSON.stringify({
                    code: 40004,
                    error: "empty_prompt",
                    message: "Generation prompt cannot be empty",
                }), { status: 400, headers: { "Content-Type": "application/json" } });
            }
            if (body.prompt.length > spec.maxPromptChars) {
                return new Response(JSON.stringify({
                    code: 40005,
                    error: "prompt_too_long",
                    message: `Prompt exceeds maximum length of ${spec.maxPromptChars} characters`,
                }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            // Lyrics length validation
            if (body.lyrics && body.lyrics.length > spec.maxLyricsChars) {
                return new Response(JSON.stringify({
                    code: 40006,
                    error: "lyrics_too_long",
                    message: `Lyrics exceed maximum length of ${spec.maxLyricsChars} characters`,
                }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            // Custom mode requires lyrics if not instrumental
            if (body.mode === "custom" && !body.instrumental && (!body.lyrics || body.lyrics.trim().length === 0)) {
                return new Response(JSON.stringify({
                    code: 40007,
                    error: "lyrics_required",
                    message: "Custom mode vocal generation requires lyrics",
                }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            // Duration boundaries
            const requestedDuration = body.duration ?? 180;
            if (requestedDuration < spec.minDuration || requestedDuration > spec.maxDuration) {
                return new Response(JSON.stringify({
                    code: 40008,
                    error: "invalid_duration",
                    message: `Requested duration ${requestedDuration}s must be between ${spec.minDuration}s and ${spec.maxDuration}s`,
                }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            // Stem separation capability validation
            if (body.stems && body.stems.length > 0) {
                if (!spec.stemSeparation) {
                    return new Response(JSON.stringify({
                        code: 40009,
                        error: "stems_not_supported",
                        message: `Stem separation is not supported on model '${body.model}'`,
                    }), { status: 400, headers: { "Content-Type": "application/json" } });
                }
            }

            // Format validation
            const format = body.format ?? "mp3";
            if (!spec.formats.includes(format)) {
                return new Response(JSON.stringify({
                    code: 40010,
                    error: "unsupported_format",
                    message: `Audio format '${format}' is not supported by model '${body.model}'`,
                }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            // Create task
            const taskId = `koyo_task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            const task: KoyosimTaskRecord = {
                id: taskId,
                model: body.model,
                mode: body.mode,
                prompt: body.prompt,
                title: body.title || "Untitled Composition",
                lyrics: body.lyrics,
                instrumental: Boolean(body.instrumental),
                requestedDuration,
                actualDuration: requestedDuration,
                format,
                stemsRequested: body.stems,
                synthIdWatermarked: Boolean(body.synthIdWatermark && spec.synthIdWatermarking),
                stage: "submitted",
                pollCount: 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            this.tasks.set(taskId, task);
            if (body.idempotencyNonce) {
                this.idempotencyMap.set(body.idempotencyNonce, taskId);
            }

            return new Response(JSON.stringify({
                code: 0,
                data: {
                    task_id: taskId,
                    status: "submitted",
                    estimated_duration_seconds: requestedDuration,
                    model: body.model,
                    created_at: task.createdAt,
                },
                msg: "ok",
            }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // 4. GET /v1/audio/music/tasks/:id (Poll task lifecycle state)
        if (method === "GET" && path.startsWith("/v1/audio/music/tasks/")) {
            const taskId = path.slice("/v1/audio/music/tasks/".length);
            const task = this.tasks.get(taskId);

            if (!task) {
                return new Response(JSON.stringify({
                    code: 40401,
                    error: "task_not_found",
                    message: `Task '${taskId}' not found on Koyosim`,
                }), { status: 404, headers: { "Content-Type": "application/json" } });
            }

            task.pollCount++;
            task.updatedAt = Date.now();

            // Progress state machine
            if (this.autoAdvanceStage) {
                if (task.failAtStage && task.stage === task.failAtStage) {
                    task.stage = "failed";
                    task.errorReason = task.errorReason || "Deterministic upstream model generation failure";
                } else if (task.stage === "submitted") {
                    task.stage = "queued";
                } else if (task.stage === "queued") {
                    task.stage = "generating";
                } else if (task.stage === "generating") {
                    task.stage = "transcoding";
                } else if (task.stage === "transcoding") {
                    task.stage = "completed";
                    this.finalizeTask(task);
                }
            }

            return new Response(JSON.stringify({
                code: 0,
                data: {
                    task_id: task.id,
                    model: task.model,
                    mode: task.mode,
                    stage: task.stage,
                    poll_count: task.pollCount,
                    duration: task.actualDuration,
                    audio_url: task.audioUrl,
                    audio_formats: task.audioFormats,
                    stems: task.stemUrls,
                    synth_id_watermarked: task.synthIdWatermarked,
                    error_reason: task.errorReason,
                    updated_at: task.updatedAt,
                },
                msg: "ok",
            }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

        // 5. GET /v1/audio/music/artifacts/:filename (Download binary audio)
        if (method === "GET" && path.startsWith("/v1/audio/music/artifacts/")) {
            const filename = path.slice("/v1/audio/music/artifacts/".length);
            const ext = filename.split(".").pop() as AudioFormat;

            if (!["mp3", "wav", "flac"].includes(ext)) {
                return new Response("Unsupported format", { status: 400 });
            }

            const binary = KoyosimMockServer.createAudioBuffer(ext);
            const contentTypes: Record<AudioFormat, string> = {
                mp3: "audio/mpeg",
                wav: "audio/wav",
                flac: "audio/flac",
            };

            return new Response(binary, {
                status: 200,
                headers: {
                    "Content-Type": contentTypes[ext],
                    "Content-Disposition": `attachment; filename="${filename}"`,
                    "Content-Length": binary.byteLength.toString(),
                },
            });
        }

        return new Response(JSON.stringify({
            code: 40400,
            error: "endpoint_not_found",
            message: `Endpoint ${method} ${path} does not exist on Koyosim API`,
        }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    private finalizeTask(task: KoyosimTaskRecord): void {
        const spec = KOYOSIM_MODELS[task.model];
        task.audioUrl = `${KOYOSIM_API_BASE_URL}/v1/audio/music/artifacts/${task.id}.${task.format}`;
        task.audioFormats = {
            mp3: `${KOYOSIM_API_BASE_URL}/v1/audio/music/artifacts/${task.id}.mp3`,
            wav: `${KOYOSIM_API_BASE_URL}/v1/audio/music/artifacts/${task.id}.wav`,
            flac: `${KOYOSIM_API_BASE_URL}/v1/audio/music/artifacts/${task.id}.flac`,
        };

        if (task.stemsRequested && task.stemsRequested.length > 0) {
            task.stemUrls = {};
            for (const stem of task.stemsRequested) {
                task.stemUrls[stem] = `${KOYOSIM_API_BASE_URL}/v1/audio/music/artifacts/${task.id}_stem_${stem}.wav`;
            }
        }

        // Calculate billed microcredits
        const cost = task.actualDuration * spec.costPerSecondMicrocredits;
        this.totalBilledMicrocredits += cost;
    }

    /**
     * Simulates signed webhook dispatch with HMAC SHA-256 header.
     */
    public createSignedWebhookPayload(task: KoyosimTaskRecord): {
        body: string;
        signature: string;
        timestamp: number;
    } {
        const timestamp = Math.floor(Date.now() / 1000);
        const bodyObj = {
            event: "music.task.completed",
            task_id: task.id,
            model: task.model,
            stage: task.stage,
            audio_url: task.audioUrl,
            audio_formats: task.audioFormats,
            duration: task.actualDuration,
            timestamp,
        };
        const body = JSON.stringify(bodyObj);
        const signaturePayload = `${timestamp}.${body}`;
        const signature = createHmac("sha256", this.webhookSecret)
            .update(signaturePayload)
            .digest("hex");

        return { body, signature: `t=${timestamp},v1=${signature}`, timestamp };
    }
}
