/**
 * Omen Trip — webhook pencatat booking dari omentrip.com
 *
 * SATU deployment ini menulis ke DUA spreadsheet sekaligus:
 *   1. Customer_Recap_Data      → sheet "Data Tamu & Pembayaran"  (rekap kerja harian)
 *   2. Omen Trip - Data Pesanan → sheet "Bookings"                (log mentah semua pesanan)
 *
 * Dipanggil oleh kirimSheet() di index.html lewat CFG.sheetsWebhook.
 * Cara pasang & deploy: lihat apps-script/README.md di repo omen-trip.
 */

// ---------------------------------------------------------------------------
// Konfigurasi — ID diambil dari URL spreadsheet:
// docs.google.com/spreadsheets/d/<ID_ADA_DI_SINI>/edit
// ---------------------------------------------------------------------------
var REKAP_ID    = '1PKUU0Fzb7wZU7CDCg6i0xvNSjechK8q9U2xX11i4rKY';
var REKAP_SHEET = 'Data Tamu & Pembayaran';

var LOG_ID      = '1yKO-rJJvotdqTi-UePvaPK-ESN2GUouScGWhY2lxelE';
var LOG_SHEET   = 'Bookings';

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Dibuka lewat browser untuk cek cepat: kalau muncul {"ok":true,...} berarti
 * deployment hidup dan izin aksesnya sudah benar.
 */
function doGet() {
  return json({
    ok: true,
    pesan: 'Webhook Omen Trip aktif. Booking dikirim lewat POST.',
    tujuan: [REKAP_SHEET, LOG_SHEET]
  });
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    console.error('Payload bukan JSON: ' + err);
    return json({ok: false, error: 'Payload bukan JSON: ' + err});
  }

  var hasil = {ok: true, rekap: null, log: null};

  // Dua tujuan ditulis terpisah supaya satu spreadsheet bermasalah
  // tidak ikut menggagalkan pencatatan ke spreadsheet yang lain.
  try {
    hasil.rekap = tulisRekap(data);
  } catch (err) {
    hasil.ok = false;
    hasil.rekap = 'ERROR: ' + err;
    console.error('Gagal menulis ke ' + REKAP_SHEET + ': ' + err);
  }

  try {
    hasil.log = tulisLog(data);
  } catch (err) {
    hasil.ok = false;
    hasil.log = 'ERROR: ' + err;
    console.error('Gagal menulis ke ' + LOG_SHEET + ': ' + err);
  }

  console.log(JSON.stringify({payload: data, hasil: hasil}));
  return json(hasil);
}

// ---------------------------------------------------------------------------
// Tujuan 1 — Customer_Recap_Data / "Data Tamu & Pembayaran"
// Kolom A..Q: No, Tanggal Keberangkatan, Kota/Trip, Nama Tamu, No. WhatsApp,
// Jml Dewasa, Jml Anak, Total Tamu, Harga/Dewasa, Harga/Anak, Total Tagihan,
// DP Diterima, Sisa Bayar, Status DP, Status Lunas, Tanggal Booking, Catatan.
// ---------------------------------------------------------------------------
function tulisRekap(d) {
  var sh = SpreadsheetApp.openById(REKAP_ID).getSheetByName(REKAP_SHEET);
  if (!sh) throw new Error('Sheet "' + REKAP_SHEET + '" tidak ditemukan di Customer_Recap_Data');

  var baris = barisKosongBerikutnya(sh, 2, 4); // header di baris 1, cek kolom D (Nama Tamu)
  siapkanRuang(sh, baris, 17);

  var dewasa = angka(d.jumlah);
  var harga  = angka(d.hargaSatuan);

  // WhatsApp & tanggal dipaksa formatnya dulu supaya "+62..." tidak jadi angka
  // dan tanggal tidak tampil sebagai serial number.
  sh.getRange(baris, 5).setNumberFormat('@');
  sh.getRange(baris, 2).setNumberFormat('yyyy-mm-dd');
  sh.getRange(baris, 16).setNumberFormat('yyyy-mm-dd');

  sh.getRange(baris, 1, 1, 17).setValues([[
    baris - 1,                                                  // A  No
    tanggalDari(d.tanggalISO),                                  // B  Tanggal Keberangkatan
    d.paket || '',                                              // C  Kota/Trip
    d.nama || '',                                               // D  Nama Tamu
    String(d.whatsapp || ''),                                   // E  No. WhatsApp
    dewasa,                                                     // F  Jml Dewasa
    0,                                                          // G  Jml Anak
    '=F' + baris + '+G' + baris,                                // H  Total Tamu (otomatis)
    harga,                                                      // I  Harga/Dewasa
    0,                                                          // J  Harga/Anak
    '=F' + baris + '*I' + baris + '+G' + baris + '*J' + baris,  // K  Total Tagihan (otomatis)
    0,                                                          // L  DP Diterima — diisi manual setelah transfer diverifikasi
    '=K' + baris + '-L' + baris,                                // M  Sisa Bayar (otomatis)
    opsiDropdown(sh, baris, 14, 'Belum DP'),                    // N  Status DP
    opsiDropdown(sh, baris, 15, 'Belum Lunas'),                 // O  Status Lunas
    new Date(),                                                 // P  Tanggal Booking
    catatanRekap(d)                                             // Q  Catatan
  ]]);

  return 'baris ' + baris;
}

/**
 * Website hanya menanyakan total tamu, belum memisah dewasa/anak, dan kolom
 * harga di sheet ini berbasis ¥. Info yang tidak punya kolom sendiri
 * dititipkan ke Catatan supaya tidak hilang.
 */
function catatanRekap(d) {
  var bagian = [];
  if (d.mataUang && d.mataUang !== 'JPY') {
    bagian.push('⚠ Harga dalam ' + d.mataUang + ', bukan ¥');
  }
  bagian.push('Booking otomatis dari website');
  if (d.durasi) bagian.push(d.durasi);
  if (d.dpAngka) bagian.push('DP diharapkan: ' + angka(d.dpAngka).toLocaleString('en-US'));
  bagian.push('Semua tamu dicatat sebagai dewasa — koreksi manual bila ada anak');
  if (d.catatan && d.catatan !== '-') bagian.push('Catatan tamu: ' + d.catatan);
  return bagian.join(' — ');
}

// ---------------------------------------------------------------------------
// Tujuan 2 — Omen Trip - Data Pesanan / "Bookings"
// Kolom A..K: Timestamp, Name, WhatsApp, Package, Guests, Departure Date,
// Total, Deposit, Notes, Booking Type, Confirmation Deadline.
// ---------------------------------------------------------------------------
function tulisLog(d) {
  var sh = SpreadsheetApp.openById(LOG_ID).getSheetByName(LOG_SHEET);
  if (!sh) throw new Error('Sheet "' + LOG_SHEET + '" tidak ditemukan di Omen Trip - Data Pesanan');

  var baris = barisKosongBerikutnya(sh, 2, 2); // header di baris 1, cek kolom B (Name)
  siapkanRuang(sh, baris, 11);

  sh.getRange(baris, 3).setNumberFormat('@');

  var paket = d.paket || '';
  if (d.durasi) paket += ' (' + d.durasi + ')';

  sh.getRange(baris, 1, 1, 11).setValues([[
    new Date(),                                          // A  Timestamp
    d.nama || '',                                        // B  Name
    String(d.whatsapp || ''),                            // C  WhatsApp
    paket,                                               // D  Package
    d.jumlah != null ? d.jumlah + ' orang' : '',         // E  Guests
    d.tanggal || d.tanggalISO || '',                     // F  Departure Date
    d.total || '',                                       // G  Total
    d.dp || '',                                          // H  Deposit
    d.catatan || '-',                                    // I  Notes
    'Booking + Bayar DP',                                // J  Booking Type
    ''                                                   // K  Confirmation Deadline
  ]]);

  return 'baris ' + baris;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Baris pertama yang benar-benar kosong, dilihat dari kolom kunci. */
function barisKosongBerikutnya(sh, mulai, kolomKunci) {
  var maks = sh.getMaxRows();
  if (maks < mulai) return mulai;
  var nilai = sh.getRange(mulai, kolomKunci, maks - mulai + 1, 1).getValues();
  for (var i = nilai.length - 1; i >= 0; i--) {
    if (String(nilai[i][0]).trim() !== '') return mulai + i + 1;
  }
  return mulai;
}

/** Pastikan sheet punya cukup baris & kolom sebelum ditulis. */
function siapkanRuang(sh, baris, jumlahKolom) {
  if (baris > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), baris - sh.getMaxRows());
  if (jumlahKolom > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), jumlahKolom - sh.getMaxColumns());
}

/**
 * Kolom status memakai dropdown bilingual ("Belum DP / 未入金"). Teks persisnya
 * dibaca dari data validation supaya nilai yang ditulis tidak dianggap invalid
 * kalau labelnya diubah sewaktu-waktu.
 */
function opsiDropdown(sh, baris, kolom, awalan) {
  var barisContoh = [baris, 2];
  for (var b = 0; b < barisContoh.length; b++) {
    var dv = sh.getRange(barisContoh[b], kolom).getDataValidation();
    if (!dv) continue;
    var kriteria = dv.getCriteriaValues();
    var opsi = kriteria && kriteria[0];
    if (!opsi || !opsi.length) continue;
    for (var i = 0; i < opsi.length; i++) {
      if (String(opsi[i]).indexOf(awalan) === 0) return opsi[i];
    }
  }
  return awalan;
}

/**
 * "2026-12-25" → Date jam 12 siang UTC. Dikunci ke UTC (bukan zona waktu
 * proyek script) supaya tanggal yang tersimpan tidak bergantung pada zona
 * waktu proyek Apps Script vs. zona waktu spreadsheet — kalau keduanya beda
 * cukup jauh, Date yang dibuat di zona waktu lokal bisa tampil mundur/maju
 * satu hari saat dirender Sheets. Jam 12 siang UTC aman untuk zona waktu
 * manapun yang dipakai kedua belah pihak (Indonesia/Jepang jauh dari batas
 * ±12 jam ke UTC).
 */
function tanggalDari(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return iso || '';
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
}

function angka(v) {
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Tes manual — jalankan dari editor Apps Script (pilih fungsi tesWebhook → Run).
// Menulis satu baris contoh ke kedua spreadsheet; hapus baris itu setelah dicek.
// ---------------------------------------------------------------------------
function tesWebhook() {
  var hasil = doPost({
    postData: {
      contents: JSON.stringify({
        nama: 'TES WEBHOOK — hapus baris ini',
        whatsapp: '+6281234567890',
        paket: 'Winter Trip',
        durasi: 'One Day Trip',
        jumlah: 2,
        hargaSatuan: 22000,
        mataUang: 'JPY',
        dpPersen: 50,
        totalAngka: 44000,
        dpAngka: 22000,
        tanggalISO: '2026-12-25',
        catatan: 'baris tes dari Apps Script',
        tanggal: '25 Desember 2026',
        total: '¥44.000',
        dp: '¥22.000'
      })
    }
  });
  console.log(hasil.getContent());
}
