import React, { useEffect, useRef, useState } from 'react'
import { Wifi, Radar, Gamepad2, Accessibility, X } from 'lucide-react'

type Props = {
  ip: string
  onIpChange: (v: string) => void
  onStartObserve: () => void
  onStartControl: () => void
}

const ipRegex = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/

export const ConnectScreen: React.FC<Props> = ({ ip, onIpChange, onStartObserve, onStartControl }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ok' | 'fail'>('idle')
  const [accessibilityOpen, setAccessibilityOpen] = useState(false)
  const [textScale, setTextScale] = useState<'normal' | 'large' | 'largest'>(() => {
    const saved = localStorage.getItem('obs:a11y:text-scale')
    if (saved === 'normal' || saved === 'large' || saved === 'largest') return saved
    return localStorage.getItem('obs:a11y:large-text') === 'true' ? 'large' : 'normal'
  })
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('obs:a11y:high-contrast') === 'true')
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem('obs:a11y:reduce-motion') === 'true')
  const [colorVision, setColorVision] = useState<'none' | 'red-green' | 'blue-yellow' | 'monochrome'>(() => {
    const saved = localStorage.getItem('obs:a11y:color-vision')
    return saved === 'red-green' || saved === 'blue-yellow' || saved === 'monochrome' ? saved : 'none'
  })
  const accessibilityTriggerRef = useRef<HTMLButtonElement>(null)
  const accessibilityPanelRef = useRef<HTMLElement>(null)
  const valid = ipRegex.test(ip)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.textScale = textScale
    root.classList.toggle('a11y-high-contrast', highContrast)
    root.classList.toggle('a11y-reduce-motion', reduceMotion)
    root.dataset.colorVision = colorVision
    localStorage.setItem('obs:a11y:text-scale', textScale)
    localStorage.setItem('obs:a11y:high-contrast', String(highContrast))
    localStorage.setItem('obs:a11y:reduce-motion', String(reduceMotion))
    localStorage.setItem('obs:a11y:color-vision', colorVision)
  }, [textScale, highContrast, reduceMotion, colorVision])

  useEffect(() => {
    if (!accessibilityOpen) return
    const panel = accessibilityPanelRef.current
    const getFocusable = () => panel?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')
    getFocusable()?.[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAccessibilityOpen(false)
        accessibilityTriggerRef.current?.focus()
        return
      }
      if (event.key !== 'Tab') return
      const items = getFocusable()
      if (!items?.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [accessibilityOpen])

  const connect = async () => {
    if (!valid) {
      setStatus('fail')
      return
    }
    setStatus('connecting')
    await new Promise((r) => setTimeout(r, 650))
    setStatus('ok')
  }

  return (
    <div className="relative min-h-full w-full overflow-x-hidden bg-[#05070a]">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_50%_0%,#101820_0%,#080b10_55%,#05070a_100%)]" />
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(105,231,176,0.12) 1px, transparent 0), linear-gradient(135deg, transparent 48%, rgba(105,231,176,0.08) 48.1%, transparent 48.25%), linear-gradient(45deg, transparent 72%, rgba(255,255,255,0.05) 72.1%, transparent 72.2%)', backgroundSize: '28px 28px, 100% 100%, 100% 100%' }} />
      <a href="#main-content" className="sr-only z-50 rounded bg-black px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Saltar para a ligação</a>
      <main id="main-content" tabIndex={-1} className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1600px] grid-cols-1 items-center gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(26rem,0.9fr)_minmax(0,1.1fr)] lg:gap-2 lg:px-10 xl:px-16">
        <section className="relative z-20 flex w-full flex-col justify-center py-4 lg:py-10">
        <header className="mb-7 flex flex-col items-start gap-4 text-left">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.35em] text-[color:var(--text-tertiary)] sm:text-xs" data-mono>
            <span className="text-[color:var(--accent)]">PLATO</span>
            <span className="h-px w-12 bg-[color:var(--accent)]/60" />
            <span>Autonomous Control &amp; Teleoperation</span>
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl md:text-6xl">Interface de Observação <span className="text-[color:var(--accent)]">&amp;</span> Controlo</h1>
          <p className="max-w-lg text-sm leading-relaxed text-[color:var(--text-secondary)] md:text-base">
            Liga-te ao veículo para telecomandar ou observar em tempo real.
          </p>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-[color:var(--text-tertiary)]" data-mono>
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] shadow-[0_0_14px_var(--accent)]" />
            <span>Sistema de teleoperação</span>
            <span className="h-px w-10 bg-white/15" />
            <span>Unidade 03</span>
          </div>
        </header>
        <div className="glass-panel w-full max-w-xl rounded-2xl p-6 md:p-8 text-left">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="connection-ip" className="text-xs uppercase tracking-[0.4em] text-[color:var(--text-tertiary)]" data-mono>
                Endereço IP
              </label>
              <input
                id="connection-ip"
                value={ip}
                onChange={(e) => {
                  onIpChange(e.target.value)
                  setStatus('idle')
                }}
                placeholder="192.168.1.42"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-lg tracking-[0.4em] text-center uppercase focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40"
                data-mono
              />
              {!valid && status !== 'idle' && <p className="text-xs text-[color:var(--danger)]">Formato de IP inválido</p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/30 px-4 py-3">
              <div className="flex items-center gap-3">
                <Wifi className="h-4 w-4 text-[color:var(--accent)]" />
                <div className="flex flex-col">
                  <span className="text-sm">Estado da ligação</span>
                  <span className="text-xs text-[color:var(--text-tertiary)]" data-mono role="status" aria-live="polite" aria-atomic="true">
                    {status === 'idle' && 'A aguardar'}
                    {status === 'connecting' && 'A ligar...'}
                    {status === 'ok' && 'Ligado • 24 ms • Rede local'}
                    {status === 'fail' && 'Falha na ligação'}
                  </span>
                </div>
              </div>
              <button
                onClick={connect}
                className="rounded-full px-5 py-2 text-sm font-medium transition hover:bg-white/5 disabled:opacity-40"
                disabled={status === 'connecting'}
                aria-busy={status === 'connecting'}
              >
                {status === 'ok' ? 'Reverificar' : 'Testar ligação'}
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <span id="connection-required" className="sr-only">Testa e verifica a ligação antes de abrir este modo.</span>
              <button
                onClick={() => { if (status === 'ok') onStartObserve() }}
                aria-disabled={status !== 'ok'}
                aria-describedby="connection-required"
                className="group flex items-center justify-between rounded-2xl border border-[color:var(--panel-border)] bg-gradient-to-br from-[color:var(--accent)]/18 to-transparent px-6 py-5 transition hover:shadow-[0_40px_80px_-60px_rgba(105,231,176,0.8)] aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent)]/20">
                    <Radar className="h-5 w-5 text-[color:var(--accent)]" />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-medium">Observar</p>
                    <p className="text-sm text-[color:var(--text-secondary)]">Visão em tempo real nos carros ativos</p>
                  </div>
                </div>
                <span className="text-xs uppercase tracking-[0.4em] text-[color:var(--text-tertiary)]" data-mono>
                  
                </span>
              </button>
              <button
                onClick={() => { if (status === 'ok') onStartControl() }}
                aria-disabled={status !== 'ok'}
                aria-describedby="connection-required"
                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-6 py-5 transition hover:border-[color:var(--accent)]/40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                    <Gamepad2 className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-medium">Telecomandar</p>
                    <p className="text-sm text-[color:var(--text-secondary)]">Controlo direto a distancia dos carros</p>
                  </div>
                </div>
                <span className="text-xs uppercase tracking-[0.4em] text-[color:var(--text-tertiary)]" data-mono>
                  
                </span>
              </button>
            </div>
            <div className="relative">
              <button
                type="button"
                ref={accessibilityTriggerRef}
                onClick={() => setAccessibilityOpen((open) => !open)}
                aria-expanded={accessibilityOpen}
                aria-controls="accessibility-menu"
                aria-haspopup="dialog"
                className="glass-chip flex items-center gap-2 rounded-full px-4 py-2 text-sm"
              >
                <Accessibility className="h-4 w-4 text-[color:var(--accent)]" />
                Acessibilidade
              </button>
              {accessibilityOpen && <>
                <div aria-hidden="true" onClick={() => { setAccessibilityOpen(false); accessibilityTriggerRef.current?.focus() }} className="fixed inset-0 z-40 bg-black/70" />
                <section ref={accessibilityPanelRef} id="accessibility-menu" role="dialog" aria-modal="true" aria-labelledby="accessibility-title" className="glass-panel fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-white/20 bg-[#080b10]/95 p-6 text-left shadow-2xl">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h2 id="accessibility-title" className="text-xl font-semibold">Acessibilidade</h2>
                      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Ajusta a leitura e as cores da interface.</p>
                    </div>
                    <button autoFocus onClick={() => { setAccessibilityOpen(false); accessibilityTriggerRef.current?.focus() }} aria-label="Fechar opções de acessibilidade" className="glass-chip rounded-full p-2"><X className="h-4 w-4" /></button>
                  </div>

                  <div className="space-y-4">
                    <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="a11y-text-size">
                      Tamanho do texto
                      <select id="a11y-text-size" value={textScale} onChange={(e) => setTextScale(e.target.value as typeof textScale)} className="rounded-xl border border-white/20 bg-black/70 px-3 py-2.5 text-[var(--text-primary)]">
                        <option value="normal">Normal</option>
                        <option value="large">Grande</option>
                        <option value="largest">Muito grande</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="a11y-color-vision">
                      Paleta para daltonismo
                      <select id="a11y-color-vision" value={colorVision} onChange={(e) => setColorVision(e.target.value as typeof colorVision)} className="rounded-xl border border-white/20 bg-black/70 px-3 py-2.5 text-[var(--text-primary)]">
                        <option value="none">Desligada</option>
                        <option value="red-green">Vermelho–verde (protanopia/deuteranopia)</option>
                        <option value="blue-yellow">Azul–amarelo (tritanopia)</option>
                        <option value="monochrome">Escala de cinzentos</option>
                      </select>
                    </label>
                    <p className="-mt-2 text-xs text-[color:var(--text-tertiary)]">Muda as cores de estado para combinações mais distinguíveis; os indicadores mantêm texto e símbolos.</p>

                    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm">
                      <span><strong className="block font-medium">Alto contraste</strong><span className="text-xs text-[color:var(--text-secondary)]">Texto e painéis mais destacados</span></span>
                      <input type="checkbox" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} className="h-5 w-5 accent-[color:var(--accent)]" />
                    </label>
                    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm">
                      <span><strong className="block font-medium">Reduzir animações</strong><span className="text-xs text-[color:var(--text-secondary)]">Menos movimento e transições</span></span>
                      <input type="checkbox" checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} className="h-5 w-5 accent-[color:var(--accent)]" />
                    </label>
                  </div>
                  <button onClick={() => { setTextScale('normal'); setColorVision('none'); setHighContrast(false); setReduceMotion(false) }} className="mt-5 text-sm text-[color:var(--accent)] underline underline-offset-4">Repor predefinições</button>
                </section>
              </>}
            </div>
          </div>
        </div>
        <p className="mt-8 text-xs text-[color:var(--text-tertiary)]" data-mono>
          Equipa PLATO: Versão Teste
        </p>
        </section>
        <aside className="relative order-first mx-auto flex h-[32vh] min-h-64 w-full max-w-2xl items-center justify-center md:h-[42vh] lg:order-last lg:h-[82vh] lg:max-h-[900px]" aria-label="Imagem decorativa do robô PLATO">
          <div className="absolute inset-[8%] rounded-full bg-[color:var(--accent)]/10 blur-3xl" />
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-70" viewBox="0 0 720 720" fill="none" aria-hidden="true">
            <path d="M74 150V74h76M570 74h76v76M74 570v76h76M570 646h76v-76" stroke="var(--accent)" strokeOpacity=".42" strokeWidth="1" />
            <path d="M22 360h105M593 360h105M360 22v80M360 618v80" stroke="white" strokeOpacity=".15" strokeWidth="1" />
            <circle cx="360" cy="360" r="285" stroke="var(--accent)" strokeOpacity=".16" strokeDasharray="2 12" />
            <circle cx="360" cy="360" r="325" stroke="white" strokeOpacity=".08" />
            <path d="M122 232h70m-70 12h38M530 476h70m-70 12h38M190 570h95m-95 8h54" stroke="var(--accent)" strokeOpacity=".45" />
          </svg>
          <img src="/images/plato-robot.webp" alt="" aria-hidden="true" width="1800" height="1386" fetchPriority="high" className="relative z-10 h-full w-full object-contain drop-shadow-[0_35px_90px_rgba(0,0,0,0.65)] [mask-image:linear-gradient(to_bottom,transparent_0%,black_8%,black_88%,transparent_100%)]" />
          <div className="absolute bottom-[7%] left-[5%] hidden items-center gap-3 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-[9px] uppercase tracking-[0.28em] text-white/55 backdrop-blur-md lg:flex" data-mono>
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
            <span>Autonomous platform</span>
            <span className="h-px w-8 bg-[color:var(--accent)]/50" />
            <span>PLATO / 03</span>
          </div>
        </aside>
      </main>
    </div>
  )
}
