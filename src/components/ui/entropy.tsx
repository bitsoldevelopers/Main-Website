"use client";

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'

interface EntropyProps {
  className?: string
}

export function Entropy({ className = "" }: EntropyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mounted, setMounted] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const canvas = canvasRef.current
    if (!canvas) return

    // Skip entirely on small screens and on devices that prefer reduced motion
    const isSmallScreen = window.matchMedia('(max-width: 768px)').matches
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (isSmallScreen || prefersReducedMotion) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.scale(dpr, dpr)
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    const particleColor = theme === 'dark' ? '#00D9FF' : '#4F46E5'
    const width = window.innerWidth
    const height = window.innerHeight

    class Particle {
      x: number
      y: number
      order: boolean
      velocity: { x: number; y: number }
      originalX: number
      originalY: number
      influence: number
      neighbors: Particle[]
      /** Position in `particles`, used to draw each link from one end only. */
      id: number

      constructor(x: number, y: number, order: boolean, id: number) {
        this.x = x
        this.y = y
        this.originalX = x
        this.originalY = y
        this.order = order
        this.velocity = {
          x: (Math.random() - 0.5) * 1.5,
          y: (Math.random() - 0.5) * 1.5
        }
        this.influence = 0
        this.neighbors = []
        this.id = id
      }

      update() {
        if (this.order) {
          const dx = this.originalX - this.x
          const dy = this.originalY - this.y

          const chaosInfluence = { x: 0, y: 0 }
          this.neighbors.forEach(neighbor => {
            if (!neighbor.order) {
              const ndx = this.x - neighbor.x
              const ndy = this.y - neighbor.y
              const distance = Math.sqrt(ndx * ndx + ndy * ndy)
              const strength = Math.max(0, 1 - distance / 150)
              chaosInfluence.x += (neighbor.velocity.x * strength)
              chaosInfluence.y += (neighbor.velocity.y * strength)
              this.influence = Math.max(this.influence, strength)
            }
          })

          this.x += dx * 0.05 * (1 - this.influence) + chaosInfluence.x * this.influence
          this.y += dy * 0.05 * (1 - this.influence) + chaosInfluence.y * this.influence
          this.influence *= 0.98
        } else {
          this.velocity.x += (Math.random() - 0.5) * 0.3
          this.velocity.y += (Math.random() - 0.5) * 0.3
          this.velocity.x *= 0.98
          this.velocity.y *= 0.98
          this.x += this.velocity.x
          this.y += this.velocity.y

          if (this.x < width / 2 || this.x > width) this.velocity.x *= -1
          if (this.y < 0 || this.y > height) this.velocity.y *= -1
          this.x = Math.max(width / 2, Math.min(width, this.x))
          this.y = Math.max(0, Math.min(height, this.y))
        }
      }

    }

    const particles: Particle[] = []
    // Wider spacing on tablets cuts the particle count ~2x without changing the look
    const spacing = window.innerWidth < 1280 ? 60 : 40
    const cols = Math.ceil(width / spacing)
    const rows = Math.ceil(height / spacing)

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * spacing + spacing / 2
        const y = j * spacing + spacing / 2
        const order = x < width / 2
        particles.push(new Particle(x, y, order, particles.length))
      }
    }

    // Comparing every particle with every other one was 1.7M distance checks
    // at 1920×1080, done in a single frame once a second. Bucketing positions
    // into 120px cells means each particle only checks the 3×3 cells around it.
    const NEIGHBOR_RADIUS = 120
    function updateNeighbors() {
      const grid = new Map<string, Particle[]>()
      for (const p of particles) {
        const key = `${Math.floor(p.x / NEIGHBOR_RADIUS)},${Math.floor(p.y / NEIGHBOR_RADIUS)}`
        const cell = grid.get(key)
        if (cell) cell.push(p)
        else grid.set(key, [p])
      }
      for (const p of particles) {
        const cx = Math.floor(p.x / NEIGHBOR_RADIUS)
        const cy = Math.floor(p.y / NEIGHBOR_RADIUS)
        const neighbors: Particle[] = []
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          for (let gy = cy - 1; gy <= cy + 1; gy++) {
            for (const other of grid.get(`${gx},${gy}`) ?? []) {
              if (other === p) continue
              const dx = p.x - other.x
              const dy = p.y - other.y
              if (dx * dx + dy * dy < NEIGHBOR_RADIUS * NEIGHBOR_RADIUS) neighbors.push(other)
            }
          }
        }
        p.neighbors = neighbors
      }
    }

    // Dots and links used to be drawn one canvas call each — about 10,000
    // fill/stroke calls a frame at 1920×1080. They are now grouped by their
    // 8-bit alpha (the same rounding the colour string always used) and each
    // group is drawn as one path, so a frame is a few dozen calls.
    const colors = Array.from({ length: 256 }, (_, a) => `${particleColor}${a.toString(16).padStart(2, '0')}`)
    const alphaByte = (alpha: number) => Math.min(255, Math.max(0, Math.round(alpha * 255)))
    const dotBuckets: number[][] = Array.from({ length: 256 }, () => [])
    const lineBuckets: number[][] = Array.from({ length: 256 }, () => [])
    const TAU = Math.PI * 2
    const DOT_RADIUS = 1.5

    let time = 0
    let animationId: number | null = null
    let paused = document.hidden
    let lastFrame = 0

    function animate(now: number) {
      if (paused || !ctx || !canvas) {
        animationId = null
        return
      }
      animationId = requestAnimationFrame(animate)
      // Motion is a fixed step per frame, so on 120/144Hz screens the field
      // ran twice as fast and cost twice the CPU. Hold it to ~60fps.
      if (now - lastFrame < 15) return
      lastFrame = now

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (time % 60 === 0) updateNeighbors()

      for (const p of particles) p.update()

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        dotBuckets[alphaByte(p.order ? 0.4 - p.influence * 0.2 : 0.4)].push(p.x, p.y)

        for (const n of p.neighbors) {
          // Neighbour lists are symmetric; draw each link from one end only.
          if (n.id < i) continue
          const dx = p.x - n.x
          const dy = p.y - n.y
          const d2 = dx * dx + dy * dy
          if (d2 >= 3600) continue
          const alpha = 0.1 * (1 - Math.sqrt(d2) / 60)
          // Each link used to be stroked twice, once from each end, which
          // compounds the alpha. Drawn once, it needs that combined alpha.
          lineBuckets[alphaByte(1 - (1 - alpha) * (1 - alpha))].push(p.x, p.y, n.x, n.y)
        }
      }

      for (let a = 0; a < 256; a++) {
        const lines = lineBuckets[a]
        if (lines.length === 0) continue
        ctx.strokeStyle = colors[a]
        ctx.beginPath()
        for (let k = 0; k < lines.length; k += 4) {
          ctx.moveTo(lines[k], lines[k + 1])
          ctx.lineTo(lines[k + 2], lines[k + 3])
        }
        ctx.stroke()
        lines.length = 0
      }

      for (let a = 0; a < 256; a++) {
        const dots = dotBuckets[a]
        if (dots.length === 0) continue
        ctx.fillStyle = colors[a]
        ctx.beginPath()
        for (let k = 0; k < dots.length; k += 2) {
          ctx.moveTo(dots[k] + DOT_RADIUS, dots[k + 1])
          ctx.arc(dots[k], dots[k + 1], DOT_RADIUS, 0, TAU)
        }
        ctx.fill()
        dots.length = 0
      }

      time++
    }

    const handleVisibilityChange = () => {
      paused = document.hidden
      if (!paused && animationId === null) {
        animationId = requestAnimationFrame(animate)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    animationId = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [mounted, theme])

  if (!mounted) return null

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 -z-10 pointer-events-none ${className}`}
      style={{ background: 'transparent' }}
    />
  )
}