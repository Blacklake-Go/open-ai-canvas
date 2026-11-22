import { getProviderLogo } from "./providerLogos.js";
import { MODEL_DESCRIPTIONS } from "./modelDescriptions.js";

const BRAND_PREFIXES = [
  {
    matches: /bytedance|byteplus|volcengine|seedream|seedance|doubao|jimeng|aesthetic|字节|即梦|豆包/i,
    aliases: ["ByteDance", "BytePlus", "Volcengine", "火山引擎", "字节跳动", "字节", "即梦", "豆包"],
  },
  {
    matches: /openai|gpt|dall.?e|sora/i,
    aliases: ["OpenAI"],
  },
  {
    matches: /google|deepmind|gemini|veo|imagen/i,
    aliases: ["Google DeepMind", "DeepMind", "Google"],
  },
  {
    matches: /alibaba|aliyun|dashscope|wan|qwen|通义|阿里/i,
    aliases: ["Alibaba Group", "Alibaba", "阿里巴巴集团", "阿里巴巴", "阿里云", "阿里通义", "通义"],
  },
  {
    matches: /kuaishou|kling|快手|可灵/i,
    aliases: ["Kuaishou", "快手"],
  },
  {
    matches: /minimax|hailuo|海螺/i,
    aliases: ["MiniMax"],
  },
  {
    matches: /anthropic|claude/i,
    aliases: ["Anthropic"],
  },
  {
    matches: /deepseek|深度求索/i,
    aliases: ["DeepSeek", "深度求索"],
  },
  {
    matches: /tencent|hunyuan|腾讯|混元/i,
    aliases: ["Tencent", "腾讯"],
  },
  {
    matches: /blackforest|\bbfl\b|flux/i,
    aliases: ["Black Forest Labs", "Black Forest", "BFL"],
  },
  {
    matches: /stability|stable-diffusion/i,
    aliases: ["Stability AI", "Stability"],
  },
  {
    matches: /xai|grok/i,
    aliases: ["xAI", "X.AI"],
  },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasSpecificBrandLogo(provider, modelId) {
  const logo = getProviderLogo(provider, modelId);
  return Boolean(logo && !logo.endsWith("/other.svg"));
}

function removeBrandPrefix(name, provider, modelId) {
  const identity = `${provider || ""} ${modelId || ""} ${name}`;
  const brand = BRAND_PREFIXES.find(({ matches }) => matches.test(identity));
  if (!brand || !hasSpecificBrandLogo(provider, modelId)) return name;

  const aliases = [...brand.aliases].sort((left, right) => right.length - left.length);
  for (const alias of aliases) {
    const prefix = new RegExp(
      `^\\s*${escapeRegExp(alias)}(?=$|[\\s:：|/·—–-]|[\\u4e00-\\u9fff])`,
      "i",
    );
    if (prefix.test(name)) {
      return name
        .replace(prefix, "")
        .replace(/^[\s:：|/·—–-]+/, "")
        .trim();
    }
  }
  return name;
}

function removeDuplicateBadge(name, badge) {
  const badgeText = String(badge || "").trim();
  if (!badgeText || badgeText === "✦") return name;

  const suffix = new RegExp(
    `(?:[\\s(（\\[_/·-]+)${escapeRegExp(badgeText)}[)）\\]]?$`,
    "i",
  );
  return name.replace(suffix, "").trim() || name;
}

/** Static fallback shown after the server has no saved badge/description. */
export function getStaticModelDisplayMeta(modelId, locale = "zh") {
  if (!modelId) return { badge: null, description: "" };

  const cleanId = String(modelId)
    .toLowerCase()
    .replace(/-edit$/, "")
    .replace(/-(t2i|i2i|t2v|i2v|v2v)$/, "");
  const match = Object.entries(MODEL_DESCRIPTIONS).find(([key]) =>
    cleanId === key || cleanId.includes(key) || key.includes(cleanId),
  )?.[1];

  return {
    badge: match?.badge || match?.tag || null,
    description: match
      ? (locale.startsWith("zh") ? match.zh : match.en)
      : (locale.startsWith("zh")
        ? "专业多模态高品质创作底座，极速响应，细节丰富。"
        : "Professional multimodal high-quality generative foundation."),
  };
}

/** Keep the provider name in the logo and the model family in its text label. */
export function formatModelDisplayName(name, { provider, modelId, badge } = {}) {
  const original = String(name || "").trim();
  if (!original) return "";

  const withoutBrand = removeBrandPrefix(original, provider, modelId);
  return removeDuplicateBadge(withoutBrand, badge);
}
