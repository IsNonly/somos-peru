# Logos de partidos

La app carga el logo de cada fila desde `/partidos/<slug>.png`.
El `slug` = nombre del partido en minúsculas, sin tildes, con `-` en vez de espacios/símbolos
(ver `slugPartido()` en `src/pages/ConteoPage.tsx`).

Si el archivo **no existe**, la fila cae automáticamente al badge blanco con iniciales — no se rompe nada.

## Ya incluidos (26, bajados de Wikimedia Commons)

accion-popular · ahora-nacion · alianza-electoral-venceremos · alianza-para-el-progreso ·
avanza-pais · frente-de-la-esperanza-2021 · frepap · fuerza-ciudadana · fuerza-popular ·
juntos-por-el-peru · partido-aprista-peruano · partido-civico-obras · partido-del-buen-gobierno ·
partido-democrata-verde · partido-morado · partido-patriotico-del-peru · partido-politico-prin ·
partido-popular-cristiano-ppc · peru-libre · peru-moderno · podemos-peru · politica-peru-primero ·
progresemos · renovacion-popular · somos-peru · vision-peru

## Faltan (usan badge de iniciales) — no hay logo en Commons

- `batalla-peru.png` — Batalla Perú
- `integridad-democratica.png` — Integridad Democrática
- `libertad-popular.png` — Libertad Popular
- `pueblo-consciente.png` — Pueblo Consciente
- `coalicion-transformadora-tierra-verde.png` — Coalición Transformadora Tierra Verde
- `partido-pais-para-todos.png` — País para Todos (en Commons solo hay un collage, no sirve a 36 px)

Para agregar uno: PNG con fondo transparente, cuadrado (~128 px), con el nombre de archivo exacto de arriba.
