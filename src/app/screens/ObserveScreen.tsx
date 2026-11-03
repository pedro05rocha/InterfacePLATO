import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Maximize2, Minimize2, Wifi, BatteryMedium, Activity, Radio, Crosshair, Users, Loader2 } from 'lucide-react'

type Props = {
  ip: string
  car: 1 | 2
  onCarChange: (v: 1 | 2) => void
  onBack: () => void
  presentation?: 'observe' | 'control'
}

type DriveMode = 'frente' | 'tras' | 'normal'

const getSources = (carNum: 1 | 2, driveMode?: DriveMode) => {
  const base = driveMode ? `/videos/control/${driveMode}` : `/videos/car${carNum}`
  return {
    front: `${base}/frente.mp4`,
    speed: `${base}/velocidade.mp4`,
    map: `${base}/mapa.mp4`,
    rear: `${base}/traseira.mp4`,
  }
}

export const ObserveScreen: React.FC<Props> = ({ ip, car, onCarChange, onBack, presentation = 'observe' }) => {
  const stageRef = useRef<HTMLDivElement>(null)

  const frontRef1 = useRef<HTMLVideoElement>(null)
  const speedRef1 = useRef<HTMLVideoElement>(null)
  const mapRef1 = useRef<HTMLVideoElement>(null)
  const rearRef1 = useRef<HTMLVideoElement>(null)

  const frontRef2 = useRef<HTMLVideoElement>(null)
  const speedRef2 = useRef<HTMLVideoElement>(null)
  const mapRef2 = useRef<HTMLVideoElement>(null)
  const rearRef2 = useRef<HTMLVideoElement>(null)

  const rafRef = useRef<number | null>(null)
  const timelineRef = useRef(0)

  const [fullscreen, setFullscreen] = useState(false)
  const [time, setTime] = useState(new Date())
  const [ready, setReady] = useState(false)
  const [loadedCount, setLoadedCount] = useState(0)
  const [driveMode, setDriveMode] = useState<DriveMode | null>(null)

  const [accel, setAccel] = useState(2.0)
  const [heading, setHeading] = useState(142)
  const [latency] = useState(24)
  const [battery] = useState(78)
  const [voltage] = useState(24.2)
  const [vectorVel] = useState(64.8)
  const accessibilityEnabled = typeof document !== 'undefined' && (
    (document.documentElement.dataset.textScale ?? 'normal') !== 'normal' ||
    document.documentElement.classList.contains('a11y-high-contrast') ||
    document.documentElement.classList.contains('a11y-reduce-motion') ||
    (document.documentElement.dataset.colorVision ?? 'none') !== 'none'
  )

  const sensors = [
    { name: 'Câmara', ok: true },
    { name: 'LiDAR', ok: true },
    { name: 'Radar', ok: true },
    { name: 'IMU', ok: true },
    { name: 'GPS', ok: true },
  ]

  const src1 = getSources(1, presentation === 'control' ? driveMode ?? 'frente' : undefined)
  const src2 = getSources(2)

  const selectDriveMode = useCallback((mode: DriveMode) => {
    timelineRef.current = 0
    setReady(false)
    setDriveMode(mode)
  }, [])

  useEffect(() => {
    if (presentation !== 'control') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        selectDriveMode('normal')
      } else if (event.key.toLowerCase() === 'w') selectDriveMode('frente')
      else if (event.key.toLowerCase() === 's') selectDriveMode('tras')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [presentation, selectDriveMode])



  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setAccel((a) => Math.max(-2.5, Math.min(3.5, a + (Math.random() - 0.5) * 0.35)))
      setHeading((h) => (h + (Math.random() - 0.5) * 3 + 360) % 360)
    }, 850)
    return () => clearInterval(t)
  }, [])


  useEffect(() => {
    if (presentation === 'control' && driveMode === null) {
      setReady(false)
      setLoadedCount(0)
      return
    }
    let count = 0
    setLoadedCount(0)
    setReady(false)
    const marked = new Set<HTMLVideoElement>()

    const markReady = (v: HTMLVideoElement) => {
      if (marked.has(v)) return
      marked.add(v)
      count += 1
      setLoadedCount(count)
      if (count >= 4) {
        setReady(true)
      }
    }

    const activeVideos = car === 1
      ? [frontRef1, speedRef1, mapRef1, rearRef1]
      : [frontRef2, speedRef2, mapRef2, rearRef2]
    const listeners: Array<{ video: HTMLVideoElement; onCanPlay: () => void; onLoaded: () => void }> = []

    activeVideos.forEach((ref) => {
      const v = ref.current
      if (!v) return
      v.muted = true
      v.playsInline = true
      v.preload = 'auto'
      
      const onCanPlay = () => markReady(v)
      const onLoaded = () => markReady(v)
      listeners.push({ video: v, onCanPlay, onLoaded })
      
      v.addEventListener('canplay', onCanPlay)
      v.addEventListener('loadeddata', onLoaded)
      
      if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) onLoaded()
    })

    const forceTimeout = setTimeout(() => {
      setReady(true)
    }, 2500)

    return () => {
      clearTimeout(forceTimeout)
      listeners.forEach(({ video, onCanPlay, onLoaded }) => {
        video.removeEventListener('canplay', onCanPlay)
        video.removeEventListener('loadeddata', onLoaded)
      })
    }
  }, [car, driveMode, presentation])

  useEffect(() => {
    if (presentation === 'control' && driveMode === null) return
    let cancelled = false
    const active = car === 1
      ? [frontRef1, speedRef1, mapRef1, rearRef1]
      : [frontRef2, speedRef2, mapRef2, rearRef2]
    const videos = active.map((ref) => ref.current).filter((v): v is HTMLVideoElement => !!v)
    const startProgress = Math.min(1, Math.max(0, timelineRef.current))

    const prepare = async () => {
      await Promise.all(videos.map((video) => new Promise<void>((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          resolve()
          return
        }
        video.addEventListener('loadedmetadata', () => resolve(), { once: true })
        video.load()
      })))
      if (cancelled) return

      const frontDuration = videos[0]?.duration
      videos.forEach((video) => {
        const duration = video.duration
        video.playbackRate = video === videos[0] || !Number.isFinite(frontDuration) || !frontDuration || !Number.isFinite(duration)
          ? 1
          : duration / frontDuration
      })
      await Promise.all(videos.map((video) => new Promise<void>((resolve) => {
        const duration = video.duration
        const target = Number.isFinite(duration) && duration > 0
          ? Math.min(startProgress * duration, Math.max(0, duration - 0.05))
          : 0
        if (Math.abs(video.currentTime - target) < 0.03) {
          resolve()
          return
        }
        video.addEventListener('seeked', () => resolve(), { once: true })
        try {
          video.currentTime = target
        } catch {
          resolve()
        }
      })))
      if (cancelled) return
      await Promise.all(videos.map((video) => video.play().catch(() => undefined)))
    }

    void prepare()
    return () => { cancelled = true }
  }, [car, driveMode, presentation])

  const syncLoop = useCallback(() => {
    const frontActive = car === 1 ? frontRef1.current : frontRef2.current
    if (!frontActive) {
      rafRef.current = requestAnimationFrame(syncLoop)
      return
    }

    const t = frontActive.currentTime
    if (isNaN(t)) {
      rafRef.current = requestAnimationFrame(syncLoop)
      return
    }
    const frontDuration = frontActive.duration
    const progress = Number.isFinite(frontDuration) && frontDuration > 0
      ? Math.min(1, t / frontDuration)
      : 0
    timelineRef.current = progress

    const targets = car === 1
      ? [speedRef1.current, mapRef1.current, rearRef1.current]
      : [speedRef2.current, mapRef2.current, rearRef2.current]

    for (let i = 0; i < targets.length; i++) {
      const v = targets[i]
      if (!v) continue
      try {
        if (Number.isFinite(v.duration) && v.duration > 0 && Number.isFinite(frontDuration) && frontDuration > 0) {
          v.playbackRate = v.duration / frontDuration
          const target = progress * v.duration
          if (Math.abs(v.currentTime - target) > 0.12) {
            v.currentTime = target
          }
        }
      } catch {}
    }

    rafRef.current = requestAnimationFrame(syncLoop)
  }, [car])

  useEffect(() => {
    if (!ready) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(syncLoop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [ready, car, syncLoop])

  const toggleFullscreen = async () => {
    const el = stageRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      await el.requestFullscreen()
      setFullscreen(true)
    } else {
      await document.exitFullscreen()
      setFullscreen(false)
    }
  }

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const videoLoading = presentation === 'observe' && !ready
  const videoActive = presentation === 'observe' || driveMode !== null

  return (
    <div className="relative h-full w-full overflow-hidden select-none bg-black" ref={stageRef}>
      {presentation === 'control' && <p className="sr-only" aria-live="polite" aria-atomic="true">
        {driveMode === null
          ? 'Telecomandar Carro 03. Atalhos: W para avançar, S para marcha-atrás e espaço para condução normal.'
          : `Modo ${driveMode === 'frente' ? 'frente' : driveMode === 'tras' ? 'marcha-atrás' : 'normal'} selecionado. Os quatro vídeos estão sincronizados.`}
      </p>}
      {presentation === 'control' && driveMode === null && <>
        <img className="absolute inset-0 h-full w-full object-cover" src="/videos/control/frente/frente-frame-1.jpg" alt="Primeiro frame da câmara frontal" />
        <div className="pointer-events-none absolute left-[2%] top-[6%] h-[20%] w-[9%] overflow-hidden" style={fullscreen ? { top: '5%', height: '16%' } : undefined}>
          <img className="absolute max-w-none" style={{ width: '662%', height: '374%', left: '-428%', top: '-232%', objectFit: 'fill', mixBlendMode: 'screen' }} src="/videos/control/frente/velocidade-frame-1.jpg" alt="Primeiro frame do velocímetro" />
        </div>
        <div className="pointer-events-none absolute left-4 top-[49%] h-[20%] w-[9%] overflow-hidden md:left-6">
          <img className="absolute max-w-none" style={{ width: '777%', height: '414%', left: '-159%', top: '-264%', objectFit: 'fill', mixBlendMode: 'screen' }} src="/videos/control/frente/mapa-frame-1.jpg" alt="Primeiro frame do mapa" />
        </div>
        <div className="pointer-events-none absolute right-[4%] bottom-[2%] h-[20%] w-[18%] overflow-hidden">
          <img className="absolute max-w-none" style={{ width: '469%', height: '742%', left: '-158%', top: '-76%', objectFit: 'fill', mixBlendMode: 'screen' }} src="/videos/control/frente/traseira-frame-1.jpg" alt="Primeiro frame da câmara traseira" />
        </div>
      </>}
      {car === 1 && videoActive && <>
      <video ref={frontRef1} className={`absolute inset-0 h-full w-full object-cover ${car === 1 ? '' : 'pointer-events-none opacity-0'}`} src={src1.front} poster={presentation === 'control' && driveMode ? `/videos/control/${driveMode}/frente-frame-1.jpg` : undefined} muted playsInline loop={presentation === 'observe'} preload={car === 1 ? 'auto' : 'none'} />
      <div className="pointer-events-none absolute left-[2%] top-[6%] h-[20%] w-[9%] overflow-hidden" style={fullscreen ? { top: '5%', height: '16%' } : undefined}>
        <video ref={speedRef1} className="absolute max-w-none" style={{ width: '662%', height: '374%', left: '-428%', top: '-232%', objectFit: 'fill', mixBlendMode: 'screen' }} src={src1.speed} poster={presentation === 'control' && driveMode ? `/videos/control/${driveMode}/velocidade-frame-1.jpg` : undefined} muted playsInline loop={presentation === 'observe'} preload="auto" />
      </div>
      <div className="pointer-events-none absolute left-4 top-[49%] h-[20%] w-[9%] overflow-hidden md:left-6">
        <video ref={mapRef1} className="absolute max-w-none" style={{ width: '777%', height: '414%', left: '-159%', top: '-264%', objectFit: 'fill', mixBlendMode: 'screen' }} src={src1.map} poster={presentation === 'control' && driveMode ? `/videos/control/${driveMode}/mapa-frame-1.jpg` : undefined} muted playsInline loop={presentation === 'observe'} preload="auto" />
      </div>
      <div className="pointer-events-none absolute right-[4%] bottom-[2%] h-[20%] w-[18%] overflow-hidden">
        <video ref={rearRef1} className="absolute max-w-none" style={{ width: '469%', height: '742%', left: '-158%', top: '-76%', objectFit: 'fill', mixBlendMode: 'screen' }} src={src1.rear} poster={presentation === 'control' && driveMode ? `/videos/control/${driveMode}/traseira-frame-1.jpg` : undefined} muted playsInline loop={presentation === 'observe'} preload="auto" />
      </div>
      </>}
      {car === 2 && videoActive && <>
      <video ref={frontRef2} className={`absolute inset-0 h-full w-full object-cover ${car === 2 ? '' : 'pointer-events-none opacity-0'}`} src={src2.front} muted playsInline loop preload={car === 2 ? 'auto' : 'none'} />
      <div className="pointer-events-none absolute left-[2%] top-[6%] h-[20%] w-[9%] overflow-hidden" style={fullscreen ? { top: '5%', height: '16%' } : undefined}>
        <video ref={speedRef2} className="absolute max-w-none" style={{ width: '662%', height: '374%', left: '-428%', top: '-232%', objectFit: 'fill', mixBlendMode: 'screen' }} src={src2.speed} muted playsInline loop preload="auto" />
      </div>
      <div className="pointer-events-none absolute left-4 top-[49%] h-[20%] w-[9%] overflow-hidden md:left-6">
        <video ref={mapRef2} className="absolute max-w-none" style={{ width: '777%', height: '414%', left: '-159%', top: '-264%', objectFit: 'fill', mixBlendMode: 'screen' }} src={src2.map} muted playsInline loop preload="auto" />
      </div>
      <div className="pointer-events-none absolute right-[4%] bottom-[2%] h-[20%] w-[18%] overflow-hidden">
        <video ref={rearRef2} className="absolute max-w-none" style={{ width: '469%', height: '742%', left: '-158%', top: '-76%', objectFit: 'fill', mixBlendMode: 'screen' }} src={src2.rear} muted playsInline loop preload="auto" />
      </div>
      </>}

      {videoLoading && <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <Loader2 className="h-8 w-8 animate-spin text-[color:var(--accent)]" />
          <p className="text-lg font-medium">A carregar vídeos do veículo {car}…</p>
          <p className="text-sm text-[color:var(--text-secondary)]" data-mono>{loadedCount}/4 prontos</p>
          <button onClick={() => setReady(true)} className="rounded-full border border-white/10 px-4 py-1.5 text-sm hover:bg-white/5 transition">Iniciar mesmo assim</button>
        </div>
      </div>}

      <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/30 pointer-events-none" />

      <div className="relative z-10 flex h-full flex-col pointer-events-none">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3 pointer-events-auto">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="glass-chip flex items-center gap-2 rounded-full px-3 py-1.5 text-sm">
              <ArrowLeft className="h-4 w-4" />
              Ligação
            </button>
            <div className="glass-chip flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.5em]" data-mono>
              <span>{presentation === 'control' ? 'TELECOMANDAR' : 'OBSERVAÇÃO'}</span>
              <span className="h-px w-5 bg-[color:var(--accent)]/50" />
              <span>{presentation === 'control' ? 'CARRO 03' : `ROBOT 0${car}`}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="glass-chip flex items-center gap-2 rounded-full px-3 py-1.5 text-xs" data-mono>
              <Wifi className="h-3.5 w-3.5 text-[color:var(--accent)]" />
              <span>{ip}</span>
              <span className="text-[color:var(--text-tertiary)]">• {latency} ms</span>
            </div>
            {presentation === 'observe' && <>
              <button onClick={() => onCarChange(car === 1 ? 2 : 1)} className="glass-chip rounded-full px-3 py-1.5 text-sm">
                Alternar veículo
              </button>
            </>}
            <button onClick={toggleFullscreen} aria-label={fullscreen ? 'Sair do ecrã inteiro' : 'Ativar ecrã inteiro'} className="glass-chip rounded-full px-3 py-1.5 text-sm">
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="relative flex-1">
          <div className="absolute left-4 md:left-6 top-44 flex flex-col gap-2" style={fullscreen && !accessibilityEnabled ? { top: '13rem' } : undefined}>
            <div className="glass-panel flex flex-col items-center gap-2 rounded-2xl px-6 py-4 text-shadow-strong">
              <p className="text-[9px] uppercase tracking-[0.5em] text-[color:var(--text-tertiary)]" data-mono>
                ROTAÇÃO
              </p>
              <svg width="110" height="110" viewBox="0 0 110 110">
                <circle cx="55" cy="55" r="46" stroke="rgba(255,255,255,0.12)" strokeWidth="6" fill="none" />
                <circle cx="55" cy="55" r="46" stroke="var(--accent)" strokeWidth="6" fill="none" strokeDasharray="190" strokeDashoffset="70" strokeLinecap="round" />
                <line x1="55" y1="55" x2="55" y2="18" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" transform={`rotate(${heading} 55 55)`} />
                <circle cx="55" cy="55" r="4" fill="var(--accent)" />
              </svg>
              <div className="flex items-center gap-3 text-xs" data-mono>
                <span>HDG {Math.round(heading)}°</span>
                <span className="text-[color:var(--text-tertiary)]">YAW</span>
              </div>
            </div>
          </div>

          <div className="absolute right-4 md:right-6 top-2 flex flex-col items-end gap-2">
            <div className="glass-panel flex items-center gap-4 rounded-2xl px-5 py-2.5 text-right text-shadow-strong">
              <div>
                <p className="text-[9px] uppercase tracking-[0.5em] text-[color:var(--text-tertiary)]" data-mono>
                  BATERIA
                </p>
                <p className="mt-1 text-lg" data-mono>
                  {battery} <span className="text-sm text-[color:var(--text-secondary)]">%</span>
                </p>
                <p className="text-xs text-[color:var(--text-tertiary)]" data-mono>
                  {voltage.toFixed(1)} V
                </p>
              </div>
              <BatteryMedium className="h-5 w-5 text-[color:var(--accent)]" />
            </div>
            <div className="glass-panel flex items-center gap-3 rounded-2xl px-5 py-2.5 text-right text-shadow-strong">
              <div>
                <p className="text-[9px] uppercase tracking-[0.5em] text-[color:var(--text-tertiary)]" data-mono>
                  LATÊNCIA
                </p>
                <p className="mt-1 text-lg" data-mono>
                  {latency} <span className="text-sm text-[color:var(--text-secondary)]">ms</span>
                </p>
              </div>
              <Radio className="h-4 w-4 text-[color:var(--accent)]" />
            </div>
            <div className="glass-panel rounded-2xl px-5 py-3 text-right text-shadow-strong">
              <p className="text-[9px] uppercase tracking-[0.5em] text-[color:var(--text-tertiary)]" data-mono>
                ESTADO DOS SENSORES
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {sensors.map((s) => (
                  <div key={s.name} className="flex items-center justify-end gap-2 text-sm">
                    <span className={s.ok ? 'text-[color:var(--text-secondary)]' : 'text-[color:var(--danger)]'}>{s.name}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.ok ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--danger)]'}`} style={s.ok ? { boxShadow: '0 0 0 6px color-mix(in srgb, var(--accent) 12%, transparent)' } : undefined} />
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-panel rounded-2xl px-5 py-2.5 text-right text-shadow-strong">
              <p className="text-[9px] uppercase tracking-[0.5em] text-[color:var(--text-tertiary)]" data-mono>
                VELOCIDADE VETORIAL
              </p>
              <p className="mt-1 text-lg" data-mono>
                {vectorVel.toFixed(1)} <span className="text-sm text-[color:var(--text-secondary)]">km/h</span>
              </p>
            </div>
            <div className="glass-panel rounded-2xl px-5 py-2.5 text-right text-shadow-strong">
              <div className="flex items-center justify-end gap-2">
                <Users className="h-4 w-4 text-[color:var(--accent)]" />
                <p className="text-[9px] uppercase tracking-[0.5em] text-[color:var(--text-tertiary)]" data-mono>
                  ESTADO DO PELOTÃO
                </p>
              </div>
              <p className="mt-1 text-sm">LÍDER • Membro 02</p>
              <p className="text-xs text-[color:var(--text-tertiary)]">Dist. ao anterior: 4.8 m</p>
            </div>
            <div className="glass-panel flex items-center gap-4 rounded-2xl px-5 py-2.5 text-shadow-strong">
              <div>
                <p className="text-[9px] uppercase tracking-[0.5em] text-[color:var(--text-tertiary)]" data-mono>
                  ACELERAÇÃO
                </p>
                <p className="mt-1 text-lg" data-mono>
                  {accel >= 0 ? '+' : ''}
                  {accel.toFixed(1)} <span className="text-sm text-[color:var(--text-secondary)]">m/s²</span>
                </p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[color:var(--accent)]" />
                <div className="h-6 w-16 rounded-full bg-gradient-to-r from-[color:var(--accent)]/40 via-white/10 to-transparent" />
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <div className="glass-panel rounded-full px-6 py-2 text-shadow-strong" data-mono>
              {time.toLocaleDateString('pt-PT')} • {time.toLocaleTimeString('pt-PT')}
            </div>
          </div>

          <div className="absolute bottom-4 left-4 md:left-6 flex flex-wrap items-center gap-2">
            <div className="glass-chip flex items-center gap-2 rounded-full px-3 py-1.5 text-xs" data-mono>
              <Crosshair className="h-3.5 w-3.5 text-[color:var(--accent)]" />
              <span>GPS: FIX 3D • HDOP 0.8</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}


