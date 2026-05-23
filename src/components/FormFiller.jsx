// FormFiller.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useGeminiAPI } from '../hooks/useGeminiAPI'
import { useTTS } from '../hooks/useTTS'
import { useOfflineCache } from '../hooks/useOfflineCache'
import { DocumentUploader } from './DocumentUploader'
import { VoiceInput } from './VoiceInput'
import { ProgressIndicator } from './ProgressIndicator'
import {
  buildFieldExtractionPrompt,
  buildFormQuestionPrompt,
  SYSTEM_PROMPTS
} from '../utils/prompts'
import { validateField, normalizeAnswer } from '../utils/validators'
import { parseFieldsFromResponse } from '../utils/extractFields'

const FORM_TEMPLATES = [
  {
    id: 'rental', label: 'Rental Application', icon: '🏠',
    fields: [
      { id: 'full_name',      label: 'Full Name',                  type: 'name',    required: true,  helpText: 'Your legal first and last name' },
      { id: 'dob',            label: 'Date of Birth',              type: 'date',    required: true,  helpText: 'Your birthday' },
      { id: 'phone',          label: 'Phone Number',               type: 'phone',   required: true,  helpText: 'A number people can call you on' },
      { id: 'email',          label: 'Email Address',              type: 'email',   required: false, helpText: 'Your email if you have one' },
      { id: 'current_address',label: 'Current Address',            type: 'address', required: true,  helpText: 'Where you live right now' },
      { id: 'employer',       label: 'Employer / Income Source',   type: 'text',    required: true,  helpText: 'Where you work or how you earn money' },
      { id: 'monthly_income', label: 'Monthly Income',             type: 'number',  required: true,  helpText: 'How much money you earn each month' }
    ]
  },
  {
    id: 'medical', label: 'Medical Intake', icon: '🏥',
    fields: [
      { id: 'full_name',        label: 'Patient Full Name',          type: 'name',  required: true,  helpText: 'Your legal name' },
      { id: 'dob',              label: 'Date of Birth',              type: 'date',  required: true,  helpText: 'Your birthday' },
      { id: 'insurance',        label: 'Insurance Provider',         type: 'text',  required: false, helpText: 'Your health insurance company name' },
      { id: 'insurance_id',     label: 'Insurance ID Number',        type: 'text',  required: false, helpText: 'The number on your insurance card' },
      { id: 'emergency_contact',label: 'Emergency Contact Name',     type: 'name',  required: true,  helpText: 'Someone we can call in an emergency' },
      { id: 'emergency_phone',  label: 'Emergency Contact Phone',    type: 'phone', required: true,  helpText: 'Their phone number' },
      { id: 'allergies',        label: 'Known Allergies',            type: 'textarea', required: false, helpText: 'Any medicines or foods you are allergic to' }
    ]
  },
  {
    id: 'benefits', label: 'Benefits Application', icon: '📋',
    fields: [
      { id: 'full_name',      label: 'Full Name',                        type: 'name',   required: true,  helpText: 'Your legal name' },
      { id: 'ssn_last4',     label: 'Last 4 of Social Security Number',  type: 'text',   required: true,  helpText: 'Just the last 4 digits of your SSN' },
      { id: 'dob',            label: 'Date of Birth',                    type: 'date',   required: true,  helpText: 'Your birthday' },
      { id: 'address',        label: 'Home Address',                     type: 'address',required: true,  helpText: 'Where you currently live' },
      { id: 'household_size', label: 'Number of People in Household',    type: 'number', required: true,  helpText: 'How many people live with you' },
      { id: 'monthly_income', label: 'Total Household Monthly Income',   type: 'number', required: true,  helpText: 'Total money earned by everyone in your home per month' }
    ]
  },
  { id: 'custom', label: 'Upload My Own Form', icon: '📤', fields: null }
]

export function FormFiller({ onProviderChange }) {
  const [stage, setStage]           = useState('select')
  const [template, setTemplate]     = useState(null)
  const [fields, setFields]         = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers]       = useState({})
  const [currentInput, setCurrentInput] = useState('')
  const [question, setQuestion]     = useState('')
  const [validationMsg, setValidationMsg] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [sessionId]                 = useState(() => `form_${Date.now()}`)

  const { call, callJSON, loading, provider } = useGeminiAPI()
  const { speak, autoRead, toggleAutoRead }   = useTTS()
  const { saveFormProgress }                  = useOfflineCache()
  const inputRef = useRef(null)

  const currentField   = fields[currentIndex]

  // Bubble provider changes up to App for the header badge
  useEffect(() => { onProviderChange?.(provider) }, [provider, onProviderChange])

  // Ask the current question via AI
  const askQuestion = useCallback(async (index, fs, ans) => {
    const field = fs[index]
    if (!field) return

    const previousAnswers = fs.slice(0, index)
      .map(f => ({ label: f.label, value: ans[f.id] || '' }))
      .filter(a => a.value)

    const prompt = buildFormQuestionPrompt(field, previousAnswers)

    try {
      const { text } = await call({
        systemPrompt: SYSTEM_PROMPTS.formHelper,
        userPrompt: prompt.userPrompt
      })
      setQuestion(text)
      if (autoRead) speak(text)
    } catch {
      const fallback = `Please enter your ${field.label}.`
      setQuestion(fallback)
      if (autoRead) speak(fallback)
    }
  }, [call, speak, autoRead])

  const startTemplate = useCallback(async (tmpl) => {
    setTemplate(tmpl)
    if (tmpl.fields) {
      setFields(tmpl.fields)
      setStage('filling')
      setCurrentIndex(0)
      setAnswers({})
      askQuestion(0, tmpl.fields, {})
    }
  }, [askQuestion])

  // Handle upload — uses Gemma 4 vision or text to extract fields
  const handleDocumentExtracted = useCallback(async ({ mode, text, base64, mimeType }) => {
    setExtracting(true)
    try {
      const prompt = buildFieldExtractionPrompt(text || 'Extract all form fields from this image.')

      // Use call() not callJSON() — we do our own robust parsing
      const { text: rawResponse } = await call({
        systemPrompt: SYSTEM_PROMPTS.formHelper,
        userPrompt: prompt.userPrompt,
        imageBase64: mode === 'image' ? base64 : null,
        mimeType:    mode === 'image' ? mimeType : null,
        maxTokens: 1024,
        temperature: 0.1
      })

      const result = parseFieldsFromResponse(rawResponse)
      const extractedFields = result?.fields || []
      if (extractedFields.length === 0) throw new Error('No fields found. Try a clearer photo or a different document.')

      setFields(extractedFields)
      setStage('filling')
      setCurrentIndex(0)
      setAnswers({})
      askQuestion(0, extractedFields, {})
    } catch (err) {
      alert(`Could not read form: ${err.message}`)
    } finally {
      setExtracting(false)
    }
  }, [call, askQuestion])

  const submitAnswer = useCallback(async (value) => {
    const v = String(value).trim()

    if (!v && currentField?.required) {
      const msg = 'This field is required. Please enter an answer.'
      setValidationMsg(msg)
      speak(msg)
      return
    }

    if (v) {
      const { valid, error } = validateField(currentField.type, v)
      if (!valid) {
        setValidationMsg(error)
        speak(error)
        return
      }
    }

    setValidationMsg('')
    const normalized = v ? normalizeAnswer(currentField.type, v) : ''
    const newAnswers  = { ...answers, [currentField.id]: normalized }
    setAnswers(newAnswers)
    setCurrentInput('')
    saveFormProgress(sessionId, fields, newAnswers)

    const nextIndex = currentIndex + 1
    if (nextIndex < fields.length) {
      setCurrentIndex(nextIndex)
      askQuestion(nextIndex, fields, newAnswers)
    } else {
      setStage('review')
      speak('Great job! Please review your answers.')
    }
  }, [currentField, answers, currentIndex, fields, sessionId, speak, askQuestion, saveFormProgress])

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      const prev = currentIndex - 1
      setCurrentIndex(prev)
      setCurrentInput(answers[fields[prev]?.id] || '')
      setValidationMsg('')
      askQuestion(prev, fields, answers)
    }
  }, [currentIndex, answers, fields, askQuestion])

  useEffect(() => { inputRef.current?.focus() }, [currentIndex])

  // ── SELECT ──────────────────────────────────────────────────────────────
  if (stage === 'select') {
    return (
      <div className="space-y-6 animate-fade-up">
        <div>
          <h2 className="font-display text-2xl font-bold text-paper mb-1">Fill a Form</h2>
          <p className="text-white/50 text-sm">Choose a template or upload your own form. I'll guide you one question at a time.</p>
        </div>

        <div className="grid gap-3">
          {FORM_TEMPLATES.map(tmpl => (
            <button
              key={tmpl.id}
              onClick={() => tmpl.id === 'custom' ? setTemplate(tmpl) : startTemplate(tmpl)}
              className={`
                flex items-center gap-4 p-4 rounded-2xl text-left border transition-all duration-200
                hover:border-amber/40 hover:bg-amber/5 focus-visible:ring-4 focus-visible:ring-amber/30
                focus-visible:outline-none active:scale-95
                ${template?.id === tmpl.id ? 'border-amber/40 bg-amber/5' : 'border-white/10 bg-white/5'}
              `}
            >
              <span className="text-3xl" aria-hidden="true">{tmpl.icon}</span>
              <div>
                <p className="font-display font-semibold text-paper">{tmpl.label}</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {tmpl.fields ? `${tmpl.fields.length} questions` : 'Upload PDF or photo'}
                </p>
              </div>
              <svg className="w-4 h-4 text-white/20 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          ))}
        </div>

        {template?.id === 'custom' && (
          <div className="animate-fade-up">
            {extracting ? (
              <div className="flex items-center gap-3 p-4 card">
                <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin flex-shrink-0"/>
                <p className="text-white/60 text-sm">Gemma 4 is reading your form…</p>
              </div>
            ) : (
              <DocumentUploader label="Upload your form (PDF or photo)" onExtracted={handleDocumentExtracted}/>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── FILLING ─────────────────────────────────────────────────────────────
  if (stage === 'filling') {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{template?.label || 'Your Form'}</h2>
          <button
            onClick={toggleAutoRead}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${autoRead ? 'border-teal/50 text-teal bg-teal/10' : 'border-white/20 text-white/40'}`}
          >
            {autoRead ? '🔊 Voice on' : '🔇 Voice off'}
          </button>
        </div>

        <ProgressIndicator current={currentIndex} total={fields.length}/>

        <div className="card p-5 space-y-4">
          {loading ? (
            <div className="flex gap-1.5 py-2" aria-live="polite" aria-label="Loading question">
              <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
            </div>
          ) : (
            <p className="text-paper text-lg leading-relaxed" aria-live="polite">{question}</p>
          )}

          <div className="flex gap-3">
            <input
              ref={inputRef}
              type={currentField?.type === 'number' ? 'number' : currentField?.type === 'date' ? 'date' : 'text'}
              value={currentInput}
              onChange={e => setCurrentInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAnswer(currentInput)}
              placeholder="Type your answer here…"
              className="input-field flex-1"
              aria-label={currentField?.label}
              disabled={loading}
              autoComplete="off"
            />
            <VoiceInput onResult={text => setCurrentInput(text)} disabled={loading}/>
          </div>

          {validationMsg && <p role="alert" className="text-amber text-sm">{validationMsg}</p>}
          {currentField?.helpText && <p className="text-white/30 text-xs">{currentField.helpText}</p>}
        </div>

        <div className="flex gap-3">
          {currentIndex > 0 && (
            <button onClick={goBack} className="btn-secondary flex-1">← Back</button>
          )}
          <button onClick={() => submitAnswer(currentInput)} disabled={loading} className="btn-primary flex-1">
            {currentIndex === fields.length - 1 ? 'Review Answers →' : 'Next →'}
          </button>
        </div>

        {!currentField?.required && (
          <button onClick={() => submitAnswer('')} className="w-full text-white/30 text-sm hover:text-white/50 transition-colors">
            Skip this question
          </button>
        )}
      </div>
    )
  }

  // ── REVIEW ──────────────────────────────────────────────────────────────
  if (stage === 'review') {
    return (
      <div className="space-y-6 animate-fade-up">
        <div>
          <h2 className="font-display text-2xl font-bold">Review Your Answers</h2>
          <p className="text-white/50 text-sm">Check everything looks right. Tap any answer to change it.</p>
        </div>

        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="card p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white/40 text-xs uppercase tracking-wide mb-0.5">{field.label}</p>
                <p className="text-paper font-medium truncate">
                  {answers[field.id] || <span className="text-white/20 italic">Not answered</span>}
                </p>
              </div>
              <button
                onClick={() => {
                  setCurrentIndex(i)
                  setCurrentInput(answers[field.id] || '')
                  setStage('filling')
                  askQuestion(i, fields, answers)
                }}
                className="text-amber text-xs hover:underline flex-shrink-0"
              >Edit</button>
            </div>
          ))}
        </div>

        <button onClick={() => setStage('done')} className="btn-primary w-full text-lg py-4">
          ✓ All Done — Save My Answers
        </button>
      </div>
    )
  }

  // ── DONE ─────────────────────────────────────────────────────────────────
  if (stage === 'done') {
    const downloadJSON = () => {
      const data = {}
      fields.forEach(f => { data[f.label] = answers[f.id] || '' })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = `${template?.label || 'form'}-answers.json`
      a.click()
    }

    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center animate-fade-up">
        <div className="w-20 h-20 rounded-full bg-teal/20 flex items-center justify-center text-4xl">✓</div>
        <div>
          <h2 className="font-display text-2xl font-bold">Form Complete!</h2>
          <p className="text-white/50 text-sm mt-1">Great job — all {fields.length} questions answered.</p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          <button onClick={downloadJSON} className="btn-primary w-full">Download My Answers (JSON)</button>
          <button
            onClick={() => { setStage('select'); setTemplate(null); setAnswers({}); setFields([]) }}
            className="btn-secondary w-full"
          >Fill Another Form</button>
        </div>
      </div>
    )
  }
      }
       
