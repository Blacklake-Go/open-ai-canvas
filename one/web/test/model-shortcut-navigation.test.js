import { expect, test } from 'bun:test';
import { withPublicNavigationModels } from '../src/lib/modelCenter/megaNavigationModels.js';

const categories = ['images', 'video', 'audio', 'agents-automation'].map(id => ({ id }));

test('navigation routes published models by capability and uses the same label on mobile', () => {
  const published = {
    isActive: true, isVisible: true, autoRouteEligible: true, hasWorkingRoute: true, creditsPrice: 10,
  };
  const rows = [
    { ...published, id: 'edit', category: 'image_edit', generationCapabilities: [{ taskType: 'i2i' }] },
    { ...published, id: 'cinema', category: 'video', generationCapabilities: { modes: ['cinema'] } },
    { ...published, id: 'image-to-video', category: 'video', generationCapabilities: [{ taskType: 'i2v' }] },
    { ...published, id: 'music', displayName: 'Music model', category: 'music' },
    { ...published, id: 'reasoner', category: 'text' },
    { ...published, id: 'inactive', isActive: false, category: 'image' },
    { ...published, id: 'hidden', isVisible: false, category: 'image' },
    { ...published, id: 'unrouted', hasWorkingRoute: false, category: 'video' },
    { ...published, id: 'unpriced', creditsPrice: 0, category: 'audio' },
    { ...published, id: 'tool-only', category: 'image', generationCapabilities: { modes: ['clipping'] } },
  ];
  const groups = withPublicNavigationModels(categories, rows, '/zh');
  expect(groups.map(group => group.models.map(model => model.href))).toEqual([
    ['/zh/studio?tab=image&model=edit'],
    ['/zh/studio?tab=cinema&model=cinema', '/zh/studio?tab=video&model=image-to-video'],
    ['/zh/studio?tab=audio&model=music'],
    ['/zh/studio?tab=agents&model=reasoner'],
  ]);
  expect(groups[2].models[0].label).toBe('Music model');
});
