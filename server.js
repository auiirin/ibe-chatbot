require('dotenv').config()
const express = require('express')
const cors = require('cors')
const Anthropic = require('@anthropic-ai/sdk')

const app = express()
app.use(cors())
app.use(express.json())

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ======================================
// Hotel Info — ใส่ข้อมูลโรงแรมตรงนี้เลย
// ======================================
const HOTEL_INFO = `
=== นโยบายและข้อมูลโรงแรม ===
• เช็คอิน: 14:00 น. | เช็คเอาท์: 12:00 น.
• Late check-out มีค่าบริการเพิ่มเติม
• ยกเลิกฟรีก่อนเข้าพัก 3 วัน / น้อยกว่า 3 วันหักค่าธรรมเนียม 1 คืน
• รับบัตรเครดิต Visa, Mastercard, JCB และ QR Code
• WiFi ฟรีทุกพื้นที่ ความเร็ว 100 Mbps
• ที่จอดรถฟรีสำหรับผู้เข้าพัก
• ไม่อนุญาตให้นำสัตว์เลี้ยงเข้าพัก
• Extra Bed 500 บาท/คืน รวมอาหารเช้า 1 ท่าน

=== บริการในโรงแรม ===
• อาหารเช้าบุฟเฟต์ — 06:30-10:30 น. — 350 บาท/ท่าน
• ร้านอาหาร The Garden — 11:00-22:00 น.
• สระว่ายน้ำ — 06:00-21:00 น. — ฟรี
• ฟิตเนส — 06:00-22:00 น. — ฟรี
• สปา & นวด — 10:00-21:00 น. — เริ่มต้น 600 บาท
• รับส่งสนามบิน — 24 ชั่วโมง — 500 บาท/เที่ยว

=== โปรโมชันปัจจุบัน ===
• พักวันจันทร์-พฤหัส ลด 20% (จองล่วงหน้า 2 วัน)
• จองล่วงหน้า 30 วัน ลด 25% (ชำระเต็มจำนวน ยกเลิกไม่ได้)
• พัก 3 คืนขึ้นไป ฟรีอาหารเช้า 2 ท่านทุกวัน (Deluxe ขึ้นไป)

=== ติดต่อ ===
• โทร: 053-000-000
• LINE: @soraso-hotel
• จองออนไลน์: soraso-ibe-qa.vercel.app
`

// ======================================
// Soraso IBE API
// ======================================
async function fetchIBERate({ checkIn, checkOut, adults = 2, children = 0 }) {
  try {
    const res = await fetch(`${process.env.SORASO_IBE_URL}/en/api/v1/Search/Availability`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'hotelcode': process.env.SORASO_HOTEL_CODE
      },
      body: JSON.stringify({
        Room: 1,
        Arrival: checkIn,
        Departure: checkOut,
        Adult: adults,
        Child: children,
        Infant: 0
      }),
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) { console.error(`IBE API error: ${res.status}`); return null }
    return await res.json()
  } catch (err) {
    console.error('IBE fetch error:', err.message)
    return null
  }
}

function formatIBERate(data, checkIn, checkOut) {
  if (!data) return null
  try {
    const rooms = Array.isArray(data) ? data : data.RoomTypes || data.rooms || data.results || data.data || []
    if (!rooms.length) return `No rooms available for ${checkIn} - ${checkOut}`
    const lines = rooms.map(r => {
      const name = r.RoomTypeName || r.RoomName || r.name || 'Room'
      const rate = r.Rate || r.TotalRate || r.ratePerNight || r.price || '-'
      const currency = r.Currency || r.currency || 'THB'
      const formatted = typeof rate === 'number' ? rate.toLocaleString() : rate
      return `• ${name} — ${formatted} ${currency}/night`
    }).join('\n')
    return `=== Current Room Rates (Live from Soraso IBE) ===\nCheck-in: ${checkIn} | Check-out: ${checkOut}\n\n${lines}`
  } catch (err) {
    console.error('IBE format error:', err.message)
    return null
  }
}

function extractDates(msg) {
  const today = new Date()
  const fmt = d => d.toISOString().split('T')[0]
  const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
  if (msg.match(/วันนี้|tonight|today/i)) return { checkIn: fmt(today), checkOut: fmt(add(today, 1)) }
  if (msg.match(/พรุ่งนี้|tomorrow/i)) return { checkIn: fmt(add(today, 1)), checkOut: fmt(add(today, 2)) }
  if (msg.match(/สุดสัปดาห์|weekend/i)) { const sat = add(today, 6 - today.getDay()); return { checkIn: fmt(sat), checkOut: fmt(add(sat, 1)) } }
  const months = { มกราคม:1,กุมภาพันธ์:2,มีนาคม:3,เมษายน:4,พฤษภาคม:5,มิถุนายน:6,กรกฎาคม:7,สิงหาคม:8,กันยายน:9,ตุลาคม:10,พฤศจิกายน:11,ธันวาคม:12 }
  const match = msg.match(/(\d{1,2})\s*(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)/)
  if (match) { const ci = new Date(today.getFullYear(), months[match[2]] - 1, parseInt(match[1])); return { checkIn: fmt(ci), checkOut: fmt(add(ci, 1)) } }
  return { checkIn: fmt(today), checkOut: fmt(add(today, 1)) }
}

// ======================================
// POST /api/chat
// ======================================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], language = 'en' } = req.body
    if (!message?.trim()) return res.status(400).json({ error: 'Please provide a message' })

    let ibeContext = ''
    if (message.match(/ราคา|ห้อง|rate|room|price|available|จอง|book|วันนี้|พรุ่งนี้|today|tomorrow|weekend|สุดสัปดาห์/i)) {
      const dates = extractDates(message)
      const ibeData = await fetchIBERate(dates)
      const ibeText = formatIBERate(ibeData, dates.checkIn, dates.checkOut)
      if (ibeText) ibeContext = ibeText
    }

    const system = `You are BOSO, the AI concierge for Soraso Hotel.
Reply in ${language === 'th' ? 'Thai' : 'English'}, friendly, concise, and professional.
Use ONLY the information below. If unsure, offer to connect with staff.

${ibeContext}

${HOTEL_INFO}

Guidelines:
- Keep answers short and clear
- If rates are from IBE, mention "current rate"
- For bookings: soraso-ibe-qa.vercel.app or call 053-000-000
- Never make up information not listed above
- Use minimal emoji`

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system,
      messages: [...history.slice(-8), { role: 'user', content: message }]
    })

    res.json({ reply: response.content[0].text, role: 'assistant' })
  } catch (err) {
    console.error('Chat error:', err.message)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})

app.get('/api/health', (_, res) => res.json({ status: 'ok', bot: 'BOSO', version: '2.0.0' }))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🤖 BOSO Chatbot v2.0 running on http://localhost:${PORT}`))
