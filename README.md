# UPLINK — AI Console

Tema operator sinyal/jaringan. Next.js 14 App Router.

## Cara pakai
1. Upload semua folder/file ini ke repo GitHub lu (struktur harus tetap sama).
2. Deploy ke Vercel seperti biasa (import repo, default settings Next.js udah cukup).
3. Buka `app/api/chat/route.js` — di situ tempat lu tempel scrape AI model lu.
   - Kalau scrape lu bisa streaming: balikin `ReadableStream` isi teks biasa (lihat contoh dummy yang sudah ada).
   - Kalau ga streaming: balikin `Response.json({ content: "..." })`, frontend otomatis fallback.
4. Format riwayat chat yang dikirim ke endpoint: `{ messages: [{ role: 'user' | 'assistant', content: '...' }] }`.

## Fitur
- Multi-session chat (tersimpan di localStorage browser)
- Streaming response + tombol Stop
- Regenerate response terakhir
- Copy pesan & copy code block
- Markdown-lite: **bold**, *italic*, `code`, ```code block```, [link](url)
- Toggle channel warna (amber / cyan)
- Waveform hidup sebagai indikator AI lagi "ngomong"
- Sidebar sesi, responsive buat mobile

## Struktur
```
app/
  layout.js
  page.js
  globals.css
  api/chat/route.js   <- tempel scrape AI di sini
components/
  ChatConsole.js       <- logic utama UI
  Waveform.js           <- animasi oscilloscope
```
