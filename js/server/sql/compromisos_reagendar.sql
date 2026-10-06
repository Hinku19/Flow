-- =========================================================
-- RE-AGENDAR COMPROMISOS Y COMPROMISOS DESDE ACTIVIDADES
-- ---------------------------------------------------------
-- El usuario de la app (flow_app) no tiene permiso ALTER, asi
-- que este script debe correrse con una cuenta con privilegios
-- contra la base de datos compartida.
--
-- Es un cambio aditivo: no borra ni modifica columnas
-- existentes.
--
-- - FechaFinOriginal: la primera fecha limite del compromiso,
--   se llena la primera vez que el lider lo re-agenda (mientras
--   no se re-agende queda en NULL y la original es
--   FechaFinEstimada).
-- - Reagendas: historial en JSON de cada re-agenda
--   [{ fechaAnterior, fechaNueva, motivo, usuarioId,
--      usuarioNombre, fecha }].
-- - OrigenReunionId / OrigenObjetivoId / OrigenPuntoId: el punto
--   de desarrollo (de un objetivo de una reunion) del que se creo
--   el compromiso con doble clic desde el modulo de Actividades.
-- =========================================================

ALTER TABLE compromisos
    ADD COLUMN FechaFinOriginal DATE NULL AFTER FechaFinEstimada,
    ADD COLUMN Reagendas TEXT NULL AFTER FechaFinOriginal,
    ADD COLUMN OrigenReunionId INT NULL AFTER ReunionId,
    ADD COLUMN OrigenObjetivoId VARCHAR(64) NULL AFTER OrigenReunionId,
    ADD COLUMN OrigenPuntoId VARCHAR(64) NULL AFTER OrigenObjetivoId;
