import { useEffect, useMemo, useState } from 'react'
import { formatRupiah, buatId } from '../lib/format'
import { KATEGORI_BELANJA, infoKategori, termasukModal } from '../lib/kategori'
import * as db from '../lib/penyimpanan'

const FORM_KOSONG = { nama: '', harga: '', kategori: 'Bahan' }
const sama = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

// Harga jauh beda dari biasanya (≥3× atau ≤⅓) → minta konfirmasi. Mencegah salah ketik 0.
function hargaJanggal(harga, biasa) {
  if (!biasa) return false
  return harga >= biasa * 3 || harga * 3 <= biasa
}

/**
 * Kartu belanja di tab Penjualan.
 * - "Sering dibeli": ketuk → nama, kategori & harga terakhir terisi otomatis
 * - Barang ditampung dulu di daftar (seperti struk), lalu "Simpan semua" sekaligus
 * - Ketuk barang yang sudah tersimpan untuk mengubahnya
 */
export default function KartuBelanja({ tanggal, pglHari, setPglHari, draf, setDraf, notify }) {
  const [form, setForm] = useState(FORM_KOSONG)
  const [sering, setSering] = useState([])
  const [menyimpan, setMenyimpan] = useState(false)
  const [diubah, setDiubah] = useState(null) // pengeluaran tersimpan yang sedang diedit

  function muatSering() {
    db.ambilBarangSering()
      .then(setSering)
      .catch(() => {}) // saran hanya pelengkap — kalau gagal, input manual tetap jalan
  }
  useEffect(muatSering, [])

  // Saran: kosong → yang paling sering; sedang mengetik → yang namanya cocok
  const saran = useMemo(() => {
    const q = form.nama.trim().toLowerCase()
    const daftar = q ? sering.filter((s) => s.nama.toLowerCase().includes(q) && !sama(s.nama, form.nama)) : sering
    return daftar.slice(0, q ? 8 : 12)
  }, [sering, form.nama])

  const biasaUntuk = (nama) => sering.find((s) => sama(s.nama, nama))

  function pilihSaran(s) {
    setForm({ nama: s.nama, harga: String(s.harga), kategori: s.kategori })
  }

  const formTerisi = form.nama !== '' || form.harga !== '' || form.kategori !== FORM_KOSONG.kategori

  // Salah ketik / salah pilih saran → kembali ke awal (termasuk kategori yang ikut terisi)
  function kosongkanForm() {
    setForm(FORM_KOSONG)
  }

  // Ketuk barang di daftar → naik lagi ke form untuk diperbaiki
  function ubahDraf(p) {
    setForm({ nama: p.deskripsi, harga: String(p.nominal), kategori: p.kategori })
    setDraf((d) => d.filter((x) => x.sementara !== p.sementara))
  }

  function kosongkanDraf() {
    if (window.confirm(`Hapus semua ${draf.length} barang dari daftar? (Belum ada yang tersimpan)`)) setDraf([])
  }

  function tambahKeDraf(e) {
    e.preventDefault()
    const harga = parseInt(form.harga, 10) || 0
    const nama = form.nama.trim().replace(/\s+/g, ' ')
    if (!nama || harga <= 0) {
      notify('⚠️ Isi nama barang & harga')
      return
    }
    const biasa = biasaUntuk(nama)
    if (biasa && hargaJanggal(harga, biasa.harga)) {
      const ok = window.confirm(
        `Harga ${nama} biasanya ${formatRupiah(biasa.harga)}.\n\nBenar ${formatRupiah(harga)}?`,
      )
      if (!ok) return
    }
    // pakai penulisan nama yang sudah ada supaya laporan per barang tetap satu
    const namaFinal = biasa ? biasa.nama : nama
    setDraf((d) => [...d, { sementara: buatId(), deskripsi: namaFinal, nominal: harga, kategori: form.kategori }])
    setForm((f) => ({ ...FORM_KOSONG, kategori: f.kategori }))
  }

  async function simpanSemua() {
    if (!draf.length || menyimpan) return
    setMenyimpan(true)
    try {
      const baris = draf.map(({ deskripsi, nominal, kategori }) => ({ id: buatId(), tanggal, deskripsi, nominal, kategori }))
      const tersimpan = await db.tambahBanyakPengeluaran(baris)
      setPglHari((d) => [...tersimpan, ...d])
      setDraf([])
      notify(`✅ ${tersimpan.length} barang disimpan — ${formatRupiah(tersimpan.reduce((s, p) => s + p.nominal, 0))}`)
      muatSering()
    } catch (err) {
      notify(`⚠️ Gagal menyimpan (cek sinyal): ${err.message}`)
    } finally {
      setMenyimpan(false)
    }
  }

  async function hapusTersimpan(p) {
    if (!window.confirm(`Hapus "${p.deskripsi}" (${formatRupiah(p.nominal)})?`)) return
    try {
      await db.hapusPengeluaran(p.id)
      setPglHari((d) => d.filter((x) => x.id !== p.id))
      setDiubah(null)
    } catch (err) {
      notify(`⚠️ Gagal menghapus: ${err.message}`)
    }
  }

  async function simpanUbahan(p, data) {
    try {
      const baru = await db.ubahPengeluaran(p.id, data)
      setPglHari((d) => d.map((x) => (x.id === p.id ? baru : x)))
      setDiubah(null)
      notify('✅ Diperbarui')
      muatSering()
    } catch (err) {
      notify(`⚠️ Gagal menyimpan: ${err.message}`)
    }
  }

  const totalDraf = draf.reduce((s, p) => s + p.nominal, 0)
  const totalHari = pglHari.reduce((s, p) => s + p.nominal, 0)

  return (
    <div className="kartu">
      <strong>
        🧺 Belanja / Pengeluaran{' '}
        {pglHari.length > 0 && (
          <small className="jumlah-judul">
            ({pglHari.length}) · {formatRupiah(totalHari)}
          </small>
        )}
      </strong>

      <form onSubmit={tambahKeDraf} className="form-belanja">
        {/* Tinggi area saran SELALU sama (ada/tidak ada saran) supaya kolom input di bawahnya tidak naik-turun saat mengetik */}
        <small className="label-kecil">{form.nama.trim() ? 'Mungkin maksudnya:' : '⭐ Sering dibeli — ketuk untuk isi otomatis'}</small>
        <div className="chip-gulir area-saran">
          {saran.map((s) => (
            <button type="button" key={s.nama} className="chip chip-saran" onClick={() => pilihSaran(s)}>
              {infoKategori(s.kategori).ikon} {s.nama}
            </button>
          ))}
          {saran.length === 0 && (
            <span className="saran-kosong">
              {!form.nama.trim() || sering.length === 0
                ? 'Belum ada riwayat belanja'
                : biasaUntuk(form.nama)
                  ? `✓ Sudah pernah dibeli · terakhir ${formatRupiah(biasaUntuk(form.nama).harga)}`
                  : '🆕 Barang baru — belum pernah dibeli'}
            </span>
          )}
        </div>

        <div className={`input-dengan-tombol ${formTerisi ? 'ada-tombol' : ''}`}>
          <input
            className="input"
            placeholder="Nama barang, mis. Kentang 2kg"
            value={form.nama}
            onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
          />
          {formTerisi && (
            <button type="button" className="btn-kosongkan" onClick={kosongkanForm} aria-label="Kosongkan isian">
              ✕ Kosongkan
            </button>
          )}
        </div>
        <div className="chip-baris chip-kategori">
          {KATEGORI_BELANJA.map((k) => (
            <button
              type="button"
              key={k.id}
              className={`chip ${form.kategori === k.id ? 'aktif' : ''}`}
              onClick={() => setForm((f) => ({ ...f, kategori: k.id }))}
            >
              {k.ikon} {k.label}
            </button>
          ))}
        </div>
        {termasukModal(form.kategori) && (
          <small className="catatan">🛠️ Peralatan = modal (stand, panci, wajan…). Tidak mengurangi untung harian.</small>
        )}
        <div className="form-baris">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="Harga (Rp)"
            value={form.harga}
            onChange={(e) => setForm((f) => ({ ...f, harga: e.target.value }))}
          />
          <button className="btn-utama kecil" type="submit">＋ Tambah</button>
        </div>
      </form>

      {draf.length > 0 && (
        <div className="draf-belanja">
          <div className="judul-draf">
            <small className="label-kecil">🧾 Belum disimpan — cocokkan dengan struk · ketuk untuk ubah</small>
            <button className="btn-teks merah" onClick={kosongkanDraf}>Kosongkan</button>
          </div>
          {draf.map((p) => (
            <div key={p.sementara} className="baris-item">
              <span onClick={() => ubahDraf(p)} style={{ cursor: 'pointer', flex: 1 }}>
                {infoKategori(p.kategori).ikon} {p.deskripsi}
              </span>
              <span>
                {formatRupiah(p.nominal)}{' '}
                <button className="btn-teks merah" onClick={() => setDraf((d) => d.filter((x) => x.sementara !== p.sementara))}>
                  ✕
                </button>
              </span>
            </div>
          ))}
          <button className="btn-utama lebar" onClick={simpanSemua} disabled={menyimpan}>
            {menyimpan ? 'Menyimpan…' : `💾 Simpan semua (${draf.length}) — ${formatRupiah(totalDraf)}`}
          </button>
        </div>
      )}

      {pglHari.length > 0 && (
        <>
          <small className="label-kecil" style={{ marginTop: 12 }}>Tersimpan · ketuk untuk ubah · ✕ untuk hapus</small>
          <div className="daftar-gulir">
            {pglHari.map((p) => (
              <div key={p.id} className="baris-item" onClick={() => setDiubah(p)} style={{ cursor: 'pointer' }}>
                <span>
                  {infoKategori(p.kategori).ikon} {p.deskripsi}
                </span>
                <span>
                  {formatRupiah(p.nominal)}{' '}
                  <button
                    className="btn-teks merah"
                    aria-label={`Hapus ${p.deskripsi}`}
                    onClick={(e) => {
                      e.stopPropagation() // jangan ikut membuka layar ubah
                      hapusTersimpan(p)
                    }}
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {diubah && (
        <ModalUbah p={diubah} onTutup={() => setDiubah(null)} onSimpan={simpanUbahan} onHapus={hapusTersimpan} notify={notify} />
      )}
    </div>
  )
}

function ModalUbah({ p, onTutup, onSimpan, onHapus, notify }) {
  const [f, setF] = useState({ deskripsi: p.deskripsi, nominal: String(p.nominal), kategori: p.kategori })
  const [menyimpan, setMenyimpan] = useState(false)

  async function kirim(e) {
    e.preventDefault()
    const nominal = parseInt(f.nominal, 10) || 0
    if (!f.deskripsi.trim() || nominal <= 0) return notify('⚠️ Isi nama barang & harga')
    setMenyimpan(true)
    await onSimpan(p, { deskripsi: f.deskripsi.trim().replace(/\s+/g, ' '), nominal, kategori: f.kategori })
    setMenyimpan(false)
  }

  return (
    <div className="overlay" onClick={onTutup}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={kirim}>
        <div className="modal-judul">
          <span>✏️ Ubah Belanja</span>
          <button type="button" className="btn-teks" onClick={onTutup}>✕</button>
        </div>
        <label className="label">Nama barang</label>
        <input className="input" value={f.deskripsi} onChange={(e) => setF((x) => ({ ...x, deskripsi: e.target.value }))} />
        <label className="label">Harga (Rp)</label>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          value={f.nominal}
          onChange={(e) => setF((x) => ({ ...x, nominal: e.target.value }))}
        />
        <label className="label">Kategori</label>
        <div className="chip-baris">
          {KATEGORI_BELANJA.map((k) => (
            <button
              type="button"
              key={k.id}
              className={`chip ${f.kategori === k.id ? 'aktif' : ''}`}
              onClick={() => setF((x) => ({ ...x, kategori: k.id }))}
            >
              {k.ikon} {k.label}
            </button>
          ))}
        </div>
        <button className="btn-utama lebar" type="submit" disabled={menyimpan}>
          {menyimpan ? 'Menyimpan…' : '💾 Simpan'}
        </button>
        <button type="button" className="btn-teks merah" onClick={() => onHapus(p)} style={{ width: '100%', marginTop: 8 }}>
          🗑️ Hapus
        </button>
      </form>
    </div>
  )
}
