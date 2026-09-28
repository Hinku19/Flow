-- =========================================================
-- COMPROMISOS CON VARIOS RESPONSABLES + PERSONAS INVOLUCRADAS
-- ---------------------------------------------------------
-- El usuario de la app (flow_app) no tiene permiso CREATE ni
-- ALTER, así que este script debe correrse con una cuenta con
-- privilegios (phpMyAdmin, MySQL Workbench, etc.) directamente
-- contra la base de datos compartida, ANTES de usar la versión
-- del backend que lo necesita.
--
-- Es un cambio aditivo: no borra ni modifica columnas.
--
-- * compromiso_responsables: todos los responsables de cada
--   compromiso (uno o varios). compromisos.UsuarioAsignadoId se
--   conserva como "responsable principal" (el primero): de él se
--   siguen tomando DepartamentoId / AreaId.
-- * compromisos.PersonasInvolucradas: solo informativo, no
--   asigna nada. Guarda un JSON [{"id":..,"nombre":".."}] con
--   usuarios de cualquier departamento (los compromisos más
--   viejos pueden tener texto libre ahí; se sigue mostrando).
-- =========================================================

CREATE TABLE IF NOT EXISTS compromiso_responsables (
    CompromisoId INT NOT NULL,
    UsuarioId INT NOT NULL,
    PRIMARY KEY (CompromisoId, UsuarioId),
    KEY IX_CompromisoResponsables_Usuario (UsuarioId),
    CONSTRAINT FK_CompromisoResponsables_Compromiso
        FOREIGN KEY (CompromisoId) REFERENCES compromisos (CompromisoId)
        ON DELETE CASCADE,
    CONSTRAINT FK_CompromisoResponsables_Usuario
        FOREIGN KEY (UsuarioId) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Los compromisos que ya existen quedan con su único responsable.
INSERT IGNORE INTO compromiso_responsables (CompromisoId, UsuarioId)
SELECT CompromisoId, UsuarioAsignadoId
FROM compromisos;


ALTER TABLE compromisos
    ADD COLUMN PersonasInvolucradas TEXT NULL AFTER Descripcion;
