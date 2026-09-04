# Video de capacitación

Coloca aquí el video del personero con **este nombre exacto**:

```
Capacitacion_Personero_ERM_2026.mp4
```

- Lo carga `src/pages/CapacitarPage.tsx` (constante `VIDEO_URL = '/videos/Capacitacion_Personero_ERM_2026.mp4'`).
- Formato recomendado: **MP4 (H.264 + AAC)** para que reproduzca en todos los navegadores.
- El personero debe verlo **completo 2 veces**; no se puede adelantar (se bloquea el seek).
  Al terminar la 2ª reproducción se marca `profiles.videos_vistos = 2` y se habilita el paso de la cartilla.

Si usas otro nombre o subcarpeta, actualiza `VIDEO_URL` en `CapacitarPage.tsx`.
