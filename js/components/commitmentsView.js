/* =========================================================
   VISTA GLOBAL DE COMPROMISOS
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    ESTADO_LABEL,
    PRIORIDAD_LABEL
} from "./commitmentList.js";

import {
    capitalizar
} from "../utils/capitalize.js";

import {
    headerUsuario
} from "../services/auth.service.js";

import {
    confirmDialog
} from "../services/confirmDialog.js";


const ESTADOS_ACTIVOS = [
    "pendiente",
    "en-progreso"
];

/*
 * Únicos estados que se pueden asignar manualmente desde esta
 * vista. "vencido" no está aquí porque no es un valor guardado
 * en la base de datos: se calcula solo (ver server.js), así que
 * no tiene sentido poder "elegirlo".
 */
const ESTADOS_EDITABLES = [
    "pendiente",
    "en-progreso",
    "completado"
];


/* =========================================================
   INICIALIZAR VISTA
   ========================================================= */

export function initCommitmentsView() {

    const list =
        document.querySelector(
            ".commitments-view__list"
        );

    const empty =
        document.querySelector(
            ".commitments-view__empty"
        );

    const filtroUsuario =
        document.querySelector(
            "#compromisos-filtro-usuario"
        );

    const filtroEstado =
        document.querySelector(
            "#compromisos-filtro-estado"
        );


    if (!list) {

        console.warn(
            "No se encontró .commitments-view__list"
        );

        return {

            render:
                async () => {}

        };

    }


    let compromisos =
        [];


    /* =====================================================
       FORMATEAR FECHA
       ===================================================== */

    function formatearFecha(
        fecha
    ) {

        if (!fecha) {

            return "-";

        }


        const d =
            new Date(
                fecha
            );


        if (
            Number.isNaN(
                d.getTime()
            )
        ) {

            return "-";

        }


        const dia =
            String(
                d.getDate()
            ).padStart(
                2,
                "0"
            );


        const mes =
            capitalizar(
                d.toLocaleDateString(
                    "es-MX",
                    {
                        month:
                            "short"
                    }
                )
            );


        return (
            `${dia}/${mes}/${d.getFullYear()}`
        );

    }


    /* =====================================================
       FECHA PARA <input type="date">
       ===================================================== */

    function aValorInputFecha(
        fecha
    ) {

        if (!fecha) {

            return "";

        }


        const d =
            new Date(
                fecha
            );


        if (
            Number.isNaN(
                d.getTime()
            )
        ) {

            return "";

        }


        const mes =
            String(
                d.getMonth() + 1
            ).padStart(2, "0");


        const dia =
            String(
                d.getDate()
            ).padStart(2, "0");


        return (
            `${d.getFullYear()}-${mes}-${dia}`
        );

    }


    /* =====================================================
       GUARDAR EDICIÓN (ESTADO / FECHA LÍMITE)
       ===================================================== */

    async function guardarEdicion(
        id,
        cambios
    ) {

        try {

            const response =
                await fetch(
                    `${API_URL}/compromisos/${id}`,
                    {

                        method:
                            "PATCH",

                        headers: {

                            "Content-Type":
                                "application/json",

                            ...headerUsuario()

                        },

                        body:
                            JSON.stringify(
                                cambios
                            )

                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible actualizar el compromiso."
                );

            }


            await render();

        }
        catch (error) {

            console.error(
                "ERROR ACTUALIZANDO COMPROMISO:",
                error
            );

            alert(
                error.message ||
                "No fue posible actualizar el compromiso."
            );

        }

    }


    /* =====================================================
       ELIMINAR COMPROMISO
       ===================================================== */

    async function eliminarCompromiso(
        id
    ) {

        const confirmado =
            await confirmDialog(
                "¿Eliminar este compromiso? Esta acción no se puede deshacer.",
                { danger: true }
            );

        if (!confirmado) {

            return;

        }


        try {

            const response =
                await fetch(
                    `${API_URL}/compromisos/${id}`,
                    {
                        method:
                            "DELETE",

                        headers:
                            headerUsuario()
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible eliminar el compromiso."
                );

            }


            await render();

        }
        catch (error) {

            console.error(
                "ERROR ELIMINANDO COMPROMISO:",
                error
            );

            alert(
                error.message ||
                "No fue posible eliminar el compromiso."
            );

        }

    }


    /* =====================================================
       CARGAR COMPROMISOS DESDE LA API
       ===================================================== */

    async function cargarCompromisos() {

        try {

            const response =
                await fetch(
                    `${API_URL}/compromisos`,
                    {
                        headers:
                            headerUsuario()
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible obtener los compromisos."
                );

            }


            compromisos =
                data.compromisos ||
                [];

        }
        catch (error) {

            console.error(
                "ERROR OBTENIENDO COMPROMISOS:",
                error
            );

            compromisos =
                [];

        }

    }


    /* =====================================================
       POBLAR FILTRO DE USUARIOS
       ===================================================== */

    function poblarFiltroUsuarios() {

        if (!filtroUsuario) {

            return;

        }


        const valorActual =
            filtroUsuario.value;


        const usuarios =
            [...new Set(
                compromisos
                    .map(c => c.usuarioAsignadoNombre)
                    .filter(Boolean)
            )].sort(
                (a, b) =>
                    a.localeCompare(b)
            );


        filtroUsuario.innerHTML = `
            <option value="">
                Todos los usuarios
            </option>
        `;


        usuarios.forEach(
            (nombre) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    nombre;


                option.textContent =
                    nombre;


                filtroUsuario.appendChild(
                    option
                );

            }
        );


        if (
            usuarios.includes(
                valorActual
            )
        ) {

            filtroUsuario.value =
                valorActual;

        }

    }


    /* =====================================================
       CREAR TARJETA
       ===================================================== */

    function crearTarjeta(
        data
    ) {

        const card =
            document.createElement(
                "li"
            );

        card.classList.add(
            "commitment-card"
        );

        card.classList.add(
            `commitment-card--${data.prioridad}`
        );


        const header =
            document.createElement(
                "div"
            );

        header.classList.add(
            "commitment-card__header"
        );


        const title =
            document.createElement(
                "span"
            );

        title.classList.add(
            "commitment-card__title"
        );

        title.textContent =
            data.descripcion;


        const badge =
            document.createElement(
                "span"
            );

        badge.classList.add(
            "commitment-card__badge"
        );

        badge.classList.add(
            `commitment-card__badge--${data.estado}`
        );

        badge.textContent =
            ESTADO_LABEL[data.estado] ||
            data.estado;


        const actions =
            document.createElement("div");

        actions.classList.add(
            "commitment-card__actions"
        );

        actions.append(
            badge
        );


        const deleteBtn =
            document.createElement("button");

        deleteBtn.type =
            "button";

        deleteBtn.classList.add(
            "commitment-card__delete"
        );

        deleteBtn.textContent =
            "✕";

        deleteBtn.setAttribute(
            "aria-label",
            "Eliminar compromiso"
        );

        deleteBtn.dataset.id =
            data.id;

        actions.append(
            deleteBtn
        );


        header.append(
            title,
            actions
        );


        const meta =
            document.createElement("div");

        meta.classList.add(
            "commitment-card__meta"
        );

        meta.textContent =
            `${data.usuarioAsignadoNombre || "?"} · ${formatearFecha(data.fechaInicio)} → ${formatearFecha(data.fechaLimite)} · ${PRIORIDAD_LABEL[data.prioridad] || data.prioridad}`;


        const origen =
            document.createElement("div");

        origen.classList.add(
            "commitments-view__origin"
        );

        origen.textContent =
            `${data.reunionTitulo || "Reunión Flow"} · ${formatearFecha(data.reunionFecha)}`;


        /* ---------------------------------------------
           EDICIÓN: ESTADO Y FECHA LÍMITE
           --------------------------------------------- */

        const edicion =
            document.createElement("div");

        edicion.classList.add(
            "commitments-view__edit"
        );


        const campoEstado =
            document.createElement("label");

        campoEstado.classList.add(
            "commitments-view__edit-field"
        );

        campoEstado.textContent =
            "Estado";


        const selectEstado =
            document.createElement("select");

        selectEstado.classList.add(
            "commitments-view__estado-edit"
        );

        selectEstado.dataset.id =
            data.id;


        ESTADOS_EDITABLES.forEach(
            (valor) => {

                const option =
                    document.createElement("option");

                option.value =
                    valor;

                option.textContent =
                    ESTADO_LABEL[valor];

                if (valor === data.estadoReal) {

                    option.selected =
                        true;

                }

                selectEstado.appendChild(
                    option
                );

            }
        );

        campoEstado.appendChild(
            selectEstado
        );


        const campoFecha =
            document.createElement("label");

        campoFecha.classList.add(
            "commitments-view__edit-field"
        );

        campoFecha.textContent =
            "Fecha límite";


        const inputFecha =
            document.createElement("input");

        inputFecha.type =
            "date";

        inputFecha.classList.add(
            "commitments-view__fecha-edit"
        );

        inputFecha.dataset.id =
            data.id;

        inputFecha.value =
            aValorInputFecha(
                data.fechaLimite
            );

        campoFecha.appendChild(
            inputFecha
        );


        edicion.append(
            campoEstado,
            campoFecha
        );


        card.append(
            header,
            meta,
            origen,
            edicion
        );


        if (
            data.estadoReal === "completado" &&
            data.fechaCompletado
        ) {

            const completado =
                document.createElement("div");

            completado.classList.add(
                "commitment-card__completado"
            );

            completado.textContent =
                `Completado: ${formatearFecha(data.fechaCompletado)}`;

            card.append(
                completado
            );

        }


        return card;

    }


    /* =====================================================
       APLICAR FILTROS Y RENDERIZAR
       ===================================================== */

    function aplicarFiltros() {

        const usuario =
            filtroUsuario ?
                filtroUsuario.value :
                "";

        const estado =
            filtroEstado ?
                filtroEstado.value :
                "activos";


        const filtrados =
            compromisos.filter(
                (item) => {

                    if (
                        usuario &&
                        item.usuarioAsignadoNombre !== usuario
                    ) {

                        return false;

                    }


                    if (
                        estado === "activos"
                    ) {

                        return ESTADOS_ACTIVOS.includes(
                            item.estado
                        );

                    }


                    if (
                        estado === "todos"
                    ) {

                        return true;

                    }


                    return (
                        item.estado === estado
                    );

                }
            );


        list.replaceChildren(
            ...filtrados.map(
                crearTarjeta
            )
        );


        if (empty) {

            empty.hidden =
                filtrados.length > 0;

        }

    }


    /* =====================================================
       RENDER COMPLETO (recarga desde la API)
       ===================================================== */

    async function render() {

        await cargarCompromisos();

        poblarFiltroUsuarios();

        aplicarFiltros();

    }


    /* =====================================================
       EVENTOS DE EDICIÓN (ESTADO / FECHA LÍMITE)
       ===================================================== */

    list.addEventListener(
        "change",
        (event) => {

            const esEstado =
                event.target.matches(
                    ".commitments-view__estado-edit"
                );

            const esFecha =
                event.target.matches(
                    ".commitments-view__fecha-edit"
                );


            if (
                !esEstado &&
                !esFecha
            ) {

                return;

            }


            const id =
                event.target.dataset.id;

            const item =
                compromisos.find(
                    (c) =>
                        String(c.id) === String(id)
                );

            if (!item) {

                return;

            }


            /*
             * El backend actualiza ambos campos siempre, así
             * que hay que mandar los dos juntos (el nuevo valor
             * del que cambió, y el que ya tenía el otro) para
             * no borrar el que no se tocó.
             */

            guardarEdicion(
                id,
                {

                    estado:
                        esEstado
                            ? event.target.value
                            : item.estadoReal,

                    fechaLimite:
                        esFecha
                            ? (event.target.value || null)
                            : aValorInputFecha(item.fechaLimite)

                }
            );

        }
    );


    /* =====================================================
       ELIMINAR COMPROMISO (CLIC)
       ===================================================== */

    list.addEventListener(
        "click",
        (event) => {

            const boton =
                event.target.closest(
                    ".commitment-card__delete"
                );

            if (!boton) {

                return;

            }


            eliminarCompromiso(
                boton.dataset.id
            );

        }
    );


    /* =====================================================
       EVENTOS DE FILTROS
       ===================================================== */

    if (filtroUsuario) {

        filtroUsuario.addEventListener(
            "change",
            aplicarFiltros
        );

    }


    if (filtroEstado) {

        filtroEstado.addEventListener(
            "change",
            aplicarFiltros
        );

    }


    return {

        render

    };

}
