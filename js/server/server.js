const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const multer = require("multer");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const path = require("path");

const db = require("./db");

const {
    VALORES_LIKERT_VALIDOS,
    PUNTAJE_LIKERT
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
   CORREO ELECTRÓNICO
   ========================================================= */

function crearTransportadorCorreo() {

    const host =
        String(process.env.SMTP_HOST || "").trim();

    const port =
        Number(process.env.SMTP_PORT || 465);

    const secure =
        String(process.env.SMTP_SECURE || "true").toLowerCase() === "true";

    const user =
        String(process.env.SMTP_USER || "").trim();

    const password =
        String(process.env.SMTP_PASSWORD || "");

    if (!host || !user || !password) {
        throw new Error(
            "El servicio de correo no está configurado. Revisa SMTP_HOST, SMTP_USER y SMTP_PASSWORD en .env."
        );
    }

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass: password
        }
    });

}


function nombreArchivoSeguro(valor) {

    return String(valor || "reunion-flow")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .substring(0, 100) || "reunion-flow";

}


/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(
    cors()
);

app.use(
    express.json({
        limit: "5mb"
    })
);


/* =========================================================
   FORMATOS PERMITIDOS EN SUBIDAS
   ---------------------------------------------------------
   El frontend ya convierte las imágenes a WebP y las reduce
   (ver js/utils/normalizarImagen.js), pero el servidor no
   confía en eso ni en el mimetype que manda el navegador (se
   puede falsificar): revisa la firma real del archivo (sus
   primeros bytes). Así se rechazan SVG (pueden traer scripts),
   HEIC (Chrome/Edge no los muestran) y archivos renombrados.
   ========================================================= */

const TIPOS_IMAGEN_PERMITIDOS = [
    "image/jpeg",
    "image/png",
    "image/webp"
];


function detectarTipoArchivo(
    buffer
) {

    if (
        !buffer ||
        buffer.length < 12
    ) {

        return null;

    }


    if (
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    ) {

        return "image/jpeg";

    }


    if (
        buffer
            .subarray(0, 8)
            .equals(
                Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            )
    ) {

        return "image/png";

    }


    if (
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    ) {

        return "image/webp";

    }


    if (
        buffer.toString("ascii", 0, 5) === "%PDF-"
    ) {

        return "application/pdf";

    }


    return null;

}


/* =========================================================
   EVIDENCIA DE INNOVACIONES (PDF / WORD / EXCEL)
   ---------------------------------------------------------
   Igual que con las imágenes, el tipo se decide por la firma
   real del archivo y no por el mimetype del navegador. Word y
   Excel no tienen firma propia: .docx/.xlsx son ZIP ("PK") y
   .doc/.xls son OLE2, así que la firma se cruza con la
   extensión. Devuelve el MIME a guardar, o null si no es
   un formato permitido.
   ========================================================= */

const FIRMA_ZIP =
    Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const FIRMA_OLE2 =
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const TIPOS_EVIDENCIA_OFFICE = {
    ".docx": {
        firma: FIRMA_ZIP,
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    },
    ".xlsx": {
        firma: FIRMA_ZIP,
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    },
    ".doc": {
        firma: FIRMA_OLE2,
        mime: "application/msword"
    },
    ".xls": {
        firma: FIRMA_OLE2,
        mime: "application/vnd.ms-excel"
    }
};


function detectarTipoEvidenciaArchivo(
    archivo
) {

    if (
        detectarTipoArchivo(
            archivo.buffer
        ) === "application/pdf"
    ) {

        return "application/pdf";

    }


    const extension =
        path
            .extname(
                archivo.originalname || ""
            )
            .toLowerCase();

    const tipoOffice =
        TIPOS_EVIDENCIA_OFFICE[extension];

    if (
        tipoOffice &&
        archivo.buffer &&
        archivo.buffer
            .subarray(0, tipoOffice.firma.length)
            .equals(
                tipoOffice.firma
            )
    ) {

        return tipoOffice.mime;

    }


    return null;

}


/* =========================================================
   ENVIAR UN ARCHIVO GUARDADO EN MySQL
   ---------------------------------------------------------
   nosniff evita que el navegador "adivine" otro tipo (p. ej.
   HTML) a partir del contenido. Solo imágenes y PDF se
   muestran en línea; cualquier otro tipo (Word, Excel o un
   tipo raro guardado antes de validar firmas) se descarga.
   ========================================================= */

const TIPOS_MOSTRABLES_EN_LINEA = [
    ...TIPOS_IMAGEN_PERMITIDOS,
    "application/pdf"
];


function enviarArchivoGuardado(
    res,
    archivo
) {

    const enLinea =
        TIPOS_MOSTRABLES_EN_LINEA.includes(
            archivo.tipo_mime
        );

    res.set(
        "Content-Type",
        archivo.tipo_mime ||
        "application/octet-stream"
    );

    res.set(
        "X-Content-Type-Options",
        "nosniff"
    );

    res.set(
        "Content-Disposition",
        `${enLinea ? "inline" : "attachment"}; filename="${encodeURIComponent(archivo.nombre_original)}"`
    );

    return res.send(
        archivo.contenido
    );

}


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
        },

        /*
         * Solo las imágenes de evidencia se restringen; el
         * archivo de evidencia (PDF/Word/Excel) no cambia.
         */
        fileFilter:
            (req, file, cb) => {

                if (
                    file.fieldname === "evidenciaImagenes" &&
                    !TIPOS_IMAGEN_PERMITIDOS.includes(file.mimetype)
                ) {

                    return cb(
                        new Error(
                            "Las imágenes de evidencia deben ser JPG, PNG o WebP."
                        )
                    );

                }

                cb(null, true);

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
                    TIPOS_IMAGEN_PERMITIDOS.includes(file.mimetype) ||
                    file.mimetype === "application/pdf";

                if (!permitido) {

                    return cb(
                        new Error(
                            "Solo se permiten imágenes JPG, PNG, WebP o archivos PDF."
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
                    TIPOS_IMAGEN_PERMITIDOS.includes(file.mimetype);

                if (!permitido) {

                    return cb(
                        new Error(
                            "Solo se permiten imágenes JPG, PNG o WebP."
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
   ALCANCE DE REUNIONES POR DEPARTAMENTO
   ---------------------------------------------------------
   administrador ve todas (y usa los filtros del historial
   para acotar). lider y operador solo ven reuniones de su
   propio departamento, más las que ellos crearon o en las
   que están como participantes (aunque sean de otro
   departamento, si los invitaron). Las reuniones viejas sin
   DepartamentoId se asignan al departamento de su creador.
   ========================================================= */

function filtroAlcanceReuniones(usuarioSolicitante) {

    if (esAdmin(usuarioSolicitante)) {

        return {
            sql: "",
            parametros: []
        };

    }


    return {

        sql: `
            AND (
                r.DepartamentoId = (
                    SELECT sAlcance.SubsidiaryId
                    FROM subsidiaries sAlcance
                    WHERE TRIM(sAlcance.SubsidiaryName) = TRIM(?)
                    LIMIT 1
                )
                OR (
                    r.DepartamentoId IS NULL
                    AND EXISTS (
                        SELECT 1
                        FROM usuarios uAlcance
                        WHERE
                            uAlcance.id = r.UsuarioCreadorId
                            AND TRIM(uAlcance.departamento) = TRIM(?)
                    )
                )
                OR r.UsuarioCreadorId = ?
                OR EXISTS (
                    SELECT 1
                    FROM reunion_participantes rpAlcance
                    WHERE
                        rpAlcance.ReunionId = r.ReunionId
                        AND rpAlcance.UsuarioId = ?
                )
            )
        `,

        parametros: [
            usuarioSolicitante.departamento || "",
            usuarioSolicitante.departamento || "",
            usuarioSolicitante.id,
            usuarioSolicitante.id
        ]

    };

}


/*
 * Para rutas de una reunión específica (/api/reuniones/:id/...).
 * Responde 401/403 por su cuenta y regresa false si no hay
 * acceso; el handler solo debe hacer "return". Una reunión
 * inexistente también da 403 a quien no es administrador,
 * para no revelar qué IDs existen en otros departamentos.
 */
async function validarAccesoReunion(
    req,
    res,
    reunionId
) {

    const usuarioSolicitante =
        await obtenerUsuarioSolicitante(req);

    if (!usuarioSolicitante) {

        res
            .status(401)
            .json({

                ok: false,

                mensaje:
                    "No fue posible identificar al usuario."

            });

        return false;

    }


    if (esAdmin(usuarioSolicitante)) {

        return true;

    }


    const filtro =
        filtroAlcanceReuniones(
            usuarioSolicitante
        );

    const [rows] =
        await db.execute(
            `
            SELECT r.ReunionId
            FROM reuniones r
            WHERE r.ReunionId = ?
            ${filtro.sql}
            LIMIT 1
            `,
            [
                reunionId,
                ...filtro.parametros
            ]
        );


    if (rows.length === 0) {

        respuestaSinPermiso(res);

        return false;

    }


    return true;

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
                        fecha_actualizacion,
                        (foto_contenido IS NOT NULL) AS tieneFoto
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


            const tipoReal =
                detectarTipoArchivo(
                    req.file.buffer
                );

            if (!TIPOS_IMAGEN_PERMITIDOS.includes(tipoReal)) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "La imagen no es un JPG, PNG o WebP válido."

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
                    tipoReal,
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


            /*
             * Caché: el navegador guarda la foto y en cada uso
             * pregunta si cambió (no-cache + ETag). Primero se
             * pide solo el MD5 (lo calcula MySQL): si coincide
             * con el que ya tiene el navegador se responde 304 y
             * el BLOB no viaja desde el MySQL remoto.
             */

            const [hashRows] =
                await db.execute(
                    `
                    SELECT
                        MD5(foto_contenido) AS hash
                    FROM usuarios
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [
                        usuarioId
                    ]
                );

            const hash =
                hashRows[0]?.hash;

            if (hash) {

                const etag =
                    `"${hash}"`;

                res.set(
                    "Cache-Control",
                    "private, no-cache"
                );

                res.set(
                    "ETag",
                    etag
                );

                if (req.get("If-None-Match") === etag) {

                    return res
                        .status(304)
                        .end();

                }

            }


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

            res.set(
                "X-Content-Type-Options",
                "nosniff"
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

/* =========================================================
   ADJUNTAR PARTICIPANTES (CON FOTO) A UNA LISTA DE REUNIONES
   ---------------------------------------------------------
   Usado por /api/reuniones/programadas y /historial para
   poder pintar las fichas de avatar de cada tarjeta y para
   filtrar por nombre de participante.
   ========================================================= */

async function adjuntarParticipantesAReuniones(
    reuniones
) {

    const reunionIds =
        reuniones.map(
            reunion =>
                reunion.ReunionId
        );


    if (reunionIds.length === 0) {

        return reuniones;

    }


    const placeholders =
        reunionIds
            .map(() => "?")
            .join(",");


    const [
        filas
    ] =
        await db.execute(
            `
            SELECT
                rp.ReunionId,
                rp.UsuarioId,
                u.nombre,
                (u.foto_contenido IS NOT NULL) AS tieneFoto

            FROM reunion_participantes rp

            INNER JOIN usuarios u
                ON u.id =
                   rp.UsuarioId

            WHERE
                rp.ReunionId IN (${placeholders})

            ORDER BY
                u.nombre
            `,
            reunionIds
        );


    const porReunion =
        {};


    filas.forEach(
        fila => {

            if (!porReunion[fila.ReunionId]) {

                porReunion[fila.ReunionId] =
                    [];

            }


            porReunion[fila.ReunionId].push({

                id:
                    Number(
                        fila.UsuarioId
                    ),

                nombre:
                    fila.nombre,

                tieneFoto:
                    Boolean(
                        fila.tieneFoto
                    )

            });

        }
    );


    reuniones.forEach(
        reunion => {

            reunion.Participantes =
                porReunion[reunion.ReunionId] ||
                [];

        }
    );


    return reuniones;

}


app.get(
    "/api/reuniones/programadas",
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


            const alcance =
                filtroAlcanceReuniones(
                    usuarioSolicitante
                );


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

                        r.DepartamentoId,
                        s.SubsidiaryName AS Departamento,

                        r.AreaId,
                        a.AreaName AS Area,

                        u.nombre AS CreadorNombre,

                        COUNT(
                            DISTINCT rp.ReunionParticipanteId
                        ) AS TotalParticipantes

                    FROM reuniones r

                    LEFT JOIN reunion_participantes rp
                        ON rp.ReunionId =
                           r.ReunionId

                    LEFT JOIN subsidiaries s
                        ON s.SubsidiaryId =
                           r.DepartamentoId

                    LEFT JOIN areas a
                        ON a.AreaId =
                           r.AreaId

                    LEFT JOIN usuarios u
                        ON u.id =
                           r.UsuarioCreadorId

                    WHERE
                        r.Estado IN ('Programada', 'En curso')

                        ${alcance.sql}

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
                        r.DepartamentoId,
                        s.SubsidiaryName,
                        r.AreaId,
                        a.AreaName,
                        u.nombre

                    ORDER BY
                        r.FechaInicio ASC
                    `,
                    alcance.parametros
                );


            await adjuntarParticipantesAReuniones(
                reuniones
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
    4: "vencido"

};


/*
 * Status 3 ("completado" a nivel de columna) por sí solo no
 * basta: el operador puede reportarlo, pero solo cuenta como
 * completado de verdad cuando el líder de su área dio el visto
 * bueno (columna Aprobado). Sin ese visto bueno se muestra
 * como "en-revision", el mismo patrón que 95%/100% en
 * innovaciones (ver /api/innovaciones/estado-mes).
 */
function calcularEstadoCompromiso(
    status,
    aprobado
) {

    if (Number(status) === 3) {

        return aprobado
            ? "completado"
            : "en-revision";

    }

    return STATUS_A_ESTADO[status] || "pendiente";

}


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
                        c.Aprobado,
                        c.FechaAprobacion,
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
                    LEFT JOIN reuniones r
                        ON r.ReunionId = c.ReunionId
                    INNER JOIN usuarios u
                        ON u.id = c.UsuarioAsignadoId
                    WHERE
                        (r.ReunionId IS NULL OR r.Estado <> 'Cancelada')
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
                            calcularEstadoCompromiso(
                                row.StatusEfectivo,
                                row.Aprobado
                            ),

                        estadoReal:
                            calcularEstadoCompromiso(
                                row.Status,
                                row.Aprobado
                            ),

                        aprobado:
                            Boolean(row.Aprobado),

                        fechaAprobacion:
                            row.FechaAprobacion,

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
   CREAR COMPROMISO DESDE EL MÓDULO (SIN REUNIÓN)
   ========================================================= */

/*
 * Solo administrador y líder. El líder solo puede asignar a
 * usuarios de su misma área (mismo criterio con el que solo ve
 * los compromisos de su área). El compromiso no pertenece a
 * ninguna reunión (ReunionId NULL), así que las resincronizaciones
 * de compromisos de reuniones nunca lo tocan.
 */

function fechaISOValida(valor) {

    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return false;
    }

    const fecha =
        new Date(`${valor}T00:00:00Z`);

    return (
        !Number.isNaN(fecha.getTime()) &&
        fecha.toISOString().slice(0, 10) === valor
    );

}


app.post(
    "/api/compromisos",
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


            const descripcion =
                String(req.body.descripcion || "").trim();

            const usuarioAsignadoId =
                Number(req.body.usuarioAsignadoId);

            const prioridad =
                req.body.prioridad || "media";

            const hoy = (() => {

                const ahora = new Date();

                return [
                    ahora.getFullYear(),
                    String(ahora.getMonth() + 1).padStart(2, "0"),
                    String(ahora.getDate()).padStart(2, "0")
                ].join("-");

            })();

            const fechaInicio =
                req.body.fechaInicio || hoy;

            const fechaLimite =
                req.body.fechaLimite;


            const error =
                !descripcion
                    ? "La descripción es obligatoria."
                    : descripcion.length > 2000
                        ? "La descripción es demasiado larga (máx. 2000 caracteres)."
                        : !usuarioAsignadoId
                            ? "Selecciona un responsable."
                            : !["alta", "media", "baja"].includes(prioridad)
                                ? "Prioridad no válida."
                                : !fechaISOValida(fechaInicio) || !fechaISOValida(fechaLimite)
                                    ? "Las fechas de inicio y límite son obligatorias y deben ser válidas."
                                    : fechaLimite < fechaInicio
                                        ? "La fecha límite no puede ser anterior a la fecha de inicio."
                                        : null;

            if (error) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje: error
                    });

            }


            const [responsables] =
                await db.execute(
                    `
                    SELECT id, area
                    FROM usuarios
                    WHERE id = ? AND activo = 1
                    LIMIT 1
                    `,
                    [
                        usuarioAsignadoId
                    ]
                );

            if (responsables.length === 0) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje: "El responsable seleccionado no es válido."
                    });

            }

            if (
                usuarioSolicitante.rol === "lider" &&
                responsables[0].area !== usuarioSolicitante.area
            ) {

                return respuestaSinPermiso(res);

            }


            const insertado =
                await insertarCompromiso(
                    db,
                    null,
                    {
                        descripcion,
                        usuarioAsignadoId,
                        prioridad,
                        fechaInicio,
                        fechaLimite,
                        estado: "pendiente"
                    }
                );

            if (!insertado) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje: "No fue posible determinar el departamento o área del responsable."
                    });

            }


            return res.json({
                ok: true,
                mensaje: "Compromiso creado correctamente."
            });

        }
        catch (error) {

            console.error(
                "ERROR AL CREAR COMPROMISO:",
                error
            );

            return res
                .status(500)
                .json({
                    ok: false,
                    mensaje:
                        error.code === "ER_BAD_NULL_ERROR"
                            ? "La base de datos aún no permite compromisos sin reunión. Ejecuta js/server/sql/compromisos_sin_reunion.sql."
                            : "No fue posible crear el compromiso.",
                    error: error.message
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
                    SELECT c.UsuarioAsignadoId, c.Status, c.FechaFinReal, c.Aprobado, u.area
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
             * "Completado" desde aquí es solo el reporte del
             * operador (Status = 3): igual que con las
             * innovaciones, no cuenta como completado de verdad
             * hasta que el líder de su área da el visto bueno
             * (POST /api/compromisos/:id/aprobar, que es lo
             * único que puede poner Aprobado = 1). Por eso,
             * cualquier cambio de estado que no sea "seguir
             * completado" reinicia Aprobado/FechaFinReal: hay
             * que volver a aprobarlo si se reabre y se vuelve a
             * marcar como completado.
             */

            const nuevoStatus =
                ESTADO_A_STATUS[estado];

            const seMantieneCompletado =
                nuevoStatus === 3 &&
                Number(compromisoActual[0].Status) === 3;

            /*
             * Solo el responsable del compromiso o el líder de su
             * área pueden marcarlo como completado (el visto bueno
             * sigue siendo aparte: POST /api/compromisos/:id/aprobar).
             */

            const esResponsable =
                usuarioSolicitante.id === compromisoActual[0].UsuarioAsignadoId;

            const esLiderDelArea =
                usuarioSolicitante.rol === "lider" &&
                usuarioSolicitante.area === compromisoActual[0].area;

            if (
                nuevoStatus === 3 &&
                !seMantieneCompletado &&
                !esResponsable &&
                !esLiderDelArea
            ) {

                return res
                    .status(403)
                    .json({

                        ok: false,

                        mensaje:
                            "Solo el responsable del compromiso o el líder de su área pueden marcarlo como completado."

                    });

            }

            const aprobado =
                seMantieneCompletado
                    ? Boolean(compromisoActual[0].Aprobado)
                    : false;

            const fechaFinReal =
                seMantieneCompletado
                    ? compromisoActual[0].FechaFinReal
                    : null;


            const [resultado] =
                await db.execute(
                    `
                    UPDATE compromisos
                    SET
                        Status = ?,
                        FechaFinEstimada = ?,
                        FechaFinReal = ?,
                        Aprobado = ?,
                        FechaAprobacion = CASE WHEN ? THEN FechaAprobacion ELSE NULL END,
                        AprobadoPor = CASE WHEN ? THEN AprobadoPor ELSE NULL END,
                        FechaActualizacion = NOW()
                    WHERE CompromisoId = ?
                    `,
                    [
                        nuevoStatus,
                        fechaLimite,
                        fechaFinReal,
                        aprobado,
                        seMantieneCompletado,
                        seMantieneCompletado,
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
   DAR VISTO BUENO A UN COMPROMISO (SOLO LÍDER / ADMIN)
   ---------------------------------------------------------
   Mismo patrón que POST /api/innovaciones/:id/aprobar: solo el
   líder del área del responsable (o un administrador) puede
   darlo, y solo aplica si el compromiso está reportado como
   completado (Status = 3) y todavía sin aprobar.
   ========================================================= */

app.post(
    "/api/compromisos/:id/aprobar",
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


            if (
                usuarioSolicitante.rol !== "lider" &&
                usuarioSolicitante.rol !== "administrador"
            ) {

                return respuestaSinPermiso(res);

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


            const [compromisoActual] =
                await db.execute(
                    `
                    SELECT c.Status, c.Aprobado, u.area
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


            if (
                usuarioSolicitante.rol === "lider" &&
                usuarioSolicitante.area !== compromisoActual[0].area
            ) {

                return respuestaSinPermiso(res);

            }


            if (Number(compromisoActual[0].Status) !== 3) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Este compromiso todavía no fue reportado como completado."

                    });

            }


            if (Boolean(compromisoActual[0].Aprobado)) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "Este compromiso ya tiene el visto bueno."

                    });

            }


            await db.execute(
                `
                UPDATE compromisos
                SET
                    Aprobado = 1,
                    FechaAprobacion = NOW(),
                    AprobadoPor = ?,
                    FechaFinReal = NOW(),
                    FechaActualizacion = NOW()
                WHERE CompromisoId = ?
                `,
                [
                    usuarioSolicitante.id,
                    compromisoId
                ]
            );


            return res.json({

                ok: true,

                mensaje:
                    "Compromiso aprobado correctamente."

            });

        }
        catch (error) {

            console.error(
                "ERROR AL APROBAR EL COMPROMISO:",
                error
            );

            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible aprobar el compromiso.",

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


            if (
                !await validarAccesoReunion(
                    req,
                    res,
                    reunionId
                )
            ) {

                return;

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


            if (
                !await validarAccesoReunion(
                    req,
                    res,
                    reunionId
                )
            ) {

                return;

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


            const alcance =
                filtroAlcanceReuniones(
                    usuarioSolicitante
                );


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

                        r.DepartamentoId,
                        s.SubsidiaryName AS Departamento,

                        r.AreaId,
                        a.AreaName AS Area,

                        u.nombre AS CreadorNombre,

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

                    LEFT JOIN subsidiaries s
                        ON s.SubsidiaryId =
                           r.DepartamentoId

                    LEFT JOIN areas a
                        ON a.AreaId =
                           r.AreaId

                    LEFT JOIN usuarios u
                        ON u.id =
                           r.UsuarioCreadorId

                    WHERE
                        r.Estado IN (
                            'Finalizada',
                            'Cancelada'
                        )

                        ${alcance.sql}

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
                        r.FechaActualizacion,
                        r.DepartamentoId,
                        s.SubsidiaryName,
                        r.AreaId,
                        a.AreaName,
                        u.nombre

                    ORDER BY
                        r.FechaInicio DESC
                    `,
                    alcance.parametros
                );


            await adjuntarParticipantesAReuniones(
                reuniones
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


            if (
                !await validarAccesoReunion(
                    req,
                    res,
                    reunionId
                )
            ) {

                return;

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
                        u.correo_electronico,
                        (u.foto_contenido IS NOT NULL) AS tieneFoto

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


    /*
     * FechaFinReal y Aprobado nunca se toman del cliente: aun
     * si el compromiso ya llega marcado "completado" desde la
     * reunión, sigue sin contar como completado de verdad hasta
     * que el líder de su área lo apruebe (ver
     * POST /api/compromisos/:id/aprobar).
     */

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
            FechaFinReal,
            Aprobado
        )
        VALUES
        (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
            null,
            0
        ]
    );


    return true;

}


/*
 * Inserta un compromiso de reunión en la tabla y, si venía
 * heredado del módulo de compromisos (compromisoModuloId, ver
 * heredar-pendientes), borra la fila original sin reunión: a
 * partir de aquí el compromiso vive como parte de esta reunión
 * y dejarla causaría un duplicado en la vista global. Solo se
 * borra si la inserción funcionó, para no perder el compromiso.
 */
async function insertarCompromisoDeReunion(
    connection,
    reunionId,
    compromiso
) {

    const insertado =
        await insertarCompromiso(
            connection,
            reunionId,
            compromiso
        );


    const compromisoModuloId =
        Number(
            compromiso.compromisoModuloId
        );


    if (
        insertado &&
        compromisoModuloId
    ) {

        await connection.execute(
            `
            DELETE FROM compromisos
            WHERE
                CompromisoId = ?
                AND ReunionId IS NULL
            `,
            [
                compromisoModuloId
            ]
        );

    }

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

        await insertarCompromisoDeReunion(
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

        await insertarCompromisoDeReunion(
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
                !await validarAccesoReunion(
                    req,
                    res,
                    reunionId
                )
            ) {

                return;

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


/*
 * Compromisos creados desde el módulo (ReunionId NULL) que
 * siguen abiertos (pendiente / en progreso) y cuyo responsable
 * es del mismo equipo (departamento y área) que el creador de
 * la reunión destino: el mismo criterio de "equipo" con el que
 * se elige la reunión de origen.
 *
 * Se convierten al formato JSON de la sección de compromisos,
 * guardando compromisoModuloId para que al finalizar la reunión
 * se borre la fila original (ver insertarCompromisoDeReunion).
 */
async function obtenerCompromisosModuloPendientes(
    connection,
    usuarioCreadorId
) {

    const [rows] =
        await connection.execute(
            `
            SELECT
                c.CompromisoId,
                c.Titulo,
                c.Descripcion,
                c.Prioridad,
                c.Status,
                DATE_FORMAT(c.FechaInicioEstimada, '%Y-%m-%d') AS FechaInicio,
                DATE_FORMAT(c.FechaFinEstimada, '%Y-%m-%d') AS FechaLimite,
                u.id AS UsuarioAsignadoId,
                u.nombre AS ResponsableNombre
            FROM compromisos c
            INNER JOIN usuarios u
                ON u.id = c.UsuarioAsignadoId
            INNER JOIN usuarios uDestino
                ON uDestino.id = ?
            WHERE
                c.ReunionId IS NULL
                AND c.Status IN (1, 2)
                AND u.departamento = uDestino.departamento
                AND u.area = uDestino.area
            ORDER BY
                c.FechaFinEstimada ASC
            `,
            [
                usuarioCreadorId
            ]
        );


    return rows.map(
        (row) => {

            const vencido =
                row.FechaLimite &&
                row.FechaLimite < hoyLocalISO();

            return {

                id:
                    crypto.randomUUID(),

                compromisoModuloId:
                    row.CompromisoId,

                descripcion:
                    row.Descripcion ||
                    row.Titulo,

                usuarioAsignadoId:
                    row.UsuarioAsignadoId,

                usuarioAsignadoNombre:
                    row.ResponsableNombre,

                fechaInicio:
                    row.FechaInicio,

                fechaLimite:
                    row.FechaLimite,

                estado:
                    STATUS_A_ESTADO[row.Status] ||
                    "pendiente",

                prioridad:
                    row.Prioridad ||
                    "media",

                ...(
                    vencido
                        ? { vencidoInformativo: true }
                        : {}
                )

            };

        }
    );

}


/*
 * Agrega los compromisos del módulo a la lista de la reunión,
 * saltando los que ya estén (mismo compromisoModuloId) para que
 * llamar dos veces a heredar-pendientes no los duplique.
 */
function agregarCompromisosModulo(
    compromisos,
    compromisosModulo
) {

    const yaIncluidos =
        new Set(
            compromisos
                .map(
                    (compromiso) =>
                        Number(compromiso.compromisoModuloId)
                )
                .filter(Boolean)
        );


    return [
        ...compromisos,
        ...compromisosModulo.filter(
            (compromiso) =>
                !yaIncluidos.has(
                    Number(compromiso.compromisoModuloId)
                )
        )
    ];

}


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


            if (
                !await validarAccesoReunion(
                    req,
                    res,
                    reunionId
                )
            ) {

                return;

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


            const compromisosModulo =
                heredarCompromisos
                    ? await obtenerCompromisosModuloPendientes(
                        connection,
                        usuarioCreadorId
                    )
                    : [];


            if (origenRows.length === 0) {

                if (compromisosModulo.length === 0) {

                    await connection.commit();

                    return res.json({

                        ok: true,

                        aplicado:
                            false

                    });

                }


                /*
                 * Sin reunión anterior de la cual heredar, solo
                 * se agregan los compromisos del módulo a los que
                 * la reunión destino ya tenga (no se sobreescribe).
                 */

                const [
                    destinoSeccionRows
                ] =
                    await connection.execute(
                        `
                        SELECT Seccion, Contenido
                        FROM reunion_secciones
                        WHERE
                            ReunionId = ?
                            AND Seccion = 'compromisos'
                        `,
                        [
                            reunionId
                        ]
                    );


                const compromisosActuales =
                    contenidoDeSeccion(
                        destinoSeccionRows,
                        "compromisos",
                        []
                    );


                const compromisosCombinados =
                    agregarCompromisosModulo(
                        Array.isArray(compromisosActuales)
                            ? compromisosActuales
                            : [],
                        compromisosModulo
                    );


                await guardarSeccionReunion(
                    connection,
                    reunionId,
                    "compromisos",
                    compromisosCombinados
                );


                await connection.commit();

                return res.json({

                    ok: true,

                    aplicado:
                        true,

                    reunionOrigenId:
                        null,

                    objetivos:
                        0,

                    compromisos:
                        compromisosCombinados.length

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
                                false,

                            /*
                             * Los responsables asignados al crear
                             * el objetivo viajan con él a la
                             * siguiente reunión (ver visor de
                             * actividades).
                             */
                            ...(
                                obtenerResponsablesObjetivo(objetivo).length > 0
                                    ? {
                                        responsables:
                                            obtenerResponsablesObjetivo(
                                                objetivo
                                            )
                                    }
                                    : {}
                            )

                        };

                    }
                );


            /* =================================================
               COMPROMISOS PENDIENTES (con id nuevo)
               ================================================= */

            let compromisosNuevos =
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


            /*
             * Compromisos del módulo (sin reunión) del mismo
             * equipo. Si alguno ya venía heredado de la reunión
             * de origen, no se vuelve a agregar.
             */

            compromisosNuevos =
                agregarCompromisosModulo(
                    compromisosNuevos,
                    compromisosModulo
                );


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
   VISOR DE ACTIVIDADES POR USUARIO
   ========================================================= */

/*
 * Objetivos asignados a un usuario (está entre los "responsables"
 * del objetivo en el JSON de la sección "objetivos"; un objetivo
 * puede tener varios) con el avance de sus puntos de
 * desarrollo, para que cada quien vea sus actividades sin abrir
 * el reporte completo de la junta.
 *
 * Solo se leen reuniones cuyos pendientes todavía no se heredaron
 * (PendientesConsumidos = 0): cuando una reunión hereda, los
 * objetivos pendientes se copian a la nueva con otro id, así que
 * la reunión anterior ya no representa el estado actual y
 * mostrarla duplicaría las actividades.
 *
 * Por defecto se consulta al propio solicitante. ?usuarioId=
 * permite ver a otro: administrador a cualquiera, líder solo a
 * usuarios de su mismo departamento, operador a nadie más.
 */

/*
 * Responsables de un objetivo como arreglo [{ id, nombre }].
 * Los objetivos asignados antes de permitir varios responsables
 * traen un solo usuarioAsignadoId / usuarioAsignadoNombre (mismo
 * criterio que js/utils/responsables.js en el frontend).
 */
function obtenerResponsablesObjetivo(
    objetivo
) {

    if (Array.isArray(objetivo?.responsables)) {

        return objetivo.responsables;

    }


    if (objetivo?.usuarioAsignadoId) {

        return [
            {
                id:
                    objetivo.usuarioAsignadoId,

                nombre:
                    objetivo.usuarioAsignadoNombre ||
                    "?"
            }
        ];

    }


    return [];

}


function calcularAvanceObjetivo(
    bloques
) {

    const puntos =
        (
            Array.isArray(bloques)
                ? bloques
                : []
        ).filter(
            (bloque) =>
                bloque.tipo === "punto"
        );


    const avance =
        puntos.length === 0
            ? 0
            : Math.round(
                puntos.reduce(
                    (suma, punto) =>
                        suma + (Number(punto.avance) || 0),
                    0
                ) / puntos.length
            );


    return {

        puntos:
            puntos.map(
                (punto) => ({

                    texto:
                        punto.texto || "",

                    avance:
                        Number(punto.avance) || 0

                })
            ),

        avance:
            avance,

        completado:
            puntos.length > 0 &&
            puntos.every(
                (punto) =>
                    (Number(punto.avance) || 0) === 100
            )

    };

}


app.get(
    "/api/actividades",
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
                Number(req.query.usuarioId) ||
                usuarioSolicitante.id;


            if (
                usuarioId !== usuarioSolicitante.id &&
                !esAdmin(usuarioSolicitante)
            ) {

                if (usuarioSolicitante.rol !== "lider") {

                    return respuestaSinPermiso(res);

                }


                const [consultadoRows] =
                    await db.execute(
                        `
                        SELECT departamento
                        FROM usuarios
                        WHERE id = ?
                        LIMIT 1
                        `,
                        [
                            usuarioId
                        ]
                    );


                if (
                    consultadoRows.length === 0 ||
                    String(consultadoRows[0].departamento || "").trim() !==
                        String(usuarioSolicitante.departamento || "").trim()
                ) {

                    return respuestaSinPermiso(res);

                }

            }


            const [rows] =
                await db.execute(
                    `
                    SELECT
                        r.ReunionId,
                        r.Titulo,
                        r.FechaInicio,
                        r.Estado,
                        rs.Seccion,
                        rs.Contenido
                    FROM reuniones r
                    INNER JOIN reunion_secciones rs
                        ON rs.ReunionId = r.ReunionId
                        AND rs.Seccion IN ('objetivos', 'desarrollo')
                    WHERE
                        r.Estado IN ('En curso', 'Finalizada')
                        AND r.PendientesConsumidos = 0
                    ORDER BY
                        r.FechaInicio DESC
                    `
                );


            /*
             * Agrupar las dos secciones de cada reunión.
             */

            const reuniones =
                new Map();

            rows.forEach(
                (row) => {

                    if (!reuniones.has(row.ReunionId)) {

                        reuniones.set(
                            row.ReunionId,
                            {
                                reunion: row,
                                filas: []
                            }
                        );

                    }

                    reuniones
                        .get(row.ReunionId)
                        .filas
                        .push(row);

                }
            );


            const actividades =
                [];

            reuniones.forEach(
                ({ reunion, filas }) => {

                    let objetivos;
                    let desarrollo;

                    try {

                        objetivos =
                            contenidoDeSeccion(
                                filas,
                                "objetivos",
                                []
                            );

                        desarrollo =
                            contenidoDeSeccion(
                                filas,
                                "desarrollo",
                                {}
                            );

                    }
                    catch (error) {

                        console.error(
                            `ERROR PARSEANDO SECCIONES DE LA REUNIÓN ${reunion.ReunionId}:`,
                            error
                        );

                        return;

                    }


                    (
                        Array.isArray(objetivos)
                            ? objetivos
                            : []
                    )
                        .filter(
                            (objetivo) =>
                                obtenerResponsablesObjetivo(objetivo).some(
                                    (responsable) =>
                                        Number(responsable.id) === usuarioId
                                )
                        )
                        .forEach(
                            (objetivo) => {

                                actividades.push({

                                    /*
                                     * Los demás responsables del
                                     * mismo objetivo, para mostrar
                                     * con quién se comparte.
                                     */
                                    compartidoCon:
                                        obtenerResponsablesObjetivo(objetivo)
                                            .filter(
                                                (responsable) =>
                                                    Number(responsable.id) !== usuarioId
                                            )
                                            .map(
                                                (responsable) =>
                                                    responsable.nombre
                                            ),

                                    reunionId:
                                        reunion.ReunionId,

                                    reunionTitulo:
                                        reunion.Titulo,

                                    reunionFecha:
                                        reunion.FechaInicio,

                                    reunionEstado:
                                        reunion.Estado,

                                    objetivoId:
                                        objetivo.id,

                                    texto:
                                        objetivo.texto,

                                    ...calcularAvanceObjetivo(
                                        desarrollo?.[objetivo.id]
                                    )

                                });

                            }
                        );

                }
            );


            return res.json({

                ok: true,

                usuarioId:
                    usuarioId,

                actividades:
                    actividades

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER ACTIVIDADES:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible obtener las actividades.",

                    error:
                        error.message

                });

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


            if (
                !await validarAccesoReunion(
                    req,
                    res,
                    reunionId
                )
            ) {

                return;

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


            if (
                !await validarAccesoReunion(
                    req,
                    res,
                    reunionId
                )
            ) {

                return;

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
   ENVIAR REPORTE PDF DE REUNIÓN POR CORREO
   ---------------------------------------------------------
   Recibe el mismo HTML utilizado por Exportar PDF, lo
   convierte a PDF mediante Chromium y lo envía a todos
   los participantes registrados en MySQL.
   ========================================================= */

/* =========================================================
   ENVIAR REPORTE PDF DE REUNIÓN POR CORREO
   ========================================================= */

app.post(
    "/api/reuniones/:id/enviar-reporte",
    async (
        req,
        res
    ) => {

        let browser =
            null;


        try {

            const reunionId =
                Number(
                    req.params.id
                );


            const html =
                typeof req.body.html === "string"
                    ? req.body.html
                    : "";


            if (
                !reunionId
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "ID de reunión no válido."

                    });

            }


            if (
                !html.trim()
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "No se recibió el contenido del reporte PDF."

                    });

            }


            if (
                !await validarAccesoReunion(
                    req,
                    res,
                    reunionId
                )
            ) {

                return;

            }


            /*
             * =================================================
             * OBTENER REUNIÓN
             * =================================================
             */

            const [
                reuniones
            ] =
                await db.execute(
                    `
                    SELECT
                        ReunionId,
                        Titulo,
                        Estado
                    FROM reuniones
                    WHERE ReunionId = ?
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


            const reunion =
                reuniones[0];


            if (
                reunion.Estado !==
                "Finalizada"
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "El reporte solo puede enviarse cuando la reunión está finalizada."

                    });

            }


            /*
             * =================================================
             * OBTENER PARTICIPANTES
             * =================================================
             */

            const [
                participantes
            ] =
                await db.execute(
                    `
                    SELECT DISTINCT
                        u.correo_electronico
                    FROM reunion_participantes rp
                    INNER JOIN usuarios u
                        ON u.id =
                           rp.UsuarioId
                    WHERE
                        rp.ReunionId = ?
                        AND u.correo_electronico IS NOT NULL
                        AND TRIM(
                            u.correo_electronico
                        ) <> ''
                    ORDER BY
                        u.correo_electronico
                    `,
                    [
                        reunionId
                    ]
                );


            const destinatarios =
                participantes
                    .map(
                        item =>
                            String(
                                item.correo_electronico
                            ).trim()
                    )
                    .filter(
                        Boolean
                    );


            if (
                destinatarios.length === 0
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            "La reunión no tiene participantes con correo electrónico registrado."

                    });

            }


            /*
             * =================================================
             * GENERAR PDF
             * =================================================
             */

            browser =
                await puppeteer.launch({

                    headless:
                        true,

                    args: [

                        "--no-sandbox",

                        "--disable-setuid-sandbox"

                    ]

                });


            const page =
                await browser.newPage();


            await page.setContent(
                html,
                {

                    waitUntil:
                        "networkidle0"

                }
            );


            await page.emulateMediaType(
                "print"
            );


            const pdf =
                await page.pdf({

                    format:
                        "Letter",

                    printBackground:
                        true,

                    preferCSSPageSize:
                        true

                });


            /*
             * =================================================
             * CONFIGURAR CORREO
             * =================================================
             */

            const transporter =
                crearTransportadorCorreo();


            const from =
                String(
                    process.env.SMTP_FROM ||
                    process.env.SMTP_USER
                ).trim();


            const titulo =
                String(
                    reunion.Titulo ||
                    "Reunión Flow"
                ).trim();


            const filename =
                `${nombreArchivoSeguro(
                    titulo
                )}.pdf`;


            /*
             * =================================================
             * ENVIAR INDIVIDUALMENTE
             * =================================================
             *
             * Esto es importante.
             *
             * Si mandamos:
             *
             * to: "a@x.com,b@y.com,c@z.com"
             *
             * no podemos determinar fácilmente cuál
             * destinatario fue rechazado.
             *
             * Al enviar uno por uno podemos regresar
             * exactamente los que fallaron.
             */

            const resultados =
                await Promise.all(

                    destinatarios.map(
                        async correo => {

                            try {

                                await transporter.sendMail({

                                    from,

                                    to:
                                        correo,

                                    subject:
                                        `Reporte de reunión: ${titulo}`,

                                    text:
                                        `Se adjunta el reporte PDF de la reunión ${titulo}.\n\n` +
                                        `Este mensaje fue generado automáticamente por FLOW.`,

                                    attachments: [

                                        {

                                            filename,

                                            content:
                                                pdf,

                                            contentType:
                                                "application/pdf"

                                        }

                                    ]

                                });


                                return {

                                    correo,

                                    enviado:
                                        true

                                };

                            }
                            catch (error) {

                                console.error(
                                    `ERROR ENVIANDO A ${correo}:`,
                                    error
                                );


                                return {

                                    correo,

                                    enviado:
                                        false,

                                    error:
                                        error.message

                                };

                            }

                        }
                    )

                );


            const fallidos =
                resultados
                    .filter(
                        resultado =>
                            !resultado.enviado
                    )
                    .map(
                        resultado =>
                            resultado.correo
                    );


            const enviados =
                resultados
                    .filter(
                        resultado =>
                            resultado.enviado
                    )
                    .map(
                        resultado =>
                            resultado.correo
                    );


            /*
             * =================================================
             * RESPUESTA
             * =================================================
             */

            return res.json({

                ok:
                    true,

                mensaje:
                    fallidos.length === 0
                        ? "Envío realizado correctamente."
                        : "La minuta se envió parcialmente.",

                enviados,

                fallidos,

                total:
                    destinatarios.length

            });

        }
        catch (error) {

            console.error(
                "ERROR ENVIANDO REPORTE DE REUNIÓN:",
                error
            );


            return res
                .status(500)
                .json({

                    ok: false,

                    mensaje:
                        "No fue posible generar o enviar el reporte de la reunión.",

                    error:
                        error.message

                });

        }
        finally {

            if (
                browser
            ) {

                try {

                    await browser.close();

                }
                catch (error) {

                    console.error(
                        "ERROR CERRANDO CHROMIUM:",
                        error
                    );

                }

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


            if (
                !await validarAccesoReunion(
                    req,
                    res,
                    reunionId
                )
            ) {

                return;

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


            const imagenInvalida =
                (archivos.evidenciaImagenes || []).find(
                    (archivo) =>
                        !TIPOS_IMAGEN_PERMITIDOS.includes(
                            detectarTipoArchivo(
                                archivo.buffer
                            )
                        )
                );

            if (imagenInvalida) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            `La imagen "${imagenInvalida.originalname}" no es un JPG, PNG o WebP válido.`

                    });

            }


            const evidenciaArchivo =
                archivos.evidenciaArchivo &&
                archivos.evidenciaArchivo[0];

            const tipoEvidenciaArchivo =
                evidenciaArchivo
                    ? detectarTipoEvidenciaArchivo(
                        evidenciaArchivo
                    )
                    : null;

            if (
                evidenciaArchivo &&
                !tipoEvidenciaArchivo
            ) {

                return res
                    .status(400)
                    .json({

                        ok: false,

                        mensaje:
                            `El archivo "${evidenciaArchivo.originalname}" no es un PDF, Word o Excel válido.`

                    });

            }


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
                        tipo === "evidencia_imagen"
                            ? detectarTipoArchivo(archivo.buffer)
                            : tipoEvidenciaArchivo,
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


            return enviarArchivoGuardado(
                res,
                rows[0]
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


                    if (
                        !await validarAccesoReunion(
                            req,
                            res,
                            reunionId
                        )
                    ) {

                        return;

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


                    const tipoReal =
                        detectarTipoArchivo(
                            req.file.buffer
                        );

                    if (
                        !TIPOS_IMAGEN_PERMITIDOS.includes(tipoReal) &&
                        tipoReal !== "application/pdf"
                    ) {

                        return res
                            .status(400)
                            .json({

                                ok: false,

                                mensaje:
                                    "El archivo no es una imagen JPG, PNG, WebP o un PDF válido."

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
                                tipoReal,
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
                            tipoReal

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


            return enviarArchivoGuardado(
                res,
                rows[0]
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
   EVALUACIONES PERSONALIZADAS (CREADAS POR EL ADMINISTRADOR)
   ---------------------------------------------------------
   Independientes de los periodos y de las 5 evaluaciones
   fijas. Cada una tiene su propio estado (activa/cerrada) y
   fecha de cierre opcional. Las respuestas son anónimas:
   evaluacion_personalizada_respuestas no guarda usuario_id;
   evaluacion_personalizada_envios solo evita duplicados.
   ========================================================= */

const TIPOS_PREGUNTA_PERSONALIZADA = [
    "opcion_multiple",
    "casillas",
    "likert",
    "texto"
];

const DESTINATARIOS_PERSONALIZADA_VALIDOS = [
    "lider",
    "operador"
];

const MAX_PREGUNTAS_PERSONALIZADA = 50;
const MAX_OPCIONES_PERSONALIZADA = 12;
const MAX_LARGO_RESPUESTA_TEXTO = 2000;


function parsearJSONColumna(valor, respaldo) {

    if (valor === null || valor === undefined) {
        return respaldo;
    }

    if (typeof valor === "string") {

        try {
            return JSON.parse(valor);
        }
        catch {
            return respaldo;
        }

    }

    return valor;

}


/*
 * Normaliza y valida las preguntas que envía el editor. Los
 * ids de pregunta/opción los asigna el servidor, así que el
 * cliente no puede colisionar ni inventar ids.
 */
function validarPreguntasPersonalizadas(preguntas) {

    if (!Array.isArray(preguntas) || preguntas.length === 0) {
        return { error: "Agrega al menos una pregunta." };
    }

    if (preguntas.length > MAX_PREGUNTAS_PERSONALIZADA) {
        return { error: `Máximo ${MAX_PREGUNTAS_PERSONALIZADA} preguntas por evaluación.` };
    }

    const normalizadas = [];

    for (let indice = 0; indice < preguntas.length; indice++) {

        const pregunta = preguntas[indice];
        const numero = indice + 1;

        const texto = String(pregunta?.texto || "").trim();

        if (!texto) {
            return { error: `La pregunta ${numero} no tiene texto.` };
        }

        if (texto.length > 500) {
            return { error: `La pregunta ${numero} supera los 500 caracteres.` };
        }

        if (!TIPOS_PREGUNTA_PERSONALIZADA.includes(pregunta?.tipo)) {
            return { error: `La pregunta ${numero} tiene un tipo no válido.` };
        }

        const normalizada = {
            id: `p${numero}`,
            tipo: pregunta.tipo,
            texto,
            requerida: pregunta.requerida !== false,
            opciones: []
        };

        if (pregunta.tipo === "opcion_multiple" || pregunta.tipo === "casillas") {

            const textosOpciones =
                (Array.isArray(pregunta.opciones) ? pregunta.opciones : [])
                    .map((opcion) => String(opcion?.texto ?? opcion ?? "").trim())
                    .filter(Boolean);

            if (textosOpciones.length < 2) {
                return { error: `La pregunta ${numero} necesita al menos 2 opciones.` };
            }

            if (textosOpciones.length > MAX_OPCIONES_PERSONALIZADA) {
                return { error: `La pregunta ${numero} supera las ${MAX_OPCIONES_PERSONALIZADA} opciones.` };
            }

            if (textosOpciones.some((opcion) => opcion.length > 200)) {
                return { error: `Una opción de la pregunta ${numero} supera los 200 caracteres.` };
            }

            if (new Set(textosOpciones.map((opcion) => opcion.toLowerCase())).size !== textosOpciones.length) {
                return { error: `La pregunta ${numero} tiene opciones repetidas.` };
            }

            normalizada.opciones =
                textosOpciones.map((opcion, posicion) => ({
                    id: `o${posicion + 1}`,
                    texto: opcion
                }));

        }

        normalizadas.push(normalizada);

    }

    return { preguntas: normalizadas };

}


/*
 * Valida las respuestas contra la definición guardada de la
 * evaluación. Devuelve solo las respuestas contestadas, ya
 * saneadas.
 */
function validarRespuestasPersonalizadas(preguntas, respuestas) {

    if (!respuestas || typeof respuestas !== "object" || Array.isArray(respuestas)) {
        return { error: "Las respuestas son obligatorias." };
    }

    const limpias = {};

    for (const pregunta of preguntas) {

        const valor = respuestas[pregunta.id];

        let contestada = false;

        if (pregunta.tipo === "opcion_multiple") {

            if (valor !== undefined && valor !== null && valor !== "") {

                if (!pregunta.opciones.some((opcion) => opcion.id === valor)) {
                    return { error: `Respuesta no válida en "${pregunta.texto}".` };
                }

                limpias[pregunta.id] = valor;
                contestada = true;

            }

        }
        else if (pregunta.tipo === "casillas") {

            if (Array.isArray(valor) && valor.length > 0) {

                const unicos = [...new Set(valor)];

                if (unicos.some((id) => !pregunta.opciones.some((opcion) => opcion.id === id))) {
                    return { error: `Respuesta no válida en "${pregunta.texto}".` };
                }

                limpias[pregunta.id] = unicos;
                contestada = true;

            }

        }
        else if (pregunta.tipo === "likert") {

            if (valor !== undefined && valor !== null && valor !== "") {

                if (!VALORES_LIKERT_VALIDOS.includes(valor)) {
                    return { error: `Respuesta no válida en "${pregunta.texto}".` };
                }

                limpias[pregunta.id] = valor;
                contestada = true;

            }

        }
        else if (pregunta.tipo === "texto") {

            const texto = typeof valor === "string" ? valor.trim() : "";

            if (texto) {

                if (texto.length > MAX_LARGO_RESPUESTA_TEXTO) {
                    return { error: `La respuesta a "${pregunta.texto}" es demasiado larga.` };
                }

                limpias[pregunta.id] = texto;
                contestada = true;

            }

        }

        if (!contestada && pregunta.requerida) {
            return { error: `Falta responder: "${pregunta.texto}".` };
        }

    }

    return { respuestas: limpias };

}


/*
 * destinatarios se guarda como texto "lider,operador". Devuelve
 * un arreglo con los roles a los que se dirige la evaluación.
 */
function parsearDestinatariosPersonalizada(valor) {

    const roles =
        String(valor || "")
            .split(",")
            .map((rol) => rol.trim())
            .filter((rol) => DESTINATARIOS_PERSONALIZADA_VALIDOS.includes(rol));

    return roles.length ? roles : [...DESTINATARIOS_PERSONALIZADA_VALIDOS];

}


function evaluacionPersonalizadaFormatear(fila, extra = {}) {

    return {

        id: fila.id,
        titulo: fila.titulo,
        descripcion: fila.descripcion || "",
        preguntas: parsearJSONColumna(fila.preguntas_json, []),
        destinatarios: parsearDestinatariosPersonalizada(fila.destinatarios),
        activa: Number(fila.activa) === 1,
        vigente: Number(fila.vigente) === 1,
        fechaCierre: fila.fecha_cierre,
        creadoEn: fila.creado_en,
        ...extra

    };

}


const SQL_VIGENTE_PERSONALIZADA =
    "(e.activa = 1 AND (e.fecha_cierre IS NULL OR e.fecha_cierre >= CURDATE()))";


function puedeVerResultadosPersonalizadas(usuario) {

    return esAdmin(usuario);

}


/* =========================================================
   LISTAR
   ---------------------------------------------------------
   Administrador: todas, con conteo de respuestas.
   Resto: solo las vigentes, con "yaRespondido".
   ========================================================= */

app.get(
    "/api/evaluaciones/personalizadas",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({
                        ok: false,
                        mensaje: "No fue posible identificar al usuario."
                    });

            }

            const [filas] =
                await db.execute(
                    `
                    SELECT
                        e.id, e.titulo, e.descripcion, e.preguntas_json, e.destinatarios,
                        e.activa, e.fecha_cierre, e.creado_en,
                        ${SQL_VIGENTE_PERSONALIZADA} AS vigente,
                        (
                            SELECT COUNT(*)
                            FROM evaluacion_personalizada_respuestas r
                            WHERE r.evaluacion_id = e.id
                        ) AS total_respuestas,
                        (
                            SELECT COUNT(*)
                            FROM evaluacion_personalizada_envios v
                            WHERE v.evaluacion_id = e.id AND v.usuario_id = ?
                        ) AS ya_respondido
                    FROM evaluacion_personalizada e
                    ORDER BY e.creado_en DESC
                    `,
                    [
                        usuarioSolicitante.id
                    ]
                );

            const administrador =
                esAdmin(usuarioSolicitante);

            const evaluaciones =
                filas
                    .filter(
                        (fila) =>
                            administrador ||
                            (
                                Number(fila.vigente) === 1 &&
                                parsearDestinatariosPersonalizada(fila.destinatarios).includes(usuarioSolicitante.rol)
                            )
                    )
                    .map((fila) =>
                        evaluacionPersonalizadaFormatear(
                            fila,
                            {
                                totalRespuestas: Number(fila.total_respuestas),
                                yaRespondido: Number(fila.ya_respondido) > 0
                            }
                        )
                    );

            return res.json({
                ok: true,
                evaluaciones,
                puedeVerResultados: puedeVerResultadosPersonalizadas(usuarioSolicitante),
                puedeAdministrar: administrador
            });

        }
        catch (error) {

            console.error(
                "ERROR AL LISTAR EVALUACIONES PERSONALIZADAS:",
                error
            );

            return res
                .status(500)
                .json({
                    ok: false,
                    mensaje: "No fue posible obtener las evaluaciones personalizadas.",
                    error: error.message
                });

        }

    }
);


/* =========================================================
   CREAR (SOLO ADMINISTRADOR)
   ========================================================= */

app.post(
    "/api/evaluaciones/personalizadas",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!esAdmin(usuarioSolicitante)) {
                return respuestaSinPermiso(res);
            }

            const titulo =
                String(req.body.titulo || "").trim();

            const descripcion =
                String(req.body.descripcion || "").trim();

            const fechaCierre =
                req.body.fechaCierre || null;

            if (!titulo) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje: "El título de la evaluación es obligatorio."
                    });

            }

            if (titulo.length > 200 || descripcion.length > 2000) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje: "El título (máx. 200) o la descripción (máx. 2000) son demasiado largos."
                    });

            }

            if (fechaCierre && !/^\d{4}-\d{2}-\d{2}$/.test(fechaCierre)) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje: "La fecha de cierre no es válida."
                    });

            }

            const destinatarios =
                Array.isArray(req.body.destinatarios)
                    ? DESTINATARIOS_PERSONALIZADA_VALIDOS.filter((rol) => req.body.destinatarios.includes(rol))
                    : [];

            if (destinatarios.length === 0) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje: "Selecciona a quién se enviará la evaluación (líderes, operadores o ambos)."
                    });

            }

            const validacion =
                validarPreguntasPersonalizadas(req.body.preguntas);

            if (validacion.error) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje: validacion.error
                    });

            }

            const [resultado] =
                await db.execute(
                    `
                    INSERT INTO evaluacion_personalizada
                        (titulo, descripcion, preguntas_json, destinatarios, activa, fecha_cierre, creado_por)
                    VALUES (?, ?, ?, ?, 1, ?, ?)
                    `,
                    [
                        titulo,
                        descripcion || null,
                        JSON.stringify(validacion.preguntas),
                        destinatarios.join(","),
                        fechaCierre,
                        usuarioSolicitante.id
                    ]
                );

            return res.json({
                ok: true,
                mensaje: "Evaluación creada correctamente.",
                evaluacionId: resultado.insertId
            });

        }
        catch (error) {

            console.error(
                "ERROR AL CREAR EVALUACIÓN PERSONALIZADA:",
                error
            );

            return res
                .status(500)
                .json({
                    ok: false,
                    mensaje: "No fue posible crear la evaluación.",
                    error: error.message
                });

        }

    }
);


/* =========================================================
   ACTIVAR / CERRAR (SOLO ADMINISTRADOR)
   ========================================================= */

app.patch(
    "/api/evaluaciones/personalizadas/:id",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!esAdmin(usuarioSolicitante)) {
                return respuestaSinPermiso(res);
            }

            const id =
                Number(req.params.id);

            if (!id || typeof req.body.activa !== "boolean") {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje: "Datos no válidos."
                    });

            }

            const [resultado] =
                await db.execute(
                    `
                    UPDATE evaluacion_personalizada
                    SET activa = ?
                    WHERE id = ?
                    `,
                    [
                        req.body.activa ? 1 : 0,
                        id
                    ]
                );

            if (resultado.affectedRows === 0) {

                return res
                    .status(404)
                    .json({
                        ok: false,
                        mensaje: "La evaluación no existe."
                    });

            }

            return res.json({
                ok: true,
                mensaje: req.body.activa ? "Evaluación activada." : "Evaluación cerrada."
            });

        }
        catch (error) {

            console.error(
                "ERROR AL ACTUALIZAR EVALUACIÓN PERSONALIZADA:",
                error
            );

            return res
                .status(500)
                .json({
                    ok: false,
                    mensaje: "No fue posible actualizar la evaluación.",
                    error: error.message
                });

        }

    }
);


/* =========================================================
   ELIMINAR (SOLO ADMINISTRADOR)
   ---------------------------------------------------------
   Las respuestas y envíos se borran en cascada (FK).
   ========================================================= */

app.delete(
    "/api/evaluaciones/personalizadas/:id",
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
                        mensaje: "ID de evaluación no válido."
                    });

            }

            const [resultado] =
                await db.execute(
                    `DELETE FROM evaluacion_personalizada WHERE id = ?`,
                    [
                        id
                    ]
                );

            if (resultado.affectedRows === 0) {

                return res
                    .status(404)
                    .json({
                        ok: false,
                        mensaje: "La evaluación no existe."
                    });

            }

            return res.json({
                ok: true,
                mensaje: "Evaluación eliminada."
            });

        }
        catch (error) {

            console.error(
                "ERROR AL ELIMINAR EVALUACIÓN PERSONALIZADA:",
                error
            );

            return res
                .status(500)
                .json({
                    ok: false,
                    mensaje: "No fue posible eliminar la evaluación.",
                    error: error.message
                });

        }

    }
);


/* =========================================================
   RESPONDER (ANÓNIMO, UNA VEZ POR USUARIO)
   ========================================================= */

app.post(
    "/api/evaluaciones/personalizadas/:id/respuestas",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!usuarioSolicitante) {

                return res
                    .status(401)
                    .json({
                        ok: false,
                        mensaje: "No fue posible identificar al usuario."
                    });

            }

            /*
             * Igual que en las evaluaciones fijas, los
             * administradores solo consultan resultados.
             */
            if (esAdmin(usuarioSolicitante)) {
                return respuestaSinPermiso(res);
            }

            const id =
                Number(req.params.id);

            const [filas] =
                await db.execute(
                    `
                    SELECT
                        e.id, e.titulo, e.preguntas_json, e.destinatarios,
                        ${SQL_VIGENTE_PERSONALIZADA} AS vigente
                    FROM evaluacion_personalizada e
                    WHERE e.id = ?
                    LIMIT 1
                    `,
                    [
                        id
                    ]
                );

            if (filas.length === 0) {

                return res
                    .status(404)
                    .json({
                        ok: false,
                        mensaje: "La evaluación no existe."
                    });

            }

            if (Number(filas[0].vigente) !== 1) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje: "Esta evaluación ya no está disponible."
                    });

            }

            if (!parsearDestinatariosPersonalizada(filas[0].destinatarios).includes(usuarioSolicitante.rol)) {
                return respuestaSinPermiso(res);
            }

            const validacion =
                validarRespuestasPersonalizadas(
                    parsearJSONColumna(filas[0].preguntas_json, []),
                    req.body.respuestas
                );

            if (validacion.error) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        mensaje: validacion.error
                    });

            }

            const connection =
                await db.getConnection();

            try {

                await connection.beginTransaction();

                await connection.execute(
                    `
                    INSERT INTO evaluacion_personalizada_envios
                        (evaluacion_id, usuario_id)
                    VALUES (?, ?)
                    `,
                    [
                        id,
                        usuarioSolicitante.id
                    ]
                );

                await connection.execute(
                    `
                    INSERT INTO evaluacion_personalizada_respuestas
                        (evaluacion_id, area_evaluador, departamento_evaluador, respuestas_json)
                    VALUES (?, ?, ?, ?)
                    `,
                    [
                        id,
                        usuarioSolicitante.area || null,
                        usuarioSolicitante.departamento || null,
                        JSON.stringify(validacion.respuestas)
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
                            mensaje: "Ya respondiste esta evaluación."
                        });

                }

                throw errorTransaccion;

            }
            finally {

                connection.release();

            }

            return res.json({
                ok: true,
                mensaje: "Evaluación registrada correctamente."
            });

        }
        catch (error) {

            console.error(
                "ERROR AL GUARDAR RESPUESTAS PERSONALIZADAS:",
                error
            );

            return res
                .status(500)
                .json({
                    ok: false,
                    mensaje: "No fue posible registrar la evaluación.",
                    error: error.message
                });

        }

    }
);


/* =========================================================
   RESULTADOS Y EXPORTACIÓN (SOLO ADMINISTRADORES)
   ========================================================= */

async function cargarRespuestasPersonalizadas(evaluacionId, departamento, area) {

    const condiciones = ["evaluacion_id = ?"];
    const parametros = [evaluacionId];

    if (departamento && departamento !== "todos") {
        condiciones.push("departamento_evaluador = ?");
        parametros.push(departamento);
    }

    if (area && area !== "todas") {
        condiciones.push("area_evaluador = ?");
        parametros.push(area);
    }

    const [filas] =
        await db.execute(
            `
            SELECT area_evaluador, departamento_evaluador, respuestas_json, creado_en
            FROM evaluacion_personalizada_respuestas
            WHERE ${condiciones.join(" AND ")}
            ORDER BY creado_en ASC
            `,
            parametros
        );

    return filas.map((fila) => ({
        area: fila.area_evaluador,
        departamento: fila.departamento_evaluador,
        creadoEn: fila.creado_en,
        respuestas: parsearJSONColumna(fila.respuestas_json, {})
    }));

}


app.get(
    "/api/evaluaciones/personalizadas/:id/resultados",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!puedeVerResultadosPersonalizadas(usuarioSolicitante)) {
                return respuestaSinPermiso(res);
            }

            const id =
                Number(req.params.id);

            const [filas] =
                await db.execute(
                    `
                    SELECT
                        e.id, e.titulo, e.descripcion, e.preguntas_json, e.destinatarios,
                        e.activa, e.fecha_cierre, e.creado_en,
                        ${SQL_VIGENTE_PERSONALIZADA} AS vigente
                    FROM evaluacion_personalizada e
                    WHERE e.id = ?
                    LIMIT 1
                    `,
                    [
                        id
                    ]
                );

            if (filas.length === 0) {

                return res
                    .status(404)
                    .json({
                        ok: false,
                        mensaje: "La evaluación no existe."
                    });

            }

            const evaluacion =
                evaluacionPersonalizadaFormatear(filas[0]);

            const todas =
                await cargarRespuestasPersonalizadas(id, null, null);

            const filtradas =
                await cargarRespuestasPersonalizadas(
                    id,
                    req.query.departamento,
                    req.query.area
                );

            /*
             * Participación: solo cuentan los usuarios activos de
             * los roles a los que se dirige la evaluación.
             */
            const [[{ elegibles }]] =
                await db.execute(
                    `
                    SELECT COUNT(*) AS elegibles
                    FROM usuarios
                    WHERE activo = 1 AND FIND_IN_SET(rol, ?) > 0
                    `,
                    [
                        evaluacion.destinatarios.join(",")
                    ]
                );

            const preguntas =
                evaluacion.preguntas.map(
                    (pregunta) => {

                        const contestadas =
                            filtradas.filter(
                                (fila) => fila.respuestas[pregunta.id] !== undefined
                            );

                        const base = {
                            id: pregunta.id,
                            tipo: pregunta.tipo,
                            texto: pregunta.texto,
                            totalRespuestas: contestadas.length
                        };

                        if (pregunta.tipo === "opcion_multiple" || pregunta.tipo === "casillas") {

                            const conteo = {};

                            contestadas.forEach(
                                (fila) => {

                                    const valor = fila.respuestas[pregunta.id];

                                    (Array.isArray(valor) ? valor : [valor]).forEach(
                                        (opcionId) => {
                                            conteo[opcionId] = (conteo[opcionId] || 0) + 1;
                                        }
                                    );

                                }
                            );

                            base.opciones =
                                pregunta.opciones.map((opcion) => ({
                                    id: opcion.id,
                                    texto: opcion.texto,
                                    cantidad: conteo[opcion.id] || 0
                                }));

                        }
                        else if (pregunta.tipo === "likert") {

                            const distribucion = {};
                            let suma = 0;

                            VALORES_LIKERT_VALIDOS.forEach((valor) => { distribucion[valor] = 0; });

                            contestadas.forEach(
                                (fila) => {

                                    const valor = fila.respuestas[pregunta.id];

                                    distribucion[valor] += 1;
                                    suma += PUNTAJE_LIKERT[valor];

                                }
                            );

                            base.distribucion = distribucion;

                            base.promedio =
                                contestadas.length
                                    ? Math.round((suma / contestadas.length) * 100) / 100
                                    : null;

                        }
                        else {

                            base.comentarios =
                                contestadas
                                    .map((fila) => fila.respuestas[pregunta.id])
                                    .slice(-200)
                                    .reverse();

                        }

                        return base;

                    }
                );

            const promediosLikert =
                preguntas
                    .filter((pregunta) => pregunta.tipo === "likert" && pregunta.promedio !== null)
                    .map((pregunta) => pregunta.promedio);

            return res.json({

                ok: true,

                evaluacion: {
                    id: evaluacion.id,
                    titulo: evaluacion.titulo,
                    descripcion: evaluacion.descripcion,
                    activa: evaluacion.activa,
                    vigente: evaluacion.vigente,
                    fechaCierre: evaluacion.fechaCierre,
                    destinatarios: evaluacion.destinatarios
                },

                total: filtradas.length,

                totalGeneral: todas.length,

                elegibles: Number(elegibles),

                promedioLikertGlobal:
                    promediosLikert.length
                        ? Math.round((promediosLikert.reduce((a, b) => a + b, 0) / promediosLikert.length) * 100) / 100
                        : null,

                filtros: {
                    departamentos: [...new Set(todas.map((fila) => fila.departamento).filter(Boolean))].sort(),
                    areas: [...new Set(todas.map((fila) => fila.area).filter(Boolean))].sort()
                },

                preguntas

            });

        }
        catch (error) {

            console.error(
                "ERROR AL OBTENER RESULTADOS PERSONALIZADOS:",
                error
            );

            return res
                .status(500)
                .json({
                    ok: false,
                    mensaje: "No fue posible obtener los resultados.",
                    error: error.message
                });

        }

    }
);


app.get(
    "/api/evaluaciones/personalizadas/:id/exportar",
    async (req, res) => {

        try {

            const usuarioSolicitante =
                await obtenerUsuarioSolicitante(req);

            if (!puedeVerResultadosPersonalizadas(usuarioSolicitante)) {
                return respuestaSinPermiso(res);
            }

            const id =
                Number(req.params.id);

            const [filas] =
                await db.execute(
                    `
                    SELECT id, titulo, preguntas_json
                    FROM evaluacion_personalizada
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [
                        id
                    ]
                );

            if (filas.length === 0) {

                return res
                    .status(404)
                    .json({
                        ok: false,
                        mensaje: "La evaluación no existe."
                    });

            }

            const respuestas =
                await cargarRespuestasPersonalizadas(
                    id,
                    req.query.departamento,
                    req.query.area
                );

            return res.json({
                ok: true,
                titulo: filas[0].titulo,
                preguntas: parsearJSONColumna(filas[0].preguntas_json, []),
                respuestas
            });

        }
        catch (error) {

            console.error(
                "ERROR AL EXPORTAR EVALUACIÓN PERSONALIZADA:",
                error
            );

            return res
                .status(500)
                .json({
                    ok: false,
                    mensaje: "No fue posible exportar las respuestas.",
                    error: error.message
                });

        }

    }
);

// =========================================================
// FRONTEND
// =========================================================

app.use(
    express.static(
        path.join(__dirname, "../..")
    )
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

/* =========================================================
   ERRORES DE SUBIDA DE ARCHIVOS
   ---------------------------------------------------------
   Multer (archivo demasiado grande, formato rechazado por
   fileFilter) pasa el error a Express, que por defecto
   responde con una página HTML y el frontend no puede leer
   el mensaje. Aquí se convierte al formato { ok, mensaje }.
   Debe registrarse después de todas las rutas.
   ========================================================= */

app.use(
    (error, req, res, next) => {

        if (res.headersSent) {

            return next(error);

        }


        console.error(
            "ERROR EN LA PETICIÓN:",
            error
        );


        if (error instanceof multer.MulterError) {

            return res
                .status(400)
                .json({

                    ok: false,

                    mensaje:
                        error.code === "LIMIT_FILE_SIZE"
                            ? "El archivo es demasiado grande."
                            : "No fue posible procesar el archivo subido."

                });

        }


        /*
         * Los rechazos de formato de los fileFilter llegan
         * como Error normal con un mensaje ya pensado para
         * el usuario.
         */

        return res
            .status(400)
            .json({

                ok: false,

                mensaje:
                    error.message ||
                    "No fue posible procesar la petición."

            });

    }
);


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
            `API red: http://10.130.10.200:${PORT}/api`
        );

        console.log(
            "===================================="
        );

    }
);