'use client';

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ShieldAlert, KeyRound, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function AgentApiKeyTab() {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [notice, setNotice] = useState('');

  const fetchKey = async () => {
    try {
      const res = await fetch('/api/user/api-key');
      if (res.ok) {
        const data = await res.json();
        if (data.apiKey) {
          setApiKey(data.apiKey);
          if (data.createdAt) {
            setCreatedAt(new Date(data.createdAt).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }));
          }
        }
      }
    } catch (err) {
      console.error('获取 API 密钥失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKey();
  }, []);

  const handleCopy = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!window.confirm('重新生成密钥将导致现存使用旧密钥的自建 Agent 与自动化脚本失效，是否继续？')) {
      return;
    }

    setRegenerating(true);
    try {
      const res = await fetch('/api/user/api-key', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.apiKey) {
        setApiKey(data.apiKey);
        if (data.createdAt) {
          setCreatedAt(new Date(data.createdAt).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }));
        }
        setNotice('新密钥已生成并永久同步至云端数据库');
        setTimeout(() => setNotice(''), 3000);
      } else {
        setNotice(data.error || '重新生成失败');
        setTimeout(() => setNotice(''), 3000);
      }
    } catch (err) {
      console.error('重新生成 API 密钥失败:', err);
      setNotice('网络请求失败，请稍后重试');
      setTimeout(() => setNotice(''), 3000);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <div>
        <h1 className="text-page-title text-ink">Agent API 密钥</h1>
        <p className="mt-1 text-body-subtle text-ink-muted">用于自建 Agent、工作流自动化或本地脚本调用。</p>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="rounded-xl border border-line-subtle bg-surface p-6 shadow-elevation-1 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-brand" />
                <h4 className="text-body-sm font-semibold text-ink">默认 Agent 访问密钥</h4>
              </div>
              <p className="text-caption text-ink-muted mt-1">用于集成自建 Agent、剧本生成流水线或本地 CLI 工具</p>
            </div>
            {createdAt && (
              <span className="text-caption text-ink-subtle font-mono">创建于: {createdAt}</span>
            )}
          </div>

          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-ink-muted text-caption">
              <Loader2 className="size-4 animate-spin text-brand" />
              <span>正在读取您的 API 密钥...</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
              <div className="flex-1 bg-well border border-line-subtle rounded-xl px-3.5 py-2 flex items-center justify-between font-mono text-body-sm text-ink min-h-[40px]">
                <span className="truncate mr-2">
                  {apiKey ? (showKey ? apiKey : `${apiKey.slice(0, 14)}••••••••••••••••`) : '暂无密钥'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-ink-muted hover:text-ink transition-colors shrink-0 p-1 cursor-pointer"
                  title={showKey ? '隐藏' : '显示'}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleCopy}
                  className="h-10 px-4 font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-brand" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      复制密钥
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={regenerating}
                  onClick={handleRegenerate}
                  className="h-10 px-4 font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`size-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                  {regenerating ? '生成中...' : '重新生成'}
                </Button>
              </div>
            </div>
          )}

          {notice && (
            <div className="text-caption text-brand bg-brand-soft border border-brand-line rounded-lg px-3 py-2 animate-in fade-in">
              {notice}
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3.5 text-caption text-amber-300 mt-2">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <p>API 密钥拥有账户完全调用权限，请勿提交至公开代码仓库或客户端。调用产生的消耗将从账户额度中实时扣除。</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
