import { useState } from 'react'
import { formatRupiah, buatId } from '../lib/format'
import { VERSI_TERBARU } from '../lib/pembaruan'

// Makanan dulu, lalu minuman. Usahakan tiap menu punya ikon yang BEDA supaya mudah dibedakan di Kasir.
const PILIHAN_EMOJI = [
  '🍟', '🍢', '🍡', '🌭', '🍗', '🍖', '🍤', '⭐', '❤️', '🥚', '🍳', '🍔', '🍞', '🥐', '🥪', '🥟',
  '🧆', '🍜', '🍙', '🍘', '🌽', '🍠', '🧈', '🍌', '🧇', '🍩',
  '🧋', '🍊', '☕', '💧', '🥤', '🍦',
]
const KATEGORI = ['Makanan', 'Minuman']
const FORM_KOSONG = { nama: '', harga: '', emoji: '🍟', kategori: 'Makanan', stok: '' }
const TAMBAH_CEPAT = [5, 10, 20, 50]

// stok di form berupa teks: '' = tidak dihitung
const keTeksStok = (stok) => (stok == null ? '' : String(stok))
const dariTeksStok = (teks) => (teks.trim() === '' ? null : parseInt(teks, 10))

export default function Menu({ menu, onSimpan, onTambahStok, onHapus, onKeluar, onRiwayat, notify }) {
  const [form, setForm] = useState(null) // null = tertutup; { ...data, id?, stokAwal }
  const [menyimpan, setMenyimpan] = useState(false)
  const [isiStok, setIsiStok] = useState(null) // menu yang sedang diisi ulang

  async function simpan(e) {
    e.preventDefault()
    if (menyimpan) return
    const harga = parseInt(form.harga, 10) || 0
    if (!form.nama.trim() || harga <= 0) {
      notify('⚠️ Isi nama & harga')
      return
    }
    const stok = dariTeksStok(form.stok)
    if (stok !== null && (Number.isNaN(stok) || stok < 0)) {
      notify('⚠️ Stok harus angka 0 atau lebih (kosongkan kalau tidak dihitung)')
      return
    }
    const data = { nama: form.nama.trim(), harga, emoji: form.emoji, kategori: form.kategori, stok }
    const lama = form.id ? menu.find((m) => m.id === form.id) : null
    const item = lama ? { ...lama, ...data } : { id: buatId(), tersedia: true, ...data }
    // stok hanya dikirim kalau menu baru atau angkanya memang diubah di form
    const denganStok = !lama || form.stok.trim() !== form.stokAwal
    setMenyimpan(true)
    const ok = await onSimpan(item, { denganStok })
    setMenyimpan(false)
    if (ok) {
      setForm(null)
      notify('✅ Menu disimpan')
    }
  }

  function hapus(m) {
    if (!window.confirm(`Hapus menu "${m.nama}"?`)) return
    onHapus(m.id)
    setForm(null)
  }

  return (
    <div>
      <button className="btn-utama lebar" onClick={() => setForm(FORM_KOSONG)}>➕ Tambah Menu</button>

      <div className="kartu">
        {menu.map((m) => (
          <div key={m.id} className="baris-item">
            <span
              onClick={() => setForm({ ...m, harga: String(m.harga), stok: keTeksStok(m.stok), stokAwal: keTeksStok(m.stok) })}
              style={{ cursor: 'pointer', flex: 1 }}
            >
              <span style={{ fontSize: 22 }}>{m.emoji}</span> <b>{m.nama}</b>
              <br />
              <small>{m.kategori} · {formatRupiah(m.harga)}</small>
              {m.stok != null && (
                <small className={`label-stok ${m.stok === 0 ? 'habis' : m.stok <= 3 ? 'menipis' : ''}`}>
                  {' '}· 📦 {m.stok === 0 ? 'Stok habis' : `Stok ${m.stok}`}
                </small>
              )}
            </span>
            {m.stok != null && (
              <button className="btn-stok" onClick={() => setIsiStok(m)}>📦 +</button>
            )}
            <label className="saklar">
              <input
                type="checkbox"
                checked={m.tersedia}
                onChange={() => onSimpan({ ...m, tersedia: !m.tersedia })}
              />
              <span>{m.tersedia ? 'Ada' : 'Habis'}</span>
            </label>
          </div>
        ))}
      </div>
      <p className="catatan">
        ⓘ Ketuk nama menu buat ubah. Tekan 📦 + untuk menambah stok. Matikan saklar kalau bahannya habis — menu jadi
        abu-abu di Kasir. Menu yang stoknya dihitung otomatis berkurang saat terjual dan tidak bisa dijual kalau stok 0.
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <button className="btn-teks" onClick={onRiwayat}>📢 Riwayat pembaruan · v{VERSI_TERBARU}</button>
        <button className="btn-teks merah" onClick={onKeluar}>🔒 Keluar</button>
      </div>

      {isiStok && (
        <ModalIsiStok
          m={menu.find((x) => x.id === isiStok.id) || isiStok}
          onTutup={() => setIsiStok(null)}
          onTambah={async (jumlah) => {
            const baru = await onTambahStok(isiStok.id, jumlah)
            if (baru != null) {
              notify(`✅ Stok ${isiStok.nama} sekarang ${baru}`)
              setIsiStok(null)
            }
          }}
        />
      )}

      {form && (
        <div className="overlay" onClick={() => setForm(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={simpan}>
            <div className="modal-judul">
              <span>{form.id ? '✏️ Ubah Menu' : '➕ Menu Baru'}</span>
              <button type="button" className="btn-teks" onClick={() => setForm(null)}>✕</button>
            </div>
            <label className="label">Nama</label>
            <input className="input" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} placeholder="Contoh: Kentang Goreng" />
            <label className="label">Harga (Rp)</label>
            <input className="input" type="number" inputMode="numeric" value={form.harga} onChange={(e) => setForm((f) => ({ ...f, harga: e.target.value }))} placeholder="10000" />
            <label className="label">Stok</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min="0"
              value={form.stok}
              onChange={(e) => setForm((f) => ({ ...f, stok: e.target.value }))}
              placeholder="Kosongkan kalau stok tidak dihitung"
            />
            <small className="catatan">
              Kosong = tidak dihitung (mis. es teh yang dibuat langsung). Isi angka = jumlah stok sekarang.
            </small>
            <label className="label">Kategori</label>
            <div className="chip-baris">
              {KATEGORI.map((k) => (
                <button type="button" key={k} className={`chip ${form.kategori === k ? 'aktif' : ''}`} onClick={() => setForm((f) => ({ ...f, kategori: k }))}>
                  {k}
                </button>
              ))}
            </div>
            <label className="label">Ikon</label>
            <div className="grid-emoji">
              {PILIHAN_EMOJI.map((em) => (
                <button type="button" key={em} className={form.emoji === em ? 'aktif' : ''} onClick={() => setForm((f) => ({ ...f, emoji: em }))}>
                  {em}
                </button>
              ))}
            </div>
            <button className="btn-utama lebar" type="submit" disabled={menyimpan}>{menyimpan ? 'Menyimpan…' : '💾 Simpan'}</button>
            {form.id && (
              <button type="button" className="btn-teks merah" onClick={() => hapus(form)} style={{ width: '100%', marginTop: 8 }}>
                🗑️ Hapus menu ini
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  )
}

function ModalIsiStok({ m, onTutup, onTambah }) {
  const [jumlah, setJumlah] = useState('')
  const [menyimpan, setMenyimpan] = useState(false)
  const n = parseInt(jumlah, 10) || 0

  async function kirim(e) {
    e.preventDefault()
    if (n <= 0 || menyimpan) return
    setMenyimpan(true)
    await onTambah(n)
    setMenyimpan(false)
  }

  return (
    <div className="overlay" onClick={onTutup}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={kirim}>
        <div className="modal-judul">
          <span>📦 Tambah Stok</span>
          <button type="button" className="btn-teks" onClick={onTutup}>✕</button>
        </div>
        <p>
          {m.emoji} <b>{m.nama}</b> — stok sekarang <b>{m.stok ?? 0}</b>
        </p>
        <label className="label">Tambah berapa?</label>
        <div className="chip-baris">
          {TAMBAH_CEPAT.map((x) => (
            <button type="button" key={x} className={`chip ${n === x ? 'aktif' : ''}`} onClick={() => setJumlah(String(x))}>
              +{x}
            </button>
          ))}
        </div>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min="1"
          autoFocus
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value)}
          placeholder="Jumlah"
        />
        {n > 0 && <p className="catatan">Stok jadi {(m.stok ?? 0) + n}</p>}
        <button className="btn-utama lebar" type="submit" disabled={n <= 0 || menyimpan}>
          {menyimpan ? 'Menyimpan…' : '✅ Tambah'}
        </button>
      </form>
    </div>
  )
}
