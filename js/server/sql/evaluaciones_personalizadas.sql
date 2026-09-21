-- =========================================================
-- MODULO EVALUACIONES - evaluaciones personalizadas
-- ---------------------------------------------------------
-- Ejecutar una sola vez contra la base de datos compartida
-- con una cuenta que tenga privilegio CREATE (el usuario de
-- la app, flow_app, solo tiene SELECT/INSERT/UPDATE/DELETE).
--
-- Son independientes de evaluacion_periodos y de las 5
-- evaluaciones fijas: cada evaluacion creada por un
-- administrador tiene su propio estado (activa/cerrada) y
-- fecha de cierre opcional.
-- =========================================================

CREATE TABLE IF NOT EXISTS evaluacion_personalizada (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NULL,
    preguntas_json JSON NOT NULL,
    activa TINYINT(1) NOT NULL DEFAULT 1,
    fecha_cierre DATE NULL,
    creado_por INT NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evaluacion_personalizada_creador
        FOREIGN KEY (creado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- evaluacion_personalizada.preguntas_json es un arreglo de
-- { id, tipo, texto, requerida, opciones: [{ id, texto }] }
-- con tipo = opcion_multiple | casillas | likert | texto.

CREATE TABLE IF NOT EXISTS evaluacion_personalizada_envios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evaluacion_id INT NOT NULL,
    usuario_id INT NOT NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_eval_pers_envios_evaluacion
        FOREIGN KEY (evaluacion_id) REFERENCES evaluacion_personalizada(id) ON DELETE CASCADE,
    CONSTRAINT fk_eval_pers_envios_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    UNIQUE KEY uq_eval_pers_envio (evaluacion_id, usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- evaluacion_personalizada_envios: solo registra QUIEN ya respondio
-- (para impedir duplicados y mostrar "ya respondiste").

CREATE TABLE IF NOT EXISTS evaluacion_personalizada_respuestas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evaluacion_id INT NOT NULL,
    area_evaluador VARCHAR(150) NULL,
    departamento_evaluador VARCHAR(150) NULL,
    respuestas_json JSON NOT NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_eval_pers_respuestas_evaluacion
        FOREIGN KEY (evaluacion_id) REFERENCES evaluacion_personalizada(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- evaluacion_personalizada_respuestas: contenido anonimo (no guarda
-- usuario_id). respuestas_json es { "preguntaId": valor } donde valor
-- es un id de opcion (opcion_multiple), un arreglo de ids (casillas),
-- un valor de la escala de Likert, o un texto.
