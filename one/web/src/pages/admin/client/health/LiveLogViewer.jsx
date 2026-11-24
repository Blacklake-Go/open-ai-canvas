"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Card } from "@/components/admin/AdminUi";
import { apiRequest } from "@/services/api/http";

const messages = {
  en: ["Runtime logs", "Current ONE process", "Output", "Errors", "Refresh", "Loading…", "No log entries yet.", "Runtime log collection is unavailable.", "Could not load runtime logs."],
  "zh-CN": ["服务端运行日志", "当前 ONE 进程", "标准输出", "异常", "刷新", "加载中…", "当前暂无日志。", "运行日志采集不可用。", "加载运行日志失败。"],
  "zh-TW": ["伺服器執行日誌", "目前的 ONE 程序", "標準輸出", "錯誤", "重新整理", "載入中…", "目前沒有日誌。", "執行日誌收集無法使用。", "無法載入執行日誌。"],
  "ja-JP": ["ランタイムログ", "現在の ONE プロセス", "出力", "エラー", "更新", "読み込み中…", "ログはまだありません。", "ランタイムログを収集できません。", "ランタイムログを読み込めませんでした。"],
  "ko-KR": ["런타임 로그", "현재 ONE 프로세스", "출력", "오류", "새로고침", "불러오는 중…", "아직 로그가 없습니다.", "런타임 로그를 수집할 수 없습니다.", "런타임 로그를 불러오지 못했습니다."],
  es: ["Registros de ejecución", "Proceso actual de ONE", "Salida", "Errores", "Actualizar", "Cargando…", "Todavía no hay registros.", "La recopilación de registros no está disponible.", "No se pudieron cargar los registros."],
};

export default function LiveLogViewer() {
  const locale = useLocale();
  const [title, source, output, errors, refresh, loading, empty, missing, failed] =
    messages[locale === "es-ES" ? "es" : locale] || messages.en;
  const [type, setType] = useState("out");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest(`/api/admin/system/logs?type=${type}`, {
      contract: "admin",
      cache: "no-store",
      signal: controller.signal,
    }).then(data => {
      if (!controller.signal.aborted) setResult({ type, revision, data });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ type, revision, error: true });
    });
    return () => controller.abort();
  }, [type, revision]);

  const current = result?.type === type && result.revision === revision ? result : null;
  const content = !current ? loading : current.error ? failed :
    current.data?.missing ? missing : current.data?.lines || empty;
  return (
    <Card className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle pb-4">
        <div>
          <h2 className="text-body-sm font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-caption text-ink-muted">{source}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-wash text-caption">
            {[["out", output], ["error", errors]].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)}
                className={`control-focus min-h-11 rounded-lg px-3 font-medium hover:bg-wash-strong ${type === value ? "bg-wash-strong text-ink" : "text-ink-muted"}`}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" disabled={!current} onClick={() => setRevision(value => value + 1)}
            className="control-focus min-h-11 rounded-lg border border-line px-3 text-caption text-ink hover:bg-wash disabled:opacity-50">
            {refresh}
          </button>
        </div>
      </div>
      <pre data-runtime-log={type} role={current?.error ? "alert" : "status"} aria-busy={!current}
        className="scrollbar-subtle max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-line-subtle bg-surface p-4 font-mono text-caption text-ink">
        {content}
      </pre>
    </Card>
  );
}
