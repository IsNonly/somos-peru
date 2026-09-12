# Despliegue — GitHub + Vercel + Supabase

El repo es un monorepo con **3 apps** independientes (Vite + React):

| Carpeta | Qué es | Puerto local |
|---|---|---|
| `apps/registro` | Formulario de inscripción + capacitación (video → cartilla → quiz) | 5173 |
| `apps/conteo-app` | App móvil del personero (conteo de votos / marcar asistencia del local) | 5174 |
| `apps/conteo-web` | Panel web (superadmin + coordinadores) | 5175 |

Las 3 comparten la misma base de datos Supabase.

---

## 1. Subir a GitHub

Ya hay remoto: `origin → https://github.com/IsNonly/somosperu-electoral-2026.git`

```bash
# desde la raíz del repo
git checkout -b deploy-seguro            # rama nueva (recomendado)
git add -A
git commit -m "feat: paneles por rol, capacitación con video, RLS de seguridad y despliegue"
git push -u origin deploy-seguro
```

Luego en GitHub abre el Pull Request `deploy-seguro → main` y haces merge (o pusheas directo a `main` si prefieres).

**Qué NO se sube** (ya está en `.gitignore`): `node_modules/`, `dist/`, los `.env` reales, `CALI.xlsx`.
**Qué SÍ se sube:** los `.env.example` (con placeholders) y el video de capacitación (`apps/registro/public/videos/*.mp4`, ~39 MB, una sola vez).

> Si no quieres el video en git: bórralo del repo, súbelo a un bucket público de Supabase Storage
> o a YouTube (no listado) y cambia `VIDEO_URL` en `apps/registro/src/pages/CapacitarPage.tsx`.

---

## 2. Desplegar en Vercel (3 proyectos)

En Vercel: **Add New… → Project → Import** el repo de GitHub. Hazlo **3 veces**, una por app.
En cada proyecto, en *Configure Project*:

| Campo | registro | conteo-app | conteo-web |
|---|---|---|---|
| **Root Directory** | `apps/registro` | `apps/conteo-app` | `apps/conteo-web` |
| Framework Preset | Vite | Vite | Vite |
| Build Command | `npm run build` | `npm run build` | `npm run build` |
| Output Directory | `dist` | `dist` | `dist` |
| Install Command | `npm install` | `npm install` | `npm install` |

El `vercel.json` de cada carpeta ya redirige todo a `index.html` (necesario para React Router).

### Variables de entorno (Settings → Environment Variables) — Production + Preview

**Las 3 apps:**
```
VITE_SUPABASE_URL   = https://zjwjipknkjgoeyyamzvf.supabase.co
VITE_SUPABASE_ANON_KEY = <la anon key de Supabase · Project Settings → API>
```

**Solo `conteo-app`** (además):
```
VITE_CAPACITACION_URL = https://<tu-registro>.vercel.app/capacitate
VITE_PANEL_URL        = https://<tu-conteo-web>.vercel.app
```
(pon las URLs reales que te dé Vercel después del primer deploy; luego re-despliega conteo-app)

Deploy. Vercel te da 3 URLs, p. ej.:
- `https://somosperu-registro.vercel.app`
- `https://somosperu-conteo-app.vercel.app`
- `https://somosperu-conteo-web.vercel.app`

---

## 3. Supabase — dejar la base segura y operativa

En **Supabase → SQL Editor**, correr en este orden (todos son idempotentes):

1. `supabase/migracion_ubigeo_nacional.sql` — columnas depto/provincia en `colegios` *(si aún no se corrió)*
2. `supabase/fix_auth_identities.sql` — arregla el login de las cuentas importadas *(si aún no se corrió)*
3. `supabase/migracion_personero_local.sql` — renombra rol "Coordinador de Local" → "Personero de Local de Votación" + columnas de asistencia
4. `supabase/renombrar_personero_centro_votacion.sql` — renombra rol "Personero de Local de Votación" → "Personero de Centro de Votación" *(pendiente de correr — el código ya reconoce ambos nombres mientras tanto)*
5. **`supabase/rls_seguridad.sql`** — ⚠️ **CORRER RECIÉN DESPUÉS de desplegar el paso 2** (Vercel con el código nuevo). Cierra la lectura anónima del padrón: con solo la anon key ya **no** se puede hacer `GET /rest/v1/profiles`.
6. `supabase/candidaturas_multinivel.sql` — tabla `candidaturas` (listas por ubigeo + nivel Regional/Provincial/Distrital), `actas.electores_habiles`, ubigeo en `votos`. Requiere PostgreSQL 15+ (Supabase lo es).
7. `supabase/seed_candidaturas.sql` — siembra **Lima Metropolitana** + los 5 distritos donde opera SP (data de prensa, con nombres de candidato).
8. `supabase/seed_candidaturas_cali.sql` — siembra **el resto del país**: por cada depto/provincia/distrito que ya existe en `colegios` (CALI), la lista estándar de partidos **sin nombre de candidato**. Así cualquier ámbito ya deja contar. Los nombres reales se cargan luego con el Excel oficial:
   `node scripts/importar_candidaturas.mjs <excel>` (formato en el encabezado del script; `SUPABASE_SERVICE_ROLE` evita el bloqueo de RLS).
9. `supabase/foto_instalacion_mesa.sql` — columnas `actas.foto_instalacion_url` / `actas.instalada_at` para la foto de "Instalación de Mesa de Sufragio" en la pantalla de inicio del personero.

> `docs/somosperu_ambitos.md` lista en qué regiones/provincias compite Somos Perú (referencia para priorizar).

### Auth settings (Supabase → Authentication)
- **Site URL:** la URL de `registro` en Vercel.
- **Redirect URLs:** agregar las 3 URLs de Vercel.
- **Confirm email:** dejar **OFF** (los correos `@somosperu.com` son ficticios; el login es por DNI).

### Verificación post-RLS
```bash
# Debe dar 401/empty (antes daba 200 con 333 filas):
curl -s "https://zjwjipknkjgoeyyamzvf.supabase.co/rest/v1/profiles?select=dni&limit=1" \
  -H "apikey: <anon key>"
```
Y probar login real en cada app con un usuario de prueba (contraseña = DNI).

---

## Notas de seguridad
- La `VITE_SUPABASE_ANON_KEY` **se ve en F12** — es normal, es una clave pública. Lo que protege los datos es RLS (paso 4).
- Tras `rls_seguridad.sql`: los datos personales (`profiles`, `actas`, `asistencias`, capacitación) solo son visibles para usuarios **autenticados**. `colegios`, ubigeo y resultados agregados (`votos`) siguen siendo públicos.
- El acotamiento por rol/geografía (un coordinador solo ve su zona) se hace en la app, no en la BD. Un usuario con cuenta podría consultar fuera de su zona vía API — si eso importa, hay que endurecer las policies de `profiles` con funciones por rol.
