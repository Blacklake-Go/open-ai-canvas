import React from 'react';

export interface StaticImageData {
  src: string;
  height?: number;
  width?: number;
  blurDataURL?: string;
}

export interface NextImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | StaticImageData;
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
  quality?: number | string;
  placeholder?: 'blur' | 'empty' | string;
  blurDataURL?: string;
  unoptimized?: boolean;
  loader?: (args: { src: string; width: number; quality?: number }) => string;
  onLoadingComplete?: (img: HTMLImageElement) => void;
}

const NextImage = React.forwardRef<HTMLImageElement, NextImageProps>(function NextImage(
  {
    src,
    alt,
    width,
    height,
    fill,
    priority,
    quality: _quality,
    placeholder: _placeholder,
    blurDataURL: _blurDataURL,
    unoptimized: _unoptimized,
    loader: _loader,
    onLoadingComplete,
    onLoad,
    loading,
    style,
    ...rest
  },
  ref,
) {
  const resolvedSrc = typeof src === 'string' ? src : src?.src || '';
  const resolvedStyle: React.CSSProperties | undefined = fill
    ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        ...(style || {}),
      }
    : style;

  return (
    <img
      ref={ref}
      src={resolvedSrc}
      alt={alt || ''}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={priority ? 'eager' : loading || 'lazy'}
      style={resolvedStyle}
      onLoad={(e) => {
        onLoad?.(e);
        if (onLoadingComplete && e.currentTarget) {
          onLoadingComplete(e.currentTarget);
        }
      }}
      {...rest}
    />
  );
});

export default NextImage;
