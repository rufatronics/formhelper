// InstallPrompt.jsx
// Android Chrome: catches beforeinstallprompt and shows native install button
// iOS Safari: shows manual "Add to Home Screen" instructions
// Shows a persistent button in the nav area so it's always accessible

import { useState, useEffect } from 'react'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIOSGuide, setShowIOSGuide]     = useState(false)
  const [installed, setInstalled]           = useState(false)
  const [dismissed, setDismissed]           = useState(
    () => !!localStorage.getItem('pwa_dismissed')
  )

  useEffect(() => {
    // Already running as installed PWA
    if (isInStandaloneMode()) { setInstalled(true); return }

    // Android Chrome — catch the install prompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      setDeferredPrompt(null)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (isIOS()) {
      setShowIOSGuide(true)
      return
    }
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
  }

  const dismiss = () => {
    setDismissed(true)
    setShowIOSGuide(false)
    localStorage.setItem('pwa_dismissed', '1')
  }

  // Don't show if already installed
  if (installed) return null

  // Determine if we have anything to show
  const canShowAndroid = !!deferredPrompt
  const canShowIOS     = isIOS()
  const hasAnything    = canShowAndroid || canShowIOS

  if (!hasAnything || dismissed) return null

  return (
    <>
      {/* Install banner */}
      <div className="fixed bottom-24 left-4 right-4 z-50 animate-fade-up">
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
              className="text-white/30 hover:text-white/60 transition-colors p-1 text-lg leading-none"
              aria-label="Dismiss"
            >✕</button>
            <button onClick={handleInstall} className="btn-primary text-xs px-4 py-2">
              {isIOS() ? 'How?' : 'Install'}
            </button>
          </div>
        </div>
      </div>

      {/* iOS instructions modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={dismiss}>
          <div className="card p-6 w-full max-w-sm space-y-4 animate-fade-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg">Add to Home Screen</h3>
            <ol className="space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-amber/20 rounded-full flex items-center justify-center text-amber text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                <span>Tap the <strong className="text-paper">Share button</strong> at the bottom of Safari (the box with an arrow pointing up)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-amber/20 rounded-full flex items-center justify-center text-amber text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                <span>Scroll down and tap <strong className="text-paper">"Add to Home Screen"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-amber/20 rounded-full flex items-center justify-center text-amber text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                <span>Tap <strong className="text-paper">"Add"</strong> in the top right corner</span>
              </li>
            </ol>
            <button onClick={dismiss} className="btn-primary w-full">Got it</button>
          </div>
        </div>
      )}
    </>
  )
            }
    
