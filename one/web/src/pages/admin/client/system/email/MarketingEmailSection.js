'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, StatusBadge } from '@/components/admin/AdminUi';
import { MARKETING_TEMPLATES, renderMarketingTemplate } from '@/lib/emailMarketingTemplates';

const TEMPLATE_KEYS = ['welcome', 'newsletter', 'credit_alert', 'winback'];

export default function MarketingEmailSection({ canWrite }) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState('welcome');
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'variables'
  const [previewDevice, setPreviewDevice] = useState('desktop'); // 'desktop' | 'mobile'
  
  // 各模板的编辑状态缓存
  const [editedSubjects, setEditedSubjects] = useState(() => ({
    welcome: MARKETING_TEMPLATES.welcome.defaultSubject,
    newsletter: MARKETING_TEMPLATES.newsletter.defaultSubject,
    credit_alert: MARKETING_TEMPLATES.credit_alert.defaultSubject,
    winback: MARKETING_TEMPLATES.winback.defaultSubject,
  }));

  const [editedHtmls, setEditedHtmls] = useState(() => ({
    welcome: MARKETING_TEMPLATES.welcome.defaultHtml,
    newsletter: MARKETING_TEMPLATES.newsletter.defaultHtml,
    credit_alert: MARKETING_TEMPLATES.credit_alert.defaultHtml,
    winback: MARKETING_TEMPLATES.winback.defaultHtml,
  }));

  const [variables, setVariables] = useState(() => ({
    welcome: { ...MARKETING_TEMPLATES.welcome.sampleVariables },
    newsletter: { ...MARKETING_TEMPLATES.newsletter.sampleVariables },
    credit_alert: { ...MARKETING_TEMPLATES.credit_alert.sampleVariables },
    winback: { ...MARKETING_TEMPLATES.winback.sampleVariables },
  }));

  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const currentTemplate = MARKETING_TEMPLATES[selectedKey];
  const currentSubject = editedSubjects[selectedKey] || '';
  const currentHtml = editedHtmls[selectedKey] || '';
  const currentVars = variables[selectedKey] || {};

  // 实时编译渲染后的 HTML
  const compiledHtml = useMemo(() => {
    return renderMarketingTemplate(currentHtml, currentVars, selectedKey);
  }, [currentHtml, currentVars, selectedKey]);

  // 实时编译的主题
  const compiledSubject = useMemo(() => {
    return renderMarketingTemplate(currentSubject, currentVars, selectedKey);
  }, [currentSubject, currentVars, selectedKey]);

  const handleSubjectChange = (val) => {
    setEditedSubjects((prev) => ({ ...prev, [selectedKey]: val }));
  };

  const handleHtmlChange = (val) => {
    setEditedHtmls((prev) => ({ ...prev, [selectedKey]: val }));
  };

  const handleVariableChange = (varKey, val) => {
    setVariables((prev) => ({
      ...prev,
      [selectedKey]: {
        ...prev[selectedKey],
        [varKey]: val,
      },
    }));
  };

  const resetToDefault = () => {
    if (!window.confirm(`确定要将【${currentTemplate.name}】重置为系统默认内容吗？当前修改将被清除。`)) return;
    setEditedSubjects((prev) => ({ ...prev, [selectedKey]: currentTemplate.defaultSubject }));
    setEditedHtmls((prev) => ({ ...prev, [selectedKey]: currentTemplate.defaultHtml }));
    setVariables((prev) => ({ ...prev, [selectedKey]: { ...currentTemplate.sampleVariables } }));
  };

  const insertVariableToHtml = (varKey) => {
    const placeholder = `{{${varKey}}}`;
    handleHtmlChange(currentHtml + placeholder);
  };

  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testEmail.trim()) {
      alert('请填写接收测试邮件的邮箱地址');
      return;
    }

    setBusy(true);
    setSendResult(null);

    try {
      const res = await fetch('/api/admin/marketing/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          to: testEmail.trim(),
          templateKey: selectedKey,
          subject: currentSubject,
          html: currentHtml,
          variables: currentVars,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || '测试邮件发送失败');
      }

      setSendResult({
        success: true,
        message: data.data?.message || `测试邮件已发送至 ${testEmail}`,
        latencyMs: data.data?.latencyMs,
      });
      router.refresh();
    } catch (err) {
      setSendResult({
        success: false,
        message: err.message || '发信请求异常',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden border border-line bg-canvas">
      {/* 头部导航与模板选择 */}
      <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-card-title font-bold text-ink">邮箱营销与模板管理</h2>
            <StatusBadge tone="good">完整就绪</StatusBadge>
          </div>
          <p className="mt-1 text-body-sm text-ink-muted">
            涵盖新用户注册欢迎引导、周报动态、额度警报与促活召回全生命周期；支持可视化编辑与双栏沙箱实时预览。
          </p>
        </div>

        {/* 模板快捷切换 Tab */}
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-wash p-1">
          {TEMPLATE_KEYS.map((key) => {
            const tmpl = MARKETING_TEMPLATES[key];
            const isSelected = selectedKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedKey(key);
                  setSendResult(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-label font-medium transition ${
                  isSelected
                    ? 'bg-brand text-ink-on-accent shadow-sm'
                    : 'text-ink-muted hover:bg-wash-press hover:text-ink'
                }`}
              >
                {tmpl.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 模板描述与操作栏 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-wash px-4 py-3 text-caption text-ink-muted">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">类型：{currentTemplate.category}</span>
          <span>·</span>
          <span>{currentTemplate.description}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetToDefault}
            className="text-label text-ink-muted hover:text-brand underline"
          >
            恢复默认模板
          </button>
        </div>
      </div>

      {/* 邮件主题编辑 */}
      <div className="mt-5">
        <label className="mb-1.5 block text-label font-semibold text-ink">
          邮件主题 (Subject)
          <span className="ml-2 font-normal text-ink-subtle">支持使用动态变量插值</span>
        </label>
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            type="text"
            value={currentSubject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            disabled={!canWrite}
            className="flex-1 rounded-xl border border-line bg-canvas px-3.5 py-2 text-body text-ink outline-none focus:border-brand-ring"
            placeholder="邮件标题..."
          />
          <div className="flex items-center rounded-xl border border-line bg-wash px-3 text-caption text-ink-muted">
            <span className="font-mono text-ink-subtle">实际渲染：</span>
            <span className="ml-1 font-medium text-ink truncate max-w-xs">{compiledSubject}</span>
          </div>
        </div>
      </div>

      {/* 主工作区：双栏排版（左侧编辑/变量，右侧实时沙箱预览） */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 左侧编辑区域 (5 列) */}
        <div className="flex flex-col gap-3 lg:col-span-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1 text-label rounded-lg transition ${
                  activeTab === 'code' ? 'bg-brand text-ink-on-accent font-semibold' : 'text-ink-muted hover:text-ink'
                }`}
              >
                HTML 源码
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('variables')}
                className={`px-3 py-1 text-label rounded-lg transition ${
                  activeTab === 'variables' ? 'bg-brand text-ink-on-accent font-semibold' : 'text-ink-muted hover:text-ink'
                }`}
              >
                测试变量调试 ({Object.keys(currentVars).length})
              </button>
            </div>
            <span className="text-micro text-ink-subtle font-mono">UTF-8 / Responsive</span>
          </div>

          {activeTab === 'code' ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5 text-micro text-ink-subtle">
                <span>点击插入变量：</span>
                {currentTemplate.supportedVariables?.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariableToHtml(v.key)}
                    className="rounded bg-wash px-1.5 py-0.5 font-mono text-ink hover:bg-brand hover:text-ink-on-accent transition"
                    title={`${v.label} (默认: ${v.default})`}
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
              <textarea
                value={currentHtml}
                onChange={(e) => handleHtmlChange(e.target.value)}
                disabled={!canWrite}
                rows={22}
                className="w-full rounded-xl border border-line bg-wash p-3.5 font-mono text-caption text-ink outline-none focus:border-brand-ring leading-relaxed"
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-wash p-4">
              <p className="mb-3 text-body-sm text-ink-muted">
                修改变量值以实时模拟右侧预览效果，测试发信时将使用此组变量：
              </p>
              <div className="grid gap-3 max-h-96 overflow-y-auto pr-1">
                {currentTemplate.supportedVariables?.map((v) => (
                  <div key={v.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-label">
                      <span className="font-mono text-ink font-semibold">{`{{${v.key}}}`}</span>
                      <span className="text-caption text-ink-subtle">{v.label}</span>
                    </div>
                    <input
                      type="text"
                      value={currentVars[v.key] ?? ''}
                      onChange={(e) => handleVariableChange(v.key, e.target.value)}
                      className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-label text-ink outline-none focus:border-brand-ring"
                      placeholder={`默认: ${v.default}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧实时沙箱预览区域 (6 列) */}
        <div className="flex flex-col gap-3 lg:col-span-6">
          <div className="flex items-center justify-between">
            <span className="text-label font-semibold text-ink">实时邮件渲染预览</span>
            <div className="flex items-center gap-1 rounded-lg border border-line bg-wash p-0.5 text-caption">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`rounded px-2.5 py-1 transition ${
                  previewDevice === 'desktop' ? 'bg-brand text-ink-on-accent font-medium' : 'text-ink-muted'
                }`}
              >
                桌面端 (600px)
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`rounded px-2.5 py-1 transition ${
                  previewDevice === 'mobile' ? 'bg-brand text-ink-on-accent font-medium' : 'text-ink-muted'
                }`}
              >
                移动端 (375px)
              </button>
            </div>
          </div>

          <div
            className="mx-auto flex w-full flex-col items-center justify-center rounded-2xl border border-line bg-wash-press p-2 transition"
            style={{ maxWidth: previewDevice === 'mobile' ? '395px' : '100%' }}
          >
            {previewDevice === 'mobile' && (
              <div className="mb-1.5 h-3 w-16 rounded-full bg-line" />
            )}
            <iframe
              title="邮件渲染预览"
              srcDoc={compiledHtml}
              sandbox="allow-same-origin"
              className="w-full rounded-xl border border-line shadow-inner transition"
              style={{
                height: '560px',
                maxWidth: previewDevice === 'mobile' ? '375px' : '100%',
                backgroundColor: '#0b0f19',
              }}
            />
          </div>
        </div>
      </div>

      {/* 底部测试发信操作面板 */}
      {canWrite && (
        <div className="mt-8 border-t border-line pt-6">
          <form onSubmit={handleSendTest} className="flex flex-col gap-4 rounded-xl border border-line bg-wash p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-label font-bold text-ink">向指定邮箱发送真实营销测试邮件</h3>
                <p className="mt-0.5 text-caption text-ink-muted">
                  将当前编辑器中编辑的【{currentTemplate.name}】HTML 及上方变量，经由 QQ 企业邮箱真实发出并记录至发信日志中。
                </p>
              </div>
              <span className="text-micro text-ink-subtle">
                频率保护：每小时限 10 封 · 记录审计日志
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="email"
                required
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="输入收件测试邮箱（例如 your-email@example.com）"
                className="flex-1 rounded-xl border border-line bg-canvas px-4 py-2.5 text-body text-ink outline-none focus:border-brand-ring"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-brand px-6 py-2.5 text-label font-bold text-ink-on-accent transition hover:bg-brand-active disabled:opacity-50"
              >
                {busy ? '正在发送测试邮件...' : '一键发送营销测试邮件'}
              </button>
            </div>

            {sendResult && (
              <p
                className={`mt-2 text-label font-medium ${
                  sendResult.success ? 'text-good' : 'text-danger'
                }`}
              >
                {sendResult.message}
                {sendResult.latencyMs != null && ` · 耗时 ${sendResult.latencyMs} ms`}
              </p>
            )}
          </form>
        </div>
      )}
    </Card>
  );
}

