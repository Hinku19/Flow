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


    let usuariosCargados =
        false;


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

                puntoItem.textContent =
                    punto.texto ||
                    "(Sin descripción)";


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
                "No hay actividades asignadas por el momento."
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


            pintar(
                data.actividades ||
                []
            );

        }
        catch (error) {

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


    return {
        render
    };

}
