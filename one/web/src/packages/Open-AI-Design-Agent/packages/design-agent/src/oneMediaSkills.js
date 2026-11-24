const labels = {
  en: ["Agent skills", "Generate image", "Edit image", "Generate video", "Animate image", "Generation model", "Attach one image from this session.", "Remove attachments or choose a reference-image skill.", "No published model is available for this skill.", "Confirm generation", "Cancel", "Open generated asset", "Describe what to create…"],
  "zh-CN": ["Agent 技能", "生成图片", "编辑图片", "生成视频", "图片转视频", "生成模型", "请添加当前会话中的一张图片。", "请移除附件或选择支持参考图的技能。", "此技能暂无可用的已发布模型。", "确认生成", "取消", "打开生成素材", "描述你想生成的内容…"],
  "zh-TW": ["Agent 技能", "生成圖片", "編輯圖片", "生成影片", "圖片轉影片", "生成模型", "請加入目前對話中的一張圖片。", "請移除附件或選擇支援參考圖的技能。", "此技能暫無可用的已發布模型。", "確認生成", "取消", "開啟生成素材", "描述你想生成的內容…"],
  "ja-JP": ["エージェントスキル", "画像生成", "画像編集", "動画生成", "画像を動画にする", "生成モデル", "このセッションの画像を1枚添付してください。", "添付を削除するか、参照画像に対応するスキルを選択してください。", "このスキルで使用できる公開モデルはありません。", "生成を確認", "キャンセル", "生成した素材を開く", "生成したい内容を入力…"],
  "ko-KR": ["에이전트 스킬", "이미지 생성", "이미지 편집", "영상 생성", "이미지를 영상으로", "생성 모델", "이 세션의 이미지 한 장을 첨부해 주세요.", "첨부를 제거하거나 참조 이미지를 지원하는 스킬을 선택해 주세요.", "이 스킬에 사용할 수 있는 공개 모델이 없습니다.", "생성 확인", "취소", "생성한 에셋 열기", "생성할 내용을 입력하세요…"],
  es: ["Habilidades del agente", "Generar imagen", "Editar imagen", "Generar vídeo", "Animar imagen", "Modelo de generación", "Adjunta una imagen de esta sesión.", "Quita los adjuntos o elige una habilidad que use imágenes de referencia.", "Esta habilidad no tiene un modelo publicado disponible.", "Confirmar generación", "Cancelar", "Abrir recurso generado", "Describe lo que quieres crear…"],
};

export function getMediaSkillCopy(locale) {
  const [menu, image, edit, video, animate, model, reference, remove, unavailable, confirm, cancel, open, placeholder] =
    labels[locale === "es-ES" ? "es" : locale] || labels.en;
  return { menu, image, edit, video, animate, model, reference, remove, unavailable, confirm, cancel, open, placeholder };
}

export function getPublishedMediaSkills(catalog, copy) {
  const definitions = [
    ["generate_image", "t2i", "image", copy.image, false],
    ["edit_image", "i2i", "image", copy.edit, true],
    ["generate_video", "t2v", "video", copy.video, false],
    ["image_to_video", "i2v", "video", copy.animate, true],
  ];
  return definitions.flatMap(([name, mode, category, label, reference]) => {
    const models = (catalog || []).filter(model =>
      (model.category === category || (mode === "i2i" && model.category === "image_edit"))
      && model.generationCapabilities?.modes?.includes(mode)
    );
    return models.length ? [{ name, mode, label, reference, models }] : [];
  });
}
