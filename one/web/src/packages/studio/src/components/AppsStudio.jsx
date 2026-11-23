"use client";

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  FaUserTie,
  FaImage,
  FaMagic,
  FaVideo,
  FaFilm,
  FaHome,
  FaRocket,
  FaExpand,
  FaCut,
  FaCamera,
  FaLayerGroup,
  FaRunning,
  FaMusic,
  FaProjectDiagram,
  FaRobot,
  FaPalette,
  FaRegSmile,
  FaBox,
  FaUserFriends,
  FaThLarge,
  FaSearch,
  FaArrowRight,
  FaCheckCircle,
  FaWind,
  FaComments,
  FaHandSparkles,
} from 'react-icons/fa';
import en from '../messages/en/appsStudio.json';
import zh from '../messages/zh/appsStudio.json';
import ja from '../messages/ja-JP/appsStudio.json';
import ko from '../messages/ko-KR/appsStudio.json';
import zhTw from '../messages/zh-TW/appsStudio.json';
import es from '../messages/es/appsStudio.json';
import { resolveCopy } from '../i18nUtils';

const APPS_MESSAGES = {
  'zh-CN': zh,
  'ja-JP': ja,
  'ko-KR': ko,
  'zh-TW': zhTw,
  es: es,
  'es-ES': es,
};

const CATEGORIES = [
  { id: 'all', label: '全部工具', labelEn: 'All Tools' },
  { id: 'drama', label: '影视短剧', labelEn: 'Drama & Cinema' },
  { id: 'character', label: '角色设定', labelEn: 'Character & 3-View' },
  { id: 'canvas', label: '画布处理', labelEn: 'Canvas & Upscale' },
  { id: 'motion', label: '动态驱动', labelEn: 'Motion & LipSync' },
  { id: 'workflow', label: '流程智能体', labelEn: 'Audio & Agent' },
];

export const REAL_STUDIO_APPS = [
  // 1. 影视与短剧工坊
  {
    id: 'drama-lab',
    name: '短剧工作坊',
    nameEn: 'Drama Lab Workshop',
    category: 'drama',
    description: '全流程短剧创作工坊，支持新建项目、编写分镜脚本草稿并自动排版生成分镜画面。',
    descriptionEn: 'End-to-end AI drama creation suite: create projects, draft scripts, and render storyboards.',
    icon: FaMagic,
    badge: 'HOT',
    color: 'from-brand/20 to-rose-600/20',
    href: '/zh/lab',
  },
  {
    id: 'cinema-studio',
    name: '电影级视频生成',
    nameEn: 'Cinema Studio',
    category: 'drama',
    description: '影视级运镜控制与电影级镜头感，支持多镜头叙事、景深调度与 4K 超高清渲染。',
    descriptionEn: 'Cinematic visual storytelling with precise camera motion and 4K ultra-HD generation.',
    icon: FaVideo,
    badge: 'PRO',
    color: 'from-indigo-600/20 to-blue-600/20',
    href: '/studio/cinema',
  },
  {
    id: 'storyboard',
    name: '连续分镜故事板',
    nameEn: 'Storyboard Studio',
    category: 'drama',
    description: '横向多格连续动作分镜，自动保持角色服装、面貌与光影场景的跨镜头一致性。',
    descriptionEn: 'Generate sequential visual storyboards with consistent characters, lighting, and wardrobe.',
    icon: FaFilm,
    badge: 'HOT',
    color: 'from-amber-500/20 to-orange-600/20',
    href: '/zh/canvas-tools/three-view/storyboard',
  },
  {
    id: 'nine-grid',
    name: '多机位九宫格镜头组',
    nameEn: 'Multi-Camera Nine-Grid',
    category: 'drama',
    description: '同一主体 3×3 九机位全景、中景、特写与正俯仰视角拍摄，极速锁定成套镜头组。',
    descriptionEn: 'Generate 3x3 camera matrices covering wide, medium, close-up, high and low angles.',
    icon: FaThLarge,
    badge: 'NEW',
    color: 'from-purple-600/20 to-pink-600/20',
    href: '/zh/canvas-tools/three-view/nine-grid',
  },
  {
    id: 'scene-top',
    name: '场景空间俯视图',
    nameEn: 'Scene Top-View',
    category: 'drama',
    description: '正上方俯视角空间透视重建，直观还原建筑内部布局、家具陈设与物体动线。',
    descriptionEn: 'Top-down architectural perspective reconstruction showing spatial relations and layout.',
    icon: FaHome,
    color: 'from-emerald-500/20 to-teal-600/20',
    href: '/zh/canvas-tools/three-view/scene-top-view',
  },

  // 2. 角色与人像设定
  {
    id: 'character-3view',
    name: '角色全角度三视图',
    nameEn: 'Character 3-View',
    category: 'character',
    description: '正面 / 侧面 / 背面全身角色设定图，锁定角色发型、面容细节与服装配饰。',
    descriptionEn: 'Full-body front, side, and rear character concept sheets with locked design consistency.',
    icon: FaUserTie,
    badge: 'HOT',
    color: 'from-rose-500/20 to-purple-600/20',
    href: '/zh/canvas-tools/three-view/character',
  },
  {
    id: 'face-3view',
    name: '面部精细三视图',
    nameEn: 'Face 3-View',
    category: 'character',
    description: '面部正面、侧面及 45° 视角高保真三视图，为 3D 建模与动作捕捉提供精确参考。',
    descriptionEn: 'High-fidelity multi-angle facial reference sheets for 3D modeling and animation.',
    icon: FaRegSmile,
    badge: 'NEW',
    color: 'from-pink-500/20 to-rose-600/20',
    href: '/zh/canvas-tools/three-view/face',
  },
  {
    id: 'product-3view',
    name: '商品电商三视图',
    nameEn: 'Product 3-View',
    category: 'character',
    description: '商品包装与工业设计产品三重视角展现，质感光影与结构细节精准呈现。',
    descriptionEn: 'E-commerce and industrial design multi-angle showcase preserving textures and dimensions.',
    icon: FaBox,
    color: 'from-amber-600/20 to-yellow-600/20',
    href: '/zh/canvas-tools/three-view/product',
  },
  {
    id: 'body-swap',
    name: 'AI 数字替身与换脸',
    nameEn: 'Digital Recast & Body Swap',
    category: 'character',
    description: '影视级高保真面部特征置换，保留原有光影、皮肤肌理、微表情与视线方向。',
    descriptionEn: 'Cinematic face and actor recast preserving natural lighting, skin pores, and expressions.',
    icon: FaUserFriends,
    badge: 'SOTA',
    color: 'from-cyan-500/20 to-blue-600/20',
    href: '/studio/body-swap',
  },
  {
    id: 'headshot-studio',
    name: 'AI 商务写真摄影棚',
    nameEn: 'AI Headshot Studio',
    category: 'character',
    description: '专业影棚级商务写真照与领英职业头像生成，支持光影风格与西装礼服切换。',
    descriptionEn: 'Studio-grade corporate headshots and executive portraits in diverse attire and lighting.',
    icon: FaUserTie,
    color: 'from-blue-600/20 to-indigo-600/20',
    href: '/studio/headshot',
  },

  // 3. 画布处理与画质增强
  {
    id: 'outpaint',
    name: 'AI 智能无缝扩图',
    nameEn: 'AI Canvas Outpaint',
    category: 'canvas',
    description: '向画面四周自由延展画幅并智能补全场景，边缘自然过渡，主体透视完全一致。',
    descriptionEn: 'Expand image boundaries with intelligent background synthesis and consistent perspective.',
    icon: FaExpand,
    badge: 'HOT',
    color: 'from-teal-500/20 to-emerald-600/20',
    href: '/zh/canvas-tools/outpaint',
  },
  {
    id: 'upscale',
    name: '2K / 4K 智能超清重构',
    nameEn: '2K/4K AI Upscale',
    category: 'canvas',
    description: 'AI 细节再造与超分辨率放大，消除压缩噪点与模糊，重现发丝与微小纹理。',
    descriptionEn: 'Super-resolution neural upscaling eliminating artifacts and restoring photorealistic textures.',
    icon: FaHandSparkles,
    badge: '4K SOTA',
    color: 'from-emerald-600/20 to-teal-700/20',
    href: '/zh/canvas-tools/upscale',
  },
  {
    id: 'cutout',
    name: '智能高精主体抠图',
    nameEn: 'Precision AI Matting',
    category: 'canvas',
    description: '毛发级半透明边缘羽化抠图，自动分离复杂背景并导出透明 PNG 或白底素材。',
    descriptionEn: 'Hair-level matting and transparent cutout with alpha matte refinement for composite workflows.',
    icon: FaCut,
    color: 'from-rose-600/20 to-pink-700/20',
    href: '/zh/canvas-tools/cutout',
  },
  {
    id: 'multi-angle',
    name: '多角度空间运镜',
    nameEn: 'Multi-Angle Camera View',
    category: 'canvas',
    description: '自由调节相机机位的水平角度、俯仰高度与变焦景别，无缝重绘全新视角画面。',
    descriptionEn: 'Adjust camera azimuth, elevation, and distance to redraw the scene from any vantage point.',
    icon: FaCamera,
    color: 'from-blue-500/20 to-cyan-600/20',
    href: '/zh/canvas-tools/multi-angle',
  },
  {
    id: 'layers-studio',
    name: '多图层自由创作画布',
    nameEn: 'Layers Studio Canvas',
    category: 'canvas',
    description: '支持分层编辑、选区重绘、笔刷蒙版与节点式图层混合的高自由度创作台。',
    descriptionEn: 'Photoshop-like infinite layer canvas with inpainting, masks, and blending nodes.',
    icon: FaLayerGroup,
    badge: 'PRO',
    color: 'from-purple-600/20 to-indigo-600/20',
    href: '/studio/layers',
  },

  // 4. 动作驱动与特效
  {
    id: 'motion-control',
    name: '骨骼姿态精确控制',
    nameEn: 'Motion Control Studio',
    category: 'motion',
    description: '输入参考姿态骨架控制角色起伏动作，精准驱动舞蹈、打斗与特技肢体运动。',
    descriptionEn: 'Control character motion using pose skeletons for complex fight, dance, and action scenes.',
    icon: FaRunning,
    badge: 'SOTA',
    color: 'from-orange-500/20 to-red-600/20',
    href: '/studio/motion-control',
  },
  {
    id: 'vibe-motion',
    name: 'AI 动态神韵驱动',
    nameEn: 'Vibe Motion Transfer',
    category: 'motion',
    description: '基于真实视频素材提取节奏、呼吸感与镜头晃动韵律，迁移至全新静态图像。',
    descriptionEn: 'Extract organic camera motion and micro-movements to breathe life into still images.',
    icon: FaWind,
    color: 'from-cyan-600/20 to-teal-600/20',
    href: '/studio/vibe-motion',
  },
  {
    id: 'lipsync-studio',
    name: 'AI 音视频对口型同步',
    nameEn: 'LipSync Studio',
    category: 'motion',
    description: '语音音频驱动角色嘴唇运动，多语言发音自动匹配，微表情与眨眼自然流畅。',
    descriptionEn: 'Audio-driven lip synchronization with natural facial micro-expressions in any language.',
    icon: FaComments,
    badge: 'HOT',
    color: 'from-pink-500/20 to-purple-600/20',
    href: '/studio/lipsync',
  },
  {
    id: 'clipping-studio',
    name: '长视频智能高光切片',
    nameEn: 'AI Clipping Studio',
    category: 'motion',
    description: '基于视觉关键帧与语音语义自动识别长视频精彩瞬间，快速切出竖屏短视频。',
    descriptionEn: 'Automated video highlight detection extracting engaging vertical clips from long footage.',
    icon: FaFilm,
    color: 'from-indigo-500/20 to-blue-600/20',
    href: '/studio/clipping',
  },

  // 5. 音频与流程智能体
  {
    id: 'audio-studio',
    name: 'AI 电影级配乐与音效',
    nameEn: 'Audio & Music Studio',
    category: 'workflow',
    description: '输入情绪提示词或分镜气氛描述，生成电影原声交响、电子配乐与拟真环境音效。',
    descriptionEn: 'Generate cinematic film scores, background ambient soundscapes, and foley audio.',
    icon: FaMusic,
    color: 'from-amber-500/20 to-rose-600/20',
    href: '/studio/audio',
  },
  {
    id: 'workflow-studio',
    name: '可视化工作流编排',
    nameEn: 'Workflow Studio',
    category: 'workflow',
    description: '拖拽式流程画布，串联生图、生视频、扩图、超清等多个模型与后处理算子。',
    descriptionEn: 'Visual node graph to chain multiple AI models and operators into automated pipelines.',
    icon: FaProjectDiagram,
    badge: 'NODE',
    color: 'from-blue-600/20 to-purple-600/20',
    href: '/studio/workflows',
  },
  {
    id: 'agent-studio',
    name: 'AI 交互剧作智能体',
    nameEn: 'Agent Studio',
    category: 'workflow',
    description: '垂直领域的影视编剧、概念美术与分镜推演 Agent，与您多轮协同共创。',
    descriptionEn: 'Collaborative AI screenwriting, concept art, and scene continuity agents.',
    icon: FaRobot,
    badge: 'AI AGENT',
    color: 'from-purple-600/20 to-brand/20',
    href: '/studio/agents',
  },
  {
    id: 'design-agent',
    name: 'UI/海报视觉设计智能体',
    nameEn: 'Design Agent Studio',
    category: 'workflow',
    description: '自然语言指令驱动布局排版，智能微调字体、色彩配搭与影视海报设计。',
    descriptionEn: 'Prompt-driven visual design assistant for poster layouts, typography, and color grading.',
    icon: FaPalette,
    color: 'from-rose-500/20 to-orange-600/20',
    href: '/studio/design-agent',
  },
];

export default function AppsStudio({ locale = 'en' }) {
  const isChinese = Boolean(locale?.includes('zh'));
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredApps = useMemo(() => {
    return REAL_STUDIO_APPS.filter((app) => {
      const matchCategory = selectedCategory === 'all' || app.category === selectedCategory;
      if (!matchCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        app.name.toLowerCase().includes(q) ||
        app.nameEn.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.descriptionEn.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchQuery]);

  const handleLaunch = (href) => {
    navigate(href);
  };

  return (
    <div className="h-full w-full flex flex-col items-center bg-transparent overflow-y-auto custom-scrollbar relative">
      <div className="flex flex-col gap-8 items-center w-full max-w-7xl pt-10 pb-24 px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#e11d74]/10 border border-[#e11d74]/20 rounded-full">
            <FaMagic className="text-[#e11d74] text-xs" />
            <span className="text-[10px] font-black text-[#e11d74] uppercase tracking-widest">
              {isChinese ? '影视与短剧创意生产力中心' : 'CREATIVE STUDIO APPS & TOOLS'}
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            {isChinese ? (
              <>
                专业 AI 影视创意与制作工具库
              </>
            ) : (
              <>
                Production AI Cinema & Drama Tools
              </>
            )}
          </h1>

          <p className="text-white/60 text-xs sm:text-sm font-medium leading-relaxed max-w-2xl mx-auto">
            {isChinese
              ? '从剧作故事板、分镜机位、角色三视图，到扩图超清、数字替身与动态驱动。22 项真实专业工具开箱即用，全面赋能影视短剧创作者。'
              : 'From script storyboarding and multi-camera views to 4K upscale, face recast, and motion control. 22 production-grade AI tools ready to launch.'}
          </p>

          {/* Search Bar */}
          <div className="relative max-w-md mx-auto pt-2">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-xs" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isChinese ? '搜索工具名称或创作功能...' : 'Search studio tools & capabilities...'}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs focus:outline-none focus:border-brand transition"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-brand text-white shadow-elevation-1'
                      : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                  }`}
                >
                  {isChinese ? cat.label : cat.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tools Count Bar */}
        <div className="w-full flex items-center justify-between border-b border-white/10 pb-3 text-xs text-white/40 font-mono">
          <span>
            {isChinese
              ? `共检索到 ${filteredApps.length} 款可用创作工具`
              : `Found ${filteredApps.length} active creative tools`}
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <FaCheckCircle className="text-xs" />
            {isChinese ? '100% 真实功能已上线' : '100% Production Ready'}
          </span>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full">
          {filteredApps.map((app) => {
            const Icon = app.icon;
            return (
              <div
                key={app.id}
                onClick={() => handleLaunch(app.href)}
                className="group relative bg-[#101216] border border-white/10 rounded-2xl flex flex-col overflow-hidden transition-[border-color,background-color,box-shadow,transform] duration-200 hover:border-brand/40 hover:bg-[#14161b] hover:shadow-elevation-3 hover:-translate-y-1 cursor-pointer"
              >
                {/* Visual Header */}
                <div className={`relative h-28 w-full overflow-hidden bg-gradient-to-br ${app.color} p-4 flex items-center justify-between border-b border-white/5`}>
                  <div className="w-12 h-12 rounded-xl bg-black/40 backdrop-blur-md flex items-center justify-center text-xl text-brand border border-white/10 group-hover:scale-110 transition-transform duration-300">
                    <Icon />
                  </div>

                  {app.badge && (
                    <span className="rounded-full border border-brand/40 bg-brand/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand backdrop-blur-md shadow-sm">
                      {app.badge}
                    </span>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-brand transition-colors">
                      {isChinese ? app.name : app.nameEn}
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed line-clamp-2">
                      {isChinese ? app.description : app.descriptionEn}
                    </p>
                  </div>

                  {/* Action Row */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      {isChinese ? '现已就绪' : 'Ready'}
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-bold text-white group-hover:text-brand group-hover:translate-x-0.5 transition-all">
                      {isChinese ? '打开工具' : 'Launch'}
                      <FaArrowRight className="text-[10px]" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
