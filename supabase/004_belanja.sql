-- =====================================================================
-- Kasir Jajanan — kategori belanja, saran barang, laporan belanja
-- (jalankan SETELAH 003_laporan.sql)
-- Supabase Dashboard → SQL Editor → New query → tempel → Run. Boleh dijalankan ulang.
--
-- Hanya menyentuh objek berawalan "jajanan_". Tabel lain tidak diubah.
-- =====================================================================

-- ---------- Kategori pengeluaran ----------
-- Bahan | Bumbu | Kemasan | Gas | Lain  = biaya operasional (mengurangi untung)
-- Peralatan                              = modal (stand, panci, wajan …) — TIDAK mengurangi untung,
--                                          dilaporkan terpisah sebagai "balik modal"
alter table public.jajanan_pengeluaran
  add column if not exists kategori text not null default 'Bahan';

do $$
begin
  alter table public.jajanan_pengeluaran
    add constraint jajanan_pengeluaran_kategori_cek
    check (kategori in ('Bahan', 'Bumbu', 'Kemasan', 'Gas', 'Lain', 'Peralatan'));
exception when duplicate_object then null;
end $$;

create index if not exists jajanan_pengeluaran_deskripsi_idx on public.jajanan_pengeluaran (deskripsi);

-- ---------- Saran "Sering dibeli" ----------
-- Satu baris per nama barang: kategori & harga TERAKHIR, berapa kali dibeli.
create or replace function public.jajanan_barang_sering(batas integer default 80)
returns table (nama text, kategori text, harga integer, kali integer, terakhir date)
language sql
stable
security invoker
set search_path = public
as $$
  select nama, kategori, harga, kali, terakhir
    from (
      select distinct on (deskripsi)
             deskripsi                                         as nama,
             kategori,
             nominal                                           as harga,
             (count(*) over (partition by deskripsi))::integer as kali,
             tanggal                                           as terakhir
        from jajanan_pengeluaran
       order by deskripsi, tanggal desc, dibuat desc
    ) s
   order by kali desc, terakhir desc
   limit batas;
$$;

-- ---------- Laporan bulanan (versi baru, menggantikan 003) ----------
create or replace function public.jajanan_laporan(awal date, akhir date, zona text default 'Asia/Makassar')
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with trx as (
    select (waktu at time zone zona)::date as tgl, total, metode, items
      from jajanan_transaksi
     where waktu >= (awal::timestamp  at time zone zona)
       and waktu <  (akhir::timestamp at time zone zona)
  ),
  harian as (
    select tgl,
           sum(total)::bigint                                              as omzet,
           count(*)::int                                                   as transaksi,
           coalesce(sum(total) filter (where metode = 'Tunai'), 0)::bigint as tunai
      from trx
     group by tgl
  ),
  pgl_bulan as (
    select * from jajanan_pengeluaran where tanggal >= awal and tanggal < akhir
  ),
  pgl as (
    select tanggal,
           coalesce(sum(nominal) filter (where kategori <> 'Peralatan'), 0)::bigint as nominal, -- operasional
           coalesce(sum(nominal) filter (where kategori =  'Peralatan'), 0)::bigint as modal
      from pgl_bulan
     group by tanggal
  ),
  per_kategori as (
    select kategori, sum(nominal)::bigint as nominal, count(*)::int as kali
      from pgl_bulan
     group by kategori
  ),
  barang as (
    select deskripsi                                       as nama,
           (array_agg(kategori order by tanggal desc))[1]  as kategori,
           count(*)::int                                   as kali,
           sum(nominal)::bigint                            as total,
           round(avg(nominal))::bigint                     as rata,
           min(nominal)                                    as termurah,
           max(nominal)                                    as termahal
      from pgl_bulan
     where kategori <> 'Peralatan'
     group by deskripsi
  ),
  menu as (
    select i ->> 'nama'                                          as nama,
           sum((i ->> 'qty')::int)::int                          as qty,
           sum((i ->> 'qty')::bigint * (i ->> 'harga')::bigint)  as nominal
      from trx, jsonb_array_elements(trx.items) as i
     group by 1
  ),
  -- Sejak awal sampai akhir bulan ini — untuk "balik modal"
  sepanjang as (
    select
      (select coalesce(sum(total), 0) from jajanan_transaksi
        where waktu < (akhir::timestamp at time zone zona))::bigint                    as omzet,
      (select coalesce(sum(nominal), 0) from jajanan_pengeluaran
        where tanggal < akhir and kategori <> 'Peralatan')::bigint                     as operasional,
      (select coalesce(sum(nominal), 0) from jajanan_pengeluaran
        where tanggal < akhir and kategori =  'Peralatan')::bigint                     as modal
  )
  select jsonb_build_object(
    'harian', coalesce((select jsonb_agg(jsonb_build_object(
                 'tanggal', tgl, 'omzet', omzet, 'transaksi', transaksi, 'tunai', tunai) order by tgl) from harian), '[]'::jsonb),
    'pengeluaran', coalesce((select jsonb_agg(jsonb_build_object(
                 'tanggal', tanggal, 'nominal', nominal, 'modal', modal) order by tanggal) from pgl), '[]'::jsonb),
    'kategori', coalesce((select jsonb_agg(jsonb_build_object(
                 'kategori', kategori, 'nominal', nominal, 'kali', kali) order by nominal desc) from per_kategori), '[]'::jsonb),
    'barang', coalesce((select jsonb_agg(jsonb_build_object(
                 'nama', nama, 'kategori', kategori, 'kali', kali, 'total', total, 'rata', rata,
                 'termurah', termurah, 'termahal', termahal) order by total desc) from barang), '[]'::jsonb),
    'menu', coalesce((select jsonb_agg(jsonb_build_object(
                 'nama', nama, 'qty', qty, 'nominal', nominal) order by qty desc, nominal desc) from menu), '[]'::jsonb),
    'sepanjang', (select jsonb_build_object('omzet', omzet, 'operasional', operasional, 'modal', modal) from sepanjang)
  );
$$;

revoke execute on function public.jajanan_barang_sering(integer)      from public, anon;
grant  execute on function public.jajanan_barang_sering(integer)      to authenticated;
revoke execute on function public.jajanan_laporan(date, date, text)   from public, anon;
grant  execute on function public.jajanan_laporan(date, date, text)   to authenticated;
