const translations = {
  en: ['New session', 'Create session', 'No previous sessions', 'Could not load sessions.', 'Try again', 'Session unavailable', 'Could not save conversation. Your changes are still open.', 'Session name', 'Open sessions', 'Sign in'],
  'zh-CN': ['新会话', '创建会话', '暂无历史会话', '会话加载失败。', '重试', '会话不可用', '对话保存失败，当前内容仍保留在页面。', '会话名称', '打开会话列表', '登录'],
  'zh-TW': ['新對話', '建立對話', '暫無歷史對話', '無法載入對話。', '重試', '對話無法使用', '無法儲存對話，目前內容仍保留在頁面。', '對話名稱', '開啟對話列表', '登入'],
  'ja-JP': ['新しいセッション', 'セッションを作成', '過去のセッションはありません', 'セッションを読み込めませんでした。', '再試行', 'セッションを利用できません', '会話を保存できませんでした。変更は画面に残っています。', 'セッション名', 'セッション一覧を開く', 'ログイン'],
  'ko-KR': ['새 세션', '세션 만들기', '이전 세션이 없습니다', '세션을 불러오지 못했습니다.', '다시 시도', '세션을 사용할 수 없습니다', '대화를 저장하지 못했습니다. 변경 사항은 화면에 남아 있습니다.', '세션 이름', '세션 목록 열기', '로그인'],
  es: ['Nueva sesión', 'Crear sesión', 'No hay sesiones anteriores', 'No se pudieron cargar las sesiones.', 'Reintentar', 'Sesión no disponible', 'No se pudo guardar la conversación. Los cambios siguen abiertos.', 'Nombre de la sesión', 'Abrir sesiones', 'Iniciar sesión'],
};

const turnTranslations = {
  en: ['Text model', 'credits', 'Send message', 'No published text model is available.'],
  'zh-CN': ['文本模型', '积分', '发送消息', '当前没有可用的已发布文本模型。'],
  'zh-TW': ['文字模型', '點數', '傳送訊息', '目前沒有可用的已發布文字模型。'],
  'ja-JP': ['テキストモデル', 'クレジット', 'メッセージを送信', '公開済みのテキストモデルはありません。'],
  'ko-KR': ['텍스트 모델', '크레딧', '메시지 보내기', '사용 가능한 게시된 텍스트 모델이 없습니다.'],
  es: ['Modelo de texto', 'créditos', 'Enviar mensaje', 'No hay ningún modelo de texto publicado disponible.'],
};

export function getSessionCopy(locale) {
  const key = locale === 'es-ES' ? 'es' : locale;
  const [newSession, create, empty, loadError, retry, unavailable, saveError, name, open, signIn] =
    translations[key] || translations.en;
  const [textModel, credits, send, modelUnavailable] = turnTranslations[key] || turnTranslations.en;
  return { newSession, create, empty, loadError, retry, unavailable, saveError, name, open, signIn, textModel, credits, send, modelUnavailable };
}
