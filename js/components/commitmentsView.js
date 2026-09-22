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
    getUsuarioActual,
    headerUsuario
} from "../services/auth.service.js";

import {
    confirmDialog
} from "../services/confirmDialog.js";


const ESTADOS_ACTIVOS = [
    "pendiente",
    "en-progreso",
    "en-revision"
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

    const botonNuevo =
        document.querySelector(
            "#compromisos-nuevo"
        );

    const dialogNuevo =
        document.querySelector(
            "#compromisos-dialog"
        );

    const formNuevo =
        document.querySelector(
            "#compromisos-form"
        );

    const errorNuevo =
        document.querySelector(
            "#compromisos-form-error"
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


    /*
     * "en-revision" no es una opción del <select> (no es algo
     * que se pueda "elegir": es "completado" sin visto bueno
     * todavía). Para el <select> y para reenviar el estado sin
     * tocarlo (edición de solo la fecha límite), se trata igual
     * que "completado".
     */
    function estadoEditable(estadoReal) {

        return estadoReal === "en-revision"
            ? "completado"
            : estadoReal;

    }


    /*
     * Solo el responsable del compromiso o un líder pueden
     * marcarlo como completado (el servidor valida además que
     * el líder sea de la misma área).
     */
    function puedeCompletar(data) {

        const usuario =
            getUsuarioActual();

        return (
            usuario?.rol === "lider" ||
            Number(usuario?.id) === Number(data.usuarioAsignadoId)
        );

    }


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
       DAR VISTO BUENO (SOLO LÍDER / ADMINISTRADOR)
       ===================================================== */

    async function aprobarCompromiso(
        id
    ) {

        try {

            const response =
                await fetch(
                    `${API_URL}/compromisos/${id}/aprobar`,
                    {

                        method:
                            "POST",

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
                    "No fue posible aprobar el compromiso."
                );

            }


            await render();

        }
        catch (error) {

            console.error(
                "ERROR APROBANDO COMPROMISO:",
                error
            );

            alert(
                error.message ||
                "No fue posible aprobar el compromiso."
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
       CREAR COMPROMISO (SOLO ADMINISTRADOR / LÍDER)
       ---------------------------------------------------------
       Compromiso independiente: no pertenece a ninguna
       reunión. El líder solo puede asignarlo a usuarios de su
       misma área (el servidor lo valida también).
       ===================================================== */

    function puedeCrear() {

        const usuario =
            getUsuarioActual();

        return (
            usuario?.rol === "administrador" ||
            usuario?.rol === "lider"
        );

    }


    function fechaHoyInput() {

        return aValorInputFecha(
            new Date()
        );

    }


    function mostrarErrorNuevo(
        mensaje
    ) {

        if (!errorNuevo) {

            alert(mensaje);

            return;

        }

        errorNuevo.hidden =
            !mensaje;

        errorNuevo.textContent =
            mensaje || "";

    }


    async function poblarResponsables() {

        const select =
            formNuevo.elements.usuarioAsignadoId;

        const usuarioActual =
            getUsuarioActual();

        try {

            const response =
                await fetch(
                    `${API_URL}/usuarios`
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible cargar los usuarios."
                );

            }


            const usuarios =
                (data.usuarios || [])
                    .filter(
                        (usuario) =>
                            Number(usuario.activo) === 1 &&
                            (
                                usuarioActual?.rol === "administrador" ||
                                usuario.area === usuarioActual?.area
                            )
                    )
                    .sort(
                        (a, b) =>
                            a.nombre.localeCompare(b.nombre)
                    );


            select.innerHTML =
                `<option value="">Seleccione un responsable</option>`;

            usuarios.forEach(
                (usuario) => {

                    const option =
                        document.createElement("option");

                    option.value =
                        usuario.id;

                    option.textContent =
                        usuario.nombre;

                    select.appendChild(
                        option
                    );

                }
            );

        }
        catch (error) {

            console.error(
                "ERROR CARGANDO USUARIOS PARA COMPROMISOS:",
                error
            );

            mostrarErrorNuevo(
                error.message
            );

        }

    }


    async function abrirFormularioNuevo() {

        formNuevo.reset();

        formNuevo.elements.fechaInicio.value =
            fechaHoyInput();

        mostrarErrorNuevo("");

        dialogNuevo.showModal();

        await poblarResponsables();

    }


    async function crearCompromiso() {

        const campos =
            formNuevo.elements;

        if (
            !campos.usuarioAsignadoId.value ||
            !campos.descripcion.value.trim() ||
            !campos.fechaInicio.value ||
            !campos.fechaLimite.value
        ) {

            mostrarErrorNuevo(
                "Completa responsable, descripción y fechas."
            );

            return;

        }

        if (campos.fechaLimite.value < campos.fechaInicio.value) {

            mostrarErrorNuevo(
                "La fecha límite no puede ser anterior a la fecha de inicio."
            );

            return;

        }


        const botonGuardar =
            formNuevo.querySelector(
                ".commitment-list__save"
            );

        try {

            botonGuardar.disabled =
                true;

            const response =
                await fetch(
                    `${API_URL}/compromisos`,
                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            ...headerUsuario()

                        },

                        body:
                            JSON.stringify({

                                usuarioAsignadoId:
                                    Number(campos.usuarioAsignadoId.value),

                                descripcion:
                                    campos.descripcion.value.trim(),

                                prioridad:
                                    campos.prioridad.value,

                                fechaInicio:
                                    campos.fechaInicio.value,

                                fechaLimite:
                                    campos.fechaLimite.value

                            })

                    }
                );

            const data =
                await response.json();

            if (!response.ok || !data.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible crear el compromiso."
                );

            }

            dialogNuevo.close();

            await render();

        }
        catch (error) {

            console.error(
                "ERROR CREANDO COMPROMISO:",
                error
            );

            mostrarErrorNuevo(
                error.message ||
                "No fue posible crear el compromiso."
            );

        }
        finally {

            botonGuardar.disabled =
                false;

        }

    }


    if (
        botonNuevo &&
        dialogNuevo &&
        formNuevo
    ) {

        botonNuevo.addEventListener(
            "click",
            abrirFormularioNuevo
        );

        formNuevo.addEventListener(
            "submit",
            (event) => {

                event.preventDefault();

                crearCompromiso();

            }
        );

        document
            .querySelector("#compromisos-cancelar")
            ?.addEventListener(
                "click",
                () => dialogNuevo.close()
            );

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
            data.reunionId
                ? `${data.reunionTitulo || "Reunión Flow"} · ${formatearFecha(data.reunionFecha)}`
                : "Creado desde Compromisos";


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

                if (
                    valor === "completado" &&
                    data.estadoReal !== "completado" &&
                    data.estadoReal !== "en-revision" &&
                    !puedeCompletar(data)
                ) {

                    option.disabled =
                        true;

                }

                if (valor === estadoEditable(data.estadoReal)) {

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
            puedeCompletar(data) &&
            (
                data.estadoReal === "pendiente" ||
                data.estadoReal === "en-progreso"
            )
        ) {

            const completarBtn =
                document.createElement("button");

            completarBtn.type =
                "button";

            completarBtn.classList.add(
                "commitment-card__complete-vencido"
            );

            completarBtn.textContent =
                "Marcar como completado";

            completarBtn.dataset.id =
                data.id;

            card.append(
                completarBtn
            );

        }


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


        const usuario =
            getUsuarioActual();

        const puedeAprobar =
            data.estadoReal === "en-revision" &&
            (
                usuario?.rol === "administrador" ||
                usuario?.rol === "lider"
            );

        if (puedeAprobar) {

            const aprobarBtn =
                document.createElement("button");

            aprobarBtn.type =
                "button";

            aprobarBtn.classList.add(
                "commitments-view__aprobar"
            );

            aprobarBtn.textContent =
                "Dar visto bueno";

            aprobarBtn.dataset.id =
                data.id;

            card.append(
                aprobarBtn
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

        if (botonNuevo) {

            botonNuevo.hidden =
                !puedeCrear();

        }

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
                            : estadoEditable(item.estadoReal),

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
       MARCAR COMO COMPLETADO (CLIC)
       ===================================================== */

    list.addEventListener(
        "click",
        (event) => {

            const boton =
                event.target.closest(
                    ".commitment-card__complete-vencido"
                );

            if (!boton) {

                return;

            }


            const item =
                compromisos.find(
                    (c) =>
                        String(c.id) === String(boton.dataset.id)
                );

            if (!item) {

                return;

            }


            guardarEdicion(
                boton.dataset.id,
                {

                    estado:
                        "completado",

                    fechaLimite:
                        aValorInputFecha(item.fechaLimite)

                }
            );

        }
    );


    /* =====================================================
       DAR VISTO BUENO (CLIC)
       ===================================================== */

    list.addEventListener(
        "click",
        (event) => {

            const boton =
                event.target.closest(
                    ".commitments-view__aprobar"
                );

            if (!boton) {

                return;

            }


            aprobarCompromiso(
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
