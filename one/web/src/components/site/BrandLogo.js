'use client';

import { useEffect, useState } from 'react';
import { Box, Sparkles, Wand2, Zap } from 'lucide-react';

function DynamicVectorIcon({ iconName, color, className }) {
  switch (iconName) {
    case 'sparkles':
      return <Sparkles className={className} style={{ color }} />;
    case 'wand':
      return <Wand2 className={className} style={{ color }} />;
    case 'zap':
      return <Zap className={className} style={{ color }} />;
    case 'cube':
      return <Box className={className} style={{ color }} />;
    case 'layers':
    default:
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
  }
}

export default function BrandLogo({
  brand,
  className = 'inline-flex items-center gap-2.5',
  nameClassName = 'text-sm font-bold tracking-tight text-white font-jost',
  imageClassName = 'h-full w-auto max-h-8 max-w-[180px] object-contain',
  showName = undefined,
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [brand?.logoUrl]);

  const brandName = brand?.brandName || 'SupDance';
  const logoBgColor = brand?.logoBgColor || '#e11d74';
  const logoTextColor = brand?.logoTextColor || '#ffffff';
  const hasImage = Boolean(brand?.logoUrl && !imgError);
  const shouldShowName = showName !== undefined ? showName : Boolean(brand?.showBrandName || !hasImage);

  return (
    <span className={className} aria-label={brandName}>
      {hasImage ? (
        <span className="h-8 max-w-[180px] flex items-center justify-center transition-transform duration-200">
          <img
            src={brand.logoUrl}
            alt={brandName}
            className={imageClassName}
            onError={() => setImgError(true)}
          />
        </span>
      ) : (
        <span
          className="size-8 rounded-lg flex items-center justify-center shadow-lg transition-transform duration-200"
          style={{
            backgroundColor: logoBgColor,
            boxShadow: `0 4px 14px ${logoBgColor}33`,
          }}
        >
          <DynamicVectorIcon
            iconName={brand?.logoIcon || 'layers'}
            color={logoTextColor}
            className="size-5"
          />
        </span>
      )}

      {shouldShowName && <span className={nameClassName}>{brandName}</span>}
    </span>
  );
}
