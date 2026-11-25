import { useEffect, useMemo, useState } from 'react'
import { formatRupiah, tanggalLokal, jamMenit } from '../lib/format'
import * as db from '../lib/penyimpanan'
import { termasukModal } from '../lib/kategori'
import KartuBelanja from './Belanja'
import PeringkatMenu from './PeringkatMenu'

export default function HariIni({ tanggalAwal, drafBelanja, setDrafBelanja, notify }) {
  const [tanggal, setTanggal] = useState(tanggalAwal || tanggalLokal())
  const [trxHari, setTrxHari] = useState([])
  const [pglHari, setPglHari] = useState([])
  const [memuat, setMemuat] = useState(true)

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
  // Peralatan = modal → tidak mengurangi untung (lihat Laporan → Balik Modal)
  const totalPengeluaran = pglHari.filter((p) => !termasukModal(p.kategori)).reduce((s, p) => s + p.nominal, 0)
  const modalHari = pglHari.filter((p) => termasukModal(p.kategori)).reduce((s, p) => s + p.nominal, 0)
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
          <small>Biaya Operasional</small>
          <b>{formatRupiah(totalPengeluaran)}</b>
        </div>
        <div className={`kotak ${laba >= 0 ? 'biru' : 'merah-muda'}`}>
          <small>Untung Bersih</small>
          <b>{formatRupiah(laba)}</b>
        </div>
      </div>
      {modalHari > 0 && (
        <p className="catatan catatan-banding">🛠️ Beli peralatan (modal) hari ini: {formatRupiah(modalHari)} — tidak mengurangi untung.</p>
      )}

      <div className="kartu">
        <strong>🔥 Menu Terlaris</strong>
        <PeringkatMenu key={tanggal} daftar={terlaris} />
      </div>

      <KartuBelanja
        tanggal={tanggal}
        pglHari={pglHari}
        setPglHari={setPglHari}
        draf={drafBelanja}
        setDraf={setDrafBelanja}
        notify={notify}
      />

      <div className="kartu">
        <strong>
          🧾 Daftar Transaksi {trxHari.length > 0 && <small className="jumlah-judul">({trxHari.length})</small>}
        </strong>
        {trxHari.length === 0 && <p className="catatan">Belum ada transaksi.</p>}
        <div className="daftar-gulir">
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
    </div>
  )
}
