"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { ToastHost as Toaster } from "../ui";
import { runMotionGraphics } from "../muapi.js";
import { fetchVibeMotionResultUrl, mapServerVibeMotionHistory } from "../generationHistory.js";
import {
  buildPublicVideoParameters,
  findPublicVideoCapability,
  getPublicVideoControlOptions,
} from "../publicGenerationCapabilities.js";
import { formatErrorMessage } from "../utils/formatError.js";
import { scopedPersistKey, migrateLegacyPersistKey } from "../persistKey.js";
import MobileGenerationActions, {
  GenerationCopyButtons,
} from "./MobileGenerationActions.jsx";
import VideoRelayMenu from "./VideoRelayMenu.jsx";

const VIBEMOTION_RELAY_COPY_EN = {
  presetsTitle: "Presets:",
  relayLoadedToast: "Loaded relayed reference video for vibe motion!",
  referenceVideoLabel: "Reference Video",
  clearReference: "Clear reference video",
  referenceUnsupportedNote: "This reference video is displayed for context only; this generation route does not accept video input.",
  presets: [
    {
      id: "dolly",
      label: "Dolly Zoom",
      prompt: "dolly zoom vertigo effect, rapid camera push-in with simultaneous wide perspective expansion, intense dramatic hero focus",
    },
    {
      id: "orbit",
      label: "Orbit 360°",
      prompt: "fluid 360-degree orbiting camera rotation around the subject, seamless panoramic perspective, smooth cinematography",
    },
    {
      id: "fpv",
      label: "FPV Drone",
      prompt: "dynamic high-speed FPV drone dive, swooping through the scene with kinetic motion blur and cinematic rolls",
    },
    {
      id: "crane",
      label: "Crane & Tilt",
      prompt: "grand crane boom camera lifting from low angle to sweeping high angle view, cinematic downward tilt",
    },
    {
      id: "whip",
      label: "Whip Pan",
      prompt: "kinetic whip pan camera transition with motion blur, sudden snap into crisp focus on the key subject",
    },
    {
      id: "vertigo",
      label: "Hitchcock Vertigo",
      prompt: "classic Hitchcock Vertigo camera track, background warping backwards with subject static, psychological tension",
    },
  ],
};

const VIBEMOTION_RELAY_COPY_LOCALES = {
  "zh-CN": {
    presetsTitle: "运镜预设:",
    relayLoadedToast: "已自动载入接力参考视频！",
    referenceVideoLabel: "参考源视频",
    clearReference: "移除参考视频",
    referenceUnsupportedNote: "当前仅展示参考视频；此生成路由尚未声明支持视频输入。",
    presets: [
      { id: "dolly", label: "推拉变焦 (Dolly Zoom)", prompt: "dolly zoom vertigo effect, rapid camera push-in with simultaneous wide perspective expansion, intense dramatic hero focus" },
      { id: "orbit", label: "360° 环绕 (Orbit 360°)", prompt: "fluid 360-degree orbiting camera rotation around the subject, seamless panoramic perspective, smooth cinematography" },
      { id: "fpv", label: "FPV 穿梭 (FPV Drone)", prompt: "dynamic high-speed FPV drone dive, swooping through the scene with kinetic motion blur and cinematic rolls" },
      { id: "crane", label: "升降仰俯 (Crane & Tilt)", prompt: "grand crane boom camera lifting from low angle to sweeping high angle view, cinematic downward tilt" },
      { id: "whip", label: "极速甩镜 (Whip Pan)", prompt: "kinetic whip pan camera transition with motion blur, sudden snap into crisp focus on the key subject" },
      { id: "vertigo", label: "希区柯克眩晕 (Vertigo)", prompt: "classic Hitchcock Vertigo camera track, background warping backwards with subject static, psychological tension" },
    ],
  },
  "ja-JP": {
    presetsTitle: "カメラプリセット:",
    relayLoadedToast: "連携された参照動画を読み込みました！",
    referenceVideoLabel: "参照動画",
    clearReference: "参照動画をクリア",
    referenceUnsupportedNote: "参照動画は表示のみです。この生成ルートは動画入力を受け付けません。",
    presets: [
      { id: "dolly", label: "ドリーズーム (Dolly Zoom)", prompt: "dolly zoom vertigo effect, rapid camera push-in with simultaneous wide perspective expansion, intense dramatic hero focus" },
      { id: "orbit", label: "360° 周回 (Orbit 360°)", prompt: "fluid 360-degree orbiting camera rotation around the subject, seamless panoramic perspective, smooth cinematography" },
      { id: "fpv", label: "FPV ドローン (FPV Drone)", prompt: "dynamic high-speed FPV drone dive, swooping through the scene with kinetic motion blur and cinematic rolls" },
      { id: "crane", label: "クレーン昇降 (Crane & Tilt)", prompt: "grand crane boom camera lifting from low angle to sweeping high angle view, cinematic downward tilt" },
      { id: "whip", label: "ホイップパン (Whip Pan)", prompt: "kinetic whip pan camera transition with motion blur, sudden snap into crisp focus on the key subject" },
      { id: "vertigo", label: "めまい効果 (Vertigo)", prompt: "classic Hitchcock Vertigo camera track, background warping backwards with subject static, psychological tension" },
    ],
  },
  "ko-KR": {
    presetsTitle: "무빙 프리셋:",
    relayLoadedToast: "연동된 참조 영상을 불러왔습니다!",
    referenceVideoLabel: "참조 영상",
    clearReference: "참조 영상 지우기",
    referenceUnsupportedNote: "참조 영상은 표시만 됩니다. 이 생성 경로는 동영상 입력을 지원하지 않습니다.",
    presets: [
      { id: "dolly", label: "돌리 줌 (Dolly Zoom)", prompt: "dolly zoom vertigo effect, rapid camera push-in with simultaneous wide perspective expansion, intense dramatic hero focus" },
      { id: "orbit", label: "360° 회전 (Orbit 360°)", prompt: "fluid 360-degree orbiting camera rotation around the subject, seamless panoramic perspective, smooth cinematography" },
      { id: "fpv", label: "FPV 드론 (FPV Drone)", prompt: "dynamic high-speed FPV drone dive, swooping through the scene with kinetic motion blur and cinematic rolls" },
      { id: "crane", label: "크레인 & 틸트 (Crane & Tilt)", prompt: "grand crane boom camera lifting from low angle to sweeping high angle view, cinematic downward tilt" },
      { id: "whip", label: "휩 팬 (Whip Pan)", prompt: "kinetic whip pan camera transition with motion blur, sudden snap into crisp focus on the key subject" },
      { id: "vertigo", label: "버티고 효과 (Vertigo)", prompt: "classic Hitchcock Vertigo camera track, background warping backwards with subject static, psychological tension" },
    ],
  },
  "zh-TW": {
    presetsTitle: "運鏡預設:",
    relayLoadedToast: "已自動載入接力參考影片！",
    referenceVideoLabel: "參考源影片",
    clearReference: "移除參考影片",
    referenceUnsupportedNote: "目前只會顯示參考影片；此生成路由尚未宣告支援影片輸入。",
    presets: [
      { id: "dolly", label: "推拉變焦 (Dolly Zoom)", prompt: "dolly zoom vertigo effect, rapid camera push-in with simultaneous wide perspective expansion, intense dramatic hero focus" },
      { id: "orbit", label: "360° 環繞 (Orbit 360°)", prompt: "fluid 360-degree orbiting camera rotation around the subject, seamless panoramic perspective, smooth cinematography" },
      { id: "fpv", label: "FPV 穿梭 (FPV Drone)", prompt: "dynamic high-speed FPV drone dive, swooping through the scene with kinetic motion blur and cinematic rolls" },
      { id: "crane", label: "升降仰俯 (Crane & Tilt)", prompt: "grand crane boom camera lifting from low angle to sweeping high angle view, cinematic downward tilt" },
      { id: "whip", label: "極速甩鏡 (Whip Pan)", prompt: "kinetic whip pan camera transition with motion blur, sudden snap into crisp focus on the key subject" },
      { id: "vertigo", label: "希區考克眩暈 (Vertigo)", prompt: "classic Hitchcock Vertigo camera track, background warping backwards with subject static, psychological tension" },
    ],
  },
  "es": {
    presetsTitle: "Ajustes de movimiento:",
    relayLoadedToast: "¡Video de referencia recibido cargado!",
    referenceVideoLabel: "Video de referencia",
    clearReference: "Quitar video de referencia",
    referenceUnsupportedNote: "El video de referencia solo se muestra; esta ruta no acepta entradas de video.",
    presets: [
      { id: "dolly", label: "Dolly Zoom", prompt: "dolly zoom vertigo effect, rapid camera push-in with simultaneous wide perspective expansion, intense dramatic hero focus" },
      { id: "orbit", label: "Órbita 360°", prompt: "fluid 360-degree orbiting camera rotation around the subject, seamless panoramic perspective, smooth cinematography" },
      { id: "fpv", label: "Dron FPV", prompt: "dynamic high-speed FPV drone dive, swooping through the scene with kinetic motion blur and cinematic rolls" },
      { id: "crane", label: "Grúa e Inclinación", prompt: "grand crane boom camera lifting from low angle to sweeping high angle view, cinematic downward tilt" },
      { id: "whip", label: "Barrido Rápido", prompt: "kinetic whip pan camera transition with motion blur, sudden snap into crisp focus on the key subject" },
      { id: "vertigo", label: "Vértigo Hitchcock", prompt: "classic Hitchcock Vertigo camera track, background warping backwards with subject static, psychological tension" },
    ],
  },
};
import {
  PROMPT_CONTROL_LABEL_CLASS,
  PromptAspectRatioIcon,
  PromptAction,
  PromptChevronIcon,
  PromptComposer,
  PromptControls,
  PromptFooter,
  PromptMenuItem,
  PromptMenuList,
  PromptPopover,
  PromptPopoverHeader,
  PromptDurationIcon,
  PromptSegmentedControl,
  PromptSegmentOption,
  promptControlClassName,
} from "./prompt/PromptComposer.jsx";
import { PromptInputField } from "./prompt/PromptInputField.jsx";
import en from "../messages/en/vibeMotionStudio.json";
import zh from "../messages/zh/vibeMotionStudio.json";
import ja from "../messages/ja-JP/vibeMotionStudio.json";
import ko from "../messages/ko-KR/vibeMotionStudio.json";
import zhTw from "../messages/zh-TW/vibeMotionStudio.json";
import es from "../messages/es/vibeMotionStudio.json";
import { resolveCopy } from "../i18nUtils";

const VIBE_MOTION_MESSAGES = {
  'zh-CN': zh,
  'ja-JP': ja,
  'ko-KR': ko,
  'zh-TW': zhTw,
  es: es,
  'es-ES': es,
};

// ── helpers ───────────────────────────────────────────────────────────────────
async function downloadFile(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

const formatTime = (s) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const isHostedVibeMotion = () =>
  typeof window !== "undefined" && window.location?.protocol?.startsWith("http");

// ── icons ─────────────────────────────────────────────────────────────────────
const CheckSvg = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-brand">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ── Dropdown helper ───────────────────────────────────────────────────────────
function DropdownItem({ label, selected, onClick }) {
  return (
    <PromptMenuItem
      selected={selected}
      onClick={onClick}
    >
      {label}
    </PromptMenuItem>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VibeMotionStudio({
  apiKey,
  initialPrompt = "",
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
  locale = "en",
}) {
  const copy = resolveCopy(en, VIBE_MOTION_MESSAGES, locale);
  const relayCopy = resolveCopy(VIBEMOTION_RELAY_COPY_EN, VIBEMOTION_RELAY_COPY_LOCALES, locale);
  const LEGACY_PERSIST_KEY = "hg_vibe_motion_studio_persistent";
  const PERSIST_KEY = scopedPersistKey(LEGACY_PERSIST_KEY, apiKey);
  useEffect(() => {
    migrateLegacyPersistKey(LEGACY_PERSIST_KEY, PERSIST_KEY);
  }, [PERSIST_KEY]);

  // ── Params ────────────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(initialPrompt || "");
  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState(null);
  const [duration, setDuration] = useState(6);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState("");
  const [videoModels, setVideoModels] = useState([]);
  const [videoModelsLoading, setVideoModelsLoading] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadModels = async () => {
      try {
        const response = await fetch("/api/app/models/available?type=video", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error("Video model directory unavailable");
        const rows = payload?.data?.models;
        const eligible = Array.isArray(rows)
          ? rows.filter((model) => findPublicVideoCapability(model, "t2v"))
          : [];
        if (!controller.signal.aborted) setVideoModels(eligible);
      } catch {
        // Keep the selector empty and generation disabled when the public API fails.
      } finally {
        if (!controller.signal.aborted) setVideoModelsLoading(false);
      }
    };
    loadModels();
    return () => controller.abort();
  }, []);

  const selectedModel = videoModels.find((model) => model.id === selectedModelId) || null;
  const selectedT2vCapability = findPublicVideoCapability(selectedModel, "t2v");
  const {
    aspectRatios: aspectRatioOptions,
    resolutions: resolutionOptions,
    durations: durationOptions,
  } = getPublicVideoControlOptions(selectedT2vCapability);

  // ── Edit mode ─────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [editSourceId, setEditSourceId] = useState(null);  // request_id of source

  // ── Dropdown open state ───────────────────────────────────────────────────
  const [openDropdown, setOpenDropdown] = useState(null); // model/spec/source control
  const controlsRef = useRef(null);
  const textareaRef = useRef(null);

  // ── Generation state ──────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);
  const pendingRequestId = useRef(null);

  // ── History ───────────────────────────────────────────────────────────────
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [fullscreenUrl, setFullscreenUrl] = useState(null);

  // Hosted history is owner-scoped by the server and receives fresh private Asset URLs.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(PERSIST_KEY) || "null"); } catch (_) {}
      if (!Array.isArray(saved) && typeof saved?.prompt === "string" && saved.prompt) {
        setPrompt(saved.prompt);
      }

      if (!isHostedVibeMotion()) {
        const rawHistory = Array.isArray(saved) ? saved : Array.isArray(saved?.history) ? saved.history : [];
        setHistory(rawHistory.map((entry) => ({ ...entry, canEdit: false })));
        setHistoryLoadError(false);
        setHistoryLoading(false);
        return;
      }

      setHistoryLoading(true);
      setHistoryLoadError(false);
      try {
        const response = await fetch("/api/generations?limit=100", {
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`Generation history request failed (${response.status})`);
        const payload = await response.json();
        if (!cancelled) setHistory(mapServerVibeMotionHistory(payload?.creations));
      } catch {
        if (!cancelled) setHistoryLoadError(true);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [PERSIST_KEY]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (isHostedVibeMotion()) {
          localStorage.setItem(PERSIST_KEY, JSON.stringify({ prompt }));
        } else {
          const stripped = history.map(({ canEdit, ...rest }) => rest);
          localStorage.setItem(PERSIST_KEY, JSON.stringify({ history: stripped, prompt }));
        }
      } catch (_) {}
    }, 500);
    return () => clearTimeout(timer);
  }, [PERSIST_KEY, history, prompt]);

  const saveHistory = useCallback((items) => {
    setHistory(items);
    if (isHostedVibeMotion()) return;
    // Strip canEdit from persisted data — it is an in-memory hint only.
    const stripped = items.map(({ canEdit, ...rest }) => rest);
    try { localStorage.setItem(PERSIST_KEY, JSON.stringify({ history: stripped, prompt })); } catch (_) {}
  }, [PERSIST_KEY, prompt]);

  const refreshHostedHistory = useCallback(async () => {
    const response = await fetch("/api/generations?limit=100", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Generation history request failed (${response.status})`);
    const payload = await response.json();
    const rows = mapServerVibeMotionHistory(payload?.creations);
    setHistory(rows);
    setHistoryLoadError(false);
    return rows;
  }, []);

  const resolveEntryUrl = useCallback(async (entry) => {
    if (!isHostedVibeMotion()) return entry?.url;
    return fetchVibeMotionResultUrl(entry?.requestId);
  }, []);

  const openEntry = useCallback(async (entry) => {
    try {
      const url = await resolveEntryUrl(entry);
      if (!url) throw new Error("Generation result is unavailable");
      setFullscreenUrl(url);
    } catch {
      toast.error(copy.history.unavailable);
    }
  }, [copy, resolveEntryUrl]);

  const downloadEntry = useCallback(async (entry, filename) => {
    try {
      const url = await resolveEntryUrl(entry);
      if (!url) throw new Error("Generation result is unavailable");
      await downloadFile(url, filename);
    } catch {
      toast.error(copy.history.downloadUnavailable);
    }
  }, [copy, resolveEntryUrl]);

  // ── Relay Video Listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const relayedVideo = sp.get("video_url");
      if (relayedVideo) {
        setReferenceVideoUrl(relayedVideo);
        toast.success(relayCopy.relayLoadedToast);
      }
    } catch (_) {}

    const handleRelay = (e) => {
      const { videoUrl } = e.detail || {};
      if (videoUrl) {
        setReferenceVideoUrl(videoUrl);
        toast.success(relayCopy.relayLoadedToast);
      }
    };
    window.addEventListener("supdance-relay-video", handleRelay);
    return () => window.removeEventListener("supdance-relay-video", handleRelay);
  }, [relayCopy]);

  // ── Close dropdowns on outside click ─────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (controlsRef.current && !controlsRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  // ── Timer ─────────────────────────────────────────────────────────────────
  const startTimer = () => {
    setElapsedTime(0);
    timerRef.current = setInterval(() => setElapsedTime((t) => t + 1), 1000);
  };
  const stopTimer = () => { clearInterval(timerRef.current); timerRef.current = null; };
  useEffect(() => () => stopTimer(), []);

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating || !selectedModel || !selectedT2vCapability || referenceVideoUrl) return;
    const generationParameters = buildPublicVideoParameters({
      capability: selectedT2vCapability,
      prompt,
      aspectRatio,
      resolution,
      duration,
    });
    if (!generationParameters) return;
    onGenerationStart?.();
    setGenerating(true);
    setGenerateError(null);
    startTimer();
    try {
      const result = await runMotionGraphics(apiKey, {
        modelId: selectedModel.id,
        studioId: "vibemotion",
        ...generationParameters,
        onRequestId: (id) => { pendingRequestId.current = id; },
      });

      const videoUrl = result?.output?.video || result?.url || result?.outputs?.[0];
      const requestId = result?.id || result?.request_id || pendingRequestId.current;

      const entry = {
        id: requestId || Date.now().toString(),
        requestId,
        url: videoUrl,
        prompt: prompt.trim(),
        modelId: selectedModel.id,
        assetId: result?.assetId || result?.asset_id || result?.asset?.id || null,
        aspectRatio,
        resolution,
        duration,
        mode: "generate",
        sourceId: null,
        timestamp: new Date().toISOString(),
        // The current generation response does not include a server-owned Asset reference or a v2v contract.
        canEdit: false,
      };

      const next = [entry, ...history].slice(0, 30);
      saveHistory(next);
      if (isHostedVibeMotion()) {
        refreshHostedHistory().catch(() => {
          // The completed job remains visible for this session if history refresh is temporarily unavailable.
        });
      }
      onGenerationComplete?.({ url: videoUrl, type: "video" });
    } catch (err) {
      // Detect the backend's "animation code not saved" limitation
      const raw = err.message || "";
      const isStaleEdit =
        raw.includes("animation code") ||
        raw.includes("does not have saved") ||
        raw.includes("Original generation does not");

      if (isStaleEdit) {
        console.warn("[VibeMotionStudio] Remix unavailable:", raw.slice(0, 120));
        const msg = copy.errors.staleEditUnavailable;
        if (onGenerationError) onGenerationError(msg);
        else toast.error(msg);
        setEditMode(false);
        setEditSourceId(null);
      } else {
        console.error("[VibeMotionStudio]", err);
        const errMsg = formatErrorMessage(raw || err, copy.errors.generationFailed);
        if (onGenerationError) onGenerationError(errMsg);
        else toast.error(errMsg);
      }
    } finally {
      setGenerating(false);
      stopTimer();
      onGenerationEnd?.();
    }
  }, [
    apiKey,
    prompt,
    selectedModel,
    selectedT2vCapability,
    referenceVideoUrl,
    aspectRatio,
    resolution,
    duration,
    history,
    saveHistory,
    refreshHostedHistory,
    onGenerationComplete,
    onGenerationEnd,
    onGenerationError,
    onGenerationStart,
    copy,
  ]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerate();
  };

  const toggleDropdown = (type) => (e) => {
    e.stopPropagation();
    setOpenDropdown((prev) => (prev === type ? null : type));
  };

  // The platform response currently lacks an owned Asset reference and this studio has no verified v2v input contract.
  const editSources = history.filter((h) => h.canEdit === true && h.assetId && h.modelId);
  const sourceEntry = editSources.find((h) => h.requestId === editSourceId);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-transparent relative overflow-hidden">
      {/* ── Fullscreen overlay ── */}
      {fullscreenUrl && (
        <div
          className="fixed inset-0 z-modal bg-black/95 flex items-center justify-center"
          onClick={() => setFullscreenUrl(null)}
        >
          <video
            src={fullscreenUrl}
            autoPlay loop controls
            className="max-h-[90vh] max-w-[90vw] rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-6 right-6 text-white/60 hover:text-white active:scale-95 active:duration-instant transition-[color,transform] duration-fast ease-standard text-3xl font-light leading-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            onClick={() => setFullscreenUrl(null)}
          >×</button>
        </div>
      )}

      {/* ── GALLERY AREA ── */}
      <div className="flex-1 w-full max-w-7xl mx-auto overflow-y-auto custom-scrollbar pb-40 lg:pb-32 px-2">
        {generating && (
          /* ── Loading card at top of grid ── */
          <div className="w-full pt-6 flex justify-center animate-fade-in">
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-brand/30 animate-spin" />
                <div className="absolute inset-4 rounded-full border-2 border-violet-400/50 animate-[spin_1.5s_linear_infinite_reverse]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400 animate-pulse">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                  </svg>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-white/80 font-semibold text-sm">
                  {editMode ? copy.loading.remixing : copy.loading.generating}
                </span>
                <span className="text-white/30 text-xs">{copy.loading.backend}</span>
              </div>
              <div className="flex items-center gap-2 text-white/30 text-xs bg-white/[0.03] px-4 py-1.5 rounded-full border border-white/[0.05]">
                <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
                  <path d="M12 2a10 10 0 0 1 10 10"/>
                </svg>
                {formatTime(elapsedTime)}
              </div>
            </div>
          </div>
        )}

        {!generating && (history.length > 0 || historyLoading || historyLoadError) ? (
          historyLoading && history.length === 0 ? (
            <p role="status" className="w-full pt-8 text-center text-white/45 text-sm">{copy.history.loading}</p>
          ) : historyLoadError && history.length === 0 ? (
            <p role="status" className="w-full pt-8 text-center text-white/45 text-sm">{copy.history.loadFailed}</p>
          ) : history.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full pt-4 animate-fade-in">
            {history.map((entry, idx) => (
              <div
                key={entry.id || idx}
                className="relative group rounded-2xl overflow-hidden border border-line bg-surface shadow-elevation-2 hover:border-brand-line transition-[border-color,box-shadow] duration-fast ease-standard flex flex-col cursor-pointer"
                onClick={() => openEntry(entry)}
              >
                {/* Video thumbnail */}
                <video
                  src={entry.url}
                  className="w-full aspect-video object-cover bg-black/40 hover:opacity-80 transition-opacity"
                  controls={false}
                  loop
                  muted
                  playsInline
                  onMouseOver={(e) => e.target.play()}
                  onMouseOut={(e) => { e.target.pause(); e.target.currentTime = 0; }}
                />

                {/* ── Mode tag (top-left) ── */}
                <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm border ${
                  entry.mode === "edit"
                    ? "bg-brand/20 text-brand border-brand/30"
                    : "bg-violet-600/30 text-violet-300 border-violet-500/30"
                }`}>
                  {entry.mode === "edit" ? copy.card.modeEdit : copy.card.modeGenerated}
                </div>

                {/* ── Hover overlay actions ── */}
                <div className="pointer-events-none absolute top-2 right-2 hidden flex-col gap-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 md:flex">
                  <GenerationCopyButtons
                    prompt={entry.prompt}
                    onCopyError={onGenerationError}
                  />
                  <button
                    type="button"
                    title={copy.card.download}
                    onClick={(e) => { e.stopPropagation(); downloadEntry(entry, `motion-${entry.id || idx}.mp4`); }}
                    className="p-2 bg-overlay-glass backdrop-blur-md rounded-full text-ink hover:bg-brand hover:text-ink-on-accent active:bg-brand-active active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard border border-line-subtle cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                  </button>
                  <VideoRelayMenu
                    videoUrl={entry.url}
                    currentTab="vibe-motion"
                    locale={locale}
                  />
                  {entry.requestId && entry.canEdit === true ? (
                    <button
                      type="button"
                      title={copy.card.remixThis}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditMode(true);
                        setEditSourceId(entry.requestId);
                        setPrompt("");
                        setTimeout(() => textareaRef.current?.focus(), 50);
                      }}
                      className="p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-brand hover:text-white active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard border border-white/10 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  ) : entry.requestId && entry.canEdit === false ? (
                    /* Legacy generation — animation code not saved by API, remix not available */
                    <div
                      title={copy.card.legacyRemixUnavailable}
                      className="p-2 bg-black/60 backdrop-blur-md rounded-full text-white/20 border border-white/5 cursor-not-allowed"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </div>
                  ) : null}
                  {!isHostedVibeMotion() && <button
                    type="button"
                    title={copy.card.delete}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(copy.card.confirmDelete)) {
                        setHistory(prev => prev.filter((_, i) => i !== idx));
                      }
                    }}
                    className="p-2 bg-black/60 backdrop-blur-md rounded-full text-red-400 hover:bg-red-500 hover:text-white active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard border border-white/10 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>}
                </div>
                <MobileGenerationActions
                  prompt={entry.prompt}
                  onCopyError={onGenerationError}
                  actions={[
                    {
                      kind: "download",
                      label: copy.mobileActions.download,
                      onSelect: () =>
                        downloadEntry(entry, `motion-${entry.id || idx}.mp4`),
                    },
                    entry.requestId &&
                      entry.canEdit === true && {
                        kind: "remix",
                        label: copy.mobileActions.remix,
                        onSelect: () => {
                          setEditMode(true);
                          setEditSourceId(entry.requestId);
                          setPrompt("");
                          setTimeout(() => textareaRef.current?.focus(), 50);
                        },
                      },
                    !isHostedVibeMotion() && {
                      kind: "delete",
                      label: copy.mobileActions.delete,
                      danger: true,
                      onSelect: () => {
                        if (confirm(copy.card.confirmDelete)) {
                          setHistory((prev) => prev.filter((_, i) => i !== idx));
                        }
                      },
                    },
                  ]}
                />

                {/* ── Card footer: prompt + metadata ── */}
                <div className="p-3 bg-black/80 backdrop-blur-sm border-t border-white/5 flex-1 flex flex-col justify-between gap-2">
                  <p className="text-white/70 text-xs line-clamp-3 leading-relaxed" title={entry.prompt}>
                    {entry.prompt || copy.card.noPrompt}
                  </p>
                  <div className="flex items-center justify-between mt-1 flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-brand px-2 py-0.5 bg-brand-soft rounded border border-brand-line whitespace-nowrap">
                        {copy.card.tag}
                      </span>
                      <div className="flex gap-2">
                        {entry.aspectRatio && (
                          <span className="text-[10px] text-white/40">{entry.aspectRatio}</span>
                        )}
                        {entry.resolution && (
                          <span className="text-[10px] text-white/40">{entry.resolution}</span>
                        )}
                        {entry.duration && (
                          <span className="text-[10px] text-white/40">{entry.duration}s</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !generating ? (
          /* ── Empty State ── */
          <div className="flex flex-col items-center justify-center h-full animate-fade-in min-h-[50vh]">
            {/* Overlapping floating cards */}
            <div className="flex items-center justify-center gap-1.5 md:gap-3 mb-10 select-none scale-90 sm:scale-100">
              <div className="w-16 h-20 sm:w-24 sm:h-28 rounded-2xl border border-white/10 shadow-elevation-3 -rotate-[12deg] transform hover:rotate-0 hover:scale-110 hover:z-20 transition-transform duration-fast ease-standard overflow-hidden bg-white/[0.01] flex-shrink-0">
                <img
                  src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/sdxl-image.avif"
                  alt="Creative asset 1"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-16 h-20 sm:w-24 sm:h-28 rounded-2xl border border-white/10 shadow-elevation-3 -rotate-[4deg] transform hover:rotate-0 hover:scale-110 hover:z-20 transition-transform duration-fast ease-standard overflow-hidden bg-white/[0.01] -ml-3 sm:-ml-4 flex-shrink-0">
                <img
                  src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/chroma-image.avif"
                  alt="Creative asset 2"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full border border-white/10 shadow-elevation-3 rotate-[6deg] transform hover:rotate-0 hover:scale-110 hover:z-20 transition-transform duration-fast ease-standard overflow-hidden bg-white/[0.01] -ml-3 sm:-ml-4 flex-shrink-0">
                <img
                  src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/neta-lumina.avif"
                  alt="Creative asset 3"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-16 h-20 sm:w-24 sm:h-28 rounded-2xl border border-white/10 shadow-elevation-3 rotate-[12deg] transform hover:rotate-0 hover:scale-110 hover:z-20 transition-transform duration-fast ease-standard overflow-hidden bg-white/[0.01] -ml-3 sm:-ml-4 flex-shrink-0">
                <img
                  src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/perfect-pony-xl.avif"
                  alt="Creative asset 4"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-center px-4 flex flex-col items-center">
              <span className="text-white font-black uppercase text-xl sm:text-3xl tracking-wide mb-1 opacity-90">{copy.empty.titleLine1}</span>
              <span className="text-brand font-black uppercase text-2xl sm:text-4xl sm:mt-1 tracking-tight">
                {copy.empty.titleLine2}
              </span>
            </h1>
            <p className="text-white/40 text-xs sm:text-sm font-medium tracking-wide text-center max-w-lg leading-relaxed px-4">
              {copy.empty.description}
            </p>
          </div>
          ) : null
        ) : null}
      </div>

      {/* ── BOTTOM PROMPT BAR — matches VideoStudio exactly ── */}
      <PromptComposer>

          {/* ── Top Row: Mode Toggle & Edit Source Banner ── */}
          <div className="flex items-center justify-between gap-3 px-1">
            {/* Left: Mode toggle pill */}
            <PromptSegmentedControl className="flex-shrink-0">
              <PromptSegmentOption
                type="button"
                onClick={() => { setEditMode(false); setEditSourceId(null); }}
                selected={!editMode}
              >
                {copy.modeToggle.generate}
              </PromptSegmentOption>
              <PromptSegmentOption
                type="button"
                onClick={() => setEditMode(true)}
                disabled={editSources.length === 0}
                selected={editMode}
                className="disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {copy.modeToggle.edit}
              </PromptSegmentOption>
            </PromptSegmentedControl>

            {/* Right: Edit mode status banner beside toggle buttons */}
            {editMode && (
              <div className="flex items-center gap-2 px-3 py-1 bg-brand/5 border border-brand/10 rounded-xl text-[11px] text-brand font-medium tracking-tight min-w-0 max-w-full overflow-hidden">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <span className="truncate">
                  {sourceEntry
                    ? `${copy.editBanner.editingPrefix} "${sourceEntry.prompt?.slice(0, 45)}${sourceEntry.prompt?.length > 45 ? "…" : ""}"`
                    : copy.editBanner.selectSource}
                </span>
                <button
                  onClick={() => { setEditMode(false); setEditSourceId(null); setPrompt(""); }}
                  className="ml-auto text-brand/40 hover:text-brand transition-[color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer text-sm leading-none flex-shrink-0"
                  title={copy.editBanner.cancelEdit}
                >
                  ×
                </button>
              </div>
            )}
          </div>

            {referenceVideoUrl && (
              <div className="w-full flex flex-col gap-1 rounded-xl border border-line bg-surface px-3 py-2 mb-1 text-micro text-ink">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold uppercase tracking-wider text-ink-subtle shrink-0">
                      {relayCopy.referenceVideoLabel}:
                    </span>
                    <span className="truncate text-ink-muted">{referenceVideoUrl}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReferenceVideoUrl("")}
                    title={relayCopy.clearReference}
                    aria-label={relayCopy.clearReference}
                    className="h-5 w-5 rounded-full flex items-center justify-center bg-wash text-ink-muted hover:bg-wash-strong hover:text-ink transition-[background-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer shrink-0"
                  >
                    ×
                  </button>
                </div>
                <p role="status" className="text-amber-400/80">{relayCopy.referenceUnsupportedNote}</p>
              </div>
            )}

            {/* Quick Motion Presets Pills */}
            <div className="w-full flex items-center gap-1.5 overflow-x-auto scrollbar-rail py-1 mb-1">
              <span className="text-micro font-bold uppercase tracking-wider text-ink-subtle shrink-0 mr-1">
                {relayCopy.presetsTitle}
              </span>
              {relayCopy.presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const text = preset.prompt;
                    setPrompt((prev) => (prev ? `${prev.trim()}, ${text}` : text));
                  }}
                  className="rounded-full border border-line bg-wash px-2.5 py-0.5 text-micro font-medium text-ink-muted hover:border-brand-line hover:bg-wash-strong hover:text-ink transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer whitespace-nowrap shrink-0"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Bottom: Textarea full width */}
            <div className="w-full">
              <PromptInputField
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onEnter={handleGenerate}
                placeholder={
                  editMode
                    ? copy.placeholder.edit
                    : copy.placeholder.generate
                }
              />
            </div>

          {/* ── Error banner ── */}
          {generateError && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {generateError}
            </div>
          )}

          {/* ── Controls row: dropdowns + generate button ── */}
          <PromptFooter>
            <PromptControls ref={controlsRef}>

              {/* ── Server-admitted video model picker ── */}
              <div className="relative">
                <button
                  type="button"
                  aria-label={copy.controls.model}
                  aria-haspopup="listbox"
                  aria-expanded={openDropdown === "model"}
                  disabled={videoModelsLoading || videoModels.length === 0}
                  onClick={toggleDropdown("model")}
                  className={`${promptControlClassName({ active: openDropdown === "model" })} cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <span className={PROMPT_CONTROL_LABEL_CLASS}>
                    {videoModelsLoading
                      ? copy.controls.loadingModels
                      : selectedModel?.displayName || copy.controls.pickModel}
                  </span>
                  <PromptChevronIcon />
                </button>
                {openDropdown === "model" && (
                  <PromptPopover className="w-64">
                    <PromptPopoverHeader>{copy.controls.model}</PromptPopoverHeader>
                    <PromptMenuList>
                      {videoModels.map((model) => (
                        <DropdownItem
                          key={model.id}
                          label={model.displayName || model.name || model.id}
                          selected={selectedModelId === model.id}
                          onClick={() => {
                            const capability = findPublicVideoCapability(model, "t2v");
                            const options = getPublicVideoControlOptions(capability);
                            setSelectedModelId(model.id);
                            setAspectRatio(options.aspectRatios[0] || "");
                            setResolution(options.resolutions[0] || null);
                            setDuration(options.durations[0] ?? null);
                            setEditMode(false);
                            setEditSourceId(null);
                            setOpenDropdown(null);
                          }}
                        />
                      ))}
                    </PromptMenuList>
                  </PromptPopover>
                )}
              </div>
              {!videoModelsLoading && videoModels.length === 0 && (
                <span role="status" className="text-[10px] text-ink-subtle">{copy.controls.modelsUnavailable}</span>
              )}

              {/* ── Resolution dropdown ── */}
              {resolutionOptions.length > 0 && <div className="relative">
                <button
                  type="button"
                  aria-label={copy.controls.resolution}
                  aria-haspopup="listbox"
                  aria-expanded={openDropdown === "resolution"}
                  onClick={toggleDropdown("resolution")}
                  className={`${promptControlClassName({ active: openDropdown === "resolution" })} cursor-pointer`}
                >
                  <span className={PROMPT_CONTROL_LABEL_CLASS}>{resolution}</span>
                  <PromptChevronIcon />
                </button>
                {openDropdown === "resolution" && (
                  <PromptPopover>
                    <PromptPopoverHeader>{copy.controls.resolution}</PromptPopoverHeader>
                    <PromptMenuList>
                      {resolutionOptions.map((value) => (
                        <DropdownItem
                          key={value}
                          label={value}
                          selected={resolution === value}
                          onClick={() => { setResolution(value); setOpenDropdown(null); }}
                        />
                      ))}
                    </PromptMenuList>
                  </PromptPopover>
                )}
              </div>}

              {/* ── Aspect Ratio dropdown ── */}
              {aspectRatioOptions.length > 0 && <div className="relative">
                <button
                  type="button"
                  onClick={toggleDropdown("ar")}
                  className={`${promptControlClassName({
                    active: openDropdown === "ar",
                  })} cursor-pointer`}
                >
                  <PromptAspectRatioIcon />
                  <span className={PROMPT_CONTROL_LABEL_CLASS}>
                    {aspectRatio}
                  </span>
                </button>
                {openDropdown === "ar" && (
                  <PromptPopover>
                    <PromptPopoverHeader>{copy.controls.aspectRatio}</PromptPopoverHeader>
                    <PromptMenuList>
                      {aspectRatioOptions.map((ar) => (
                        <DropdownItem
                          key={ar}
                          label={ar}
                          selected={aspectRatio === ar}
                          onClick={() => { setAspectRatio(ar); setOpenDropdown(null); }}
                        />
                      ))}
                    </PromptMenuList>
                  </PromptPopover>
                )}
              </div>}

              {/* ── Duration dropdown ── */}
              {durationOptions.length > 0 && <div className="relative">
                <button
                  type="button"
                  onClick={toggleDropdown("dur")}
                  className={`${promptControlClassName({
                    active: openDropdown === "dur",
                  })} cursor-pointer`}
                >
                  <PromptDurationIcon />
                  <span className={PROMPT_CONTROL_LABEL_CLASS}>
                    {duration}s
                  </span>
                </button>
                {openDropdown === "dur" && (
                  <PromptPopover>
                    <PromptPopoverHeader>{copy.controls.duration}</PromptPopoverHeader>
                    <PromptMenuList>
                      {durationOptions.map((d) => (
                        <DropdownItem
                          key={d}
                          label={`${d}s`}
                          selected={duration === d}
                          onClick={() => { setDuration(d); setOpenDropdown(null); }}
                        />
                      ))}
                    </PromptMenuList>
                  </PromptPopover>
                )}
              </div>}

              {/* Edit source picker dropdown — only shown in edit mode */}
              {editMode && editSources.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={toggleDropdown("source")}
                    className={`${promptControlClassName({ active: true })} cursor-pointer`}
                  >
                    <div className="w-4 h-4 bg-brand/20 rounded flex items-center justify-center border border-brand/30">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </div>
                    <span className={`${PROMPT_CONTROL_LABEL_CLASS} text-brand/70 max-w-[120px] truncate`}>
                      {sourceEntry ? `${copy.controls.sourcePrefix} ${sourceEntry.prompt?.slice(0, 20)}…` : copy.controls.pickSource}
                    </span>
                    <PromptChevronIcon />
                  </button>
                  {openDropdown === "source" && (
                    <PromptPopover className="w-64">
                      <PromptPopoverHeader>{copy.controls.sourceGeneration}</PromptPopoverHeader>
                      <div className="flex flex-col gap-1">
                        {editSources.map((src) => (
                          <div
                            key={src.requestId}
                            className="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer transition-[background-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant group/opt"
                            onClick={() => { setEditSourceId(src.requestId); setOpenDropdown(null); }}
                          >
                            <div className="w-10 h-7 rounded overflow-hidden bg-black/40 flex-shrink-0 border border-white/5">
                              <video src={src.url} className="w-full h-full object-cover" muted playsInline />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-white/70 truncate leading-tight group-hover/opt:text-white">{src.prompt}</p>
                              <p className="text-[9px] text-white/30 mt-0.5">{src.aspectRatio} · {src.duration}s</p>
                            </div>
                            {editSourceId === src.requestId && <CheckSvg />}
                          </div>
                        ))}
                      </div>
                    </PromptPopover>
                  )}
                </div>
              )}

              <span className="text-[10px] text-white/20 hidden sm:block ml-2">{copy.controls.shortcutHint}</span>
            </PromptControls>

            {/* ── Generate Button — matches VideoStudio exactly ── */}
            <PromptAction
              onClick={handleGenerate}
              disabled={generating || !prompt.trim() || videoModelsLoading || !selectedModel || !selectedT2vCapability || Boolean(referenceVideoUrl) || (editMode && !editSourceId)}
            >
              {generating ? (
                <>
                  <span className="animate-spin inline-block text-black">◌</span>{" "}
                  {editMode ? copy.generateButton.remixing : copy.generateButton.generating}
                </>
              ) : editMode ? (
                <span>{copy.generateButton.remix}</span>
              ) : (
                <span>{copy.generateButton.generate}</span>
              )}
            </PromptAction>
          </PromptFooter>
      </PromptComposer>
      <Toaster position="top-right" duration={5000} />
    </div>
  );
}
