'use client';

import { createContext, useContext } from 'react';
import enCopy from '@/messages/en/assetLibraryV2.json';

const AssetLibraryCopyContext = createContext(null);

export function AssetLibraryCopyProvider({ copy, children }) {
  return <AssetLibraryCopyContext.Provider value={copy || enCopy}>{children}</AssetLibraryCopyContext.Provider>;
}

export function useAssetLibraryCopy() {
  return useContext(AssetLibraryCopyContext) || enCopy;
}

export function fillCopy(template, values = {}) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (match, key) => (
    values[key] === undefined || values[key] === null ? match : String(values[key])
  ));
}
