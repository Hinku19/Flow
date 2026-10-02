-- =========================================================
-- LIMPIEZA DE COMPROMISOS DUPLICADOS POR LA HERENCIA ENTRE REUNIONES
-- ---------------------------------------------------------
-- Antes de la corrección en server.js (compromisoOrigenId, ver
-- resincronizarCompromisos), cada reunión que heredaba un
-- compromiso pendiente lo volvía a insertar como fila nueva en
-- `compromisos` al finalizar, sin borrar la fila de la reunión
-- anterior: una copia más por cada reunión.
--
-- Criterio de duplicado: misma Descripcion, mismo responsable
-- principal y misma fecha de inicio (la herencia las conserva),
-- en reuniones DISTINTAS. Se conserva la copia más reciente
-- (CompromisoId mayor, la de la última reunión) y se borran las
-- anteriores. Si alguna copia anterior ya estaba reportada como
-- completada (Status 3) y la que se conserva sigue abierta, ese
-- avance (y su visto bueno, si lo tenía) se pasa a la que se
-- conserva antes de borrar.
--
-- Los compromisos del módulo (ReunionId NULL) no se tocan.
-- compromiso_responsables se limpia sola (ON DELETE CASCADE).
--
-- Se puede volver a correr sin riesgo: si ya no hay duplicados
-- no hace nada. Conviene correrlo de nuevo cuando terminen las
-- reuniones que ya estaban en curso al desplegar la corrección
-- (heredaron con el formato anterior y generarán una última
-- copia al finalizar).
--
-- Correr con una cuenta con privilegios (phpMyAdmin, MySQL
-- Workbench, etc.) contra la base de datos compartida.
-- =========================================================


-- ---------------------------------------------------------
-- PASO 1 (solo lectura): revisar qué se va a borrar.
-- Correr esto solo primero y revisar el resultado.
-- ---------------------------------------------------------

SELECT
    k.CompromisoId AS ConservarId,
    k.ReunionId AS ConservarReunionId,
    k.Status AS ConservarStatus,
    c.CompromisoId AS BorrarId,
    c.ReunionId AS BorrarReunionId,
    c.Status AS BorrarStatus,
    c.Aprobado AS BorrarAprobado,
    LEFT(c.Descripcion, 80) AS Descripcion
FROM compromisos c
INNER JOIN (
    SELECT
        Descripcion,
        UsuarioAsignadoId,
        FechaInicioEstimada,
        MAX(CompromisoId) AS ConservarId
    FROM compromisos
    WHERE ReunionId IS NOT NULL
    GROUP BY
        Descripcion,
        UsuarioAsignadoId,
        FechaInicioEstimada
    HAVING COUNT(DISTINCT ReunionId) > 1
) g
    ON g.Descripcion <=> c.Descripcion
    AND g.UsuarioAsignadoId = c.UsuarioAsignadoId
    AND g.FechaInicioEstimada <=> c.FechaInicioEstimada
INNER JOIN compromisos k
    ON k.CompromisoId = g.ConservarId
WHERE
    c.ReunionId IS NOT NULL
    AND c.CompromisoId <> k.CompromisoId
    AND c.ReunionId <> k.ReunionId
ORDER BY
    k.CompromisoId,
    c.CompromisoId;


-- ---------------------------------------------------------
-- PASO 2: borrar los duplicados (en una transacción).
-- Para un ensayo sin cambios, cambiar el COMMIT final por
-- ROLLBACK.
-- ---------------------------------------------------------

START TRANSACTION;


DROP TEMPORARY TABLE IF EXISTS tmp_compromisos_duplicados;

CREATE TEMPORARY TABLE tmp_compromisos_duplicados AS
SELECT
    c.CompromisoId AS BorrarId,
    k.CompromisoId AS ConservarId
FROM compromisos c
INNER JOIN (
    SELECT
        Descripcion,
        UsuarioAsignadoId,
        FechaInicioEstimada,
        MAX(CompromisoId) AS ConservarId
    FROM compromisos
    WHERE ReunionId IS NOT NULL
    GROUP BY
        Descripcion,
        UsuarioAsignadoId,
        FechaInicioEstimada
    HAVING COUNT(DISTINCT ReunionId) > 1
) g
    ON g.Descripcion <=> c.Descripcion
    AND g.UsuarioAsignadoId = c.UsuarioAsignadoId
    AND g.FechaInicioEstimada <=> c.FechaInicioEstimada
INNER JOIN compromisos k
    ON k.CompromisoId = g.ConservarId
WHERE
    c.ReunionId IS NOT NULL
    AND c.CompromisoId <> k.CompromisoId
    AND c.ReunionId <> k.ReunionId;


-- La copia completada más reciente de cada grupo (si hay).
DROP TEMPORARY TABLE IF EXISTS tmp_compromisos_completados;

CREATE TEMPORARY TABLE tmp_compromisos_completados AS
SELECT
    d.ConservarId,
    MAX(d.BorrarId) AS CompletadoId
FROM tmp_compromisos_duplicados d
INNER JOIN compromisos c
    ON c.CompromisoId = d.BorrarId
WHERE c.Status = 3
GROUP BY d.ConservarId;


UPDATE compromisos k
INNER JOIN tmp_compromisos_completados x
    ON x.ConservarId = k.CompromisoId
INNER JOIN compromisos c
    ON c.CompromisoId = x.CompletadoId
SET
    k.Status = c.Status,
    k.FechaFinReal = c.FechaFinReal,
    k.Aprobado = c.Aprobado,
    k.FechaAprobacion = c.FechaAprobacion
WHERE k.Status IN (1, 2);


DELETE c
FROM compromisos c
INNER JOIN tmp_compromisos_duplicados d
    ON d.BorrarId = c.CompromisoId;


-- Debe regresar 0 filas.
SELECT
    Descripcion,
    UsuarioAsignadoId,
    FechaInicioEstimada,
    COUNT(*) AS Copias
FROM compromisos
WHERE ReunionId IS NOT NULL
GROUP BY
    Descripcion,
    UsuarioAsignadoId,
    FechaInicioEstimada
HAVING COUNT(DISTINCT ReunionId) > 1;


COMMIT;


DROP TEMPORARY TABLE IF EXISTS tmp_compromisos_completados;
DROP TEMPORARY TABLE IF EXISTS tmp_compromisos_duplicados;
