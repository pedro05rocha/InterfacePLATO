import React, { useEffect, useMemo, useState } from 'react'
import { ObserveScreen } from './screens/ObserveScreen'
import { ControlScreen } from './screens/ControlScreen'
import { ConnectScreen } from './screens/ConnectScreen'
import { Toaster } from 'sonner'

type Screen = 'connect' | 'observe' | 'control'

function useHashRoute() {
  const [screen, setScreen] = useState<Screen>(() => {
    const h = window.location.hash.replace('#/', '')
    if (h === 'observar' || h === 'observe') return 'observe'
    if (h === 'controlar' || h === 'control') return 'control'
    return 'connect'
  })
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#/', '')
      if (h === 'observar' || h === 'observe') setScreen('observe')
      else if (h === 'controlar' || h === 'control') setScreen('control')
      else setScreen('connect')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (s: Screen) => {
    if (s === 'observe') window.location.hash = '#/observar'
    else if (s === 'control') window.location.hash = '#/controlar'
    else window.location.hash = '#/ligar'
    setScreen(s)
  }
  return { screen, go }
}

const App: React.FC = () => {
  const { screen, go } = useHashRoute()
  const [ip, setIp] = useState(() => localStorage.getItem('obs:ip') || '192.168.1.42')
  const [car, setCar] = useState<1 | 2>(() => Number(localStorage.getItem('obs:car')) === 2 ? 2 : 1)

  useEffect(() => {
    localStorage.setItem('obs:ip', ip)
  }, [ip])
  useEffect(() => {
    localStorage.setItem('obs:car', String(car))
  }, [car])

  if (screen === 'connect') {
    return <ConnectScreen ip={ip} onIpChange={setIp} onStartObserve={() => go('observe')} onStartControl={() => go('control')} />
  }
  if (screen === 'observe') {
    return <ObserveScreen ip={ip} car={car} onCarChange={setCar} onBack={() => go('connect')} />
  }
  if (screen === 'control') {
    return <ControlScreen ip={ip} onBack={() => go('connect')} />
  }
  return <ConnectScreen ip={ip} onIpChange={setIp} onStartObserve={() => go('observe')} onStartControl={() => go('control')} />
}

export default App
