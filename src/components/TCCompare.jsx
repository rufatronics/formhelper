// TCCompare.jsx
import { useState, useCallback } from 'react'
import { useGeminiAPI } from '../hooks/useGeminiAPI'
import { useTTS } from '../hooks/useTTS'
import { useOfflineCache } from '../hooks/useOfflineCache'
import { DocumentUploader } from './DocumentUploader'
import { VoiceInput } from './VoiceInput'
import { buildComparePrompt, buildSimplifyPrompt, buildExplainClausePrompt } from '../utils/prompts'

function hashText(text) {
  let h = 0
  for (let i = 0; i < Math.min(text.length, 200); i++) { h = (h * 31 + text.charCodeAt(i)) | 0 }
  return String(h)
}

export function TCCompare() {
  const [docA, setDocA] = useState(null)
  const [docB, setDocB] = useState(null)
  const [labelA, setLabelA] = useState('Document A')
  const [labelB, setLabelB] = useState('Document B')
  const [comparison, setComparison] = useState(null)
  const [simplified, setSimplified] = useState({})
  const [explaining, setExplaining] = useState(null)
  const [explanations, setExplanations] = useState({})
  const [stage, setStage] = useState('upload') // upload | comparing | results
  const [followUpQ, setFollowUpQ] = useState('')
  const [followUpA, setFollowUpA] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)

  const { call, callJSON, loading } = useGeminiAPI()
  const { speak } = useTTS()
  const { cacheAPIResponse, getCachedResponse } = useOfflineCache()

  const compare = useCallback(async () => {
    if (!docA || !docB) return
    setStage('comparing')

    const textA = docA.text || '[Image — visual document]'
    const textB = docB.text || '[Image — visual document]'
    const cacheKey = `compare_${hashText(textA)}_${hashText(textB)}`

    try {
      // Check cache first
      const cached = await getCachedResponse(cacheKey)
      if (cached) { setComparison(cached); setStage('results'); return }

      const prompt = buildComparePrompt(textA, textB, labelA, labelB)
      const result = await callJSON({
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
        imageBase64: docA.mode === 'image' ? docA.base64 : null,
        mimeType: docA.mode === 'image' ? docA.mimeType : null,
        useThinking: true,
        heavy: true,
        maxTokens: 3000
      })

      setComparison(result)
      setStage('results')
      await cacheAPIResponse(cacheKey, result)
    } catch (err) {
      alert(`Comparison failed: ${err.message}`)
      setStage('upload')
    }
  }, [docA, docB, labelA, labelB, callJSON, cacheAPIResponse, getCachedResponse])

  const simplifyDoc = useCallback(async (which) => {
    const doc = which === 'A' ? docA : docB
    if (!doc?.text) return

    try {
      const prompt = buildSimplifyPrompt(doc.text)
      const { text } = await call({
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
        useThinking: false
      })
      setSimplified(prev => ({ ...prev, [which]: text }))
      speak(text)
    } catch {}
  }, [docA, docB, call, speak])

  const explainDifference = useCallback(async (topic, clause) => {
    const key = `${topic}_${clause.slice(0, 20)}`
    if (explanations[key]) { speak(explanations[key]); return }
    setExplaining(key)

    try {
      const prompt = buildExplainClausePrompt(clause, `This is about "${topic}" in a contract.`)
      const { text } = await call({ systemPrompt: prompt.systemPrompt, userPrompt: prompt.userPrompt })
      setExplanations(prev => ({ ...prev, [key]: text }))
      speak(text)
    } catch {} finally {
      setExplaining(null)
    }
  }, [call, speak, explanations])

  const askFollowUp = useCallback(async () => {
    if (!followUpQ.trim()) return
    setFollowUpLoading(true)
    setFollowUpA('')

    const context = comparison
      ? `Document comparison summary: ${comparison.summary}\nDifferences: ${comparison.differences?.map(d => `${d.topic}: A="${d.docA}" vs B="${d.docB}"`).join('. ')}`
      : ''

    try {
      const { text } = await call({
        systemPrompt: 'You are ClearForm, a plain-language assistant. Answer questions about documents simply and clearly. Use words a 10-year-old understands.',
        userPrompt: `${context}\n\nUser question: ${followUpQ}`
      })
      setFollowUpA(text)
      speak(text)
    } catch {} finally {
      setFollowUpLoading(false)
    }
  }, [followUpQ, comparison, call, speak])

  // --- UPLOAD ---
  if (stage === 'upload') {
    return (
      <div className="space-y-6 animate-fade-up">
        <div>
          <h2 className="font-display text-2xl font-bold">Compare Documents</h2>
          <p className="text-white/50 text-sm">Upload two contracts or T&Cs. I'll explain the differences in plain language.</p>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <input
              value={labelA}
              onChange={e => setLabelA(e.target.value)}
              placeholder="Name this document…"
              className="input-field text-sm"
              aria-label="Label for Document A"
            />
            <DocumentUploader label="Upload First Document" onExtracted={setDocA} />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10"/>
            <span className="text-white/30 text-xs uppercase tracking-widest">vs</span>
            <div className="flex-1 h-px bg-white/10"/>
          </div>

          <div className="space-y-2">
            <input
              value={labelB}
              onChange={e => setLabelB(e.target.value)}
              placeholder="Name this document…"
              className="input-field text-sm"
              aria-label="Label for Document B"
            />
            <DocumentUploader label="Upload Second Document" onExtracted={setDocB} />
          </div>
        </div>

        <button
          onClick={compare}
          disabled={!docA || !docB || loading}
          className="btn-primary w-full text-lg py-4 disabled:opacity-40"
        >
          Compare with Gemma 4 →
        </button>
      </div>
    )
  }

  // --- COMPARING ---
  if (stage === 'comparing') {
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center animate-fade-up">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-amber/20"/>
          <div className="absolute inset-0 rounded-full border-4 border-t-amber animate-spin"/>
          <span className="absolute inset-0 flex items-center justify-center text-2xl" aria-hidden="true">🔍</span>
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Gemma 4 is comparing…</h2>
          <p className="text-white/40 text-sm mt-1">Using deep reasoning mode for accuracy</p>
        </div>
      </div>
    )
  }

  // --- RESULTS ---
  if (stage === 'results' && comparison) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Comparison Results</h2>
          <button onClick={() => setStage('upload')} className="text-white/30 text-xs hover:text-white/60">← New comparison</button>
        </div>

        {/* Summary card */}
        <div className="card p-5 border-amber/20 bg-amber/5 space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-widest">Summary</p>
          <p className="text-paper leading-relaxed">{comparison.summary}</p>
          {comparison.recommendation && (
            <p className="text-amber text-sm font-medium mt-2">💡 {comparison.recommendation}</p>
          )}
        </div>

        {/* Simplify buttons */}
        <div className="flex gap-2">
          <button onClick={() => simplifyDoc('A')} className="btn-secondary text-sm flex-1">
            Simplify {labelA}
          </button>
          <button onClick={() => simplifyDoc('B')} className="btn-secondary text-sm flex-1">
            Simplify {labelB}
          </button>
        </div>

        {simplified.A && (
          <div className="card p-4 space-y-1 border-white/10">
            <p className="text-white/40 text-xs uppercase tracking-widest">{labelA} — Plain Language</p>
            <p className="text-paper/80 text-sm leading-relaxed whitespace-pre-line">{simplified.A}</p>
          </div>
        )}
        {simplified.B && (
          <div className="card p-4 space-y-1 border-white/10">
            <p className="text-white/40 text-xs uppercase tracking-widest">{labelB} — Plain Language</p>
            <p className="text-paper/80 text-sm leading-relaxed whitespace-pre-line">{simplified.B}</p>
          </div>
        )}

        {/* Differences table */}
        <div className="space-y-3">
          <h3 className="font-display font-semibold text-paper/80">Key Differences</h3>
          {comparison.differences?.map((diff, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold text-amber text-sm">{diff.topic}</span>
                <button
                  onClick={() => explainDifference(diff.topic, `${diff.docA} vs ${diff.docB}`)}
                  disabled={explaining === `${diff.topic}_${(`${diff.docA} vs ${diff.docB}`).slice(0, 20)}`}
                  className="text-xs text-teal hover:underline disabled:opacity-40"
                  aria-label={`Explain ${diff.topic} in simpler words`}
                >
                  {explaining ? 'Explaining…' : '🔍 Explain this'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/5 rounded-xl p-3 space-y-1">
                  <p className="text-white/30 text-xs">{labelA}</p>
                  <p className="text-paper/80">{diff.docA}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 space-y-1">
                  <p className="text-white/30 text-xs">{labelB}</p>
                  <p className="text-paper/80">{diff.docB}</p>
                </div>
              </div>

              {diff.userNote && (
                <p className="text-white/50 text-xs italic">{diff.userNote}</p>
              )}

              {explanations[`${diff.topic}_${(`${diff.docA} vs ${diff.docB}`).slice(0, 20)}`] && (
                <div className="bg-teal/10 border border-teal/20 rounded-xl p-3">
                  <p className="text-teal/80 text-sm">{explanations[`${diff.topic}_${(`${diff.docA} vs ${diff.docB}`).slice(0, 20)}`]}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Follow-up Q&A */}
        <div className="card p-4 space-y-3">
          <p className="font-display font-semibold text-sm text-white/60">Ask a follow-up question</p>
          <div className="flex gap-2">
            <input
              value={followUpQ}
              onChange={e => setFollowUpQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && askFollowUp()}
              placeholder="e.g. Which one lets me cancel easier?"
              className="input-field flex-1 text-sm"
              aria-label="Ask a follow-up question about these documents"
            />
            <VoiceInput onResult={setFollowUpQ} />
          </div>
          <button
            onClick={askFollowUp}
            disabled={followUpLoading || !followUpQ.trim()}
            className="btn-primary w-full text-sm py-2.5"
          >
            {followUpLoading ? 'Thinking…' : 'Ask →'}
          </button>
          {followUpA && (
            <div className="bg-amber/5 border border-amber/20 rounded-xl p-3 animate-fade-up">
              <p className="text-paper text-sm leading-relaxed">{followUpA}</p>
            </div>
          )}
        </div>
      </div>
    )
  }
}
