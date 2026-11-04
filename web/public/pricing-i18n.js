(function () {
    const locales = ["zh-CN", "zh-TW", "en-US", "es-ES", "ja-JP", "ko-KR"];
    const terms = [
        ["价目表", "價目表", "Pricing", "Precios", "料金表", "요금표"],
        ["SupDance ONE 价目表", "SupDance ONE 價目表", "SupDance ONE Pricing", "Precios de SupDance ONE", "SupDance ONE 料金表", "SupDance ONE 요금표"],
        ["服务条款", "服務條款", "Terms of Service", "Términos del servicio", "利用規約", "서비스 약관"],
        ["隐私政策", "隱私政策", "Privacy Policy", "Política de privacidad", "プライバシーポリシー", "개인정보 처리방침"],
        ["可接受使用", "可接受使用", "Acceptable Use", "Uso aceptable", "許容される利用", "허용 가능한 사용"],
        ["法律中心", "法律中心", "Legal Center", "Centro legal", "法務センター", "법률 센터"],
        ["切换明暗主题", "切換明暗主題", "Toggle light and dark theme", "Cambiar tema claro u oscuro", "明暗テーマを切り替え", "밝은/어두운 테마 전환"],
        ["语言", "語言", "Language", "Idioma", "言語", "언어"],
        ["首页", "首頁", "home", "inicio", "ホーム", "홈"],
        ["积分充值套餐", "積分儲值方案", "Credit packs", "Paquetes de créditos", "クレジットパック", "크레딧 패키지"],
        ["云存储扩容套餐", "雲端儲存擴充方案", "Cloud storage add-ons", "Ampliaciones de almacenamiento", "クラウドストレージ追加プラン", "클라우드 저장 공간 추가"],
        ["图片生成与编辑", "圖片生成與編輯", "Image generation and editing", "Generación y edición de imágenes", "画像生成と編集", "이미지 생성 및 편집"],
        ["视频生成（按秒）", "影片生成（按秒）", "Video generation (per second)", "Generación de video (por segundo)", "動画生成（秒単位）", "동영상 생성(초당)"],
        ["视频生成（按条）", "影片生成（按段）", "Video generation (per clip)", "Generación de video (por clip)", "動画生成（クリップ単位）", "동영상 생성(클립당)"],
        ["文本生成", "文字生成", "Text generation", "Generación de texto", "テキスト生成", "텍스트 생성"],
        ["到账积分", "入帳積分", "Credits received", "Créditos recibidos", "付与クレジット", "지급 크레딧"],
        ["参考价/百万 Token", "參考價/百萬 Token", "Reference price / 1M tokens", "Precio de referencia / millón de tokens", "参考価格 / 100万トークン", "참고 가격 / 백만 토큰"],
        ["参考价/张", "參考價/張", "Reference price / image", "Precio de referencia / imagen", "参考価格 / 枚", "참고 가격 / 장"],
        ["参考价/秒", "參考價/秒", "Reference price / second", "Precio de referencia / segundo", "参考価格 / 秒", "참고 가격 / 초"],
        ["参考价/条", "參考價/段", "Reference price / clip", "Precio de referencia / clip", "参考価格 / クリップ", "참고 가격 / 클립"],
        ["积分/百万 Token", "積分/百萬 Token", "Credits / 1M tokens", "Créditos / millón de tokens", "クレジット / 100万トークン", "크레딧 / 백만 토큰"],
        ["积分/张", "積分/張", "credits/image", "créditos/imagen", "クレジット/枚", "크레딧/장"],
        ["积分/秒", "積分/秒", "credits/second", "créditos/segundo", "クレジット/秒", "크레딧/초"],
        ["积分/条", "積分/段", "credits/clip", "créditos/clip", "クレジット/クリップ", "크레딧/클립"],
        ["积分", "積分", "credits", "créditos", "クレジット", "크레딧"],
        ["百万Token", "百萬 Token", "1M tokens", "millón de tokens", "100万トークン", "백만 토큰"],
        ["计费项目", "計費項目", "Billing item", "Concepto de cobro", "課金項目", "과금 항목"],
        ["有效期", "有效期", "Validity", "Vigencia", "有効期間", "유효 기간"],
        ["售价", "售價", "Price", "Precio", "価格", "가격"],
        ["套餐", "方案", "Pack", "Paquete", "プラン", "패키지"],
        ["容量", "容量", "Capacity", "Capacidad", "容量", "용량"],
        ["能力", "功能", "Capability", "Función", "機能", "기능"],
        ["规格", "規格", "Specification", "Especificación", "仕様", "사양"],
        ["模型", "模型", "Model", "Modelo", "モデル", "모델"],
        ["文本输入 Token", "文字輸入 Token", "Input tokens", "Tokens de entrada", "入力トークン", "입력 토큰"],
        ["文本输出 Token", "文字輸出 Token", "Output tokens", "Tokens de salida", "出力トークン", "출력 토큰"],
        ["文生图 / 图像编辑", "文字生圖 / 圖像編輯", "Text to image / image editing", "Texto a imagen / edición", "テキストから画像 / 画像編集", "텍스트 이미지 생성 / 이미지 편집"],
        ["文生图 / 图生图", "文字生圖 / 圖生圖", "Text to image / image to image", "Texto a imagen / imagen a imagen", "テキストから画像 / 画像から画像", "텍스트 이미지 생성 / 이미지 변환"],
        ["文生 / 图生视频", "文字 / 圖片生影片", "Text / image to video", "Texto / imagen a video", "テキスト / 画像から動画", "텍스트 / 이미지 동영상 생성"],
        ["参考生视频", "參考生成影片", "Reference to video", "Referencia a video", "参照画像から動画", "참조 동영상 생성"],
        ["图生视频", "圖片生影片", "Image to video", "Imagen a video", "画像から動画", "이미지 동영상 생성"],
        ["文生视频", "文字生影片", "Text to video", "Texto a video", "テキストから動画", "텍스트 동영상 생성"],
        ["图像编辑", "圖像編輯", "Image editing", "Edición de imágenes", "画像編集", "이미지 편집"],
        ["通用生图", "通用生圖", "Image generation", "Generación de imágenes", "画像生成", "이미지 생성"],
        ["图生图", "圖生圖", "Image to image", "Imagen a imagen", "画像から画像", "이미지 변환"],
        ["文生图", "文字生圖", "Text to image", "Texto a imagen", "テキストから画像", "텍스트 이미지 생성"],
        ["默认标准", "預設標準", "Default", "Predeterminado", "標準", "기본"],
        ["默认", "預設", "Default", "Predeterminado", "標準", "기본"],
        ["低画质", "低畫質", "Low quality", "Calidad baja", "低画質", "저화질"],
        ["高画质", "高畫質", "High quality", "Calidad alta", "高画質", "고화질"],
        ["标准", "標準", "Standard", "Estándar", "標準", "표준"],
        ["平价档", "平價方案", "Budget tier", "Nivel económico", "低価格帯", "저가형"],
        ["上下文", "上下文", "context", "contexto", "コンテキスト", "컨텍스트"],
        ["输出上限", "輸出上限", "output limit", "límite de salida", "出力上限", "출력 한도"],
        ["输入档", "輸入級距", "input tier", "nivel de entrada", "入力区分", "입력 구간"],
        ["无声", "無聲", "Silent", "Sin sonido", "音声なし", "무음"],
        ["有声", "有聲", "With sound", "Con sonido", "音声あり", "음성 포함"],
        ["预览", "預覽", "Preview", "Vista previa", "プレビュー", "미리보기"],
        ["经济版", "經濟版", "Economy", "Económico", "エコノミー", "경제형"],
        ["快速", "快速", "Fast", "Rápido", "高速", "고속"],
        ["视频", "影片", "Video", "Video", "動画", "동영상"],
        ["标准版", "標準版", "Standard", "Estándar", "標準版", "표준형"],
        ["标准档", "標準級距", "Standard tier", "Nivel estándar", "標準区分", "표준 구간"],
        ["编辑", "編輯", "Edit", "Edición", "編集", "편집"],
        ["尝鲜包", "體驗包", "Starter pack", "Paquete inicial", "お試しパック", "체험 패키지"],
        ["轻量扩容包", "輕量擴充包", "Light storage pack", "Ampliación ligera", "ライト追加パック", "라이트 저장 공간"],
        ["标准扩容包", "標準擴充包", "Standard storage pack", "Ampliación estándar", "標準追加パック", "표준 저장 공간"],
        ["专业扩容包", "專業擴充包", "Pro storage pack", "Ampliación profesional", "プロ追加パック", "프로 저장 공간"],
        ["进阶扩容包", "進階擴充包", "Advanced storage pack", "Ampliación avanzada", "アドバンス追加パック", "고급 저장 공간"],
        ["工作室扩容包", "工作室擴充包", "Studio storage pack", "Ampliación estudio", "スタジオ追加パック", "스튜디오 저장 공간"],
        ["企业扩容包", "企業擴充包", "Enterprise storage pack", "Ampliación empresarial", "エンタープライズ追加パック", "기업 저장 공간"],
        ["团队云盘包", "團隊雲端硬碟包", "Team cloud pack", "Paquete en la nube para equipos", "チームクラウドパック", "팀 클라우드 패키지"],
        ["尊享云盘包", "尊享雲端硬碟包", "Premium cloud pack", "Paquete en la nube prémium", "プレミアムクラウドパック", "프리미엄 클라우드 패키지"],
        ["轻量包", "輕量包", "Light pack", "Paquete ligero", "ライトパック", "라이트 패키지"],
        ["进阶包", "進階包", "Advanced pack", "Paquete avanzado", "アドバンスパック", "고급 패키지"],
        ["标准包", "標準包", "Standard pack", "Paquete estándar", "標準パック", "표준 패키지"],
        ["专业包", "專業包", "Pro pack", "Paquete profesional", "プロパック", "프로 패키지"],
        ["工作室包", "工作室包", "Studio pack", "Paquete estudio", "スタジオパック", "스튜디오 패키지"],
        ["团队包", "團隊包", "Team pack", "Paquete de equipo", "チームパック", "팀 패키지"],
        ["企业旗舰包", "企業旗艦包", "Enterprise flagship pack", "Paquete empresarial insignia", "エンタープライズフラッグシップ", "기업 플래그십 패키지"],
        ["赠", "贈", "bonus", "bonificación", "特典", "보너스"],
        ["个月", "個月", "month", "mes", "か月", "개월"],
        ["万相", "萬相", "Wanxiang", "Wanxiang", "Wanxiang", "Wanxiang"],
        ["千问", "千問", "Qwen", "Qwen", "Qwen", "Qwen"],
        ["可灵", "可靈", "Kling", "Kling", "Kling", "Kling"],
        ["悠船", "悠船", "Midjourney", "Midjourney", "Midjourney", "Midjourney"],
        ["海螺", "海螺", "Hailuo", "Hailuo", "Hailuo", "Hailuo"],
        ["更新于", "更新於", "Updated", "Actualizado", "更新日", "업데이트"],
        ["价格以实际购买页面为准。", "價格以實際購買頁面為準。", "Prices shown at checkout prevail.", "Prevalecen los precios al finalizar la compra.", "決済画面の価格が優先されます。", "결제 화면의 가격이 우선합니다."],
        ["美元参考换算：", "美元參考換算：", "USD reference conversion: ", "Conversión de referencia a USD: ", "米ドル参考換算：", "USD 참고 환산: "],
        ["中间价", "中間價", "mid-market rate", "tipo de cambio medio", "仲値", "시장 중간 환율"],
        [
            "套餐金额保留 2 位、模型参考价保留 3 位小数；最终支付金额以结账页为准。",
            "方案金額保留 2 位、模型參考價保留 3 位小數；最終支付金額以結帳頁為準。",
            "Pack prices use 2 decimals; model reference prices use 3. The checkout amount is final.",
            "Los paquetes usan 2 decimales y los modelos 3. El importe final aparece al pagar.",
            "パックは小数点以下2桁、モデル参考価格は3桁で表示します。最終金額は決済画面をご確認ください。",
            "패키지는 소수점 둘째 자리, 모델 참고 가격은 셋째 자리까지 표시합니다. 최종 금액은 결제 화면을 확인하세요.",
        ],
        [
            "具体可用模型、规格与最终扣费以产品页面为准。",
            "實際可用模型、規格與最終扣費以產品頁面為準。",
            "Available models, specifications and charges are shown in the product.",
            "Consulte en el producto los modelos, especificaciones y cargos finales.",
            "利用可能なモデル、仕様、最終料金は製品画面をご確認ください。",
            "사용 가능한 모델, 사양 및 최종 요금은 제품 화면을 확인하세요.",
        ],
    ];
    const root = document.documentElement;
    const selector = document.getElementById("language-select");
    const themeButton = document.getElementById("theme-toggle");
    const sunIcon =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
    const moonIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.985 12.486A9 9 0 0 1 11.514 3.015 9 9 0 1 0 20.985 12.486Z"/></svg>';
    const nodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.nodeValue.trim() && node.parentElement.closest("main, header")) nodes.push([node, node.nodeValue]);
    }
    const attributes = Array.from(document.querySelectorAll("[aria-label]"), (element) => [element, element.getAttribute("aria-label")]);
    const sorted = terms.slice().sort((left, right) => right[0].length - left[0].length);
    function translate(source, index) {
        if (index === 0) return source;
        let result = source;
        for (const row of sorted) result = result.split(row[0]).join(row[index]);
        return result;
    }
    function setLocale(locale) {
        const index = Math.max(0, locales.indexOf(locale));
        root.lang = locales[index];
        selector.value = locales[index];
        for (const [node, source] of nodes) node.nodeValue = translate(source, index);
        for (const [element, source] of attributes) element.setAttribute("aria-label", translate(source, index));
        document.title = translate("价目表", index) + " · Supdance";
        localStorage.setItem("supdance:i18n:locale", locales[index]);
    }
    function setTheme(theme) {
        root.dataset.theme = theme;
        themeButton.innerHTML = theme === "dark" ? sunIcon : moonIcon;
        themeButton.setAttribute("aria-pressed", String(theme === "dark"));
        localStorage.setItem("yingce:theme_store", JSON.stringify({ state: { theme }, version: 0 }));
    }
    let storedTheme;
    try {
        storedTheme = JSON.parse(localStorage.getItem("yingce:theme_store") || "null")?.state?.theme;
    } catch (_) {
        storedTheme = null;
    }
    setTheme(storedTheme === "dark" ? "dark" : "light");
    const params = new URLSearchParams(location.search);
    const requested = params.get("lang");
    setLocale(locales.includes(requested) ? requested : localStorage.getItem("supdance:i18n:locale") || "zh-CN");
    selector.addEventListener("change", () => setLocale(selector.value));
    let revealing = false;
    themeButton.addEventListener("click", async () => {
        if (revealing) return;
        const next = root.dataset.theme === "dark" ? "light" : "dark";
        if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setTheme(next);
            return;
        }
        revealing = true;
        const bounds = themeButton.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        const radius = Math.hypot(Math.max(centerX, innerWidth - centerX), Math.max(centerY, innerHeight - centerY));
        root.dataset.themeRevealing = "true";
        root.style.setProperty("--theme-reveal-from", `circle(0px at ${centerX}px ${centerY}px)`);
        try {
            const transition = document.startViewTransition(() => setTheme(next));
            await transition.ready;
            await document.documentElement.animate({ clipPath: [`circle(0px at ${centerX}px ${centerY}px)`, `circle(${radius}px at ${centerX}px ${centerY}px)`] }, { duration: 400, easing: "ease-out", pseudoElement: "::view-transition-new(root)" })
                .finished;
        } catch (_) {
            setTheme(next);
        } finally {
            delete root.dataset.themeRevealing;
            root.style.removeProperty("--theme-reveal-from");
            revealing = false;
        }
    });
})();
