    / useGeminiAPI.js
// Server always returns SSE stream now — we parse it on the client.
// Includes: auto-retry on network errors, reduced token limits, timeout handling.

import { useState, useCallback, useRef } from 'react'

const MODELS = {
  default: 'gemma-4-26b-a4b-it',
  heavy: 'gemma-4-26b-a4b-it'  // use same MoE model for everything — faster, avoids 504
}

const DEFAULT_TOKENS = 512   // keep low for speed — enough for conversational replies
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1500

function buildContents(prompt, history = [], imageBase64 = null, mimeType = null) {
  const contents = []
  for (const msg of history.slice(-6)) { // only last 6 messages — reduces payload size
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

function parseJSON(text) {
  const clean = text.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '').trim()
  try { return JSON.parse(clean) } catch { return null }
}

// Read a SSE stream from /api/gemma and collect the full text
async function readStream(response, onChunk = null) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // keep incomplete last line in buffer

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6).trim()
      if (!jsonStr || jsonStr === '[DONE]') continue

      try {
        const parsed = JSON.parse(jsonStr)
        const part = parsed.candidates?.[0]?.content?.parts?.[0]
        if (!part || part.thought) continue
        const delta = part.text || ''
        if (delta) {
          fullText += delta
          const cleaned = cleanText(fullText)
          onChunk?.(delta, cleaned)
        }
      } catch { /* skip malformed chunk */ }
    }
  }

  return cleanText(fullText)
}

// Fetch with retry on network errors
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 50000) // 50s client timeout

      const res = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeoutId)

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
          continue
        }
      }
      return res
    } catch (err) {
      if (attempt < retries && err.name !== 'AbortError') {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
        continue
      }
      throw err
    }
  }
}

export function useGeminiAPI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [streamText, setStreamText] = useState('')
  const abortRef = useRef(null)

  // Standard call — streams internally but resolves with full text
  const call = useCallback(async ({
    systemPrompt,
    userPrompt,
    history = [],
    imageBase64 = null,
    mimeType = null,
    useThinking = false,
    temperature = 0.2,
    maxTokens = DEFAULT_TOKENS,
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
          // Reduced thinking budget — 512 is enough, avoids long waits
          ...(useThinking && { thinkingConfig: { thinkingBudget: 512 } })
        }
      }

      const res = await fetchWithRetry('/api/gemma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `API error ${res.status}`)
      }

      const text = await readStream(res)
      if (!text) throw new Error('Empty response from model. Please try again.')
      return { text }
    } catch (err) {
      const msg = err.name === 'AbortError'
        ? 'Request timed out. Check your connection and try again.'
        : err.message
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  // Streaming call — updates streamText live
  const stream = useCallback(async ({
    systemPrompt,
    userPrompt,
    history = [],
    temperature = 0.3,
    maxTokens = DEFAULT_TOKENS,
    onChunk = null
  }) => {
    setLoading(true)
    setError(null)
    setStreamText('')
    abortRef.current = new AbortController()

    try {
      const payload = {
        model: MODELS.default,
        system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents: buildContents(userPrompt, history),
        generationConfig: { temperature, maxOutputTokens: maxTokens }
      }

      const res = await fetchWithRetry('/api/gemma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error(`Stream error ${res.status}`)

      const fullText = await readStream(res, (delta, cleaned) => {
        setStreamText(cleaned)
        onChunk?.(delta, cleaned)
      })

      return fullText
    } catch (err) {
      if (err.name !== 'AbortError') {
        const msg = err.name === 'AbortError'
          ? 'Request timed out. Check your connection and try again.'
          : err.message
        setError(msg)
        throw new Error(msg)
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
    // Give JSON calls more tokens since they need structured output
    const { text } = await call({ ...options, temperature: 0.1, maxTokens: 1024 })
    const parsed = parseJSON(text)
    if (!parsed) throw new Error('Could not read the document. Please try again.')
    return parsed
  }, [call])

  return { call, stream, callJSON, abort, loading, error, streamText }
}
