import { supabase } from './supabase'
import { tanggalLokal } from './format'

// Semua akses data ke Supabase ada di sini. Tabel: jajanan_menu, jajanan_transaksi,
// jajanan_pengeluaran (lihat supabase/schema.sql).

export const MENU_CONTOH = [
  { id: 'm1', nama: 'Kentang Goreng', harga: 10000, emoji: '🍟', kategori: 'Makanan', tersedia: true },
  { id: 'm2', nama: 'Cireng', harga: 5000, emoji: '🥟', kategori: 'Makanan', tersedia: true },
  { id: 'm3', nama: 'Cilok', harga: 10000, emoji: '🍡', kategori: 'Makanan', tersedia: true },
  { id: 'm4', nama: 'Sosis Bakar', harga: 5000, emoji: '🌭', kategori: 'Makanan', tersedia: true },
  { id: 'm5', nama: 'Tahu Crispy', harga: 8000, emoji: '🧈', kategori: 'Makanan', tersedia: true },
  { id: 'm6', nama: 'Telur Gulung', harga: 2000, emoji: '🍢', kategori: 'Makanan', tersedia: true },
  { id: 'm7', nama: 'Pisang Goreng', harga: 3000, emoji: '🍌', kategori: 'Makanan', tersedia: true },
  { id: 'm8', nama: 'Es Teh Manis', harga: 3000, emoji: '🧋', kategori: 'Minuman', tersedia: true },
  { id: 'm9', nama: 'Es Jeruk', harga: 5000, emoji: '🍊', kategori: 'Minuman', tersedia: true },
  { id: 'm10', nama: 'Air Mineral', harga: 4000, emoji: '💧', kategori: 'Minuman', tersedia: true },
]

function periksa({ data, error }) {
  if (error) throw error
  return data
}

// ---------------- Menu ----------------
const KOLOM_MENU = 'id, nama, harga, emoji, kategori, tersedia, urutan'

export async function ambilMenu() {
  return periksa(await supabase.from('jajanan_menu').select(KOLOM_MENU).order('urutan').order('dibuat'))
}

export async function simpanMenu(item) {
  return periksa(await supabase.from('jajanan_menu').upsert(item).select(KOLOM_MENU).single())
}

export async function simpanBanyakMenu(items) {
  periksa(await supabase.from('jajanan_menu').upsert(items))
}

export async function hapusMenu(id) {
  periksa(await supabase.from('jajanan_menu').delete().eq('id', id))
}

// ---------------- Transaksi ----------------
// Rentang 1 hari menurut jam HP (WIB/WITA/WIT), bukan UTC.
function rentangHari(tanggal) {
  const [y, m, d] = tanggal.split('-').map(Number)
  return [new Date(y, m - 1, d).toISOString(), new Date(y, m - 1, d + 1).toISOString()]
}

export async function ambilTransaksi(tanggal) {
  const [awal, akhir] = rentangHari(tanggal)
  return periksa(
    await supabase
      .from('jajanan_transaksi')
      .select('*')
      .gte('waktu', awal)
      .lt('waktu', akhir)
      .order('waktu', { ascending: false }),
  )
}

export async function kirimTransaksi(t) {
  // upsert + ignoreDuplicates: aman kalau terkirim dua kali (mis. sinyal putus setelah tersimpan)
  periksa(await supabase.from('jajanan_transaksi').upsert(t, { onConflict: 'id', ignoreDuplicates: true }))
}

export async function hapusTransaksi(id) {
  periksa(await supabase.from('jajanan_transaksi').delete().eq('id', id))
}

// ---------------- Pengeluaran ----------------
export async function ambilPengeluaran(tanggal) {
  return periksa(
    await supabase
      .from('jajanan_pengeluaran')
      .select('id, tanggal, deskripsi, nominal')
      .eq('tanggal', tanggal)
      .order('dibuat', { ascending: false }),
  )
}

export async function tambahPengeluaran(p) {
  periksa(await supabase.from('jajanan_pengeluaran').insert(p))
}

export async function hapusPengeluaran(id) {
  periksa(await supabase.from('jajanan_pengeluaran').delete().eq('id', id))
}

// ---------------- Antrean offline (transaksi) ----------------
// Kalau sinyal hilang saat bayar, transaksi disimpan dulu di HP lalu dikirim ulang otomatis.
const KUNCI_ANTREAN = 'jajanan.antrean'

export function bacaAntrean() {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_ANTREAN)) || []
  } catch {
    return []
  }
}

export function tulisAntrean(daftar) {
  try {
    localStorage.setItem(KUNCI_ANTREAN, JSON.stringify(daftar))
  } catch {
    // storage penuh / private mode
  }
}

export function antreanUntuk(tanggal) {
  return bacaAntrean().filter((t) => tanggalLokal(t.waktu) === tanggal)
}

// ---------------- Pindah data lama dari prototipe (localStorage) ----------------
const KUNCI_LAMA = { menu: 'jajanan.menu', transaksi: 'jajanan.transaksi', pengeluaran: 'jajanan.pengeluaran' }

function bacaLama(kunci) {
  try {
    return JSON.parse(localStorage.getItem(kunci)) || []
  } catch {
    return []
  }
}

export function dataLama() {
  return {
    menu: bacaLama(KUNCI_LAMA.menu),
    transaksi: bacaLama(KUNCI_LAMA.transaksi),
    pengeluaran: bacaLama(KUNCI_LAMA.pengeluaran),
  }
}

// Menu lama dianggap "berisi" kalau sudah diubah dari menu contoh bawaan prototipe
function menuLamaDiubah(menu) {
  const ringkas = (d) => JSON.stringify(d.map(({ id, nama, harga, emoji, kategori, tersedia }) => [id, nama, harga, emoji, kategori, tersedia]))
  return menu.length > 0 && ringkas(menu) !== ringkas(MENU_CONTOH)
}

export function adaDataLama() {
  const d = dataLama()
  return d.transaksi.length > 0 || d.pengeluaran.length > 0 || menuLamaDiubah(d.menu)
}

// Pindahkan semua data prototipe dari HP ini ke database.
// Menu di database DIGANTI dengan menu dari HP ini (transaksi lama tidak terpengaruh,
// karena isi pesanan disimpan sebagai salinan nama & harga).
export async function pindahkanDataLama() {
  const d = dataLama()
  if (d.menu.length) {
    await simpanBanyakMenu(d.menu.map((m, i) => ({ ...m, urutan: i })))
    const ids = d.menu.map((m) => m.id).join(',')
    periksa(await supabase.from('jajanan_menu').delete().not('id', 'in', `(${ids})`))
  }
  if (d.transaksi.length) {
    periksa(await supabase.from('jajanan_transaksi').upsert(d.transaksi, { onConflict: 'id', ignoreDuplicates: true }))
  }
  if (d.pengeluaran.length) {
    periksa(await supabase.from('jajanan_pengeluaran').upsert(d.pengeluaran, { onConflict: 'id', ignoreDuplicates: true }))
  }
  hapusDataLama()
}

export function hapusDataLama() {
  Object.values(KUNCI_LAMA).forEach((k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      // abaikan
    }
  })
}
