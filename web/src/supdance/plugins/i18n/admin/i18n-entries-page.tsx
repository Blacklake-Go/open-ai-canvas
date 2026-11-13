import { interfaceText } from "@/i18n/interface-text";
import { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Input } from "antd";
import type { ColumnsType } from "antd/es/table";
import { saveAs } from "file-saver";
import { Download, Edit3, Plus, Radar, RotateCcw, Search, Settings2, Trash2, Upload } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";

import { Select } from "@/components/ui/base/select";
import { AdminPageFrame } from "@/pages/admin/components/admin-shell";
import { AdminDataTable, AdminFilterChip, AdminStatTile, AdminStatusBadge, AdminTableEmpty, PaginationBar } from "@/pages/admin/components/admin-ui";
import { AdminDrawer, AdminModal } from "@/pages/admin/ui/overlays";
import { deleteAdminSupDanceI18nEntry, exportAdminSupDanceI18n, getPublicSupDanceI18nBundle, importAdminSupDanceI18n, listAdminSupDanceI18nEntries, upsertAdminSupDanceI18nEntries } from "../api";
import { DEFAULT_SUPDANCE_LANGUAGES, NAMESPACE_LABELS, SUPPORTED_LOCALE_CODES } from "../locales";
import { useI18n, useSupDanceI18nStore } from "../store";
import { TranslationWorkflowPanel } from "./translation-workflow";
import { SUPDANCE_I18N_PLUGIN_ID, type SupDanceDiscoveredTextItem, type SupDanceI18nEntry, type SupDanceLocaleCode } from "../types";

const EMPTY_TRANSLATIONS: Record<SupDanceLocaleCode, string> = {
    "fr-FR": "",
    "de-DE": "",
    "zh-CN": "",
    "en-US": "",
    "zh-TW": "",
    "ja-JP": "",
    "ko-KR": "",
    "es-ES": "",
};

function createEmptyEntryDraft(): SupDanceI18nEntry {
    return {
        key: "",
        namespace: "custom",
        sourceText: "",
        description: "",
        translations: { ...EMPTY_TRANSLATIONS },
        origin: "custom",
    };
}

function inferNamespaceFromRoute(route: string): string {
    const clean = route.toLowerCase();
    if (clean.startsWith("/canvas")) return "canvas";
    if (clean.startsWith("/projects")) return "projects";
    if (clean.startsWith("/create")) return "create";
    if (clean.startsWith("/assets")) return "assets";
    if (clean.startsWith("/skills")) return "skills";
    if (clean.startsWith("/plugins")) return "plugins";
    if (clean.startsWith("/settings")) return "settings";
    if (clean.startsWith("/login") || clean.startsWith("/register") || clean.startsWith("/auth")) return "auth";
    if (clean.startsWith("/admin")) return "admin";
    return "custom";
}

function buildSuggestedKeyFromText(namespace: string, sourceText: string): string {
    let hash = 0;
    for (let i = 0; i < sourceText.length; i++) {
        hash = (hash * 31 + sourceText.charCodeAt(i)) >>> 0;
    }
    return `${namespace}.auto_${hash.toString(36).slice(0, 8)}`;
}

export function SupDanceI18nEntriesPage() {
    const { t } = useI18n();
    const [workflowOpen, setWorkflowOpen] = useState(false);
    const { message, modal } = App.useApp();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const storeEntries = useSupDanceI18nStore((s) => s.entries);
    const storeSettings = useSupDanceI18nStore((s) => s.settings);
    const discoveredUntranslated = useSupDanceI18nStore((s) => s.discoveredUntranslated);
    const clearDiscoveredUntranslated = useSupDanceI18nStore((s) => s.clearDiscoveredUntranslated);

    const [keyword, setKeyword] = useState(() => searchParams.get("keyword") ?? "");
    const [namespace, setNamespace] = useState(() => searchParams.get("namespace") ?? "all");
    const [origin, setOrigin] = useState(() => searchParams.get("origin") ?? "all");
    const [missingLocale, setMissingLocale] = useState(() => searchParams.get("missingLocale") ?? "all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const [loading, setLoading] = useState(false);
    const [serverConnected, setServerConnected] = useState<boolean | null>(null);
    const [remoteItems, setRemoteItems] = useState<SupDanceI18nEntry[] | null>(null);
    const [remoteTotal, setRemoteTotal] = useState<number | null>(null);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [isCreateMode, setIsCreateMode] = useState(false);
    const [editingEntry, setEditingEntry] = useState<SupDanceI18nEntry>(createEmptyEntryDraft);
    const [savingEntry, setSavingEntry] = useState(false);

    const [discoveredDrawerOpen, setDiscoveredDrawerOpen] = useState(false);

    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importJsonText, setImportJsonText] = useState("");
    const [importing, setImporting] = useState(false);

    const fetchRemoteEntries = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listAdminSupDanceI18nEntries({
                keyword: keyword.trim() || undefined,
                namespace: namespace !== "all" ? namespace : undefined,
                origin: origin !== "all" ? origin : undefined,
                missingLocale: missingLocale !== "all" ? missingLocale : undefined,
                page,
                pageSize,
            });
            setServerConnected(true);
            setRemoteItems(res.items);
            setRemoteTotal(res.total);
        } catch {
            setServerConnected(false);
            setRemoteItems(null);
            setRemoteTotal(null);
        } finally {
            setLoading(false);
        }
    }, [keyword, missingLocale, namespace, origin, page, pageSize]);

    useEffect(() => {
        void fetchRemoteEntries();
    }, [fetchRemoteEntries]);

    const filteredLocalEntries = useMemo(() => {
        const kw = keyword.trim().toLowerCase();
        return storeEntries.filter((entry) => {
            if (namespace !== "all" && entry.namespace !== namespace) return false;
            if (origin !== "all" && entry.origin !== origin) return false;
            if (missingLocale !== "all") {
                const targetVal = entry.translations[missingLocale as SupDanceLocaleCode];
                if (targetVal && targetVal.trim() !== "") return false;
            }
            if (kw) {
                const hitKey = entry.key.toLowerCase().includes(kw);
                const hitSource = entry.sourceText.toLowerCase().includes(kw);
                const hitDesc = (entry.description ?? "").toLowerCase().includes(kw);
                const hitTrans = SUPPORTED_LOCALE_CODES.some((code) => (entry.translations[code] ?? "").toLowerCase().includes(kw));
                if (!hitKey && !hitSource && !hitDesc && !hitTrans) return false;
            }
            return true;
        });
    }, [keyword, missingLocale, namespace, origin, storeEntries]);

    const displayItems = useMemo(() => {
        if (remoteItems !== null) return remoteItems;
        const start = (page - 1) * pageSize;
        return filteredLocalEntries.slice(start, start + pageSize);
    }, [filteredLocalEntries, page, pageSize, remoteItems]);

    const displayTotal = remoteTotal ?? filteredLocalEntries.length;

    const summaryStats = useMemo(() => {
        const total = storeEntries.length;
        let builtin = 0;
        let modified = 0;
        let custom = 0;
        for (const item of storeEntries) {
            if (item.origin === "modified") modified += 1;
            else if (item.origin === "custom") custom += 1;
            else builtin += 1;
        }
        return { total, builtin, modified, custom };
    }, [storeEntries]);

    const namespaceOptions = useMemo(() => {
        const counts = new Map<string, number>();
        for (const item of storeEntries) {
            counts.set(item.namespace, (counts.get(item.namespace) ?? 0) + 1);
        }
        return [
            { value: "all", label: interfaceText("全部模块 ({value1})", { value1: storeEntries.length }) },
            ...Object.entries(NAMESPACE_LABELS).map(([ns, label]) => ({
                value: ns,
                label: `${interfaceText(label)} (${counts.get(ns) ?? 0})`,
            })),
        ];
    }, [storeEntries]);

    const openCreateDrawer = () => {
        setIsCreateMode(true);
        setEditingEntry(createEmptyEntryDraft());
        setDrawerOpen(true);
    };

    const openCreateFromDiscovered = (item: SupDanceDiscoveredTextItem) => {
        const inferredNamespace = inferNamespaceFromRoute(item.route);
        const suggestedKey = buildSuggestedKeyFromText(inferredNamespace, item.sourceText);
        setIsCreateMode(true);
        setEditingEntry({
            key: suggestedKey,
            namespace: inferredNamespace,
            sourceText: item.sourceText,
            description: interfaceText("自动嗅探自页面 {value1}", { value1: item.route }),
            translations: {
                ...EMPTY_TRANSLATIONS,
                "zh-CN": item.sourceText,
            },
            origin: "custom",
        });
        setDiscoveredDrawerOpen(false);
        setDrawerOpen(true);
    };

    const openEditDrawer = (record: SupDanceI18nEntry) => {
        setIsCreateMode(false);
        setEditingEntry({
            ...record,
            translations: {
                ...record.translations,
                "zh-CN": record.translations["zh-CN"] ?? record.sourceText ?? "",
                "en-US": record.translations["en-US"] ?? "",
                "zh-TW": record.translations["zh-TW"] ?? "",
                "ja-JP": record.translations["ja-JP"] ?? "",
                "ko-KR": record.translations["ko-KR"] ?? "",
                "es-ES": record.translations["es-ES"] ?? "",
            },
        });
        setDrawerOpen(true);
    };

    const refreshPublished = async () => {
        const bundle = await getPublicSupDanceI18nBundle();
        useSupDanceI18nStore.getState().applyBundle(bundle);
        setServerConnected(true);
        await fetchRemoteEntries();
    };

    const handleSaveEntry = async () => {
        const cleanKey = editingEntry.key.trim();
        const zhText = editingEntry.translations["zh-CN"]?.trim() || editingEntry.sourceText.trim();
        if (!cleanKey || !zhText) {
            message.warning(interfaceText("请填写词条 Key 和简体中文基准内容"));
            return;
        }
        const normalizedEntry: SupDanceI18nEntry = {
            ...editingEntry,
            key: cleanKey,
            namespace: editingEntry.namespace || cleanKey.split(".")[0] || "custom",
            sourceText: editingEntry.sourceText.trim() || zhText,
            translations: { ...editingEntry.translations, ...Object.fromEntries(SUPPORTED_LOCALE_CODES.map((code) => [code, code === "zh-CN" ? zhText : (editingEntry.translations[code]?.trim() ?? "")])) },
        };
        setSavingEntry(true);
        try {
            await upsertAdminSupDanceI18nEntries([normalizedEntry]);
            await refreshPublished();
            setDrawerOpen(false);
            message.success(interfaceText("翻译已保存并应用"));
        } catch (err) {
            setServerConnected(false);
            message.error(err instanceof Error ? err.message : interfaceText("保存或同步失败，请保留草稿并重试"));
        } finally {
            setSavingEntry(false);
        }
    };

    const handleResetOrDelete = (record: SupDanceI18nEntry) => {
        modal.confirm({
            title: interfaceText("删除或恢复翻译覆盖"),
            content: interfaceText("确定删除词条「{key}」的覆盖？内置词条将恢复默认译文。", { key: record.key }),
            okText: interfaceText("确认"),
            cancelText: interfaceText("取消"),
            okButtonProps: { danger: record.origin === "custom" },
            onOk: async () => {
                try {
                    await deleteAdminSupDanceI18nEntry(record.key);
                    await refreshPublished();
                    message.success(interfaceText("已恢复或删除服务器上的翻译覆盖"));
                } catch (err) {
                    setServerConnected(false);
                    message.error(err instanceof Error ? err.message : interfaceText("操作或同步失败，请重试"));
                    throw err;
                }
            },
        });
    };

    const handleExportJson = async () => {
        try {
            let payload;
            try {
                payload = await exportAdminSupDanceI18n();
            } catch {
                payload = {
                    pluginId: SUPDANCE_I18N_PLUGIN_ID,
                    version: "1.3.0",
                    exportedAt: new Date().toISOString(),
                    settings: storeSettings,
                    entries: storeEntries,
                };
            }
            const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: "application/json;charset=utf-8",
            });
            saveAs(blob, `supdance-i18n-dictionary-${new Date().toISOString().slice(0, 10)}.json`);
            message.success(interfaceText("多语言词库 JSON 已导出"));
        } catch (err) {
            message.error(err instanceof Error ? err.message : interfaceText("导出失败"));
        }
    };

    const handleImportJson = async () => {
        if (!importJsonText.trim()) {
            message.warning(interfaceText("请粘贴或上传有效的 JSON 词库内容"));
            return;
        }
        setImporting(true);
        try {
            const parsed = JSON.parse(importJsonText) as { entries?: SupDanceI18nEntry[]; overrides?: Record<string, SupDanceI18nEntry> };
            const list = Array.isArray(parsed.entries) ? parsed.entries : parsed.overrides ? Object.values(parsed.overrides) : [];
            if (!list.length) {
                message.warning(interfaceText("未在 JSON 中识别到有效的 entries 词条数组"));
                return;
            }
            await importAdminSupDanceI18n({ entries: list });
            await refreshPublished();
            setImportModalOpen(false);
            setImportJsonText("");
            message.success(interfaceText("成功导入并持久化 {value1} 条多语言词条至服务端", { value1: list.length }));
        } catch (err) {
            setServerConnected(false);
            message.error(err instanceof Error ? err.message : interfaceText("导入或同步失败，请保留内容并重试"));
        } finally {
            setImporting(false);
        }
    };

    const hasActiveFilters = Boolean(keyword.trim()) || namespace !== "all" || origin !== "all" || missingLocale !== "all";

    const resetFilters = () => {
        setKeyword("");
        setNamespace("all");
        setOrigin("all");
        setMissingLocale("all");
        setPage(1);
        setSearchParams({});
    };

    const columns: ColumnsType<SupDanceI18nEntry> = [
        {
            title: interfaceText("词条 Key / 模块"),
            dataIndex: "key",
            key: "key",
            width: 220,
            render: (_val, record) => (
                <div className="space-y-1">
                    <div className="font-mono text-xs font-medium text-[var(--admin-text-primary)]">{record.key}</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <AdminStatusBadge label={interfaceText(NAMESPACE_LABELS[record.namespace] || record.namespace)} tone="neutral" />
                        {record.origin === "modified" ? (
                            <AdminStatusBadge label={interfaceText("已修订")} tone="info" />
                        ) : record.origin === "custom" ? (
                            <AdminStatusBadge label={interfaceText("自定义新增")} tone="success" />
                        ) : (
                            <AdminStatusBadge label={interfaceText("内置")} tone="neutral" />
                        )}
                    </div>
                </div>
            ),
        },
        {
            title: interfaceText("简体中文 (zh-CN / 原文)"),
            dataIndex: "sourceText",
            key: "zh-CN",
            width: 190,
            render: (_val, record) => (
                <button
                    type="button"
                    className="group flex w-full items-start justify-between gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-[var(--admin-row-hover)]"
                    onClick={() => openEditDrawer(record)}
                    title={interfaceText("点击修改词条翻译")}
                >
                    <span className="text-xs font-medium text-[var(--admin-text-primary)]">{record.translations["zh-CN"] || record.sourceText}</span>
                    <Edit3 className="mt-0.5 size-3 shrink-0 text-[var(--admin-text-secondary)] opacity-60 group-hover:opacity-100" />
                </button>
            ),
        },
        {
            title: "English (en-US)",
            key: "en-US",
            width: 190,
            render: (_val, record) => {
                const text = record.translations["en-US"];
                return (
                    <button type="button" className="group flex w-full items-start justify-between gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-[var(--admin-row-hover)]" onClick={() => openEditDrawer(record)}>
                        {text ? <span className="text-xs text-[var(--admin-text-primary)]">{text}</span> : <span className="text-xs italic text-[var(--admin-status-warning)]">{interfaceText("待翻译 (点击补充)")}</span>}
                        <Edit3 className="mt-0.5 size-3 shrink-0 text-[var(--admin-text-secondary)] opacity-0 group-hover:opacity-100" />
                    </button>
                );
            },
        },
        {
            title: interfaceText("繁體中文 (zh-TW)"),
            key: "zh-TW",
            width: 160,
            render: (_val, record) => {
                const text = record.translations["zh-TW"];
                return (
                    <button type="button" className="group flex w-full items-start justify-between gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-[var(--admin-row-hover)]" onClick={() => openEditDrawer(record)}>
                        {text ? <span className="text-xs text-[var(--admin-text-primary)]">{text}</span> : <span className="text-xs italic text-[var(--admin-status-warning)]">{interfaceText("待翻译")}</span>}
                        <Edit3 className="mt-0.5 size-3 shrink-0 text-[var(--admin-text-secondary)] opacity-0 group-hover:opacity-100" />
                    </button>
                );
            },
        },
        {
            title: interfaceText("其他界面语言"),
            key: "other-locales",
            width: 280,
            render: (_val, record) => (
                <div className="cursor-pointer space-y-1 rounded px-1.5 py-1 transition-colors hover:bg-[var(--admin-row-hover)]" onClick={() => openEditDrawer(record)}>
                    {SUPPORTED_LOCALE_CODES.filter((code) => !["zh-CN", "en-US", "zh-TW"].includes(code)).map((code) => {
                        const val = record.translations[code];
                        const badge = DEFAULT_SUPDANCE_LANGUAGES.find((language) => language.code === code)?.badge ?? code;
                        return (
                            <div key={code} className="flex items-center gap-1.5 text-xs">
                                <span className="inline-flex h-4 min-w-[20px] shrink-0 items-center justify-center rounded bg-[var(--admin-surface-2)] px-1 text-xs font-semibold text-[var(--admin-text-secondary)]">{badge}</span>
                                {val ? <span className="truncate text-[var(--admin-text-primary)]">{val}</span> : <span className="italic text-[var(--admin-status-warning)]">{interfaceText("未翻译")}</span>}
                            </div>
                        );
                    })}
                </div>
            ),
        },
        {
            title: interfaceText("操作"),
            key: "actions",
            width: 150,
            align: "right",
            render: (_val, record) => (
                <div className="inline-flex items-center justify-end gap-1">
                    <Button type="text" size="small" icon={<Edit3 className="size-3.5" />} onClick={() => openEditDrawer(record)}>
                        {interfaceText("修改翻译")}
                    </Button>
                    {record.origin === "modified" || record.origin === "custom" ? (
                        <Button type="text" size="small" danger={record.origin === "custom"} icon={record.origin === "custom" ? <Trash2 className="size-3.5" /> : <RotateCcw className="size-3.5" />} onClick={() => handleResetOrDelete(record)}>
                            {record.origin === "custom" ? interfaceText("删除") : interfaceText("还原")}
                        </Button>
                    ) : null}
                </div>
            ),
        },
    ];

    return (
        <AdminPageFrame
            scroll
            title={interfaceText("多语言词条与字段修改")}
            description={interfaceText("管理八种语言的界面译文。已接入的词条保存后会更新到页面；自定义词条需由组件引用后显示。")}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <Button className="min-h-11 sm:min-h-0" onClick={() => setWorkflowOpen(true)}>
                        {t("admin.i18n_workflow.open")}
                    </Button>
                    {serverConnected !== null ? <AdminStatusBadge label={serverConnected ? interfaceText("服务端已同步") : interfaceText("本地缓存降级")} tone={serverConnected ? "info" : "warning"} /> : null}
                    <Button icon={<Radar className="size-4" />} onClick={() => setDiscoveredDrawerOpen(true)}>
                        {interfaceText("未收录词条嗅探 (")}
                        {discoveredUntranslated.length})
                    </Button>
                    <Button icon={<Settings2 className="size-4" />} onClick={() => navigate("/admin/i18n/settings")}>
                        {interfaceText("语言管理设置")}
                    </Button>
                    <Button icon={<Upload className="size-4" />} onClick={() => setImportModalOpen(true)}>
                        {interfaceText("导入词库")}
                    </Button>
                    <Button icon={<Download className="size-4" />} onClick={() => void handleExportJson()}>
                        {interfaceText("导出词库")}
                    </Button>
                    <Button type="primary" icon={<Plus className="size-4" />} onClick={openCreateDrawer}>
                        {interfaceText("新增翻译字段")}
                    </Button>
                </div>
            }
        >
            <div className="admin-i18n-entries space-y-4" data-i18n-ignore="true" data-plugin-scope="i18n">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <AdminStatTile label={interfaceText("全站词条总数")} value={summaryStats.total} detail={interfaceText("原生词条与已接入的扩展词条")} />
                    <AdminStatTile label={interfaceText("内置基础词条")} value={summaryStats.builtin} detail={interfaceText("八种界面语言的内置词库")} />
                    <AdminStatTile label={interfaceText("已修订内置词条")} value={summaryStats.modified} detail="可随时一键还原为出厂默认翻译" />
                    <AdminStatTile label={interfaceText("自定义新增字段")} value={summaryStats.custom} detail={`页面自动嗅探待收录 ${discoveredUntranslated.length} 条`} />
                </div>

                <AdminDataTable<SupDanceI18nEntry>
                    toolbar={
                        <div className="w-full max-w-xs">
                            <Input
                                allowClear
                                value={keyword}
                                prefix={<Search className="size-3.5 text-muted-foreground" />}
                                placeholder={interfaceText("搜索 Key、中文原文或任意语种译文...")}
                                onChange={(e) => {
                                    setKeyword(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                    }
                    toolbarFilters={
                        <div className="flex flex-wrap items-center gap-2">
                            <Select
                                value={namespace}
                                className="w-44"
                                options={namespaceOptions}
                                onChange={(val) => {
                                    setNamespace(String(val));
                                    setPage(1);
                                }}
                                aria-label={interfaceText("按模块筛选")}
                            />
                            <Select
                                value={origin}
                                className="w-36"
                                options={[
                                    { value: "all", label: interfaceText("全部来源") },
                                    { value: "builtin", label: interfaceText("内置未改") },
                                    { value: "modified", label: interfaceText("已修订覆写") },
                                    { value: "custom", label: interfaceText("自定义新增") },
                                ]}
                                onChange={(val) => {
                                    setOrigin(String(val));
                                    setPage(1);
                                }}
                                aria-label={interfaceText("按词条来源筛选")}
                            />
                            <Select
                                value={missingLocale}
                                className="w-44"
                                options={[
                                    { value: "all", label: interfaceText("全部翻译状态") },
                                    ...DEFAULT_SUPDANCE_LANGUAGES.map((lang) => ({
                                        value: lang.code,
                                        label: interfaceText("缺失 {value1} ({value2})", { value1: lang.name, value2: lang.code }),
                                    })),
                                ]}
                                onChange={(val) => {
                                    setMissingLocale(String(val));
                                    setPage(1);
                                }}
                                aria-label={interfaceText("按缺失语种筛选")}
                            />
                        </div>
                    }
                    toolbarActive={hasActiveFilters}
                    onReset={resetFilters}
                    toolbarActiveFilters={
                        hasActiveFilters ? (
                            <>
                                {namespace !== "all" ? <AdminFilterChip label={interfaceText("模块: {value1}", { value1: interfaceText(NAMESPACE_LABELS[namespace] || namespace) })} onRemove={() => setNamespace("all")} /> : null}
                                {origin !== "all" ? <AdminFilterChip label={`来源: ${origin}`} onRemove={() => setOrigin("all")} /> : null}
                                {missingLocale !== "all" ? <AdminFilterChip label={`缺失语种: ${missingLocale}`} onRemove={() => setMissingLocale("all")} /> : null}
                            </>
                        ) : undefined
                    }
                    table={{
                        rowKey: "key",
                        loading,
                        columns,
                        dataSource: displayItems,
                        pagination: false,
                        size: "middle",
                    }}
                    empty={<AdminTableEmpty filtered={hasActiveFilters} title={hasActiveFilters ? interfaceText("未找到匹配的翻译词条") : interfaceText("暂无词条数据")} description={interfaceText("更换搜索词，或新增需要管理的八语言词条。")} />}
                    footer={
                        <PaginationBar
                            current={page}
                            pageSize={pageSize}
                            total={displayTotal}
                            alwaysShow
                            itemLabel="条词条"
                            onChange={(nextPage, nextSize) => {
                                setPage(nextPage);
                                setPageSize(nextSize);
                            }}
                        />
                    }
                />
            </div>

            <AdminDrawer className="[&_.ant-drawer-close]:min-h-11 [&_.ant-drawer-close]:min-w-11" open={workflowOpen} onClose={() => setWorkflowOpen(false)} title={t("admin.i18n_workflow.title")} size="min(100vw, 64rem)">
                {workflowOpen ? <TranslationWorkflowPanel onChanged={() => void fetchRemoteEntries()} /> : null}
            </AdminDrawer>
            <AdminDrawer
                open={discoveredDrawerOpen}
                width={560}
                title={interfaceText("历史发现的未收录词条 ({count})", { count: discoveredUntranslated.length })}
                onClose={() => setDiscoveredDrawerOpen(false)}
                extra={
                    discoveredUntranslated.length > 0 ? (
                        <Button
                            size="small"
                            onClick={() => {
                                clearDiscoveredUntranslated();
                                message.success(interfaceText("已清空待收录嗅探列表"));
                            }}
                        >
                            {interfaceText("清空列表")}
                        </Button>
                    ) : null
                }
            >
                <div className="space-y-3" data-i18n-ignore="true" data-plugin-scope="i18n">
                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)]/50 p-3 text-xs text-[var(--admin-text-secondary)]">
                        {interfaceText("这里保留旧版发现记录。新增界面文字由源码扫描与更新中心管理，选择记录可创建翻译草稿。")}
                    </div>
                    {discoveredUntranslated.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[var(--admin-border)] p-8 text-center text-xs text-[var(--admin-text-secondary)]">{interfaceText("暂无历史发现记录。可在更新中心检查新增或变化的界面文字。")}</div>
                    ) : (
                        <div className="divide-y divide-[var(--admin-row-border)] rounded-lg border border-[var(--admin-border)]">
                            {discoveredUntranslated.map((item) => (
                                <div key={item.sourceText} className="flex items-center justify-between gap-3 p-3">
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="break-words text-xs font-medium text-[var(--admin-text-primary)]">{item.sourceText}</div>
                                        <div className="flex items-center gap-2 text-xs text-[var(--admin-text-secondary)]">
                                            <span>
                                                {interfaceText("发现路由：")}
                                                {item.route}
                                            </span>
                                            <span>·</span>
                                            <span>
                                                {interfaceText("出现")}
                                                {item.count}
                                                {interfaceText("次")}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        <Button type="primary" size="small" icon={<Plus className="size-3.5" />} onClick={() => openCreateFromDiscovered(item)}>
                                            {interfaceText("创建翻译草稿")}
                                        </Button>
                                        <Button type="text" size="small" onClick={() => clearDiscoveredUntranslated(item.sourceText)}>
                                            {interfaceText("忽略")}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </AdminDrawer>

            <AdminDrawer
                open={drawerOpen}
                width={560}
                title={isCreateMode ? interfaceText("新增多语言字段词条") : interfaceText("编辑词条翻译 · {value1}", { value1: editingEntry.key })}
                onClose={() => setDrawerOpen(false)}
                extra={
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setDrawerOpen(false)}>{interfaceText("取消")}</Button>
                        <Button type="primary" loading={savingEntry} onClick={() => void handleSaveEntry()}>
                            {interfaceText("保存并热生效")}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4" data-i18n-ignore="true" data-plugin-scope="i18n">
                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)]/50 p-3 text-xs text-[var(--admin-text-secondary)]">
                        {interfaceText("提示：支持 ICU 动态占位变量（如")}
                        <code>{"{count}"}</code>、<code>{"{name}"}</code>
                        {interfaceText("）。只要「简体中文 (zh-CN)」与页面上的中文文案或动态格式一致，切换语言时全站对应文本与按钮会自动匹配并替换为目标语种译文。")}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-[var(--admin-text-primary)]">{interfaceText("词条唯一标识 (Key)")}</label>
                            <Input
                                disabled={!isCreateMode}
                                value={editingEntry.key}
                                placeholder={interfaceText("如：custom.myButton 或 nav.discover")}
                                onChange={(e) =>
                                    setEditingEntry((prev) => ({
                                        ...prev,
                                        key: e.target.value,
                                    }))
                                }
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-[var(--admin-text-primary)]">{interfaceText("所属业务模块 (Namespace)")}</label>
                            <Select
                                value={editingEntry.namespace}
                                className="w-full"
                                options={Object.entries(NAMESPACE_LABELS).map(([ns, label]) => ({
                                    value: ns,
                                    label: `${interfaceText(label)} (${ns})`,
                                }))}
                                onChange={(val) =>
                                    setEditingEntry((prev) => ({
                                        ...prev,
                                        namespace: String(val),
                                    }))
                                }
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-[var(--admin-text-primary)]">{interfaceText("备注说明（可选，供管理员查阅）")}</label>
                        <Input
                            value={editingEntry.description ?? ""}
                            placeholder={interfaceText("说明该词条在页面中的位置或语境...")}
                            onChange={(e) =>
                                setEditingEntry((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                }))
                            }
                        />
                    </div>

                    <div className="space-y-3 border-t border-[var(--admin-row-border)] pt-3">
                        <div className="text-xs font-semibold text-[var(--admin-text-primary)]">{interfaceText("八种界面语言的译文")}</div>

                        {DEFAULT_SUPDANCE_LANGUAGES.map((lang) => {
                            const val = editingEntry.translations[lang.code] ?? "";
                            return (
                                <div key={lang.code} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--admin-text-primary)]">
                                            <span className="inline-flex h-4 min-w-[22px] items-center justify-center rounded bg-[var(--admin-surface-2)] px-1 text-xs font-semibold text-[var(--admin-text-secondary)]">{lang.badge}</span>
                                            <span>
                                                {lang.nativeName} ({lang.name})
                                            </span>
                                            <span className="font-mono text-xs text-[var(--admin-text-secondary)]">{lang.code}</span>
                                        </label>
                                        {lang.code === "zh-CN" ? <span className="text-xs text-[var(--admin-accent)]">{interfaceText("基准匹配原文（必填）")}</span> : null}
                                    </div>
                                    <Input.TextArea
                                        autoSize={{ minRows: 1, maxRows: 4 }}
                                        value={val}
                                        placeholder={`请输入 ${lang.nativeName} (${lang.code}) 译文...`}
                                        onChange={(e) => {
                                            const nextVal = e.target.value;
                                            setEditingEntry((prev) => ({
                                                ...prev,
                                                sourceText: lang.code === "zh-CN" ? nextVal : prev.sourceText,
                                                translations: {
                                                    ...prev.translations,
                                                    [lang.code]: nextVal,
                                                },
                                            }));
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </AdminDrawer>

            <AdminModal
                open={importModalOpen}
                title={interfaceText("导入多语言词库 (JSON)")}
                okText={interfaceText("确认导入并热生效")}
                cancelText={interfaceText("取消")}
                confirmLoading={importing}
                onCancel={() => setImportModalOpen(false)}
                onOk={() => void handleImportJson()}
            >
                <div className="space-y-3 pt-2" data-i18n-ignore="true" data-plugin-scope="i18n">
                    <p className="text-xs text-[var(--admin-text-secondary)]">
                        {interfaceText("支持粘贴由「导出词库」生成的 JSON 内容，或包含")}
                        <code>entries</code>
                        {interfaceText("数组的词条文件，同 Key 词条将自动覆盖更新。")}
                    </p>
                    <Input.TextArea
                        rows={10}
                        className="font-mono text-xs"
                        value={importJsonText}
                        placeholder={
                            '{\n  "entries": [\n    {\n      "key": "custom.hello",\n      "namespace": "custom",\n      "sourceText": "你好",\n      "translations": {\n        "zh-CN": "你好",\n        "en-US": "Hello",\n        "zh-TW": "你好",\n        "ja-JP": "こんにちは",\n        "ko-KR": "안녕하세요",\n        "es-ES": "Hola"\n      }\n    }\n  ]\n}'
                        }
                        onChange={(e) => setImportJsonText(e.target.value)}
                    />
                </div>
            </AdminModal>
        </AdminPageFrame>
    );
}
export default SupDanceI18nEntriesPage;
