export const runtime = 'nodejs'

// Semua model image yang boleh dipilih dari frontend.
const ALLOWED_IMAGE_MODELS = ['pollinations-flux', 'pollinations-turbo', 'gemini-image']

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
      return generateWithGemini(prompt, w, h)
    }
    return generateWithPollinations(prompt, selected, w, h)
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

// Gemini image generation (nano-banana / gemini-2.5-flash-image).
async function generateWithGemini(prompt, w, h) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'GEMINI_API_KEY belum di-set. Tambahkan di Vercel → Settings → Environment Variables.' },
      { status: 500 }
    )
  }

  const geminiModel = 'gemini-2.5-flash-image'
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
