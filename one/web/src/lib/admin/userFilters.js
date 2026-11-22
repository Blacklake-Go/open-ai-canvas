import { ROLE_LABELS } from './permissions';

export const PROVIDER_LABELS = {
  phone: '手机短信',
  email: '邮箱密码',
  wechat: '微信',
  wechat_oauth: '微信',
  qq: 'QQ',
  douyin: '抖音',
  bilibili: '哔哩哔哩',
  google: 'Google',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  x: 'X (Twitter)',
  github: 'GitHub',
  apple: 'Apple',
};

export const LOGIN_PROVIDER_OPTIONS = Object.entries(PROVIDER_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const USER_ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function providerLabel(provider) {
  return PROVIDER_LABELS[provider] || provider || '未知渠道';
}
