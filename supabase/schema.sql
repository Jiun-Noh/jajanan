-- =====================================================================
-- Kasir Jajanan — skema database
-- Jalankan SEKALI di Supabase Dashboard → SQL Editor → New query → Run.
--
-- Aman untuk tabel lama: hanya MEMBUAT tabel baru berawalan "jajanan_".
-- Tidak ada DROP / ALTER / DELETE ke tabel lain. Boleh dijalankan ulang.
-- =====================================================================

-- Email akun login aplikasi (harus sama dengan user yang dibuat di
-- Authentication → Users, dan dengan VITE_LOGIN_EMAIL di file .env).
-- Hanya akun ini yang boleh baca/tulis tabel jajanan_*.
create or replace function public.jajanan_boleh_akses()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'kasir@jajanan.app'
$$;

-- ---------- Menu ----------
create table if not exists public.jajanan_menu (
  id         text primary key,
  nama       text        not null,
  harga      integer     not null check (harga >= 0),
  emoji      text        not null default '🍟',
  kategori   text        not null default 'Makanan',
  tersedia   boolean     not null default true,
  urutan     integer     not null default 0,
  dibuat     timestamptz not null default now()
);

-- ---------- Transaksi penjualan ----------
-- items = snapshot isi pesanan saat dibayar: [{id, nama, harga, qty}, ...]
-- (disimpan apa adanya supaya laporan lama tidak berubah kalau harga menu diubah)
create table if not exists public.jajanan_transaksi (
  id         text primary key,
  waktu      timestamptz not null default now(),
  items      jsonb       not null default '[]'::jsonb,
  total      integer     not null check (total >= 0),
  metode     text        not null check (metode in ('Tunai', 'QRIS')),
  diterima   integer     not null default 0,
  kembalian  integer     not null default 0
);
create index if not exists jajanan_transaksi_waktu_idx on public.jajanan_transaksi (waktu desc);

-- ---------- Pengeluaran / belanja bahan ----------
create table if not exists public.jajanan_pengeluaran (
  id         text primary key,
  tanggal    date        not null,
  deskripsi  text        not null,
  nominal    integer     not null check (nominal > 0),
  dibuat     timestamptz not null default now()
);
create index if not exists jajanan_pengeluaran_tanggal_idx on public.jajanan_pengeluaran (tanggal);

-- ---------- Keamanan (Row Level Security) ----------
-- Tanpa login yang benar, tabel ini tidak bisa dibaca/ditulis sama sekali,
-- walaupun seseorang tahu URL & anon key.
alter table public.jajanan_menu        enable row level security;
alter table public.jajanan_transaksi   enable row level security;
alter table public.jajanan_pengeluaran enable row level security;

drop policy if exists jajanan_menu_akses        on public.jajanan_menu;
drop policy if exists jajanan_transaksi_akses   on public.jajanan_transaksi;
drop policy if exists jajanan_pengeluaran_akses on public.jajanan_pengeluaran;

create policy jajanan_menu_akses on public.jajanan_menu
  for all to authenticated
  using (public.jajanan_boleh_akses()) with check (public.jajanan_boleh_akses());

create policy jajanan_transaksi_akses on public.jajanan_transaksi
  for all to authenticated
  using (public.jajanan_boleh_akses()) with check (public.jajanan_boleh_akses());

create policy jajanan_pengeluaran_akses on public.jajanan_pengeluaran
  for all to authenticated
  using (public.jajanan_boleh_akses()) with check (public.jajanan_boleh_akses());

grant select, insert, update, delete on public.jajanan_menu,
  public.jajanan_transaksi, public.jajanan_pengeluaran to authenticated;
