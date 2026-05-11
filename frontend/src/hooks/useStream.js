import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = 'ws://localhost:8000/ws/stream'
const INITIAL_BACKOFF = 500
const MAX_BACKOFF     = 8000
const BACKOFF_FACTOR  = 1.8

export function useStream() {
  const [frame, setFrame]           = useState(null)
  const [connected, setConnected]   = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [fps, setFps]               = useState(0)
  const [error, setError]           = useState(null)

  const wsRef       = useRef(null)
  const backoffRef  = useRef(INITIAL_BACKOFF)
  const retryRef    = useRef(null)
  const fpsCountRef = useRef(0)
  const fpsTimerRef = useRef(null)
  const mountedRef  = useRef(true)

  const tickFps = useCallback(() => {
    fpsCountRef.current += 1
  }, [])

  useEffect(() => {
    fpsTimerRef.current = setInterval(() => {
      setFps(fpsCountRef.current)
      fpsCountRef.current = 0
    }, 1000)
    return () => clearInterval(fpsTimerRef.current)
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current) {
      wsRef.current.close()
    }

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setConnected(true)
      setError(null)
      backoffRef.current = INITIAL_BACKOFF
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'frame') {
          setFrame(data)
          setFrameCount(c => c + 1)
          tickFps()
        } else if (data.type === 'error') {
          setError(data.message)
        }
      } catch (e) {}
    }

    ws.onerror = () => {
      if (!mountedRef.current) return
      setError('WebSocket error — retrying...')
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setConnected(false)
      wsRef.current = null

      const delay = backoffRef.current
      backoffRef.current = Math.min(
        backoffRef.current * BACKOFF_FACTOR,
        MAX_BACKOFF,
      )
      retryRef.current = setTimeout(connect, delay)
    }
  }, [tickFps])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(retryRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [connect])

  return { frame, connected, frameCount, fps, error }
}