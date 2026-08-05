# Webhook Booking — Cara Pasang & Deploy

`booking-webhook.gs` adalah sumber kode Apps Script yang menerima booking dari
omentrip.com dan menulisnya ke **dua** spreadsheet sekaligus:

| Spreadsheet | Sheet | Isi |
| --- | --- | --- |
| `Customer_Recap_Data` | `Data Tamu & Pembayaran` | Rekap kerja harian (tamu, tagihan, status DP) |
| `Omen Trip - Data Pesanan` | `Bookings` | Log mentah semua pesanan yang masuk |

File ini **tidak ikut jalan di GitHub Pages** — ini hanya salinan sumber supaya
kodenya ikut ter-version-control. Yang benar-benar berjalan adalah project Apps
Script di akun Google `japan@omentrip.com`.

## Kenapa dulu datanya berhenti masuk

1. **Nama field payload berubah, script-nya tidak.** Website sempat diganti
   mengirim `tanggalISO` / `hargaSatuan`, padahal script masih membaca
   `tanggal` / `total` / `dp`. Field yang tidak dikenal jadi kosong — itu sebabnya
   di `Bookings` baris 2 Agustus ke bawah kolom *Departure Date*, *Total*, dan
   *Deposit* jadi blank.
2. **Satu URL webhook hanya bisa menulis ke satu tujuan.** Saat `CFG.sheetsWebhook`
   dialihkan ke script `Customer_Recap_Data`, `Omen Trip - Data Pesanan` otomatis
   berhenti terisi. Script baru ini menulis ke keduanya dari satu deployment.
3. **Tiap kali deploy dibuat sebagai "Deployment baru", URL-nya ikut berubah**,
   dan `index.html` masih menunjuk URL lama. Lihat cara menghindarinya di
   langkah 5 di bawah.

## Langkah pasang

1. Buka <https://script.google.com> dengan akun **japan@omentrip.com**.
2. Buka project webhook yang sudah ada (atau **New project** kalau mulai baru).
3. Hapus seluruh isi `Code.gs`, lalu **tempel seluruh isi `booking-webhook.gs`**.
   ID kedua spreadsheet sudah tertulis di bagian atas file — tidak perlu diubah
   selama nama file spreadsheet-nya tidak diganti-ganti.
4. **Save** (ikon disket).
5. **Deploy:**
   - Kalau project ini **sudah pernah di-deploy**: klik `Deploy` →
     `Manage deployments` → klik ikon **pensil (Edit)** pada deployment yang ada →
     `Version:` pilih **New version** → `Deploy`.
     👉 Cara ini **mempertahankan URL `/exec` yang sama**, jadi `index.html`
     tidak perlu diubah lagi. Ini yang selama ini terlewat.
   - Kalau **belum pernah**: `Deploy` → `New deployment` → gear → `Web app`, isi:
     - `Execute as:` **Me (japan@omentrip.com)**
     - `Who has access:` **Anyone** ← wajib "Anyone", bukan "Anyone with Google account".
       Kalau salah di sini, request dari website ditolak diam-diam tanpa error di browser.
   - Setujui permission yang diminta (akses Spreadsheet).
6. **Tes dari editor:** pilih fungsi `tesWebhook` di dropdown atas, klik `Run`.
   Harus muncul satu baris "TES WEBHOOK — hapus baris ini" di **kedua**
   spreadsheet. Hapus baris tes itu setelah dicek.
7. **Tes deployment-nya hidup:** buka URL `/exec` langsung di browser. Harus
   muncul `{"ok":true,"pesan":"Webhook Omen Trip aktif...` — kalau yang muncul
   halaman login Google, berarti `Who has access` masih salah (ulangi langkah 5).
8. Kalau URL `/exec`-nya berubah (karena membuat deployment baru), update
   `CFG.sheetsWebhook` di `index.html` dengan URL yang baru.

## Kalau nanti mau menambah/mengubah data yang dikirim

`kirimSheet()` di `index.html` mengirim nilai **mentah dan terformat sekaligus**:

| Field | Contoh | Dipakai untuk |
| --- | --- | --- |
| `nama`, `whatsapp`, `catatan` | `"Budi"`, `"+62812..."` | keduanya |
| `paket`, `durasi` | `"Winter Trip"`, `"One Day Trip"` | keduanya |
| `jumlah` | `2` (angka) | keduanya |
| `hargaSatuan`, `mataUang` | `22000`, `"JPY"` | rekap (kolom angka) |
| `dpPersen`, `totalAngka`, `dpAngka` | `50`, `44000`, `22000` | rekap |
| `tanggalISO` | `"2026-12-25"` | rekap (kolom tanggal asli) |
| `tanggal`, `total`, `dp` | `"25 Desember 2026"`, `"¥44.000"` | log `Bookings` (teks apa adanya) |

**Jangan menghapus field lama saat menambah yang baru.** Script membaca
berdasarkan nama field; field yang hilang akan menghasilkan kolom kosong —
persis kegagalan nomor 1 di atas.

## Catatan keterbatasan yang perlu diketahui

- **Dewasa vs anak:** form website hanya menanyakan total tamu, jadi semua tamu
  ditulis ke kolom *Jml Dewasa* dan *Jml Anak* diisi `0`. Kalau ada anak,
  koreksi manual — pengingatnya sudah ikut ditulis di kolom *Catatan*.
- **Mata uang:** kolom harga di `Customer_Recap_Data` berbasis ¥, sedangkan
  Hokkaido Trip dihargai dalam Rupiah. Angkanya tetap ditulis apa adanya dan
  kolom *Catatan* diberi tanda `⚠ Harga dalam IDR, bukan ¥`.
- **DP Diterima** selalu ditulis `0` dan **Status DP** selalu `Belum DP`.
  Itu memang disengaja sesuai sheet "Cara Pakai": ubah manual setelah transfer
  benar-benar diverifikasi masuk.
- **Kolom otomatis** (*Total Tamu*, *Total Tagihan*, *Sisa Bayar*) ditulis
  sebagai rumus, jadi ikut berubah kalau angka dewasa/anak/DP dikoreksi manual.

## Kalau data tetap tidak masuk

Cek berurutan:

1. Buka URL `/exec` di browser — hidup atau tidak (langkah 7 di atas).
2. Apps Script → **Executions**: lihat apakah ada eksekusi `doPost` masuk.
   - Tidak ada eksekusi sama sekali → masalah di sisi website/URL/akses.
   - Ada tapi gagal → baca pesan error-nya; script ini mencatat detail lewat
     `console.log`/`console.error`.
3. Di browser, buka omentrip.com → DevTools → tab Network → kirim booking tes →
   cari request ke `script.google.com`. Karena dikirim `no-cors`/`sendBeacon`,
   isinya tidak bisa dibaca, tapi request-nya harus terlihat keluar.
