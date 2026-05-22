// api/gemma.js  –  Vercel Serverless Function
// Proxies requests to the Gemini API so the key never reaches the browser.
// Set GOOGLE_AI_KEY in Vercel → Project → Settings → Environment Variables.

export const config = { runtime: 'edge' }

const GEMMA_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    })
  }

  const apiKey = process.env.GOOGLE_AI_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.json()
    const { model = 'gemma-4-27b-it', stream = false, ...payload } = body

    const endpoint = stream
      ? `${GEMMA_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
      : `${GEMMA_BASE}/${model}:generateContent?key=${apiKey}`

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (stream) {
      // Forward SSE stream directly
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          ...corsHeaders(),
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      })
    }

    const data = await upstream.json()
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
    })
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
}
