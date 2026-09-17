-- =========================================================
-- MODULO EVALUACIONES - creacion de tablas
-- ---------------------------------------------------------
-- Ejecutar una sola vez contra la base de datos compartida
-- con una cuenta que tenga privilegio CREATE (el usuario de
-- la app, flow_app, solo tiene SELECT/INSERT/UPDATE/DELETE).
-- =========================================================

CREATE TABLE IF NOT EXISTS evaluacion_periodos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,
    activo TINYINT(1) NOT NULL DEFAULT 0,
    creado_por INT NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evaluacion_periodos_creador
        FOREIGN KEY (creado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS evaluacion_envios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    periodo_id INT NOT NULL,
    usuario_id INT NOT NULL,
    formulario VARCHAR(50) NOT NULL,
    colega_objetivo_id INT NOT NULL DEFAULT 0,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evaluacion_envios_periodo
        FOREIGN KEY (periodo_id) REFERENCES evaluacion_periodos(id),
    CONSTRAINT fk_evaluacion_envios_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    UNIQUE KEY uq_evaluacion_envio (periodo_id, usuario_id, formulario, colega_objetivo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- evaluacion_envios: registra QUIEN respondio QUE formulario en QUE
-- periodo (y a que companero, si aplica) unicamente para impedir
-- respuestas duplicadas y mostrar el estado "ya respondiste". No
-- se usa para mostrar resultados individuales.

CREATE TABLE IF NOT EXISTS evaluacion_respuestas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    periodo_id INT NOT NULL,
    formulario VARCHAR(50) NOT NULL,
    area_evaluador VARCHAR(150) NULL,
    area_objetivo VARCHAR(150) NULL,
    colega_objetivo_id INT NULL,
    respuestas_json JSON NOT NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_evaluacion_respuestas_periodo
        FOREIGN KEY (periodo_id) REFERENCES evaluacion_periodos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- evaluacion_respuestas: contenido anonimo de cada envio (no guarda
-- usuario_id de quien respondio). respuestas_json es un objeto
-- { "preguntaId": "totalmente_acuerdo" | "de_acuerdo" | "neutral" |
--   "en_desacuerdo" | "totalmente_desacuerdo", ... }
