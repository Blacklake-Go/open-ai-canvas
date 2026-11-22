/**
 * 全局用户个人资料浮窗事件派发工具
 * 独立于组件，防止任何模块循环依赖
 */
export function openGlobalProfileModal(options = {}) {
  if (typeof window !== 'undefined') {
    const detail = typeof options === 'string' ? { userId: options } : options;
    window.dispatchEvent(
      new CustomEvent('open-profile-modal', {
        detail: {
          userId: detail.userId || null,
          creator: detail.creator || null,
          initialTab: detail.initialTab || 'creations',
          ...detail,
        },
      })
    );
  }
}

export function closeGlobalProfileModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('close-profile-modal'));
  }
}
