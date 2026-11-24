import { isServerModelGenerationEligible } from './generationEligibility';

const destinations = {
  images: [
    { tab: 'image', modes: ['t2i', 'i2i'] },
    { tab: 'cinema', modes: ['cinema'] },
  ],
  video: [
    { tab: 'video', modes: ['t2v', 'i2v', 'v2v'] },
    { tab: 'cinema', modes: ['cinema'] },
  ],
};

function navigationTarget(model) {
  const category = model.category;
  if (category === 'text') return { group: 'agents-automation', tab: 'agents' };
  if (category === 'audio' || category === 'music') return { group: 'audio', tab: 'audio' };

  const group = category === 'image' || category === 'image_edit' ? 'images' : category;
  if (group !== 'images' && group !== 'video') return null;
  const contract = model.generationCapabilities;
  const modes = Array.isArray(contract) ? contract.map(item => item?.taskType) : contract?.modes;
  if (!Array.isArray(modes)) return null;
  const match = destinations[group].find(destination => destination.modes.some(mode => modes.includes(mode)));
  return match ? { group, tab: match.tab } : null;
}

/** Navigation is a projection of the public directory, never a static catalog. */
export function withPublicNavigationModels(categories, models, rootPath = '') {
  const byGroup = new Map();
  for (const model of Array.isArray(models) ? models : []) {
    if (!isServerModelGenerationEligible(model) || typeof model.id !== 'string'
      || !/^[A-Za-z0-9._-]{1,128}$/.test(model.id)) continue;
    const target = navigationTarget(model);
    if (!target) continue;
    const { group, tab } = target;
    const entries = byGroup.get(group) || [];
    const name = model.displayName || model.name || model.id;
    entries.push({
      id: model.id, modelKey: model.id, tabId: tab, name, label: name, description: '',
      href: `${rootPath}/studio?tab=${tab}&model=${encodeURIComponent(model.id)}`,
    });
    byGroup.set(group, entries);
  }
  return (categories || []).map(category => ({ ...category, models: byGroup.get(category.id) || [] }));
}
