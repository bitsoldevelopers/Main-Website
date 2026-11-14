"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Zap, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: LucideIcon;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
}

export default function RadialOrbitalTimeline({
  timelineData,
}: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>(
    {}
  );
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((key) => {
        if (parseInt(key) !== id) {
          newState[parseInt(key)] = false;
        }
      });

      newState[id] = !prev[id];

      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);

        const relatedItems = getRelatedItems(id);
        const newPulseEffect: Record<number, boolean> = {};
        relatedItems.forEach((relId) => {
          newPulseEffect[relId] = true;
        });
        setPulseEffect(newPulseEffect);

        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }

      return newState;
    });
  };

  useEffect(() => {
    let rotationTimer: NodeJS.Timeout;

    if (autoRotate) {
      rotationTimer = setInterval(() => {
        setRotationAngle((prev) => {
          const newAngle = (prev + 0.3) % 360;
          return Number(newAngle.toFixed(3));
        });
      }, 50);
    }

    return () => {
      if (rotationTimer) {
        clearInterval(rotationTimer);
      }
    };
  }, [autoRotate]);

  const centerViewOnNode = (nodeId: number) => {
    if (!nodeRefs.current[nodeId]) return;

    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;

    setRotationAngle(270 - targetAngle);
  };

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = 250; 
    const radian = (angle * Math.PI) / 180;

    const x = radius * Math.cos(radian);
    const y = radius * Math.sin(radian);

    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(
      0.4,
      Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2))
    );

    return { x, y, angle, zIndex, opacity };
  };

  const getRelatedItems = (itemId: number): number[] => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? currentItem.relatedIds : [];
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    const relatedItems = getRelatedItems(activeNodeId);
    return relatedItems.includes(itemId);
  };

  const getStatusStyles = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed":
        return "bg-brand-cyan text-brand-dark";
      case "in-progress":
        return "bg-brand-purple text-white";
      case "pending":
        return "bg-white/10 text-brand-muted border-white/20";
      default:
        return "bg-white/10 text-brand-muted";
    }
  };

  return (
    <div
      className="w-full h-[800px] flex flex-col items-center justify-center bg-transparent overflow-hidden relative"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      <div className="relative w-full max-w-5xl h-full flex items-center justify-center">
        <div
          className="absolute w-full h-full flex items-center justify-center"
          ref={orbitRef}
          style={{
            perspective: "1200px",
          }}
        >
          {/* Central Core */}
          <div className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-brand-cyan via-brand-purple to-indigo-600 animate-pulse flex items-center justify-center z-10 shadow-[0_0_50px_rgba(0,217,255,0.3)]">
            <div className="absolute w-32 h-32 rounded-full border border-brand-cyan/20 animate-ping opacity-70"></div>
            <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center">
               <div className="w-4 h-4 bg-white rounded-full animate-pulse shadow-[0_0_15px_white]" />
            </div>
          </div>

          {/* Orbit Ring */}
          <div className="absolute w-[500px] h-[500px] rounded-full border border-white/5 pointer-events-none"></div>

          {timelineData.map((item, index) => {
            const position = calculateNodePosition(index, timelineData.length);
            const isExpanded = expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;

            const nodeStyle = {
              transform: `translate(${position.x}px, ${position.y}px)`,
              zIndex: isExpanded ? 200 : position.zIndex,
              opacity: isExpanded ? 1 : position.opacity,
            };

            return (
              <div
                key={item.id}
                ref={(el) => { nodeRefs.current[item.id] = el; }}
                className="absolute transition-all duration-700 cursor-pointer"
                style={nodeStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItem(item.id);
                }}
              >
                {/* Glow Effect */}
                <div
                  className={`absolute rounded-full -inset-4 ${
                    isPulsing ? "animate-pulse duration-1000" : ""
                  } transition-opacity duration-500`}
                  style={{
                    background: `radial-gradient(circle, ${isExpanded ? 'rgba(0,217,255,0.2)' : 'rgba(255,255,255,0.05)'} 0%, transparent 70%)`,
                    width: `${item.energy * 0.8 + 60}px`,
                    height: `${item.energy * 0.8 + 60}px`,
                    left: `-${(item.energy * 0.8 + 60 - 40) / 2}px`,
                    top: `-${(item.energy * 0.8 + 60 - 40) / 2}px`,
                    opacity: isExpanded || isRelated ? 1 : 0.5
                  }}
                ></div>

                {/* Node Circle */}
                <div
                  className={`
                  w-12 h-12 rounded-full flex items-center justify-center
                  ${
                    isExpanded
                      ? "bg-brand-cyan text-brand-dark"
                      : isRelated
                      ? "bg-brand-purple text-white"
                      : "bg-white/10 backdrop-blur-xl text-white"
                  }
                  border-2 
                  ${
                    isExpanded
                      ? "border-white shadow-[0_0_20px_rgba(0,217,255,0.5)]"
                      : isRelated
                      ? "border-brand-cyan animate-pulse"
                      : "border-white/20"
                  }
                  transition-all duration-500 transform
                  ${isExpanded ? "scale-125" : "hover:scale-110"}
                `}
                >
                  <Icon size={20} />
                </div>

                {/* Year Label */}
                <div
                  className={`
                  absolute top-16 left-1/2 -translate-x-1/2 whitespace-nowrap
                  text-[10px] font-bold tracking-[0.2em] uppercase
                  transition-all duration-300
                  ${isExpanded ? "text-brand-cyan opacity-100" : "text-white/40"}
                `}
                >
                  {item.date.split(' ').pop()}
                </div>

                {/* Content Card */}
                {isExpanded && (
                  <Card className="absolute top-24 left-1/2 -translate-x-1/2 w-72 bg-brand-dark/95 backdrop-blur-2xl border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-visible">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-brand-cyan/50"></div>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-center mb-1">
                        <Badge
                          className={`px-2 py-0.5 text-[8px] font-bold tracking-widest ${getStatusStyles(
                            item.status
                          )}`}
                        >
                          {item.status.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] font-mono text-brand-muted">
                          {item.date}
                        </span>
                      </div>
                      <CardTitle className="text-lg text-white font-bold tracking-tight">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-brand-muted leading-relaxed">
                      <p className="mb-4">{item.content}</p>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-brand-cyan/70">
                          <span className="flex items-center">
                            <Zap size={12} className="mr-1" />
                            Innovation Scale
                          </span>
                          <span className="font-mono">{item.energy}%</span>
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-cyan to-brand-purple transition-all duration-1000"
                            style={{ width: `${item.energy}%` }}
                          ></div>
                        </div>
                      </div>

                      {item.relatedIds.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-white/5">
                          <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/30 mb-3">
                            Linked Milestones
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {item.relatedIds.map((relatedId) => {
                              const relatedItem = timelineData.find(
                                (i) => i.id === relatedId
                              );
                              return (
                                <button
                                  key={relatedId}
                                  className="flex items-center h-7 px-3 text-[9px] font-bold uppercase tracking-wider rounded-lg border border-white/10 bg-white/5 hover:bg-brand-cyan/10 hover:border-brand-cyan/30 text-white/60 hover:text-brand-cyan transition-all"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleItem(relatedId);
                                  }}
                                >
                                  {relatedItem?.title}
                                  <ArrowRight
                                    size={10}
                                    className="ml-2 opacity-50"
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
