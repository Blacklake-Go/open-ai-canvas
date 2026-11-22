'use client';

import React, { useState } from 'react';

export default function InteractiveCodeTerminal() {
  const [activeLang, setActiveLang] = useState('curl');
  const [copied, setCopied] = useState(false);

  const codeSnippets = {
    curl: `# 统一调用全模态生成接口 (以 Seedance 2.5 视频生成为例)
curl -X POST "https://api.Supdance.com/v1/video/generate" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "seedance-2.5-global/multimodal-video",
    "prompt": "电影级赛博朋克雨夜街道，霓虹倒影，超高清8k，极速运镜",
    "aspect_ratio": "16:9",
    "duration": 5
  }'`,
    python: `# 使用官方 Python SDK
from supdance import SupDanceClient

client = SupDanceClient(api_key="YOUR_API_KEY")

response = client.video.create(
    model="seedance-2.5-global/multimodal-video",
    prompt="电影级赛博朋克雨夜街道，霓虹倒影，超高清8k，极速运镜",
    aspect_ratio="16:9",
    duration=5
)

print(response.video_url)`,
    node: `// Node.js / TypeScript 极速接入
import { SupDanceAI } from '@supdance/sdk';

const ai = new SupDanceAI({ apiKey: process.env.SUPDANCE_API_KEY });

const task = await ai.video.generate({
  model: 'seedance-2.5-global/multimodal-video',
  prompt: '电影级赛博朋克雨夜街道，霓虹倒影，超高清8k，极速运镜',
  duration: 5,
});

console.log(task.outputUrl);`,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippets[activeLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-line bg-base/90 backdrop-blur-xl shadow-elevation-4 shadow-brand-soft">
      {/* 终端顶部状态栏 */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-wash">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-danger" />
          <div className="w-3 h-3 rounded-full bg-warning" />
          <div className="w-3 h-3 rounded-full bg-success" />
          <span className="ml-3 text-xs font-mono text-ink-muted">api.Supdance.com/v1/multimodal/generate</span>
        </div>

        {/* 语言切换器与复制 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-scrim p-1 rounded-lg border border-line-subtle text-xs font-mono">
            {['curl', 'python', 'node'].map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`px-2.5 py-1 rounded transition-all ${
                  activeLang === lang
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {lang === 'curl' ? 'cURL' : lang === 'python' ? 'Python' : 'Node.js'}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink px-2 py-1 rounded bg-wash border border-line-subtle transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
        </div>
      </div>

      {/* 终端代码体 */}
      <div className="p-6 font-mono text-xs leading-relaxed overflow-x-auto bg-canvas">
        <pre className="text-ink">
          <code>{codeSnippets[activeLang]}</code>
        </pre>
      </div>

      {/* 实时响应指示条 */}
      <div className="px-6 py-2.5 border-t border-line-subtle bg-scrim flex items-center justify-between text-[11px] font-mono text-ink-subtle">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span className="text-ink-muted">Response: 200 OK (142ms)</span>
        </div>
        <span className="text-ink-subtle">Streaming: Supported</span>
      </div>
    </div>
  );
}
