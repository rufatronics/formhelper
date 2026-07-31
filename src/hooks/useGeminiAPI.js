// useGeminiAPI.js
// Calls OpenRouter first (fast), falls back to Google Gemini API if it fails.
// Both called directly from the browser — no Vercel proxy needed.
// Keys are in Vite env vars: VITE_OPENROUTER_KEY and VITE_GEMINI_KEY
// Gracefully handles 429 rate limit issues by auto-switching channels.

import { useState, useCallback, useRef } from 'react'

const OR_KEY    = import.meta.env.VITE_OPENROUTER_KEY  || ''
const GEM_KEY   = import.meta.env.VITE_GEMINI_KEY      || ''

const OR_URL    = 'https://openrouter.ai/api/v1/chat/completions'
const GEM_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEM_MODEL = 'gemma-4-26b-a4b-it'
const OR_MODEL  = 'google/gemma-4-26b-a4b-it'

const DEFAULT_TOKENS = 512
const TIMEOUT_MS     = 20000   // 20s — if OR doesn't start in 20s, fall back

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

function buildContents(prompt, history = [], imageBase64 = null, mimeType = null) {
  const contents = []
  for (const msg of history.slice(-6)) {
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

function buildMessages(systemPrompt, userPrompt, history = [], imageBase64 = null, mimeType = null) {
  const messages = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  for (const msg of history.slice(-6)) {
    messages.push({ role: msg.role === 'model' ? 'assistant' : msg.role, content: msg.content })
  }
  if (imageBase64 && mimeType) {
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        { type: 'text', text: userPrompt }
      ]
    })
  } else {
    messages.push({ role: 'user', content: userPrompt })
  }
  return messages
}

async function readORStream(response, onChunk = null) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const str = line.slice(6).trim()
      if (!str || str === '[DONE]') continue
      try {
        const parsed = JSON.parse(str)
        const delta = parsed.choices?.[0]?.delta?.content || ''
        if (delta) {
          fullText += delta
          const cleaned = cleanText(fullText)
          onChunk?.(delta, cleaned)
        }
      } catch {}
    }
  }
  return cleanText(fullText)
}

async function readGemStream(response, onChunk = null) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const str = line.slice(6).trim()
      if (!str || str === '[DONE]') continue
      try {
        const parsed = JSON.parse(str)
        const part = parsed.candidates?.[0]?.content?.parts?.[0]
        if (!part || part.thought) continue
        const delta = part.text || ''
        if (delta) {
          fullText += delta
          const cleaned = cleanText(fullText)
          onChunk?.(delta, cleaned)
        }
      } catch {}
    }
  }
  return cleanText(fullText)
}

async function callOpenRouter({ systemPrompt, userPrompt, history, imageBase64, mimeType, temperature, maxTokens, onChunk }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  const res = await fetch(OR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OR_KEY}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Kariya'
    },
    body: JSON.stringify({
      model: OR_MODEL,
      messages: buildMessages(systemPrompt, userPrompt, history, imageBase64, mimeType),
      stream: true,
      max_tokens: maxTokens,
      temperature
    }),
    signal: controller.signal
  })

  clearTimeout(timer)
  if (res.status === 429) {
    throw new Error('RATE_LIMIT')
  }
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`)
  return readORStream(res, onChunk)
}

async function callGemini({ systemPrompt, userPrompt, history, imageBase64, mimeType, temperature, maxTokens, useThinking, onChunk }) {
  const endpoint = `${GEM_BASE}/${GEM_MODEL}:streamGenerateContent?alt=sse&key=${GEM_KEY}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 55000)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents: buildContents(userPrompt, history, imageBase64, mimeType),
      generationConfig: {
        temperature: useThinking ? 1.0 : temperature,
        maxOutputTokens: maxTokens,
        ...(useThinking && { thinkingConfig: { thinkingBudget: 512 } })
      }
    }),
    signal: controller.signal
  })

  clearTimeout(timer)
  if (res.status === 429) {
    throw new Error('RATE_LIMIT')
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  return readGemStream(res, onChunk)
}

async function callWithFallback(options, onChunk = null) {
  const { onProviderSwitch } = options

  // Try OpenRouter first if key exists
  if (OR_KEY) {
    try {
      const text = await callOpenRouter({ ...options, onChunk })
      if (text) return text
      throw new Error('Empty response')
    } catch (err) {
      if (err.message === 'RATE_LIMIT') {
        console.warn('OpenRouter is rate limited (429). Falling back immediately to direct Gemini endpoint...')
      } else {
        console.warn('OpenRouter failed, falling back to Gemini:', err.message)
      }
      onProviderSwitch?.('gemini')
    }
  }

  // Gemini fallback
  if (!GEM_KEY) throw new Error('No API keys configured. Please add VITE_OPENROUTER_KEY or VITE_GEMINI_KEY to your environment.')

  try {
    return await callGemini({ ...options, onChunk })
  } catch (err) {
    if (err.message === 'RATE_LIMIT') {
      throw new Error('SERVER_BUSY')
    }
    throw err
  }
}

export function useGeminiAPI() {
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [streamText, setStreamText] = useState('')
  const [provider, setProvider]     = useState('openrouter')

  const call = useCallback(async ({
    systemPrompt, userPrompt, history = [],
    imageBase64 = null, mimeType = null,
    useThinking = false, temperature = 0.2,
    maxTokens = DEFAULT_TOKENS, heavy = false
  }) => {
    setLoading(true)
    setError(null)
    try {
      const text = await callWithFallback({
        systemPrompt, userPrompt, history,
        imageBase64, mimeType, useThinking,
        temperature,
        maxTokens: heavy ? 1024 : maxTokens,
        onProviderSwitch: (p) => setProvider(p)
      })
      if (!text) throw new Error('Empty response. Please try again.')
      return { text }
    } catch (err) {
      let msg = err.message
      if (err.message === 'SERVER_BUSY') {
        msg = 'Wuraren sabis ɗinmu suna cike da aiki (Rate limit). Don Allah a jira sakan biyar kafin a sake gwadawa. / Server is currently busy (Rate limit). Please wait 5 seconds and try again.'
      } else if (err.name === 'AbortError') {
        msg = 'Gwadawa ta katse saboda jinkiri. / Timed out. Check connection.'
      }
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const stream = useCallback(async ({
    systemPrompt, userPrompt, history = [],
    temperature = 0.3, maxTokens = DEFAULT_TOKENS,
    imageBase64 = null, mimeType = null,
    onChunk = null
  }) => {
    setLoading(true)
    setError(null)
    setStreamText('')

    try {
      const fullText = await callWithFallback({
        systemPrompt, userPrompt, history,
        imageBase64, mimeType,
        temperature, maxTokens,
        onProviderSwitch: (p) => setProvider(p)
      }, (delta, cleaned) => {
        setStreamText(cleaned)
        onChunk?.(delta, cleaned)
      })
      return fullText
    } catch (err) {
      let msg = err.message
      if (err.message === 'SERVER_BUSY') {
        msg = 'Wuraren sabis ɗinmu suna cike da aiki (Rate limit). Don Allah a jira sakan biyar kafin a sake gwadawa. / Server is currently busy (Rate limit). Please wait 5 seconds and try again.'
      } else if (err.name === 'AbortError') {
        msg = 'Gwadawa ta katse saboda jinkiri. / Timed out. Check connection.'
      }
      setError(msg)
      throw new Error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const callJSON = useCallback(async (options) => {
    const { text } = await call({ ...options, temperature: 0.1, maxTokens: 1024 })
    const parsed = parseJSON(text)
    if (!parsed) throw new Error('Could not read the document. Please try again.')
    return parsed
  }, [call])

  return { call, stream, callJSON, loading, error, streamText, provider }
}
