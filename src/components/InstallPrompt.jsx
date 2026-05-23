// InstallPrompt.jsx
import { useState, useEffect } from 'react'

export function InstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(
    () => !!localStorage.getItem('pwa_dismissed')
  )

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }
    const handler = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
      setPrompt(null)
    }
  }

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa_dismissed', '1')
  }

  // Don't show if already installed, dismissed, or no prompt available
  if (installed || dismissed || !prompt) return null

  return (
    <div
      className="fixed bottom-24 left-4 right-4 z-50 animate-fade-up"
      role="complementary"
      aria-label="Install app"
    >
      <div className="card p-4 flex items-center gap-3 shadow-2xl border-amber/20 bg-ink">
        <div className="w-10 h-10 bg-amber/20 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
          📲
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-paper text-sm font-semibold">Add to Home Screen</p>
          <p className="text-white/40 text-xs">Works offline · No app store needed</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-white/30 hover:text-white/60 transition-colors p-1 text-lg leading-none"
          >
            ✕
          </button>
          <button
            onClick={install}
            className="btn-primary text-xs px-4 py-2"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
  }
