# Sajin

AI console bertema tinta & segel, persona Sajin Komamura (Bleach), pakai Gemini API resmi.

## Setup
1. Upload semua file ke repo GitHub (struktur folder harus tetap sama).
2. Deploy ke Vercel.
3. Di Vercel: Settings → Environment Variables → tambahkan:
   - `GEMINI_API_KEY` = API key dari https://aistudio.google.com/apikey
4. Redeploy setelah menambahkan env var.

## Fitur
- Persona Sajin Komamura (system prompt di `app/api/chat/route.js`)
- Panel "Sedang berpikir..." / "Berpikir selesai" — asli dari Gemini thinking mode, bukan animasi bohongan
- Vision — bisa lampirkan gambar lewat tombol + di composer
- Streaming response + tombol Hentikan
- Ulangi (regenerate) jawaban terakhir
- Salin pesan & salin code block
- Markdown-lite: **bold**, *italic*, `code`, ```code block```, [link](url)
- Multi-percakapan tersimpan di localStorage browser
- Tombol kirim yang animasi morph pas mulai ngetik

## Struktur
```
app/
  layout.js
  page.js
  globals.css
  api/chat/route.js     <- persona + panggilan Gemini API (streaming + thinking)
components/
  ChatConsole.js          <- semua logic + UI chat
```

## Ganti persona
Edit isi `SYSTEM_PROMPT` di `app/api/chat/route.js`.

## Ganti model
Endpoint di `route.js` pakai `gemini-flash-latest`. Bisa diganti ke versi spesifik seperti `gemini-2.5-flash` kalau butuh behavior yang lebih stabil/tidak berubah otomatis.
