import { evaluateModelAvailability, isModelAvailable } from './availability.js';
import { sanitizePublicSchema } from './capabilitySchema.js';

/** Shared admission rule for user-facing model directories. */
export function isSelectablePublicModel(model) {
  return isModelAvailable(model);
}

export function selectPublicModels(models, category) {
  return (models || []).filter((model) => model.category === category
    && evaluateModelAvailability(model, { site: 'main' }).available);
}

function publicCapabilityValues(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item === 'string' && item.trim() && item.length <= 80) return [item.trim()];
    if (typeof item === 'number' && Number.isFinite(item) && item >= 0) return [item];
    return [];
  }))].slice(0, 40);
}

export function serializePublicGenerationCapabilities(value, {includeVariants = false} = {}) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((capability) => {
    if (!capability || typeof capability !== 'object' || Array.isArray(capability)) return [];
    const taskType = typeof capability.taskType === 'string' ? capability.taskType.trim().toLowerCase() : '';
    if (!/^[a-z0-9_]{1,32}$/.test(taskType)) return [];
    return [{
      taskType,
      inputTypes: publicCapabilityValues(capability.inputTypes),
      outputTypes: publicCapabilityValues(capability.outputTypes),
      aspectRatios: publicCapabilityValues(capability.aspectRatios),
      resolutions: publicCapabilityValues(capability.resolutions),
      durations: publicCapabilityValues(capability.durations),
      qualities: publicCapabilityValues(capability.qualities),
      parameters: publicCapabilityValues(capability.parameters).filter((item) => typeof item === 'string'),
      ...(capability.inputSchema ? {inputSchema:sanitizePublicSchema(capability.inputSchema)} : {}),
      ...(includeVariants && capability.variants?.length ? {variants:serializePublicGenerationCapabilities(capability.variants)} : {}),
    }];
  }).slice(0, 20);
}

/**
 * Project a selectable model into the app-directory response. Directory values
 * are display hints only; a chargeable price must come from a server quote.
 */
export function serializePublicAppModel(model) {
  const hasConfiguredCredits = model.credits_price !== null
    && model.credits_price !== undefined
    && model.credits_price !== ''
    && Number.isFinite(Number(model.credits_price))
    && Number(model.credits_price) > 0;

  return {
    id: model.id,
    name: model.name,
    displayName: model.display_name || model.name,
    category: model.category,
    credits: hasConfiguredCredits && model.pricing_type !== 'formula' ? Number(model.credits_price) : null,
    startingCredits: hasConfiguredCredits ? Number(model.credits_price) : null,
    pricingType: model.pricing_type || 'unknown',
    quoteRequired: true,
    creditsAreQuote: false,
    priceCny: null,
    description: model.description || '',
    tags: Array.isArray(model.metadata_json?.tags) ? model.metadata_json.tags : [],
    features: Array.isArray(model.metadata_json?.features) ? model.metadata_json.features : [],
    recommended: model.tier === 'core',
    isPinned: Boolean(model.is_pinned),
    availableRoutes: model.available_providers?.length || 0,
    generationCapabilities: serializePublicGenerationCapabilities(model.generation_capabilities),
  };
}
