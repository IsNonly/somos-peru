-- ============================================================
-- MIGRACIÓN — Candidaturas multinivel (Regional / Provincial / Distrital)
--
-- Contexto: la conteo-app tenía las listas de candidatos HARDCODEADAS y solo
-- para Lima Metropolitana. Esta migración mueve las candidaturas a la BD,
-- indexadas por ubigeo (departamento/provincia/distrito) + nivel, para que
-- cada personero vea SOLO las listas de su propia provincia/distrito.
--
-- Los 3 niveles de la ERM 2026:
--   REGIONAL   -> Gobernador Regional        (clave: departamento)
--   PROVINCIAL -> Alcalde Provincial          (clave: departamento + provincia)
--   DISTRITAL  -> Alcalde Distrital           (clave: departamento + provincia + distrito)
--
-- Nota: Lima Metropolitana (provincia de Lima, departamento de Lima) NO elige
-- Gobernador Regional — la Municipalidad Metropolitana de Lima tiene régimen
-- especial con competencias regionales. Por eso para ese ámbito no se siembra
-- nivel REGIONAL (la app tampoco lo muestra si la tabla no trae filas).
--
-- Ejecutar en Supabase > SQL Editor. Idempotente: se puede volver a correr.
-- Después correr:  supabase/seed_candidaturas.sql
-- ============================================================

-- ── 1) Tabla de candidaturas ────────────────────────────────
create table if not exists public.candidaturas (
  id            bigserial primary key,
  nivel         text not null check (nivel in ('REGIONAL','PROVINCIAL','DISTRITAL')),
  departamento  text not null,
  provincia     text,            -- null solo para REGIONAL
  distrito      text,            -- null salvo DISTRITAL
  partido       text not null,
  candidato     text,            -- cabeza de lista; null = aún no cargado / no confirmado
  sigla         text,
  color         text default '#6B7280',
  orden         integer default 0,   -- posición en la cédula (ONPE)
  activo        boolean default true,
  fuente        text,            -- 'ONPE', 'JNE', 'prensa 2026', 'plantilla nacional', 'manual'
  updated_at    timestamptz default now()
);

-- Coherencia de niveles: provincia/distrito nulos o no según el nivel
alter table public.candidaturas drop constraint if exists candidaturas_nivel_ambito_chk;
alter table public.candidaturas add constraint candidaturas_nivel_ambito_chk check (
  (nivel = 'REGIONAL'   and provincia is null      and distrito is null) or
  (nivel = 'PROVINCIAL' and provincia is not null  and distrito is null) or
  (nivel = 'DISTRITAL'  and provincia is not null  and distrito is not null)
);

-- Una sola fila por (ámbito + partido). NULLS NOT DISTINCT (PostgreSQL 15+,
-- que es lo que corre Supabase) hace que provincia/distrito NULL — nivel
-- REGIONAL/PROVINCIAL — cuenten como iguales, así el upsert es idempotente
-- y PostgREST puede usar estas columnas como onConflict.
create unique index if not exists uq_candidaturas_ambito_partido
  on public.candidaturas (nivel, departamento, provincia, distrito, partido)
  nulls not distinct;

-- Índice de lectura para la conteo-app (filtra por ámbito, solo activas)
create index if not exists idx_candidaturas_lookup
  on public.candidaturas (nivel, departamento, provincia, distrito)
  where activo;

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_candidaturas_touch on public.candidaturas;
create trigger trg_candidaturas_touch
  before update on public.candidaturas
  for each row execute function public.touch_updated_at();

-- ── 2) RLS: lectura pública, escritura autenticada ─────────
-- (mismo patrón que colegios / partidos en rls_seguridad.sql: la data de
--  candidatos no es PII y el panel/anon la necesita para pintar la cédula)
alter table public.candidaturas enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'candidaturas'
  loop
    execute format('drop policy if exists %I on public.candidaturas', p.policyname);
  end loop;
end $$;
create policy "candidaturas_read_pub"   on public.candidaturas for select using (true);
create policy "candidaturas_write_auth" on public.candidaturas for all to authenticated using (true) with check (true);

grant select on public.candidaturas to anon, authenticated;
grant all    on public.candidaturas to authenticated;
grant usage, select on sequence public.candidaturas_id_seq to authenticated;

-- ── 3) actas: total de electores hábiles de la mesa + ubigeo ─
alter table public.actas add column if not exists electores_habiles integer;
alter table public.actas add column if not exists departamento      text;
alter table public.actas add column if not exists provincia         text;

-- ── 4) votos: ubigeo para poder agregar resultados a nivel nacional ─
alter table public.votos add column if not exists departamento text;
alter table public.votos add column if not exists provincia    text;

-- ── 5) Soltar las FK a distritos(nombre) — eran solo Lima (43 filas). ─
--     Ahora actas/votos pueden referir distritos de todo el país.
alter table public.actas  drop constraint if exists actas_distrito_fkey;
alter table public.votos  drop constraint if exists votos_distrito_fkey;

-- ── 6) Vista de resultados por ubigeo + nivel ──────────────
-- DROP + CREATE (no REPLACE): la vista previa de schema.sql empieza por
-- `distrito` y CREATE OR REPLACE no deja reordenar columnas. Ningún código
-- de las apps consulta esta vista, así que el DROP es seguro.
drop view if exists public.vista_resultados;
create view public.vista_resultados as
select
  v.departamento,
  v.provincia,
  v.distrito,
  v.nivel,
  v.partido,
  sum(v.cantidad)              as total_votos,
  count(distinct v.mesa_numero) as mesas_con_reporte
from public.votos v
join public.actas a on v.acta_id = a.id
where a.estado = 'TRANSMITIDA'
group by v.departamento, v.provincia, v.distrito, v.nivel, v.partido;

grant select on public.vista_resultados to anon, authenticated;

-- ── 7) Verificación ───────────────────────────────────────
select 'candidaturas' as tabla, count(*) as filas from public.candidaturas
union all
select 'actas.electores_habiles (no null)', count(*) from public.actas where electores_habiles is not null;
