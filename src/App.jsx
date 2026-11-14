import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, konfigurasiAda } from './lib/supabase'
import * as db from './lib/penyimpanan'
import { formatRupiah } from './lib/format'
import Masuk from './pages/Masuk'
import Kasir from './pages/Kasir'
import HariIni from './pages/HariIni'
import Menu from './pages/Menu'

const TAB = [
  { id: 'kasir', label: 'Kasir', ikon: '🛒' },
  { id: 'hariini', label: 'Penjualan', ikon: '📊' },
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
  const [menu, setMenu] = useState([])
  const [memuat, setMemuat] = useState(true)
  const [antrean, setAntrean] = useState(db.bacaAntrean)
  const [versi, setVersi] = useState(0) // naik tiap ada transaksi terkirim → Penjualan muat ulang
  const [toast, setToast] = useState(null)
  const sedangKirim = useRef(false)
  const sudahMulai = useRef(false)
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
    }
  }, [notify])

  // Kirim transaksi yang tertahan di HP. Mengembalikan true kalau antrean kosong.
  const kirimAntrean = useCallback(async () => {
    if (sedangKirim.current) return false
    sedangKirim.current = true
    let adaTerkirim = false
    try {
      // baca ulang tiap putaran, supaya transaksi yang baru masuk ikut terkirim
      for (let t = db.bacaAntrean()[0]; t; t = db.bacaAntrean()[0]) {
        try {
          await db.kirimTransaksi(t)
        } catch {
          break // masih offline — coba lagi nanti
        }
        db.tulisAntrean(db.bacaAntrean().filter((x) => x.id !== t.id))
        adaTerkirim = true
      }
    } finally {
      sedangKirim.current = false
    }
    const sisa = db.bacaAntrean()
    setAntrean(sisa)
    if (adaTerkirim) setVersi((v) => v + 1)
    return sisa.length === 0
  }, [])

  // Muat awal + pindahkan data prototipe (localStorage) kalau ada
  useEffect(() => {
    if (sudahMulai.current) return // StrictMode menjalankan effect dua kali di mode dev
    sudahMulai.current = true
    ;(async () => {
      try {
        const lama = db.dataLama()
        let daftar = await db.ambilMenu()
        if (daftar.length === 0) {
          const awal = lama.menu.length ? lama.menu : db.MENU_CONTOH
          await db.simpanBanyakMenu(awal.map((m, i) => ({ ...m, urutan: i })))
          daftar = await db.ambilMenu()
        }
        if (db.adaDataLama()) {
          const ok = window.confirm(
            `Ada data lama di HP ini (${lama.transaksi.length} transaksi, ${lama.pengeluaran.length} pengeluaran).\n\nPindahkan ke database sekarang?`,
          )
          if (ok) {
            await db.pindahkanDataLama()
            notify('✅ Data lama sudah dipindahkan')
            setVersi((v) => v + 1)
          }
        }
        setMenu(daftar)
      } catch (e) {
        notify(`⚠️ Gagal memuat data: ${e.message}`)
      } finally {
        setMemuat(false)
      }
    })()
  }, [notify])

  // Coba kirim ulang antrean: saat dibuka, saat sinyal kembali, dan tiap 30 detik
  useEffect(() => {
    kirimAntrean()
    const ulang = () => db.bacaAntrean().length && kirimAntrean()
    window.addEventListener('online', ulang)
    const id = setInterval(ulang, 30000)
    return () => {
      window.removeEventListener('online', ulang)
      clearInterval(id)
    }
  }, [kirimAntrean])

  async function simpanTransaksi(t) {
    // Simpan dulu di HP supaya tidak hilang, baru dikirim
    db.tulisAntrean([...db.bacaAntrean(), t])
    setAntrean(db.bacaAntrean())
    const terkirim = await kirimAntrean()
    notify(terkirim ? `✅ Tersimpan — ${formatRupiah(t.total)}` : `⏳ Disimpan di HP — dikirim saat ada sinyal`)
  }

  function hapusDariAntrean(id) {
    db.tulisAntrean(db.bacaAntrean().filter((t) => t.id !== id))
    setAntrean(db.bacaAntrean())
  }

  async function simpanMenu(item) {
    const lama = menu
    const urutan = item.urutan ?? Math.max(-1, ...menu.map((m) => m.urutan ?? 0)) + 1
    const data = { ...item, urutan }
    setMenu((d) => (d.some((m) => m.id === data.id) ? d.map((m) => (m.id === data.id ? data : m)) : [...d, data]))
    try {
      await db.simpanMenu(data)
      return true
    } catch (e) {
      setMenu(lama)
      notify(`⚠️ Gagal menyimpan: ${e.message}`)
      return false
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
    if (antrean.length && !window.confirm(`Masih ada ${antrean.length} transaksi belum terkirim. Tetap keluar?`)) return
    await supabase.auth.signOut()
  }

  return (
    <div className="app">
      <header className="topbar">
        <span>🍟 Kasir Jajanan</span>
        {antrean.length > 0 && (
          <button className="badge-sinkron" onClick={kirimAntrean} title="Ketuk untuk kirim ulang">
            ⏳ {antrean.length} belum terkirim
          </button>
        )}
      </header>

      <main className="konten">
        {memuat ? (
          <p className="catatan">Memuat…</p>
        ) : (
          <>
            {tab === 'kasir' && <Kasir menu={menu} onSimpan={simpanTransaksi} />}
            {tab === 'hariini' && (
              <HariIni antrean={antrean} versi={versi} onHapusAntrean={hapusDariAntrean} notify={notify} />
            )}
            {tab === 'menu' && (
              <Menu menu={menu} onSimpan={simpanMenu} onHapus={hapusMenu} onMuatUlang={muatMenu} onKeluar={keluar} notify={notify} />
            )}
          </>
        )}
      </main>

      <nav className="tabbar">
        {TAB.map((t) => (
          <button key={t.id} className={tab === t.id ? 'aktif' : ''} onClick={() => setTab(t.id)}>
            <span className="ikon">{t.ikon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
