/* =========================================================
   FORMULARIOS DE EVALUACIONES (ESCALA DE LIKERT)
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    headerUsuario
} from "../services/auth.service.js";

import {
    FORMULARIOS_EVALUACION,
    ESCALA_LIKERT,
    obtenerFormulario
} from "./evaluacionesCatalogo.js";


export function initEvaluacionesForm() {

    const submenu =
        document.querySelector("#evaluaciones-submenu");

    const contenedor =
        document.querySelector("#evaluaciones-form-container");

    const avisoPeriodo =
        document.querySelector("#evaluaciones-periodo-aviso");

    if (!submenu || !contenedor) {

        return {
            render: async () => {},
            getEstado: () => null
        };

    }


    const botones =
        submenu.querySelectorAll(".evaluations-submenu__btn");


    /* =====================================================
       ESTADO
       ===================================================== */

    let estadoActual = null;
    let tabActiva = "general";
    let colegaSiguiente = null;


    function escaparHTML(valor) {

        if (valor === null || valor === undefined) {
            return "";
        }

        return String(valor)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    /* =====================================================
       CARGAR ESTADO DESDE EL SERVIDOR
       ===================================================== */

    async function cargarEstado() {

        try {

            const response =
                await fetch(
                    `${API_URL}/evaluaciones/estado`,
                    {
                        headers: headerUsuario()
                    }
                );

            const data =
                await response.json();

            if (!response.ok || !data.ok) {

                throw new Error(
                    data.mensaje ||
                    "No fue posible obtener el estado de las evaluaciones."
                );

            }

            estadoActual = data;

        }
        catch (error) {

            console.error(
                "ERROR AL CARGAR ESTADO DE EVALUACIONES:",
                error
            );

            estadoActual = null;

        }

    }


    /* =====================================================
       AVISO DE PERIODO
       ===================================================== */

    function pintarAvisoPeriodo() {

        if (!avisoPeriodo) return;

        if (!estadoActual || !estadoActual.periodoActivo) {

            avisoPeriodo.hidden = false;

            avisoPeriodo.classList.add("evaluations-periodo-aviso--cerrado");

            avisoPeriodo.textContent =
                "No hay un periodo de evaluación activo en este momento.";

            return;

        }

        avisoPeriodo.hidden = false;

        avisoPeriodo.classList.remove("evaluations-periodo-aviso--cerrado");

        avisoPeriodo.textContent =
            `Periodo activo: ${estadoActual.periodoActivo.nombre}`;

    }


    /* =====================================================
       SUBMENÚ
       ===================================================== */

    function pintarSubmenu() {

        let primeraVisible = null;

        botones.forEach(
            (boton) => {

                const slug =
                    boton.dataset.tab;

                const info =
                    estadoActual?.formularios?.[slug];

                const visible =
                    Boolean(info?.visible);

                boton.hidden = !visible;

                if (visible && !primeraVisible) {
                    primeraVisible = slug;
                }

                const completo =
                    info?.yaRespondido === true ||
                    info?.todosEvaluados === true;

                boton.classList.toggle(
                    "evaluations-submenu__btn--completo",
                    completo
                );

                boton.classList.toggle(
                    "evaluations-submenu__btn--activo",
                    slug === tabActiva
                );

            }
        );

        const tabActivaVisible =
            estadoActual?.formularios?.[tabActiva]?.visible;

        if (!tabActivaVisible && primeraVisible) {
            tabActiva = primeraVisible;
        }

    }


    /* =====================================================
       CONTENIDO DE UNA PESTAÑA
       ===================================================== */

    function renderContenido() {

        botones.forEach(
            (boton) => {

                boton.classList.toggle(
                    "evaluations-submenu__btn--activo",
                    boton.dataset.tab === tabActiva
                );

            }
        );


        if (!estadoActual) {

            contenedor.innerHTML =
                `<p class="evaluations-empty">No fue posible cargar las evaluaciones. Intenta recargar la página.</p>`;

            return;

        }

        if (!estadoActual.periodoActivo) {

            contenedor.innerHTML =
                `<p class="evaluations-empty">No hay un periodo de evaluación activo. Cuando un administrador abra uno, aquí aparecerán los formularios.</p>`;

            return;

        }


        const formulario =
            obtenerFormulario(tabActiva);

        const info =
            estadoActual.formularios?.[tabActiva];

        if (!formulario || !info || !info.visible) {

            contenedor.innerHTML =
                `<p class="evaluations-empty">Este formulario no está disponible para tu rol o área.</p>`;

            return;

        }


        /* =============================================
           LÍDER DE ÁREA SIN ASIGNAR
           ============================================= */

        if (formulario.objetivo === "lider_area" && !info.liderNombre) {

            contenedor.innerHTML =
                `<p class="evaluations-empty">Tu área todavía no tiene un líder asignado, así que no puedes responder este formulario.</p>`;

            return;

        }


        /* =============================================
           YA RESPONDIDO (FORMULARIOS DE DESTINATARIO ÚNICO)
           ============================================= */

        if (formulario.objetivo !== "colega_area" && info.yaRespondido) {

            contenedor.innerHTML =
                `<p class="evaluations-empty">Ya respondiste "${escaparHTML(formulario.titulo)}" en el periodo actual. ¡Gracias por tu retroalimentación!</p>`;

            return;

        }


        /* =============================================
           SIN COMPAÑEROS EN LA MISMA ÁREA
           ============================================= */

        if (formulario.objetivo === "colega_area" && (!info.colegas || info.colegas.length === 0)) {

            contenedor.innerHTML =
                `<p class="evaluations-empty">No hay compañeros activos registrados en tu área para evaluar.</p>`;

            return;

        }


        /* =============================================
           YA EVALUASTE A TODOS TUS COMPAÑEROS
           ============================================= */

        if (formulario.objetivo === "colega_area" && info.todosEvaluados) {

            contenedor.innerHTML = `
                <div class="evaluations-empty evaluations-empty--done">
                    <p class="evaluations-empty__icono">✓</p>
                    <p class="evaluations-empty__texto">¡Ya evaluaste a todos tus compañeros de área en este periodo!</p>
                </div>
            `;

            return;

        }


        contenedor.innerHTML =
            construirFormularioHTML(formulario, info);


        conectarFormulario(formulario);

    }


    function construirOpcionesLikert(pregunta) {

        return ESCALA_LIKERT.map(
            (opcion) => `
                <label class="evaluations-question__opcion">
                    <input
                        type="radio"
                        name="pregunta-${pregunta.id}"
                        value="${opcion.valor}"
                        required
                    >
                    ${escaparHTML(opcion.etiqueta)}
                </label>
            `
        ).join("");

    }


    function construirFormularioHTML(formulario, info) {

        const idPreseleccionado =
            colegaSiguiente;

        colegaSiguiente = null;

        const selectorDestinatario =
            formulario.objetivo === "colega_area"
                ? `
                    <div class="evaluations-target">
                        <label for="evaluaciones-colega-select">Compañero a evaluar</label>
                        <select id="evaluaciones-colega-select" required>
                            <option value="">Selecciona un compañero…</option>
                            ${info.colegas.map(
                                (colega) => `
                                    <option
                                        value="${colega.id}"
                                        ${colega.yaEvaluado ? "disabled" : ""}
                                        ${idPreseleccionado === colega.id ? "selected" : ""}
                                    >
                                        ${escaparHTML(colega.nombre)}${colega.yaEvaluado ? " (ya evaluado)" : ""}
                                    </option>
                                `
                            ).join("")}
                        </select>
                    </div>
                `
                : formulario.objetivo === "lider_area"
                    ? `
                        <div class="evaluations-target">
                            <label>Estás evaluando a</label>
                            <p style="margin: 0; font-weight: var(--weight-medium); color: var(--color-text);">
                                ${escaparHTML(info.liderNombre)}
                            </p>
                        </div>
                    `
                    : "";

        const preguntasHTML =
            formulario.preguntas.map(
                (pregunta) => `
                    <div class="evaluations-question">
                        <p class="evaluations-question__texto">${escaparHTML(pregunta.texto)}</p>
                        <div class="evaluations-question__opciones">
                            ${construirOpcionesLikert(pregunta)}
                        </div>
                    </div>
                `
            ).join("");

        return `
            <form id="evaluaciones-form" class="evaluations-form" novalidate>

                <p class="evaluations-form__intro">${escaparHTML(formulario.subtitulo)}</p>

                ${selectorDestinatario}

                <div class="evaluations-question-list">
                    ${preguntasHTML}
                </div>

                <p
                    id="evaluaciones-form-feedback"
                    class="evaluations-feedback"
                    hidden
                ></p>

                <div class="evaluations-form__actions">
                    <button
                        type="submit"
                        id="evaluaciones-form-submit"
                        class="evaluations-form__submit"
                    >
                        Enviar evaluación
                    </button>
                </div>

            </form>
        `;

    }


    function mostrarFeedback(mensaje, exito) {

        const feedback =
            document.querySelector("#evaluaciones-form-feedback");

        if (!feedback) return;

        feedback.hidden = false;

        feedback.textContent = mensaje;

        feedback.classList.toggle("evaluations-feedback--success", exito);
        feedback.classList.toggle("evaluations-feedback--error", !exito);

    }


    function conectarFormulario(formulario) {

        const form =
            document.querySelector("#evaluaciones-form");

        if (!form) return;

        form.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();

                const boton =
                    document.querySelector("#evaluaciones-form-submit");


                let colegaObjetivoId = null;

                if (formulario.objetivo === "colega_area") {

                    const select =
                        document.querySelector("#evaluaciones-colega-select");

                    colegaObjetivoId =
                        Number(select?.value);

                    if (!colegaObjetivoId) {

                        mostrarFeedback(
                            "Selecciona a un compañero para evaluar.",
                            false
                        );

                        return;

                    }

                }


                const respuestas = {};

                let completo = true;

                formulario.preguntas.forEach(
                    (pregunta) => {

                        const seleccionado =
                            form.querySelector(
                                `input[name="pregunta-${pregunta.id}"]:checked`
                            );

                        if (!seleccionado) {
                            completo = false;
                            return;
                        }

                        respuestas[pregunta.id] =
                            seleccionado.value;

                    }
                );

                if (!completo) {

                    mostrarFeedback(
                        "Debes responder todas las preguntas antes de enviar.",
                        false
                    );

                    return;

                }


                try {

                    if (boton) {
                        boton.disabled = true;
                        boton.textContent = "Enviando…";
                    }

                    const response =
                        await fetch(
                            `${API_URL}/evaluaciones/respuestas`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    ...headerUsuario()
                                },
                                body: JSON.stringify({
                                    formulario: formulario.slug,
                                    respuestas,
                                    colegaObjetivoId
                                })
                            }
                        );

                    const data =
                        await response.json();

                    if (!response.ok || !data.ok) {

                        throw new Error(
                            data.mensaje ||
                            "No fue posible registrar la evaluación."
                        );

                    }

                    await cargarEstado();

                    if (formulario.objetivo === "colega_area") {

                        const colegasRestantes =
                            estadoActual?.formularios?.[formulario.slug]?.colegas || [];

                        colegaSiguiente =
                            colegasRestantes.find((colega) => !colega.yaEvaluado)?.id ||
                            null;

                    }

                    pintarAvisoPeriodo();
                    pintarSubmenu();
                    renderContenido();

                }
                catch (error) {

                    console.error(
                        "ERROR AL ENVIAR EVALUACIÓN:",
                        error
                    );

                    mostrarFeedback(
                        error.message ||
                        "No fue posible registrar la evaluación.",
                        false
                    );

                    if (boton) {
                        boton.disabled = false;
                        boton.textContent = "Enviar evaluación";
                    }

                }

            }
        );

    }


    /* =====================================================
       CAMBIAR DE PESTAÑA
       ===================================================== */

    function mostrarTab(slug) {

        if (!FORMULARIOS_EVALUACION.some((formulario) => formulario.slug === slug)) {
            return;
        }

        tabActiva = slug;

        renderContenido();

    }


    botones.forEach(
        (boton) => {

            boton.addEventListener(
                "click",
                () => {

                    mostrarTab(boton.dataset.tab);

                }
            );

        }
    );


    /* =====================================================
       RENDER PRINCIPAL
       ===================================================== */

    async function render() {

        await cargarEstado();

        pintarAvisoPeriodo();
        pintarSubmenu();
        renderContenido();

    }


    return {
        render,
        getEstado: () => estadoActual
    };

}
