import { useState } from 'react'
import { supabase, EMAIL_LOGIN } from '../lib/supabase'

const PANJANG_PIN = 6
const TOMBOL = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export default function Masuk() {
  const [pin, setPin] = useState('')
  const [galat, setGalat] = useState('')
  const [memproses, setMemproses] = useState(false)

  async function coba(nilai) {
    setMemproses(true)
    const { error } = await supabase.auth.signInWithPassword({ email: EMAIL_LOGIN, password: nilai })
    setMemproses(false)
    if (error) {
      setGalat(error.message === 'Invalid login credentials' ? 'PIN salah, coba lagi' : `Gagal masuk: ${error.message}`)
      setPin('')
    }
    // kalau berhasil, App otomatis pindah ke halaman kasir (onAuthStateChange)
  }

  function tekan(k) {
    if (memproses) return
    setGalat('')
    if (k === '⌫') return setPin((p) => p.slice(0, -1))
    if (!k || pin.length >= PANJANG_PIN) return
    const baru = pin + k
    setPin(baru)
    if (baru.length === PANJANG_PIN) coba(baru)
  }

  return (
    <div className="layar-masuk">
      <div className="logo-masuk">🍟</div>
      <h1>Kasir Jajanan</h1>
      <p className="catatan">Masukkan PIN untuk membuka aplikasi</p>

      <div className={`titik-pin ${galat ? 'goyang' : ''}`}>
        {Array.from({ length: PANJANG_PIN }).map((_, i) => (
          <span key={i} className={i < pin.length ? 'isi' : ''} />
        ))}
      </div>
      <div className="pesan-masuk">{memproses ? 'Memeriksa…' : galat}</div>

      <div className="papan-pin">
        {TOMBOL.map((k, i) =>
          k ? (
            <button key={i} onClick={() => tekan(k)} disabled={memproses}>
              {k}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  )
}
