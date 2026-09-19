-- =========================================================
-- VISTO BUENO DEL LÍDER PARA COMPROMISOS
-- ---------------------------------------------------------
-- El usuario de la app (flow_app) no tiene permiso ALTER
-- sobre esta tabla, así que este script debe correrse con
-- una cuenta con privilegios (phpMyAdmin, MySQL Workbench,
-- etc.) directamente contra la base de datos compartida.
--
-- Es un cambio aditivo: no borra ni modifica columnas
-- existentes. Espeja las columnas que ya tiene la tabla
-- `innovaciones` (aprobada / fecha_aprobacion / aprobada_por)
-- para el mismo flujo de "visto bueno del líder".
-- =========================================================

ALTER TABLE compromisos
    ADD COLUMN Aprobado TINYINT(1) NOT NULL DEFAULT 0 AFTER FechaFinReal,
    ADD COLUMN FechaAprobacion DATETIME NULL AFTER Aprobado,
    ADD COLUMN AprobadoPor INT NULL AFTER FechaAprobacion;
