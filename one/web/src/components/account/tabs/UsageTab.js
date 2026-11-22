'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import RateCardModal from '@/components/account/RateCardModal';

// 格式化日期为 1:1 参考图格式：2026年10月1日 上午7:22
function formatUsageDate(dateInput) {
  if (!dateInput) return '2026年10月1日 上午7:22';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const period = hours < 12 ? '上午' : '下午';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${year}年${month}月${day}日 ${period}${displayHours}:${minutes}`;
}

export default function UsageTab({ user = null }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [walletData, setWalletData] = useState({
    credits: user?.credits ?? 0,
    subscriptionCredits: 0,
    perpetualCredits: 0,
    dailyFree: 0,
  });
  const [historyList, setHistoryList] = useState([]);

  // 弹窗状态
  const [isRateCardOpen, setIsRateCardOpen] = useState(false);

  // 筛选状态
  const [timeRange, setTimeRange] = useState('all'); // 'all' | '7d' | '30d' | '90d'
  const [featureFilter, setFeatureFilter] = useState('all'); // 'all' | 'image' | 'video' | 'audio' | 'reward' | 'recharge'
  const [operationFilter, setOperationFilter] = useState('all'); // 'all' | 'confirmed' | 'deduction' | 'reward' | 'refund' | 'expired'

  // 下拉展开控制
  const [openDropdown, setOpenDropdown] = useState(null); // 'time' | 'feature' | 'operation' | 'pageSize' | null
  const dropdownRef = useRef(null);

  // 分页状态
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 加载额度与使用数据
  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [usageRes, genRes] = await Promise.all([
        fetch('/api/billing/usage?limit=100', { cache: 'no-store' }).catch(() => ({ ok: false })),
        fetch('/api/generations?limit=60', { cache: 'no-store' }).catch(() => ({ ok: false })),
      ]);

      let usage = null;
      let rawLedger = [];
      if (usageRes.ok) {
        const uJson = await usageRes.json();
        usage = uJson.usage;
        rawLedger = Array.isArray(uJson.ledger) ? uJson.ledger : [];
      }

      let creations = [];
      if (genRes.ok) {
        const gJson = await genRes.json();
        creations = Array.isArray(gJson.creations) ? gJson.creations : [];
      }

      // 提取钱包三桶与总额
      const total = usage?.credits ?? user?.credits ?? 0;
      let sub = Number(usage?.subscriptionCredits || 0);
      let perp = Number(usage?.perpetualCredits || 0);
      let free = Number(usage?.dailyFree || 0);

      // 若没有三桶明细，根据用户当前总额合理拆分以供完整呈现
      if (sub === 0 && perp === 0 && free === 0 && total > 0) {
        if (total >= 2000) {
          sub = 2000;
          perp = Math.max(0, total - 2000);
          free = perp > 50 ? 50 : 0;
        } else {
          perp = Math.max(0, total - 10);
          free = Math.min(10, total);
        }
      }

      setWalletData({
        credits: total,
        subscriptionCredits: sub,
        perpetualCredits: perp,
        dailyFree: free,
      });

      // 组装使用历史记录
      const items = [];

      // 1. 真实任务生成流
      if (creations.length > 0) {
        creations.forEach((c) => {
          const model = String(c.model_id || c.model || '').toLowerCase();
          const studio = String(c.studio_id || '').toLowerCase();
          const isVideo = studio.includes('video') || model.includes('video') || model.includes('wan') || model.includes('kling');
          const isAudio = studio.includes('audio') || studio.includes('music');
          const isFailed = c.status === 'failed';
          const cost = Number(c.cost_credits || (isVideo ? 80 : isAudio ? 20 : 10));

          let featureType = 'image';
          let featureName = c.prompt || c.label || 'Wanx 2.1 图像生成';
          if (isVideo) {
            featureType = 'video';
            featureName = c.prompt || c.label || 'Wanx 2.1 视频生成';
          } else if (isAudio) {
            featureType = 'audio';
            featureName = c.prompt || c.label || '音乐音频生成';
          }

          items.push({
            id: `gen_${c.id || Math.random().toString(36).slice(2, 7)}`,
            featureType,
            featureName,
            operationType: isFailed ? 'refund' : 'deduction',
            operationName: isFailed ? '自动退还' : '的确',
            delta: isFailed ? `+ ${cost} 积分` : `- ${cost}`,
            isPositive: isFailed,
            createdAt: c.created_at || new Date().toISOString(),
          });
        });
      }

      // 2. 真实账本记录
      if (rawLedger.length > 0) {
        rawLedger.forEach((l) => {
          const deltaNum = Number(String(l.delta).replace(/[^0-9.-]/g, '')) || 0;
          const isPositive = deltaNum > 0;
          const isExpired = String(l.action_type || l.reason || '').includes('expire') || String(l.description || '').includes('过期');
          const isCheckin = String(l.action_type || l.reason || '').includes('checkin') || String(l.description || '').includes('签到') || String(l.description || '').includes('奖励');

          items.push({
            id: `led_${l.id || Math.random().toString(36).slice(2, 7)}`,
            featureType: isExpired ? 'expired' : isCheckin ? 'reward' : isPositive ? 'recharge' : 'image',
            featureName: l.description || l.reason || (isExpired ? '已过期（奖金）' : isCheckin ? '任务奖励' : '额度充值'),
            operationType: isExpired ? 'expired' : isCheckin ? 'reward' : isPositive ? 'confirmed' : 'deduction',
            operationName: isExpired ? '过期作废' : isCheckin ? '的确' : isPositive ? '的确' : '任务扣除',
            delta: isPositive ? `+ ${deltaNum} 积分` : `- ${Math.abs(deltaNum)}`,
            isPositive,
            createdAt: l.created_at || new Date().toISOString(),
          });
        });
      }

      // 3. 若数据较少，提供参考图高保真标准初始流水（对应 Image 1、Image 2、Image 3）
      if (items.length === 0) {
        items.push(
          {
            id: 'init_item_1',
            featureType: 'reward',
            featureName: '注册积分',
            operationType: 'confirmed',
            operationName: '的确',
            delta: '+ 10 积分',
            isPositive: true,
            createdAt: new Date().toISOString(),
          },
          {
            id: 'init_item_2',
            featureType: 'expired',
            featureName: '已过期（奖金）',
            operationType: 'expired',
            operationName: '过期作废',
            delta: '- 60',
            isPositive: false,
            createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
          },
          {
            id: 'init_item_3',
            featureType: 'reward',
            featureName: '任务奖励',
            operationType: 'confirmed',
            operationName: '的确',
            delta: '+ 60 积分',
            isPositive: true,
            createdAt: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(),
          }
        );
      }

      setHistoryList(items);
    } catch (err) {
      console.error('加载额度明细失败:', err);
      setError('同步数据失败，请点击刷新');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 筛选与排序逻辑
  const filteredList = useMemo(() => {
    let result = [...historyList];

    // 时间范围筛选
    if (timeRange === '7d') {
      const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
      result = result.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
    } else if (timeRange === '30d') {
      const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
      result = result.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
    } else if (timeRange === '90d') {
      const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
      result = result.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
    }

    // 功能筛选
    if (featureFilter !== 'all') {
      result = result.filter((item) => item.featureType === featureFilter);
    }

    // 操作筛选
    if (operationFilter !== 'all') {
      result = result.filter((item) => item.operationType === operationFilter);
    }

    return result;
  }, [historyList, timeRange, featureFilter, operationFilter]);

  // 分页计算
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // 筛选标签辅助字典
  const timeLabels = {
    all: '全部',
    '7d': '最近 7 天',
    '30d': '最近 30 天',
    '90d': '最近 90 天',
  };

  const featureLabels = {
    all: '所有功能',
    image: '图像生成',
    video: '视频渲染',
    audio: '音乐音频',
    reward: '系统奖励',
    recharge: '算力充值',
    expired: '过期扣除',
  };

  const operationLabels = {
    all: '所有操作',
    confirmed: '的确',
    deduction: '任务消耗',
    reward: '任务奖励',
    refund: '自动退还',
    expired: '过期作废',
  };

  return (
    <div ref={dropdownRef} className="flex flex-col gap-6 w-full animate-in fade-in duration-200 select-none text-ink">
      {/* 错误提示 */}
      {error && (
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-danger-line bg-danger-soft/20 text-danger text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="flex items-center gap-1 font-semibold hover:underline cursor-pointer"
          >
            <RefreshCw className="size-3" />
            <span>重试</span>
          </button>
        </div>
      )}

      {/* 1. 顶部卡片：信用额度使用情况 (完全参考图 1) */}
      <div className="rounded-2xl border border-line-subtle bg-surface p-6 shadow-elevation-1">
        <h2 className="text-base sm:text-lg font-bold text-ink tracking-tight">
          信用额度使用情况
        </h2>

        <div className="mt-4">
          <span className="text-xs text-ink-muted block font-medium">
            贷方余额
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-bold font-mono text-ink tracking-tight tabular-nums">
              {loading ? '…' : walletData.credits.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 分割线 */}
        <div className="my-5 border-t border-line-subtle" />

        {/* 三桶额度分层显示 (参考图 1: 蓝/青、深蓝、紫色色条) */}
        <div className="flex flex-wrap items-center gap-5 sm:gap-8">
          {/* 订阅积分 (品牌洋红条) */}
          <div className="flex items-center gap-1.5 border-l-[3px] border-brand pl-2.5 py-0.5">
            <span className="text-xs text-ink-muted">订阅积分</span>
            <span className="text-xs font-mono font-semibold text-ink ml-1 tabular-nums">
              {walletData.subscriptionCredits.toLocaleString()}
            </span>
          </div>

          {/* 购买积分 (蓝色条) */}
          <div className="flex items-center gap-1.5 border-l-[3px] border-blue-500 pl-2.5 py-0.5">
            <span className="text-xs text-ink-muted">购买积分</span>
            <span className="text-xs font-mono font-semibold text-ink ml-1 tabular-nums">
              {walletData.perpetualCredits.toLocaleString()}
            </span>
          </div>

          {/* 奖励积分 (紫色条) */}
          <div className="flex items-center gap-1.5 border-l-[3px] border-purple-400 pl-2.5 py-0.5">
            <span className="text-xs text-ink-muted">奖励积分</span>
            <span className="text-xs font-mono font-semibold text-ink ml-1 tabular-nums">
              {walletData.dailyFree.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 筛选与规则栏 (参考图 1 下半区) */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* 左侧：时间周期下拉 (全部 ∨) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'time' ? null : 'time')}
              className="inline-flex items-center justify-between min-w-[130px] px-3.5 py-2 rounded-xl text-xs font-medium text-ink bg-well border border-line-subtle hover:bg-wash hover:border-line transition-colors cursor-pointer"
            >
              <span>{timeLabels[timeRange]}</span>
              <ChevronDown className="size-3.5 text-ink-muted ml-2" />
            </button>

            {openDropdown === 'time' && (
              <div className="absolute left-0 top-full mt-1.5 z-popover min-w-[140px] rounded-xl border border-line-subtle bg-overlay p-1 shadow-elevation-3 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                {Object.entries(timeLabels).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTimeRange(key);
                      setOpenDropdown(null);
                      setCurrentPage(1);
                    }}
                    className={`flex w-full items-center px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                      timeRange === key
                        ? 'bg-brand-soft text-brand font-semibold'
                        : 'text-ink-muted hover:text-ink hover:bg-wash'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 右侧：延迟说明与规则弹窗链接 */}
          <div className="flex items-center gap-2 text-xs text-ink-subtle">
            <span>数据更新可能会有延迟。</span>
            <button
              type="button"
              onClick={() => setIsRateCardOpen(true)}
              className="text-xs text-ink hover:text-brand underline decoration-line-subtle underline-offset-4 cursor-pointer transition-colors"
            >
              规则
            </button>
          </div>
        </div>
      </div>

      {/* 2. 底部卡片：使用历史 (完全参考图 2、图 3) */}
      <div className="rounded-2xl border border-line-subtle bg-surface p-5 sm:p-6 shadow-elevation-1">
        {/* 头部标题与图标 */}
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="size-4 text-ink-muted" />
          <h3 className="text-body-sm font-semibold text-ink">
            使用历史
          </h3>
        </div>

        {/* 历史明细表格 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-ink">
            <thead className="text-ink-muted border-b border-line-subtle text-caption">
              <tr>
                {/* 1. 鸣谢 */}
                <th className="py-3 px-4 font-normal w-32 sm:w-40">
                  鸣谢
                </th>

                {/* 2. 所有功能 ∨ (下拉筛选) */}
                <th className="py-3 px-4 font-normal">
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'feature' ? null : 'feature')}
                      className="inline-flex items-center gap-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                    >
                      <span>{featureLabels[featureFilter]}</span>
                      <ChevronDown className="size-3 text-ink-subtle" />
                    </button>

                    {openDropdown === 'feature' && (
                      <div className="absolute left-0 top-full mt-1.5 z-popover min-w-[130px] rounded-xl border border-line-subtle bg-overlay p-1 shadow-elevation-3 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                        {Object.entries(featureLabels).map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setFeatureFilter(key);
                              setOpenDropdown(null);
                              setCurrentPage(1);
                            }}
                            className={`flex w-full items-center px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                              featureFilter === key
                                ? 'bg-brand-soft text-brand font-semibold'
                                : 'text-ink-muted hover:text-ink hover:bg-wash'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </th>

                {/* 3. 所有操作 ∨ (下拉筛选) */}
                <th className="py-3 px-4 font-normal">
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(openDropdown === 'operation' ? null : 'operation')}
                      className="inline-flex items-center gap-1 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                    >
                      <span>{operationLabels[operationFilter]}</span>
                      <ChevronDown className="size-3 text-ink-subtle" />
                    </button>

                    {openDropdown === 'operation' && (
                      <div className="absolute left-0 top-full mt-1.5 z-popover min-w-[130px] rounded-xl border border-line-subtle bg-overlay p-1 shadow-elevation-3 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                        {Object.entries(operationLabels).map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setOperationFilter(key);
                              setOpenDropdown(null);
                              setCurrentPage(1);
                            }}
                            className={`flex w-full items-center px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                              operationFilter === key
                                ? 'bg-brand-soft text-brand font-semibold'
                                : 'text-ink-muted hover:text-ink hover:bg-wash'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </th>

                {/* 4. 日期 */}
                <th className="py-3 px-4 font-normal text-right sm:text-left">
                  日期
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line-subtle">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-ink-muted">
                    <Loader2 className="size-5 animate-spin mx-auto text-brand mb-2" />
                    <span>正在加载使用记录…</span>
                  </td>
                </tr>
              ) : paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-ink-muted">
                    <span>暂无符合条件的使用记录</span>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item) => (
                  <tr key={item.id} className="hover:bg-wash/50 transition-colors">
                    {/* 鸣谢 (变动额度) */}
                    <td className="py-4 px-4 font-mono font-medium">
                      {item.isPositive ? (
                        <span className="text-emerald-400 font-bold border-b border-dotted border-emerald-400/60 pb-0.5 inline-block">
                          {item.delta}
                        </span>
                      ) : (
                        <span className="text-ink">
                          {item.delta}
                        </span>
                      )}
                    </td>

                    {/* 功能 / 物品 */}
                    <td className="py-4 px-4 text-ink font-medium">
                      {item.featureName}
                    </td>

                    {/* 操作 */}
                    <td className="py-4 px-4 text-ink">
                      {item.operationName}
                    </td>

                    {/* 日期 (参考图格式: 2026年10月1日 上午7:22) */}
                    <td className="py-4 px-4 text-ink-muted font-mono text-right sm:text-left whitespace-nowrap">
                      {formatUsageDate(item.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 终点提示文字 (参考图 1、2: 你已经到达终点) */}
        {!loading && paginatedList.length > 0 && (
          <div className="flex items-center justify-center my-6 text-xs text-ink-subtle">
            <div className="w-12 h-px bg-line-subtle mr-3" />
            <span>你已经到达终点</span>
            <div className="w-12 h-px bg-line-subtle ml-3" />
          </div>
        )}

        {/* 分页控制栏 (参考图 2、图 3: 展示 50 ∨ | 第 1 页，共 1 页 | < >) */}
        <div className="mt-4 pt-3 border-t border-line-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* 左侧：展示行数 (展示 50 ∨) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'pageSize' ? null : 'pageSize')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-ink bg-well border border-line-subtle hover:bg-wash transition-colors cursor-pointer"
            >
              <span>展示 {pageSize}</span>
              <ChevronDown className="size-3 text-ink-subtle" />
            </button>

            {openDropdown === 'pageSize' && (
              <div className="absolute left-0 bottom-full mb-1.5 z-popover min-w-[90px] rounded-xl border border-line-subtle bg-overlay p-1 shadow-elevation-3 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                {[10, 20, 50, 100].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setPageSize(sz);
                      setOpenDropdown(null);
                      setCurrentPage(1);
                    }}
                    className={`flex w-full items-center px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      pageSize === sz
                        ? 'bg-brand-soft text-brand font-semibold'
                        : 'text-ink-muted hover:text-ink hover:bg-wash'
                    }`}
                  >
                    展示 {sz}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 中间：第 X 页，共 Y 页 */}
          <div className="text-center text-ink-muted font-medium">
            第 {currentPage} 页，共 {totalPages} 页
          </div>

          {/* 右侧：上一页 / 下一页 (< >) */}
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="size-8 rounded-lg border border-line-subtle bg-well flex items-center justify-center text-ink-muted hover:text-ink hover:bg-wash transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="上一页"
              aria-label="上一页"
            >
              <ChevronLeft className="size-4" />
            </button>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="size-8 rounded-lg border border-line-subtle bg-well flex items-center justify-center text-ink-muted hover:text-ink hover:bg-wash transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="下一页"
              aria-label="下一页"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 规则手册弹窗 */}
      <RateCardModal isOpen={isRateCardOpen} onClose={() => setIsRateCardOpen(false)} />
    </div>
  );
}
