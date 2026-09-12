-- ============================================================
-- SEED -- Candidaturas ERM 2026, Tumbes (nivel DISTRITAL)
--
-- Fuente: prensa (candidatos a alcalde por distrito), pegada por el usuario
-- el 11 sep 2026. Reemplaza la plantilla nacional (CALI) por los partidos
-- que realmente compiten en cada distrito de Tumbes; el resto de partidos
-- de la plantilla que NO aparecen en esta lista se desactivan (activo=false)
-- porque, segun la fuente, no presentaron candidato en ese distrito.
--
-- Ya corrido en prod (vía script puntual, no scripts/importar_candidaturas.mjs).
-- Idempotente: ON CONFLICT sobre (nivel, departamento, provincia, distrito, partido).
-- ============================================================

insert into public.candidaturas (nivel, departamento, provincia, distrito, partido, candidato, activo, fuente) values
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Renovación Tumbesina','José Manuel Gálvez Herrera',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Podemos Perú','Romario Rai Prescott Núñez',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Somos Perú','Guillermo Arturo Arenas Roncal',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Fe en el Perú','Patricio Habel Aliaga Infante',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Renovación Popular','Jaime Idrogo Cruzado',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Alianza Electoral Venceremos','Darwin Daniel Barrios Sosa',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Fuerza Popular','Enrique Armando Vizcarra Tinedo',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Partido Morado','Francisco Benedicto Yacila Lomas',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Perú Primero','George Govver Díaz Cruz',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Libertad Popular','Javier Starly Nizama Cabrejos',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Alianza para el Progreso','José De La Rosa Cruz Martínez',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Perú Libre','Marisol Rosarela Tripul Ramírez',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Partido Aprista Peruano','Pedro José Vértiz Querevalú',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Partido del Buen Gobierno','Samir Cristian Pozo Pacsi',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Tumbes','Acción Popular','Víctor Manuel Aponte Valladolid',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Corrales','Fe en el Perú','José Armando Vilchez Barrientos',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Corrales','Renovación Tumbesina','Graciela Katherine Valdez Zapata',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Corrales','Alianza para el Progreso','Carmen Victoria Castillo Valdiviezo',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Corrales','Acción Popular','Lorenzo Sotero Dios Yacila',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Corrales','Somos Perú','Alejandro Arévalo Ortiz',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Corrales','Renovación Popular','Carmen Chiroque Paico',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Corrales','Perú Libre','Javier Suclupe Sandoval',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Corrales','Partido Aprista Peruano','José Martín Mogollón Medina',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','La Cruz','Renovación Popular','José Alipio Davis Atoche',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','La Cruz','Acción Popular','Javier Eduardo Zavala León',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','La Cruz','Fe en el Perú','José Eddy Delgado Bravo',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','La Cruz','Renovación Tumbesina','Roberto Leonidas Chávez Flores',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Pampas de Hospital','Somos Perú','Freddy Alexis Feijoo Zapata',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Pampas de Hospital','Fe en el Perú','Nexar Cruz Cruz',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Pampas de Hospital','Acción Popular','Giomar Obduver Heredia Rueda',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','Pampas de Hospital','Renovación Tumbesina',null,true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Jacinto','Perú Libre','Arnaldo Roque Rueda',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Jacinto','Integridad Democrática','Reynaldo Rujel Rojas',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Jacinto','Renovación Popular','María Jackeline Bazán Barrera',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Jacinto','Alianza para el Progreso',null,true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Jacinto','Fe en el Perú','Manuel Daniel Delgado Saavedra',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Jacinto','Renovación Tumbesina','Aldo Jorge Clavijo Campos',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Jacinto','Somos Perú','Arlintong Esteban Del Rosario Vinces',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Juan de la Virgen','Alianza para el Progreso','Lilia Yeins Morán García',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Juan de la Virgen','Renovación Popular','Rubén Edgardo Infante Carrillo',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Juan de la Virgen','Alianza Electoral Venceremos','Baltazar Benito Castillo Hidalgo',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Juan de la Virgen','Acción Popular','Calixto Baca Talledo',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Juan de la Virgen','Fe en el Perú','Carlos Arturo Barranzuela Granda',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Juan de la Virgen','Partido Aprista Peruano','José Aguedo Farías Agurto',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Tumbes','San Juan de la Virgen','Somos Perú','José Daniel Luna Benites',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Contralmirante Villar','Zorritos','Somos Perú',null,true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Contralmirante Villar','Zorritos','Renovación Popular',null,true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Contralmirante Villar','Zorritos','Alianza para el Progreso',null,true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Contralmirante Villar','Zorritos','Podemos Perú',null,true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Contralmirante Villar','Zorritos','Acción Popular',null,true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Contralmirante Villar','Zorritos','Lista Independiente Vecinal Zorritos',null,true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Contralmirante Villar','Casitas','Somos Perú','Wilmer Alberto Infante Távara',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Contralmirante Villar','Casitas','Alianza para el Progreso','Amelita Isabel Fernández Becerra',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Contralmirante Villar','Casitas','Renovación Popular','Ysmael Infante Távara',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Contralmirante Villar','Canoas de Punta Sal','Renovación Tumbesina','Reynaldo López Cruz',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Contralmirante Villar','Canoas de Punta Sal','Somos Perú','Carlos Artemio Eche Martínez',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Contralmirante Villar','Canoas de Punta Sal','Acción Popular','Luis Francisco Inoñán Gamboa',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Zarumilla','Todo con el Pueblo','Elmer Antonio Saavedra Reyes',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Zarumilla','Alianza para el Progreso','César Enrique Chapoñán Díaz',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Zarumilla','Perú Libre','Víctor Raúl Gonzales Torres',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Zarumilla','Somos Perú','Edgar Saúl Carrasco Ynfante',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Zarumilla','Renovación Popular','Jorge Augusto Garrido Zapata',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Zarumilla','Fe en el Perú','Carlos Enrique Zeta Namuche',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Zarumilla','Renovación Tumbesina',null,true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Zarumilla','Acción Popular',null,true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Zarumilla','Perú Primero','Segundo Remigio Arévalo Gil',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Zarumilla','Visión Perú',null,true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Matapalo','Renovación Tumbesina','Santiago Córdova Ruiz',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Matapalo','Alianza para el Progreso','Roberto Darwin Mendoza Domínguez',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Matapalo','Renovación Popular','Carlos Arturo Pérez Córdova',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Matapalo','Fe en el Perú',null,true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Matapalo','Acción Popular','Wilmer García Maldonado',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Matapalo','Perú Primero','Víctor Huamán Adriano',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Matapalo','Somos Perú','Gonzalo García Portocarrero',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Papayal','Somos Perú','Cristhiam Jonathan Becerra Luna',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Papayal','Renovación Popular','Jordy Alex Olivares Pizarro',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Papayal','Fe en el Perú','Melvin Iván Rivas García',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Papayal','Renovación Tumbesina','Wilson Alfredo Collantes Mogollón',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Papayal','Alianza para el Progreso','Arnaldo Castro Castillo',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Aguas Verdes','Somos Perú','Elgar Elibrando Arizola Zapata',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Aguas Verdes','Renovación Tumbesina','Eliar Edwin Tello Mateo',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Aguas Verdes','Perú Libre','Jorge Maguín Carmen Castro',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Aguas Verdes','Renovación Popular','José Avelino Arizola Del Rosario',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Aguas Verdes','Perú Primero','Ynoel Aquino Ramos',true,'prensa 2026'),
  ('DISTRITAL','Tumbes','Zarumilla','Aguas Verdes','FREPAP','Luis Hinostroza Tío',true,'prensa 2026')
on conflict (nivel, departamento, provincia, distrito, partido)
do update set candidato = excluded.candidato, fuente = excluded.fuente, activo = excluded.activo,
              updated_at = now();

-- Desactivar partidos de la plantilla CALI que no aparecen en la lista real
-- de cada distrito (no presentaron candidato ahi segun la fuente).
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Tumbes'
  and distrito = 'Tumbes' and fuente = 'plantilla (CALI)'
  and partido not in ('Renovación Tumbesina', 'Podemos Perú', 'Somos Perú', 'Fe en el Perú', 'Renovación Popular', 'Alianza Electoral Venceremos', 'Fuerza Popular', 'Partido Morado', 'Perú Primero', 'Libertad Popular', 'Alianza para el Progreso', 'Perú Libre', 'Partido Aprista Peruano', 'Partido del Buen Gobierno', 'Acción Popular');
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Tumbes'
  and distrito = 'Corrales' and fuente = 'plantilla (CALI)'
  and partido not in ('Fe en el Perú', 'Renovación Tumbesina', 'Alianza para el Progreso', 'Acción Popular', 'Somos Perú', 'Renovación Popular', 'Perú Libre', 'Partido Aprista Peruano');
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Tumbes'
  and distrito = 'La Cruz' and fuente = 'plantilla (CALI)'
  and partido not in ('Renovación Popular', 'Acción Popular', 'Fe en el Perú', 'Renovación Tumbesina');
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Tumbes'
  and distrito = 'Pampas de Hospital' and fuente = 'plantilla (CALI)'
  and partido not in ('Somos Perú', 'Fe en el Perú', 'Acción Popular', 'Renovación Tumbesina');
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Tumbes'
  and distrito = 'San Jacinto' and fuente = 'plantilla (CALI)'
  and partido not in ('Perú Libre', 'Integridad Democrática', 'Renovación Popular', 'Alianza para el Progreso', 'Fe en el Perú', 'Renovación Tumbesina', 'Somos Perú');
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Tumbes'
  and distrito = 'San Juan de la Virgen' and fuente = 'plantilla (CALI)'
  and partido not in ('Alianza para el Progreso', 'Renovación Popular', 'Alianza Electoral Venceremos', 'Acción Popular', 'Fe en el Perú', 'Partido Aprista Peruano', 'Somos Perú');
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Contralmirante Villar'
  and distrito = 'Zorritos' and fuente = 'plantilla (CALI)'
  and partido not in ('Somos Perú', 'Renovación Popular', 'Alianza para el Progreso', 'Podemos Perú', 'Acción Popular', 'Lista Independiente Vecinal Zorritos');
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Contralmirante Villar'
  and distrito = 'Casitas' and fuente = 'plantilla (CALI)'
  and partido not in ('Somos Perú', 'Alianza para el Progreso', 'Renovación Popular');
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Contralmirante Villar'
  and distrito = 'Canoas de Punta Sal' and fuente = 'plantilla (CALI)'
  and partido not in ('Renovación Tumbesina', 'Somos Perú', 'Acción Popular');
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Zarumilla'
  and distrito = 'Zarumilla' and fuente = 'plantilla (CALI)'
  and partido not in ('Todo con el Pueblo', 'Alianza para el Progreso', 'Perú Libre', 'Somos Perú', 'Renovación Popular', 'Fe en el Perú', 'Renovación Tumbesina', 'Acción Popular', 'Perú Primero', 'Visión Perú');
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Zarumilla'
  and distrito = 'Matapalo' and fuente = 'plantilla (CALI)'
  and partido not in ('Renovación Tumbesina', 'Alianza para el Progreso', 'Renovación Popular', 'Fe en el Perú', 'Acción Popular', 'Perú Primero', 'Somos Perú');
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Zarumilla'
  and distrito = 'Papayal' and fuente = 'plantilla (CALI)'
  and partido not in ('Somos Perú', 'Renovación Popular', 'Fe en el Perú', 'Renovación Tumbesina', 'Alianza para el Progreso');
update public.candidaturas set activo = false, updated_at = now()
  where nivel = 'DISTRITAL' and departamento = 'Tumbes' and provincia = 'Zarumilla'
  and distrito = 'Aguas Verdes' and fuente = 'plantilla (CALI)'
  and partido not in ('Somos Perú', 'Renovación Tumbesina', 'Perú Libre', 'Renovación Popular', 'Perú Primero', 'FREPAP');
