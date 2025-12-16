import React, { useRef, useState, useEffect } from 'react';

interface VirtualJoystickProps {
  onMove: (x: number, y: number) => void;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ onMove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [origin, setOrigin] = useState({ x: 0, y: 0 }); // Where the touch started

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      // For a fixed joystick, origin is center. 
      // For a floating one we might set origin to touch. 
      // Here we implement a fixed area at bottom left but the stick centers on touch or fixed center.
      // Let's go with fixed center for consistency in this UI.
      setActive(true);
      updatePosition(touch.clientX, touch.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!active) return;
    const touch = e.touches[0];
    updatePosition(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setActive(false);
    setPosition({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const updatePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = rect.width / 2;

    let clampedX = dx;
    let clampedY = dy;

    // Normalize if outside radius
    if (distance > maxRadius) {
      const angle = Math.atan2(dy, dx);
      clampedX = Math.cos(angle) * maxRadius;
      clampedY = Math.sin(angle) * maxRadius;
    }

    setPosition({ x: clampedX, y: clampedY });
    
    // Output normalized vector (-1 to 1)
    onMove(clampedX / maxRadius, clampedY / maxRadius);
  };

  return (
    <div 
      className="absolute bottom-8 left-8 w-40 h-40 z-50 opacity-60 hover:opacity-100 transition-opacity"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        ref={containerRef}
        className="relative w-full h-full rounded-full bg-slate-800/50 border-2 border-white/30 backdrop-blur-sm"
      >
        <div 
          className="absolute top-1/2 left-1/2 w-16 h-16 bg-white/80 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`
          }}
        />
      </div>
    </div>
  );
};
