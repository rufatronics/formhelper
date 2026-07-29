// src/components/VerifyView.jsx
import { useState, useCallback, useRef } from 'react'
import { useGeminiAPI } from '../hooks/useGeminiAPI'
import { useTTS } from '../hooks/useTTS'
import { DocumentUploader } from './DocumentUploader'
import { buildVerifyPrompt } from '../utils/prompts'
import {
  performELA,
  performFFTCheck,
  performNoiseConsistency,
  performOpenCVForensics,
  parseJPEGQuantization
} from '../utils/forensics'

export function VerifyView() {
  const [doc, setDoc] = useState(null)
  const [forensicSignals, setForensicSignals] = useState(null)
  const [report, setReport] = useState(null)
  const [stage, setStage] = useState('upload') // upload | processing | results
  const [loadingMsg, setLoadingMsg] = useState('')
  const [expandedSections, setExpandedSections] = useState({})

  const { callJSON, loading } = useGeminiAPI()
  const { speak } = useTTS()
  const imageRef = useRef(null)

  const toggleSection = (index) => {
    setExpandedSections(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const handleDocumentSelected = useCallback((extractedData) => {
    setDoc(extractedData)
    // Clear old state
    setForensicSignals(null)
    setReport(null)
    setStage('upload')
  }, [])

  const runAnalysis = useCallback(async () => {
    if (!doc) return
    setStage('processing')
    setLoadingMsg('Reading image layout…')

    try {
      // 1. Load Image Element for client-side pixel extraction
      const img = new Image()
      img.src = `data:${doc.mimeType || 'image/jpeg'};base64,${doc.base64}`

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = () => reject(new Error('Failed to render document image on canvas'))
      })

      // 2. Perform Classical Client-Side Image Forensics
      setLoadingMsg('Performing Error Level Analysis (ELA)…')
      const elaResult = await performELA(img, 0.85)

      setLoadingMsg('Analyzing frequency domain (FFT)…')
      const fftResult = await performFFTCheck(img)

      setLoadingMsg('Calculating local noise consistency map…')
      const noiseResult = await performNoiseConsistency(img)

      setLoadingMsg('Scanning text line alignments (OpenCV)…')
      const opencvResult = await performOpenCVForensics(img)

      setLoadingMsg('Parsing re-compression quantization signatures…')
      const dqtResult = await parseJPEGQuantization(doc.file)

      const signals = {
        ela: { score: elaResult.score, heatmapDataUrl: elaResult.heatmapDataUrl },
        fft: fftResult,
        noiseConsistency: noiseResult,
        textLineAlignment: {
          detectedCount: opencvResult.textLinesDetectedCount || 0,
          baselineYVariance: opencvResult.textLineBaselineYVariance || 0,
          verticalSpacingVariance: opencvResult.textLineVerticalSpacingVariance || 0
        },
        stampIsolation: {
          detectedCount: opencvResult.detectedStampRegionsCount || 0,
          regions: opencvResult.stampRegionsList || []
        },
        recompressionEstimate: dqtResult
      }

      setForensicSignals(signals)

      // 3. Send raw signals to Gemma 4 to formulate verdict and report
      setLoadingMsg('Formulating calibrated verification report with Gemma 4…')
      const prompt = buildVerifyPrompt(signals)
      const reportResponse = await callJSON({
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
        useThinking: false,
        temperature: 0.1
      })

      setReport(reportResponse)
      setStage('results')

      if (reportResponse.summary) {
        speak(reportResponse.summary)
      }
    } catch (err) {
      alert(`Verification analysis failed: ${err.message}`)
      setStage('upload')
    }
  }, [doc, callJSON, speak])

  const reset = () => {
    setDoc(null)
    setForensicSignals(null)
    setReport(null)
    setStage('upload')
    setLoadingMsg('')
  }

  // --- UPLOAD STAGE ---
  if (stage === 'upload') {
    return (
      <div className="space-y-6 animate-fade-up">
        <div>
          <h2 className="font-display text-2xl font-bold text-paper mb-1">Verify Document</h2>
          <p className="text-white/50 text-sm">Upload a certificate, admission letter, or ID to analyze if it is genuine, digitally modified, or AI-generated.</p>
        </div>

        <DocumentUploader
          label="Select or take a photo of the document"
          accept="image/*"
          onExtracted={handleDocumentSelected}
        />

        {doc && (
          <div className="space-y-4 animate-fade-up">
            <div className="relative aspect-[3/4] max-h-72 rounded-2xl overflow-hidden border border-white/10 bg-white/5 mx-auto">
              <img
                src={`data:${doc.mimeType || 'image/jpeg'};base64,${doc.base64}`}
                alt="Uploaded document thumbnail"
                className="w-full h-full object-contain"
              />
            </div>

            <button onClick={runAnalysis} className="btn-primary w-full text-lg py-4">
              Analyze Forensics with Gemma 4 →
            </button>
          </div>
        )}
      </div>
    )
  }

  // --- PROCESSING STAGE ---
  if (stage === 'processing') {
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center animate-fade-up">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-amber/20"/>
          <div className="absolute inset-0 rounded-full border-4 border-t-amber animate-spin"/>
          <span className="absolute inset-0 flex items-center justify-center text-2xl" aria-hidden="true">🛡️</span>
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Document Forensics</h2>
          <p className="text-white/40 text-sm mt-1">{loadingMsg}</p>
        </div>
      </div>
    )
  }

  // --- RESULTS STAGE ---
  const classificationColors = {
    'genuine': 'border-teal/30 bg-teal/5 text-teal-light',
    'edited-genuine': 'border-amber/30 bg-amber/5 text-amber',
    'AI-generated': 'border-purple-500/30 bg-purple-500/5 text-purple-400',
    're-shared-copy': 'border-blue-500/30 bg-blue-500/5 text-blue-400',
    'fabricated-from-scratch': 'border-red-500/30 bg-red-500/5 text-red-400'
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Verification Report</h2>
        <button onClick={reset} className="text-white/30 text-xs hover:text-white/60">← Start New</button>
      </div>

      {report && (
        <>
          {/* Main prominence card */}
          <div className={`card p-5 border-2 ${classificationColors[report.classification] || 'border-amber/20 bg-amber/5'} space-y-3`}>
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs uppercase tracking-widest">Classification</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 font-semibold font-mono">
                Score: {report.confidenceScore}%
              </span>
            </div>
            <p className="text-2xl font-display font-black capitalize leading-none">
              {report.classification?.replace(/-/g, ' ')}
            </p>
            <p className="text-paper text-sm leading-relaxed">{report.summary}</p>
            {report.recommendation && (
              <div className="pt-2 border-t border-white/5 text-xs font-medium">
                💡 Recommendation: {report.recommendation}
              </div>
            )}
          </div>

          {/* ELA Heatmap Viewer */}
          {forensicSignals?.ela?.heatmapDataUrl && (
            <div className="card p-4 space-y-2">
              <p className="font-display font-bold text-sm text-paper/80">Error Level Analysis Heatmap</p>
              <div className="relative aspect-[3/4] max-h-72 rounded-xl overflow-hidden border border-white/10 bg-black">
                <img
                  src={forensicSignals.ela.heatmapDataUrl}
                  alt="Error level analysis heatmap"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-white/40 text-[11px] leading-snug">
                Heatmap shows local compression differences. High-contrast edge highlights are normal, but localized bright grids/spots often point to digital modifications.
              </p>
            </div>
          )}

          {/* Detailed Forensic Section Accordions */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-paper/80">Detailed Signals Analysis</h3>
            {report.sections?.map((section, idx) => {
              const isExpanded = !!expandedSections[idx];
              return (
                <div key={idx} className="card overflow-hidden">
                  <button
                    onClick={() => toggleSection(idx)}
                    className="w-full flex items-center justify-between p-4 text-left font-display font-semibold text-sm hover:bg-white/5 transition-colors"
                  >
                    <span>{section.title}</span>
                    <span className="text-white/30 text-xs">{isExpanded ? 'Collapse ▲' : 'Expand ▼'}</span>
                  </button>
                  {isExpanded && (
                    <div className="p-4 pt-0 border-t border-white/5 bg-white/[0.01] space-y-2 animate-fade-down">
                      <p className="text-paper/90 text-sm leading-relaxed">{section.finding}</p>
                      {section.implication && (
                        <p className="text-white/40 text-xs italic">🔍 Implication: {section.implication}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
