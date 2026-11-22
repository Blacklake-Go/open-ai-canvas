"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { ToastHost as Toaster } from "../ui";
import { generateAudio, uploadFile } from "../muapi.js";
import { pollPlatformGeneration } from "../platformGeneration.js";
import { audioGenerationParameters, isMusicModel, mapServerAudioHistory, missingAudioFields, musicModes } from "../audioGeneration.js";
import { PromptInputField } from "./prompt/PromptInputField.jsx";
import { formatErrorMessage } from "../utils/formatError.js";
import { scopedPersistKey, migrateLegacyPersistKey } from "../persistKey.js";
import { audioModels, getAudioModelById, applyActiveModelDirectory } from "../models.js";
import { getProviderLogo } from "../providerLogos.js";
import { formatModelDisplayName } from "../modelDisplayFormat.js";
import { getModelBadge } from "../modelDescriptions.js";
import ModelDisplayRow from "./ModelDisplayRow.jsx";
import ModelPriceTag from "./ModelPriceTag.jsx";
import {ModelParameterInput} from './ModelParameterControls.jsx';
import en from "../messages/en/audioStudio.json";
import zh from "../messages/zh/audioStudio.json";
import ja from "../messages/ja-JP/audioStudio.json";
import ko from "../messages/ko-KR/audioStudio.json";
import zhTw from "../messages/zh-TW/audioStudio.json";
import es from "../messages/es/audioStudio.json";
import { resolveCopy } from "../i18nUtils";

const AUDIO_MESSAGES = {
  zh,
  'zh-CN': zh,
  'zh-TW': zhTw,
  'zh-HK': zhTw,
  'zh-Hant': zhTw,
  'zh-Hans': zh,
  ja,
  'ja-JP': ja,
  ko,
  'ko-KR': ko,
  es,
  // Alias kept for the legacy `/es-ES` URL prefix and stored preferences;
  // both now resolve to the single Spanish dictionary rather than a duplicate
  // copy that had to be hand-synced.
  'es-ES': es,
  en,
};

// ---------------------------------------------------------------------------
// Upload button states
// ---------------------------------------------------------------------------
const UPLOAD_STATE = {
  IDLE: "idle",
  UPLOADING: "uploading",
  READY: "ready",
};

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const VolumeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const VolumeMuteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

const MusicIcon = ({ className = "text-brand" }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
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

// ---------------------------------------------------------------------------
// Single File Uploader Component
// ---------------------------------------------------------------------------
function AudioFileUploader({ label, value, onChange, apiKey, copy = en, stableAssetUrl = false }) {
  const [uploadState, setUploadState] = useState(value ? UPLOAD_STATE.READY : UPLOAD_STATE.IDLE);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState(value ? value.split('/').pop().slice(-30) : "");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (!value) {
      setUploadState(UPLOAD_STATE.IDLE);
      setFileName("");
      setProgress(0);
    } else if (uploadState !== UPLOAD_STATE.READY) {
      setUploadState(UPLOAD_STATE.READY);
      setFileName(value.split('/').pop().slice(-30));
    }
  }, [value]);

  const handleUpload = async (files) => {
    const file = files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error(copy.uploader.sizeLimitError);
      return;
    }

    setUploadState(UPLOAD_STATE.UPLOADING);
    setProgress(0);

    try {
      const url = await uploadFile(apiKey, file, (pct) => {
        setProgress(pct);
      }, {stableAssetUrl});
      setFileName(file.name);
      setUploadState(UPLOAD_STATE.READY);
      onChange(url);
    } catch (err) {
      setUploadState(UPLOAD_STATE.IDLE);
      toast.error(copy.uploader.uploadFailedError.replace('{message}', err.message));
    } finally {
      setProgress(0);
    }
  };

  const handleInputChange = (e) => {
    handleUpload(Array.from(e.target.files || []));
  };

  const clearFile = (e) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadState !== UPLOAD_STATE.IDLE) return;
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadState !== UPLOAD_STATE.IDLE) return;
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (uploadState !== UPLOAD_STATE.IDLE) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleUpload(Array.from(files));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
          {label}
        </label>
        {uploadState === UPLOAD_STATE.READY && (
          <button
            type="button"
            onClick={clearFile}
            className="text-xs font-medium text-danger hover:text-danger-hover active:scale-[0.98] active:duration-instant transition-[color,transform] duration-fast ease-standard uppercase tracking-wider flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger"
          >
            <TrashIcon /> {copy.uploader.clear}
          </button>
        )}
      </div>

      <div
        onClick={() => uploadState === UPLOAD_STATE.IDLE && fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative border rounded-xl p-4 transition-[background-color,border-color,box-shadow] duration-fast ease-standard flex items-center gap-3.5 cursor-pointer backdrop-blur-md ${
          isDragging
            ? "border-brand bg-brand-soft shadow-elevation-1"
            : uploadState === UPLOAD_STATE.READY
            ? "border-brand-line bg-brand-soft shadow-elevation-1"
            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleInputChange}
        />

        {uploadState === UPLOAD_STATE.IDLE && (
          <>
            <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center text-ink-muted border border-white/5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-ink">{copy.uploader.uploadPrompt}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">{copy.uploader.uploadHint}</div>
            </div>
          </>
        )}

        {uploadState === UPLOAD_STATE.UPLOADING && (
          <div className="w-full flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-ink mb-1.5 font-semibold">
                <span>{copy.uploader.uploading}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-brand rounded-full transition-[width] duration-base ease-standard" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        )}

        {uploadState === UPLOAD_STATE.READY && (
          <>
            <div className="w-10 h-10 rounded-lg bg-brand-soft flex items-center justify-center text-brand border border-brand-line">
              <MusicIcon className="text-brand" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="text-xs font-semibold text-ink truncate">{fileName}</div>
              <div className="text-[11px] text-brand font-medium mt-0.5">{copy.uploader.ready}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multiple File Uploader Component (for array fields like audios_list)
// ---------------------------------------------------------------------------
function AudioListUploader({ label, value = [], onChange, apiKey, maxItems = 2, copy = en, stableAssetUrl = false }) {
  const handleItemChange = (index, url) => {
    const newItems = [...value];
    if (url) {
      newItems[index] = url;
    } else {
      newItems.splice(index, 1);
    }
    onChange(newItems.filter(Boolean));
  };

  return (
    <div className="space-y-4">
      <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider">
        {label} {copy.uploader.maxSuffix.replace('{max}', maxItems)}
      </label>
      <div className="space-y-3">
        {Array.from({ length: maxItems }).map((_, i) => (
          <AudioFileUploader
            stableAssetUrl={stableAssetUrl}
            key={i}
            label={copy.uploader.trackLabel.replace('{index}', i + 1)}
            value={value[i] || null}
            onChange={(url) => handleItemChange(i, url)}
            apiKey={apiKey}
            copy={copy}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audio player: the timeline reflects actual media metadata and playback.
// ---------------------------------------------------------------------------
function PremiumAudioPlayer({ url, title, copy = en }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);
  const [playbackError, setPlaybackError] = useState(null);

  // Reset player when URL changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(null);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [url]);

  // Audio state event listeners
  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0);
    }
  };

  const onAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Toggle playback
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Audio playback error:", err);
        setPlaybackError(copy.player.playbackError);
      });
    }
  };

  // Volume control
  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    if (val === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  // Scrubbing
  const handleScrub = (e) => {
    if (!audioRef.current || duration === 0) return;
    const seekTime = Number(e.target.value);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  // Helper formatting time
  const formatTime = (time) => {
    if (!Number.isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const downloadAudio = async () => {
    try {
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Audio download failed');
      const blob = await response.blob();
      if (!blob.type.startsWith('audio/')) throw new Error('Audio download returned invalid content');
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const extension = /wav/i.test(blob.type) ? 'wav' : 'mp3';
      a.download = `${title ? title.replace(/[^\p{L}\p{N}._-]+/gu, '_') : 'generated_audio'}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      setPlaybackError(copy.player.downloadError);
    }
  };

  return (
    <div className="w-full bg-surface-glass/85 border border-white/10 rounded-2xl p-6 lg:p-8 shadow-elevation-3 space-y-6 backdrop-blur-2xl">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onAudioEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => setPlaybackError(copy.player.playbackError)}
        preload="metadata"
      />

      {/* Visualizer and Track Details */}
      <div className="flex flex-col items-center justify-center py-6 relative rounded-xl bg-black/40 overflow-hidden border border-white/5 backdrop-blur-md">
        <div className="mb-4 flex h-12 items-center justify-center"><MusicIcon /></div>
        <div className="text-center px-4 max-w-full relative z-10">
          <span className="text-xs font-bold text-brand uppercase tracking-[0.2em] block mb-1">
            {copy.player.nowPlaying}
          </span>
          <p className="text-ink font-bold text-base truncate max-w-sm">{title || copy.player.defaultTitle}</p>
        </div>
      </div>

      {/* Controls & Progress bar */}
      <div className="space-y-4">
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-ink-muted w-10 text-right">
            {formatTime(currentTime)}
          </span>
          
          <input type="range" aria-label={copy.player.seek} min="0" max={duration || 0} step="0.1"
            value={Math.min(currentTime, duration || 0)} disabled={!duration} onChange={handleScrub}
            className="range flex-1 cursor-pointer accent-brand" />

          <span className="text-xs font-mono font-medium text-ink-muted w-10 text-left">
            {formatTime(duration)}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2">
          {/* Volume Control */}
          <div className="flex items-center gap-2 group/volume w-24">
            <button
              onClick={toggleMute}
              className="p-2.5 bg-wash hover:bg-wash-strong active:scale-[0.98] active:duration-instant border border-line rounded-xl text-ink-muted hover:text-ink transition-[background-color,color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
              title={copy.player.muteUnmute}
              type="button"
            >
              {isMuted ? <VolumeMuteIcon /> : <VolumeIcon />}
            </button>
            <input
              type="range"
              aria-label={copy.player.volume}
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="range pointer-events-none w-16 h-1 bg-white/15 rounded-full appearance-none cursor-pointer accent-brand transition-colors opacity-0 group-hover/volume:pointer-events-auto group-hover/volume:opacity-100 group-focus-within/volume:pointer-events-auto group-focus-within/volume:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 max-sm:pointer-events-auto max-sm:opacity-100"
            />
          </div>

          {/* Main Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="w-12 h-12 bg-brand hover:bg-brand-hover active:bg-brand-active text-ink-on-accent rounded-full flex items-center justify-center transition-[background-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring shadow-elevation-brand cursor-pointer"
            title={isPlaying ? copy.player.pause : copy.player.play}
            type="button"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          {/* Download Button */}
          <button
            onClick={downloadAudio}
            className="px-4 py-2 bg-wash hover:bg-wash-strong border border-line hover:border-brand-line rounded-xl text-xs font-semibold text-ink flex items-center gap-2 active:scale-[0.98] active:duration-instant transition-[background-color,border-color,color,transform] duration-fast ease-standard cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
            title={copy.player.download}
            type="button"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span>{copy.player.download}</span>
          </button>
        </div>
      </div>
      {playbackError && <p role="alert" className="text-body-sm text-danger">{playbackError}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Audio Studio Component
// ---------------------------------------------------------------------------
export default function AudioStudio({
  apiKey,
  ownerUserId,
  hosted = false,
  initialModel,
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
  historyItems,
  droppedFiles,
  onFilesHandled,
  locale = "en",
}) {
  const copy = resolveCopy(en, AUDIO_MESSAGES, locale);
  const LEGACY_PERSIST_KEY = "hg_audio_studio_persistent";
  const PERSIST_KEY = scopedPersistKey(LEGACY_PERSIST_KEY, hosted ? `user:${ownerUserId || 'guest'}` : apiKey);
  const ownerScopeRef = useRef(PERSIST_KEY);
  ownerScopeRef.current = PERSIST_KEY;
  const generatingRef = useRef(false);
  const [loadedPersistKey, setLoadedPersistKey] = useState(null);
  useEffect(() => {
    if (!hosted) migrateLegacyPersistKey(LEGACY_PERSIST_KEY, PERSIST_KEY);
  }, [PERSIST_KEY]);

  const AUDIO_MODEL_ALIASES = {
    'suno': 'suno-create-music',
    'suno-v4': 'suno-create-music',
    'suno-music': 'suno-create-music',
    'minimax-music': 'minimax-music-3.0',
    'minimax-music-3': 'minimax-music-3.0',
    'minimax-music-3-0': 'minimax-music-3.0',
    'minimax-speech': 'minimax-speech-2.6-hd',
    'elevenlabs': 'elevenlabs-text-to-dialogue-v3',
    'elevenlabs-v3': 'elevenlabs-text-to-dialogue-v3',
    'mmaudio': 'mmaudio-v2-text-to-audio',
  };

  const [directoryRevision, setDirectoryRevision] = useState(0);
  const [directoryLoaded, setDirectoryLoaded] = useState(false);
  useEffect(() => {
    let mounted = true;
    const refresh = () => setDirectoryRevision(value => value + 1);
    window.addEventListener('supdance-model-pricing-updated', refresh);
    fetch('/api/models/active?schemaVersion=2&nocache=1', {cache:'no-store'})
      .then(response => { if (!response.ok) throw new Error('模型目录不可用'); return response.json(); })
      .then(data => { if (mounted) applyActiveModelDirectory(Array.isArray(data.models) ? data.models : []); })
      .catch(() => { if (mounted) applyActiveModelDirectory([]); })
      .finally(() => { if (mounted) setDirectoryLoaded(true); });
    return () => { mounted = false; window.removeEventListener('supdance-model-pricing-updated', refresh); };
  }, []);

  const resolveAudioModelId = useCallback((modelKey) => {
    if (!modelKey) return audioModels[0]?.id ?? "";
    const rawKey = String(modelKey).trim();
    const cleanKey = AUDIO_MODEL_ALIASES[rawKey] || AUDIO_MODEL_ALIASES[rawKey.toLowerCase()] || rawKey;
    const keyLower = cleanKey.toLowerCase();
    const found = audioModels.find(
      (m) =>
        m.id.toLowerCase() === keyLower ||
        m.canonicalModelId?.toLowerCase() === keyLower ||
        (m.endpoint && m.endpoint.toLowerCase() === keyLower) ||
        (m.family && m.family.toLowerCase() === keyLower) ||
        keyLower.includes(m.id.toLowerCase())
    );
    return found?.id || rawKey;
  }, []);

  // ── Mode & model state ──────────────────────────────────────────────────
  const [selectedModelId, setSelectedModelId] = useState(() => {
    const urlModel = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('model') : null;
    return resolveAudioModelId(initialModel || urlModel);
  });
  const [params, setParams] = useState({});
  const [openDropdown, setOpenDropdown] = useState(false);
  const [openParamDropdown, setOpenParamDropdown] = useState(null);
  const modelBtnRef = useRef(null);
  const sidebarRef = useRef(null);

  // Sync with initialModel prop updates and URL ?model=
  useEffect(() => {
    const urlModel = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('model') : null;
    const targetModel = initialModel || urlModel;
    if (targetModel) {
      const resolved = resolveAudioModelId(targetModel);
      if (resolved) setSelectedModelId(resolved);
    }
  }, [initialModel, resolveAudioModelId, directoryRevision]);

  // Sync with global supdance-select-model custom events
  useEffect(() => {
    const handleSelectModelEvent = (e) => {
      const detail = e.detail;
      const modelKey = typeof detail === "string" ? detail : (detail?.modelKey || detail?.modelId);
      const tabId = detail?.tabId;
      if (tabId && tabId !== "audio") return;
      if (modelKey) {
        const resolved = resolveAudioModelId(modelKey);
        if (resolved) setSelectedModelId(resolved);
      }
    };
    window.addEventListener("supdance-select-model", handleSelectModelEvent);
    return () => window.removeEventListener("supdance-select-model", handleSelectModelEvent);
  }, [resolveAudioModelId]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setOpenDropdown(false);
        setOpenParamDropdown(null);
      }
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  // ── Generation state ──────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [pendingTask, setPendingTask] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [activeResultUrl, setActiveResultUrl] = useState(null);
  const [activeResultTitle, setActiveResultTitle] = useState("");
  const [view, setView] = useState("input"); // 'input' | 'result'

  // ── History state ────────────────────────────────────────────────────
  const [internalHistory, setInternalHistory] = useState([]);
  const history = historyItems ?? internalHistory;
  const [activeHistoryIdx, setActiveHistoryIdx] = useState(0);

  const selectedModel = getAudioModelById(selectedModelId);
  const availableMusicModes = musicModes(selectedModel);
  const selectedMusicMode = params.is_instrumental === true ? 'instrumental' : params.lyrics_optimizer === true ? 'description' : 'lyrics';
  useEffect(() => {
    if (directoryLoaded && !getAudioModelById(selectedModelId)) {
      setSelectedModelId((audioModels.find(isMusicModel) || audioModels[0])?.id || '');
    }
  }, [directoryRevision, directoryLoaded, selectedModelId]);
  const selectedModelDisplayName = selectedModel
    ? formatModelDisplayName(
      copy.models?.[selectedModel.id]?.name || selectedModel.name,
      { provider: selectedModel.family || selectedModel.provider, modelId: selectedModel.id },
    )
    : copy.sidebar.selectModel;

  // ── Initialize params when model changes ──────────────────────────────
  useEffect(() => {
    if (!selectedModel) return;
    const initial = {};
    Object.entries(selectedModel.inputs || {}).forEach(([key, schema]) => {
      // Don't overwrite parameters if already in state and valid
      if (params[key] !== undefined) {
        if (schema.enum) {
          const enumValues = schema.enum.map(opt => typeof opt === "object" ? opt.value : opt);
          if (enumValues.includes(params[key])) {
            initial[key] = params[key];
          } else {
            initial[key] = schema.default !== undefined ? schema.default : enumValues[0];
          }
        } else if (schema.type === "boolean") {
          initial[key] = typeof params[key] === "boolean" ? params[key] : (schema.default ?? false);
        } else if (schema.type === "int" || schema.type === "integer" || schema.type === "float" || schema.type === "number") {
          if (typeof params[key] === "number" && !isNaN(params[key])) {
            let val = params[key];
            if (schema.minValue !== undefined) val = Math.max(schema.minValue, val);
            if (schema.maxValue !== undefined) val = Math.min(schema.maxValue, val);
            initial[key] = val;
          } else {
            initial[key] = schema.default !== undefined ? schema.default : 0;
          }
        } else {
          initial[key] = params[key];
        }
      } else {
        initial[key] = schema.default !== undefined ? schema.default : (schema.enum ? (typeof schema.enum[0] === 'object' ? schema.enum[0].value : schema.enum[0]) : "");
      }
    });
    setParams(initial);
  }, [selectedModelId, selectedModel?.capabilityVersion]);

  // ── Persistence: Load ────────────────────────────────────────────────────
  useEffect(() => {
    setLoadedPersistKey(null);
    setParams({});
    setInternalHistory([]);
    setActiveResultUrl(null);
    setActiveResultTitle('');
    setGenerateError(null);
    setPendingTask(null);
    setHistoryError(null);
    setView('input');
    generatingRef.current = false;
    setIsGenerating(false);
    try {
      const stored = localStorage.getItem(PERSIST_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.selectedModelId) setSelectedModelId(data.selectedModelId);
        if (data.params) setParams(data.params);
        if (!hosted) {
          if (data.internalHistory) setInternalHistory(data.internalHistory);
          if (data.activeResultUrl) setActiveResultUrl(data.activeResultUrl);
          if (data.activeResultTitle) setActiveResultTitle(data.activeResultTitle);
          if (data.view) setView(data.view);
        }
      }
    } catch (err) {
      console.warn("Failed to load AudioStudio persistence:", err);
    }
    setLoadedPersistKey(PERSIST_KEY);
  }, [PERSIST_KEY]);

  // Hosted history is authoritative and supplies stable owner-scoped asset links.
  useEffect(() => {
    if (!ownerUserId || historyItems || isGenerating) return;
    const controller = new AbortController();
    fetch('/api/generations?limit=100', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('History unavailable'); return response.json(); })
      .then(data => {
        if (controller.signal.aborted) return;
        setInternalHistory(mapServerAudioHistory(data.creations));
        setPendingTask((data.creations || []).find(task => ['audio', 'music'].includes(task.studio_id) && ['queued', 'processing'].includes(task.status)) || null);
        setHistoryError(null);
      })
      .catch(() => { if (!controller.signal.aborted) setHistoryError(copy.history.unavailable); });
    return () => controller.abort();
  }, [ownerUserId, historyItems, isGenerating]);

  // ── Persistence: Save ────────────────────────────────────────────────────
  useEffect(() => {
    if (loadedPersistKey !== PERSIST_KEY) return;
    const timer = setTimeout(() => {
      try {
        const state = {
          selectedModelId,
          params,
          ...(!hosted ? { internalHistory, activeResultUrl, activeResultTitle, view } : {}),
        };
        localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn("Failed to save AudioStudio persistence:", err);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [PERSIST_KEY, loadedPersistKey, selectedModelId, params, internalHistory, activeResultUrl, activeResultTitle, view]);

  // ── Handle Dropped Files ────────────────────────────────────────────────
  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      const audioFiles = droppedFiles.filter(f => f.type.startsWith('audio/'));
      if (audioFiles.length > 0 && selectedModel) {
        // Find the first audio input field in the current model
        const firstAudioField = Object.entries(selectedModel.inputs || {}).find(
          ([_, schema]) => schema.field === 'audio' && schema.type === 'string'
        );
        const firstAudioListField = Object.entries(selectedModel.inputs || {}).find(
          ([_, schema]) => ['audios_list','audio'].includes(schema.field) && schema.type === 'array'
        );

        if (firstAudioField) {
          const [key] = firstAudioField;
          // Trigger file upload helper
          uploadFile(apiKey, audioFiles[0], () => {}, {stableAssetUrl:Boolean(selectedModel.published)})
            .then(url => {
              setParams(prev => ({ ...prev, [key]: url }));
            })
            .catch(err => toast.error(copy.generate.droppedFileUploadError.replace('{message}', err.message)));
        } else if (firstAudioListField) {
          const [key] = firstAudioListField;
          uploadFile(apiKey, audioFiles[0], () => {}, {stableAssetUrl:Boolean(selectedModel.published)})
            .then(url => {
              setParams(prev => {
                const currentList = Array.isArray(prev[key]) ? [...prev[key]] : [];
                if (currentList.length < 2) currentList.push(url);
                return { ...prev, [key]: currentList };
              });
            })
            .catch(err => toast.error(copy.generate.droppedFileUploadError.replace('{message}', err.message)));
        }
      }
      onFilesHandled?.();
    }
  }, [droppedFiles, onFilesHandled, selectedModel, apiKey]);

  // ── History helpers ─────────────────────────────────────────────────────
  const addToInternalHistory = useCallback((entry) => {
    setInternalHistory((prev) => [entry, ...prev].slice(0, 30));
  }, []);

  const handleSelectHistory = (entry, index) => {
    setActiveResultUrl(entry.url);
    setActiveResultTitle(entry.title || entry.prompt || copy.player.defaultTitle);
    setActiveHistoryIdx(index);
    setView("result");
  };

  const acceptResult = (res, { modelId = selectedModelId, prompt = params.prompt || '', title = params.title } = {}) => {
    if (!res?.url) throw new Error(copy.generate.noUrlError);
    const entry = { id: res.id, url: res.url, title: title || prompt || modelId, prompt, model: modelId, timestamp: new Date().toISOString() };
    if (!historyItems) addToInternalHistory(entry);
    setActiveResultUrl(res.url);
    setActiveResultTitle(entry.title);
    setView('result');
    setActiveHistoryIdx(0);
    setPendingTask(null);
    onGenerationComplete?.({ url: res.url, model: modelId, prompt, type: 'audio' });
  };

  const handleGenerate = async () => {
    if (!selectedModel || generatingRef.current || pendingTask) return;
    const parameters = audioGenerationParameters(selectedModel, params);
    const missing = missingAudioFields(selectedModel, parameters);
    if (missing.length) {
      const field = missing[0];
      toast.error(copy.sidebar.requiredFieldError.replace('{field}', copy.fields?.[field]?.title || selectedModel.inputs?.[field]?.title || field));
      return;
    }
    const scope = PERSIST_KEY;
    generatingRef.current = true;
    onGenerationStart?.();
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await generateAudio(apiKey, {
        ...parameters, _modelId: selectedModelId,
        onRequestId: id => { if (ownerScopeRef.current === scope) setPendingTask({ id, model: selectedModelId }); },
      });
      if (ownerScopeRef.current === scope) acceptResult(res);
    } catch (error) {
      if (ownerScopeRef.current !== scope) return;
      if (error.requestId) setPendingTask(error.pending ? { id: error.requestId, model: selectedModelId } : null);
      const message = formatErrorMessage(error, copy.generate.genericError);
      setGenerateError(message);
      onGenerationError?.(message);
    } finally {
      if (ownerScopeRef.current === scope) {
        generatingRef.current = false;
        setIsGenerating(false);
        onGenerationEnd?.();
      }
    }
  };

  const handleResume = async () => {
    if (!pendingTask || generatingRef.current) return;
    const scope = PERSIST_KEY;
    const original = pendingTask;
    generatingRef.current = true;
    setIsGenerating(true);
    setGenerateError(null);
    onGenerationStart?.();
    try {
      const result = await pollPlatformGeneration({ creationId: original.id });
      if (ownerScopeRef.current === scope) acceptResult(result, { modelId: original.model, title: original.label });
    } catch (error) {
      if (ownerScopeRef.current !== scope) return;
      if (!error.pending) setPendingTask(null);
      setGenerateError(formatErrorMessage(error, copy.generate.genericError));
    } finally {
      if (ownerScopeRef.current === scope) {
        generatingRef.current = false;
        setIsGenerating(false);
        onGenerationEnd?.();
      }
    }
  };

  const handleNew = () => {
    setView("input");
    setActiveResultUrl(null);
    setActiveResultTitle("");
  };

  return (
    <div className="w-full h-full flex bg-transparent text-white overflow-hidden relative">
      
      {/* ─── LEFT CONFIGURATION SIDEBAR ─── */}
      <div ref={sidebarRef} className="w-full lg:w-[400px] border-r border-white/10 flex flex-col bg-surface-glass/80 backdrop-blur-2xl flex-shrink-0 z-30">
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6 pb-28">
          
          {/* Model Selector */}
          <div className="space-y-2 relative">
            <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider block">
              {copy.sidebar.modelLabel}
            </label>
            <button
              ref={modelBtnRef}
              type="button"
              onClick={() => setOpenDropdown(!openDropdown)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-wash px-4 py-3.5 text-label font-medium text-ink transition-[background-color,border-color,transform] duration-fast ease-standard hover:border-brand-line/50 hover:bg-wash-strong active:scale-[0.98] active:duration-instant cursor-pointer backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                {(() => {
                  const logo = getProviderLogo(selectedModel?.family || selectedModel?.id);
                  return logo ? (
                    <img
                      src={logo}
                      alt=""
                      className="size-4 shrink-0 rounded-md object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null;
                })()}
                <span
                  title={selectedModelDisplayName}
                  className="min-w-0 truncate whitespace-nowrap"
                >
                  {selectedModelDisplayName}
                </span>
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${openDropdown ? 'rotate-180' : ''}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {openDropdown && (
              <div className="absolute left-0 right-0 z-popover mt-2 max-h-60 overflow-y-auto rounded-xl border border-line-strong bg-overlay-glass p-1.5 shadow-elevation-3 scrollbar-rail backdrop-blur-2xl">
                {audioModels.map((model) => {
                  const localizedModelName = copy.models?.[model.id]?.name || model.name;
                  const localizedModelDesc = copy.models?.[model.id]?.description || model.description;
                  const provider = model.family || model.provider;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      aria-pressed={model.id === selectedModelId}
                      onClick={() => {
                        setSelectedModelId(model.id);
                        setOpenDropdown(false);
                      }}
                      className={`w-full cursor-pointer rounded-lg border text-left transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring ${
                        model.id === selectedModelId ? "border-line bg-wash-strong" : "border-transparent bg-transparent hover:bg-wash-strong"
                      }`}
                    >
                      <ModelDisplayRow
                        name={localizedModelName}
                        modelId={model.id}
                        provider={provider}
                        badge={model.badge || model.version || getModelBadge(model.id)}
                        description={localizedModelDesc}
                        trailing={<ModelPriceTag ids={model.id} locale={locale} className="flex-shrink-0" />}
                        selected={model.id === selectedModelId}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedModel && <p className="text-caption text-ink-muted">{isMusicModel(selectedModel) ? copy.sidebar.musicGroup : copy.sidebar.speechGroup}</p>}
          {pendingTask && <div role="status" className="space-y-2 rounded-xl border border-line bg-well p-3 text-body-sm text-ink-muted">
            <p>{copy.generate.pending}</p>
            <button type="button" disabled={isGenerating} onClick={handleResume}
              className="rounded-lg px-3 py-2 text-brand-text hover:bg-wash focus-visible:outline focus-visible:outline-1 disabled:opacity-50">{copy.generate.resume}</button>
          </div>}
          {availableMusicModes.length > 1 && <label className="block space-y-2 text-body-sm text-ink-muted">
            <span>{copy.sidebar.musicMode}</span>
            <select aria-label={copy.sidebar.musicMode} value={selectedMusicMode}
              onChange={event => setParams(previous => ({ ...previous,
                ...(selectedModel.inputs.is_instrumental ? { is_instrumental: event.target.value === 'instrumental' } : {}),
                ...(selectedModel.inputs.lyrics_optimizer ? { lyrics_optimizer: event.target.value === 'description' } : {}),
              }))}
              className="w-full rounded-lg border border-line bg-well px-3 py-2 text-ink focus-visible:outline focus-visible:outline-1">
              {availableMusicModes.map(mode => <option key={mode} value={mode}>{copy.sidebar.musicModes[mode]}</option>)}
            </select>
          </label>}

          {/* Model Description */}
          {selectedModel && (copy.models?.[selectedModel.id]?.description || selectedModel.description) && (
            <div>
              <span className="text-[10px] font-bold text-brand uppercase tracking-wider block mb-1.5">{copy.sidebar.descriptionLabel}</span>
              <p className="text-zinc-400 text-xs leading-relaxed font-normal">
                {copy.models?.[selectedModel.id]?.description || selectedModel.description}
              </p>
            </div>
          )}

          {/* Dynamic Configuration Form */}
          <div className="space-y-5">
            {selectedModel && Object.entries(selectedModel.inputs || {}).map(([key, schema]) => {
              if (availableMusicModes.length > 1 && (['is_instrumental', 'lyrics_optimizer'].includes(key) || (key === 'lyrics' && selectedMusicMode !== 'lyrics'))) return null;
              const fieldMeta = copy.fields?.[key] || {};
              const fieldTitle = fieldMeta.title || schema.title || key;
              const fieldDescription = fieldMeta.description || schema.description || "";
              const fieldPlaceholder = fieldMeta.placeholder || schema.placeholder || fieldDescription || (copy.sidebar?.fieldPlaceholder ? copy.sidebar.fieldPlaceholder.replace('{field}', fieldTitle) : "");
              const fieldOptions = fieldMeta.options || schema.optionLabels || {};

              // Dedicated Model Version Selector (e.g. Suno V3_5, V4, V4_5, V5, V5_5)
              if (key === 'model' && schema.enum) {
                const currentVal = params[key] || schema.default || "V5";
                return (
                  <div key={key} className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider block">
                        {fieldTitle || copy.sidebar?.modelVersionLabel || copy.fields?.model?.title || "Model Version"}
                      </label>
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-brand-soft border border-brand-line text-brand">
                        {currentVal}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-1.5 bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-xl">
                      {schema.enum.map((opt) => {
                        const val = typeof opt === "object" ? opt.value : opt;
                        const label = fieldOptions[val] || (typeof opt === "object" ? (opt.label || opt.value) : opt);
                        const isSelected = currentVal === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setParams(prev => ({ ...prev, [key]: val }))}
                            className={`py-2 px-2 rounded-lg text-xs font-semibold text-center transition-[background-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                              isSelected
                                ? "bg-brand text-white shadow-elevation-1 font-bold"
                                : "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {fieldDescription && (
                      <span className="block text-[11px] text-zinc-400 leading-normal">
                        {fieldDescription}
                      </span>
                    )}
                  </div>
                );
              }

              // Audio URL file upload (single)
              if (schema.type === "string" && schema.field === "audio") {
                return (
                  <AudioFileUploader
                    stableAssetUrl={Boolean(selectedModel.published)}
                    key={key}
                    label={fieldTitle}
                    value={params[key] || ""}
                    onChange={(url) => setParams(prev => ({ ...prev, [key]: url }))}
                    apiKey={apiKey}
                    copy={copy}
                  />
                );
              }

              // Audio URLs list file upload (multiple)
              if (schema.type === "array" && ['audios_list','audio'].includes(schema.field)) {
                return (
                  <AudioListUploader
                    stableAssetUrl={Boolean(selectedModel.published)}
                    key={key}
                    label={fieldTitle}
                    value={params[key] || []}
                    onChange={(urls) => setParams(prev => ({ ...prev, [key]: urls }))}
                    apiKey={apiKey}
                    maxItems={schema.maxItems || 2}
                    copy={copy}
                  />
                );
              }

              // Boolean Toggles
              if(selectedModel.published && (['array','object'].includes(schema.type) || Array.isArray(schema.type) || schema.anyOf || schema.oneOf)) {
                return <div key={key} className="space-y-2"><label className="block text-xs text-ink-muted">{fieldTitle}</label><ModelParameterInput key={`${selectedModel.id}:${key}`} schema={schema} label={fieldTitle} value={params[key]} onChange={value=>setParams(current=>({...current,[key]:value}))}/></div>;
              }
              if (schema.type === "boolean") {
                return (
                  <div key={key} className="flex items-center justify-between bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-xl p-4 transition-[background-color,border-color] duration-fast ease-standard hover:bg-white/[0.05] hover:border-white/20">
                    <div className="flex-1 pr-4">
                      <span className="block text-xs font-bold text-white tracking-tight">
                        {fieldTitle}
                      </span>
                      {fieldDescription && (
                        <span className="block text-[11px] text-zinc-400 leading-normal mt-1">
                          {fieldDescription}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setParams(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={`w-11 h-6 rounded-full p-1 transition-[background-color] duration-fast ease-standard active:scale-[0.98] active:duration-instant relative shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                        params[key] ? "bg-brand shadow-elevation-brand" : "bg-white/10 hover:bg-white/15"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform duration-fast ease-standard ${
                        params[key] ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </button>
                  </div>
                );
              }

              // Small Enum Pills (<= 3 options)
              if (schema.enum && schema.enum.length <= 3) {
                const currentVal = params[key] !== undefined ? params[key] : (schema.default || "");
                return (
                  <div key={key} className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      {fieldTitle}
                    </label>
                    <div className="flex gap-1.5 p-1.5 bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-xl">
                      {schema.enum.map((opt) => {
                        const val = typeof opt === "object" ? opt.value : opt;
                        const label = fieldOptions[val] || (typeof opt === "object" ? (opt.label || opt.value) : opt);
                        const isSelected = currentVal === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setParams(prev => ({ ...prev, [key]: val }))}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-center transition-[background-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                              isSelected
                                ? "bg-brand text-white shadow-elevation-1 font-bold"
                                : "text-zinc-300 hover:text-white hover:bg-white/[0.06]"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {fieldDescription && (
                      <span className="block text-[11px] text-zinc-400 leading-normal">
                        {fieldDescription}
                      </span>
                    )}
                  </div>
                );
              }

              // Enum Dropdowns (> 3 options)
              if (schema.enum) {
                const isOpen = openParamDropdown === key;
                return (
                  <div key={key} className="space-y-2 relative">
                    <label className="block text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      {fieldTitle}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenDropdown(false);
                        setOpenParamDropdown(isOpen ? null : key);
                      }}
                      className="w-full bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] active:duration-instant border border-white/10 hover:border-white/20 rounded-xl px-4 py-3.5 text-xs text-left font-medium text-white flex items-center justify-between transition-[background-color,border-color,transform] duration-fast ease-standard cursor-pointer backdrop-blur-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                    >
                      <span>{fieldOptions[params[key]] || params[key] || copy.sidebar.selectOption}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 right-0 mt-1.5 z-50 bg-[#161618]/95 backdrop-blur-2xl border border-white/15 rounded-xl shadow-elevation-3 max-h-60 overflow-y-auto custom-scrollbar p-1.5">
                        {schema.enum.map((opt) => {
                          const optionValue = typeof opt === "object" ? opt.value : opt;
                          const optionLabel = fieldOptions[optionValue] || (typeof opt === "object" ? (opt.label || opt.value) : opt);
                          return (
                            <button
                              key={optionValue}
                              type="button"
                              onClick={() => {
                                setParams(prev => ({ ...prev, [key]: optionValue }));
                                setOpenParamDropdown(null);
                              }}
                              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-medium transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant cursor-pointer border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring ${
                                params[key] === optionValue
                                  ? "text-brand bg-brand-soft border-brand-line font-bold"
                                  : "text-zinc-200 border-transparent hover:bg-white/[0.06] hover:text-white"
                              }`}
                            >
                              {optionLabel}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {fieldDescription && (
                      <span className="block text-[11px] text-zinc-400 leading-normal">
                        {fieldDescription}
                      </span>
                    )}
                  </div>
                );
              }

              // Number Sliders & Ranges
              const isNumber = schema.type === "int" || schema.type === "integer" || schema.type === "float" || schema.type === "number";
              const hasMinMax = schema.minValue !== undefined && schema.maxValue !== undefined;
              if (isNumber && hasMinMax) {
                const step = schema.step || (schema.type === "float" ? 0.05 : 1);
                return (
                  <div key={key} className="space-y-3 bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-xl p-4 transition-[background-color,border-color] duration-fast ease-standard hover:bg-white/[0.05] hover:border-white/20">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-white tracking-tight">{fieldTitle}</span>
                      <span className="text-brand font-mono bg-brand-soft px-2 py-0.5 rounded-md border border-brand-line text-[11px]">
                        {params[key] !== undefined ? params[key] : schema.default}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] text-zinc-400 font-medium w-6 text-right font-mono">{schema.minValue}</span>
                      <input
                        type="range"
                        min={schema.minValue}
                        max={schema.maxValue}
                        step={step}
                        value={params[key] !== undefined ? params[key] : (schema.default || 0)}
                        onChange={(e) => setParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                        className="range flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-brand transition-colors duration-fast"
                      />
                      <span className="text-[10px] text-zinc-400 font-medium w-6 text-left font-mono">{schema.maxValue}</span>
                    </div>
                    {fieldDescription && (
                      <span className="block text-[11px] text-zinc-400 leading-normal">
                        {fieldDescription}
                      </span>
                    )}
                  </div>
                );
              }

              // Prompt / Textarea Input
              if (key === "prompt" || key === "lyrics") {
                const exampleText = fieldMeta.example || schema.examples?.[0];
                return (
                  <div key={key} className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      {fieldTitle || copy.sidebar.lyricsPromptLabel}
                    </label>
                    <PromptInputField
                      aria-label={fieldTitle}
                      maxLength={schema.maxLength}
                      value={params[key] || ""}
                      onChange={(e) => setParams(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full bg-white/[0.04] backdrop-blur-md border border-white/10 focus:border-brand-line focus:ring-1 focus:ring-brand-ring rounded-xl p-3.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none transition-[border-color,box-shadow] duration-fast ease-standard min-h-[110px] resize-none leading-relaxed"
                      placeholder={fieldPlaceholder || copy.sidebar.promptPlaceholder}
                    />
                    {exampleText && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => setParams(prev => ({ ...prev, [key]: exampleText }))}
                          className="text-[11px] px-3 py-1 bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] active:duration-instant border border-white/10 hover:border-brand-line hover:text-white rounded-full transition-[background-color,border-color,color,transform] duration-fast ease-standard font-medium text-zinc-300 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                        >
                          "{exampleText.slice(0, 35)}..."
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              // Standard Text / Input fields
              return (
                <div key={key} className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    {fieldTitle}
                  </label>
                  <input
                    type={isNumber ? "number" : "text"}
                    value={params[key] !== undefined ? params[key] : ""}
                    placeholder={fieldPlaceholder}
                    onChange={(e) => {
                      const val = isNumber ? (e.target.value === "" ? "" : parseFloat(e.target.value)) : e.target.value;
                      setParams(prev => ({ ...prev, [key]: val }));
                    }}
                    className="w-full bg-white/[0.04] backdrop-blur-md border border-white/10 hover:border-white/20 focus:border-brand-line focus:ring-1 focus:ring-brand-ring rounded-xl px-4 py-3.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none transition-[border-color,box-shadow] duration-fast ease-standard shadow-inner"
                  />
                  {fieldDescription && (
                    <span className="block text-[11px] text-zinc-400 leading-normal">
                      {fieldDescription}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Dynamic Cost & Generate Section */}
        <div className="p-4 border-t border-white/10 bg-surface-glass/90 backdrop-blur-2xl absolute bottom-0 left-0 w-full lg:w-[400px] z-40">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !selectedModel || !directoryLoaded || Boolean(pendingTask)}
            className="w-full py-3.5 bg-brand text-ink-on-accent text-sm font-bold rounded-xl hover:bg-brand-hover active:bg-brand-active transition-[background-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring disabled:opacity-50 disabled:grayscale shadow-elevation-brand flex items-center justify-center gap-2.5 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>{copy.generate.generating}</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>{copy.generate.cta}</span>
              </>
            )}
          </button>
          {selectedModel && <div className="mt-2 text-center"><ModelPriceTag ids={selectedModel.id} locale={locale} /></div>}
        </div>
      </div>

      {/* ─── RIGHT CONTENT AREA ─── */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative z-20">
        
        {/* Main Display panel */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 flex flex-col justify-between">
          {historyError && <p role="alert" className="text-body-sm text-ink-muted">{historyError}</p>}
          
          <div className="flex-1 flex items-center justify-center min-h-[400px] mb-8">
            
            {/* 1. Error Display */}
            {generateError && (
              <div className="w-full max-w-md p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col items-center gap-4 animate-shake backdrop-blur-md">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-red-400 border border-red-500/30 shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="text-xs font-black text-red-400 uppercase tracking-widest block mb-1">
                    {copy.result.errorHeading}
                  </span>
                  <p className="text-white font-medium text-sm leading-relaxed">
                    {generateError}
                  </p>
                </div>
              </div>
            )}

            {/* 2. Generating / Loading View */}
            {isGenerating && !generateError && (
              <div className="flex flex-col items-center gap-6 animate-fade-in">
                <div className="relative">
                  <div className="w-24 h-24 border-[3px] border-white/10 border-t-brand rounded-full animate-spin shadow-elevation-brand" />
                  <div className="absolute inset-0 flex items-center justify-center text-brand">
                    <MusicIcon className="animate-pulse text-brand" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-xs font-black text-brand uppercase tracking-[0.3em] animate-pulse">
                    {copy.result.loadingHeading}
                  </div>
                  <div className="text-sm text-zinc-300 font-bold">
                    {copy.result.loadingSubtext}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Empty State (no audio, not loading, no error) */}
            {view === "input" && !isGenerating && !generateError && (
              <div className="flex flex-col items-center gap-6 max-w-md text-center p-8 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-elevation-2 relative group animate-fade-in">
                {/* Glow behind the icon */}
                <div className="absolute inset-0 bg-brand/5 blur-3xl rounded-full opacity-30 group-hover:opacity-50 transition-opacity duration-1000 pointer-events-none" />
                <div className="w-20 h-20 bg-white/[0.04] border border-white/15 rounded-2xl flex items-center justify-center shadow-inner relative z-10 transition-transform duration-500 group-hover:scale-105">
                  <MusicIcon className="text-brand w-9 h-9" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-white font-black text-xl mb-3 tracking-tight">{copy.result.emptyHeading}</h3>
                  <p className="text-sm text-zinc-300 font-medium leading-relaxed px-4">
                    {copy.result.emptyBody}
                  </p>
                </div>
              </div>
            )}

            {/* 4. Active Result Player Display */}
            {view === "result" && activeResultUrl && !isGenerating && !generateError && (
              <div className="w-full max-w-2xl animate-fade-in space-y-4">
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={handleNew}
                    className="text-xs font-bold text-zinc-200 hover:text-white flex items-center gap-2 active:scale-[0.98] active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 px-4 py-2 rounded-full cursor-pointer shadow-elevation-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
                    type="button"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="19" y1="12" x2="5" y2="12" />
                      <polyline points="12 19 5 12 12 5" />
                    </svg>
                    <span>{copy.result.newGeneration}</span>
                  </button>
                  <span className="text-[11px] font-bold text-emerald-400 px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> {copy.result.success}
                  </span>
                </div>
                <PremiumAudioPlayer url={activeResultUrl} title={activeResultTitle} copy={copy} />
              </div>
            )}

          </div>

          {/* ─── BOTTOM HISTORY FOOTER ─── */}
          {history.length > 0 && (
            <div className="border-t border-white/10 pt-6 w-full animate-fade-in">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-4 px-1">
                {copy.history.heading.replace('{count}', history.length)}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                {history.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    onClick={() => handleSelectHistory(entry, idx)}
                    className={`p-3.5 bg-white/[0.03] backdrop-blur-md border rounded-xl cursor-pointer transition-[background-color,border-color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant flex flex-col justify-between h-28 hover:bg-white/[0.07] hover:border-white/20 ${
                      activeResultUrl === entry.url && view === "result"
                        ? "border-brand-line bg-brand-soft/20 shadow-elevation-1"
                        : "border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        activeResultUrl === entry.url && view === "result" ? "bg-brand-soft text-brand border border-brand-line" : "bg-white/[0.06] text-zinc-300"
                      }`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-bold text-brand uppercase tracking-wider truncate">
                        {entry.model ? (copy.models?.[entry.model]?.name || entry.model.split('-').slice(0, 2).join(' ')) : copy.history.fallbackModel}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-white line-clamp-2 leading-tight">
                      {entry.title || entry.prompt || copy.history.untitled}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
      <Toaster position="top-right" duration={5000} />
    </div>
  );
}
