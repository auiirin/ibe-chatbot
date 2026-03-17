-- ======================================
-- HOTEL CHATBOT — Supabase Schema
-- รันใน Supabase SQL Editor
-- ======================================

-- ประเภทห้องพัก
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,           -- เช่น "Deluxe Room", "Suite"
  type VARCHAR(50),                     -- standard, deluxe, suite
  price_per_night DECIMAL(10,2),        -- ราคาต่อคืน (บาท)
  capacity INT,                         -- จำนวนคนสูงสุด
  size_sqm INT,                         -- ขนาด ตร.ม.
  description TEXT,
  amenities TEXT[],                     -- ['WiFi', 'Air-con', 'Minibar']
  available BOOLEAN DEFAULT true
);

-- บริการของโรงแรม
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,           -- เช่น "สระว่ายน้ำ", "สปา"
  category VARCHAR(50),                 -- dining, wellness, facility
  description TEXT,
  price DECIMAL(10,2),                  -- null = ฟรี
  hours VARCHAR(100),                   -- "06:00 - 22:00"
  available BOOLEAN DEFAULT true
);

-- FAQ / นโยบายโรงแรม
CREATE TABLE faqs (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(50)                  -- checkin, payment, policy, etc.
);

-- โปรโมชัน
CREATE TABLE promotions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200),
  description TEXT,
  discount_percent INT,
  valid_from DATE,
  valid_until DATE,
  conditions TEXT,
  active BOOLEAN DEFAULT true
);

-- ======================================
-- ใส่ข้อมูลตัวอย่าง
-- ======================================

INSERT INTO rooms (name, type, price_per_night, capacity, size_sqm, description, amenities) VALUES
('Standard Room', 'standard', 1800, 2, 28, 'ห้องพักมาตรฐาน วิวสวน พร้อมเครื่องอำนวยความสะดวกครบครัน', ARRAY['WiFi', 'Air-con', 'TV', 'Hot shower']),
('Deluxe Room', 'deluxe', 2800, 2, 36, 'ห้องพักดีลักซ์ วิวสระว่ายน้ำ ตกแต่งสไตล์ล้านนาประยุกต์', ARRAY['WiFi', 'Air-con', 'TV', 'Minibar', 'Bathtub', 'Pool view']),
('Superior Room', 'superior', 2200, 2, 32, 'ห้องพักซูพีเรียร์ วิวภูเขา บรรยากาศสงบ', ARRAY['WiFi', 'Air-con', 'TV', 'Balcony', 'Mountain view']),
('Family Suite', 'suite', 4500, 4, 55, 'สวีทครอบครัว 2 ห้องนอน เหมาะสำหรับครอบครัว', ARRAY['WiFi', 'Air-con', 'TV', 'Minibar', 'Bathtub', 'Living room', 'Kitchen']),
('Honeymoon Suite', 'suite', 5500, 2, 60, 'สวีทฮันนีมูน วิว 180° บรรยากาศโรแมนติก พร้อมอ่างน้ำวน', ARRAY['WiFi', 'Air-con', 'TV', 'Minibar', 'Jacuzzi', 'Private balcony', 'City view']);

INSERT INTO services (name, category, description, price, hours) VALUES
('อาหารเช้า (Breakfast)', 'dining', 'บุฟเฟต์อาหารเช้า นานาชาติและไทย', 350, '06:30 - 10:30'),
('ร้านอาหาร The Garden', 'dining', 'อาหารไทยและนานาชาติ บรรยากาศสวน', NULL, '11:00 - 22:00'),
('สระว่ายน้ำ', 'facility', 'สระว่ายน้ำกลางแจ้ง ขนาด 15x6 เมตร', NULL, '06:00 - 21:00'),
('ฟิตเนส', 'wellness', 'ห้องออกกำลังกายพร้อมอุปกรณ์ครบครัน', NULL, '06:00 - 22:00'),
('สปา & นวด', 'wellness', 'บริการนวดไทย อโรมาเธอราพี และทรีตเมนต์', 600, '10:00 - 21:00'),
('บริการรับส่งสนามบิน', 'transport', 'รับส่งสนามบินเชียงใหม่ (ทั้งสองทาง)', 500, '24 ชั่วโมง'),
('ที่จอดรถ', 'facility', 'ที่จอดรถฟรีสำหรับผู้เข้าพัก', NULL, '24 ชั่วโมง');

INSERT INTO faqs (question, answer, category) VALUES
('เช็คอิน เช็คเอาท์ กี่โมง?', 'เช็คอิน 14:00 น. เป็นต้นไป / เช็คเอาท์ก่อน 12:00 น. หากต้องการ Late Check-out สามารถแจ้งได้ที่เคาน์เตอร์ มีค่าบริการเพิ่มเติม', 'checkin'),
('รับสัตว์เลี้ยงได้ไหม?', 'ขออภัยครับ ทางโรงแรมไม่อนุญาตให้นำสัตว์เลี้ยงเข้าพัก', 'policy'),
('มีที่จอดรถไหม?', 'มีที่จอดรถฟรีสำหรับผู้เข้าพักทุกท่าน รองรับได้ประมาณ 50 คัน', 'facility'),
('WiFi ฟรีไหม?', 'WiFi ฟรีทุกห้องและทุกพื้นที่สาธารณะ ความเร็วสูงสุด 100 Mbps', 'facility'),
('ยกเลิกการจองได้ไหม?', 'ยกเลิกฟรีก่อนวันเข้าพัก 3 วัน หากยกเลิกน้อยกว่า 3 วัน หักค่าธรรมเนียม 1 คืน', 'payment'),
('รับบัตรเครดิตไหม?', 'รับบัตรเครดิตทุกประเภท Visa, Mastercard, JCB รวมถึงโอนเงินและ QR Code', 'payment'),
('มี Extra Bed ไหม?', 'มีครับ ค่าบริการ Extra Bed คืนละ 500 บาท รวมอาหารเช้า 1 ท่าน', 'checkin');

INSERT INTO promotions (title, description, discount_percent, valid_from, valid_until, conditions) VALUES
('โปรฯ ต้นสัปดาห์', 'จองพักวันจันทร์-พฤหัส ลด 20%', 20, '2026-01-01', '2026-12-31', 'จองล่วงหน้าอย่างน้อย 2 วัน ไม่รวมวันหยุดนักขัตฤกษ์'),
('โปรฯ จองล่วงหน้า 30 วัน', 'จองล่วงหน้า 30 วันขึ้นไป ลด 25%', 25, '2026-01-01', '2026-12-31', 'ชำระเต็มจำนวน ไม่สามารถยกเลิกได้'),
('โปรฯ พักยาว 3 คืน', 'พัก 3 คืนขึ้นไป ฟรีอาหารเช้า 2 ท่านทุกวัน', 0, '2026-01-01', '2026-12-31', 'ห้องประเภท Deluxe ขึ้นไปเท่านั้น');
