-- =========================================================
-- COMPROMISOS INDEPENDIENTES (CREADOS DESDE EL MODULO)
-- ---------------------------------------------------------
-- El usuario de la app (flow_app) no tiene permiso ALTER, asi
-- que este script debe correrse con una cuenta con privilegios
-- contra la base de datos compartida.
--
-- Permite que un compromiso no pertenezca a ninguna reunion
-- (ReunionId vacio). La llave foranea FK_Compromisos_Reunion
-- se conserva: los compromisos de reuniones siguen borrandose
-- en cascada junto con su reunion.
-- =========================================================

ALTER TABLE compromisos
    MODIFY COLUMN ReunionId INT NULL;
