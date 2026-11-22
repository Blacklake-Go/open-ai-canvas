import en from '../messages/en/assetLibraryV2.json';
import zh from '../messages/zh/assetLibraryV2.json';
import ja from '../messages/ja-JP/assetLibraryV2.json';
import ko from '../messages/ko-KR/assetLibraryV2.json';
import zhTw from '../messages/zh-TW/assetLibraryV2.json';
import es from '../messages/es/assetLibraryV2.json';
import { normalizeLocale } from './locales';

const COPY = {
  en,
  'zh-CN': zh,
  'ja-JP': ja,
  'ko-KR': ko,
  'zh-TW': zhTw,
  es,
};

export function getAssetLibraryCopy(locale) {
  const normalized = normalizeLocale(locale);
  return { ...en, ...(COPY[normalized] || {}), locale: normalized };
}
