# Video de capacitación

Ya NO se guarda acá. Un archivo de ~46MB dentro de `/public` se re-empaquetaba
en CADA deployment de Vercel -con los pushes acumulados eso eran varios GB de
"Deployment Storage" solo en el proyecto `registro`-, así que se subió a
Supabase Storage (bucket público `capacitacion`, proyecto VES) y se referencia
por URL absoluta desde `src/pages/CapacitarPage.tsx` (constante `VIDEO_URL`).

Es el mismo contenido nacional para las 3 instancias (VES/CDL/San Isidro), así
que basta con una sola copia hospedada en lugar de una por instancia.

Para reemplazar el video: sube el archivo nuevo al bucket `capacitacion` en el
Storage del proyecto VES de Supabase (mismo nombre, o actualiza `VIDEO_URL` si
cambia el nombre).
