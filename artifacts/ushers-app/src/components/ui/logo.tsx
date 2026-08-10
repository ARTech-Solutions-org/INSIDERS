import React from 'react';

export function Logo({ 
  className = "", 
  color = "foreground" 
}: { 
  className?: string, 
  color?: "foreground" | "white" | "primary" 
}) {
  const bgColorClass = 
    color === "white" ? "bg-white" : 
    color === "primary" ? "bg-primary" : 
    "bg-foreground";

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Invisible image to dictate the correct intrinsic dimensions */}
      <img 
        src="/insiders-logo.png" 
        alt="INSIDERS" 
        className="w-full h-full object-contain opacity-0" 
      />
      {/* Absolute div that uses the mask to render the color */}
      <div 
        className={`absolute inset-0 ${bgColorClass}`}
        style={{
          maskImage: "url('/insiders-logo.png')",
          WebkitMaskImage: "url('/insiders-logo.png')",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
      />
    </div>
  );
}
