-- =========================================================
-- MODULO EVALUACIONES - evaluaciones personalizadas, migracion v2
-- ---------------------------------------------------------
-- Ejecutar despues de evaluaciones_personalizadas.sql, con una
-- cuenta que tenga privilegio ALTER (el usuario de la app,
-- flow_app, no lo tiene).
--
-- Agrega evaluacion_personalizada.destinatarios: a quien se
-- envia cada evaluacion. Valores: lider, operador o
-- lider,operador. Las evaluaciones ya creadas quedan
-- dirigidas a ambos.
-- =========================================================

ALTER TABLE evaluacion_personalizada
    ADD COLUMN destinatarios VARCHAR(30) NOT NULL DEFAULT 'lider,operador' AFTER preguntas_json;
