-- =====================================================================
-- Kasir Jajanan — fitur stok (jalankan SETELAH schema.sql)
-- Supabase Dashboard → SQL Editor → New query → tempel → Run. Boleh dijalankan ulang.
--
-- Hanya menyentuh objek berawalan "jajanan_". Tabel lain tidak diubah.
-- =====================================================================

-- stok NULL  = stok tidak dihitung (mis. es teh yang dibuat langsung)
-- stok angka = stok dihitung; berkurang otomatis saat terjual, tidak bisa minus
alter table public.jajanan_menu
  add column if not exists stok integer check (stok is null or stok >= 0);

-- ---------- Jual: kurangi stok + simpan transaksi, dalam SATU langkah ----------
-- Kalau ada satu menu yang stoknya kurang, SELURUH penjualan dibatalkan
-- (stok tidak berkurang, transaksi tidak tersimpan). Aman dipakai beberapa HP sekaligus.
create or replace function public.jajanan_jual(trx jsonb)
returns void
language plpgsql
security invoker            -- tetap tunduk pada RLS (hanya akun kasir)
set search_path = public
as $$
declare
  it        jsonb;
  qty       integer;
  sisa      integer;
  nama_menu text;
begin
  -- urutkan per id supaya dua penjualan bersamaan tidak saling mengunci (deadlock)
  for it in select value from jsonb_array_elements(trx -> 'items') order by value ->> 'id' loop
    qty := (it ->> 'qty')::integer;

    update jajanan_menu
       set stok = stok - qty
     where id = it ->> 'id' and stok is not null and stok >= qty;

    if not found then
      select m.stok, m.nama into sisa, nama_menu from jajanan_menu m where m.id = it ->> 'id';
      if not found then
        raise exception 'Menu "%" sudah dihapus', it ->> 'nama';
      elsif sisa is not null then
        raise exception 'Stok % tidak cukup (sisa %)', nama_menu, sisa;
      end if;
      -- sisa NULL = stok tidak dihitung → lanjut
    end if;
  end loop;

  insert into jajanan_transaksi (id, waktu, items, total, metode, diterima, kembalian)
  values (
    trx ->> 'id',
    (trx ->> 'waktu')::timestamptz,
    trx -> 'items',
    (trx ->> 'total')::integer,
    trx ->> 'metode',
    (trx ->> 'diterima')::integer,
    (trx ->> 'kembalian')::integer
  );
end;
$$;

-- ---------- Batalkan transaksi: hapus + kembalikan stok ----------
create or replace function public.jajanan_batal(trx_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  isi jsonb;
  it  jsonb;
begin
  delete from jajanan_transaksi where id = trx_id returning items into isi;
  if not found then
    raise exception 'Transaksi tidak ditemukan (mungkin sudah dibatalkan)';
  end if;

  for it in select value from jsonb_array_elements(isi) order by value ->> 'id' loop
    update jajanan_menu
       set stok = stok + (it ->> 'qty')::integer
     where id = it ->> 'id' and stok is not null;
  end loop;
end;
$$;

-- ---------- Tambah stok (isi ulang) ----------
-- Menambah, bukan menimpa — aman walau HP lain sedang berjualan. Mengembalikan stok baru.
create or replace function public.jajanan_tambah_stok(menu_id text, jumlah integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  baru integer;
begin
  if jumlah is null or jumlah <= 0 then
    raise exception 'Jumlah harus lebih dari 0';
  end if;
  update jajanan_menu set stok = coalesce(stok, 0) + jumlah where id = menu_id returning stok into baru;
  if not found then
    raise exception 'Menu tidak ditemukan';
  end if;
  return baru;
end;
$$;

-- Hanya pengguna yang sudah login yang boleh memanggil fungsi-fungsi ini
revoke execute on function public.jajanan_jual(jsonb)                 from public, anon;
revoke execute on function public.jajanan_batal(text)                 from public, anon;
revoke execute on function public.jajanan_tambah_stok(text, integer)  from public, anon;
grant  execute on function public.jajanan_jual(jsonb)                 to authenticated;
grant  execute on function public.jajanan_batal(text)                 to authenticated;
grant  execute on function public.jajanan_tambah_stok(text, integer)  to authenticated;
