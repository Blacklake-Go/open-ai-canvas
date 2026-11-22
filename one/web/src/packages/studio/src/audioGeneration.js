export function isMusicModel(model) {
  return model?.taskType === 't2m' || model?.fixedParameters?.task_type === 't2m';
}

export function musicModes(model) {
  if (!isMusicModel(model)) return [];
  const inputs = model.inputs || {};
  const modes = inputs.lyrics ? ['lyrics'] : [];
  if (inputs.lyrics_optimizer?.type === 'boolean' && inputs.lyrics_optimizer.const !== false) modes.push('description');
  if (inputs.is_instrumental?.type === 'boolean' && inputs.is_instrumental.const !== false) modes.push('instrumental');
  return modes;
}

export function audioGenerationParameters(model, values) {
  const parameters = Object.fromEntries(Object.entries(values || {}).filter(([, value]) => value !== '' && value !== undefined && value !== null));
  Object.assign(parameters, model?.fixedParameters);
  if (isMusicModel(model) && (parameters.is_instrumental === true || parameters.lyrics_optimizer === true)) delete parameters.lyrics;
  return parameters;
}

export function missingAudioFields(model, parameters) {
  const required = new Set(model?.required || []);
  if (isMusicModel(model) && model.inputs?.lyrics) {
    if (parameters.is_instrumental === true || parameters.lyrics_optimizer === true) {
      required.delete('lyrics');
      required.add('prompt');
    } else required.add('lyrics');
  }
  return [...required].filter(key => parameters[key] === undefined || parameters[key] === null
    || (typeof parameters[key] === 'string' && !parameters[key].trim()) || (Array.isArray(parameters[key]) && !parameters[key].length));
}

export function mapServerAudioHistory(creations) {
  return (creations || []).flatMap(creation => {
    if (!['audio', 'music'].includes(creation.studio_id) || creation.status !== 'succeeded' || creation.storage_status !== 'ready' || !creation.asset_id) return [];
    let input = creation.input_summary_json || {};
    if (typeof input === 'string') { try { input = JSON.parse(input); } catch { input = {}; } }
    return [{ id: creation.id, assetId: creation.asset_id, url: `/api/assets/${encodeURIComponent(creation.asset_id)}/download?inline=1`,
      title: creation.label || input.prompt || creation.model, prompt: input.prompt || '', model: creation.model,
      parameters: input.parameters || {}, timestamp: creation.created_at }];
  });
}
