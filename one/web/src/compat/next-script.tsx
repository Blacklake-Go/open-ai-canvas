import { useEffect, useRef } from 'react';

export interface NextScriptProps {
  id?: string;
  src?: string;
  strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload' | 'worker';
  onLoad?: () => void;
  onReady?: () => void;
  onError?: (e: unknown) => void;
  dangerouslySetInnerHTML?: { __html: string };
  children?: string;
  async?: boolean;
  defer?: boolean;
  type?: string;
}

export default function Script({
  id,
  src,
  strategy = 'afterInteractive',
  onLoad,
  onReady,
  onError,
  dangerouslySetInnerHTML,
  children,
  async = true,
  defer,
  type,
}: NextScriptProps) {
  const inlineCode =
    dangerouslySetInnerHTML?.__html ?? (typeof children === 'string' ? children : '');

  const onLoadRef = useRef(onLoad);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const inject = () => {
      if (id && document.getElementById(id)) {
        onReadyRef.current?.();
        return;
      }
      if (src && !id && document.querySelector(`script[src="${CSS.escape(src)}"]`)) {
        onReadyRef.current?.();
        return;
      }
      const el = document.createElement('script');
      if (id) el.id = id;
      if (type) el.type = type;
      if (src) {
        el.src = src;
        el.async = async;
        if (defer !== undefined) el.defer = defer;
        el.onload = () => {
          onLoadRef.current?.();
          onReadyRef.current?.();
        };
        el.onerror = (err) => onErrorRef.current?.(err);
      } else if (inlineCode) {
        el.text = inlineCode;
      }
      document.body.appendChild(el);
      if (!src) {
        onLoadRef.current?.();
        onReadyRef.current?.();
      }
    };

    if (strategy === 'lazyOnload') {
      const timer = window.setTimeout(inject, 0);
      return () => window.clearTimeout(timer);
    }

    inject();
    return undefined;
  }, [id, src, strategy, inlineCode, async, defer, type]);

  return null;
}
