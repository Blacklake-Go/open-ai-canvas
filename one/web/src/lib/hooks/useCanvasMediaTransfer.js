import { useEffect, useRef } from 'react';

const CHANNEL = 'supdance.one.canvas-media.v1';
const MAX_SIZE = 100 * 1024 * 1024;
const TIMEOUT = 5 * 60 * 1000;

function canvasOrigin() {
  const localTarget = import.meta.env.VITE_ONE_CANVAS_TARGET_ORIGIN?.trim();
  if (/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(localTarget || '') && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return localTarget;
  }
  return 'https://canvas.supdance.com';
}

export function isCanvasTransferable(creation) {
  return creation?.status === 'succeeded'
    && /^[A-Za-z0-9_-]+$/.test(creation.asset_id || '')
    && ['image', 'video', 'audio'].includes(creation.mediaType);
}

export function useCanvasMediaTransfer(owner, onFailure) {
  const active = useRef(null);
  useEffect(() => () => {
    active.current?.stop();
    active.current = null;
  }, [owner]);

  function start(creation) {
    if (!owner || !isCanvasTransferable(creation)) return;
    if (active.current) {
      active.current.popup.focus();
      return;
    }
    const target = canvasOrigin();
    const id = crypto.randomUUID();
    const params = new URLSearchParams({ id, source: window.location.origin });
    const popup = window.open(`${target}/canvas/import-one#${params}`, '_blank');
    if (!popup) {
      onFailure('popup');
      return;
    }

    let port;
    let sending = false;
    const controller = new AbortController();
    const done = (failure) => {
      active.current?.stop();
      active.current = null;
      if (failure) onFailure(failure);
    };
    const expiry = window.setTimeout(() => done('expired'), TIMEOUT);
    const closed = window.setInterval(() => { if (popup.closed) done(); }, 750);
    const stop = () => {
      window.removeEventListener('message', connect);
      window.clearTimeout(expiry);
      window.clearInterval(closed);
      controller.abort();
      port?.close();
    };
    active.current = { stop, popup };

    async function fetchMedia() {
      if (sending) return;
      sending = true;
      try {
        const path = `/api/assets/${encodeURIComponent(creation.asset_id)}/download?inline=1&transfer=canvas`;
        const response = await fetch(path, {
          credentials: 'include', cache: 'no-store', redirect: 'error', signal: controller.signal,
          headers: { 'X-ONE-Expected-User': owner },
        });
        const declaredSize = Number(response.headers.get('content-length'));
        if (!response.ok || declaredSize > MAX_SIZE) throw new Error('asset unavailable');
        const blob = await response.blob();
        if (!blob.size || blob.size > MAX_SIZE || !blob.type.startsWith(`${creation.mediaType}/`)) throw new Error('invalid media');
        port.postMessage({ phase: 'media', blob, title: String(creation.prompt || creation.label || '').slice(0, 100) });
      } catch {
        if (!controller.signal.aborted) port.postMessage({ phase: 'unavailable' });
      } finally {
        sending = false;
      }
    }

    function connect(event) {
      if (event.origin !== target || event.source !== popup || event.data?.channel !== CHANNEL || event.data?.id !== id || port) return;
      if (event.data.phase !== 'hello') return;
      const channel = new MessageChannel();
      port = channel.port1;
      port.onmessage = ({ data }) => {
        if (data?.phase === 'request') void fetchMedia();
        if (data?.phase === 'complete' || data?.phase === 'cancel') done();
      };
      window.removeEventListener('message', connect);
      popup.postMessage({
        channel: CHANNEL, id, phase: 'offer',
        kind: creation.mediaType,
      }, target, [channel.port2]);
    }
    window.addEventListener('message', connect);
  }
  return { start };
}
