export function normalizeGenerationTaskType(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = {
    text_to_video: 't2v', text2video: 't2v', t2v: 't2v',
    image_to_video: 'i2v', img2video: 'i2v', i2v: 'i2v',
    video_to_video: 'v2v', video_edit: 'v2v', v2v: 'v2v',
    text_to_image: 't2i', txt2img:'t2i', text2image: 't2i', t2i: 't2i',
    image_to_image: 'i2i', img2img:'i2i', image_edit: 'i2i', i2i: 'i2i',
    text_to_audio: 't2a', text2audio: 't2a', text_to_speech:'t2a', tts:'t2a', t2a:'t2a',
    chat:'t2t', completion:'t2t', reasoning:'t2t', text_to_text:'t2t', t2t:'t2t',
    text_to_music:'t2m', music:'t2m', t2m:'t2m',
  };
  return aliases[normalized] || normalized;
}


/** Public contract helpers shared by catalogue projection and publication validation. */
export function isProviderConfigurationParameter(key) {
  const normalized = String(key).replace(/([a-z0-9])([A-Z])/g,'$1_$2').toLowerCase();
  if (/^(max_tokens|max_completion_tokens|max_output_tokens)$/.test(normalized)) return false;
  if (/^(?:price|cost|credit|credits|billing|quote)(?:_|$)/.test(normalized) || /^(?:estimated_cost|actual_cost|quoted_credits)(?:_|$)/.test(normalized)) return true;
  return /api.?key|base.?url|credential|provider|endpoint|channel|secret|token/i.test(key)
    || /^(?:script|javascript)/i.test(key)
    || ['__proto__', 'constructor', 'prototype'].includes(key);
}

export function sanitizePublicSchema(value, depth = 0) {
  if(value===false)return {not:{}};
  if(value===true)return {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 5) return null;
  const schema = {};
  if(value.$ref || value.$dynamicRef)return {not:{},description:'该参数配置包含尚未解析的引用，需管理员验证后发布'};
  const types = new Set(['object','array','string','number','integer','boolean','null']);
  if (types.has(value.type)) schema.type = value.type;
  if (Array.isArray(value.type) && value.type.every(type => types.has(type))) schema.type = value.type;
  if(['string','number','boolean'].includes(typeof value.const) || value.const===null)schema.const=value.const;
  if(typeof value['x-inputRole']==='string' && ['image','mask','video','audio'].includes(value['x-inputRole']))schema['x-inputRole']=value['x-inputRole'];
  if(typeof value.pattern==='string')schema.pattern=value.pattern;
  for(const key of ['not','if','then','else','contains','propertyNames'])if(value[key]!==undefined)schema[key]=sanitizePublicSchema(value[key],depth+1);
  for (const key of ['title','description']) if (typeof value[key] === 'string') schema[key] = value[key].slice(0, key === 'title' ? 120 : 240);
  if (Array.isArray(value.required)) schema.required = value.required.filter(key => typeof key === 'string' && !isProviderConfigurationParameter(key)).slice(0,40);
  if (Array.isArray(value.enum)) schema.enum = value.enum.filter(item => ['string','number','boolean'].includes(typeof item) || item === null).slice(0,40);
  if (['string','number','boolean'].includes(typeof value.default) || value.default === null) schema.default = value.default;
  for (const key of ['minimum','maximum','exclusiveMinimum','exclusiveMaximum','multipleOf','minLength','maxLength','minItems','maxItems']) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) schema[key] = value[key];
  }
  if (typeof value.additionalProperties === 'boolean') schema.additionalProperties = value.additionalProperties;
  if (typeof value.uniqueItems === 'boolean') schema.uniqueItems = value.uniqueItems;
  if (value.items) schema.items = sanitizePublicSchema(value.items, depth + 1);
  if (value.properties && typeof value.properties === 'object' && !Array.isArray(value.properties)) {
    schema.properties = Object.fromEntries(Object.entries(value.properties).filter(([key]) => !isProviderConfigurationParameter(key)).slice(0,40)
      .map(([key, child]) => [key.slice(0,80), sanitizePublicSchema(child, depth + 1)]).filter(([,child]) => child));
  }
  for (const key of ['oneOf','anyOf','allOf']) if (Array.isArray(value[key])) schema[key] = value[key].slice(0,40).map(child => sanitizePublicSchema(child,depth + 1)).filter(Boolean);
  return schema;
}

export function modelModality(model) {
  let metadata = model.capabilities || model.metadata_json || {};
  if (typeof metadata === 'string') { try { metadata = JSON.parse(metadata); } catch { metadata = {}; } }
  const type = String(model.type || model.category || '').toLowerCase();
  const explicit = String(metadata.modality || metadata.sub_type || '').toLowerCase();
  return type === 'music' || (type === 'audio' && explicit === 'music') ? 'music' : type;
}

const numericParameters = new Set(['temperature','top_p','speed','guidance_scale','guidance','strength','fps']);
const integerParameters = new Set(['max_tokens','max_completion_tokens','max_output_tokens','seed','batch_size','num_images','count','n','width','height']);
const booleanParameters = new Set(['watermark','generate_audio','instrumental','loop','camera_fixed']);

/** Derive controls from reviewed route declarations; no per-model client fields. */
export function buildPublicParameterSchema(capabilities, declaredSchema) {
  const declared = sanitizePublicSchema(declaredSchema);
  const variants = (capabilities || []).flatMap(capability => capability.variants?.length ? capability.variants : [capability]).map(capability => {
    const properties = {prompt:{type:'string'},task_type:{const:capability.taskType}};
    for (const key of capability.parameters || []) {
      if (isProviderConfigurationParameter(key) || ['prompt','task_type'].includes(key)) continue;
      const published = capability.inputSchema?.properties?.[key] || declared?.properties?.[key];
      if (published) { properties[key] = ['count','n','num_images','batch_size'].includes(key) ? {...published,const:1} : published; continue; }
      const values = key === 'aspect_ratio' || key === 'ratio' ? capability.aspectRatios
        : key === 'resolution' || key === 'size' ? capability.resolutions
          : key === 'duration' || key === 'seconds' ? capability.durations
            : key === 'quality' ? capability.qualities : null;
      if (values?.length) properties[key] = { enum: values };
      else if (numericParameters.has(key)) properties[key] = { type:'number' };
      else if (integerParameters.has(key)) properties[key] = { type:'integer',...(['count','n','num_images','batch_size'].includes(key) ? {const:1} : {}) };
      else if (booleanParameters.has(key)) properties[key] = { type:'boolean' };
      else if (key === 'messages') properties[key] = { type:'array', items:{type:'object'} };
      else if (['images','image_urls','reference_images','reference_asset_ids','video_urls','audio_urls'].includes(key)) properties[key] = {type:'array',items:{type:'string'}};
      else properties[key] = { type:'string' };
    }
    const shape = { type:'object', properties, required: (declared?.required || capability.inputSchema?.required || []).filter(key => properties[key]), additionalProperties:false };
    const constraints = declared || capability.inputSchema;
    return constraints?.oneOf || constraints?.anyOf || constraints?.allOf ? {allOf:[shape,constraints]} : shape;
  });
  if (!variants.length) return declared;
  const distinct = [...new Map(variants.map(schema => [JSON.stringify(schema), schema])).values()];
  if (distinct.length === 1) return distinct[0];
  // Keep each route's parameter combinations intact instead of accepting a union that no route supports.
  return { anyOf: distinct };
}

export function canvasContractVersion(request) {
  const requested = new URL(request.url).searchParams.get('schemaVersion');
  if (!requested) return 1;
  if (requested === '1' || requested === '2') return Number(requested);
  throw Object.assign(new Error('模型能力协议版本不受支持'), { code:'MODEL_CATALOG_VERSION_UNSUPPORTED' });
}
