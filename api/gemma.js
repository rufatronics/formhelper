api/gemma.js — Vercel Serverless Function (Node.js runtime, NOT edge)
// Node.js runtime gets 60s max duration vs edge's 25s.
// We ALWAYS stream back to the client — even for "non-streaming" calls.
// This keeps the connection alive and avoids 504s on slow responses.

export const config = {
  runtime: 'nodejs',
  maxDuration: 60
}

const GEMMA_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.GOOGLE_AI_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  try {
    const { model = 'gemma-4-26b-a4b-it', stream = false, ...payload } = req.body

    // Always use SSE streaming to keep connection alive and avoid 504
    const endpoint = `${GEMMA_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55000) // 55s — just under Vercel's 60s limit
    })

    if (!upstream.ok) {
      const errText = await upstream.text()
      return res.status(upstream.status).json({ error: errText })
    }

    // Forward the SSE stream directly to the client
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering on Vercel

    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      res.write(chunk)
    }

    res.end()
  } catch (err) {
    // If headers not sent yet, return JSON error
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message })
    }
    res.end()
  }
}
