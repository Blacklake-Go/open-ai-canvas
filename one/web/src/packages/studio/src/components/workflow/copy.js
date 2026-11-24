const fields = [
  "title", "templates", "library", "newWorkflow", "promptImage", "expandText", "useTemplate",
  "builder", "playground", "back", "name", "addText", "addImage", "text", "image", "model", "instruction",
  "remove", "save", "saved", "discard", "deleteTitle", "deleteDescription", "cancel", "signIn", "signInHint",
  "empty", "loadFailed", "retry", "loading", "unavailable", "conflict", "failed", "input", "start", "history",
  "quote", "confirm", "credits", "waiting", "queued", "running", "succeeded", "failedStep", "open", "modelMissing",
  "prev", "next", "savedVersion", "stepHelp", "creditError",
];

const strings = {
  en: [
    "Workflows", "Templates", "My workflows", "New workflow", "Prompt to image", "Develop an idea", "Use template",
    "Builder", "Playground", "All workflows", "Workflow name", "Add text step", "Add image step", "Text", "Image", "Model", "Step instructions",
    "Remove step", "Save", "Saved", "Delete workflow", "Delete this workflow?", "The workflow will leave your library. Generated assets stay in your account.", "Cancel", "Sign in", "Sign in to save and run workflows.",
    "No workflows yet.", "Could not load workflows.", "Try again", "Loading…", "This workflow is unavailable.", "This workflow changed in another tab. Reopen it to edit the latest version.", "The action could not be completed.", "Starting input", "Create run", "Previous runs",
    "Get quote", "Confirm step", "credits", "Waiting for the previous text result.", "Queued", "Running", "Completed", "Failed", "Open generated image", "No matching model is currently published.",
    "Previous", "Next", "Workflow version", "Each text step passes its result to the next step. An image can be the final step.", "There are not enough credits for this step.",
  ],
  "zh-CN": [
    "工作流", "模板", "我的工作流", "新建工作流", "提示词生图", "扩展创意", "使用模板",
    "编辑", "运行", "所有工作流", "工作流名称", "添加文本步骤", "添加图片步骤", "文本", "图片", "模型", "步骤指令",
    "移除步骤", "保存", "已保存", "删除工作流", "删除此工作流？", "工作流将从列表中移除，已生成素材仍保存在你的账户中。", "取消", "登录", "登录后可保存和运行工作流。",
    "暂无工作流。", "无法加载工作流。", "重试", "加载中…", "此工作流不可用。", "工作流已在其他标签页更新。重新打开即可编辑最新版本。", "操作未能完成。", "初始输入", "创建运行", "运行历史",
    "获取报价", "确认执行", "积分", "等待上一步生成文本。", "排队中", "执行中", "已完成", "失败", "打开生成图片", "当前没有匹配的已发布模型。",
    "上一页", "下一页", "工作流版本", "文本步骤的输出会传给下一步。图片可以作为最后一步。", "积分余额不足以执行此步骤。",
  ],
  "zh-TW": [
    "工作流程", "範本", "我的工作流程", "新增工作流程", "提示詞生成圖片", "拓展創意", "使用範本",
    "編輯", "執行", "所有工作流程", "工作流程名稱", "加入文字步驟", "加入圖片步驟", "文字", "圖片", "模型", "步驟指示",
    "移除步驟", "儲存", "已儲存", "刪除工作流程", "刪除此工作流程？", "工作流程將從清單移除，生成的素材仍保存在你的帳號中。", "取消", "登入", "登入後即可儲存並執行工作流程。",
    "目前沒有工作流程。", "無法載入工作流程。", "再試一次", "載入中…", "無法使用此工作流程。", "工作流程已在其他分頁更新。重新開啟以編輯最新版本。", "無法完成操作。", "初始輸入", "建立執行紀錄", "執行紀錄",
    "取得報價", "確認執行", "點數", "等待前一步的文字結果。", "排隊中", "執行中", "已完成", "失敗", "開啟生成圖片", "目前沒有相符的已發布模型。",
    "上一頁", "下一頁", "工作流程版本", "文字結果會傳給下一步。最後一步可生成圖片。", "點數不足以執行此步驟。",
  ],
  "ja-JP": [
    "ワークフロー", "テンプレート", "マイワークフロー", "新規ワークフロー", "プロンプトから画像へ", "アイデアを広げる", "テンプレートを使う",
    "編集", "実行", "すべてのワークフロー", "ワークフロー名", "テキストを追加", "画像を追加", "テキスト", "画像", "モデル", "ステップの指示",
    "ステップを削除", "保存", "保存済み", "ワークフローを削除", "このワークフローを削除しますか？", "ワークフローが一覧から削除されます。生成した素材はアカウントに残ります。", "キャンセル", "ログイン", "ログインしてワークフローを保存・実行します。",
    "ワークフローはありません。", "ワークフローを読み込めませんでした。", "再試行", "読み込み中…", "このワークフローは利用できません。", "別のタブで更新されました。開き直して最新バージョンを編集してください。", "操作を完了できませんでした。", "最初の入力", "実行を作成", "実行履歴",
    "見積もりを取得", "ステップを確認", "クレジット", "前のテキスト結果を待っています。", "待機中", "実行中", "完了", "失敗", "生成画像を開く", "利用できる公開モデルがありません。",
    "前へ", "次へ", "ワークフローのバージョン", "テキスト結果は次のステップに渡されます。最後に画像を生成できます。", "このステップに必要なクレジットが不足しています。",
  ],
  "ko-KR": [
    "워크플로", "템플릿", "내 워크플로", "새 워크플로", "프롬프트로 이미지 생성", "아이디어 확장", "템플릿 사용",
    "편집", "실행", "모든 워크플로", "워크플로 이름", "텍스트 단계 추가", "이미지 단계 추가", "텍스트", "이미지", "모델", "단계 지시문",
    "단계 삭제", "저장", "저장됨", "워크플로 삭제", "이 워크플로를 삭제할까요?", "목록에서 워크플로가 제거됩니다. 생성한 에셋은 계정에 유지됩니다.", "취소", "로그인", "워크플로를 저장하고 실행하려면 로그인하세요.",
    "워크플로가 없습니다.", "워크플로를 불러오지 못했습니다.", "다시 시도", "불러오는 중…", "이 워크플로를 사용할 수 없습니다.", "다른 탭에서 변경되었습니다. 다시 열어 최신 버전을 편집하세요.", "작업을 완료하지 못했습니다.", "초기 입력", "실행 만들기", "실행 기록",
    "비용 확인", "단계 실행 확인", "크레딧", "이전 단계의 텍스트 결과를 기다리는 중입니다.", "대기 중", "실행 중", "완료", "실패", "생성 이미지 열기", "사용할 수 있는 게시된 모델이 없습니다.",
    "이전", "다음", "워크플로 버전", "텍스트 결과는 다음 단계로 전달됩니다. 마지막 단계에서 이미지를 생성할 수 있습니다.", "이 단계를 실행할 크레딧이 부족합니다.",
  ],
  es: [
    "Flujos de trabajo", "Plantillas", "Mis flujos", "Nuevo flujo", "De idea a imagen", "Desarrollar una idea", "Usar plantilla",
    "Editor", "Ejecutar", "Todos los flujos", "Nombre del flujo", "Añadir paso de texto", "Añadir paso de imagen", "Texto", "Imagen", "Modelo", "Instrucciones del paso",
    "Quitar paso", "Guardar", "Guardado", "Eliminar flujo", "¿Eliminar este flujo?", "El flujo desaparecerá de tu biblioteca. Los recursos generados seguirán en tu cuenta.", "Cancelar", "Iniciar sesión", "Inicia sesión para guardar y ejecutar flujos.",
    "Aún no hay flujos.", "No se pudieron cargar los flujos.", "Reintentar", "Cargando…", "Este flujo no está disponible.", "El flujo cambió en otra pestaña. Vuelve a abrirlo para editar la versión más reciente.", "No se pudo completar la acción.", "Entrada inicial", "Crear ejecución", "Historial de ejecuciones",
    "Consultar coste", "Confirmar paso", "créditos", "Esperando el texto del paso anterior.", "En cola", "En curso", "Completado", "Error", "Abrir imagen generada", "No hay un modelo publicado compatible.",
    "Anterior", "Siguiente", "Versión del flujo", "El resultado de texto pasa al siguiente paso. El último paso puede generar una imagen.", "No hay créditos suficientes para este paso.",
  ],
};

export function workflowCopy(locale) {
  const values = strings[locale === "es-ES" ? "es" : locale] || strings.en;
  return Object.fromEntries(fields.map((key, index) => [key, values[index]]));
}

const automationFields = ["quote", "title", "detail", "maximum", "confirm", "stop", "active", "stopped", "completed", "priceChanged", "expired", "limited", "failed"];
const automationMessages = {
  en: [
    "Quote automatic run", "Automatic run",
    "ONE runs the remaining steps in order, even after you close this page. Each step is charged at its actual price. The run stops if a step exceeds the approved limit.",
    "Maximum total", "Start automatic run", "Stop remaining steps", "Automatic run in progress.",
    "Automatic run stopped. Any queued or running step can still finish.", "Automatic run completed.",
    "A step now costs more than the approved limit. Get a new quote to continue.", "The quote expired or the run changed. Get a new quote.",
    "The account reached its generation limit. Try again later.", "A step failed or returned no usable result. Later steps were skipped.",
  ],
  "zh-CN": [
    "获取自动运行报价", "自动运行",
    "关闭页面后，ONE 会继续按顺序执行剩余步骤。每步按实际报价结算，超过本次确认上限时停止。",
    "总积分上限", "开始自动运行", "停止剩余步骤", "正在自动运行。",
    "自动运行已停止。已排队或正在执行的步骤仍会继续。", "自动运行已完成。",
    "有步骤的新报价超过确认上限。重新报价后可继续。", "报价已过期或运行状态已变化，请重新报价。",
    "账户已达到生成频率上限，请稍后重试。", "有步骤失败或未返回可用结果，后续步骤已停止。",
  ],
  "zh-TW": [
    "取得自動執行報價", "自動執行",
    "關閉頁面後，ONE 會繼續依序執行剩餘步驟。每一步依實際報價結算，超過本次確認上限時停止。",
    "點數總上限", "開始自動執行", "停止剩餘步驟", "正在自動執行。",
    "自動執行已停止。已排隊或正在執行的步驟仍會繼續。", "自動執行已完成。",
    "有步驟的新報價超過確認上限。重新報價後可繼續。", "報價已過期或執行狀態已變更，請重新報價。",
    "帳號已達生成頻率上限，請稍後再試。", "有步驟失敗或未傳回可用結果，後續步驟已停止。",
  ],
  "ja-JP": [
    "自動実行の見積もり", "自動実行",
    "ページを閉じても残りを順番に実行します。各ステップは実際の料金で精算し、承認した上限を超えると停止します。",
    "合計上限", "自動実行を開始", "残りを停止", "自動実行中です。",
    "自動実行を停止しました。待機中または実行中のステップは続行します。", "自動実行が完了しました。",
    "料金が承認した上限を超えました。新しい見積もりを取得してください。", "見積もりが期限切れか実行状態が変わりました。再見積もりしてください。",
    "生成の回数制限に達しました。後でお試しください。", "失敗または結果のないステップがあるため、後続の実行を停止しました。",
  ],
  "ko-KR": [
    "자동 실행 비용 확인", "자동 실행",
    "페이지를 닫아도 나머지 단계가 순서대로 실행됩니다. 각 단계는 실제 비용만 정산하며 승인 금액을 초과하면 중지됩니다.",
    "총 한도", "자동 실행 시작", "남은 단계 중지", "자동 실행 중입니다.",
    "자동 실행을 중지했습니다. 대기 또는 실행 중인 단계는 계속될 수 있습니다.", "자동 실행을 완료했습니다.",
    "단계의 비용이 승인 한도를 초과했습니다. 계속하려면 비용을 다시 확인하세요.", "견적이 만료되었거나 실행 상태가 변경되었습니다. 다시 확인하세요.",
    "계정의 생성 한도에 도달했습니다. 나중에 다시 시도하세요.", "단계에 실패했거나 사용할 결과가 없어 나머지 단계를 중지했습니다.",
  ],
  es: [
    "Cotizar ejecución automática", "Ejecución automática",
    "ONE ejecuta los pasos restantes en orden aunque cierres esta página. Cada paso se cobra a su precio real. La ejecución se detiene si un paso supera el límite aprobado.",
    "Máximo total", "Iniciar ejecución automática", "Detener pasos restantes", "Ejecución automática en curso.",
    "Ejecución automática detenida. Los pasos en cola o en curso pueden finalizar.", "Ejecución automática completada.",
    "Un paso cuesta más que el límite aprobado. Solicita una nueva cotización para continuar.", "La cotización venció o cambió la ejecución. Solicita una nueva.",
    "La cuenta alcanzó el límite de generación. Inténtalo más tarde.", "Un paso falló o no devolvió un resultado válido. Se omitieron los pasos siguientes.",
  ],
};

export function automationCopy(locale) {
  const values = automationMessages[locale === "es-ES" ? "es" : locale] || automationMessages.en;
  return Object.fromEntries(automationFields.map((key, index) => [key, values[index]]));
}
