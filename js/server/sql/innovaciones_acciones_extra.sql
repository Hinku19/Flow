-- =========================================================
-- INNOVACIONES: HASTA 10 ACCIONES
-- ---------------------------------------------------------
-- Las acciones 1 a 5 siguen en sus columnas (accion_1 ...
-- accion_5). Las acciones 6 a 10 (opcionales) se guardan como
-- un arreglo JSON de textos en acciones_extra, p. ej.
-- ["Acción 6", "Acción 7"].
--
-- Cambio aditivo: no borra ni modifica columnas. Mientras no se
-- corra, las innovaciones con 5 acciones o menos se siguen
-- registrando igual; solo las que traen más de 5 fallan, con un
-- mensaje que pide correr este script.
--
-- El usuario de la app (flow_app) no tiene permiso ALTER: correr
-- con una cuenta con privilegios (phpMyAdmin, MySQL Workbench,
-- etc.) contra la base de datos compartida.
-- =========================================================

ALTER TABLE innovaciones
    ADD COLUMN acciones_extra TEXT NULL AFTER accion_5;
