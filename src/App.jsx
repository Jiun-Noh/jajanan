import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { supabase, konfigurasiAda } from './lib/supabase'
import * as db from './lib/penyimpanan'
import { formatRupiah } from './lib/format'
import Masuk from './pages/Masuk'
import Kasir from './pages/Kasir'
import HariIni from './pages/HariIni'
import Laporan from './pages/Laporan'
import Menu from './pages/Menu'
import ModalPembaruan from './pages/Pembaruan'
import { PEMBARUAN, VERSI_TERBARU, pembaruanBelumDilihat, tandaiSudahDilihat } from './lib/pembaruan'
import { useAdaVersiBaru } from './lib/versiBaru'

const TAB = [
  { id: 'kasir', label: 'Kasir', ikon: '🛒' },
  { id: 'hariini', label: 'Penjualan', ikon: '📊' },
  { id: 'laporan', label: 'Laporan', ikon: '📈' },
  { id: 'menu', label: 'Menu', ikon: '📋' },
]

export default function App() {
  const [sesi, setSesi] = useState(undefined) // undefined = masih cek, null = belum login

  useEffect(() => {
    if (!konfigurasiAda) return
    supabase.auth.getSession().then(({ data }) => setSesi(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesi(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!konfigurasiAda) {
    return (
      <div className="layar-masuk">
        <h1>⚠️ Belum dikonfigurasi</h1>
        <p className="catatan">Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env, lalu build ulang.</p>
      </div>
    )
  }
  if (sesi === undefined) return <div className="layar-masuk"><p className="catatan">Memuat…</p></div>
  if (!sesi) return <Masuk />
  return <Aplikasi />
}

function Aplikasi() {
  const [tab, setTab] = useState('kasir')
  const [drafBelanja, setDrafBelanja] = useState([]) // daftar belanja yang belum disimpan (tetap ada walau pindah tab)
  const [hariDipilih, setHariDipilih] = useState(null) // dari Laporan → buka Penjualan di tanggal itu
  const [menu, setMenu] = useState([])
  const [memuat, setMemuat] = useState(true)
  const [toast, setToast] = useState(null)
  const [pembaruan, setPembaruan] = useState(pembaruanBelumDilihat) // popup otomatis
  const [riwayatBuka, setRiwayatBuka] = useState(false)
  const adaVersiBaru = useAdaVersiBaru()
  const timerToast = useRef(null)

  const notify = useCallback((pesan) => {
    setToast(pesan)
    clearTimeout(timerToast.current)
    timerToast.current = setTimeout(() => setToast(null), 2500)
  }, [])

  const muatMenu = useCallback(async () => {
    try {
      setMenu(await db.ambilMenu())
    } catch (e) {
      notify(`⚠️ Gagal memuat menu: ${e.message}`)
    } finally {
      setMemuat(false)
    }
  }, [notify])

  // Pindah tab → mulai dari atas. Tanpa ini posisi gulir tab sebelumnya terbawa, dan tab yang
  // lebih pendek terlihat kosong. useLayoutEffect = sebelum layar digambar, jadi tidak berkedip.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  // Muat ulang menu tiap pindah tab → stok selalu terbaru (HP lain mungkin baru berjualan)
  useEffect(() => {
    muatMenu()
  }, [tab, muatMenu])

  // Kembalikan true kalau tersimpan, supaya Kasir tahu boleh mengosongkan keranjang
  async function simpanTransaksi(t) {
    try {
      await db.simpanTransaksi(t)
      notify(`✅ Tersimpan — ${formatRupiah(t.total)}`)
      return true
    } catch (e) {
      notify(`⚠️ ${e.message}`)
      return false
    } finally {
      muatMenu() // ambil stok terbaru, berhasil maupun gagal
    }
  }

  async function simpanMenu(item, opsi) {
    const lama = menu
    const urutan = item.urutan ?? Math.max(-1, ...menu.map((m) => m.urutan ?? 0)) + 1
    const data = { ...item, urutan }
    setMenu((d) => (d.some((m) => m.id === data.id) ? d.map((m) => (m.id === data.id ? data : m)) : [...d, data]))
    try {
      const tersimpan = await db.simpanMenu(data, opsi)
      setMenu((d) => d.map((m) => (m.id === tersimpan.id ? tersimpan : m))) // stok asli dari DB
      return true
    } catch (e) {
      setMenu(lama)
      notify(`⚠️ Gagal menyimpan: ${e.message}`)
      return false
    }
  }

  async function tambahStok(id, jumlah) {
    try {
      const baru = await db.tambahStok(id, jumlah)
      setMenu((d) => d.map((m) => (m.id === id ? { ...m, stok: baru } : m)))
      return baru
    } catch (e) {
      notify(`⚠️ Gagal menambah stok: ${e.message}`)
      return null
    }
  }

  async function hapusMenu(id) {
    const lama = menu
    setMenu((d) => d.filter((m) => m.id !== id))
    try {
      await db.hapusMenu(id)
    } catch (e) {
      setMenu(lama)
      notify(`⚠️ Gagal menghapus: ${e.message}`)
    }
  }

  async function keluar() {
    if (!window.confirm('Keluar dari aplikasi?')) return
    await supabase.auth.signOut({ scope: 'local' }) // HP ini saja, HP lain tetap masuk
  }

  return (
    <div className={`app ${adaVersiBaru ? 'ada-pita' : ''}`}>
      <header className="topbar">
        <span>🍟 Kasir Jajanan</span>
        <button className="btn-atas" onClick={() => setRiwayatBuka(true)} aria-label="Riwayat pembaruan">
          📢
        </button>
      </header>
      {adaVersiBaru && (
        <button className="pita-versi" onClick={() => window.location.reload()}>
          🔄 Versi baru tersedia — ketuk untuk memperbarui
        </button>
      )}

      <main className="konten">
        {memuat ? (
          <p className="catatan">Memuat…</p>
        ) : (
          <>
            {tab === 'kasir' && <Kasir menu={menu} onSimpan={simpanTransaksi} />}
            {tab === 'hariini' && (
              <HariIni tanggalAwal={hariDipilih} drafBelanja={drafBelanja} setDrafBelanja={setDrafBelanja} notify={notify} />
            )}
            {tab === 'laporan' && (
              <Laporan
                onBukaHari={(tgl) => {
                  setHariDipilih(tgl)
                  setTab('hariini')
                }}
                notify={notify}
              />
            )}
            {tab === 'menu' && (
              <Menu menu={menu} onSimpan={simpanMenu} onTambahStok={tambahStok} onHapus={hapusMenu} onKeluar={keluar} notify={notify} />
            )}
          </>
        )}
      </main>

      <nav className="tabbar">
        {TAB.map((t) => (
          <button key={t.id} className={tab === t.id ? 'aktif' : ''} onClick={() => {
              // ketuk tab yang sedang dibuka → gulir halus ke atas
              if (t.id === tab) return window.scrollTo({ top: 0, behavior: 'smooth' })
              setHariDipilih(null)
              setTab(t.id)
            }}>
            <span className="ikon">{t.ikon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {toast && <div className="toast">{toast}</div>}

      {pembaruan.length > 0 && (
        <ModalPembaruan
          daftar={pembaruan}
          onTutup={() => {
            tandaiSudahDilihat()
            setPembaruan([])
          }}
        />
      )}
      {riwayatBuka && <ModalPembaruan daftar={PEMBARUAN} judul={`📢 Riwayat pembaruan · v${VERSI_TERBARU}`} onTutup={() => setRiwayatBuka(false)} />}
    </div>
  )
}
