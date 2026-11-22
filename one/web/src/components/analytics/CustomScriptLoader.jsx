'use client';

import { useEffect } from 'react';

/**
 * CustomScriptLoader
 * Safely parses and injects user-defined tracking scripts on the client side.
 * Enforces async execution, avoids hydration mismatch, and cleans up on unmount.
 */
export default function CustomScriptLoader({ code, customCode }) {
  const scriptContent = code ?? customCode ?? '';

  useEffect(() => {
    if (!scriptContent || typeof scriptContent !== 'string') return;
    const clean = scriptContent.trim();
    if (!clean) return;

    const mountedElements = [];

    // Parse snippet via DOMParser to isolate elements
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(clean, 'text/html');
      const scripts = doc.querySelectorAll('script');

      if (scripts.length > 0) {
        scripts.forEach((oldScript, index) => {
          const newScript = document.createElement('script');
          newScript.id = `custom-analytics-script-${index}`;
          newScript.async = true;

          // Copy attributes
          Array.from(oldScript.attributes).forEach((attr) => {
            newScript.setAttribute(attr.name, attr.value);
          });

          // Copy inline script content
          if (oldScript.textContent) {
            newScript.textContent = oldScript.textContent;
          }

          document.head.appendChild(newScript);
          mountedElements.push(newScript);
        });
      } else {
        // Raw JavaScript code provided without <script> wrapper
        const inlineScript = document.createElement('script');
        inlineScript.id = 'custom-analytics-inline-raw';
        inlineScript.async = true;
        inlineScript.textContent = clean;
        document.head.appendChild(inlineScript);
        mountedElements.push(inlineScript);
      }
    } catch (err) {
      console.warn('[analytics] Failed to parse custom script:', err?.message || err);
    }

    return () => {
      mountedElements.forEach((el) => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    };
  }, [scriptContent]);

  return null;
}
