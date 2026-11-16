import { supabase } from './supabase'

// Semua akses data ke Supabase ada di sini. Tabel: jajanan_menu, jajanan_transaksi,
// jajanan_pengeluaran (lihat supabase/schema.sql). Tidak ada data yang disimpan di HP —
// semuanya langsung dibaca/ditulis ke database.

function periksa({ data, error }) {
  if (error) throw error
  return data
}

// ---------------- Menu ----------------
const KOLOM_MENU = 'id, nama, harga, emoji, kategori, tersedia, urutan, stok'

export async function ambilMenu() {
  return periksa(await supabase.from('jajanan_menu').select(KOLOM_MENU).order('urutan').order('dibuat'))
}

// Stok TIDAK ikut disimpan kecuali denganStok = true (menu baru / stok diubah manual).
// Supaya mengubah nama/harga atau saklar Ada/Habis tidak menimpa stok dengan angka lama
// sementara HP lain sedang berjualan.
export async function simpanMenu(item, { denganStok = false } = {}) {
  const { stok, ...lain } = item
  const data = denganStok ? { ...lain, stok: stok ?? null } : lain
  return periksa(await supabase.from('jajanan_menu').upsert(data).select(KOLOM_MENU).single())
}

// Isi ulang stok: menambah (bukan menimpa). Mengembalikan stok baru.
export async function tambahStok(id, jumlah) {
  return periksa(await supabase.rpc('jajanan_tambah_stok', { menu_id: id, jumlah }))
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

// Kurangi stok + simpan transaksi dalam satu langkah di database (lihat 002_stok.sql).
// Gagal (mis. "Stok Cireng tidak cukup (sisa 0)") → tidak ada yang tersimpan.
export async function simpanTransaksi(t) {
  periksa(await supabase.rpc('jajanan_jual', { trx: t }))
}

// Batalkan transaksi + kembalikan stoknya
export async function hapusTransaksi(id) {
  periksa(await supabase.rpc('jajanan_batal', { trx_id: id }))
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

// ---------------- Laporan bulanan ----------------
// Dihitung di database (lihat 003_laporan.sql). bulan = 'YYYY-MM'.
const ZONA_HP = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Makassar'

export async function ambilLaporan(bulan) {
  const [y, m] = bulan.split('-').map(Number)
  const awal = `${bulan}-01`
  const akhir = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return periksa(await supabase.rpc('jajanan_laporan', { awal, akhir, zona: ZONA_HP }))
}
