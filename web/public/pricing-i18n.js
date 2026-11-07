(function () {
    const locales = ["zh-CN", "en-US", "fr-FR", "de-DE", "ja-JP", "ko-KR"];
    const terms = [
        ["价目表", "Pricing", "Grille tarifaire", "Preisliste", "料金表", "요금표"],
        [
            "Supdance 积分套餐、云存储与 AI 模型公开价目表。",
            "Public price list for Supdance credits plans, cloud storage, and AI models.",
            "Grille tarifaire publique des packs de crédits Supdance, du stockage cloud et des modèles d'IA.",
            "Öffentliche Preisliste für Supdance-Credits-Pakete, Cloud-Speicher und KI-Modelle.",
            "Supdance のクレジットプラン、クラウドストレージ、AIモデルの公開価格一覧。",
            "Supdance 크레딧 플랜, 클라우드 스토리지 및 AI 모델 공개 가격표.",
        ],
        ["服务条款", "Terms of Service", "Conditions d'utilisation", "Nutzungsbedingungen", "利用規約", "서비스 약관"],
        ["隐私政策", "Privacy Policy", "Politique de confidentialité", "Datenschutzrichtlinie", "プライバシーポリシー", "개인정보 처리방침"],
        ["可接受使用", "Acceptable Use", "Utilisation acceptable", "Zulässige Nutzung", "許容される利用", "허용 가능한 사용"],
        ["法律中心", "Legal Center", "Centre juridique", "Rechtsbereich", "法務センター", "법률 센터"],
        ["SupDance ONE 价目表", "SupDance ONE Pricing", "Grille tarifaire SupDance ONE", "SupDance ONE Preisliste", "SupDance ONE 料金表", "SupDance ONE 요금표"],
        [
            "美元价目更新于 2026-11-07。结账时可查看实际支付金额。",
            "USD pricing updated November 7, 2026. Check the amount due at checkout.",
            "Tarifs en USD mis à jour le 7 novembre 2026. Le montant à payer figure sur la page de paiement.",
            "USD-Preise aktualisiert am 7. November 2026. Der zu zahlende Betrag wird an der Kasse angezeigt.",
            "米ドル価格の更新日：2026年11月7日。お支払い額は決済画面でご確認ください。",
            "미국 달러 가격을 2026년 11월 7일에 업데이트했습니다. 결제 화면에서 최종 금액을 확인하세요.",
        ],
        [
            "充值和存储套餐以美元定价。1 美元购买 100 基础积分，套餐赠分另计。下方模型积分与美元金额为 11 月 5 日的历史参考，实际用量和扣费请查看生成页。",
            "Credit packs and storage add-ons are priced in USD. USD 1 buys 100 base credits, plus any pack bonus. Model rates in credits and USD are the November 5 reference rates. Check the generation page for current usage and charges.",
            "Les packs de crédits et les extensions de stockage sont tarifés en USD. Un dollar donne droit à 100 crédits de base, auxquels s’ajoute le bonus du pack. Les tarifs des modèles en crédits et en USD sont ceux du 5 novembre. Consultez la page de génération pour connaître la consommation et le tarif actuels.",
            "Credit-Pakete und Speichererweiterungen werden in USD berechnet. Für 1 USD erhalten Sie 100 Basis-Credits zuzüglich eines etwaigen Paketbonus. Die Modellpreise in Credits und USD entsprechen dem Stand vom 5. November. Den aktuellen Verbrauch und Preis sehen Sie auf der Generierungsseite.",
            "クレジットパックと追加ストレージは米ドル建てです。1米ドルで基本クレジットを100獲得でき、パック特典は別途加算されます。モデルのクレジット数と米ドル価格は11月5日時点の参考値です。現在の使用量と料金は生成画面をご確認ください。",
            "크레딧 패키지와 추가 저장 공간의 가격은 미국 달러 기준입니다. 1달러당 기본 크레딧 100개가 지급되며 패키지 보너스가 별도로 추가됩니다. 모델별 크레딧과 달러 금액은 11월 5일 기준 참고 요금입니다. 현재 사용량과 요금은 생성 화면에서 확인하세요.",
        ],
        ["积分充值套餐", "Credit packs", "Forfaits de recharge de crédits", "Credit-Aufladepakete", "クレジットパック", "크레딧 패키지"],
        ["套餐", "Pack", "Forfait", "Paket", "プラン", "패키지"],
        ["到账积分", "Credits received", "Crédits reçus", "Erhaltene Credits", "付与クレジット", "지급 크레딧"],
        ["售价 (USD)", "Price (USD)", "Prix (USD)", "Preis (USD)", "価格 (USD)", "가격 (USD)"],
        ["尝鲜包", "Starter pack", "Pack découverte", "Schnupperpaket", "お試しパック", "체험 패키지"],
        ["1,000 积分", "1,000 credits", "1 000 crédits", "1.000 Credits", "1,000 クレジット", "1,000 크레딧"],
        ["轻量包 · 赠 6%", "Light pack · bonus 6%", "Pack léger · 6 % offerts", "Light-Paket · 6 % gratis", "ライトパック · 特典 6%", "라이트 패키지 · 보너스 6%"],
        ["5,300 积分", "5,300 credits", "5 300 crédits", "5.300 Credits", "5,300 クレジット", "5,300 크레딧"],
        ["进阶包 · 赠 10%", "Advanced pack · bonus 10%", "Pack avancé · 10 % offerts", "Advanced-Paket · 10 % gratis", "アドバンスパック · 特典 10%", "고급 패키지 · 보너스 10%"],
        ["11,000 积分", "11,000 credits", "11 000 crédits", "11.000 Credits", "11,000 クレジット", "11,000 크레딧"],
        ["标准包 · 赠 14%", "Standard pack · bonus 14%", "Pack standard · 14 % offerts", "Standard-Paket · 14 % gratis", "標準パック · 特典 14%", "표준 패키지 · 보너스 14%"],
        ["34,200 积分", "34,200 credits", "34 200 crédits", "34.200 Credits", "34,200 クレジット", "34,200 크레딧"],
        ["专业包 · 赠 17%", "Pro pack · bonus 17%", "Pack pro · 17 % offerts", "Pro-Paket · 17 % gratis", "プロパック · 特典 17%", "프로 패키지 · 보너스 17%"],
        ["70,200 积分", "70,200 credits", "70 200 crédits", "70.200 Credits", "70,200 クレジット", "70,200 크레딧"],
        ["工作室包 · 赠 20%", "Studio pack · bonus 20%", "Pack Studio · 20 % offerts", "Studio-Paket · 20 % Bonus", "スタジオパック · 特典 20%", "스튜디오 패키지 · 보너스 20%"],
        ["120,000 积分", "120,000 credits", "120 000 crédits", "120.000 Credits", "120,000 クレジット", "120,000 크레딧"],
        ["团队包 · 赠 22%", "Team pack · bonus 22%", "Pack Équipe · 22 % offerts", "Team-Paket · 22 % Bonus", "チームパック · 特典 22%", "팀 패키지 · 보너스 22%"],
        ["244,000 积分", "244,000 credits", "244 000 crédits", "244.000 Credits", "244,000 クレジット", "244,000 크레딧"],
        ["企业旗舰包 · 赠 24%", "Enterprise flagship pack · bonus 24%", "Pack Entreprise Premium · 24 % offerts", "Enterprise-Flaggschiff-Paket · 24 % Bonus", "エンタープライズフラッグシップ · 特典 24%", "기업 플래그십 패키지 · 보너스 24%"],
        ["372,000 积分", "372,000 credits", "372 000 crédits", "372.000 Credits", "372,000 クレジット", "372,000 크레딧"],
        ["云存储扩容套餐", "Cloud storage add-ons", "Forfait d'extension de stockage cloud", "Cloud-Speicher-Erweiterungspaket", "クラウドストレージ追加プラン", "클라우드 저장 공간 추가"],
        ["容量", "Capacity", "Capacité", "Kapazität", "容量", "용량"],
        ["有效期", "Validity", "Validité", "Gültigkeit", "有効期間", "유효 기간"],
        ["轻量扩容包", "Light storage pack", "Pack d'extension léger", "Leichtes Erweiterungspaket", "ライト追加パック", "라이트 저장 공간"],
        ["1 个月", "1 month", "1 mois", "1 Monat", "1 か月", "1 개월"],
        ["标准扩容包", "Standard storage pack", "Pack d'extension standard", "Standard-Erweiterungspaket", "標準追加パック", "표준 저장 공간"],
        ["专业扩容包", "Pro storage pack", "Pack d'extension professionnel", "Professionelles Erweiterungspaket", "プロ追加パック", "프로 저장 공간"],
        ["进阶扩容包", "Advanced storage pack", "Pack d'extension avancé", "Erweitertes Erweiterungspaket", "アドバンス追加パック", "고급 저장 공간"],
        ["工作室扩容包", "Studio storage pack", "Pack d'extension studio", "Studio-Erweiterungspaket", "スタジオ追加パック", "스튜디오 저장 공간"],
        ["企业扩容包", "Enterprise storage pack", "Pack de extension entreprise", "Unternehmens-Erweiterungspaket", "エンタープライズ追加パック", "기업 저장 공간"],
        ["团队云盘包", "Team cloud pack", "Pack de cloud pour équipe", "Team-Cloud-Paket", "チームクラウドパック", "팀 클라우드 패키지"],
        ["尊享云盘包", "Premium cloud pack", "Pack de cloud premium", "Premium-Cloud-Paket", "プレミアムクラウドパック", "프리미엄 클라우드 패키지"],
        ["图片生成与编辑", "Image generation and editing", "Génération et édition d'images", "Bilderzeugung und -bearbeitung", "画像生成と編集", "이미지 생성 및 편집"],
        ["模型", "Model", "Modèle", "Modell", "モデル", "모델"],
        ["能力", "Capability", "Capacité", "Funktion", "機能", "기능"],
        ["规格", "Specification", "Spécifications", "Spezifikationen", "仕様", "사양"],
        ["积分/张", "credits/image", "crédits/image", "Credits/Bild", "クレジット/枚", "크레딧/장"],
        ["参考价/张 (USD)", "Reference price / image (USD)", "Prix de référence / image (USD)", "Referenzpreis/Bild (USD)", "参考価格 / 枚 (USD)", "참고 가격 / 장 (USD)"],
        ["图生图", "Image to image", "Image vers image", "Bild zu Bild", "画像から画像", "이미지 변환"],
        ["1.4 积分/张", "1.4 credits/image", "1,4 crédits/image", "1,4 Credits/Bild", "1.4 クレジット/枚", "1.4 크레딧/장"],
        ["2.3 积分/张", "2.3 credits/image", "2,3 crédits/image", "2,3 Credits/Bild", "2.3 クレジット/枚", "2.3 크레딧/장"],
        ["5.3 积分/张", "5.3 credits/image", "5,3 crédits/image", "5,3 Credits/Bild", "5.3 クレジット/枚", "5.3 크레딧/장"],
        ["图像编辑", "Image editing", "Édition d'image", "Bildbearbeitung", "画像編集", "이미지 편집"],
        ["默认标准", "Default", "Standard par défaut", "Standard", "標準", "기본"],
        ["1.8 积分/张", "1.8 credits/image", "1,8 crédits/image", "1,8 Credits/Bild", "1.8 クレジット/枚", "1.8 크레딧/장"],
        ["文生图", "Text to image", "Texte en image", "Text zu Bild", "テキストから画像", "텍스트 이미지 생성"],
        ["6.1 积分/张", "6.1 credits/image", "6,1 crédits/image", "6,1 Credits/Bild", "6.1 クレジット/枚", "6.1 크레딧/장"],
        ["1k · 低画质(low)", "1k · Low quality(low)", "1k · basse qualité (low)", "1k · niedrige Qualität (low)", "1k · 低画質(low)", "1k · 저화질(low)"],
        ["1.6 积分/张", "1.6 credits/image", "1,6 crédit/image", "1,6 Credit/Bild", "1.6 クレジット/枚", "1.6 크레딧/장"],
        ["2k · 低画质(low)", "2k · Low quality(low)", "2k · basse qualité (low)", "2k · niedrige Qualität (low)", "2k · 低画質(low)", "2k · 저화질(low)"],
        ["3.2 积分/张", "3.2 credits/image", "3,2 crédits/image", "3,2 Credits/Bild", "3.2 クレジット/枚", "3.2 크레딧/장"],
        ["4k · 低画质(low)", "4k · Low quality(low)", "4k · basse qualité (low)", "4k · niedrige Qualität (low)", "4k · 低画質(low)", "4k · 저화질(low)"],
        ["4.4 积分/张", "4.4 credits/image", "4,4 crédits/image", "4,4 Credits/Bild", "4.4 クレジット/枚", "4.4 크레딧/장"],
        ["1k · 标准(medium)", "1k · Standard(medium)", "1k · Standard (medium)", "1k · Standard (medium)", "1k · 標準(medium)", "1k · 표준(medium)"],
        ["8.8 积分/张", "8.8 credits/image", "8.8 crédits/image", "8.8 Credits/Bild", "8.8 クレジット/枚", "8.8 크레딧/장"],
        ["2k · 标准(medium)", "2k · Standard(medium)", "2k · Standard (medium)", "2k · Standard (medium)", "2k · 標準(medium)", "2k · 표준(medium)"],
        ["17.6 积分/张", "17.6 credits/image", "17.6 crédits/image", "17.6 Credits/Bild", "17.6 クレジット/枚", "17.6 크레딧/장"],
        ["4k · 标准(medium)", "4k · Standard(medium)", "4k · Standard (medium)", "4k · Standard (medium)", "4k · 標準(medium)", "4k · 표준(medium)"],
        ["25.8 积分/张", "25.8 credits/image", "25.8 crédits/image", "25.8 Credits/Bild", "25.8 クレジット/枚", "25.8 크레딧/장"],
        ["1k · 高画质(high)", "1k · High quality(high)", "1k · Haute qualité (high)", "1k · Hohe Qualität (high)", "1k · 高画質(high)", "1k · 고화질(high)"],
        ["31.5 积分/张", "31.5 credits/image", "31.5 crédits/image", "31.5 Credits/Bild", "31.5 クレジット/枚", "31.5 크레딧/장"],
        ["2k · 高画质(high)", "2k · High quality(high)", "2k · haute qualité (high)", "2k · hohe Qualität (high)", "2k · 高画質(high)", "2k · 고화질(high)"],
        ["63.0 积分/张", "63.0 credits/image", "63,0 crédits/image", "63,0 Credits/Bild", "63.0 クレジット/枚", "63.0 크레딧/장"],
        ["4k · 高画质(high)", "4k · High quality(high)", "4k · haute qualité (high)", "4k · hohe Qualität (high)", "4k · 高画質(high)", "4k · 고화질(high)"],
        ["94.5 积分/张", "94.5 credits/image", "94,5 crédits/image", "94,5 Credits/Bild", "94.5 クレジット/枚", "94.5 크레딧/장"],
        ["GPT Image 2 编辑", "GPT Image 2 Edit", "GPT Image 2 Édition", "GPT Image 2 Bearbeitung", "GPT Image 2 編集", "GPT Image 2 편집"],
        ["2.7 积分/张", "2.7 credits/image", "2,7 crédits/image", "2,7 Credits/Bild", "2.7 クレジット/枚", "2.7 크레딧/장"],
        ["Grok Imagine 经济版", "Grok Imagine Economy", "Grok Imagine Version économique", "Grok Imagine Sparversion", "Grok Imagine エコノミー", "Grok Imagine 경제형"],
        ["10.3 积分/张", "10.3 credits/image", "10,3 crédits/image", "10,3 Credits/Bild", "10.3 クレジット/枚", "10.3 크레딧/장"],
        ["通用生图", "Image generation", "Génération d'images générale", "Allgemeine Bildgenerierung", "画像生成", "이미지 생성"],
        ["3.5 积分/张", "3.5 credits/image", "3,5 crédits/image", "3,5 Credits/Bild", "3.5 クレジット/枚", "3.5 크레딧/장"],
        ["4.9 积分/张", "4.9 credits/image", "4,9 crédits/image", "4,9 Credits/Bild", "4.9 クレジット/枚", "4.9 크레딧/장"],
        ["14.2 积分/张", "14.2 credits/image", "14,2 crédits/image", "14,2 Credits/Bild", "14.2 クレジット/枚", "14.2 크레딧/장"],
        ["7.4 积分/张", "7.4 credits/image", "7,4 crédits/image", "7,4 Credits/Bild", "7.4 クレジット/枚", "7.4 크레딧/장"],
        ["28.7 积分/张", "28.7 credits/image", "28,7 crédits/image", "28,7 Credits/Bild", "28.7 クレジット/枚", "28.7 크레딧/장"],
        ["文生图 / 图生图", "Text to image / image to image", "Texte en image / Image en image", "Text zu Bild / Bild zu Bild", "テキストから画像 / 画像から画像", "텍스트 이미지 생성 / 이미지 변환"],
        ["11.4 积分/张", "11.4 credits/image", "11,4 crédits/image", "11,4 Credits/Bild", "11.4 クレジット/枚", "11.4 크레딧/장"],
        ["18.0 积分/张", "18.0 credits/image", "18.0 crédits/image", "18.0 Credits/Bild", "18.0 クレジット/枚", "18.0 크레딧/장"],
        ["22.8 积分/张", "22.8 credits/image", "22.8 crédits/image", "22.8 Credits/Bild", "22.8 クレジット/枚", "22.8 크레딧/장"],
        ["19.6 积分/张", "19.6 credits/image", "19.6 crédits/image", "19.6 Credits/Bild", "19.6 クレジット/枚", "19.6 크레딧/장"],
        ["6.6 积分/张", "6.6 credits/image", "6.6 crédits/image", "6.6 Credits/Bild", "6.6 クレジット/枚", "6.6 크레딧/장"],
        ["13.2 积分/张", "13.2 credits/image", "13.2 crédits/image", "13.2 Credits/Bild", "13.2 クレジット/枚", "13.2 크레딧/장"],
        ["万相 2.5 Preview", "Wanxiang 2.5 Preview", "Wanxiang 2.5 Preview", "Wanxiang 2.5 Preview", "Wanxiang 2.5 Preview", "Wanxiang 2.5 Preview"],
        ["万相 (2.7 Edit Pro)", "Wanxiang (2.7 Edit Pro)", "Wanxiang (2.7 Edit Pro)", "Wanxiang (2.7 Edit Pro)", "Wanxiang (2.7 Edit Pro)", "Wanxiang (2.7 Edit Pro)"],
        ["千问 2.0", "Qwen 2.0", "Qwen 2.0", "Qwen 2.0", "Qwen 2.0", "Qwen 2.0"],
        ["文生图 / 图像编辑", "Text to image / image editing", "Texte en image / Édition d'images", "Text zu Bild / Bildbearbeitung", "テキストから画像 / 画像編集", "텍스트 이미지 생성 / 이미지 편집"],
        ["千问 3.0 图像编辑", "Qwen 3.0 Image editing", "Qwen 3.0 Édition d'images", "Qwen 3.0 Bildbearbeitung", "Qwen 3.0 画像編集", "Qwen 3.0 이미지 편집"],
        ["8.2 积分/张", "8.2 credits/image", "8,2 crédits/image", "8,2 Credits/Bild", "8.2 クレジット/枚", "8.2 크레딧/장"],
        ["悠船 V8.2 快速", "Midjourney V8.2 Fast", "YouChuan V8.2 Rapide", "YouChuan V8.2 Schnell", "Midjourney V8.2 高速", "Midjourney V8.2 고속"],
        ["13.1 积分/张", "13.1 credits/image", "13,1 crédits/image", "13,1 Credits/Bild", "13.1 クレジット/枚", "13.1 크레딧/장"],
        [
            "悠船 (V6 / V7 / Niji 7 / V8.1 / V8.2预览)",
            "Midjourney (V6 / V7 / Niji 7 / V8.1 / V8.2Preview)",
            "YouChuan (V6 / V7 / Niji 7 / V8.1 / V8.2 aperçu)",
            "YouChuan (V6 / V7 / Niji 7 / V8.1 / V8.2 Vorschau)",
            "Midjourney (V6 / V7 / Niji 7 / V8.1 / V8.2プレビュー)",
            "Midjourney (V6 / V7 / Niji 7 / V8.1 / V8.2미리보기)",
        ],
        ["14.7 积分/张", "14.7 credits/image", "14,7 crédits/image", "14,7 Credits/Bild", "14.7 クレジット/枚", "14.7 크레딧/장"],
        ["视频生成（按秒）", "Video generation (per second)", "Génération vidéo (par seconde)", "Videoerstellung (pro Sekunde)", "動画生成（秒単位）", "동영상 생성(초당)"],
        ["积分/秒", "credits/second", "crédits/seconde", "Credits/Sekunde", "クレジット/秒", "크레딧/초"],
        ["参考价/秒 (USD)", "Reference price / second (USD)", "prix de référence/seconde (USD)", "Referenzpreis/Sekunde (USD)", "参考価格 / 秒 (USD)", "참고 가격 / 초 (USD)"],
        ["图生视频", "Image to video", "Image en vidéo", "Bild zu Video", "画像から動画", "이미지 동영상 생성"],
        ["1.8 积分/秒", "1.8 credits/second", "1,8 crédit/seconde", "1,8 Credits/Sekunde", "1.8 クレジット/秒", "1.8 크레딧/초"],
        ["文生 / 图生视频", "Text / image to video", "Texte en / image en vidéo", "Text-zu-/Bild-zu-Video", "テキスト / 画像から動画", "텍스트 / 이미지 동영상 생성"],
        ["4.9 积分/秒", "4.9 credits/second", "4,9 crédits/seconde", "4,9 Credits/Sekunde", "4.9 クレジット/秒", "4.9 크레딧/초"],
        ["6.6 积分/秒", "6.6 credits/second", "6,6 crédits/seconde", "6,6 Credits/Sekunde", "6.6 クレジット/秒", "6.6 크레딧/초"],
        ["8.2 积分/秒", "8.2 credits/second", "8,2 crédits/seconde", "8,2 Credits/Sekunde", "8.2 クレジット/秒", "8.2 크레딧/초"],
        ["14.7 积分/秒", "14.7 credits/second", "14,7 crédits/seconde", "14,7 Credits/Sekunde", "14.7 クレジット/秒", "14.7 크레딧/초"],
        ["文生视频", "Text to video", "Texte en vidéo", "Text zu Video", "テキストから動画", "텍스트 동영상 생성"],
        ["5.3 积分/秒", "5.3 credits/second", "5,3 crédits/seconde", "5,3 Credits/Sekunde", "5.3 クレジット/秒", "5.3 크레딧/초"],
        ["12.6 积分/秒", "12.6 credits/second", "12,6 crédits/seconde", "12,6 Credits/Sekunde", "12.6 クレジット/秒", "12.6 크레딧/초"],
        ["9.8 积分/秒", "9.8 credits/second", "9,8 crédits/seconde", "9,8 Credits/Sekunde", "9.8 クレジット/秒", "9.8 크레딧/초"],
        ["22.8 积分/秒", "22.8 credits/second", "22,8 crédits/seconde", "22,8 Credits/Sekunde", "22.8 クレジット/秒", "22.8 크레딧/초"],
        ["16.3 积分/秒", "16.3 credits/second", "16,3 crédits/seconde", "16,3 Credits/Sekunde", "16.3 クレジット/秒", "16.3 크레딧/초"],
        ["13.1 积分/秒", "13.1 credits/second", "13,1 crédits/seconde", "13,1 Credits/Sekunde", "13.1 クレジット/秒", "13.1 크레딧/초"],
        ["25.5 积分/秒", "25.5 credits/second", "25,5 crédits/seconde", "25,5 Credits/Sekunde", "25.5 クレジット/秒", "25.5 크레딧/초"],
        ["31.9 积分/秒", "31.9 credits/second", "31,9 crédits/seconde", "31,9 Credits/Sekunde", "31.9 クレジット/秒", "31.9 크레딧/초"],
        ["38.2 积分/秒", "38.2 credits/second", "38,2 crédits/seconde", "38,2 Credits/Sekunde", "38.2 クレジット/秒", "38.2 크레딧/초"],
        ["默认 / 480p", "Default / 480p", "Par défaut / 480p", "Standard / 480p", "標準 / 480p", "기본 / 480p"],
        ["27.1 积分/秒", "27.1 credits/second", "27,1 crédits/seconde", "27,1 Credits/Sekunde", "27.1 クレジット/秒", "27.1 크레딧/초"],
        ["图生视频 (Pro)", "Image to video (Pro)", "Image en vidéo (Pro)", "Bild zu Video (Pro)", "画像から動画 (Pro)", "이미지 동영상 생성 (Pro)"],
        ["参考生视频 (Drama)", "Reference to video (Drama)", "Référence en vidéo (Drama)", "Referenz zu Video (Drama)", "参照画像から動画 (Drama)", "참조 동영상 생성 (Drama)"],
        ["可灵 3.0 Pro", "Kling 3.0 Pro", "Kling 3.0 Pro", "Kling 3.0 Pro", "Kling 3.0 Pro", "Kling 3.0 Pro"],
        ["无声", "Silent", "Muet", "Stumm", "音声なし", "무음"],
        ["有声", "With sound", "Avec son", "Mit Ton", "音声あり", "음성 포함"],
        ["24.5 积分/秒", "24.5 credits/second", "24,5 crédits/seconde", "24,5 Credits/Sekunde", "24.5 クレジット/秒", "24.5 크레딧/초"],
        ["可灵 4.0", "Kling 4.0", "Kling 4.0", "Kling 4.0", "Kling 4.0", "Kling 4.0"],
        ["30.3 积分/秒", "30.3 credits/second", "30,3 crédits/seconde", "30,3 Credits/Sekunde", "30.3 クレジット/秒", "30.3 크레딧/초"],
        ["47.8 积分/秒", "47.8 credits/second", "47,8 crédits/seconde", "47,8 Credits/Sekunde", "47.8 クレジット/秒", "47.8 크레딧/초"],
        ["79.6 积分/秒", "79.6 credits/second", "79,6 crédits/seconde", "79,6 Credits/Sekunde", "79.6 クレジット/秒", "79.6 크레딧/초"],
        ["视频生成（按条）", "Video generation (per clip)", "Génération vidéo (par clip)", "Videoerzeugung (pro Clip)", "動画生成（クリップ単位）", "동영상 생성(클립당)"],
        ["积分/条", "credits/clip", "Crédits/clip", "Credits/Clip", "クレジット/クリップ", "크레딧/클립"],
        ["参考价/条 (USD)", "Reference price / clip (USD)", "Prix de référence/clip (USD)", "Referenzpreis/Clip (USD)", "参考価格 / クリップ (USD)", "참고 가격 / 클립 (USD)"],
        ["6.6 积分/条", "6.6 credits/clip", "6,6 crédits/clip", "6,6 Credits/Clip", "6.6 クレジット/クリップ", "6.6 크레딧/클립"],
        ["11.4 积分/条", "11.4 credits/clip", "11,4 crédits/clip", "11,4 Credits/Clip", "11.4 クレジット/クリップ", "11.4 크레딧/클립"],
        ["18.0 积分/条", "18.0 credits/clip", "18,0 crédits/clip", "18,0 Credits/Clip", "18.0 クレジット/クリップ", "18.0 크레딧/클립"],
        ["41.4 积分/条", "41.4 credits/clip", "41,4 crédits/clip", "41,4 Credits/Clip", "41.4 クレジット/クリップ", "41.4 크레딧/클립"],
        ["38.2 积分/条", "38.2 credits/clip", "38,2 crédits/clip", "38,2 Credits/Clip", "38.2 クレジット/クリップ", "38.2 크레딧/클립"],
        ["60.5 积分/条", "60.5 credits/clip", "60,5 crédits/clip", "60,5 Credits/Clip", "60.5 クレジット/クリップ", "60.5 크레딧/클립"],
        ["9.8 积分/条", "9.8 credits/clip", "9,8 crédits/pièce", "9,8 Credits/Stück", "9.8 クレジット/クリップ", "9.8 크레딧/클립"],
        ["16.3 积分/条", "16.3 credits/clip", "16,3 crédits/pièce", "16,3 Credits/Stück", "16.3 クレジット/クリップ", "16.3 크레딧/클립"],
        ["19.6 积分/条", "19.6 credits/clip", "19,6 crédits/pièce", "19,6 Credits/Stück", "19.6 クレジット/クリップ", "19.6 크레딧/클립"],
        ["31.9 积分/条", "31.9 credits/clip", "31,9 crédits/pièce", "31,9 Credits/Stück", "31.9 クレジット/クリップ", "31.9 크레딧/클립"],
        ["24.5 积分/条", "24.5 credits/clip", "24,5 crédits/pièce", "24,5 Credits/Stück", "24.5 クレジット/クリップ", "24.5 크레딧/클립"],
        ["25.5 积分/条", "25.5 credits/clip", "25,5 crédits/pièce", "25,5 Credits/Stück", "25.5 クレジット/クリップ", "25.5 크레딧/클립"],
        ["49.4 积分/条", "49.4 credits/clip", "49,4 crédits/pièce", "49,4 Credits/Stück", "49.4 クレジット/クリップ", "49.4 크레딧/클립"],
        ["57.3 积分/条", "57.3 credits/clip", "57,3 crédits/pièce", "57,3 Credits/Stück", "57.3 クレジット/クリップ", "57.3 크레딧/클립"],
        ["92.3 积分/条", "92.3 credits/clip", "92,3 crédits/clip", "92,3 Credits/Clip", "92.3 クレジット/クリップ", "92.3 크레딧/클립"],
        ["可灵 2.6 标准版", "Kling 2.6 Standard", "Kling 2.6 Édition Standard", "Kling 2.6 Standard", "Kling 2.6 標準版", "Kling 2.6 표준형"],
        ["47.8 积分/条", "47.8 credits/clip", "47,8 crédits/clip", "47,8 Credits/Clip", "47.8 クレジット/クリップ", "47.8 크레딧/클립"],
        ["可灵 2.5 Turbo 标准档", "Kling 2.5 Turbo Standard tier", "Kling 2.5 Turbo – palier Standard", "Kling 2.5 Turbo – Standard-Stufe", "Kling 2.5 Turbo 標準区分", "Kling 2.5 Turbo 표준 구간"],
        ["28.7 积分/条", "28.7 credits/clip", "28,7 crédits/clip", "28,7 Credits/Clip", "28.7 クレジット/クリップ", "28.7 크레딧/클립"],
        ["55.7 积分/条", "55.7 credits/clip", "55,7 crédits/clip", "55,7 Credits/Clip", "55.7 クレジット/クリップ", "55.7 크레딧/클립"],
        ["悠船 图生视频", "Midjourney Image to video", "YouChuan – image en vidéo", "YouChuan – Bild zu Video", "Midjourney 画像から動画", "Midjourney 이미지 동영상 생성"],
        ["14.7 积分/条", "14.7 credits/clip", "14,7 crédits/clip", "14,7 Credits/Clip", "14.7 クレジット/クリップ", "14.7 크레딧/클립"],
        ["43.0 积分/条", "43.0 credits/clip", "43,0 crédits/clip", "43,0 Credits/Clip", "43.0 クレジット/クリップ", "43.0 크레딧/클립"],
        ["Sora 2 经济版", "Sora 2 Economy", "Sora 2 version économique", "Sora 2 Economy", "Sora 2 エコノミー", "Sora 2 경제형"],
        ["Grok Imagine 视频", "Grok Imagine Video", "Vidéo Grok Imagine", "Grok Imagine Video", "Grok Imagine 動画", "Grok Imagine 동영상"],
        ["71.6 积分/条", "71.6 credits/clip", "71,6 crédits/clip", "71,6 Credits/Clip", "71.6 クレジット/クリップ", "71.6 크레딧/클립"],
        ["海螺 2.3 Fast", "Hailuo 2.3 Fast", "Hailuo 2.3 Fast", "Hailuo 2.3 Fast", "Hailuo 2.3 Fast", "Hailuo 2.3 Fast"],
        ["27.1 积分/条", "27.1 credits/clip", "27,1 crédits/clip", "27,1 Credits/Clip", "27.1 クレジット/クリップ", "27.1 크레딧/클립"],
        ["海螺 02 Pro / 2.3 Pro", "Hailuo 02 Pro / 2.3 Pro", "Hailuo 02 Pro / 2.3 Pro", "Hailuo 02 Pro / 2.3 Pro", "Hailuo 02 Pro / 2.3 Pro", "Hailuo 02 Pro / 2.3 Pro"],
        ["70.0 积分/条", "70.0 credits/clip", "70,0 crédits/clip", "70,0 Credits/Clip", "70.0 クレジット/クリップ", "70.0 크레딧/클립"],
        ["文本生成", "Text generation", "Génération de texte", "Textgenerierung", "テキスト生成", "텍스트 생성"],
        ["计费项目", "Billing item", "Élément facturé", "Abrechnungsposten", "課金項目", "과금 항목"],
        ["积分/百万 Token", "Credits / 1M tokens", "Crédits/million de tokens", "Credits/Million Token", "クレジット / 100万トークン", "크레딧 / 백만 토큰"],
        ["参考价/百万 Token (USD)", "Reference price / 1M tokens (USD)", "Prix de référence/million de tokens (USD)", "Referenzpreis/Million Token (USD)", "参考価格 / 100万トークン (USD)", "참고 가격 / 백만 토큰 (USD)"],
        ["文本输入 Token", "Input tokens", "Tokens d'entrée de texte", "Text-Eingabe-Tokens", "入力トークン", "입력 토큰"],
        ["1M 上下文 · 输出上限 32K", "1M context · output limit 32K", "Contexte 1M · sortie max. 32K", "1M Kontext · Ausgabe-Limit 32K", "1M コンテキスト · 出力上限 32K", "1M 컨텍스트 · 출력 한도 32K"],
        ["700 积分/百万Token", "700 credits/1M tokens", "700 crédits/million de tokens", "700 Credits/Million Token", "700 クレジット/100万トークン", "700 크레딧/백만 토큰"],
        ["文本输出 Token", "Output tokens", "Tokens de sortie de texte", "Text-Ausgabe-Tokens", "出力トークン", "출력 토큰"],
        ["3,500 积分/百万Token", "3,500 credits/1M tokens", "3 500 crédits/million de tokens", "3.500 Credits/Million Token", "3,500 クレジット/100万トークン", "3,500 크레딧/백만 토큰"],
        ["1.05M 上下文 · ≤272K 输入档", "1.05M context · ≤272K input tier", "1,05 M de contexte · niveau d'entrée ≤272K", "1,05 M Kontext · ≤272K Eingangsstufe", "1.05M コンテキスト · ≤272K 入力区分", "1.05M 컨텍스트 · ≤272K 입력 구간"],
        ["2,625 积分/百万Token", "2,625 credits/1M tokens", "2 625 crédits/million de tokens", "2.625 Credits/Million Token", "2,625 クレジット/100万トークン", "2,625 크레딧/백만 토큰"],
        ["15,750 积分/百万Token", "15,750 credits/1M tokens", "15 750 crédits/million de tokens", "15.750 Credits/Million Token", "15,750 クレジット/100万トークン", "15,750 크레딧/백만 토큰"],
        ["87.5 积分/百万Token", "87.5 credits/1M tokens", "87,5 crédits/million de tokens", "87,5 Credits/Million Token", "87.5 クレジット/100万トークン", "87.5 크레딧/백만 토큰"],
        ["437.5 积分/百万Token", "437.5 credits/1M tokens", "437,5 crédits/million de tokens", "437,5 Credits/Million Token", "437.5 クレジット/100万トークン", "437.5 크레딧/백만 토큰"],
        ["256K 上下文 · 平价档", "256K context · Budget tier", "256K de contexte · niveau économique", "256K Kontext · Einstiegspreisstufe", "256K コンテキスト · 低価格帯", "256K 컨텍스트 · 저가형"],
        ["10.5 积分/百万Token", "10.5 credits/1M tokens", "10,5 crédits/million de tokens", "10,5 Credits/Million Token", "10.5 クレジット/100万トークン", "10.5 크레딧/백만 토큰"],
        ["35 积分/百万Token", "35 credits/1M tokens", "35 crédits / million de tokens", "35 Credits pro Million Tokens", "35 クレジット/100万トークン", "35 크레딧/백만 토큰"],
        ["1M 上下文 · 平价档", "1M context · Budget tier", "1M de contexte · gamme économique", "1M Kontext · Preiswerte Stufe", "1M コンテキスト · 低価格帯", "1M 컨텍스트 · 저가형"],
        ["7.2275 积分/百万Token", "7.2275 credits/1M tokens", "7.2275 crédits / million de tokens", "7.2275 Credits pro Million Tokens", "7.2275 クレジット/100万トークン", "7.2275 크레딧/백만 토큰"],
        ["24.3775 积分/百万Token", "24.3775 credits/1M tokens", "24.3775 crédits / million de tokens", "24.3775 Credits pro Million Tokens", "24.3775 クレジット/100万トークン", "24.3775 크레딧/백만 토큰"],
        [
            "具体可用模型、规格与最终扣费以产品页面为准。",
            "Available models, specifications and charges are shown in the product.",
            "Les modèles disponibles, les spécifications et la facturation finale font foi sur la page du produit.",
            "Verfügbare Modelle, Spezifikationen und die endgültige Abrechnung richten sich nach der Produktseite.",
            "利用可能なモデル、仕様、最終料金は製品画面をご確認ください。",
            "사용 가능한 모델, 사양 및 최종 요금은 제품 화면을 확인하세요.",
        ],
        [
            "Supdance · 价格以实际购买页面为准。",
            "Supdance · Prices shown at checkout prevail.",
            "Supdance · Les prix sont indiqués sur la page d'achat réelle.",
            "Supdance · Preise gemäß der tatsächlichen Kaufseite.",
            "Supdance · 決済画面の価格が優先されます。",
            "Supdance · 결제 화면의 가격이 우선합니다.",
        ],
        ["Supdance 首页", "Supdance home", "Accueil de Supdance", "Supdance-Startseite", "Supdance ホーム", "Supdance 홈"],
        ["页面导航", "Page navigation", "Navigation de la page", "Seitennavigation", "ページナビゲーション", "페이지 탐색"],
        ["语言", "Language", "Langue", "Sprache", "言語", "언어"],
        ["切换明暗主题", "Toggle light and dark theme", "Basculer le thème clair/sombre", "Hell-/Dunkeldesign umschalten", "明暗テーマを切り替え", "밝은/어두운 테마 전환"],
        ["缓存读取 Token", "Cached input tokens", "Tokens lus en cache", "Cache-Lese-Tokens", "キャッシュ読み取りトークン", "캐시 읽기 토큰"],
        ["缓存写入 Token", "Cache write tokens", "Tokens écrits en cache", "Cache-Schreib-Tokens", "キャッシュ書き込みトークン", "캐시 쓰기 토큰"],
        ["缓存写入 Token（1小时）", "Cache write tokens (1 hour)", "Tokens écrits en cache (1 heure)", "Cache-Schreib-Tokens (1 Stunde)", "キャッシュ書き込みトークン（1時間）", "캐시 쓰기 토큰 (1시간)"],
        ["1.05M 上下文 · >272K 输入档", "1.05M context · >272K input tier", "1,05 M de contexte · niveau d'entrée >272K", "1,05 M Kontext · >272K Eingangsstufe", "1.05M コンテキスト · >272K 入力区分", "1.05M 컨텍스트 · >272K 입력 구간"],
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
        if (node.nodeValue.trim() && node.parentElement.closest("main, header") && !node.parentElement.closest("select, script, style")) nodes.push([node, node.nodeValue]);
    }
    const attributes = Array.from(document.querySelectorAll("[aria-label]"), (element) => [element, element.getAttribute("aria-label")]);
    const translations = new Map(terms.map((row) => [row[0], row]));
    function translate(source, index) {
        if (index === 0) return source;
        const text = source.trim();
        const credits = /^([\d,]+(?:\.\d+)?) 积分\/百万Token$/.exec(text);
        if (credits) {
            const units = ["积分/百万Token", "credits/1M tokens", "crédits/million de tokens", "Credits/Million Token", "クレジット/100万トークン", "크레딧/백만 토큰"];
            return source.replace(text, () => `${credits[1]} ${units[index]}`);
        }
        const translated = translations.get(text)?.[index];
        return translated ? source.replace(text, () => translated) : source;
    }
    function setLocale(locale) {
        const index = Math.max(0, locales.indexOf(locale));
        root.lang = locales[index];
        selector.value = locales[index];
        for (const [node, source] of nodes) node.nodeValue = translate(source, index);
        for (const [element, source] of attributes) element.setAttribute("aria-label", translate(source, index));
        document.title = translate("价目表", index) + " · Supdance";
        localStorage.setItem("yingce:locale", JSON.stringify({ state: { locale: locales[index] }, version: 0 }));
        document.querySelector('meta[name="description"]')?.setAttribute("content", translate("Supdance 积分套餐、云存储与 AI 模型公开价目表。", index));
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
    let savedLocale;
    try {
        savedLocale = JSON.parse(localStorage.getItem("yingce:locale") || "null")?.state?.locale;
    } catch (_) {
        savedLocale = null;
    }
    const detected = (navigator.languages || [navigator.language]).map((language) => locales.find((locale) => locale === language || locale.split("-")[0] === language.split("-")[0])).find(Boolean);
    setLocale(locales.includes(requested) ? requested : locales.includes(savedLocale) ? savedLocale : detected || "zh-CN");
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
