const DATE_TIME_OPTIONS = { timeZone: 'Asia/Shanghai', hour12: false };

export function formatAdminDateTime(value) {
  return value ? new Date(value).toLocaleString('zh-CN', DATE_TIME_OPTIONS) : '—';
}
