// InstallPrompt.jsx
import { useState, useEffect } from 'react'

export function InstallPrompt() {
  const [prompt, setPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('pwa_dismissed')) { setDismissed(true); return }
    const handler = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  const install = async () => {
    prompt.prompt()
    const result = await prompt.userChoice
    if (result.outcome === 'accepted') setPrompt(null)
  }

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa_dismissed', '1')
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 animate-fade-up" role="banner" aria-label="Install app prompt">
      <div className="card p-4 flex items-center gap-3 shadow-2xl border-amber/20 bg-ink">
        <div className="w-10 h-10 bg-amber/20 rounded-xl flex items-center justify-center flex-shrink-0 text-amber text-xl">
          📲
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-paper text-sm font-medium">Install ClearForm</p>
          <p className="text-white/40 text-xs">Works offline · No app store needed</p>
        </div>
        <div className="flex gap-2">
          <button onClick={dismiss} className="text-white/30 text-xs hover:text-white/60 p-1" aria-label="Dismiss install prompt">✕</button>
          <button onClick={install} className="btn-primary text-xs px-3 py-2">Install</button>
        </div>
      </div>
    </div>
  )
}
