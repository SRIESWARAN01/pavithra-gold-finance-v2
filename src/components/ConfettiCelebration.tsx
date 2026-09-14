'use client';

import React, { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  shape: 'rect' | 'circle' | 'ribbon';
  duration: number;
  delay: number;
}

const CONFETTI_COLORS = [
  '#FFD700', // Gold
  '#2563EB', // Blue
  '#10B981', // Emerald Green
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#3B82F6', // Royal Blue
  '#14B8A6', // Teal
];

export default function ConfettiCelebration() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const generated: ConfettiPiece[] = [];
    const count = 75; // 75 colorful celebration particles

    for (let i = 0; i < count; i++) {
      const shapes: ('rect' | 'circle' | 'ribbon')[] = ['rect', 'circle', 'ribbon'];
      generated.push({
        id: i,
        x: Math.random() * 100, // percentage from left
        y: -10 - Math.random() * 20, // start above the screen
        size: 8 + Math.random() * 12,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * 360,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        duration: 2.5 + Math.random() * 3, // fall duration in seconds
        delay: Math.random() * 1.5, // staggered start
      });
    }

    setPieces(generated);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      <style jsx>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(0vh) rotate(0deg) scale(1);
            opacity: 1;
          }
          75% {
            opacity: 1;
          }
          100% {
            transform: translateY(115vh) rotate(720deg) scale(0.6);
            opacity: 0;
          }
        }
        @keyframes confettiSway {
          0%, 100% {
            margin-left: 0px;
          }
          50% {
            margin-left: 30px;
          }
        }
      `}</style>

      {pieces.map((p) => {
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.shape === 'ribbon' ? `${p.size * 1.8}px` : `${p.size}px`,
              height: p.shape === 'circle' ? `${p.size}px` : `${p.size * 0.6}px`,
              backgroundColor: p.color,
              borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'ribbon' ? '4px' : '2px',
              transform: `rotate(${p.rotation}deg)`,
              animation: `confettiFall ${p.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}s forwards, confettiSway ${p.duration * 0.5}s ease-in-out infinite`,
              boxShadow: `0 0 6px ${p.color}80`,
            }}
          />
        );
      })}
    </div>
  );
}
