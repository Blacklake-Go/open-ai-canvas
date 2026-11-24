"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { ToastHost as Toaster } from "../ui";
import { generateImage, generateI2I, generateVideo, generateI2V, uploadFile } from "../muapi.js";
import { scopedPersistKey, migrateLegacyPersistKey } from "../persistKey.js";
import MobileGenerationActions, {
  CopyContentIcon,
} from "./MobileGenerationActions.jsx";
import VideoRelayMenu from "./VideoRelayMenu.jsx";
import {
  PromptAspectRatioIcon,
  PromptAction,
  PromptComposer,
  PromptControls,
  PromptFooter,
  PromptMenuItem,
  PromptMenuList,
  PromptPopover,
  PromptPopoverHeader,
  PromptQualityIcon,
  promptControlClassName,
  promptMediaButtonClassName,
} from "./prompt/PromptComposer.jsx";
import { PromptInputField } from "./prompt/PromptInputField.jsx";
import { usePromptMention } from "./prompt/PromptAttachments.jsx";
import en from "../messages/en/cinemaStudio.json";
import zh from "../messages/zh/cinemaStudio.json";
import ja from "../messages/ja-JP/cinemaStudio.json";
import ko from "../messages/ko-KR/cinemaStudio.json";
import zhTw from "../messages/zh-TW/cinemaStudio.json";
import es from "../messages/es/cinemaStudio.json";
import { resolveCopy } from "../i18nUtils";

const CINEMA_MESSAGES = {
  'zh-CN': zh,
  'ja-JP': ja,
  'ko-KR': ko,
  'zh-TW': zhTw,
  es: es,
  'es-ES': es,
};
import { isModelActive, subscribeModelDirectory, getVideoModelById, getI2VModelById, getModelById, getI2IModelById } from "../models.js";

// ─── Constants (inlined from promptUtils) ───────────────────────────────────

const CAMERA_MAP = {
  "Modular 8K Digital": "modular 8K digital cinema camera",
  "Full-Frame Cine Digital": "full-frame digital cinema camera",
  "Grand Format 70mm Film": "grand format 70mm film camera",
  "Studio Digital S35": "Super 35 studio digital camera",
  "Classic 16mm Film": "classic 16mm film camera",
  "Premium Large Format Digital": "premium large-format digital cinema camera",
};

const LENS_MAP = {
  "Creative Tilt Lens": "creative tilt lens effect",
  "Compact Anamorphic": "compact anamorphic lens",
  "Extreme Macro": "extreme macro lens",
  "70s Cinema Prime": "1970s cinema prime lens",
  "Classic Anamorphic": "classic anamorphic lens",
  "Premium Modern Prime": "premium modern prime lens",
  "Warm Cinema Prime": "warm-toned cinema prime lens",
  "Swirl Bokeh Portrait": "swirl bokeh portrait lens",
  "Vintage Prime": "vintage prime lens",
  "Halation Diffusion": "halation diffusion filter",
  "Clinical Sharp Prime": "ultra-sharp clinical prime lens",
};

async function fetchImageAsPngBlob(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image request failed with status ${response.status}.`);
  }

  const sourceBlob = await response.blob();
  if (sourceBlob.type === "image/png") return sourceBlob;

  const objectUrl = URL.createObjectURL(sourceBlob);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not decode the image."));
      element.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create an image clipboard canvas.");
    }

    context.drawImage(image, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Could not convert the image to PNG.")),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const FOCAL_PERSPECTIVE = {
  8: "ultra-wide perspective",
  14: "wide-angle perspective",
  24: "wide-angle dynamic perspective",
  35: "natural cinematic perspective",
  50: "standard portrait perspective",
  85: "classic portrait perspective",
};

const APERTURE_EFFECT = {
  "f/1.4": "shallow depth of field, creamy bokeh",
  "f/4": "balanced depth of field",
  "f/11": "deep focus clarity, sharp foreground to background",
};

const ASSET_URLS = {
  "Modular 8K Digital": "/assets/cinema/modular_8k_digital.webp",
  "Full-Frame Cine Digital": "/assets/cinema/full_frame_cine_digital.webp",
  "Grand Format 70mm Film": "/assets/cinema/grand_format_70mm_film.webp",
  "Studio Digital S35": "/assets/cinema/studio_digital_s35.webp",
  "Classic 16mm Film": "/assets/cinema/classic_16mm_film.webp",
  "Premium Large Format Digital":
    "/assets/cinema/premium_large_format_digital.webp",
  "Creative Tilt Lens": "/assets/cinema/creative_tilt_lens.webp",
  "Compact Anamorphic": "/assets/cinema/compact_anamorphic.webp",
  "Extreme Macro": "/assets/cinema/extreme_macro.webp",
  "70s Cinema Prime": "/assets/cinema/70s_cinema_prime.webp",
  "Classic Anamorphic": "/assets/cinema/classic_anamorphic.webp",
  "Premium Modern Prime": "/assets/cinema/premium_modern_prime.webp",
  "Warm Cinema Prime": "/assets/cinema/warm_cinema_prime.webp",
  "Swirl Bokeh Portrait": "/assets/cinema/swirl_bokeh_portrait.webp",
  "Vintage Prime": "/assets/cinema/vintage_prime.webp",
  "Halation Diffusion": "/assets/cinema/halation_diffusion.webp",
  "Clinical Sharp Prime": "/assets/cinema/clinical_sharp_prime.webp",
  "f/1.4": "/assets/cinema/f_1_4.webp",
  "f/4": "/assets/cinema/f_4.webp",
  "f/11": "/assets/cinema/f_11.webp",
};


// ─── Cinema Multi-Models & Video Engine ─────────────────────────────────────

const CINEMA_VIDEO_MODELS = [
  { id: "kling-v2.6-pro-t2v", i2vId: "kling-v2.6-pro-t2v", name: "Kling 2.6 Pro (电影运镜)", badge: "推荐" },
  { id: "minimax-hailuo-2.3-standard-t2v", i2vId: "minimax-hailuo-2.3-standard-t2v", name: "Hailuo 2.3 (海螺电影级)", badge: "4K Cinema" },
  { id: "veo3-text-to-video", i2vId: "veo3-text-to-video", name: "Google Veo 3 (电影运镜)", badge: "Veo 3" },
  { id: "veo-2-text-to-video", i2vId: "veo-2-text-to-video", name: "Google Veo 2 (电影画质)", badge: "Veo 2" },
  { id: "seedance-2.5-text-to-video", i2vId: "seedance-2.5-image-to-video", name: "Seedance 2.5 (电影级视听)", badge: "SOON" },
];

const CINEMA_PHOTO_MODELS = [
  { id: "gpt-image-2.5-flash", editId: "gpt-image-2.5-flash", name: "Seedream 4.5 极速 (电影巨幅)", badge: "推荐" },
  { id: "bytedance-seedream-v3", editId: "bytedance-seedream-v3", name: "Seedream 3.0 (胶片质感)", badge: "经典" },
  { id: "bytedance-seedream-5.0-pro", editId: "bytedance-seedream-5.0-pro-edit", name: "Seedream 5.0 Pro (电影巨幅)", badge: "SOON" },
  { id: "nano-banana-pro", editId: "nano-banana-pro-edit", name: "Nano Banana Pro (8K胶片)", badge: "SOON" },
];

const VIDEO_DURATIONS = ["5s", "10s"];

function isVideoUrl(url) {
  if (!url || typeof url !== "string") return false;
  return (
    url.endsWith(".mp4") ||
    url.endsWith(".webm") ||
    url.endsWith(".mov") ||
    url.includes(".mp4?") ||
    url.includes(".webm?") ||
    url.includes("/video/") ||
    url.includes("video")
  );
}

const ASPECT_RATIOS = ["16:9", "21:9", "9:16", "1:1", "4:5"];
const RESOLUTIONS = ["1K", "2K", "4K"];
const CAMERAS = Object.keys(CAMERA_MAP);
const LENSES = Object.keys(LENS_MAP);
const FOCAL_LENGTHS = Object.keys(FOCAL_PERSPECTIVE).map((k) => parseInt(k));
const APERTURES = Object.keys(APERTURE_EFFECT);

export function resolveVideoDuration(modelId, rawDuration) {
  const sec = typeof rawDuration === "number" ? rawDuration : (parseInt(rawDuration, 10) || 5);
  const model = getVideoModelById(modelId) || getI2VModelById(modelId);
  const durationInput = model?.inputs?.duration;
  if (durationInput?.enum && Array.isArray(durationInput.enum) && durationInput.enum.length > 0) {
    if (durationInput.enum.includes(sec)) return sec;
    return durationInput.enum.reduce((prev, curr) =>
      Math.abs(curr - sec) < Math.abs(prev - sec) ? curr : prev
    );
  }
  if (durationInput?.minValue !== undefined || durationInput?.maxValue !== undefined) {
    let val = sec;
    if (durationInput.minValue !== undefined) val = Math.max(durationInput.minValue, val);
    if (durationInput.maxValue !== undefined) val = Math.min(durationInput.maxValue, val);
    return val;
  }
  return sec;
}

export function resolveVideoResolution(modelId, rawRes) {
  const norm = (rawRes || "").toLowerCase();
  let mapped = "720p";
  if (norm === "1k") mapped = "720p";
  else if (norm === "2k") mapped = "1080p";
  else if (norm === "4k") mapped = "1080p";
  else if (norm.includes("p")) mapped = norm;

  const model = getVideoModelById(modelId) || getI2VModelById(modelId);
  const valid = model?.inputs?.resolution?.enum;
  if (Array.isArray(valid) && valid.length > 0) {
    if (norm === "4k") {
      const match4k = valid.find((v) => String(v).toLowerCase() === "4k");
      if (match4k) return match4k;
    }
    const exact = valid.find((v) => String(v).toLowerCase() === mapped.toLowerCase());
    if (exact) return exact;
    return model?.inputs?.resolution?.default || valid[0];
  }
  if (model?.fixedParameters?.resolution) {
    return model.fixedParameters.resolution;
  }
  return mapped;
}

function buildNanoBananaPrompt(
  basePrompt,
  camera,
  lens,
  focalLength,
  aperture,
  isCinemaVideo = false,
) {
  const cameraDesc = CAMERA_MAP[camera] || camera;
  const lensDesc = LENS_MAP[lens] || lens;
  const perspective = FOCAL_PERSPECTIVE[focalLength] || "";
  const depthEffect = APERTURE_EFFECT[aperture] || "";
  const qualityTags = isCinemaVideo
    ? ["cinematic motion", "smooth cinematic camera movement", "masterpiece cinema film", "4K HDR film grade"]
    : ["professional photography", "ultra-detailed", "8K resolution"];
  const parts = [
    basePrompt,
    `shot on a ${cameraDesc}`,
    `using a ${lensDesc} at ${focalLength}mm ${perspective ? `(${perspective})` : ""}`,
    `aperture ${aperture}`,
    depthEffect,
    "cinematic lighting",
    "natural color science",
    "high dynamic range",
    qualityTags.join(", "),
  ];
  return parts.filter((p) => p && p.trim() !== "").join(", ");
}

// ─── Dropdown ────────────────────────────────────────────────────────────────

function Dropdown({ title, items, selected, onSelect, triggerRef, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, triggerRef]);

  return (
    <PromptPopover
      ref={menuRef}
    >
      <PromptPopoverHeader>{title}</PromptPopoverHeader>
      <PromptMenuList>
      {items.map((item) => (
        <PromptMenuItem
          key={item}
          selected={item === selected}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item);
            onClose();
          }}
        >
          {item}
        </PromptMenuItem>
      ))}
      </PromptMenuList>
    </PromptPopover>
  );
}

// Camera configuration controls

function ScrollColumn({ title, items, columnKey, value, onChange }) {
  const listRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const scrollTopStart = useRef(0);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;

    const timer = setTimeout(() => {
      const target = Array.from(list.children).find(
        (child) => child.dataset.value === String(value),
      );
      if (target) target.scrollIntoView({ block: "center" });
    }, 100);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const centerY = list.scrollTop + list.clientHeight / 2;
    const children = Array.from(list.children).filter(
      (child) => child.dataset.value,
    );
    let closest = null;
    let minimumDistance = Infinity;

    children.forEach((child) => {
      const childCenter = child.offsetTop + child.offsetHeight / 2;
      const distance = Math.abs(centerY - childCenter);
      if (distance < minimumDistance) {
        minimumDistance = distance;
        closest = child;
      }
    });

    children.forEach((child) => {
      const selected = child === closest;
      child.dataset.selected = String(selected);
      child.setAttribute("aria-selected", String(selected));
    });

    if (closest) {
      const nextValue =
        columnKey === "focal"
          ? parseInt(closest.dataset.value, 10)
          : closest.dataset.value;
      if (String(nextValue) !== String(value)) onChange(nextValue);
    }
  }, [columnKey, onChange, value]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;

    list.addEventListener("scroll", handleScroll);
    const timer = setTimeout(handleScroll, 150);

    return () => {
      list.removeEventListener("scroll", handleScroll);
      clearTimeout(timer);
    };
  }, [handleScroll]);

  const handleMouseDown = (event) => {
    const list = listRef.current;
    if (!list) return;

    isDragging.current = true;
    list.classList.add("cursor-grabbing");
    list.classList.remove("snap-y");
    startY.current = event.pageY - list.offsetTop;
    scrollTopStart.current = list.scrollTop;
    event.preventDefault();
  };

  const stopDragging = () => {
    const list = listRef.current;
    isDragging.current = false;
    if (!list) return;
    list.classList.remove("cursor-grabbing");
    list.classList.add("snap-y");
  };

  const handleMouseMove = (event) => {
    const list = listRef.current;
    if (!isDragging.current || !list) return;

    event.preventDefault();
    const y = event.pageY - list.offsetTop;
    list.scrollTop = scrollTopStart.current - (y - startY.current) * 1.5;
  };

  const handleItemClick = (item) => {
    const list = listRef.current;
    if (!list) return;

    const target = Array.from(list.children).find(
      (child) => child.dataset.value === String(item),
    );
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="flex w-[170px] shrink-0 snap-center flex-col md:w-[190px]">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-white/75">{title}</h3>
        <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-b from-brand to-aurora-purple shadow-[0_0_6px_rgba(225, 29, 116,0.5)]" />
      </div>

      <div className="relative h-[320px] overflow-hidden rounded-2xl border border-white/[0.06] bg-canvas shadow-inner">
        <div className="pointer-events-none absolute inset-x-2 top-1/2 z-0 h-[82px] -translate-y-1/2 rounded-xl border border-brand/20 bg-gradient-to-r from-brand/15 to-purple-500/10 shadow-[0_0_15px_rgba(225, 29, 116,0.1)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-20 bg-gradient-to-b from-canvas via-canvas/85 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-20 bg-gradient-to-t from-canvas via-canvas/85 to-transparent" />

        <div
          ref={listRef}
          role="listbox"
          aria-label={title}
          className="relative z-10 h-full cursor-grab snap-y snap-mandatory overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onMouseDown={handleMouseDown}
          onMouseLeave={stopDragging}
          onMouseUp={stopDragging}
          onMouseMove={handleMouseMove}
        >
          <div aria-hidden="true" style={{ height: "calc(50% - 41px)" }} />
          {items.map((item) => {
            const imageUrl = ASSET_URLS[item];
            const selected = String(item) === String(value);

            return (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={selected}
                data-value={item}
                data-selected={selected}
                onClick={() => handleItemClick(item)}
                className="group flex h-[82px] w-full snap-center select-none items-center justify-center gap-2.5 px-4 text-left opacity-30 transition-[opacity,transform] duration-200 ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring data-[selected=true]:opacity-100"
              >
                <span
                  className={`flex shrink-0 items-center justify-center font-semibold transition-colors ${
                    imageUrl
                      ? "h-10 w-10"
                      : "text-base text-white/55 group-data-[selected=true]:text-brand"
                  }`}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <>
                      {item}
                      {columnKey === "focal" ? "mm" : ""}
                    </>
                  )}
                </span>
                {columnKey !== "focal" && (
                  <span className="line-clamp-2 min-w-0 text-[10px] font-medium leading-snug text-white/60 transition-colors group-data-[selected=true]:text-white">
                    {item}
                  </span>
                )}
              </button>
            );
          })}
          <div aria-hidden="true" style={{ height: "calc(50% - 41px)" }} />
        </div>
      </div>

    </section>
  );
}

function CameraControlsOverlay({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  copy,
}) {
  const backdropRef = useRef(null);

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) onClose();
  };

  const updateSetting = (key) => (val) => {
    onSettingsChange((prev) => ({ ...prev, [key]: val }));
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-config-title"
        aria-describedby="camera-config-description"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-surface/95 shadow-[0_24px_100px_rgba(0,0,0,0.75)] backdrop-blur-2xl animate-scale-up"
      >
        <div className="flex items-start justify-between border-b border-white/[0.05] px-5 py-5 md:px-7 md:py-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14.5 4H9.5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3Z" />
                <circle cx="12" cy="12.5" r="3.5" />
              </svg>
              {copy.cameraOverlay.eyebrow}
            </div>
            <h2
              id="camera-config-title"
              className="text-xl font-semibold tracking-tight text-white md:text-2xl"
            >
              {copy.cameraOverlay.title}
            </h2>
            <p
              id="camera-config-description"
              className="mt-1.5 max-w-2xl text-xs leading-relaxed text-white/45 md:text-sm"
            >
              {copy.cameraOverlay.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.cameraOverlay.closeAria}
            title={copy.cameraOverlay.close}
            className="ml-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] text-white/40 transition-[background-color,border-color,color,transform] duration-fast ease-standard hover:border-white/15 hover:bg-white/[0.07] hover:text-white active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-x-auto px-5 py-6 no-scrollbar md:px-7 md:py-7">
          <div className="mx-auto flex w-max min-w-full justify-start gap-3 sm:justify-center md:gap-5">
            <ScrollColumn
              title={copy.cameraOverlay.columns.camera}
              items={CAMERAS}
              columnKey="camera"
              value={settings.camera}
              onChange={updateSetting("camera")}
            />
            <ScrollColumn
              title={copy.cameraOverlay.columns.lens}
              items={LENSES}
              columnKey="lens"
              value={settings.lens}
              onChange={updateSetting("lens")}
            />
            <ScrollColumn
              title={copy.cameraOverlay.columns.focalLength}
              items={FOCAL_LENGTHS}
              columnKey="focal"
              value={settings.focal}
              onChange={updateSetting("focal")}
            />
            <ScrollColumn
              title={copy.cameraOverlay.columns.aperture}
              items={APERTURES}
              columnKey="aperture"
              value={settings.aperture}
              onChange={updateSetting("aperture")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CINEMA_RELAY_COPY_EN = {
  presetsTitle: "Cinema Shot Presets:",
  relayLoadedToast: "Loaded relayed reference video into Cinema Studio!",
  presets: [
    {
      id: "anamorphic-noir",
      label: "Anamorphic Noir",
      prompt: "Anamorphic 2.39:1 widescreen frame, moody chiaroscuro neo-noir street lighting, wet asphalt reflections, shallow depth of field, organic 35mm film grain",
    },
    {
      id: "golden-hour-epic",
      label: "Golden Hour Epic",
      prompt: "Sweeping IMAX 70mm golden hour vista, volumetric god rays piercing atmospheric haze, rich warm highlights and deep cinematic shadows",
    },
    {
      id: "cyber-neon-closeup",
      label: "Cyber Neon Close-Up",
      prompt: "Intimate macro portrait on Cook Panchro lens, bi-color cyan and magenta neon rim light, crisp eye catchlights, creamy bokeh background",
    },
    {
      id: "thriller-dolly",
      label: "Suspense Tracking",
      prompt: "Slow tense Steadicam corridor tracking shot, low-key tungsten practical lamps, subtle atmospheric smoke, high-contrast thriller cinematography",
    },
  ],
};

const CINEMA_RELAY_COPY_LOCALES = {
  "zh-CN": {
    presetsTitle: "电影镜头预设:",
    relayLoadedToast: "已载入接力参考视频至电影工作室！",
    presets: [
      { id: "anamorphic-noir", label: "变形宽银幕黑色电影", prompt: CINEMA_RELAY_COPY_EN.presets[0].prompt },
      { id: "golden-hour-epic", label: "黄金时刻史诗全景", prompt: CINEMA_RELAY_COPY_EN.presets[1].prompt },
      { id: "cyber-neon-closeup", label: "赛博霓虹特写", prompt: CINEMA_RELAY_COPY_EN.presets[2].prompt },
      { id: "thriller-dolly", label: "悬疑跟拍长镜头", prompt: CINEMA_RELAY_COPY_EN.presets[3].prompt },
    ],
  },
  "zh-TW": {
    presetsTitle: "電影鏡頭預設:",
    relayLoadedToast: "已載入接力參考影片至電影工作室！",
    presets: [
      { id: "anamorphic-noir", label: "變形寬銀幕黑色電影", prompt: CINEMA_RELAY_COPY_EN.presets[0].prompt },
      { id: "golden-hour-epic", label: "黃金時刻史詩全景", prompt: CINEMA_RELAY_COPY_EN.presets[1].prompt },
      { id: "cyber-neon-closeup", label: "賽博霓虹特寫", prompt: CINEMA_RELAY_COPY_EN.presets[2].prompt },
      { id: "thriller-dolly", label: "懸疑跟拍長鏡頭", prompt: CINEMA_RELAY_COPY_EN.presets[3].prompt },
    ],
  },
  "ja-JP": {
    presetsTitle: "シネマショットプリセット:",
    relayLoadedToast: "リレーされた参照動画をシネマスタジオに読み込みました！",
    presets: [
      { id: "anamorphic-noir", label: "アナモルフィック・ノワール", prompt: CINEMA_RELAY_COPY_EN.presets[0].prompt },
      { id: "golden-hour-epic", label: "ゴールデンアワー・エピック", prompt: CINEMA_RELAY_COPY_EN.presets[1].prompt },
      { id: "cyber-neon-closeup", label: "サイバーネオンクローズアップ", prompt: CINEMA_RELAY_COPY_EN.presets[2].prompt },
      { id: "thriller-dolly", label: "サスペンス・トラッキング", prompt: CINEMA_RELAY_COPY_EN.presets[3].prompt },
    ],
  },
  "ko-KR": {
    presetsTitle: "시네마 샷 프리셋:",
    relayLoadedToast: "릴레이된 참조 영상을 시네마 스튜디오로 불러왔습니다!",
    presets: [
      { id: "anamorphic-noir", label: "아나모픽 느와르", prompt: CINEMA_RELAY_COPY_EN.presets[0].prompt },
      { id: "golden-hour-epic", label: "골든 아워 에픽", prompt: CINEMA_RELAY_COPY_EN.presets[1].prompt },
      { id: "cyber-neon-closeup", label: "사이버 네온 클로즈업", prompt: CINEMA_RELAY_COPY_EN.presets[2].prompt },
      { id: "thriller-dolly", label: "서스펜스 트래킹", prompt: CINEMA_RELAY_COPY_EN.presets[3].prompt },
    ],
  },
  "es": {
    presetsTitle: "Ajustes de Plano de Cine:",
    relayLoadedToast: "¡Video de referencia cargado en Cinema Studio!",
    presets: [
      { id: "anamorphic-noir", label: "Noir Anamórfico", prompt: CINEMA_RELAY_COPY_EN.presets[0].prompt },
      { id: "golden-hour-epic", label: "Épico Hora Dorada", prompt: CINEMA_RELAY_COPY_EN.presets[1].prompt },
      { id: "cyber-neon-closeup", label: "Primer Plano Neón", prompt: CINEMA_RELAY_COPY_EN.presets[2].prompt },
      { id: "thriller-dolly", label: "Tracking de Suspenso", prompt: CINEMA_RELAY_COPY_EN.presets[3].prompt },
    ],
  },
};

export default function CinemaStudio({
  apiKey,
  initialModel = "",
  initialPrompt = "",
  onGenerationStart,
  onGenerationEnd,
  onGenerationComplete,
  onGenerationError,
  historyItems,
  locale = "en",
}) {
  const copy = resolveCopy(en, CINEMA_MESSAGES, locale);
  const relayCopy = resolveCopy(CINEMA_RELAY_COPY_EN, CINEMA_RELAY_COPY_LOCALES, locale);
  const [directoryRevision, setDirectoryRevision] = useState(0);
  useEffect(() => subscribeModelDirectory(() => setDirectoryRevision(revision => revision + 1)), []);
  const availableCinemaVideoModels = useMemo(() => CINEMA_VIDEO_MODELS.filter(model => isModelActive(model.id)), [directoryRevision]);
  const availableCinemaPhotoModels = useMemo(() => CINEMA_PHOTO_MODELS.filter(model => isModelActive(model.id)), [directoryRevision]);
  const LEGACY_PERSIST_KEY = "hg_cinema_studio_persistent";
  const PERSIST_KEY = scopedPersistKey(LEGACY_PERSIST_KEY, apiKey);
  useEffect(() => {
    migrateLegacyPersistKey(LEGACY_PERSIST_KEY, PERSIST_KEY);
  }, [PERSIST_KEY]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const relayedVideo = sp.get("video_url");
      if (relayedVideo) {
        setCanvasUrl(relayedVideo);
        toast.success(relayCopy.relayLoadedToast);
      }
    } catch (_) {}

    const handleRelay = (e) => {
      const { videoUrl } = e.detail || {};
      if (videoUrl) {
        setCanvasUrl(videoUrl);
        toast.success(relayCopy.relayLoadedToast);
      }
    };
    window.addEventListener("supdance-relay-video", handleRelay);
    return () => window.removeEventListener("supdance-relay-video", handleRelay);
  }, [relayCopy]);

  // ── Settings state ──
  const [generationMode, setGenerationMode] = useState("video"); // 'video' | 'image'
  const [selectedVideoModel, setSelectedVideoModel] = useState(availableCinemaVideoModels[0]?.id || '');
  const [selectedPhotoModel, setSelectedPhotoModel] = useState(availableCinemaPhotoModels[0]?.id || '');

  const applyModelSelection = useCallback((targetModelKey) => {
    if (!targetModelKey) return;
    const cleanKey = String(targetModelKey).trim();
    const videoMatch = availableCinemaVideoModels.find(
      (m) => m.id === cleanKey || m.i2vId === cleanKey
    );
    if (videoMatch) {
      setGenerationMode("video");
      setSelectedVideoModel(videoMatch.id);
      return;
    }
    const photoMatch = availableCinemaPhotoModels.find(
      (m) => m.id === cleanKey || m.editId === cleanKey
    );
    if (photoMatch) {
      setGenerationMode("image");
      setSelectedPhotoModel(photoMatch.id);
      return;
    }
  }, [availableCinemaVideoModels, availableCinemaPhotoModels]);

  useEffect(() => {
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const urlModel = urlParams?.get("model");
    const targetModel = initialModel || urlModel;
    if (targetModel) {
      applyModelSelection(targetModel);
    }
  }, [initialModel, applyModelSelection]);

  useEffect(() => {
    const handleSelectModelEvent = (e) => {
      const detail = e.detail;
      if (detail?.tabId && detail.tabId !== "cinema") return;
      const modelKey = typeof detail === "string" ? detail : detail?.modelKey;
      if (modelKey) {
        applyModelSelection(modelKey);
      }
    };
    window.addEventListener("supdance-select-model", handleSelectModelEvent);
    return () => window.removeEventListener("supdance-select-model", handleSelectModelEvent);
  }, [applyModelSelection]);

  useEffect(() => {
    if (!availableCinemaVideoModels.some((model) => model.id === selectedVideoModel)) {
      setSelectedVideoModel(availableCinemaVideoModels[0]?.id || '');
    }
    if (!availableCinemaPhotoModels.some((model) => model.id === selectedPhotoModel)) {
      setSelectedPhotoModel(availableCinemaPhotoModels[0]?.id || '');
    }
  }, [availableCinemaPhotoModels, availableCinemaVideoModels, selectedPhotoModel, selectedVideoModel]);
  const [videoDuration, setVideoDuration] = useState("5s");
  const [settings, setSettings] = useState({
    prompt: initialPrompt || "",
    aspect_ratio: "16:9",
    camera: CAMERAS[0],
    lens: LENSES[0],
    focal: 35,
    aperture: "f/1.4",
  });

  useEffect(() => {
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const urlPrompt = urlParams?.get("prompt") || urlParams?.get("remixPrompt");
    const targetPrompt = urlPrompt || initialPrompt;
    if (targetPrompt) {
      setSettings((prev) => ({ ...prev, prompt: targetPrompt }));
    }
  }, [initialPrompt]);
  const [resolution, setResolution] = useState("2K");

  // ── UI state ──
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [canvasUrl, setCanvasUrl] = useState(null); // null = prompt view
  const [fullscreenUrl, setFullscreenUrl] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const imageInputRef = useRef(null);
  const [activeHistoryIndex, setactiveHistoryIndex] = useState(null);
  const [copiedPromptIndex, setCopiedPromptIndex] = useState(null);
  const [copiedImageIndex, setCopiedImageIndex] = useState(null);
  const regenerateTimerRef = useRef(null);
  const [failedMedia, setFailedMedia] = useState({});
  const handleMediaError = useCallback((url) => {
    if (!url) return;
    setFailedMedia((prev) => ({ ...prev, [url]: true }));
  }, []);

  useEffect(() => () => {
    if (regenerateTimerRef.current) {
      clearTimeout(regenerateTimerRef.current);
      regenerateTimerRef.current = null;
    }
  }, []);

  // ── Internal history state (used when historyItems prop is not provided) ──
  const [internalHistory, setInternalHistory] = useState([]);

  // ── Dropdown state ──
  const [openDropdown, setOpenDropdown] = useState(null); // 'mode' | 'model' | 'duration' | 'ar' | 'res' | null
  const modeBtnRef = useRef(null);
  const modelBtnRef = useRef(null);
  const durationBtnRef = useRef(null);
  const arBtnRef = useRef(null);
  const resBtnRef = useRef(null);

  // ── Textarea auto-grow ──
  const textareaRef = useRef(null);
  const resultImgRef = useRef(null);

  const handleImageFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setImageUploadProgress(0);

    try {
      const url = await uploadFile(apiKey, file, (progress) => {
        setImageUploadProgress(progress);
      });
      if (url) setUploadedImage(url);
    } catch (err) {
      console.error("Image upload failed:", err);
      toast.error(err?.message || "图片上传失败，请重试");
    } finally {
      setIsUploadingImage(false);
      setImageUploadProgress(0);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleImageUpload = async (e) => {
    await handleImageFiles(Array.from(e.target.files || []));
  };

  const removeImage = () => {
    setUploadedImage(null);
  };

  // ── Image drag-and-drop ─────────────────────────────────────────────────
  const [isImageDragging, setIsImageDragging] = useState(false);
  const imageDragCounterRef = useRef(0);

  const handleImageDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    imageDragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsImageDragging(true);
    }
  };

  const handleImageDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    imageDragCounterRef.current -= 1;
    if (imageDragCounterRef.current <= 0) {
      imageDragCounterRef.current = 0;
      setIsImageDragging(false);
    }
  };

  const handleImageDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    imageDragCounterRef.current = 0;
    setIsImageDragging(false);
    if (isUploadingImage) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleImageFiles(Array.from(files));
    }
  };

  // ── Persistence: Load ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PERSIST_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (!new URLSearchParams(window.location.search).get("model")) {
          if (data.generationMode) setGenerationMode(data.generationMode);
          if (data.selectedVideoModel) setSelectedVideoModel(data.selectedVideoModel);
          if (data.selectedPhotoModel) setSelectedPhotoModel(data.selectedPhotoModel);
        }
        if (data.videoDuration) setVideoDuration(data.videoDuration);
        if (data.settings) setSettings(data.settings);
        if (data.resolution) setResolution(data.resolution);
        if (data.internalHistory) setInternalHistory(data.internalHistory);
        if (data.uploadedImage) setUploadedImage(data.uploadedImage);
      }
    } catch (err) {
      console.warn("Failed to load CinemaStudio persistence:", err);
    }
  }, []);

  // ── Adjust height on load ────────────────────────────────────────────────
  // ── Persistence: Save ────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const state = {
          generationMode,
          selectedVideoModel,
          selectedPhotoModel,
          videoDuration,
          settings,
          resolution,
          internalHistory,
          uploadedImage,
        };
        localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
      } catch (err) {
        console.warn("Failed to save CinemaStudio persistence:", err);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [settings, resolution, internalHistory, uploadedImage]);

  // Derive effective history (prop wins over internal)
  const history = historyItems != null ? historyItems : internalHistory;

  useEffect(() => {
    setCanvasUrl(history[0]?.url || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyItems]);

  const formatSummaryValue = () =>
    `${settings.lens}, ${settings.focal}mm, ${settings.aperture}`;

  const mentionItems = useMemo(
    () =>
      uploadedImage
        ? [{ id: uploadedImage, url: uploadedImage, name: "Reference 1" }]
        : [],
    [uploadedImage],
  );
  const mention = usePromptMention({
    textareaRef,
    value: settings.prompt,
    onChange: (e) =>
      setSettings((prev) => ({ ...prev, prompt: e.target.value })),
    items: mentionItems,
    enabled: mentionItems.length > 0,
  });

  // ── Textarea auto-height ──
  // ── Generate ──
  const handleGenerate = useCallback(async () => {
    const basePrompt = settings.prompt.trim();
    if (!basePrompt || isGenerating) return;

    onGenerationStart?.();
    setIsGenerating(true);

    const isVideo = generationMode === "video";
    const finalPrompt = buildNanoBananaPrompt(
      basePrompt,
      settings.camera,
      settings.lens,
      settings.focal,
      settings.aperture,
      isVideo,
    );

    try {
      let res;
      if (isVideo) {
        const modelObj = availableCinemaVideoModels.find((m) => m.id === selectedVideoModel) || availableCinemaVideoModels[0];
        if (!modelObj) throw new Error('当前没有可用的电影视频模型');
        const targetModel = uploadedImage ? (modelObj.i2vId || modelObj.id) : modelObj.id;
        
        const videoParams = {
          model: targetModel,
          prompt: finalPrompt,
          aspect_ratio: settings.aspect_ratio,
          duration: resolveVideoDuration(targetModel, parseInt(videoDuration, 10) || 5),
          resolution: resolveVideoResolution(targetModel, resolution),
          studioId: "cinema",
        };
        if (uploadedImage) {
          videoParams.image_url = uploadedImage;
          res = await generateI2V(apiKey, videoParams);
        } else {
          res = await generateVideo(apiKey, videoParams);
        }
      } else {
        const modelObj = availableCinemaPhotoModels.find((m) => m.id === selectedPhotoModel) || availableCinemaPhotoModels[0];
        if (!modelObj) throw new Error('当前没有可用的电影图片模型');
        const targetModel = uploadedImage ? (modelObj.editId || modelObj.id) : modelObj.id;
        
        const resMap = { "1k": "720p", "2k": "1080p", "4k": "4K" };
        const mappedRes = resMap[resolution.toLowerCase()] || resolution.toLowerCase();

        if (uploadedImage) {
          res = await generateI2I(apiKey, {
            model: targetModel,
            prompt: finalPrompt,
            aspect_ratio: settings.aspect_ratio,
            resolution: mappedRes,
            negative_prompt: "blurry, low quality, distortion, bad composition",
            image_url: uploadedImage,
            images_list: [uploadedImage],
            studioId: "cinema",
          });
        } else {
          res = await generateImage(apiKey, {
            model: targetModel,
            prompt: finalPrompt,
            aspect_ratio: settings.aspect_ratio,
            resolution: mappedRes,
            negative_prompt: "blurry, low quality, distortion, bad composition",
            studioId: "cinema",
          });
        }
      }

      if (res && res.url) {
        const entry = {
          url: res.url,
          timestamp: Date.now(),
          mediaType: isVideo ? "video" : "image",
          settings: {
            mode: generationMode,
            model: isVideo ? selectedVideoModel : selectedPhotoModel,
            duration: isVideo ? videoDuration : undefined,
            prompt: basePrompt,
            camera: settings.camera,
            lens: settings.lens,
            focal: settings.focal,
            aperture: settings.aperture,
            aspect_ratio: settings.aspect_ratio,
            resolution,
          },
        };

        if (historyItems == null) {
          setInternalHistory((prev) => [entry, ...prev].slice(0, 50));
        }

        setCanvasUrl(res.url);

        if (onGenerationComplete) {
          onGenerationComplete({
            url: res.url,
            mediaType: isVideo ? "video" : "image",
            model: isVideo ? selectedVideoModel : selectedPhotoModel,
            prompt: basePrompt,
            type: "cinema",
          });
        }
      } else {
        throw new Error("No media returned from generation");
      }
    } catch (e) {
      console.error("CinemaStudio generate failed:", e);
      const errMsg = e?.message?.slice(0, 120) || "Cinema generation failed";
      toast.error(errMsg);
      onGenerationError?.(errMsg);
    } finally {
      setIsGenerating(false);
      onGenerationEnd?.();
    }
  }, [
    settings,
    generationMode,
    selectedVideoModel,
    selectedPhotoModel,
    videoDuration,
    resolution,
    uploadedImage,
    apiKey,
    isGenerating,
    onGenerationComplete,
    onGenerationEnd,
    onGenerationError,
    historyItems,
  ]);

  const handleGenerateRef = useRef(handleGenerate);
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  }, [handleGenerate]);

  // ── Auto-generation trigger from URL (?auto=1) ───────────────────────────
  const autoTriggeredRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || autoTriggeredRef.current) return;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("auto") === "1") {
      autoTriggeredRef.current = true;
      try {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete("auto");
        window.history.replaceState({}, "", nextUrl.toString());
      } catch {}
      const timer = setTimeout(() => {
        handleGenerate();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [handleGenerate]);

  // ── Regenerate ──
  const handleRegenerate = useCallback((entry) => {
    if (entry?.settings) {
      if (entry.settings.prompt) {
        setSettings((prev) => ({
          ...prev,
          prompt: entry.settings.prompt,
          camera: entry.settings.camera || prev.camera,
          lens: entry.settings.lens || prev.lens,
          focal: entry.settings.focal || prev.focal,
          aperture: entry.settings.aperture || prev.aperture,
          aspect_ratio: entry.settings.aspect_ratio || prev.aspect_ratio,
        }));
      }
      if (entry.settings.mode) setGenerationMode(entry.settings.mode);
      if (entry.settings.duration) setVideoDuration(entry.settings.duration);
      if (entry.settings.resolution) setResolution(entry.settings.resolution);
      if (entry.settings.model) {
        if (entry.settings.mode === "video") setSelectedVideoModel(entry.settings.model);
        else setSelectedPhotoModel(entry.settings.model);
      }
    }
    setCanvasUrl(null);
    // Small delay then generate
    if (regenerateTimerRef.current) clearTimeout(regenerateTimerRef.current);
    regenerateTimerRef.current = setTimeout(() => {
      regenerateTimerRef.current = null;
      if (handleGenerateRef.current) {
        handleGenerateRef.current();
      }
    }, 300);
  }, []);

  // ── Download ──
  const handleDownload = useCallback(async () => {
    if (!canvasUrl) return;
    try {
      const response = await fetch(canvasUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `cinema-shot-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(canvasUrl, "_blank");
    }
  }, [canvasUrl]);

  const handleCopyPrompt = useCallback(
    async (prompt, index) => {
      if (!prompt) return;

      try {
        await navigator.clipboard.writeText(prompt);
        setCopiedPromptIndex(index);
        window.setTimeout(() => {
          setCopiedPromptIndex((current) => (current === index ? null : current));
        }, 1600);
      } catch (error) {
        console.error("Failed to copy the prompt:", error);
        onGenerationError?.("Could not copy the prompt to the clipboard.");
      }
    },
    [onGenerationError],
  );

  const handleCopyImage = useCallback(
    async (url, index) => {
      if (!url) return;

      try {
        if (
          !window.isSecureContext ||
          !navigator.clipboard?.write ||
          typeof window.ClipboardItem === "undefined"
        ) {
          throw new Error("Image clipboard access requires HTTPS or localhost.");
        }

        await navigator.clipboard.write([
          new window.ClipboardItem({
            "image/png": fetchImageAsPngBlob(url),
          }),
        ]);
        setCopiedImageIndex(index);
        window.setTimeout(() => {
          setCopiedImageIndex((current) => (current === index ? null : current));
        }, 1600);
      } catch (error) {
        console.error("Failed to copy the image:", error);
        onGenerationError?.(
          "Could not copy the image. Image copy requires HTTPS or localhost.",
        );
      }
    },
    [onGenerationError],
  );

  const resetToPrompt = () => {
    setCanvasUrl(null);
    setSettings((prev) => ({ ...prev, prompt: "" }));
    if (textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-transparent relative overflow-hidden">
      <Toaster position="top-right" duration={5000} />
      
      {/* ── CENTRAL GALLERY AREA ── */}
      <div className="flex-1 w-full max-w-7xl mx-auto overflow-y-auto custom-scrollbar pb-40 lg:pb-32 px-2">
        {history.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full pt-4 animate-fade-in">
            {history.map((entry, idx) => (
              <div
                key={entry.timestamp ?? idx}
                className="relative group rounded-2xl overflow-hidden border border-line bg-surface shadow-elevation-3 hover:border-brand-line transition-[border-color,box-shadow,transform] duration-smooth ease-card-hover flex flex-col cursor-pointer"
                onClick={() => setFullscreenUrl(entry.url)}
              >
                {failedMedia[entry.url] ? (
                  <div className="w-full aspect-[4/3] flex flex-col items-center justify-center bg-zinc-900/80 border border-white/5 text-zinc-500 gap-2 p-4 text-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="text-xs text-zinc-400 font-medium">媒体加载失败</span>
                  </div>
                ) : entry.mediaType === "video" || isVideoUrl(entry.url) ? (
                  <div className="relative w-full aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
                    <video
                      src={entry.url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      onError={() => handleMediaError(entry.url)}
                      className="w-full h-full object-cover bg-black/40"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/70 border border-brand/30 text-[9px] text-brand font-bold tracking-wider flex items-center gap-1.5 backdrop-blur-md">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      CINEMA VIDEO
                    </div>
                  </div>
                ) : (
                  <img
                    src={entry.url}
                    alt={copy.card.historyItemAlt.replace("{index}", idx + 1)}
                    onError={() => handleMediaError(entry.url)}
                    className="w-full aspect-[4/3] object-cover bg-black/40"
                  />
                )}
                
                {/* Overlay actions */}
                <div className="pointer-events-none absolute top-2 right-2 hidden flex-col gap-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 md:flex">
                  <button
                    type="button"
                    title={copy.actions?.regenerate || "Regenerate"}
                    aria-label={copy.actions?.regenerate || "Regenerate"}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRegenerate(entry);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/60 font-black backdrop-blur-md transition-[background-color,border-color,color,transform] duration-fast ease-standard hover:bg-brand hover:text-white text-white active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                  </button>
                  {(entry.mediaType === "video" || isVideoUrl(entry.url)) && (
                    <VideoRelayMenu
                      videoUrl={entry.url}
                      currentTab="cinema"
                      locale={locale}
                    />
                  )}
                  <button
                    type="button"
                    title={copiedPromptIndex === idx ? copy.actions.promptCopied : copy.actions.copyPrompt}
                    aria-label={copiedPromptIndex === idx ? copy.actions.promptCopied : copy.actions.copyPrompt}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCopyPrompt(entry.settings?.prompt, idx);
                    }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/60 font-black backdrop-blur-md transition-[background-color,border-color,color,transform] duration-fast ease-standard hover:bg-brand hover:text-white active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer ${
                      copiedPromptIndex === idx ? "text-brand" : "text-white"
                    }`}
                  >
                    {copiedPromptIndex === idx ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12l4 4L19 6" />
                      </svg>
                    ) : (
                      <CopyContentIcon kind="text" size={17} />
                    )}
                  </button>
                  <button
                    type="button"
                    title={copiedImageIndex === idx ? copy.actions.imageCopied : copy.actions.copyImage}
                    aria-label={copiedImageIndex === idx ? copy.actions.imageCopied : copy.actions.copyImage}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCopyImage(entry.url, idx);
                    }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/60 backdrop-blur-md transition-[background-color,border-color,color,transform] duration-fast ease-standard hover:bg-brand hover:text-white active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer ${
                      copiedImageIndex === idx ? "text-brand" : "text-white"
                    }`}
                  >
                    {copiedImageIndex === idx ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12l4 4L19 6" />
                      </svg>
                    ) : (
                      <CopyContentIcon kind="image" size={17} />
                    )}
                  </button>
                  <button
                    type="button"
                    title={copy.actions.download}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const response = await fetch(entry.url);
                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl;
                        a.download = `cinema-shot-${entry.id || idx}.jpg`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                      } catch {
                        window.open(entry.url, "_blank");
                      }
                    }}
                    className="p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-brand hover:text-white transition-[background-color,border-color,color,transform] duration-fast ease-standard border border-white/10 active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
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
                      if (confirm(copy.actions.deleteConfirm)) {
                        setInternalHistory(prev => prev.filter((_, i) => i !== idx));
                      }
                    }}
                    className="p-2 bg-black/60 backdrop-blur-md rounded-full text-red-400 hover:bg-red-500 hover:text-white transition-[background-color,border-color,color,transform] duration-fast ease-standard border border-white/10 active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
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
                  actions={[
                    {
                      kind: "remix",
                      label: copy.actions?.regenerate || "Regenerate",
                      onSelect: () => handleRegenerate(entry),
                    },
                    {
                      kind: "text",
                      label: copy.actions.copyPrompt,
                      onSelect: () =>
                        handleCopyPrompt(entry.settings?.prompt, idx),
                    },
                    {
                      kind: "image",
                      label: copy.actions.copyImage,
                      onSelect: () => handleCopyImage(entry.url, idx),
                    },
                    {
                      kind: "download",
                      label: copy.actions.download,
                      onSelect: async () => {
                        try {
                          const response = await fetch(entry.url);
                          const blob = await response.blob();
                          const blobUrl = URL.createObjectURL(blob);
                          const anchor = document.createElement("a");
                          anchor.href = blobUrl;
                          anchor.download = `cinema-shot-${entry.id || idx}.jpg`;
                          document.body.appendChild(anchor);
                          anchor.click();
                          document.body.removeChild(anchor);
                          URL.revokeObjectURL(blobUrl);
                        } catch {
                          window.open(entry.url, "_blank");
                        }
                      },
                    },
                    {
                      kind: "delete",
                      label: copy.actions.delete,
                      danger: true,
                      onSelect: () => {
                        if (confirm(copy.actions.deleteConfirm)) {
                          setInternalHistory((prev) => prev.filter((_, i) => i !== idx));
                        }
                      },
                    },
                  ]}
                />

                {/* Details */}
                <div className="p-3 bg-black/80 backdrop-blur-sm border-t border-white/5 flex-1 flex flex-col justify-between gap-2">
                  <p
                    className="w-full text-left text-xs line-clamp-3 leading-relaxed text-white/70"
                    title={entry.settings?.prompt || copy.card.noPrompt}
                  >
                    {entry.settings?.prompt || copy.card.noPrompt}
                  </p>
                  <span className="sr-only" aria-live="polite">
                    {copiedPromptIndex === idx
                      ? copy.actions.promptCopied
                      : copiedImageIndex === idx
                        ? copy.actions.imageCopied
                        : ""}
                  </span>
                  <div className="flex items-center mt-1 flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-brand px-2 py-0.5 bg-brand/10 rounded border border-brand/20">
                        {copy.card.badge}
                      </span>
                      {entry.settings?.camera && (
                        <span className="text-[10px] text-white/40">{entry.settings.camera}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-fade-in min-h-[50vh]">
            {/* Overlapping floating cards */}
            <div className="flex items-center justify-center gap-1.5 md:gap-3 mb-10 select-none scale-90 sm:scale-100">
              <div className="w-16 h-20 sm:w-24 sm:h-28 rounded-2xl border border-white/10 shadow-2xl -rotate-[12deg] transform hover:rotate-0 hover:scale-110 hover:z-20 transition-[transform] duration-smooth ease-card-hover overflow-hidden bg-white/[0.01] flex-shrink-0">
                <img
                  src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/sdxl-image.avif"
                  alt="Creative asset 1"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-16 h-20 sm:w-24 sm:h-28 rounded-2xl border border-white/10 shadow-2xl -rotate-[4deg] transform hover:rotate-0 hover:scale-110 hover:z-20 transition-[transform] duration-smooth ease-card-hover overflow-hidden bg-white/[0.01] -ml-3 sm:-ml-4 flex-shrink-0">
                <img
                  src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/chroma-image.avif"
                  alt="Creative asset 2"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full border border-white/10 shadow-2xl rotate-[6deg] transform hover:rotate-0 hover:scale-110 hover:z-20 transition-[transform] duration-smooth ease-card-hover overflow-hidden bg-white/[0.01] -ml-3 sm:-ml-4 flex-shrink-0">
                <img
                  src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/neta-lumina.avif"
                  alt="Creative asset 3"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-16 h-20 sm:w-24 sm:h-28 rounded-2xl border border-white/10 shadow-2xl rotate-[12deg] transform hover:rotate-0 hover:scale-110 hover:z-20 transition-[transform] duration-smooth ease-card-hover overflow-hidden bg-white/[0.01] -ml-3 sm:-ml-4 flex-shrink-0">
                <img
                  src="https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/perfect-pony-xl.avif"
                  alt="Creative asset 4"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-center px-4 flex flex-col items-center">
              <span className="text-white font-black uppercase text-xl sm:text-3xl tracking-wide mb-1 opacity-90">{copy.empty.kicker}</span>
              <span className="text-brand font-black uppercase text-2xl sm:text-4xl sm:mt-1 tracking-tight">
                {copy.empty.title}
              </span>
            </h1>
            <p className="text-white/40 text-xs sm:text-sm font-medium tracking-wide text-center max-w-lg leading-relaxed px-4">
              {copy.empty.description}
            </p>
          </div>
        )}
      </div>

      {/* ── BOTTOM PROMPT BAR ── */}
      <PromptComposer
        positionClassName="absolute bottom-4 left-4 right-4 md:left-0 md:right-0 md:mx-auto md:max-w-[95%] lg:max-w-4xl z-30 animate-fade-in"
        style={null}
      >
          {/* Cinema Shot Presets Pills */}
          <div className="w-full flex items-center gap-1.5 overflow-x-auto scrollbar-rail py-1 mb-1 px-1">
            <span className="text-micro font-bold uppercase tracking-wider text-ink-subtle shrink-0 mr-1">
              {relayCopy.presetsTitle}
            </span>
            {relayCopy.presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    prompt: prev.prompt ? `${prev.prompt.trim()}, ${preset.prompt}` : preset.prompt,
                  }))
                }
                className="rounded-full border border-line bg-wash px-2.5 py-0.5 text-micro font-medium text-ink-muted hover:border-brand-line hover:bg-wash-strong hover:text-ink transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring whitespace-nowrap shrink-0 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Upper Row: Image Upload & Textarea */}
          <div className="flex items-start gap-4 w-full px-1">
            {/* Image Upload Button */}
            <div
              className="relative pt-0.5"
              onDragEnter={handleImageDragEnter}
              onDragLeave={handleImageDragLeave}
              onDragOver={handleImageDragOver}
              onDrop={handleImageDrop}
            >
              <input
                type="file"
                ref={imageInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />

              <button
                onClick={() =>
                  uploadedImage
                    ? removeImage()
                    : imageInputRef.current?.click()
                }
                disabled={isUploadingImage}
                className={promptMediaButtonClassName({
                  active: Boolean(uploadedImage) || isImageDragging,
                  className: "active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer" + (isImageDragging ? " ring-2 ring-brand ring-offset-1 ring-offset-black scale-105" : ""),
                })}
              >
                {isUploadingImage ? (
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
                        strokeDashoffset={88 - (88 * imageUploadProgress) / 100}
                        className="text-brand transition-[stroke-dashoffset] duration-300"
                      />
                    </svg>
                    <span className="absolute text-[8px] font-bold text-white">
                      {imageUploadProgress}%
                    </span>
                  </div>
                ) : uploadedImage ? (
                  <div className="relative w-full h-full group">
                    <img
                      src={uploadedImage}
                      alt={copy.referenceImage.alt}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/40 group-hover:text-brand transition-colors">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                )}
              </button>
            </div>

            <PromptInputField
              ref={textareaRef}
              value={settings.prompt}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, prompt: e.target.value }))
              }
              onEnter={handleGenerate}
              mention={mention}
              placeholder={copy.prompt.placeholder}
              className="flex-1 relative"
            />
          </div>

          {/* Bottom Row: Controls & Generate */}
          <PromptFooter>
            <PromptControls>
              {/* Cinema Mode Toggle (Video / Photo) */}
              <div className="flex items-center bg-white/5 p-0.5 rounded-full border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setGenerationMode("video")}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring flex items-center gap-1.5 cursor-pointer ${
                    generationMode === "video"
                      ? "bg-brand text-white shadow-elevation-brand"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="23 7 16 12 23 17 23 7"/>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                  {copy.modes?.video || "视频"}
                </button>
                <button
                  type="button"
                  onClick={() => setGenerationMode("image")}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold transition-[background-color,border-color,color,transform] duration-fast ease-standard active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring flex items-center gap-1.5 cursor-pointer ${
                    generationMode === "image"
                      ? "bg-brand text-white shadow-elevation-brand"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  {copy.modes?.image || "摄影"}
                </button>
              </div>

              {/* Model Picker */}
              <div className="relative">
                <button
                  type="button"
                  ref={modelBtnRef}
                  data-studio-model={generationMode === "video" ? selectedVideoModel : selectedPhotoModel}
                  className={promptControlClassName({
                    active: openDropdown === "model",
                    className: "text-xs font-semibold active:scale-[0.98] active:duration-instant cursor-pointer",
                  })}
                  onClick={() =>
                    setOpenDropdown((d) => (d === "model" ? null : "model"))
                  }
                >
                  <span className="text-brand">✦</span>
                  <span className="max-w-[130px] truncate">
                    {generationMode === "video"
                      ? (availableCinemaVideoModels.find((m) => m.id === selectedVideoModel)?.name || "暂无可用模型")
                      : (availableCinemaPhotoModels.find((m) => m.id === selectedPhotoModel)?.name || "暂无可用模型")}
                  </span>
                </button>
                {openDropdown === "model" && (
                  <Dropdown
                    title={copy.models?.title || "电影模型"}
                    items={
                      generationMode === "video"
                        ? availableCinemaVideoModels.map((m) => m.name)
                        : availableCinemaPhotoModels.map((m) => m.name)
                    }
                    selected={
                      generationMode === "video"
                        ? (availableCinemaVideoModels.find((m) => m.id === selectedVideoModel)?.name)
                        : (availableCinemaPhotoModels.find((m) => m.id === selectedPhotoModel)?.name)
                    }
                    onSelect={(val) => {
                      if (generationMode === "video") {
                        const m = availableCinemaVideoModels.find((item) => item.name === val);
                        if (m) setSelectedVideoModel(m.id);
                      } else {
                        const m = availableCinemaPhotoModels.find((item) => item.name === val);
                        if (m) setSelectedPhotoModel(m.id);
                      }
                    }}
                    triggerRef={modelBtnRef}
                    onClose={() => setOpenDropdown(null)}
                  />
                )}
              </div>

              {/* Duration Button (only for video mode) */}
              {generationMode === "video" && (
                <div className="relative">
                  <button
                    ref={durationBtnRef}
                    className={promptControlClassName({
                      active: openDropdown === "duration",
                      className: "text-xs font-semibold active:scale-[0.98] active:duration-instant cursor-pointer",
                    })}
                    onClick={() =>
                      setOpenDropdown((d) => (d === "duration" ? null : "duration"))
                    }
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {videoDuration}
                  </button>
                  {openDropdown === "duration" && (
                    <Dropdown
                      title={copy.duration?.title || "视频时长"}
                      items={VIDEO_DURATIONS}
                      selected={videoDuration}
                      onSelect={(val) => setVideoDuration(val)}
                      triggerRef={durationBtnRef}
                      onClose={() => setOpenDropdown(null)}
                    />
                  )}
                </div>
              )}

              {/* Aspect Ratio Button */}
              <div className="relative">
                <button
                  ref={arBtnRef}
                  className={promptControlClassName({
                    active: openDropdown === "ar",
                    className: "text-xs font-semibold active:scale-[0.98] active:duration-instant cursor-pointer",
                  })}
                  onClick={() =>
                    setOpenDropdown((d) => (d === "ar" ? null : "ar"))
                  }
                >
                  <PromptAspectRatioIcon />
                  {settings.aspect_ratio}
                </button>
                {openDropdown === "ar" && (
                  <Dropdown
                    title={copy.dropdowns.aspectRatio}
                    items={ASPECT_RATIOS}
                    selected={settings.aspect_ratio}
                    onSelect={(val) =>
                      setSettings((prev) => ({ ...prev, aspect_ratio: val }))
                    }
                    triggerRef={arBtnRef}
                    onClose={() => setOpenDropdown(null)}
                  />
                )}
              </div>

              {/* Resolution Button */}
              <div className="relative">
                <button
                  ref={resBtnRef}
                  className={promptControlClassName({
                    active: openDropdown === "res",
                    className: "text-xs font-semibold active:scale-[0.98] active:duration-instant cursor-pointer",
                  })}
                  onClick={() =>
                    setOpenDropdown((d) => (d === "res" ? null : "res"))
                  }
                >
                  <PromptQualityIcon />
                  {resolution}
                </button>
                {openDropdown === "res" && (
                  <Dropdown
                    title={copy.dropdowns.resolution}
                    items={RESOLUTIONS}
                    selected={resolution}
                    onSelect={setResolution}
                    triggerRef={resBtnRef}
                    onClose={() => setOpenDropdown(null)}
                  />
                )}
              </div>

              {/* Summary Card (triggers overlay) */}
              <button
                className={promptControlClassName({
                  className: "text-left overflow-hidden text-xs font-semibold text-white/70 hover:text-white active:scale-[0.98] active:duration-instant cursor-pointer",
                })}
                onClick={() => setIsOverlayOpen(true)}
              >
                <div className="w-1.5 h-1.5 bg-brand rounded-full shadow-lg shadow-brand/20 shrink-0" />
                <span className="max-w-[120px] truncate text-xs font-semibold text-white/70 group-hover:text-brand transition-colors">
                  {settings.camera} · {formatSummaryValue()}
                </span>
              </button>
            </PromptControls>

            {/* Generate Button */}
            <PromptAction
              disabled={isGenerating || !settings.prompt.trim() || (generationMode === "video" ? !availableCinemaVideoModels.length : !availableCinemaPhotoModels.length)}
              onClick={handleGenerate}
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin inline-block text-black">◌</span>
                  <span>{copy.prompt.generating}</span>
                </>
              ) : (
                <>
                  <span>{copy.prompt.generate}</span>
                </>
              )}
            </PromptAction>
          </PromptFooter>
      </PromptComposer>
      {fullscreenUrl && (
        <div 
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/95 backdrop-blur-sm animate-fade-in"
          onClick={() => setFullscreenUrl(null)}
        >
          <button
            type="button"
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-[background-color,border-color,color,transform] duration-fast ease-standard border border-white/10 active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring cursor-pointer"
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
          {failedMedia[fullscreenUrl] ? (
            <div
              className="flex flex-col items-center justify-center bg-zinc-900 border border-white/10 rounded-2xl p-8 text-zinc-400 gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-sm">媒体加载失败</span>
            </div>
          ) : isVideoUrl(fullscreenUrl) ? (
            <video
              src={fullscreenUrl}
              autoPlay
              loop
              controls
              playsInline
              onError={() => handleMediaError(fullscreenUrl)}
              className="max-w-[95vw] max-h-[95vh] rounded-2xl shadow-2xl object-contain animate-scale-up" 
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={fullscreenUrl}
              alt={copy.fullscreen.alt}
              onError={() => handleMediaError(fullscreenUrl)}
              className="max-w-[95vw] max-h-[95vh] rounded-2xl shadow-2xl object-contain animate-scale-up" 
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}  
      {/* ── Camera Controls Overlay ── */}
      <CameraControlsOverlay
        isOpen={isOverlayOpen}
        onClose={() => setIsOverlayOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
        copy={copy}
      />
    </div>
  );
}
