function stringOptions(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim()))];
}

function positiveNumberOptions(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(Number)
    .filter((item) => Number.isFinite(item) && item > 0))];
}

export function findPublicVideoCapability(model, taskType = "t2v") {
  const expectedInput = { t2v: "text", i2v: "image", v2v: "video" }[taskType];
  if (!expectedInput) return null;
  if (!Array.isArray(model?.generationCapabilities)) return null;
  return model.generationCapabilities.find((capability) =>
    capability?.taskType === taskType
    && capability.inputTypes?.includes(expectedInput)
    && capability.outputTypes?.includes("video"),
  ) || null;
}

export function findPublicImageCapability(model, taskType = "t2i") {
  const expectedInput = { t2i: "text", i2i: "image" }[taskType];
  if (!expectedInput || !Array.isArray(model?.generationCapabilities)) return null;
  return model.generationCapabilities.find((capability) =>
    capability?.taskType === taskType
    && capability.inputTypes?.includes(expectedInput)
    && capability.outputTypes?.includes("image"),
  ) || null;
}

export function getPublicVideoControlOptions(capability) {
  return {
    aspectRatios: stringOptions(capability?.aspectRatios),
    resolutions: stringOptions(capability?.resolutions),
    durations: positiveNumberOptions(capability?.durations),
    qualities: stringOptions(capability?.qualities),
  };
}

export function getPublicImageControlOptions(capability, qualityField) {
  const resolutions = stringOptions(capability?.resolutions);
  const qualities = stringOptions(capability?.qualities);
  return {
    aspectRatios: stringOptions(capability?.aspectRatios),
    choices: qualityField === "resolution" ? resolutions : qualityField === "quality" ? qualities : [],
  };
}

const MEDIA_PARAMETER_KEYS = Object.freeze({
  image: ["image", "image_url", "image_urls", "images", "images_list", "reference_image", "reference_images", "start_image_url", "first_image_url", "last_image", "end_image_url"],
  video: ["video", "video_url", "video_urls", "videos", "videos_list", "video_files", "reference_videos", "source_video", "input_video"],
  audio: ["audio", "audio_url", "audio_urls", "audios", "audios_list", "audio_files", "reference_audios"],
});

/** Keep user-supplied non-spec inputs only when the route declares them. */
export function filterPublicProviderParameters(parameters, capability) {
  const allowed = new Set(stringOptions(capability?.parameters));
  for (const inputType of stringOptions(capability?.inputTypes)) {
    for (const key of MEDIA_PARAMETER_KEYS[inputType] || []) allowed.add(key);
  }
  return Object.fromEntries(Object.entries(parameters || {}).filter(([key]) => allowed.has(key)));
}

// Keep the old export for existing video callers while both studios share the
// same server-declared media and supplemental-parameter filtering contract.
export const filterPublicVideoProviderParameters = filterPublicProviderParameters;

export function buildPublicImageParameters({
  capability,
  taskType = capability?.taskType,
  prompt,
  aspectRatio,
  qualityField,
  qualityValue,
} = {}) {
  const expectedInput = { t2i: "text", i2i: "image" }[taskType];
  if (!capability || capability.taskType !== taskType || !expectedInput
    || !capability.inputTypes?.includes(expectedInput)
    || !capability.outputTypes?.includes("image")) return null;

  const options = getPublicImageControlOptions(capability, qualityField);
  const parameters = { task_type: taskType };
  if (typeof prompt === "string" && prompt.trim()) parameters.prompt = prompt.trim();
  if (options.aspectRatios.includes(aspectRatio)) parameters.aspect_ratio = aspectRatio;
  if (options.choices.includes(qualityValue) && qualityField === "resolution") {
    parameters.resolution = qualityValue;
  }
  if (options.choices.includes(qualityValue) && qualityField === "quality") {
    parameters.quality = qualityValue;
  }
  return parameters;
}

/** Build only settings explicitly declared by the selected server capability. */
export function buildPublicVideoParameters({
  capability,
  taskType = capability?.taskType,
  prompt,
  aspectRatio,
  resolution,
  duration,
  quality,
} = {}) {
  const expectedInput = { t2v: "text", i2v: "image", v2v: "video" }[taskType];
  if (!capability || capability.taskType !== taskType || !expectedInput
    || !capability.inputTypes?.includes(expectedInput)
    || !capability.outputTypes?.includes("video")) return null;

  const options = getPublicVideoControlOptions(capability);
  const parameters = {
    task_type: taskType,
  };
  if (typeof prompt === "string" && prompt.trim()) parameters.prompt = prompt.trim();
  if (options.aspectRatios.includes(aspectRatio)) parameters.aspect_ratio = aspectRatio;
  if (options.resolutions.includes(resolution)) parameters.resolution = resolution;
  if (options.durations.includes(Number(duration))) {
    parameters.duration = Number(duration);
    parameters.duration_seconds = Number(duration);
  }
  if (options.qualities.includes(quality)) parameters.quality = quality;
  return parameters;
}
