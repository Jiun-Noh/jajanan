import { useEffect, useMemo, useState } from 'react'
import { formatRupiah, tanggalLokal, jamMenit, buatId } from '../lib/format'
import * as db from '../lib/penyimpanan'

export default function HariIni({ notify }) {
  const [tanggal, setTanggal] = useState(tanggalLokal())
  const [formP, setFormP] = useState({ deskripsi: '', nominal: '' })
  const [trxHari, setTrxHari] = useState([])
  const [pglHari, setPglHari] = useState([])
  const [memuat, setMemuat] = useState(true)
  const [menyimpan, setMenyimpan] = useState(false)

  useEffect(() => {
    let batal = false
    setMemuat(true)
    Promise.all([db.ambilTransaksi(tanggal), db.ambilPengeluaran(tanggal)])
      .then(([t, p]) => {
        if (batal) return
        setTrxHari(t)
        setPglHari(p)
      })
      .catch((e) => !batal && notify(`⚠️ Gagal memuat: ${e.message}`))
      .finally(() => !batal && setMemuat(false))
    return () => {
      batal = true
    }
  }, [tanggal, notify])

  const omzet = trxHari.reduce((s, t) => s + t.total, 0)
  const tunai = trxHari.filter((t) => t.metode === 'Tunai').reduce((s, t) => s + t.total, 0)
  const qris = omzet - tunai
  const totalPengeluaran = pglHari.reduce((s, p) => s + p.nominal, 0)
  const laba = omzet - totalPengeluaran

  const terlaris = useMemo(() => {
    const per = {}
    trxHari.forEach((t) =>
      t.items.forEach((i) => {
        per[i.nama] = per[i.nama] || { nama: i.nama, qty: 0, nominal: 0 }
        per[i.nama].qty += i.qty
        per[i.nama].nominal += i.qty * i.harga
      }),
    )
    return Object.values(per).sort((a, b) => b.qty - a.qty)
  }, [trxHari])

  async function tambahPengeluaran(e) {
    e.preventDefault()
    if (menyimpan) return
    const nominal = parseInt(formP.nominal, 10) || 0
    if (!formP.deskripsi.trim() || nominal <= 0) {
      notify('⚠️ Isi keterangan & nominal')
      return
    }
    const p = { id: buatId(), tanggal, deskripsi: formP.deskripsi.trim(), nominal }
    setMenyimpan(true)
    try {
      await db.tambahPengeluaran(p)
      setPglHari((d) => [p, ...d])
      setFormP({ deskripsi: '', nominal: '' })
    } catch (err) {
      notify(`⚠️ Gagal menyimpan (cek sinyal): ${err.message}`)
    } finally {
      setMenyimpan(false)
    }
  }

  async function hapusPengeluaran(id) {
    try {
      await db.hapusPengeluaran(id)
      setPglHari((d) => d.filter((p) => p.id !== id))
    } catch (err) {
      notify(`⚠️ Gagal menghapus: ${err.message}`)
    }
  }

  async function hapusTransaksi(t) {
    if (!window.confirm('Batalkan transaksi ini? Stoknya akan dikembalikan.')) return
    try {
      await db.hapusTransaksi(t.id)
      setTrxHari((d) => d.filter((x) => x.id !== t.id))
    } catch (err) {
      notify(`⚠️ Gagal membatalkan: ${err.message}`)
    }
  }

  return (
    <div>
      <div className="baris-tanggal">
        <input className="input" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        {tanggal !== tanggalLokal() && (
          <button className="chip" onClick={() => setTanggal(tanggalLokal())}>Hari ini</button>
        )}
      </div>
      {memuat && <p className="catatan">Memuat…</p>}

      <div className="grid-ringkas">
        <div className="kotak hijau">
          <small>Omzet</small>
          <b>{formatRupiah(omzet)}</b>
        </div>
        <div className="kotak">
          <small>Transaksi</small>
          <b>{trxHari.length}</b>
        </div>
        <div className="kotak">
          <small>💵 Tunai</small>
          <b>{formatRupiah(tunai)}</b>
        </div>
        <div className="kotak">
          <small>📱 QRIS</small>
          <b>{formatRupiah(qris)}</b>
        </div>
        <div className="kotak merah-muda">
          <small>Belanja Bahan</small>
          <b>{formatRupiah(totalPengeluaran)}</b>
        </div>
        <div className={`kotak ${laba >= 0 ? 'biru' : 'merah-muda'}`}>
          <small>Untung Bersih</small>
          <b>{formatRupiah(laba)}</b>
        </div>
      </div>

      <div className="kartu">
        <strong>🔥 Menu Terlaris</strong>
        {terlaris.length === 0 && <p className="catatan">Belum ada penjualan.</p>}
        {terlaris.map((m, i) => (
          <div key={m.nama} className="baris-item">
            <span>{i + 1}. {m.nama}</span>
            <span><b>{m.qty}×</b> <small>{formatRupiah(m.nominal)}</small></span>
          </div>
        ))}
      </div>

      <div className="kartu">
        <strong>🧺 Belanja Bahan / Pengeluaran</strong>
        <form onSubmit={tambahPengeluaran} className="form-baris">
          <input
            className="input"
            placeholder="Contoh: Kentang 5kg, minyak, gas"
            value={formP.deskripsi}
            onChange={(e) => setFormP((f) => ({ ...f, deskripsi: e.target.value }))}
          />
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="Rp"
            value={formP.nominal}
            onChange={(e) => setFormP((f) => ({ ...f, nominal: e.target.value }))}
            style={{ maxWidth: 110 }}
          />
          <button className="btn-utama kecil" type="submit" disabled={menyimpan}>+</button>
        </form>
        {pglHari.map((p) => (
          <div key={p.id} className="baris-item">
            <span>{p.deskripsi}</span>
            <span>
              {formatRupiah(p.nominal)}{' '}
              <button className="btn-teks merah" onClick={() => hapusPengeluaran(p.id)}>✕</button>
            </span>
          </div>
        ))}
      </div>

      <div className="kartu">
        <strong>🧾 Daftar Transaksi</strong>
        {trxHari.length === 0 && <p className="catatan">Belum ada transaksi.</p>}
        {trxHari.map((t) => (
          <div key={t.id} className="baris-item">
            <span>
              <b>{jamMenit(t.waktu)}</b> · {t.metode === 'Tunai' ? '💵' : '📱'} {t.metode}
              <br />
              <small>{t.items.map((i) => `${i.nama} ×${i.qty}`).join(', ')}</small>
            </span>
            <span>
              <b>{formatRupiah(t.total)}</b>{' '}
              <button className="btn-teks merah" onClick={() => hapusTransaksi(t)}>
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
