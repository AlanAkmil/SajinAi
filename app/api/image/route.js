export const runtime = 'nodejs'

// Semua model image yang boleh dipilih dari frontend.
const ALLOWED_IMAGE_MODELS = ['pollinations-flux', 'pollinations-turbo', 'gemini-image', 'hf-flux']

export async function POST(req) {
  try {
    const { prompt, model, width, height } = await req.json()

    if (!prompt || !prompt.trim()) {
      return Response.json({ error: 'Prompt tidak boleh kosong.' }, { status: 400 })
    }

    const selected = ALLOWED_IMAGE_MODELS.includes(model) ? model : 'pollinations-flux'
    const w = Math.min(Math.max(parseInt(width) || 1024, 256), 1536)
    const h = Math.min(Math.max(parseInt(height) || 1024, 256), 1536)

    if (selected === 'gemini-image') {
      return await generateWithGemini(prompt, w, h)
    }
    if (selected === 'hf-flux') {
      return await generateWithHuggingFace(prompt)
    }
    return await generateWithPollinations(prompt, selected, w, h)
  } catch (error) {
    console.error('Image route error:', error?.message)
    return Response.json({ error: error?.message || 'Terjadi kesalahan pada server.' }, { status: 500 })
  }
}

// Pollinations: API gambar gratis, tanpa API key, tanpa captcha/bypass.
// Endpoint-nya GET, tapi kita proxy lewat server biar frontend tetap satu pola fetch.
async function generateWithPollinations(prompt, selected, w, h) {
  const pollModel = selected === 'pollinations-turbo' ? 'turbo' : 'flux'
  const seed = Math.floor(Math.random() * 1_000_000_000)
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${pollModel}&width=${w}&height=${h}&nologo=true&seed=${seed}`

  const res = await fetch(url)

  if (res.status === 429) {
    return Response.json({ error: 'Pollinations lagi kena limit. Coba model lain sebentar.' }, { status: 429 })
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    return Response.json({ error: `Pollinations error [${res.status}]: ${errText}` }, { status: res.status })
  }

  const buf = await res.arrayBuffer()
  const base64 = Buffer.from(buf).toString('base64')
  const mime = res.headers.get('content-type') || 'image/jpeg'

  return Response.json({ imageUrl: `data:${mime};base64,${base64}`, model: selected })
}

// Gemini image generation (Nano Banana 2 — gemini-3.1-flash-image).
// Model lama gemini-2.5-flash-image udah ditinggalkan Google per migrasi Imagen -> Gemini 3.x Image.
async function generateWithGemini(prompt, w, h) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'GEMINI_API_KEY belum di-set. Tambahkan di Vercel → Settings → Environment Variables.' },
      { status: 500 }
    )
  }

  const geminiModel = 'gemini-3.1-flash-image'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  })

  if (res.status === 429) {
    return Response.json({ error: 'Gemini lagi kena limit. Coba model lain sebentar.' }, { status: 429 })
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    return Response.json({ error: `Gemini error [${res.status}]: ${errText}` }, { status: res.status })
  }

  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find((p) => p.inlineData?.data)

  if (!imagePart) {
    return Response.json({ error: 'Gemini tidak mengembalikan gambar. Coba ubah prompt.' }, { status: 502 })
  }

  const mime = imagePart.inlineData.mimeType || 'image/png'
  return Response.json({ imageUrl: `data:${mime};base64,${imagePart.inlineData.data}`, model: 'gemini-image' })
}

// Hugging Face Inference Providers — FLUX.1-schnell (Black Forest Labs).
// Dipilih FLUX.1-schnell (bukan FLUX.1-dev) karena schnell yang beneran dihost
// gratis lewat provider hf-inference bawaan; FLUX.1-dev cuma tersedia lewat
// provider fal (berbayar/butuh billing terpisah).
async function generateWithHuggingFace(prompt) {
  const hfToken = process.env.HF_TOKEN
  if (!hfToken) {
    return Response.json(
      { error: 'HF_TOKEN belum di-set. Buat token gratis di huggingface.co/settings/tokens lalu tambahkan di Vercel → Settings → Environment Variables.' },
      { status: 500 }
    )
  }

  const res = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: prompt }),
  })

  if (res.status === 429) {
    return Response.json({ error: 'Hugging Face lagi kena limit. Coba model lain sebentar.' }, { status: 429 })
  }
  if (res.status === 503) {
    // Model lagi "cold start" / loading di server HF — bukan error permanen.
    return Response.json({ error: 'Model FLUX di Hugging Face lagi loading, coba lagi ~20 detik.' }, { status: 503 })
  }
  if (res.status === 403) {
    return Response.json(
      {
        error:
          'Akses ditolak (403). Buka huggingface.co/black-forest-labs/FLUX.1-schnell, pastiin login pakai akun yang sama dengan token, baru coba lagi.',
      },
      { status: 403 }
    )
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    return Response.json({ error: `Hugging Face error [${res.status}]: ${errText}` }, { status: res.status })
  }

  const buf = await res.arrayBuffer()
  const base64 = Buffer.from(buf).toString('base64')
  const mime = res.headers.get('content-type') || 'image/jpeg'

  return Response.json({ imageUrl: `data:${mime};base64,${base64}`, model: 'hf-flux' })
}
