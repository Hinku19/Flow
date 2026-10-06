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
    confirmDialog,
    avisoDialog
} from "../services/confirmDialog.js";

import {
    obtenerResponsables,
    nombresResponsables,
    esResponsable,
    mismaArea,
    textoInvolucrados
} from "../utils/responsables.js";

import {
    crearSelectorResponsables
} from "../utils/selectorResponsables.js";

import {
    reagendarDialog,
    crearAvisoReagenda
} from "../services/reagendarDialog.js";


/*
 * "Activos" (filtro por defecto): los que todavía requieren
 * algo, del responsable o del líder.
 */
const ESTADOS_ACTIVOS = [
    "pendiente",
    "vencido",
    "en-revision"
];


/*
 * Estatus en los que el responsable ya lo marcó como completado
 * (con o sin visto bueno todavía).
 */
const ESTADOS_MARCADOS = [
    "en-revision",
    "completado",
    "completado-destiempo"
];


/*
 * Estatus en los que el responsable todavía puede marcar el
 * compromiso como completado.
 */
const ESTADOS_SIN_COMPLETAR = [
    "pendiente",
    "vencido"
];


/*
 * Orden de la lista: de los más recientes a los más viejos, según
 * la fecha de inicio; sin fecha, o con la misma fecha, el más
 * recientemente creado (id mayor) va primero.
 */
function compararMasRecientePrimero(
    a,
    b
) {

    const fechaA =
        Date.parse(a.fechaInicio) || 0;

    const fechaB =
        Date.parse(b.fechaInicio) || 0;

    if (fechaA !== fechaB) {

        return fechaB - fechaA;

    }

    return (
        Number(b.id) -
        Number(a.id)
    );

}


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

    /*
     * El operador solo ve sus propios compromisos: el filtro de
     * usuario se oculta desde el inicio (no solo al terminar de
     * cargar) para que no aparezca ni un instante.
     */
    if (
        filtroUsuario &&
        getUsuarioActual()?.rol === "operador"
    ) {

        const contenedorFiltroUsuario =
            filtroUsuario.closest(
                ".commitments-filter"
            );

        if (contenedorFiltroUsuario) {

            contenedorFiltroUsuario.hidden =
                true;

        }

    }

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
     * Compromisos que el usuario acaba de modificar (completar,
     * visto bueno, deshacer, re-agendar): se siguen mostrando
     * aunque ya no entren en el filtro de estado, hasta que salga
     * del módulo, para que vea el resultado y pueda deshacerlo.
     */
    const idsRecientes =
        new Set();


    const selectorResponsables =
        formNuevo
            ? crearSelectorResponsables(
                formNuevo.querySelector(
                    ".commitment-list__responsables"
                )
            )
            : null;


    const selectorInvolucrados =
        formNuevo
            ? crearSelectorResponsables(
                formNuevo.querySelector(
                    ".commitment-list__involucrados"
                ),
                {
                    etiqueta:
                        "Personas involucradas",
                    singular:
                        "Involucrado",
                    plural:
                        "involucrados",
                    conFiltros:
                        true
                }
            )
            : null;


    /*
     * Solo un responsable del compromiso (cualquiera de ellos,
     * el estado es compartido) o un administrador pueden
     * marcarlo como completado. El líder que no es responsable
     * solo da el visto bueno, una vez que el responsable lo
     * completó (el servidor valida lo mismo).
     */
    function puedeCompletar(data) {

        const usuario =
            getUsuarioActual();

        return (
            usuario?.rol === "administrador" ||
            esResponsable(
                data,
                usuario?.id
            )
        );

    }


    function esLiderOAdmin() {

        const usuario =
            getUsuarioActual();

        return (
            usuario?.rol === "administrador" ||
            usuario?.rol === "lider"
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
       GUARDAR EDICIÓN (COMPLETAR / FECHA LÍMITE)
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


            idsRecientes.add(
                String(id)
            );

            await render({
                conservarRecientes:
                    true
            });

        }
        catch (error) {

            console.error(
                "ERROR ACTUALIZANDO COMPROMISO:",
                error
            );

            avisoDialog(
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


            idsRecientes.add(
                String(id)
            );

            await render({
                conservarRecientes:
                    true
            });

        }
        catch (error) {

            console.error(
                "ERROR APROBANDO COMPROMISO:",
                error
            );

            avisoDialog(
                error.message ||
                "No fue posible aprobar el compromiso."
            );

        }

    }


    /* =====================================================
       ACCIÓN SOBRE UN COMPROMISO (POST)
       ---------------------------------------------------------
       Quitar visto bueno y re-agendar: mismo manejo de errores
       que aprobarCompromiso.
       ===================================================== */

    async function enviarAccion(
        id,
        accion,
        cuerpo,
        mensajeError
    ) {

        try {

            const response =
                await fetch(
                    `${API_URL}/compromisos/${id}/${accion}`,
                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            ...headerUsuario()

                        },

                        body:
                            JSON.stringify(
                                cuerpo || {}
                            )

                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    mensajeError
                );

            }


            idsRecientes.add(
                String(id)
            );

            await render({
                conservarRecientes:
                    true
            });

        }
        catch (error) {

            console.error(
                `ERROR EN ${accion.toUpperCase()} COMPROMISO:`,
                error
            );

            avisoDialog(
                error.message ||
                mensajeError
            );

        }

    }


    /* =====================================================
       DESHACER COMPLETADO / VISTO BUENO
       ===================================================== */

    async function deshacerCompletado(
        id
    ) {

        const confirmado =
            await confirmDialog(
                "¿Deshacer el completado? El compromiso vuelve a quedar pendiente."
            );

        if (!confirmado) {

            return;

        }


        guardarEdicion(
            id,
            {

                estado:
                    "pendiente"

            }
        );

    }


    async function deshacerVistoBueno(
        id
    ) {

        const confirmado =
            await confirmDialog(
                "¿Quitar el visto bueno? El compromiso vuelve a quedar en espera de visto bueno."
            );

        if (!confirmado) {

            return;

        }


        enviarAccion(
            id,
            "quitar-visto-bueno",
            null,
            "No fue posible quitar el visto bueno."
        );

    }


    /* =====================================================
       RE-AGENDAR (SOLO LÍDER / ADMINISTRADOR)
       ===================================================== */

    async function reagendarCompromiso(
        id
    ) {

        const item =
            compromisos.find(
                (c) =>
                    String(c.id) === String(id)
            );

        if (!item) {

            return;

        }


        const resultado =
            await reagendarDialog(
                item
            );

        if (!resultado) {

            return;

        }


        enviarAccion(
            id,
            "reagendar",
            resultado,
            "No fue posible re-agendar el compromiso."
        );

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

            avisoDialog(
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

            avisoDialog(mensaje);

            return;

        }

        errorNuevo.hidden =
            !mensaje;

        errorNuevo.textContent =
            mensaje || "";

    }


    async function poblarResponsables() {

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


            const activos =
                (data.usuarios || [])
                    .filter(
                        (usuario) =>
                            Number(usuario.activo) === 1
                    )
                    .sort(
                        (a, b) =>
                            a.nombre.localeCompare(b.nombre)
                    );


            /* responsables: solo del mismo departamento y área */
            selectorResponsables.setUsuarios(
                activos.filter(
                    (usuario) =>
                        mismaArea(
                            usuario,
                            usuarioActual
                        )
                )
            );

            /* involucrados: cualquier persona de cualquier departamento */
            selectorInvolucrados.setUsuarios(
                activos
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

        selectorResponsables.limpiar();

        selectorInvolucrados.limpiar();

        formNuevo.elements.fechaInicio.value =
            fechaHoyInput();

        mostrarErrorNuevo("");

        dialogNuevo.showModal();

        await poblarResponsables();

    }


    async function crearCompromiso() {

        const campos =
            formNuevo.elements;

        const responsables =
            selectorResponsables.getSeleccionados();

        if (
            responsables.length === 0 ||
            !campos.descripcion.value.trim() ||
            !campos.fechaInicio.value ||
            !campos.fechaLimite.value
        ) {

            mostrarErrorNuevo(
                "Elige al menos un responsable y completa descripción y fechas."
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

                                responsablesIds:
                                    responsables.map(
                                        (responsable) => responsable.id
                                    ),

                                personasInvolucradasIds:
                                    selectorInvolucrados
                                        .getSeleccionados()
                                        .map(
                                            (persona) => persona.id
                                        ),

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
                (data.compromisos || [])
                    .sort(
                        compararMasRecientePrimero
                    );

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

    /*
     * Ids de los usuarios activos: el filtro solo ofrece
     * usuarios activos (aunque uno inactivo siga como
     * responsable de algún compromiso).
     */
    async function cargarUsuariosActivosIds() {

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

            return new Set(
                (data.usuarios || [])
                    .filter(
                        (usuario) =>
                            Number(usuario.activo) === 1
                    )
                    .map(
                        (usuario) =>
                            Number(usuario.id)
                    )
            );

        }
        catch (error) {

            console.error(
                "ERROR CARGANDO USUARIOS PARA EL FILTRO:",
                error
            );

            return null;

        }

    }


    /*
     * El operador solo ve sus propios compromisos (lo filtra
     * el servidor), así que para él no hay filtro de usuarios.
     */
    async function poblarFiltroUsuarios() {

        if (!filtroUsuario) {

            return;

        }


        const contenedorFiltro =
            filtroUsuario.closest(
                ".commitments-filter"
            );

        const esOperador =
            getUsuarioActual()?.rol === "operador";

        if (contenedorFiltro) {

            contenedorFiltro.hidden =
                esOperador;

        }

        if (esOperador) {

            filtroUsuario.value =
                "";

            return;

        }


        const valorActual =
            filtroUsuario.value;

        const activosIds =
            await cargarUsuariosActivosIds();


        const porId =
            new Map();

        compromisos
            .flatMap(
                (c) =>
                    obtenerResponsables(c)
            )
            .filter(
                (responsable) =>
                    responsable.id &&
                    responsable.nombre &&
                    (
                        !activosIds ||
                        activosIds.has(
                            Number(responsable.id)
                        )
                    )
            )
            .forEach(
                (responsable) =>
                    porId.set(
                        String(responsable.id),
                        responsable.nombre
                    )
            );


        const usuarios =
            [...porId.entries()]
                .sort(
                    (a, b) =>
                        a[1].localeCompare(b[1])
                );


        filtroUsuario.innerHTML = `
            <option value="">
                Todos los usuarios
            </option>
        `;


        usuarios.forEach(
            ([id, nombre]) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    id;


                option.textContent =
                    nombre;


                filtroUsuario.appendChild(
                    option
                );

            }
        );


        filtroUsuario.value =
            porId.has(valorActual)
                ? valorActual
                : "";

    }


    /* =====================================================
       BOTÓN SECUNDARIO DE LA TARJETA
       (re-agendar, deshacer completado / visto bueno)
       ===================================================== */

    function crearBotonSecundario(
        id,
        accion,
        texto
    ) {

        const boton =
            document.createElement("button");

        boton.type =
            "button";

        boton.classList.add(
            "commitment-card__secundario"
        );

        boton.dataset.id =
            id;

        boton.dataset.accion =
            accion;

        boton.textContent =
            texto;

        return boton;

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
            `${nombresResponsables(data) || "?"} · ${formatearFecha(data.fechaInicio)} → ${formatearFecha(data.fechaLimite)} · ${PRIORIDAD_LABEL[data.prioridad] || data.prioridad}`;


        const origen =
            document.createElement("div");

        origen.classList.add(
            "commitments-view__origin"
        );

        origen.textContent =
            data.reunionId
                ? `${data.reunionTitulo || "Reunión Flow"} · ${formatearFecha(data.reunionFecha)}`
                : data.origenReunionId
                    ? `Creado desde Actividades · ${data.origenReunionTitulo || "Reunión"}`
                    : "Creado desde Compromisos";


        /* ---------------------------------------------
           EDICIÓN: FECHA LÍMITE
           (el estatus solo cambia con "Marcar como
           completado" y "Dar visto bueno")
           --------------------------------------------- */

        const edicion =
            document.createElement("div");

        edicion.classList.add(
            "commitments-view__edit"
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


        /*
         * Una vez establecida, la fecha límite ya no se
         * puede cambiar.
         */

        inputFecha.disabled =
            Boolean(
                inputFecha.value
            );

        campoFecha.appendChild(
            inputFecha
        );


        edicion.append(
            campoFecha
        );


        card.append(
            header,
            meta
        );


        if (
            textoInvolucrados(
                data
            )
        ) {

            const involucrados =
                document.createElement("div");

            involucrados.classList.add(
                "commitment-card__involucrados"
            );

            involucrados.textContent =
                `Involucrados: ${textoInvolucrados(data)}`;

            card.append(
                involucrados
            );

        }


        const avisoReagenda =
            crearAvisoReagenda(
                data
            );

        if (avisoReagenda) {

            card.append(
                avisoReagenda
            );

        }


        card.append(
            origen,
            edicion
        );


        /* botones de acción, en una sola fila */
        const botones =
            document.createElement("div");

        botones.classList.add(
            "commitment-card__botones"
        );


        if (
            puedeCompletar(data) &&
            ESTADOS_SIN_COMPLETAR.includes(
                data.estado
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

            botones.append(
                completarBtn
            );

        }


        /*
         * Dos fechas: cuando el responsable lo marcó como
         * completado y cuando el líder dio el visto bueno.
         */

        if (
            ESTADOS_MARCADOS.includes(
                data.estado
            ) &&
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


        if (
            data.aprobado &&
            data.fechaAprobacion
        ) {

            const vistoBueno =
                document.createElement("div");

            vistoBueno.classList.add(
                "commitment-card__completado"
            );

            vistoBueno.textContent =
                `Visto bueno: ${formatearFecha(data.fechaAprobacion)}`;

            card.append(
                vistoBueno
            );

        }


        const usuario =
            getUsuarioActual();

        const puedeAprobar =
            data.estado === "en-revision" &&
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

            botones.append(
                aprobarBtn
            );

        }


        /*
         * Deshacer el completado: el responsable (o
         * administrador), mientras no tenga visto bueno; si ya lo
         * tiene, solo si además es líder (o administrador), que es
         * quien puede quitar ese visto bueno.
         */
        if (
            puedeCompletar(data) &&
            ESTADOS_MARCADOS.includes(
                data.estado
            ) &&
            (
                !data.aprobado ||
                esLiderOAdmin()
            )
        ) {

            botones.append(
                crearBotonSecundario(
                    data.id,
                    "deshacer-completado",
                    "↶ Deshacer completado"
                )
            );

        }


        if (
            data.aprobado &&
            esLiderOAdmin()
        ) {

            botones.append(
                crearBotonSecundario(
                    data.id,
                    "deshacer-visto-bueno",
                    "↶ Deshacer visto bueno"
                )
            );

        }


        if (
            esLiderOAdmin() &&
            ESTADOS_SIN_COMPLETAR.includes(
                data.estado
            )
        ) {

            const reagendarBtn =
                crearBotonSecundario(
                    data.id,
                    "reagendar",
                    "Re-agendar"
                );

            reagendarBtn.classList.add(
                "commitment-card__reagendar"
            );

            botones.append(
                reagendarBtn
            );

        }


        if (botones.children.length > 0) {

            card.append(
                botones
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
                        !obtenerResponsables(item).some(
                            (responsable) => String(responsable.id) === usuario
                        )
                    ) {

                        return false;

                    }


                    if (
                        idsRecientes.has(
                            String(item.id)
                        )
                    ) {

                        return true;

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

    /*
     * Al entrar al módulo (llamada desde main.js, sin opciones) se
     * olvidan los compromisos recién modificados; las recargas
     * internas tras una acción los conservan.
     */
    async function render(
        {
            conservarRecientes = false
        } = {}
    ) {

        if (!conservarRecientes) {

            idsRecientes.clear();

        }


        if (botonNuevo) {

            botonNuevo.hidden =
                !puedeCrear();

        }

        await cargarCompromisos();

        await poblarFiltroUsuarios();

        aplicarFiltros();

    }


    /* =====================================================
       EVENTOS DE EDICIÓN (FECHA LÍMITE)
       ===================================================== */

    list.addEventListener(
        "change",
        (event) => {

            if (
                !event.target.matches(
                    ".commitments-view__fecha-edit"
                )
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
             * Sin `estado`, el backend conserva el estatus
             * actual y solo fija la fecha límite.
             */

            guardarEdicion(
                id,
                {

                    fechaLimite:
                        event.target.value || null

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
       RE-AGENDAR / DESHACER (CLIC)
       ===================================================== */

    const ACCIONES = {

        "reagendar":
            reagendarCompromiso,

        "deshacer-completado":
            deshacerCompletado,

        "deshacer-visto-bueno":
            deshacerVistoBueno

    };


    list.addEventListener(
        "click",
        (event) => {

            const boton =
                event.target.closest(
                    "[data-accion]"
                );

            if (
                !boton ||
                !ACCIONES[boton.dataset.accion]
            ) {

                return;

            }


            ACCIONES[boton.dataset.accion](
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
