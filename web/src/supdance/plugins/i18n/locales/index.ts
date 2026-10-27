import type { SupDanceI18nEntry, SupDanceI18nSettings, SupDanceLanguageItem, SupDanceLocaleCode } from "../types";

export const SUPPORTED_LOCALE_CODES: readonly SupDanceLocaleCode[] = ["zh-CN", "en-US", "zh-TW", "ja-JP", "ko-KR", "es-ES"] as const;

export const NAMESPACE_LABELS: Record<string, string> = {
    common: "通用与基础控件",
    nav: "顶栏与侧栏导航",
    auth: "登录与注册认证",
    create: "首页创作工作台",
    canvas: "自由画布与节点",
    projects: "短剧制作工作台",
    assets: "资产与素材管理",
    skills: "技能广场与编排",
    plugins: "插件中心与扩展",
    settings: "个人设置与积分",
    admin: "管理后台与运维",
    custom: "自定义扩展词条",
};

export const DEFAULT_SUPDANCE_LANGUAGES: SupDanceLanguageItem[] = [
    { code: "zh-CN", name: "简体中文", nativeName: "简体中文", badge: "中", direction: "ltr", enabled: true, sortOrder: 1 },
    { code: "en-US", name: "英语", nativeName: "English", badge: "EN", direction: "ltr", enabled: true, sortOrder: 2 },
    { code: "zh-TW", name: "繁体中文", nativeName: "繁體中文", badge: "繁", direction: "ltr", enabled: true, sortOrder: 3 },
    { code: "ja-JP", name: "日文", nativeName: "日本語", badge: "日", direction: "ltr", enabled: true, sortOrder: 4 },
    { code: "ko-KR", name: "韩国语", nativeName: "한국어", badge: "韓", direction: "ltr", enabled: true, sortOrder: 5 },
    { code: "es-ES", name: "西班牙语", nativeName: "Español", badge: "ES", direction: "ltr", enabled: true, sortOrder: 6 },
];

export const DEFAULT_SUPDANCE_I18N_SETTINGS: SupDanceI18nSettings = {
    defaultLocale: "zh-CN",
    fallbackLocale: "zh-CN",
    autoDetectBrowser: true,
    switcherStyle: "icon_code",
    showInWorkspaceTopBar: true,
    showInAuthPage: true,
    showInCanvasTopBar: true,
    showInAdminTopBar: true,
    translateAdminPages: false,
    languages: DEFAULT_SUPDANCE_LANGUAGES,
    revision: "builtin-v1",
};

function e(key: string, namespace: string, zhCN: string, enUS: string, zhTW: string, jaJP: string, koKR: string, esES: string, description = ""): SupDanceI18nEntry {
    return {
        key,
        namespace,
        sourceText: zhCN,
        description,
        origin: "builtin",
        translations: {
            "zh-CN": zhCN,
            "en-US": enUS,
            "zh-TW": zhTW,
            "ja-JP": jaJP,
            "ko-KR": koKR,
            "es-ES": esES,
        },
    };
}

export const BUILTIN_SUPDANCE_I18N_ENTRIES: readonly SupDanceI18nEntry[] = [
    // ==================== common: 通用与基础控件 ====================
    e("common.confirm", "common", "确认", "Confirm", "確認", "確認", "확인", "Confirmar", "通用确认按钮"),
    e("common.cancel", "common", "取消", "Cancel", "取消", "キャンセル", "취소", "Cancelar", "通用取消按钮"),
    e("common.save", "common", "保存", "Save", "儲存", "保存", "저장", "Guardar", "通用保存按钮"),
    e("common.save_changes", "common", "保存修改", "Save Changes", "儲存修改", "変更を保存", "변경사항 저장", "Guardar cambios", "保存表单更改"),
    e("common.delete", "common", "删除", "Delete", "刪除", "削除", "삭제", "Eliminar", "通用删除按钮"),
    e("common.edit", "common", "编辑", "Edit", "編輯", "編集", "편집", "Editar", "通用编辑按钮"),
    e("common.create", "common", "新建", "Create", "新建", "新規作成", "생성", "Crear", "通用新建按钮"),
    e("common.refresh", "common", "刷新", "Refresh", "重新整理", "更新", "새로고침", "Actualizar", "通用刷新按钮"),
    e("common.reset", "common", "重置", "Reset", "重設", "リセット", "초기화", "Restablecer", "重置筛选或配置"),
    e("common.search", "common", "搜索", "Search", "搜尋", "検索", "검색", "Buscar", "通用搜索按钮"),
    e("common.filter", "common", "筛选", "Filter", "篩選", "フィルター", "필터", "Filtrar", "通用筛选按钮"),
    e("common.close", "common", "关闭", "Close", "關閉", "閉じる", "닫기", "Cerrar", "关闭弹窗或抽屉"),
    e("common.back", "common", "返回", "Back", "返回", "戻る", "뒤로", "Volver", "通用返回操作"),
    e("common.loading", "common", "加载中...", "Loading...", "載入中...", "読み込み中...", "로딩 중...", "Cargando...", "通用加载状态"),
    e("common.all", "common", "全部", "All", "全部", "すべて", "전체", "Todo", "通用全部筛选项"),
    e("common.enabled", "common", "已启用", "Enabled", "已啟用", "有効", "활성화됨", "Habilitado", "启用状态标签"),
    e("common.disabled", "common", "已停用", "Disabled", "已停用", "無効", "비활성화됨", "Deshabilitado", "停用状态标签"),
    e("common.available", "common", "已开放", "Available", "已開放", "公開中", "사용 가능", "Disponible", "平台开放状态"),
    e("common.unavailable", "common", "平台停用", "Unavailable", "平台停用", "停止中", "사용 불가", "No disponible", "平台停用状态"),
    e("common.copy", "common", "复制", "Copy", "複製", "コピー", "복사", "Copiar", "复制操作"),
    e("common.download", "common", "下载", "Download", "下載", "ダウンロード", "다운로드", "Descargar", "下载操作"),
    e("common.upload", "common", "上传", "Upload", "上傳", "アップロード", "업로드", "Subir", "上传操作"),
    e("common.export", "common", "导出", "Export", "匯出", "エクスポート", "내보내기", "Exportar", "导出操作"),
    e("common.import", "common", "导入", "Import", "匯入", "インポート", "가져오기", "Importar", "导入操作"),
    e("common.actions", "common", "操作", "Actions", "操作", "操作", "작업", "Acciones", "表格操作列标题"),
    e("common.status", "common", "状态", "Status", "狀態", "ステータス", "상태", "Estado", "表格状态列标题"),
    e("common.type", "common", "类型", "Type", "類型", "タイプ", "유형", "Tipo", "表格类型列标题"),
    e("common.totalCount", "common", "共 {count} 条", "Total {count}", "共 {count} 條", "全 {count} 件", "총 {count}개", "Total {count}", "通用分页计数模板"),

    // ==================== nav: 顶栏与侧栏导航 ====================
    e("nav.workspace", "nav", "创作工作台", "Creative Studio", "創作工作台", "制作スタジオ", "크리에이티브 스튜디오", "Estudio Creativo", "侧栏品牌副标题"),
    e("nav.create", "nav", "创作", "Create", "創作", "制作", "창작", "Crear", "主导航：创作工作台"),
    e("nav.projects", "nav", "短剧制作", "Short Drama", "短劇製作", "ショートドラマ制作", "숏폼 드라마 제작", "Producción de Microdramas", "主导航：短剧制作"),
    e("nav.projects_short", "nav", "短剧", "Drama", "短劇", "ドラマ", "드라마", "Drama", "折叠侧栏：短剧"),
    e("nav.canvas", "nav", "自由画布", "Infinite Canvas", "自由畫布", "フリーキャンバス", "무한 캔버스", "Lienzo Libre", "主导航：自由画布"),
    e("nav.canvas_short", "nav", "画布", "Canvas", "畫布", "キャンバス", "캔버스", "Lienzo", "折叠侧栏：画布"),
    e("nav.resources_tools", "nav", "资源与工具", "Resources & Tools", "資源與工具", "リソースとツール", "리소스 및 도구", "Recursos y Herramientas", "侧栏分组：资源与工具"),
    e("nav.image_gen", "nav", "图片生成", "Image Generation", "圖片生成", "画像生成", "이미지 생성", "Generación de Imágenes", "侧栏：图片生成"),
    e("nav.video_gen", "nav", "视频生成", "Video Generation", "影片生成", "動画生成", "비디오 생성", "Generación de Video", "侧栏：视频生成"),
    e("nav.skills", "nav", "技能", "Skills", "技能", "スキル", "스킬", "Habilidades", "主导航：技能"),
    e("nav.plugins", "nav", "插件", "Plugins", "外掛", "プラグイン", "플러그인", "Complementos", "主导航：插件"),
    e("nav.assets_history", "nav", "资产与历史", "Assets & History", "資產與歷史", "アセットと履歴", "자산 및 기록", "Activos e Historial", "侧栏分组：资产与历史"),
    e("nav.assets", "nav", "资产", "Assets", "資產", "アセット", "자산", "Activos", "主导航：资产"),
    e("nav.tasks", "nav", "创作历史", "Creation History", "創作歷史", "制作履歴", "창작 기록", "Historial de Creación", "主导航：创作历史"),
    e("nav.tasks_short", "nav", "历史", "History", "歷史", "履歴", "기록", "Historial", "折叠侧栏：历史"),
    e("nav.settings", "nav", "设置", "Settings", "設定", "設定", "설정", "Configuración", "导航：设置"),
    e("nav.feedback", "nav", "反馈", "Feedback", "回饋", "フィードバック", "피드백", "Comentarios", "顶栏：反馈按钮"),
    e("nav.feedback_title", "nav", "意见与问题反馈", "Feedback & Bug Report", "意見與問題回饋", "フィードバックとバグ報告", "의견 및 문제 피드백", "Comentarios y Reporte de Errores", "顶栏：反馈提示"),
    e("nav.credits", "nav", "积分", "Credits", "積分", "クレジット", "크레딧", "Créditos", "顶栏：积分胶囊"),
    e("nav.available_credits", "nav", "可用积分", "Available Credits", "可用積分", "利用可能クレジット", "사용 가능 크레딧", "Créditos disponibles", "账户卡片：可用积分"),
    e("nav.topup_redeem", "nav", "充值 / 兑换", "Top Up / Redeem", "儲值 / 兌換", "チャージ / 交換", "충전 / 교환", "Recargar / Canjear", "账户卡片：充值兑换"),
    e("nav.refresh_balance", "nav", "刷新余额", "Refresh Balance", "重新整理餘額", "残高を更新", "잔액 새로고침", "Actualizar saldo", "账户卡片：刷新余额"),
    e("nav.account_settings", "nav", "账户与设置", "Account & Settings", "帳戶與設定", "アカウントと設定", "계정 및 설정", "Cuenta y Configuración", "账户卡片：账户与设置"),
    e("nav.admin_console", "nav", "管理员后台", "Admin Console", "管理員後台", "管理コンソール", "관리자 콘솔", "Consola de Administración", "账户卡片：管理员后台"),
    e("nav.logout", "nav", "退出登录", "Log Out", "登出", "ログアウト", "로그아웃", "Cerrar sesión", "账户卡片：退出登录"),
    e("nav.dark_mode", "nav", "深色模式", "Dark Mode", "深色模式", "ダークモード", "다크 모드", "Modo oscuro", "账户菜单：深色模式"),
    e("nav.toggle_theme", "nav", "切换主题", "Toggle Theme", "切換主題", "テーマを切り替え", "테마 전환", "Cambiar tema", "顶栏：切换主题"),
    e("nav.switch_language", "nav", "切换语言", "Switch Language", "切換語言", "言語を切り替え", "언어 전환", "Cambiar idioma", "顶栏：切换语言"),
    e("nav.collapse_sidebar", "nav", "收起侧栏", "Collapse Sidebar", "收起側欄", "サイドバーを折りたたむ", "사이드바 접기", "Contraer barra lateral", "收起侧栏"),
    e("nav.expand_sidebar", "nav", "展开侧栏", "Expand Sidebar", "展開側欄", "サイドバーを展開", "사이드바 펼치기", "Expandir barra lateral", "展开侧栏"),
    e("nav.guest_mode", "nav", "游客模式", "Guest Mode", "訪客模式", "ゲストモード", "게스트 모드", "Modo invitado", "侧栏：游客模式"),
    e("nav.guest", "nav", "游客", "Guest", "訪客", "ゲスト", "게스트", "Invitado", "顶栏：游客"),
    e("nav.role_admin", "nav", "管理员", "Admin", "管理員", "管理者", "관리자", "Administrador", "角色标签：管理员"),
    e("nav.role_creator", "nav", "创作者", "Creator", "創作者", "クリエイター", "크리에이터", "Creador", "角色标签：创作者"),

    // ==================== auth: 登录与注册认证 ====================
    e("auth.login", "auth", "登录", "Log In", "登入", "ログイン", "로그인", "Iniciar sesión", "登录按钮/标签"),
    e("auth.register", "auth", "注册", "Sign Up", "註冊", "新規登録", "회원가입", "Registrarse", "注册按钮/标签"),
    e("auth.enter_studio", "auth", "进入创作现场", "Enter the Creative Studio", "進入創作現場", "制作スタジオへ入る", "크리에이티브 스튜디오 입장", "Entrar al Estudio Creativo", "登录页主标题"),
    e(
        "auth.login_desc",
        "auth",
        "继续编辑你的画布、素材与生成任务。",
        "Continue editing your canvases, assets, and generation tasks.",
        "繼續編輯你的畫布、素材與生成任務。",
        "キャンバス、素材、生成タスクの編集を続けましょう。",
        "캔버스, 자산 및 생성 작업을 계속 편집하세요.",
        "Continúa editando tus lienzos, activos y tareas de generación.",
        "登录页副标题",
    ),
    e("auth.create_space", "auth", "建立你的创作空间", "Create Your Workspace", "建立你的創作空間", "あなたの制作スペースを作成", "나만의 창작 공간 만들기", "Crea tu Espacio Creativo", "注册页主标题"),
    e(
        "auth.register_desc",
        "auth",
        "一个账号管理画布、素材、技能和模型偏好。",
        "Manage canvases, assets, skills, and model preferences in one account.",
        "一個帳號管理畫布、素材、技能和模型偏好。",
        "1つのアカウントでキャンバス、素材、スキル、モデル設定を管理します。",
        "하나의 계정으로 캔버스, 자산, 스킬 및 모델 설정을 관리하세요.",
        "Gestiona lienzos, activos, habilidades y modelos en una sola cuenta.",
        "注册页副标题",
    ),
    e("auth.reset_password", "auth", "重新设置密码", "Reset Password", "重新設定密碼", "パスワードを再設定", "비밀번호 재설정", "Restablecer contraseña", "找回密码标题"),
    e("auth.password_login", "auth", "密码登录", "Password Login", "密碼登入", "パスワードログイン", "비밀번호 로그인", "Iniciar con contraseña", "密码登录分段"),
    e("auth.username_or_email", "auth", "用户名 / 邮箱", "Username / Email", "使用者名稱 / 信箱", "ユーザー名 / メール", "사용자 이름 / 이메일", "Usuario / Correo", "用户名或邮箱标签"),
    e("auth.username_placeholder", "auth", "用户名或邮箱", "Username or email", "使用者名稱或信箱", "ユーザー名またはメールアドレス", "사용자 이름 또는 이메일", "Usuario o correo electrónico", "用户名输入框占位"),
    e("auth.password", "auth", "密码", "Password", "密碼", "パスワード", "비밀번호", "Contraseña", "密码标签"),
    e("auth.password_placeholder", "auth", "请输入密码", "Enter your password", "請輸入密碼", "パスワードを入力してください", "비밀번호를 입력하세요", "Introduce tu contraseña", "密码输入框占位"),
    e("auth.forgot_password", "auth", "忘记密码？", "Forgot password?", "忘記密碼？", "パスワードをお忘れですか？", "비밀번호를 잊으셨나요?", "¿Olvidaste tu contraseña?", "忘记密码链接"),
    e("auth.back_home", "auth", "返回首页", "Back to Home", "返回首頁", "ホームへ戻る", "홈으로 돌아가기", "Volver al inicio", "登录页返回首页"),
    e("auth.play_brand_video", "auth", "播放品牌影片", "Play Brand Film", "播放品牌影片", "ブランド映像を再生", "브랜드 영상 재생", "Reproducir video de marca", "播放品牌影片按钮"),
    e("auth.creation_happening", "auth", "创作正在发生", "Creation in Progress", "創作正在發生", "制作進行中", "창작이 진행 중입니다", "Creación en curso", "影片播放中提示"),

    // ==================== create: 首页创作工作台 ====================
    e("create.recent_canvases", "create", "最近画布", "Recent Canvases", "最近畫布", "最近のキャンバス", "최근 캔버스", "Lienzos recientes", "创作页：最近画布"),
    e("create.new_canvas", "create", "新建画布", "New Canvas", "新建畫布", "新規キャンバス", "새 캔버스", "Nuevo lienzo", "创作页：新建画布"),
    e("create.inspiration", "create", "灵感广场", "Inspiration Gallery", "靈感廣場", "インスピレーション", "영감 갤러리", "Galería de Inspiración", "创作页：灵感广场"),
    e("create.send", "create", "发送", "Send", "發送", "送信", "전송", "Enviar", "发送提示词"),
    e("create.generate", "create", "开始生成", "Generate", "開始生成", "生成開始", "생성 시작", "Generar", "开始生成按钮"),

    // ==================== canvas: 自由画布与节点 ====================
    e("canvas.my_canvases", "canvas", "我的画布", "My Canvases", "我的畫布", "マイキャンバス", "내 캔버스", "Mis lienzos", "画布列表标题"),
    e("canvas.create_project", "canvas", "新建画布项目", "New Canvas Project", "新建畫布專案", "新規キャンバスプロジェクト", "새 캔버스 프로젝트", "Nuevo proyecto de lienzo", "新建画布项目"),
    e("canvas.switch_to_assets", "canvas", "切换到资产视图", "Switch to Assets View", "切換到資產視圖", "アセット表示に切り替え", "자산 보기로 전환", "Cambiar a vista de activos", "画布顶栏菜单"),
    e("canvas.switch_to_canvas", "canvas", "切换到画布视图", "Switch to Canvas View", "切換到畫布視圖", "キャンバス表示に切り替え", "캔버스 보기로 전환", "Cambiar a vista de lienzo", "画布顶栏菜单"),
    e("canvas.undo", "canvas", "撤销", "Undo", "復原", "元に戻す", "실행 취소", "Deshacer", "画布：撤销"),
    e("canvas.redo", "canvas", "重做", "Redo", "重做", "やり直す", "다시 실행", "Rehacer", "画布：重做"),
    e("canvas.share", "canvas", "分享", "Share", "分享", "共有", "공유", "Compartir", "画布：分享"),
    e("canvas.focus_mode", "canvas", "专注模式", "Focus Mode", "專注模式", "集中モード", "집중 모드", "Modo concentración", "画布：专注模式"),
    e("canvas.shortcuts", "canvas", "快捷键", "Shortcuts", "快捷鍵", "ショートカット", "단축키", "Atajos", "画布：快捷键"),

    // ==================== projects: 短剧制作工作台 ====================
    e("projects.title", "projects", "短剧项目", "Short Drama Projects", "短劇專案", "ショートドラマプロジェクト", "숏폼 드라마 프로젝트", "Proyectos de Microdrama", "短剧项目列表标题"),
    e("projects.create", "projects", "新建短剧", "New Short Drama", "新建短劇", "新規ショートドラマ", "새 숏폼 드라마", "Nuevo Microdrama", "新建短剧按钮"),
    e("projects.episodes", "projects", "分集管理", "Episodes", "分集管理", "エピソード管理", "에피소드 관리", "Episodios", "分集管理"),
    e("projects.storyboard", "projects", "分镜脚本", "Storyboard", "分鏡腳本", "絵コンテ・脚本", "스토리보드", "Guion gráfico", "分镜脚本"),

    // ==================== assets: 资产与素材管理 ====================
    e("assets.title", "assets", "我的资产", "My Assets", "我的資產", "マイアセット", "내 자산", "Mis activos", "资产页标题"),
    e("assets.upload", "assets", "上传素材", "Upload Asset", "上傳素材", "素材をアップロード", "소재 업로드", "Subir activo", "上传素材按钮"),
    e("assets.image", "assets", "图片", "Images", "圖片", "画像", "이미지", "Imágenes", "资产类型：图片"),
    e("assets.video", "assets", "视频", "Videos", "影片", "動画", "비디오", "Videos", "资产类型：视频"),
    e("assets.audio", "assets", "音频", "Audio", "音訊", "音声", "오디오", "Audio", "资产类型：音频"),

    // ==================== skills: 技能广场与编排 ====================
    e("skills.title", "skills", "技能广场", "Skills Marketplace", "技能廣場", "スキルマーケット", "스킬 마켓", "Mercado de Habilidades", "技能广场标题"),
    e("skills.my_skills", "skills", "我的技能", "My Skills", "我的技能", "マイスキル", "내 스킬", "Mis habilidades", "我的技能"),
    e("skills.create_skill", "skills", "创建技能", "Create Skill", "建立技能", "スキルを作成", "스킬 만들기", "Crear habilidad", "创建技能按钮"),

    // ==================== plugins: 插件中心与扩展 ====================
    e("plugins.center_title", "plugins", "插件中心", "Plugin Center", "外掛中心", "プラグインセンター", "플러그인 센터", "Centro de Complementos", "插件中心标题"),
    e("plugins.upload_plugin", "plugins", "上传插件", "Upload Plugin", "上傳外掛", "プラグインをアップロード", "플러그인 업로드", "Subir complemento", "上传插件按钮"),
    e("plugins.all_plugins", "plugins", "全部插件", "All Plugins", "全部外掛", "すべてのプラグイン", "전체 플러그인", "Todos los complementos", "全部插件统计"),
    e("plugins.official_apps", "plugins", "官方应用", "Official Apps", "官方應用", "公式アプリ", "공식 앱", "Aplicaciones oficiales", "官方应用统计"),
    e("plugins.system_protocols", "plugins", "系统协议", "System Protocols", "系統協定", "システムプロトコル", "시스템 프로토콜", "Protocolos del sistema", "系统协议统计"),
    e("plugins.payment_protocols", "plugins", "支付协议", "Payment Protocols", "支付協定", "決済プロトコル", "결제 프로토콜", "Protocolos de pago", "支付协议统计"),
    e(
        "plugins.searchPlaceholder",
        "plugins",
        "搜索插件名称、ID 或作者",
        "Search plugin name, ID or author",
        "搜尋外掛名稱、ID 或作者",
        "プラグイン名、ID、作成者を検索",
        "플러그인 이름, ID 또는 작성자 검색",
        "Buscar complemento por nombre, ID o autor",
        "插件搜索占位文案",
    ),
    e("plugins.searchAria", "plugins", "搜索插件", "Search plugins", "搜尋外掛", "プラグインを検索", "플러그인 검색", "Buscar complementos", "插件搜索无障碍标签"),

    // ==================== settings: 个人设置与积分 ====================
    e("settings.profile", "settings", "个人资料", "Profile", "個人資料", "プロフィール", "프로필", "Perfil", "设置：个人资料"),
    e("settings.channels", "settings", "模型渠道", "Model Channels", "模型渠道", "モデルチャネル", "모델 채널", "Canales de modelo", "设置：模型渠道"),
    e("settings.storage", "settings", "存储配置", "Storage Settings", "儲存配置", "ストレージ設定", "스토리지 설정", "Configuración de almacenamiento", "设置：存储配置"),
    e("settings.security", "settings", "账号安全", "Account Security", "帳號安全", "アカウントセキュリティ", "계정 보안", "Seguridad de la cuenta", "设置：账号安全"),

    // ==================== admin: 管理后台与运维 ====================
    e("admin.back_to_studio", "admin", "返回创作台", "Back to Studio", "返回創作台", "スタジオへ戻る", "스튜디오로 돌아가기", "Volver al estudio", "后台侧栏：返回创作台"),
    e("admin.overview", "admin", "运行总览", "Overview", "運行總覽", "システム概要", "운영 개요", "Resumen", "后台：运行总览"),
    e("admin.request_logs", "admin", "请求明细", "Request Logs", "請求明細", "リクエスト履歴", "요청 내역", "Registros de solicitudes", "后台：请求明细"),
    e("admin.system_performance", "admin", "系统性能", "System Performance", "系統效能", "システム性能", "시스템 성능", "Rendimiento del sistema", "后台：系统性能"),
    e("admin.system_channels", "admin", "系统渠道", "System Channels", "系統渠道", "システムチャネル", "시스템 채널", "Canales del sistema", "后台：系统渠道"),
    e("admin.frontend_models", "admin", "前台模型", "Frontend Models", "前台模型", "フロントモデル", "프론트엔드 모델", "Modelos públicos", "后台：前台模型"),
    e("admin.prompt_templates", "admin", "提示词模板", "Prompt Templates", "提示詞模板", "プロンプトテンプレート", "프롬프트 템플릿", "Plantillas de prompts", "后台：提示词模板"),
    e("admin.workbench_tools", "admin", "工作台工具", "Workbench Tools", "工作台工具", "ワークベンチツール", "워크벤치 도구", "Herramientas de trabajo", "后台：工作台工具"),
    e("admin.storage_resources", "admin", "存储资源", "Storage Resources", "儲存資源", "ストレージリソース", "스토리지 리소스", "Recursos de almacenamiento", "后台：存储资源"),
    e("admin.user_management", "admin", "用户管理", "Users", "使用者管理", "ユーザー管理", "사용자 관리", "Gestión de usuarios", "后台：用户管理"),
    e("admin.login_logs", "admin", "用户登录日志", "Login Logs", "使用者登入日誌", "ログイン履歴", "로그인 로그", "Registros de acceso", "后台：用户登录日志"),
    e("admin.user_feedbacks", "admin", "用户反馈", "User Feedback", "使用者回饋", "ユーザーフィードバック", "사용자 피드백", "Comentarios de usuarios", "后台：用户反馈"),
    e("admin.announcements", "admin", "系统公告", "Announcements", "系統公告", "システムお知らせ", "시스템 공지", "Anuncios del sistema", "后台：系统公告"),
    e("admin.banner_announcements", "admin", "常驻通知", "Banner Notices", "常駐通知", "バナー通知", "상단 배너 공지", "Avisos permanentes", "后台：常驻通知"),
    e("admin.payments", "admin", "支付充值", "Payments", "支付儲值", "決済・チャージ", "결제 및 충전", "Pagos y recargas", "后台：支付充值"),
    e("admin.credit_operations", "admin", "积分运营", "Credit Operations", "積分營運", "クレジット運用", "크레딧 운영", "Operaciones de crédito", "后台：积分运营"),
    e("admin.redemption_codes", "admin", "兑换码", "Redemption Codes", "兌換碼", "引き換えコード", "리딤 코드", "Códigos de canje", "后台：兑换码"),
    e("admin.plugin_management", "admin", "插件管理", "Plugin Management", "外掛管理", "プラグイン管理", "플러그인 관리", "Gestión de complementos", "后台：插件管理"),
    e("admin.i18n_settings", "admin", "语言管理设置", "Language Settings", "語言管理設定", "言語管理設定", "언어 관리 설정", "Configuración de idiomas", "后台：语言管理设置"),
    e("admin.i18n_entries", "admin", "多语言词条修改", "Translation Entries", "多語言詞條修改", "翻訳エントリー編集", "다국어 항목 편집", "Entradas de traducción", "后台：多语言词条修改"),
    e("admin.appearance", "admin", "站点及外观", "Site & Appearance", "站點及外觀", "サイトと外観", "사이트 및 외관", "Sitio y apariencia", "后台：站点及外观"),
    e("admin.features", "admin", "功能开放", "Feature Availability", "功能開放", "機能公開設定", "기능 개방", "Disponibilidad de funciones", "后台：功能开放"),
    e("admin.system_update", "admin", "系统更新", "System Update", "系統更新", "システム更新", "시스템 업데이트", "Actualización del sistema", "后台：系统更新"),
];

export function isSupportedLocaleCode(value: unknown): value is SupDanceLocaleCode {
    return typeof value === "string" && (SUPPORTED_LOCALE_CODES as readonly string[]).includes(value);
}

/**
 * Merges the built-in 6-language dictionary with custom/modified overrides from the backend.
 */
export const BUILTIN_I18N_ENTRIES = BUILTIN_SUPDANCE_I18N_ENTRIES;

export function mergeI18nEntries(customEntries: Record<string, SupDanceI18nEntry> = {}): SupDanceI18nEntry[] {
    const builtinKeySet = new Set<string>();
    const result: SupDanceI18nEntry[] = [];

    for (const builtin of BUILTIN_SUPDANCE_I18N_ENTRIES) {
        builtinKeySet.add(builtin.key);
        const override = customEntries[builtin.key];
        if (!override) {
            result.push({ ...builtin, translations: { ...builtin.translations } });
            continue;
        }
        const mergedTranslations = { ...builtin.translations };
        for (const code of SUPPORTED_LOCALE_CODES) {
            const candidate = override.translations?.[code];
            if (typeof candidate === "string" && candidate.trim()) {
                mergedTranslations[code] = candidate.trim();
            }
        }
        result.push({
            key: builtin.key,
            namespace: override.namespace || builtin.namespace,
            sourceText: override.sourceText?.trim() || mergedTranslations["zh-CN"] || builtin.sourceText,
            description: override.description?.trim() || builtin.description,
            translations: mergedTranslations,
            origin: "modified",
            updatedAt: override.updatedAt,
            updatedBy: override.updatedBy,
        });
    }

    const customKeys = Object.keys(customEntries)
        .filter((key) => !builtinKeySet.has(key))
        .sort();

    for (const key of customKeys) {
        const custom = customEntries[key];
        if (!custom) continue;
        const sourceText = custom.sourceText?.trim() || custom.translations?.["zh-CN"]?.trim() || "";
        if (!sourceText) continue;
        const translations: Record<SupDanceLocaleCode, string> = {
            "zh-CN": custom.translations?.["zh-CN"]?.trim() || sourceText,
            "en-US": custom.translations?.["en-US"]?.trim() || "",
            "zh-TW": custom.translations?.["zh-TW"]?.trim() || "",
            "ja-JP": custom.translations?.["ja-JP"]?.trim() || "",
            "ko-KR": custom.translations?.["ko-KR"]?.trim() || "",
            "es-ES": custom.translations?.["es-ES"]?.trim() || "",
        };
        result.push({
            key,
            namespace: custom.namespace?.trim() || "custom",
            sourceText,
            description: custom.description?.trim(),
            translations,
            origin: "custom",
            updatedAt: custom.updatedAt,
            updatedBy: custom.updatedBy,
        });
    }

    return result;
}
