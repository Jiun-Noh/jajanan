-- =====================================================================
-- Kasir Jajanan — laporan bulanan (jalankan SETELAH 002_stok.sql)
-- Supabase Dashboard → SQL Editor → New query → tempel → Run. Boleh dijalankan ulang.
--
-- Hanya MEMBACA tabel jajanan_*. Tidak mengubah data apa pun.
-- Total dihitung di database (bukan di HP) supaya tetap benar walau transaksinya ribuan
-- (API Supabase hanya mengirim maks. 1000 baris per permintaan).
-- =====================================================================

-- awal  = tanggal pertama (termasuk), akhir = tanggal setelah hari terakhir (tidak termasuk)
-- zona  = zona waktu HP, mis. 'Asia/Makassar' (WITA) / 'Asia/Jakarta' (WIB),
--         supaya penjualan jam 23:30 tidak terhitung ke hari berikutnya.
create or replace function public.jajanan_laporan(awal date, akhir date, zona text default 'Asia/Makassar')
returns jsonb
language sql
stable
security invoker            -- tetap tunduk pada RLS (hanya akun kasir)
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
           sum(total)::bigint                                   as omzet,
           count(*)::int                                        as transaksi,
           coalesce(sum(total) filter (where metode = 'Tunai'), 0)::bigint as tunai
      from trx
     group by tgl
  ),
  pgl as (
    select tanggal, sum(nominal)::bigint as nominal
      from jajanan_pengeluaran
     where tanggal >= awal and tanggal < akhir
     group by tanggal
  ),
  menu as (
    select i ->> 'nama'                                          as nama,
           sum((i ->> 'qty')::int)::int                          as qty,
           sum((i ->> 'qty')::bigint * (i ->> 'harga')::bigint)  as nominal
      from trx, jsonb_array_elements(trx.items) as i
     group by 1
  )
  select jsonb_build_object(
    'harian', coalesce((select jsonb_agg(jsonb_build_object(
                 'tanggal', tgl, 'omzet', omzet, 'transaksi', transaksi, 'tunai', tunai) order by tgl) from harian), '[]'::jsonb),
    'pengeluaran', coalesce((select jsonb_agg(jsonb_build_object(
                 'tanggal', tanggal, 'nominal', nominal) order by tanggal) from pgl), '[]'::jsonb),
    'menu', coalesce((select jsonb_agg(jsonb_build_object(
                 'nama', nama, 'qty', qty, 'nominal', nominal) order by qty desc, nominal desc) from menu), '[]'::jsonb)
  );
$$;

revoke execute on function public.jajanan_laporan(date, date, text) from public, anon;
grant  execute on function public.jajanan_laporan(date, date, text) to authenticated;
