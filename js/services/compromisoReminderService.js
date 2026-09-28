const db = require("../server/db");


/* =========================================================
   FECHA LOCAL
   ========================================================= */

function obtenerFechaLocal() {

    const fecha =
        new Date();


    const dia =
        String(
            fecha.getDate()
        )
        .padStart(2, "0");


    const mes =
        String(
            fecha.getMonth() + 1
        )
        .padStart(2, "0");


    const anio =
        fecha.getFullYear();


    return `${anio}-${mes}-${dia}`;

}


/* =========================================================
   FECHA DEL DÍA ANTERIOR
   ========================================================= */

function obtenerFechaDiaAnterior() {

    const fecha =
        new Date();


    fecha.setDate(
        fecha.getDate() - 1
    );


    const dia =
        String(
            fecha.getDate()
        )
        .padStart(2, "0");


    const mes =
        String(
            fecha.getMonth() + 1
        )
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
        return "";
    }

    const dias = [
        "Dom",
        "Lun",
        "Mar",
        "Mié",
        "Jue",
        "Vie",
        "Sáb"
    ];

    let valor = fecha;

    /*
     * Si viene como Date de JavaScript
     */
    if (fecha instanceof Date) {

        if (isNaN(fecha.getTime())) {
            return "";
        }

        return `${dias[fecha.getDay()]} ${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}/${fecha.getFullYear()}`;
    }

    /*
     * Convertimos a texto
     */
    valor =
        String(fecha).trim();


    /*
     * Si viene como:
     *
     * 2026-09-30
     *
     * o:
     *
     * 2026-09-30T00:00:00.000Z
     */
    const coincidencia =
        valor.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );


    if (coincidencia) {

        const anio =
            Number(coincidencia[1]);

        const mes =
            Number(coincidencia[2]);

        const dia =
            Number(coincidencia[3]);


        /*
         * Usamos UTC para evitar que la fecha
         * cambie de día por la zona horaria.
         */
        const fechaObjeto =
            new Date(
                Date.UTC(
                    anio,
                    mes - 1,
                    dia
                )
            );


        return `${dias[fechaObjeto.getUTCDay()]} ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${anio}`;

    }


    /*
     * Si llega algo como:
     *
     * Wed Sep 30 2026 ...
     *
     * intentamos convertirlo.
     */
    const fechaObjeto =
        new Date(valor);


    if (
        !isNaN(
            fechaObjeto.getTime()
        )
    ) {

        return `${dias[fechaObjeto.getDay()]} ${String(fechaObjeto.getDate()).padStart(2, "0")}/${String(fechaObjeto.getMonth() + 1).padStart(2, "0")}/${fechaObjeto.getFullYear()}`;

    }


    return valor;

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
        )
        .toLowerCase() === "true";


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

            pass:
                password

        }

    });

}


/* =========================================================
   OBTENER USUARIOS QUE RECIBIRÁN CORREO
   ---------------------------------------------------------
   Se obtienen todos los usuarios activos que tengan correo.
   Después se determina qué compromisos corresponden a cada
   uno según su rol.
   ========================================================= */

async function obtenerDestinatarios() {

    const [
        usuarios
    ] =
        await db.execute(
            `
            SELECT

                id,

                nombre,

                correo_electronico,

                rol,

                departamento

            FROM usuarios

            WHERE

                activo = 1

                AND correo_electronico IS NOT NULL

                AND TRIM(
                    correo_electronico
                ) <> ''

            ORDER BY

                nombre ASC
            `
        );


    return usuarios;

}


/* =========================================================
   OBTENER COMPROMISOS PENDIENTES
   ---------------------------------------------------------
   OPERADOR / ADMINISTRADOR:
       Solo sus propios compromisos.

   LÍDER:
       Compromisos de todo su departamento.

   NO incluye compromisos vencidos.
   ========================================================= */

async function obtenerCompromisosPendientes(
    usuario
) {

    const rol =
        String(
            usuario.rol || ""
        )
        .trim()
        .toLowerCase();


    let condicionResponsable = "";

    let parametros = [];


    /* =====================================================
       LÍDER
       ===================================================== */

    if (
        rol === "lider"
    ) {

        condicionResponsable = `
            u.departamento = ?
        `;


        parametros.push(
            usuario.departamento
        );

    }


    /* =====================================================
       OPERADOR / ADMINISTRADOR
       ===================================================== */

    else {

        condicionResponsable = `
            c.UsuarioAsignadoId = ?
        `;


        parametros.push(
            usuario.id
        );

    }


    const [
        filas
    ] =
        await db.execute(
            `
            SELECT

                c.CompromisoId,

                c.Titulo,

                c.Descripcion,

                c.Prioridad,

                c.FechaInicioEstimada,

                c.FechaFinEstimada,

                c.Status,

                c.UsuarioAsignadoId,

                u.nombre AS ResponsableNombre,

                u.correo_electronico AS ResponsableCorreo,

                u.departamento AS ResponsableDepartamento

            FROM compromisos c

            INNER JOIN usuarios u
                ON u.id =
                    c.UsuarioAsignadoId

            WHERE

                ${condicionResponsable}

                AND u.activo = 1

                AND c.Status IN (1, 2)

                AND (
                    c.FechaFinEstimada IS NULL
                    OR DATE(c.FechaFinEstimada) >= CURDATE()
                )

            ORDER BY

                c.FechaFinEstimada ASC,

                u.nombre ASC,

                c.CompromisoId ASC
            `,

            parametros
        );


    return filas;

}


/* =========================================================
   OBTENER COMPROMISOS VENCIDOS DEL DÍA ANTERIOR
   ---------------------------------------------------------
   SOLO PARA LÍDERES.

   Ejemplo:

   Si hoy es 26/09/2026:

       FechaFinEstimada = 25/09/2026

   y el compromiso tiene Status = 4 (vencido).

   Se incluyen los compromisos del departamento del líder.
   ========================================================= */

async function obtenerCompromisosVencidosAyer(
    usuario
) {

    const [
        filas
    ] =
        await db.execute(
            `
            SELECT

                c.CompromisoId,

                c.Titulo,

                c.Descripcion,

                c.Prioridad,

                c.FechaInicioEstimada,

                c.FechaFinEstimada,

                c.Status,

                c.UsuarioAsignadoId,

                u.nombre AS ResponsableNombre,

                u.correo_electronico AS ResponsableCorreo,

                u.departamento AS ResponsableDepartamento

            FROM compromisos c

            INNER JOIN usuarios u
                ON u.id =
                    c.UsuarioAsignadoId

            WHERE

                u.activo = 1

                AND u.departamento = ?

                AND c.FechaFinEstimada IS NOT NULL

                AND DATE(
                    c.FechaFinEstimada
                ) = DATE_SUB(
                    CURDATE(),
                    INTERVAL 1 DAY
                )

                AND c.Status = 4

            ORDER BY

                u.nombre ASC,

                c.FechaFinEstimada ASC,

                c.CompromisoId ASC
            `,

            [
                usuario.departamento
            ]
        );


    return filas;

}


/* =========================================================
   GENERAR TEXTO DEL CORREO
   ========================================================= */

function generarTextoCorreo(
    destinatario
) {

    const fechaHoy =
        obtenerFechaLocal();


    const fechaAyer =
        obtenerFechaDiaAnterior();


    let texto =
        `Hola ${destinatario.nombre},\n\n`;


    /* =====================================================
       ENCABEZADO
       ===================================================== */

    if (
        destinatario.rol === "lider"
    ) {

        texto +=
            `Estos son los compromisos pendientes de tu departamento al día ${formatearFecha(fechaHoy)}:\n\n`;

    }
    else {

        texto +=
            `Estos son tus compromisos pendientes al día ${formatearFecha(fechaHoy)}:\n\n`;

    }


    /* =====================================================
       COMPROMISOS PENDIENTES
       ===================================================== */

    const grupos =
        new Map();


    for (
        const compromiso
        of destinatario.compromisos
    ) {

        const responsable =
            compromiso.ResponsableNombre ||
            "Sin responsable";


        if (
            !grupos.has(
                responsable
            )
        ) {

            grupos.set(
                responsable,
                []
            );

        }


        grupos
            .get(
                responsable
            )
            .push(
                compromiso
            );

    }


    let contador =
        1;


    for (
        const [
            responsable,
            compromisos
        ]
        of grupos
    ) {

        /* =================================================
           SOLO EL LÍDER VE EL RESPONSABLE
           ================================================= */

        if (
            destinatario.rol === "lider"
        ) {

            texto +=
                `\n${responsable}\n`;

        }


        for (
            const compromiso
            of compromisos
        ) {

            const descripcion =
                compromiso.Descripcion ||
                compromiso.Titulo ||
                "Compromiso sin descripción";


            texto +=
                `${contador}. ${descripcion}`;


            if (
                compromiso.FechaFinEstimada
            ) {

                texto +=
                    ` — Fecha límite: ${formatearFecha(
                        compromiso.FechaFinEstimada
                    )}`;

            }


            texto +=
                `\n`;


            contador++;

        }

    }


    /* =====================================================
       SI NO HAY PENDIENTES
       ===================================================== */

    if (
        destinatario.compromisos.length === 0
    ) {

        texto +=
            `No tienes compromisos pendientes.\n`;

    }


    /* =====================================================
       COMPROMISOS VENCIDOS
       -----------------------------------------------------
       SOLO PARA LÍDERES
       ===================================================== */

    if (
        destinatario.rol === "lider"
    ) {

        const vencidosAyer =
            Array.isArray(
                destinatario.vencidosAyer
            )
                ? destinatario.vencidosAyer
                : [];


        texto +=
            `\n\n========================================\n`;


        texto +=
            `COMPROMISOS VENCIDOS AL ${formatearFecha(fechaAyer)}\n`;


        texto +=
            `========================================\n\n`;


        if (
            vencidosAyer.length === 0
        ) {

            texto +=
                `No hubo compromisos vencidos al ${formatearFecha(fechaAyer)}.\n`;

        }
        else {

            let contadorVencidos =
                1;


            for (
                const compromiso
                of vencidosAyer
            ) {

                const descripcion =
                    compromiso.Descripcion ||
                    compromiso.Titulo ||
                    "Compromiso sin descripción";


                texto +=
                    `${contadorVencidos}. ${descripcion}`;


                texto +=
                    ` — Responsable: ${
                        compromiso.ResponsableNombre ||
                        "Sin responsable"
                    }`;


                if (
                    compromiso.FechaFinEstimada
                ) {

                    texto +=
                        ` — Fecha límite: ${formatearFecha(
                            compromiso.FechaFinEstimada
                        )}`;

                }


                texto +=
                    `\n`;


                contadorVencidos++;

            }

        }

    }


    /* =====================================================
       PIE
       ===================================================== */

    texto +=
        `\nEste mensaje fue generado automáticamente por FLOW.`;


    return texto;

}


/* =========================================================
   ENVIAR RECORDATORIOS
   ========================================================= */

async function enviarRecordatoriosCompromisos() {

    console.log(
        "=========================================="
    );


    console.log(
        "FLOW - RECORDATORIOS DE COMPROMISOS"
    );


    console.log(
        "Iniciando envío..."
    );


    try {

        /* =================================================
           OBTENER USUARIOS
           ================================================= */

        const usuarios =
            await obtenerDestinatarios();


        console.log(
            `Usuarios con correo encontrados: ${usuarios.length}`
        );


        if (
            usuarios.length === 0
        ) {

            console.log(
                "No existen usuarios con correo para enviar."
            );


            return [];

        }


        /* =================================================
           CONSTRUIR DESTINATARIOS
           ================================================= */

        const destinatarios =
            [];


        for (
            const usuario
            of usuarios
        ) {

            const rol =
                String(
                    usuario.rol || ""
                )
                .trim()
                .toLowerCase();


            /* =============================================
               COMPROMISOS PENDIENTES
               ============================================= */

            const compromisos =
                await obtenerCompromisosPendientes(
                    usuario
                );


            /* =============================================
               VENCIDOS DEL DÍA ANTERIOR
               SOLO LÍDER
               ============================================= */

            let vencidosAyer =
                [];


            if (
                rol === "lider"
            ) {

                vencidosAyer =
                    await obtenerCompromisosVencidosAyer(
                        usuario
                    );

            }


            /* =============================================
               DECIDIR SI SE ENVÍA
               ============================================= */

            const tienePendientes =
                compromisos.length > 0;


            const tieneVencidos =
                vencidosAyer.length > 0;


            /*
             * Operador / administrador:
             * solo reciben correo si tienen pendientes.
             *
             * Líder:
             * recibe correo si tiene pendientes
             * O si tiene vencidos del día anterior.
             */

            if (
                rol !== "lider" &&
                !tienePendientes
            ) {

                continue;

            }


            if (
                rol === "lider" &&
                !tienePendientes &&
                !tieneVencidos
            ) {

                continue;

            }


            destinatarios.push({

                id:
                    usuario.id,

                nombre:
                    usuario.nombre,

                correo:
                    String(
                        usuario.correo_electronico
                    )
                    .trim()
                    .toLowerCase(),

                rol,

                departamento:
                    usuario.departamento || "",

                compromisos,

                vencidosAyer

            });

        }


        console.log(
            `Destinatarios que recibirán correo: ${destinatarios.length}`
        );


        if (
            destinatarios.length === 0
        ) {

            console.log(
                "No existen recordatorios para enviar."
            );


            return [];

        }


        /* =================================================
           TRANSPORTADOR
           ================================================= */

        const transporter =
            crearTransportadorCorreo();


        const from =
            String(
                process.env.SMTP_FROM ||
                process.env.SMTP_USER
            ).trim();


        const resultados =
            [];


        /* =================================================
           ENVIAR
           ================================================= */

        for (
            const destinatario
            of destinatarios
        ) {

            try {

                await transporter.sendMail({

                    from,

                    to:
                        destinatario.correo,

                    subject:
                        `Compromisos pendientes al ${formatearFecha(
                            obtenerFechaLocal()
                        )}`,

                    text:
                        generarTextoCorreo(
                            destinatario
                        )

                });


                console.log(
                    `✓ Correo enviado a ${destinatario.correo} ` +
                    `(${destinatario.compromisos.length} pendientes` +
                    `${
                        destinatario.rol === "lider"
                            ? `, ${destinatario.vencidosAyer.length} vencidos`
                            : ""
                    })`
                );


                resultados.push({

                    correo:
                        destinatario.correo,

                    enviado:
                        true

                });

            }
            catch (
                error
            ) {

                console.error(
                    `✗ Error enviando a ${destinatario.correo}:`,
                    error.message
                );


                resultados.push({

                    correo:
                        destinatario.correo,

                    enviado:
                        false,

                    error:
                        error.message

                });

            }

        }


        console.log(
            "Recordatorios finalizados."
        );


        return resultados;

    }
    catch (
        error
    ) {

        console.error(
            "ERROR GENERAL EN RECORDATORIOS:",
            error
        );


        throw error;

    }

}


/* =========================================================
   EXPORTAR
   ========================================================= */

module.exports = {

    enviarRecordatoriosCompromisos

};