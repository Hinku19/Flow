/* =========================================================
   PDF REPORT SERVICE
   ========================================================= */

import {
    API_URL
} from "../components/config.js";

import {
    headerUsuario
} from "./auth.service.js";

async function convertirImagenADataURL(url) {

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`No fue posible cargar el recurso ${url}.`);
    }

    const blob = await response.blob();

    return await new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;

        reader.readAsDataURL(blob);

    });

}

export async function generarHTMLReunionPDF(
    reunion,
    secciones,
    participantes
) {

    if (!reunion) {

        throw new Error(
            "No se recibió la información de la reunión."
        );

    }

    const logoSocoda =
        await convertirImagenADataURL(
            new URL(
                "./assets/socoadalogo.png",
                window.location.href
            ).href
        );


    const logoFlow =
        await convertirImagenADataURL(
            new URL(
                "./assets/flowlogo.png",
                window.location.href
            ).href
        );


    const s =
        secciones ||
        {};


    const asistentes =
        Array.isArray(
            participantes
        )
            ? participantes
            : [];


    /* =====================================================
       FUNCIONES AUXILIARES
       ===================================================== */

    function escaparHTML(
        valor
    ) {

        if (
            valor === null ||
            valor === undefined
        ) {

            return "";

        }


        return String(valor)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }


    function formatearFecha(
        valor
    ) {

        if (!valor) {

            return "—";

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

            return "—";

        }


        return fecha.toLocaleString(
            "es-MX",
            {

                day:
                    "2-digit",

                month:
                    "2-digit",

                year:
                    "numeric",

                hour:
                    "2-digit",

                minute:
                    "2-digit"

            }
        );

    }


    function renderLista(
        items,
        callback
    ) {

        if (
            !Array.isArray(items) ||
            items.length === 0
        ) {

            return `
                <div class="empty">
                    Sin registros.
                </div>
            `;

        }


        return items
            .map(
                callback
            )
            .join("");

    }


    function texto(
        valor
    ) {

        return escaparHTML(
            valor ||
            "—"
        );

    }


    /* =====================================================
       OBJETIVOS
       ===================================================== */

    const objetivosHTML =
        renderLista(
            s.objetivos,
            objetivo => {

                return `
                    <div class="objective-item">

                        <span class="objective-check">
                            ${
                                objetivo.done
                                    ? "✓"
                                    : "○"
                            }
                        </span>

                        <span>
                            ${texto(
                                objetivo.texto
                            )}
                        </span>

                    </div>
                `;

            }
        );


    /* =====================================================
       ASUNTOS GENERALES
       ===================================================== */

    const asuntosHTML =
        renderLista(
            s.asuntos,
            asunto => {

                return `
                    <div class="bullet-item">

                        •
                        ${texto(
                            asunto.texto
                        )}

                    </div>
                `;

            }
        );


    /* =====================================================
       DESARROLLO
       ===================================================== */

    let desarrolloHTML =
        "";


    const desarrollo =
        s.desarrollo ||
        {};


    Object.keys(
        desarrollo
    ).forEach(
        objetivoId => {

            const bloques =
                desarrollo[
                    objetivoId
                ];


            if (
                !Array.isArray(
                    bloques
                )
            ) {

                return;

            }


            const objetivo =
                (
                    Array.isArray(
                        s.objetivos
                    )
                        ? s.objetivos
                        : []
                )
                .find(
                    item =>
                        String(
                            item.id
                        ) ===
                        String(
                            objetivoId
                        )
                );


            desarrolloHTML += `
                <div class="development-group">

                    ${
                        objetivo
                            ? `
                                <div class="development-title">
                                    ${texto(
                                        objetivo.texto
                                    )}
                                </div>
                            `
                            : ""
                    }

                    <div class="development-content">
            `;


            bloques.forEach(
                bloque => {

                    if (
                        bloque.tipo ===
                        "subtitulo"
                    ) {

                        desarrolloHTML += `
                            <div class="development-subtitle">
                                ${texto(
                                    bloque.texto
                                )}
                            </div>
                        `;

                    }

                    else if (
                        bloque.tipo ===
                        "punto"
                    ) {

                        desarrolloHTML += `
                            <div class="development-point">

                                •
                                ${texto(
                                    bloque.texto
                                )}

                                <span class="progress">
                                    ${
                                        bloque.avance ??
                                        0
                                    }%
                                </span>

                            </div>
                        `;

                    }

                    else {

                        desarrolloHTML += `
                            <div class="development-text">
                                ${texto(
                                    bloque.texto
                                )}
                            </div>
                        `;

                    }

                }
            );


            desarrolloHTML += `
                    </div>

                </div>
            `;

        }
    );


    if (
        !desarrolloHTML
    ) {

        desarrolloHTML =
            `
                <div class="empty">
                    Sin registros.
                </div>
            `;

    }


    /* =====================================================
       PARTICIPANTES
       ===================================================== */

    const participantesHTML =
        renderLista(
            asistentes,
            participante => {

                const nombre =
                    participante.nombre ||
                    participante.Nombre ||
                    "Usuario";


                const asistio =
                    Number(
                        participante.Asistio
                    ) === 1;


                return `
                    <tr>

                        <td>
                            ${texto(
                                nombre
                            )}
                        </td>

                        <td>
                            ${
                                asistio
                                    ? "Asistió"
                                    : "No asistió"
                            }
                        </td>

                        <td>
                            —
                        </td>

                    </tr>
                `;

            }
        );


    /* =====================================================
       COMPROMISOS
       ===================================================== */

    let compromisosHTML =
        "";


    if (
        Array.isArray(
            s.compromisos
        ) &&
        s.compromisos.length > 0
    ) {

        compromisosHTML =
            s.compromisos
                .map(
                    compromiso => {

                        const responsables =
                            compromiso.usuarioAsignadoNombre ||
                            (
                                Array.isArray(
                                    compromiso.colaboradores
                                )
                                    ? compromiso.colaboradores.join(
                                        ", "
                                    )
                                    : (
                                        compromiso.colaboradores ||
                                        ""
                                    )
                            );


                        return `
                            <tr>

                                <td>
                                    ${texto(
                                        responsables
                                    )}
                                </td>

                                <td>
                                    ${texto(
                                        compromiso.descripcion
                                    )}
                                </td>

                                <td>
                                    ${texto(
                                        compromiso.vigencia
                                    )}
                                </td>

                                <td>
                                    ${texto(
                                        compromiso.estado
                                    )}
                                </td>

                            </tr>
                        `;

                    }
                )
                .join("");

    }


    if (
        !compromisosHTML
    ) {

        compromisosHTML = `
            <tr>

                <td colspan="4">
                    Sin compromisos pendientes.
                </td>

            </tr>
        `;

    }


    /* =====================================================
       ENLACES
       ===================================================== */

    const enlacesHTML =
        renderLista(
            s.enlaces,
            enlace => {

                return `
                    <tr>

                        <td>
                            ${texto(
                                enlace.titulo
                            )}
                        </td>

                        <td>
                            ${texto(
                                enlace.url
                            )}
                        </td>

                    </tr>
                `;

            }
        );


    /* =====================================================
       DOCUMENTO
       ===================================================== */

    const tituloReunion =
        reunion.Titulo ||
        "Reunión Flow";


    const fechaGeneracion =
        new Date()
            .toLocaleDateString(
                "es-MX"
            );


    const html =
`
<!DOCTYPE html>

<html lang="es">

<head>

    <meta charset="UTF-8">

    <title>
        ${escaparHTML(
            tituloReunion
        )}
    </title>


    <style>

        /* =================================================
           CONFIGURACIÓN DE PÁGINA
           ================================================= */

        @page {

            size:
                letter;

            margin:
                12mm;

        }


        /* =================================================
           GENERAL
           ================================================= */

        * {

            box-sizing:
                border-box;

        }


        body {

            margin:
                0;

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            color:
                #1a1a1a;

            font-size:
                11px;

            line-height:
                1.35;

        }


        .report {

            width:
                100%;

        }


        /* =================================================
           ENCABEZADO
           ================================================= */

        .header {

            display:
                grid;

            grid-template-columns:
                145px 1fr;

            gap:
                20px;

            align-items:
                center;

            margin-bottom:
                18px;

            padding-bottom:
                12px;

            border-bottom:
                1px solid #d3d3d3;

        }


        /* =================================================
           LOGO SOCOADA
           ================================================= */

        .logo {

            width:
                125px !important;

            height:
                70px !important;

            display:
                flex;

            align-items:
                center;

            justify-content:
                flex-start;

            overflow:
                hidden;

        }


        .logo img {

            display:
                block !important;

            width:
                115px !important;

            height:
                auto !important;

            max-width:
                115px !important;

            max-height:
                65px !important;

            min-width:
                0 !important;

            min-height:
                0 !important;

            object-fit:
                contain;

        }


        /* =================================================
           INFORMACIÓN - DOS COLUMNAS
           ================================================= */

        .info {

            display:
                grid;

            grid-template-columns:
                1fr 1fr;

            column-gap:
                28px;

            align-items:
                start;

        }


        .info-column {

            display:
                grid;

            grid-template-columns:
                78px 1fr;

            column-gap:
                8px;

            row-gap:
                5px;

        }


        .info-label {

            font-weight:
                700;

        }


        .info-value {

            min-width:
                0;

        }


        /* =================================================
           SECCIONES
           ================================================= */

        .section {

            margin-top:
                16px;

        }


        .section-title {

            background:
                #dcecf5;

            border-bottom:
                1px solid #9fc6db;

            padding:
                7px 9px;

            font-size:
                14px;

            font-weight:
                700;

            color:
                #164f6d;

        }


        /* =================================================
           TABLAS
           ================================================= */

        table {

            width:
                100%;

            border-collapse:
                collapse;

            margin-top:
                8px;

        }


        th,
        td {

            border:
                1px solid #d3d3d3;

            padding:
                6px 7px;

            vertical-align:
                top;

        }


        th {

            background:
                #f4f7f9;

            font-weight:
                700;

        }


        /* =================================================
           OBJETIVOS
           ================================================= */

        .objective-item {

            padding:
                4px 0;

            display:
                flex;

            gap:
                6px;

        }


        .objective-check {

            width:
                15px;

            flex-shrink:
                0;

        }


        /* =================================================
           ASUNTOS
           ================================================= */

        .bullet-item {

            padding:
                3px 0;

        }


        /* =================================================
           DESARROLLO
           ================================================= */

        .development-group {

            display:
                grid;

            grid-template-columns:
                185px 1fr;

            border:
                1px solid #d3d3d3;

            border-bottom:
                none;

        }


        .development-group:last-child {

            border-bottom:
                1px solid #d3d3d3;

        }


        .development-title {

            padding:
                9px;

            font-weight:
                700;

            background:
                #fafafa;

            border-right:
                1px solid #d3d3d3;

        }


        .development-content {

            padding:
                9px;

        }


        .development-subtitle {

            font-weight:
                700;

            margin-bottom:
                5px;

        }


        .development-point {

            margin-bottom:
                4px;

        }


        .development-text {

            margin-bottom:
                5px;

        }


        .progress {

            font-weight:
                700;

        }


        /* =================================================
           ESTADO VACÍO
           ================================================= */

        .empty {

            color:
                #666;

            font-style:
                italic;

            padding:
                7px 0;

        }


        /* =================================================
           PIE DE PÁGINA
           ================================================= */

        .footer {

            position:
                relative;

            min-height:
                32px;

            margin-top:
                20px;

            padding-top:
                7px;

            border-top:
                1px solid #d3d3d3;

            display:
                flex;

            align-items:
                center;

            justify-content:
                space-between;

            font-size:
                9px;

            color:
                #666;

            break-inside:
                avoid;

            page-break-inside:
                avoid;

        }


        .footer__left {

            position:
                relative;

            z-index:
                2;

        }


        .footer__right {

            position:
                relative;

            z-index:
                2;

        }


        /* =================================================
           MARCA DE AGUA FLOW
           ================================================= */

        .footer__watermark {

            position:
                absolute;

            left:
                50%;

            bottom:
                2px;

            transform:
                translateX(-50%);

            width:
                70px !important;

            height:
                22px !important;

            display:
                flex;

            align-items:
                center;

            justify-content:
                center;

            overflow:
                hidden;

            opacity:
                0.10;

            z-index:
                1;

        }


        .footer__watermark img {

            display:
                block !important;

            width:
                65px !important;

            height:
                auto !important;

            max-width:
                65px !important;

            max-height:
                22px !important;

            min-width:
                0 !important;

            min-height:
                0 !important;

            object-fit:
                contain;

        }


        /* =================================================
           IMPRESIÓN
           ================================================= */

        @media print {

            body {

                print-color-adjust:
                    exact;

                -webkit-print-color-adjust:
                    exact;

            }

        }

    </style>

</head>


<body>

    <div class="report">


        <!-- =================================================
             ENCABEZADO
             ================================================= -->

        <div class="header">


            <!-- =============================================
                 LOGO SOCOADA
                 ============================================= -->

            <div class="logo">

                <img
                    src="${logoSocoda}"
                    alt="SOCOADA"
                >

            </div>


            <!-- =============================================
                 INFORMACIÓN DE LA REUNIÓN
                 ============================================= -->

            <div class="info">


                <!-- =========================================
                     COLUMNA 1
                     ========================================= -->

                <div class="info-column">


                    <div class="info-label">
                        Reunión:
                    </div>

                    <div class="info-value">
                        ${texto(
                            tituloReunion
                        )}
                    </div>


                    <div class="info-label">
                        Tipo:
                    </div>

                    <div class="info-value">
                        Reunión
                    </div>


                    <div class="info-label">
                        Fecha:
                    </div>

                    <div class="info-value">
                        ${texto(
                            formatearFecha(
                                reunion.FechaInicio
                            )
                        )}
                    </div>


                </div>


                <!-- =========================================
                     COLUMNA 2
                     ========================================= -->

                <div class="info-column">


                    <div class="info-label">
                        Departamento:
                    </div>

                    <div class="info-value">
                        ${texto(
                            reunion.Departamento
                        )}
                    </div>


                    <div class="info-label">
                        Área:
                    </div>

                    <div class="info-value">
                        ${texto(
                            reunion.Area
                        )}
                    </div>


                    <div class="info-label">
                        Creada por:
                    </div>

                    <div class="info-value">
                        ${texto(
                            reunion.CreadorNombre ||
                            reunion.UsuarioCreadorNombre
                        )}
                    </div>


                    <div class="info-label">
                        Estado:
                    </div>

                    <div class="info-value">
                        ${texto(
                            reunion.Estado
                        )}
                    </div>


                </div>


            </div>


        </div>


        <!-- =================================================
             ASISTENCIA
             ================================================= -->

        <div class="section">


            <div class="section-title">
                Asistencia y participantes
            </div>


            <table>

                <thead>

                    <tr>

                        <th>
                            Participante
                        </th>

                        <th>
                            Asistencia
                        </th>

                        <th>
                            Rol
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${participantesHTML}

                </tbody>

            </table>


        </div>


        <!-- =================================================
             OBJETIVOS
             ================================================= -->

        <div class="section">


            <div class="section-title">
                Objetivos
            </div>


            ${objetivosHTML}


        </div>


        <!-- =================================================
             ASUNTOS GENERALES
             ================================================= -->

        <div class="section">


            <div class="section-title">
                Asuntos generales
            </div>


            ${asuntosHTML}


        </div>


        <!-- =================================================
             DESARROLLO
             ================================================= -->

        <div class="section">


            <div class="section-title">
                Desarrollo
            </div>


            ${desarrolloHTML}


        </div>


        <!-- =================================================
             OTROS ASUNTOS
             ================================================= -->

        <div class="section">


            <div class="section-title">
                Otros asuntos
            </div>


            <div class="development-content">

                ${texto(
                    s.otros
                )}

            </div>


        </div>


        <!-- =================================================
             COMPETITIVIDAD
             ================================================= -->

        <div class="section">


            <div class="section-title">
                Competitividad
            </div>


            <div class="development-content">

                ${texto(
                    s.competitividad
                )}

            </div>


        </div>


        <!-- =================================================
             COMPROMISOS
             ================================================= -->

        <div class="section">


            <div class="section-title">
                Compromisos
            </div>


            <table>

                <thead>

                    <tr>

                        <th>
                            Responsable
                        </th>

                        <th>
                            Compromiso
                        </th>

                        <th>
                            Vigencia
                        </th>

                        <th>
                            Estado
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${compromisosHTML}

                </tbody>

            </table>


        </div>


        <!-- =================================================
             ACUERDOS
             ================================================= -->

        <div class="section">


            <div class="section-title">
                Acuerdos
            </div>


            <div class="development-content">

                ${texto(
                    s.acuerdos
                )}

            </div>


        </div>


        <!-- =================================================
             ENLACES
             ================================================= -->

        <div class="section">


            <div class="section-title">
                Enlaces
            </div>


            <table>

                <thead>

                    <tr>

                        <th>
                            Enlace
                        </th>

                        <th>
                            URL
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${enlacesHTML}

                </tbody>

            </table>


        </div>


        <!-- =================================================
             REFLEXIÓN
             ================================================= -->

        <div class="section">


            <div class="section-title">
                Reflexión grupal
            </div>


            <div class="development-content">

                ${texto(
                    s.reflexion
                )}

            </div>


        </div>


        <!-- =================================================
             PIE
             ================================================= -->

        <div class="footer">


            <div class="footer__left">

                Generado el:
                ${fechaGeneracion}

            </div>


            <div class="footer__watermark">

                <img
                    src="${logoFlow}"
                    alt="FLOW"
                >

            </div>


            <div class="footer__right">

                Reporte de reunión

            </div>


        </div>


    </div>


    <script>

        window.onload =
            async function () {


                /* =========================================
                   ESPERAR A QUE CARGUEN LOS LOGOS
                   ========================================= */

                const imagenes =
                    Array.from(
                        document.images
                    );


                await Promise.all(
                    imagenes.map(
                        imagen => {


                            if (
                                imagen.complete
                            ) {

                                return Promise.resolve();

                            }


                            return new Promise(
                                resolve => {


                                    imagen.onload =
                                        resolve;


                                    imagen.onerror =
                                        resolve;


                                }
                            );

                        }
                    )
                );


                /* =========================================
                   IMPRIMIR
                   ========================================= */

                setTimeout(
                    function () {

                        window.print();

                    },
                    300
                );


            };


        /* =================================================
           CERRAR VENTANA DESPUÉS DE IMPRIMIR
           ================================================= */

        window.onafterprint =
            function () {


                setTimeout(
                    function () {

                        window.close();

                    },
                    300
                );


            };

    </script>


</body>

</html>

`;


    return html;

}

/* =========================================================
   EXPORTAR PDF DESDE EL NAVEGADOR
   ========================================================= */

export async function exportarReunionPDF(
    reunion,
    secciones,
    participantes
) {

    const html =
        await generarHTMLReunionPDF(
            reunion,
            secciones,
            participantes
        );

    const ventana =
        window.open(
            "",
            "_blank",
            "width=1200,height=900"
        );

    if (!ventana) {
        throw new Error(
            "El navegador bloqueó la ventana del reporte. Permite ventanas emergentes para Flow."
        );
    }

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();

}

/* =========================================================
   ENVIAR REPORTE POR CORREO
   ========================================================= */

export async function enviarReporteReunionPorCorreo(
    reunionId,
    reunion,
    secciones,
    participantes
) {

    const html =
        await generarHTMLReunionPDF(
            reunion,
            secciones,
            participantes
        );

    /*
     * El HTML de Exportar PDF contiene el script que abre
     * el diálogo de impresión. Para el servidor solo necesitamos
     * la plantilla visual, así que lo retiramos antes de enviarla.
     */
    const htmlParaCorreo =
        html.replace(
            /<script[\s\S]*?<\/script>/gi,
            ""
        );

    const response =
        await fetch(
            `${API_URL}/reuniones/${reunionId}/enviar-reporte`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...headerUsuario()
                },
                body: JSON.stringify({
                    html: htmlParaCorreo
                })
            }
        );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.mensaje ||
            data.error ||
            "No fue posible enviar el reporte por correo."
        );
    }

    return data;

}