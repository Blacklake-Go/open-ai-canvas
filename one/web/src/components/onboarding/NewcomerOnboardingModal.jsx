'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Clapperboard,
  Camera,
  PenTool,
  Palette,
  BookOpen,
  Megaphone,
  Code,
  GraduationCap,
  MoreHorizontal,
  Video,
  Monitor,
  Lightbulb,
  Coins,
  Loader2,
  Film,
} from 'lucide-react';
import { OCCUPATIONS, PURPOSES } from '@/lib/onboarding/schema';
import { optionLabel, optionDesc } from '@/lib/onboarding/copy';
import { normalizeLocale } from '@/lib/locales';
import { cn } from '@/lib/utils';

// Lucide 图标映射表
const ICON_COMPONENTS = {
  Clapperboard,
  Camera,
  PenTool,
  Palette,
  BookOpen,
  Megaphone,
  Code,
  GraduationCap,
  MoreHorizontal,
  Video,
  Monitor,
  Lightbulb,
  Film,
};

function OptionIcon({ name, className }) {
  const Icon = ICON_COMPONENTS[name] || Palette;
  return <Icon className={className} aria-hidden="true" />;
}

// 数字递增滚动动效 Hook (Count-Up)
function useCountUp(target, duration = 800) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!target || target <= 0) {
      setCount(0);
      return;
    }
    let startTimestamp = null;
    let frameId;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(easeOut * target));
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration]);

  return count;
}

export default function NewcomerOnboardingModal({
  user,
  locale = 'en',
  studioHref = '/studio',
  isPageMode = false,
  initialStep = 1,
  onComplete,
  onClose,
}) {
  const normLocale = normalizeLocale(locale);

  // 当前步骤：1 = 职业领域，2 = 创作场景
  const [step, setStep] = useState(initialStep);
  const [selectedOccupation, setSelectedOccupation] = useState(step === 2 ? 'media_culture' : '');
  const [selectedPurpose, setSelectedPurpose] = useState('');
  const [otherText, setOtherText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rewardSuccess, setRewardSuccess] = useState(null); // { rewardCredits: 50, user: ... }

  // 过滤展示两步调研的核心选项（前 9 项职业与前 8 项场景）
  const occupationList = OCCUPATIONS.slice(0, 9);
  const purposeList = PURPOSES.slice(0, 8);

  const targetReward = rewardSuccess?.rewardCredits ?? 50;
  const animatedCredits = useCountUp(rewardSuccess ? targetReward : 0, 800);
  const animatedTotal = 40 + animatedCredits;

  const ONBOARDING_MODAL_STRINGS = {
    en: {
      appName: 'SupDance',
      welcome: 'Welcome to SupDance',
      step1Title: 'What kind of work do you do?',
      step1Subtitle: 'Help us understand your background to provide tools and content tailored for you.',
      step2Title: 'What will you create with SupDance?',
      step2Subtitle: 'Choose your primary creative scenario so we can best meet your creative needs.',
      footerHint: 'Choose the option that best fits your needs',
      next: 'Next',
      back: 'Back',
      finish: 'Finish & Start Creating',
      skip: 'Skip for now',
      otherPlaceholder: 'Describe your field or focus in a few words (optional)',
      rewardTitle: 'Creator Credits Activated',
      rewardSubtitle: 'Your creative workspace is ready, 50 credits have been added to your account',
      rewardBase: 'Sign-up 40',
      rewardBonus: 'Onboarding',
      rewardTotal: 'Total',
      rewardBenefit1: 'Generate 1 high-res AI video for free',
      rewardBenefit2: 'Or 9 Flux master-quality images',
      startCreation: 'Start Creating Now',
    },
    'zh-CN': {
      appName: 'SupDance',
      welcome: '欢迎来到 SupDance',
      step1Title: '你主要从事什么领域的工作？',
      step1Subtitle: '帮助我们了解你的专业背景，以便提供更适合你的工具与内容。',
      step2Title: '你打算用 SupDance 创作什么？',
      step2Subtitle: '选择你的主要创作场景，以便我们更好地满足你的创作需求。',
      footerHint: '选择最符合你当前需求的一项',
      next: '下一步',
      back: '上一步',
      finish: '完成并开始创作',
      skip: '跳过并直接体验',
      otherPlaceholder: '请用简短文字描述你的领域或方向（选填）',
      rewardTitle: '新手创作算力已激活',
      rewardSubtitle: '专属创作者空间已就绪，50 算力已注入您的账户',
      rewardBase: '基础注册 40',
      rewardBonus: '入驻礼遇',
      rewardTotal: '总额度',
      rewardBenefit1: '可免费生成 1 条高清视频',
      rewardBenefit2: '或 9 张 Flux 高清原画',
      startCreation: '即刻开启 AI 创作',
    },
    'zh-TW': {
      appName: 'SupDance',
      welcome: '歡迎來到 SupDance',
      step1Title: '你主要從事什麼領域的工作？',
      step1Subtitle: '幫助我們了解你的專業背景，以便提供更適合你的工具與內容。',
      step2Title: '你打算用 SupDance 創作什麼？',
      step2Subtitle: '選擇你的主要創作場景，以便我們更好地滿足你的創作需求。',
      footerHint: '選擇最符合你目前需求的一項',
      next: '下一步',
      back: '上一步',
      finish: '完成並開始創作',
      skip: '略過並直接體驗',
      otherPlaceholder: '請用簡短文字描述你的領域或方向（選填）',
      rewardTitle: '新手創作算力已啟動',
      rewardSubtitle: '專屬創作者空間已就緒，50 算力已注入您的帳戶',
      rewardBase: '基礎註冊 40',
      rewardBonus: '入駐禮遇',
      rewardTotal: '總額度',
      rewardBenefit1: '可免費生成 1 條高清影片',
      rewardBenefit2: '或 9 張 Flux 高清原畫',
      startCreation: '即刻開啟 AI 創作',
    },
    'ja-JP': {
      appName: 'SupDance',
      welcome: 'SupDance へようこそ',
      step1Title: '主にどのような分野でお仕事をされていますか？',
      step1Subtitle: '最適なツールやコンテンツをご案内するため、ご専門をお聞かせください。',
      step2Title: 'SupDance で何を創作したいですか？',
      step2Subtitle: '主な創作目的をお選びいただくことで、最適な機能をご提案します。',
      footerHint: '最も当てはまるものを1つ選択してください',
      next: '次へ',
      back: '戻る',
      finish: '完了して創作を開始',
      skip: 'スキップして体験',
      otherPlaceholder: '専門分野や創作内容を簡単にご記入ください（任意）',
      rewardTitle: 'スターター創作クレジットが付与されました',
      rewardSubtitle: '専用ワークスペースの準備が整いました。50 クレジットが追加されました',
      rewardBase: '新規登録 40',
      rewardBonus: 'オンボーディング特典',
      rewardTotal: '合計',
      rewardBenefit1: '高画質 AI 動画 1 本を無料生成可能',
      rewardBenefit2: 'または Flux 高精細画像 9 枚',
      startCreation: '今すぐ AI 創作を開始',
    },
    'ko-KR': {
      appName: 'SupDance',
      welcome: 'SupDance에 오신 것을 환영합니다',
      step1Title: '주로 어떤 분야에서 일하시나요?',
      step1Subtitle: '전문 분야를 파악하여 더 적합한 도구와 콘텐츠를 제공해 드릴 수 있습니다.',
      step2Title: 'SupDance로 무엇을 만들고 싶으신가요?',
      step2Subtitle: '창작 요구에 맞춤형 지원을 위해 주요 창작 목적을 선택해 주세요.',
      footerHint: '가장 적합한 항목 하나를 선택하세요',
      next: '다음',
      back: '이전',
      finish: '완료하고 창작 시작',
      skip: '건너뛰고 바로 체험',
      otherPlaceholder: '귀하의 분야나 방향을 간단히 설명해 주세요 (선택 사항)',
      rewardTitle: '신규 크리에이터 크레딧이 활성화되었습니다',
      rewardSubtitle: '크리에이터 작업 공간이 준비되었습니다. 50 크레딧이 지급되었습니다',
      rewardBase: '기본 가입 40',
      rewardBonus: '온보딩 보너스',
      rewardTotal: '총합',
      rewardBenefit1: '고화질 AI 비디오 1개 무료 생성 가능',
      rewardBenefit2: '또는 Flux 고화질 이미지 9장',
      startCreation: '지금 AI 창작 시작하기',
    },
    es: {
      appName: 'SupDance',
      welcome: 'Bienvenido a SupDance',
      step1Title: '¿En qué área trabajas principalmente?',
      step1Subtitle: 'Ayúdanos a conocer tu perfil profesional para ofrecerte mejores herramientas y contenidos.',
      step2Title: '¿Qué te gustaría crear con SupDance?',
      step2Subtitle: 'Selecciona tus objetivos principales para que podamos adaptarnos a tus necesidades.',
      footerHint: 'Selecciona la opción que mejor se adapte',
      next: 'Siguiente',
      back: 'Atrás',
      finish: 'Finalizar y empezar a crear',
      skip: 'Omitir y explorar',
      otherPlaceholder: 'Describe brevemente tu área o enfoque (opcional)',
      rewardTitle: 'Créditos de creación activados',
      rewardSubtitle: 'Tu espacio creativo está listo, se han añadido 50 créditos a tu cuenta',
      rewardBase: 'Registro 40',
      rewardBonus: 'Bienvenida',
      rewardTotal: 'Total',
      rewardBenefit1: 'Genera 1 video de alta definición gratis',
      rewardBenefit2: 'O 9 imágenes de alta calidad con Flux',
      startCreation: 'Comenzar a crear ahora',
    },
  };

  const copy = ONBOARDING_MODAL_STRINGS[normLocale] || ONBOARDING_MODAL_STRINGS.en;

  const handleSkip = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skip: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || '操作失败');

      const updatedUser = {
        ...user,
        onboardingCompleted: true,
      };

      if (isPageMode && typeof window !== 'undefined') {
        window.location.href = studioHref;
      } else {
        onComplete?.(updatedUser);
        onClose?.();
      }
    } catch (err) {
      setError(err?.message || '网络异常，请重试');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (busy || !selectedOccupation || !selectedPurpose) return;
    setBusy(true);
    setError('');

    try {
      const payload = {
        occupation: selectedOccupation,
        purpose: selectedPurpose,
        purposeCodes: [selectedPurpose],
        customText: otherText.trim() || undefined,
        commitment: 'browsing',
        usageIntent: 'personal',
      };

      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || '保存偏好设置失败，请重试');

      const rewardCredits = Number(data?.data?.rewardCredits ?? 50);
      const updatedUser = {
        ...user,
        occupation: data?.data?.occupation || selectedOccupation,
        onboardingCompleted: true,
        onboardingStep: 2,
      };

      if (rewardCredits > 0) {
        setRewardSuccess({ rewardCredits, user: updatedUser });
      } else {
        if (isPageMode && typeof window !== 'undefined') {
          window.location.href = studioHref;
        } else {
          onComplete?.(updatedUser);
        }
      }
    } catch (err) {
      setError(err?.message || '提交失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const finishJourney = () => {
    if (isPageMode && typeof window !== 'undefined') {
      window.location.href = studioHref;
    } else {
      onComplete?.(rewardSuccess?.user || user);
      onClose?.();
    }
  };

  // 视图二：礼遇奖励到账成功视图 (Glass-Stage 算力展台卡)
  if (rewardSuccess) {
    const content = (
      <div className="relative w-full max-w-[460px] rounded-2xl border border-line bg-overlay backdrop-blur-2xl p-6 sm:p-8 shadow-elevation-4 text-center text-ink select-none overflow-hidden animate-scale-in">
        {/* 顶部微透环境漫反射高光 */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full pointer-events-none opacity-40 blur-3xl animate-glow-pulse"
          style={{ background: 'radial-gradient(circle, rgba(225,29,116,0.45) 0%, transparent 70%)' }}
        />

        {/* 精密徽章底座 */}
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft border border-brand-line text-brand shadow-elevation-2">
          <Coins className="size-7" />
        </div>

        {/* 标题区 */}
        <h2 id="onboarding-reward-title" className="mt-4 text-section-title font-bold text-ink tracking-tight">
          {copy.rewardTitle}
        </h2>
        <p className="mt-1.5 text-caption text-ink-muted">
          {copy.rewardSubtitle}
        </p>

        {/* 核心算力展台卡 (Glass-Stage) */}
        <div className="my-5 rounded-xl border border-brand-line/60 bg-gradient-to-b from-brand/10 to-transparent p-5 backdrop-blur-md shadow-elevation-2 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent" />
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="font-mono text-4xl font-extrabold text-brand tracking-tight">
              +{animatedCredits}
            </span>
            <span className="text-caption font-semibold text-brand/90">
              Credits
            </span>
          </div>
          <div className="mt-3.5 pt-3 border-t border-line-subtle text-caption text-ink-muted flex items-center justify-center gap-1.5">
            <span>{copy.rewardBase}</span>
            <span>+</span>
            <span>{copy.rewardBonus} {animatedCredits}</span>
            <span>=</span>
            <span className="text-ink font-mono font-bold">{copy.rewardTotal} {animatedTotal}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-line-subtle bg-wash px-2.5 py-1 text-micro text-ink-muted">
              <Film className="size-3 text-brand" />
              <span>{copy.rewardBenefit1}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-line-subtle bg-wash px-2.5 py-1 text-micro text-ink-muted">
              <Palette className="size-3 text-brand" />
              <span>{copy.rewardBenefit2}</span>
            </span>
          </div>
        </div>

        {/* 主操作按钮 */}
        <button
          type="button"
          onClick={finishJourney}
          className="h-11 w-full rounded-full bg-brand text-body font-semibold text-ink-on-accent transition-[background-color,color,transform] duration-fast ease-standard hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] active:duration-instant focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring shadow-elevation-1 cursor-pointer flex items-center justify-center gap-2 group"
        >
          <span>{copy.startCreation}</span>
          <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    );

    if (isPageMode) {
      return (
        <main className="min-h-screen bg-canvas text-ink flex items-center justify-center p-4">
          {content}
        </main>
      );
    }

    return (
      <div
        className="fixed inset-0 z-modal flex items-center justify-center bg-scrim backdrop-blur-xl p-4 transition-opacity duration-base ease-enter animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-reward-title"
      >
        {content}
      </div>
    );
  }

  // 视图一：两步调研交互主卡片（完整一屏不滚动）
  const cardContent = (
    <div className="relative w-full max-w-[660px] rounded-2xl border border-line bg-overlay backdrop-blur-2xl p-5 sm:p-7 shadow-elevation-4 text-ink select-none overflow-hidden animate-scale-in">
      {/* 顶部微透环境漫反射高光 */}
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full pointer-events-none opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(225,29,116,0.35) 0%, transparent 70%)' }}
      />

      {/* 跳过 / 关闭按钮 */}
      <button
        type="button"
        onClick={handleSkip}
        disabled={busy}
        aria-label="跳过引导"
        className="absolute right-4 top-4 size-8 rounded-full bg-wash hover:bg-surface-raised border border-line-subtle text-ink-muted hover:text-ink active:scale-95 active:duration-instant flex items-center justify-center transition-[background-color,color,transform] duration-fast ease-standard cursor-pointer z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-ring"
        title={copy.skip}
      >
        <X className="size-3.5" />
      </button>

      {/* 顶部导航与进度指示条 */}
      <div className="flex items-center justify-between mb-2 pr-8">
        <span className="text-caption text-ink-muted font-medium">
          {copy.welcome}
        </span>
        <div className="flex items-center gap-1.5" aria-label={`步骤 ${step} / 2`}>
          <div
            className={cn(
              'h-1 w-7 rounded-full transition-colors duration-smooth',
              step >= 1 ? 'bg-brand' : 'bg-line'
            )}
          />
          <div
            className={cn(
              'h-1 w-7 rounded-full transition-colors duration-smooth',
              step >= 2 ? 'bg-brand' : 'bg-line'
            )}
          />
          <span className="font-mono text-caption text-ink-muted ml-1.5">
            {step} / 2
          </span>
        </div>
      </div>

      {/* 居中 SupDance 官方 Logo（纯净无外框容器） */}
      <div className="flex justify-center mt-1 mb-3.5">
        <img
          src="/branding/logo-square.png"
          alt="SupDance"
          width={56}
          height={56}
          className="h-12 w-12 sm:h-14 sm:w-14 object-contain rounded-2xl drop-shadow-md select-none pointer-events-none"
        />
      </div>

      {/* 标题与副标题 */}
      <div className="text-center mb-3 sm:mb-4">
        <h2 id="onboarding-modal-title" className="text-section-title font-bold text-ink tracking-tight">
          {step === 1 ? copy.step1Title : copy.step2Title}
        </h2>
        <p className="mt-1 text-caption text-ink-muted max-w-md mx-auto">
          {step === 1 ? copy.step1Subtitle : copy.step2Subtitle}
        </p>
      </div>

      {/* 选项卡片网格 (双列平铺一整页，坚决不滚动页面) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(step === 1 ? occupationList : purposeList).map((item) => {
          const isSelected = step === 1
            ? selectedOccupation === item.code
            : selectedPurpose === item.code;

          const title = optionLabel(item, normLocale);
          const desc = optionDesc(item, normLocale);

          return (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                if (step === 1) setSelectedOccupation(item.code);
                else setSelectedPurpose(item.code);
              }}
              className={cn(
                'flex items-center justify-between p-2.5 sm:px-3 rounded-xl border text-left transition-[background-color,border-color,box-shadow,transform] duration-fast ease-standard active:scale-[0.98] cursor-pointer group',
                isSelected
                  ? 'border-brand bg-brand-soft/40 shadow-elevation-1 ring-1 ring-brand-ring'
                  : 'border-line-subtle bg-wash text-ink-muted hover:border-line hover:bg-surface-raised hover:text-ink'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                    isSelected
                      ? 'border-brand-line bg-brand/20 text-brand'
                      : 'border-line-subtle bg-surface-raised text-ink-muted group-hover:text-ink'
                  )}
                >
                  <OptionIcon name={item.icon} className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-semibold text-ink truncate leading-tight">
                    {title}
                  </div>
                  {desc && (
                    <div className="text-micro text-ink-muted truncate mt-0.5 leading-tight">
                      {desc}
                    </div>
                  )}
                </div>
              </div>

              {/* 单选指示器 */}
              <div
                className={cn(
                  'ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all',
                  isSelected
                    ? 'border-brand bg-brand text-ink-on-accent shadow-sm'
                    : 'border-line-subtle group-hover:border-line'
                )}
              >
                {isSelected && <Check className="h-3 w-3 text-white stroke-[3]" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* 如果选了其他（other），平滑呈现输入框 */}
      {((step === 1 && selectedOccupation === 'other') || (step === 2 && selectedPurpose === 'other')) && (
        <div className="mt-2.5 animate-fade-in">
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder={copy.otherPlaceholder}
            maxLength={60}
            className="w-full h-9 px-3 rounded-xl border border-line-subtle bg-well text-body-sm text-ink placeholder-ink-disabled outline-none focus:border-brand-line focus:ring-1 focus:ring-brand-ring transition"
          />
        </div>
      )}

      {/* 异常提示 */}
      {error && (
        <div className="mt-2.5 rounded-xl border border-danger-line bg-danger-soft p-2 text-caption text-danger text-center animate-fade-in">
          {error}
        </div>
      )}

      {/* 底部操作区 */}
      <div className="mt-4 pt-3.5 border-t border-line-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-caption text-ink-subtle select-none">
          {copy.footerHint}
        </span>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {step === 2 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError('');
                setStep(1);
              }}
              className="h-9 px-4 rounded-full border border-line-subtle bg-wash hover:bg-surface-raised text-body-sm text-ink-muted hover:text-ink active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="size-4" />
              <span>{copy.back}</span>
            </button>
          )}

          {step === 1 ? (
            <button
              type="button"
              disabled={!selectedOccupation || busy}
              onClick={() => {
                setError('');
                setStep(2);
              }}
              className="h-9 px-6 rounded-full bg-brand text-body-sm font-semibold text-ink-on-accent transition-all hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-elevation-1"
            >
              <span>{copy.next}</span>
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!selectedPurpose || busy}
              onClick={handleSubmit}
              className="h-9 px-6 rounded-full bg-brand text-body-sm font-semibold text-ink-on-accent transition-all hover:bg-brand-hover active:bg-brand-active active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shadow-elevation-1"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>处理中…</span>
                </>
              ) : (
                <>
                  <span>{copy.finish}</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (isPageMode) {
    return (
      <main className="min-h-screen bg-canvas text-ink flex items-center justify-center p-4">
        {cardContent}
      </main>
    );
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-scrim backdrop-blur-xl p-4 transition-opacity duration-base ease-enter animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
    >
      {cardContent}
    </div>
  );
}
