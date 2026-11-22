'use client';

import React, { useState } from 'react';

export default function DeveloperEcosystem() {
  const [activeTab, setActiveTab] = useState('agent');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const copyPromptText = () => {
    navigator.clipboard.writeText(
      '从 https://github.com/supdance/OpenClaw_SupDance_Skills 安装 SupDance 技能，并引导我配置 API Key。'
    );
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <section className="py-20 max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
      {/* 区域标题 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
        <div>
          <span className="text-brand font-mono text-xs font-semibold tracking-wider uppercase">
            DEVELOPER ECOSYSTEM
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink mt-1 tracking-tight">
            为现代开发者打造的全场景接入体系
          </h2>
        </div>
        <p className="text-sm text-ink-muted max-w-md mt-3 md:mt-0">
          无论您是在聊天 Agent 中用自然语言驱动、在终端命令行批处理，还是在 ComfyUI 工作流中搭建流水线，我们都已深度就绪。
        </p>
      </div>

      {/* 选项卡容器 */}
      <div className="rounded-2xl p-6 sm:p-8 border border-line bg-well/80 backdrop-blur-xl">
        {/* 头部 Tab 切换 */}
        <div className="flex flex-wrap gap-2 border-b border-line pb-4 mb-6">
          <button
            onClick={() => setActiveTab('agent')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'agent'
                ? 'bg-brand-soft text-brand-hover border border-brand-line'
                : 'text-ink-muted hover:text-ink hover:bg-wash'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span>Agent 智能体调用 (MCP)</span>
          </button>

          <button
            onClick={() => setActiveTab('cli')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === 'cli'
                ? 'bg-brand-soft text-brand-hover border border-brand-line font-bold'
                : 'text-ink-muted hover:text-ink hover:bg-wash'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>SupDance_CLI 终端工具</span>
          </button>

          <button
            onClick={() => setActiveTab('comfyui')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === 'comfyui'
                ? 'bg-brand-soft text-brand-hover border border-brand-line font-bold'
                : 'text-ink-muted hover:text-ink hover:bg-wash'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>ComfyUI 官方节点套件</span>
          </button>

          <button
            onClick={() => setActiveTab('sdk')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === 'sdk'
                ? 'bg-brand-soft text-brand-hover border border-brand-line font-bold'
                : 'text-ink-muted hover:text-ink hover:bg-wash'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span>多语言 SDK & API 网关</span>
          </button>
        </div>

        {/* 内容展示 */}
        {activeTab === 'agent' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <h3 className="text-xl font-bold text-ink">
                在聊天 Agent 中使用自然语言调用 SupDance
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                非常适合 OpenClaw、Dify、Coze、FastGPT 等对话式智能体：复制提示词并发送给智能体，即可自动安装技能并引导配置 API Key，无需编写单行代码即可调度全模态模型。
              </p>
              <div className="flex items-center gap-3 pt-2">
                <span className="px-2.5 py-1 rounded bg-wash-strong text-xs text-ink font-mono">OpenClaw Ready</span>
                <span className="px-2.5 py-1 rounded bg-wash-strong text-xs text-ink font-mono">MCP Protocol</span>
                <span className="px-2.5 py-1 rounded bg-wash-strong text-xs text-ink font-mono">Tool-Calling</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-xl bg-canvas border border-line p-4 font-mono text-xs text-ink relative group">
                <div className="flex items-center justify-between mb-2 text-ink-muted text-[11px] pb-2 border-b border-line-subtle">
                  <span className="text-brand font-semibold">提示词引导指令 (Prompt)</span>
                  <button onClick={copyPromptText} className="hover:text-ink flex items-center gap-1 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>{copiedPrompt ? '已复制！' : '复制指令'}</span>
                  </button>
                </div>
                <p className="text-ink leading-relaxed select-all">
                  从 <span className="text-brand-hover font-semibold">https://github.com/supdance/OpenClaw_SupDance_Skills</span> 安装 SupDance 技能，并引导我配置 API Key。
                </p>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-line-subtle">
                  <span className="text-[11px] text-ink-subtle">支持零配置自动探测工具调用契约</span>
                  <a href="https://github.com" target="_blank" rel="noreferrer" className="text-xs text-brand hover:text-brand-hover flex items-center gap-1 font-sans font-semibold">
                    <span>查看 GitHub 仓库</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cli' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <h3 className="text-xl font-bold text-ink">
                命令行极速流：SupDance_CLI
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                专为 DevOps 工程师与脚本极客打造。支持一行命令完成批处理生图、长视频异步渲染排队、资产同步至本地云端等高级工作流。
              </p>
              <div className="flex items-center gap-2 pt-1 font-mono text-xs text-ink-muted">
                <span className="text-success font-bold">$</span> supdance video create --prompt "..." --output ./output.mp4
              </div>
            </div>
            <div className="lg:col-span-6">
              <div className="rounded-xl bg-canvas border border-line p-4 font-mono text-xs text-ink">
                <div className="text-ink-subtle mb-2"># 一键安装 SupDance CLI 全局工具</div>
                <div className="p-2.5 rounded bg-scrim border border-line-subtle text-brand-hover flex items-center justify-between">
                  <span>npm install -g @supdance/cli</span>
                  <button onClick={() => navigator.clipboard.writeText('npm install -g @supdance/cli')} className="text-ink-muted hover:text-ink text-[11px]">复制</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'comfyui' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <h3 className="text-xl font-bold text-ink">
                ComfyUI 官方节点套件 (ComfyUI-SupDance)
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                无缝嵌入任何 ComfyUI 流程中。无需在本地配置昂贵的 4090 或 A100 显卡，只需将 SupDance 统一节点连接到您的工作流，即可极速输出 4K 超高清画质。
              </p>
            </div>
            <div className="lg:col-span-6">
              <div className="rounded-xl bg-canvas border border-line p-4 font-mono text-xs text-ink">
                <div className="text-ink-subtle mb-2"># 极速克隆至 custom_nodes 目录</div>
                <div className="p-2.5 rounded bg-scrim border border-line-subtle text-warning flex items-center justify-between">
                  <span>git clone https://github.com/supdance/ComfyUI-SupDanceNode</span>
                  <button onClick={() => navigator.clipboard.writeText('git clone https://github.com/supdance/ComfyUI-SupDanceNode')} className="text-ink-muted hover:text-ink text-[11px]">复制</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sdk' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <h3 className="text-xl font-bold text-ink">
                企业级强类型 SDK：Python / TypeScript / Go
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                自带完备的 TypeScript 类型定义、智能流式分块处理（SSE）、自动断线重连与智能熔断。99.99% 企业级 SLA 承诺。
              </p>
            </div>
            <div className="lg:col-span-6">
              <div className="rounded-xl bg-canvas border border-line p-4 font-mono text-xs text-ink">
                <div className="text-ink-subtle mb-2"># 安装官方 SDK</div>
                <div className="space-y-2">
                  <div className="p-2 rounded bg-scrim border border-line-subtle text-purple-300">pip install supdance-sdk</div>
                  <div className="p-2 rounded bg-scrim border border-line-subtle text-info">npm install @supdance/sdk</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
