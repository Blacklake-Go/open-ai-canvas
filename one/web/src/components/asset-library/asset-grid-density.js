import enCopy from '@/messages/en/assetLibraryV2.json';

export function getAssetGridDensityOptions(copy = enCopy) {
  return [
    { label: copy.densityComfortable, value: 6 },
    { label: copy.densityStandard, value: 8 },
    { label: copy.densityCompact, value: 10 },
  ];
}

export const ASSET_GRID_CARD_MIN_WIDTH = {
  6: 272,
  8: 208,
  10: 160,
};

export function parseAssetGridDensity(value) {
  const number = Number(value);
  return number === 6 || number === 10 ? number : 8;
}

export function readAssetGridDensity(key) {
  if (typeof window === 'undefined') return 8;
  return parseAssetGridDensity(window.localStorage.getItem(key));
}
