import React from 'react';
import { useLocation } from 'wouter';

export function Watermark() {
  const [location] = useLocation();
  const isAuthPage = ['/login', '/register', '/pending'].includes(location);

  return (
    <div
      className="fixed right-0 pointer-events-none flex items-center z-0"
      style={{
        top: isAuthPage ? '0' : '76px',
        bottom: isAuthPage ? '0' : 'calc(70px + env(safe-area-inset-bottom))'
      }}
    >
      <div
        className="brand-display text-foreground opacity-[0.03] whitespace-nowrap select-none flex items-center justify-center h-full"
        style={{
          fontSize: "calc((100dvh - 160px) / 4.0)",
          letterSpacing: "0.05em",
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          lineHeight: "0.85",
        }}
      >
        (INSIDERS)
      </div>
    </div>
  );
}
