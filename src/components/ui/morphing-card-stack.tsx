"use client"

import { useState, type ReactNode } from "react"
import { motion, AnimatePresence, LayoutGroup, type PanInfo } from "framer-motion"
import { cn } from "@/lib/utils"
import { Grid3X3, Layers, LayoutList } from "lucide-react"

export type LayoutMode = "stack" | "grid" | "list"

export interface CardData {
  id: string
  title: string
  description: string
  icon?: ReactNode
  color?: string
}

export interface MorphingCardStackProps {
  cards?: CardData[]
  className?: string
  defaultLayout?: LayoutMode
  onCardClick?: (card: CardData) => void
}

const layoutIcons = {
  stack: Layers,
  grid: Grid3X3,
  list: LayoutList,
}

const SWIPE_THRESHOLD = 50

export function MorphingCardStack({
  cards = [],
  className,
  defaultLayout = "stack",
  onCardClick,
}: MorphingCardStackProps) {
  const [layout, setLayout] = useState<LayoutMode>(defaultLayout)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  if (!cards || cards.length === 0) {
    return null
  }

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const { offset, velocity } = info
    const swipe = Math.abs(offset.x) * velocity.x

    if (offset.x < -SWIPE_THRESHOLD || swipe < -1000) {
      // Swiped left - go to next card
      setActiveIndex((prev) => (prev + 1) % cards.length)
    } else if (offset.x > SWIPE_THRESHOLD || swipe > 1000) {
      // Swiped right - go to previous card
      setActiveIndex((prev) => (prev - 1 + cards.length) % cards.length)
    }
    setIsDragging(false)
  }

  const getStackOrder = () => {
    const reordered = []
    for (let i = 0; i < cards.length; i++) {
      const index = (activeIndex + i) % cards.length
      reordered.push({ ...cards[index], stackPosition: i })
    }
    return reordered.reverse() // Reverse so top card renders last (on top)
  }

  const getLayoutStyles = (stackPosition: number) => {
    switch (layout) {
      case "stack":
        return {
          top: stackPosition * 8,
          left: stackPosition * 8,
          zIndex: cards.length - stackPosition,
          rotate: (stackPosition - 1) * 2,
        }
      case "grid":
        return {
          top: 0,
          left: 0,
          zIndex: 1,
          rotate: 0,
        }
      case "list":
        return {
          top: 0,
          left: 0,
          zIndex: 1,
          rotate: 0,
        }
    }
  }

  const containerStyles = {
    stack: "relative h-80 w-80 md:h-96 md:w-96",
    grid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
    list: "flex flex-col gap-6",
  }

  const displayCards = layout === "stack" ? getStackOrder() : cards.map((c, i) => ({ ...c, stackPosition: i }))

  return (
    <div className={cn("space-y-8", className)}>
      {/* Layout Toggle */}
      <div className="flex items-center justify-center gap-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1 w-fit mx-auto backdrop-blur-xl">
        {(Object.keys(layoutIcons) as LayoutMode[]).map((mode) => {
          const Icon = layoutIcons[mode]
          return (
            <button
              key={mode}
              onClick={() => setLayout(mode)}
              className={cn(
                "rounded-full px-4 py-2 transition-all text-xs font-bold uppercase tracking-widest",
                layout === mode
                  ? "bg-brand-cyan text-brand-dark"
                  : "text-slate-500 dark:text-brand-muted hover:text-brand-cyan hover:bg-brand-cyan/10",
              )}
              aria-label={`Switch to ${mode} layout`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{mode}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Cards Container */}
      <LayoutGroup>
        <motion.div layout className={cn(containerStyles[layout], "mx-auto")}>
          <AnimatePresence mode="popLayout">
            {displayCards.map((card) => {
              const styles = getLayoutStyles(card.stackPosition)
              const isExpanded = expandedCard === card.id
              const isTopCard = layout === "stack" && card.stackPosition === 0

              return (
                <motion.div
                  key={card.id}
                  layoutId={card.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: 1,
                    scale: isExpanded ? 1.05 : 1,
                    x: 0,
                    ...styles,
                  }}
                  exit={{ opacity: 0, scale: 0.8, x: -200 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                  }}
                  drag={isTopCard ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.7}
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={handleDragEnd}
                  whileDrag={{ scale: 1.02, cursor: "grabbing" }}
                  onClick={() => {
                    if (isDragging) return
                    setExpandedCard(isExpanded ? null : card.id)
                    onCardClick?.(card)
                  }}
                  className={cn(
                    "cursor-pointer rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 backdrop-blur-xl shadow-2xl transition-all duration-300",
                    "hover:border-brand-cyan/50",
                    layout === "stack" && "absolute w-full h-full",
                    layout === "stack" && isTopCard && "cursor-grab active:cursor-grabbing shadow-brand-cyan/10",
                    layout === "grid" && "w-full",
                    layout === "list" && "w-full",
                    isExpanded && "ring-2 ring-brand-cyan border-brand-cyan",
                  )}
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-center gap-4 mb-6">
                      {card.icon && (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
                          {card.icon}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate">{card.title}</h3>
                        <div className="text-xs font-bold text-brand-cyan uppercase tracking-widest mt-1">Verified Client</div>
                      </div>
                    </div>

                    <div className="flex-grow">
                      <p
                        className={cn(
                          "text-lg text-slate-700 dark:text-brand-muted leading-relaxed italic",
                          layout === "stack" && "line-clamp-4 md:line-clamp-6",
                          layout === "grid" && "line-clamp-3",
                          layout === "list" && "line-clamp-none",
                        )}
                      >
                        &quot;{card.description}&quot;
                      </p>
                    </div>

                    {isTopCard && (
                      <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                         <div className="flex gap-1">
                            {[1,2,3,4,5].map(i => (
                              <div key={i} className="w-1 h-1 rounded-full bg-brand-cyan" />
                            ))}
                         </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">Swipe to navigate</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>

      {layout === "stack" && cards.length > 1 && (
        <div className="flex justify-center gap-2">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                index === activeIndex ? "w-8 bg-brand-cyan" : "w-2 bg-slate-300 dark:bg-white/10 hover:bg-brand-cyan/50",
              )}
              aria-label={`Go to card ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
