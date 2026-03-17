require('dotenv').config()
const express = require('express')
const cors = require('cors')
const Anthropic = require('@anthropic-ai/sdk')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(cors())
app.use(express.json())

// Init clients
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

// ======================================
// ดึงข้อมูลโรงแรมจาก DB
// ======================================
async function getHotelContext(userMessage) {
  const msg = userMessage.toLowerCase()
  const context = []

  // ดึงข้อมูลห้องพัก (ถ้าถามเรื่องห้อง/ราคา)
  if (msg.match(/ห้อง|ราคา|พัก|rate|room|price|suite|deluxe|standard/)) {
    const { data: rooms } = await supabase
      .from('rooms')
      .select('*')
      .eq('available', true)
      .order('price_per_night')

    if (rooms?.length) {
      const roomText = rooms.map(r =>
        `• ${r.name} — ${r.price_per_night.toLocaleString()} บาท/คืน | ${r.capacity} คน | ${r.size_sqm} ตร.ม.\n  ${r.description}\n  สิ่งอำนวยความสะดวก: ${r.amenities.join(', ')}`
      ).join('\n\n')
      context.push(`=== ห้องพักที่มีให้บริการ ===\n${roomText}`)
    }
  }

  // ดึงบริการ (ถ้าถามเรื่องบริการ/สิ่งอำนวยความสะดวก)
  if (msg.match(/บริการ|สระ|สปา|ฟิตเนส|อาหาร|รถ|สนามบิน|service|pool|spa|gym|restaurant/)) {
    const { data: services } = await supabase
      .from('services')
      .select('*')
      .eq('available', true)

    if (services?.length) {
      const svcText = services.map(s =>
        `• ${s.name} | เวลา: ${s.hours} | ${s.price ? `ราคา: ${s.price} บาท` : 'ฟรี'}\n  ${s.description}`
      ).join('\n\n')
      context.push(`=== บริการของโรงแรม ===\n${svcText}`)
    }
  }

  // ดึง FAQ (ถ้าถามทั่วไป)
  if (msg.match(/เช็คอิน|เช็คเอาท์|ยกเลิก|จอดรถ|wifi|บัตร|สัตว์|check|cancel|pet|park/)) {
    const { data: faqs } = await supabase
      .from('faqs')
      .select('*')

    if (faqs?.length) {
      const faqText = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
      context.push(`=== FAQ & นโยบายโรงแรม ===\n${faqText}`)
    }
  }

  // ดึงโปรโมชัน (ถ้าถามเรื่องโปรหรือส่วนลด)
  if (msg.match(/โปร|ส่วนลด|ลด|discount|promotion|offer|deal/)) {
    const today = new Date().toISOString().split('T')[0]
    const { data: promos } = await supabase
      .from('promotions')
      .select('*')
      .eq('active', true)
      .lte('valid_from', today)
      .gte('valid_until', today)

    if (promos?.length) {
      const promoText = promos.map(p =>
        `• ${p.title}${p.discount_percent > 0 ? ` (ลด ${p.discount_percent}%)` : ''}\n  ${p.description}\n  เงื่อนไข: ${p.conditions}`
      ).join('\n\n')
      context.push(`=== โปรโมชันที่มีอยู่ตอนนี้ ===\n${promoText}`)
    }
  }

  // ถ้าไม่ match อะไรเลย ดึง FAQ ทั้งหมด
  if (context.length === 0) {
    const { data: faqs } = await supabase.from('faqs').select('*')
    if (faqs?.length) {
      const faqText = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
      context.push(`=== FAQ & นโยบายโรงแรม ===\n${faqText}`)
    }
  }

  return context.join('\n\n')
}

// ======================================
// API: POST /api/chat
// ======================================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body

    if (!message?.trim()) {
      return res.status(400).json({ error: 'กรุณาส่งข้อความมาด้วยครับ' })
    }

    // ดึงข้อมูลจาก DB ตามคำถาม
    const hotelContext = await getHotelContext(message)

    // System prompt
    const systemPrompt = `คุณคือ AI Assistant ของโรงแรม ชื่อ "น้อง SORA" 
คุณพูดภาษาไทยเป็นหลัก สุภาพ เป็นมิตร และช่วยเหลือลูกค้าอย่างเต็มที่
ตอบคำถามโดยอิงจากข้อมูลด้านล่างเท่านั้น หากไม่มีข้อมูลให้บอกว่าจะสอบถามพนักงานให้

${hotelContext}

แนวทางการตอบ:
- ตอบกระชับ ชัดเจน ไม่เยิ่นเย้อ
- ใช้ emoji ประกอบบ้างเล็กน้อยเพื่อความเป็นมิตร
- ถ้าลูกค้าสนใจจอง ให้แนะนำให้โทร 02-111-1111 หรือ LINE: @soraso
- ห้ามสร้างข้อมูลที่ไม่มีในฐานข้อมูล`

    // สร้าง messages array พร้อม history
    const messages = [
      ...history.slice(-10), // เก็บ history แค่ 10 ข้อความล่าสุด
      { role: 'user', content: message }
    ]

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    })

    res.json({
      reply: response.content[0].text,
      role: 'assistant'
    })

  } catch (err) {
    console.error('Chat error:', err)
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' })
  }
})

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🏨 Hotel Chatbot running on http://localhost:${PORT}`))
