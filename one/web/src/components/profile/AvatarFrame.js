const FRAME_THEME_STYLES = {
  solar: {
    border: '1.5px solid rgba(245, 158, 11, 0.6)',
    boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.15)',
    color: '#fcd34d',
  },
  neon: {
    border: '1.5px solid rgba(225, 29, 116, 0.6)',
    boxShadow: '0 0 0 1px rgba(225, 29, 116, 0.15)',
    color: '#e11d74',
  },
  aurora: {
    border: '1.5px solid rgba(167, 139, 250, 0.6)',
    boxShadow: '0 0 0 1px rgba(167, 139, 250, 0.15)',
    color: '#c4b5fd',
  },
};

export function getAvatarFrameStyle(frame) {
  const theme = frame?.assetConfig?.theme || frame?.asset_config?.theme;
  return FRAME_THEME_STYLES[theme] || null;
}

export default function AvatarFrame({ frame, children, className = '' }) {
  const style = getAvatarFrameStyle(frame);
  if (!style) return <div className={`relative ${className}`}>{children}</div>;

  return (
    <div
      className={`relative rounded-full ${className}`}
      style={{ border: style.border, boxShadow: style.boxShadow }}
      data-avatar-frame={frame.slug}
      title={frame.name}
    >
      {children}
    </div>
  );
}
