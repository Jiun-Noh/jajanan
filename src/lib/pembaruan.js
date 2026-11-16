// Riwayat pembaruan aplikasi — yang TERBARU DI ATAS.
// Setiap kali ada pembaruan yang perlu diketahui pengguna, tambahkan satu entri di paling atas
// dengan `versi` baru. Popup "Apa yang baru" akan muncul sekali di tiap HP.
// (Pembaruan kecil yang tidak perlu diumumkan: cukup deploy tanpa menambah entri.)

export const PEMBARUAN = [
  {
    versi: '1.2.0',
    tanggal: '2026-11-17',
    isi: [
      '📈 Tab baru "Laporan": lihat omzet, untung bersih, transaksi, dan belanja bahan selama SEBULAN.',
      '▲▼ Langsung terlihat naik/turun dibanding bulan lalu (untuk bulan berjalan, dibandingkan dengan tanggal yang sama bulan lalu).',
      '📊 Grafik omzet per hari — ketuk batangnya untuk lihat angka hari itu, lalu tekan "Detail →" untuk membuka penjualan hari itu.',
      '🔥 Menu terlaris sebulan, dan tombol ‹ › untuk melihat bulan-bulan sebelumnya.',
      '📜 Daftar transaksi & belanja yang panjang sekarang bisa digulir di dalam kotaknya.',
    ],
  },
  {
    versi: '1.1.0',
    tanggal: '2026-11-16',
    isi: [
      '📦 Stok menu! Di tab Menu, ketuk nama menu lalu isi kolom "Stok". Kosongkan kalau stoknya tidak perlu dihitung (mis. es teh).',
      '➕ Tambah stok: tekan tombol "📦 +" di samping menu untuk menambah stok yang baru dibuat/dibeli.',
      '🛒 Saat berjualan, stok otomatis berkurang. Di Kasir terlihat "Sisa …", dan menu yang stoknya 0 jadi HABIS (tidak bisa dijual).',
      '↩️ Membatalkan transaksi (✕ di tab Penjualan) otomatis mengembalikan stoknya.',
      '☁️ Semua data sekarang langsung tersimpan di server. Kalau internet putus saat bayar, akan muncul pesan gagal — pesanan tidak hilang, tinggal tekan Selesai lagi.',
    ],
  },
  {
    versi: '1.0.0',
    tanggal: '2026-11-15',
    isi: ['🎉 Versi resmi: data tersimpan di server, bisa dibuka di beberapa HP, dan dilindungi PIN.'],
  },
]

export const VERSI_TERBARU = PEMBARUAN[0].versi

const KUNCI = 'jajanan.versiDilihat'

export function versiDilihat() {
  try {
    return localStorage.getItem(KUNCI)
  } catch {
    return null
  }
}

export function tandaiSudahDilihat() {
  try {
    localStorage.setItem(KUNCI, VERSI_TERBARU)
  } catch {
    // private mode — popup mungkin muncul lagi, tidak masalah
  }
}

// Entri yang belum dilihat di HP ini. HP baru (belum pernah lihat) → hanya entri terbaru.
export function pembaruanBelumDilihat() {
  const terakhir = versiDilihat()
  if (terakhir === VERSI_TERBARU) return []
  const i = PEMBARUAN.findIndex((p) => p.versi === terakhir)
  return i === -1 ? PEMBARUAN.slice(0, 1) : PEMBARUAN.slice(0, i)
}
