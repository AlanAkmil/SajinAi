'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import InkSeal from './InkSeal'

const STORAGE_KEY = 'sajin_sessions_v2'

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

function defaultSession() {
  return {
    id: uid(),
    name: 'Percakapan baru',
    createdAt: Date.now(),
    messages: [
      {
        id: uid(),
        role: 'assistant',
        content: 'Aku Sajin. Katakan apa yang ingin kau bicarakan, kawan.',
        ts: Date.now(),
      },
    ],
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
  const [status, setStatus] = useState('idle') // idle | busy | error
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showJump, setShowJump] = useState(false)
  const [pendingImage, setPendingImage] = useState(null) // { dataUrl, mimeType, base64 }

  const abortRef = useRef(null)
  const messagesEndRef = useRef(null)
  const messagesRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1600)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    let saved = null
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    } catch {}
    if (saved && saved.sessions?.length) {
      setSessions(saved.sessions)
      setActiveId(saved.activeId ?? saved.sessions[0].id)
    } else {
      const s = defaultSession()
      setSessions([s])
      setActiveId(s.id)
    }
  }, [])

  useEffect(() => {
    if (!sessions.length) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, activeId }))
  }, [sessions, activeId])

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
  }

  async function sendMessage(overrideText, overrideImage) {
    const text = (overrideText ?? input).trim()
    const image = overrideImage !== undefined ? overrideImage : pendingImage
    if ((!text && !image) || status === 'busy' || !activeSession) return

    const userMsg = {
      id: uid(),
      role: 'user',
      content: text,
      ts: Date.now(),
      image: image ? { mimeType: image.mimeType, data: image.base64, previewUrl: image.dataUrl } : null,
    }
    const sessionId = activeSession.id

    updateSessionMessages(sessionId, (msgs) => [...msgs, userMsg])
    if (activeSession.messages.length <= 1) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, name: (text || 'Gambar').slice(0, 32) } : s
        )
      )
    }
    setInput('')
    setPendingImage(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setStatus('busy')

    const assistantId = uid()
    updateSessionMessages(sessionId, (msgs) => [
      ...msgs,
      { id: assistantId, role: 'assistant', content: '', ts: Date.now(), streaming: true },
    ])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const history = [...activeSession.messages, userMsg].map(({ role, content, image }) => ({
        role,
        content,
        image: image ? { mimeType: image.mimeType, data: image.data } : undefined,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      })

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`
        try {
          const errData = await res.json()
          if (errData?.error) errMsg = errData.error
        } catch {}
        throw new Error(errMsg)
      }

      if (res.body && res.body.getReader) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let acc = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          acc += decoder.decode(value, { stream: true })
          updateSessionMessages(sessionId, (msgs) =>
            msgs.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
          )
        }
      } else {
        const data = await res.json()
        updateSessionMessages(sessionId, (msgs) =>
          msgs.map((m) => (m.id === assistantId ? { ...m, content: data.content ?? '' } : m))
        )
      }

      updateSessionMessages(sessionId, (msgs) =>
        msgs.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: m.content || '(Sajin tidak memberikan balasan. Periksa log server.)',
                streaming: false,
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

  return (
    <div>
      {!booted && (
        <div className="boot-screen">
          <svg viewBox="0 0 220 40">
            <path d="M10 30 Q 60 5, 110 22 T 210 15" />
          </svg>
          <div className="boot-label">SAJIN</div>
        </div>
      )}

      <div className="ink-wash">
        <div className="ink-blob a" />
        <div className="ink-blob b" />
      </div>

      <div className="app-shell">
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}
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
            <div className="status-line">
              <span className={`status-dot ${status === 'busy' ? 'busy' : ''}`} />
              {status === 'busy' ? 'Sajin sedang menjawab...' : status === 'error' ? 'Terjadi kendala' : 'Siap'}
            </div>
            <div className="header-seal">
              <InkSeal active={status === 'busy'} size={32} />
            </div>
          </div>

          <div className="messages" ref={messagesRef} onScroll={handleScroll}>
            {activeSession.messages.map((m) => (
              <div key={m.id} className={`msg ${m.role}`}>
                <div className="msg-meta">
                  <span className="role-label">{m.role === 'user' ? 'Anda' : 'Sajin'}</span>
                  <span>{formatTime(m.ts)}</span>
                </div>
                <div className="msg-bubble">
                  {m.image?.previewUrl && (
                    <img className="msg-image" src={m.image.previewUrl} alt="lampiran" />
                  )}
                  <MessageContent content={m.content || (m.streaming ? '' : '')} />
                  {m.streaming && <span className="cursor-blink" />}
                </div>
                {m.role === 'assistant' && !m.streaming && m.content && (
                  <div className="msg-actions">
                    <button onClick={() => copyMsg(m.content)}>Salin</button>
                    {m === activeSession.messages[activeSession.messages.length - 1] && (
                      <button onClick={regenerate}>Ulangi</button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

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

          <div className="composer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <button className="attach-btn" onClick={() => fileInputRef.current?.click()} title="Lampirkan gambar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              placeholder="Sampaikan sesuatu kepada Sajin..."
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            {status === 'busy' ? (
              <button className="stop-btn" onClick={stopGeneration}>
                Hentikan
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={() => sendMessage()}
                disabled={!input.trim() && !pendingImage}
              >
                Kirim
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
