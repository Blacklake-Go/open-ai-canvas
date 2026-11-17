import type { AppLocale } from "@/i18n/locales";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import type { SupDanceI18nEntry } from "@/supdance/plugins/i18n/types";

const words = {
    title: ["页面管理", "Page management", "頁面管理", "Gestión de páginas", "Gestion des pages", "Seitenverwaltung", "ページ管理", "페이지 관리"],
    summary: [
        "统一管理模型展示、HTML 页面和邮件中心。各模块保留原有配置与权限。",
        "Manage model display, HTML pages and Email Center together. Each module keeps its settings and permissions.",
        "統一管理模型展示、HTML 頁面及郵件中心，各模組保留原有設定與權限。",
        "Gestiona la presentación de modelos, las páginas HTML y el correo, con sus ajustes y permisos originales.",
        "Gérez l’affichage des modèles, les pages HTML et les e-mails en conservant leurs paramètres et autorisations.",
        "Verwalten Sie Modelldarstellung, HTML-Seiten und E-Mail-Center mit den bisherigen Einstellungen und Berechtigungen.",
        "モデル表示、HTML ページ、メールセンターをまとめて管理します。各機能の設定と権限は維持されます。",
        "모델 표시, HTML 페이지, 이메일 센터를 통합 관리합니다. 각 모듈의 설정과 권한은 유지됩니다.",
    ],
    models: ["模型展示", "Model display", "模型展示", "Presentación de modelos", "Affichage des modèles", "Modelldarstellung", "モデル表示", "모델 표시"],
    html: ["HTML 页面", "HTML pages", "HTML 頁面", "Páginas HTML", "Pages HTML", "HTML-Seiten", "HTML ページ", "HTML 페이지"],
    email: ["邮件中心", "Email center", "郵件中心", "Centro de correo", "Centre de messagerie", "E-Mail-Center", "メールセンター", "이메일 센터"],
    loading: ["正在加载页面管理…", "Loading page management…", "正在載入頁面管理…", "Cargando gestión de páginas…", "Chargement de la gestion des pages…", "Seitenverwaltung wird geladen…", "ページ管理を読み込み中…", "페이지 관리 불러오는 중…"],
} satisfies Record<string, readonly string[]>;

export const pageManagementText = (locale: AppLocale, key: keyof typeof words) => words[key][SUPPORTED_LOCALES.findIndex((item) => item.code === locale)];
export const PAGE_MANAGEMENT_ENTRIES: SupDanceI18nEntry[] = Object.entries(words).map(([key, values]) => ({
    key: `page.management.${key}`,
    namespace: "admin",
    sourceText: values[0],
    description: "Page management plugin",
    origin: "builtin",
    translations: Object.fromEntries(SUPPORTED_LOCALES.map(({ code }, index) => [code, values[index]])),
}));
