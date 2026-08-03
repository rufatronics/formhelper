// ChatWindow.jsx
// React component supporting an interactive streaming chat with Kariya AI.
// Empowers users to ask conversational questions about agreements, terms, or safety.
// Features a dynamic camera/file uploader, allowing users to select or snap pictures
// of physical documents and immediately consult Gemma 4 regarding their contents.

import { useState, useRef, useEffect, useCallback } from 'react'
import { useGeminiAPI } from '../hooks/useGeminiAPI'
import { useTTS } from '../hooks/useTTS'
import { useOfflineCache } from '../hooks/useOfflineCache'
import { VoiceInput } from './VoiceInput'
import { buildChatPrompt } from '../utils/prompts'
import { TRANSLATIONS } from '../utils/translations'
import { extractTextFromFile } from '../utils/documentParser'

const SUGGESTIONS = {
  ha: [
    'Menene ma\'anar "indemnify"?',
    'Shin wannan takarda tana da lafiya in sanya hannu?',
    'Menene ya kamata in kiyaye a yarjejeniyar haya?',
    'Yi bayanin menene "liability clause".'
  ],
  en: [
    'What does "indemnify" mean?',
    'Is this contract safe to sign?',
    'What should I watch out for in a rental agreement?',
    'Explain what a liability clause is.'
  ],
  pcm: [
    'Wetin be the meaning of "indemnify"?',
    'This contract safe to sign so?',
    'Wetin I suppose look out for for rent agreement?',
    'Explain wetin "liability clause" be.'
  ]
}

function MessageBubble({ msg, onSpeak }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-up`}>
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm
        ${isUser ? 'bg-amber/20 text-amber' : 'bg-teal/20 text-teal'}
      `} aria-hidden="true">
        {isUser ? '👤' : '✦'}
      </div>
      <div className={`
        max-w-[80%] rounded-2xl px-4 py-3 leading-relaxed text-sm space-y-2
        ${isUser ? 'bg-amber/10 text-paper rounded-tr-sm' : 'bg-white/5 text-paper/90 rounded-tl-sm'}
      `}>
        {msg.attachmentUrl && (
          <div className="relative rounded-lg overflow-hidden border border-white/10 max-h-40 bg-black">
            <img src={msg.attachmentUrl} alt="User attachment" className="w-full h-full object-contain" />
          </div>
        )}
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {!isUser && (
          <button
            onClick={() => onSpeak(msg.content)}
            className="mt-2 text-white/20 hover:text-white/50 transition-colors text-xs"
            aria-label="Read this message aloud"
          >
            🔊
          </button>
        )}
      </div>
    </div>
  )
}

export function ChatWindow({ lang = 'ha' }) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.ha;
  const currentSuggestions = SUGGESTIONS[lang] || SUGGESTIONS.ha;

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: lang === 'ha'
        ? 'Sannu! Ni ne mataimakin ku Kariya AI. Zan iya taimaka muku wajen fassara ko fahimtar kowace takarda, yarjejeniyar haya, ko sako. Za ku iya aiko min da tambaya ko hoto!'
        : lang === 'pcm'
        ? 'Howfar! I be your Kariya AI assistant. I fit help you interpret contract or any form. Ask me anything or upload paper photo!'
        : 'Hi! I\'m Kariya AI. I can help you translate and understand documents, lease agreements, or text messages. Ask me any question or upload a photo!',
      id: 'welcome'
    }
  ])
  const [input, setInput] = useState('')
  const [streamingMsg, setStreamingMsg] = useState('')
  const [attachment, setAttachment] = useState(null) // { base64, mimeType, name, extractedText }
  const [loadingFile, setLoadingFile] = useState(false)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  const { stream, loading } = useGeminiAPI()
  const { speak } = useTTS()
  const { saveChatHistory, getChatHistory } = useOfflineCache()

  // Pull local persisted history if available
  useEffect(() => {
    const saved = getChatHistory()
    if (saved.length > 0) {
      setMessages([messages[0], ...saved])
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMsg])

  // Triggers camera or file selector
  const handleAttachmentClick = () => {
    fileInputRef.current?.click()
  }

  // Converts attached file and extracts OCR details asynchronously
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoadingFile(true)
    try {
      const res = await extractTextFromFile(file)
      setAttachment({
        base64: res.base64,
        mimeType: res.mimeType || file.type,
        name: file.name,
        localUrl: URL.createObjectURL(file),
        extractedText: res.text
      })
    } catch (err) {
      alert(`Could not read file: ${err.message}`)
    } finally {
      setLoadingFile(false)
    }
  }

  const sendMessage = useCallback(async (text) => {
    const tVal = text.trim()
    if (!tVal && !attachment) return
    if (loading) return

    // Create user message representation including attachments
    const userMsg = {
      role: 'user',
      content: tVal || (lang === 'ha' ? '[An tura hoto / Attached Photo]' : '[Uploaded Document Image]'),
      attachmentUrl: attachment?.localUrl || null,
      id: Date.now()
    }

    const history = messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreamingMsg('')

    const systemPrompt = `You are Kariya, a supportive assistant powered by Gemma 4. Translate answers to: ${
      lang === 'ha' ? 'Hausa' : lang === 'pcm' ? 'Nigerian Pidgin' : 'English'
    }. Keep vocabulary simple, highly clear, and safe for low-literacy users. Use visual markers like emojis where appropriate.`

    // Append extracted OCR text block to userPrompt context so the AI always gets the textual details!
    let finalUserPrompt = tVal || "Describe and analyze the contents of this uploaded document in detail."
    if (attachment?.extractedText) {
      finalUserPrompt = `${finalUserPrompt}\n\n[Attached Document OCR Text content]:\n${attachment.extractedText}`
    }

    const queryParams = {
      systemPrompt,
      userPrompt: finalUserPrompt,
      history,
      imageBase64: attachment?.base64 || null,
      mimeType: attachment?.mimeType || null,
      onChunk: (_, full) => setStreamingMsg(full)
    }

    // Reset attached state once loaded to query queue
    setAttachment(null)

    try {
      const fullText = await stream(queryParams)

      const assistantMsg = { role: 'assistant', content: fullText, id: Date.now() + 1 }
      setMessages(prev => {
        const updated = [...prev, assistantMsg]
        saveChatHistory(updated.filter(m => m.id !== 'welcome'))
        return updated
      })
    } catch (err) {
      const errMsg = {
        role: 'assistant',
        content: lang === 'ha'
          ? `Yi haƙuri, na sami ɗan matsala wajen haɗawa da sabar: ${err.message}`
          : `Sorry, I had trouble connecting: ${err.message}`,
        id: Date.now() + 1
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setStreamingMsg('')
    }
  }, [messages, loading, stream, saveChatHistory, attachment, lang])

  const clearHistory = useCallback(() => {
    setMessages([messages[0]])
    localStorage.removeItem('clearform_chat')
  }, [messages])

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold">{t.chatTitle}</h2>
        <button onClick={clearHistory} className="text-white/20 text-xs hover:text-white/50 transition-colors">
          {lang === 'ha' ? 'Share hirar' : 'Clear chat'}
        </button>
      </div>

      {/* Messages list container */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 max-h-[400px]" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} onSpeak={speak} />
        ))}
        {streamingMsg && (
          <div className="flex gap-3 animate-fade-up">
            <div className="w-8 h-8 rounded-full bg-teal/20 text-teal flex items-center justify-center flex-shrink-0 text-sm" aria-hidden="true">✦</div>
            <div className="max-w-[80%] bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-paper/90 leading-relaxed">
              <p className="whitespace-pre-wrap">{streamingMsg}</p>
              <span className="inline-block w-1 h-4 bg-amber/60 animate-pulse ml-0.5 align-middle" aria-hidden="true"/>
            </div>
          </div>
        )}
        {loading && !streamingMsg && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-teal/20 flex items-center justify-center flex-shrink-0 text-sm" aria-hidden="true">✦</div>
            <div className="bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center" aria-label="Loading response">
              <span className="typing-dot" aria-hidden="true"/>
              <span className="typing-dot" aria-hidden="true"/>
              <span className="typing-dot" aria-hidden="true"/>
            </div>
          </div>
        )}
        {loadingFile && (
          <div className="flex items-center gap-2 text-xs text-white/50 bg-white/5 rounded-xl p-2 max-w-xs animate-pulse">
            <div className="w-4 h-4 border-2 border-amber border-t-transparent rounded-full animate-spin" />
            <span>Reading image details...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion tags (rendered before user initiates text answers) */}
      {messages.length <= 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {currentSuggestions.slice(0, 3).map(s => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="flex-shrink-0 text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:border-white/30 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Attachment Preview Panel */}
      {attachment && (
        <div className="mb-3 flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/10 animate-fade-up max-w-xs">
          <img src={attachment.localUrl} alt="Thumbnail attachment" className="w-10 h-10 object-cover rounded-lg" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/70 truncate">{attachment.name}</p>
            <p className="text-[10px] text-teal uppercase font-semibold">Ready with OCR Text</p>
          </div>
          <button
            onClick={() => setAttachment(null)}
            className="w-5 h-5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-full flex items-center justify-center text-xs"
            aria-label="Remove attachment"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hidden file attachment trigger */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Interactive Input console panel */}
      <div className="flex gap-2">
        {/* Snap or Attach Document Trigger */}
        <button
          onClick={handleAttachmentClick}
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-paper px-3 rounded-xl flex items-center justify-center transition-colors focus:outline-none"
          title="Attach document image"
          aria-label="Attach document image"
          disabled={loading || loadingFile}
        >
          📷
        </button>

        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder={t.chatPlaceholder}
          className="input-field flex-1"
          aria-label="Type your question"
          disabled={loading || loadingFile}
        />
        <VoiceInput onResult={text => { setInput(text); sendMessage(text) }} disabled={loading || loadingFile} />
        <button
          onClick={() => sendMessage(input)}
          disabled={(!input.trim() && !attachment) || loading || loadingFile}
          className="btn-primary px-4 py-3 text-sm"
          aria-label="Send message"
        >
          {t.chatSendBtn.replace(' →', '')} →
        </button>
      </div>
    </div>
  )
}

// .
