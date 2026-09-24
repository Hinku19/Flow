/* =========================================================
   HISTORY VIEW
   ========================================================= */

import {
    capitalizar
} from "../utils/capitalize.js";

import {
    API_URL
} from "./config.js";

import {
    confirmDialog
} from "../services/confirmDialog.js";

import {
    getReunionActivaId
} from "../services/session.js";

import {
    crearGrupoAvatares
} from "../utils/avatarFicha.js";

import {
    esAdmin,
    headerUsuario
} from "../services/auth.service.js";


/* =========================================================
   CREAR VISTA DE HISTORIAL
   ========================================================= */

export function createHistoryView({
    container,
    onOpen
}) {

    const list =
        container.querySelector(
            ".historial__list"
        );


    /* =====================================================
       VALIDAR CONTENEDOR
       ===================================================== */

    if (!list) {

        console.error(
            "No se encontró .historial__list"
        );

        return {

            render:
                () => {}

        };

    }


    /* =========================================================
       FILTROS (SOLO ADMINISTRADORES)
       ========================================================= */

    const filtrosContenedor =
        container.querySelector(
            "#historial-filtros"
        );


    const filtroNombreInput =
        container.querySelector(
            "#historial-filtro-nombre"
        );


    const filtroDepartamentoSelect =
        container.querySelector(
            "#historial-filtro-departamento"
        );


    const filtroAreaSelect =
        container.querySelector(
            "#historial-filtro-area"
        );


    const btnLimpiarFiltrosHistorial =
        container.querySelector(
            "#historial-filtro-limpiar"
        );


    /*
     * Últimas reuniones obtenidas de la API, sin filtrar.
     * Se guardan para poder re-filtrar sin volver a pedirlas
     * al servidor cada vez que cambia un filtro.
     */

    let historialCompleto =
        [];


    let programadasCompleto =
        [];


    /*
     * Claves "YYYY-MM" de los meses que el usuario dejó
     * expandidos, para que no se vuelvan a cerrar solos cada
     * vez que se repinta la lista (filtro, borrar, etc.).
     */

    const mesesAbiertosProgramadas =
        new Set();


    const mesesAbiertosHistorial =
        new Set();


    /* =========================================================
       QUITAR ACENTOS (BÚSQUEDA MÁS TOLERANTE)
       ========================================================= */

    function normalizarTexto(
        texto
    ) {

        return String(
            texto ||
            ""
        )
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toLowerCase()
            .trim();

    }


    /* =========================================================
       ¿LA REUNIÓN CUMPLE LOS FILTROS ACTUALES?
       ========================================================= */

    function cumpleFiltros(
        reunion
    ) {

        if (!filtrosContenedor) {

            return true;

        }


        const departamentoId =
            filtroDepartamentoSelect
                ? filtroDepartamentoSelect.value
                : "";


        const areaId =
            filtroAreaSelect
                ? filtroAreaSelect.value
                : "";


        const nombreBuscado =
            filtroNombreInput
                ? normalizarTexto(
                    filtroNombreInput.value
                )
                : "";


        if (
            departamentoId &&
            Number(
                reunion.DepartamentoId
            ) !==
            Number(
                departamentoId
            )
        ) {

            return false;

        }


        if (
            areaId &&
            Number(
                reunion.AreaId
            ) !==
            Number(
                areaId
            )
        ) {

            return false;

        }


        if (nombreBuscado) {

            const participantes =
                Array.isArray(
                    reunion.Participantes
                )
                    ? reunion.Participantes
                    : [];


            const candidatos =
                [
                    reunion.Titulo,
                    reunion.CreadorNombre,
                    ...participantes.map(
                        participante =>
                            participante.nombre
                    )
                ];


            const coincide =
                candidatos.some(
                    candidato =>
                        normalizarTexto(
                            candidato
                        ).includes(
                            nombreBuscado
                        )
                );


            if (!coincide) {

                return false;

            }

        }


        return true;

    }


    /* =========================================================
       CARGAR DEPARTAMENTOS DEL FILTRO
       ========================================================= */

    async function cargarDepartamentosFiltro() {

        if (!filtroDepartamentoSelect) {
            return;
        }


        try {

            const response =
                await fetch(
                    `${API_URL}/subsidiaries`
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible cargar los departamentos."
                );

            }


            filtroDepartamentoSelect.innerHTML = `
                <option value="">
                    Todos los departamentos
                </option>
            `;


            (data.datos || []).forEach(
                departamento => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        departamento.SubsidiaryId;


                    option.textContent =
                        departamento.SubsidiaryName;


                    filtroDepartamentoSelect.appendChild(
                        option
                    );

                }
            );

        }
        catch (error) {

            console.error(
                "ERROR CARGANDO DEPARTAMENTOS DEL FILTRO:",
                error
            );

        }

    }


    /* =========================================================
       CARGAR ÁREAS DEL FILTRO
       ========================================================= */

    async function cargarAreasFiltro(
        subsidiaryId
    ) {

        if (!filtroAreaSelect) {
            return;
        }


        if (!subsidiaryId) {

            filtroAreaSelect.innerHTML = `
                <option value="">
                    Todas las áreas
                </option>
            `;


            filtroAreaSelect.disabled =
                true;


            return;

        }


        try {

            filtroAreaSelect.disabled =
                true;


            filtroAreaSelect.innerHTML = `
                <option value="">
                    Cargando áreas...
                </option>
            `;


            const response =
                await fetch(
                    `${API_URL}/areas?subsidiaryId=${encodeURIComponent(
                        subsidiaryId
                    )}`
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible cargar las áreas."
                );

            }


            filtroAreaSelect.innerHTML = `
                <option value="">
                    Todas las áreas
                </option>
            `;


            (data.datos || []).forEach(
                area => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        area.AreaId;


                    option.textContent =
                        area.AreaName;


                    filtroAreaSelect.appendChild(
                        option
                    );

                }
            );


            filtroAreaSelect.disabled =
                (data.datos || []).length === 0;

        }
        catch (error) {

            console.error(
                "ERROR CARGANDO ÁREAS DEL FILTRO:",
                error
            );


            filtroAreaSelect.innerHTML = `
                <option value="">
                    Error al cargar áreas
                </option>
            `;


            filtroAreaSelect.disabled =
                true;

        }

    }


    /* =========================================================
       FORMATEAR FECHA
       ========================================================= */

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


        const anio =
            d.getFullYear();


        return (
            `${dia}/${mes}/${anio}`
        );

    }


    /* =========================================================
       FORMATEAR HORA
       ========================================================= */

    function formatearHora(
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


        return d.toLocaleTimeString(
            "es-MX",
            {
                hour:
                    "numeric",

                minute:
                    "2-digit",

                hour12:
                    true

            }
        );

    }


    /* =========================================================
       OBTENER REUNIONES PROGRAMADAS
       ========================================================= */

    async function obtenerReunionesProgramadas() {

        try {

            const response =
                await fetch(
                    `${API_URL}/reuniones/programadas`,
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
                    "No fue posible obtener las reuniones programadas."
                );

            }


            return (
                data.reuniones ||
                []
            );

        }
        catch (error) {

            console.error(
                "ERROR OBTENIENDO REUNIONES PROGRAMADAS:",
                error
            );


            return [];

        }

    }


    /* =========================================================
       OBTENER HISTORIAL
       ========================================================= */

    async function obtenerHistorial() {

        try {

            const response =
                await fetch(
                    `${API_URL}/reuniones/historial`,
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
                    "No fue posible obtener el historial."
                );

            }


            return (
                data.reuniones ||
                []
            );

        }
        catch (error) {

            console.error(
                "ERROR OBTENIENDO HISTORIAL:",
                error
            );


            return [];

        }

    }


    /* =========================================================
       ELIMINAR REUNIÓN
       ========================================================= */

    async function eliminarReunion(
        reunionId
    ) {

        if (
            reunionId ===
            getReunionActivaId()
        ) {

            alert(
                "No puedes eliminar la reunión que está en curso."
            );

            return;

        }


        const confirmado =
            await confirmDialog(
                "¿Eliminar esta reunión? Se borrará junto con sus objetivos, compromisos y participantes. Esta acción no se puede deshacer.",
                { danger: true }
            );

        if (!confirmado) {

            return;

        }


        try {

            const response =
                await fetch(
                    `${API_URL}/reuniones/${reunionId}`,
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
                    "No fue posible eliminar la reunión."
                );

            }


            await render();

        }
        catch (error) {

            console.error(
                "ERROR ELIMINANDO REUNIÓN:",
                error
            );

            alert(
                error.message ||
                "No fue posible eliminar la reunión."
            );

        }

    }


    /* =========================================================
       BOTÓN ELIMINAR
       ========================================================= */

    function crearBotonEliminar(
        reunionId
    ) {

        const boton =
            document.createElement(
                "button"
            );

        boton.type =
            "button";

        boton.classList.add(
            "history-card__delete"
        );

        boton.dataset.reunionId =
            reunionId;

        boton.setAttribute(
            "aria-label",
            "Eliminar reunión"
        );

        boton.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="4,7 20,7"></polyline>
                <path d="M9 7V4h6v3"></path>
                <path d="M6 7l1 13h10l1-13"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
        `;

        return boton;

    }


    /* =========================================================
       CARD - REUNIÓN PROGRAMADA
       ========================================================= */

    function crearTarjetaProgramada(
        reunion
    ) {

        const card =
            document.createElement(
                "article"
            );


        card.classList.add(
            "history-card",
            "history-card--programada"
        );


        /*
         * ID REAL DE MYSQL
         */

        card.dataset.id =
            reunion.ReunionId;


        /* ---------------------------------------------
           HEADER
           --------------------------------------------- */

        const header =
            document.createElement(
                "div"
            );


        header.classList.add(
            "history-card__header"
        );


        const fecha =
            document.createElement(
                "span"
            );


        fecha.classList.add(
            "history-card__date"
        );


        fecha.textContent =
            formatearFecha(
                reunion.FechaInicio
            );


        const enCurso =
            reunion.Estado === "En curso";


        const badge =
            document.createElement(
                "span"
            );


        badge.classList.add(
            "history-card__badge",
            enCurso
                ? "history-card__badge--en-curso"
                : "history-card__badge--programada"
        );


        badge.textContent =
            enCurso
                ? "En curso"
                : "Programada";


        header.append(
            fecha,
            badge,
            crearBotonEliminar(
                reunion.ReunionId
            )
        );


        /* ---------------------------------------------
           TÍTULO
           --------------------------------------------- */

        const title =
            document.createElement(
                "h3"
            );


        title.classList.add(
            "history-card__title"
        );


        title.textContent =
            reunion.Titulo ||
            "Reunión Flow";


        /* ---------------------------------------------
           HORA
           --------------------------------------------- */

        const hora =
            document.createElement(
                "div"
            );


        hora.classList.add(
            "history-card__time"
        );


        hora.textContent =
            formatearHora(
                reunion.FechaInicio
            );


        /* ---------------------------------------------
           PARTICIPANTES
           --------------------------------------------- */

        const parts =
            document.createElement(
                "div"
            );


        parts.classList.add(
            "history-card__parts"
        );


        const numParticipantes =
            Number(
                reunion.TotalParticipantes
            ) || 0;


        parts.appendChild(
            crearGrupoAvatares(
                reunion.Participantes,
                5,
                "avatar-ficha--sm"
            )
        );


        const partsTexto =
            document.createElement(
                "span"
            );


        partsTexto.textContent =
            `${numParticipantes} participante${
                numParticipantes !== 1
                    ? "s"
                    : ""
            }`;


        parts.appendChild(
            partsTexto
        );


        /* ---------------------------------------------
           ACCIÓN
           --------------------------------------------- */

        const action =
            document.createElement(
                "div"
            );


        action.classList.add(
            "history-card__action"
        );


        action.textContent =
            enCurso
                ? "Clic para continuar →"
                : "Clic para iniciar →";


        /* ---------------------------------------------
           ARMAR CARD
           --------------------------------------------- */

        card.append(
            header,
            title,
            hora,
            parts,
            action
        );


        return card;

    }


    /* =========================================================
       CARD - HISTORIAL
       ========================================================= */

    function crearTarjetaHistorial(
        reunion
    ) {

        const card =
            document.createElement(
                "article"
            );


        card.classList.add(
            "history-card"
        );


        /*
         * IMPORTANTE:
         * usamos ReunionId.
         * Ya no usamos índice de localStorage.
         */

        card.dataset.reunionId =
            reunion.ReunionId;


        /* ---------------------------------------------
           HEADER
           --------------------------------------------- */

        const header =
            document.createElement(
                "div"
            );


        header.classList.add(
            "history-card__header"
        );


        const fecha =
            document.createElement(
                "span"
            );


        fecha.classList.add(
            "history-card__date"
        );


        fecha.textContent =
            formatearFecha(
                reunion.FechaInicio
            );


        /* ---------------------------------------------
           ESTADO
           --------------------------------------------- */

        const badge =
            document.createElement(
                "span"
            );


        badge.classList.add(
            "history-card__badge"
        );


        const totalObjetivos =
            Number(
                reunion.TotalObjetivos
            ) || 0;


        const totalCompromisos =
            Number(
                reunion.TotalCompromisos
            ) || 0;


        const pendientes =
            totalObjetivos +
            totalCompromisos;


        if (
            reunion.Estado ===
            "Finalizada"
        ) {

            badge.classList.add(
                "history-card__badge--cerrada"
            );


            if (
                pendientes === 0
            ) {

                badge.textContent =
                    "Todo cerrado";

            }
            else {

                badge.textContent =
                    `${pendientes} pendientes`;

            }

        }
        else {

            badge.classList.add(
                "history-card__badge--pendiente"
            );


            badge.textContent =
                `${pendientes} pendientes`;

        }


        header.append(
            fecha,
            badge,
            crearBotonEliminar(
                reunion.ReunionId
            )
        );


        /* ---------------------------------------------
           TÍTULO
           --------------------------------------------- */

        const title =
            document.createElement(
                "h3"
            );


        title.classList.add(
            "history-card__title"
        );


        title.textContent =
            reunion.Titulo ||
            "Reunión Flow";


        /* ---------------------------------------------
           PARTICIPANTES
           --------------------------------------------- */

        const parts =
            document.createElement(
                "div"
            );


        parts.classList.add(
            "history-card__parts"
        );


        const totalParticipantes =
            Number(
                reunion.TotalParticipantes
            ) || 0;


        parts.appendChild(
            crearGrupoAvatares(
                reunion.Participantes,
                5,
                "avatar-ficha--sm"
            )
        );


        const partsTexto =
            document.createElement(
                "span"
            );


        partsTexto.textContent =
            `${totalParticipantes} participante${
                totalParticipantes !== 1
                    ? "s"
                    : ""
            }`;


        parts.appendChild(
            partsTexto
        );


        /* ---------------------------------------------
           ESTADÍSTICAS
           --------------------------------------------- */

        const stats =
            document.createElement(
                "div"
            );


        stats.classList.add(
            "history-card__stats"
        );


        const objetivos =
            document.createElement(
                "span"
            );


        objetivos.innerHTML =
            `<b>${totalObjetivos}</b> objetivos`;


        const compromisos =
            document.createElement(
                "span"
            );


        compromisos.innerHTML =
            `<b>${totalCompromisos}</b> compromisos`;


        stats.append(
            objetivos,
            compromisos
        );


        /* ---------------------------------------------
           ARMAR CARD
           --------------------------------------------- */

        card.append(
            header,
            title,
            parts,
            stats
        );


        return card;

    }


    /* =========================================================
       AGRUPAR REUNIONES POR MES
       ---------------------------------------------------------
       Recibe las reuniones ya ordenadas (por fecha) y las junta
       en grupos "YYYY-MM", conservando ese mismo orden entre
       los grupos (el primero que aparece es el primer grupo).
       ========================================================= */

    function agruparPorMes(
        reuniones
    ) {

        const grupos =
            new Map();


        reuniones.forEach(
            reunion => {

                const fecha =
                    new Date(
                        reunion.FechaInicio
                    );


                const fechaValida =
                    !Number.isNaN(
                        fecha.getTime()
                    );


                const clave =
                    fechaValida
                        ? `${fecha.getFullYear()}-${String(
                            fecha.getMonth() + 1
                        ).padStart(2, "0")}`
                        : "sin-fecha";


                if (!grupos.has(clave)) {

                    const etiqueta =
                        fechaValida
                            ? capitalizar(
                                fecha.toLocaleDateString(
                                    "es-MX",
                                    {
                                        month: "long",
                                        year: "numeric"
                                    }
                                )
                            )
                            : "Sin fecha";


                    grupos.set(
                        clave,
                        {
                            clave,
                            etiqueta,
                            reuniones: []
                        }
                    );

                }


                grupos.get(clave).reuniones.push(
                    reunion
                );

            }
        );


        return Array.from(
            grupos.values()
        );

    }


    /* =========================================================
       CREAR SECCIÓN (AGRUPADA POR MES, EN DESPLEGABLES)
       ========================================================= */

    function crearSeccion(
        tituloTexto,
        clase,
        reunionesOrdenadas,
        crearTarjetaFn,
        mesesAbiertos
    ) {

        const section =
            document.createElement(
                "section"
            );


        section.classList.add(
            "history-view__section",
            clase
        );


        /* ---------------------------------------------
           TÍTULO
           --------------------------------------------- */

        const titulo =
            document.createElement(
                "h2"
            );


        titulo.classList.add(
            "history-view__section-title"
        );


        titulo.textContent =
            tituloTexto;


        /* ---------------------------------------------
           GRUPOS POR MES
           --------------------------------------------- */

        const claseTarjetas =
            clase ===
            "history-view__section--programadas"
                ? "history-view__programadas"
                : "history-view__historial";


        const meses =
            agruparPorMes(
                reunionesOrdenadas
            );


        /*
         * La primera vez que se pinta esta sección dejamos
         * abierto el primer mes (el más próximo o el más
         * reciente, según la sección); después de eso se
         * respeta lo que el usuario haya expandido/cerrado.
         */

        if (
            mesesAbiertos.size === 0 &&
            meses.length > 0
        ) {

            mesesAbiertos.add(
                meses[0].clave
            );

        }


        const gruposContainer =
            document.createElement(
                "div"
            );


        gruposContainer.classList.add(
            "history-view__meses"
        );


        meses.forEach(
            grupo => {

                const details =
                    document.createElement(
                        "details"
                    );


                details.classList.add(
                    "history-month"
                );


                details.open =
                    mesesAbiertos.has(
                        grupo.clave
                    );


                details.addEventListener(
                    "toggle",
                    () => {

                        if (details.open) {

                            mesesAbiertos.add(
                                grupo.clave
                            );

                        }
                        else {

                            mesesAbiertos.delete(
                                grupo.clave
                            );

                        }

                    }
                );


                const summary =
                    document.createElement(
                        "summary"
                    );


                summary.classList.add(
                    "history-month__summary"
                );


                const etiqueta =
                    document.createElement(
                        "span"
                    );


                etiqueta.classList.add(
                    "history-month__label"
                );


                etiqueta.textContent =
                    grupo.etiqueta;


                const contador =
                    document.createElement(
                        "span"
                    );


                contador.classList.add(
                    "history-month__count"
                );


                contador.textContent =
                    `${grupo.reuniones.length} reunión${
                        grupo.reuniones.length !== 1
                            ? "es"
                            : ""
                    }`;


                summary.append(
                    etiqueta,
                    contador
                );


                const tarjetasContainer =
                    document.createElement(
                        "div"
                    );


                tarjetasContainer.classList.add(
                    claseTarjetas
                );


                tarjetasContainer.append(
                    ...grupo.reuniones.map(
                        crearTarjetaFn
                    )
                );


                details.append(
                    summary,
                    tarjetasContainer
                );


                gruposContainer.appendChild(
                    details
                );

            }
        );


        section.append(
            titulo,
            gruposContainer
        );


        return section;

    }


    /* =========================================================
       PINTAR TARJETAS (A PARTIR DE LO YA CARGADO)
       ---------------------------------------------------------
       Separado de render() para poder re-filtrar sin volver a
       pedir el historial/programadas al servidor.
       ========================================================= */

    function renderTarjetas() {

        const historial =
            historialCompleto.filter(
                cumpleFiltros
            );


        const programadas =
            programadasCompleto.filter(
                cumpleFiltros
            );


        /* ---------------------------------------------
           LIMPIAR
           --------------------------------------------- */

        list.replaceChildren();


        /* =================================================
           LAYOUT
           ================================================= */

        const layout =
            document.createElement(
                "div"
            );


        layout.classList.add(
            "history-view__layout"
        );


        /* =================================================
           PROGRAMADAS
           ================================================= */

        if (
            programadas.length > 0
        ) {

            const programadasOrdenadas =
                [...programadas].sort(
                    (a, b) =>
                        new Date(
                            a.FechaInicio
                        ) -
                        new Date(
                            b.FechaInicio
                        )
                );


            layout.appendChild(
                crearSeccion(
                    "Próximas reuniones",
                    "history-view__section--programadas",
                    programadasOrdenadas,
                    crearTarjetaProgramada,
                    mesesAbiertosProgramadas
                )
            );

        }


        /* =================================================
           HISTORIAL
           ================================================= */

        if (
            historial.length > 0
        ) {

            const historialOrdenado =
                [...historial].sort(
                    (a, b) =>
                        new Date(
                            b.FechaInicio
                        ) -
                        new Date(
                            a.FechaInicio
                        )
                );


            layout.appendChild(
                crearSeccion(
                    "Historial de reuniones",
                    "history-view__section--historial",
                    historialOrdenado,
                    crearTarjetaHistorial,
                    mesesAbiertosHistorial
                )
            );

        }


        /* =================================================
           INSERTAR
           ================================================= */

        if (
            layout.children.length > 0
        ) {

            list.appendChild(
                layout
            );

        }
        else {

            const empty =
                document.createElement(
                    "p"
                );


            empty.classList.add(
                "historial__empty"
            );


            const hayDatosSinFiltrar =
                historialCompleto.length > 0 ||
                programadasCompleto.length > 0;


            empty.textContent =
                hayDatosSinFiltrar
                    ? "No se encontraron reuniones con esos filtros."
                    : "Aún no hay reuniones guardadas.";


            list.appendChild(
                empty
            );

        }

    }


    /* =========================================================
       OBTENER DATOS Y PINTAR
       ========================================================= */

    async function render() {

        historialCompleto =
            await obtenerHistorial();


        programadasCompleto =
            await obtenerReunionesProgramadas();


        renderTarjetas();

    }


    /* =========================================================
       EVENTOS DE FILTROS (SOLO ADMINISTRADORES)
       ========================================================= */

    if (
        filtrosContenedor &&
        esAdmin()
    ) {

        filtrosContenedor.hidden =
            false;


        cargarDepartamentosFiltro();


        if (filtroNombreInput) {

            filtroNombreInput.addEventListener(
                "input",
                renderTarjetas
            );

        }


        if (filtroDepartamentoSelect) {

            filtroDepartamentoSelect.addEventListener(
                "change",
                () => {

                    cargarAreasFiltro(
                        filtroDepartamentoSelect.value
                    ).then(
                        renderTarjetas
                    );

                }
            );

        }


        if (filtroAreaSelect) {

            filtroAreaSelect.addEventListener(
                "change",
                renderTarjetas
            );

        }


        if (btnLimpiarFiltrosHistorial) {

            btnLimpiarFiltrosHistorial.addEventListener(
                "click",
                () => {

                    if (filtroNombreInput) {

                        filtroNombreInput.value =
                            "";

                    }


                    if (filtroDepartamentoSelect) {

                        filtroDepartamentoSelect.value =
                            "";

                    }


                    cargarAreasFiltro(
                        ""
                    ).then(
                        renderTarjetas
                    );

                }
            );

        }

    }


    /* =========================================================
       CLICK
       ========================================================= */

    list.addEventListener(
        "click",
        (event) => {

            /* ---------------------------------------------
               ELIMINAR
               --------------------------------------------- */

            const botonEliminar =
                event.target.closest(
                    ".history-card__delete"
                );


            if (
                botonEliminar
            ) {

                event.preventDefault();

                event.stopPropagation();


                const id =
                    Number(
                        botonEliminar.dataset.reunionId
                    );


                if (id) {

                    eliminarReunion(
                        id
                    );

                }


                return;

            }


            /* ---------------------------------------------
               REUNIÓN PROGRAMADA
               --------------------------------------------- */

            const programada =
                event.target.closest(
                    ".history-card--programada"
                );


            if (
                programada
            ) {

                const id =
                    Number(
                        programada.dataset.id
                    );


                if (!id) {

                    return;

                }


                document.dispatchEvent(
                    new CustomEvent(
                        "flow:iniciar-reunion",
                        {
                            detail: {
                                id:
                                    id
                            }
                        }
                    )
                );


                return;

            }


            /* ---------------------------------------------
               HISTORIAL
               --------------------------------------------- */

            const card =
                event.target.closest(
                    ".history-card"
                );


            if (!card) {

                return;

            }


            if (
                card.classList.contains(
                    "history-card--programada"
                )
            ) {

                return;

            }


            const reunionId =
                Number(
                    card.dataset.reunionId
                );


            if (!reunionId) {

                return;

            }


            if (
                typeof onOpen ===
                "function"
            ) {

                onOpen(
                    reunionId
                );

            }

        }
    );


    /* =========================================================
       EVENTOS
       ========================================================= */

    document.addEventListener(
        "flow:reunion-programada",
        () => {

            render();

        }
    );


    document.addEventListener(
        "flow:volver-historial",
        () => {

            render();

        }
    );


    /* =========================================================
       API PÚBLICA
       ========================================================= */

    return {

        render

    };

}