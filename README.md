# Sajin

AI console bertema tinta & segel, persona Sajin Komamura (Bleach), pakai Gemini API resmi.

## Setup
1. Upload semua file ke repo GitHub (struktur folder harus tetap sama).
2. Deploy ke Vercel.
3. Di Vercel: Settings → Environment Variables → tambahkan:
   - `GEMINI_API_KEY` = API key dari https://aistudio.google.com/apikey
   - `GROQ_API_KEY` = API key dari https://console.groq.com/keys (buat model-model Groq, free tier)
4. Redeploy setelah menambahkan env var.

## Fitur
- Persona Sajin Komamura (system prompt di `app/api/chat/route.js`, dipakai konsisten di semua model termasuk Groq)
- Panel "Sedang berpikir..." / "Berpikir selesai" — asli dari Gemini thinking mode, bukan animasi bohongan
- Vision — bisa lampirkan gambar lewat tombol + di composer (khusus model Gemini)
- Multi-model chat: Gemini Flash/Flash Lite/Pro + Groq (GPT-OSS 120B, GPT-OSS 20B, Compound, Compound Mini, Qwen3.6 27B, Qwen3.8 27B)
- Mode "Buat Gambar" — text-to-image lewat Pollinations (gratis, tanpa API key), Gemini Nano Banana 2, atau Hugging Face SD3 Medium
- Model yang kena rate limit otomatis abu-abu/nonaktif di picker selama ~60 detik
- Streaming response + tombol Hentikan
- Ulangi (regenerate) jawaban terakhir
- Salin pesan & salin code block
- Markdown-lite: **bold**, *italic*, `code`, ```code block```, [link](url)
- Multi-percakapan tersimpan di localStorage browser
- Tombol kirim yang animasi morph pas mulai ngetik

## Env var
- `GEMINI_API_KEY` — wajib untuk model Gemini & mode gambar Nano Banana 2
- `GROQ_API_KEY` — wajib kalau mau pakai model-model Groq (opsional kalau cuma mau Gemini)
- `HF_TOKEN` — wajib kalau mau pakai SD3 Medium di mode gambar (buat gratis di huggingface.co/settings/tokens, pilih token tipe "Read")

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
