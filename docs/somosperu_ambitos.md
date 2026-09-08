# Somos Perú — ámbitos donde compite (ERM 2026)

> **Fuente:** scrape del registro ONPE publicado en `deylg/elecciones-erm2026` (github). **No es la data oficial** y se detectaron huecos (ej. Lima Metropolitana trae 13 listas donde ONPE/prensa registran ~22). Úsese para **priorizar provincias**, no como padrón final de cédula. Validar contra ONPE/JNE antes de la jornada.

## Cómo cargar las provincias en la conteo-app

`supabase/seed_candidaturas_cali.sql` — llena todos los ámbitos del país (depto/
provincia/distrito que ya están en `colegios`, o sea CALI) con la lista estándar
de partidos **sin nombre de candidato**. Así cualquier provincia ya deja contar.

Los nombres reales de candidato se cargan después con el Excel oficial de ONPE/JNE:
`node scripts/importar_candidaturas.mjs <excel>` (columna `FUENTE` para marcar el origen).

## Resumen

| Cargo | Candidaturas SP | Universo |
|---|---|---|
| Gobernador Regional | 18 | 25 regiones |
| Alcalde Provincial | 121 | 196 provincias |
| Alcalde Distrital | 898 | ~1874 distritos |

## Regiones con candidato SP a Gobernador (18)

| Región | Candidato |
|---|---|
| Amazonas | Amilcar Diaz Mendoza |
| Áncash | Juan Carlos Morillo Ulloa |
| Arequipa | Hector Hugo Herrera Herrera |
| Cajamarca | Edison Carrasco Olivera |
| Callao | Ismael Alberto Paredes Avalos |
| Ica | Juan Enrique Mendoza Uribe |
| Junín | Fernando Del Villar Canchari |
| La Libertad | Aldo Carlos Mariños |
| Lima Provincias | Andres Eduardo Tello Velazco |
| Loreto | German Vladimir Chong Rios |
| Madre De Dios | Iriana Velasquez Ruiz |
| Pasco | Jhonny Edgar Inga Aucapiña |
| Piura | Santiago Enrique Paz Lopez |
| Puno | Wilhem Rogger Limachi Viamonte |
| San Martín | Christopher Sandro Rivero Uzategui |
| Tacna | Mariela Beatriz Soto Villalba |
| Tumbes | Luis Constantino Arevalo Guerrero |
| Ucayali | Sandro Acosta Villavicencio |

_Sin lista SP a Gobernador:_ Ayacucho, Cusco, Huancavelica, Huánuco, Lambayeque, Lima Metropolitana (no elige gobernador), Moquegua.

## Provincias con candidato SP a Alcalde Provincial (121)

### Amazonas (5)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Bagua | Emigdio Arteaga Alvarez | 5 |
| Bongara | Edilberto Delgado Barboza | 7 |
| Condorcanqui | Eudes Abelino Chanchari Perez | 2 |
| Luya | Edwin Mori Llanca | 19 |
| Rodríguez De Mendoza | Manuel Asencion Fernandez Yoplac | 9 |

### Áncash (14)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Aija | Magaly Bertha Roldan Camones | 3 |
| Antonio Raimondi | Robert Nilton Torres Torres | 4 |
| Carlos Fermin Fitzcarrald | Jaime Orlando Collazos Huarangoy | 2 |
| Casma | Gonzalo Alfredo Trujillo Rosales | 3 |
| Huaraz | Jorge Antonio Noriega Cortez | 7 |
| Huari | Haron Ulpiano Osorio Vega | 14 |
| Huaylas | Frank Clay Quijandria Nolasco | 5 |
| Mariscal Luzuriaga | Atilio Alejandro Lopez Mejia | 7 |
| Pallasca | Alberto Cier Lotin | 8 |
| Pomabamba | Miguel Angel Limas Velveder | 2 |
| Recuay | Julian Elias Torre Maldonado | 4 |
| Santa | Crecencio Domingo Caldas Egusquiza | 6 |
| Sihuas | Abdon Casimiro Casahuaman Casahuaman | 7 |
| Yungay | Efrain Nuños Julca Regalado | 7 |

### Arequipa (5)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Arequipa | Jose Miguel Briones Silva | 10 |
| Camana | Nolverto Mario Chambi Linares | 3 |
| Caylloma | Cristhian Victor Panta Mamani | 15 |
| Condesuyos | Tomas Wuile Ayñayanque Rosas | 6 |
| La Union | Antonio Dionicio Castro Flores | 5 |

### Ayacucho (3)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Huamanga | Silver Nereo Palomino Cardenas | 6 |
| Paucar Del Sara Sara | Yony Odon Reyes Anampa | 8 |
| Vilcas Huaman | Victor Rolando Navarrete Estrada | 3 |

### Cajamarca (12)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Cajabamba | Richard Obando Barahona | 2 |
| Cajamarca | Sergio Sanchez Ibañez | 10 |
| Celendin | Edwin Ramos Diaz | 10 |
| Contumaza | James Noe Tantalean Teran | 3 |
| Cutervo | Oscar Mena Vilchez | 14 |
| Hualgayoc | Erickson Ruiz Fernandez | 1 |
| Jaen | Rony Lavan Guerrero | 10 |
| San Ignacio | Darwin Eileen Baique Quevedo | 6 |
| San Marcos | Carlos Willan Acosta Enco | 5 |
| San Miguel | Anderson Anibal Quiroz Bardales | 10 |
| San Pablo | Carlos Enrique Chavarry Sánchez | 2 |
| Santa Cruz | Pepe Alarcon Vasquez | 8 |

### Cusco (7)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Acomayo | Larry Patilla Huacac | 5 |
| Anta | Alex Cahua Aragon | 2 |
| Chumbivilcas | Ceferino Henry Romero Palma | 4 |
| Cusco | Juan Carlos Galdos Tejada | 2 |
| Espinar | Marco Antonio Ccallo Nina | 7 |
| Paucartambo | Santos Yuca Meza | 3 |
| Quispicanchi | Moises Quispe Huallpa | 9 |

### Huancavelica (2)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Castrovirreyna | Jorge Luis Cardenas Ordoñez | 5 |
| Huancavelica | Samuel Quispe Miranda | 3 |

### Huánuco (8)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Ambo | Cleber Mory Rojas | 7 |
| Huamalies | Manuel Valverde Miraval | 8 |
| Huanuco | Ramiro Pujay Hipolo | 10 |
| Leoncio Prado | Nilton Bazan Hoyos | 7 |
| Marañon | Mariano Prospero Malqui Diego | 4 |
| Pachitea | Juan Manuel Delgado Falera | 2 |
| Puerto Inca | Joel Rosales Paulino | 4 |
| Yarowilca | Edinson Soto Casio | 2 |

### Ica (4)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Chincha | Alberto Eugenio Oliva Corrales | 9 |
| Ica | Jose Luis Galvez Chavez | 13 |
| Nasca | Julio Oscar Elias Lucana | 4 |
| Pisco | Jesus Felipe Echegaray Nieto | 7 |

### La Libertad (9)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Bolívar | Edwar Javier Davila Echeverria | 5 |
| Chepén | Carlos Enrique Paredes Silva | 1 |
| Gran Chimú | Juan Julio Iglesias Gutierrez | 2 |
| Otuzco | Heli Adan Verde Rodriguez | 6 |
| Pacasmayo | Victor Raul Cruzado Rivera | 3 |
| Pataz | Santos Panfilo Quispe Alvarado | 6 |
| Sanchez Carrion | Carlos Arturo Rebaza Lopez | 7 |
| Santiago De Chuco | Juan Alberto Gabriel Alipio | 5 |
| Viru | Joselito Alejandro Afiler Horna | 2 |

### Lambayeque (3)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Chiclayo | Elber Requejo Sanchez | 14 |
| Ferreñafe | Luis Alberto Junior Gutierrez Barba | 3 |
| Lambayeque | Joaquin Teodomiro Chavez Siancas | 10 |

### Lima Metropolitana (1)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Lima | Carlos Ricardo Bruce Montes De Oca | 35 |

### Lima Provincias (9)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Barranca | Flor De Maria Vargas Armestar | 2 |
| Cajatambo | Jose Del Carmen Flores Fuentes Rivera | 3 |
| Canta | Victor Hugo Ibañez Soto | 6 |
| Cañete | Javier Eugenio Castillo Ñiquen | 9 |
| Huaral | Fernando Augusto Mora Aguilar | 7 |
| Huarochiri | Victor Marciano Rodriguez Cabeza | 15 |
| Huaura | Pompeyo Prisciliano Vergara Guadalupe | 10 |
| Oyon | Ali Max Espinoza Salinas | 4 |
| Yauyos | Cesar Elias Arbizu Sierra | 29 |

### Loreto (8)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Alto Amazonas | Jose Antonio Inuma Torres | 4 |
| Datem Del Marañon | Wagner Musoline Acho | 5 |
| Loreto | Guido Miguel Coronel Zumaeta | 4 |
| Mariscal Ramon Castilla | Juan Lao Del Aguila | 3 |
| Maynas | Roger Cristobal Gronerth Pinedo | 9 |
| Putumayo | Rafael Antonio Gaytan Gonzales | 2 |
| Requena | Rita Flores Huanuiri | 8 |
| Ucayali | Gerlin Gonzalez Macedo | 5 |

### Madre De Dios (2)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Manu | Reynaldo Rivas Davila | 0 |
| Tambopata | Keernny Dina Racua Aparicio | 0 |

### Moquegua (1)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Ilo | Juan Humberto Ramirez Flores | 0 |

### Pasco (2)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Daniel Alcides Carrion | Americo Reyes Sebastian | 7 |
| Pasco | Julio Cayetano Cajahuaman Quispe | 10 |

### Piura (6)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Huancabamba | Natividad Campos Ojeda | 6 |
| Morropon | Nelson Mio Reyes | 8 |
| Paita | Humberto Ruiz Martinez | 4 |
| Piura | Miguel Gerardo Cueva Celi | 8 |
| Sullana | Julio Wilfredo Oliva Reto | 5 |
| Talara | Harold Aleman Saavedra | 4 |

### Puno (5)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Carabaya | Hector Aguilar Narvaez | 8 |
| El Collao | Igor Cleofas Maquera Mamani | 2 |
| Moho | Josue Quispe Capajaña | 3 |
| Puno | Raul Dimas Huaracha Velasquez | 3 |
| San Antonio De Putina | Jimmy Eber Arenas Ochochoque | 3 |

### San Martín (8)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| El Dorado | Juan Carlos Mendoza Ruiz | 3 |
| Huallaga | Carlos Alberto Lopez Soto | 3 |
| Mariscal Caceres | Been Sadad Gonzales Chavez | 3 |
| Moyobamba | Wilson Villegas Viena | 1 |
| Picota | Alex Tenazoa Torres | 4 |
| Rioja | Jonny Ortiz Rios | 3 |
| San Martin | Alberto Enrique Hildebrandt Pinedo | 7 |
| Tocache | Benjamin Herrera Sopla | 1 |

### Tumbes (3)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Contralmirante Villar | Aldo Mariano Castañeda Palacios | 2 |
| Tumbes | Guillermo Arturo Arenas Roncal | 5 |
| Zarumilla | Edgar Saul Carrasco Ynfante | 3 |

### Ucayali (4)

| Provincia | Candidato SP | # distritos con lista SP |
|---|---|---|
| Atalaya | Jorge Lenin Escudero Viera | 2 |
| Coronel Portillo | Segundo Leonidas Perez Collazos | 6 |
| Padre Abad | Eli Herson Ruiz Montecinos | 6 |
| Purus | Domingo Rios Lozano | 0 |

## Distritos con lista SP — provincias sin candidato SP provincial pero con distritales

| Región / Provincia | # distritos SP |
|---|---|
| Amazonas / Chachapoyas | 18 |
| Cajamarca / Chota | 13 |
| Cusco / La Convencion | 11 |
| Pasco / Oxapampa | 7 |
| Amazonas / Utcubamba | 6 |
| La Libertad / Ascope | 6 |
| La Libertad / Trujillo | 6 |
| Áncash / Carhuaz | 5 |
| Áncash / Corongo | 5 |
| Huánuco / Dos De Mayo | 5 |
| Huánuco / Lauricocha | 5 |
| San Martín / Bellavista | 5 |
| Puno / Chucuito | 4 |
| Puno / Melgar | 4 |
| Puno / Yunguyo | 4 |
| Áncash / Bolognesi | 4 |
| Áncash / Huarmey | 4 |
| Arequipa / Caravelí | 4 |
| Ayacucho / Lucanas | 4 |
| Ayacucho / Parinacochas | 4 |
| Ica / Palpa | 4 |
| San Martín / Lamas | 4 |
| Ayacucho / La Mar | 3 |
| Piura / Ayabaca | 3 |
| Piura / Sechura | 3 |
| Tacna / Tacna | 3 |
| Arequipa / Islay | 2 |
| Ayacucho / Huanta | 2 |
| Callao / Callao | 2 |
| Cusco / Canchis | 2 |
| Huancavelica / Tayacaja | 2 |
| Junín / Huancayo | 2 |
| Junín / Satipo | 2 |
| La Libertad / Julcan | 2 |
| Moquegua / General Sanchez Cerro | 2 |
| Puno / Azangaro | 1 |
| Puno / Lampa | 1 |
| Puno / San Roman | 1 |
| Áncash / Ocros | 1 |
| Apurímac / Cotabambas | 1 |
| Apurímac / Grau | 1 |
| Arequipa / Castilla | 1 |
| Ayacucho / Sucre | 1 |
| Cusco / Calca | 1 |
| Cusco / Canas | 1 |
| Cusco / Paruro | 1 |
| Huancavelica / Angaraes | 1 |
| Huánuco / Huacaybamba | 1 |
| Junín / Chanchamayo | 1 |
| Junín / Jauja | 1 |
| Junín / Tarma | 1 |
| Tacna / Jorge Basadre | 1 |

_Total distritos SP en provincias sin cabeza provincial SP: 179_
