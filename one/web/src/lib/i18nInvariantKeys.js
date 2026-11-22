/**
 * Keys whose translation is *expected* to equal the English source.
 *
 * The i18n validators flag "value identical to English" as a fallback signal —
 * that is how an untranslated string gets caught. Brand names, model
 * identifiers, payment-provider wordmarks and separator glyphs are legitimately
 * the same in more than one locale, so they would otherwise produce a permanent
 * false positive that trains everyone to ignore the signal.
 *
 * This module is the single source of truth. Both `lib/i18nCatalog.js` (admin
 * language UI + publish gate) and `scripts/validate-i18n.mjs` (CI) read it.
 * It used to be a hand-copied list in each file, which is how the two drifted
 * apart and started reporting real untranslated copy as noise.
 *
 * Zero imports on purpose: `lib/i18nCatalog.js` pulls in `server-only`, so a
 * plain Node script cannot import it, and `lib/locales.js` static-imports
 * message JSON that bare Node cannot resolve.
 *
 * Two tiers, because a word that is a cognate in one language is still a
 * translation gap in another:
 *
 *   INVARIANT_TRANSLATION_KEYS          — same in every locale (wordmarks,
 *                                          identifiers, punctuation)
 *   LOCALE_INVARIANT_TRANSLATION_KEYS   — same in English only for one locale,
 *                                          written `key@locale` (true cognates)
 *
 * Adding an entry is a claim that the value cannot be translated, not that
 * translating it is inconvenient. Put the reason in the comment.
 */

export const INVARIANT_TRANSLATION_KEYS = new Set([
  // Login providers render the vendor's own Latin wordmark everywhere.
  'common.authModal.providerGoogle',
  'common.authModal.providerTikTok',
  'common.authModal.providerX',
  'common.authModal.providerQQ',
  'common.authModal.providerWeChat',
  'common.authModal.providerDouyin',
  // An example address is a format hint, not copy.
  'common.authModal.emailPlaceholder',
  // Product name.
  'common.homePortal.cliTitle',
  // Payment channel wordmarks kept in their brand Latin form.
  'common.billing.alipay',
  'common.billing.wechat',
  // Internal currency name.
  'common.financial.kcoin',
  // Media-type tokens used as identifiers in the asset UI.
  'common.account.avatar',
  'common.onboarding.avatarLabel',
  'common.assetLibrary.audio',
  'studio.imageStudio.mediaMenu.audio',
  // Routing-mode label: Seedance "VIP" channel and MiniMax "LoRA" profile are
  // product-mode identifiers rather than descriptive prose.
  'studio.videoStudio.minimax.profiles.lora.label',
  'studio.videoStudio.seedance.profiles.vip.label',
  'studio.videoStudio.seedance.toolVariants.vip',
  // Delimiter between negative prompts — the glyph itself is the value.
  'studio.imageStudio.negativePrompt.separator',
  // Musical term used as a technical field label.
  'studio.audioStudio.fields.sound_tempo.title',
  // Upstream model identifiers; the vendor spells them in Latin script.
  'studio.audioStudio.models.elevenlabs-tts-turbo-2-5.name',
  'studio.audioStudio.models.gemini-2-5-pro-tts.name',
  'studio.audioStudio.models.gemini-3-1-flash-tts.name',
  'studio.audioStudio.models.suno-v4.name',
  'studio.audioStudio.models.suno-v3.5.name',
]);

/**
 * Spanish borrows these words from Latin with identical spelling, so the
 * correct Spanish translation is character-for-character the English source.
 * Scoped per locale: Japanese and Korean *do* translate all four, and a global
 * exemption here would have let their real gaps pass unnoticed.
 */
export const LOCALE_INVARIANT_TRANSLATION_KEYS = new Set([
  'assetLibraryV2.kindLabels.audio@es',       // RAE lists "audio" as a Spanish noun
  'assetLibraryV2.audioFallback@es',          // same word, same spelling
  'assetLibraryV2.categoryLabels.material@es', // "material" is a Spanish adjective
  'assetLibraryV2.durationSeconds@es',        // "s" is the SI symbol for segundos
  // "instrumental" is spelled identically in Spanish music UI.
  'studio.audioStudio.sidebar.musicModes.instrumental@es',
]);

export function isInvariantTranslationKey(key, locale) {
  if (INVARIANT_TRANSLATION_KEYS.has(key)) return true;
  return locale ? LOCALE_INVARIANT_TRANSLATION_KEYS.has(`${key}@${locale}`) : false;
}
