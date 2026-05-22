// App.jsx
import { useState } from 'react'
import { FormFiller } from './components/FormFiller'
import { TCCompare } from './components/TCCompare'
import { ChatWindow } from './components/ChatWindow'
import { InstallPrompt } from './components/InstallPrompt'

const TABS = [
  { id: 'form', label: 'Fill Form', icon: '📝', shortLabel: 'Form' },
  { id: 'compare', label: 'Compare Docs', icon: '⚖️', shortLabel: 'Compare' },
  { id: 'chat', label: 'Ask Questions', icon: '💬', shortLabel: 'Chat' }
]

function Header() {
  return (
    <header className="px-4 pt-safe pt-4 pb-2 flex items-center gap-3">
      <div className="w-8 h-8 bg-amber rounded-lg flex items-center justify-center flex-shrink-0">
        <span className="text-ink text-sm font-display font-black">CF</span>
      </div>
      <div>
        <h1 className="font-display font-black text-paper text-lg leading-tight">ClearForm</h1>
        <p className="text-white/30 text-xs leading-tight">Powered by Gemma 4</p>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse-slow" aria-hidden="true"/>
        <span className="text-teal text-xs font-mono">gemma-4-26b</span>
      </div>
    </header>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('form')

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto relative">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-amber/5 rounded-full blur-3xl"/>
        <div className="absolute top-1/2 -left-32 w-80 h-80 bg-teal/5 rounded-full blur-3xl"/>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-amber/3 rounded-full blur-3xl"/>
      </div>

      <Header />

      {/* Main content */}
      <main className="flex-1 px-4 py-4 overflow-y-auto pb-24" id="main-content" tabIndex="-1">
        <div className={activeTab === 'form' ? 'block' : 'hidden'} role="tabpanel" id="panel-form" aria-labelledby="tab-form">
          <FormFiller />
        </div>
        <div className={activeTab === 'compare' ? 'block' : 'hidden'} role="tabpanel" id="panel-compare" aria-labelledby="tab-compare">
          <TCCompare />
        </div>
        <div className={activeTab === 'chat' ? 'block' : 'hidden'} role="tabpanel" id="panel-chat" aria-labelledby="tab-chat">
          <ChatWindow />
        </div>
      </main>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-ink/95 backdrop-blur-xl border-t border-white/10 pb-safe px-2 pt-2"
        aria-label="Main navigation"
      >
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all duration-200
                focus-visible:ring-2 focus-visible:ring-amber/50 focus-visible:outline-none
                ${activeTab === tab.id
                  ? 'text-amber bg-amber/10'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'}
              `}
            >
              <span className="text-xl" aria-hidden="true">{tab.icon}</span>
              <span className="text-xs font-body font-medium">{tab.shortLabel}</span>
            </button>
          ))}
        </div>
      </nav>

      <InstallPrompt />
    </div>
  )
}
