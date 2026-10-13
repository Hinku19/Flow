/* =========================================================
   MENÚ PRINCIPAL (DASHBOARD)
   ---------------------------------------------------------
   Llena las partes dinámicas del menú: la fecha, la tarjeta
   "Próxima reunión" y "Tus pendientes". La navegación a los
   módulos la siguen haciendo los botones con data-view
   (main.js); aquí solo se reutilizan los mismos caminos que
   ya existen:

   - Programar reunión → el mismo diálogo que abre el botón
     "+ Programar reunión" de la vista Reuniones.
   - Preparar / Iniciar / Continuar → el evento
     flow:iniciar-reunion, igual que al dar clic en una
     reunión programada del historial.
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    capitalizar
} from "../utils/capitalize.js";

import {
    crearFichaAvatar
} from "../utils/avatarFicha.js";

import {
    getUsuarioActual,
    headerUsuario
} from "../services/auth.service.js";


/* =========================================================
   CONSTANTES
   ========================================================= */

const MAX_PENDIENTES =
    3;

/*
 * El líder ve los pendientes de todo su equipo, así que se
 * le muestran unos cuantos más.
 */
const MAX_PENDIENTES_EQUIPO =
    5;

/*
 * Un compromiso que vence en estos días o menos se marca
 * como "vence pronto" (punto naranja).
 */
const DIAS_VENCE_PRONTO =
    3;

/*
 * Estados de compromiso que cuentan como pendiente, en el
 * orden en que se muestran.
 */
const ORDEN_ESTADO_PENDIENTE = {

    vencido:
        0,

    pendiente:
        1,

    "en-revision":
        2

};

/*
 * Dentro de cada estado, primero lo de mayor prioridad.
 */
const ORDEN_PRIORIDAD = {

    alta:
        0,

    media:
        1,

    baja:
        2

};

const ICONOS_ACCION = {

    /* portapapeles */
    programada:
        "M9 3h6v4H9z M7 5H5v16h14V5h-2 M9 12h6 M9 16h4",

    /* play dentro de un círculo */
    hoy:
        "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M10 8.5l5 3.5l-5 3.5z",

    /* flecha */
    "en-curso":
        "M5 12h14 M13 6l6 6l-6 6"

};

const TEXTOS_ACCION = {

    programada:
        "Preparar reunión",

    hoy:
        "Iniciar reunión",

    "en-curso":
        "Continuar reunión"

};


/* =========================================================
   CREAR MENÚ
   ========================================================= */

export function createHomeMenu({
    onAbrirReunion
} = {}) {

    const vista =
        document.querySelector(
            "#vista-dashboard"
        );

    if (!vista) {

        return {
            render() {}
        };

    }


    const fechaHoy =
        vista.querySelector(
            "#dashboard-fecha"
        );

    const btnProgramar =
        vista.querySelector(
            "#dashboard-btn-programar"
        );

    const tarjetaReunion =
        vista.querySelector(
            "#dashboard-proxima-reunion"
        );

    const etiquetaReunion =
        vista.querySelector(
            "#dashboard-reunion-etiqueta"
        );

    const insigniaReunion =
        vista.querySelector(
            "#dashboard-reunion-insignia"
        );

    const detalleReunion =
        vista.querySelector(
            "#dashboard-reunion-detalle"
        );

    const mesReunion =
        vista.querySelector(
            "#dashboard-reunion-mes"
        );

    const diaReunion =
        vista.querySelector(
            "#dashboard-reunion-dia"
        );

    const tituloReunion =
        vista.querySelector(
            "#dashboard-reunion-titulo"
        );

    const metaReunion =
        vista.querySelector(
            "#dashboard-reunion-meta"
        );

    const vacioReunion =
        vista.querySelector(
            "#dashboard-reunion-vacio"
        );

    const btnAccion =
        vista.querySelector(
            "#dashboard-reunion-accion"
        );

    const iconoAccion =
        vista.querySelector(
            "#dashboard-reunion-accion-icono"
        );

    const textoAccion =
        vista.querySelector(
            "#dashboard-reunion-accion-texto"
        );

    const btnProgramarVacio =
        vista.querySelector(
            "#dashboard-reunion-programar"
        );

    const ultimaJunta =
        vista.querySelector(
            "#dashboard-ultima-junta"
        );

    const ultimaHace =
        vista.querySelector(
            "#dashboard-ultima-hace"
        );

    const ultimaTitulo =
        vista.querySelector(
            "#dashboard-ultima-titulo"
        );

    const ultimaMeta =
        vista.querySelector(
            "#dashboard-ultima-meta"
        );

    const avatarUsuario =
        vista.querySelector(
            "#dashboard-avatar"
        );

    const etiquetaPendientes =
        vista.querySelector(
            "#dashboard-pendientes-etiqueta"
        );

    const listaPendientes =
        vista.querySelector(
            "#dashboard-pendientes"
        );


    /*
     * Reunión que muestra la tarjeta (para el botón
     * principal).
     */
    let reunionMostrada =
        null;

    /*
     * Última junta finalizada (para abrirla al darle clic).
     */
    let ultimaJuntaId =
        null;

    /*
     * Evita que una carga vieja pise a una más reciente si
     * el usuario entra y sale del menú muy rápido.
     */
    let cargaActual =
        0;


    /* =========================================================
       UTILIDADES DE FECHA
       ========================================================= */

    function inicioDelDia(
        fecha
    ) {

        return new Date(
            fecha.getFullYear(),
            fecha.getMonth(),
            fecha.getDate()
        );

    }


    function diasHasta(
        fecha
    ) {

        const diferencia =
            inicioDelDia(
                fecha
            ).getTime() -
            inicioDelDia(
                new Date()
            ).getTime();

        return Math.round(
            diferencia /
            (1000 * 60 * 60 * 24)
        );

    }


    function formatearHora(
        fecha
    ) {

        return fecha.toLocaleTimeString(
            "es-MX",
            {
                hour:
                    "numeric",
                minute:
                    "2-digit"
            }
        );

    }


    function fechaValida(
        valor
    ) {

        if (!valor) {

            return null;

        }

        const fecha =
            new Date(
                valor
            );

        return Number.isNaN(
            fecha.getTime()
        )
            ? null
            : fecha;

    }


    /* =========================================================
       FECHA DE HOY
       ========================================================= */

    function pintarFechaHoy() {

        if (!fechaHoy) {

            return;

        }

        fechaHoy.textContent =
            new Date()
                .toLocaleDateString(
                    "es-MX",
                    {
                        weekday:
                            "long",
                        day:
                            "numeric",
                        month:
                            "long"
                    }
                )
                .replace(
                    ",",
                    ""
                );

    }


    /* =========================================================
       FOTO DE PERFIL
       ---------------------------------------------------------
       urlFoto llega de profileMenu.js al subir o quitar la
       foto (con versión, para que no se quede la vieja en
       caché); null = sin foto, se muestran las iniciales.
       ========================================================= */

    function pintarAvatarUsuario(
        urlFoto
    ) {

        if (!avatarUsuario) {

            return;

        }

        const usuario =
            getUsuarioActual();

        const tieneFoto =
            urlFoto === undefined
                ? Boolean(
                    usuario?.tieneFoto
                )
                : Boolean(
                    urlFoto
                );

        const ficha =
            crearFichaAvatar({
                id:
                    usuario?.id,
                nombre:
                    usuario?.nombre,
                tieneFoto:
                    tieneFoto,
                className:
                    "dashboard__avatar"
            });

        const img =
            ficha.querySelector(
                "img"
            );

        if (img) {

            img.loading =
                "eager";

            if (urlFoto) {

                img.src =
                    urlFoto;

            }

        }

        avatarUsuario.replaceChildren(
            ficha
        );

    }


    /* =========================================================
       PROGRAMAR REUNIÓN
       ---------------------------------------------------------
       Reutiliza el botón de la vista Reuniones, que ya tiene
       conectado el diálogo de programación
       (meetingLifecycle.js).
       ========================================================= */

    function abrirProgramarReunion() {

        document
            .querySelector(
                "#btn-programar-reunion-historial"
            )
            ?.click();

    }


    /* =========================================================
       PRÓXIMA REUNIÓN
       ========================================================= */

    async function obtenerReunionesProgramadas() {

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

        if (!response.ok) {

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


    /*
     * Solo reuniones donde el usuario es creador o
     * participante. Una en curso tiene prioridad; si no, la
     * programada más cercana (el servidor ya las ordena por
     * FechaInicio).
     */
    function elegirReunion(
        reuniones,
        usuarioId
    ) {

        const propias =
            reuniones.filter(
                (reunion) =>
                    Number(reunion.UsuarioCreadorId) === usuarioId ||
                    (
                        reunion.Participantes ||
                        []
                    ).some(
                        (participante) =>
                            Number(participante.id) === usuarioId
                    )
            );

        return (
            propias.find(
                (reunion) =>
                    reunion.Estado === "En curso"
            ) ||
            propias.find(
                (reunion) =>
                    reunion.Estado === "Programada"
            ) ||
            null
        );

    }


    function textoInsignia(
        dias
    ) {

        if (dias < 0) {

            return "Atrasada";

        }

        if (dias === 0) {

            return "Hoy";

        }

        if (dias === 1) {

            return "Mañana";

        }

        return `En ${dias} días`;

    }


    function textoParticipantes(
        reunion
    ) {

        const total =
            Number(
                reunion.TotalParticipantes
            ) || 0;

        return `${total} participante${
            total !== 1
                ? "s"
                : ""
        }`;

    }


    function pintarReunionVacia() {

        reunionMostrada =
            null;

        tarjetaReunion.dataset.estado =
            "vacio";

        etiquetaReunion.textContent =
            "Próxima reunión";

        insigniaReunion.hidden =
            true;

        detalleReunion.hidden =
            true;

        btnAccion.hidden =
            true;

        vacioReunion.hidden =
            false;

        btnProgramarVacio.hidden =
            false;

    }


    function pintarReunion(
        reunion
    ) {

        const fecha =
            fechaValida(
                reunion.FechaInicio
            ) ||
            new Date();

        const enCurso =
            reunion.Estado === "En curso";

        const dias =
            diasHasta(
                fecha
            );

        const estado =
            enCurso
                ? "en-curso"
                : dias <= 0
                    ? "hoy"
                    : "programada";


        reunionMostrada =
            reunion;

        tarjetaReunion.dataset.estado =
            estado;

        etiquetaReunion.textContent =
            enCurso
                ? "Reunión en curso"
                : "Próxima reunión";


        insigniaReunion.hidden =
            false;

        insigniaReunion.textContent =
            enCurso
                ? "En curso"
                : textoInsignia(
                    dias
                );

        insigniaReunion.classList.toggle(
            "home-meeting__badge--atrasada",
            !enCurso &&
            dias < 0
        );


        mesReunion.textContent =
            fecha
                .toLocaleDateString(
                    "es-MX",
                    {
                        month:
                            "short"
                    }
                )
                .replace(
                    ".",
                    ""
                );

        diaReunion.textContent =
            fecha.getDate();


        tituloReunion.textContent =
            reunion.Titulo ||
            "Reunión Flow";

        metaReunion.textContent =
            enCurso
                ? [
                    `Programada a las ${formatearHora(fecha)}`,
                    textoParticipantes(reunion)
                ].join(" · ")
                : [
                    capitalizar(
                        fecha.toLocaleDateString(
                            "es-MX",
                            {
                                weekday:
                                    "long"
                            }
                        )
                    ),
                    formatearHora(
                        fecha
                    ),
                    textoParticipantes(
                        reunion
                    )
                ].join(" · ");


        iconoAccion.setAttribute(
            "d",
            ICONOS_ACCION[estado]
        );

        textoAccion.textContent =
            TEXTOS_ACCION[estado];


        detalleReunion.hidden =
            false;

        btnAccion.hidden =
            false;

        vacioReunion.hidden =
            true;

        btnProgramarVacio.hidden =
            true;

    }


    async function cargarReunion(
        carga
    ) {

        const usuario =
            getUsuarioActual();

        try {

            const reuniones =
                await obtenerReunionesProgramadas();

            if (carga !== cargaActual) {

                return;

            }

            const reunion =
                elegirReunion(
                    reuniones,
                    Number(
                        usuario?.id
                    )
                );

            if (reunion) {

                pintarReunion(
                    reunion
                );

            }
            else {

                pintarReunionVacia();

            }

        }
        catch (error) {

            console.error(
                "ERROR CARGANDO PRÓXIMA REUNIÓN:",
                error
            );

            if (carga === cargaActual) {

                pintarReunionVacia();

            }

        }

    }


    /* =========================================================
       ÚLTIMA JUNTA
       ---------------------------------------------------------
       La reunión finalizada más reciente del departamento del
       usuario (el servidor ya las regresa de la más nueva a la
       más vieja). Una reunión sin departamento cuenta si el
       usuario la creó o participó en ella.
       ========================================================= */

    function normalizarDepartamento(
        texto
    ) {

        return String(
            texto ||
            ""
        )
            .trim()
            .toLowerCase();

    }


    function elegirUltimaJunta(
        reuniones,
        usuario
    ) {

        const usuarioId =
            Number(
                usuario?.id
            );

        const departamento =
            normalizarDepartamento(
                usuario?.departamento
            );

        return (
            reuniones.find(
                (reunion) => {

                    if (reunion.Estado !== "Finalizada") {

                        return false;

                    }

                    if (reunion.Departamento) {

                        return (
                            Boolean(departamento) &&
                            normalizarDepartamento(
                                reunion.Departamento
                            ) === departamento
                        );

                    }

                    return (
                        Number(reunion.UsuarioCreadorId) === usuarioId ||
                        (
                            reunion.Participantes ||
                            []
                        ).some(
                            (participante) =>
                                Number(participante.id) === usuarioId
                        )
                    );

                }
            ) ||
            null
        );

    }


    function textoHace(
        fecha
    ) {

        const dias =
            -diasHasta(
                fecha
            );

        if (dias <= 0) {

            return "hoy";

        }

        if (dias === 1) {

            return "ayer";

        }

        return `hace ${dias} días`;

    }


    function plural(
        cantidad,
        singular,
        pluralTexto
    ) {

        const total =
            Number(
                cantidad
            ) || 0;

        return `${total} ${
            total === 1
                ? singular
                : pluralTexto
        }`;

    }


    function pintarUltimaJunta(
        reunion
    ) {

        if (!ultimaJunta) {

            return;

        }

        if (!reunion) {

            ultimaJuntaId =
                null;

            ultimaJunta.hidden =
                true;

            return;

        }

        const fecha =
            fechaValida(
                reunion.FechaInicio
            );

        ultimaJuntaId =
            reunion.ReunionId;

        ultimaHace.textContent =
            fecha
                ? `· ${textoHace(fecha)}`
                : "";

        ultimaTitulo.textContent =
            [
                reunion.Titulo ||
                "Reunión Flow",
                fecha
                    ? fecha
                        .toLocaleDateString(
                            "es-MX",
                            {
                                day:
                                    "numeric",
                                month:
                                    "short"
                            }
                        )
                        .replace(
                            ".",
                            ""
                        )
                    : ""
            ]
                .filter(Boolean)
                .join(" · ");

        ultimaMeta.textContent =
            [
                plural(
                    reunion.TotalParticipantes,
                    "participante",
                    "participantes"
                ),
                plural(
                    reunion.TotalObjetivos,
                    "objetivo",
                    "objetivos"
                ),
                plural(
                    reunion.TotalCompromisos,
                    "compromiso",
                    "compromisos"
                )
            ].join(" · ");

        ultimaJunta.setAttribute(
            "aria-label",
            `Abrir la última junta: ${ultimaTitulo.textContent}`
        );

        ultimaJunta.hidden =
            false;

    }


    async function cargarUltimaJunta(
        carga
    ) {

        try {

            const reuniones =
                await obtenerJSON(
                    "/reuniones/historial",
                    "reuniones"
                );

            if (carga !== cargaActual) {

                return;

            }

            pintarUltimaJunta(
                elegirUltimaJunta(
                    reuniones,
                    getUsuarioActual()
                )
            );

        }
        catch (error) {

            console.error(
                "ERROR CARGANDO ÚLTIMA JUNTA:",
                error
            );

            if (carga === cargaActual) {

                pintarUltimaJunta(
                    null
                );

            }

        }

    }


    /* =========================================================
       TUS PENDIENTES
       ========================================================= */

    async function obtenerJSON(
        ruta,
        clave
    ) {

        const response =
            await fetch(
                `${API_URL}${ruta}`,
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
                "No fue posible obtener los pendientes."
            );

        }

        return (
            data[clave] ||
            []
        );

    }


    function ordenPrioridad(
        prioridad
    ) {

        const orden =
            ORDEN_PRIORIDAD[
                String(
                    prioridad ||
                    ""
                )
                    .trim()
                    .toLowerCase()
            ];

        return orden === undefined
            ? Object.keys(ORDEN_PRIORIDAD).length
            : orden;

    }


    /*
     * Compromisos sin terminar (vencido, pendiente o en
     * espera de visto bueno), de cualquier prioridad.
     *
     * - Normalmente: solo donde el usuario es responsable
     *   (el administrador recibe todos, por eso se filtra).
     * - Líder (equipo = true): todos los que el servidor le
     *   regresa, que ya son los de su departamento.
     *
     * Orden: vencidos, pendientes y en revisión; dentro de
     * cada grupo, por prioridad y luego por fecha límite.
     */
    function pendientesDeCompromisos(
        compromisos,
        usuarioId,
        equipo
    ) {

        return compromisos
            .filter(
                (compromiso) =>
                    ORDEN_ESTADO_PENDIENTE[compromiso.estado] !== undefined &&
                    (
                        equipo ||
                        Number(compromiso.usuarioAsignadoId) === usuarioId ||
                        (
                            compromiso.responsables ||
                            []
                        ).some(
                            (responsable) =>
                                Number(responsable.id) === usuarioId
                        )
                    )
            )
            .map(
                (compromiso) => ({
                    texto:
                        compromiso.descripcion,
                    fecha:
                        fechaValida(
                            compromiso.fechaLimite
                        ),
                    estado:
                        compromiso.estado,
                    prioridad:
                        ordenPrioridad(
                            compromiso.prioridad
                        ),
                    responsables:
                        equipo
                            ? nombresResponsables(
                                compromiso,
                                usuarioId
                            )
                            : ""
                })
            )
            .sort(
                (a, b) => {

                    const porEstado =
                        ORDEN_ESTADO_PENDIENTE[a.estado] -
                        ORDEN_ESTADO_PENDIENTE[b.estado];

                    if (porEstado !== 0) {

                        return porEstado;

                    }

                    if (a.prioridad !== b.prioridad) {

                        return a.prioridad - b.prioridad;

                    }

                    if (!a.fecha) {

                        return b.fecha
                            ? 1
                            : 0;

                    }

                    if (!b.fecha) {

                        return -1;

                    }

                    return a.fecha - b.fecha;

                }
            );

    }


    /*
     * "Ana López, Tú": a quién le toca cada pendiente en la
     * vista de equipo del líder.
     */
    function nombresResponsables(
        compromiso,
        usuarioId
    ) {

        const responsables =
            compromiso.responsables?.length
                ? compromiso.responsables
                : [
                    {
                        id:
                            compromiso.usuarioAsignadoId,
                        nombre:
                            compromiso.usuarioAsignadoNombre
                    }
                ];

        return responsables
            .map(
                (responsable) =>
                    Number(responsable.id) === usuarioId
                        ? "Tú"
                        : responsable.nombre
            )
            .filter(Boolean)
            .join(", ");

    }


    function crearPendiente(
        pendiente
    ) {

        const item =
            document.createElement(
                "li"
            );

        item.classList.add(
            "home-pending__item"
        );


        let tipo =
            "normal";

        let etiqueta =
            "Sin fecha";

        if (pendiente.estado === "vencido") {

            tipo =
                "vencido";

            etiqueta =
                "Vencido";

        }
        else if (pendiente.estado === "en-revision") {

            tipo =
                "revision";

            etiqueta =
                "En revisión";

        }
        else if (pendiente.fecha) {

            if (
                diasHasta(
                    pendiente.fecha
                ) <= DIAS_VENCE_PRONTO
            ) {

                tipo =
                    "pronto";

            }

            etiqueta =
                capitalizar(
                    pendiente.fecha
                        .toLocaleDateString(
                            "es-MX",
                            {
                                weekday:
                                    "short",
                                day:
                                    "numeric"
                            }
                        )
                        .replace(
                            ".",
                            ""
                        )
                        .replace(
                            ",",
                            ""
                        )
                );

        }


        item.classList.add(
            `home-pending__item--${tipo}`
        );


        const texto =
            document.createElement(
                "span"
            );

        texto.classList.add(
            "home-pending__text"
        );

        texto.textContent =
            pendiente.texto ||
            "Sin descripción";

        texto.title =
            texto.textContent;


        const contenido =
            document.createElement(
                "span"
            );

        contenido.classList.add(
            "home-pending__content"
        );

        contenido.append(
            texto
        );

        if (pendiente.responsables) {

            const responsables =
                document.createElement(
                    "span"
                );

            responsables.classList.add(
                "home-pending__owner"
            );

            responsables.textContent =
                pendiente.responsables;

            responsables.title =
                pendiente.responsables;

            contenido.append(
                responsables
            );

        }


        const fecha =
            document.createElement(
                "span"
            );

        fecha.classList.add(
            "home-pending__date"
        );

        fecha.textContent =
            etiqueta;


        item.append(
            contenido,
            fecha
        );

        return item;

    }


    function pintarMensajePendientes(
        mensaje
    ) {

        const item =
            document.createElement(
                "li"
            );

        item.classList.add(
            "home-pending__empty"
        );

        item.textContent =
            mensaje;

        listaPendientes.replaceChildren(
            item
        );

    }


    async function cargarPendientes(
        carga
    ) {

        const usuario =
            getUsuarioActual();

        const usuarioId =
            Number(
                usuario?.id
            );

        const equipo =
            usuario?.rol === "lider";

        etiquetaPendientes.textContent =
            equipo
                ? "Pendientes de tu equipo"
                : "Tus pendientes";

        const compromisos =
            await obtenerJSON(
                "/compromisos",
                "compromisos"
            ).catch(
                (error) => {

                    console.error(
                        "ERROR CARGANDO COMPROMISOS DEL MENÚ:",
                        error
                    );

                    return [];

                }
            );

        if (carga !== cargaActual) {

            return;

        }


        const pendientes =
            pendientesDeCompromisos(
                compromisos,
                usuarioId,
                equipo
            ).slice(
                0,
                equipo
                    ? MAX_PENDIENTES_EQUIPO
                    : MAX_PENDIENTES
            );


        if (pendientes.length === 0) {

            pintarMensajePendientes(
                equipo
                    ? "Tu equipo no tiene compromisos pendientes. ¡Todo al día!"
                    : "No tienes compromisos pendientes. ¡Todo al día!"
            );

            return;

        }

        listaPendientes.replaceChildren(
            ...pendientes.map(
                crearPendiente
            )
        );

    }


    /* =========================================================
       RENDER
       ========================================================= */

    function render() {

        cargaActual += 1;

        const carga =
            cargaActual;

        pintarFechaHoy();

        if (!listaPendientes.children.length) {

            pintarMensajePendientes(
                "Cargando pendientes…"
            );

        }

        cargarReunion(
            carga
        );

        cargarPendientes(
            carga
        );

        cargarUltimaJunta(
            carga
        );

    }


    /* =========================================================
       EVENTOS
       ========================================================= */

    btnProgramar?.addEventListener(
        "click",
        abrirProgramarReunion
    );

    btnProgramarVacio?.addEventListener(
        "click",
        abrirProgramarReunion
    );

    ultimaJunta?.addEventListener(
        "click",
        () => {

            if (
                ultimaJuntaId &&
                typeof onAbrirReunion === "function"
            ) {

                onAbrirReunion(
                    ultimaJuntaId
                );

            }

        }
    );

    btnAccion?.addEventListener(
        "click",
        () => {

            if (!reunionMostrada) {

                return;

            }

            document.dispatchEvent(
                new CustomEvent(
                    "flow:iniciar-reunion",
                    {
                        detail: {
                            id:
                                reunionMostrada.ReunionId
                        }
                    }
                )
            );

        }
    );

    document.addEventListener(
        "flow:foto-perfil-actualizada",
        (event) => {

            pintarAvatarUsuario(
                event.detail?.url ||
                null
            );

        }
    );

    pintarAvatarUsuario();

    /*
     * Una reunión recién programada cambia la tarjeta.
     */
    document.addEventListener(
        "flow:reunion-programada",
        render
    );

    /*
     * Se llega al menú por muchos caminos (Volver al inicio,
     * terminar una reunión, Atrás del navegador…). En vez de
     * engancharse a cada uno, se refresca cada vez que la
     * vista deja de estar oculta.
     */
    vista.dataset.visible =
        vista.classList.contains(
            "view--hidden"
        )
            ? "0"
            : "1";

    new MutationObserver(
        () => {

            const visible =
                !vista.classList.contains(
                    "view--hidden"
                );

            if (
                visible &&
                vista.dataset.visible !== "1"
            ) {

                render();

            }

            vista.dataset.visible =
                visible
                    ? "1"
                    : "0";

        }
    ).observe(
        vista,
        {
            attributes:
                true,
            attributeFilter: [
                "class"
            ]
        }
    );


    return {
        render
    };

}
