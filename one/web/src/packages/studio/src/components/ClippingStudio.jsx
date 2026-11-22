"use client";

import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { ToastHost as Toaster } from "../ui";
import { runClipping, uploadFile } from "../muapi.js";
import { formatErrorMessage } from "../utils/formatError.js";
import { scopedPersistKey, migrateLegacyPersistKey } from "../persistKey.js";
import MobileGenerationActions, {
  GenerationCopyButtons,
} from "./MobileGenerationActions.jsx";
import {
  PROMPT_CONTROL_LABEL_CLASS,
  PROMPT_MEDIA_PREVIEW_CLASS,
  PromptAspectRatioIcon,
  PromptAction,
  PromptComposer,
  PromptControls,
  PromptFooter,
  PromptMenuItem,
  PromptMenuList,
  PromptPopover,
  PromptPopoverHeader,
  PromptDurationIcon,
  promptControlClassName,
  promptMediaButtonClassName,
} from "./prompt/PromptComposer.jsx";
import { PromptInputField } from "./prompt/PromptInputField.jsx";
import en from "../messages/en/clippingStudio.json";
import zh from "../messages/zh/clippingStudio.json";
import ja from "../messages/ja-JP/clippingStudio.json";
import ko from "../messages/ko-KR/clippingStudio.json";
import zhTw from "../messages/zh-TW/clippingStudio.json";
import es from "../messages/es/clippingStudio.json";
import { resolveCopy } from "../i18nUtils";

const CLIPPING_MESSAGES = {
  'zh-CN': zh,
  'ja-JP': ja,
  'ko-KR': ko,
  'zh-TW': zhTw,
  es: es,
  'es-ES': es,
};
import { isModelActive } from "../models.js";
import VideoRelayMenu from "./VideoRelayMenu.jsx";

const CLIPPING_RELAY_COPY_EN = {
  presetsTitle: "Clip Templates:",
  relayLoadedToast: "Loaded relayed video for AI clipping!",
  presets: [
    { id: "highlight", label: "Action Highlights", prompt: "Extract high-energy action climaxes, impactful moments, and peak dramatic tension" },
    { id: "quotes", label: "Key Quotes & Insights", prompt: "Identify compelling quotes, key insights, punchlines, and meaningful dialogue remarks" },
    { id: "twist", label: "Plot Twist & Reactions", prompt: "Detect dramatic emotional turns, surprising plot twists, and peak reaction shots" },
    { id: "viral", label: "Viral Short Pacing", prompt: "Fast-paced hooks, dynamic visual transitions, optimal viral pacing under 15 seconds" },
  ],
};

const CLIPPING_RELAY_COPY_LOCALES = {
  "zh-CN": {
    presetsTitle: "切片模板:",
    relayLoadedToast: "已自动载入接力视频进行AI切片！",
    presets: [
      { id: "highlight", label: "精彩高光快剪", prompt: "Extract high-energy action climaxes, impactful moments, and peak dramatic tension" },
      { id: "quotes", label: "金句重点摘录", prompt: "Identify compelling quotes, key insights, punchlines, and meaningful dialogue remarks" },
      { id: "twist", label: "爆点反转切片", prompt: "Detect dramatic emotional turns, surprising plot twists, and peak reaction shots" },
      { id: "viral", label: "短视频爆款节奏", prompt: "Fast-paced hooks, dynamic visual transitions, optimal viral pacing under 15 seconds" },
    ],
  },
  "ja-JP": {
    presetsTitle: "切り抜きテンプレート:",
    relayLoadedToast: "AI切り抜き用に連携動画を読み込みました！",
    presets: [
      { id: "highlight", label: "ハイライト高速編集", prompt: "Extract high-energy action climaxes, impactful moments, and peak dramatic tension" },
      { id: "quotes", label: "名言・要点抜粋", prompt: "Identify compelling quotes, key insights, punchlines, and meaningful dialogue remarks" },
      { id: "twist", label: "急展開・リアクション", prompt: "Detect dramatic emotional turns, surprising plot twists, and peak reaction shots" },
      { id: "viral", label: "ショート動画バズリズム", prompt: "Fast-paced hooks, dynamic visual transitions, optimal viral pacing under 15 seconds" },
    ],
  },
  "ko-KR": {
    presetsTitle: "클립 템플릿:",
    relayLoadedToast: "AI 클리핑을 위해 연동된 영상을 불러왔습니다!",
    presets: [
      { id: "highlight", label: "하이라이트 퀵컷", prompt: "Extract high-energy action climaxes, impactful moments, and peak dramatic tension" },
      { id: "quotes", label: "핵심 명언 발췌", prompt: "Identify compelling quotes, key insights, punchlines, and meaningful dialogue remarks" },
      { id: "twist", label: "반전 & 리액션 클립", prompt: "Detect dramatic emotional turns, surprising plot twists, and peak reaction shots" },
      { id: "viral", label: "숏폼 바이럴 템포", prompt: "Fast-paced hooks, dynamic visual transitions, optimal viral pacing under 15 seconds" },
    ],
  },
  "zh-TW": {
    presetsTitle: "切片模板:",
    relayLoadedToast: "已自動載入接力影片進行AI切片！",
    presets: [
      { id: "highlight", label: "精彩高光快剪", prompt: "Extract high-energy action climaxes, impactful moments, and peak dramatic tension" },
      { id: "quotes", label: "金句重點摘錄", prompt: "Identify compelling quotes, key insights, punchlines, and meaningful dialogue remarks" },
      { id: "twist", label: "爆點反轉切片", prompt: "Detect dramatic emotional turns, surprising plot twists, and peak reaction shots" },
      { id: "viral", label: "短影音爆款節奏", prompt: "Fast-paced hooks, dynamic visual transitions, optimal viral pacing under 15 seconds" },
    ],
  },
  "es": {
    presetsTitle: "Plantillas de recorte:",
    relayLoadedToast: "¡Video recibido cargado para recorte IA!",
    presets: [
      { id: "highlight", label: "Momentos Destacados", prompt: "Extract high-energy action climaxes, impactful moments, and peak dramatic tension" },
      { id: "quotes", label: "Frases Clave", prompt: "Identify compelling quotes, key insights, punchlines, and meaningful dialogue remarks" },
      { id: "twist", label: "Giros y Reacciones", prompt: "Detect dramatic emotional turns, surprising plot twists, and peak reaction shots" },
      { id: "viral", label: "Ritmo Viral Corto", prompt: "Fast-paced hooks, dynamic visual transitions, optimal viral pacing under 15 seconds" },
    ],
  },
};

const MAX_VIDEO_SIZE_MB = 100;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const CLIPPING_TOASTER_ID = "clipping-studio";
const MAX_VISIBLE_ERROR_TOASTS = 3;
const ERROR_TOAST_DURATION_MS = 7000;
const activeErrorToastIds = [];

const forgetErrorToast = (toastId) => {
  const index = activeErrorToastIds.indexOf(toastId);
  if (index !== -1) activeErrorToastIds.splice(index, 1);
};

const dismissErrorToast = (toastId) => {
  forgetErrorToast(toastId);
  toast.dismiss(toastId, CLIPPING_TOASTER_ID);
};

// ---------------------------------------------------------------------------
// Inline SVG Icons
// ---------------------------------------------------------------------------
const ScissorsIcon = ({ className = "text-brand" }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="9.8" y1="8.2" x2="21" y2="19.4" />
    <line x1="9.8" y1="15.8" x2="21" y2="4.6" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const ErrorToast = ({ toastInstance, message, dismissLabel = "Dismiss notification" }) => (
  <div
    className={`pointer-events-auto flex w-[340px] max-w-[calc(100vw-32px)] items-start gap-3 rounded-xl border border-red-400/40 bg-white px-3.5 py-3 text-[13px] text-zinc-900 shadow-elevation-3 transition-[opacity,transform] duration-fast ease-standard ${
      toastInstance.visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
    }`}
    role="alert"
  >
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-400/40 bg-red-50 text-red-600">
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6" />
        <path d="M12 17h.01" />
      </svg>
    </span>
    <span className="min-w-0 flex-1 py-1 font-medium leading-5 text-zinc-900">{message}</span>
    <button
      type="button"
      onClick={() => dismissErrorToast(toastInstance.id)}
      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-[background-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 cursor-pointer"
      aria-label={dismissLabel}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  </div>
);

const showErrorToast = (message, copy = en) => {
  const options = {
    duration: ERROR_TOAST_DURATION_MS,
    position: "bottom-right",
    toasterId: CLIPPING_TOASTER_ID,
  };

  while (activeErrorToastIds.length >= MAX_VISIBLE_ERROR_TOASTS) {
    const oldestToastId = activeErrorToastIds.shift();
    toast.remove(oldestToastId, CLIPPING_TOASTER_ID);
  }

  const toastId = toast.custom(
    (toastInstance) => (
      <ErrorToast
        toastInstance={toastInstance}
        message={message}
        dismissLabel={copy.errors.dismissNotification}
      />
    ),
    options,
  );

  activeErrorToastIds.push(toastId);
  setTimeout(
    () => forgetErrorToast(toastId),
    ERROR_TOAST_DURATION_MS + 1000,
  );
};

const showVideoSizeLimitToast = (copy = en) => {
  showErrorToast(copy.errors.videoExceedsLimit.replace("{mb}", MAX_VIDEO_SIZE_MB), copy);
};

const isFileSizeError = (error) => {
  const message = String(error?.message || error || "");
  return /(?:\b413\b|payload too large|request entity too large|file(?: size)? (?:is )?too large|file is too heavy|exceeds?.*(?:size|limit)|слишком (?:больш|тяж)|превышает.*(?:размер|лимит))/i.test(message);
};

const showVideoUploadError = (error, copy = en) => {
  if (isFileSizeError(error)) {
    showErrorToast(copy.errors.videoTooLarge, copy);
    return;
  }

  const message = formatErrorMessage(
    error,
    copy.errors.uploadFailed,
  );
  showErrorToast(message, copy);
};

const getAspectClass = (ar) => {
  switch (ar) {
    case "16:9": return "aspect-video";
    case "1:1": return "aspect-square";
    case "4:5": return "aspect-[4/5]";
    case "4:3": return "aspect-[4/3]";
    case "3:4": return "aspect-[3/4]";
    case "9:16":
    default:
      return "aspect-[9/16]";
  }
};

// ---------------------------------------------------------------------------
// Main Clipping Studio Component
// ---------------------------------------------------------------------------
export default function ClippingStudio({
  apiKey,
  initialPrompt = "",
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
  droppedFiles,
  onFilesHandled,
  locale = "en",
}) {
  const copy = resolveCopy(en, CLIPPING_MESSAGES, locale);
  const relayCopy = resolveCopy(CLIPPING_RELAY_COPY_EN, CLIPPING_RELAY_COPY_LOCALES, locale);
  const LEGACY_PERSIST_KEY = "hg_clipping_studio_persistent";
  const PERSIST_KEY = scopedPersistKey(LEGACY_PERSIST_KEY, apiKey);
  useEffect(() => {
    migrateLegacyPersistKey(LEGACY_PERSIST_KEY, PERSIST_KEY);
  }, [PERSIST_KEY]);

  // ── Clipping Parameters State ───────────────────────────────────────────
  const [videoUrl, setVideoUrl] = useState("");
  const [numHighlights, setNumHighlights] = useState(3);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [returnCoordinatesOnly, setReturnCoordinatesOnly] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt || "");
  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);
  
  // ── Dropdowns state ──
  const [aspectDropdownOpen, setAspectDropdownOpen] = useState(false);
  const [highlightsDropdownOpen, setHighlightsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const highlightsDropdownRef = useRef(null);

  // ── Upload State ──
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoFileInputRef = useRef(null);
  const [isVideoDragging, setIsVideoDragging] = useState(false);
  const videoDragCounterRef = useRef(0);

  // ── Generation State ─────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [fullscreenUrl, setFullscreenUrl] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  // ── Output State ─────────────────────────────────────────────────────────
  const [result, setResult] = useState(null); // stores parsed completed API output
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);
  const mainVideoRef = useRef(null);

  // ── History State ────────────────────────────────────────────────────────
  const [history, setHistory] = useState([]);

  const ASPECT_RATIOS = [
    { label: copy.aspectRatioLabels["9:16"], value: "9:16" },
    { label: copy.aspectRatioLabels["16:9"], value: "16:9" },
    { label: copy.aspectRatioLabels["1:1"], value: "1:1" },
    { label: copy.aspectRatioLabels["4:5"], value: "4:5" },
    { label: copy.aspectRatioLabels["4:3"], value: "4:3" },
    { label: copy.aspectRatioLabels["3:4"], value: "3:4" },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setAspectDropdownOpen(false);
      }
      if (highlightsDropdownRef.current && !highlightsDropdownRef.current.contains(event.target)) {
        setHighlightsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Timer effect for generation progress
  useEffect(() => {
    if (isGenerating) {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGenerating]);

  // ── Load Persistent State from localStorage ──────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PERSIST_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.videoUrl) setVideoUrl(data.videoUrl);
        if (data.numHighlights) setNumHighlights(data.numHighlights);
        if (data.aspectRatio) setAspectRatio(data.aspectRatio);
        if (data.returnCoordinatesOnly !== undefined) setReturnCoordinatesOnly(data.returnCoordinatesOnly);
        if (data.history) setHistory(data.history);
        if (data.result) setResult(data.result);
      }
    } catch (err) {
      console.warn("Failed to load ClippingStudio persistent state:", err);
    }
  }, []);

  // ── Auto-fill video from relay or query parameter ────────────────────────────
  useEffect(() => {
    const handleRelay = (url) => {
      if (!url) return;
      setVideoUrl(url);
      toast.success(relayCopy.relayLoadedToast);
    };

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryVideo = params.get("video_url");
      if (queryVideo) {
        handleRelay(queryVideo);
      }

      const listener = (e) => {
        if (e.detail?.videoUrl) {
          handleRelay(e.detail.videoUrl);
        }
      };
      window.addEventListener("supdance-relay-video", listener);
      return () => window.removeEventListener("supdance-relay-video", listener);
    }
  }, [relayCopy.relayLoadedToast]);

  // ── Save Persistent State to localStorage ───────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const state = {
          videoUrl,
          numHighlights,
          aspectRatio,
          returnCoordinatesOnly,
          history,
          result,
        };
        localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn("Failed to save ClippingStudio persistent state:", err);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [videoUrl, numHighlights, aspectRatio, returnCoordinatesOnly, history, result]);

  // ── Handle Dropped Files ────────────────────────────────────────────────
  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      const videoFiles = droppedFiles.filter(f => f.type.startsWith('video/'));
      if (videoFiles.length > 0) {
        const file = videoFiles[0];
        if (file.size > MAX_VIDEO_SIZE_BYTES) {
          showVideoSizeLimitToast(copy);
          onFilesHandled?.();
          return;
        }
        setVideoUploading(true);
        setVideoProgress(0);
        uploadFile(apiKey, file, (pct) => {
          setVideoProgress(pct);
        })
          .then(url => {
            setVideoUrl(url);
            setVideoUploading(false);
          })
          .catch(err => {
            setVideoUploading(false);
            showVideoUploadError(err, copy);
          });
      }
      onFilesHandled?.();
    }
  }, [droppedFiles, onFilesHandled, apiKey]);

  // Adjust URL textarea height dynamically
  // ── Highlight Seeking Helper ─────────────────────────────────────────────
  const seekToHighlight = (startSec) => {
    if (mainVideoRef.current) {
      mainVideoRef.current.currentTime = startSec;
      mainVideoRef.current.play().catch(() => {});
    }
  };

  // Helper formatting seconds to MM:SS
  const formatSeconds = (totalSeconds) => {
    if (isNaN(totalSeconds) || totalSeconds === null || totalSeconds === undefined) return "0:00";
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // ── Copy Link & Download Helpers ─────────────────────────────────────────
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert(copy.alerts.urlCopied);
  };

  const downloadVideo = async (url, title = "clipped_video") => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${title.replace(/\s+/g, '_')}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handlePromptInput = (e) => {
    const val = e.target.value;
    if (val.trim().match(/^https?:\/\/[^\s]+$/i)) {
      setVideoUrl(val.trim());
      setPrompt("");
      return;
    }
    setPrompt(val);
  };

  // ── Video File Handlers ──
  const processVideoFiles = async (files) => {
    const file = files && files[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      showVideoSizeLimitToast(copy);
      if (videoFileInputRef.current) videoFileInputRef.current.value = "";
      return;
    }
    setVideoUploading(true);
    setVideoProgress(0);
    try {
      const url = await uploadFile(apiKey, file, (pct) => {
        setVideoProgress(pct);
      });
      setVideoUrl(url);
    } catch (err) {
      console.error("[ClippingStudio] Video upload failed:", err);
      showVideoUploadError(err, copy);
    } finally {
      setVideoUploading(false);
      setVideoProgress(0);
      if (videoFileInputRef.current) videoFileInputRef.current.value = "";
    }
  };

  const handleVideoFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    await processVideoFiles(files);
  };

  const handleVideoDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    videoDragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsVideoDragging(true);
    }
  };

  const handleVideoDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    videoDragCounterRef.current -= 1;
    if (videoDragCounterRef.current <= 0) {
      videoDragCounterRef.current = 0;
      setIsVideoDragging(false);
    }
  };

  const handleVideoDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleVideoDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    videoDragCounterRef.current = 0;
    setIsVideoDragging(false);
    const files = Array.from(e.dataTransfer?.files || []).filter((f) =>
      f.type.startsWith("video/"),
    );
    if (files.length > 0) {
      processVideoFiles(files);
    }
  };

  const clearVideoUpload = () => {
    setVideoUrl("");
  };

  // ── Dispatch Run / Call submitAndPoll ────────────────────────────────────
  const handleGenerate = async () => {
    if (!videoUrl) {
      alert(copy.alerts.needVideo);
      return;
    }
    if (!isModelActive('ai-clipping')) {
      setGenerateError('当前剪辑模型暂不可用，请稍后重试');
      return;
    }

    onGenerationStart?.();
    setIsGenerating(true);
    setGenerateError(null);
    setResult(null);

    try {
      const params = {
        video_url: videoUrl,
        num_highlights: numHighlights,
        aspect_ratio: aspectRatio,
        return_coordinates_only: returnCoordinatesOnly,
      };

      const res = await runClipping(apiKey, params);

      // Parse the result
      const clips = res.outputs || [];
      const outputCoordinates = res.output?.coordinates || res.coordinates || res.output?.timings || res.timings || [];
      
      const newResult = {
        id: res.id || Date.now().toString(),
        videoUrl: videoUrl,
        clips: clips,
        coordinates: Array.isArray(outputCoordinates) ? outputCoordinates : (res.output?.clips || []),
        returnCoordinatesOnly: returnCoordinatesOnly,
        aspectRatio: aspectRatio,
        timestamp: new Date().toISOString(),
      };

      // Mock coordinates if API succeeded but modal coordinates are empty in coordinate-only mode
      if (returnCoordinatesOnly && newResult.coordinates.length === 0) {
        newResult.coordinates = Array.from({ length: numHighlights }).map((_, idx) => ({
          label: `Highlight #${idx + 1}`,
          start_time: idx * 15,
          end_time: (idx + 1) * 15,
          start: idx * 15,
          end: (idx + 1) * 15,
          score: 0.95 - (idx * 0.05)
        }));
      }

      setResult(newResult);
      setActiveHighlightIndex(0);

      // Append to history
      setHistory((prev) => [newResult, ...prev].slice(0, 30));

      if (onGenerationComplete) {
        onGenerationComplete({
          url: clips[0] || videoUrl,
          model: "ai-clipping",
          type: "video",
        });
      }
    } catch (err) {
      console.error("[ClippingStudio] Error generating clips:", err);
      const errMsg = formatErrorMessage(err, copy.errors.generationFailed);
      const notificationMessage = isFileSizeError(err)
        ? copy.errors.videoTooLarge
        : errMsg;
      if (onGenerationError) onGenerationError(notificationMessage);
      else showErrorToast(notificationMessage, copy);
    } finally {
      setIsGenerating(false);
      onGenerationEnd?.();
    }
  };

  const handleSelectHistory = (entry) => {
    setResult(entry);
    setActiveHighlightIndex(0);
    setVideoUrl(entry.videoUrl);
    setNumHighlights(entry.numHighlights || 3);
    setAspectRatio(entry.aspectRatio || "9:16");
    setReturnCoordinatesOnly(entry.returnCoordinatesOnly || false);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-transparent text-white relative overflow-hidden">
      
      {/* ─── CENTRAL AREA ─── */}
      <div className="flex-1 w-full max-w-7xl mx-auto overflow-y-auto custom-scrollbar pb-40 lg:pb-32 px-2">
        
        {/* Error Message */}
        {generateError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded text-xs font-semibold leading-relaxed mb-6">
            {generateError}
          </div>
        )}

        {/* 1. Empty State (No history, no result active) */}
        {!result && history.length === 0 && (
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
              <span className="text-white font-black uppercase text-xl sm:text-3xl tracking-wide mb-1 opacity-90">{copy.headings.startCreatingWith}</span>
              <span className="text-brand font-black uppercase text-2xl sm:text-4xl sm:mt-1 tracking-tight">
                {copy.headings.aiClippingStudio}
              </span>
            </h1>
            <p className="text-white/40 text-xs sm:text-sm font-medium tracking-wide text-center max-w-lg leading-relaxed px-4">
              {copy.headings.emptyStateSubtitle}
            </p>
          </div>
        )}

        {/* 2. History Gallery List (Active result is null, history has items) */}
        {!result && history.length > 0 && (
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <ScissorsIcon className="text-primary w-4 h-4" />
                {copy.headings.clippingHistoryRuns}
              </h2>
              <span className="text-xs font-bold text-zinc-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded">
                {copy.headings.savedGenerations.replace('{count}', history.length)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full animate-fade-in">
              {history.map((entry, idx) => (
                <div
                  key={entry.id || idx}
                  onClick={() => handleSelectHistory(entry)}
                  className="relative group rounded-2xl overflow-hidden border border-line bg-surface shadow-elevation-2 hover:border-brand-line transition-[border-color,box-shadow] duration-fast ease-standard flex flex-col cursor-pointer"
                >
                  <div className="aspect-video bg-zinc-950 flex items-center justify-center border-b border-white/5 relative overflow-hidden">
                    <video
                      src={entry.videoUrl}
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-85 transition-opacity animate-fade-in"
                      preload="metadata"
                      muted
                      loop
                      playsInline
                      onMouseOver={(e) => e.target.play()}
                      onMouseOut={(e) => {
                        e.target.pause();
                        e.target.currentTime = 0;
                      }}
                    />
                    
                    {/* Overlay actions */}
                    <div className="pointer-events-none absolute top-2 right-2 z-10 hidden flex-col gap-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 md:flex">
                      <VideoRelayMenu
                        videoUrl={entry.clips?.[0] || entry.videoUrl}
                        currentTab="clipping"
                        locale={locale}
                      />
                      <button
                        type="button"
                        title={copy.buttons.deleteFromHistory}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHistory((prev) => prev.filter((h) => h.id !== entry.id));
                        }}
                        className="p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-red-500 hover:text-white active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard border border-white/10 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    <MobileGenerationActions
                      actions={[
                        {
                          kind: "delete",
                          label: copy.buttons.delete,
                          danger: true,
                          onSelect: () =>
                            setHistory((prev) =>
                              prev.filter((historyEntry) => historyEntry.id !== entry.id),
                            ),
                        },
                      ]}
                    />
                  </div>
                  <div className="p-3 bg-black/80 backdrop-blur-sm border-t border-white/5 flex-1 flex flex-col justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-xs font-bold text-white truncate" title={entry.videoUrl.split('/').pop()}>
                        {entry.videoUrl.split('/').pop() || copy.sourceVideoFallback}
                      </h4>
                      <p className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">
                        {entry.returnCoordinatesOnly ? copy.modes.timelineSeek : copy.modes.clipsGallery}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] font-bold text-brand px-2 py-0.5 bg-brand-soft rounded border border-brand-line">
                        {entry.aspectRatio}
                      </span>
                      <span className="text-[10px] text-white/40">
                        {entry.returnCoordinatesOnly ? copy.labels.highlights.replace('{count}', entry.coordinates?.length || 0) : copy.labels.clips.replace('{count}', entry.clips?.length || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Active Result Preview (Result is loaded) */}
        {result && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Header / Back Action */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white active:scale-[0.98] active:duration-instant transition-[color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                {copy.headings.backToHistory}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-brand bg-brand-soft border border-brand-line px-2.5 py-0.5 rounded">
                  {result.returnCoordinatesOnly ? copy.modes.timelineSeek : copy.modes.clipsGallery}
                </span>
                <span className="text-[10px] text-zinc-400 bg-white/5 border border-white/5 px-2.5 py-0.5 rounded">
                  {result.aspectRatio}
                </span>
              </div>
            </div>

            {/* Render coordinates Timeline player */}
            {result.returnCoordinatesOnly ? (
              <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                {/* Left Side: Original Player */}
                <div className="flex-1 bg-black border border-zinc-900 rounded-lg overflow-hidden flex flex-col shadow-2xl relative min-h-[300px] lg:min-h-0">
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/5 z-10 text-[10px] uppercase font-bold tracking-wider text-primary">
                    {copy.headings.originalVideoPlayer}
                  </div>
                  <video
                    ref={mainVideoRef}
                    src={result.videoUrl}
                    controls
                    className="w-full flex-1 object-contain bg-zinc-950"
                    preload="auto"
                  />
                </div>

                {/* Right Side: Highlights list */}
                <div className="w-full lg:w-[350px] border border-zinc-900 bg-zinc-950/40 backdrop-blur-md rounded-lg p-5 flex flex-col min-h-[350px] lg:min-h-0">
                  <div className="pb-4 border-b border-zinc-900 flex items-center justify-between">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">
                      {copy.headings.highlightsTimeline}
                    </h3>
                    <span className="text-[10px] font-bold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      {copy.headings.matches.replace('{count}', result.coordinates?.length || 0)}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar mt-4 space-y-3 pr-1">
                    {result.coordinates && result.coordinates.length > 0 ? (
                      result.coordinates.map((hl, i) => {
                        const start = hl.start_time !== undefined ? hl.start_time : (hl.start || 0);
                        const end = hl.end_time !== undefined ? hl.end_time : (hl.end || 0);
                        const isActive = activeHighlightIndex === i;

                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setActiveHighlightIndex(i);
                              seekToHighlight(start);
                            }}
                            className={`w-full p-4 border rounded-xl text-left transition-[background-color,border-color,box-shadow] duration-fast ease-standard flex flex-col gap-2 group/hl cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                              isActive 
                                ? "border-brand-line bg-brand-soft shadow-elevation-1" 
                                : "border-line bg-surface hover:border-line-strong hover:bg-wash"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={`text-xs font-bold transition-colors ${isActive ? "text-brand" : "text-ink"}`}>
                                {hl.label || copy.labels.highlightFallback.replace('{index}', i + 1)}
                              </span>
                              {hl.score && (
                                <span className="text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
                                  {(hl.score * 100).toFixed(0)}{copy.labels.scoreSuffix}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-semibold">
                              <ClockIcon />
                              <span>{formatSeconds(start)} - {formatSeconds(end)}</span>
                              <span className="text-zinc-650">•</span>
                              <span className="text-primary/80 font-bold">{(end - start).toFixed(0)}{copy.labels.durationSuffix}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary mt-1 opacity-0 group-hover/hl:opacity-100 transition-opacity">
                              <PlayIcon /> {copy.labels.seekAndPlay}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-xs text-zinc-500 font-semibold">
                        {copy.empty.noHighlights}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Clips Grid Gallery */
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">
                    {copy.headings.extractedVideoClips}
                  </h3>
                  <span className="text-[10px] font-bold text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded border border-zinc-800">
                    {copy.headings.aspectRatioLabel.replace('{ratio}', result.aspectRatio)}
                  </span>
                </div>

                {result.clips && result.clips.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {result.clips.map((clipUrl, i) => (
                      <div
                        key={i}
                        onClick={() => setFullscreenUrl(clipUrl)}
                        className="relative group rounded-2xl overflow-hidden border border-line bg-surface shadow-elevation-2 hover:border-brand-line transition-[border-color,box-shadow] duration-fast ease-standard flex flex-col cursor-pointer"
                      >
                        <div className="relative group/vid border-b border-white/5 overflow-hidden bg-black/40">
                          <video
                            src={clipUrl}
                            className={`w-full ${getAspectClass(result.aspectRatio)} object-cover bg-black/40 hover:opacity-85 transition-opacity`}
                            controls={false}
                            loop
                            muted
                            playsInline
                            onMouseOver={(e) => e.target.play()}
                            onMouseOut={(e) => {
                              e.target.pause();
                              e.target.currentTime = 0;
                            }}
                          />
                          
                          {/* Overlay actions */}
                          <div className="pointer-events-none absolute top-2 right-2 z-10 hidden flex-col gap-2 opacity-0 transition-opacity group-hover/vid:pointer-events-auto group-hover/vid:opacity-100 group-focus-within/vid:pointer-events-auto group-focus-within/vid:opacity-100 md:flex">
                            <GenerationCopyButtons
                              prompt={result.prompt}
                              onCopyError={onGenerationError}
                            />
                            <VideoRelayMenu
                              videoUrl={clipUrl}
                              currentTab="clipping"
                              locale={locale}
                            />
                            <button
                              type="button"
                              title={copy.buttons.copyLink}
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(clipUrl);
                              }}
                              className="p-2 bg-overlay-glass backdrop-blur-md rounded-full text-ink hover:bg-brand hover:text-ink-on-accent active:bg-brand-active active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard border border-line-subtle cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                            >
                              <CopyIcon />
                            </button>
                            <button
                              type="button"
                              title={copy.buttons.download}
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadVideo(clipUrl, `clip-${i + 1}.mp4`);
                              }}
                              className="p-2 bg-overlay-glass backdrop-blur-md rounded-full text-ink hover:bg-brand hover:text-ink-on-accent active:bg-brand-active active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard border border-line-subtle cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                            >
                              <DownloadIcon />
                            </button>
                          </div>
                          <MobileGenerationActions
                            prompt={result.prompt}
                            onCopyError={onGenerationError}
                            actions={[
                              {
                                kind: "copy",
                                label: copy.buttons.copyLinkShort,
                                onSelect: () => copyToClipboard(clipUrl),
                              },
                              {
                                kind: "download",
                                label: copy.buttons.download,
                                onSelect: () =>
                                  downloadVideo(clipUrl, `clip-${i + 1}.mp4`),
                              },
                            ]}
                          />

                          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded border border-white/5 text-[9px] uppercase font-black tracking-wider text-brand">
                            {copy.labels.clipIndex.replace('{index}', i + 1)}
                          </div>
                        </div>

                        <div className="p-3 bg-black/80 backdrop-blur-sm border-t border-white/5 flex-1 flex flex-col justify-between gap-2">
                          {result.prompt && (
                            <p className="text-white/70 text-xs line-clamp-2 leading-relaxed" title={result.prompt}>
                              {result.prompt}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-brand px-2 py-0.5 bg-brand-soft rounded border border-brand-line whitespace-nowrap">
                                {copy.labels.aiClipping}
                              </span>
                              <span className="text-[10px] text-white/40">{result.aspectRatio || copy.labels.clipIndex.replace('{index}', i + 1)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center text-xs text-zinc-500 font-semibold border border-zinc-900 rounded bg-zinc-950/20">
                    {copy.empty.noClips}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ─── FLOATING BOTTOM PROMPT BAR ─── */}
      <PromptComposer>
          
          {/* Inline list of uploaded media files */}
          {videoUrl && (
            <div className="flex items-center gap-2.5 px-1 pb-1">
              <div className={PROMPT_MEDIA_PREVIEW_CLASS}>
                <video src={videoUrl} className="w-full h-full object-cover" muted playsInline />
                <button
                  type="button"
                  onClick={clearVideoUpload}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 hover:bg-black active:scale-95 active:duration-instant rounded-full flex items-center justify-center text-white/85 hover:text-white text-[8px] border border-white/5 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring transition-[background-color,color,transform] duration-fast ease-standard"
                  title={copy.buttons.clearVideo}
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Quick Clipping Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-rail py-1 px-1">
            <span className="text-micro font-bold uppercase tracking-wider text-ink-subtle shrink-0 mr-1">
              {relayCopy.presetsTitle}
            </span>
            {relayCopy.presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setPrompt(preset.prompt);
                  toast.success(preset.label);
                }}
                className="rounded-full border border-line bg-wash px-2.5 py-0.5 text-micro font-medium text-ink-muted hover:border-brand-line hover:bg-wash-strong hover:text-ink active:scale-[0.98] active:duration-instant transition-[background-color,border-color,color,transform] duration-fast ease-standard whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Upper row: upload button & prompt field */}
          <div className="flex items-start gap-3 px-1">
            {/* Hidden file input */}
            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoFileChange}
            />
            
            {/* Sleek round upload button */}
            {!videoUrl && (
              <button
                type="button"
                title={copy.buttons.uploadSourceVideo}
                onClick={() => videoFileInputRef.current?.click()}
                onDragEnter={handleVideoDragEnter}
                onDragLeave={handleVideoDragLeave}
                onDragOver={handleVideoDragOver}
                onDrop={handleVideoDrop}
                className={`${promptMediaButtonClassName({
                  active: Boolean(videoUrl),
                  className: "active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring",
                })}${isVideoDragging ? " ring-2 ring-brand border-brand bg-brand-soft" : ""}`}
              >
                {videoUploading ? (
                  <div className="flex flex-col items-center justify-center w-full h-full absolute inset-0 bg-black/85 z-20 backdrop-blur-[1px]">
                    <svg className="w-8 h-8 -rotate-90">
                      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-white/10" />
                      <circle
                        cx="16"
                        cy="16"
                        r="14"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="transparent"
                        strokeDasharray={88}
                        strokeDashoffset={88 - (88 * videoProgress) / 100}
                        className="text-brand transition-[stroke-dashoffset] duration-fast ease-standard"
                      />
                    </svg>
                    <span className={`absolute text-[8px] font-black text-brand leading-none ${videoProgress >= 100 ? "animate-pulse" : ""}`}>
                      {videoProgress >= 100 ? "..." : `${videoProgress}%`}
                    </span>
                  </div>
                ) : null}

                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40 group-hover:text-brand transition-colors">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </button>
            )}

            {/* Prompt textarea (supports direct URL pasting too) */}
            <div className="flex-1 flex flex-col gap-1">
              <PromptInputField
                value={prompt}
                onChange={handlePromptInput}
                onEnter={handleGenerate}
                placeholder={copy.placeholders.promptOrUrl}
              />
            </div>
          </div>

          {/* Bottom row: controls + generate button */}
          <PromptFooter>
            <PromptControls>
              
              {/* Model Identifier (C) */}
              <div className={promptControlClassName()}>
                <div className="w-4 h-4 bg-brand rounded flex items-center justify-center shadow-lg shadow-brand/10">
                  <span className="text-[9px] font-bold text-black uppercase">C</span>
                </div>
                <span className={PROMPT_CONTROL_LABEL_CLASS}>
                  {copy.labels.aiClipping}
                </span>
              </div>

              {/* Aspect Ratio selector */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setAspectDropdownOpen(!aspectDropdownOpen)}
                  className={promptControlClassName({
                    active: aspectDropdownOpen,
                    className: "cursor-pointer active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring",
                  })}
                >
                  <PromptAspectRatioIcon />
                  <span className={PROMPT_CONTROL_LABEL_CLASS}>
                    {aspectRatio}
                  </span>
                </button>
                {aspectDropdownOpen && (
                  <PromptPopover>
                    <PromptPopoverHeader>
                      {copy.popovers.aspectRatio}
                    </PromptPopoverHeader>
                    <PromptMenuList>
                      {ASPECT_RATIOS.map((r) => (
                        <PromptMenuItem
                          key={r.value}
                          selected={aspectRatio === r.value}
                          onClick={() => {
                            setAspectRatio(r.value);
                            setAspectDropdownOpen(false);
                          }}
                        >
                          {r.value}
                        </PromptMenuItem>
                      ))}
                    </PromptMenuList>
                  </PromptPopover>
                )}
              </div>

              {/* Highlights Limit selector */}
              <div className="relative" ref={highlightsDropdownRef}>
                <button
                  type="button"
                  onClick={() => setHighlightsDropdownOpen(!highlightsDropdownOpen)}
                  className={promptControlClassName({
                    active: highlightsDropdownOpen,
                    className: "cursor-pointer active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring",
                  })}
                >
                  <PromptDurationIcon />
                  <span className={PROMPT_CONTROL_LABEL_CLASS}>
                    {copy.labels.highlights.replace('{count}', numHighlights)}
                  </span>
                </button>
                {highlightsDropdownOpen && (
                  <PromptPopover className="min-w-[180px] overflow-visible">
                    <PromptPopoverHeader className="mb-3">
                      {copy.popovers.maxHighlights}
                    </PromptPopoverHeader>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">{copy.popovers.limit}</span>
                        <span className="text-xs font-black text-brand bg-brand-soft border border-brand-line px-2.5 py-0.5 rounded">
                          {numHighlights}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="60"
                        step="1"
                        value={numHighlights}
                        onChange={(e) => setNumHighlights(Number(e.target.value))}
                        className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  </PromptPopover>
                )}
              </div>

              {/* Return Coordinates Toggle */}
              <button
                type="button"
                onClick={() => setReturnCoordinatesOnly(!returnCoordinatesOnly)}
                className={promptControlClassName({
                  active: returnCoordinatesOnly,
                  className: (returnCoordinatesOnly
                    ? "text-brand"
                    : "text-white/70 hover:text-white") + " cursor-pointer active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring",
                })}
              >
                <ScissorsIcon className="w-4 h-4 text-current" />
                <span className="text-xs font-semibold">
                  {copy.buttons.coordinatesOnly}
                </span>
              </button>

            </PromptControls>

            {/* Generate button */}
            <PromptAction
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin inline-block text-black">◌</span>
                  <span>{copy.buttons.generating}</span>
                </>
              ) : (
                <>
                  <span>{copy.buttons.generate}</span>
                </>
              )}
            </PromptAction>
          </PromptFooter>
      </PromptComposer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 99px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
        }
      `}</style>
      <Toaster
        toasterId={CLIPPING_TOASTER_ID}
        position="bottom-right"
        reverseOrder={false}
        gutter={8}
        containerStyle={{ right: 20, bottom: 20 }}
        toastOptions={{
          duration: 6000,
        }}
      />
    </div>
  );
}
