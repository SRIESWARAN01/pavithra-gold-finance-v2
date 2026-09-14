import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  hideText?: boolean;
}

export default function Logo({ size = 'md', className = '', hideText = false }: LogoProps) {
  const dimensions = {
    sm: { imgSize: 'w-8 h-8', textTitle: 'text-sm', textSubtitle: 'text-[9px]', gap: 'gap-2.5' },
    md: { imgSize: 'w-10 h-10', textTitle: 'text-base', textSubtitle: 'text-[10px]', gap: 'gap-3' },
    lg: { imgSize: 'w-12 h-12', textTitle: 'text-lg', textSubtitle: 'text-[11px]', gap: 'gap-3' },
    xl: { imgSize: 'w-24 h-24', textTitle: 'text-2xl', textSubtitle: 'text-xs', gap: 'gap-4' },
  };

  const current = dimensions[size];

  return (
    <div className={`flex items-center ${current.gap} ${className}`}>
      {/* Premium Circular Emblem Shield wrapper */}
      <div className={`relative ${current.imgSize} rounded-full overflow-hidden border-2 border-blue-100 bg-white flex items-center justify-center shadow-sm shrink-0`}>
        <img 
          src="/logo.jpg" 
          alt="PGF" 
          className="w-full h-full object-cover scale-[1.1] transition-transform duration-300 hover:scale-125"
        />
        {/* Subtle inner metallic highlight ring */}
        <div className="absolute inset-0 rounded-full border border-white/30 pointer-events-none" />
      </div>

      {!hideText && (
        <div className="flex flex-col justify-center">
          <h1 className={`font-bold text-gray-900 tracking-wide leading-none font-outfit ${current.textTitle}`}>
            Pavithra
          </h1>
          <span className={`text-blue-600 tracking-[0.12em] uppercase font-semibold leading-none mt-1 ${current.textSubtitle}`}>
            Gold Finance
          </span>
        </div>
      )}
    </div>
  );
}
