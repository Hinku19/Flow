const db = require("../server/db");


/* =========================================================
   FECHA LOCAL
   ========================================================= */

function obtenerFechaLocal() {

    const fecha = new Date();

    const dia =
        String(fecha.getDate())
            .padStart(2, "0");

    const mes =
        String(fecha.getMonth() + 1)
            .padStart(2, "0");

    const anio =
        fecha.getFullYear();

    return `${anio}-${mes}-${dia}`;

}


/* =========================================================
   FECHA FORMATEADA
   ========================================================= */

function formatearFecha(fecha) {

    if (!fecha) {
        return "sin fecha de cierre";
    }

    const valor =
        String(fecha)
            .substring(0, 10);

    const partes =
        valor.split("-");

    if (partes.length !== 3) {
        return valor;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;

}


/* =========================================================
   CREAR TRANSPORTADOR
   ========================================================= */

function crearTransportadorCorreo() {

    const nodemailer =
        require("nodemailer");


    const host =
        String(
            process.env.SMTP_HOST || ""
        ).trim();


    const port =
        Number(
            process.env.SMTP_PORT || 465
        );


    const secure =
        String(
            process.env.SMTP_SECURE || "true"
        ).toLowerCase() === "true";


    const user =
        String(
            process.env.SMTP_USER || ""
        ).trim();


    const password =
        String(
            process.env.SMTP_PASSWORD || ""
        );


    if (
        !host ||
        !user ||
        !password
    ) {

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


/* =========================================================
   OBTENER DESTINATARIOS
   ---------------------------------------------------------
   Obtiene los usuarios activos cuyo rol esté incluido
   en la configuración de la evaluación.
   ========================================================= */

async function obtenerDestinatariosEvaluacion(
    destinatarios
) {

    const roles =
        Array.isArray(destinatarios)
            ? destinatarios
            : [];


    if (roles.length === 0) {
        return [];
    }


    const placeholders =
        roles
            .map(() => "?")
            .join(",");


    const [usuarios] =
        await db.execute(
            `
            SELECT

                id,

                nombre,

                rol,

                departamento,

                correo_electronico

            FROM usuarios

            WHERE

                activo = 1

                AND rol IN (${placeholders})

                AND correo_electronico IS NOT NULL

                AND TRIM(
                    correo_electronico
                ) <> ''

            ORDER BY

                nombre ASC
            `,
            roles
        );


    return usuarios;

}


/* =========================================================
   OBTENER EVALUACIÓN
   ========================================================= */

async function obtenerEvaluacion(
    evaluacionId
) {

    const [filas] =
        await db.execute(
            `
            SELECT

                id,

                titulo,

                descripcion,

                destinatarios,

                activa,

                fecha_cierre

            FROM evaluacion_personalizada

            WHERE id = ?

            LIMIT 1
            `,
            [
                evaluacionId
            ]
        );


    if (
        filas.length === 0
    ) {

        throw new Error(
            "La evaluación no existe."
        );

    }


    return filas[0];

}


/* =========================================================
   PARSEAR DESTINATARIOS
   ========================================================= */

function parsearDestinatarios(
    valor
) {

    return String(
        valor || ""
    )
        .split(",")
        .map(
            rol =>
                rol
                    .trim()
                    .toLowerCase()
        )
        .filter(
            rol =>
                rol === "lider" ||
                rol === "operador"
        );

}


/* =========================================================
   GENERAR CORREO DE NUEVA EVALUACIÓN
   ========================================================= */

function generarTextoNuevaEvaluacion(
    usuario,
    evaluacion
) {

    let texto =
        `Hola ${usuario.nombre},\n\n`;


    texto +=
        `La evaluación "${evaluacion.titulo}" ha sido asignada para tu respuesta.\n\n`;


    if (
        evaluacion.fecha_cierre
    ) {

        texto +=
            `Tienes hasta el ${formatearFecha(
                evaluacion.fecha_cierre
            )} para responderla.\n\n`;

    }
    else {

        texto +=
            `Actualmente se encuentra disponible para responder.\n\n`;

    }


    texto +=
        `Te pedimos completar la evaluación dentro del plazo establecido.\n\n`;


    texto +=
        `Este mensaje fue generado automáticamente por FLOW.`;


    return texto;

}


/* =========================================================
   GENERAR CORREO DE RECORDATORIO
   ========================================================= */

function generarTextoRecordatorio(
    usuario,
    evaluacion
) {

    let texto =
        `Hola ${usuario.nombre},\n\n`;


    texto +=
        `Este es un recordatorio de que la evaluación "${evaluacion.titulo}" continúa pendiente de respuesta.\n\n`;


    if (
        evaluacion.fecha_cierre
    ) {

        texto +=
            `Fecha límite para responder: ${formatearFecha(
                evaluacion.fecha_cierre
            )}.\n\n`;

    }
    else {

        texto +=
            `La evaluación continúa disponible para responder mientras permanezca activa.\n\n`;

    }


    texto +=
        `Te pedimos completar la evaluación a la brevedad.\n\n`;


    texto +=
        `Este mensaje fue generado automáticamente por FLOW.`;


    return texto;

}


/* =========================================================
   ENVIAR NOTIFICACIÓN DE NUEVA EVALUACIÓN
   ---------------------------------------------------------
   Se ejecuta inmediatamente después de crear la evaluación.
   ========================================================= */

async function enviarNotificacionNuevaEvaluacion(
    evaluacionId
) {

    console.log(
        "=========================================="
    );

    console.log(
        "FLOW - NUEVA EVALUACIÓN"
    );


    try {

        const evaluacion =
            await obtenerEvaluacion(
                evaluacionId
            );


        const roles =
            parsearDestinatarios(
                evaluacion.destinatarios
            );


        const usuarios =
            await obtenerDestinatariosEvaluacion(
                roles
            );


        console.log(
            `Destinatarios encontrados: ${usuarios.length}`
        );


        if (
            usuarios.length === 0
        ) {

            console.log(
                "No existen destinatarios con correo electrónico."
            );

            return [];

        }


        const transporter =
            crearTransportadorCorreo();


        const from =
            String(
                process.env.SMTP_FROM ||
                process.env.SMTP_USER
            ).trim();


        const resultados = [];


        for (
            const usuario
            of usuarios
        ) {

            try {

                await transporter.sendMail({

                    from,

                    to:
                        usuario.correo_electronico,

                    subject:
                        `Nueva evaluación pendiente: ${evaluacion.titulo}`,

                    text:
                        generarTextoNuevaEvaluacion(
                            usuario,
                            evaluacion
                        )

                });


                console.log(
                    `✓ Evaluación enviada a ${usuario.correo_electronico}`
                );


                resultados.push({

                    usuarioId:
                        usuario.id,

                    correo:
                        usuario.correo_electronico,

                    enviado:
                        true

                });

            }
            catch (error) {

                console.error(
                    `✗ Error enviando evaluación a ${usuario.correo_electronico}:`,
                    error.message
                );


                resultados.push({

                    usuarioId:
                        usuario.id,

                    correo:
                        usuario.correo_electronico,

                    enviado:
                        false,

                    error:
                        error.message

                });

            }

        }


        return resultados;

    }
    catch (error) {

        console.error(
            "ERROR EN NOTIFICACIÓN DE NUEVA EVALUACIÓN:",
            error
        );

        throw error;

    }

}


/* =========================================================
   OBTENER EVALUACIONES PENDIENTES
   ---------------------------------------------------------
   Obtiene evaluaciones:

   - Activas.
   - No vencidas.
   - Dirigidas a líder u operador.
   - Que tengan usuarios que todavía NO respondieron.
   ========================================================= */

async function obtenerEvaluacionesPendientes() {

    const [evaluaciones] =
        await db.execute(
            `
            SELECT

                e.id,

                e.titulo,

                e.descripcion,

                e.destinatarios,

                e.activa,

                e.fecha_cierre

            FROM evaluacion_personalizada e

            WHERE

                e.activa = 1

                AND (
                    e.fecha_cierre IS NULL
                    OR e.fecha_cierre >= CURDATE()
                )

            ORDER BY

                e.id ASC
            `
        );


    return evaluaciones;

}


/* =========================================================
   ENVIAR RECORDATORIOS
   ---------------------------------------------------------
   Se ejecuta diariamente a las 08:00 AM.
   ========================================================= */

async function enviarRecordatoriosEvaluaciones() {

    console.log(
        "=========================================="
    );

    console.log(
        "FLOW - RECORDATORIOS DE EVALUACIONES"
    );

    console.log(
        "Iniciando envío..."
    );


    try {

        const evaluaciones =
            await obtenerEvaluacionesPendientes();


        console.log(
            `Evaluaciones pendientes: ${evaluaciones.length}`
        );


        if (
            evaluaciones.length === 0
        ) {

            console.log(
                "No existen evaluaciones pendientes."
            );

            return [];

        }


        const transporter =
            crearTransportadorCorreo();


        const from =
            String(
                process.env.SMTP_FROM ||
                process.env.SMTP_USER
            ).trim();


        const resultados = [];


        for (
            const evaluacion
            of evaluaciones
        ) {

            const roles =
                parsearDestinatarios(
                    evaluacion.destinatarios
                );


            if (
                roles.length === 0
            ) {
                continue;
            }


            /*
             * Obtener usuarios que pertenecen
             * a los roles configurados.
             */

            const usuarios =
                await obtenerDestinatariosEvaluacion(
                    roles
                );


            for (
                const usuario
                of usuarios
            ) {

                /*
                 * Si ya respondió la evaluación,
                 * no se envía recordatorio.
                 */

                const [respondio] =
                    await db.execute(
                        `
                        SELECT

                            1

                        FROM evaluacion_personalizada_envios

                        WHERE

                            evaluacion_id = ?

                            AND usuario_id = ?

                        LIMIT 1
                        `,
                        [
                            evaluacion.id,
                            usuario.id
                        ]
                    );


                if (
                    respondio.length > 0
                ) {

                    continue;

                }


                try {

                    await transporter.sendMail({

                        from,

                        to:
                            usuario.correo_electronico,

                        subject:
                            `Recordatorio — Evaluación pendiente: ${evaluacion.titulo}`,

                        text:
                            generarTextoRecordatorio(
                                usuario,
                                evaluacion
                            )

                    });


                    console.log(
                        `✓ Recordatorio enviado a ${usuario.correo_electronico} — ${evaluacion.titulo}`
                    );


                    resultados.push({

                        evaluacionId:
                            evaluacion.id,

                        usuarioId:
                            usuario.id,

                        correo:
                            usuario.correo_electronico,

                        enviado:
                            true

                    });

                }
                catch (error) {

                    console.error(
                        `✗ Error enviando recordatorio a ${usuario.correo_electronico}:`,
                        error.message
                    );


                    resultados.push({

                        evaluacionId:
                            evaluacion.id,

                        usuarioId:
                            usuario.id,

                        correo:
                            usuario.correo_electronico,

                        enviado:
                            false,

                        error:
                            error.message

                    });

                }

            }

        }


        console.log(
            "Recordatorios de evaluaciones finalizados."
        );


        return resultados;

    }
    catch (error) {

        console.error(
            "ERROR GENERAL EN RECORDATORIOS DE EVALUACIONES:",
            error
        );

        throw error;

    }

}


/* =========================================================
   EXPORTAR
   ========================================================= */

module.exports = {

    enviarNotificacionNuevaEvaluacion,

    enviarRecordatoriosEvaluaciones

};