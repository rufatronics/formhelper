# ClearForm — Plain Language Form & T&C Helper

> A PWA that helps low-literacy users fill forms and understand contracts — powered by **Gemma 4** via the Gemini API.

Built for the [dev.to Gemma 4 Challenge](https://dev.to/challenges).

---

## Features

- **📝 Voice-guided form filling** — asks one question at a time, validates answers, works with your voice
- **⚖️ Document comparison** — upload two T&Cs, get a plain-language side-by-side breakdown using Gemma 4's thinking mode
- **🔍 Explain any clause** — tap any difference to get a 3rd-grade explanation read aloud
- **💬 Streaming chat** — ask anything about your documents, answers stream in real time
- **📲 PWA** — installable, works offline for cached content
- **🖼️ Native image/PDF input** — passes scanned forms directly to Gemma 4 vision (no OCR needed)
- **🔒 Server-side API key** — key lives in Vercel environment variables, never exposed to the browser

---

## Tech Stack

| Layer | What |
|-------|------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS (Syne + Instrument Sans fonts) |
| AI | Gemma 4 (`gemma-4-26b-a4b-it`) via Gemini API |
| Proxy | Vercel Edge Function (`/api/gemma.js`) |
| PWA | vite-plugin-pwa + Workbox |
| Storage | IndexedDB (documents) + localStorage (progress) |
| Speech | Web Speech API (STT) + SpeechSynthesis (TTS) |
| PDF | pdf.js (text extraction + page rendering) |

---

## Gemma 4 Optimizations

- Uses **`gemma-4-26b-a4b-it`** (MoE) for most calls — best efficiency/quality ratio
- Uses **`gemma-4-31b-it`** (dense) for T&C comparison — heavier reasoning task
- **Thinking mode** enabled for document comparison (`thinkingBudget: 1024`)
- **Native system prompt support** — Gemma 4's `system_instruction` field used properly
- **Streaming** for chat — answers appear word by word for a natural feel
- **Native vision** — images and scanned PDFs sent directly to the model, no Tesseract
- **Temperature 1.0** enforced when thinking mode is on (required by the API)
- **JSON mode** for structured outputs (field extraction, comparisons)

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/yourusername/clearform
cd clearform
npm install
```

### 2. Get a Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click **Get API Key** → Create new key
3. Make sure Gemma 4 models are available in your region

### 3. Local development

Create `.env.local`:
```
GOOGLE_AI_KEY=your_key_here
```

Start the Vercel dev server (needed to run the API proxy locally):
```bash
npx vercel dev
```

> **Do not use `npm run dev` alone** — it won't run the `/api/gemma.js` proxy.  
> If you just want to test the frontend, you can temporarily hardcode the key in `api/gemma.js` (never commit this).

---

## Deploy to Vercel

### One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/clearform)

### Manual deploy

```bash
npm install -g vercel
vercel login
vercel
```

### Set the API key in Vercel

1. Go to your project in the [Vercel dashboard](https://vercel.com/dashboard)
2. **Settings → Environment Variables**
3. Add:
   - **Name:** `GOOGLE_AI_KEY`
   - **Value:** your Google AI Studio key
   - **Environments:** Production, Preview, Development
4. Redeploy

---

## Project Structure

```
clearform/
├── api/
│   └── gemma.js          # Vercel Edge Function — API proxy (key lives here)
├── src/
│   ├── App.jsx            # Root + tab navigation
│   ├── components/
│   │   ├── FormFiller.jsx       # Step-by-step voice form filling
│   │   ├── TCCompare.jsx        # Document comparison + explain
│   │   ├── ChatWindow.jsx       # Streaming conversational chat
│   │   ├── DocumentUploader.jsx # Drag-drop PDF/image upload
│   │   ├── VoiceInput.jsx       # Mic button + Web Speech API
│   │   ├── ProgressIndicator.jsx
│   │   └── InstallPrompt.jsx    # PWA install banner
│   ├── hooks/
│   │   ├── useGeminiAPI.js      # All Gemma 4 API calls + streaming
│   │   ├── useSpeechRecognition.js
│   │   ├── useTTS.js
│   │   └── useOfflineCache.js   # IndexedDB + localStorage
│   └── utils/
│       ├── prompts.js           # All Gemma 4 prompt templates
│       ├── documentParser.js    # PDF text + image extraction
│       └── validators.js        # Field validation
├── vercel.json
└── vite.config.js
```

---

## Accessibility

- All interactive elements have `aria-label`
- `aria-live` on dynamic content (questions, chat, errors)
- Keyboard navigable with visible focus rings
- Respects `prefers-reduced-motion`
- `forced-colors` (high contrast) supported
- Font sizes use `rem` — respects user browser font settings
- Voice fallback for every action

---

## Security Notes

- The Google AI key is stored **only** in Vercel environment variables
- The `/api/gemma.js` edge function proxies all requests — the key is never in the client bundle
- No user data is sent to any third party beyond the Gemini API (no analytics, no tracking)
- Documents are stored locally in IndexedDB only

---

## License

MIT
