-- ============================================================
-- Permitir eliminar personeros aunque tengan actas o asistencias
-- Antes: la base rechazaba borrar a un personero con un acta, una asistencia
-- confirmada o una asistencia marcada a su nombre ("Edge Function returned a
-- non-2xx status code" en el Panel). Ahora, al eliminarlo, esos registros se
-- CONSERVAN (el acta guarda su DNI y sus votos) y solo se suelta el enlace a
-- su perfil. Las tablas que ya se borraban junto con el perfil (capacitación,
-- cuestionario, sus propias asistencias) quedan igual.
-- Se puede correr más de una vez. Correr en VES, San Isidro y Cercado.
-- ============================================================
do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tabla, a.attname as columna
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = 'public.profiles'::regclass
       and array_length(c.conkey, 1) = 1
       and c.confdeltype in ('a', 'r')          -- "no action" / "restrict": bloquean el borrado
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
                   r.tabla, r.conname, r.columna);
    raise notice 'Ajustado: %.%', r.tabla, r.columna;
  end loop;
end $$;

-- Verificación: ninguna fila debe decir "BLOQUEA"
select c.conrelid::regclass as tabla, a.attname as columna,
       case c.confdeltype when 'n' then 'se suelta (set null)' when 'c' then 'se borra con el perfil'
                          else 'BLOQUEA' end as al_eliminar_personero
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
 where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
 order by 1, 2;
