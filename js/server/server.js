const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const multer = require("multer");

const db = require("./db");

const {
    VALORES_LIKERT_VALIDOS,
    PUNTAJE_LIKERT,
    FORMULARIOS_EVALUACION,
    FORMULARIOS_VALIDOS
} = require("./evaluacionesCatalogo");

db.getConnection()
    .then(connection => {

        console.log("=================================");
        console.log("MYSQL CONECTADO CORRECTAMENTE");
        console.log("Servidor:", process.env.DB_HOST);
        console.log("Base de datos:", process.env.DB_NAME);
        console.log("=================================");

        connection.release();

    })
    .catch(error => {

        console.error("=================================");
        console.error("ERROR DE CONEXIÓN MYSQL");
        console.error(error);
        console.error("=================================");

    });


/* =========================================================
   SERVIDOR
   ========================================================= */

const app =
    express();

const PORT =
    process.env.PORT || 3000;


/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(
    cors()
);

app.use(
    express.json()
);


/* =========================================================
   ARCHIVOS SUBIDOS (INNOVACIONES)
   ---------------------------------------------------------
   Se guardan como BLOB en MySQL (tabla innovacion_archivos)
   en vez de en disco: así son visibles desde cualquier
   máquina, ya que todos comparten el mismo MySQL pero cada
   quien corre su propio backend local.
   ========================================================= */

const uploadInnovacion =
    multer({

        storage:
            multer.memoryStorage(),

        limits: {
            fileSize:
                15 * 1024 * 1024
        }

    });


/* =========================================================
   ARCHIVOS SUBIDOS (ENLACES DE COMPETITIVIDAD)
   ---------------------------------------------------------
   Mismo patrón que innovaciones: BLOB en MySQL. Solo se
   permiten imágenes o PDF, hasta 10 MB.
   ========================================================= */

const uploadEnlaceArchivo =
    multer({

        storage:
            multer.memoryStorage(),

        limits: {
            fileSize:
                10 * 1024 * 1024
        },

        fileFilter:
            (req, file, cb) => {

                const permitido =
                    file.mimetype.startsWith("image/") ||
                    file.mimetype === "application/pdf";

                if (!permitido) {

                    return cb(
                        new Error(
                            "Solo se permiten imágenes o archivos PDF."
                        )
                    );

                }

                cb(null, true);

            }

    });


/* =========================================================
   ARCHIVOS SUBIDOS (FOTO DE PERFIL)
   ---------------------------------------------------------
   Mismo patrón: BLOB en MySQL, en la propia tabla usuarios
   (columnas foto_mime / foto_contenido). Solo imágenes.
   ========================================================= */

const uploadFotoPerfil =
    multer({

        storage:
            multer.memoryStorage(),

        limits: {
            fileSize:
                5 * 1024 * 1024
        },

        fileFilter:
            (req, file, cb) => {

                const permitido =
                    file.mimetype.startsWith("image/");

                if (!permitido) {

                    return cb(
                        new Error(
                            "Solo se permiten imágenes."
                        )
                    );

                }

                cb(null, true);

            }

    });


/* =========================================================
   IDENTIFICAR AL USUARIO QUE HACE LA PETICIÓN
   ---------------------------------------------------------
   No hay tokens de sesión: el frontend manda quién es en el
   encabezado X-Usuario-Id (ver auth.service.js). Esto no es
   a prueba de manipulación deliberada, pero ya evita que
   cualquiera vea datos ajenos con solo abrir la vista —
   antes ninguna ruta validaba nada.
   ========================================================= */

async function obtenerUsuarioSolicitante(req) {

    const usuarioId =
        Number(
            req.get("X-Usuario-Id")
        );

    if (!usuarioId) {

        return null;

    }

    const [filas] =
        await db.execute(
            `
            SELECT id, nombre, area, departamento, rol, activo
            FROM usuarios
            WHERE id = ?
            LIMIT 1
            `,
            [
                usuarioId
            ]
        );

    if (
        filas.length === 0 ||
        Number(filas[0].activo) !== 1
    ) {

        return null;

    }

    return filas[0];

}


function esAdmin(usuarioSolicitante) {

    return usuarioSolicitante?.rol === "administrador";

}


function respuestaSinPermiso(res) {

    return res
        .status(403)
        .json({

            ok: false,

            mensaje:
                "No tienes permiso para realizar esta acción."

        });

}


/* =========================================================
   PRUEBA DEL SERVIDOR
   ========================================================= */

app.get(
    "/api",
    (req, res) => {

        res.json({
            ok: true,
            mensaje:
                "Servidor FLOW funcionando correctamente.",
            fecha:
                new Date().toISOString()
        });

    }
);


/* =========================================================
   REGISTRAR USUARIO
   ========================================================= */

app.post(
    "/api/usuarios",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!esAdmin(usuarioSolicitante)) {

                return respuestaSinPermiso(res);

            }


            const {
                nombre,
                departamento,
                area,
                correo_electronico,
                password
            } = req.body;


            /* =============================================
               VALIDACIÓN
               ============================================= */

            if (
                !nombre ||
                !departamento ||
                !area ||
                !correo_electronico ||
                !password
            ) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje:
                            "Todos los campos son obligatorios."
                    });

            }


            /* =============================================
               VALIDAR CORREO EXISTENTE
               ============================================= */

            const [existentes] =
                await db.execute(
                    `
                    SELECT
                        id
                    FROM usuarios
                    WHERE correo_electronico = ?
                    LIMIT 1
                    `,
                    [
                        correo_electronico
                    ]
                );


            if (
                existentes.length > 0
            ) {

                return res
                    .status(409)
                    .json({
                        ok: false,
                        mensaje:
                            "Ya existe un usuario con ese correo electrónico."
                    });

            }


            /* =============================================
               ENCRIPTAR CONTRASEÑA
               ============================================= */

            const passwordHash =
                await bcrypt.hash(
                    password,
                    10
                );


            /* =============================================
               INSERTAR USUARIO
               ============================================= */

            const [resultado] =
                await db.execute(
                    `
                    INSERT INTO usuarios
                    (
                        nombre,
                        departamento,
                        area,
                        correo_electronico,
                        password_hash,
                        activo
                    )
                    VALUES
                    (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        1
                    )
                    `,
                    [
                        nombre,
                        departamento,
                        area,
                        correo_electronico,
                        passwordHash
                    ]
                );


            /* =============================================
               RESPUESTA
               ============================================= */

            return res
                .status(201)
                .json({

                    ok: true,

                    mensaje:
                        "Usuario registrado correctamente.",

                    usuario: {

                        id:
                            resultado.insertId,

                        nombre,

                        departamento,

                        area,

                        correo_electronico

                    }

                });


        }
        catch (error) {

            console.error(
                "ERROR AL REGISTRAR USUARIO:"
            );

            console.error(
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "Error interno al registrar el usuario.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   INICIAR SESIÓN
   ========================================================= */

app.post(
    "/api/login",
    async (req, res) => {

        try {

            const {
                correo,
                password
            } = req.body;


            /* =============================================
               VALIDACIÓN
               ============================================= */

            if (
                !correo ||
                !password
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Correo y contraseña son obligatorios."

                    });

            }


            /* =============================================
               BUSCAR USUARIO
               ============================================= */

            const [usuarios] =
                await db.execute(
                    `
                    SELECT
                        id,
                        nombre,
                        departamento,
                        area,
                        rol,
                        correo_electronico,
                        password_hash,
                        activo,
                        (foto_contenido IS NOT NULL) AS tieneFoto
                    FROM usuarios
                    WHERE correo_electronico = ?
                    LIMIT 1
                    `,
                    [
                        correo.trim()
                    ]
                );


            /* =============================================
               USUARIO NO EXISTE
               ============================================= */

            if (
                usuarios.length === 0
            ) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "Correo o contraseña incorrectos."

                    });

            }


            const usuario =
                usuarios[0];


            /* =============================================
               VALIDAR USUARIO ACTIVO
               ============================================= */

            if (
                Number(
                    usuario.activo
                ) !== 1
            ) {

                return res
                    .status(403)
                    .json({

                        ok: false,

                        mensaje:
                            "El usuario se encuentra inactivo."

                    });

            }


            /* =============================================
               VALIDAR CONTRASEÑA
               ============================================= */

            const passwordCorrecta =
                await bcrypt.compare(
                    password,
                    usuario.password_hash
                );


            if (
                !passwordCorrecta
            ) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "Correo o contraseña incorrectos."

                    });

            }


            /* =============================================
               RESPUESTA
               ============================================= */

            return res.json({

                ok: true,

                mensaje:
                    "Inicio de sesión correcto.",

                usuario: {

                    id:
                        usuario.id,

                    nombre:
                        usuario.nombre,

                    departamento:
                        usuario.departamento,

                    area:
                        usuario.area,

                    rol:
                        usuario.rol,

                    correo_electronico:
                        usuario.correo_electronico,

                    activo:
                        usuario.activo,

                    tieneFoto:
                        Boolean(usuario.tieneFoto)

                }

            });


        }
        catch (error) {

            console.error(
                "ERROR AL INICIAR SESIÓN:"
            );

            console.error(
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "Error interno al iniciar sesión.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   OBTENER USUARIOS
   ========================================================= */

app.get(
    "/api/usuarios",
    async (req, res) => {

        try {

            const [usuarios] =
                await db.execute(
                    `
                    SELECT
                        id,
                        nombre,
                        departamento,
                        area,
                        rol,
                        correo_electronico,
                        activo,
                        fecha_registro,
                        fecha_actualizacion
                    FROM usuarios
                    ORDER BY nombre
                    `
                );


            return res.json({

                ok: true,

                usuarios:
                    usuarios

            });


        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER USUARIOS:"
            );

            console.error(
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener los usuarios.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   EDITAR USUARIO
   ========================================================= */

app.put(
    "/api/usuarios/:id",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!esAdmin(usuarioSolicitante)) {

                return respuestaSinPermiso(res);

            }


            const id =
                Number(
                    req.params.id
                );


            const {
                nombre,
                departamento,
                area,
                correo_electronico,
                password
            } = req.body;


            /* =================================================
               VALIDAR ID
               ================================================= */

            if (!id) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje:
                            "ID de usuario no válido."
                    });

            }


            /* =================================================
               VALIDAR CAMPOS
               ================================================= */

            if (
                !nombre ||
                !departamento ||
                !area ||
                !correo_electronico
            ) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje:
                            "Nombre, departamento, área y correo son obligatorios."
                    });

            }


            /* =================================================
               VALIDAR CORREO DUPLICADO
               ================================================= */

            const [
                existentes
            ] =
                await db.execute(
                    `
                    SELECT
                        id
                    FROM usuarios
                    WHERE
                        correo_electronico = ?
                        AND id <> ?
                    LIMIT 1
                    `,
                    [
                        correo_electronico,
                        id
                    ]
                );


            if (
                existentes.length > 0
            ) {

                return res
                    .status(409)
                    .json({
                        ok: false,
                        mensaje:
                            "Ya existe otro usuario con ese correo electrónico."
                    });

            }


            /* =================================================
               ACTUALIZAR SIN CAMBIAR CONTRASEÑA
               ================================================= */

            if (
                !password ||
                password.trim() === ""
            ) {

                await db.execute(
                    `
                    UPDATE usuarios
                    SET
                        nombre = ?,
                        departamento = ?,
                        area = ?,
                        correo_electronico = ?,
                        fecha_actualizacion = NOW()
                    WHERE id = ?
                    `,
                    [
                        nombre,
                        departamento,
                        area,
                        correo_electronico,
                        id
                    ]
                );

            }

            else {

                /* =============================================
                   GENERAR NUEVO HASH
                   ============================================= */

                const passwordHash =
                    await bcrypt.hash(
                        password,
                        10
                    );


                /* =============================================
                   ACTUALIZAR CON CONTRASEÑA
                   ============================================= */

                await db.execute(
                    `
                    UPDATE usuarios
                    SET
                        nombre = ?,
                        departamento = ?,
                        area = ?,
                        correo_electronico = ?,
                        password_hash = ?,
                        fecha_actualizacion = NOW()
                    WHERE id = ?
                    `,
                    [
                        nombre,
                        departamento,
                        area,
                        correo_electronico,
                        passwordHash,
                        id
                    ]
                );

            }


            /* =================================================
               RESPUESTA
               ================================================= */

            return res.json({

                ok: true,

                mensaje:
                    "Usuario actualizado correctamente."

            });

        }
        catch (error) {

            console.error(
                "ERROR AL EDITAR USUARIO:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "Error interno al actualizar el usuario.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   SUBIR FOTO DE PERFIL
   ---------------------------------------------------------
   Solo el propio usuario puede cambiar su foto.
   ========================================================= */

app.post(
    "/api/usuarios/:id/foto",
    uploadFotoPerfil.single("foto"),
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "No fue posible identificar al usuario."

                    });

            }


            const usuarioId =
                Number(
                    req.params.id
                );

            if (usuarioSolicitante.id !== usuarioId) {

                return respuestaSinPermiso(res);

            }


            if (!req.file) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "No se recibió ninguna imagen."

                    });

            }


            await db.execute(
                `
                UPDATE usuarios
                SET
                    foto_mime = ?,
                    foto_contenido = ?
                WHERE id = ?
                `,
                [
                    req.file.mimetype,
                    req.file.buffer,
                    usuarioId
                ]
            );


            return res.json({

                ok: true,

                mensaje:
                    "Foto de perfil actualizada correctamente."

            });

        }
        catch (error) {

            console.error(
                "ERROR AL SUBIR FOTO DE PERFIL:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible actualizar la foto de perfil.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   QUITAR FOTO DE PERFIL
   ========================================================= */

app.delete(
    "/api/usuarios/:id/foto",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "No fue posible identificar al usuario."

                    });

            }


            const usuarioId =
                Number(
                    req.params.id
                );

            if (usuarioSolicitante.id !== usuarioId) {

                return respuestaSinPermiso(res);

            }


            await db.execute(
                `
                UPDATE usuarios
                SET
                    foto_mime = NULL,
                    foto_contenido = NULL
                WHERE id = ?
                `,
                [
                    usuarioId
                ]
            );


            return res.json({

                ok: true,

                mensaje:
                    "Foto de perfil eliminada correctamente."

            });

        }
        catch (error) {

            console.error(
                "ERROR AL QUITAR FOTO DE PERFIL:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible quitar la foto de perfil.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   OBTENER FOTO DE PERFIL
   ---------------------------------------------------------
   Sirve el contenido de la imagen guardada como BLOB en
   usuarios.foto_contenido.
   ========================================================= */

app.get(
    "/api/usuarios/:id/foto",
    async (req, res) => {

        try {

            const usuarioId =
                Number(
                    req.params.id
                );

            const [rows] =
                await db.execute(
                    `
                    SELECT
                        foto_mime,
                        foto_contenido
                    FROM usuarios
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [
                        usuarioId
                    ]
                );

            if (
                rows.length === 0 ||
                !rows[0].foto_contenido
            ) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "El usuario no tiene foto de perfil."

                    });

            }


            res.set(
                "Content-Type",
                rows[0].foto_mime ||
                "application/octet-stream"
            );

            return res.send(
                rows[0].foto_contenido
            );

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER FOTO DE PERFIL:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener la foto de perfil.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   OBTENER DEPARTAMENTOS
   ========================================================= */

app.get(
    "/api/subsidiaries",
    async (req, res) => {

        try {

            const [rows] =
                await db.execute(
                    `
                    SELECT
                        SubsidiaryId,
                        SubsidiaryName
                    FROM subsidiaries
                    ORDER BY SubsidiaryName
                    `
                );


            return res.json({

                ok: true,

                datos:
                    rows

            });


        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER DEPARTAMENTOS:"
            );

            console.error(
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener los departamentos.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   OBTENER ÁREAS POR DEPARTAMENTO
   ========================================================= */

app.get(
    "/api/areas",
    async (req, res) => {

        try {

            const subsidiaryId =
                Number(
                    req.query.subsidiaryId
                );


            const [rows] =
                subsidiaryId ?
                    await db.execute(
                        `
                        SELECT
                            AreaId,
                            AreaName
                        FROM areas
                        WHERE SubsidiaryId = ?
                        ORDER BY AreaName
                        `,
                        [
                            subsidiaryId
                        ]
                    ) :
                    await db.execute(
                        `
                        SELECT
                            AreaId,
                            AreaName
                        FROM areas
                        ORDER BY AreaName
                        `
                    );


            return res.json({

                ok: true,

                datos:
                    rows

            });


        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER ÁREAS:"
            );

            console.error(
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener las áreas.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   ACTUALIZAR ESTADO DEL USUARIO
   ========================================================= */

app.patch(
    "/api/usuarios/:id/estado",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!esAdmin(usuarioSolicitante)) {

                return respuestaSinPermiso(res);

            }


            const id =
                Number(req.params.id);

            const activo =
                Number(req.body.activo);


            /* =============================================
               VALIDAR ID
               ============================================= */

            if (
                !id
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de usuario no válido."

                    });

            }


            /* =============================================
               VALIDAR ESTADO
               ============================================= */

            if (
                activo !== 0 &&
                activo !== 1
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "El estado debe ser 0 o 1."

                    });

            }


            /* =============================================
               ACTUALIZAR MYSQL
               ============================================= */

            const [resultado] =
                await db.execute(
                    `
                    UPDATE usuarios
                    SET
                        activo = ?,
                        fecha_actualizacion = NOW()
                    WHERE id = ?
                    `,
                    [
                        activo,
                        id
                    ]
                );


            /* =============================================
               USUARIO NO ENCONTRADO
               ============================================= */

            if (
                resultado.affectedRows === 0
            ) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Usuario no encontrado."

                    });

            }


            /* =============================================
               RESPUESTA
               ============================================= */

            return res.json({

                ok: true,

                mensaje:
                    activo === 1
                        ? "Usuario activado correctamente."
                        : "Usuario desactivado correctamente."

            });


        }
        catch (error) {

            console.error(
                "ERROR AL ACTUALIZAR ESTADO DEL USUARIO:"
            );

            console.error(
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible actualizar el estado del usuario.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   ASIGNAR ROL DE USUARIO
   ========================================================= */

const ROLES_VALIDOS = [
    "administrador",
    "lider",
    "operador"
];

app.patch(
    "/api/usuarios/:id/rol",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!esAdmin(usuarioSolicitante)) {

                return respuestaSinPermiso(res);

            }


            const id =
                Number(req.params.id);

            const rol =
                req.body.rol;


            if (!id) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de usuario no válido."

                    });

            }


            if (!ROLES_VALIDOS.includes(rol)) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "El rol debe ser administrador, lider u operador."

                    });

            }


            const [resultado] =
                await db.execute(
                    `
                    UPDATE usuarios
                    SET
                        rol = ?,
                        fecha_actualizacion = NOW()
                    WHERE id = ?
                    `,
                    [
                        rol,
                        id
                    ]
                );

            if (resultado.affectedRows === 0) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Usuario no encontrado."

                    });

            }


            return res.json({

                ok: true,

                mensaje:
                    "Rol actualizado correctamente."

            });

        }
        catch (error) {

            console.error(
                "ERROR AL ACTUALIZAR ROL DEL USUARIO:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible actualizar el rol del usuario.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   CREAR REUNIÓN
   ========================================================= */

app.post(
    "/api/reuniones",
    async (req, res) => {

        try {

            const {
                titulo,
                descripcion,
                fechaInicio,
                fechaFin,
                lugar,
                estado,
                usuarioCreadorId,
                departamentoId,
                areaId,
                heredarCompromisos
            } = req.body;

            console.log(
    "POST /api/reuniones BODY:",
    req.body
);

console.log(
    "usuarioCreadorId:",
    usuarioCreadorId,
    "tipo:",
    typeof usuarioCreadorId
);


            /* =================================================
               VALIDACIONES
               ================================================= */

            if (!usuarioCreadorId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "No se recibió el usuario creador."

                    });

            }


            if (!fechaInicio) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "La fecha de inicio es obligatoria."

                    });

            }


            if (!departamentoId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "El departamento es obligatorio."

                    });

            }


            if (!areaId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "El área es obligatoria."

                    });

            }


            /* =================================================
               INSERTAR REUNIÓN
               ================================================= */
const [
    resultado
] =
    await db.execute(
        `
        INSERT INTO reuniones
        (
            Titulo,
            Descripcion,
            FechaInicio,
            FechaFin,
            Lugar,
            Estado,
            UsuarioCreadorId,
            DepartamentoId,
            AreaId
        )
        VALUES
        (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
        )
        `,
        [

            titulo,

            descripcion ||
                null,

            fechaInicio ||
                null,

            fechaFin ||
                null,

            lugar ||
                null,

            estado ||
                "Programada",

            Number(
                usuarioCreadorId
            ),

            departamentoId
                ? Number(
                    departamentoId
                )
                : null,

            areaId
                ? Number(
                    areaId
                )
                : null

        ]
    );


            /* =================================================
               RESPUESTA
               ================================================= */

            return res
                .status(201)
                .json({

                    ok: true,

                    ReunionId:
                        resultado.insertId,

                    mensaje:
                        "Reunión creada correctamente."

                });

        }
        catch (error) {

            console.error(
                "ERROR AL CREAR REUNIÓN:"
            );

            console.error(
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible crear la reunión.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   OBTENER REUNIONES PROGRAMADAS
   ========================================================= */

app.get(
    "/api/reuniones/programadas",
    async (req, res) => {

        try {

            const [
                reuniones
            ] =
                await db.execute(
                    `
                    SELECT
                        r.ReunionId,
                        r.Titulo,
                        r.Descripcion,
                        r.FechaInicio,
                        r.FechaFin,
                        r.Lugar,
                        r.Estado,
                        r.UsuarioCreadorId,
                        r.FechaRegistro,

                        COUNT(
                            rp.ReunionParticipanteId
                        ) AS TotalParticipantes

                    FROM reuniones r

                    LEFT JOIN reunion_participantes rp
                        ON rp.ReunionId =
                           r.ReunionId

                    WHERE
                        r.Estado IN ('Programada', 'En curso')

                    GROUP BY
                        r.ReunionId,
                        r.Titulo,
                        r.Descripcion,
                        r.FechaInicio,
                        r.FechaFin,
                        r.Lugar,
                        r.Estado,
                        r.UsuarioCreadorId,
                        r.FechaRegistro

                    ORDER BY
                        r.FechaInicio ASC
                    `
                );


            return res.json({

                ok: true,

                reuniones:
                    reuniones

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER REUNIONES PROGRAMADAS:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener las reuniones programadas.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   OBTENER TODOS LOS COMPROMISOS
   ========================================================= */

const STATUS_A_ESTADO = {

    1: "pendiente",
    2: "en-progreso",
    3: "completado",
    4: "vencido"

};


app.get(
    "/api/compromisos",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "No fue posible identificar al usuario."

                    });

            }


            /*
             * administrador ve todo. lider ve solo los
             * compromisos de usuarios de su misma área.
             * operador ve solo los suyos.
             */

            let filtroRol =
                "";

            const parametrosFiltro =
                [];

            if (usuarioSolicitante.rol === "lider") {

                filtroRol =
                    "AND u.area = ?";

                parametrosFiltro.push(
                    usuarioSolicitante.area
                );

            }
            else if (usuarioSolicitante.rol === "operador") {

                filtroRol =
                    "AND c.UsuarioAsignadoId = ?";

                parametrosFiltro.push(
                    usuarioSolicitante.id
                );

            }


            const [rows] =
                await db.execute(
                    `
                    SELECT
                        c.CompromisoId,
                        c.Titulo,
                        c.Descripcion,
                        c.Prioridad,
                        c.FechaInicioEstimada,
                        c.FechaFinEstimada,
                        c.FechaFinReal,
                        c.Status,
                        c.ReunionId,
                        r.Titulo AS ReunionTitulo,
                        r.FechaInicio AS ReunionFecha,
                        u.id AS UsuarioAsignadoId,
                        u.nombre AS ResponsableNombre,
                        CASE
                            WHEN c.Status IN (1, 2)
                                AND c.FechaFinEstimada IS NOT NULL
                                AND DATE(c.FechaFinEstimada) < CURDATE()
                            THEN 4
                            ELSE c.Status
                        END AS StatusEfectivo
                    FROM compromisos c
                    INNER JOIN reuniones r
                        ON r.ReunionId = c.ReunionId
                    INNER JOIN usuarios u
                        ON u.id = c.UsuarioAsignadoId
                    WHERE
                        r.Estado <> 'Cancelada'
                        ${filtroRol}
                    ORDER BY
                        c.FechaFinEstimada ASC
                    `,
                    parametrosFiltro
                );


            const compromisos =
                rows.map(
                    row => ({

                        id:
                            row.CompromisoId,

                        descripcion:
                            row.Descripcion ||
                            row.Titulo,

                        usuarioAsignadoId:
                            row.UsuarioAsignadoId,

                        usuarioAsignadoNombre:
                            row.ResponsableNombre,

                        fechaInicio:
                            row.FechaInicioEstimada,

                        fechaLimite:
                            row.FechaFinEstimada,

                        fechaCompletado:
                            row.FechaFinReal,

                        estado:
                            STATUS_A_ESTADO[row.StatusEfectivo] ||
                            "pendiente",

                        estadoReal:
                            STATUS_A_ESTADO[row.Status] ||
                            "pendiente",

                        prioridad:
                            row.Prioridad,

                        reunionId:
                            row.ReunionId,

                        reunionTitulo:
                            row.ReunionTitulo,

                        reunionFecha:
                            row.ReunionFecha

                    })
                );


            return res.json({

                ok: true,

                compromisos:
                    compromisos

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER COMPROMISOS:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener los compromisos.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   ACTUALIZAR ESTADO / FECHA LÍMITE DE UN COMPROMISO
   ========================================================= */

/*
 * Desde la vista global de compromisos solo se pueden editar
 * estos dos campos. El resto (responsable, descripción, fecha
 * de inicio, prioridad) se define al crear el compromiso
 * dentro de la reunión y no se modifica aquí.
 */

app.patch(
    "/api/compromisos/:id",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "No fue posible identificar al usuario."

                    });

            }


            const compromisoId =
                Number(
                    req.params.id
                );


            if (!compromisoId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de compromiso no válido."

                    });

            }


            /*
             * lider solo puede editar compromisos de su misma
             * área, operador solo los suyos.
             */

            const [compromisoActual] =
                await db.execute(
                    `
                    SELECT c.UsuarioAsignadoId, c.Status, c.FechaFinReal, u.area
                    FROM compromisos c
                    INNER JOIN usuarios u
                        ON u.id = c.UsuarioAsignadoId
                    WHERE c.CompromisoId = ?
                    LIMIT 1
                    `,
                    [
                        compromisoId
                    ]
                );

            if (compromisoActual.length === 0) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Compromiso no encontrado."

                    });

            }

            const puedeEditar =
                usuarioSolicitante.rol === "administrador" ||
                (
                    usuarioSolicitante.rol === "lider" &&
                    usuarioSolicitante.area === compromisoActual[0].area
                ) ||
                (
                    usuarioSolicitante.rol === "operador" &&
                    usuarioSolicitante.id === compromisoActual[0].UsuarioAsignadoId
                );

            if (!puedeEditar) {

                return respuestaSinPermiso(res);

            }


            const estado =
                String(
                    req.body.estado ||
                    ""
                ).trim();


            const fechaLimite =
                req.body.fechaLimite ||
                null;


            if (
                !ESTADO_A_STATUS[estado]
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Estado de compromiso no válido."

                    });

            }


            /*
             * FechaFinReal registra cuándo se completó de
             * verdad (a diferencia de FechaFinEstimada, que es
             * la fecha límite). Se marca al pasar a completado
             * y se limpia si deja de estarlo; si no cambia de
             * completado, se conserva la que ya tenía.
             */

            const nuevoStatus =
                ESTADO_A_STATUS[estado];

            const pasaACompletado =
                nuevoStatus === 3 &&
                Number(compromisoActual[0].Status) !== 3;

            const dejaDeCompletado =
                nuevoStatus !== 3 &&
                Number(compromisoActual[0].Status) === 3;

            const fechaFinReal =
                pasaACompletado
                    ? new Date()
                    : dejaDeCompletado
                        ? null
                        : compromisoActual[0].FechaFinReal;


            const [resultado] =
                await db.execute(
                    `
                    UPDATE compromisos
                    SET
                        Status = ?,
                        FechaFinEstimada = ?,
                        FechaFinReal = ?,
                        FechaActualizacion = NOW()
                    WHERE CompromisoId = ?
                    `,
                    [
                        nuevoStatus,
                        fechaLimite,
                        fechaFinReal,
                        compromisoId
                    ]
                );


            if (
                resultado.affectedRows === 0
            ) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Compromiso no encontrado."

                    });

            }


            return res.json({

                ok: true,

                mensaje:
                    "Compromiso actualizado correctamente."

            });

        }
        catch (error) {

            console.error(
                "ERROR AL ACTUALIZAR COMPROMISO:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible actualizar el compromiso.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   ELIMINAR COMPROMISO (VISTA GLOBAL)
   ========================================================= */

app.delete(
    "/api/compromisos/:id",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "No fue posible identificar al usuario."

                    });

            }


            const compromisoId =
                Number(
                    req.params.id
                );

            if (!compromisoId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de compromiso no válido."

                    });

            }


            /*
             * Mismo criterio que al editar: lider solo puede
             * borrar compromisos de su misma área, operador
             * solo los suyos.
             */

            const [compromisoActual] =
                await db.execute(
                    `
                    SELECT c.UsuarioAsignadoId, u.area
                    FROM compromisos c
                    INNER JOIN usuarios u
                        ON u.id = c.UsuarioAsignadoId
                    WHERE c.CompromisoId = ?
                    LIMIT 1
                    `,
                    [
                        compromisoId
                    ]
                );

            if (compromisoActual.length === 0) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Compromiso no encontrado."

                    });

            }

            const puedeEliminar =
                usuarioSolicitante.rol === "administrador" ||
                (
                    usuarioSolicitante.rol === "lider" &&
                    usuarioSolicitante.area === compromisoActual[0].area
                ) ||
                (
                    usuarioSolicitante.rol === "operador" &&
                    usuarioSolicitante.id === compromisoActual[0].UsuarioAsignadoId
                );

            if (!puedeEliminar) {

                return respuestaSinPermiso(res);

            }


            await db.execute(
                `
                DELETE FROM compromisos
                WHERE CompromisoId = ?
                `,
                [
                    compromisoId
                ]
            );

            return res.json({

                ok: true,

                mensaje:
                    "Compromiso eliminado correctamente."

            });

        }
        catch (error) {

            console.error(
                "ERROR AL ELIMINAR COMPROMISO:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible eliminar el compromiso.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   OBTENER SECCIONES DE UNA REUNIÓN
   ========================================================= */

app.get(
    "/api/reuniones/:id/secciones",
    async (req, res) => {

        try {

            const reunionId =
                Number(
                    req.params.id
                );


            if (!reunionId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de reunión no válido."

                    });

            }


            const [rows] =
                await db.execute(
                    `
                    SELECT
                        ReunionSeccionId,
                        ReunionId,
                        Seccion,
                        Contenido,
                        FechaRegistro,
                        FechaActualizacion
                    FROM reunion_secciones
                    WHERE ReunionId = ?
                    ORDER BY Seccion
                    `,
                    [
                        reunionId
                    ]
                );


            const secciones =
                rows.map(
                    row => {

                        let contenido =
                            row.Contenido;


                        if (
                            typeof contenido ===
                            "string"
                        ) {

                            try {

                                contenido =
                                    JSON.parse(
                                        contenido
                                    );

                            }
                            catch (error) {

                                console.error(
                                    "ERROR PARSEANDO CONTENIDO:",
                                    error
                                );

                            }

                        }


                        return {

                            ReunionSeccionId:
                                row.ReunionSeccionId,

                            ReunionId:
                                row.ReunionId,

                            Seccion:
                                row.Seccion,

                            Contenido:
                                contenido

                        };

                    }
                );


            return res.json({

                ok: true,

                secciones:
                    secciones

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER SECCIONES:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener las secciones.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   GUARDAR / ACTUALIZAR SECCIÓN
   ========================================================= */

app.put(
    "/api/reuniones/:id/secciones/:seccion",
    async (req, res) => {

        try {

            const reunionId =
                Number(
                    req.params.id
                );


            const seccion =
                String(
                    req.params.seccion ||
                    ""
                ).trim();


            const contenido =
                req.body.contenido;


            if (!reunionId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de reunión no válido."

                    });

            }


            if (!seccion) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "La sección es obligatoria."

                    });

            }


            if (
                contenido ===
                undefined
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "El contenido es obligatorio."

                    });

            }


            if (
                !/^[a-zA-Z0-9_-]{1,50}$/
                    .test(seccion)
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Nombre de sección no válido."

                    });

            }


            const contenidoJSON =
                JSON.stringify(
                    contenido
                );


            await db.execute(
                `
                INSERT INTO reunion_secciones
                (
                    ReunionId,
                    Seccion,
                    Contenido
                )
                VALUES
                (
                    ?,
                    ?,
                    ?
                )
                ON DUPLICATE KEY UPDATE
                    Contenido = VALUES(Contenido),
                    FechaActualizacion =
                        CURRENT_TIMESTAMP
                `,
                [
                    reunionId,
                    seccion,
                    contenidoJSON
                ]
            );


            /*
             * Deja rastro en la reunión de que algo se
             * modificó (relevante sobre todo para reuniones
             * ya finalizadas que siguen editables ese día).
             */

            await db.execute(
                `
                UPDATE reuniones
                SET FechaActualizacion = NOW()
                WHERE ReunionId = ?
                `,
                [
                    reunionId
                ]
            );


            return res.json({

                ok: true,

                mensaje:
                    "Sección guardada correctamente."

            });

        }
        catch (error) {

            console.error(
                "ERROR AL GUARDAR SECCIÓN:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible guardar la sección.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   OBTENER HISTORIAL DE REUNIONES
   ========================================================= */

app.get(
    "/api/reuniones/historial",
    async (req, res) => {

        try {

            const [
                reuniones
            ] =
                await db.execute(
                    `
                    SELECT
                        r.ReunionId,
                        r.Titulo,
                        r.Descripcion,
                        r.FechaInicio,
                        r.FechaFin,
                        r.Lugar,
                        r.Estado,
                        r.UsuarioCreadorId,
                        r.FechaRegistro,
                        r.FechaActualizacion,

                        COUNT(
                            DISTINCT rp.ReunionParticipanteId
                        ) AS TotalParticipantes,

                        COALESCE(
                            JSON_LENGTH(
                                (
                                    SELECT
                                        rs.Contenido
                                    FROM reunion_secciones rs
                                    WHERE
                                        rs.ReunionId =
                                            r.ReunionId
                                        AND rs.Seccion =
                                            'objetivos'
                                    LIMIT 1
                                )
                            ),
                            0
                        ) AS TotalObjetivos,

                        COALESCE(
                            JSON_LENGTH(
                                (
                                    SELECT
                                        rs.Contenido
                                    FROM reunion_secciones rs
                                    WHERE
                                        rs.ReunionId =
                                            r.ReunionId
                                        AND rs.Seccion =
                                            'compromisos'
                                    LIMIT 1
                                )
                            ),
                            0
                        ) AS TotalCompromisos

                    FROM reuniones r

                    LEFT JOIN reunion_participantes rp
                        ON rp.ReunionId =
                           r.ReunionId

                    WHERE
                        r.Estado IN (
                            'Finalizada',
                            'Cancelada'
                        )

                    GROUP BY
                        r.ReunionId,
                        r.Titulo,
                        r.Descripcion,
                        r.FechaInicio,
                        r.FechaFin,
                        r.Lugar,
                        r.Estado,
                        r.UsuarioCreadorId,
                        r.FechaRegistro,
                        r.FechaActualizacion

                    ORDER BY
                        r.FechaInicio DESC
                    `
                );


            return res.json({

                ok: true,

                reuniones:
                    reuniones

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER HISTORIAL:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener el historial de reuniones.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   OBTENER REUNIÓN POR ID
   ========================================================= */

app.get(
    "/api/reuniones/:id",
    async (req, res) => {

        try {

            const reunionId =
                Number(
                    req.params.id
                );


            if (!reunionId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de reunión no válido."

                    });

            }


            /* =================================================
               REUNIÓN + CREADOR + DEPARTAMENTO + ÁREA
               ================================================= */

            const [
                reuniones
            ] =
                await db.execute(
                    `
                    SELECT

                        r.ReunionId,
                        r.Titulo,
                        r.Descripcion,
                        r.FechaInicio,
                        r.FechaFin,
                        r.Lugar,
                        r.Estado,
                        r.FechaRegistro,
                        r.FechaActualizacion,
                        r.UsuarioCreadorId,

                        u.nombre AS CreadorNombre,

                        r.DepartamentoId,
                        s.SubsidiaryName AS Departamento,

                        r.AreaId,
                        a.AreaName AS Area

                    FROM reuniones r

                    LEFT JOIN usuarios u
                        ON u.id =
                           r.UsuarioCreadorId

                    LEFT JOIN subsidiaries s
                        ON s.SubsidiaryId =
                           r.DepartamentoId

                    LEFT JOIN areas a
                        ON a.AreaId =
                           r.AreaId

                    WHERE
                        r.ReunionId = ?

                    LIMIT 1
                    `,
                    [
                        reunionId
                    ]
                );


            if (
                reuniones.length === 0
            ) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Reunión no encontrada."

                    });

            }


            /* =================================================
               PARTICIPANTES
               ================================================= */

            const [
                participantes
            ] =
                await db.execute(
                    `
                    SELECT
                        rp.UsuarioId,
                        rp.Asistio,
                        u.nombre,
                        u.correo_electronico

                    FROM reunion_participantes rp

                    INNER JOIN usuarios u
                        ON u.id =
                           rp.UsuarioId

                    WHERE
                        rp.ReunionId = ?

                    ORDER BY
                        u.nombre
                    `,
                    [
                        reunionId
                    ]
                );


            return res.json({

                ok: true,

                reunion:
                    reuniones[0],

                participantes:
                    participantes

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER REUNIÓN:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener la reunión.",

                    error:
                        error.message

                });

        }

    }
);

/* =========================================================
   MIGRAR COMPROMISOS A LA TABLA COMPROMISOS
   ========================================================= */

/*
 * Se ejecuta al finalizar una reunión. Los compromisos viven,
 * mientras la reunión está activa, como JSON dentro de
 * reunion_secciones (Seccion='compromisos'). Al terminar, se
 * archivan como filas reales en la tabla `compromisos`.
 *
 * "Vencido" NO es un valor guardado en Status: se calcula al
 * consultar (ver GET /api/compromisos), comparando la fecha
 * límite contra la fecha actual.
 */

const ESTADO_A_STATUS = {

    "pendiente": 1,
    "en-progreso": 2,
    "completado": 3

};


function aFechaHoraMySQL(
    valor
) {

    if (!valor) {

        return null;

    }


    const fecha =
        new Date(
            valor
        );


    if (
        Number.isNaN(
            fecha.getTime()
        )
    ) {

        return null;

    }


    return fecha
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

}


async function resolverDepartamentoArea(
    connection,
    usuarioAsignadoId
) {

    const [rows] =
        await connection.execute(
            `
            SELECT
                s.SubsidiaryId,
                a.AreaId
            FROM usuarios u
            LEFT JOIN subsidiaries s
                ON s.SubsidiaryName = u.departamento
            LEFT JOIN areas a
                ON a.AreaName = u.area
                AND a.SubsidiaryId = s.SubsidiaryId
            WHERE u.id = ?
            LIMIT 1
            `,
            [
                usuarioAsignadoId
            ]
        );


    if (
        rows.length === 0 ||
        !rows[0].SubsidiaryId ||
        !rows[0].AreaId
    ) {

        return null;

    }


    return {

        departamentoId:
            rows[0].SubsidiaryId,

        areaId:
            rows[0].AreaId

    };

}


async function insertarCompromiso(
    connection,
    reunionId,
    compromiso
) {

    const usuarioAsignadoId =
        Number(
            compromiso.usuarioAsignadoId
        );


    if (!usuarioAsignadoId) {

        console.warn(
            `Compromiso sin usuarioAsignadoId válido en reunión ${reunionId}, se omite:`,
            compromiso
        );

        return false;

    }


    const deptoArea =
        await resolverDepartamentoArea(
            connection,
            usuarioAsignadoId
        );


    if (!deptoArea) {

        console.warn(
            `No fue posible resolver departamento/área para el usuario ${usuarioAsignadoId} (reunión ${reunionId}), se omite el compromiso.`
        );

        return false;

    }


    const descripcion =
        String(
            compromiso.descripcion ||
            ""
        ).trim();


    const status =
        ESTADO_A_STATUS[compromiso.estado] ||
        1;


    await connection.execute(
        `
        INSERT INTO compromisos
        (
            ReunionId,
            Titulo,
            Descripcion,
            UsuarioAsignadoId,
            DepartamentoId,
            AreaId,
            Prioridad,
            FechaInicioEstimada,
            FechaFinEstimada,
            Status,
            FechaFinReal
        )
        VALUES
        (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        `,
        [
            reunionId,
            descripcion.slice(0, 250) || "Compromiso",
            descripcion || null,
            usuarioAsignadoId,
            deptoArea.departamentoId,
            deptoArea.areaId,
            compromiso.prioridad || "media",
            compromiso.fechaInicio || null,
            compromiso.fechaLimite || null,
            status,
            status === 3
                ? aFechaHoraMySQL(compromiso.fechaCompletado)
                : null
        ]
    );


    return true;

}


async function resincronizarCompromisos(
    connection,
    reunionId,
    compromisos
) {

    await connection.execute(
        `
        DELETE FROM compromisos
        WHERE ReunionId = ?
        `,
        [
            reunionId
        ]
    );


    for (const compromiso of compromisos) {

        await insertarCompromiso(
            connection,
            reunionId,
            compromiso
        );

    }

}


async function migrarCompromisosATabla(
    connection,
    reunionId
) {

    /*
     * Idempotente a propósito: si esta función llegara a
     * correr más de una vez para la misma reunión (doble
     * clic en "Terminar", reintento, etc.), sin este borrado
     * cada corrida agregaría una copia extra de los mismos
     * compromisos.
     */

    await connection.execute(
        `
        DELETE FROM compromisos
        WHERE ReunionId = ?
        `,
        [
            reunionId
        ]
    );


    const [seccionRows] =
        await connection.execute(
            `
            SELECT Contenido
            FROM reunion_secciones
            WHERE
                ReunionId = ?
                AND Seccion = 'compromisos'
            LIMIT 1
            `,
            [
                reunionId
            ]
        );


    if (seccionRows.length === 0) {

        return;

    }


    let contenido =
        seccionRows[0].Contenido;


    if (typeof contenido === "string") {

        try {

            contenido =
                JSON.parse(
                    contenido
                );

        }
        catch (error) {

            console.error(
                "ERROR PARSEANDO COMPROMISOS AL FINALIZAR:",
                error
            );

            contenido = [];

        }

    }


    if (!Array.isArray(contenido)) {

        return;

    }


    for (const compromiso of contenido) {

        await insertarCompromiso(
            connection,
            reunionId,
            compromiso
        );

    }

}


/* =========================================================
   ACTUALIZAR ESTADO DE REUNIÓN
   ========================================================= */

app.patch(
    "/api/reuniones/:id/estado",
    async (req, res) => {

        let connection;

        try {

            const reunionId =
                Number(
                    req.params.id
                );


            const estado =
                String(
                    req.body.estado ||
                    ""
                ).trim();


            const estadosPermitidos = [

                "Programada",
                "En curso",
                "Finalizada",
                "Cancelada"

            ];


            if (!reunionId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de reunión no válido."

                    });

            }


            if (
                !estadosPermitidos.includes(
                    estado
                )
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Estado de reunión no válido."

                    });

            }


            if (
                estado === "Finalizada"
            ) {

                connection =
                    await db.getConnection();


                await connection.beginTransaction();


                await migrarCompromisosATabla(
                    connection,
                    reunionId
                );


                await connection.execute(
                    `
                    UPDATE reuniones
                    SET
                        Estado = ?,
                        FechaFinalizacion = COALESCE(FechaFinalizacion, NOW()),
                        FechaActualizacion = NOW()
                    WHERE ReunionId = ?
                    `,
                    [
                        estado,
                        reunionId
                    ]
                );


                await connection.commit();

            }
            else {

                await db.execute(
                    `
                    UPDATE reuniones
                    SET
                        Estado = ?,
                        FechaActualizacion = NOW()
                    WHERE ReunionId = ?
                    `,
                    [
                        estado,
                        reunionId
                    ]
                );

            }


            return res.json({

                ok: true,

                mensaje:
                    "Estado de reunión actualizado correctamente."

            });

        }
        catch (error) {

            if (connection) {

                await connection.rollback();

            }


            console.error(
                "ERROR AL ACTUALIZAR ESTADO DE REUNIÓN:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible actualizar el estado.",

                    error:
                        error.message

                });

        }
        finally {

            if (connection) {

                connection.release();

            }

        }

    }
);


/* =========================================================
   HEREDAR PENDIENTES A LA SIGUIENTE REUNIÓN
   ========================================================= */

/*
 * Al terminar una reunión, sus objetivos y compromisos que
 * quedaron sin completar (y el desarrollo asociado a esos
 * objetivos) se pueden pasar automáticamente a la siguiente
 * reunión que se inicie. Esto se calcula y se guarda aquí,
 * en el servidor, para que funcione sin importar en qué
 * computadora se programó/finalizó/inició cada reunión (antes
 * dependía de localStorage del navegador, que no se comparte
 * entre compañeros).
 *
 * "PendientesConsumidos" marca la reunión de origen para que
 * sus pendientes no se vuelvan a heredar una segunda vez si
 * se inician varias reuniones seguidas.
 */

function agruparPorPrioridad(
    bloques
) {

    const grupos =
        [];

    let actual = {

        subtitulo:
            null,

        items:
            []

    };


    bloques.forEach(
        (bloque) => {

            if (
                bloque.tipo === "subtitulo"
            ) {

                grupos.push(
                    actual
                );

                actual = {

                    subtitulo:
                        bloque,

                    items:
                        []

                };

            }
            else {

                actual.items.push(
                    bloque
                );

            }

        }
    );

    grupos.push(
        actual
    );


    const esPrioritario =
        (bloque) =>
            bloque.tipo === "punto" &&
            bloque.prioridad;


    return grupos.flatMap(
        (grupo) => {

            const prioritarios =
                grupo.items.filter(
                    esPrioritario
                );

            const normales =
                grupo.items.filter(
                    (bloque) =>
                        !esPrioritario(bloque)
                );

            const itemsOrdenados = [
                ...prioritarios,
                ...normales
            ];

            return grupo.subtitulo
                ? [grupo.subtitulo, ...itemsOrdenados]
                : itemsOrdenados;

        }
    );

}


function contenidoDeSeccion(
    filas,
    seccion,
    fallback
) {

    const fila =
        filas.find(
            (f) =>
                f.Seccion === seccion
        );

    if (!fila) {

        return fallback;

    }


    return typeof fila.Contenido === "string"
        ? JSON.parse(fila.Contenido)
        : fila.Contenido;

}


async function guardarSeccionReunion(
    connection,
    reunionId,
    seccion,
    contenido
) {

    await connection.execute(
        `
        INSERT INTO reunion_secciones
        (
            ReunionId,
            Seccion,
            Contenido
        )
        VALUES
        (
            ?, ?, ?
        )
        ON DUPLICATE KEY UPDATE
            Contenido = VALUES(Contenido),
            FechaActualizacion = CURRENT_TIMESTAMP
        `,
        [
            reunionId,
            seccion,
            JSON.stringify(contenido)
        ]
    );

}


/*
 * Fecha de hoy en formato YYYY-MM-DD (hora local del servidor),
 * usada para decidir si un compromiso está vencido. Comparar
 * fechas como texto ISO (en vez de new Date(fechaLimite) < new
 * Date()) evita que un compromiso con vencimiento "hoy" aparezca
 * vencido desde la medianoche UTC: con esto sigue vigente hasta
 * las 23:59 del día en curso.
 */
function hoyLocalISO() {

    const d =
        new Date();

    const mes =
        String(d.getMonth() + 1).padStart(2, "0");

    const dia =
        String(d.getDate()).padStart(2, "0");

    return `${d.getFullYear()}-${mes}-${dia}`;

}


/*
 * Compatibilidad con compromisos guardados antes del cambio de
 * esquema, cuando se guardaba "colaboradores": [nombre] en vez
 * de usuarioAsignadoId. Solo existen en un puñado de reuniones
 * viejas (anteriores a la migración a la tabla `compromisos`);
 * los compromisos nuevos siempre traen usuarioAsignadoId desde
 * el formulario. Sin esto, esos compromisos se heredan sin
 * responsable (aparecen con "?" en la tarjeta).
 */
const NOMBRE_LEGACY_A_USUARIO_ID = {

    "Adán Bustamante": 1,
    "Juan Carlos Alcaraz Huerta": 3,
    "Marcos Soliz": 7,
    "Carlos Alcaraz": 3

};


app.post(
    "/api/reuniones/:id/heredar-pendientes",
    async (req, res) => {

        let connection;

        try {

            const reunionId =
                Number(
                    req.params.id
                );


            if (!reunionId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de reunión no válido."

                    });

            }


            connection =
                await db.getConnection();

            await connection.beginTransaction();


            /* =================================================
               REUNIÓN DESTINO (para saber si quiere compromisos)
               ================================================= */

            const [
                destinoRows
            ] =
                await connection.execute(
                    `
                    SELECT HeredarCompromisos, UsuarioCreadorId
                    FROM reuniones
                    WHERE ReunionId = ?
                    LIMIT 1
                    `,
                    [
                        reunionId
                    ]
                );


            if (destinoRows.length === 0) {

                await connection.rollback();

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "La reunión no existe."

                    });

            }


            const heredarCompromisos =
                Number(
                    destinoRows[0].HeredarCompromisos
                ) === 1;

            const usuarioCreadorId =
                destinoRows[0].UsuarioCreadorId;


            /* =================================================
               REUNIÓN ORIGEN: la última finalizada sin heredar,
               DEL MISMO EQUIPO (departamento y área del creador).
               ---------------------------------------------------
               Antes esta búsqueda era global (cualquier reunión
               finalizada sin consumir, de cualquier equipo), así
               que la reunión nueva de un departamento le podía
               "robar" los pendientes a la de otro completamente
               ajeno, dejando a ambos con datos incorrectos.

               Se corrigió filtrando por el mismo UsuarioCreadorId,
               pero eso era demasiado estricto: dos compañeros del
               mismo equipo que alternan quién crea la reunión
               recurrente dejaban de heredarse pendientes entre sí.
               Se compara por departamento/área del creador (mismo
               equipo) en vez de exigir el mismo usuario exacto.
               ================================================= */

            const [
                origenRows
            ] =
                await connection.execute(
                    `
                    SELECT r.ReunionId, r.FechaInicio
                    FROM reuniones r
                    INNER JOIN usuarios uOrigen
                        ON uOrigen.id = r.UsuarioCreadorId
                    INNER JOIN usuarios uDestino
                        ON uDestino.id = ?
                    WHERE
                        r.Estado = 'Finalizada'
                        AND r.PendientesConsumidos = 0
                        AND uOrigen.departamento = uDestino.departamento
                        AND uOrigen.area = uDestino.area
                    ORDER BY
                        r.FechaInicio DESC
                    LIMIT 1
                    `,
                    [
                        usuarioCreadorId
                    ]
                );


            if (origenRows.length === 0) {

                await connection.commit();

                return res.json({

                    ok: true,

                    aplicado:
                        false

                });

            }


            const reunionOrigenId =
                origenRows[0].ReunionId;

            const reunionOrigenFecha =
                origenRows[0].FechaInicio;


            const [
                seccionRows
            ] =
                await connection.execute(
                    `
                    SELECT Seccion, Contenido
                    FROM reunion_secciones
                    WHERE
                        ReunionId = ?
                        AND Seccion IN ('objetivos', 'compromisos', 'desarrollo')
                    `,
                    [
                        reunionOrigenId
                    ]
                );


            const objetivos =
                contenidoDeSeccion(
                    seccionRows,
                    "objetivos",
                    []
                );

            const compromisos =
                contenidoDeSeccion(
                    seccionRows,
                    "compromisos",
                    []
                );

            const desarrollo =
                contenidoDeSeccion(
                    seccionRows,
                    "desarrollo",
                    {}
                );


            /* =================================================
               OBJETIVOS PENDIENTES (con id nuevo)
               ================================================= */

            const objetivosViejosPendientes =
                (
                    Array.isArray(objetivos)
                        ? objetivos
                        : []
                ).filter(
                    (objetivo) =>
                        !objetivo.done
                );


            const mapaObjetivos =
                {};

            const objetivosNuevos =
                objetivosViejosPendientes.map(
                    (objetivo) => {

                        const nuevoId =
                            crypto.randomUUID();

                        mapaObjetivos[objetivo.id] =
                            nuevoId;

                        return {

                            id:
                                nuevoId,

                            texto:
                                objetivo.texto,

                            done:
                                false

                        };

                    }
                );


            /* =================================================
               COMPROMISOS PENDIENTES (con id nuevo)
               ================================================= */

            const compromisosNuevos =
                [];

            /*
             * Los compromisos vencidos (vencidoInformativo === true)
             * se siguen heredando reunión tras reunión mientras no
             * se marquen como completados: solo "estado === completado"
             * los saca de la herencia.
             */

            const compromisosOrigen =
                heredarCompromisos
                    ? (
                        Array.isArray(compromisos)
                            ? compromisos
                            : []
                    ).filter(
                        (compromiso) =>
                            compromiso.estado !== "completado"
                    )
                    : [];


            for (const compromiso of compromisosOrigen) {

                const vencido =
                    compromiso.fechaLimite &&
                    compromiso.fechaLimite < hoyLocalISO();


                let usuarioAsignadoId =
                    compromiso.usuarioAsignadoId;

                let usuarioAsignadoNombre =
                    compromiso.usuarioAsignadoNombre;


                if (
                    !usuarioAsignadoId &&
                    compromiso.colaboradores?.[0]
                ) {

                    const idLegacy =
                        NOMBRE_LEGACY_A_USUARIO_ID[
                            compromiso.colaboradores[0]
                        ];

                    if (idLegacy) {

                        const [
                            usuarioRows
                        ] =
                            await connection.execute(
                                `
                                SELECT id, nombre
                                FROM usuarios
                                WHERE id = ?
                                LIMIT 1
                                `,
                                [
                                    idLegacy
                                ]
                            );

                        if (usuarioRows.length > 0) {

                            usuarioAsignadoId =
                                usuarioRows[0].id;

                            usuarioAsignadoNombre =
                                usuarioRows[0].nombre;

                        }

                    }

                }


                compromisosNuevos.push({

                    ...compromiso,

                    id:
                        crypto.randomUUID(),

                    usuarioAsignadoId:
                        usuarioAsignadoId,

                    usuarioAsignadoNombre:
                        usuarioAsignadoNombre,

                    ...(
                        vencido
                            ? { vencidoInformativo: true }
                            : {}
                    )

                });

            }


            /* =================================================
               DESARROLLO PENDIENTE (bloques al 100% se quitan)
               ================================================= */

            const desarrolloNuevo =
                {};

            objetivosViejosPendientes.forEach(
                (objetivoViejo) => {

                    const bloques =
                        desarrollo[objetivoViejo.id];

                    if (!bloques) {

                        return;

                    }


                    const bloquesVigentes =
                        bloques
                            .filter(
                                (bloque) =>
                                    !(
                                        bloque.tipo === "punto" &&
                                        bloque.avance === 100
                                    )
                            )
                            .map(
                                (bloque) => ({

                                    ...bloque,

                                    id:
                                        crypto.randomUUID(),

                                    /*
                                     * Reuniones anteriores a que
                                     * se empezara a guardar
                                     * fechaCreacion por punto no
                                     * la traen: se usa la fecha
                                     * de la reunión de origen
                                     * como referencia.
                                     */
                                    ...(
                                        bloque.tipo === "punto" &&
                                        !bloque.fechaCreacion
                                            ? { fechaCreacion: reunionOrigenFecha }
                                            : {}
                                    )

                                })
                            );


                    desarrolloNuevo[
                        mapaObjetivos[objetivoViejo.id]
                    ] =
                        agruparPorPrioridad(
                            bloquesVigentes
                        );

                }
            );


            /* =================================================
               GUARDAR EN LA REUNIÓN DESTINO
               ================================================= */

            await guardarSeccionReunion(
                connection,
                reunionId,
                "objetivos",
                objetivosNuevos
            );

            await guardarSeccionReunion(
                connection,
                reunionId,
                "compromisos",
                compromisosNuevos
            );

            await guardarSeccionReunion(
                connection,
                reunionId,
                "desarrollo",
                desarrolloNuevo
            );


            await connection.execute(
                `
                UPDATE reuniones
                SET PendientesConsumidos = 1
                WHERE ReunionId = ?
                `,
                [
                    reunionOrigenId
                ]
            );

            await connection.execute(
                `
                UPDATE reuniones
                SET PendientesOrigenId = ?
                WHERE ReunionId = ?
                `,
                [
                    reunionOrigenId,
                    reunionId
                ]
            );


            await connection.commit();


            return res.json({

                ok: true,

                aplicado:
                    true,

                reunionOrigenId:
                    reunionOrigenId,

                objetivos:
                    objetivosNuevos.length,

                compromisos:
                    compromisosNuevos.length

            });

        }
        catch (error) {

            if (connection) {

                await connection.rollback();

            }


            console.error(
                "ERROR AL HEREDAR PENDIENTES:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible heredar los pendientes.",

                    error:
                        error.message

                });

        }
        finally {

            if (connection) {

                connection.release();

            }

        }

    }
);


/* =========================================================
   RESINCRONIZAR COMPROMISOS DE UNA REUNIÓN FINALIZADA
   ========================================================= */

/*
 * Solo aplica mientras la reunión sigue dentro de su ventana
 * de edición (terminada el mismo día calendario). Se usa desde
 * la vista de Archivo cuando esta editable: cada guardado de
 * compromisos vuelve a reflejar el arreglo completo en la
 * tabla `compromisos` (se borra y reinserta, ver
 * resincronizarCompromisos).
 */

app.put(
    "/api/reuniones/:id/compromisos",
    async (req, res) => {

        let connection;

        try {

            const reunionId =
                Number(
                    req.params.id
                );


            if (!reunionId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de reunión no válido."

                    });

            }


            const compromisos =
                Array.isArray(
                    req.body.compromisos
                )
                    ? req.body.compromisos
                    : [];


            const [reuniones] =
                await db.execute(
                    `
                    SELECT
                        Estado,
                        FechaFinalizacion
                    FROM reuniones
                    WHERE ReunionId = ?
                    LIMIT 1
                    `,
                    [
                        reunionId
                    ]
                );


            if (reuniones.length === 0) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Reunión no encontrada."

                    });

            }


            const reunion =
                reuniones[0];


            const finalizadaHoy =
                reunion.Estado === "Finalizada" &&
                reunion.FechaFinalizacion &&
                new Date(reunion.FechaFinalizacion).toDateString() ===
                    new Date().toDateString();


            if (!finalizadaHoy) {

                return res
                    .status(403)
                    .json({

                        ok: false,

                        mensaje:
                            "La ventana de edición para esta reunión ya cerró."

                    });

            }


            connection =
                await db.getConnection();


            await connection.beginTransaction();


            await resincronizarCompromisos(
                connection,
                reunionId,
                compromisos
            );


            await connection.commit();


            return res.json({

                ok: true,

                mensaje:
                    "Compromisos actualizados correctamente."

            });

        }
        catch (error) {

            if (connection) {

                await connection.rollback();

            }


            console.error(
                "ERROR AL RESINCRONIZAR COMPROMISOS:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible actualizar los compromisos.",

                    error:
                        error.message

                });

        }
        finally {

            if (connection) {

                connection.release();

            }

        }

    }
);


/* =========================================================
   GUARDAR PARTICIPANTES DE UNA REUNIÓN
   ========================================================= */

app.post(
    "/api/reuniones/:id/participantes",
    async (req, res) => {

        let connection;

        try {

            const reunionId =
                Number(
                    req.params.id
                );


            const usuarios =
                Array.isArray(
                    req.body.usuarios
                )
                    ? req.body.usuarios
                    : [];


            /* =============================================
               VALIDAR REUNIÓN
               ============================================= */

            if (!reunionId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de reunión no válido."

                    });

            }


            /* =============================================
               VALIDAR PARTICIPANTES
               ============================================= */

            if (
                usuarios.length === 0
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "No se recibieron participantes."

                    });

            }


            connection =
                await db.getConnection();


            await connection.beginTransaction();


            /* =============================================
               INSERTAR PARTICIPANTES
               ============================================= */

            for (
                const usuarioId of usuarios
            ) {

                const idUsuario =
                    Number(
                        usuarioId
                    );


                if (!idUsuario) {

                    continue;

                }


                await connection.execute(
                    `
                    INSERT INTO reunion_participantes
                    (
                        ReunionId,
                        UsuarioId,
                        Asistio
                    )
                    VALUES
                    (
                        ?,
                        ?,
                        0
                    )
                    ON DUPLICATE KEY UPDATE
                        Asistio = Asistio
                    `,
                    [
                        reunionId,
                        idUsuario
                    ]
                );

            }


            await connection.commit();


            return res
                .status(201)
                .json({

                    ok: true,

                    mensaje:
                        "Participantes guardados correctamente."

                });

        }
        catch (error) {

            if (connection) {

                await connection.rollback();

            }


            console.error(
                "ERROR AL GUARDAR PARTICIPANTES:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible guardar los participantes.",

                    error:
                        error.message

                });

        }
        finally {

            if (connection) {

                connection.release();

            }

        }

    }
);


/* =========================================================
   ELIMINAR REUNIÓN
   ---------------------------------------------------------
   Borra la reunión y todo lo que depende de ella
   (compromisos migrados, participantes y secciones)
   dentro de una sola transacción. Si la reunión había
   heredado pendientes de otra (PendientesOrigenId), esa
   reunión origen se desatasca (PendientesConsumidos = 0)
   para que no pierda sus pendientes para siempre.
   ========================================================= */

app.delete(
    "/api/reuniones/:id",
    async (req, res) => {

        let connection;

        try {

            const reunionId =
                Number(
                    req.params.id
                );


            if (!reunionId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de reunión no válido."

                    });

            }


            connection =
                await db.getConnection();

            await connection.beginTransaction();


            /*
             * Si esta reunión había heredado pendientes de otra
             * (PendientesOrigenId), al borrarla esa copia
             * desaparece con ella. Hay que "desatascar" la
             * reunión origen (PendientesConsumidos = 0) para que
             * sus pendientes vuelvan a estar disponibles la
             * próxima vez que se inicie una reunión — si no,
             * quedan huérfanos para siempre.
             */

            const [origenRows] =
                await connection.execute(
                    `
                    SELECT PendientesOrigenId
                    FROM reuniones
                    WHERE ReunionId = ?
                    `,
                    [
                        reunionId
                    ]
                );

            const pendientesOrigenId =
                origenRows.length > 0
                    ? origenRows[0].PendientesOrigenId
                    : null;


            await connection.execute(
                `
                DELETE FROM compromisos
                WHERE ReunionId = ?
                `,
                [
                    reunionId
                ]
            );

            await connection.execute(
                `
                DELETE FROM reunion_participantes
                WHERE ReunionId = ?
                `,
                [
                    reunionId
                ]
            );

            await connection.execute(
                `
                DELETE FROM reunion_secciones
                WHERE ReunionId = ?
                `,
                [
                    reunionId
                ]
            );

            await connection.execute(
                `
                DELETE FROM reunion_enlace_archivos
                WHERE reunion_id = ?
                `,
                [
                    reunionId
                ]
            );

            const [resultado] =
                await connection.execute(
                    `
                    DELETE FROM reuniones
                    WHERE ReunionId = ?
                    `,
                    [
                        reunionId
                    ]
                );


            if (
                resultado.affectedRows === 0
            ) {

                await connection.rollback();

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "No se encontró la reunión."

                    });

            }


            if (pendientesOrigenId) {

                await connection.execute(
                    `
                    UPDATE reuniones
                    SET PendientesConsumidos = 0
                    WHERE ReunionId = ?
                    `,
                    [
                        pendientesOrigenId
                    ]
                );

            }


            await connection.commit();


            return res.json({

                ok: true,

                mensaje:
                    "Reunión eliminada correctamente.",

                pendientesRestaurados:
                    Boolean(pendientesOrigenId)

            });


        }
        catch (error) {

            if (connection) {

                await connection.rollback();

            }


            console.error(
                "ERROR AL ELIMINAR REUNIÓN:"
            );

            console.error(
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible eliminar la reunión.",

                    error:
                        error.message

                });

        }
        finally {

            if (connection) {

                connection.release();

            }

        }

    }
);


/* =========================================================
   CÁLCULO DE VALOR PRESENTE NETO (VPN)
   ---------------------------------------------------------
   Misma fórmula que usaba el formato Excel de VPN que antes
   se subía como archivo adjunto (ver
   js/utils/calcularVPN.js para la versión del frontend, que
   se usa para mostrar el resultado en vivo mientras se
   captura). Se vuelve a calcular aquí para no depender de
   lo que mande el cliente.
   ========================================================= */

function aNumeroVPN(
    valor
) {

    const numero =
        Number(
            valor
        );

    return Number.isFinite(numero)
        ? numero
        : 0;

}


function sumarMontosVPN(
    filas
) {

    return (
        Array.isArray(filas)
            ? filas
            : []
    ).reduce(
        (total, fila) =>
            total +
            aNumeroVPN(
                fila?.total
            ),
        0
    );

}


function calcularVPN({
    tasaDescuentoAnual,
    mesesProyeccion,
    capitalHumano,
    inversiones,
    costos,
    beneficios
}) {

    const capitalHumanoTotal =
        (
            Array.isArray(capitalHumano)
                ? capitalHumano
                : []
        ).reduce(
            (total, fila) =>
                total +
                (
                    aNumeroVPN(fila?.horas) *
                    aNumeroVPN(fila?.salarioDiario)
                ) / 8,
            0
        );

    const inversionesTotal =
        sumarMontosVPN(
            inversiones
        );

    const costosTotal =
        sumarMontosVPN(
            costos
        );

    const beneficiosTotal =
        sumarMontosVPN(
            beneficios
        );

    const flujoNetoMensual =
        beneficiosTotal -
        costosTotal;

    const inversionTotal =
        capitalHumanoTotal +
        inversionesTotal;

    const meses =
        aNumeroVPN(mesesProyeccion) ||
        36;

    const tasaMensual =
        aNumeroVPN(tasaDescuentoAnual) /
        100 /
        12;

    let valorPresenteFlujos =
        0;

    for (
        let mes = 1;
        mes <= meses;
        mes++
    ) {

        valorPresenteFlujos +=
            flujoNetoMensual /
            Math.pow(
                1 + tasaMensual,
                mes
            );

    }

    const resultadoVPN =
        valorPresenteFlujos -
        inversionTotal;

    return {

        capitalHumanoTotal,
        inversionesTotal,
        costosTotal,
        beneficiosTotal,
        flujoNetoMensual,
        inversionTotal,
        resultadoVPN

    };

}


/* =========================================================
   REGISTRAR INNOVACIÓN
   ========================================================= */

app.post(
    "/api/innovaciones",
    uploadInnovacion.fields([
        {
            name: "evidenciaArchivo",
            maxCount: 1
        },
        {
            name: "evidenciaImagenes",
            maxCount: 10
        }
    ]),
    async (req, res) => {

        let connection;

        try {

            const campos =
                req.body;

            const archivos =
                req.files ||
                {};


            /* =============================================
               VALIDACIÓN
               ============================================= */

            const camposObligatorios = {

                areaId:
                    campos.areaId,

                responsableNombre:
                    campos.responsableNombre,

                responsableApellido:
                    campos.responsableApellido,

                nombre:
                    campos.nombre,

                actividad:
                    campos.actividad,

                servicio:
                    campos.servicio,

                problematica:
                    campos.problematica,

                objetivo:
                    campos.objetivo,

                estrategia:
                    campos.estrategia,

                debilidad:
                    campos.debilidad,

                accion1:
                    campos.accion1,

                accion2:
                    campos.accion2,

                accion3:
                    campos.accion3,

                justificacion:
                    campos.justificacion

            };

            const faltante =
                Object.entries(
                    camposObligatorios
                ).find(
                    ([, valor]) =>
                        !valor ||
                        !String(valor).trim()
                );

            if (faltante) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Todos los campos obligatorios deben completarse."

                    });

            }


            let vpnDatos;

            try {

                vpnDatos =
                    JSON.parse(
                        campos.vpnDatos ||
                        "null"
                    );

            }
            catch (error) {

                vpnDatos =
                    null;

            }

            if (
                !vpnDatos ||
                !String(
                    vpnDatos.tasaDescuentoAnual ??
                    ""
                ).trim()
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Debe capturar la tasa de descuento del VPN."

                    });

            }


            /* =============================================
               INSERTAR INNOVACIÓN + ARCHIVOS (BLOB)
               ============================================= */

            connection =
                await db.getConnection();

            await connection.beginTransaction();

            const [resultado] =
                await connection.execute(
                    `
                    INSERT INTO innovaciones
                    (
                        usuario_id,
                        area_id,
                        area_nombre,
                        responsable_nombre,
                        responsable_apellido,
                        nombre_innovacion,
                        actividad_impacta,
                        servicio_relacionado,
                        problematica,
                        objetivo,
                        estrategia,
                        debilidad,
                        accion_1,
                        accion_2,
                        accion_3,
                        accion_4,
                        accion_5,
                        justificacion_valuacion
                    )
                    VALUES
                    (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    )
                    `,
                    [
                        campos.usuarioId || null,
                        campos.areaId,
                        campos.areaNombre || null,
                        campos.responsableNombre.trim(),
                        campos.responsableApellido.trim(),
                        campos.nombre.trim(),
                        campos.actividad.trim(),
                        campos.servicio.trim(),
                        campos.problematica.trim(),
                        campos.objetivo.trim(),
                        campos.estrategia.trim(),
                        campos.debilidad.trim(),
                        campos.accion1.trim(),
                        campos.accion2.trim(),
                        campos.accion3.trim(),
                        campos.accion4 ? campos.accion4.trim() : null,
                        campos.accion5 ? campos.accion5.trim() : null,
                        campos.justificacion.trim()
                    ]
                );

            const innovacionId =
                resultado.insertId;


            /* =============================================
               GUARDAR VPN (RECALCULADO EN EL SERVIDOR)
               ============================================= */

            const resultadoVpn =
                calcularVPN(
                    vpnDatos
                );

            await connection.execute(
                `
                INSERT INTO innovacion_vpn
                (
                    innovacion_id,
                    tasa_descuento_anual,
                    meses_proyeccion,
                    capital_humano,
                    inversiones,
                    costos,
                    beneficios,
                    capital_humano_total,
                    inversiones_total,
                    costos_total,
                    beneficios_total,
                    flujo_neto_mensual,
                    inversion_total,
                    resultado_vpn
                )
                VALUES
                (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
                `,
                [
                    innovacionId,
                    aNumeroVPN(vpnDatos.tasaDescuentoAnual),
                    aNumeroVPN(vpnDatos.mesesProyeccion) || 36,
                    JSON.stringify(vpnDatos.capitalHumano || []),
                    JSON.stringify(vpnDatos.inversiones || []),
                    JSON.stringify(vpnDatos.costos || []),
                    JSON.stringify(vpnDatos.beneficios || []),
                    resultadoVpn.capitalHumanoTotal,
                    resultadoVpn.inversionesTotal,
                    resultadoVpn.costosTotal,
                    resultadoVpn.beneficiosTotal,
                    resultadoVpn.flujoNetoMensual,
                    resultadoVpn.inversionTotal,
                    resultadoVpn.resultadoVPN
                ]
            );


            const archivosAGuardar = [

                ...(
                    archivos.evidenciaArchivo &&
                    archivos.evidenciaArchivo[0]
                        ? [{

                            tipo:
                                "evidencia_archivo",

                            archivo:
                                archivos.evidenciaArchivo[0]

                        }]
                        : []
                ),

                ...(archivos.evidenciaImagenes || []).map(
                    (archivo) => ({

                        tipo:
                            "evidencia_imagen",

                        archivo:
                            archivo

                    })
                )

            ];

            for (const {
                tipo,
                archivo
            } of archivosAGuardar) {

                await connection.execute(
                    `
                    INSERT INTO innovacion_archivos
                    (
                        innovacion_id,
                        tipo,
                        nombre_original,
                        tipo_mime,
                        contenido
                    )
                    VALUES
                    (
                        ?, ?, ?, ?, ?
                    )
                    `,
                    [
                        innovacionId,
                        tipo,
                        archivo.originalname,
                        archivo.mimetype,
                        archivo.buffer
                    ]
                );

            }


            await connection.commit();


            /* =============================================
               RESPUESTA
               ============================================= */

            return res
                .status(201)
                .json({

                    ok: true,

                    mensaje:
                        "Innovación registrada correctamente.",

                    innovacion: {

                        id:
                            innovacionId

                    }

                });


        }
        catch (error) {

            if (connection) {

                await connection.rollback();

            }


            console.error(
                "ERROR AL REGISTRAR INNOVACIÓN:"
            );

            console.error(
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "Error interno al registrar la innovación.",

                    error:
                        error.message

                });

        }
        finally {

            if (connection) {

                connection.release();

            }

        }

    }
);


/* =========================================================
   LISTAR INNOVACIONES (TARJETAS)
   ---------------------------------------------------------
   Abierto a cualquier usuario autenticado, igual que el
   formulario de captura. Trae los archivos de cada innovación
   ya agrupados, para que la tarjeta pueda mostrar sus enlaces
   de descarga sin una petición extra por innovación.
   ========================================================= */

app.get(
    "/api/innovaciones",
    async (req, res) => {

        try {

            const [innovaciones] =
                await db.execute(
                    `
                    SELECT
                        id,
                        area_nombre,
                        responsable_nombre,
                        responsable_apellido,
                        nombre_innovacion,
                        fecha_creacion,
                        aprobada
                    FROM innovaciones
                    ORDER BY fecha_creacion DESC
                    `
                );

            const [archivos] =
                await db.execute(
                    `
                    SELECT
                        id,
                        innovacion_id,
                        tipo,
                        nombre_original,
                        tipo_mime
                    FROM innovacion_archivos
                    ORDER BY id ASC
                    `
                );

            const archivosPorInnovacion =
                new Map();

            for (const archivo of archivos) {

                if (!archivosPorInnovacion.has(archivo.innovacion_id)) {

                    archivosPorInnovacion.set(
                        archivo.innovacion_id,
                        []
                    );

                }

                archivosPorInnovacion.get(archivo.innovacion_id).push({

                    id:
                        archivo.id,

                    tipo:
                        archivo.tipo,

                    nombreOriginal:
                        archivo.nombre_original,

                    tipoMime:
                        archivo.tipo_mime

                });

            }

            const resultado =
                innovaciones.map(
                    (innovacion) => ({

                        id:
                            innovacion.id,

                        areaNombre:
                            innovacion.area_nombre,

                        responsableNombre:
                            `${innovacion.responsable_nombre} ${innovacion.responsable_apellido}`.trim(),

                        nombreInnovacion:
                            innovacion.nombre_innovacion,

                        fechaCreacion:
                            innovacion.fecha_creacion,

                        aprobada:
                            Boolean(innovacion.aprobada),

                        archivos:
                            archivosPorInnovacion.get(innovacion.id) ||
                            []

                    })
                );

            return res.json({

                ok: true,

                innovaciones:
                    resultado

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER INNOVACIONES:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener las innovaciones.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   ESTADO DE LA INNOVACIÓN DEL MES (POR ÁREA)
   ---------------------------------------------------------
   Cada área debe subir una innovación al mes. El % que se ve
   en el perfil de los operadores y la revisión del líder se
   calculan aquí mismo, según el área del usuario que pregunta:
   0%  -> no hay ninguna innovación de esta área este mes
   95% -> ya se subió, falta el visto bueno del líder
   100% -> el líder ya dio el visto bueno
   No se guarda el % en ningún lado: se recalcula cada vez, así
   que al cambiar de mes vuelve a 0% sin necesidad de ningún
   proceso aparte.
   ---------------------------------------------------------
   IMPORTANTE: esta ruta debe registrarse ANTES de
   "/api/innovaciones/:id" (más abajo) — Express prueba las
   rutas en el orden en que se registran, así que si quedara
   después, "estado-mes" se interpretaría como el :id de esa
   ruta y nunca llegaría aquí.
   ========================================================= */

app.get(
    "/api/innovaciones/estado-mes",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "No fue posible identificar al usuario."

                    });

            }


            const [rows] =
                await db.execute(
                    `
                    SELECT
                        id,
                        aprobada
                    FROM innovaciones
                    WHERE
                        area_nombre = ?
                        AND YEAR(fecha_creacion) = YEAR(CURDATE())
                        AND MONTH(fecha_creacion) = MONTH(CURDATE())
                    ORDER BY fecha_creacion DESC
                    LIMIT 1
                    `,
                    [
                        usuarioSolicitante.area
                    ]
                );

            if (rows.length === 0) {

                return res.json({

                    ok: true,

                    area:
                        usuarioSolicitante.area,

                    estado: 0,

                    innovacionId: null

                });

            }

            const innovacionDelMes =
                rows[0];

            return res.json({

                ok: true,

                area:
                    usuarioSolicitante.area,

                estado:
                    innovacionDelMes.aprobada ? 100 : 95,

                innovacionId:
                    innovacionDelMes.id

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER EL ESTADO DE LA INNOVACIÓN DEL MES:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener el estado de la innovación del mes.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   DETALLE DE UNA INNOVACIÓN
   ---------------------------------------------------------
   Trae todos los campos capturados en el formulario, los
   totales del VPN (sin el desglose fila por fila) y la lista
   de archivos adjuntos, para el visor de detalle.
   ========================================================= */

app.get(
    "/api/innovaciones/:id",
    async (req, res) => {

        try {

            const innovacionId =
                Number(
                    req.params.id
                );

            if (!innovacionId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de innovación no válido."

                    });

            }


            const [innovaciones] =
                await db.execute(
                    `
                    SELECT *
                    FROM innovaciones
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [
                        innovacionId
                    ]
                );

            if (innovaciones.length === 0) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Innovación no encontrada."

                    });

            }

            const innovacion =
                innovaciones[0];


            const [vpnFilas] =
                await db.execute(
                    `
                    SELECT
                        tasa_descuento_anual,
                        meses_proyeccion,
                        capital_humano_total,
                        inversiones_total,
                        costos_total,
                        beneficios_total,
                        flujo_neto_mensual,
                        inversion_total,
                        resultado_vpn
                    FROM innovacion_vpn
                    WHERE innovacion_id = ?
                    LIMIT 1
                    `,
                    [
                        innovacionId
                    ]
                );


            const [archivos] =
                await db.execute(
                    `
                    SELECT
                        id,
                        tipo,
                        nombre_original,
                        tipo_mime
                    FROM innovacion_archivos
                    WHERE innovacion_id = ?
                    ORDER BY id ASC
                    `,
                    [
                        innovacionId
                    ]
                );


            return res.json({

                ok: true,

                innovacion: {

                    id:
                        innovacion.id,

                    areaNombre:
                        innovacion.area_nombre,

                    responsableNombre:
                        `${innovacion.responsable_nombre} ${innovacion.responsable_apellido}`.trim(),

                    nombreInnovacion:
                        innovacion.nombre_innovacion,

                    actividadImpacta:
                        innovacion.actividad_impacta,

                    servicioRelacionado:
                        innovacion.servicio_relacionado,

                    problematica:
                        innovacion.problematica,

                    objetivo:
                        innovacion.objetivo,

                    estrategia:
                        innovacion.estrategia,

                    debilidad:
                        innovacion.debilidad,

                    acciones:
                        [
                            innovacion.accion_1,
                            innovacion.accion_2,
                            innovacion.accion_3,
                            innovacion.accion_4,
                            innovacion.accion_5
                        ].filter(Boolean),

                    justificacionValuacion:
                        innovacion.justificacion_valuacion,

                    fechaCreacion:
                        innovacion.fecha_creacion,

                    aprobada:
                        Boolean(innovacion.aprobada),

                    fechaAprobacion:
                        innovacion.fecha_aprobacion,

                    vpn:
                        vpnFilas[0] || null,

                    archivos:
                        archivos.map(
                            (archivo) => ({

                                id:
                                    archivo.id,

                                tipo:
                                    archivo.tipo,

                                nombreOriginal:
                                    archivo.nombre_original,

                                tipoMime:
                                    archivo.tipo_mime

                            })
                        )

                }

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER DETALLE DE INNOVACIÓN:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener el detalle de la innovación.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   DAR VISTO BUENO A UNA INNOVACIÓN (SOLO LÍDER)
   ---------------------------------------------------------
   Solo el líder del área a la que pertenece la innovación
   puede aprobarla.
   ========================================================= */

app.post(
    "/api/innovaciones/:id/aprobar",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "No fue posible identificar al usuario."

                    });

            }


            if (usuarioSolicitante.rol !== "lider") {

                return respuestaSinPermiso(res);

            }


            const innovacionId =
                Number(
                    req.params.id
                );

            if (!innovacionId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de innovación no válido."

                    });

            }


            const [rows] =
                await db.execute(
                    `
                    SELECT area_nombre
                    FROM innovaciones
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [
                        innovacionId
                    ]
                );

            if (rows.length === 0) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Innovación no encontrada."

                    });

            }


            if (rows[0].area_nombre !== usuarioSolicitante.area) {

                return respuestaSinPermiso(res);

            }


            await db.execute(
                `
                UPDATE innovaciones
                SET
                    aprobada = 1,
                    fecha_aprobacion = NOW(),
                    aprobada_por = ?
                WHERE id = ?
                `,
                [
                    usuarioSolicitante.id,
                    innovacionId
                ]
            );


            return res.json({

                ok: true,

                mensaje:
                    "Innovación aprobada correctamente."

            });

        }
        catch (error) {

            console.error(
                "ERROR AL APROBAR LA INNOVACIÓN:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible aprobar la innovación.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   ELIMINAR INNOVACIÓN (SOLO ADMINISTRADOR)
   ========================================================= */

app.delete(
    "/api/innovaciones/:id",
    async (req, res) => {

        let connection;

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "No fue posible identificar al usuario."

                    });

            }


            if (!esAdmin(usuarioSolicitante)) {

                return respuestaSinPermiso(res);

            }


            const innovacionId =
                Number(
                    req.params.id
                );

            if (!innovacionId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de innovación no válido."

                    });

            }


            connection =
                await db.getConnection();

            await connection.beginTransaction();

            await connection.execute(
                `DELETE FROM innovacion_archivos WHERE innovacion_id = ?`,
                [
                    innovacionId
                ]
            );

            await connection.execute(
                `DELETE FROM innovacion_vpn WHERE innovacion_id = ?`,
                [
                    innovacionId
                ]
            );

            const [resultado] =
                await connection.execute(
                    `DELETE FROM innovaciones WHERE id = ?`,
                    [
                        innovacionId
                    ]
                );

            if (resultado.affectedRows === 0) {

                await connection.rollback();

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Innovación no encontrada."

                    });

            }

            await connection.commit();


            return res.json({

                ok: true,

                mensaje:
                    "Innovación eliminada correctamente."

            });

        }
        catch (error) {

            if (connection) {

                await connection.rollback();

            }

            console.error(
                "ERROR AL ELIMINAR LA INNOVACIÓN:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible eliminar la innovación.",

                    error:
                        error.message

                });

        }
        finally {

            if (connection) {

                connection.release();

            }

        }

    }
);


/* =========================================================
   OBTENER ARCHIVO DE INNOVACIÓN
   ---------------------------------------------------------
   Sirve el contenido de un archivo (VPN, evidencia o imagen)
   guardado como BLOB en innovacion_archivos.
   ========================================================= */

app.get(
    "/api/innovaciones/archivos/:archivoId",
    async (req, res) => {

        try {

            const archivoId =
                Number(
                    req.params.archivoId
                );

            if (!archivoId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de archivo no válido."

                    });

            }


            const [rows] =
                await db.execute(
                    `
                    SELECT
                        nombre_original,
                        tipo_mime,
                        contenido
                    FROM innovacion_archivos
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [
                        archivoId
                    ]
                );

            if (rows.length === 0) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Archivo no encontrado."

                    });

            }


            const archivo =
                rows[0];

            res.set(
                "Content-Type",
                archivo.tipo_mime ||
                "application/octet-stream"
            );

            res.set(
                "Content-Disposition",
                `inline; filename="${encodeURIComponent(archivo.nombre_original)}"`
            );

            return res.send(
                archivo.contenido
            );


        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER ARCHIVO DE INNOVACIÓN:"
            );

            console.error(
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener el archivo.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   SUBIR ARCHIVO DE ENLACE (COMPETITIVIDAD)
   ---------------------------------------------------------
   Guarda el archivo como BLOB en reunion_enlace_archivos,
   ligado a la reunión. El metadato (id devuelto aquí) es lo
   que se guarda en el JSON de la sección "enlaces".
   ========================================================= */

app.post(
    "/api/reuniones/:id/enlaces/archivo",
    (req, res) => {

        uploadEnlaceArchivo.single("archivo")(
            req,
            res,
            async (errorSubida) => {

                if (errorSubida) {

                    return res
                        .status(400)
                        .json({

                            ok: false,

                            mensaje:
                                errorSubida.message ||
                                "No fue posible subir el archivo."

                        });

                }


                try {

                    const reunionId =
                        Number(
                            req.params.id
                        );

                    if (!reunionId) {

                        return res
                            .status(400)
                            .json({

                                ok: false,

                                mensaje:
                                    "ID de reunión no válido."

                            });

                    }


                    if (!req.file) {

                        return res
                            .status(400)
                            .json({

                                ok: false,

                                mensaje:
                                    "No se recibió ningún archivo."

                            });

                    }


                    const [result] =
                        await db.execute(
                            `
                            INSERT INTO reunion_enlace_archivos
                            (
                                reunion_id,
                                nombre_original,
                                tipo_mime,
                                contenido
                            )
                            VALUES
                            (
                                ?, ?, ?, ?
                            )
                            `,
                            [
                                reunionId,
                                req.file.originalname,
                                req.file.mimetype,
                                req.file.buffer
                            ]
                        );

                    return res.json({

                        ok: true,

                        archivoId:
                            result.insertId,

                        nombreOriginal:
                            req.file.originalname,

                        tipoMime:
                            req.file.mimetype

                    });

                }
                catch (error) {

                    console.error(
                        "ERROR AL SUBIR ARCHIVO DE ENLACE:",
                        error
                    );

                    return res
                        .status(500)
                        .json({

                            ok: false,

                            mensaje:
                                "No fue posible subir el archivo.",

                            error:
                                error.message

                        });

                }

            }
        );

    }
);


/* =========================================================
   OBTENER ARCHIVO DE ENLACE (COMPETITIVIDAD)
   ---------------------------------------------------------
   Sirve el contenido de un archivo (imagen o PDF) guardado
   como BLOB en reunion_enlace_archivos.
   ========================================================= */

app.get(
    "/api/enlaces/archivos/:archivoId",
    async (req, res) => {

        try {

            const archivoId =
                Number(
                    req.params.archivoId
                );

            if (!archivoId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de archivo no válido."

                    });

            }


            const [rows] =
                await db.execute(
                    `
                    SELECT
                        nombre_original,
                        tipo_mime,
                        contenido
                    FROM reunion_enlace_archivos
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [
                        archivoId
                    ]
                );

            if (rows.length === 0) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Archivo no encontrado."

                    });

            }


            const archivo =
                rows[0];

            res.set(
                "Content-Type",
                archivo.tipo_mime ||
                "application/octet-stream"
            );

            res.set(
                "Content-Disposition",
                `inline; filename="${encodeURIComponent(archivo.nombre_original)}"`
            );

            return res.send(
                archivo.contenido
            );

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER ARCHIVO DE ENLACE:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener el archivo.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   ELIMINAR ARCHIVO DE ENLACE (COMPETITIVIDAD)
   ---------------------------------------------------------
   Borra el BLOB de reunion_enlace_archivos cuando el usuario
   quita el enlace correspondiente desde la sección "enlaces".
   ========================================================= */

app.delete(
    "/api/enlaces/archivos/:archivoId",
    async (req, res) => {

        try {

            const archivoId =
                Number(
                    req.params.archivoId
                );

            if (!archivoId) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de archivo no válido."

                    });

            }


            const [resultado] =
                await db.execute(
                    `
                    DELETE FROM reunion_enlace_archivos
                    WHERE id = ?
                    `,
                    [
                        archivoId
                    ]
                );

            if (resultado.affectedRows === 0) {

                return res
                    .status(404)
                    .json({

                        ok: false,

                        mensaje:
                            "Archivo no encontrado."

                    });

            }

            return res.json({

                ok: true,

                mensaje:
                    "Archivo eliminado correctamente."

            });

        }
        catch (error) {

            console.error(
                "ERROR AL ELIMINAR ARCHIVO DE ENLACE:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible eliminar el archivo.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   VISOR DE ARCHIVOS (SOLO ADMINISTRADOR)
   ---------------------------------------------------------
   Metadatos (sin el BLOB) de los adjuntos subidos durante las
   reuniones (reunion_enlace_archivos), para listarlos y
   descargarlos desde un solo lugar. Las innovaciones tienen su
   propia vista de tarjetas (ver GET /api/innovaciones) y no se
   listan aquí para no duplicarlas. La descarga real sigue
   pasando por el endpoint ya existente
   (/api/enlaces/archivos/:id).
   ========================================================= */

app.get(
    "/api/archivos",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "No fue posible identificar al usuario."

                    });

            }


            if (!esAdmin(usuarioSolicitante)) {

                return respuestaSinPermiso(res);

            }


            const [rows] =
                await db.execute(
                    `
                    SELECT
                        ea.id AS archivoId,
                        ea.nombre_original AS nombreArchivo,
                        ea.tipo_mime AS tipoMime,
                        ea.fecha_creacion AS fechaCreacion,
                        r.Titulo AS referenciaTitulo,
                        DATE_FORMAT(r.FechaInicio, '%Y-%m-%d') AS referenciaSubtitulo,
                        COALESCE(s.SubsidiaryName, u.departamento) AS departamentoNombre,
                        COALESCE(a.AreaName, u.area) AS areaNombre
                    FROM reunion_enlace_archivos ea
                    INNER JOIN reuniones r
                        ON r.ReunionId = ea.reunion_id
                    LEFT JOIN subsidiaries s
                        ON s.SubsidiaryId = r.DepartamentoId
                    LEFT JOIN areas a
                        ON a.AreaId = r.AreaId
                    LEFT JOIN usuarios u
                        ON u.id = r.UsuarioCreadorId
                    ORDER BY ea.fecha_creacion DESC
                    `
                );


            return res.json({

                ok: true,

                archivos:
                    rows

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER EL LISTADO DE ARCHIVOS:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener el listado de archivos.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   EVALUACIONES (ESCALA DE LIKERT)
   ---------------------------------------------------------
   Respuestas anónimas (evaluacion_respuestas no guarda quién
   respondió). evaluacion_envios sí guarda usuario_id, pero
   solo para impedir respuestas duplicadas por periodo/
   formulario/colega y mostrar "ya respondiste" — nunca se usa
   para mostrar resultados individuales.
   ========================================================= */

function evaluacionFormularioVisible(
    definicion,
    usuarioSolicitante
) {

    if (
        definicion.soloRoles &&
        !definicion.soloRoles.includes(usuarioSolicitante.rol)
    ) {

        return false;

    }

    if (
        definicion.ocultarParaAreas &&
        definicion.ocultarParaAreas.includes(usuarioSolicitante.area)
    ) {

        return false;

    }

    return true;

}


function evaluacionFormularioHabilitadoEnPeriodo(
    periodoActivo,
    slug
) {

    return (
        Array.isArray(periodoActivo?.formulariosHabilitados) &&
        periodoActivo.formulariosHabilitados.includes(slug)
    );

}


async function obtenerPeriodoEvaluacionActivo() {

    const [filas] =
        await db.execute(
            `
            SELECT id, nombre, fecha_inicio, fecha_fin, activo, formularios_habilitados
            FROM evaluacion_periodos
            WHERE activo = 1
            ORDER BY creado_en DESC
            LIMIT 1
            `
        );

    const periodo =
        filas[0] || null;

    if (!periodo) {
        return null;
    }

    const formulariosHabilitados =
        typeof periodo.formularios_habilitados === "string"
            ? JSON.parse(periodo.formularios_habilitados)
            : periodo.formularios_habilitados;

    return {

        ...periodo,

        formulariosHabilitados:
            Array.isArray(formulariosHabilitados)
                ? formulariosHabilitados
                : FORMULARIOS_VALIDOS

    };

}


/* =========================================================
   ESTADO DE EVALUACIONES (PERIODO ACTIVO + FORMULARIOS)
   ========================================================= */

app.get(
    "/api/evaluaciones/estado",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "No fue posible identificar al usuario."

                    });

            }


            const periodoActivo =
                await obtenerPeriodoEvaluacionActivo();

            const formularios = {};

            if (!periodoActivo) {

                for (const slug of FORMULARIOS_VALIDOS) {

                    formularios[slug] = {
                        visible: false
                    };

                }

                return res.json({

                    ok: true,

                    periodoActivo: null,

                    formularios

                });

            }


            const [enviosPropios] =
                await db.execute(
                    `
                    SELECT formulario, colega_objetivo_id
                    FROM evaluacion_envios
                    WHERE periodo_id = ? AND usuario_id = ?
                    `,
                    [
                        periodoActivo.id,
                        usuarioSolicitante.id
                    ]
                );


            const [lideresArea] =
                await db.execute(
                    `
                    SELECT id, nombre
                    FROM usuarios
                    WHERE area = ? AND rol = 'lider' AND activo = 1
                    LIMIT 1
                    `,
                    [
                        usuarioSolicitante.area
                    ]
                );

            const liderArea =
                lideresArea[0] || null;

            const yaEvaluoALider =
                enviosPropios.some(
                    (envio) => envio.formulario === "lider_dpto"
                );


            for (const slug of FORMULARIOS_VALIDOS) {

                const definicion =
                    FORMULARIOS_EVALUACION[slug];

                if (
                    !evaluacionFormularioVisible(definicion, usuarioSolicitante) ||
                    !evaluacionFormularioHabilitadoEnPeriodo(periodoActivo, slug)
                ) {

                    formularios[slug] = {
                        visible: false
                    };

                    continue;

                }


                if (definicion.objetivo === "colega_area") {

                    const [colegasFilas] =
                        await db.execute(
                            `
                            SELECT id, nombre
                            FROM usuarios
                            WHERE area = ? AND activo = 1 AND id <> ?
                            ORDER BY nombre
                            `,
                            [
                                usuarioSolicitante.area,
                                usuarioSolicitante.id
                            ]
                        );

                    /*
                     * El líder ya tiene su propia encuesta
                     * dedicada ("Evaluación a líder de dpto.").
                     * En cuanto el usuario la responde, el
                     * líder deja de aparecer aquí como
                     * "compañero" para no evaluarlo dos veces.
                     */

                    const colegasFiltrados =
                        colegasFilas.filter(
                            (colega) =>
                                !(
                                    yaEvaluoALider &&
                                    liderArea &&
                                    colega.id === liderArea.id
                                )
                        );

                    const idsYaEvaluados =
                        enviosPropios
                            .filter((envio) => envio.formulario === slug)
                            .map((envio) => envio.colega_objetivo_id);

                    const colegas =
                        colegasFiltrados.map((colega) => ({

                            id: colega.id,

                            nombre: colega.nombre,

                            yaEvaluado:
                                idsYaEvaluados.includes(colega.id)

                        }));

                    formularios[slug] = {

                        visible: true,

                        colegas,

                        todosEvaluados:
                            colegas.length > 0 &&
                            colegas.every((colega) => colega.yaEvaluado)

                    };

                    continue;

                }


                if (definicion.objetivo === "lider_area") {

                    formularios[slug] = {

                        visible: true,

                        liderNombre:
                            liderArea?.nombre || null,

                        yaRespondido:
                            yaEvaluoALider

                    };

                    continue;

                }


                const yaRespondido =
                    enviosPropios.some(
                        (envio) => envio.formulario === slug
                    );

                formularios[slug] = {

                    visible: true,

                    yaRespondido

                };

            }


            return res.json({

                ok: true,

                periodoActivo: {

                    id: periodoActivo.id,

                    nombre: periodoActivo.nombre,

                    fechaInicio: periodoActivo.fecha_inicio,

                    fechaFin: periodoActivo.fecha_fin

                },

                formularios

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER ESTADO DE EVALUACIONES:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener el estado de las evaluaciones.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   ENVIAR RESPUESTAS DE UN FORMULARIO
   ========================================================= */

app.post(
    "/api/evaluaciones/respuestas",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({

                        ok: false,

                        mensaje:
                            "No fue posible identificar al usuario."

                    });

            }


            const {
                formulario,
                respuestas,
                colegaObjetivoId
            } = req.body;


            if (!FORMULARIOS_VALIDOS.includes(formulario)) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Formulario de evaluación no válido."

                    });

            }


            const definicion =
                FORMULARIOS_EVALUACION[formulario];

            if (!evaluacionFormularioVisible(definicion, usuarioSolicitante)) {

                return respuestaSinPermiso(res);

            }


            const periodoActivo =
                await obtenerPeriodoEvaluacionActivo();

            if (!periodoActivo) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "No hay un periodo de evaluación activo."

                    });

            }


            if (!evaluacionFormularioHabilitadoEnPeriodo(periodoActivo, formulario)) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Este formulario no está habilitado en el periodo actual."

                    });

            }


            if (
                !respuestas ||
                typeof respuestas !== "object"
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Las respuestas son obligatorias."

                    });

            }


            const idsEsperados =
                definicion.preguntaIds;

            const idsRecibidos =
                Object.keys(respuestas);

            const respuestasCompletas =
                idsEsperados.length === idsRecibidos.length &&
                idsEsperados.every(
                    (id) => VALORES_LIKERT_VALIDOS.includes(respuestas[id])
                );

            if (!respuestasCompletas) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Debes responder todas las preguntas del formulario."

                    });

            }


            /* =============================================
               RESOLVER DESTINATARIO SEGÚN EL TIPO DE FORMULARIO
               ============================================= */

            let areaObjetivo = null;
            let departamentoObjetivo = null;
            let colegaObjetivoIdFinal = 0;

            if (definicion.objetivo === "area_fija") {

                areaObjetivo =
                    definicion.areaObjetivo;

                const [subsidiariaObjetivo] =
                    await db.execute(
                        `
                        SELECT s.SubsidiaryName
                        FROM areas a
                        INNER JOIN subsidiaries s ON s.SubsidiaryId = a.SubsidiaryId
                        WHERE a.AreaName = ?
                        LIMIT 1
                        `,
                        [
                            definicion.areaObjetivo
                        ]
                    );

                departamentoObjetivo =
                    subsidiariaObjetivo[0]?.SubsidiaryName || null;

            }
            else if (definicion.objetivo === "lider_area") {

                const [lideres] =
                    await db.execute(
                        `
                        SELECT id
                        FROM usuarios
                        WHERE area = ? AND rol = 'lider' AND activo = 1
                        LIMIT 1
                        `,
                        [
                            usuarioSolicitante.area
                        ]
                    );

                if (lideres.length === 0) {

                    return res
                        .status(400)
                        .json({

                            ok: false,

                            mensaje:
                                "Tu área no tiene un líder asignado."

                        });

                }

                areaObjetivo =
                    usuarioSolicitante.area;

                departamentoObjetivo =
                    usuarioSolicitante.departamento;

            }
            else if (definicion.objetivo === "colega_area") {

                const idColega =
                    Number(colegaObjetivoId);

                if (!idColega || idColega === usuarioSolicitante.id) {

                    return res
                        .status(400)
                        .json({

                            ok: false,

                            mensaje:
                                "Selecciona a un compañero válido para evaluar."

                        });

                }

                const [colegas] =
                    await db.execute(
                        `
                        SELECT id, area
                        FROM usuarios
                        WHERE id = ? AND area = ? AND activo = 1
                        LIMIT 1
                        `,
                        [
                            idColega,
                            usuarioSolicitante.area
                        ]
                    );

                if (colegas.length === 0) {

                    return res
                        .status(400)
                        .json({

                            ok: false,

                            mensaje:
                                "El compañero seleccionado no es válido."

                        });

                }


                /*
                 * El líder ya tiene su propia encuesta dedicada:
                 * en cuanto el usuario la respondió, no puede
                 * volver a evaluarlo aquí como "compañero".
                 */

                const [enviosLiderPrevio] =
                    await db.execute(
                        `
                        SELECT id
                        FROM evaluacion_envios
                        WHERE periodo_id = ? AND usuario_id = ? AND formulario = 'lider_dpto'
                        LIMIT 1
                        `,
                        [
                            periodoActivo.id,
                            usuarioSolicitante.id
                        ]
                    );

                const [lideresArea] =
                    await db.execute(
                        `
                        SELECT id
                        FROM usuarios
                        WHERE area = ? AND rol = 'lider' AND activo = 1
                        LIMIT 1
                        `,
                        [
                            usuarioSolicitante.area
                        ]
                    );

                if (
                    enviosLiderPrevio.length > 0 &&
                    lideresArea[0]?.id === idColega
                ) {

                    return res
                        .status(400)
                        .json({

                            ok: false,

                            mensaje:
                                "Ya evaluaste a esta persona como líder de tu área."

                        });

                }

                areaObjetivo =
                    colegas[0].area;

                departamentoObjetivo =
                    usuarioSolicitante.departamento;

                colegaObjetivoIdFinal =
                    idColega;

            }


            /* =============================================
               GUARDAR (ENVÍO + RESPUESTA ANÓNIMA)
               ============================================= */

            const connection =
                await db.getConnection();

            try {

                await connection.beginTransaction();

                await connection.execute(
                    `
                    INSERT INTO evaluacion_envios
                        (periodo_id, usuario_id, formulario, colega_objetivo_id)
                    VALUES (?, ?, ?, ?)
                    `,
                    [
                        periodoActivo.id,
                        usuarioSolicitante.id,
                        formulario,
                        colegaObjetivoIdFinal
                    ]
                );

                await connection.execute(
                    `
                    INSERT INTO evaluacion_respuestas
                        (periodo_id, formulario, area_evaluador, area_objetivo, departamento_evaluador, departamento_objetivo, colega_objetivo_id, respuestas_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        periodoActivo.id,
                        formulario,
                        usuarioSolicitante.area,
                        areaObjetivo,
                        usuarioSolicitante.departamento,
                        departamentoObjetivo,
                        colegaObjetivoIdFinal || null,
                        JSON.stringify(respuestas)
                    ]
                );

                await connection.commit();

            }
            catch (errorTransaccion) {

                await connection.rollback();

                if (errorTransaccion.code === "ER_DUP_ENTRY") {

                    return res
                        .status(409)
                        .json({

                            ok: false,

                            mensaje:
                                "Ya respondiste este formulario en el periodo actual."

                        });

                }

                throw errorTransaccion;

            }
            finally {

                connection.release();

            }


            return res.json({

                ok: true,

                mensaje:
                    "Evaluación registrada correctamente."

            });

        }
        catch (error) {

            console.error(
                "ERROR AL GUARDAR RESPUESTAS DE EVALUACIÓN:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible registrar la evaluación.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   PERIODOS DE EVALUACIÓN
   ========================================================= */

app.get(
    "/api/evaluaciones/periodos",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (
                !usuarioSolicitante ||
                (usuarioSolicitante.rol !== "administrador" && usuarioSolicitante.rol !== "lider")
            ) {

                return respuestaSinPermiso(res);

            }


            const [periodos] =
                await db.execute(
                    `
                    SELECT id, nombre, fecha_inicio, fecha_fin, activo, formularios_habilitados
                    FROM evaluacion_periodos
                    ORDER BY creado_en DESC
                    `
                );


            return res.json({

                ok: true,

                periodos:
                    periodos.map((periodo) => ({

                        ...periodo,

                        formularios_habilitados:
                            typeof periodo.formularios_habilitados === "string"
                                ? JSON.parse(periodo.formularios_habilitados)
                                : (periodo.formularios_habilitados || FORMULARIOS_VALIDOS)

                    }))

            });

        }
        catch (error) {

            console.error(
                "ERROR AL LISTAR PERIODOS DE EVALUACIÓN:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener los periodos de evaluación.",

                    error:
                        error.message

                });

        }

    }
);


app.post(
    "/api/evaluaciones/periodos",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!esAdmin(usuarioSolicitante)) {

                return respuestaSinPermiso(res);

            }


            const {
                nombre,
                fechaInicio,
                fechaFin,
                formularios
            } = req.body;


            if (!nombre || !fechaInicio) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "El nombre y la fecha de inicio son obligatorios."

                    });

            }


            const formulariosSeleccionados =
                Array.isArray(formularios)
                    ? formularios.filter((slug) => FORMULARIOS_VALIDOS.includes(slug))
                    : [];

            if (formulariosSeleccionados.length === 0) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Selecciona al menos una encuesta para incluir en el periodo."

                    });

            }


            const connection =
                await db.getConnection();

            try {

                await connection.beginTransaction();

                await connection.execute(
                    `UPDATE evaluacion_periodos SET activo = 0 WHERE activo = 1`
                );

                const [resultado] =
                    await connection.execute(
                        `
                        INSERT INTO evaluacion_periodos
                            (nombre, fecha_inicio, fecha_fin, activo, creado_por, formularios_habilitados)
                        VALUES (?, ?, ?, 1, ?, ?)
                        `,
                        [
                            nombre,
                            fechaInicio,
                            fechaFin || null,
                            usuarioSolicitante.id,
                            JSON.stringify(formulariosSeleccionados)
                        ]
                    );

                await connection.commit();

                return res.json({

                    ok: true,

                    mensaje:
                        "Periodo de evaluación creado y abierto.",

                    periodoId:
                        resultado.insertId

                });

            }
            catch (errorTransaccion) {

                await connection.rollback();

                throw errorTransaccion;

            }
            finally {

                connection.release();

            }

        }
        catch (error) {

            console.error(
                "ERROR AL CREAR PERIODO DE EVALUACIÓN:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible crear el periodo de evaluación.",

                    error:
                        error.message

                });

        }

    }
);


app.patch(
    "/api/evaluaciones/periodos/:id",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!esAdmin(usuarioSolicitante)) {

                return respuestaSinPermiso(res);

            }


            const id =
                Number(req.params.id);

            if (!id) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de periodo no válido."

                    });

            }


            await db.execute(
                `
                UPDATE evaluacion_periodos
                SET activo = 0
                WHERE id = ?
                `,
                [
                    id
                ]
            );


            return res.json({

                ok: true,

                mensaje:
                    "Periodo de evaluación cerrado."

            });

        }
        catch (error) {

            console.error(
                "ERROR AL CERRAR PERIODO DE EVALUACIÓN:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible cerrar el periodo de evaluación.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   RESULTADOS (SOLO LÍDERES Y ADMINISTRADORES)
   ========================================================= */

app.get(
    "/api/evaluaciones/resultados",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (
                !usuarioSolicitante ||
                (usuarioSolicitante.rol !== "administrador" && usuarioSolicitante.rol !== "lider")
            ) {

                return respuestaSinPermiso(res);

            }


            const periodoId =
                Number(req.query.periodoId);

            const formulario =
                req.query.formulario;

            if (
                !periodoId ||
                !FORMULARIOS_VALIDOS.includes(formulario)
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Periodo y formulario son obligatorios."

                    });

            }


            /*
             * Formularios con destinatario (líder de dpto.,
             * colaborador a colaborador, otros dptos a TI) se
             * agrupan por el área/departamento del destinatario;
             * los de opinión general (general, clima) se agrupan
             * por el área/departamento de quien respondió.
             */

            const usaColumnaObjetivo =
                [
                    "lider_dpto",
                    "colaborador_colaborador",
                    "otros_dptos_ti"
                ].includes(formulario);

            const columnaArea =
                usaColumnaObjetivo
                    ? "area_objetivo"
                    : "area_evaluador";

            const columnaDepartamento =
                usaColumnaObjetivo
                    ? "departamento_objetivo"
                    : "departamento_evaluador";


            /*
             * Un líder solo ve resultados relacionados con su
             * propia área; un administrador ve todo.
             */

            let filtroArea =
                "";

            const parametrosFiltro =
                [
                    periodoId,
                    formulario
                ];

            if (usuarioSolicitante.rol === "lider") {

                if (
                    formulario === "otros_dptos_ti" &&
                    usuarioSolicitante.area !== "Tecnologías de la Información"
                ) {

                    return respuestaSinPermiso(res);

                }

                filtroArea =
                    `AND ${columnaArea} = ?`;

                parametrosFiltro.push(
                    usuarioSolicitante.area
                );

            }


            /*
             * Filtro opcional por departamento (sucursal), para
             * ver los resultados de un solo departamento a la
             * vez. Disponible para administradores y líderes.
             */

            let filtroDepartamento =
                "";

            const departamento =
                req.query.departamento;

            if (departamento && departamento !== "todos") {

                filtroDepartamento =
                    `AND ${columnaDepartamento} = ?`;

                parametrosFiltro.push(
                    departamento
                );

            }


            const [filas] =
                await db.execute(
                    `
                    SELECT respuestas_json
                    FROM evaluacion_respuestas
                    WHERE periodo_id = ? AND formulario = ? ${filtroArea} ${filtroDepartamento}
                    `,
                    parametrosFiltro
                );


            const idsPregunta =
                FORMULARIOS_EVALUACION[formulario].preguntaIds;

            const acumulado = {};

            for (const idPregunta of idsPregunta) {

                acumulado[idPregunta] = {

                    totalPuntaje: 0,

                    totalRespuestas: 0,

                    distribucion: {

                        totalmente_acuerdo: 0,
                        de_acuerdo: 0,
                        neutral: 0,
                        en_desacuerdo: 0,
                        totalmente_desacuerdo: 0

                    }

                };

            }

            for (const fila of filas) {

                const respuestas =
                    typeof fila.respuestas_json === "string"
                        ? JSON.parse(fila.respuestas_json)
                        : fila.respuestas_json;

                for (const idPregunta of idsPregunta) {

                    const valor =
                        respuestas[idPregunta];

                    if (!VALORES_LIKERT_VALIDOS.includes(valor)) {
                        continue;
                    }

                    acumulado[idPregunta].totalPuntaje +=
                        PUNTAJE_LIKERT[valor];

                    acumulado[idPregunta].totalRespuestas += 1;

                    acumulado[idPregunta].distribucion[valor] += 1;

                }

            }

            const preguntas =
                idsPregunta.map(
                    (idPregunta) => {

                        const datos =
                            acumulado[idPregunta];

                        return {

                            id: idPregunta,

                            totalRespuestas:
                                datos.totalRespuestas,

                            promedio:
                                datos.totalRespuestas > 0
                                    ? Number(
                                        (datos.totalPuntaje / datos.totalRespuestas).toFixed(2)
                                    )
                                    : null,

                            distribucion:
                                datos.distribucion

                        };

                    }
                );


            return res.json({

                ok: true,

                total:
                    filas.length,

                preguntas

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER RESULTADOS DE EVALUACIONES:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener los resultados de evaluaciones.",

                    error:
                        error.message

                });

        }

    }
);


/* =========================================================
   RUTA NO ENCONTRADA
   ========================================================= */

app.use(
    (req, res) => {

        res
            .status(404)
            .json({

                ok: false,

                mensaje:
                    "Ruta API no encontrada.",

                ruta:
                    req.originalUrl,

                metodo:
                    req.method

            });

    }
);


/* =========================================================
   INICIAR SERVIDOR
   ========================================================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "===================================="
        );

        console.log(
            " FLOW - SERVIDOR"
        );

        console.log(
            "===================================="
        );

        console.log(
            `Servidor escuchando en el puerto ${PORT}`
        );

        console.log(
            `API local: http://localhost:${PORT}/api`
        );

        console.log(
            "===================================="
        );

    }
);