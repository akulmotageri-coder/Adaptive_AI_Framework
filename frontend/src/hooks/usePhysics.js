import { useState, useCallback, useRef } from 'react'

const API = ''
const DEBOUNCE_MS = 120

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

const DEFAULT_STATE = {
  depth_m:          10.0,
  turbidity:        0.50,
  water_type:       'bay_of_bengal',
  ambient_light:    0.80,
  salinity_ppt:     35.0,
  temperature_c:    28.0,
  current_speed_ms: 0.20,
  lat:              13.08,
  lon:              80.27,
}

export function usePhysics() {
  const [physics, setPhysics]     = useState(DEFAULT_STATE)
  const [location, setLocation]   = useState(null)
  const [gpsActive, setGpsActive] = useState(false)
  const [gpsError, setGpsError]   = useState(null)

  const syncPhysics = useRef(
    debounce(async (patch) => {
      try {
        await fetch(`${API}/api/physics`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(patch),
        })
      } catch (e) {}
    }, DEBOUNCE_MS)
  ).current

  const updatePhysics = useCallback((patch) => {
    setPhysics(prev => ({ ...prev, ...patch }))
    syncPhysics(patch)
  }, [syncPhysics])

  const updateLocation = useCallback(async (lat, lon, isSimulated = false) => {
    setPhysics(prev => ({ ...prev, lat, lon }))
    try {
      const res = await fetch(`${API}/api/location`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ lat, lon, is_simulated: isSimulated }),
      })
      const data = await res.json()
      if (data.context) {
        setLocation(data.context)
        setPhysics(prev => ({
          ...prev,
          water_type: data.context.water_type,
        }))
      }
    } catch (e) {}
  }, [])

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported by this browser')
      return
    }
    setGpsActive(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        updateLocation(latitude, longitude, false)
        setGpsActive(false)
      },
      (err) => {
        setGpsError(err.message)
        setGpsActive(false)
      },
      { timeout: 10000, maximumAge: 30000 }
    )
  }, [updateLocation])

  return {
    physics,
    location,
    gpsActive,
    gpsError,
    updatePhysics,
    updateLocation,
    requestGps,
  }
}