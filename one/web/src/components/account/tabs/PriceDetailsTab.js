'use client';

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PriceDetailsTab() {
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [models, setModels] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/models/active')
      .then((response) => (response.ok ? response.json() : { models: [] }))
      .then((data) => {
        if (!cancelled) setModels(Array.isArray(data.models) ? data.models : []);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const modelRows = (types) => models
    .filter((model) => types.includes(String(model.type || '').toLowerCase()))
    .map((model) => ({
      model: model.name || model.id,
      price: `${Number(model.creditsPrice || 0)} 积分起（实际费用以生成参数报价为准）`,
    }));

  const textRows = modelRows(['text']);

  const priceCategories = [
    {
      id: 'dialogue',
      classification: '对话与语言',
      description: '(Agent 对话、剧本创作与多模态理解)',
      rows: textRows.length > 0
        ? textRows
        : [{ model: 'Agent 创意对话模型', price: '以实际模型报价为准' }],
      note: '按 Token 或单次调用计费，会员权益与防刷规则以当前订阅配置为准',
    },
    {
      id: 'image-generation',
      classification: '图片生成',
      note: '当前活动模型目录；分辨率与批量张数影响结算积分',
      rows: modelRows(['image', 'image_edit']),
    },
    {
      id: 'video-generation',
      classification: '视频生成',
      note: '当前活动模型目录；时长、分辨率和关键帧影响报价',
      rows: modelRows(['video', 'video_image', 'video_text']),
    },
    {
      id: 'audio-generation',
      classification: '音频与音乐',
      note: '当前活动模型目录；语音合成、音乐创作与人声克隆',
      rows: modelRows(['audio']),
    },
  ].filter((category) => category.rows.length > 0);

  const headerClass = 'border-b border-line-subtle px-4 py-3 text-caption font-semibold text-ink-muted bg-well text-start';
  const cellClass = (isFirst) => `border-b border-line-subtle px-4 py-3 text-body-sm text-ink-muted ${isFirst ? 'border-t-0' : ''}`;

  const displayedCategories = priceCategories.filter(
    (c) => selectedCategory === 'all' || c.id === selectedCategory
  );

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 标题与分类过滤胶囊 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-page-title text-ink">模型价格</h1>
          <p className="mt-1 text-body-subtle text-ink-muted">当前各模型基础资费与算力消耗标准。</p>
        </div>
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="self-start sm:self-auto">
          <TabsList className="overflow-x-auto">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="dialogue">对话与语言</TabsTrigger>
            <TabsTrigger value="image-generation">图片生成</TabsTrigger>
            <TabsTrigger value="video-generation">视频生成</TabsTrigger>
            <TabsTrigger value="audio-generation">音频与音乐</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 桌面端高保真表格 */}
      <div className="w-full rounded-xl overflow-hidden border border-line-subtle bg-surface shadow-elevation-1">
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse table-fixed">
            <colgroup>
              <col className="w-[17%]" />
              <col className="w-[27%]" />
              <col className="w-[38%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead>
              <tr>
                <th className={headerClass}>分类</th>
                <th className={headerClass}>模型</th>
                <th className={headerClass}>价格</th>
                <th className={headerClass}>备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-body-sm text-ink-muted">正在读取当前模型价盘…</td>
                </tr>
              ) : displayedCategories.map((category) =>
                category.rows.map((row, rowIndex) => (
                  <tr
                    key={`${category.id}-${rowIndex}`}
                    className="hover:bg-wash transition-colors"
                  >
                    {/* 分类列 (首行跨行合并) */}
                    {rowIndex === 0 && (
                      <td
                        className={`${cellClass(true)} align-top font-semibold bg-wash-subtle/50`}
                        rowSpan={category.rows.length}
                      >
                        <div className="text-body-sm text-ink font-semibold">
                          {category.classification}
                        </div>
                        {category.description && (
                          <div className="text-caption text-ink-muted mt-1 font-normal">
                            {category.description}
                          </div>
                        )}
                      </td>
                    )}

                    {/* 模型列 */}
                    <td className={`${cellClass(rowIndex === 0)} font-medium text-ink text-body-sm`}>
                      {row.model}
                    </td>

                    {/* 价格列 */}
                    <td className={`${cellClass(rowIndex === 0)} leading-relaxed text-ink-muted text-caption`}>
                      <div className="whitespace-normal break-words">{row.price}</div>
                    </td>

                    {/* 备注列 (首行跨行合并) */}
                    {rowIndex === 0 && (
                      <td
                        className={`${cellClass(true)} align-top text-ink-subtle bg-wash-subtle/30 text-caption leading-relaxed`}
                        rowSpan={category.rows.length}
                      >
                        {category.note || '-'}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
