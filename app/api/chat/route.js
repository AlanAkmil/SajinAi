export const runtime = 'nodejs'

export async function POST(req) {
  const { messages } = await req.json()

  // ============================================
  // TODO(Abras): GANTI BAGIAN INI DENGAN SCRAPE LU
  // ============================================
  // Frontend nerima dua jenis response:
  //
  // 1) STREAMING (disarankan) — balikin ReadableStream isinya
  //    potongan teks biasa (bukan JSON per-chunk), contoh liat
  //    di bawah. Frontend bakal append tiap chunk secara live.
  //
  // 2) NON-STREAMING — balikin Response.json({ content: "..." })
  //    kalau scrape lu ga support stream, frontend otomatis fallback.
  //
  // `messages` di sini isinya array riwayat chat: [{ role, content }]
  // role: 'user' | 'assistant'
  // ============================================

  const lastMessage = messages?.[messages.length - 1]?.content ?? ''
  const dummyReply = `[DUMMY] Sajin belum konek ke scrape asli. Lu ngirim: "${lastMessage}". Sambungin scrape AI lu di app/api/chat/route.js, cuy.`

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (const word of dummyReply.split(' ')) {
        controller.enqueue(encoder.encode(word + ' '))
        await new Promise((r) => setTimeout(r, 45))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
