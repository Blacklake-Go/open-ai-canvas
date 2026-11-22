'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const EMPTY_KPI = Object.freeze({
  totalCalls: 0,
  successCalls: 0,
  failedCalls: 0,
  successRate: 0,
  avgDurationMs: 0,
  p50DurationMs: 0,
  p90DurationMs: 0,
  activeModelsCount: 0,
});

export function useModelDirectory({ enabled = true, range = '24h' } = {}) {
  const [models, setModels] = useState([]);
  const [telemetry, setTelemetry] = useState({ range, kpi: EMPTY_KPI, models: [] });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError('');
    try {
      const [modelsResponse, telemetryResponse] = await Promise.all([
        fetch('/api/models/active', { cache: 'no-store' }),
        fetch(`/api/models/telemetry?range=${encodeURIComponent(range)}`, { cache: 'no-store' }),
      ]);
      const modelsPayload = await modelsResponse.json().catch(() => ({}));
      const telemetryPayload = await telemetryResponse.json().catch(() => ({}));

      if (!modelsResponse.ok) {
        throw new Error(modelsPayload.error || '模型目录加载失败');
      }
      if (!telemetryResponse.ok) {
        throw new Error(telemetryPayload.error || '模型遥测加载失败');
      }

      setModels(Array.isArray(modelsPayload.models) ? modelsPayload.models : []);
      setTelemetry({
        range: telemetryPayload.range || range,
        kpi: { ...EMPTY_KPI, ...(telemetryPayload.kpi || {}) },
        models: Array.isArray(telemetryPayload.models) ? telemetryPayload.models : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '模型数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [enabled, range]);

  useEffect(() => {
    reload();
  }, [reload]);

  const telemetryById = useMemo(() => {
    const map = new Map();
    for (const item of telemetry.models) {
      map.set(String(item.id), item);
    }
    return map;
  }, [telemetry.models]);

  return { models, telemetry, telemetryById, loading, error, reload };
}
