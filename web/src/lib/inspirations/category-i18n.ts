/**
 * 灵感目录分类标签的六语映射。
 *
 * 目录 JSON 与 manifest 里的分类标签是简中原文，且同一分类码在不同来源下可能对应不同标签，
 * 因此这里按“简中标签”建表而不是按分类码，避免跨来源的同码不同名互相覆盖。
 * 不走 i18n 词典的原文匹配：像“角色”“其他”这类词在后台与技能命名空间已有另一套释义，
 * 按原文整站替换会把灵感分类译成管理后台的说法。
 */
import type { SupDanceLocaleCode } from "@/supdance/plugins/i18n/types";

type CategoryLocales = Record<SupDanceLocaleCode, string>;

const INSPIRATION_CATEGORY_LABELS: Record<string, CategoryLocales> = {
    "3D 卡通": { "zh-CN": "3D 卡通", "en-US": "3D Cartoon", "zh-TW": "3D 卡通", "ja-JP": "3D カートゥーン", "ko-KR": "3D 카툰", "es-ES": "Dibujo animado 3D" },
    "3D 渲染": { "zh-CN": "3D 渲染", "en-US": "3D Render", "zh-TW": "3D 渲染", "ja-JP": "3D レンダリング", "ko-KR": "3D 렌더링", "es-ES": "Render 3D" },
    "草图 / 线稿": { "zh-CN": "草图 / 线稿", "en-US": "Sketch / Line Art", "zh-TW": "草圖／線稿", "ja-JP": "ラフ／線画", "ko-KR": "스케치／선화", "es-ES": "Boceto / Línea" },
    插画: { "zh-CN": "插画", "en-US": "Illustration", "zh-TW": "插畫", "ja-JP": "イラスト", "ko-KR": "일러스트", "es-ES": "Ilustración" },
    插画创作: { "zh-CN": "插画创作", "en-US": "Illustration", "zh-TW": "插畫創作", "ja-JP": "イラスト制作", "ko-KR": "일러스트 제작", "es-ES": "Ilustración" },
    产品: { "zh-CN": "产品", "en-US": "Product", "zh-TW": "產品", "ja-JP": "製品", "ko-KR": "제품", "es-ES": "Producto" },
    产品广告分镜: { "zh-CN": "产品广告分镜", "en-US": "Product Ad Shot List", "zh-TW": "產品廣告分鏡", "ja-JP": "商品広告のカット割り", "ko-KR": "제품 광고 컷 구성", "es-ES": "Lista de planos de anuncio de producto" },
    产品拍摄: { "zh-CN": "产品拍摄", "en-US": "Product Photography", "zh-TW": "產品拍攝", "ja-JP": "プロダクト撮影", "ko-KR": "제품 촬영", "es-ES": "Fotografía de producto" },
    产品营销: { "zh-CN": "产品营销", "en-US": "Product Marketing", "zh-TW": "產品行銷", "ja-JP": "プロダクトマーケティング", "ko-KR": "제품 마케팅", "es-ES": "Marketing de producto" },
    车辆: { "zh-CN": "车辆", "en-US": "Vehicle", "zh-TW": "車輛", "ja-JP": "車両", "ko-KR": "차량", "es-ES": "Vehículo" },
    "城市风光 / 街道": { "zh-CN": "城市风光 / 街道", "en-US": "Cityscape / Street", "zh-TW": "城市風光／街道", "ja-JP": "街並み／ストリート", "ko-KR": "도시 풍경／거리", "es-ES": "Panorama urbano / Calle" },
    宠物与动物: { "zh-CN": "宠物与动物", "en-US": "Pets & Animals", "zh-TW": "寵物與動物", "ja-JP": "ペットと動物", "ko-KR": "반려동물과 동물", "es-ES": "Mascotas y animales" },
    达人测评: { "zh-CN": "达人测评", "en-US": "Creator Review", "zh-TW": "達人評測", "ja-JP": "クリエイターレビュー", "ko-KR": "크리에이터 리뷰", "es-ES": "Reseña de creador" },
    打斗编排: { "zh-CN": "打斗编排", "en-US": "Fight Choreography", "zh-TW": "打鬥編排", "ja-JP": "アクション振付", "ko-KR": "액션 안무", "es-ES": "Coreografía de pelea" },
    等距: { "zh-CN": "等距", "en-US": "Isometric", "zh-TW": "等距", "ja-JP": "アイソメトリック", "ko-KR": "아이소메트릭", "es-ES": "Isométrico" },
    电商主图: { "zh-CN": "电商主图", "en-US": "E-commerce Hero Image", "zh-TW": "電商主圖", "ja-JP": "EC メイン画像", "ko-KR": "이커머스 대표 이미지", "es-ES": "Imagen principal de comercio electrónico" },
    "电影 / 电影剧照": { "zh-CN": "电影 / 电影剧照", "en-US": "Film / Cinematic Still", "zh-TW": "電影／電影劇照", "ja-JP": "映画／映画のスチール", "ko-KR": "영화／영화 스틸", "es-ES": "Película / Fotograma" },
    电影感叙事短片: { "zh-CN": "电影感叙事短片", "en-US": "Cinematic Narrative Short", "zh-TW": "電影感敘事短片", "ja-JP": "映画的な短編ストーリー", "ko-KR": "영화 같은 서사 단편", "es-ES": "Cortometraje narrativo cinematográfico" },
    定格动画节奏: { "zh-CN": "定格动画节奏", "en-US": "Stop-Motion Rhythm", "zh-TW": "定格動畫節奏", "ja-JP": "ストップモーションの節奏", "ko-KR": "스톱 모션 리듬", "es-ES": "Ritmo de stop motion" },
    "动漫 / 漫画": { "zh-CN": "动漫 / 漫画", "en-US": "Anime / Manga", "zh-TW": "動漫／漫畫", "ja-JP": "アニメ／マンガ", "ko-KR": "애니／만화", "es-ES": "Anime / Manga" },
    动漫风格: { "zh-CN": "动漫风格", "en-US": "Anime Style", "zh-TW": "動漫風格", "ja-JP": "アニメ調", "ko-KR": "애니메이션 스타일", "es-ES": "Estilo anime" },
    动漫风格锁定: { "zh-CN": "动漫风格锁定", "en-US": "Anime Style Lock", "zh-TW": "動漫風格鎖定", "ja-JP": "アニメ調スタイル固定", "ko-KR": "애니메이션 스타일 고정을", "es-ES": "Estilo anime fijo" },
    "动物 / 生物": { "zh-CN": "动物 / 生物", "en-US": "Animal / Creature", "zh-TW": "動物／生物", "ja-JP": "動物／生物", "ko-KR": "동물／생물", "es-ES": "Animal / Criatura" },
    对白表演节拍: { "zh-CN": "对白表演节拍", "en-US": "Dialogue Performance Beats", "zh-TW": "對白表演節拍", "ja-JP": "台詞演技のビート", "ko-KR": "대사 연기 박자", "es-ES": "Marcos de actuación en diálogo" },
    分镜表转视频: { "zh-CN": "分镜表转视频", "en-US": "Storyboard Grid to Video", "zh-TW": "分鏡表轉影片", "ja-JP": "絵コンテ表から動画へ", "ko-KR": "스토리보드 표를 영상으로", "es-ES": "Guion gráfico a vídeo" },
    "风景 / 自然": { "zh-CN": "风景 / 自然", "en-US": "Landscape / Nature", "zh-TW": "風景／自然", "ja-JP": "風景／自然", "ko-KR": "풍경／자연", "es-ES": "Paisaje / Naturaleza" },
    "复古 / 怀旧": { "zh-CN": "复古 / 怀旧", "en-US": "Retro / Nostalgic", "zh-TW": "復古／懷舊", "ja-JP": "レトロ／ノスタルジック", "ko-KR": "레트로／향수", "es-ES": "Retro / Nostálgico" },
    复古伪纪录: { "zh-CN": "复古伪纪录", "en-US": "Retro Mockumentary", "zh-TW": "復古偽紀錄", "ja-JP": "レトロなモキュメンタリー", "ko-KR": "레트로 목 인터뷰", "es-ES": "Falso documental retro" },
    "个人资料 / 头像": { "zh-CN": "个人资料 / 头像", "en-US": "Profile / Avatar", "zh-TW": "個人檔案／頭像", "ja-JP": "プロフィール／アバター", "ko-KR": "프로필／아바타", "es-ES": "Perfil / Avatar" },
    梗图喜剧: { "zh-CN": "梗图喜剧", "en-US": "Meme Comedy", "zh-TW": "梗圖喜劇", "ja-JP": "ミームコメディ", "ko-KR": "밈 코미디", "es-ES": "Comedia de memes" },
    过程变身蒙太奇: { "zh-CN": "过程变身蒙太奇", "en-US": "Transformation Montage", "zh-TW": "過程變身蒙太奇", "ja-JP": "プロセス変身モンタージュ", "ko-KR": "과정 변신 몽타주", "es-ES": "Montaje de transformación" },
    "海报 / 传单": { "zh-CN": "海报 / 传单", "en-US": "Poster / Flyer", "zh-TW": "海報／傳單", "ja-JP": "ポスター／チラシ", "ko-KR": "포스터／전단", "es-ES": "Póster / Folleto" },
    海报设计: { "zh-CN": "海报设计", "en-US": "Poster Design", "zh-TW": "海報設計", "ja-JP": "ポスターデザイン", "ko-KR": "포스터 디자인", "es-ES": "Diseño de póster" },
    极简主义: { "zh-CN": "极简主义", "en-US": "Minimalism", "zh-TW": "極簡主義", "ja-JP": "ミニマリズム", "ko-KR": "미니멀리즘", "es-ES": "Minimalismo" },
    "建筑 / 室内设计": { "zh-CN": "建筑 / 室内设计", "en-US": "Architecture / Interior Design", "zh-TW": "建築／室內設計", "ja-JP": "建築／インテリアデザイン", "ko-KR": "건축／인테리어 디자인", "es-ES": "Arquitectura / Diseño de interiores" },
    角色: { "zh-CN": "角色", "en-US": "Character", "zh-TW": "角色", "ja-JP": "キャラクター", "ko-KR": "캐릭터", "es-ES": "Personaje" },
    角色一致性: { "zh-CN": "角色一致性", "en-US": "Character Consistency", "zh-TW": "角色一致性", "ja-JP": "キャラクターの一貫性", "ko-KR": "캐릭터 일관성", "es-ES": "Coherencia de personaje" },
    恐怖悬疑: { "zh-CN": "恐怖悬疑", "en-US": "Horror & Suspense", "zh-TW": "恐怖懸疑", "ja-JP": "ホラー＆サスペンス", "ko-KR": "공포 서스펜스", "es-ES": "Terror y suspenso" },
    旅行城市漫步: { "zh-CN": "旅行城市漫步", "en-US": "Travel City Walk", "zh-TW": "旅行城市漫遊", "ja-JP": "旅の街歩き", "ko-KR": "여행 도시 산책", "es-ES": "Paseo urbano de viaje" },
    "漫画 / 故事板": { "zh-CN": "漫画 / 故事板", "en-US": "Comic / Storyboard", "zh-TW": "漫畫／故事板", "ja-JP": "コミック／ストーリーボード", "ko-KR": "만화／스토리보드", "es-ES": "Cómic / Storyboard" },
    "漫画 / 图画小说": { "zh-CN": "漫画 / 图画小说", "en-US": "Comic / Graphic Novel", "zh-TW": "漫畫／圖畫小說", "ja-JP": "コミック／グラフィックノベル", "ko-KR": "만화／그래픽 노블", "es-ES": "Cómic / Novela gráfica" },
    "美食 ASMR": { "zh-CN": "美食 ASMR", "en-US": "Food ASMR", "zh-TW": "美食 ASMR", "ja-JP": "グルメ ASMR", "ko-KR": "음식 ASMR", "es-ES": "ASMR de comida" },
    品牌设计: { "zh-CN": "品牌设计", "en-US": "Brand Design", "zh-TW": "品牌設計", "ja-JP": "ブランドデザイン", "ko-KR": "브랜드 디자인", "es-ES": "Diseño de marca" },
    其他: { "zh-CN": "其他", "en-US": "Other", "zh-TW": "其他", "ja-JP": "その他", "ko-KR": "기타", "es-ES": "Otros" },
    汽车与载具: { "zh-CN": "汽车与载具", "en-US": "Cars & Vehicles", "zh-TW": "汽車與載具", "ja-JP": "自動車と乗り物", "ko-KR": "자동차 및 탈것", "es-ES": "Coches y vehículos" },
    "人像 / 自拍": { "zh-CN": "人像 / 自拍", "en-US": "Portrait / Selfie", "zh-TW": "人像／自拍", "ja-JP": "ポートレート／セルフィー", "ko-KR": "인물／셀피", "es-ES": "Retrato / Selfie" },
    人像摄影: { "zh-CN": "人像摄影", "en-US": "Portrait Photography", "zh-TW": "人像攝影", "ja-JP": "ポートレート撮影", "ko-KR": "인물 사진", "es-ES": "Fotografía de retrato" },
    日式美学: { "zh-CN": "日式美学", "en-US": "Japanese Aesthetic", "zh-TW": "日式美學", "ja-JP": "和の美学", "ko-KR": "일본식 미학", "es-ES": "Estética japonesa" },
    "赛博朋克 / 科幻": { "zh-CN": "赛博朋克 / 科幻", "en-US": "Cyberpunk / Sci-Fi", "zh-TW": "賽博龐克／科幻", "ja-JP": "サイバーパンク／SF", "ko-KR": "사이버펑크／SF", "es-ES": "Ciberpunk / Ciencia ficción" },
    社交媒体: { "zh-CN": "社交媒体", "en-US": "Social Media", "zh-TW": "社群媒體", "ja-JP": "ソーシャルメディア", "ko-KR": "소셜 미디어", "es-ES": "Redes sociales" },
    社交媒体帖子: { "zh-CN": "社交媒体帖子", "en-US": "Social Media Post", "zh-TW": "社群媒體貼文", "ja-JP": "ソーシャルメディア投稿", "ko-KR": "소셜 미디어 게시물", "es-ES": "Publicación en redes sociales" },
    摄影: { "zh-CN": "摄影", "en-US": "Photography", "zh-TW": "攝影", "ja-JP": "写真", "ko-KR": "사진", "es-ES": "Fotografía" },
    时间冻结与倒放: { "zh-CN": "时间冻结与倒放", "en-US": "Time Freeze & Rewind", "zh-TW": "時間凍結與倒帶", "ja-JP": "時間の停止と巻き戻し", "ko-KR": "시간 정지와 되감기", "es-ES": "Congelación de tiempo y rebobinado" },
    时间轴分镜脚本: { "zh-CN": "时间轴分镜脚本", "en-US": "Timeline Shot Script", "zh-TW": "時間軸分鏡腳本", "ja-JP": "タイムライン絵コンテ台本", "ko-KR": "타임라인 컷 시나리오", "es-ES": "Guion de tomas por línea de tiempo" },
    时尚编辑: { "zh-CN": "时尚编辑", "en-US": "Fashion Editorial", "zh-TW": "時尚編輯", "ja-JP": "ファッションエディトリアル", "ko-KR": "패션 에디토리얼", "es-ES": "Editorial de moda" },
    时尚单品: { "zh-CN": "时尚单品", "en-US": "Fashion Item", "zh-TW": "時尚單品", "ja-JP": "ファッションアイテム", "ko-KR": "패션 아이템", "es-ES": "Artículo de moda" },
    时尚造型册: { "zh-CN": "时尚造型册", "en-US": "Fashion Lookbook", "zh-TW": "時尚造型冊", "ja-JP": "ファッションルックブック", "ko-KR": "패션 룩북", "es-ES": "Lookbook de moda" },
    "食品 / 饮料": { "zh-CN": "食品 / 饮料", "en-US": "Food / Drink", "zh-TW": "食品／飲料", "ja-JP": "食品／飲料", "ko-KR": "식품／음료", "es-ES": "Comida / Bebida" },
    史诗奇幻科幻: { "zh-CN": "史诗奇幻科幻", "en-US": "Epic Fantasy & Sci-Fi", "zh-TW": "史詩奇幻科幻", "ja-JP": "壮大なファンタジー＆SF", "ko-KR": "서사적 판타지 SF", "es-ES": "Fantasía épica y ciencia ficción" },
    "手持 UGC Vlog": { "zh-CN": "手持 UGC Vlog", "en-US": "Handheld UGC Vlog", "zh-TW": "手持 UGC Vlog", "ja-JP": "ハンドヘルド UGC ブイログ", "ko-KR": "핸드헬드 UGC 브이로그", "es-ES": "Vlog UGC en cámara en mano" },
    水彩画: { "zh-CN": "水彩画", "en-US": "Watercolor", "zh-TW": "水彩畫", "ja-JP": "水彩画", "ko-KR": "수채화", "es-ES": "Acuarela" },
    "水墨 / 中国风": { "zh-CN": "水墨 / 中国风", "en-US": "Ink Wash / Chinese Style", "zh-TW": "水墨／中國風", "ja-JP": "水墨／中国風", "ko-KR": "수묵／중국풍", "es-ES": "Tinta china / Estilo chino" },
    图表: { "zh-CN": "图表", "en-US": "Chart", "zh-TW": "圖表", "ja-JP": "グラフ", "ko-KR": "차트", "es-ES": "Gráfico" },
    "团体 / 情侣": { "zh-CN": "团体 / 情侣", "en-US": "Group / Couple", "zh-TW": "團體／情侶", "ja-JP": "グループ／カップル", "ko-KR": "그룹／커플", "es-ES": "Grupo / Pareja" },
    "网红 / 模特": { "zh-CN": "网红 / 模特", "en-US": "Influencer / Model", "zh-TW": "網紅／模特兒", "ja-JP": "インフルエンサー／モデル", "ko-KR": "인플루언서／모델", "es-ES": "Influencer / Modelo" },
    "文本 / 排版": { "zh-CN": "文本 / 排版", "en-US": "Text / Typography", "zh-TW": "文字／排版", "ja-JP": "テキスト／タイポグラフィ", "ko-KR": "텍스트／타이포그래피", "es-ES": "Texto / Tipografía" },
    像素艺术: { "zh-CN": "像素艺术", "en-US": "Pixel Art", "zh-TW": "像素藝術", "ja-JP": "ピクセルアート", "ko-KR": "픽셀 아트", "es-ES": "Arte de píxeles" },
    "信息图 / 教育视觉图": {
        "zh-CN": "信息图 / 教育视觉图",
        "en-US": "Infographic / Educational Visual",
        "zh-TW": "資訊圖／教育視覺圖",
        "ja-JP": "インフォグラフィック／教育ビジュアル",
        "ko-KR": "인포그래픽／교육 시각 자료",
        "es-ES": "Infografía / Visual educativo",
    },
    "音乐卡点 MV": { "zh-CN": "音乐卡点 MV", "en-US": "Beat-Synced Music Video", "zh-TW": "音樂卡點 MV", "ja-JP": "音楽ビート同期 MV", "ko-KR": "음악 비트 싱크 MV", "es-ES": "Vídeo musical sincronizado al ritmo" },
    油画: { "zh-CN": "油画", "en-US": "Oil Painting", "zh-TW": "油畫", "ja-JP": "油絵", "ko-KR": "유화", "es-ES": "Pintura al óleo" },
    "游戏 UI 直播": { "zh-CN": "游戏 UI 直播", "en-US": "Game UI Stream", "zh-TW": "遊戲 UI 直播", "ja-JP": "ゲーム UI ライブ配信", "ko-KR": "게임 UI 라이브", "es-ES": "Transmisión de interfaz de juego" },
    游戏素材: { "zh-CN": "游戏素材", "en-US": "Game Assets", "zh-TW": "遊戲素材", "ja-JP": "ゲームアセット", "ko-KR": "게임 에셋", "es-ES": "Recursos de juego" },
    运动极限: { "zh-CN": "运动极限", "en-US": "Extreme Sports", "zh-TW": "運動極限", "ja-JP": "エクストリームスポーツ", "ko-KR": "익스트림 스포츠", "es-ES": "Deportes extremos" },
    "摘要 / 背景": { "zh-CN": "摘要 / 背景", "en-US": "Summary / Background", "zh-TW": "摘要／背景", "ja-JP": "要約／背景", "ko-KR": "요약／배경", "es-ES": "Resumen / Antecedentes" },
    "App / 网页设计": { "zh-CN": "App / 网页设计", "en-US": "App / Web Design", "zh-TW": "App／網頁設計", "ja-JP": "アプリ／Web デザイン", "ko-KR": "앱／웹 디자인", "es-ES": "Diseño de app / web" },
    "POV 长镜头": { "zh-CN": "POV 长镜头", "en-US": "POV Long Take", "zh-TW": "POV 長鏡頭", "ja-JP": "POV ロングショット", "ko-KR": "POV 롱 테이크", "es-ES": "Plano secuencia en POV" },
    "Q 版 / Q 萌风": { "zh-CN": "Q 版 / Q 萌风", "en-US": "Chibi / Cute Style", "zh-TW": "Q 版／Q 萌風", "ja-JP": "デフォルメ／ちcute風", "ko-KR": "츄비／귀여운 스타일", "es-ES": "Chibi / Estilo tierno" },
    "YouTube 缩略图": { "zh-CN": "YouTube 缩略图", "en-US": "YouTube Thumbnail", "zh-TW": "YouTube 縮圖", "ja-JP": "YouTube サムネイル", "ko-KR": "YouTube 썸네일", "es-ES": "Miniatura de YouTube" },
};

const FALLBACK_LOCALE: SupDanceLocaleCode = "zh-CN";

/** 把 manifest 的简中分类标签解析成当前语种标签；未收录时原样返回，不猜测译文。 */
export function resolveInspirationCategoryLabel(zhLabel: string | undefined, locale: SupDanceLocaleCode): string {
    const label = zhLabel?.trim();
    if (!label) return "";
    if (locale === FALLBACK_LOCALE) return label;
    return INSPIRATION_CATEGORY_LABELS[label]?.[locale] ?? label;
}

export const INSPIRATION_CATEGORY_LOCALE_COUNT = Object.keys(INSPIRATION_CATEGORY_LABELS).length;
