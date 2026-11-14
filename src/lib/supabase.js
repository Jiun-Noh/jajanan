import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const EMAIL_LOGIN = import.meta.env.VITE_LOGIN_EMAIL || 'kasir@jajanan.app'
export const konfigurasiAda = Boolean(url && anonKey)

export const supabase = konfigurasiAda
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null
