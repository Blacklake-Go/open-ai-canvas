import type { SupDanceI18nEntry } from "../types";

export const MUSIC_SITE_DESCRIPTION = "音乐工作台使用后台配置的平台音乐模型、统一音频生成任务与实时报价，提供简单和歌词创作、目标时长、原始 MP3 播放下载及共享任务历史。模型与版本由渠道配置决定。";

const definitions = [
    ["image_created", "你的图像已创建", "Your image is ready", "你的圖像已建立", "画像が生成されました", "이미지가 생성되었습니다", "Tu imagen está lista"],
    ["video_created", "你的视频已创建", "Your video is ready", "你的影片已建立", "動画が生成されました", "동영상이 생성되었습니다", "Tu vídeo está listo"],
    ["video_results", "视频结果", "Video results", "影片結果", "動画の結果", "동영상 결과", "Resultados de vídeo"],
    ["image_result_count", "{count} 张图片", "{count} images", "{count} 張圖片", "画像 {count} 枚", "이미지 {count}개", "{count} imágenes"],
    ["download_number", "下载 {number}", "Download {number}", "下載 {number}", "ダウンロード {number}", "다운로드 {number}", "Descargar {number}"],
    [
        "no_models",
        "暂无可用音乐模型，请在后台配置音乐渠道。",
        "No music models are available. Configure a music channel in Admin.",
        "暫無可用音樂模型，請在後台配置音樂渠道。",
        "利用できる音楽モデルがありません。管理画面で音楽チャネルを設定してください。",
        "사용 가능한 음악 모델이 없습니다. 관리자에서 음악 채널을 설정하세요.",
        "No hay modelos de música disponibles. Configura un canal en Administración.",
    ],
    [
        "site_billing_tip",
        "以平台实时报价及最终账单为准",
        "Uses the live platform quote and final bill",
        "以平台即時報價及最終帳單為準",
        "プラットフォームの最新見積もりと最終請求に基づきます",
        "플랫폼 실시간 견적과 최종 청구서를 따릅니다",
        "Se aplica la cotización actual y la factura final de la plataforma",
    ],
    ["original_download", "下载原始音频", "Download original audio", "下載原始音訊", "元の音声をダウンロード", "원본 오디오 다운로드", "Descargar audio original"],
    ["message_generation", "音乐生成", "Music generation", "音樂生成", "音楽生成", "음악 생성", "Generación de música"],
    ["message_created", "音乐已生成", "Your music is ready", "音樂已生成", "音楽が生成されました", "음악이 생성되었습니다", "Tu música está lista"],
    ["result_count", "{count} 个音频结果", "{count} audio results", "{count} 個音訊結果", "音声結果 {count} 件", "오디오 결과 {count}개", "{count} resultados de audio"],
    [
        "target_duration_hint",
        "目标时长 {seconds} 秒，实际时长以音频为准",
        "Target: {seconds}s; actual duration follows the audio",
        "目標時長 {seconds} 秒，實際時長以音訊為準",
        "目標 {seconds} 秒。実際の長さは音声によって異なります",
        "목표 {seconds}초, 실제 길이는 오디오에 따라 달라집니다",
        "Objetivo: {seconds}s; la duración real depende del audio",
    ],
];

export const MUSIC_SITE_I18N_ENTRIES: SupDanceI18nEntry[] = definitions.map(([key, zhCN, enUS, zhTW, jaJP, koKR, esES]) => ({
    key: `music.${key}`,
    namespace: "music",
    sourceText: zhCN,
    description: "",
    origin: "builtin",
    translations: { "zh-CN": zhCN, "en-US": enUS, "zh-TW": zhTW, "ja-JP": jaJP, "ko-KR": koKR, "es-ES": esES },
}));
