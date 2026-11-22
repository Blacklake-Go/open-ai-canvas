"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { ToastHost as Toaster } from "../ui";
import { processLipSync, uploadFile } from "../muapi.js";
import { formatErrorMessage } from "../utils/formatError.js";
import { scopedPersistKey, migrateLegacyPersistKey } from "../persistKey.js";
import MobileGenerationActions, {
  GenerationCopyButtons,
} from "./MobileGenerationActions.jsx";
import {
  lipsyncModels,
  imageLipSyncModels,
  videoLipSyncModels,
  getLipSyncModelById,
  getResolutionsForLipSyncModel,
} from "../models.js";
import {
  PROMPT_CONTROL_LABEL_CLASS,
  PromptAction,
  PromptChevronIcon,
  PromptComposer,
  PromptControls,
  PromptFooter,
  PromptMenuItem,
  PromptMenuList,
  PromptPopover,
  PromptPopoverHeader,
  PromptQualityIcon,
  PromptSegmentedControl,
  PromptSegmentOption,
  promptControlClassName,
  promptMediaButtonClassName,
} from "./prompt/PromptComposer.jsx";
import { PromptInputField } from "./prompt/PromptInputField.jsx";
import en from "../messages/en/lipSyncStudio.json";
import zh from "../messages/zh/lipSyncStudio.json";
import ja from "../messages/ja-JP/lipSyncStudio.json";
import ko from "../messages/ko-KR/lipSyncStudio.json";
import zhTw from "../messages/zh-TW/lipSyncStudio.json";
import es from "../messages/es/lipSyncStudio.json";
import { resolveCopy } from "../i18nUtils";

const LIPSYNC_MESSAGES = {
  'zh-CN': zh,
  'ja-JP': ja,
  'ko-KR': ko,
  'zh-TW': zhTw,
  es: es,
  'es-ES': es,
};
import VideoRelayMenu from "./VideoRelayMenu.jsx";

const LIPSYNC_RELAY_COPY_EN = {
  presetsTitle: "Audio Presets:",
  relayPortraitToast: "Loaded relayed portrait!",
  relayVideoToast: "Loaded relayed video!",
  loadedPresetPrefix: "Loaded audio preset: ",
  presets: [
    { id: "female", label: "Female · Natural Anchor", url: "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3", name: "female_explainer.mp3", text: "High-definition intelligent lip-sync voice test with accurate facial micro-expressions and lip movement." },
    { id: "male", label: "Male · Tech Narrator", url: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", name: "male_tech.mp3", text: "Welcome to the future AI digital human workbench, experiencing ultra-natural audio-visual synchronization." },
    { id: "ecom", label: "Live Host · Promo Pitch", url: "https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3", name: "ecommerce_host.mp3", text: "Check out today's featured product—unbeatable quality and limited-time offer, grab yours now!" },
    { id: "biz", label: "Global · Business Pitch", url: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3", name: "business_pitch.mp3", text: "Experience next-generation high-fidelity AI lip synchronization in real time." },
  ],
};

const LIPSYNC_RELAY_COPY_LOCALES = {
  "zh-CN": {
    presetsTitle: "示范音频:",
    relayPortraitToast: "已自动载入接力人像！",
    relayVideoToast: "已自动载入接力视频！",
    loadedPresetPrefix: "已载入预设音频：",
    presets: [
      { id: "female", label: "女声 · 自然播报", url: "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3", name: "female_explainer.mp3", text: "这是一段高清智能对口型语音测试，能够精准还原面部微表情与唇齿动作。" },
      { id: "male", label: "男声 · 科技解说", url: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", name: "male_tech.mp3", text: "欢迎来到未来AI数字人工作台，体验极致自然的声画同步效果。" },
      { id: "ecom", label: "带货口播 · 激情推荐", url: "https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3", name: "ecommerce_host.mp3", text: "家人们看过来，今天这款产品真的是太惊喜了，手慢无赶紧冲！" },
      { id: "biz", label: "英文 · 商业陈述", url: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3", name: "business_pitch.mp3", text: "Experience next-generation high-fidelity AI lip synchronization in real time." },
    ],
  },
  "ja-JP": {
    presetsTitle: "サンプル音声:",
    relayPortraitToast: "連携されたポートレートを読み込みました！",
    relayVideoToast: "連携された動画を読み込みました！",
    loadedPresetPrefix: "プリセット音声を読み込みました：",
    presets: [
      { id: "female", label: "女性 · ナチュラル報道", url: "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3", name: "female_explainer.mp3", text: "高精度AIリップシンクテスト、自然な表情と口元の動きを忠実に再現します。" },
      { id: "male", label: "男性 · テック解説", url: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", name: "male_tech.mp3", text: "次世代AIデジタルヒューマンスタジオへようこそ、自然な音声同期を体験してください。" },
      { id: "ecom", label: "ライブ配信 · 情熱紹介", url: "https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3", name: "ecommerce_host.mp3", text: "注目の新商品をご紹介します！驚きのクオリティをぜひ今すぐチェックしてください！" },
      { id: "biz", label: "英語 · ビジネスピッチ", url: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3", name: "business_pitch.mp3", text: "Experience next-generation high-fidelity AI lip synchronization in real time." },
    ],
  },
  "ko-KR": {
    presetsTitle: "샘플 오디오:",
    relayPortraitToast: "연동된 인물 사진을 불러왔습니다!",
    relayVideoToast: "연동된 영상을 불러왔습니다!",
    loadedPresetPrefix: "프리셋 오디오 로드됨: ",
    presets: [
      { id: "female", label: "여성 · 자연스러운 브리핑", url: "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3", name: "female_explainer.mp3", text: "고화질 AI 립싱크 음성 테스트로 미세한 표정과 입모양을 정교하게 구현합니다." },
      { id: "male", label: "남성 · 테크 해설", url: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", name: "male_tech.mp3", text: "미래형 AI 디지털 휴먼 스튜디오에서 자연스러운 오디오·비디오 동기화를 경험하세요." },
      { id: "ecom", label: "라이브 커머스 · 추천", url: "https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3", name: "ecommerce_host.mp3", text: "오늘 소개해 드릴 특별한 제품, 놀라운 혜택을 지금 바로 만나보세요!" },
      { id: "biz", label: "영어 · 비즈니스 피치", url: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3", name: "business_pitch.mp3", text: "Experience next-generation high-fidelity AI lip synchronization in real time." },
    ],
  },
  "zh-TW": {
    presetsTitle: "示範音訊:",
    relayPortraitToast: "已自動載入接力人像！",
    relayVideoToast: "已自動載入接力影片！",
    loadedPresetPrefix: "已載入預設音訊：",
    presets: [
      { id: "female", label: "女聲 · 自然播報", url: "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3", name: "female_explainer.mp3", text: "這是一段高畫質智慧對嘴語音測試，能夠精準還原臉部微表情與唇齒動作。" },
      { id: "male", label: "男聲 · 科技解說", url: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", name: "male_tech.mp3", text: "歡迎來到未來AI數位人工作台，體驗極致自然的聲畫同步效果。" },
      { id: "ecom", label: "帶貨口播 · 激情推薦", url: "https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3", name: "ecommerce_host.mp3", text: "大家快過來看，今天這款產品真的太驚喜了，手慢無趕緊衝！" },
      { id: "biz", label: "英文 · 商業陳述", url: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3", name: "business_pitch.mp3", text: "Experience next-generation high-fidelity AI lip synchronization in real time." },
    ],
  },
  "es": {
    presetsTitle: "Audios de muestra:",
    relayPortraitToast: "¡Retrato recibido cargado automáticamente!",
    relayVideoToast: "¡Video recibido cargado automáticamente!",
    loadedPresetPrefix: "Audio predefinido cargado: ",
    presets: [
      { id: "female", label: "Voz Femenina · Presentación", url: "https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3", name: "female_explainer.mp3", text: "Prueba de sincronización labial inteligente de alta definición con expresiones faciales precisas." },
      { id: "male", label: "Voz Masculina · Tecnología", url: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3", name: "male_tech.mp3", text: "Bienvenido al estudio de humanos digitales IA, experimenta una sincronización audiovisual natural." },
      { id: "ecom", label: "Locutor · Promo Comercial", url: "https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3", name: "ecommerce_host.mp3", text: "¡Descubre el producto estrella de hoy con una oferta exclusiva por tiempo limitado!" },
      { id: "biz", label: "Inglés · Pitch de Negocios", url: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3", name: "business_pitch.mp3", text: "Experience next-generation high-fidelity AI lip synchronization in real time." },
    ],
  },
};

// ---------------------------------------------------------------------------
// Upload button states
// ---------------------------------------------------------------------------
const UPLOAD_STATE = {
  IDLE: "idle",
  UPLOADING: "uploading",
  READY: "ready",
};

function MediaPickerButton({
  accept,
  label,
  icon,
  onUpload,
  onClear,
  uploadState,
  progress,
  fileName,
  previewUrl,
  isVideo,
  apiKey,
  mediaCopy = en.media,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const acceptPrefix = accept?.split("/")[0];

  const handleClick = (e) => {
    e.stopPropagation();
    if (uploadState === UPLOAD_STATE.READY) {
      onClear();
      return;
    }
    inputRef.current?.click();
  };

  const handleChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = "";
    await onUpload(Array.from(files));
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (uploadState === UPLOAD_STATE.UPLOADING) return;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const matched = acceptPrefix
      ? Array.from(files).filter((f) => f.type.startsWith(`${acceptPrefix}/`))
      : Array.from(files);
    if (matched.length === 0) return;
    await onUpload(matched);
  };

  return (
    <button
      type="button"
      title={
        uploadState === UPLOAD_STATE.READY
          ? `${fileName} — ${mediaCopy.clickToClear}`
          : `${mediaCopy.uploadFilePrefix} ${label} ${mediaCopy.uploadFileSuffix}`
      }
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={promptMediaButtonClassName({
        active: uploadState === UPLOAD_STATE.READY,
        className: `${isDragging ? "ring-2 ring-brand ring-offset-1 ring-offset-black scale-105" : ""} cursor-pointer`,
      })}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />

      {/* Idle state */}
      {uploadState === UPLOAD_STATE.IDLE && (
        <div className="flex flex-col items-center justify-center gap-1 w-full h-full">
          {icon}
        </div>
      )}

      {/* Uploading indicator */}
      {uploadState === UPLOAD_STATE.UPLOADING && (
        <div className="flex flex-col items-center justify-center w-full h-full absolute inset-0 bg-black/80 z-20 backdrop-blur-[2px]">
          <svg className="w-8 h-8 -rotate-90">
            <circle
              cx="16"
              cy="16"
              r="14"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              className="text-white/10"
            />
            <circle
              cx="16"
              cy="16"
              r="14"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              strokeDasharray={88}
              strokeDashoffset={88 - (88 * progress) / 100}
              className="text-brand transition-[stroke-dashoffset] duration-300"
            />
          </svg>
          <span className="absolute text-[9px] font-black text-brand leading-none">
            {progress}%
          </span>
        </div>
      )}

      {/* Ready state */}
      {uploadState === UPLOAD_STATE.READY && (
        <div className="flex flex-col items-center justify-center gap-1 w-full h-full absolute inset-0 bg-brand-soft rounded-full group-hover:bg-brand-pressed transition-colors duration-fast ease-standard">
          {previewUrl ? (
            isVideo ? (
              <video
                src={previewUrl}
                className="w-full h-full object-cover"
                muted
              />
            ) : (
              <img
                src={previewUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center w-full px-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary mb-0.5">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span className="text-[7px] font-black text-primary uppercase truncate w-full text-center">
                {fileName?.split('.').pop() || "AUD"}
              </span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline dropdown
// ---------------------------------------------------------------------------
function Dropdown({
  isOpen,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  anchorRef,
  className = "",
}) {
  const dropRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (
        !dropRef.current?.contains(e.target) &&
        !anchorRef?.current?.contains(e.target)
      ) {
        onClose();
      }
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <PromptPopover
      ref={dropRef}
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      <PromptPopoverHeader>{title}</PromptPopoverHeader>
      <PromptMenuList>
      {items.map((item) => (
        <PromptMenuItem
          key={item.id}
          selected={item.id === selectedId}
          description={
            item.description
              ? `${item.description.slice(0, 60)}${
                  item.description.length > 60 ? "..." : ""
                }`
              : undefined
          }
          onClick={() => {
            onSelect(item);
            onClose();
          }}
        >
          {item.name}
        </PromptMenuItem>
      ))}
      </PromptMenuList>
    </PromptPopover>
  );
}

// ---------------------------------------------------------------------------
// History sidebar thumbnail
// ---------------------------------------------------------------------------
function HistoryThumb({ entry, isActive, onSelect, onDownload }) {
  return (
    <div
      onClick={onSelect}
      className={`relative group/thumb cursor-pointer rounded-lg overflow-hidden border-2 transition-[border-color,box-shadow] duration-fast ease-standard ${
        isActive
          ? "border-primary shadow-glow"
          : "border-white/10 hover:border-white/30"
      }`}
    >
      <video
        src={entry.url}
        preload="metadata"
        muted
        className="w-full aspect-square object-cover"
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover/thumb:pointer-events-auto group-hover/thumb:opacity-100 group-focus-within/thumb:pointer-events-auto group-focus-within/thumb:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDownload(entry);
          }}
          className="p-1.5 bg-brand text-ink-on-accent rounded-lg hover:bg-brand-hover active:bg-brand-active active:scale-95 active:duration-instant transition-[background-color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
          title="Download"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------
const MicIcon = ({
  className = "text-muted group-hover:text-primary transition-colors",
}) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
  </svg>
);

const VideoIcon = ({
  className = "text-muted group-hover:text-primary transition-colors",
}) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
  >
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function LipSyncStudio({
  apiKey,
  initialPrompt = "",
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
  historyItems,
  droppedFiles,
  onFilesHandled,
  locale = "en",
}) {
  const copy = resolveCopy(en, LIPSYNC_MESSAGES, locale);
  const relayCopy = resolveCopy(LIPSYNC_RELAY_COPY_EN, LIPSYNC_RELAY_COPY_LOCALES, locale);
  const LEGACY_PERSIST_KEY = "hg_lipsync_studio_persistent";
  const PERSIST_KEY = scopedPersistKey(LEGACY_PERSIST_KEY, apiKey);
  useEffect(() => {
    migrateLegacyPersistKey(LEGACY_PERSIST_KEY, PERSIST_KEY);
  }, [PERSIST_KEY]);

  // ── Mode & model state ──────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState("image"); // 'image' | 'video'

  const currentModels =
    inputMode === "image" ? imageLipSyncModels : videoLipSyncModels;
  const firstModel = currentModels[0];

  const [selectedModelId, setSelectedModelId] = useState(firstModel?.id ?? "");
  const [selectedResolution, setSelectedResolution] = useState(
    firstModel?.inputs?.resolution?.default ?? "480p",
  );

  // ── Upload state ────────────────────────────────────────────────────────
  const [imageState, setImageState] = useState(UPLOAD_STATE.IDLE);
  const [imageName, setImageName] = useState("");
  const [imageUrl, setImageUrl] = useState(null);

  const [videoState, setVideoState] = useState(UPLOAD_STATE.IDLE);
  const [videoName, setVideoName] = useState("");
  const [videoUrl, setVideoUrl] = useState(null);

  const [audioState, setAudioState] = useState(UPLOAD_STATE.IDLE);
  const [audioName, setAudioName] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);

  // ── Individual progress states ──
  const [imageProgress, setImageProgress] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);

  // ── Prompt ──────────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(initialPrompt || "");
  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);

  // ── Generation / UI state ───────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [fullscreenUrl, setFullscreenUrl] = useState(null);
  const [view, setView] = useState("input"); // 'input' | 'result'
  const [activeResultUrl, setActiveResultUrl] = useState(null);

  // ── History ─────────────────────────────────────────────────────────────
  // If historyItems prop is provided, use it; otherwise use internal state.
  const [internalHistory, setInternalHistory] = useState([]);
  const history = historyItems ?? internalHistory;
  const [activeHistoryIdx, setActiveHistoryIdx] = useState(0);

  // ── Dropdown state ──────────────────────────────────────────────────────
  const [openDropdown, setOpenDropdown] = useState(null); // 'model' | 'resolution' | null
  const modelBtnRef = useRef(null);
  const resolutionBtnRef = useRef(null);
  const textareaRef = useRef(null);

  // ── Video ref for result ────────────────────────────────────────────────
  const resultVideoRef = useRef(null);
  const hasRestored = useRef(false);

  // ── Persistence: Load ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PERSIST_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.inputMode) setInputMode(data.inputMode);
        if (data.selectedModelId) setSelectedModelId(data.selectedModelId);
        if (data.selectedResolution) setSelectedResolution(data.selectedResolution);
        if (data.imageUrl) {
          setImageUrl(data.imageUrl);
          setImageState(UPLOAD_STATE.READY);
        }
        if (data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setVideoState(UPLOAD_STATE.READY);
        }
        if (data.audioUrl) {
          setAudioUrl(data.audioUrl);
          setAudioState(UPLOAD_STATE.READY);
        }
        if (data.imageName) setImageName(data.imageName);
        if (data.videoName) setVideoName(data.videoName);
        if (data.audioName) setAudioName(data.audioName);
        if (data.prompt) setPrompt(data.prompt);
        if (data.internalHistory) setInternalHistory(data.internalHistory);
      }
    } catch (err) {
      console.warn("Failed to load LipSyncStudio persistence:", err);
    } finally {
      hasRestored.current = true;
    }
  }, []);

  // ── Auto-fill media from relay or query parameter ────────────────────────────
  useEffect(() => {
    const handleRelay = (url) => {
      if (!url) return;
      const isImg = /\.(png|jpe?g|webp|gif|avif)($|\?)/i.test(url);
      if (isImg) {
        setInputMode("image");
        setImageUrl(url);
        setImageName("Relayed Portrait");
        setImageState(UPLOAD_STATE.READY);
        toast.success(relayCopy.relayPortraitToast);
      } else {
        setInputMode("video");
        setVideoUrl(url);
        setVideoName("Relayed Video");
        setVideoState(UPLOAD_STATE.READY);
        toast.success(relayCopy.relayVideoToast);
      }
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
  }, [relayCopy.relayPortraitToast, relayCopy.relayVideoToast]);

  // ── Persistence: Save ────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const state = {
          inputMode,
          selectedModelId,
          selectedResolution,
          imageUrl,
          imageName,
          videoUrl,
          videoName,
          audioUrl,
          audioName,
          prompt,
          internalHistory,
        };
        localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn("Failed to save LipSyncStudio persistence:", err);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [
    inputMode,
    selectedModelId,
    selectedResolution,
    imageUrl,
    imageName,
    videoUrl,
    videoName,
    audioUrl,
    audioName,
    prompt,
    internalHistory,
  ]);

  // ── Derived model info ──────────────────────────────────────────────────
  const selectedModel = lipsyncModels.find((m) => m.id === selectedModelId);
  const resolutionOptions = getResolutionsForLipSyncModel(selectedModelId);
  const showResolution = resolutionOptions.length > 0;
  const showPrompt = !!selectedModel?.hasPrompt;

  // ── Sync model when mode changes ────────────────────────────────────────
  useEffect(() => {
    if (hasRestored.current) return;
    const models =
      inputMode === "image" ? imageLipSyncModels : videoLipSyncModels;
    const first = models[0];
    if (!first) return;
    setSelectedModelId(first.id);
    setSelectedResolution(first.inputs?.resolution?.default ?? "480p");
  }, [inputMode]);

  // ── Upload handlers ─────────────────────────────────────────────────────
  const handleImageUpload = useCallback(
    async (files) => {
      const file = Array.isArray(files) ? files[0] : files;
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        alert(copy.errors.imageTooLarge);
        return;
      }
      setImageState(UPLOAD_STATE.UPLOADING);
      setImageProgress(0);
      try {
        const url = await uploadFile(apiKey, file, (pct) => {
          setImageProgress(pct);
        });
        setImageUrl(url);
        setImageName(file.name);
        setImageState(UPLOAD_STATE.READY);
      } catch (err) {
        setImageState(UPLOAD_STATE.IDLE);
        alert(copy.errors.imageUploadFailed.replace("{message}", err.message));
      } finally {
        setImageProgress(0);
      }
    },
    [apiKey],
  );

  const handleVideoPick = useCallback(
    async (files) => {
      const file = Array.isArray(files) ? files[0] : files;
      if (!file) return;
      if (file.size > 50 * 1024 * 1024) {
        alert(copy.errors.videoTooLarge);
        return;
      }
      setVideoState(UPLOAD_STATE.UPLOADING);
      setVideoProgress(0);
      try {
        const url = await uploadFile(apiKey, file, (pct) => {
          setVideoProgress(pct);
        });
        setVideoUrl(url);
        setVideoName(file.name);
        setVideoState(UPLOAD_STATE.READY);
      } catch (err) {
        setVideoState(UPLOAD_STATE.IDLE);
        alert(copy.errors.videoUploadFailed.replace("{message}", err.message));
      } finally {
        setVideoProgress(0);
      }
    },
    [apiKey],
  );

  const handlePromptInput = (e) => {
    setPrompt(e.target.value);
  };

  const handleAudioPick = useCallback(
    async (files) => {
      const file = Array.isArray(files) ? files[0] : files;
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        alert(copy.errors.audioTooLarge);
        return;
      }
      setAudioState(UPLOAD_STATE.UPLOADING);
      setAudioProgress(0);
      try {
        const url = await uploadFile(apiKey, file, (pct) => {
          setAudioProgress(pct);
        });
        setAudioUrl(url);
        setAudioName(file.name);
        setAudioState(UPLOAD_STATE.READY);
      } catch (err) {
        setAudioState(UPLOAD_STATE.IDLE);
        alert(copy.errors.audioUploadFailed.replace("{message}", err.message));
      } finally {
        setAudioProgress(0);
      }
    },
    [apiKey],
  );

  // ── Handle Dropped Files ────────────────────────────────────────────────
  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      const imageFiles = droppedFiles.filter(f => f.type.startsWith('image/'));
      const videoFiles = droppedFiles.filter(f => f.type.startsWith('video/'));
      const audioFiles = droppedFiles.filter(f => f.type.startsWith('audio/'));
      
      if (audioFiles.length > 0) {
        handleAudioPick(audioFiles[0]);
      } else if (videoFiles.length > 0) {
        switchToVideo();
        handleVideoPick(videoFiles[0]);
      } else if (imageFiles.length > 0) {
        switchToImage();
        handleImageUpload(imageFiles[0]);
      }
      onFilesHandled?.();
    }
  }, [droppedFiles, onFilesHandled, handleAudioPick, handleVideoPick, handleImageUpload]);

  // ── Mode toggle ─────────────────────────────────────────────────────────
  const switchToImage = () => {
    if (inputMode === "image") return;
    setInputMode("image");
    setVideoUrl(null);
    setVideoState(UPLOAD_STATE.IDLE);
    setVideoName("");
    const first = imageLipSyncModels[0];
    if (first) {
      setSelectedModelId(first.id);
      setSelectedResolution(first.inputs?.resolution?.default ?? "480p");
    }
  };

  const switchToVideo = () => {
    if (inputMode === "video") return;
    setInputMode("video");
    setImageUrl(null);
    setImageState(UPLOAD_STATE.IDLE);
    setImageName("");
    const first = videoLipSyncModels[0];
    if (first) {
      setSelectedModelId(first.id);
      setSelectedResolution(first.inputs?.resolution?.default ?? "480p");
    }
  };

  // ── Model selection ─────────────────────────────────────────────────────
  const handleModelSelect = (model) => {
    setSelectedModelId(model.id);
    const resolutions = getResolutionsForLipSyncModel(model.id);
    if (resolutions.length > 0) {
      setSelectedResolution(
        model.inputs?.resolution?.default ?? resolutions[0],
      );
    }
  };

  // ── History helpers ─────────────────────────────────────────────────────
  const addToInternalHistory = useCallback((entry) => {
    setInternalHistory((prev) => [entry, ...prev].slice(0, 30));
  }, []);

  const downloadFile = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
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
  };

  // ── Generation ──────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!audioUrl) {
      alert(copy.errors.needAudio);
      return;
    }
    if (inputMode === "image" && !imageUrl) {
      alert(copy.errors.needImage);
      return;
    }
    if (inputMode === "video" && !videoUrl) {
      alert(copy.errors.needVideo);
      return;
    }

    onGenerationStart?.();
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const lipsyncParams = {
        model: selectedModelId,
        audio_url: audioUrl,
      };
      if (inputMode === "image") lipsyncParams.image_url = imageUrl;
      else lipsyncParams.video_url = videoUrl;
      if (prompt && selectedModel?.hasPrompt) lipsyncParams.prompt = prompt;
      if (showResolution) lipsyncParams.resolution = selectedResolution;
      if (selectedModel?.hasSeed) lipsyncParams.seed = -1;

      const res = await processLipSync(apiKey, lipsyncParams);

      if (!res?.url) throw new Error("No video URL returned by API");

      const genId = res.id || Date.now().toString();
      const entry = {
        id: genId,
        url: res.url,
        prompt,
        model: selectedModelId,
        timestamp: new Date().toISOString(),
      };

      if (!historyItems) addToInternalHistory(entry);

      setActiveResultUrl(res.url);
      setActiveHistoryIdx(0);
      setView("result");

      if (onGenerationComplete) {
        onGenerationComplete({
          url: res.url,
          model: selectedModelId,
          prompt,
          type: "lipsync",
        });
      }
    } catch (e) {
      console.error("[LipSyncStudio]", e);
      const errMsg = formatErrorMessage(e, copy.errors.generationFailed);
      if (onGenerationError) onGenerationError(errMsg);
      else toast.error(errMsg);
    } finally {
      setIsGenerating(false);
      onGenerationEnd?.();
    }
  };

  // ── Reset to input view ─────────────────────────────────────────────────
  const handleNew = () => {
    setView("input");
    setActiveResultUrl(null);
    setPrompt("");
    setImageUrl(null);
    setImageState(UPLOAD_STATE.IDLE);
    setImageName("");
    setVideoUrl(null);
    setVideoState(UPLOAD_STATE.IDLE);
    setVideoName("");
    setAudioUrl(null);
    setAudioState(UPLOAD_STATE.IDLE);
    setAudioName("");
  };

  // ── Media status labels ─────────────────────────────────────────────────
  const mediaStatusText =
    inputMode === "image"
      ? imageState === UPLOAD_STATE.READY
        ? `✓ ${imageName}`
        : copy.media.noImage
      : videoState === UPLOAD_STATE.READY
        ? `✓ ${videoName}`
        : copy.media.noVideo;
  const mediaStatusClass =
    (inputMode === "image" ? imageState : videoState) === UPLOAD_STATE.READY
      ? "text-primary"
      : "text-muted";

  const audioStatusText =
    audioState === UPLOAD_STATE.READY ? `✓ ${audioName}` : copy.media.noAudio;
  const audioStatusClass =
    audioState === UPLOAD_STATE.READY ? "text-primary" : "text-muted";

  const hasHistory = history.length > 0;

  // ── Dropdown item lists ─────────────────────────────────────────────────
  const modelDropdownItems = currentModels;
  const resolutionDropdownItems = resolutionOptions.map((r) => ({
    id: r,
    name: r,
  }));

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-transparent relative overflow-hidden">
      
      {/* ── CENTRAL GALLERY AREA ── */}
      <div className="flex-1 w-full max-w-7xl mx-auto overflow-y-auto custom-scrollbar pb-40 lg:pb-32 px-2">
        {history.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full pt-4 animate-fade-in">
            {history.map((entry, idx) => (
              <div
                key={entry.id || idx}
                className="relative group rounded-2xl overflow-hidden border border-line bg-surface shadow-xl hover:border-brand-line transition-[border-color,box-shadow,transform] duration-fast ease-standard active:scale-[0.99] flex flex-col cursor-pointer"
                onClick={() => setFullscreenUrl(entry.url)}
              >
                <video
                  src={entry.url}
                  className="w-full aspect-video object-cover bg-black/40 hover:opacity-80 transition-opacity"
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
                <div className="pointer-events-none absolute top-2 right-2 hidden flex-col gap-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 md:flex">
                  <GenerationCopyButtons
                    prompt={entry.prompt}
                    onCopyError={onGenerationError}
                  />
                  <VideoRelayMenu
                    videoUrl={entry.url}
                    currentTab="lipsync"
                    locale={locale}
                  />
                  <button
                    type="button"
                    title={copy.actions.download}
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadFile(entry.url, `lipsync-${entry.id || idx}.mp4`);
                    }}
                    className="p-2 bg-overlay-glass backdrop-blur-md rounded-full text-ink hover:bg-brand hover:text-ink-on-accent active:bg-brand-active active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard border border-line-subtle cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title={copy.actions.delete}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(copy.confirm.deleteItem)) {
                        setInternalHistory(prev => prev.filter((_, i) => i !== idx));
                      }
                    }}
                    className="p-2 bg-overlay-glass backdrop-blur-md rounded-full text-danger hover:bg-danger hover:text-ink-on-accent active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard border border-line-subtle cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
                <MobileGenerationActions
                  prompt={entry.prompt}
                  onCopyError={onGenerationError}
                  actions={[
                    {
                      kind: "download",
                      label: copy.actions.download,
                      onSelect: () =>
                        downloadFile(entry.url, `lipsync-${entry.id || idx}.mp4`),
                    },
                    {
                      kind: "delete",
                      label: copy.actions.delete,
                      danger: true,
                      onSelect: () => {
                        if (confirm(copy.confirm.deleteItem)) {
                          setInternalHistory((prev) => prev.filter((_, i) => i !== idx));
                        }
                      },
                    },
                  ]}
                />

                {/* Details */}
                <div className="p-3 bg-black/80 backdrop-blur-sm border-t border-white/5 flex-1 flex flex-col justify-between gap-2">
                  {entry.prompt && (
                    <p className="text-white/70 text-xs line-clamp-2 leading-relaxed" title={entry.prompt}>
                      {entry.prompt}
                    </p>
                  )}
                  <div className="flex items-center justify-between flex-wrap gap-1 mt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-brand px-2 py-0.5 bg-brand-soft rounded border border-brand-line whitespace-nowrap">
                        {copy.badges.lipSync}
                      </span>
                      {entry.resolution && (
                        <span className="text-[10px] text-white/40">{entry.resolution}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
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
              <span className="text-white font-black uppercase text-xl sm:text-3xl tracking-wide mb-1 opacity-90">{copy.hero.titleLine1}</span>
              <span className="text-brand font-black uppercase text-2xl sm:text-4xl sm:mt-1 tracking-tight">
                {copy.hero.titleLine2}
              </span>
            </h1>
            <p className="text-white/40 text-xs sm:text-sm font-medium tracking-wide text-center max-w-lg leading-relaxed px-4">
              {copy.hero.subtitle}
            </p>
          </div>
        )}
      </div>

      {/* ── BOTTOM PROMPT BAR ── */}
      <PromptComposer>
          {/* Mode toggle row */}
          <div className="flex items-center px-1">
            <PromptSegmentedControl>
            <PromptSegmentOption
              type="button"
              onClick={switchToImage}
              selected={inputMode === "image"}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              {copy.modes.portraitImage}
            </PromptSegmentOption>
            <PromptSegmentOption
              type="button"
              onClick={switchToVideo}
              selected={inputMode === "video"}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="2" y="5" width="15" height="14" rx="2" />
                <path d="m17 10 5-3v10l-5-3" />
              </svg>
              {copy.modes.video}
            </PromptSegmentOption>
            </PromptSegmentedControl>
          </div>

          {/* Audio Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-rail py-1 px-1">
            <span className="text-micro font-bold uppercase tracking-wider text-ink-subtle shrink-0 mr-1">
              {relayCopy.presetsTitle}
            </span>
            {relayCopy.presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setAudioUrl(preset.url);
                  setAudioName(preset.name);
                  setAudioState(UPLOAD_STATE.READY);
                  setPrompt(preset.text);
                  toast.success(`${relayCopy.loadedPresetPrefix}${preset.label}`);
                }}
                className="rounded-full border border-line bg-wash px-2.5 py-0.5 text-micro font-medium text-ink-muted hover:border-brand-line hover:bg-wash-strong hover:text-ink transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer whitespace-nowrap shrink-0"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Uploads row */}
          <div className="flex items-center gap-2 px-1">
            <div className="flex items-center gap-2">
              {/* Image picker — only in image mode */}
              {inputMode === "image" && (
                <MediaPickerButton
                  accept="image/*"
                  label={copy.media.imageLabel}
                  mediaCopy={copy.media}
                  icon={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-white/40 group-hover:text-brand transition-colors"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  }
                  onUpload={handleImageUpload}
                  onClear={() => {
                    setImageUrl(null);
                    setImageState(UPLOAD_STATE.IDLE);
                    setImageName("");
                  }}
                  uploadState={imageState}
                  progress={imageProgress}
                  fileName={imageName}
                  previewUrl={imageUrl}
                  isVideo={false}
                  apiKey={apiKey}
                />
              )}

              {/* Video picker — only in video mode */}
              {inputMode === "video" && (
                <MediaPickerButton
                  accept="video/*"
                  label={copy.media.videoLabel}
                  mediaCopy={copy.media}
                  icon={
                    <VideoIcon className="text-white/40 group-hover:text-brand transition-colors" />
                  }
                  onUpload={handleVideoPick}
                  onClear={() => {
                    setVideoUrl(null);
                    setVideoState(UPLOAD_STATE.IDLE);
                    setVideoName("");
                  }}
                  uploadState={videoState}
                  progress={videoProgress}
                  fileName={videoName}
                  previewUrl={videoUrl}
                  isVideo={true}
                  apiKey={apiKey}
                />
              )}

              {/* Audio picker — always visible */}
              <MediaPickerButton
                accept="audio/*"
                label={copy.media.audioLabel}
                mediaCopy={copy.media}
                icon={
                  <MicIcon className="text-white/40 group-hover:text-brand transition-colors" />
                }
                onUpload={handleAudioPick}
                onClear={() => {
                  setAudioUrl(null);
                  setAudioState(UPLOAD_STATE.IDLE);
                  setAudioName("");
                }}
                uploadState={audioState}
                progress={audioProgress}
                fileName={audioName}
                previewUrl={null}
                isVideo={false}
                apiKey={apiKey}
              />
            </div>

            {/* Prompt textarea */}
            <div className="flex-1 flex flex-col">
              <PromptInputField
                ref={textareaRef}
                value={prompt}
                onChange={handlePromptInput}
                onEnter={handleGenerate}
                placeholder={copy.prompt.placeholder}
              />
            </div>
          </div>

          {/* Bottom controls row */}
          <PromptFooter>
            <PromptControls>
              {/* Model selector */}
              <div className="relative">
                <button
                  ref={modelBtnRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdown(
                      openDropdown === "model" ? null : "model",
                    );
                  }}
                  className={`${promptControlClassName({
                    active: openDropdown === "model",
                  })} cursor-pointer`}
                >
                  <div className="w-3.5 h-3.5 bg-brand rounded-sm flex items-center justify-center">
                    <span className="text-[9px] font-black text-black">
                      S
                    </span>
                  </div>
                  <span className={PROMPT_CONTROL_LABEL_CLASS}>
                    {selectedModel?.name ?? copy.model.selectModel}
                  </span>
                  <PromptChevronIcon />
                </button>
                <Dropdown
                  isOpen={openDropdown === "model"}
                  title={copy.model.dropdownTitle}
                  items={modelDropdownItems}
                  selectedId={selectedModelId}
                  onSelect={handleModelSelect}
                  onClose={() => setOpenDropdown(null)}
                  anchorRef={modelBtnRef}
                  className="w-80 max-w-[calc(100vw-3rem)]"
                />
              </div>

              {/* Resolution selector */}
              {showResolution && (
                <div className="relative">
                  <button
                    ref={resolutionBtnRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdown(
                        openDropdown === "resolution" ? null : "resolution",
                      );
                    }}
                    className={`${promptControlClassName({
                      active: openDropdown === "resolution",
                    })} cursor-pointer`}
                  >
                    <PromptQualityIcon />
                    <span className={PROMPT_CONTROL_LABEL_CLASS}>
                      {selectedResolution}
                    </span>
                  </button>
                  <Dropdown
                    isOpen={openDropdown === "resolution"}
                    title={copy.model.resolutionDropdownTitle}
                    items={resolutionDropdownItems}
                    selectedId={selectedResolution}
                    onSelect={(item) => setSelectedResolution(item.id)}
                    onClose={() => setOpenDropdown(null)}
                    anchorRef={resolutionBtnRef}
                  />
                </div>
              )}
            </PromptControls>

            {/* Generate button */}
            <PromptAction
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin inline-block text-black">
                    ◌
                  </span>{" "}
                  {copy.actions.generating}
                </>
              ) : (
                <>
                  <span>{copy.actions.generate}</span>
                </>
              )}
            </PromptAction>
          </PromptFooter>
      </PromptComposer>

      {/* ── FULLSCREEN MEDIA MODAL ── */}
      {fullscreenUrl && (
        <div 
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/95 backdrop-blur-sm animate-fade-in"
          onClick={() => setFullscreenUrl(null)}
        >
          <button
            type="button"
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-[background-color,transform] duration-fast ease-standard active:scale-95 active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring border border-white/10"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenUrl(null);
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <video 
            src={fullscreenUrl} 
            controls 
            autoPlay 
            loop 
            className="max-w-[95vw] max-h-[95vh] rounded-2xl shadow-2xl object-contain animate-scale-up" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <Toaster position="top-right" duration={5000} />
    </div>
  );
}
