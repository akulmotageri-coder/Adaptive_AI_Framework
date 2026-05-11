/**
 * VideoPanel — side-by-side raw vs enhanced frame display.
 *
 * Left  : raw degraded frame (Jaffe-McGlamery output)
 * Right : enhanced frame (CLAHE + backscatter removal output)
 *
 * Bounding boxes are drawn on the enhanced frame via a canvas
 * overlay that sits precisely on top of the image.
 *
 * Severity colours:
 *   critical → red
 *   high     → orange
 *   medium   → amber
 *   low      → teal
 */

import { useRef, useEffect, useState } from 'react'

const SEVERITY_COLORS = {
  critical: '#ff3344',
  high:     '#ff8800',
  medium:   '#ffaa00',
  low:      '#00d4ff',
}

const SEVERITY_GLOW = {
  critical: 'rgba(255,51,68,0.6)',
  high:     'rgba(255,136,0,0.5)',
  medium:   'rgba(255,170,0,0.4)',
  low:      'rgba(0,212,255,0.3)',
}

function drawDetections(canvas, detections, imgW, imgH) {
  if (!canvas) return
  const ctx    = canvas.getContext('2d')
  const scaleX = canvas.width  / imgW
  const scaleY = canvas.height / imgH

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  detections.forEach(det => {
    const { x1, y1, x2, y2 } = det.bbox
    const color = SEVERITY_COLORS[det.severity] || '#00d4ff'
    const glow  = SEVERITY_GLOW[det.severity]   || 'rgba(0,212,255,0.3)'

    const rx1 = x1 * scaleX
    const ry1 = y1 * scaleY
    const rx2 = x2 * scaleX
    const ry2 = y2 * scaleY
    const rw  = rx2 - rx1
    const rh  = ry2 - ry1

    // Outer glow
    ctx.shadowColor = glow
    ctx.shadowBlur  = 14

    // Bounding box
    ctx.strokeStyle = color
    ctx.lineWidth   = 2
    ctx.strokeRect(rx1, ry1, rw, rh)

    // Corner accents
    ctx.shadowBlur = 0
    const cs = Math.min(rw, rh, 16)
    ctx.lineWidth = 2.5
    ;[
      [rx1, ry1, cs, 0,   0,   cs],
      [rx2, ry1, -cs, 0,  0,   cs],
      [rx1, ry2, cs, 0,   0,  -cs],
      [rx2, ry2, -cs, 0,  0,  -cs],
    ].forEach(([sx, sy, dx1, dy1, dx2, dy2]) => {
      ctx.beginPath()
      ctx.moveTo(sx + dx1, sy)
      ctx.lineTo(sx, sy)
      ctx.lineTo(sx, sy + dy2)
      ctx.stroke()
    })

    // Label background
    const label    = `${det.display_name}  ${(det.adjusted_conf * 100).toFixed(0)}%`
    const fontSize = Math.max(10, Math.min(13, rw / 8))
    ctx.font       = `500 ${fontSize}px Inter, sans-serif`
    const tw       = ctx.measureText(label).width
    const lh       = fontSize + 6
    const lx       = rx1
    const ly       = ry1 > lh + 2 ? ry1 - lh - 2 : ry2 + 2

    ctx.fillStyle = color
    ctx.fillRect(lx, ly, tw + 10, lh)

    // Label text
    ctx.fillStyle    = '#000000'
    ctx.shadowColor  = 'transparent'
    ctx.fillText(label, lx + 5, ly + lh - 4)
  })
}

function FrameView({ title, src, badge, children }) {
  const [imgSrc, setImgSrc] = useState(null)

  useEffect(() => {
    if (!src) return
    if (src.startsWith('/api')) {
      // Poll the frame endpoint every 100ms
      const interval = setInterval(() => {
        setImgSrc(`http://localhost:8000${src}?t=${Date.now()}`)
      }, 100)
      return () => clearInterval(interval)
    } else {
      setImgSrc(src)
    }
  }, [src])

  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <div className="flex items-center justify-between px-2">
        <span
          className="mono text-xs font-medium tracking-widest uppercase"
          style={{ color: 'var(--teal-glow)' }}
        >
          {title}
        </span>
        {badge}
      </div>

      <div
        className="relative w-full rounded overflow-hidden"
        style={{
          border:      '1px solid var(--panel-border)',
          background:  '#000',
          aspectRatio: '4/3',
        }}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={title}
            style={{
              width:      '100%',
              height:     '100%',
              objectFit:  'cover',
              display:    'block',
            }}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span
              className="mono text-xs animate-pulse-teal"
              style={{ color: 'var(--text-dim)' }}
            >
              awaiting signal...
            </span>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
export default function VideoPanel({ frame, fps, connected }) {
  const canvasRef = useRef(null)
  const [imgSize, setImgSize] = useState({ w: 640, h: 480 })

  const detections = frame?.detections?.detections ?? []
  const rawSrc     = frame?.raw_frame  ?? null
  const enhSrc     = frame?.enh_frame  ?? null

  // Resolve image natural size once first frame arrives
  useEffect(() => {
    if (!enhSrc) return
    const img  = new Image()
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src    = enhSrc
  }, [enhSrc ? enhSrc.slice(0, 40) : null])

  // Redraw bounding boxes whenever detections or frame size changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const container = canvas.parentElement
    if (container) {
      canvas.width  = container.offsetWidth
      canvas.height = container.offsetHeight
    }

    drawDetections(canvas, detections, imgSize.w, imgSize.h)
  }, [detections, imgSize])

  // Severity counts for badge
  const critical = detections.filter(d => d.severity === 'critical').length
  const high     = detections.filter(d => d.severity === 'high').length
  const total    = detections.length

  const threatBadge = total > 0 ? (
    <div className="flex items-center gap-1">
      {critical > 0 && (
        <span
          className="mono text-xs px-2 py-0.5 rounded animate-pulse-red"
          style={{
            background: 'rgba(255,51,68,0.2)',
            border:     '1px solid #ff3344',
            color:      '#ff3344',
          }}
        >
          {critical} CRITICAL
        </span>
      )}
      {high > 0 && (
        <span
          className="mono text-xs px-2 py-0.5 rounded"
          style={{
            background: 'rgba(255,136,0,0.15)',
            border:     '1px solid #ff8800',
            color:      '#ff8800',
          }}
        >
          {high} HIGH
        </span>
      )}
    </div>
  ) : (
    <span
      className="mono text-xs px-2 py-0.5 rounded"
      style={{
        background: 'rgba(0,255,136,0.1)',
        border:     '1px solid var(--green-safe)',
        color:      'var(--green-safe)',
      }}
    >
      CLEAR
    </span>
  )

  return (
    <div
      className="panel flex flex-col gap-3 p-3"
      style={{ minHeight: 0 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Connection dot */}
          <div
            className={connected ? 'animate-pulse-teal' : 'animate-pulse-red'}
            style={{
              width:        8,
              height:       8,
              borderRadius: '50%',
              background:   connected
                ? 'var(--teal-glow)'
                : 'var(--red-critical)',
            }}
          />
          <span
            className="mono text-xs font-semibold tracking-widest"
            style={{ color: 'var(--text-secondary)' }}
          >
            {connected ? 'LIVE FEED' : 'DISCONNECTED'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="mono text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            {fps} FPS
          </span>
          <span
            className="mono text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            {frame?.frame_id ? `#${frame.frame_id}` : '—'}
          </span>
        </div>
      </div>

      {/* Frames row */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* Raw frame */}
        <FrameView
          title="RAW · DEGRADED"
          src={rawSrc}
          badge={
            <span
              className="mono text-xs"
              style={{ color: 'var(--text-dim)' }}
            >
              UIQM {frame?.enhancement?.uiqm_before?.uiqm?.toFixed(3) ?? '—'}
            </span>
          }
        />

        {/* Enhanced frame + bounding boxes */}
        <FrameView
          title="ENHANCED · AI PROCESSED"
          src={enhSrc}
          badge={threatBadge}
        >
          {/* Canvas overlay for bounding boxes */}
          <canvas
            ref={canvasRef}
            style={{
              position:      'absolute',
              top:           0,
              left:          0,
              width:         '100%',
              height:        '100%',
              pointerEvents: 'none',
            }}
          />
        </FrameView>

      </div>

      {/* UIQM gain bar */}
      {frame?.enhancement && (
        <div className="flex items-center gap-3 px-1">
          <span
            className="mono text-xs"
            style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap' }}
          >
            UIQM GAIN
          </span>
          <div
            className="flex-1 rounded-full overflow-hidden"
            style={{ height: 4, background: 'var(--ocean-accent)' }}
          >
            <div
              style={{
                height:     '100%',
                width:      `${Math.min(100,
                  (frame.enhancement.gain ?? 0) * 300
                )}%`,
                background: 'linear-gradient(90deg, var(--teal-dim), var(--teal-glow))',
                transition: 'width 0.3s ease',
                borderRadius: '9999px',
              }}
            />
          </div>
          <span
            className="mono text-xs"
            style={{
              color: frame.enhancement.gain > 0
                ? 'var(--green-safe)'
                : 'var(--red-critical)',
              whiteSpace: 'nowrap',
            }}
          >
            {frame.enhancement.gain >= 0 ? '+' : ''}
            {(frame.enhancement.gain ?? 0).toFixed(3)}
          </span>
        </div>
      )}

    </div>
  )
}