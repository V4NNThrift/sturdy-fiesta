# 🤖 AI Tools Indonesia

Platform AI Multifungsi Terlengkap - Full Bahasa Indonesia

## Fitur Utama

### 🧩 Block Blast Solver AI
- Input board 8x8 dengan klik
- Pilih pieces yang tersedia
- AI mencari move optimal menggunakan heuristic search + beam search
- Highlight posisi terbaik

### 🔧 Tools Lengkap
- 🔢 Kalkulator Modern
- 📝 Catatan Online
- ✅ To Do List
- 📱 QR Code Generator
- 🔐 Password Generator
- 📄 Penghitung Kata
- 🔤 Konversi Huruf
- { } JSON Formatter
- 🔄 Base64 Encode/Decode
- #️⃣ Hash Generator (MD5, SHA1, SHA256, SHA512)
- 🎨 Color Converter (HEX, RGB, HSL)
- 🔗 Pemendek Link
- 📜 Lorem Ipsum Generator

### 🔐 Sistem Autentikasi
- Register via Bot Telegram
- Login dengan username + password
- Session management yang aman
- Rate limiting untuk free users

### 📊 Dashboard
- Statistik penggunaan
- Riwayat aktivitas
- Progress bar limit harian

## Cara Setup

### 1. Jalankan Server

```bash
python3 server.py
```

Server berjalan di `http://localhost:8000`

### 2. Register Akun

1. Buka Telegram, cari bot dengan token yang dikonfigurasi
2. Kirim `/start`
3. Kirim `/register username password`
4. Login ke website dengan username & password

### 3. Bot Telegram Commands

- `/start` - Mulai & info
- `/register username password` - Daftar akun baru
- `/myaccount` - Cek info akun
- `/resetpassword passwordbaru` - Reset password

## Tech Stack

- **Backend**: Python 3 (built-in http.server, sqlite3, hashlib, json)
- **Frontend**: Vanilla JavaScript SPA
- **Database**: SQLite
- **Styling**: Custom CSS (Dark Theme, Responsive)
- **Bot**: Telegram Bot API (long polling)

## Struktur Project

```
├── server.py           # Main server (HTTP + Telegram Bot + API)
├── public/
│   ├── index.html      # Main HTML
│   ├── css/
│   │   └── style.css   # Stylesheet
│   └── js/
│       └── app.js      # SPA Application
├── database/
│   └── aitools.db      # SQLite Database (auto-generated)
└── README.md
```

## Keamanan

- Password di-hash dengan PBKDF2-HMAC-SHA256 + salt
- Session tokens menggunakan secrets.token_urlsafe
- Rate limiting per user per hari
- Input validation di semua endpoint
- Calculator menggunakan eval yang di-sanitize
- HttpOnly cookies untuk session

## License

MIT
