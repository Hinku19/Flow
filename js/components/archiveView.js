/* =========================================================
   ARCHIVE VIEW
   ========================================================= */

import {
    showView
} from "../services/viewManager.js";

import {
    exportarReunionPDF
} from "../services/pdfReportService.js";

import {
    API_URL
} from "./config.js";

import {
    headerUsuario
} from "../services/auth.service.js";

import {
    cargarSeccionesDesdeBD
} from "../services/storage.service.js";

import {
    reiniciarContenedor
} from "../utils/reiniciarContenedor.js";

import {
    createEditableList
} from "./editableList.js";

import {
    createDevelopmentTable
} from "./developmentTable.js";

import {
    createCommitmentList
} from "./commitmentList.js";

import {
    createTextSection
} from "./textSection.js";

import {
    createLinkList
} from "./linkList.js";

import {
    avisoDialog
} from "../services/confirmDialog.js";


let reunionActual =
    null;

let seccionesActuales =
    {};


/* =========================================================
   ETIQUETAS DE ESTADO
   ========================================================= */

const ESTADO_LABEL = {

    pendiente:
        "Pendiente",

    "en-progreso":
        "En progreso",

    completado:
        "Completado"

};


/* =========================================================
   CREAR VISTA DE ARCHIVO
   ========================================================= */

export function createArchiveView() {

    const content =
        document.querySelector(
            "#archive-content"
        );


    const editableContainer =
        document.querySelector(
            "#archive-editable"
        );


    const readonlyLabel =
        document.querySelector(
            "#archive-readonly-label"
        );


    const backBtn =
        document.querySelector(
            "#archive-back"
        );

     const pdfBtn =
        document.querySelector(
             "#archive-export-pdf"
        );


    /* =====================================================
       VALIDAR ELEMENTOS
       ===================================================== */

    if (!content) {

        console.error(
            "No se encontró #archive-content"
        );

    }


    if (!backBtn) {

        console.error(
            "No se encontró #archive-back"
        );

    }


    /* =========================================================
       TÍTULO
       ========================================================= */

    function titulo(
        texto
    ) {

        const h =
            document.createElement(
                "h2"
            );


        h.classList.add(
            "archive__section-title"
        );


        h.textContent =
            texto;


        return h;

    }


    /* =========================================================
       PÁRRAFO
       ========================================================= */

    function parrafo(
        texto
    ) {

        const p =
            document.createElement(
                "p"
            );


        p.classList.add(
            "archive__text"
        );


        p.textContent =
            texto ||
            "—";


        return p;

    }


    /* =========================================================
       LISTA SIMPLE
       ========================================================= */

    function listaSimple(
        items,
        formato
    ) {

        const ul =
            document.createElement(
                "ul"
            );


        ul.classList.add(
            "archive__list"
        );


        if (
            !Array.isArray(
                items
            ) ||
            items.length === 0
        ) {

            ul.appendChild(
                parrafo(
                    "Sin registros."
                )
            );


            return ul;

        }


        items.forEach(
            item => {

                const li =
                    document.createElement(
                        "li"
                    );


                li.textContent =
                    formato(
                        item
                    );


                ul.appendChild(
                    li
                );

            }
        );


        return ul;

    }


    /* =========================================================
       PINTAR DESARROLLO
       ========================================================= */

    function pintarDesarrollo(
        desarrollo,
        objetivos
    ) {

        const cont =
            document.createElement(
                "div"
            );


        desarrollo =
            desarrollo ||
            {};


        objetivos =
            Array.isArray(
                objetivos
            )
                ? objetivos
                : [];


        for (
            const objetivoId in desarrollo
        ) {

            const bloques =
                desarrollo[
                    objetivoId
                ];


            if (
                !Array.isArray(
                    bloques
                )
            ) {

                continue;

            }


            const obj =
                objetivos.find(
                    objetivo =>
                        String(
                            objetivo.id
                        ) ===
                        String(
                            objetivoId
                        )
                );


            if (
                obj
            ) {

                cont.appendChild(
                    titulo(
                        obj.texto
                    )
                );

            }


            bloques.forEach(
                bloque => {

                    if (
                        bloque.tipo ===
                        "subtitulo"
                    ) {

                        const s =
                            document.createElement(
                                "h4"
                            );


                        s.textContent =
                            bloque.texto;


                        cont.appendChild(
                            s
                        );

                    }

                    else if (
                        bloque.tipo ===
                        "punto"
                    ) {

                        const p =
                            document.createElement(
                                "p"
                            );


                        p.textContent =
                            `• ${
                                bloque.texto ||
                                ""
                            } (${
                                bloque.avance ??
                                0
                            }%)`;


                        cont.appendChild(
                            p
                        );

                    }

                    else {

                        cont.appendChild(
                            parrafo(
                                bloque.texto
                            )
                        );

                    }

                }
            );

        }


        /*
         * Si no existe desarrollo,
         * mostrar mensaje.
         */

        if (
            cont.children.length ===
            0
        ) {

            cont.appendChild(
                parrafo(
                    "Sin registros."
                )
            );

        }


        return cont;

    }


    /* =========================================================
       OBTENER REUNIÓN
       ========================================================= */

    async function obtenerReunion(
        reunionId
    ) {

        const response =
            await fetch(
                `${API_URL}/reuniones/${reunionId}`,
                {

                    headers:
                        headerUsuario()

                }
            );


        const data =
            await response.json();


        if (
            !response.ok
        ) {

            throw new Error(
                data.mensaje ||
                data.error ||
                "No fue posible obtener la reunión."
            );

        }


        return data;

    }


    /* =========================================================
       OBTENER SECCIONES
       ========================================================= */

    async function obtenerSecciones(
        reunionId
    ) {

        const response =
            await fetch(
                `${API_URL}/reuniones/${reunionId}/secciones`,
                {

                    headers:
                        headerUsuario()

                }
            );


        const data =
            await response.json();


        if (
            !response.ok
        ) {

            throw new Error(
                data.mensaje ||
                data.error ||
                "No fue posible obtener las secciones."
            );

        }


        return data.secciones ||
            [];

    }


    /* =========================================================
       CONVERTIR SECCIONES A OBJETO
       ========================================================= */

    function construirSecciones(
        secciones
    ) {

        const resultado = {};


        (
            secciones ||
            []
        ).forEach(
            seccion => {

                resultado[
                    seccion.Seccion
                ] =
                    seccion.Contenido;

            }
        );


        return resultado;

    }


    /* =========================================================
       ¿SIGUE EDITABLE?
       ========================================================= */

    /*
     * Una reunión finalizada se puede seguir editando desde
     * aquí mientras dure el día calendario (hora local) en que
     * se dio clic en "Terminar". Después de ese día, vuelve a
     * ser de solo lectura.
     */

    function esEditable(
        reunion
    ) {

        if (
            reunion.Estado !== "Finalizada" ||
            !reunion.FechaFinalizacion
        ) {

            return false;

        }


        const finalizada =
            new Date(
                reunion.FechaFinalizacion
            );

        const hoy =
            new Date();


        return (
            finalizada.toDateString() ===
            hoy.toDateString()
        );

    }


    /* =========================================================
       MONTAR MODO EDITABLE
       ========================================================= */

    async function montarModoEditable(
        reunionId
    ) {

        /*
         * Refrescar caché/localStorage con lo último de la
         * base de datos antes de montar los componentes (los
         * cuales leen de ahí a través de loadData/saveData).
         */

        await cargarSeccionesDesdeBD(
            reunionId
        );


        const claveSeccion =
            (seccion) =>
                `flow.reunion.${reunionId}.${seccion}`;


        const developmentTable =
            createDevelopmentTable({

                container:
                    reiniciarContenedor(
                        "#archive-desarrollo"
                    ),

                storageKey:
                    claveSeccion(
                        "desarrollo"
                    )

            });


        createEditableList({

            container:
                reiniciarContenedor(
                    "#archive-objetivos"
                ),

            itemName:
                "objetivo",

            storageKey:
                claveSeccion(
                    "objetivos"
                ),

            showCheckbox:
                false,

            checkCompletado:
                (id) =>
                    developmentTable.todosLosPuntosCompletados(
                        id
                    ),

            onNavigate:
                (id) => {

                    developmentTable.irAObjetivo(
                        id
                    );

                },

            onChange:
                (objetivos) => {

                    developmentTable.setObjetivos(
                        objetivos
                    );

                }

        });


        createEditableList({

            container:
                reiniciarContenedor(
                    "#archive-asuntos"
                ),

            itemName:
                "asunto",

            storageKey:
                claveSeccion(
                    "asuntos"
                )

        });


        createCommitmentList({

            container:
                reiniciarContenedor(
                    "#archive-compromisos"
                ),

            storageKey:
                claveSeccion(
                    "compromisos"
                ),

            sincronizarTabla: {
                reunionId
            }

        });


        createTextSection({

            container:
                reiniciarContenedor(
                    "#archive-otros"
                ),

            storageKey:
                claveSeccion(
                    "otros"
                ),

            placeholder:
                "Otros asuntos tratados…"

        });


        const competitividadContainer =
            reiniciarContenedor(
                "#archive-competitividad"
            );

        createTextSection({

            container:
                competitividadContainer,

            storageKey:
                claveSeccion(
                    "competitividad"
                ),

            placeholder:
                "Notas sobre competitividad…"

        });

        createLinkList({

            container:
                competitividadContainer,

            storageKey:
                claveSeccion(
                    "enlaces"
                ),

            reunionId

        });


        createTextSection({

            container:
                reiniciarContenedor(
                    "#archive-acuerdos"
                ),

            storageKey:
                claveSeccion(
                    "acuerdos"
                ),

            placeholder:
                "Acuerdos…"

        });


        createTextSection({

            container:
                reiniciarContenedor(
                    "#archive-reflexion"
                ),

            storageKey:
                claveSeccion(
                    "reflexion"
                ),

            placeholder:
                "Reflexión grupal de la reunión…"

        });


        return developmentTable;

    }


    /* =========================================================
       RENDER
       ========================================================= */

    async function render(
        reunionId
    ) {

        try {

            /* =============================================
               VALIDAR ID
               ============================================= */

            const id =
                Number(
                    reunionId
                );


            if (!id) {

                console.error(
                    "ReunionId inválido:",
                    reunionId
                );


                return;

            }


            console.log(
                "ABRIENDO REUNIÓN DESDE MYSQL:",
                id
            );


            /* =============================================
               CARGAR DATOS
               ============================================= */

            const [
                reunionData,
                secciones
            ] =
                await Promise.all(
                    [

                        obtenerReunion(
                            id
                        ),

                        obtenerSecciones(
                            id
                        )

                    ]
                );


            const reunion =
                reunionData.reunion ||
                {};

/* =====================================================
   PARTICIPANTES
   ===================================================== */

reunion.participantes =
    Array.isArray(
        reunionData.participantes
    )
        ? reunionData.participantes
        : [];


const s =
    construirSecciones(
        secciones
    );


reunionActual =
    reunion;


seccionesActuales =
    s;


            console.log(
                "REUNIÓN:",
                reunion
            );


            console.log(
                "SECCIONES:",
                s
            );


            /* =============================================
               ¿SIGUE EDITABLE?
               ============================================= */

            const editable =
                esEditable(
                    reunion
                );


            if (
                readonlyLabel
            ) {

                readonlyLabel.textContent =
                    editable
                        ? "Reunión terminada hoy · aún editable"
                        : "Reunión archivada · solo lectura";

            }


            if (
                editable
            ) {

                if (content) {
                    content.hidden = true;
                }

                if (editableContainer) {
                    editableContainer.hidden = false;
                }


                const developmentTable =
                    await montarModoEditable(
                        id
                    );


                showView(
                    "archivo"
                );


                /*
                 * Los <textarea> del desarrollo calculan su
                 * alto (autoGrow) al montarse, pero en ese
                 * momento la vista todavía está oculta
                 * (view--hidden) y scrollHeight mide 0 — el
                 * texto queda ahí pero visualmente colapsado.
                 * Se recalcula ya con la vista visible.
                 */

                if (
                    developmentTable
                ) {

                    developmentTable.refreshTextAreas();

                }


                return;

            }


            if (content) {
                content.hidden = false;
            }

            if (editableContainer) {
                editableContainer.hidden = true;
            }


            /* =============================================
               LIMPIAR VISTA
               ============================================= */

            content.replaceChildren();


            /* =============================================
               INFORMACIÓN GENERAL
               ============================================= */

            content.appendChild(
                titulo(
                    reunion.Titulo ||
                    "Reunión"
                )
            );


            if (
                reunion.Descripcion
            ) {

                content.appendChild(
                    parrafo(
                        reunion.Descripcion
                    )
                );

            }


            /* =============================================
               OBJETIVOS
               ============================================= */

            content.appendChild(
                titulo(
                    "Objetivos"
                )
            );


            content.appendChild(
                listaSimple(
                    s.objetivos ||
                    [],
                    objetivo =>
                        `${
                            objetivo.done
                                ? "✓"
                                : "○"
                        } ${
                            objetivo.texto ||
                            ""
                        }`
                )
            );


            /* =============================================
               ASUNTOS GENERALES
               ============================================= */

            content.appendChild(
                titulo(
                    "Asuntos generales"
                )
            );


            content.appendChild(
                listaSimple(
                    s.asuntos ||
                    [],
                    asunto =>
                        `${
                            asunto.done
                                ? "✓"
                                : "○"
                        } ${
                            asunto.texto ||
                            ""
                        }`
                )
            );


            /* =============================================
               DESARROLLO
               ============================================= */

            content.appendChild(
                titulo(
                    "Desarrollo"
                )
            );


            content.appendChild(
                pintarDesarrollo(
                    s.desarrollo ||
                    {},
                    s.objetivos ||
                    []
                )
            );


            /* =============================================
               COMPROMISOS
               ============================================= */

            content.appendChild(
                titulo(
                    "Compromisos"
                )
            );


            content.appendChild(
                listaSimple(
                    s.compromisos ||
                    [],
                    compromiso => {

                        const colaboradores =
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


                        const estado =
                            ESTADO_LABEL[
                                compromiso.estado
                            ] ||
                            compromiso.estado ||
                            "—";


                        return (
                            `${colaboradores}` +
                            `${
                                colaboradores
                                    ? " — "
                                    : ""
                            }` +
                            `${compromiso.descripcion || ""}` +
                            ` [${
                                estado
                            }]`
                        );

                    }
                )
            );


            /* =============================================
               OTROS ASUNTOS
               ============================================= */

            content.appendChild(
                titulo(
                    "Otros asuntos"
                )
            );


            content.appendChild(
                parrafo(
                    s.otros
                )
            );


            /* =============================================
               COMPETITIVIDAD
               ============================================= */

            content.appendChild(
                titulo(
                    "Competitividad"
                )
            );


            content.appendChild(
                parrafo(
                    s.competitividad
                )
            );


            /* =============================================
               ACUERDOS
               ============================================= */

            content.appendChild(
                titulo(
                    "Acuerdos"
                )
            );


            content.appendChild(
                parrafo(
                    s.acuerdos
                )
            );


            /* =============================================
               ENLACES
               ============================================= */

            content.appendChild(
                titulo(
                    "Enlaces"
                )
            );


            content.appendChild(
                listaSimple(
                    s.enlaces ||
                    [],
                    enlace =>
                        `${enlace.titulo || ""}: ${
                            enlace.url || ""
                        }`
                )
            );


            /* =============================================
               REFLEXIÓN
               ============================================= */

            content.appendChild(
                titulo(
                    "Reflexión grupal"
                )
            );


            content.appendChild(
                parrafo(
                    s.reflexion
                )
            );


            /* =============================================
               MOSTRAR VISTA
               ============================================= */

            showView(
                "archivo"
            );

        }
        catch (error) {

            console.error(
                "ERROR AL ABRIR REUNIÓN ARCHIVADA:",
                error
            );


            content.replaceChildren();


            content.appendChild(
                parrafo(
                    error.message ||
                    "No fue posible cargar la reunión."
                )
            );


            showView(
                "archivo"
            );

        }

    }


    /* =========================================================
       VOLVER AL HISTORIAL
       ========================================================= */

    if (
        backBtn
    ) {

        backBtn.addEventListener(
            "click",
            () => {

                document.dispatchEvent(
                    new CustomEvent(
                        "flow:volver-historial"
                    )
                );


                showView(
                    "historial"
                );

            }
        );

    }

    if (
    pdfBtn
) {

    pdfBtn.addEventListener(
        "click",
        function () {

            try {

                if (
                    !reunionActual
                ) {

                    avisoDialog(
                        "No hay una reunión cargada."
                    );

                    return;

                }


                exportarReunionPDF(
                    reunionActual,
                    seccionesActuales,
                    reunionActual.participantes ||
                    []
                );

            }
            catch (error) {

                console.error(
                    "ERROR EXPORTANDO PDF:",
                    error
                );


                avisoDialog(
                    error.message ||
                    "No fue posible generar el PDF."
                );

            }

        }
    );

}


    /* =========================================================
       API PÚBLICA
       ========================================================= */

    return {

        render

    };

}