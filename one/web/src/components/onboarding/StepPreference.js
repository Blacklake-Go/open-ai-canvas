'use client';

import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Box,
  Briefcase,
  Camera,
  Check,
  Clapperboard,
  Coffee,
  Feather,
  FlaskConical,
  Gamepad2,
  Gift,
  Mountain,
  Package,
  PenTool,
  Pin,
  Rocket,
  SkipForward,
  Smile,
  Smartphone,
  Sparkles,
  Sprout,
  TrendingUp,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FOCUS_RING } from 'studio/ui/tokens';
import { optionDesc, optionLabel } from '@/lib/onboarding/copy';
import {
  COMMITMENTS,
  OCCUPATIONS,
  PURPOSES,
  PURPOSE_MAX,
  STYLES,
  STYLE_MAX,
  STYLE_MIN,
  USAGE_INTENTS,
} from '@/lib/onboarding/schema';
import { cn } from '@/lib/utils';

const ICONS = {
  Clapperboard,
  PenTool,
  Smartphone,
  Gamepad2,
  Sprout,
  Briefcase,
  TrendingUp,
  BookOpen,
  Smile,
  FlaskConical,
  Users,
  Camera,
  WandSparkles,
  Box,
  Feather,
  Rocket,
  Package,
  Mountain,
  Coffee,
};

function OptionIcon({ name, className }) {
  const Icon = ICONS[name];
  if (!Icon) return null;
  return <Icon className={className} aria-hidden="true" />;
}

function Field({ id, title, hint, children }) {
  return (
    <div className="mt-6 border-t border-line-subtle pt-5 first-of-type:border-0 first-of-type:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={id} className="text-card-title">{title}</h3>
        <span className="text-micro text-ink-subtle">{hint}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function pick(list, code, localeCode) {
  const item = list.find((entry) => entry.code === code);
  if (!item) return null;
  return { ...item, label: optionLabel(item, localeCode) };
}

export default function StepPreference({ copy, localeCode, busy, credits, onBack, onSkip, onSubmit }) {
  const [occupation, setOccupation] = useState('');
  const [purposeCodes, setPurposeCodes] = useState([]);
  const [commitment, setCommitment] = useState('');
  const [styleCodes, setStyleCodes] = useState([]);
  const [usageIntent, setUsageIntent] = useState('');
  const [allowTraining, setAllowTraining] = useState(false);

  const togglePurpose = (code) => {
    setPurposeCodes((prev) => {
      if (prev.includes(code)) return prev.filter((entry) => entry !== code);
      return prev.length >= PURPOSE_MAX ? prev : [...prev, code];
    });
  };

  const toggleStyle = (code) => {
    setStyleCodes((prev) => {
      if (prev.includes(code)) return prev.filter((entry) => entry !== code);
      return prev.length >= STYLE_MAX ? [...prev.slice(1), code] : [...prev, code];
    });
  };

  const promotePurpose = (code) => setPurposeCodes((prev) => [code, ...prev.filter((entry) => entry !== code)]);

  const missing = [
    !occupation && copy.occupationLabel,
    purposeCodes.length < 1 && copy.purposeLabel,
    !commitment && copy.commitmentLabel,
    styleCodes.length < STYLE_MIN && copy.styleLabel,
    !usageIntent && copy.usageLabel,
  ].find(Boolean);

  const personaPreview = [
    pick(OCCUPATIONS, occupation, localeCode),
    pick(PURPOSES, purposeCodes[0], localeCode),
    pick(COMMITMENTS, commitment, localeCode),
    pick(STYLES, styleCodes[0], localeCode),
  ].filter(Boolean);

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-elevation-3 sm:p-7">
      <h1 className="text-page-title">{copy.preferenceTitle}</h1>
      <p className="mt-1.5 text-body-sm text-ink-muted">{copy.preferenceSubtitle}</p>

      <Field id="onboarding-field-occupation" title={copy.occupationLabel} hint={copy.occupationHint}>
        <div
          role="radiogroup"
          aria-labelledby="onboarding-field-occupation"
          className="grid gap-2 sm:grid-cols-2"
        >
          {OCCUPATIONS.map((entry) => {
            const active = occupation === entry.code;
            return (
              <button
                key={entry.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setOccupation(entry.code)}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors duration-fast ease-standard',
                  FOCUS_RING,
                  active
                    ? 'border-brand-line bg-brand-soft'
                    : 'border-line bg-transparent hover:border-line-strong hover:bg-wash',
                )}
              >
                <OptionIcon
                  name={entry.icon}
                  className={cn('mt-0.5 size-4 shrink-0', active ? 'text-brand' : 'text-ink-muted')}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-body-sm font-medium text-ink">
                    {optionLabel(entry, localeCode)}
                  </span>
                  <span className="mt-0.5 block text-caption text-ink-muted">
                    {optionDesc(entry, localeCode)}
                  </span>
                </span>
                {active && <Check className="size-4 shrink-0 text-brand" />}
              </button>
            );
          })}
        </div>
      </Field>

      <Field id="onboarding-field-purpose" title={copy.purposeLabel} hint={copy.purposeHint}>
        <div
          role="group"
          aria-labelledby="onboarding-field-purpose"
          className="grid gap-2 sm:grid-cols-3"
        >
          {PURPOSES.map((entry) => {
            const rank = purposeCodes.indexOf(entry.code);
            const active = rank >= 0;
            return (
              <button
                key={entry.code}
                type="button"
                onClick={() => togglePurpose(entry.code)}
                aria-pressed={active}
                className={cn(
                  'relative flex items-center gap-2 rounded-xl border p-2.5 text-left transition-colors duration-fast ease-standard',
                  FOCUS_RING,
                  active
                    ? 'border-brand-line bg-brand-soft'
                    : 'border-line bg-transparent hover:border-line-strong hover:bg-wash',
                )}
              >
                <OptionIcon
                  name={entry.icon}
                  className={cn('size-3.5 shrink-0', active ? 'text-brand' : 'text-ink-muted')}
                />
                <span className="min-w-0 flex-1 truncate text-body-sm text-ink">
                  {optionLabel(entry, localeCode)}
                </span>
                {active && (
                  <span className="rounded-full bg-brand px-1.5 text-micro font-medium text-ink-on-accent">
                    {rank + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {purposeCodes.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line-subtle bg-well px-3 py-2">
            <span className="text-micro text-ink-subtle">{copy.purposePrimary}</span>
            {purposeCodes.map((code, index) => {
              const entry = pick(PURPOSES, code, localeCode);
              return (
                <span key={code} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-micro">
                  <span className="font-mono text-ink-subtle">{index + 1}</span>
                  <span className="text-ink">{entry.label}</span>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => promotePurpose(code)}
                      aria-label={copy.purposeSetPrimary}
                      className="cursor-pointer text-ink-subtle transition-colors duration-fast ease-standard hover:text-brand"
                    >
                      <Pin className="size-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => togglePurpose(code)}
                    aria-label={copy.purposeRemove}
                    className="cursor-pointer text-ink-subtle transition-colors duration-fast ease-standard hover:text-danger"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </Field>

      <Field id="onboarding-field-commitment" title={copy.commitmentLabel} hint={copy.commitmentHint}>
        <div
          role="radiogroup"
          aria-labelledby="onboarding-field-commitment"
          className="flex flex-wrap gap-2"
        >
          {COMMITMENTS.map((entry) => {
            const active = commitment === entry.code;
            return (
              <button
                key={entry.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCommitment(entry.code)}
                title={optionDesc(entry, localeCode)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-body-sm transition-colors duration-fast ease-standard',
                  FOCUS_RING,
                  active
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-line bg-transparent text-ink-muted hover:border-line-strong hover:text-ink',
                )}
              >
                {optionLabel(entry, localeCode)}
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        id="onboarding-field-style"
        title={copy.styleLabel}
        hint={styleCodes.length >= STYLE_MIN ? copy.styleHintDone : copy.styleHintTodo}
      >
        <div
          role="group"
          aria-labelledby="onboarding-field-style"
          className="flex flex-wrap gap-2"
        >
          {STYLES.map((entry) => {
            const active = styleCodes.includes(entry.code);
            return (
              <button
                key={entry.code}
                type="button"
                onClick={() => toggleStyle(entry.code)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-body-sm transition-colors duration-fast ease-standard',
                  FOCUS_RING,
                  active
                    ? 'border-brand-line bg-brand-soft text-ink'
                    : 'border-line bg-transparent text-ink-muted hover:border-line-strong hover:bg-wash',
                )}
              >
                <OptionIcon
                  name={entry.icon}
                  className={cn('size-3.5 shrink-0', active ? 'text-brand' : 'text-ink-muted')}
                />
                <span>{optionLabel(entry, localeCode)}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field id="onboarding-field-usage" title={copy.usageLabel} hint={copy.usageHint}>
        <div
          role="radiogroup"
          aria-labelledby="onboarding-field-usage"
          className="grid gap-2 sm:grid-cols-2"
        >
          {USAGE_INTENTS.map((entry) => {
            const active = usageIntent === entry.code;
            return (
              <button
                key={entry.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setUsageIntent(entry.code)}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors duration-fast ease-standard',
                  FOCUS_RING,
                  active
                    ? 'border-brand-line bg-brand-soft'
                    : 'border-line bg-transparent hover:border-line-strong hover:bg-wash',
                )}
              >
                <span
                  className={cn(
                    'size-4 shrink-0 rounded-full border transition-colors duration-fast ease-standard',
                    active ? 'border-brand bg-brand' : 'border-line-strong',
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="block text-body-sm text-ink">{optionLabel(entry, localeCode)}</span>
                  <span className="block text-caption text-ink-muted">{optionDesc(entry, localeCode)}</span>
                </span>
              </button>
            );
          })}
        </div>

        <label
          htmlFor="onboarding-allow-training"
          className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-line-subtle bg-well px-3 py-2.5"
        >
          <input
            id="onboarding-allow-training"
            type="checkbox"
            checked={allowTraining}
            onChange={(event) => setAllowTraining(event.target.checked)}
            className="mt-0.5 size-4 accent-brand"
          />
          <span className="min-w-0">
            <span className="block text-body-sm text-ink">{copy.allowTraining}</span>
            <span className="block text-caption text-ink-muted">{copy.allowTrainingHint}</span>
          </span>
        </label>
      </Field>

      {personaPreview.length === 4 && (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-line-subtle bg-well px-3 py-2.5 text-caption text-ink-muted">
          <Sparkles className="size-3.5 shrink-0 text-brand" />
          <span>{copy.personaPreview}</span>
          <code className="font-mono text-body-sm text-brand">
            {[
              pick(OCCUPATIONS, occupation, localeCode),
              pick(PURPOSES, purposeCodes[0], localeCode),
              pick(COMMITMENTS, commitment, localeCode),
              pick(STYLES, styleCodes[0], localeCode),
            ].map((entry) => entry.persona).join('-')}
          </code>
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="md" onClick={onBack} disabled={busy}>
          <span>{copy.back}</span>
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="tertiary" size="md" onClick={onSkip} disabled={busy} title={copy.skipHint}>
            <SkipForward className="size-3.5" />
            <span>{copy.skip}</span>
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={busy || Boolean(missing)}
            onClick={() => onSubmit({ occupation, purposeCodes, commitment, styleCodes, usageIntent, allowTraining })}
          >
            {busy ? (
              <span>{copy.saving}</span>
            ) : (
              <>
                <Gift className="size-4 text-warning" />
                <span>{copy.finishWithReward.replace('{credits}', String(credits))}</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {missing
        ? <p className="mt-2 text-right text-caption text-ink-subtle">{copy.selectRequired.replace('{field}', missing)}</p>
        : <p className="mt-2 text-right text-caption text-ink-subtle">{copy.rewardClaimHint}</p>}
    </section>
  );
}
