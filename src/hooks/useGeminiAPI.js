// useGeminiAPI.js
// Calls our /api/gemma Vercel serverless proxy — key never touches the browser.
// Supports: streaming, thinking mode, image/PDF input, JSON mode.

import { useState, useCallback, useRef } from 'react'

const MODELS = {
  default: 'gemma-4-26b-a4b-it',   // MoE — best efficiency
  heavy: 'gemma-4-31b-it'           // Dense — use for T&C comparison
}

function buildContents(prompt, history = [], imageBase64 = null, mimeType = null) {
  const contents = []
  for (const msg of history) {
    contents.push({ role: msg.role, parts: [{ text: msg.content }] })
  }
  const parts = []
  if (imageBase64 && mimeType) {
    parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } })
  }
  parts.push({ text: prompt })
  contents.push({ role: 'user', parts })
  return contents
}

function cleanText(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\*\s+User says:[\s\S]*?\n\n/gi, '')
    .replace(/\*\s+Context:[\s\S]*?\n/gi, '')
    .replace(/\*\s+Persona:[\s\S]*?\n/gi, '')
    .replace(/\*\s+Acknowledge[\s\S]*?\n/gi, '')
    .replace(/\*\s+Introduce[\s\S]*?\n/gi, '')
    .replace(/\*\s+Explain what[\s\S]*?\n/gi, '')
    .replace(/\*\s+Invite[\s\S]*?\n/gi, '')
    .trim()
}

function extractText(data) {
  if (!data?.candidates?.[0]) throw new Error('No response from model')
  const raw = data.candidates[0].content.parts
    .filter(p => p.text && !p.thought)
    .map(p => p.text)
    .join('')
  return cleanText(raw)
}

function parseJSON(text) {
  const clean = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '').trim()
  try { return JSON.parse(clean) } catch { return null }
}

export function useGeminiAPI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [streamText, setStreamText] = useState('')
  const abortRef = useRef(null)

  const call = useCallback(async ({
    systemPrompt,
    userPrompt,
    history = [],
    imageBase64 = null,
    mimeType = null,
    useThinking = false,
    temperature = 0.2,
    maxTokens = 2048,
    heavy = false
  }) => {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        model: heavy ? MODELS.heavy : MODELS.default,
        system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents: buildContents(userPrompt, history, imageBase64, mimeType),
        generationConfig: {
          temperature: useThinking ? 1.0 : temperature,
          maxOutputTokens: maxTokens,
          ...(useThinking && { thinkingConfig: { thinkingBudget: 1024 } })
        }
      }
      const res = await fetch('/api/gemma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `API error ${res.status}`)
      }
      const data = await res.json()
      const text = extractText(data)
      return { text, raw: data }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const stream = useCallback(async ({
    systemPrompt,
    userPrompt,
    history = [],
    temperature = 0.3,
    maxTokens = 1024,
    onChunk = null
  }) => {
    setLoading(true)
    setError(null)
    setStreamText('')
    abortRef.current = new AbortController()
    try {
      const payload = {
        model: MODELS.default,
        stream: true,
        system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents: buildContents(userPrompt, history),
        generationConfig: { temperature, maxOutputTokens: maxTokens }
      }
      const res = await fetch('/api/gemma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal
      })
      if (!res.ok) throw new Error(`Stream error ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (jsonStr === '[DONE]') continue
          try {
            const parsed = JSON.parse(jsonStr)
            const part = parsed.candidates?.[0]?.content?.parts?.[0]
            if (!part || part.thought) continue
            const delta = part.text || ''
            if (delta) {
              fullText += delta
              const cleaned = cleanText(fullText)
              setStreamText(cleaned)
              onChunk?.(delta, cleaned)
            }
          } catch { /* skip malformed chunks */ }
        }
      }
      return cleanText(fullText)
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message)
        throw err
      }
      return streamText
    } finally {
      setLoading(false)
    }
  }, [streamText])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const callJSON = useCallback(async (options) => {
    const { text } = await call({ ...options, temperature: 0.1 })
    const parsed = parseJSON(text)
    if (!parsed) throw new Error('Model returned invalid JSON. Please try again.')
    return parsed
  }, [call])

  return { call, stream, callJSON, abort, loading, error, streamText }
    }
