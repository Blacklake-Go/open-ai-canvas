"use client";

import { useState, useRef, useEffect } from "react";
import { resolveCopy } from "../i18nUtils";

const RELAY_COPY_EN = {
  triggerTitle: "Send to other creative studios",
  headerTitle: "Send to Studio",
  targets: {
    lipsync: {
      name: "Lip Sync",
      desc: "Sync mouth movements with audio",
    },
    "motion-control": {
      name: "Motion Control",
      desc: "Transfer motion to new character",
    },
    clipping: {
      name: "AI Clipping",
      desc: "Extract highlights & smart clips",
    },
    "body-swap": {
      name: "Body Swap",
      desc: "Replace character body & outfit",
    },
    "vibe-motion": {
      name: "Vibe Motion",
      desc: "Refine camera paths & motion graphics",
    },
    marketing: {
      name: "Marketing Studio",
      desc: "Create commercial & UGC video ads",
    },
    video: {
      name: "Video Studio",
      desc: "Continue or edit in main workbench",
    },
    cinema: {
      name: "Cinema Studio",
      desc: "Apply cinematic lens & camera rig",
    },
  },
};

const RELAY_COPY_LOCALES = {
  "zh-CN": {
    triggerTitle: "流转至其他工作台继续创作",
    headerTitle: "一键流转到工作台",
    targets: {
      lipsync: {
        name: "唇形同步",
        desc: "为视频人物同步音频嘴型",
      },
      "motion-control": {
        name: "动作控制",
        desc: "将动作轨迹迁移至新角色",
      },
      clipping: {
        name: "AI 剪辑",
        desc: "智能切片与高光片段提取",
      },
      "body-swap": {
        name: "换体工作室",
        desc: "无缝替换视频角色与服装",
      },
      "vibe-motion": {
        name: "动感运镜",
        desc: "基于视频进行镜头微调与转场",
      },
      marketing: {
        name: "营销工作室",
        desc: "生成电商带货与商业广告大片",
      },
      video: {
        name: "视频工作室",
        desc: "送回主工作台进行续写或重绘",
      },
      cinema: {
        name: "电影影视工作室",
        desc: "套用专业电影机位与镜头语言",
      },
    },
  },
  "ja-JP": {
    triggerTitle: "他のスタジオに送って制作を続ける",
    headerTitle: "スタジオへ連携",
    targets: {
      lipsync: {
        name: "リップシンク",
        desc: "音声に合わせて口元の動きを同期",
      },
      "motion-control": {
        name: "モーション制御",
        desc: "動きの軌跡を別キャラへ転写",
      },
      clipping: {
        name: "AI 切り抜き",
        desc: "ハイライト抽出とスマート編集",
      },
      "body-swap": {
        name: "ボディスワップ",
        desc: "キャラクターの体型や衣装を置換",
      },
      "vibe-motion": {
        name: "バイブモーション",
        desc: "カメラワークとモーショングラフィックス",
      },
      marketing: {
        name: "マーケティング",
        desc: "EC・商用プロモーション動画を生成",
      },
      video: {
        name: "ビデオスタジオ",
        desc: "メインスタジオで動画編集・延長",
      },
      cinema: {
        name: "シネマスタジオ",
        desc: "映画級のカメラ・レンズ設定を適用",
      },
    },
  },
  "ko-KR": {
    triggerTitle: "다른 스튜디오로 보내 작업 이어가기",
    headerTitle: "스튜디오로 전달",
    targets: {
      lipsync: {
        name: "립싱크",
        desc: "오디오에 맞춰 입모양 동기화",
      },
      "motion-control": {
        name: "모션 컨트롤",
        desc: "동작 궤적을 새로운 캐릭터에 적용",
      },
      clipping: {
        name: "AI 클리핑",
        desc: "하이라이트 자동 추출 및 컷 편집",
      },
      "body-swap": {
        name: "바디 스왑",
        desc: "캐릭터 체형 및 의상 교체",
      },
      "vibe-motion": {
        name: "바이브 모션",
        desc: "카메라 무빙 및 모션 그래픽 연출",
      },
      marketing: {
        name: "마케팅 스튜디오",
        desc: "커머스 및 광고 홍보 영상 제작",
      },
      video: {
        name: "비디오 스튜디오",
        desc: "메인 스튜디오에서 영상 편집 및 연장",
      },
      cinema: {
        name: "시네마 스튜디오",
        desc: "시네마틱 카메라 및 렌즈 효과 적용",
      },
    },
  },
  "zh-TW": {
    triggerTitle: "流轉至其他工作台繼續創作",
    headerTitle: "一鍵流轉到工作台",
    targets: {
      lipsync: {
        name: "唇形同步",
        desc: "為影片人物同步音訊嘴型",
      },
      "motion-control": {
        name: "動作控制",
        desc: "將動作軌跡遷移至新角色",
      },
      clipping: {
        name: "AI 剪輯",
        desc: "智慧切片與高光片段提取",
      },
      "body-swap": {
        name: "換體工作室",
        desc: "無縫替換影片角色與服裝",
      },
      "vibe-motion": {
        name: "動感運鏡",
        desc: "基於影片進行鏡頭微調與轉場",
      },
      marketing: {
        name: "行銷工作室",
        desc: "生成電商帶貨與商業廣告大片",
      },
      video: {
        name: "影片工作室",
        desc: "送回主工作台進行續寫或重繪",
      },
      cinema: {
        name: "電影影視工作室",
        desc: "套用專業電影機位與鏡頭語言",
      },
    },
  },
  "es": {
    triggerTitle: "Enviar a otros estudios creativos",
    headerTitle: "Enviar al Estudio",
    targets: {
      lipsync: {
        name: "Sincronización Labial",
        desc: "Sincroniza los labios con el audio",
      },
      "motion-control": {
        name: "Control de Movimiento",
        desc: "Transfiere movimiento a otro personaje",
      },
      clipping: {
        name: "Recorte IA",
        desc: "Extrae momentos destacados y clips",
      },
      "body-swap": {
        name: "Cambio Corporal",
        desc: "Reemplaza cuerpo y vestuario",
      },
      "vibe-motion": {
        name: "Movimiento Vibe",
        desc: "Ajusta cámara y gráficos animados",
      },
      marketing: {
        name: "Estudio de Marketing",
        desc: "Crea anuncios comerciales y UGC",
      },
      video: {
        name: "Estudio de Video",
        desc: "Continúa o edita en el estudio principal",
      },
      cinema: {
        name: "Estudio de Cine",
        desc: "Aplica lentes y cámaras cinematográficas",
      },
    },
  },
};

const RELAY_TARGET_ICONS = [
  {
    id: "lipsync",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
      </svg>
    ),
  },
  {
    id: "motion-control",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3"/>
        <line x1="12" y1="8" x2="12" y2="14"/>
        <path d="M9 11l3 3 3-3"/>
        <path d="M7 21l5-5 5 5"/>
      </svg>
    ),
  },
  {
    id: "clipping",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3"/>
        <circle cx="6" cy="18" r="3"/>
        <line x1="20" y1="4" x2="8.12" y2="15.88"/>
        <line x1="14.47" y1="14.47" x2="20" y2="20"/>
        <line x1="8.12" y1="8.12" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    id: "body-swap",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="8.5" cy="7" r="4"/>
        <polyline points="17 11 19 13 23 9"/>
        <path d="M23 13v-2"/>
      </svg>
    ),
  },
  {
    id: "vibe-motion",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
  },
  {
    id: "marketing",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    id: "video",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
  },
  {
    id: "cinema",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
];

export default function VideoRelayMenu({
  videoUrl,
  currentTab = "video",
  locale = "en",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const copy = resolveCopy(RELAY_COPY_EN, RELAY_COPY_LOCALES, locale);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const handleSelect = (targetTabId) => {
    setIsOpen(false);
    if (!videoUrl) return;

    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      search.set("tab", targetTabId);
      search.set("video_url", videoUrl);

      const newUrl = `${window.location.pathname}?${search.toString()}`;
      window.history.pushState(null, "", newUrl);

      window.dispatchEvent(
        new CustomEvent("supdance-relay-video", {
          detail: {
            targetTab: targetTabId,
            videoUrl,
            sourceStudio: currentTab,
            timestamp: Date.now(),
          },
        })
      );
    }
  };

  const availableTargets = RELAY_TARGET_ICONS.filter((t) => t.id !== currentTab);

  return (
    <div ref={containerRef} className={`relative inline-block pointer-events-auto ${className}`}>
      <button
        type="button"
        title={copy.triggerTitle}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="p-2 bg-overlay backdrop-blur-md rounded-full text-ink hover:text-ink-on-accent hover:bg-brand active:scale-95 active:duration-instant transition-[background-color,color,transform] duration-fast ease-standard border border-line shadow-elevation-2 flex items-center justify-center group cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform group-hover:rotate-45"
        >
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute right-0 top-full mt-2 w-60 rounded-xl border border-line bg-overlay p-1.5 shadow-elevation-4 z-popover animate-fade-in text-ink"
        >
          <div className="px-2.5 py-1.5 text-micro font-semibold uppercase tracking-wider text-ink-subtle border-b border-line-subtle mb-1">
            {copy.headerTitle}
          </div>

          <div className="space-y-0.5 max-h-64 overflow-y-auto custom-scrollbar">
            {availableTargets.map((target) => {
              const itemCopy = copy.targets?.[target.id] || RELAY_COPY_EN.targets[target.id];
              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => handleSelect(target.id)}
                  className="w-full flex items-start gap-2.5 rounded-lg p-2 text-left transition-colors duration-fast hover:bg-wash-strong group"
                >
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-line bg-wash text-ink-muted group-hover:border-brand-line group-hover:text-brand transition-colors">
                    {target.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-body-sm font-medium text-ink group-hover:text-brand transition-colors">
                      {itemCopy.name}
                    </div>
                    <div className="text-micro text-ink-subtle truncate">
                      {itemCopy.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
