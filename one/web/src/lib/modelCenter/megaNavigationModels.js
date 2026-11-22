/** Navigation is a projection of the public directory, never a static catalog. */
export function withPublicNavigationModels(categories, models, rootPath = '') {
  const groups = { images: 'image', video: 'video', audio: 'audio' };
  return (categories || []).map((category) => {
    const type = groups[category.id];
    const listed = type && Array.isArray(models) ? models.filter((model) => model?.category === type
      && typeof model.id === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(model.id)) : [];
    return {
      ...category,
      models: listed.map((model) => ({
        id: model.id,
        modelKey: model.id,
        tabId: type,
        name: model.displayName || model.name || model.id,
        description: '',
        href: `${rootPath}/studio?tab=${type}&model=${encodeURIComponent(model.id)}`,
      })),
    };
  });
}
