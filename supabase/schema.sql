-- O Rei do PPF: galeria de fotos e área do studio.
-- Rode inteiro no SQL Editor do Supabase. Pode rodar de novo sem problema.

-- Quem pode entrar no painel
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  created_at timestamptz not null default now()
);

-- Fotos dos carros (os arquivos ficam no Storage, bucket "fotos")
create table if not exists public.fotos (
  id uuid primary key default gen_random_uuid(),
  path text not null,              -- foto grande, ex.: 2026/10/<uuid>.jpg
  thumb text,                      -- miniatura da galeria
  carro text,                      -- ex.: Porsche 911 Carrera
  servico text,                    -- id do serviço (assets/js/config.js) ou texto livre
  legenda text,
  destaque boolean not null default false, -- a mais recente com destaque vira a capa do site
  publicado boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists fotos_vitrine on public.fotos (publicado, destaque desc, created_at desc);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.admins enable row level security;
alter table public.fotos enable row level security;

drop policy if exists "admins leem a si" on public.admins;
create policy "admins leem a si" on public.admins for select using (user_id = auth.uid());

drop policy if exists "fotos publicadas" on public.fotos;
create policy "fotos publicadas" on public.fotos for select using (publicado or public.is_admin());
drop policy if exists "fotos admin" on public.fotos;
create policy "fotos admin" on public.fotos for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;
revoke all on public.fotos from anon, authenticated;
grant select on public.fotos to anon;
grant select, insert, update, delete on public.fotos to authenticated;

-- Storage: bucket público para leitura; só admin envia, troca e apaga
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos: admin le" on storage.objects;
create policy "fotos: admin le" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "fotos: admin envia" on storage.objects;
create policy "fotos: admin envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "fotos: admin altera" on storage.objects;
create policy "fotos: admin altera" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "fotos: admin apaga" on storage.objects;
create policy "fotos: admin apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.is_admin());

-- Depois de criar o usuário do dono em Authentication > Users (Add user, com "Auto Confirm User"):
--   insert into public.admins (user_id, nome) select id, 'Rei do PPF' from auth.users where email = 'email-do-dono@exemplo.com';
