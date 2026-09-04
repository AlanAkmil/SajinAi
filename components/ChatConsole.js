'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const STORAGE_KEY = 'sajin_sessions_v4'

const MODELS = [
  { id: 'gemini-flash-latest', name: 'Gemini Flash', desc: 'Cepat, seimbang, gratis' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', desc: 'Lebih ringan, kuota lebih longgar' },
  { id: 'gemini-2.5-pro', name: 'Gemini Pro', desc: 'Paling pintar — butuh billing aktif' },
  { id: 'groq-gpt-oss-120b', name: 'GPT-OSS 120B', desc: 'Groq — reasoning tinggi' },
  { id: 'groq-gpt-oss-20b', name: 'GPT-OSS 20B', desc: 'Groq — paling ngebut' },
  { id: 'groq-compound', name: 'Compound', desc: 'Groq — agentic, web search + code exec bawaan' },
  { id: 'groq-compound-mini', name: 'Compound Mini', desc: 'Groq — versi ringan Compound' },
  { id: 'groq-qwen3.6-27b', name: 'Qwen3.6 27B', desc: 'Groq — reasoning & vision' },
  { id: 'groq-qwen3.8-27b', name: 'Qwen3.8 27B', desc: 'Groq — versi terbaru Qwen' },
]

// Model text Groq nggak bisa lihat gambar — cuma Gemini yang vision-capable
// sebagai model utama. Qwen3.6 juga vision-capable tapi cuma dipakai sebagai
// fallback otomatis kalau Gemini gagal/limit.
const VISION_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-pro']
const VISION_FALLBACK_MODEL = 'groq-qwen3.6-27b'

const IMAGE_MODELS = [
  { id: 'pollinations-flux', name: 'Flux', desc: 'Pollinations — gratis, no key' },
  { id: 'pollinations-turbo', name: 'Turbo', desc: 'Pollinations — lebih cepat, kualitas standar' },
  { id: 'gemini-image', name: 'Nano Banana 2', desc: 'Gemini 3.1 — kualitas terbaik, gratis' },
  { id: 'hf-flux', name: 'FLUX.1 Dev', desc: 'Hugging Face — open-weight, butuh HF_TOKEN' },
]

// Berapa lama model dianggap "kena limit" dan di-grey-out di picker sebelum dicoba lagi.
const RATE_LIMIT_COOLDOWN_MS = 60_000

const REASONING_LEVELS = [
  { id: 'standard', name: 'Standar', desc: 'Jawab cepat, mikir sebentar' },
  { id: 'high', name: 'Tinggi', desc: 'Mikir lebih dalam, lebih lambat' },
]

const SUGGESTIONS = [
  'Jelaskan cara kerja rekursi dalam pemrograman',
  'Analisis gambar yang aku lampirkan',
  'Ceritakan tentang Gotei 13',
  'Bantu aku debug kode yang error',
]

function uid() {
  return crypto.randomUUID().slice(0, 8)
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderInline(text) {
  const escaped = escapeHtml(text)
  return escaped
    .replace(/`([^`]+)`/g, '<code class="msg-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="code-block">
      <button
        className="code-copy"
        onClick={() => {
          navigator.clipboard.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        }}
      >
        {copied ? 'TERSALIN' : 'SALIN'}
      </button>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

function MessageContent({ content }) {
  const parts = content.split(/```([\s\S]*?)```/g)
  return (
    <div className="msg-content">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <CodeBlock key={i} code={part.trim()} />
        ) : (
          part
            .split('\n')
            .filter((_, idx, arr) => !(idx === arr.length - 1 && part.split('\n')[idx] === ''))
            .map((line, j) => (
              <p key={j} dangerouslySetInnerHTML={{ __html: renderInline(line) || '&nbsp;' }} />
            ))
        )
      )}
    </div>
  )
}

function ChevronIcon({ open, rotate }) {
  const deg = rotate != null ? rotate : open ? 90 : 0
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ transform: `rotate(${deg}deg)`, transition: 'transform 0.2s ease' }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function ThinkingPanel({ thinking, done, collapsed, onToggle }) {
  if (!thinking) return null
  return (
    <div className="thinking-panel">
      <button className="thinking-header" onClick={onToggle}>
        <ChevronIcon open={!collapsed} />
        <span>{done ? 'Berpikir selesai' : 'Sedang berpikir...'}</span>
        {!done && <span className="thinking-dot" />}
      </button>
      {!collapsed && <div className="thinking-body">{thinking}</div>}
    </div>
  )
}

function defaultSession() {
  return {
    id: uid(),
    name: 'Percakapan baru',
    createdAt: Date.now(),
    messages: [],
  }
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const base64 = result.split(',')[1]
      resolve({ dataUrl: result, base64 })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ChatConsole() {
  const [booted, setBooted] = useState(false)
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('idle')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showJump, setShowJump] = useState(false)
  const [pendingImage, setPendingImage] = useState(null)
  const [attachSheetOpen, setAttachSheetOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [reasoningExpanded, setReasoningExpanded] = useState(false)
  const [model, setModel] = useState('gemini-flash-latest')
  const [reasoningLevel, setReasoningLevel] = useState('standard')
  const [webSearch, setWebSearch] = useState(false)
  const [imageMode, setImageMode] = useState(false)
  const [imageModel, setImageModel] = useState('pollinations-flux')
  // { [modelId]: timestamp sampai kapan model dianggap kena limit }
  const [limitedModels, setLimitedModels] = useState({})

  const abortRef = useRef(null)
  const messagesEndRef = useRef(null)
  const messagesRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1000)
    return () => clearTimeout(t)
  }, [])

  // Re-render tiap beberapa detik biar model yang cooldown-nya udah lewat
  // otomatis balik normal (nggak abu-abu lagi) tanpa perlu refresh.
  const [, forceTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  function markModelLimited(id) {
    setLimitedModels((prev) => ({ ...prev, [id]: Date.now() + RATE_LIMIT_COOLDOWN_MS }))
  }

  function isModelLimited(id) {
    const until = limitedModels[id]
    return !!until && until > Date.now()
  }

  useEffect(() => {
    let saved = null
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    } catch {}
    if (saved && saved.sessions?.length) {
      setSessions(saved.sessions)
      setActiveId(saved.activeId ?? saved.sessions[0].id)
      if (saved.model) setModel(saved.model)
      if (saved.reasoningLevel) setReasoningLevel(saved.reasoningLevel)
    } else {
      const s = defaultSession()
      setSessions([s])
      setActiveId(s.id)
    }
  }, [])

  useEffect(() => {
    if (!sessions.length) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, activeId, model, reasoningLevel }))
  }, [sessions, activeId, model, reasoningLevel])

  const activeSession = sessions.find((s) => s.id === activeId)

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    scrollToBottom(false)
  }, [activeId])

  function updateSessionMessages(sessionId, updater) {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, messages: updater(s.messages) } : s))
    )
  }

  function newSession() {
    const s = defaultSession()
    setSessions((prev) => [s, ...prev])
    setActiveId(s.id)
    setSidebarOpen(false)
  }

  function deleteSession(id, e) {
    e.stopPropagation()
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (id === activeId && next.length) setActiveId(next[0].id)
      if (!next.length) {
        const s = defaultSession()
        setActiveId(s.id)
        return [s]
      }
      return next
    })
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    try {
      const { dataUrl, base64 } = await fileToBase64(file)
      setPendingImage({ dataUrl, mimeType: file.type, base64 })
    } catch {}
    e.target.value = ''
    setAttachSheetOpen(false)
  }

  function toggleThinking(sessionId, msgId) {
    updateSessionMessages(sessionId, (msgs) =>
      msgs.map((m) => (m.id === msgId ? { ...m, thinkingCollapsed: !m.thinkingCollapsed } : m))
    )
  }

  async function sendMessage(overrideText, overrideImage) {
    const text = (overrideText ?? input).trim()
    const image = overrideImage !== undefined ? overrideImage : pendingImage
    if ((!text && !image) || status === 'busy' || !activeSession) return

    if (imageMode) return sendImageRequest(text)

    const userMsg = {
      id: uid(),
      role: 'user',
      content: text,
      ts: Date.now(),
      image: image ? { mimeType: image.mimeType, data: image.base64, previewUrl: image.dataUrl } : null,
    }
    const sessionId = activeSession.id

    updateSessionMessages(sessionId, (msgs) => [...msgs, userMsg])
    if (activeSession.messages.length === 0) {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, name: (text || 'Gambar').slice(0, 32) } : s))
      )
    }
    setInput('')
    setPendingImage(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setStatus('busy')

    const assistantId = uid()
    updateSessionMessages(sessionId, (msgs) => [
      ...msgs,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        thinking: '',
        thinkingCollapsed: false,
        thinkingDone: false,
        ts: Date.now(),
        streaming: true,
      },
    ])

    const controller = new AbortController()
    abortRef.current = controller

    const history = [...activeSession.messages, userMsg].map(({ role, content, image }) => ({
      role,
      content,
      image: image ? { mimeType: image.mimeType, data: image.data } : undefined,
    }))

    // Satu percobaan kirim+stream ke satu model. Throw kalau gagal, biar
    // caller yang mutusin mau fallback ke model lain atau nyerah.
    async function attempt(requestModel) {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, model: requestModel, reasoningLevel, webSearch }),
        signal: controller.signal,
      })

      if (!res.ok) {
        if (res.status === 429) markModelLimited(requestModel)
        let errMsg = `HTTP ${res.status}`
        try {
          const errData = await res.json()
          if (errData?.error) errMsg = errData.error
        } catch {}
        const err = new Error(errMsg)
        err.statusCode = res.status
        throw err
      }

      if (res.body && res.body.getReader) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let accThinking = ''
        let accAnswer = ''
        let sawAnswer = false

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const evt = JSON.parse(line)
              if (evt.type === 'thought') {
                accThinking += evt.text
              } else if (evt.type === 'answer') {
                if (!sawAnswer) sawAnswer = true
                accAnswer += evt.text
              }
            } catch {}
          }
          updateSessionMessages(sessionId, (msgs) =>
            msgs.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    thinking: accThinking,
                    content: accAnswer,
                    thinkingDone: sawAnswer,
                    thinkingCollapsed: sawAnswer,
                  }
                : m
            )
          )
        }
      } else {
        const data = await res.json()
        updateSessionMessages(sessionId, (msgs) =>
          msgs.map((m) => (m.id === assistantId ? { ...m, content: data.content ?? '' } : m))
        )
      }
    }

    // Reset bubble assistant sebelum percobaan baru (dipakai juga pas fallback).
    function resetAssistantBubble(note) {
      updateSessionMessages(sessionId, (msgs) =>
        msgs.map((m) =>
          m.id === assistantId
            ? { ...m, content: note || '', thinking: '', thinkingDone: false, thinkingCollapsed: false, streaming: true }
            : m
        )
      )
    }

    try {
      try {
        await attempt(model)
      } catch (err) {
        if (err.name === 'AbortError') throw err

        // Vision Gemini gagal (limit/error) & ada gambar -> auto-fallback ke Qwen3.6.
        const canFallback = image && VISION_MODELS.includes(model) && model !== VISION_FALLBACK_MODEL
        if (!canFallback) throw err

        resetAssistantBubble('Gemini kena kendala, otomatis coba Qwen3.6 (fallback vision)...')
        await new Promise((r) => setTimeout(r, 400))
        resetAssistantBubble('')
        await attempt(VISION_FALLBACK_MODEL)
      }

      updateSessionMessages(sessionId, (msgs) =>
        msgs.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: m.content || '(Sajin tidak memberikan balasan. Periksa log server.)',
                streaming: false,
                thinkingDone: true,
                thinkingCollapsed: true,
              }
            : m
        )
      )
      setStatus('idle')
    } catch (err) {
      if (err.name === 'AbortError') {
        updateSessionMessages(sessionId, (msgs) =>
          msgs.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + '\n\n[dihentikan]', streaming: false }
              : m
          )
        )
        setStatus('idle')
      } else {
        updateSessionMessages(sessionId, (msgs) =>
          msgs.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Terjadi kendala: ${err.message}`, streaming: false }
              : m
          )
        )
        setStatus('error')
        setTimeout(() => setStatus('idle'), 2500)
      }
    } finally {
      abortRef.current = null
      scrollToBottom()
    }
  }

  async function sendImageRequest(text) {
    if (!text || status === 'busy' || !activeSession) return
    const sessionId = activeSession.id

    const userMsg = { id: uid(), role: 'user', content: text, ts: Date.now() }
    updateSessionMessages(sessionId, (msgs) => [...msgs, userMsg])
    if (activeSession.messages.length === 0) {
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, name: text.slice(0, 32) } : s)))
    }
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setStatus('busy')

    const assistantId = uid()
    updateSessionMessages(sessionId, (msgs) => [
      ...msgs,
      { id: assistantId, role: 'assistant', content: '', ts: Date.now(), streaming: true, generatingImage: true },
    ])

    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, model: imageModel }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 429) markModelLimited(imageModel)
        throw new Error(data?.error || `HTTP ${res.status}`)
      }

      updateSessionMessages(sessionId, (msgs) =>
        msgs.map((m) =>
          m.id === assistantId
            ? { ...m, content: '', generatedImage: data.imageUrl, streaming: false, generatingImage: false }
            : m
        )
      )
      setStatus('idle')
    } catch (err) {
      updateSessionMessages(sessionId, (msgs) =>
        msgs.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Gagal membuat gambar: ${err.message}`, streaming: false, generatingImage: false }
            : m
        )
      )
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2500)
    } finally {
      scrollToBottom()
    }
  }

  function stopGeneration() {
    abortRef.current?.abort()
  }

  function regenerate() {
    if (!activeSession || status === 'busy') return
    const msgs = activeSession.messages
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    updateSessionMessages(activeSession.id, (m) => {
      const idx = m.map((x) => x.id).lastIndexOf(lastUser.id)
      return m.slice(0, idx + 1)
    })
    const img = lastUser.image
      ? { mimeType: lastUser.image.mimeType, base64: lastUser.image.data, dataUrl: lastUser.image.previewUrl }
      : null
    sendMessage(lastUser.content, img)
  }

  function copyMsg(content) {
    navigator.clipboard.writeText(content)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleScroll() {
    const el = messagesRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setShowJump(!nearBottom)
  }

  if (!activeSession) return null
  const canSend = imageMode ? !!input.trim() : !!(input.trim() || pendingImage)
  const isEmpty = activeSession.messages.length === 0
  const currentModel = MODELS.find((m) => m.id === model) || MODELS[0]
  const currentImageModel = IMAGE_MODELS.find((m) => m.id === imageModel) || IMAGE_MODELS[0]
  const headerModelName = imageMode ? currentImageModel.name : currentModel.name

  return (
    <div>
      {!booted && (
        <div className="boot-screen">
          <div className="boot-orb" />
        </div>
      )}

      <div className="ink-wash">
        <div className="ink-blob a" />
        <div className="ink-blob b" />
      </div>

      <div className="app-shell">
        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <div className="brand-mark">
              <span className="brand-seal">7</span>
              <span className="brand-name">Sajin</span>
            </div>
            <div className="brand-sub">Riwayat Percakapan</div>
          </div>
          <button className="new-session-btn" onClick={newSession}>
            + PERCAKAPAN BARU
          </button>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`session-item ${s.id === activeId ? 'active' : ''}`}
                onClick={() => {
                  setActiveId(s.id)
                  setSidebarOpen(false)
                }}
              >
                <span className="session-name">{s.name}</span>
                <button className="session-del" onClick={(e) => deleteSession(s.id, e)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="console">
          <div className="console-header">
            <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
            <button className="header-picker-trigger" onClick={() => setPickerOpen((v) => !v)}>
              <div className="avatar-orb" />
              <div className="header-text">
                <div className="header-name">
                  Sajin <ChevronIcon open={pickerOpen} />
                </div>
                <div className="status-line">
                  <span className={`status-dot ${status === 'busy' ? 'busy' : ''}`} />
                  {status === 'busy' ? 'sedang menjawab...' : headerModelName}
                </div>
              </div>
            </button>
          </div>

          {pickerOpen && (
            <>
              <div
                className="sheet-backdrop"
                onClick={() => {
                  setPickerOpen(false)
                  setReasoningExpanded(false)
                }}
              />
              <div className="model-picker">
                <div className="picker-mode-switch">
                  <button
                    className={`picker-mode-btn ${!imageMode ? 'active' : ''}`}
                    onClick={() => setImageMode(false)}
                  >
                    Chat
                  </button>
                  <button
                    className={`picker-mode-btn ${imageMode ? 'active' : ''}`}
                    onClick={() => setImageMode(true)}
                  >
                    Buat Gambar
                  </button>
                </div>

                <div className="picker-section-label">{imageMode ? 'Model Gambar' : 'Model'}</div>
                {(imageMode ? IMAGE_MODELS : MODELS).map((m) => {
                  const limited = isModelLimited(m.id)
                  const selectedId = imageMode ? imageModel : model
                  return (
                    <button
                      key={m.id}
                      className={`picker-item ${selectedId === m.id ? 'active' : ''} ${limited ? 'disabled' : ''}`}
                      disabled={limited}
                      onClick={() => {
                        if (limited) return
                        if (imageMode) setImageModel(m.id)
                        else setModel(m.id)
                        setPickerOpen(false)
                      }}
                    >
                      <div>
                        <div className="picker-item-name">{m.name}</div>
                        <div className="picker-item-desc">{limited ? 'Kena limit — coba lagi sebentar' : m.desc}</div>
                      </div>
                      {!limited && selectedId === m.id && <span className="picker-check">✓</span>}
                    </button>
                  )
                })}
                {!imageMode && (
                  <>
                    <div className="picker-divider" />
                    {!reasoningExpanded ? (
                      <button className="picker-item" onClick={() => setReasoningExpanded(true)}>
                        <div>
                          <div className="picker-item-name">Tingkat Penalaran</div>
                          <div className="picker-item-desc">
                            {REASONING_LEVELS.find((r) => r.id === reasoningLevel)?.name}
                          </div>
                        </div>
                        <ChevronIcon open={false} />
                      </button>
                    ) : (
                      <>
                        <button className="picker-item picker-back" onClick={() => setReasoningExpanded(false)}>
                          <ChevronIcon rotate={180} />
                          <div className="picker-item-name">Tingkat Penalaran</div>
                        </button>
                        {REASONING_LEVELS.map((r) => (
                          <button
                            key={r.id}
                            className={`picker-item ${reasoningLevel === r.id ? 'active' : ''}`}
                            onClick={() => {
                              setReasoningLevel(r.id)
                              setReasoningExpanded(false)
                            }}
                          >
                            <div>
                              <div className="picker-item-name">{r.name}</div>
                              <div className="picker-item-desc">{r.desc}</div>
                            </div>
                            {reasoningLevel === r.id && <span className="picker-check">✓</span>}
                          </button>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {isEmpty ? (
            <div className="welcome-screen">
              <div className="welcome-orb" />
              <div className="welcome-text">Apa yang ingin kau bicarakan, kawan?</div>
              <div className="suggestion-grid">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="suggestion-chip" onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages" ref={messagesRef} onScroll={handleScroll}>
              {activeSession.messages.map((m) => (
                <div key={m.id} className={`msg ${m.role}`}>
                  {m.role === 'user' ? (
                    <div className="msg-bubble user-bubble">
                      {m.image?.previewUrl && <img className="msg-image" src={m.image.previewUrl} alt="lampiran" />}
                      <MessageContent content={m.content} />
                    </div>
                  ) : (
                    <div className="assistant-block">
                      <ThinkingPanel
                        thinking={m.thinking}
                        done={m.thinkingDone}
                        collapsed={m.thinkingCollapsed}
                        onToggle={() => toggleThinking(activeSession.id, m.id)}
                      />
                      {m.generatingImage && (
                        <div className="assistant-content image-generating">
                          <span className="typing-dots">
                            <span />
                            <span />
                            <span />
                          </span>
                          <span>membuat gambar...</span>
                        </div>
                      )}
                      {m.generatedImage && (
                        <div className="assistant-content">
                          <img className="generated-image" src={m.generatedImage} alt={m.content || 'gambar hasil generate'} />
                        </div>
                      )}
                      {!m.generatingImage && (m.content || m.streaming) && (
                        <div className="assistant-content">
                          <MessageContent content={m.content} />
                          {m.streaming && !m.content && (
                            <span className="typing-dots">
                              <span />
                              <span />
                              <span />
                            </span>
                          )}
                          {m.streaming && m.content && <span className="cursor-blink" />}
                        </div>
                      )}
                      {!m.streaming && m.content && (
                        <div className="msg-actions">
                          <button className="icon-btn" onClick={() => copyMsg(m.content)} title="Salin">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                          </button>
                          {m === activeSession.messages[activeSession.messages.length - 1] && (
                            <button className="icon-btn" onClick={regenerate} title="Ulangi">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 4v6h-6M1 20v-6h6" />
                                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {showJump && (
            <button className="jump-latest" onClick={() => scrollToBottom()}>
              ↓ pesan terbaru
            </button>
          )}

          {pendingImage && (
            <div className="image-preview-bar">
              <div className="image-preview-item">
                <img src={pendingImage.dataUrl} alt="preview" />
                <button className="image-preview-remove" onClick={() => setPendingImage(null)}>
                  ✕
                </button>
              </div>
            </div>
          )}

          {webSearch && (
            <div className="active-tools-bar">
              <span className="tool-pill">
                🔎 Pencarian web aktif
                <button onClick={() => setWebSearch(false)}>✕</button>
              </span>
            </div>
          )}

          <div className="composer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <button
              className="attach-btn"
              onClick={() => setAttachSheetOpen(true)}
              title={!imageMode && !VISION_MODELS.includes(model) ? 'Model ini tidak mendukung gambar' : 'Lampirkan'}
              disabled={imageMode || !VISION_MODELS.includes(model)}
              style={imageMode || !VISION_MODELS.includes(model) ? { opacity: 0.35, pointerEvents: 'none' } : undefined}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              placeholder={imageMode ? 'Deskripsikan gambar yang ingin dibuat...' : 'Sampaikan sesuatu kepada Sajin...'}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            {status === 'busy' ? (
              <button className="round-btn stop-round" onClick={stopGeneration} title="Hentikan">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                className={`round-btn send-round ${canSend ? 'ready' : ''}`}
                onClick={() => sendMessage()}
                disabled={!canSend}
                title="Kirim"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {attachSheetOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setAttachSheetOpen(false)} />
          <div className="attach-sheet">
            <div className="sheet-handle" />
            <div className="sheet-grid">
              <button className="sheet-item" onClick={() => cameraInputRef.current?.click()}>
                <div className="sheet-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <span>Kamera</span>
              </button>
              <button className="sheet-item" onClick={() => fileInputRef.current?.click()}>
                <div className="sheet-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <span>Foto</span>
              </button>
            </div>
            <div className="sheet-divider" />
            <button
              className="sheet-row"
              onClick={() => {
                setWebSearch((v) => !v)
                setAttachSheetOpen(false)
              }}
            >
              <div className="sheet-row-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z" />
                </svg>
              </div>
              <div className="sheet-row-text">
                <div>Pencarian web</div>
                <div className="sheet-row-sub">{webSearch ? 'Aktif' : 'Nonaktif'}</div>
              </div>
              <div className={`sheet-switch ${webSearch ? 'on' : ''}`}>
                <div className="sheet-switch-knob" />
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
