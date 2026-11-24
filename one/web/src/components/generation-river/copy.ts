const keys = ['title', 'loading', 'empty', 'loadError', 'refresh', 'today', 'yesterday', 'submitting', 'queued', 'running', 'checking', 'succeeded', 'failed', 'canceled', 'image', 'video', 'audio', 'digital-human', 'agent', 'other', 'openResult', 'download', 'viewText', 'close', 'editInputs', 'useDrivingAudio', 'inputsRestored', 'restoreUnavailable', 'restoreConflict', 'musicStyle', 'instrumental'] as const;

const strings: Record<string, string[]> = {
  en: ['Generation river', 'Loading tasks…', 'Your generation tasks will appear here.', 'Could not load task history.', 'Refresh status', 'Today', 'Yesterday', 'Submitting', 'Queued', 'Generating', 'Checking status', 'Completed', 'Failed', 'Canceled', 'Image', 'Video', 'Audio', 'Digital human', 'Assistant', 'Creation', 'Open result', 'Download', 'View text', 'Dismiss', "Edit inputs", "Use as driving audio", "Inputs restored. Review them to continue.", "These task inputs are unavailable.", "Your draft changed while the task loaded. Open the inputs again to restore them.", "Music style", "Instrumental"],
  'zh-CN': ['生成河', '正在加载任务…', '你提交的生成任务会显示在这里。', '任务记录加载失败。', '刷新状态', '今天', '昨天', '正在提交', '已排队', '生成中', '等待核对', '已完成', '生成失败', '已取消', '图像', '视频', '音频', '数字人', '创作助手', '创作', '打开作品', '下载', '查看文本', '关闭反馈', "编辑原参数", "用作驱动音频", "参数已恢复，检查后可继续。", "暂时无法恢复这条任务的参数。", "加载期间草稿有更新。再次打开任务参数即可恢复。", "音乐风格", "纯音乐"],
  'zh-TW': ['生成河', '正在載入任務…', '你提交的生成任務會顯示在這裡。', '無法載入任務記錄。', '重新整理狀態', '今天', '昨天', '正在提交', '已排隊', '生成中', '等待核對', '已完成', '生成失敗', '已取消', '圖像', '影片', '音訊', '數位人', '創作助理', '創作', '開啟作品', '下載', '檢視文字', '關閉通知', "編輯原始參數", "用作驅動音訊", "參數已還原，檢查後可繼續。", "暫時無法還原這項任務的參數。", "載入期間草稿已更新。再次開啟任務參數即可還原。", "音樂風格", "純音樂"],
  'ja-JP': ['生成タイムライン', 'タスクを読み込み中…', '送信した生成タスクがここに表示されます。', 'タスク履歴を読み込めませんでした。', '状態を更新', '今日', '昨日', '送信中', '待機中', '生成中', '状態を確認中', '完了', '失敗', 'キャンセル済み', '画像', '動画', '音声', 'デジタルヒューマン', 'アシスタント', '作品', '結果を開く', 'ダウンロード', 'テキストを表示', '通知を閉じる', "入力を編集", "駆動音声として使用", "入力を復元しました。内容を確認して続けてください。", "このタスクの入力を復元できません。", "読み込み中に下書きが変わりました。入力を再度開いて復元できます。", "音楽スタイル", "インストゥルメンタル"],
  'ko-KR': ['생성 타임라인', '작업을 불러오는 중…', '제출한 생성 작업이 여기에 표시됩니다.', '작업 기록을 불러오지 못했습니다.', '상태 새로고침', '오늘', '어제', '제출 중', '대기 중', '생성 중', '상태 확인 중', '완료', '실패', '취소됨', '이미지', '동영상', '오디오', '디지털 휴먼', '어시스턴트', '작품', '결과 열기', '다운로드', '텍스트 보기', '알림 닫기', "입력 수정", "구동 오디오로 사용", "입력을 복원했습니다. 내용을 확인한 뒤 계속하세요.", "이 작업의 입력을 복원할 수 없습니다.", "불러오는 동안 초안이 변경되었습니다. 작업 입력을 다시 열어 복원하세요.", "음악 스타일", "연주곡"],
  es: ['Historial de generación', 'Cargando tareas…', 'Tus tareas de generación aparecerán aquí.', 'No se pudo cargar el historial.', 'Actualizar estado', 'Hoy', 'Ayer', 'Enviando', 'En cola', 'Generando', 'Comprobando estado', 'Completada', 'Fallida', 'Cancelada', 'Imagen', 'Vídeo', 'Audio', 'Humano digital', 'Asistente', 'Creación', 'Abrir resultado', 'Descargar', 'Ver texto', 'Cerrar aviso', "Editar datos de entrada", "Usar como audio de animación", "Se restauraron los datos. Revísalos antes de continuar.", "No se pudieron restaurar los datos de esta tarea.", "El borrador cambió durante la carga. Vuelve a abrir los datos para restaurarlos.", "Estilo musical", "Instrumental"],
};

const previewCopy: Record<string, { preview: string; previewError: string }> = {
  en: { preview: 'Preview', previewError: 'Preview unavailable. You can still open or download the result.' },
  'zh-CN': { preview: '预览', previewError: '预览暂时无法加载，可以打开或下载作品。' },
  'zh-TW': { preview: '預覽', previewError: '預覽暫時無法載入，可以開啟或下載作品。' },
  'ja-JP': { preview: 'プレビュー', previewError: 'プレビューを表示できません。結果を開くかダウンロードしてください。' },
  'ko-KR': { preview: '미리보기', previewError: '미리보기를 불러올 수 없습니다. 결과를 열거나 다운로드할 수 있습니다.' },
  es: { preview: 'Vista previa', previewError: 'La vista previa no está disponible. Puedes abrir o descargar el resultado.' },
};

export function getRiverCopy(locale: string) {
  const values = strings[locale] || strings.en;
  const copy = Object.fromEntries(keys.map((key, index) => [key, values[index]])) as Record<typeof keys[number], string>;
  return { ...copy, ...(previewCopy[locale] || previewCopy.en) };
}
