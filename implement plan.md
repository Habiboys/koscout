# PROJECT PLAN: KOSFINDER
## Platform Pencarian, Agregasi, dan Perbandingan Kos Berbasis Lokasi

**Tech Stack: Next.js (Fullstack) | Data Scraping | Maps | Geolocation | AI Recommendation**

Saya akan merancang aplikasi web yang dapat mengumpulkan informasi kos dari berbagai platform seperti Mamikos dan situs pencarian kos lainnya, kemudian menggabungkannya menjadi satu platform yang memudahkan kamu menemukan kos terbaik berdasarkan harga, fasilitas, lokasi, jarak ke kantor, dan kondisi lingkungan sekitar.

Konsepnya bukan sekadar website pencarian kos, tetapi **platform pengambilan keputusan untuk memilih kos yang paling sesuai dengan kebutuhan pengguna.**

Misalnya, kamu mendapatkan pekerjaan di Jakarta dan ingin mencari kos dengan kriteria:

- Budget maksimal Rp2.000.000/bulan.
- Jarak maksimal 5 km dari kantor.
- Memiliki AC, Wi-Fi, kamar mandi dalam, dan parkir motor.
- Dekat tempat makan murah, minimarket, dan transportasi umum.
- Waktu perjalanan ke kantor maksimal 20 menit.
- Lingkungan tidak terlalu bising.
- Biaya keseluruhan paling ekonomis.

Aplikasi akan mencari kos dari berbagai sumber, menganalisisnya, lalu memberikan perbandingan dan rekomendasi.

---

# 1. Konsep dan Tujuan Aplikasi

### Nama sementara: KosFinder

**Tujuan utama:**

Membantu pengguna menemukan kos terbaik dengan mempertimbangkan harga, fasilitas, akses transportasi, waktu perjalanan, dan fasilitas publik di sekitar kos.

### Cara kerja aplikasi

```text
                  PENGGUNA
                      |
                      v
             WEB APP NEXT.JS
                      |
                      v
              INPUT PENCARIAN
                      |
        +-------------+-------------+
        |             |             |
        v             v             v
    Lokasi Kantor   Budget      Preferensi
        |             |             |
        +-------------+-------------+
                      |
                      v
              SEARCH ENGINE
                      |
          +-----------+-----------+
          |           |           |
          v           v           v
       Mamikos     Platform B   Platform C
          |           |           |
          +-----------+-----------+
                      |
                      v
             DATA NORMALIZATION
                      |
                      v
            DEDUPLICATION ENGINE
                      |
                      v
             LOCATION ANALYSIS
                      |
           +----------+----------+
           |          |          |
           v          v          v
       Distance    Transport    Nearby POI
           |          |          |
           +----------+----------+
                      |
                      v
             SCORING ENGINE
                      |
                      v
            RANKING & COMPARISON
                      |
                      v
                HASIL KOS
```

Sistem akan menggunakan **Next.js untuk frontend dan backend sekaligus**, sehingga tidak perlu memisahkan proyek frontend dan backend.

---

# 2. Apakah Perlu Database?

Menurut saya, **untuk MVP awal tidak wajib menggunakan database**, tetapi ada beberapa pertimbangan penting.

### Opsi A — Tanpa database

Alurnya:

```text
User melakukan pencarian
          |
          v
Next.js API Route
          |
          v
Scraping / Fetching Data
          |
          v
Normalisasi Data
          |
          v
Analisis Lokasi
          |
          v
Perhitungan Skor
          |
          v
Tampilkan Hasil
```

Keuntungan:
- Arsitektur sederhana.
- Tidak perlu mengelola database.
- Deployment lebih mudah.
- Cocok untuk aplikasi pribadi.
- Biaya infrastruktur relatif kecil.

Kekurangan:
- Setiap pencarian berpotensi melakukan scraping ulang.
- Pencarian bisa lambat.
- Sulit menyimpan riwayat perubahan harga.
- Data dari berbagai sumber harus diproses ulang.
- API Maps dan scraping dapat menambah biaya.
- Sulit mendeteksi kos duplikat secara konsisten.

### Opsi B — Menggunakan penyimpanan ringan

Saya lebih merekomendasikan pendekatan ini.

Gunakan:

**Next.js + TypeScript + SQLite + Prisma**

SQLite bukan database server terpisah seperti MySQL atau PostgreSQL. Datanya disimpan dalam sebuah file.

Contohnya:

```text
kosfinder/
├── src/
├── prisma/
│   ├── schema.prisma
│   └── dev.db
├── public/
├── package.json
└── next.config.ts
```

Database digunakan untuk menyimpan:

1. Data kos hasil pengumpulan.
2. Riwayat harga kos.
3. Lokasi kantor.
4. Kos favorit.
5. Hasil analisis fasilitas sekitar.
6. Cache data hasil scraping.
7. Riwayat perbandingan.

**Keputusan arsitektur yang saya sarankan:**

Untuk tahap pertama, gunakan Next.js dengan penyimpanan JSON atau SQLite lokal. Jika aplikasinya nanti digunakan banyak pengguna, pertimbangkan PostgreSQL.

Catatan: SQLite berbasis file cocok untuk server dengan penyimpanan persisten, misalnya VPS atau Docker dengan volume. Jika deployment menggunakan platform serverless dengan filesystem sementara, jangan mengandalkan SQLite lokal untuk data persisten.

---

# 3. Rancangan Fitur Lengkap

## Modul 1 — Smart Kos Search

Ini merupakan fitur utama.

Pengguna dapat mencari kos berdasarkan lokasi kantor atau lokasi lain yang ditentukan.

### Input pencarian

| Parameter | Contoh |
|---|---|
| Lokasi kantor | Gedung kantor di Jakarta Selatan |
| Radius pencarian | 5 km |
| Budget minimum | Rp800.000 |
| Budget maksimum | Rp2.000.000 |
| Jenis kos | Putra / Putri / Campur |
| Kamar mandi | Dalam |
| AC | Wajib |
| Wi-Fi | Wajib |
| Parkir motor | Wajib |
| Dapur | Opsional |
| Transportasi | Dekat MRT/KRL/TransJakarta |
| Maksimal perjalanan | 20 menit |

### Fitur tambahan

**1. Search by Office Location**

Pengguna memasukkan alamat kantor atau memilih titik langsung di peta.

Contoh:

```text
Lokasi kantor:
Jl. TB Simatupang, Jakarta Selatan

Radius:
5 km

Budget:
Rp1.000.000 - Rp2.000.000

Fasilitas:
[x] AC
[x] WiFi
[x] Kamar mandi dalam
[x] Parkir motor

Transportasi:
[x] MRT
[x] TransJakarta
[ ] KRL
```

**2. Multiple Office Locations**

Menarik jika pengguna memiliki beberapa lokasi kerja.

Contohnya:

```text
Kantor utama : Jakarta Selatan
Kantor kedua : Jakarta Pusat

Sistem mencari kos yang memiliki
akses perjalanan paling optimal
ke kedua kantor.
```

**3. Search by Commute Time**

Daripada hanya menggunakan jarak kilometer, pengguna bisa menentukan:

> Cari kos dengan waktu perjalanan ke kantor maksimal 25 menit menggunakan motor.

Ini lebih realistis dibandingkan jarak garis lurus.

---

## Modul 2 — Multi-Source Kos Aggregator

Modul ini bertugas mengumpulkan data dari berbagai platform pencarian kos.

### Sumber data potensial

| Sumber | Data yang ingin diperoleh |
|---|---|
| Mamikos | Harga, lokasi, fasilitas, foto, detail kos |
| Situs kos lainnya | Informasi kos dan harga |
| Situs properti | Listing kamar sewa atau hunian |
| Data yang dimasukkan pengguna | Kos yang ditemukan secara manual |
| Data OpenStreetMap | Fasilitas umum dan lokasi sekitar |

### Informasi yang dikumpulkan

```typescript
interface Kos {
  id: string;

  name: string;

  source: string;
  sourceUrl: string;

  address: string;

  latitude: number | null;
  longitude: number | null;

  price: {
    monthly: number | null;
    yearly: number | null;
    deposit: number | null;
  };

  room: {
    size: string | null;
    bathroomType: "inside" | "outside" | "unknown";
    electricityIncluded: boolean | null;
  };

  facilities: string[];

  images: string[];

  gender: "male" | "female" | "mixed" | "unknown";

  rating: number | null;

  lastUpdated: string;
}
```

### Strategi pengumpulan data

Saya menyarankan membuat adapter terpisah untuk setiap sumber.

```text
Scraper Engine
     |
     +-- Mamikos Adapter
     |
     +-- Property Site Adapter
     |
     +-- Other Kos Adapter
     |
     +-- Manual URL Import
```

Setiap adapter bertugas:

1. Mengambil informasi dari sumber yang diizinkan.
2. Mengekstrak data listing.
3. Mengubah data menjadi format standar.
4. Melakukan validasi.
5. Mengirim hasil ke proses deduplikasi.

**Penting:** Jangan mengasumsikan semua situs mengizinkan scraping. Untuk Mamikos dan platform lain, perlu memeriksa ketentuan penggunaan, robots.txt, dan ketersediaan API atau izin akses. Tidak semua data yang terlihat di browser boleh otomatis diambil dan disimpan ulang. Jika suatu situs membatasi pengambilan otomatis, gunakan sumber resmi, integrasi berizin, atau impor manual dari pengguna. Hindari bypass CAPTCHA, proteksi anti-bot, maupun pembatasan akses.

### Fitur menarik: Import Kos from URL

Misalnya pengguna menemukan kos menarik.

Pengguna cukup memasukkan tautan:

```text
https://situs-kos.example/listing/123
```

Sistem mencoba mengambil metadata yang tersedia dan diizinkan.

Jika tidak bisa diambil otomatis, pengguna tetap dapat memasukkan harga, fasilitas, alamat, dan foto secara manual.

Hasilnya masuk ke daftar perbandingan.

---

## Modul 3 — Interactive Map

Menurut saya, ini salah satu fitur terpenting.



### Tampilan yang direncanakan

```text
+----------------------------------------------------------+
| KosFinder                                                |
+----------------------------------------------------------+
| Search: Jakarta Selatan     Budget: < 2 Juta             |
+---------------------------+------------------------------+
|                           |                              |
| DAFTAR KOS                |          PETA                |
|                           |                              |
| Kos A                     |       [Kos A]                |
| Rp1.500.000               |                              |
| Jarak: 1.2 km             |            [KANTOR]          |
|                           |                              |
| Kos B                     |    [Kos B]                   |
| Rp1.800.000               |                              |
| Jarak: 2.1 km             |                 [Kos C]      |
|                           |                              |
| Kos C                     |                              |
| Rp1.200.000               |                              |
+---------------------------+------------------------------+
```

### Kemampuan peta

- Menampilkan titik lokasi kantor.
- Menampilkan marker setiap kos.
- Warna marker berdasarkan harga.
- Menampilkan radius pencarian.
- Menampilkan rute menuju kantor.
- Menampilkan estimasi waktu perjalanan.
- Menampilkan lokasi transportasi umum.
- Menampilkan fasilitas publik di sekitar kos.
- Filter kos langsung melalui peta.
- Menggeser peta untuk mencari area lain.

### Teknologi

Gunakan:

- Leaflet atau MapLibre GL JS untuk peta.
- OpenStreetMap untuk data geografis.
- Routing engine untuk estimasi perjalanan.
- Geocoding service untuk mengubah alamat menjadi koordinat.

Untuk produksi, perhatikan batas penggunaan dan kebijakan layanan tile, geocoding, serta routing. Menggunakan library open-source tidak otomatis membuat seluruh layanan peta gratis tanpa batas.

---

# 4. Modul Analisis Lokasi dan Fasilitas Sekitar

Ini fitur yang akan membedakan KosFinder dari website pencarian kos biasa.

Setiap kos akan dianalisis berdasarkan fasilitas di sekitarnya.

### Kategori fasilitas

| Kategori | Data yang dianalisis |
|---|---|
| Tempat makan | Warung, restoran, rumah makan |
| Belanja | Minimarket, supermarket, pasar |
| Transportasi | MRT, KRL, TransJakarta, halte bus |
| Kesehatan | Apotek, klinik, rumah sakit |
| Keuangan | ATM, bank |
| Hiburan | Mall, bioskop, pusat kebugaran |
| Kebutuhan sehari-hari | Laundry, fotokopi |
| Keamanan | Pos polisi dan fasilitas keamanan publik |

### Contoh hasil analisis

**Kos Melati Residence**

Lokasi: Jakarta Selatan

Harga: Rp1.500.000/bulan

| Fasilitas | Jumlah dalam radius 1 km | Terdekat |
|---|---:|---:|
| Tempat makan | 24 | 120 m |
| Minimarket | 5 | 250 m |
| Laundry | 8 | 100 m |
| ATM | 4 | 400 m |
| Halte TransJakarta | 2 | 550 m |
| Stasiun MRT | 1 | 900 m |
| Apotek | 3 | 350 m |
| Mall | 1 | 1,2 km |

Angka di atas hanya contoh ilustrasi.

### Fitur Nearby Facilities Score

Sistem memberikan skor berdasarkan kelengkapan fasilitas.

Contoh:

```text
Kos Melati Residence

Food Accessibility     95/100
Public Transportation  85/100
Shopping               90/100
Healthcare             80/100
Daily Needs            95/100

Overall Location Score 89/100
```

Perhitungan mempertimbangkan jumlah fasilitas, jarak, dan tingkat kepentingannya.

Untuk menghitung fasilitas terdekat, kita dapat menggunakan data OpenStreetMap melalui layanan Overpass API, dengan caching dan pembatasan permintaan yang sesuai.

Namun, jumlah fasilitas dari data peta tidak selalu lengkap. Jadi hasilnya perlu ditandai sebagai estimasi berdasarkan data yang tersedia.

---

# 5. Modul Perbandingan Kos

Pengguna dapat memilih beberapa kos untuk dibandingkan.

Misalnya:

```text
[x] Kos Melati
[x] Kos Anggrek
[x] Kos Mawar

[Bandingkan Sekarang]
```

### Contoh hasil perbandingan

| Parameter | Kos Melati | Kos Anggrek | Kos Mawar |
|---|---:|---:|---:|
| Harga/bulan | Rp1,5 jt | Rp1,8 jt | Rp1,2 jt |
| Jarak kantor | 1,2 km | 2,1 km | 3,5 km |
| Waktu naik motor | 7 menit | 12 menit | 20 menit |
| AC | ✅ | ✅ | ❌ |
| Wi-Fi | ✅ | ✅ | ✅ |
| Kamar mandi dalam | ✅ | ✅ | ❌ |
| Parkir motor | ✅ | ✅ | ✅ |
| Tempat makan sekitar | 24 | 18 | 30 |
| Minimarket sekitar | 5 | 3 | 6 |
| Akses transportasi | Bagus | Sangat bagus | Sedang |
| Skor fasilitas | 90 | 95 | 65 |
| Skor lokasi | 95 | 85 | 75 |
| **Total skor** | **92** | **89** | **71** |

*Seluruh data pada tabel merupakan contoh simulasi.*

### Fitur Highlight Differences

Sistem otomatis menandai:

- Kos paling murah.
- Kos paling dekat kantor.
- Kos dengan fasilitas paling lengkap.
- Kos dengan akses transportasi terbaik.
- Kos dengan biaya bulanan keseluruhan paling rendah.
- Kos dengan nilai terbaik berdasarkan preferensi pengguna.

---

# 6. Smart Kos Recommendation Engine

Tidak cukup hanya membandingkan harga dan fasilitas.

Sistem sebaiknya mampu menentukan kos mana yang paling cocok untuk pengguna.

### Metode Weighted Scoring

Contoh bobot:

| Kriteria | Bobot |
|---|---:|
| Harga | 25% |
| Jarak dan waktu perjalanan | 30% |
| Fasilitas kamar | 20% |
| Fasilitas sekitar | 15% |
| Transportasi umum | 10% |
| **Total** | **100%** |

Formula:

\[
Score = 0.25P + 0.30D + 0.20F + 0.15N + 0.10T
\]

Keterangan:

- \(P\): Skor harga.
- \(D\): Skor perjalanan.
- \(F\): Skor fasilitas kos.
- \(N\): Skor fasilitas sekitar.
- \(T\): Skor transportasi umum.

Setiap komponen dinormalisasi menjadi nilai 0–100.

Pengguna dapat mengubah bobot tersebut sesuai prioritasnya.

Contoh:

```text
Saya lebih mementingkan:

Harga             40%
Jarak kantor      35%
Fasilitas kos     15%
Fasilitas sekitar  5%
Transportasi       5%
```

Sistem akan menghitung ulang peringkat kos secara otomatis.

**Penting:** Fasilitas wajib seperti AC dan kamar mandi dalam harus diperlakukan sebagai filter, bukan hanya komponen skor. Kos yang tidak memenuhi syarat wajib sebaiknya dikeluarkan dari rekomendasi utama.

---

# 7. Fitur Tambahan yang Sangat Menarik

Selain fitur utama, saya menyarankan beberapa fitur yang benar-benar membantu proses memilih kos.

## 7.1 True Monthly Cost Calculator

Harga sewa murah belum tentu berarti biaya hidup lebih murah.

Misalnya:

**Kos A**
- Sewa: Rp1.200.000
- Listrik: Rp150.000
- Internet: Gratis
- Transportasi: Rp500.000
- Laundry: Rp150.000

Total: **Rp2.000.000/bulan**

**Kos B**
- Sewa: Rp1.600.000
- Listrik: Termasuk
- Internet: Termasuk
- Transportasi: Rp100.000
- Laundry: Rp150.000

Total: **Rp1.850.000/bulan**

Meskipun harga sewanya lebih mahal, Kos B justru lebih ekonomis.

Formula:

\[
TotalCost = Rent + Electricity + Internet + Transport + Laundry + Other
\]

Tambahkan biaya awal seperti deposit, administrasi, dan biaya pindahan secara terpisah.

Fitur ini bisa menghitung proyeksi pengeluaran selama 3, 6, dan 12 bulan.

## 7.2 Commute Simulator

Pengguna memilih transportasi sehari-hari:

- Jalan kaki.
- Sepeda.
- Motor.
- Mobil.
- Transportasi umum.

Sistem menghitung estimasi jarak, waktu perjalanan, biaya, dan akses rute.

Contoh:

| Transportasi | Waktu | Estimasi biaya/hari |
|---|---:|---:|
| Jalan kaki | 35 menit | Rp0 |
| Motor | 10 menit | Rp8.000 |
| Mobil | 15 menit | Rp30.000 |
| TransJakarta | 25 menit | Rp7.000 |

Angka ilustrasi, bukan hasil perhitungan rute aktual.

Untuk Jakarta, sebaiknya pengguna juga dapat mengatur jam berangkat, misalnya pukul 07.30 dan pulang pukul 17.30. Estimasi waktu dengan lalu lintas aktual membutuhkan penyedia routing yang mendukung data traffic.

## 7.3 Kos Shortlist & Favorites

Pengguna dapat menyimpan kos yang menarik.

Contoh:

```text
MY SHORTLIST

1. Kos Melati
   Status: Belum dihubungi

2. Kos Anggrek
   Status: Sudah dihubungi

3. Kos Mawar
   Status: Jadwal survei

4. Kos Kenanga
   Status: Sudah disurvei
```

Status yang tersedia:

`Disimpan → Dihubungi → Jadwal Survei → Sudah Disurvei → Dipilih / Ditolak`

Tambahkan catatan pribadi untuk setiap kos.

## 7.4 Kos Visit Checklist

Ketika mengunjungi kos secara langsung, pengguna dapat mengisi checklist.

| Pemeriksaan | Status |
|---|---|
| Kondisi AC | Baik |
| Kualitas Wi-Fi | Baik |
| Kebersihan kamar mandi | Cukup |
| Air bersih | Baik |
| Kebisingan | Sedang |
| Keamanan parkir | Baik |
| Sinyal seluler | Buruk |
| Ventilasi kamar | Baik |

Bisa juga mengunggah foto hasil survei.

Dengan demikian, aplikasi tidak hanya berguna ketika mencari kos, tetapi juga saat memutuskan kos mana yang akan disewa.

## 7.5 Price History Tracker

Jika tersedia sumber data yang sah dan pembaruan berkala, aplikasi dapat menampilkan riwayat harga.

```text
Kos Melati

Juli       Rp1.500.000
Agustus    Rp1.500.000
September  Rp1.400.000
Oktober    Rp1.350.000

Perubahan: Turun 10%
```

Pengguna dapat melihat apakah harga kos sedang naik atau turun.

Fitur ini membutuhkan penyimpanan persisten dan data historis. Jadi, tidak cocok jika aplikasi benar-benar tanpa database atau penyimpanan lain.

## 7.6 Flood Risk & Environmental Analysis

Fitur ini relevan untuk mencari kos di Jakarta.

Sistem dapat menampilkan:

- Potensi banjir berdasarkan peta risiko resmi.
- Kedekatan dengan sungai atau saluran air.
- Ketersediaan akses jalan alternatif.
- Indikasi kebisingan berdasarkan data yang tersedia.
- Kondisi lingkungan dari catatan survei pengguna.

Jangan menyimpulkan bahwa suatu kos aman dari banjir hanya karena jauh dari sungai. Gunakan peta risiko atau data kejadian yang kredibel, sertakan tanggal data, dan tandai ketidakpastiannya.

## 7.7 AI Kos Advisor

Ini bisa menjadi fitur unggulan pada tahap lanjutan.

Pengguna dapat bertanya menggunakan bahasa sehari-hari.

Contoh:

> Cari kos maksimal Rp1,8 juta yang dekat kantor saya, ada AC, kamar mandi dalam, dan dekat tempat makan murah. Saya lebih mementingkan waktu perjalanan daripada fasilitas mewah.

AI akan menerjemahkan permintaan tersebut menjadi filter dan bobot penilaian.

Hasilnya:

```text
REKOMENDASI TERBAIK

1. Kos Melati - 92/100

Alasan:
- Memenuhi seluruh fasilitas wajib.
- Waktu perjalanan hanya 8 menit.
- Banyak pilihan tempat makan.
- Total pengeluaran relatif rendah.

Kekurangan:
- Tidak tersedia dapur bersama.
- Kamar relatif kecil.

2. Kos Anggrek - 89/100

Alasan:
- Fasilitas lebih lengkap.
- Dekat transportasi umum.

Kekurangan:
- Harga lebih mahal.
- Perjalanan ke kantor lebih lama.
```

AI tidak boleh mengarang informasi yang tidak tersedia pada listing. Setiap alasan rekomendasi harus berasal dari data yang sudah dikumpulkan dan dianalisis.

**Untuk MVP, tidak perlu menggunakan AI berbayar.** Sistem filter dan scoring deterministik sudah cukup. AI bisa ditambahkan belakangan.

---

# 8. Rancangan Tech Stack

Karena kamu ingin satu framework saja, seluruh aplikasi bisa menggunakan Next.js.

| Komponen | Teknologi | Fungsi |
|---|---|---|
| Framework | Next.js App Router | Frontend dan backend |
| Bahasa | TypeScript | Type safety |
| UI | Tailwind CSS | Styling |
| Komponen | shadcn/ui | Komponen antarmuka |
| State management | Zustand | State pencarian dan perbandingan |
| Data fetching | TanStack Query | Caching dan sinkronisasi |
| Map | MapLibre GL JS | Peta interaktif |
| Geospatial | Turf.js | Analisis koordinat dan radius |
| HTML parsing | Cheerio | Parsing halaman yang diizinkan |
| Browser automation | Playwright | Ekstraksi dari sumber yang mengizinkan |
| Validasi | Zod | Validasi input dan hasil ekstraksi |
| Penyimpanan MVP | SQLite + Prisma | Data dan riwayat |
| Charts | Recharts | Visualisasi perbandingan |
| Testing | Vitest + Playwright | Unit, integrasi, dan E2E |
| Deployment | Docker | Menjalankan satu aplikasi |

Seluruh komponen tersebut merupakan library atau dependensi dalam satu proyek Next.js, bukan aplikasi backend terpisah.

### Tentang scraping dengan Playwright

Gunakan Playwright hanya ketika sumber data memang mengizinkan otomatisasi dan membutuhkan rendering JavaScript. Untuk HTML statis, `fetch` dan Cheerio lebih ringan.

Saya juga sudah memeriksa [ketentuan resmi Mamikos](https://help.mamikos.com/post/syarat-dan-ketentuan-umum?utm_source=chatgpt.com). Ketentuannya membatasi penggunaan crawler, robot, dan perangkat otomatis dalam sejumlah aktivitas, serta melarang pengumpulan data pengguna tanpa izin. Karena itu, **jangan menjadikan scraping otomatis Mamikos tanpa persetujuan sebagai ketergantungan utama MVP**. Bangun adapter yang bisa menggunakan API berizin atau impor manual sebagai alternatif.

Untuk geocoding, layanan publik [Nominatim](https://operations.osmfoundation.org/policies/nominatim/?utm_source=chatgpt.com) juga memiliki batas maksimum satu permintaan per detik, melarang autocomplete melalui API publik, dan mewajibkan identifikasi aplikasi serta caching yang sesuai.

---

# 9. Struktur Folder Next.js

Saya menyarankan menggunakan arsitektur modular agar kode mudah dikembangkan.

```text
kosfinder/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── public/
│   ├── images/
│   └── icons/
│
├── src/
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   │
│   │   ├── search/
│   │   │   └── page.tsx
│   │   │
│   │   ├── kos/
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   │
│   │   ├── compare/
│   │   │   └── page.tsx
│   │   │
│   │   ├── favorites/
│   │   │   └── page.tsx
│   │   │
│   │   ├── map/
│   │   │   └── page.tsx
│   │   │
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   │
│   │   └── api/
│   │       ├── search/
│   │       │   └── route.ts
│   │       │
│   │       ├── listings/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       └── route.ts
│   │       │
│   │       ├── import/
│   │       │   └── route.ts
│   │       │
│   │       ├── compare/
│   │       │   └── route.ts
│   │       │
│   │       ├── nearby/
│   │       │   └── route.ts
│   │       │
│   │       ├── routes/
│   │       │   └── route.ts
│   │       │
│   │       └── recommendations/
│   │           └── route.ts
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── search/
│   │   ├── kos/
│   │   ├── maps/
│   │   ├── comparison/
│   │   └── charts/
│   │
│   ├── features/
│   │   ├── search/
│   │   ├── listings/
│   │   ├── comparison/
│   │   ├── favorites/
│   │   └── recommendations/
│   │
│   ├── server/
│   │   ├── db/
│   │   │   └── prisma.ts
│   │   │
│   │   ├── collectors/
│   │   │   ├── collector.interface.ts
│   │   │   ├── collector.registry.ts
│   │   │   ├── authorized-api.collector.ts
│   │   │   ├── permitted-web.collector.ts
│   │   │   └── manual-import.collector.ts
│   │   │
│   │   ├── normalization/
│   │   │   ├── normalize-listing.ts
│   │   │   └── normalize-facilities.ts
│   │   │
│   │   ├── deduplication/
│   │   │   └── duplicate-detector.ts
│   │   │
│   │   ├── geospatial/
│   │   │   ├── geocoding.ts
│   │   │   ├── distance.ts
│   │   │   ├── routing.ts
│   │   │   └── nearby-places.ts
│   │   │
│   │   ├── scoring/
│   │   │   ├── price-score.ts
│   │   │   ├── facility-score.ts
│   │   │   ├── location-score.ts
│   │   │   └── overall-score.ts
│   │   │
│   │   └── repositories/
│   │       ├── listing.repository.ts
│   │       └── favorite.repository.ts
│   │
│   ├── hooks/
│   │   ├── use-kos-search.ts
│   │   └── use-comparison.ts
│   │
│   ├── stores/
│   │   ├── search.store.ts
│   │   └── comparison.store.ts
│   │
│   ├── types/
│   │   ├── kos.ts
│   │   ├── search.ts
│   │   └── location.ts
│   │
│   └── lib/
│       ├── utils.ts
│       ├── constants.ts
│       └── validations.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example
├── Dockerfile
├── compose.yaml
├── next.config.ts
├── package.json
└── tsconfig.json
```

**Prinsip utama:** Semua proses scraping, pengambilan API eksternal yang membutuhkan kredensial, scoring server-side, dan penyimpanan dijalankan di server. Browser hanya menerima data yang memang dibutuhkan.

---

# 10. Rancangan Database Minimal

Jika menggunakan SQLite, saya menyarankan tabel berikut.

| Tabel | Fungsi |
|---|---|
| `listings` | Informasi utama kos |
| `listing_sources` | Sumber dan URL asli listing |
| `facilities` | Master fasilitas |
| `listing_facilities` | Relasi kos dan fasilitas |
| `listing_images` | Referensi gambar |
| `office_locations` | Titik kantor pengguna |
| `favorites` | Kos yang disimpan |
| `price_history` | Riwayat perubahan harga |
| `nearby_places` | Fasilitas publik sekitar |
| `commute_estimates` | Estimasi perjalanan |
| `search_preferences` | Preferensi pencarian |
| `visit_notes` | Catatan hasil survei |
| `collection_runs` | Status proses pengumpulan data |

Untuk penggunaan pribadi, autentikasi belum diperlukan. Nantinya, jika aplikasi digunakan banyak orang, tabel yang bersifat personal perlu dihubungkan ke `users`.

### Mekanisme deduplikasi

Karena kos yang sama bisa muncul pada beberapa sumber, gunakan pendekatan bertahap:

1. Cocokkan URL dan ID sumber.
2. Normalisasi nama dan alamat.
3. Bandingkan koordinat.
4. Bandingkan karakteristik kos.
5. Tandai kandidat duplikat dengan confidence score.
6. Minta konfirmasi pengguna untuk hasil yang ambigu.

Jangan otomatis menggabungkan dua listing hanya karena berdekatan. Satu bangunan kos dapat memiliki beberapa tipe kamar dengan harga berbeda.

---

# 11. Rancangan API

Seluruh endpoint menggunakan Next.js Route Handlers.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/search` | Pencarian kos |
| GET | `/api/listings` | Daftar kos |
| GET | `/api/listings/:id` | Detail kos |
| POST | `/api/import` | Impor listing |
| POST | `/api/compare` | Bandingkan kos |
| GET | `/api/nearby` | Fasilitas sekitar |
| POST | `/api/routes` | Estimasi rute |
| POST | `/api/recommendations` | Rekomendasi kos |
| GET | `/api/favorites` | Daftar favorit |
| POST | `/api/favorites` | Tambah favorit |
| DELETE | `/api/favorites/:id` | Hapus favorit |
| POST | `/api/office-locations` | Simpan lokasi kantor |
| POST | `/api/visit-notes` | Simpan catatan survei |

Untuk endpoint yang menerima URL, wajib melakukan validasi domain, protokol, redirect, dan alamat IP tujuan untuk mencegah SSRF. Endpoint pengumpulan data juga perlu rate limiting dan timeout.

---

# 12. Alur Sistem End-to-End

Berikut alur lengkap dari pengguna membuka website hingga mendapatkan rekomendasi.

### Flow 1 — Pencarian kos

```text
START
  |
  v
Pengguna membuka KosFinder
  |
  v
Masukkan lokasi kantor
  |
  v
Pilih koordinat pada peta
  |
  v
Masukkan budget dan preferensi
  |
  v
Klik "Cari Kos"
  |
  v
Validasi parameter pencarian
  |
  v
Ambil listing dari cache
dan sumber data yang diizinkan
  |
  v
Normalisasi data listing
  |
  v
Deteksi listing duplikat
  |
  v
Filter harga, lokasi, dan fasilitas wajib
  |
  v
Tampilkan daftar kos dan marker peta
  |
  v
END
```

### Flow 2 — Analisis kos

```text
Pengguna memilih kos
         |
         v
Ambil detail listing
         |
         v
Periksa koordinat lokasi
         |
         +--------------------+
         |                    |
         v                    v
    Koordinat valid     Koordinat tidak ada
         |                    |
         |                    v
         |              Minta pengguna
         |              menentukan titik
         |                    |
         +--------------------+
                  |
                  v
         Hitung jarak kantor
                  |
                  v
         Hitung estimasi rute
                  |
                  v
         Ambil fasilitas sekitar
                  |
                  v
         Hitung biaya bulanan
                  |
                  v
         Hitung skor rekomendasi
                  |
                  v
         Tampilkan hasil analisis
```

### Flow 3 — Perbandingan

```text
Pilih 2-5 kos
      |
      v
Klik Bandingkan
      |
      v
Ambil data semua kos
      |
      v
Samakan parameter penilaian
      |
      v
Hitung skor setiap kos
      |
      v
Tampilkan tabel perbandingan
      |
      v
Tampilkan kelebihan dan kekurangan
      |
      v
Rekomendasikan kos terbaik
      |
      v
Simpan hasil perbandingan
```

---

# 13. Tahapan Implementasi

Saya membagi pengembangan menjadi enam fase agar bisa dikerjakan secara bertahap.

## Fase 1 — Foundation & Project Setup

**Estimasi: 1–2 hari**

Pekerjaan:

1. Inisialisasi Next.js dengan TypeScript.
2. Instalasi Tailwind CSS dan shadcn/ui.
3. Konfigurasi ESLint dan TypeScript strict mode.
4. Setup struktur folder modular.
5. Setup SQLite dan Prisma.
6. Membuat layout utama dan navigasi.
7. Membuat konfigurasi environment.
8. Setup Docker.
9. Menambahkan data dummy untuk pengujian.

**Output:** Aplikasi Next.js sudah berjalan dan siap dikembangkan.

## Fase 2 — Data Collection Engine

**Estimasi: 3–5 hari**

Pekerjaan:

1. Membuat interface standar untuk sumber data.
2. Membuat adapter impor manual.
3. Membuat adapter API atau sumber web yang mengizinkan pengambilan otomatis.
4. Implementasi parsing data.
5. Implementasi normalisasi harga.
6. Implementasi normalisasi fasilitas.
7. Implementasi deduplikasi.
8. Implementasi caching.
9. Implementasi pencatatan error.
10. Membuat halaman untuk melihat status pengumpulan data.

**Output:** Aplikasi dapat menerima data kos dari beberapa sumber yang tersedia dan mengubahnya menjadi format seragam.

Keberhasilan fase ini sangat bergantung pada izin dan akses sumber data. Jika belum tersedia integrasi otomatis yang sah, impor manual tetap menjadi jalur utama yang berfungsi.

## Fase 3 — Search & Interactive Maps

**Estimasi: 3–4 hari**

Pekerjaan:

1. Membuat halaman pencarian.
2. Membuat filter budget dan fasilitas.
3. Membuat input lokasi kantor.
4. Integrasi peta.
5. Menampilkan marker kos.
6. Implementasi radius pencarian.
7. Menampilkan jarak kos ke kantor.
8. Integrasi routing.
9. Membuat tampilan split-screen antara peta dan daftar kos.
10. Membuat tampilan responsif untuk mobile.

**Output:** Pengguna dapat mencari kos berdasarkan lokasi kantor dan melihat hasilnya pada peta.

## Fase 4 — Location Intelligence

**Estimasi: 3–5 hari**

Pekerjaan:

1. Integrasi sumber POI.
2. Membuat kategori fasilitas sekitar.
3. Menghitung jumlah fasilitas dalam radius tertentu.
4. Menghitung jarak fasilitas terdekat.
5. Membuat analisis akses transportasi.
6. Menghitung skor lingkungan.
7. Menghitung estimasi biaya perjalanan.
8. Membuat cache hasil analisis lokasi.

**Output:** Setiap kos memiliki analisis lingkungan, fasilitas sekitar, dan akses perjalanan.

## Fase 5 — Comparison & Recommendation

**Estimasi: 3–4 hari**

Pekerjaan:

1. Membuat fitur pilih kos.
2. Membuat tabel perbandingan.
3. Membuat algoritma weighted scoring.
4. Membuat pengaturan bobot.
5. Membuat kalkulator biaya bulanan.
6. Membuat rekomendasi otomatis.
7. Membuat fitur favorit.
8. Membuat catatan survei.
9. Menampilkan alasan di balik setiap skor.

**Output:** Pengguna dapat membandingkan kos secara objektif berdasarkan preferensi pribadi.

## Fase 6 — Testing, Optimization & Deployment

**Estimasi: 2–4 hari**

Pekerjaan:

1. Unit testing algoritma scoring.
2. Integration testing API.
3. E2E testing menggunakan Playwright.
4. Pengujian data kosong dan tidak lengkap.
5. Pengujian kegagalan API eksternal.
6. Pengujian error scraping.
7. Pengujian responsivitas.
8. Optimasi caching.
9. Audit keamanan endpoint.
10. Deployment menggunakan Docker.

**Output:** Aplikasi siap digunakan untuk pencarian kos pribadi.

### Total estimasi pengembangan

| Fase | Estimasi |
|---|---:|
| Foundation | 1–2 hari |
| Data Collection | 3–5 hari |
| Search & Maps | 3–4 hari |
| Location Intelligence | 3–5 hari |
| Comparison | 3–4 hari |
| Testing & Deployment | 2–4 hari |
| **Total** | **15–24 hari kerja** |

Estimasi ini untuk satu developer dengan bantuan AI coding agent, dengan asumsi integrasi eksternal tersedia dan tidak ada hambatan perizinan. Integrasi scraping atau routing yang kompleks dapat memperpanjang waktu pengembangan.

---

# 14. Prioritas MVP vs Pengembangan Lanjutan

Saya tidak menyarankan langsung membangun semua fitur.

| Fitur | MVP | Lanjutan |
|---|:---:|:---:|
| Pencarian kos | ✅ | |
| Filter harga dan fasilitas | ✅ | |
| Input lokasi kantor | ✅ | |
| Peta interaktif | ✅ | |
| Import kos dari URL/manual | ✅ | |
| Pengumpulan data otomatis dari sumber berizin | Jika tersedia | ✅ |
| Perhitungan jarak | ✅ | |
| Estimasi waktu perjalanan | ✅ | |
| Fasilitas sekitar | ✅ | |
| Perbandingan kos | ✅ | |
| Scoring otomatis | ✅ | |
| Favorit | ✅ | |
| Kalkulator biaya bulanan | ✅ | |
| Catatan survei | | ✅ |
| Riwayat harga | | ✅ |
| Analisis banjir | | ✅ |
| Multi-office routing | | ✅ |
| AI recommendation | | ✅ |
| Notifikasi perubahan harga | | ✅ |
| Monitoring ketersediaan kamar | | ✅ |

---

# 15. Arsitektur Final yang Saya Rekomendasikan

Untuk kebutuhan pribadi, saya memilih arsitektur berikut:

```text
                   KOSFINDER
                  NEXT.JS APP
                       |
          +------------+------------+
          |                         |
          v                         v
     FRONTEND                  BACKEND
   React Components          Route Handlers
          |                         |
          |              +----------+----------+
          |              |          |          |
          |              v          v          v
          |          Collectors   Maps API   Scoring
          |              |          |          |
          |              v          v          |
          |          Normalize   POI/Route     |
          |              |          |          |
          |              +----------+----------+
          |                         |
          |                         v
          |                  DATA SERVICE
          |                         |
          |                         v
          |                   SQLite + Prisma
          |                         |
          +------------+------------+
                       |
                       v
                RESPONSE TO UI
```

### Deployment

Karena kamu menggunakan Next.js dan ingin arsitektur sederhana, satu container sudah cukup untuk MVP.

```text
VPS / Local Server
        |
        v
     Docker
        |
        v
 Next.js Container
        |
        +-- Frontend
        |
        +-- API Routes
        |
        +-- Data Collectors
        |
        +-- Scoring Engine
        |
        +-- SQLite
              |
              v
       Persistent Volume
```

Untuk tugas pengumpulan data berkala, gunakan scheduler eksternal seperti cron yang memanggil endpoint internal terproteksi, atau worker terjadwal yang dijalankan secara terpisah. Hindari menjalankan proses scraping panjang di dalam request HTTP biasa.

---

# 16. Hal Teknis yang Harus Diantisipasi

Ada beberapa tantangan penting dalam proyek ini.

**Pertama, data kos tidak selalu akurat.** Harga bisa berubah, kamar mungkin sudah penuh, dan fasilitas yang dicantumkan belum tentu tersedia. Setiap listing sebaiknya menampilkan sumber dan waktu terakhir diperiksa.

**Kedua, alamat kos terkadang tidak lengkap.** Sistem harus membedakan koordinat yang terverifikasi, koordinat perkiraan, dan listing yang belum memiliki lokasi. Jangan menghitung jarak presisi menggunakan lokasi yang belum diketahui.

**Ketiga, data fasilitas publik tidak selalu lengkap.** OpenStreetMap dapat menyediakan banyak POI, tetapi tidak menjamin seluruh warung makan, laundry, atau halte tercatat. API publik Overpass juga memiliki batas kapasitas dan penggunaan. [OpenStreetMap](https://wiki.openstreetmap.org/wiki/OSM_Server_Side_Script?utm_source=chatgpt.com)

**Keempat, jarak lurus tidak sama dengan waktu perjalanan.** Gunakan perhitungan jarak geografis hanya untuk filter awal. Untuk rekomendasi perjalanan, gunakan routing berdasarkan jaringan jalan dan moda transportasi.

**Kelima, jangan membuat rekomendasi berdasarkan data yang tidak tersedia.** Misalnya, jika informasi listrik tidak diketahui, jangan menganggap listrik gratis. Tampilkan status `Belum diketahui` dan sesuaikan confidence score.

**Keenam, perhatikan keamanan impor URL.** Jangan mengizinkan backend mengakses sembarang alamat internal atau layanan metadata cloud. Gunakan allowlist domain dan validasi tujuan request.

---

# 17. Kriteria Keberhasilan Aplikasi

Agar pengembangannya jelas, berikut target penerimaan MVP.

| Area | Kriteria keberhasilan |
|---|---|
| Pencarian | Pengguna bisa mencari berdasarkan lokasi, budget, dan fasilitas |
| Pengumpulan data | Data dari sumber berizin atau impor manual berhasil dinormalisasi |
| Deduplikasi | Listing identik tidak muncul berulang tanpa alasan |
| Lokasi | Kos dengan koordinat valid tampil pada peta |
| Jarak | Jarak dan rute ditampilkan dengan metode perhitungan yang jelas |
| Fasilitas sekitar | POI dikategorikan dan ditampilkan sesuai radius |
| Perbandingan | Minimal 2 kos dapat dibandingkan |
| Scoring | Perhitungan konsisten dan bobot dapat disesuaikan |
| Biaya | Biaya sewa dan biaya tambahan dipisahkan |
| Penyimpanan | Favorit dan preferensi tidak hilang setelah aplikasi dimulai ulang |
| Reliability | Kegagalan satu sumber data tidak menggagalkan seluruh pencarian |
| Testing | Seluruh alur utama lulus pengujian E2E |

---

# 18. Keputusan Akhir Pengembangan

Untuk proyek ini, saya merekomendasikan:

**Nama proyek:** KosFinder

**Arsitektur:** Monolithic Fullstack Next.js

**Tech stack utama:** Next.js, TypeScript, Tailwind CSS, shadcn/ui, MapLibre, Prisma, dan SQLite.

**Deployment:** Docker pada VPS atau komputer lokal.

**Database:** SQLite, tanpa server database terpisah.

**Data kos:** API berizin, pengumpulan otomatis dari sumber yang memperbolehkannya, dan impor manual.

**Data geografis:** OpenStreetMap serta penyedia geocoding dan routing yang sesuai kebutuhan.

**Rekomendasi:** Weighted Scoring, tanpa AI pada MVP.

**Target utama:** Membantu pengguna menemukan kos dengan biaya hidup paling masuk akal, fasilitas sesuai kebutuhan, dan perjalanan ke kantor yang efisien.

### Satu fitur yang menurut saya wajib menjadi fokus

**Best Kos Based on Total Living Cost & Commute.**

Misalnya sistem menemukan 50 kos di sekitar kantor. Alih-alih hanya mengurutkan berdasarkan harga sewa, KosFinder bisa menjawab:

> Dari 50 kos yang ditemukan, Kos Melati merupakan pilihan paling ekonomis untuk kebutuhan Anda. Walaupun sewanya Rp300.000 lebih mahal dibandingkan kos termurah, estimasi pengeluaran bulanan keseluruhan lebih rendah karena biaya transportasi lebih kecil dan fasilitas penting sudah termasuk.

Itulah nilai utama aplikasi ini.

**Saran saya:** Bangun MVP dengan Next.js + SQLite terlebih dahulu. Jangan menghilangkan database hanya demi menyederhanakan proyek, karena penyimpanan data, caching, deduplikasi, favorit, dan riwayat harga justru akan sangat membantu. SQLite memberikan semua kebutuhan dasar tersebut tanpa menambah server database atau framework lain.

## Tambahan Project Plan KosFinder — AI Recommendation & Export Data untuk Analisis AI Eksternal

Saya sarankan kita menambahkan **dua metode analisis AI** ke KosFinder:

1. **Integrated AI Recommendation (Gemini API)** — Pengguna cukup memasukkan Gemini API Key di pengaturan aplikasi. AI akan menganalisis kos yang dipilih, membandingkan kelebihan dan kekurangannya, kemudian memberikan rekomendasi.
2. **Export AI-Ready Data (JSON & Prompt)** — Pengguna dapat mengekspor hasil pencarian dan perbandingan kos menjadi JSON terstruktur, kemudian menggunakannya untuk bertanya kepada ChatGPT, Gemini, Claude, atau AI lainnya.

Dengan begitu, aplikasi tetap bisa digunakan tanpa Gemini API Key karena perbandingan dan scoring dasar berjalan secara lokal.

---

# 19. Modul AI Recommendation Engine

### 19.1 Konfigurasi Gemini API

Tambahkan halaman:

`Settings → AI Configuration`

Fitur konfigurasi:

- Input Gemini API Key.
- Pilihan model Gemini.
- Tombol Test Connection.
- Status koneksi API.
- Pilihan mengaktifkan atau menonaktifkan AI.
- Pengaturan bahasa hasil analisis.
- Pengaturan panjang dan detail rekomendasi.

**Keamanan:** API Key tidak boleh dimasukkan ke URL atau disimpan dalam plaintext di database. Untuk aplikasi pribadi, paling sederhana simpan key melalui environment variable di server. Jika ingin mendukung input key melalui UI, gunakan penyimpanan terenkripsi di server dan jangan mengembalikan nilainya ke browser setelah disimpan.

### 19.2 Alur rekomendasi AI

```text
Pengguna mencari kos
        |
        v
Sistem mengumpulkan data kos
        |
        v
Filter berdasarkan kebutuhan
        |
        v
Hitung jarak dan fasilitas sekitar
        |
        v
Hitung skor setiap kos
        |
        v
Pengguna memilih 2–10 kos
        |
        v
Klik "Analyze with AI"
        |
        v
Sistem membuat JSON terstruktur
        |
        v
Kirim JSON ke Gemini API
        |
        v
Gemini menganalisis:
- Harga dan total biaya
- Fasilitas kamar
- Jarak dan waktu perjalanan
- Transportasi
- Fasilitas sekitar
- Kelebihan dan kekurangan
- Kesesuaian dengan preferensi
        |
        v
AI memberikan rekomendasi
        |
        v
Tampilkan hasil analisis
```

AI akan berperan sebagai **decision assistant**, bukan pengganti perhitungan sistem.

Artinya, nilai jarak, biaya, dan skor tetap dihitung oleh aplikasi. Gemini bertugas menginterpretasikan hasilnya dan menjelaskan rekomendasi secara natural.

## 20. Export AI-Ready JSON & Prompt

Fitur ini saya sarankan **masuk ke MVP**, bukan pengembangan lanjutan.

Pengguna dapat mengekspor seluruh hasil perbandingan atau hanya kos yang dipilih.

### Pilihan ekspor

| Format | Kegunaan |
|---|---|
| JSON | Analisis menggunakan AI eksternal |
| JSON + Prompt | Langsung ditempel ke ChatGPT/Gemini |
| Markdown | Perbandingan dalam bentuk teks dan tabel |
| CSV | Pengolahan data di spreadsheet |
| Copy to Clipboard | Menyalin hasil tanpa mengunduh file |

### Contoh JSON yang dihasilkan

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "2026-10-26T13:00:00+07:00",
  "office": {
    "name": "Kantor Jakarta Selatan",
    "address": "Jakarta Selatan"
  },
  "preferences": {
    "maxBudget": 2000000,
    "maxCommuteMinutes": 25,
    "transportMode": "motorcycle",
    "requiredFacilities": [
      "AC",
      "WiFi",
      "Private Bathroom"
    ],
    "weights": {
      "price": 25,
      "commute": 30,
      "facilities": 20,
      "nearby": 15,
      "transport": 10
    }
  },
  "listings": [
    {
      "id": "kos-001",
      "name": "Kos Melati",
      "source": "Example Listing",
      "sourceUrl": null,
      "priceMonthly": 1500000,
      "facilities": [
        "AC",
        "WiFi",
        "Private Bathroom",
        "Motorcycle Parking"
      ],
      "distanceToOfficeKm": 1.2,
      "commuteMinutes": 8,
      "nearby": {
        "restaurants": 24,
        "minimarkets": 5,
        "laundry": 8,
        "publicTransportStops": 2
      },
      "scores": {
        "price": 85,
        "commute": 95,
        "facilities": 90,
        "nearby": 92,
        "transport": 80,
        "overall": 89.55
      },
      "dataQuality": {
        "locationVerified": true,
        "priceVerified": false
      }
    }
  ]
}
```

*Data di atas hanya contoh struktur.*

JSON harus memuat seluruh informasi yang relevan, termasuk sumber data, tanggal pengambilan, informasi yang belum diketahui, dan bobot penilaian.

### Fitur Generate AI Prompt

Tambahkan tombol:

**Copy JSON + AI Analysis Prompt**

Aplikasi otomatis membuat prompt seperti:

> Analisis data kos berikut berdasarkan harga, fasilitas, waktu perjalanan ke kantor, akses transportasi, dan fasilitas sekitar.
>
> Bandingkan seluruh kos secara objektif. Jelaskan kelebihan dan kekurangan masing-masing, identifikasi biaya tersembunyi, serta rekomendasikan tiga kos terbaik.
>
> Prioritaskan waktu perjalanan dan total pengeluaran bulanan. Jangan mengarang informasi yang tidak tersedia. Jelaskan jika ada data yang belum terverifikasi.
>
> Gunakan data JSON berikut sebagai sumber utama:
>
> [JSON HASIL PERBANDINGAN]

Dengan demikian, kamu tinggal menyalin prompt tersebut ke ChatGPT atau Gemini tanpa perlu menjelaskan ulang data kos satu per satu.

---

## 21. Tampilan AI Recommendation

Pada halaman perbandingan, tambahkan panel:

```text
┌───────────────────────────────────────────────┐
│           KOS COMPARISON ANALYSIS             │
├───────────────────────────────────────────────┤
│                                               │
│  5 kos dipilih untuk dibandingkan             │
│                                               │
│  [Compare] [Analyze with Gemini ✨]           │
│                                               │
│  EXPORT OPTIONS                               │
│                                               │
│  [Download JSON]  [Copy JSON]                 │
│                                               │
│  [Copy AI Prompt] [Export Markdown]           │
│                                               │
├───────────────────────────────────────────────┤
│                                               │
│  AI RECOMMENDATION                            │
│                                               │
│  🏆 Best Overall: Kos Melati                  │
│                                               │
│  Alasan:                                      │
│  - Jarak paling dekat kantor                  │
│  - Fasilitas memenuhi kebutuhan               │
│  - Total biaya relatif ekonomis               │
│                                               │
│  Kelebihan:                                   │
│  + Waktu perjalanan singkat                   │
│  + Dekat tempat makan                         │
│                                               │
│  Kekurangan:                                  │
│  - Harga bukan yang termurah                  │
│                                               │
│  [Ask Follow-up Question]                     │
│                                               │
└───────────────────────────────────────────────┘
```

### Fitur AI Chat Follow-up

Setelah analisis selesai, pengguna bisa bertanya lebih lanjut.

Contohnya:

- "Kalau gaji saya Rp5 juta, mana yang paling masuk akal?"
- "Saya lebih mementingkan jarak kantor daripada harga."
- "Bandingkan Kos Melati dan Kos Mawar secara mendalam."
- "Kalau saya naik TransJakarta setiap hari, mana yang terbaik?"
- "Buatkan estimasi pengeluaran bulanan untuk tiga kos terbaik."

Gemini akan menggunakan data perbandingan yang sudah ada sebagai konteks.

---

## 22. Struktur Folder Tambahan

Tambahkan modul berikut ke struktur Next.js sebelumnya:

```text
src/
├── app/
│   ├── ai-analysis/
│   │   └── page.tsx
│   │
│   ├── settings/
│   │   └── ai/
│   │       └── page.tsx
│   │
│   └── api/
│       ├── ai/
│       │   ├── analyze/
│       │   │   └── route.ts
│       │   ├── chat/
│       │   │   └── route.ts
│       │   └── test-connection/
│       │       └── route.ts
│       │
│       └── export/
│           ├── json/
│           │   └── route.ts
│           └── markdown/
│               └── route.ts
│
├── server/
│   └── ai/
│       ├── gemini.client.ts
│       ├── recommendation.service.ts
│       ├── prompt.builder.ts
│       └── response.validator.ts
│
├── features/
│   ├── ai-analysis/
│   └── data-export/
│
└── types/
    ├── ai-recommendation.ts
    └── export-schema.ts
```

### Library tambahan

Gunakan SDK resmi `@google/genai` untuk integrasi Gemini. Gemini mendukung structured outputs berbasis JSON Schema, sehingga respons AI dapat dibuat dalam format yang konsisten dan divalidasi menggunakan Zod sebelum ditampilkan. [Google AI for Developers](https://ai.google.dev/gemini-api/docs/structured-output?hl=en\&utm_source=chatgpt.com)

Dokumentasi:
[Gemini API — Getting Started](https://ai.google.dev/gemini-api/docs/get-started?utm_source=chatgpt.com)

---

## 23. Penyesuaian Roadmap

Saya akan memasukkan fitur AI ini ke dalam rencana pengembangan sebelumnya.

| Fitur AI | Prioritas |
|---|---|
| Export JSON hasil pencarian | MVP |
| Export JSON hasil perbandingan | MVP |
| Copy JSON to Clipboard | MVP |
| Generate AI Prompt | MVP |
| Konfigurasi Gemini API Key | MVP |
| Test Gemini API Connection | MVP |
| AI Recommendation | MVP |
| AI Chat Follow-up | MVP |
| Structured JSON Response | MVP |
| Export Markdown | MVP |
| Riwayat percakapan AI | Lanjutan |
| Multi-AI Provider (GPT, Claude, Gemini) | Lanjutan |

Estimasi tambahan untuk modul AI dan ekspor adalah **3–5 hari kerja**, termasuk pengujian.

### Keputusan akhir

Dengan penambahan ini, KosFinder memiliki tiga tingkat analisis:

**Level 1 — Standard Comparison:** Perbandingan otomatis menggunakan algoritma scoring tanpa API AI.

**Level 2 — Gemini AI Analysis:** Analisis langsung di dalam KosFinder menggunakan Gemini API Key yang dikonfigurasi pengguna.

**Level 3 — External AI Analysis:** Ekspor seluruh data perbandingan ke JSON atau prompt siap pakai untuk dianalisis menggunakan ChatGPT, Gemini, Claude, atau model lainnya.

**Ketiganya menggunakan dataset dan hasil perhitungan yang sama**, sehingga tidak terjadi perbedaan angka antara perbandingan standar, analisis Gemini, dan data yang diekspor.

Dengan desain ini, aplikasi tetap berfungsi penuh tanpa AI, tetapi menyediakan analisis yang lebih mendalam ketika pengguna ingin menggunakannya.

Plan kamu sudah kuat di sisi fitur, tapi terlalu gemuk untuk pemakaian pribadi dan ada beberapa lubang di hal yang paling berisiko. Ini review-nya.

## 1. Soal database: tidak perlu server DB, tapi tetap perlu penyimpanan

Kamu benar bahwa tidak perlu MySQL/PostgreSQL. Tapi "tanpa penyimpanan sama sekali" tidak jalan, karena:
- tanpa cache, geocoding, routing, dan Overpass akan dipanggil ulang tiap pencarian (lambat dan kena rate limit)
- favorit, catatan survei, dan hasil import hilang saat restart

Pilihan paling pas untuk kamu: **SQLite (satu file) lewat Drizzle atau Prisma, jalan lokal atau Docker + volume**. Tetap satu proyek Next.js. Kalau mau lebih minimal lagi untuk v0.1, cukup file JSON + cache di folder `.cache/`. Jangan deploy ke Vercel dengan SQLite lokal, karena filesystem-nya tidak persisten.

## 2. Masalah terbesar: sumber data

Seluruh plan bergantung pada data masuk, dan itu bagian paling rapuh. Mamikos punya proteksi anti-bot dan ketentuan yang membatasi crawler (plan-mu sendiri sudah menyebutnya). Saran saya:

**Jadikan "browser extension / bookmarklet" jalur utama ingestion.** Kamu browsing Mamikos seperti biasa, lalu klik "Simpan ke KosFinder" dan data listing yang sedang kamu lihat dikirim ke app lokalmu. Ini jauh lebih stabil daripada scraper server-side, tidak perlu Playwright, dan volumenya wajar karena itu aktivitas browsing pribadi. Jalur cadangannya: paste URL atau teks listing, lalu diparse (regex, atau LLM untuk ekstraksi ke JSON).

Scraper otomatis cukup jadi adapter opsional. Jangan bangun fondasi di atasnya.

## 3. Hal yang belum ada di plan

| Gap | Kenapa penting | Solusi |
|---|---|---|
| **Routing dengan lalu lintas** | Jakarta: 3 km bisa 10 menit atau 45 menit. OSRM/OSM tidak punya data traffic | Google Routes API atau Mapbox (ada free tier, cache hasilnya), dengan jam berangkat 07.00-08.00 |
| **Kualitas POI** | Overpass/OSM di Indonesia sering tidak lengkap (warung, laundry) | Gabung dengan Google Places atau Foursquare hanya untuk kos yang masuk shortlist, bukan semua |
| **Normalisasi harga** | Listing bisa per hari/bulan/tahun, ada harga coret, "mulai dari", biaya tambahan listrik/air | Skema harga: `price_period`, `min_stay`, `is_starting_price`, `extra_fees` |
| **Tipe kamar** | Satu kos punya beberapa tipe kamar dengan harga beda | Model `Property` 1:N `RoomType`, dan scoring dilakukan per tipe kamar |
| **Ketersediaan** | Kos sudah penuh tapi masih tampil | Simpan `lastCheckedAt` dan `availability`, beri label "data X hari lalu" |
| **Koordinat tidak akurat** | Pin listing sering meleset ratusan meter | Tandai `exact / approximate / unknown`, dan tampilkan jarak sebagai perkiraan |
| **Gemini API key** | Plan menyebut input key di UI, tapi itu butuh penyimpanan terenkripsi | Untuk pribadi, pakai `.env` saja |
| **Gerbang kualitas data** | Scoring dari data kosong menghasilkan rekomendasi palsu | Hitung `completeness score`, dan data yang tidak diketahui jangan dihitung sebagai 0 atau gratis |

## 4. Inkonsistensi di plan yang perlu dirapikan

- AI ditulis "lanjutan" di dokumen pertama, lalu "MVP" di dokumen kedua. Putuskan satu.
- Total 15-24 hari + 3-5 hari AI terlalu banyak untuk alat pribadi.
- Stack terlalu berat: Zustand + TanStack Query + Recharts + Vitest + Playwright E2E + Docker sekaligus. Mulai dengan lebih sedikit.
- Multi-AI provider tidak perlu. Export JSON + prompt sudah menutupi ChatGPT/Claude, dan itu fitur paling murah dengan nilai tinggi.

## 5. Fitur tambahan yang menurut saya paling berguna

1. **Isochrone / peta waktu tempuh**: area yang bisa dicapai dalam ≤20 menit dari kantor. Ini lebih berguna daripada lingkaran radius, dan bisa jadi filter pencarian langsung.
2. **Deal-breaker vs preferensi**: fasilitas wajib jadi filter keras, sisanya jadi skor (plan sudah menyinggung ini, jadikan UI utama).
3. **Rasio rent ≤ 30% gaji**: indikator cepat apakah harga masuk akal.
4. **Deteksi listing mencurigakan**: harga jauh di bawah rata-rata area, foto duplikat antar listing, deskripsi kosong.
5. **Template pesan WhatsApp ke pemilik**: pertanyaan yang belum terjawab di listing (listrik, deposit, minimal sewa, jam malam) terisi otomatis dari data yang masih "belum diketahui".
6. **Link Street View/foto lingkungan** per kos untuk cek gang, kondisi jalan, dan kebisingan sebelum survei.
7. **Harga per m²** dan perbandingan dengan median area.
8. **Peta panas harga** agar tahu area mana yang murah tapi masih dekat.
9. **Rute survei**: urutan kunjungan beberapa kos dalam sehari.

## 6. Urutan pengerjaan yang saya sarankan

**Fase 0 (½-1 hari): spike risiko.** Buktikan dulu data bisa masuk. Bikin extension/bookmarklet sederhana, kirim satu listing ke endpoint Next.js, lalu geocode dan hitung rute. Kalau bagian ini gagal, sisa plan tidak berguna.

**v0.1 (≈1 minggu):**
- import (extension + paste) → normalisasi → SQLite
- input titik kantor di peta
- jarak dan waktu tempuh (routing dengan traffic, di-cache)
- filter deal-breaker + peta + daftar
- tabel perbandingan 2-5 kos
- export JSON + prompt AI

**v0.2:** POI sekitar + skor lokasi, kalkulator biaya total bulanan, favorit + status shortlist.

**v0.3:** Gemini API bila masih diperlukan, isochrone, deteksi listing aneh, riwayat harga.

Dengan urutan ini kamu sudah punya alat yang bisa dipakai mencari kos nyata di minggu pertama, bukan setelah 3-4 minggu.

