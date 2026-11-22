'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export const COUNTRY_CODES = [
  { code: '+86', label: '中国大陆 (+86)' },
  { code: '+1', label: '美国 / 加拿大 (+1)' },
  { code: '+852', label: '中国香港 (+852)' },
  { code: '+886', label: '中国台湾 (+886)' },
  { code: '+81', label: '日本 (+81)' },
  { code: '+65', label: '新加坡 (+65)' },
  { code: '+44', label: '英国 (+44)' },
];

export default function PhoneLoginView({
  countryCode,
  setCountryCode,
  phone,
  setPhone,
  phoneCode,
  setPhoneCode,
  phoneCountdown,
  onSendCode,
  onSubmit,
  busy = false,
  copy = {},
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-ink-muted">
          {copy.phoneLabel || '手机号码'}
        </label>
        <div className="flex gap-2">
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="h-11 px-2 rounded-xl bg-well border border-line-subtle text-ink text-xs focus:outline-none focus:border-brand cursor-pointer font-mono shrink-0"
          >
            {COUNTRY_CODES.map((item) => (
              <option key={item.code} value={item.code} className="bg-surface text-ink">
                {item.code}
              </option>
            ))}
          </select>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={copy.phonePlaceholder || '输入手机号'}
            className="flex-1 h-11 px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-subtle text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-ink-muted">
          {copy.codeLabel || '短信验证码'}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={6}
            value={phoneCode}
            onChange={(e) => setPhoneCode(e.target.value)}
            placeholder={copy.codePlaceholder || '6 位验证码'}
            className="flex-1 h-11 px-3.5 rounded-xl bg-well border border-line-subtle text-ink placeholder-ink-subtle text-xs sm:text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/50 transition-all font-mono tracking-widest text-center"
          />
          <button
            type="button"
            disabled={phoneCountdown > 0 || busy}
            onClick={onSendCode}
            className="h-11 px-3.5 rounded-xl bg-wash hover:bg-surface-raised disabled:opacity-50 text-ink text-xs font-medium border border-line-subtle transition-colors shrink-0 cursor-pointer"
          >
            {phoneCountdown > 0
              ? (copy.resendCode ? copy.resendCode(phoneCountdown) : `${phoneCountdown}s 后重发`)
              : (copy.sendCode || '获取验证码')}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full h-11 mt-1 rounded-full bg-brand hover:bg-brand-hover active:bg-brand-active disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all duration-200 shadow-elevation-2 flex items-center justify-center gap-2 cursor-pointer"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        <span>{copy.submitLogin || '验证并登录'}</span>
      </button>
    </form>
  );
}
