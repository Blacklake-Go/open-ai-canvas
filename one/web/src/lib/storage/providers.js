/**
 * 存储供应商目录（纯数据，客户端与服务端共用）。
 * 后台卡片、配置表单与服务端校验都以这里为唯一来源。
 */

export const STORAGE_PROVIDER_IDS = Object.freeze(['local', 'cos', 'oss', 'qiniu', 's3']);

export const PROVIDER_CATALOG = Object.freeze([
  {
    id: 'local',
    label: '服务器本地',
    description: '新增资源写入当前部署的数据目录，通过后端签名链接访问。',
    kind: '本地磁盘',
    fields: [],
  },
  {
    id: 'cos',
    label: '腾讯云 COS',
    description: '新增资源写入腾讯云 Bucket，可由 Region 生成 Endpoint。',
    kind: '对象存储',
    defaults: { region: 'ap-guangzhou', endpoint: '' },
    fields: ['endpoint', 'region', 'bucket', 'accessKeyId', 'accessKeySecret', 'pathPrefix'],
  },
  {
    id: 'oss',
    label: '阿里云 OSS',
    description: '新增资源写入阿里云 Bucket，可选 CDN 域名读取。',
    kind: '对象存储',
    defaults: { region: 'cn-hangzhou', endpoint: '' },
    fields: ['endpoint', 'region', 'bucket', 'accessKeyId', 'accessKeySecret', 'pathPrefix'],
  },
  {
    id: 'qiniu',
    label: '七牛云 Kodo',
    description: '新增资源上传到 Kodo；无绑定域名时由后端代理读取。',
    kind: '对象存储',
    defaults: { region: 'cn-east-1', endpoint: '' },
    fields: ['endpoint', 'region', 'bucket', 'accessKeyId', 'accessKeySecret', 'pathPrefix'],
  },
  {
    id: 's3',
    label: 'S3 兼容存储',
    description: '支持 AWS S3、Cloudflare R2、Backblaze B2、RustFS 与自定义 S3 Endpoint。',
    kind: '对象存储',
    defaults: { region: 'us-east-1', endpoint: '' },
    fields: ['endpoint', 'region', 'bucket', 'accessKeyId', 'accessKeySecret', 'pathPrefix', 's3Preset', 'pathStyle'],
  },
]);

export const PROVIDER_LABELS = Object.freeze(
  Object.fromEntries(PROVIDER_CATALOG.map((item) => [item.id, item.label]))
);

export const S3_PRESETS = Object.freeze([
  { id: 'custom', label: '自定义 Endpoint' },
  { id: 'aws', label: 'AWS S3' },
  { id: 'cloudflare-r2', label: 'Cloudflare R2' },
  { id: 'backblaze-b2', label: 'Backblaze B2' },
  { id: 'rustfs', label: 'RustFS' },
]);

export function providerLabel(id) {
  return PROVIDER_LABELS[id] || id || '—';
}
