-- =========================================================
-- MODULO EVALUACIONES - migracion v2
-- ---------------------------------------------------------
-- Ejecutar despues de evaluaciones_tablas.sql, con una cuenta
-- que tenga privilegio ALTER (el usuario de la app, flow_app,
-- no lo tiene).
--
-- Agrega:
--   1) evaluacion_periodos.formularios_habilitados: que
--      encuestas eligio el administrador incluir en ese
--      periodo (antes un periodo activaba las 5 siempre).
--   2) evaluacion_respuestas.departamento_evaluador /
--      departamento_objetivo: para poder filtrar resultados
--      por departamento (sucursal), ademas del filtro por
--      area que ya existia.
-- =========================================================

ALTER TABLE evaluacion_periodos
    ADD COLUMN formularios_habilitados JSON NULL AFTER activo;

ALTER TABLE evaluacion_respuestas
    ADD COLUMN departamento_evaluador VARCHAR(150) NULL AFTER area_evaluador,
    ADD COLUMN departamento_objetivo VARCHAR(150) NULL AFTER area_objetivo;
