-- =========================================================
-- COMPROMISOS: ESTATUS NUEVOS
-- ---------------------------------------------------------
-- Los estatus visibles ahora son: Pendiente, Vencido, En espera
-- de visto bueno, Completado y Completado a destiempo. Todos se
-- calculan a partir de Status (1 = sin completar, 3 = marcado
-- como completado), Aprobado, FechaFinEstimada y FechaFinReal
-- (ver SQL_ESTADO_COMPROMISO en server.js).
--
-- "En progreso" (Status 2) ya no existe: esos compromisos pasan
-- a Status 1 (Pendiente, o Vencido si ya pasó su fecha límite).
-- El backend ya trata Status 2 como pendiente, así que esto solo
-- deja la tabla limpia; se puede correr en cualquier momento y
-- más de una vez.
--
-- Nota: antes de este cambio FechaFinReal se llenaba al dar el
-- visto bueno, no cuando el responsable lo marcaba. En los
-- compromisos ya aprobados de antes, "a destiempo" se calcula
-- con la fecha del visto bueno.
--
-- Correr con una cuenta con privilegios (phpMyAdmin, MySQL
-- Workbench, etc.) contra la base de datos compartida.
-- =========================================================

UPDATE compromisos
SET
    Status = 1,
    FechaActualizacion = NOW()
WHERE Status IN (2, 4);
