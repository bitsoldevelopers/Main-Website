'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

// Types for the component
interface DockApp {
  id: string;
  name: string;
  icon: React.ReactNode | string;
}

interface MacOSDockProps {
  apps: DockApp[];
  onAppClick: (appId: string) => void;
  openApps?: string[];
  className?: string;
}

const MacOSDock: React.FC<MacOSDockProps> = ({ 
  apps, 
  onAppClick, 
  openApps = [],
  className = ''
}) => {
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [currentScales, setCurrentScales] = useState<number[]>(apps.map(() => 1));
  const [currentPositions, setCurrentPositions] = useState<number[]>([]);
  const dockRef = useRef<HTMLDivElement>(null);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastMouseMoveTime = useRef<number>(0);

  // Responsive size calculations based on viewport
  const getResponsiveConfig = useCallback(() => {
    if (typeof window === 'undefined') {
      return { baseIconSize: 64, maxScale: 1.5, effectWidth: 250 };
    }

    const smallerDimension = Math.min(window.innerWidth, window.innerHeight);
    
    if (smallerDimension < 480) {
      return {
        baseIconSize: Math.max(40, smallerDimension * 0.08),
        maxScale: 1.4,
        effectWidth: smallerDimension * 0.4
      };
    } else if (smallerDimension < 768) {
      return {
        baseIconSize: Math.max(48, smallerDimension * 0.07),
        maxScale: 1.5,
        effectWidth: smallerDimension * 0.35
      };
    } else if (smallerDimension < 1024) {
      return {
        baseIconSize: Math.max(56, smallerDimension * 0.06),
        maxScale: 1.6,
        effectWidth: smallerDimension * 0.3
      };
    } else {
      return {
        baseIconSize: Math.max(60, Math.min(64, smallerDimension * 0.05)),
        maxScale: 1.5,
        effectWidth: 250
      };
    }
  }, []);

  // Use a stable initial value for hydration safety
  const [config, setConfig] = useState({ baseIconSize: 64, maxScale: 1.5, effectWidth: 250 });
  const { baseIconSize, maxScale, effectWidth } = config;
  const minScale = 1.0;
  const baseSpacing = Math.max(12, baseIconSize * 0.2);

  // Update config on mount and resize
  useEffect(() => {
    const handleResize = () => {
      setConfig(getResponsiveConfig());
    };

    handleResize(); // Set initial client config
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getResponsiveConfig]);

  // Authentic macOS cosine-based magnification algorithm
  const calculateTargetMagnification = useCallback((mousePosition: number | null) => {
    if (mousePosition === null) {
      return apps.map(() => minScale);
    }

    return apps.map((_, index) => {
      const normalIconCenter = (index * (baseIconSize + baseSpacing)) + (baseIconSize / 2);
      const minX = mousePosition - (effectWidth / 2);
      const maxX = mousePosition + (effectWidth / 2);
      
      if (normalIconCenter < minX || normalIconCenter > maxX) {
        return minScale;
      }
      
      const theta = ((normalIconCenter - minX) / effectWidth) * 2 * Math.PI;
      const cappedTheta = Math.min(Math.max(theta, 0), 2 * Math.PI);
      const scaleFactor = (1 - Math.cos(cappedTheta)) / 2;
      
      return minScale + (scaleFactor * (maxScale - minScale));
    });
  }, [apps, baseIconSize, baseSpacing, effectWidth, maxScale, minScale]);

  // Calculate positions based on current scales
  const calculatePositions = useCallback((scales: number[]) => {
    let currentX = 0;
    
    return scales.map((scale) => {
      const scaledWidth = baseIconSize * scale;
      const centerX = currentX + (scaledWidth / 2);
      currentX += scaledWidth + baseSpacing;
      return centerX;
    });
  }, [baseIconSize, baseSpacing]);

  // Lay the icons out at rest whenever the apps or the icon size change.
  // Done while rendering (React's "adjust state when props change" pattern)
  // rather than in an effect, so the first paint already has positions.
  const layoutKey = `${apps.length}:${baseIconSize}:${baseSpacing}`;
  const [laidOutFor, setLaidOutFor] = useState('');
  if (laidOutFor !== layoutKey) {
    setLaidOutFor(layoutKey);
    const initialScales = apps.map(() => minScale);
    setCurrentScales(initialScales);
    setCurrentPositions(calculatePositions(initialScales));
  }

  // Animation loop: one frame per render, easing scales and positions toward
  // the magnification under the cursor. Each frame's state update re-renders,
  // which restarts this effect with fresh values.
  useEffect(() => {
    const tick = () => {
      const targetScales = calculateTargetMagnification(mouseX);
      const targetPositions = calculatePositions(targetScales);
      const lerpFactor = mouseX !== null ? 0.2 : 0.12;

      setCurrentScales(prevScales =>
        prevScales.map((currentScale, index) => currentScale + (targetScales[index] - currentScale) * lerpFactor)
      );
      setCurrentPositions(prevPositions =>
        prevPositions.map((currentPos, index) => currentPos + (targetPositions[index] - currentPos) * lerpFactor)
      );

      const scalesNeedUpdate = currentScales.some((scale, index) => Math.abs(scale - targetScales[index]) > 0.002);
      const positionsNeedUpdate = currentPositions.some((pos, index) => Math.abs(pos - targetPositions[index]) > 0.1);
      if (scalesNeedUpdate || positionsNeedUpdate || mouseX !== null) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [mouseX, calculateTargetMagnification, calculatePositions, currentScales, currentPositions]);

  // Throttled mouse movement handler
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const now = performance.now();
    
    if (now - lastMouseMoveTime.current < 16) {
      return;
    }
    
    lastMouseMoveTime.current = now;
    
    if (dockRef.current) {
      const rect = dockRef.current.getBoundingClientRect();
      const padding = Math.max(8, baseIconSize * 0.12);
      setMouseX(e.clientX - rect.left - padding);
    }
  }, [baseIconSize]);

  const handleMouseLeave = useCallback(() => {
    setMouseX(null);
  }, []);

  const createBounceAnimation = (element: HTMLElement) => {
    const bounceHeight = Math.max(-8, -baseIconSize * 0.15);
    element.style.transition = 'transform 0.2s ease-out';
    element.style.transform = `translateY(${bounceHeight}px)`;
    
    setTimeout(() => {
      element.style.transform = 'translateY(0px)';
    }, 200);
  };

  const handleAppClick = (appId: string, index: number) => {
    if (iconRefs.current[index]) {
      createBounceAnimation(iconRefs.current[index]!);
    }
    
    onAppClick(appId);
  };

  // Calculate content width
  const contentWidth = currentPositions.length > 0 
    ? Math.max(...currentPositions.map((pos, index) => 
        pos + (baseIconSize * currentScales[index]) / 2
      ))
    : (apps.length * (baseIconSize + baseSpacing)) - baseSpacing;

  const padding = Math.max(12, baseIconSize * 0.2);

    return (
    <div 
      ref={dockRef}
      className={`backdrop-blur-xl ${className}`}
      style={{
        width: `${contentWidth + padding * 2}px`,
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: `${Math.max(20, baseIconSize * 0.5)}px`,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: `
          0 ${Math.max(10, baseIconSize * 0.2)}px ${Math.max(30, baseIconSize * 0.6)}px rgba(0, 0, 0, 0.3),
          inset 0 1px 1px rgba(255, 255, 255, 0.1)
        `,
        padding: `${padding}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div 
        className="relative"
        style={{
          height: `${baseIconSize}px`,
          width: '100%'
        }}
      >
        {apps.map((app, index) => {
          const scale = currentScales[index];
          const position = currentPositions[index] || 0;
          const scaledSize = baseIconSize * scale;
          
          return (
            <div
              key={app.id}
              ref={(el) => { iconRefs.current[index] = el; }}
              className="absolute cursor-pointer flex flex-col items-center justify-end group/item"
              title={app.name}
              role="button"
              tabIndex={0}
              aria-label={app.name}
              onClick={() => handleAppClick(app.id, index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleAppClick(app.id, index);
                }
              }}
              style={{
                left: `${position - scaledSize / 2}px`,
                bottom: '0px',
                width: `${scaledSize}px`,
                height: `${scaledSize}px`,
                transformOrigin: 'bottom center',
                zIndex: Math.round(scale * 10)
              }}
            >
              {typeof app.icon === 'string' ? (
                // eslint-disable-next-line @next/next/no-img-element -- resized every animation frame; next/image would fetch a new size each time
                <img
                  src={app.icon}
                  alt={app.name}
                  width={scaledSize}
                  height={scaledSize}
                  className="object-contain"
                  style={{
                    filter: `drop-shadow(0 ${scale > 1.2 ? Math.max(4, baseIconSize * 0.1) : Math.max(2, baseIconSize * 0.06)}px ${scale > 1.2 ? Math.max(8, baseIconSize * 0.2) : Math.max(4, baseIconSize * 0.12)}px rgba(0,0,0,0.3))`
                  }}
                />
              ) : (
                <div 
                  className="flex items-center justify-center bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 group-hover/item:border-brand-cyan/50 transition-colors shadow-inner"
                  style={{
                    width: `${scaledSize}px`,
                    height: `${scaledSize}px`,
                  }}
                >
                  <div style={{ transform: `scale(${scale * 0.8})` }}>
                    {app.icon}
                  </div>
                </div>
              )}

              {/* Tooltip */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/80 backdrop-blur-md text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/item:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10 uppercase tracking-widest">
                {app.name}
              </div>
              
              {/* App Indicator Dot */}
              {openApps.includes(app.id) && (
                <div 
                  className="absolute"
                  style={{
                    bottom: `${Math.max(-4, -baseIconSize * 0.1)}px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: `${Math.max(4, baseIconSize * 0.08)}px`,
                    height: `${Math.max(4, baseIconSize * 0.08)}px`,
                    borderRadius: '50%',
                    backgroundColor: '#0066ff',
                    boxShadow: '0 0 8px rgba(0, 242, 254, 0.8)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MacOSDock;
