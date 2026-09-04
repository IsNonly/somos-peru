-- ============================================================
-- BACKFILL — departamento_asignado / provincia_asignado de coordinadores
--
-- Contexto: el formulario de registro (apps/registro/RegisterPage.tsx) ya guarda
-- la cascada completa Departamento→Provincia→Distrito para los coordinadores.
-- Pero las ~200 cuentas IMPORTADAS en lote se cargaron antes de que existieran
-- esas columnas (las agregó migracion_ubigeo_nacional.sql), así que a esas les
-- quedó solo `distrito_asignado`.
--
-- scope.ts deduce la provincia del distrito cuando falta; para Lima Metropolitana
-- siempre acierta. Este script deja el dato EXPLÍCITO para que no haya que deducir.
--
-- Ejecutar en Supabase > SQL Editor. Idempotente: solo toca filas cuya
-- provincia_asignado está vacía/NULL. NO pisa lo que ya tiene valor.
-- ============================================================

-- ── 0) Diagnóstico: qué coordinadores tienen la provincia sin llenar ──────
select p.dni, p.rol, p.distrito_asignado,
       p.departamento_asignado, p.provincia_asignado
from profiles p
where p.rol in ('Coordinador Provincial','Coordinador de Distritos')
  and coalesce(p.provincia_asignado,'') = ''
order by p.distrito_asignado;

-- ── 1) Backfill Lima Metropolitana (provincia de Lima, 43 distritos) ──────
-- Se fuerza provincia='Lima' aunque el nombre de distrito exista en otra
-- provincia del departamento: todos los coordinadores importados son de Lima Metro.
update profiles p
set departamento_asignado = 'Lima',
    provincia_asignado    = 'Lima'
from vista_ubigeo u
where p.rol in ('Coordinador Provincial','Coordinador de Distritos')
  and coalesce(p.provincia_asignado,'') = ''
  and p.distrito_asignado is not null
  and u.departamento = 'Lima'
  and u.provincia    = 'Lima'
  and u.distrito      = p.distrito_asignado;

-- ── 2) Backfill Callao (por si algún coordinador quedó con distrito del Callao) ──
update profiles p
set departamento_asignado = u.departamento,
    provincia_asignado    = u.provincia
from vista_ubigeo u
where p.rol in ('Coordinador Provincial','Coordinador de Distritos')
  and coalesce(p.provincia_asignado,'') = ''
  and p.distrito_asignado is not null
  and u.departamento ilike '%callao%'
  and u.distrito = p.distrito_asignado;

-- ── 3) Verificación: deben quedar 0 filas (o solo casos raros fuera de Lima/Callao
--      que habría que revisar a mano) ──────────────────────────────────────
select p.dni, p.rol, p.distrito_asignado
from profiles p
where p.rol in ('Coordinador Provincial','Coordinador de Distritos')
  and coalesce(p.provincia_asignado,'') = '';
