import { useStream }  from './hooks/useStream'
import { usePhysics } from './hooks/usePhysics'
import VideoPanel     from './components/VideoPanel'

export default function App() {
  const { frame, connected, fps, error } = useStream()
  const { physics, updatePhysics }       = usePhysics()

  return (
    <div
      style={{
        width:         '100vw',
        height:        '100vh',
        display:       'flex',
        flexDirection: 'column',
        padding:       '12px',
        gap:           '12px',
        background:    'var(--ocean-deep)',
      }}
    >
      <div
        className="mono"
        style={{
          color:         'var(--teal-glow)',
          fontSize:      11,
          letterSpacing: '0.2em',
        }}
      >
        SECURE VISION — AI UNDERWATER SURVEILLANCE
        {error && (
          <span style={{ color: 'var(--red-critical)', marginLeft: 16 }}>
            {error}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <VideoPanel
          frame={frame}
          fps={fps}
          connected={connected}
        />
      </div>
    </div>
  )
}