/**
 * 全局认证浮窗事件派发工具
 * 独立于组件，防止任何模块循环依赖
 */
export function openGlobalAuthModal(options = {}) {
  if (typeof window !== 'undefined') {
    const detail = typeof options === 'string' ? { mode: options } : options;
    window.dispatchEvent(
      new CustomEvent('open-auth-modal', {
        detail: {
          mode: detail.mode || 'login',
          tab: detail.tab || 'email',
          ...detail,
        },
      })
    );
  }
}

export function closeGlobalAuthModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('close-auth-modal'));
  }
}
