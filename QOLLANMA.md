# Shodiev POS — foydalanish qo'llanmasi

## 1. O'rnatish

1. `Shodiev POS Setup 1.2.0.exe` faylini kassa kompyuteriga ko'chiring.
2. Ustiga ikki marta bosing → "Установить" / "O'rnatish".
3. Ish stolida **Shodiev POS** yorlig'i paydo bo'ladi.

**Birinchi kirish:**

| Login | Parol |
|---|---|
| `rahbar` | `1234` |

> ⚠️ Birinchi kirgandan keyin **darhol parolni o'zgartiring**: Xodimlar → Rahbar → Tahrirlash → yangi parol.

---

## 2. Ishni boshlash tartibi (bir martalik sozlash)

### 2.1. Do'kon ma'lumotlari
**Sozlama → Do'kon ma'lumotlari** — nom, manzil, telefon. Bular chekda chiqadi.

### 2.2. Printer
**Sozlama → Chek va printer**:
- Printerni ro'yxatdan tanlang (XP-80T).
- Chek eni: **80 mm**.
- **«Sinov chekini chiqarish»** tugmasini bosing — chek chiqsa, hammasi tayyor.

### 2.3. Telegram bot
**Sozlama → Telegram bot**:
1. Telegramda **@BotFather** ga kiring → `/newbot` → bot nomini bering → u sizga **token** beradi.
2. Tokenni dasturga joylang.
3. Rahbar o'z telefonidan botni topib **/start** bossin.
4. **«Chat ID ni aniqlash»** tugmasini bosing → rahbarni tanlang.
5. **«Sinov xabarini yuborish»** — Telegramga xabar kelsa, tayyor.

### 2.4. Tovarlarni kiritish
**Tovarlar → + Yangi tovar**:
- **Nomi** — masalan `Pepsi 1.5L`
- **Shtrix-kod** — skanerni shu maydonda o'qiting (yoki bo'sh qoldiring)
- **Sotuv narxi** — 1 dona narxi
- **1 blokda nechta dona** — masalan 6 (tezkor kiritish uchun)
- **Ogohlantirish chegarasi** — qoldiq shundan kam bo'lsa ogohlantiradi

> Tovarlarni bittalab kiritib chiqing. Bir marta kiritilsa, keyin faqat kirim qilinadi.

---

## 3. Kunlik ish

### 3.1. Sotuv
1. **Sotuv** bo'limi ochiq turadi.
2. Tovarni qo'shish — 3 xil yo'l:
   - **Shtrix-kodni o'qing** (eng tez) — savatga o'zi tushadi
   - Nomini yozib qidiring va bosing
   - Kartochkadagi **+blok** tugmasi — bir blokni birdan qo'shadi
3. Miqdorni **−** / **+** bilan yoki raqamni yozib o'zgartiring.
4. **«To'lovga o'tish»** (yoki **F2**).
5. To'lov turini tanlang:
   - Bitta usul bo'lsa — **Naqd / Karta / Terminal** tugmasini bosing
   - **Aralash bo'lsa** — masalan 100 000 naqd, qolgani terminal: «Naqd» katagiga 100000 yozing, «Terminal» katagiga qolganini yozing (yoki katakni ikki marta bosing — qolgan summani o'zi to'ldiradi)
   - **Qarzga** — summani «Qarzga» katagiga yozing va **mijozni tanlang**
6. Naqd bo'lsa, mijoz bergan pulni yozsangiz — **qaytimni o'zi hisoblaydi**.
7. **«Sotuvni yakunlash»** → chek chiqadi, rahbarga Telegramga xabar ketadi.

### 3.2. Tovar qabul qilish (kirim)
**Kirim → Yangi kirim**:
1. Tovarni qidiring yoki shtrix-kodni o'qing.
2. **Miqdor** (dona), **tan narx** (kelgan narxi) ni yozing.
3. Agar sotuv narxi ham o'zgargan bo'lsa — «Sotuv narx» ustunida o'zgartiring.
4. **«Kirimni saqlash»** → qoldiq oshadi, rahbarga Telegramga xabar ketadi.

> Tan narx o'zgarsa, dastur **o'rtacha** hisoblab qo'yadi.
> Masalan 100 dona 9000 dan bor edi, 100 dona 10000 dan keldi → yangi tan narx **9500**.

### 3.3. Qarzlar
**Mijozlar** bo'limi:
- **+ Yangi mijoz** — ism va telefon.
- **Qarz to'lash** — mijoz pul olib kelganda summani kiriting, usulini tanlang.
- **Tarix** — shu mijozning barcha sotuvlari va to'lovlari.

---

## 4. Rahbar uchun

### Kompyuterda
- **Panel** — bugungi savdo, foyda, naqd/karta, ombor qiymati, qarzdorlar, tugayotgan tovarlar.
- **Hisobot** — istalgan davr uchun: savdo, foyda, to'lov turlari, cheklar ro'yxati, tovarlar kesimi, kunlar kesimi, ombor qoldig'i.
- Chekni **qayta chop etish** yoki **bekor qilish** (tovar omborga qaytadi).
- Istalgan tovarning **narxini, nomini, qoldig'ini** o'zgartirish — hamma narsa rahbar qo'lida.
- Sotuv paytida ham narxni o'zgartirish mumkin (savatdagi narx katagi faqat rahbarga ko'rinadi).

### Telegramda
Bot tugmalari:
| Tugma | Nima ko'rsatadi |
|---|---|
| 📊 Bugun | Bugungi savdo, foyda, naqd/karta/terminal, top tovarlar |
| 📅 Hafta | Oxirgi 7 kun |
| 🗓 Oy | Shu oy boshidan |
| 📈 Jami | Butun davr |
| 📦 Qoldiq | Ombor qiymati + tugayotgan tovarlar |
| 📝 Qarzdorlar | Kim qancha qarzdor |
| 🏆 Top tovarlar | Eng ko'p sotilganlar |

Bundan tashqari bot avtomatik yuboradi:
- **Har bir sotuv** (chek) — sodir bo'lishi bilan
- **Har bir kirim** — kim qabul qilgani bilan
- **Qarz to'lovlari**
- **Kunlik yakuniy hisobot** — har kuni belgilangan vaqtda (standart 21:00)
- **Zaxira nusxa** — kuniga bir marta baza fayli

---

## 5. Xodim qo'shish

**Xodimlar → + Yangi xodim**:
- Ism, login, parol
- Qaysi **filialda** ishlashi
- **Ruxsatlar**: sotuv / kirim / tovarlar / mijozlar / qarz / hisobot

> Xodimga **«Hisobot»** ruxsati berilmasa — u **tan narxni va foydani ko'rmaydi**.

---

## 6. Internet yoki svet o'chsa nima bo'ladi?

| Holat | Nima bo'ladi |
|---|---|
| **Internet o'chdi** | Dastur oldingidek ishlayveradi: sotuv, chek, qoldiq, hisobot. Telegram xabarlari navbatda turadi (yuqoridagi ⏳ belgisi ko'rsatadi) va internet kelishi bilan **birin-ketin o'zi yuboriladi** — asl vaqti bilan. |
| **Svet o'chdi** | Tugallangan cheklar yo'qolmaydi (baza har amaldan keyin darhol diskka yoziladi). Kompyuter yoqilganda dastur ochiladi va ishni davom ettiradi. |
| **Kompyuter buzildi** | Telegramdagi oxirgi zaxira faylini yangi kompyuterga tiklaymiz — hamma ma'lumot joyida. |

---

## 7. Zaxira nusxa (backup)

Avtomatik: har kuni kompyuterdagi papkaga + Telegramga.

Qo'lda: **Sozlama → Zaxira nusxa → «Hozir zaxira nusxa yaratish»**.

**Tiklash** (kompyuter almashsa): yangi kompyuterga dasturni o'rnating, Telegramdan `.db` faylni yuklab oling va quyidagi papkaga `shodiev-pos.db` nomi bilan joylang:

```
C:\Users\<foydalanuvchi>\AppData\Roaming\shodiev-pos\
```

---

## 7a. Kassa hisobi (istalgan paytda)

**Kassa** bo'limi. Ekranda «kassada bo'lishi kerak» degan naqd summa turadi - bu oxirgi
hisobdan hozirgacha tushgan naqd pul (sotuvdan + qarz to'lovlaridan).

1. «Kassani sanash» tugmasi.
2. Pul turlarini (100 000 dan nechta, 50 000 dan nechta...) yozing - summani o'zi hisoblaydi.
   Yoki umumiy summani qo'lda yozing.
3. Kerak bo'lsa izoh qoldiring (masalan: «tushlikka 50 000 olindi»).
4. Saqlang - farq chiqsa rahbarga Telegramga darhol xabar boradi.

Keyingi hisob shu paytdan boshlab sanaydi. Kuniga bir necha marta qilsa ham bo'ladi.

## 7b. Tovar tugayapti - ogohlantirish

Tovarning «Ogohlantirish chegarasi» dan pastga tushishi bilan rahbarga Telegramga xabar boradi:
«Pepsi 1.5L - 8 dona qoldi». Bir tovar uchun kuniga bir marta yuboriladi, telegram to'lib ketmaydi.

## 7c. Narx o'zgarishlari

**Hisobot -> Narx o'zgarishlari**: qaysi tovarning narxi qachon, kim tomonidan, nechadan nechaga
o'zgargani. Kirim paytida avtomatik o'zgargan tan narxlar ham shu yerda.

## 7d. Avtomatik yangilanish

Dastur har 4 soatda yangi versiyani tekshiradi, topsa orqa fonda yuklab oladi va yuqorida
«Yangilash» tugmasi chiqadi. Savdo yarim qolmasligi uchun qayta ishga tushirishni o'zingiz
tanlaysiz. Qo'lda tekshirish: **Sozlama -> Dastur -> «Yangilanishni tekshirish»**.

## 8. Foydali tugmalar

| Tugma | Vazifasi |
|---|---|
| **F2** | To'lovga o'tish |
| **Esc** | Oynani yopish |
| **Enter** (qidiruvda) | Birinchi topilgan tovarni savatga qo'shish |
| **F12** | Texnik panel (muammo bo'lganda) |

---

## 9. Texnik ma'lumot

- Baza fayli: `C:\Users\<foydalanuvchi>\AppData\Roaming\shodiev-pos\shodiev-pos.db`
- Zaxira papkasi: `...\shodiev-pos\backup\`
- Dastur internetsiz to'liq ishlaydi; internet faqat Telegram uchun kerak.
- Ma'lumotlar shu kompyuterda saqlanadi, hech qanday tashqi serverga yuborilmaydi (Telegramdan tashqari).
