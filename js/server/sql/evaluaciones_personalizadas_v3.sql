-- =========================================================
-- MODULO EVALUACIONES - evaluaciones personalizadas, migracion v3
-- ---------------------------------------------------------
-- Ejecutar despues de evaluaciones_personalizadas_v2.sql, con
-- una cuenta que tenga privilegios CREATE y ALTER (el usuario
-- de la app, flow_app, no los tiene).
--
-- 1. evaluacion_personalizada.limite_respuestas: tope total de
--    respuestas. NULL = sin limite. Al alcanzarlo la evaluacion
--    deja de estar vigente (se cierra sola).
--
-- 2. evaluacion_personalizada_destinatarios: usuarios exactos a
--    los que se envia cada evaluacion (elegidos por departamento,
--    area, rol y casillas en el editor). Las evaluaciones creadas
--    antes de esta migracion no tienen filas aqui y siguen
--    dirigidas por rol (columna destinatarios).
--
-- Los valores (puntos) de las respuestas no requieren columnas
-- nuevas: se guardan dentro de preguntas_json
-- (opciones[].valor y valoresLikert).
-- =========================================================

ALTER TABLE evaluacion_personalizada
    ADD COLUMN limite_respuestas INT NULL AFTER fecha_cierre;

CREATE TABLE IF NOT EXISTS evaluacion_personalizada_destinatarios (
    evaluacion_id INT NOT NULL,
    usuario_id INT NOT NULL,
    PRIMARY KEY (evaluacion_id, usuario_id),
    CONSTRAINT fk_eval_pers_dest_evaluacion
        FOREIGN KEY (evaluacion_id) REFERENCES evaluacion_personalizada(id) ON DELETE CASCADE,
    CONSTRAINT fk_eval_pers_dest_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
