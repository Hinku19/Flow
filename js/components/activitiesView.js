/* =========================================================
   VISOR DE ACTIVIDADES POR USUARIO
   ---------------------------------------------------------
   Muestra los objetivos asignados a un usuario en las
   reuniones (ver asignación en editableList / main.js) con el
   avance de sus puntos de desarrollo, sin tener que abrir el
   reporte completo de cada junta.

   Cada quien ve lo suyo. Administrador puede elegir a
   cualquier usuario y líder a los de su departamento (el
   servidor valida lo mismo en GET /api/actividades).
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    getUsuarioActual,
    headerUsuario
} from "../services/auth.service.js";

import {
    capitalizar
} from "../utils/capitalize.js";

import {
    mismaArea
} from "../utils/responsables.js";

import {
    crearSelectorResponsables
} from "../utils/selectorResponsables.js";


export function initActivitiesView() {

    const vista =
        document.querySelector(
            "#vista-actividades"
        );


    if (!vista) {

        console.warn(
            "No se encontró #vista-actividades"
        );

        return {
            render: () => {}
        };

    }


    const titulo =
        vista.querySelector(
            ".view__title"
        );

    const filtros =
        vista.querySelector(
            ".activities-view__filtros"
        );

    const filtroUsuario =
        vista.querySelector(
            "#actividades-filtro-usuario"
        );

    const estado =
        vista.querySelector(
            ".activities-view__estado"
        );

    const lista =
        vista.querySelector(
            ".activities-view__lista"
        );

    const filtroNombre =
        vista.querySelector(
            "#actividades-filtro-nombre"
        );

    const filtroDesde =
        vista.querySelector(
            "#actividades-filtro-desde"
        );

    const filtroHasta =
        vista.querySelector(
            "#actividades-filtro-hasta"
        );

    const botonLimpiar =
        vista.querySelector(
            "#actividades-filtro-limpiar"
        );

    const dialogCompromiso =
        vista.querySelector(
            "#actividades-compromiso-dialog"
        );

    const formCompromiso =
        vista.querySelector(
            "#actividades-compromiso-form"
        );

    const errorCompromiso =
        vista.querySelector(
            "#actividades-compromiso-error"
        );


    let usuariosCargados =
        false;


    /* lo último que mandó el servidor, antes de los filtros */
    let actividadesCargadas =
        [];


    /* punto (y su actividad) que se está convirtiendo en compromiso */
    let actividadAConvertir =
        null;

    let puntoAConvertir =
        null;


    const selectorResponsables =
        crearSelectorResponsables(
            formCompromiso.querySelector(
                ".commitment-list__responsables"
            )
        );

    const selectorInvolucrados =
        crearSelectorResponsables(
            formCompromiso.querySelector(
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
        );


    /* =========================================================
       ¿PUEDE VER A OTROS USUARIOS?
       ========================================================= */

    function puedeElegirUsuario() {

        const usuario =
            getUsuarioActual();

        return (
            usuario?.rol === "administrador" ||
            usuario?.rol === "lider"
        );

    }


    /* =========================================================
       MENSAJE DE ESTADO
       ========================================================= */

    function mostrarEstado(
        texto
    ) {

        lista.replaceChildren();

        estado.textContent =
            texto;

        estado.hidden =
            false;

    }


    /* =========================================================
       FORMATOS
       ========================================================= */

    function formatearFecha(
        valor
    ) {

        const fecha =
            new Date(
                valor
            );

        if (Number.isNaN(fecha.getTime())) {

            return "";

        }

        const mes =
            capitalizar(
                fecha.toLocaleDateString(
                    "es-MX",
                    {
                        month:
                            "short"
                    }
                )
            );

        return `${String(fecha.getDate()).padStart(2, "0")}/${mes}/${fecha.getFullYear()}`;

    }


    /* "YYYY-MM-DD" en hora local, para comparar con los filtros */
    function fechaLocalISO(
        valor
    ) {

        const fecha =
            new Date(
                valor
            );

        if (Number.isNaN(fecha.getTime())) {

            return "";

        }

        return [
            fecha.getFullYear(),
            String(fecha.getMonth() + 1).padStart(2, "0"),
            String(fecha.getDate()).padStart(2, "0")
        ].join("-");

    }


    /*
     * Fecha de creación de un punto; los puntos viejos (sin
     * fechaCreacion) toman la fecha de la reunión.
     */
    function fechaDePunto(
        actividad,
        punto
    ) {

        return (
            punto.fechaCreacion ||
            actividad.reunionFecha
        );

    }


    /* sin acentos ni mayúsculas, para buscar por nombre */
    function normalizar(
        texto
    ) {

        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();

    }


    function claseAvance(
        avance
    ) {

        if (avance >= 100) {

            return "activity__bar--completo";

        }

        if (avance > 66) {

            return "activity__bar--alto";

        }

        if (avance > 33) {

            return "activity__bar--medio";

        }

        return "activity__bar--bajo";

    }


    /* =========================================================
       SELECTOR DE USUARIO (ADMINISTRADOR / LÍDER)
       ========================================================= */

    async function cargarUsuariosFiltro() {

        const usuarioActual =
            getUsuarioActual();


        const response =
            await fetch(
                `${API_URL}/usuarios`,
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
                "No fue posible cargar los usuarios."
            );

        }


        const usuarios =
            (
                data.usuarios ||
                []
            )
                .filter(
                    usuario =>
                        Number(usuario.activo) === 1
                )
                .filter(
                    usuario =>
                        usuarioActual.rol === "administrador" ||
                        String(usuario.departamento || "").trim() ===
                            String(usuarioActual.departamento || "").trim()
                )
                .sort(
                    (a, b) =>
                        a.nombre.localeCompare(
                            b.nombre
                        )
                );


        filtroUsuario.replaceChildren();


        usuarios.forEach(
            usuario => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    usuario.id;

                option.textContent =
                    Number(usuario.id) === Number(usuarioActual.id)
                        ? `${usuario.nombre} (yo)`
                        : usuario.nombre;

                filtroUsuario.appendChild(
                    option
                );

            }
        );


        filtroUsuario.value =
            String(
                usuarioActual.id
            );

        filtros.hidden =
            false;

        usuariosCargados =
            true;

    }


    /* =========================================================
       PINTAR UNA ACTIVIDAD
       ========================================================= */

    function crearActividad(
        actividad
    ) {

        const item =
            document.createElement(
                "li"
            );

        item.classList.add(
            "activity"
        );

        item.classList.toggle(
            "activity--completada",
            actividad.completado
        );


        const cabecera =
            document.createElement(
                "div"
            );

        cabecera.classList.add(
            "activity__cabecera"
        );


        const texto =
            document.createElement(
                "span"
            );

        texto.classList.add(
            "activity__texto"
        );

        texto.textContent =
            actividad.texto;


        const avance =
            document.createElement(
                "div"
            );

        avance.classList.add(
            "activity__avance"
        );

        avance.title =
            "Promedio de avance de sus puntos de desarrollo";


        const track =
            document.createElement(
                "div"
            );

        track.classList.add(
            "activity__track"
        );


        const bar =
            document.createElement(
                "div"
            );

        bar.classList.add(
            "activity__bar",
            claseAvance(
                actividad.avance
            )
        );

        bar.style.width =
            `${actividad.avance}%`;

        track.appendChild(
            bar
        );


        const porcentaje =
            document.createElement(
                "span"
            );

        porcentaje.classList.add(
            "activity__porcentaje"
        );

        porcentaje.textContent =
            `${actividad.avance}%`;


        avance.append(
            track,
            porcentaje
        );

        cabecera.append(
            texto,
            avance
        );

        item.appendChild(
            cabecera
        );


        if (
            Array.isArray(actividad.compartidoCon) &&
            actividad.compartidoCon.length > 0
        ) {

            const compartido =
                document.createElement(
                    "p"
                );

            compartido.classList.add(
                "activity__compartido"
            );

            compartido.textContent =
                `Compartido con: ${actividad.compartidoCon.join(", ")}`;

            item.appendChild(
                compartido
            );

        }


        if (actividad.puntos.length === 0) {

            const sinPuntos =
                document.createElement(
                    "p"
                );

            sinPuntos.classList.add(
                "activity__sin-puntos"
            );

            sinPuntos.textContent =
                "Aún no tiene puntos de desarrollo.";

            item.appendChild(
                sinPuntos
            );

            return item;

        }


        const puntos =
            document.createElement(
                "ul"
            );

        puntos.classList.add(
            "activity__puntos"
        );


        actividad.puntos.forEach(
            punto => {

                const puntoItem =
                    document.createElement(
                        "li"
                    );

                puntoItem.classList.add(
                    "activity__punto"
                );

                puntoItem.textContent =
                    punto.texto ||
                    "(Sin descripción)";


                /*
                 * Igual que el doble clic sobre un punto en el
                 * desarrollo de la reunión: lo convierte en
                 * compromiso con todo precargado (líder /
                 * administrador, una sola vez por punto).
                 */
                if (punto.compromisoCreado) {

                    puntoItem.classList.add(
                        "activity__punto--convertido"
                    );

                    puntoItem.title =
                        "Ya convertido en compromiso";

                }
                else if (
                    puedeElegirUsuario() &&
                    punto.id
                ) {

                    puntoItem.classList.add(
                        "activity__punto--convertible"
                    );

                    puntoItem.title =
                        "Doble clic para convertir en compromiso";

                    puntoItem.addEventListener(
                        "dblclick",
                        () =>
                            abrirConvertir(
                                actividad,
                                punto
                            )
                    );

                }


                const puntoAvance =
                    document.createElement(
                        "span"
                    );

                puntoAvance.classList.add(
                    "activity__punto-avance"
                );

                puntoAvance.textContent =
                    `${punto.avance}%`;


                puntoItem.appendChild(
                    puntoAvance
                );


                if (punto.prioridad) {

                    const puntoPrioridad =
                        document.createElement(
                            "span"
                        );

                    puntoPrioridad.classList.add(
                        "activity__punto-prioridad"
                    );

                    puntoPrioridad.textContent =
                        " - Actividad Prioritaria";

                    puntoItem.appendChild(
                        puntoPrioridad
                    );

                }


                /*
                 * Fecha de la reunión en que se creó el punto (los
                 * heredados conservan la de su reunión de origen).
                 */
                const puntoFecha =
                    document.createElement(
                        "span"
                    );

                puntoFecha.classList.add(
                    "activity__punto-fecha"
                );

                puntoFecha.textContent =
                    formatearFecha(
                        fechaDePunto(
                            actividad,
                            punto
                        )
                    );

                puntoItem.appendChild(
                    puntoFecha
                );


                if (punto.compromisoCreado) {

                    const puntoCompromiso =
                        document.createElement(
                            "span"
                        );

                    puntoCompromiso.classList.add(
                        "activity__punto-compromiso"
                    );

                    puntoCompromiso.textContent =
                        "Compromiso";

                    puntoItem.appendChild(
                        puntoCompromiso
                    );

                }

                puntos.appendChild(
                    puntoItem
                );

            }
        );


        item.appendChild(
            puntos
        );

        return item;

    }


    /* =========================================================
       PINTAR LA LISTA (AGRUPADA POR REUNIÓN)
       ========================================================= */

    function pintar(
        actividades
    ) {

        if (actividades.length === 0) {

            mostrarEstado(
                actividadesCargadas.length === 0
                    ? "No hay actividades asignadas por el momento."
                    : "No hay actividades con estos filtros."
            );

            return;

        }


        estado.hidden =
            true;


        /*
         * El servidor ya las manda de la reunión más reciente
         * a la más antigua; Map conserva ese orden.
         */

        const grupos =
            new Map();

        actividades.forEach(
            actividad => {

                if (!grupos.has(actividad.reunionId)) {

                    grupos.set(
                        actividad.reunionId,
                        []
                    );

                }

                grupos
                    .get(actividad.reunionId)
                    .push(actividad);

            }
        );


        const tarjetas =
            [];

        grupos.forEach(
            (actividadesReunion) => {

                const primera =
                    actividadesReunion[0];


                const grupo =
                    document.createElement(
                        "section"
                    );

                grupo.classList.add(
                    "activities-group"
                );


                const header =
                    document.createElement(
                        "header"
                    );

                header.classList.add(
                    "activities-group__header"
                );


                const tituloReunion =
                    document.createElement(
                        "h2"
                    );

                tituloReunion.classList.add(
                    "activities-group__titulo"
                );

                tituloReunion.textContent =
                    primera.reunionTitulo ||
                    "Reunión";


                const meta =
                    document.createElement(
                        "span"
                    );

                meta.classList.add(
                    "activities-group__meta"
                );

                meta.textContent =
                    formatearFecha(
                        primera.reunionFecha
                    );


                if (primera.reunionEstado === "En curso") {

                    const badge =
                        document.createElement(
                            "span"
                        );

                    badge.classList.add(
                        "activities-group__badge"
                    );

                    badge.textContent =
                        "En curso";

                    meta.appendChild(
                        badge
                    );

                }


                header.append(
                    tituloReunion,
                    meta
                );


                const listaActividades =
                    document.createElement(
                        "ul"
                    );

                listaActividades.classList.add(
                    "activities-list"
                );

                listaActividades.append(
                    ...actividadesReunion.map(
                        crearActividad
                    )
                );


                grupo.append(
                    header,
                    listaActividades
                );

                tarjetas.push(
                    grupo
                );

            }
        );


        lista.replaceChildren(
            ...tarjetas
        );

    }


    /* =========================================================
       CARGAR ACTIVIDADES
       ========================================================= */

    async function cargarActividades() {

        const usuarioActual =
            getUsuarioActual();


        const usuarioId =
            filtroUsuario.value ||
            String(
                usuarioActual.id
            );


        const esPropio =
            usuarioId === String(usuarioActual.id);

        titulo.textContent =
            esPropio
                ? "Mis actividades"
                : `Actividades de ${filtroUsuario.selectedOptions[0]?.textContent || "usuario"}`;


        mostrarEstado(
            "Cargando actividades…"
        );


        try {

            const response =
                await fetch(
                    `${API_URL}/actividades?usuarioId=${encodeURIComponent(usuarioId)}`,
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
                    "No fue posible obtener las actividades."
                );

            }


            actividadesCargadas =
                data.actividades ||
                [];

            aplicarFiltros();

        }
        catch (error) {

            actividadesCargadas =
                [];

            console.error(
                "ERROR AL CARGAR ACTIVIDADES:",
                error
            );

            mostrarEstado(
                error.message ||
                "No fue posible obtener las actividades."
            );

        }

    }


    /* =========================================================
       FILTROS POR NOMBRE Y FECHA (DE LA REUNIÓN)
       ========================================================= */

    /*
     * Nombre: si coincide la actividad se muestran todos sus
     * puntos; si no, solo los puntos que coinciden.
     * Fecha (desde / hasta): sobre la fecha de cada punto; una
     * actividad sin puntos usa la fecha de su reunión.
     * Una actividad se oculta si no le queda nada que mostrar.
     */
    function aplicarFiltros() {

        const nombre =
            normalizar(
                filtroNombre.value
            );

        const desde =
            filtroDesde.value;

        const hasta =
            filtroHasta.value;


        function enRango(
            valor
        ) {

            const fecha =
                fechaLocalISO(
                    valor
                );

            return (
                (
                    !desde ||
                    fecha >= desde
                ) &&
                (
                    !hasta ||
                    fecha <= hasta
                )
            );

        }


        const hayFiltros =
            Boolean(
                nombre ||
                desde ||
                hasta
            );


        pintar(
            actividadesCargadas
                .map(
                    (actividad) => {

                        if (!hayFiltros) {

                            return actividad;

                        }


                        if (actividad.puntos.length === 0) {

                            return (
                                (
                                    !nombre ||
                                    normalizar(actividad.texto).includes(nombre)
                                ) &&
                                enRango(
                                    actividad.reunionFecha
                                )
                            )
                                ? actividad
                                : null;

                        }


                        const coincideActividad =
                            !nombre ||
                            normalizar(actividad.texto).includes(nombre);

                        const puntos =
                            actividad.puntos.filter(
                                (punto) =>
                                    (
                                        coincideActividad ||
                                        normalizar(punto.texto).includes(nombre)
                                    ) &&
                                    enRango(
                                        fechaDePunto(
                                            actividad,
                                            punto
                                        )
                                    )
                            );

                        return puntos.length > 0
                            ? {
                                ...actividad,
                                puntos
                            }
                            : null;

                    }
                )
                .filter(Boolean)
        );

    }


    /* =========================================================
       CONVERTIR UN PUNTO EN COMPROMISO (LÍDER / ADMINISTRADOR)
       ---------------------------------------------------------
       Doble clic sobre un punto de desarrollo. Se crea como
       compromiso del módulo (sin reunión), con la referencia al
       punto para no convertirlo dos veces (lo valida el
       servidor en POST /api/compromisos).
       ========================================================= */

    function mostrarErrorCompromiso(
        mensaje
    ) {

        errorCompromiso.hidden =
            !mensaje;

        errorCompromiso.textContent =
            mensaje || "";

    }


    async function poblarSelectoresCompromiso(
        actividad
    ) {

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
            const delArea =
                activos.filter(
                    (usuario) =>
                        mismaArea(
                            usuario,
                            usuarioActual
                        )
                );

            selectorResponsables.setUsuarios(
                delArea
            );

            selectorInvolucrados.setUsuarios(
                activos
            );


            /*
             * Se precargan los responsables de la actividad que
             * se pueden asignar (los de otra área los rechazaría
             * el servidor).
             */
            selectorResponsables.setSeleccionados(
                (actividad.responsables || [])
                    .filter(
                        (responsable) =>
                            delArea.some(
                                (usuario) =>
                                    Number(usuario.id) === Number(responsable.id)
                            )
                    )
            );

        }
        catch (error) {

            console.error(
                "ERROR CARGANDO USUARIOS PARA EL COMPROMISO:",
                error
            );

            mostrarErrorCompromiso(
                error.message
            );

        }

    }


    async function abrirConvertir(
        actividad,
        punto
    ) {

        actividadAConvertir =
            actividad;

        puntoAConvertir =
            punto;

        formCompromiso.reset();

        selectorResponsables.limpiar();

        selectorInvolucrados.limpiar();

        formCompromiso.elements.descripcion.value =
            punto.texto || "";

        formCompromiso.elements.fechaInicio.value =
            fechaLocalISO(
                new Date()
            );

        mostrarErrorCompromiso("");

        dialogCompromiso.showModal();

        await poblarSelectoresCompromiso(
            actividad
        );

    }


    async function crearCompromisoDesdeActividad() {

        const campos =
            formCompromiso.elements;

        const responsables =
            selectorResponsables.getSeleccionados();

        if (
            responsables.length === 0 ||
            !campos.descripcion.value.trim() ||
            !campos.fechaInicio.value ||
            !campos.fechaLimite.value
        ) {

            mostrarErrorCompromiso(
                "Elige al menos un responsable y completa descripción y fechas."
            );

            return;

        }

        if (campos.fechaLimite.value < campos.fechaInicio.value) {

            mostrarErrorCompromiso(
                "La fecha límite no puede ser anterior a la fecha de inicio."
            );

            return;

        }


        const botonGuardar =
            formCompromiso.querySelector(
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
                                    campos.fechaLimite.value,

                                origenReunionId:
                                    actividadAConvertir.reunionId,

                                origenObjetivoId:
                                    actividadAConvertir.objetivoId,

                                origenPuntoId:
                                    puntoAConvertir.id

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

            dialogCompromiso.close();

            await cargarActividades();

        }
        catch (error) {

            console.error(
                "ERROR CONVIRTIENDO ACTIVIDAD EN COMPROMISO:",
                error
            );

            mostrarErrorCompromiso(
                error.message ||
                "No fue posible crear el compromiso."
            );

        }
        finally {

            botonGuardar.disabled =
                false;

        }

    }


    formCompromiso.addEventListener(
        "submit",
        (event) => {

            event.preventDefault();

            crearCompromisoDesdeActividad();

        }
    );


    vista
        .querySelector("#actividades-compromiso-cancelar")
        .addEventListener(
            "click",
            () => dialogCompromiso.close()
        );


    /* =========================================================
       RENDER (AL ENTRAR A LA VISTA)
       ========================================================= */

    async function render() {

        if (
            puedeElegirUsuario() &&
            !usuariosCargados
        ) {

            try {

                await cargarUsuariosFiltro();

            }
            catch (error) {

                /*
                 * Sin la lista de usuarios igual puede ver
                 * sus propias actividades.
                 */

                console.error(
                    "ERROR CARGANDO USUARIOS DEL VISOR:",
                    error
                );

            }

        }


        await cargarActividades();

    }


    filtroUsuario.addEventListener(
        "change",
        cargarActividades
    );


    filtroNombre.addEventListener(
        "input",
        aplicarFiltros
    );

    filtroDesde.addEventListener(
        "change",
        aplicarFiltros
    );

    filtroHasta.addEventListener(
        "change",
        aplicarFiltros
    );

    botonLimpiar.addEventListener(
        "click",
        () => {

            filtroNombre.value =
                "";

            filtroDesde.value =
                "";

            filtroHasta.value =
                "";

            aplicarFiltros();

        }
    );


    return {
        render
    };

}
