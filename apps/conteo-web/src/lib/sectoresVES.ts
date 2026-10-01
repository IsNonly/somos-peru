// Sectores de Villa El Salvador (mismo dato que apps/registro/src/lib/territoriosVES.ts;
// el Excel los llama TERRITORIO N, en pantalla se muestran como "Sector N").
// La clave es el nombre del local normalizado con `norm()`.
import { AMBITO_DISTRITOS } from './supabase'

export const norm = (t: string | null | undefined) =>
  String(t ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim()

// Solo la instancia de VES agrupa por sector; Cercado de Lima y San Isidro no.
export const USA_SECTORES = AMBITO_DISTRITOS.some(d => norm(d) === 'VILLA EL SALVADOR')

const TERRITORIO_POR_COLEGIO: Record<string, number> = {
  // Territorio 1
  "IE 6062 PERU EEUU": 1,
  "IE 6070 HEROES DEL ALTO CENEPA": 1,
  "IE 6080 ROSA DE AMERICA": 1,
  "IE 7072 SAN MARTIN DE PORRES": 1,
  "IE 7090 FORJADORES DEL PERU": 1,
  "IE 7092 JUAN PABLO II": 1,
  "IE 7095 PERU ITALIA": 1,
  "IE REPUBLICA DE BOLIVIA": 1,
  "IEP ADVENTISTA SALVADOR": 1,
  "IEP CIENCIAS": 1,
  "IEP HOWARD GARDNER": 1,
  "IEP INNOVA SCHOOLS VES LADERAS DE VILLA": 1,
  "IEP NUESTRA SENORA DE LA MERCED": 1,
  "IEP SACO OLIVEROS DE VILLA EL SALVADOR": 1,
  "IEP SAN AGUSTIN DE VILLA": 1,
  // Territorio 2
  "IE 6063 JOSE CARLOS MARIATEGUI": 2,
  "IE 6065 PERU INGLATERRA": 2,
  "IE 6066 VILLA EL SALVADOR": 2,
  "IEP PERUANO FRANCES": 2,
  "IEP ROSA DE SANTA MARIA DE VILLA": 2,
  // Territorio 3
  "EESPP MANUEL GONZALES PRADA": 3,
  "IE 6067 JUAN VELASCO ALVARADO": 3,
  "IE 6068 MANUEL GONZALES PRADA": 3,
  "IE 6069 PACHACUTEC": 3,
  "IE 6076 REPUBLICA DE NICARAGUA": 3,
  "IE 7093 REPUBLICA DE FRANCIA": 3,
  "IE 7097 VILLA AMSTELVEEN": 3,
  "IE FE Y ALEGRIA 17": 3,
  "IEP MONTESSORI DE VILLA": 3,
  "IEP PAMER": 3,
  "IEP PROLOG DE VILLA EL SALVADOR PRIMARIA": 3,
  "IEP PROLOG DE VILLA EL SALVADOR SECUNDARIA": 3,
  "IEP SAN IGNACIO DE LOYOLA": 3,
  "IESTP JULIO CESAR TELLO": 3,
  "ISP ANTONIO RAYMONDI": 3,
  "UNIVERSIDAD NACIONAL TECNOLOGICA DE LIMA SUR": 3,
  // Territorio 4
  "IE 7084 PERUANO SUIZO": 4,
  "IE 7213 PERUANO JAPONES": 4,
  "IE 7215 NACIONES UNIDAS PRIMARIA": 4,
  "IE 7224 ELIAS AGUIRRE": 4,
  "IE 7242 DIVINO MAESTRO": 4,
  "IE 7243 REY JUAN CARLOS DE BORBON": 4,
  "IEP BENJAMIN FRANKLIN": 4,
  "IEP EMMANUEL": 4,
  "IEP JORGE CHAVEZ": 4,
  "IEP LA MERCED": 4,
  "IEP MARIA INMACULADA CONCEPCION": 4,
  "IEP SAN LORENZO": 4,
  // Territorio 5
  "IE 6004 SANTIAGO ANTUNEZ DE MAYOLO SECUNDARIA": 5,
  "IE 7094 SASAKAWA": 5,
  "IE 7216 VILLA DE JESUS": 5,
  "IEP AVANTGARD COLLEGE": 5,
  "IEP INNOVA SCHOOLS VES VALLEJO": 5,
  "UNIVERSIDAD AUTONOMA DEL PERU": 5,
  // Territorio 6
  "IE 6071 REPUBLICA FEDERAL DE ALEMANIA": 6,
  "IE 6099 PERU ESPANA": 6,
  "IE 7096 PRINCIPE DE ASTURIAS": 6,
  "IE 7232 DANIEL ALCIDES CARRION": 6,
  "IEP EL MUNDO NUEVO DE VILLA": 6,
  "IEP MI DULCE JESUS": 6,
  // Territorio 7
  "IE 7091 REPUBLICA DEL PERU": 7,
  "IE 7228 PERUANO CANADIENSE": 7,
  "IE 7237 PERU VALLADOLID": 7,
  "IE 7238 SOLIDARIDAD PERU ALEMANIA": 7,
  "IE 7240 JESUS DE NAZARETH": 7,
  "IEP CORAZON DE JESUS DE OASIS": 7,
  "IEP EL NAZARENO DE VILLA SECUNDARIA": 7,
  "IEP JULIO CESAR TELLO DE OASIS": 7,
  "IEP LA CATOLICA": 7,
  "IEP PASCAL BLAISE": 7,
  "IEP SEBASTIAN LORENTE": 7,
  // Territorio 8
  "IE 7234 LAS PALMERAS": 8,
  // Territorio 9
  "IEP JAVIER PEREZ DE CUELLAR": 9,
}

// Sector del colegio, o null si no es de VES o no figura en la lista.
export function sectorDe(distrito: string | null | undefined, colegio: string | null | undefined): number | null {
  if (!USA_SECTORES || (distrito && norm(distrito) !== 'VILLA EL SALVADOR')) return null
  return TERRITORIO_POR_COLEGIO[norm(colegio)] ?? null
}
