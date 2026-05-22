// useTTS.js — Text-to-speech via Web Speech SpeechSynthesis API
import { useState, useCallback, useEffect, useRef } from 'react'

export function useTTS() {
  const [speaking, setSpeaking] = useState(false)
  const [supported] = useState(() => 'speechSynthesis' in window)
  const [autoRead, setAutoRead] = useState(() => {
    return localStorage.getItem('clearform_autoread') === 'true'
  })
  const utteranceRef = useRef(null)

  // Pick a clear, natural voice
  const getVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices()
    return (
      voices.find(v => v.lang.startsWith('en') && v.localService && v.name.includes('Google')) ||
      voices.find(v => v.lang.startsWith('en') && v.localService) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0]
    )
  }, [])

  const speak = useCallback((text) => {
    if (!supported || !text) return
    window.speechSynthesis.cancel()

    // Strip markdown for cleaner speech
    const clean = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\n+/g, '. ')

    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.voice = getVoice()
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [supported, getVoice])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const toggleAutoRead = useCallback(() => {
    setAutoRead(prev => {
      const next = !prev
      localStorage.setItem('clearform_autoread', String(next))
      return next
    })
  }, [])

  // Fix Chrome bug where speech stops after ~15s
  useEffect(() => {
    if (!supported) return
    const id = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 10000)
    return () => clearInterval(id)
  }, [supported])

  return { speak, stop, speaking, supported, autoRead, toggleAutoRead }
}
