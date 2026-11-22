'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Sparkles,
  Image as ImageIcon,
  Film,
  Volume2,
  Smile,
  Play,
  Pause,
  Download,
  ExternalLink,
  RotateCcw,
  X,
  Plus,
  Box,
  ArrowUp,
  LoaderCircle,
  Check,
  Lock,
  Unlock,
  Settings2,
  Maximize2,
  SlidersHorizontal,
  Layers,
  Wand2,
  Upload,
  Radio,
  Music,
  ArrowUpRight,
} from 'lucide-react';
import { useUserSession } from '@/lib/hooks/useUserSession';
import { localizeStudioPath } from '@/lib/locales';

// Studio components and primitives
import {
  PromptComposer,
  PromptFooter,
  PromptControls,
  PromptAction,
  PromptPopover,
  PromptChevronIcon,
  promptControlClassName,
  PROMPT_CONTROL_LABEL_CLASS,
} from '@/packages/studio/src/components/prompt/PromptComposer.jsx';
import { PromptInputField } from '@/packages/studio/src/components/prompt/PromptInputField.jsx';
import { usePromptMention } from '@/packages/studio/src/components/prompt/PromptAttachments.jsx';
import { UploadButton } from '@/packages/studio/src/components/ImageStudio.jsx';
import FrontendModelPicker from '@/packages/studio/src/components/FrontendModelPicker.jsx';
import ImageSpecPopover from '@/packages/studio/src/components/ImageSpecPopover.jsx';
import { VideoSpecPopover } from '@/packages/studio/src/components/VideoSpecPopover.jsx';
import ModelPriceTag from '@/packages/studio/src/components/ModelPriceTag.jsx';
import DrawModal from '@/packages/studio/src/components/DrawModal.jsx';
import { priceForIds } from '@/packages/studio/src/modelPrice.js';
import { submitPlatformGeneration } from '@/packages/studio/src/platformGeneration.js';
import { hasTemporaryReferenceUrl } from '@/packages/studio/src/stableAssetReference.js';

// Studio models, logos & config
import {
  t2iModels,
  t2vModels,
  audioModels,
  lipsyncModels,
  isModelActive,
  getAspectRatiosForModel,
  getResolutionsForModel,
  getAspectRatiosForI2IModel,
  getResolutionsForI2IModel,
  getAspectRatiosForVideoModel,
  getResolutionsForVideoModel,
  getDurationsForModel,
} from '@/packages/studio/src/models.js';
import {
  imageModelCatalog,
  imageModelPickerEntryByVariantId,
  getImageReferenceVariant,
  videoModelCatalog,
} from '@/packages/studio/src/modelFamilies.js';
import {
  getModelDisplayName,
  getModelBadge,
} from '@/packages/studio/src/modelDescriptions.js';
import {
  getModelMediaCapabilities,
} from '@/packages/studio/src/modelCapabilities.js';
import {
  getProviderLogo,
  getProviderStyle,
  invertLogos,
} from '@/packages/studio/src/providerLogos.js';
import { scopedPersistKey } from '@/packages/studio/src/persistKey.js';
import { resolveCopy } from '@/packages/studio/src/i18nUtils.js';

// Messages
import enMessages from '@/packages/studio/src/messages/en/imageStudio.json';
import zhMessages from '@/packages/studio/src/messages/zh/imageStudio.json';
import jaMessages from '@/packages/studio/src/messages/ja-JP/imageStudio.json';
import koMessages from '@/packages/studio/src/messages/ko-KR/imageStudio.json';
import zhTwMessages from '@/packages/studio/src/messages/zh-TW/imageStudio.json';
import esMessages from '@/packages/studio/src/messages/es/imageStudio.json';

const PERSIST_PREFIX = 'hg_home_composer_v2';

// 5 Core Modes definition for Dreamina Style Workbench
const CREATION_MODES = [
  { id: 'agent', label: 'AI Agent', icon: Sparkles },
  { id: 'image', label: 'AI 图像', icon: ImageIcon, badge: null },
  { id: 'video', label: 'AI 视频', icon: Film },
  { id: 'audio', label: 'AI 音频', icon: Volume2 },
  { id: 'digital-human', label: 'AI 数字人', icon: Smile },
];

// Presets for Audio TTS Voices
const AUDIO_VOICE_PRESETS = [
  {
    id: 'female_warm',
    name: '温暖女声 · 抒情解说',
    previewUrl: 'https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3',
    gender: 'female',
    tag: '解说/播客',
  },
  {
    id: 'male_magnetic',
    name: '磁性男声 · 影视旁白',
    previewUrl: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
    gender: 'male',
    tag: '电影/纪录片',
  },
  {
    id: 'female_vibrant',
    name: '活力带货 · 激情口播',
    previewUrl: 'https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3',
    gender: 'female',
    tag: '电商/短视频',
  },
  {
    id: 'male_tech',
    name: '沉稳男声 · 科技分析',
    previewUrl: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
    gender: 'male',
    tag: '商业/科技',
  },
];

// Music Style Tags
const MUSIC_GENRE_TAGS = [
  '流行流行 Pop',
  '电子电子 EDM',
  '古典交响 Orchestral',
  '电影配乐 Cinematic',
  '赛博朋克 Cyberpunk',
  '嘻哈节奏 Hip-Hop',
  '纯净钢琴 Piano Solo',
];

const HomeStudioPromptComposer = forwardRef(function HomeStudioPromptComposer(
  {
    locale = 'zh',
    onRequireAuth,
    onStartCreation,
    onModeChange,
    onTaskComplete,
    skillOptions = [],
    onSkillSelect,
    className = '',
  },
  ref,
) {
  const router = useRouter();
  const { user } = useUserSession();
  const apiKey = user?.apiKey || user?.id || null;
  const isZh = String(locale).startsWith('zh');
  const studioBase = localizeStudioPath(locale);

  // i18n copy resolution
  const copy = useMemo(() => {
    return resolveCopy(
      enMessages,
      {
        'zh-CN': zhMessages,
        'zh-TW': zhTwMessages,
        'ja-JP': jaMessages,
        'ko-KR': koMessages,
        es: esMessages,
        'es-ES': esMessages,
      },
      locale,
    );
  }, [locale]);

  // Mode Selection: default to the first screenshot mode; query strings still override it.
  const [activeTab, setActiveTab] = useState('agent');

  // Multi-mode draft storage to isolate and preserve parameters per mode
  const [drafts, setDrafts] = useState({
    image: {
      prompt: '',
      modelId: 'seedream-5.0',
      ar: '1:1',
      quality: '1K',
      width: 1024,
      height: 1024,
      batch: 1,
      imageUrls: [],
      advanced: { seed: -1, negativePrompt: '', guidance: 7, steps: 25 },
    },
    video: {
      prompt: '',
      modelId: 'seedance-2.0',
      videoMode: 't2v', // 't2v' | 'i2v' | 'first_last' | 'multi_image' | 'video_ref'
      ar: '16:9',
      resolution: '720p',
      duration: 5,
      firstFrameUrl: null,
      endFrameUrl: null,
      imageUrls: [],
      videoRefUrl: null,
      advanced: { cameraMotion: 'fixed', generateAudio: true, seed: -1 },
    },
    audio: {
      prompt: '',
      modelId: 'minimax-speech-2.6',
      subMode: 'tts', // 'tts' | 'clone' | 'music'
      voiceId: 'female_warm',
      speed: 1.0,
      language: 'zh',
      cloneAudioUrl: null,
      musicStyle: '电影配乐 Cinematic',
      isInstrumental: false,
    },
    agent: {
      prompt: '',
      modelId: 'deepseek-chat',
      referenceUrls: [],
    },
    'digital-human': {
      prompt: '',
      modelId: 'infinitetalk',
      driveType: 'text', // 'text' | 'audio'
      avatarUrl: null,
      driveAudioUrl: null,
      voiceId: 'female_warm',
      resolution: '720p',
    },
  });

  // Sync with active models on mount
  useEffect(() => {
    let isMounted = true;
    fetch('/api/models/active?nocache=1')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!isMounted || !Array.isArray(data?.models) || !data.models.length) return;
        const activeIds = new Set(data.models.map((m) => m.id));
        setDrafts((prev) => {
          let changed = false;
          const next = { ...prev };
          // Image
          if (!activeIds.has(prev.image.modelId)) {
            const firstImg = data.models.find((m) => m.type === 'image')?.id || 'seedream-5.0';
            next.image = { ...next.image, modelId: firstImg };
            changed = true;
          }
          // Video
          if (!activeIds.has(prev.video.modelId)) {
            const firstVid = data.models.find((m) => m.type === 'video')?.id || 'seedance-2.0';
            next.video = { ...next.video, modelId: firstVid };
            changed = true;
          }
          return changed ? next : prev;
        });
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Load URL query param on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlType = searchParams.get('type');
      if (urlType && CREATION_MODES.some((m) => m.id === urlType)) {
        setActiveTab(urlType);
        onModeChange?.(urlType);
      }
    }
  }, [onModeChange]);

  const stopAudition = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    setAuditionPlaying(null);
  }, []);

  // Sync tab change with URL without refreshing page
  const handleSwitchTab = useCallback((modeId) => {
    stopAudition();
    setActiveTab(modeId);
    onModeChange?.(modeId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('type', modeId);
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [onModeChange, stopAudition]);

  // Current active draft helper
  const currentDraft = drafts[activeTab] || drafts.image;

  const updateCurrentDraft = useCallback((updater) => {
    setDrafts((prev) => {
      const modeData = prev[activeTab] || {};
      const nextData = typeof updater === 'function' ? updater(modeData) : { ...modeData, ...updater };
      return { ...prev, [activeTab]: nextData };
    });
  }, [activeTab]);

  // Allowed options dynamically derived from current model schema
  const allowedImageAspectRatios = useMemo(() => {
    const list = getAspectRatiosForModel(currentDraft.modelId);
    return list && list.length > 0 ? list : ['1:1', '3:4', '16:9', '4:3', '9:16', '2:3', '3:2', '21:9'];
  }, [currentDraft.modelId]);

  const allowedImageResolutions = useMemo(() => {
    const list = getResolutionsForModel(currentDraft.modelId);
    return list && list.length > 0 ? list : ['1K', '2K', '4K'];
  }, [currentDraft.modelId]);

  const allowedVideoAspectRatios = useMemo(() => {
    const list = getAspectRatiosForVideoModel(currentDraft.modelId);
    return list && list.length > 0 ? list : ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
  }, [currentDraft.modelId]);

  const allowedVideoResolutions = useMemo(() => {
    const list = getResolutionsForVideoModel(currentDraft.modelId);
    return list && list.length > 0 ? list : ['720p', '1080p', '480p'];
  }, [currentDraft.modelId]);

  const allowedVideoDurations = useMemo(() => {
    const list = getDurationsForModel(currentDraft.modelId);
    return list && list.length > 0 ? list : [5, 10, 15];
  }, [currentDraft.modelId]);

  const handleModelSelect = useCallback(
    (entry) => {
      const modelId = entry.id;
      if (activeTab === 'image') {
        const supportedRatios = getAspectRatiosForModel(modelId);
        const supportedResolutions = getResolutionsForModel(modelId);
        updateCurrentDraft((prev) => {
          const nextAr =
            supportedRatios.length > 0 && !supportedRatios.includes(prev.ar)
              ? supportedRatios[0] || '1:1'
              : prev.ar;
          const nextQuality =
            supportedResolutions.length > 0 && !supportedResolutions.includes(prev.quality)
              ? supportedResolutions[0] || '1K'
              : prev.quality;
          return {
            ...prev,
            modelId,
            ar: nextAr,
            quality: nextQuality,
          };
        });
      } else if (activeTab === 'video') {
        const supportedRatios = getAspectRatiosForVideoModel(modelId);
        const supportedResolutions = getResolutionsForVideoModel(modelId);
        const supportedDurations = getDurationsForModel(modelId);
        updateCurrentDraft((prev) => {
          const nextAr =
            supportedRatios.length > 0 && !supportedRatios.includes(prev.ar)
              ? supportedRatios[0] || '16:9'
              : prev.ar;
          const nextRes =
            supportedResolutions.length > 0 && !supportedResolutions.includes(prev.resolution)
              ? supportedResolutions[0] || '720p'
              : prev.resolution;
          const nextDur =
            supportedDurations.length > 0 && !supportedDurations.includes(prev.duration)
              ? supportedDurations[0] || 5
              : prev.duration;
          return {
            ...prev,
            modelId,
            ar: nextAr,
            resolution: nextRes,
            duration: nextDur,
          };
        });
      } else {
        updateCurrentDraft({ modelId });
      }
      setDropdownOpen(null);
    },
    [activeTab, updateCurrentDraft],
  );

  // Dropdown & Popover control state
  const [dropdownOpen, setDropdownOpen] = useState(null); // 'model' | 'spec' | 'advanced' | 'audio_voice' | 'skills' | 'drive' | null
  const [isDrawModalOpen, setIsDrawModalOpen] = useState(false);
  const [fullscreenUrl, setFullscreenUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Active generation task state for in-place rendering & progress
  const [activeTask, setActiveTask] = useState(null);
  // Recent completed creations in session
  const [recentCreations, setRecentCreations] = useState([]);

  // Audio audition sample state
  const [auditionPlaying, setAuditionPlaying] = useState(null);
  const audioPlayerRef = useRef(null);

  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);
  const avatarInputRef = useRef(null);

  // Close popovers on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(null);
      }
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [dropdownOpen]);

  // Expose imperative handle for parent component (JimengHomePortal)
  useImperativeHandle(ref, () => ({
    setPromptText: (text, modeId) => {
      const targetMode = modeId && CREATION_MODES.some((m) => m.id === modeId) ? modeId : activeTab;
      if (targetMode !== activeTab) {
        handleSwitchTab(targetMode);
      }
      setDrafts((prev) => ({
        ...prev,
        [targetMode]: {
          ...(prev[targetMode] || {}),
          prompt: text || '',
        },
      }));
      textareaRef.current?.focus();
    },
    appendPromptText: (text) => {
      if (!text) return;
      updateCurrentDraft((prev) => ({
        prompt: prev.prompt ? `${prev.prompt}，${text}` : text,
      }));
      textareaRef.current?.focus();
    },
    toggleSkillPrompt: (skillPrompt) => {
      if (!skillPrompt) return;
      updateCurrentDraft((prev) => {
        const cur = prev.prompt || '';
        if (cur.includes(skillPrompt)) {
          const cleaned = cur
            .replace(new RegExp(`，?${skillPrompt.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}`), '')
            .replace(new RegExp(`${skillPrompt.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}，?`), '')
            .trim();
          return { prompt: cleaned };
        }
        return { prompt: cur ? `${cur}，${skillPrompt}` : skillPrompt };
      });
      textareaRef.current?.focus();
    },
    applyCreationPreset: ({ prompt: newPrompt, modelId, ar, quality, batch, mode }) => {
      const targetMode = mode && CREATION_MODES.some((m) => m.id === mode) ? mode : activeTab;
      if (targetMode !== activeTab) {
        handleSwitchTab(targetMode);
      }
      const safeModelId =
        modelId === 'gpt-image-2.5-flash'
          ? 'seedream-5.0-pro'
          : modelId === 'seedance-2.5-text-to-video'
          ? 'kling-v2.6-pro-t2v'
          : modelId;
      setDrafts((prev) => {
        const modeData = prev[targetMode] || {};
        return {
          ...prev,
          [targetMode]: {
            ...modeData,
            prompt: newPrompt !== undefined ? newPrompt : modeData.prompt,
            modelId: safeModelId || modeData.modelId,
            ar: ar || modeData.ar,
            quality: quality || modeData.quality,
            batch: batch || modeData.batch,
          },
        };
      });
      textareaRef.current?.focus();
    },
    focusTextarea: () => {
      textareaRef.current?.focus();
    },
    switchMode: (modeId) => {
      handleSwitchTab(modeId);
    },
    getComposerState: () => ({
      activeTab,
      currentDraft,
    }),
  }));

  // File Upload Handlers (Supports Image, Video, Audio)
  const handleFileUpload = useCallback(async (file, targetSlot = 'general') => {
    if (!file) return;

    // Check size limit: 100MB for video/audio, 20MB for image
    const isLargeMedia = file.type.startsWith('video') || file.type.startsWith('audio');
    const maxSize = isLargeMedia ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(isZh ? `文件过大，单文件不得超过 ${isLargeMedia ? '100MB' : '20MB'}` : 'File too large');
      return;
    }

    // Immediate local preview object URL
    const localUrl = URL.createObjectURL(file);
    setUploadProgress(10);

    // If user is unauthenticated, allow local preview until generation
    if (!user) {
      if (activeTab === 'image') {
        updateCurrentDraft((prev) => ({ imageUrls: [...prev.imageUrls, localUrl] }));
      } else if (activeTab === 'agent') {
        updateCurrentDraft((prev) => ({ referenceUrls: [...prev.referenceUrls, localUrl] }));
      } else if (activeTab === 'video') {
        if (targetSlot === 'first_frame') updateCurrentDraft({ firstFrameUrl: localUrl });
        else if (targetSlot === 'end_frame') updateCurrentDraft({ endFrameUrl: localUrl });
        else if (targetSlot === 'video_ref') updateCurrentDraft({ videoRefUrl: localUrl });
        else updateCurrentDraft((prev) => ({ imageUrls: [...prev.imageUrls, localUrl] }));
      } else if (activeTab === 'audio') {
        updateCurrentDraft({ cloneAudioUrl: localUrl });
      } else if (activeTab === 'digital-human') {
        if (targetSlot === 'avatar') updateCurrentDraft({ avatarUrl: localUrl });
        else updateCurrentDraft({ driveAudioUrl: localUrl });
      }
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 400);
      toast.success(isZh ? '素材已就绪' : 'Asset ready');
      return;
    }

    // Authenticated upload to /api/assets/upload
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('studioId', `home-${activeTab}`);
      formData.append('title', file.name || '上传素材');

      setUploadProgress(40);
      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(isZh ? '上传服务响应失败' : 'Upload failed');
      }

      const data = await res.json();
      const assetId = data.asset?.id;
      const isImageReference = activeTab === 'image' || (activeTab === 'video' && targetSlot !== 'video_ref');
      if (isImageReference && !assetId) throw new Error(isZh ? '素材保存失败，请重新上传' : 'Asset could not be saved. Please upload again.');
      const finalUrl = isImageReference
        ? `/api/assets/${encodeURIComponent(assetId)}/download?inline=1`
        : data.url || data.asset?.url || localUrl;
      setUploadProgress(100);

      // Save into respective slot
      if (activeTab === 'image') {
        updateCurrentDraft((prev) => ({ imageUrls: [...prev.imageUrls, finalUrl] }));
      } else if (activeTab === 'agent') {
        updateCurrentDraft((prev) => ({ referenceUrls: [...prev.referenceUrls, finalUrl] }));
      } else if (activeTab === 'video') {
        if (targetSlot === 'first_frame') updateCurrentDraft({ firstFrameUrl: finalUrl });
        else if (targetSlot === 'end_frame') updateCurrentDraft({ endFrameUrl: finalUrl });
        else if (targetSlot === 'video_ref') updateCurrentDraft({ videoRefUrl: finalUrl });
        else updateCurrentDraft((prev) => ({ imageUrls: [...prev.imageUrls, finalUrl] }));
      } else if (activeTab === 'audio') {
        updateCurrentDraft({ cloneAudioUrl: finalUrl });
      } else if (activeTab === 'digital-human') {
        if (targetSlot === 'avatar') updateCurrentDraft({ avatarUrl: finalUrl });
        else updateCurrentDraft({ driveAudioUrl: finalUrl });
      }
      toast.success(isZh ? '素材上传并解析成功' : 'Asset uploaded successfully');
    } catch (err) {
      console.error('[Upload error]', err);
      toast.error(isZh ? '上传失败，请重试' : 'Upload failed');
    } finally {
      setTimeout(() => setUploadProgress(0), 400);
    }
  }, [user, activeTab, isZh, updateCurrentDraft]);

  // Drag and drop event handlers
  const [isDragOver, setIsDragOver] = useState(false);
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Paste event handler for pasting screenshots directly
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileUpload(file);
          toast.success(isZh ? '已捕获剪贴板截图并自动上传' : 'Clipboard image pasted');
          break;
        }
      }
    }
  };

  // Mention system integration
  const mention = usePromptMention({
    enabled: true,
    sources: activeTab === 'agent' ? currentDraft.referenceUrls || [] : currentDraft.imageUrls || [],
    onSelectMention: (item) => {
      updateCurrentDraft((prev) => ({
        prompt: prev.prompt ? `${prev.prompt} @${item.name || '素材'} ` : `@${item.name || '素材'} `,
      }));
    },
  });

  // Audition sample audio playback
  const handleToggleAudition = (voice) => {
    if (auditionPlaying === voice.id) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      setAuditionPlaying(null);
      return;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = voice.previewUrl;
      audioPlayerRef.current.play();
      setAuditionPlaying(voice.id);
    }
  };

  // Generation submission handler
  const handleTriggerSubmit = useCallback(async () => {
    if (isSubmitting) return;

    const draft = currentDraft;
    const promptText = (draft.prompt || '').trim();

    // 1. Input Validation
    if (!promptText && activeTab !== 'digital-human') {
      toast.error(isZh ? '请输入创作提示词或指令' : 'Please enter a creation prompt');
      textareaRef.current?.focus();
      return;
    }

    if (activeTab === 'image' && Number(draft.batch) > 1) {
      toast.error(isZh ? '首页暂不支持批量生成，请前往图片工作台' : 'For batch generation, please use the image studio.');
      return;
    }
    if (activeTab === 'image' && (hasTemporaryReferenceUrl(draft.imageUrls) || (draft.imageUrls || []).some((url) => /^(?:blob:|data:)/i.test(url)))) {
      toast.error(isZh ? '参考图已失效，请重新上传' : 'Reference image expired. Please upload again.');
      return;
    }

    if (activeTab === 'video' && (hasTemporaryReferenceUrl([...(draft.imageUrls || []), draft.firstFrameUrl, draft.endFrameUrl]) || [...(draft.imageUrls || []), draft.firstFrameUrl, draft.endFrameUrl].some((url) => typeof url === 'string' && /^(?:blob:|data:)/i.test(url)))) {
      toast.error(isZh ? '参考图已失效，请重新上传' : 'Reference image expired. Please upload again.');
      return;
    }

    if (activeTab === 'video' && (draft.firstFrameUrl || draft.endFrameUrl || draft.imageUrls?.length)) {
      toast.error(isZh ? '参考图视频请前往视频工作台生成' : 'Please use the video studio for image-to-video generation.');
      return;
    }

    if (activeTab === 'video' && draft.videoMode === 'first_last' && (!draft.firstFrameUrl || !draft.endFrameUrl)) {
      toast.error(isZh ? '首尾帧模式需要同时上传首帧和尾帧图片' : 'First & Last frame mode requires both frames');
      return;
    }

    if (activeTab === 'digital-human' && !draft.avatarUrl) {
      toast.error(isZh ? '请先上传数字人肖像图片或视频' : 'Please upload avatar photo or video');
      return;
    }

    // 2. Authentication Gate: If unauthenticated, trigger login modal and hold task
    if (!user) {
      if (onRequireAuth) {
        onRequireAuth({
          mode: activeTab,
          draft,
        });
      } else {
        toast.error(isZh ? '请先登录以进行创作' : 'Please login to create');
      }
      return;
    }

    // 3. Prepare task payload according to mode
    setIsSubmitting(true);
    let taskParams = {};

    if (activeTab === 'image') {
      taskParams = {
        aspect_ratio: draft.ar,
        resolution: draft.quality,
        batch_size: draft.batch,
        negative_prompt: draft.advanced?.negativePrompt || undefined,
        seed: draft.advanced?.seed !== -1 ? Number(draft.advanced?.seed) : undefined,
        image_urls: draft.imageUrls?.length > 0 ? draft.imageUrls : undefined,
        width: draft.width || undefined,
        height: draft.height || undefined,
      };
    } else if (activeTab === 'video') {
      taskParams = {
        reference_mode: draft.videoMode,
        aspect_ratio: draft.ar,
        resolution: draft.resolution,
        duration: Number(draft.duration) || 5,
        camera_motion: draft.advanced?.cameraMotion || 'fixed',
        generate_audio: draft.advanced?.generateAudio ?? true,
        first_frame_url: draft.firstFrameUrl || undefined,
        end_frame_url: draft.endFrameUrl || undefined,
        image_urls: draft.imageUrls?.length > 0 ? draft.imageUrls : undefined,
        video_url: draft.videoRefUrl || undefined,
      };
    } else if (activeTab === 'audio') {
      taskParams = {
        audio_mode: draft.subMode,
        voice_id: draft.voiceId,
        speed: draft.speed,
        language: draft.language,
        clone_audio_url: draft.cloneAudioUrl || undefined,
        music_style: draft.musicStyle || undefined,
        instrumental: draft.isInstrumental,
      };
    } else if (activeTab === 'digital-human') {
      taskParams = {
        avatar_url: draft.avatarUrl,
        drive_type: draft.driveType,
        audio_url: draft.driveAudioUrl || undefined,
        voice_id: draft.voiceId || 'female_warm',
        resolution: draft.resolution || '720p',
      };
    } else if (activeTab === 'agent') {
      taskParams = {
        reference_urls: draft.referenceUrls || [],
      };
    }

    // 4. Initialize active in-place status tracking card
    const trackingId = `local-task-${Date.now()}`;
    setActiveTask({
      id: trackingId,
      status: 'queued',
      phase: '正在请求服务端报价与锁定额度...',
      progress: 15,
      elapsed: 0,
      prompt: promptText,
      modelId: draft.modelId,
      mediaType: activeTab,
      resultUrl: null,
    });

    const timer = setInterval(() => {
      setActiveTask((prev) => {
        if (!prev || prev.status === 'succeeded' || prev.status === 'failed') return prev;
        return { ...prev, elapsed: (prev.elapsed || 0) + 1 };
      });
    }, 1000);

    try {
      const result = await submitPlatformGeneration({
        modelId: draft.modelId,
        studioId: `home-${activeTab}`,
        prompt: promptText,
        parameters: taskParams,
        onPhase: (phase, reqId) => {
          setActiveTask((prev) => {
            if (!prev) return prev;
            let progress = prev.progress;
            let phaseDesc = '正在处理中...';
            if (phase === 'reserved') {
              progress = 30;
              phaseDesc = isZh ? '任务已排队，正在调度最优模型供应商...' : 'Queued, scheduling model route...';
            } else if (phase === 'completed') {
              progress = 100;
              phaseDesc = isZh ? '生成完成！' : 'Generation complete!';
            }
            return {
              ...prev,
              id: reqId || prev.id,
              status: phase === 'completed' ? 'succeeded' : 'processing',
              phase: phaseDesc,
              progress,
            };
          });
        },
      });

      clearInterval(timer);
      const finalUrl = result?.result_url || result?.url || (Array.isArray(result?.outputs) ? result.outputs[0] : null);

      setActiveTask({
        id: result?.id || trackingId,
        status: 'succeeded',
        phase: isZh ? '生成完成！已同步至云端资产库' : 'Complete! Synced to Asset Library',
        progress: 100,
        resultUrl: finalUrl,
        prompt: promptText,
        modelId: draft.modelId,
        mediaType: activeTab,
      });

      if (finalUrl) {
        const completedItem = {
          id: result?.id || trackingId,
          url: finalUrl,
          result_url: finalUrl,
          prompt: promptText,
          mediaType: activeTab,
          studio_id: activeTab,
          modelId: draft.modelId,
          model_id: draft.modelId,
          createdAt: new Date().toISOString(),
          status: 'succeeded',
        };
        setRecentCreations((prev) => [completedItem, ...prev]);
        onTaskComplete?.(completedItem);
      }

      toast.success(isZh ? '创作任务已成功生成！' : 'Creation successful!');
    } catch (err) {
      clearInterval(timer);
      console.error('[Generation submission error]', err);
      setActiveTask({
        id: trackingId,
        status: 'failed',
        phase: err.message || (isZh ? '生成任务失败，额度已安全释放' : 'Generation failed'),
        progress: 100,
        error: err.message,
      });
      toast.error(err.message || (isZh ? '生成遇到异常，已自动退款' : 'Generation error'));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, currentDraft, activeTab, isZh, user, onRequireAuth]);

  // Mode Specific Placeholders
  const placeholderText = useMemo(() => {
    switch (activeTab) {
      case 'video':
        return isZh
          ? '描述视频镜头运镜、光影与动态细节... 例如：电影级镜头向前缓缓推进，阳光穿透薄雾'
          : 'Describe camera motion, cinematic lighting & scene dynamics... e.g. Cinematic slow zoom in, golden sunrise rays';
      case 'audio':
        return isZh
          ? '输入需要配音朗读的台词文案，或描述你想创作的音乐风格与情绪...'
          : 'Enter script for voiceover, or describe musical rhythm, genre and emotion...';
      case 'agent':
        return isZh
          ? '输入复杂创作指令，例如：为我的新消费品牌策划一组小红书爆款海报与宣传短视频脚本全案...'
          : 'Enter complex creative instruction, e.g. Design a complete viral campaign including product posters and video script...';
      case 'digital-human':
        return isZh
          ? '输入数字人台词或带货口播脚本，数字人将呈现极度自然的声画协同与面部微表情...'
          : 'Enter digital human script for realistic audio-visual lip synchronization...';
      default:
        return isZh
          ? '输入提示词描述你想要创建的图像... 支持中英文，按 @ 可引用参考素材，/ 可触发创作预设'
          : 'Describe the image you want to create... Type @ for references, / for skill presets';
    }
  }, [activeTab, isZh]);

  const referenceUrls = activeTab === 'agent'
    ? currentDraft.referenceUrls || []
    : currentDraft.imageUrls || [];

  // Audio HTML element for auditioning
  return (
    <>
      <audio ref={audioPlayerRef} onEnded={() => setAuditionPlaying(null)} className="hidden" />

      {/* Main Creative Composer Island */}
      <PromptComposer
        positionClassName="relative z-20 w-full max-w-[1280px]"
        flush
        minHeightClassName="min-h-[280px] sm:min-h-[324px]"
        panelClassName={`w-full bg-surface-glass border border-line-subtle hover:border-line focus-within:border-brand-line transition-colors duration-fast ease-standard shadow-elevation-2 backdrop-blur-2xl flex flex-col justify-between group ${className} ${
          isDragOver ? 'ring-2 ring-brand border-brand-line bg-brand/5' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* ── 1. Top Mode Tabs Strip ── */}
        <div
          role="tablist"
          aria-label={isZh ? '创作类型' : 'Creation type'}
          className="flex min-h-[64px] items-center gap-1.5 overflow-x-auto px-4 py-2 scrollbar-rail select-none"
        >
          {CREATION_MODES.map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => handleSwitchTab(tab.id)}
                className={`relative flex h-12 shrink-0 items-center gap-2 rounded-xl border px-4 sm:px-5 text-sm font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                  isActive
                    ? 'border-white/[0.06] bg-wash-strong text-ink font-semibold shadow-elevation-1'
                    : 'border-transparent text-ink-muted hover:text-ink hover:bg-wash'
                }`}
              >
                <TabIcon className="size-4 text-current" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── 2. Mode-Specific Sub-Mode Selector & Slots Ribbon ── */}
        <div className="px-5 pt-2 flex flex-col gap-2.5">
          {/* A. Video Mode Specific Sub-Mode Pills: [文生视频] [图生视频] [首尾帧] [多图参考] [视频参考] */}
          {activeTab === 'video' && (
            <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
              <span className="text-[11px] text-ink-subtle font-semibold shrink-0 uppercase tracking-wider mr-1">
                {isZh ? '模式:' : 'Mode:'}
              </span>
              {[
                { id: 't2v', label: '文生视频' },
                { id: 'i2v', label: '图生视频' },
                { id: 'first_last', label: '首尾帧生成' },
                { id: 'multi_image', label: '多图参考' },
                { id: 'video_ref', label: '视频参考' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateCurrentDraft({ videoMode: m.id })}
                  className={`control-focus h-control-xs shrink-0 rounded-full border px-3 text-label font-medium transition-[background-color,border-color,color] duration-fast ease-standard cursor-pointer ${
                    currentDraft.videoMode === m.id
                      ? 'border-brand-line bg-brand-soft font-semibold text-ink'
                      : 'border-line-subtle bg-wash text-ink-muted hover:border-line hover:bg-wash-strong hover:text-ink'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* B. Audio Mode Specific Sub-Mode Pills: [文本朗读 TTS] [声音克隆] [音乐生成] */}
          {activeTab === 'audio' && (
            <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
              <span className="text-[11px] text-ink-subtle font-semibold shrink-0 uppercase tracking-wider mr-1">
                {isZh ? '类型:' : 'Type:'}
              </span>
              {[
                { id: 'tts', label: '文本朗读 (TTS)' },
                { id: 'clone', label: '声音克隆' },
                { id: 'music', label: '音乐与音效' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateCurrentDraft({ subMode: m.id })}
                  className={`control-focus h-control-xs shrink-0 rounded-full border px-3 text-label font-medium transition-[background-color,border-color,color] duration-fast ease-standard cursor-pointer ${
                    currentDraft.subMode === m.id
                      ? 'border-brand-line bg-brand-soft font-semibold text-ink'
                      : 'border-line-subtle bg-wash text-ink-muted hover:border-line hover:bg-wash-strong hover:text-ink'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* ── 3. Reference Media Attachment Cards Strip ── */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Image and Agent reference thumbnails */}
            {(activeTab === 'image' || activeTab === 'agent') && (
              <div className="flex items-start gap-2 flex-wrap">
                {referenceUrls.map((url, idx) => (
                  <div
                    key={url + idx}
                    className="relative group size-[72px] overflow-hidden rounded-xl border border-white/15 bg-black/40 shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={isZh ? `参考素材 ${idx + 1}` : `Reference ${idx + 1}`}
                      className="size-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setFullscreenUrl(url)}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateCurrentDraft((prev) => ({
                          ...(activeTab === 'agent'
                            ? { referenceUrls: prev.referenceUrls.filter((_, i) => i !== idx) }
                            : { imageUrls: prev.imageUrls.filter((_, i) => i !== idx) }),
                        }))
                      }
                      aria-label={isZh ? '移除参考素材' : 'Remove reference'}
                      className="absolute top-1 right-1 size-4 rounded-full bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}

                <div className="group/reference relative">
                  <label className="flex h-[84px] w-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 bg-white/[0.02] text-ink-muted transition-colors hover:border-white/40 hover:bg-white/[0.05] hover:text-ink focus-within:border-brand-line">
                    <Plus className="size-4" aria-hidden="true" />
                    <span className="text-xs">{isZh ? '参考' : 'Reference'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      aria-label={isZh ? '上传参考图片' : 'Upload reference images'}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        files.forEach((f) => handleFileUpload(f));
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {activeTab === 'image' && (
                    <button
                      type="button"
                      aria-label={isZh ? '打开涂鸦草图' : 'Open sketch canvas'}
                      title={isZh ? '涂鸦草图' : 'Sketch canvas'}
                      onClick={() => setIsDrawModalOpen(true)}
                      className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border border-white/10 bg-raised text-ink-muted opacity-0 shadow-elevation-1 transition-opacity group-hover/reference:opacity-100 focus-visible:opacity-100"
                    >
                      <Wand2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Video Mode Media Slots */}
            {activeTab === 'video' && currentDraft.videoMode === 'first_last' && (
              <div className="flex items-center gap-3">
                {/* Slot 1: First Frame */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted">{isZh ? '首帧:' : 'First:'}</span>
                  {currentDraft.firstFrameUrl ? (
                    <div className="relative group size-12 rounded-xl overflow-hidden border border-brand-line bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={currentDraft.firstFrameUrl} alt="First" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => updateCurrentDraft({ firstFrameUrl: null })}
                        className="absolute top-1 right-1 size-4 rounded-full bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="h-9 px-2.5 rounded-xl border border-dashed border-white/20 hover:border-brand-line bg-white/[0.02] flex items-center gap-1.5 cursor-pointer text-xs text-white/60 hover:text-white">
                      <Plus className="size-3" />
                      <span>{isZh ? '添加首帧' : 'Add First'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files?.[0], 'first_frame')}
                      />
                    </label>
                  )}
                </div>

                {/* Slot 2: End Frame */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted">{isZh ? '尾帧:' : 'End:'}</span>
                  {currentDraft.endFrameUrl ? (
                    <div className="relative group size-12 rounded-xl overflow-hidden border border-brand-line bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={currentDraft.endFrameUrl} alt="End" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => updateCurrentDraft({ endFrameUrl: null })}
                        className="absolute top-1 right-1 size-4 rounded-full bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="h-9 px-2.5 rounded-xl border border-dashed border-white/20 hover:border-brand-line bg-white/[0.02] flex items-center gap-1.5 cursor-pointer text-xs text-white/60 hover:text-white">
                      <Plus className="size-3" />
                      <span>{isZh ? '添加尾帧' : 'Add End'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files?.[0], 'end_frame')}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Video Mode Video Reference Slot */}
            {activeTab === 'video' && currentDraft.videoMode === 'video_ref' && (
              <div className="flex items-center gap-2">
                {currentDraft.videoRefUrl ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white">
                    <Film className="size-4 text-brand" />
                    <span>{isZh ? '参考视频已载入' : 'Reference video loaded'}</span>
                    <button
                      type="button"
                      onClick={() => updateCurrentDraft({ videoRefUrl: null })}
                      className="text-white/40 hover:text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="h-9 px-3 rounded-xl border border-dashed border-white/20 hover:border-brand-line bg-white/[0.02] flex items-center gap-1.5 cursor-pointer text-xs text-white/60 hover:text-white">
                    <Upload className="size-3.5 text-brand" />
                    <span>{isZh ? '上传参考视频 (.mp4)' : 'Upload Video (.mp4)'}</span>
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files?.[0], 'video_ref')}
                    />
                  </label>
                )}
              </div>
            )}

            {/* Audio Voice Clone Slot */}
            {activeTab === 'audio' && currentDraft.subMode === 'clone' && (
              <div className="flex items-center gap-2">
                {currentDraft.cloneAudioUrl ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white">
                    <Volume2 className="size-4 text-brand" />
                    <span>{isZh ? '声音样本已就绪' : 'Voice sample ready'}</span>
                    <button
                      type="button"
                      onClick={() => updateCurrentDraft({ cloneAudioUrl: null })}
                      className="text-white/40 hover:text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="h-9 px-3 rounded-xl border border-dashed border-white/20 hover:border-brand-line bg-white/[0.02] flex items-center gap-1.5 cursor-pointer text-xs text-white/60 hover:text-white">
                    <Upload className="size-3.5 text-brand" />
                    <span>{isZh ? '上传 3-10 秒人声样本 (.mp3, .wav)' : 'Upload 3-10s voice (.mp3, .wav)'}</span>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files?.[0], 'clone_audio')}
                    />
                  </label>
                )}
              </div>
            )}

            {/* Digital Human Avatar Slot */}
            {activeTab === 'digital-human' && (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    ref={avatarInputRef}
                    id="home-composer-avatar-reference"
                    type="file"
                    accept="image/*,video/*"
                    className="sr-only"
                    aria-label={isZh ? '上传数字人形象素材' : 'Upload avatar reference'}
                    onChange={(e) => {
                      handleFileUpload(e.target.files?.[0], 'avatar');
                      e.target.value = '';
                    }}
                  />
                  {currentDraft.avatarUrl ? (
                    <div className="relative group size-[72px] overflow-hidden rounded-xl border border-brand-line bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={currentDraft.avatarUrl} alt={isZh ? '数字人参考素材' : 'Avatar reference'} className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => updateCurrentDraft({ avatarUrl: null })}
                        aria-label={isZh ? '移除数字人素材' : 'Remove avatar reference'}
                        className="absolute top-1 right-1 size-4 rounded-full bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="home-composer-avatar-reference" className="flex h-[84px] w-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 bg-white/[0.02] text-ink-muted transition-colors hover:border-white/40 hover:bg-white/[0.05] hover:text-ink focus-within:border-brand-line">
                      <Plus className="size-4" aria-hidden="true" />
                      <span className="text-xs">{isZh ? '参考' : 'Reference'}</span>
                    </label>
                  )}
                </div>

                {currentDraft.driveType === 'audio' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-muted">{isZh ? '驱动音频:' : 'Audio:'}</span>
                    {currentDraft.driveAudioUrl ? (
                      <div className="px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white flex items-center gap-1.5">
                        <Volume2 className="size-3 text-brand" />
                        <span>{isZh ? '音频已载入' : 'Audio loaded'}</span>
                        <button
                          type="button"
                          onClick={() => updateCurrentDraft({ driveAudioUrl: null })}
                          className="text-white/40 hover:text-white"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="h-9 px-2.5 rounded-xl border border-dashed border-white/20 hover:border-brand-line bg-white/[0.02] flex items-center gap-1.5 cursor-pointer text-xs text-white/60 hover:text-white">
                        <Upload className="size-3" />
                        <span>{isZh ? '上传录音' : 'Upload Audio'}</span>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e.target.files?.[0], 'drive_audio')}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── 4. Multiline Textarea Input Area ── */}
        <div className="relative px-5 pt-3 pb-1" onPaste={handlePaste}>
          <PromptInputField
            ref={textareaRef}
            value={currentDraft.prompt || ''}
            onChange={(e) => updateCurrentDraft({ prompt: e.target.value })}
            placeholder={placeholderText}
            mention={mention}
            mentionTitle={copy.promptBar?.mentionTitle || (isZh ? '可能@的内容' : 'Mentions')}
            onEnter={handleTriggerSubmit}
          />
        </div>

        {/* ── 5. Bottom Parameter Toolbar (Controls + Quote + Primary Generate Button) ── */}
        <PromptFooter bordered={false} className="px-4 pb-4">
          {/* Left Side: Parameters Controls */}
          <PromptControls ref={dropdownRef} className="min-w-0 flex-wrap overflow-visible">
            {/* 1. Model Selector Capsule Button */}
            <div className="relative shrink-0">
              <button
                type="button"
                data-testid="composer-model-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen((o) => (o === 'model' ? null : 'model'));
                }}
                aria-label={isZh ? `选择模型，当前为${getModelDisplayName(currentDraft.modelId, currentDraft.modelId)}` : `Choose model, current ${getModelDisplayName(currentDraft.modelId, currentDraft.modelId)}`}
                title={getModelDisplayName(currentDraft.modelId, currentDraft.modelId)}
                className={promptControlClassName({
                  active: dropdownOpen === 'model',
                  className: 'shrink-0 min-w-fit px-3',
                })}
              >
                {activeTab === 'agent' ? (
                  <Sparkles className="size-4 shrink-0 text-brand" aria-hidden="true" />
                ) : (
                  <Box className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                )}
                <span className="whitespace-nowrap text-sm font-semibold text-current">
                  {activeTab === 'agent' ? (isZh ? '自动' : 'Auto') : getModelDisplayName(currentDraft.modelId, currentDraft.modelId)}
                </span>
                <PromptChevronIcon />
              </button>

              {dropdownOpen === 'model' && (
                <PromptPopover
                  glass
                  positionClassName="absolute top-[calc(100%+8px)] left-0 z-popover"
                  onClick={(e) => e.stopPropagation()}
                  className="w-[calc(100vw-2rem)] sm:w-[400px] max-h-[min(540px,calc(100vh-200px))] flex flex-col overflow-hidden p-0"
                >
                  <FrontendModelPicker
                    studioType={activeTab}
                    selectedModel={currentDraft.modelId}
                    onSelect={handleModelSelect}
                    onClose={() => setDropdownOpen(null)}
                    copy={copy}
                    locale={locale}
                  />
                </PromptPopover>
              )}
            </div>

            {activeTab === 'agent' && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-expanded={dropdownOpen === 'skills'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen((open) => open === 'skills' ? null : 'skills');
                  }}
                  className={promptControlClassName({ active: dropdownOpen === 'skills', className: 'shrink-0 min-w-fit px-2.5' })}
                >
                  <span className={`${PROMPT_CONTROL_LABEL_CLASS} whitespace-nowrap`}>{isZh ? '技能' : 'Skills'}</span>
                  <PromptChevronIcon />
                </button>
                {dropdownOpen === 'skills' && (
                  <PromptPopover
                    role="menu"
                    aria-label={isZh ? '创作技能' : 'Creation skills'}
                    positionClassName="absolute top-[calc(100%+8px)] left-0 z-popover"
                    onClick={(e) => e.stopPropagation()}
                    className="w-[min(360px,calc(100vw-2rem))] max-h-[min(420px,calc(100vh-180px))] overflow-y-auto p-2"
                  >
                    <div className="px-2 py-1.5 text-xs font-semibold text-ink-subtle">
                      {isZh ? '选择创作技能' : 'Choose a skill'}
                    </div>
                    {skillOptions.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onSkillSelect?.(skill);
                          setDropdownOpen(null);
                        }}
                        className="control-focus flex min-h-10 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-body text-ink-muted transition-none hover:bg-wash-strong hover:text-ink"
                      >
                        <span className="min-w-0 truncate">{skill.label}</span>
                        {skill.badge && <span className="shrink-0 text-micro text-brand-text">{skill.badge}</span>}
                      </button>
                    ))}
                  </PromptPopover>
                )}
              </div>
            )}

            {/* 2. Mode-Specific Spec Popover (Image Spec or Video Spec or Audio Settings) */}
            {activeTab === 'image' && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  data-testid="composer-spec-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen((o) => (o === 'spec' ? null : 'spec'));
                  }}
                  aria-label={isZh ? `图像参数 ${currentDraft.ar}、${currentDraft.quality}、${currentDraft.batch} 张` : `Image settings ${currentDraft.ar}, ${currentDraft.quality}, ${currentDraft.batch} images`}
                  className={promptControlClassName({
                    active: dropdownOpen === 'spec',
                    className: 'shrink-0 min-w-fit px-2.5',
                  })}
                >
                  <span className={`${PROMPT_CONTROL_LABEL_CLASS} whitespace-nowrap`}>
                    {currentDraft.ar} · {currentDraft.quality} · {currentDraft.batch}
                  </span>
                  <PromptChevronIcon />
                </button>

                {dropdownOpen === 'spec' && (
                  <PromptPopover
                    positionClassName="absolute top-[calc(100%+8px)] left-0 z-popover"
                    onClick={(e) => e.stopPropagation()}
                    className="w-[calc(100vw-2rem)] sm:w-[420px] max-h-[min(540px,calc(100vh-200px))] overflow-y-auto custom-scrollbar p-4 flex flex-col"
                  >
                    <ImageSpecPopover
                      aspectRatios={allowedImageAspectRatios}
                      selectedAr={currentDraft.ar}
                      onSelectAr={(ar) => updateCurrentDraft({ ar })}
                      resolutions={allowedImageResolutions}
                      selectedQuality={currentDraft.quality}
                      onSelectQuality={(q) => updateCurrentDraft({ quality: q })}
                      showQuality={true}
                      batchSize={currentDraft.batch}
                      onChangeBatchSize={(n) => updateCurrentDraft({ batch: n })}
                      customWidth={currentDraft.width}
                      customHeight={currentDraft.height}
                      onChangeDimensions={({ width, height, aspectRatio }) => {
                        updateCurrentDraft({
                          width,
                          height,
                          ...(aspectRatio ? { ar: aspectRatio } : {}),
                        });
                      }}
                      copy={copy}
                    />
                    <details className="mt-3 border-t border-line-subtle pt-3">
                      <summary className="cursor-pointer text-xs font-medium text-ink-muted hover:text-ink">
                        {isZh ? '高级参数' : 'Advanced settings'}
                      </summary>
                      <div className="mt-3 flex flex-col gap-3">
                        <div>
                          <label htmlFor="home-image-seed" className="mb-1 block text-xs text-ink-subtle">
                            Seed（随机种子，-1 为随机）
                          </label>
                          <input
                            id="home-image-seed"
                            type="number"
                            value={currentDraft.advanced?.seed ?? -1}
                            onChange={(e) => updateCurrentDraft((prev) => ({
                              advanced: { ...prev.advanced, seed: parseInt(e.target.value, 10) || -1 },
                            }))}
                            className="h-9 w-full rounded-lg border border-line bg-well px-3 text-sm text-ink focus:border-brand-line focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="home-image-negative-prompt" className="mb-1 block text-xs text-ink-subtle">
                            {isZh ? '反向提示词' : 'Negative prompt'}
                          </label>
                          <textarea
                            id="home-image-negative-prompt"
                            rows={2}
                            value={currentDraft.advanced?.negativePrompt || ''}
                            onChange={(e) => updateCurrentDraft((prev) => ({
                              advanced: { ...prev.advanced, negativePrompt: e.target.value },
                            }))}
                            placeholder={isZh ? '模糊、变形、多余肢体、水印…' : 'Blur, distortion, extra limbs, watermark…'}
                            className="w-full resize-none rounded-xl border border-line bg-well p-3 text-sm text-ink focus:border-brand-line focus:outline-none"
                          />
                        </div>
                      </div>
                    </details>
                  </PromptPopover>
                )}
              </div>
            )}

            {activeTab === 'video' && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen((o) => (o === 'spec' ? null : 'spec'));
                  }}
                  className={promptControlClassName({
                    active: dropdownOpen === 'spec',
                    className: 'shrink-0 min-w-fit px-2.5',
                  })}
                >
                  <span className={`${PROMPT_CONTROL_LABEL_CLASS} whitespace-nowrap`}>
                    {currentDraft.ar} · {currentDraft.resolution} · {currentDraft.duration}s
                  </span>
                  <PromptChevronIcon />
                </button>

                {dropdownOpen === 'spec' && (
                  <PromptPopover
                    positionClassName="absolute top-[calc(100%+8px)] left-0 z-popover"
                    onClick={(e) => e.stopPropagation()}
                    className="w-[calc(100vw-2rem)] sm:w-[380px] max-h-[min(540px,calc(100vh-200px))] overflow-y-auto custom-scrollbar p-4 flex flex-col"
                  >
                    <VideoSpecPopover
                      aspectRatios={allowedVideoAspectRatios}
                      selectedAr={currentDraft.ar}
                      onSelectAr={(ar) => updateCurrentDraft({ ar })}
                      resolutions={allowedVideoResolutions}
                      selectedResolution={currentDraft.resolution}
                      onSelectResolution={(r) => updateCurrentDraft({ resolution: typeof r === 'object' ? r.value || r.id : r })}
                      copy={copy}
                    />

                    {/* Video Duration Selector */}
                    <div className="mt-4 pt-3 border-t border-line-subtle">
                      <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>{isZh ? '视频时长' : 'Duration'}</span>
                        <span className="text-[10px] text-ink-subtle">{currentDraft.duration}s</span>
                      </div>
                      <div className="flex items-center gap-1.5 p-1 rounded-full bg-well border border-line-subtle">
                        {allowedVideoDurations.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => updateCurrentDraft({ duration: d })}
                            className={`control-focus h-control-xs flex-1 rounded-full text-center text-label font-medium transition-none cursor-pointer ${
                              currentDraft.duration === d
                                ? 'bg-surface-raised text-ink font-semibold shadow-elevation-1'
                                : 'text-ink-muted hover:bg-wash hover:text-ink'
                            }`}
                          >
                            {d}s
                          </button>
                        ))}
                      </div>
                    </div>
                  </PromptPopover>
                )}
              </div>
            )}

            {activeTab === 'digital-human' && (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className={promptControlClassName({ className: 'shrink-0' })}
                aria-label={isZh ? '选择数字人形象素材' : 'Choose avatar reference'}
              >
                <span className={PROMPT_CONTROL_LABEL_CLASS}>{isZh ? '形象' : 'Avatar'}</span>
              </button>
            )}

            {/* Audio Voice Timbre Selector */}
            {((activeTab === 'audio' && currentDraft.subMode === 'tts') || activeTab === 'digital-human') && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen((o) => (o === 'audio_voice' ? null : 'audio_voice'));
                  }}
                  className={promptControlClassName({
                    active: dropdownOpen === 'audio_voice',
                    className: 'shrink-0',
                  })}
                >
                  <Volume2 className="size-3.5 text-brand" />
                  <span className={PROMPT_CONTROL_LABEL_CLASS}>
                    {activeTab === 'digital-human' && isZh ? '音色：' : ''}
                    {AUDIO_VOICE_PRESETS.find((v) => v.id === currentDraft.voiceId)?.name?.split('·')[0] || (isZh ? '音色选择' : 'Choose voice')}
                  </span>
                  <PromptChevronIcon />
                </button>

                {dropdownOpen === 'audio_voice' && (
                  <PromptPopover
                    positionClassName="absolute top-[calc(100%+8px)] left-0 z-popover"
                    onClick={(e) => e.stopPropagation()}
                    className="w-[calc(100vw-2rem)] sm:w-[320px] max-h-[min(420px,calc(100vh-200px))] overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2"
                  >
                    <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                      {isZh ? '选择解说音色' : 'Select Voice'}
                    </div>
                    {AUDIO_VOICE_PRESETS.map((voice) => {
                      const isSelected = currentDraft.voiceId === voice.id;
                      const isPlaying = auditionPlaying === voice.id;
                      return (
                        <div
                          key={voice.id}
                          onClick={() => {
                            updateCurrentDraft({ voiceId: voice.id });
                            setDropdownOpen(null);
                          }}
                          className={`flex items-center justify-between rounded-md border p-2 transition-none cursor-pointer ${
                            isSelected
                              ? 'border-line bg-wash-press text-ink'
                              : 'border-line-subtle bg-wash text-ink-muted hover:bg-wash-strong hover:text-ink'
                          }`}
                        >
                          <div>
                            <p className="text-label font-semibold">{voice.name}</p>
                            <span className="text-micro text-ink-subtle">{voice.tag}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAudition(voice);
                            }}
                            className="control-focus flex size-control-xs items-center justify-center rounded-full bg-wash-strong text-ink transition-colors duration-fast hover:bg-wash-press cursor-pointer"
                          >
                            {isPlaying ? <Pause className="size-3" /> : <Play className="size-3 ml-0.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </PromptPopover>
                )}
              </div>
            )}

            {activeTab === 'digital-human' && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-expanded={dropdownOpen === 'drive'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen((open) => open === 'drive' ? null : 'drive');
                  }}
                  className={promptControlClassName({ active: dropdownOpen === 'drive', className: 'shrink-0' })}
                >
                  <span className={PROMPT_CONTROL_LABEL_CLASS}>
                    {isZh ? `动作：${currentDraft.driveType === 'audio' ? '音频驱动' : '文本驱动'}` : `Motion: ${currentDraft.driveType === 'audio' ? 'Audio' : 'Text'}`}
                  </span>
                  <PromptChevronIcon />
                </button>
                {dropdownOpen === 'drive' && (
                  <PromptPopover
                    role="menu"
                    aria-label={isZh ? '选择数字人驱动方式' : 'Choose avatar drive mode'}
                    positionClassName="absolute top-[calc(100%+8px)] left-0 z-popover"
                    onClick={(e) => e.stopPropagation()}
                    className="w-[240px] p-2"
                  >
                    {[
                      { id: 'text', label: isZh ? '台词驱动' : 'Text script' },
                      { id: 'audio', label: isZh ? '音频驱动' : 'Audio driven' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={currentDraft.driveType === option.id}
                        onClick={() => {
                          updateCurrentDraft({ driveType: option.id });
                          setDropdownOpen(null);
                        }}
                        className={`control-focus flex min-h-10 w-full items-center justify-between rounded-md px-3 py-2 text-left text-body transition-none ${currentDraft.driveType === option.id ? 'bg-wash-press text-ink' : 'text-ink-muted hover:bg-wash-strong hover:text-ink'}`}
                      >
                        {option.label}
                        {currentDraft.driveType === option.id && <Check className="size-4" aria-hidden="true" />}
                      </button>
                    ))}
                  </PromptPopover>
                )}
              </div>
            )}

            {/* 3. Advanced Parameters Popover (Seed, Negative Prompt, Camera Motion) */}
            {(activeTab === 'video' || activeTab === 'audio') && <div className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen((o) => (o === 'advanced' ? null : 'advanced'));
                }}
                className={promptControlClassName({
                  active: dropdownOpen === 'advanced',
                  className: 'shrink-0 min-w-fit px-2.5',
                })}
                title={isZh ? '高级参数设置' : 'Advanced Parameters'}
              >
                <SlidersHorizontal className="size-3.5 text-white/60" />
                <span className={`${PROMPT_CONTROL_LABEL_CLASS} whitespace-nowrap`}>
                  {isZh ? '参数' : 'Params'}
                </span>
                <PromptChevronIcon />
              </button>

              {dropdownOpen === 'advanced' && (
                <PromptPopover
                  positionClassName="absolute top-[calc(100%+8px)] left-0 z-popover"
                  onClick={(e) => e.stopPropagation()}
                  className="w-[calc(100vw-2rem)] sm:w-[340px] max-h-[min(540px,calc(100vh-200px))] overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3.5"
                >
                  <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                    {isZh ? '高级控制参数' : 'Advanced Settings'}
                  </div>

                  {/* Seed Input */}
                  <div>
                    <label className="text-[11px] text-ink-subtle mb-1 block">Seed (随机种子: -1 为随机)</label>
                    <input
                      type="number"
                      value={currentDraft.advanced?.seed ?? -1}
                      onChange={(e) =>
                        updateCurrentDraft((prev) => ({
                          advanced: { ...prev.advanced, seed: parseInt(e.target.value, 10) || -1 },
                        }))
                      }
                      className="control-focus h-control-sm w-full rounded-lg border border-line bg-well px-2.5 text-label text-ink"
                    />
                  </div>

                  {/* Video Camera Trajectory */}
                  {activeTab === 'video' && (
                    <div>
                      <label className="text-[11px] text-ink-subtle mb-1 block">运镜轨迹预设</label>
                      <select
                        value={currentDraft.advanced?.cameraMotion || 'fixed'}
                        onChange={(e) =>
                          updateCurrentDraft((prev) => ({
                            advanced: { ...prev.advanced, cameraMotion: e.target.value },
                          }))
                        }
                        className="control-focus h-control-sm w-full rounded-lg border border-line bg-well px-2 text-label text-ink"
                      >
                        <option value="fixed">固定镜头 (Fixed Camera)</option>
                        <option value="zoom_in">缓慢推进 (Zoom In)</option>
                        <option value="zoom_out">缓缓拉远 (Zoom Out)</option>
                        <option value="pan_left">向左平移 (Pan Left)</option>
                        <option value="pan_right">向右平移 (Pan Right)</option>
                        <option value="orbit">环绕运镜 (Orbit Motion)</option>
                      </select>
                    </div>
                  )}

                </PromptPopover>
              )}
            </div>}
          </PromptControls>

          {/* Right Side: Estimated Credits Tag + Primary Generate Action */}
          <div className="flex shrink-0 items-center gap-4 self-end sm:self-center">
            {/* Live Model Cost in Credits */}
            <div className="flex items-center gap-1.5 select-none whitespace-nowrap text-ink">
              <Sparkles className="size-3.5 text-brand" aria-hidden="true" />
              <ModelPriceTag
                ids={currentDraft.modelId}
                multiplier={currentDraft.batch || 1}
                locale={locale}
                compact
                className="text-sm font-semibold tabular-nums text-ink"
              />
            </div>

            {/* Screenshot-matched circular submit action */}
            <PromptAction
              data-testid="composer-generate-button"
              onClick={handleTriggerSubmit}
              circular
              aria-label={
                isSubmitting
                  ? (isZh ? '生成中' : 'Generating')
                  : (isZh ? '开始生成' : 'Start generation')
              }
              title={isZh ? '开始生成' : 'Start generation'}
              disabled={
                isSubmitting
                || (activeTab === 'digital-human'
                  ? !currentDraft.avatarUrl
                  : !String(currentDraft.prompt || '').trim())
              }
              className="disabled:bg-raised disabled:border-line disabled:text-ink-subtle disabled:shadow-none"
            >
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUp className="size-4" aria-hidden="true" />
              )}
            </PromptAction>
          </div>
        </PromptFooter>
      </PromptComposer>

      {/* ── 6. Live Active In-Place Task Progress Card (Dreamina High-Fidelity Feedback) ── */}
      {activeTask && (
        <div className="w-full max-w-[960px] mt-4 rounded-2xl bg-[#16181d]/90 border border-white/10 p-4 sm:p-5 backdrop-blur-xl shadow-elevation-3 flex flex-col gap-3 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="rounded-full border border-brand-line bg-brand-soft px-2.5 py-0.5 text-micro font-semibold uppercase tracking-wide text-brand-text">
                {activeTask.mediaType}
              </span>
              <span className="text-xs font-semibold text-white/90 truncate max-w-[280px] sm:max-w-[420px]">
                {activeTask.prompt}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-subtle font-mono">
                {activeTask.elapsed ? `${activeTask.elapsed}s` : ''}
              </span>
              <button
                type="button"
                onClick={() => setActiveTask(null)}
                className="text-white/40 hover:text-white p-1"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Progress / Status feedback */}
          {activeTask.status !== 'succeeded' && activeTask.status !== 'failed' && (
            <div className="flex flex-col gap-2 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted flex items-center gap-2">
                  <span className="animate-spin inline-block text-brand">◌</span>
                  <span>{activeTask.phase}</span>
                </span>
                <span className="text-white font-mono">{activeTask.progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-wash-strong">
                <div
                  className="h-full bg-brand transition-all duration-300"
                  style={{ width: `${activeTask.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Succeeded Result Viewers */}
          {activeTask.status === 'succeeded' && activeTask.resultUrl && (
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
              {/* Media viewer */}
              {activeTask.mediaType === 'video' ? (
                <div className="w-full sm:w-1/2 rounded-xl overflow-hidden bg-black/60 shadow-elevation-2">
                  <video
                    src={activeTask.resultUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full max-h-[300px] object-contain"
                  />
                </div>
              ) : activeTask.mediaType === 'audio' ? (
                <div className="w-full p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
                  <audio src={activeTask.resultUrl} controls className="w-full" autoPlay />
                </div>
              ) : (
                <div className="w-full sm:w-1/2 rounded-xl overflow-hidden bg-black/60 shadow-elevation-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeTask.resultUrl}
                    alt="Result"
                    className="w-full max-h-[300px] object-contain cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setFullscreenUrl(activeTask.resultUrl)}
                  />
                </div>
              )}

              {/* Action Buttons: Open in Canvas, Download, Regenerate */}
              <div className="w-full sm:w-1/2 flex flex-col gap-2.5">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-400" />
                  <span>{isZh ? '作品已就绪' : 'Artwork Ready'}</span>
                </h4>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {isZh
                    ? '已自动同步至您的专属资产库，并已注入无限画布资产索引中。'
                    : 'Synced to your private Asset Library and indexed for Infinite Canvas.'}
                </p>

                <div className="flex items-center gap-2 pt-2 flex-wrap">
                  {/* 1. Open in Infinite Canvas */}
                  <a
                    href={`/canvas?importAsset=${encodeURIComponent(activeTask.resultUrl)}&type=${activeTask.mediaType}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="control-focus flex h-control-sm items-center gap-1.5 rounded-lg bg-brand px-3 text-label font-semibold text-ink-on-accent transition-colors duration-fast hover:bg-brand-hover-solid"
                  >
                    <Layers className="size-3.5" />
                    <span>{isZh ? '在无限画布中打开 ↗' : 'Open in Canvas ↗'}</span>
                  </a>

                  {/* 2. Download File */}
                  <a
                    href={activeTask.resultUrl}
                    download={`koyosim-${activeTask.mediaType}-${Date.now()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="control-focus flex h-control-sm items-center gap-1.5 rounded-lg border border-line bg-wash px-3 text-label font-medium text-ink transition-colors duration-fast hover:border-line-strong hover:bg-wash-strong"
                  >
                    <Download className="size-3.5" />
                    <span>{isZh ? '下载原文件' : 'Download'}</span>
                  </a>

                  {/* 3. Regenerate */}
                  <button
                    type="button"
                    onClick={handleTriggerSubmit}
                    className="control-focus flex h-control-sm items-center gap-1.5 rounded-lg px-3 text-label text-ink-muted transition-colors duration-fast hover:bg-wash hover:text-ink"
                  >
                    <RotateCcw className="size-3.5" />
                    <span>{isZh ? '重新生成' : 'Regenerate'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Failed State */}
          {activeTask.status === 'failed' && (
            <div className="flex items-center justify-between rounded-lg border border-danger-line bg-danger-soft p-3 text-caption text-danger">
              <span>{activeTask.error || (isZh ? '生成任务失败，请检查提示词或网络' : 'Generation failed')}</span>
              <button
                type="button"
                onClick={handleTriggerSubmit}
                className="control-focus rounded-md border border-danger-line bg-danger-soft px-3 py-1 text-label font-medium text-danger transition-colors duration-fast hover:text-ink"
              >
                {isZh ? '重试' : 'Retry'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Draw Canvas Modal ── */}
      <DrawModal
        isOpen={isDrawModalOpen}
        onClose={() => setIsDrawModalOpen(false)}
        apiKey={apiKey}
        batchSize={1}
        onAddHistoryItem={(entry) => {
          if (entry?.url) {
            updateCurrentDraft((prev) => ({
              imageUrls: [...prev.imageUrls, entry.url],
            }));
            toast.success(isZh ? '已添加手绘草图为参考图' : 'Sketch added as reference');
          }
        }}
      />

      {/* ── Fullscreen Image Preview Lightbox ── */}
      {fullscreenUrl && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-scrim backdrop-blur-xl animate-fade-in"
          onClick={() => setFullscreenUrl(null)}
        >
          <button
            type="button"
            className="control-focus absolute right-6 top-6 flex size-control-md items-center justify-center rounded-lg border border-line bg-wash text-ink-muted transition-colors duration-fast hover:border-line-strong hover:bg-wash-strong hover:text-ink cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenUrl(null);
            }}
          >
            <X className="size-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreenUrl}
            alt="Preview"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-elevation-4"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
});

export default HomeStudioPromptComposer;
