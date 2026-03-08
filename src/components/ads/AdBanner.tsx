'use client';

import { useEffect, useRef } from 'react';

interface AdBannerProps {
  adKey: string;
  format?: 'banner' | 'native' | 'social-bar';
  width?: number;
  height?: number;
  className?: string;
}

export default function AdBanner({
  adKey,
  format = 'banner',
  width = 728,
  height = 90,
  className = '',
}: AdBannerProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current || !adRef.current || !adKey) return;
    loaded.current = true;

    try {
      const script = document.createElement('script');
      script.async = true;
      script.setAttribute('data-cfasync', 'false');

      if (format === 'social-bar') {
        script.src = `//pl${adKey}.profitablegatecpm.com/${adKey}.js`;
        document.head.appendChild(script);
      } else if (format === 'native') {
        script.src = `//pl${adKey}.profitablegatecpm.com/${adKey}.js`;
        adRef.current.appendChild(script);
      } else {
        // Standard banner
        const atOptions = {
          key: adKey,
          format: 'iframe',
          height,
          width,
          params: {},
        };
        const configScript = document.createElement('script');
        configScript.type = 'text/javascript';
        configScript.text = `atOptions = ${JSON.stringify(atOptions)};`;
        adRef.current.appendChild(configScript);

        script.src = `//www.highperformanceformat.com/${adKey}/invoke.js`;
        adRef.current.appendChild(script);
      }
    } catch (e) {
      console.error('Ad loading error:', e);
    }
  }, [adKey, format, width, height]);

  if (!adKey) return null;

  if (format === 'social-bar') {
    return null; // Social bar injects itself globally
  }

  return (
    <div
      ref={adRef}
      className={`flex items-center justify-center overflow-hidden ${className}`}
      style={{ minHeight: height, maxWidth: width }}
    />
  );
}
