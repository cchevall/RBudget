// Tiny canvas confetti: hearts, stars and coins
const COLORS = ['#ff8fb5', '#ffd166', '#a68bff', '#5fd0a8', '#6fb4ff', '#ff9f7a']
const SHAPES = ['♥', '★', '●', '✿']

export function burst(originY = 0.35) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 1
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '400' })
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const parts = Array.from({ length: 90 }, () => {
    const a = Math.random() * Math.PI * 2
    const v = 6 + Math.random() * 9
    return {
      x: innerWidth / 2,
      y: innerHeight * originY,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 6,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      s: 10 + Math.random() * 12,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      t: SHAPES[(Math.random() * SHAPES.length) | 0],
    }
  })
  const start = performance.now()
  const tick = (now: number) => {
    const el = now - start
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    for (const p of parts) {
      p.vy += 0.32
      p.vx *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.r += p.vr
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - el / 2200)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.r)
      ctx.fillStyle = p.c
      ctx.font = `${p.s}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(p.t, 0, 0)
      ctx.restore()
    }
    if (el < 2200) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}
