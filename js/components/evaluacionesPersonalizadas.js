/* =========================================================
   EVALUACIONES PERSONALIZADAS
   ---------------------------------------------------------
   Editor de formularios (estilo Google Forms) para el
   administrador, tarjetas con las evaluaciones creadas,
   formulario de respuesta y resultados con gráficas.
   Independiente de los periodos y de las 5 evaluaciones
   fijas (evaluacionesForm.js / evaluacionesResultados.js).
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    headerUsuario
} from "../services/auth.service.js";

import {
    confirmDialog,
    confirmarEliminacion,
    avisoDialog
} from "../services/confirmDialog.js";

import {
    ESCALA_LIKERT,
    obtenerEtiquetaLikert
} from "./evaluacionesCatalogo.js";


const TIPOS_PREGUNTA = [

    { valor: "opcion_multiple", etiqueta: "Opción múltiple (una respuesta)" },
    { valor: "casillas", etiqueta: "Casillas (varias respuestas)" },
    { valor: "likert", etiqueta: "Escala de Likert" },
    { valor: "texto", etiqueta: "Respuesta abierta" }

];

const MAX_PREGUNTAS = 50;
const MAX_OPCIONES = 12;


export function initEvaluacionesPersonalizadas() {

    const contenedor =
        document.querySelector("#evaluaciones-custom");

    if (!contenedor) {

        return {
            render: async () => {}
        };

    }


    /* =====================================================
       ESTADO
       ===================================================== */

    let pantalla = "lista";

    let evaluaciones = [];
    let puedeAdministrar = false;
    let puedeVerResultados = false;
    let cargando = false;

    let borrador = null;
    let evaluacionActiva = null;
    let resultados = null;
    let filtroDepartamento = "todos";
    let filtroArea = "todas";


    /* =====================================================
       UTILIDADES
       ===================================================== */

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


    function formatearFecha(valor) {

        if (!valor) return "";

        const fecha =
            new Date(`${String(valor).slice(0, 10)}T00:00:00`);

        if (Number.isNaN(fecha.getTime())) return "";

        return fecha.toLocaleDateString(
            "es-MX",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );

    }


    function porcentaje(cantidad, total) {

        if (!total) return 0;

        return Math.round((cantidad / total) * 100);

    }


    async function pedir(ruta, opciones = {}) {

        const response =
            await fetch(
                `${API_URL}${ruta}`,
                {
                    ...opciones,
                    headers: {
                        ...(opciones.body ? { "Content-Type": "application/json" } : {}),
                        ...headerUsuario()
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok || !data.ok) {

            throw new Error(
                data.mensaje ||
                "No fue posible completar la operación."
            );

        }

        return data;

    }


    function avisar(mensaje, exito = false) {

        const aviso =
            contenedor.querySelector(".eval-custom__feedback");

        if (!aviso) {

            avisoDialog(mensaje);

            return;

        }

        aviso.hidden = false;

        aviso.textContent = mensaje;

        aviso.classList.toggle("evaluations-feedback--success", exito);
        aviso.classList.toggle("evaluations-feedback--error", !exito);

    }


    /* =====================================================
       LISTA (TARJETAS)
       ===================================================== */

    async function cargarLista() {

        cargando = true;

        try {

            const data =
                await pedir("/evaluaciones/personalizadas");

            evaluaciones =
                data.evaluaciones || [];

            puedeAdministrar =
                Boolean(data.puedeAdministrar);

            puedeVerResultados =
                Boolean(data.puedeVerResultados);

        }
        catch (error) {

            console.error(
                "ERROR AL CARGAR EVALUACIONES PERSONALIZADAS:",
                error
            );

            evaluaciones = [];

            contenedor.innerHTML =
                `<p class="evaluations-empty">${escaparHTML(error.message)} Si acabas de actualizar el sistema, verifica que las tablas de evaluaciones personalizadas existan en la base de datos.</p>`;

            cargando = false;

            return false;

        }

        cargando = false;

        return true;

    }


    function construirTarjeta(evaluacion) {

        const abierta =
            evaluacion.vigente;

        const estado =
            abierta
                ? `<span class="eval-card__estado eval-card__estado--activa">● Activa</span>`
                : `<span class="eval-card__estado eval-card__estado--cerrada">● Cerrada</span>`;

        const cierre =
            evaluacion.fechaCierre
                ? `Cierra el ${formatearFecha(evaluacion.fechaCierre)}`
                : "Sin fecha de cierre";

        const acciones = [];

        if (!puedeAdministrar && abierta) {

            acciones.push(
                evaluacion.yaRespondido
                    ? `<span class="eval-card__hecho">✓ Ya respondiste</span>`
                    : `<button type="button" class="eval-card__btn eval-card__btn--primario" data-accion="responder" data-id="${evaluacion.id}">Responder</button>`
            );

        }

        if (puedeVerResultados) {

            acciones.push(
                `<button type="button" class="eval-card__btn" data-accion="resultados" data-id="${evaluacion.id}">Ver resultados</button>`
            );

        }

        if (puedeAdministrar) {

            acciones.push(
                `<button type="button" class="eval-card__btn" data-accion="alternar" data-id="${evaluacion.id}" data-activa="${evaluacion.activa ? "1" : "0"}">${evaluacion.activa ? "Cerrar" : "Reactivar"}</button>`
            );

        }

        return `
            <article class="innovation-card eval-card" data-id="${evaluacion.id}">

                <header class="innovation-card__header">
                    ${estado}
                    <span class="innovation-card__date">${escaparHTML(cierre)}</span>
                    ${
                        puedeAdministrar
                            ? `<button type="button" class="innovation-card__delete" data-accion="eliminar" data-id="${evaluacion.id}" aria-label="Eliminar evaluación">✕</button>`
                            : ""
                    }
                </header>

                <h3 class="innovation-card__title">${escaparHTML(evaluacion.titulo)}</h3>

                <p class="innovation-card__responsable eval-card__descripcion">${escaparHTML(evaluacion.descripcion || "Sin descripción")}</p>

                <p class="eval-card__meta">
                    ${evaluacion.preguntas.length} pregunta${evaluacion.preguntas.length === 1 ? "" : "s"}
                    ${puedeVerResultados ? ` · ${evaluacion.totalRespuestas} respuesta${evaluacion.totalRespuestas === 1 ? "" : "s"}` : ""}
                </p>

                <div class="innovation-card__files eval-card__acciones">
                    ${acciones.join("")}
                </div>

            </article>
        `;

    }


    function pintarLista() {

        pantalla = "lista";

        const tarjetas =
            evaluaciones.map(construirTarjeta).join("");

        const vacio =
            puedeAdministrar
                ? "Todavía no has creado evaluaciones. Usa “Nueva evaluación” para crear la primera."
                : "Por el momento no existen evaluaciones pendientes.";

        contenedor.innerHTML = `
            <div class="eval-custom__barra">

                <div>
                    <h2 class="innovations-list__title">Evaluaciones</h2>
                    <p class="evaluations-form__intro">
                        ${puedeAdministrar
                            ? "Crea evaluaciones a tu gusto, ciérralas cuando quieras y consulta sus resultados."
                            : "Responde las evaluaciones activas. Tus respuestas son anónimas."}
                    </p>
                </div>

                ${
                    puedeAdministrar
                        ? `<button type="button" class="eval-custom__btn-principal" data-accion="nueva">＋ Nueva evaluación</button>`
                        : ""
                }

            </div>

            <p class="eval-custom__feedback evaluations-feedback" hidden></p>

            ${
                evaluaciones.length
                    ? `<div class="innovations-list__grid">${tarjetas}</div>`
                    : `<p class="evaluations-empty">${vacio}</p>`
            }
        `;

    }


    /* =====================================================
       EDITOR
       ===================================================== */

    function preguntaNueva(tipo = "opcion_multiple") {

        return {

            tipo,
            texto: "",
            requerida: true,

            opciones:
                tipo === "opcion_multiple" || tipo === "casillas"
                    ? ["Opción 1", "Opción 2"]
                    : []

        };

    }


    function abrirEditor() {

        borrador = {
            titulo: "",
            descripcion: "",
            fechaCierre: "",
            destinatarios: {
                lider: true,
                operador: true
            },
            preguntas: [preguntaNueva()]
        };

        pintarEditor();

    }


    function construirPreguntaEditor(pregunta, indice, total) {

        const usaOpciones =
            pregunta.tipo === "opcion_multiple" ||
            pregunta.tipo === "casillas";

        const opcionesHTML =
            usaOpciones
                ? `
                    <div class="eval-editor__opciones">

                        ${pregunta.opciones.map(
                            (opcion, posicion) => `
                                <div class="eval-editor__opcion">
                                    <span class="eval-editor__marca eval-editor__marca--${pregunta.tipo}"></span>
                                    <input
                                        type="text"
                                        value="${escaparHTML(opcion)}"
                                        maxlength="200"
                                        data-campo="q-opcion"
                                        data-o="${posicion}"
                                        aria-label="Opción ${posicion + 1}"
                                    >
                                    <button
                                        type="button"
                                        class="eval-editor__icono"
                                        data-accion="quitar-opcion"
                                        data-o="${posicion}"
                                        aria-label="Quitar opción"
                                        ${pregunta.opciones.length <= 2 ? "disabled" : ""}
                                    >✕</button>
                                </div>
                            `
                        ).join("")}

                        ${
                            pregunta.opciones.length < MAX_OPCIONES
                                ? `<button type="button" class="eval-editor__agregar-opcion" data-accion="agregar-opcion">＋ Agregar opción</button>`
                                : ""
                        }

                    </div>
                `
                : pregunta.tipo === "likert"
                    ? `
                        <div class="evaluations-question__opciones eval-editor__vista-previa">
                            ${ESCALA_LIKERT.map(
                                (opcion) => `<span class="evaluations-question__opcion">${escaparHTML(opcion.etiqueta)}</span>`
                            ).join("")}
                        </div>
                    `
                    : `<p class="eval-editor__vista-previa-texto">Los usuarios escribirán su respuesta aquí.</p>`;

        return `
            <div class="eval-editor__pregunta" data-q="${indice}">

                <div class="eval-editor__pregunta-top">

                    <span class="eval-editor__numero">${indice + 1}</span>

                    <input
                        type="text"
                        class="eval-editor__texto"
                        placeholder="Escribe la pregunta"
                        value="${escaparHTML(pregunta.texto)}"
                        maxlength="500"
                        data-campo="q-texto"
                    >

                    <select data-campo="q-tipo" aria-label="Tipo de pregunta">
                        ${TIPOS_PREGUNTA.map(
                            (tipo) => `<option value="${tipo.valor}" ${tipo.valor === pregunta.tipo ? "selected" : ""}>${tipo.etiqueta}</option>`
                        ).join("")}
                    </select>

                </div>

                ${opcionesHTML}

                <div class="eval-editor__pregunta-pie">

                    <label class="eval-editor__requerida">
                        <input type="checkbox" data-campo="q-requerida" ${pregunta.requerida ? "checked" : ""}>
                        Obligatoria
                    </label>

                    <div class="eval-editor__herramientas">
                        <button type="button" class="eval-editor__icono" data-accion="subir" aria-label="Subir pregunta" ${indice === 0 ? "disabled" : ""}>↑</button>
                        <button type="button" class="eval-editor__icono" data-accion="bajar" aria-label="Bajar pregunta" ${indice === total - 1 ? "disabled" : ""}>↓</button>
                        <button type="button" class="eval-editor__icono" data-accion="duplicar" aria-label="Duplicar pregunta" ${total >= MAX_PREGUNTAS ? "disabled" : ""}>⧉</button>
                        <button type="button" class="eval-editor__icono eval-editor__icono--peligro" data-accion="eliminar-pregunta" aria-label="Eliminar pregunta" ${total <= 1 ? "disabled" : ""}>🗑</button>
                    </div>

                </div>

            </div>
        `;

    }


    function pintarEditor() {

        pantalla = "editor";

        contenedor.innerHTML = `
            <div class="eval-editor">

                <button type="button" class="view__back" data-accion="cancelar">← Volver a las evaluaciones</button>

                <div class="eval-editor__cabecera">

                    <input
                        type="text"
                        class="eval-editor__titulo"
                        placeholder="Título de la evaluación"
                        value="${escaparHTML(borrador.titulo)}"
                        maxlength="200"
                        data-campo="titulo"
                    >

                    <textarea
                        class="eval-editor__descripcion"
                        placeholder="Descripción o instrucciones (opcional)"
                        rows="2"
                        maxlength="2000"
                        data-campo="descripcion"
                    >${escaparHTML(borrador.descripcion)}</textarea>

                    <div class="evaluations-resultados__campo">
                        <label for="eval-editor-cierre">Fecha de cierre (opcional)</label>
                        <input
                            type="date"
                            id="eval-editor-cierre"
                            value="${escaparHTML(borrador.fechaCierre)}"
                            data-campo="fechaCierre"
                        >
                    </div>

                    <div class="eval-editor__destinatarios">

                        <span class="eval-editor__destinatarios-titulo">Enviar a</span>

                        <label class="eval-switch">
                            <input
                                type="checkbox"
                                role="switch"
                                data-campo="dest-lider"
                                ${borrador.destinatarios.lider ? "checked" : ""}
                            >
                            <span class="eval-switch__pista"></span>
                            Líderes
                        </label>

                        <label class="eval-switch">
                            <input
                                type="checkbox"
                                role="switch"
                                data-campo="dest-operador"
                                ${borrador.destinatarios.operador ? "checked" : ""}
                            >
                            <span class="eval-switch__pista"></span>
                            Operadores
                        </label>

                    </div>

                </div>

                <div class="eval-editor__lista">
                    ${borrador.preguntas.map(
                        (pregunta, indice) => construirPreguntaEditor(pregunta, indice, borrador.preguntas.length)
                    ).join("")}
                </div>

                <button
                    type="button"
                    class="eval-editor__agregar-pregunta"
                    data-accion="agregar-pregunta"
                    ${borrador.preguntas.length >= MAX_PREGUNTAS ? "disabled" : ""}
                >＋ Agregar pregunta</button>

                <p class="eval-custom__feedback evaluations-feedback" hidden></p>

                <div class="evaluations-form__actions">
                    <button type="button" class="eval-custom__btn-secundario" data-accion="cancelar">Cancelar</button>
                    <button type="button" class="evaluations-form__submit" data-accion="guardar">Guardar evaluación</button>
                </div>

            </div>
        `;

    }


    function preguntaDesdeElemento(elemento) {

        const bloque =
            elemento.closest("[data-q]");

        if (!bloque) return null;

        return {
            indice: Number(bloque.dataset.q),
            pregunta: borrador.preguntas[Number(bloque.dataset.q)]
        };

    }


    function alEditarCampo(event) {

        if (pantalla !== "editor" || !borrador) return;

        const campo =
            event.target.dataset?.campo;

        if (!campo) return;

        if (campo === "titulo" || campo === "descripcion" || campo === "fechaCierre") {

            borrador[campo] = event.target.value;

            return;

        }

        if (campo === "dest-lider" || campo === "dest-operador") {

            borrador.destinatarios[campo.replace("dest-", "")] =
                event.target.checked;

            return;

        }

        const contexto =
            preguntaDesdeElemento(event.target);

        if (!contexto) return;

        const { pregunta } =
            contexto;

        if (campo === "q-texto") {

            pregunta.texto = event.target.value;

        }
        else if (campo === "q-opcion") {

            pregunta.opciones[Number(event.target.dataset.o)] =
                event.target.value;

        }
        else if (campo === "q-requerida") {

            pregunta.requerida = event.target.checked;

        }
        else if (campo === "q-tipo" && event.type === "change") {

            pregunta.tipo = event.target.value;

            if (pregunta.tipo === "opcion_multiple" || pregunta.tipo === "casillas") {

                if (pregunta.opciones.length < 2) {
                    pregunta.opciones = ["Opción 1", "Opción 2"];
                }

            }
            else {

                pregunta.opciones = [];

            }

            pintarEditor();

        }

    }


    async function accionEditor(accion, boton) {

        const contexto =
            preguntaDesdeElemento(boton);

        const indice =
            contexto?.indice;

        if (accion === "agregar-pregunta") {

            if (borrador.preguntas.length < MAX_PREGUNTAS) {

                borrador.preguntas.push(preguntaNueva());

                pintarEditor();

                contenedor
                    .querySelector(".eval-editor__pregunta:last-child .eval-editor__texto")
                    ?.focus();

            }

        }
        else if (accion === "eliminar-pregunta" && borrador.preguntas.length > 1) {

            const confirmado =
                await confirmarEliminacion(
                    "¿Eliminar esta pregunta y sus opciones? Esta acción no se puede deshacer."
                );

            if (!confirmado) return;

            borrador.preguntas.splice(indice, 1);

            pintarEditor();

        }
        else if (accion === "duplicar" && borrador.preguntas.length < MAX_PREGUNTAS) {

            borrador.preguntas.splice(
                indice + 1,
                0,
                JSON.parse(JSON.stringify(borrador.preguntas[indice]))
            );

            pintarEditor();

        }
        else if (accion === "subir" && indice > 0) {

            [borrador.preguntas[indice - 1], borrador.preguntas[indice]] =
                [borrador.preguntas[indice], borrador.preguntas[indice - 1]];

            pintarEditor();

        }
        else if (accion === "bajar" && indice < borrador.preguntas.length - 1) {

            [borrador.preguntas[indice + 1], borrador.preguntas[indice]] =
                [borrador.preguntas[indice], borrador.preguntas[indice + 1]];

            pintarEditor();

        }
        else if (accion === "agregar-opcion") {

            const { pregunta } = contexto;

            if (pregunta.opciones.length < MAX_OPCIONES) {

                pregunta.opciones.push(`Opción ${pregunta.opciones.length + 1}`);

                pintarEditor();

                contenedor
                    .querySelectorAll(`[data-q="${indice}"] .eval-editor__opcion input`)
                    ?.[pregunta.opciones.length - 1]
                    ?.select();

            }

        }
        else if (accion === "quitar-opcion") {

            const { pregunta } = contexto;

            if (pregunta.opciones.length > 2) {

                const confirmado =
                    await confirmarEliminacion(
                        "¿Eliminar esta opción?"
                    );

                if (!confirmado) return;

                pregunta.opciones.splice(Number(boton.dataset.o), 1);

                pintarEditor();

            }

        }

    }


    function validarBorrador() {

        if (!borrador.titulo.trim()) {
            return "Escribe un título para la evaluación.";
        }

        if (!borrador.destinatarios.lider && !borrador.destinatarios.operador) {
            return "Activa al menos un destinatario: líderes u operadores.";
        }

        for (let i = 0; i < borrador.preguntas.length; i++) {

            const pregunta = borrador.preguntas[i];

            if (!pregunta.texto.trim()) {
                return `La pregunta ${i + 1} no tiene texto.`;
            }

            if (pregunta.tipo === "opcion_multiple" || pregunta.tipo === "casillas") {

                const opciones =
                    pregunta.opciones.map((opcion) => opcion.trim());

                if (opciones.some((opcion) => !opcion)) {
                    return `La pregunta ${i + 1} tiene opciones vacías.`;
                }

                if (new Set(opciones.map((opcion) => opcion.toLowerCase())).size !== opciones.length) {
                    return `La pregunta ${i + 1} tiene opciones repetidas.`;
                }

            }

        }

        return null;

    }


    async function guardarBorrador(boton) {

        const error =
            validarBorrador();

        if (error) {

            avisar(error);

            return;

        }

        try {

            boton.disabled = true;
            boton.textContent = "Guardando…";

            await pedir(
                "/evaluaciones/personalizadas",
                {
                    method: "POST",
                    body: JSON.stringify({
                        titulo: borrador.titulo.trim(),
                        descripcion: borrador.descripcion.trim(),
                        fechaCierre: borrador.fechaCierre || null,
                        destinatarios:
                            Object.keys(borrador.destinatarios)
                                .filter((rol) => borrador.destinatarios[rol]),
                        preguntas:
                            borrador.preguntas.map(
                                (pregunta) => ({
                                    tipo: pregunta.tipo,
                                    texto: pregunta.texto.trim(),
                                    requerida: pregunta.requerida,
                                    opciones: pregunta.opciones.map((opcion) => opcion.trim())
                                })
                            )
                    })
                }
            );

            borrador = null;

            await mostrarLista();

        }
        catch (errorGuardar) {

            console.error(
                "ERROR AL GUARDAR EVALUACIÓN PERSONALIZADA:",
                errorGuardar
            );

            avisar(errorGuardar.message);

            boton.disabled = false;
            boton.textContent = "Guardar evaluación";

        }

    }


    /* =====================================================
       RESPONDER
       ===================================================== */

    function abrirResponder(id) {

        evaluacionActiva =
            evaluaciones.find((evaluacion) => evaluacion.id === id);

        if (!evaluacionActiva) return;

        pintarResponder();

    }


    function construirCampoRespuesta(pregunta) {

        if (pregunta.tipo === "opcion_multiple" || pregunta.tipo === "casillas") {

            const tipoInput =
                pregunta.tipo === "casillas" ? "checkbox" : "radio";

            return `
                <div class="eval-responder__opciones">
                    ${pregunta.opciones.map(
                        (opcion) => `
                            <label class="evaluations-question__opcion">
                                <input type="${tipoInput}" name="pregunta-${pregunta.id}" value="${opcion.id}">
                                ${escaparHTML(opcion.texto)}
                            </label>
                        `
                    ).join("")}
                </div>
            `;

        }

        if (pregunta.tipo === "likert") {

            return `
                <div class="evaluations-question__opciones">
                    ${ESCALA_LIKERT.map(
                        (opcion) => `
                            <label class="evaluations-question__opcion">
                                <input type="radio" name="pregunta-${pregunta.id}" value="${opcion.valor}">
                                ${escaparHTML(opcion.etiqueta)}
                            </label>
                        `
                    ).join("")}
                </div>
            `;

        }

        return `
            <textarea
                class="eval-responder__texto"
                name="pregunta-${pregunta.id}"
                rows="3"
                maxlength="2000"
                placeholder="Escribe tu respuesta"
            ></textarea>
        `;

    }


    function pintarResponder() {

        pantalla = "responder";

        contenedor.innerHTML = `
            <button type="button" class="view__back" data-accion="volver">← Volver a las evaluaciones</button>

            <form id="eval-responder-form" class="evaluations-form" novalidate>

                <div class="eval-responder__cabecera">
                    <h2 class="innovations-list__title">${escaparHTML(evaluacionActiva.titulo)}</h2>
                    ${evaluacionActiva.descripcion ? `<p class="evaluations-form__intro">${escaparHTML(evaluacionActiva.descripcion)}</p>` : ""}
                    <p class="evaluations-form__intro">Tus respuestas son anónimas. Las preguntas con * son obligatorias.</p>
                </div>

                <div class="evaluations-question-list">
                    ${evaluacionActiva.preguntas.map(
                        (pregunta) => `
                            <div class="evaluations-question" data-pid="${pregunta.id}">
                                <p class="evaluations-question__texto">
                                    ${escaparHTML(pregunta.texto)}${pregunta.requerida ? " <span class=\"eval-responder__asterisco\">*</span>" : ""}
                                </p>
                                ${construirCampoRespuesta(pregunta)}
                            </div>
                        `
                    ).join("")}
                </div>

                <p class="eval-custom__feedback evaluations-feedback" hidden></p>

                <div class="evaluations-form__actions">
                    <button type="submit" class="evaluations-form__submit">Enviar evaluación</button>
                </div>

            </form>
        `;

    }


    async function enviarRespuestas(form) {

        const respuestas = {};

        for (const pregunta of evaluacionActiva.preguntas) {

            const nombre =
                `pregunta-${pregunta.id}`;

            let valor;

            if (pregunta.tipo === "casillas") {

                valor =
                    Array.from(form.querySelectorAll(`input[name="${nombre}"]:checked`))
                        .map((input) => input.value);

                if (!valor.length) valor = undefined;

            }
            else if (pregunta.tipo === "texto") {

                valor =
                    form.querySelector(`[name="${nombre}"]`)?.value.trim() || undefined;

            }
            else {

                valor =
                    form.querySelector(`input[name="${nombre}"]:checked`)?.value;

            }

            if (valor === undefined) {

                if (pregunta.requerida) {

                    avisar(`Falta responder: "${pregunta.texto}"`);

                    form.querySelector(`[data-pid="${pregunta.id}"]`)
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });

                    return;

                }

                continue;

            }

            respuestas[pregunta.id] = valor;

        }

        const boton =
            form.querySelector("button[type=\"submit\"]");

        try {

            boton.disabled = true;
            boton.textContent = "Enviando…";

            await pedir(
                `/evaluaciones/personalizadas/${evaluacionActiva.id}/respuestas`,
                {
                    method: "POST",
                    body: JSON.stringify({ respuestas })
                }
            );

            await mostrarLista();

            avisar("¡Gracias! Tu evaluación fue registrada.", true);

        }
        catch (error) {

            console.error(
                "ERROR AL ENVIAR EVALUACIÓN PERSONALIZADA:",
                error
            );

            avisar(error.message);

            boton.disabled = false;
            boton.textContent = "Enviar evaluación";

        }

    }


    /* =====================================================
       RESULTADOS
       ===================================================== */

    async function abrirResultados(id, conservarFiltros = false) {

        if (!conservarFiltros) {

            filtroDepartamento = "todos";
            filtroArea = "todas";

        }

        try {

            resultados =
                await pedir(
                    `/evaluaciones/personalizadas/${id}/resultados?departamento=${encodeURIComponent(filtroDepartamento)}&area=${encodeURIComponent(filtroArea)}`
                );

        }
        catch (error) {

            console.error(
                "ERROR AL CARGAR RESULTADOS PERSONALIZADOS:",
                error
            );

            avisar(error.message);

            return;

        }

        pintarResultados();

    }


    function construirGrafica(pregunta) {

        if (pregunta.tipo === "opcion_multiple" || pregunta.tipo === "casillas") {

            return `
                <div class="eval-grafica">
                    ${pregunta.opciones.map(
                        (opcion) => {

                            const pct =
                                porcentaje(opcion.cantidad, pregunta.totalRespuestas);

                            return `
                                <div class="eval-grafica__fila">
                                    <span class="eval-grafica__etiqueta">${escaparHTML(opcion.texto)}</span>
                                    <div class="eval-grafica__pista">
                                        <div class="eval-grafica__relleno" style="width: ${pct}%"></div>
                                    </div>
                                    <span class="eval-grafica__valor">${opcion.cantidad} · ${pct}%</span>
                                </div>
                            `;

                        }
                    ).join("")}
                </div>
            `;

        }

        if (pregunta.tipo === "likert") {

            const segmentos =
                ESCALA_LIKERT.map(
                    (opcion) => {

                        const cantidad =
                            pregunta.distribucion[opcion.valor] || 0;

                        if (!cantidad) return "";

                        return `
                            <div
                                class="evaluations-resultados__segmento evaluations-resultados__segmento--${opcion.valor}"
                                style="width: ${(cantidad / pregunta.totalRespuestas) * 100}%"
                                title="${escaparHTML(opcion.etiqueta)}: ${cantidad}"
                            ></div>
                        `;

                    }
                ).join("");

            return `
                <div class="evaluations-resultados__barra">${segmentos}</div>

                <div class="eval-grafica eval-grafica--likert">
                    ${ESCALA_LIKERT.map(
                        (opcion) => {

                            const cantidad =
                                pregunta.distribucion[opcion.valor] || 0;

                            return `
                                <div class="eval-grafica__fila">
                                    <span class="eval-grafica__etiqueta">
                                        <span class="evaluations-resultados__leyenda-punto eval-punto--${opcion.valor}"></span>
                                        ${escaparHTML(opcion.etiqueta)}
                                    </span>
                                    <span class="eval-grafica__valor">${cantidad} · ${porcentaje(cantidad, pregunta.totalRespuestas)}%</span>
                                </div>
                            `;

                        }
                    ).join("")}
                </div>
            `;

        }

        return pregunta.comentarios.length
            ? `
                <ul class="eval-comentarios">
                    ${pregunta.comentarios.map(
                        (comentario) => `<li>${escaparHTML(comentario)}</li>`
                    ).join("")}
                </ul>
            `
            : "";

    }


    function pintarResultados() {

        pantalla = "resultados";

        const {
            evaluacion,
            total,
            totalGeneral,
            elegibles,
            promedioLikertGlobal,
            filtros,
            preguntas
        } = resultados;

        const participacion =
            Math.min(100, porcentaje(totalGeneral, elegibles));

        const opcionesFiltro = (lista, actual, valorTodos, etiquetaTodos) =>
            [`<option value="${valorTodos}">${etiquetaTodos}</option>`]
                .concat(
                    lista.map(
                        (valor) => `<option value="${escaparHTML(valor)}" ${valor === actual ? "selected" : ""}>${escaparHTML(valor)}</option>`
                    )
                )
                .join("");

        contenedor.innerHTML = `
            <button type="button" class="view__back" data-accion="volver">← Volver a las evaluaciones</button>

            <div class="eval-resultados__cabecera">

                <div>
                    <h2 class="innovations-list__title">${escaparHTML(evaluacion.titulo)}</h2>
                    ${evaluacion.descripcion ? `<p class="evaluations-form__intro">${escaparHTML(evaluacion.descripcion)}</p>` : ""}
                </div>

                <button
                    type="button"
                    class="evaluations-resultados__btn-pdf"
                    data-accion="exportar"
                    ${total ? "" : "disabled"}
                >Exportar CSV</button>

            </div>

            <div class="eval-resumen">

                <div class="eval-resumen__tarjeta">
                    <span class="eval-resumen__valor">${total}</span>
                    <span class="eval-resumen__etiqueta">Respuesta${total === 1 ? "" : "s"}${total !== totalGeneral ? ` (de ${totalGeneral} en total)` : ""}</span>
                </div>

                <div class="eval-resumen__tarjeta">
                    <span class="eval-resumen__valor">${participacion}%</span>
                    <span class="eval-resumen__etiqueta">Participación (${totalGeneral} de ${elegibles} usuarios)</span>
                    <div class="eval-grafica__pista"><div class="eval-grafica__relleno" style="width: ${participacion}%"></div></div>
                </div>

                ${
                    promedioLikertGlobal !== null
                        ? `
                            <div class="eval-resumen__tarjeta">
                                <span class="eval-resumen__valor">${promedioLikertGlobal} <small>/ 5</small></span>
                                <span class="eval-resumen__etiqueta">Promedio de preguntas Likert</span>
                            </div>
                        `
                        : ""
                }

                <div class="eval-resumen__tarjeta">
                    <span class="eval-resumen__valor eval-resumen__valor--${evaluacion.vigente ? "activa" : "cerrada"}">${evaluacion.vigente ? "Activa" : "Cerrada"}</span>
                    <span class="eval-resumen__etiqueta">${evaluacion.fechaCierre ? `Cierra el ${escaparHTML(formatearFecha(evaluacion.fechaCierre))}` : "Sin fecha de cierre"}</span>
                </div>

            </div>

            <div class="evaluations-resultados__controles">

                <div class="evaluations-resultados__campo">
                    <label for="eval-filtro-departamento">Departamento</label>
                    <select id="eval-filtro-departamento" data-filtro="departamento">
                        ${opcionesFiltro(filtros.departamentos, filtroDepartamento, "todos", "Todos los departamentos")}
                    </select>
                </div>

                <div class="evaluations-resultados__campo">
                    <label for="eval-filtro-area">Área</label>
                    <select id="eval-filtro-area" data-filtro="area">
                        ${opcionesFiltro(filtros.areas, filtroArea, "todas", "Todas las áreas")}
                    </select>
                </div>

            </div>

            <p class="eval-custom__feedback evaluations-feedback" hidden></p>

            ${
                total
                    ? `
                        <div class="evaluations-resultados__lista">
                            ${preguntas.map(
                                (pregunta, indice) => `
                                    <article class="evaluations-resultados__pregunta">

                                        <div class="evaluations-resultados__pregunta-top">
                                            <p class="evaluations-resultados__pregunta-texto">${indice + 1}. ${escaparHTML(pregunta.texto)}</p>
                                            <span class="evaluations-resultados__promedio">
                                                ${
                                                    pregunta.tipo === "likert"
                                                        ? (pregunta.promedio !== null ? `${pregunta.promedio} / 5` : "Sin datos")
                                                        : `${pregunta.totalRespuestas} resp.`
                                                }
                                            </span>
                                        </div>

                                        ${pregunta.totalRespuestas ? construirGrafica(pregunta) : `<p class="evaluations-form__intro">Sin respuestas para esta pregunta.</p>`}

                                    </article>
                                `
                            ).join("")}
                        </div>
                    `
                    : `<p class="evaluations-empty">Aún no hay respuestas${total !== totalGeneral || filtroDepartamento !== "todos" || filtroArea !== "todas" ? " con estos filtros" : ""}.</p>`
            }
        `;

    }


    /* =====================================================
       EXPORTAR A CSV
       ===================================================== */

    function celdaCSV(valor) {

        const texto =
            String(valor ?? "");

        return /[",\n\r]/.test(texto)
            ? `"${texto.replace(/"/g, "\"\"")}"`
            : texto;

    }


    async function exportarCSV(boton) {

        try {

            boton.disabled = true;

            const data =
                await pedir(
                    `/evaluaciones/personalizadas/${resultados.evaluacion.id}/exportar?departamento=${encodeURIComponent(filtroDepartamento)}&area=${encodeURIComponent(filtroArea)}`
                );

            const encabezados = [
                "Fecha",
                "Departamento",
                "Área",
                ...data.preguntas.map((pregunta) => pregunta.texto)
            ];

            const filas =
                data.respuestas.map(
                    (fila) => [
                        formatearFecha(fila.creadoEn),
                        fila.departamento || "",
                        fila.area || "",
                        ...data.preguntas.map(
                            (pregunta) => {

                                const valor =
                                    fila.respuestas[pregunta.id];

                                if (valor === undefined) return "";

                                const textoOpcion = (id) =>
                                    pregunta.opciones.find((opcion) => opcion.id === id)?.texto || id;

                                if (pregunta.tipo === "casillas") {
                                    return valor.map(textoOpcion).join(" | ");
                                }

                                if (pregunta.tipo === "opcion_multiple") {
                                    return textoOpcion(valor);
                                }

                                if (pregunta.tipo === "likert") {
                                    return obtenerEtiquetaLikert(valor);
                                }

                                return valor;

                            }
                        )
                    ]
                );

            const csv =
                [encabezados, ...filas]
                    .map((fila) => fila.map(celdaCSV).join(","))
                    .join("\r\n");

            const blob =
                new Blob(
                    ["﻿" + csv],
                    { type: "text/csv;charset=utf-8" }
                );

            const enlace =
                document.createElement("a");

            enlace.href =
                URL.createObjectURL(blob);

            enlace.download =
                `evaluacion_${data.titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "resultados"}.csv`;

            document.body.appendChild(enlace);
            enlace.click();
            enlace.remove();

            URL.revokeObjectURL(enlace.href);

        }
        catch (error) {

            console.error(
                "ERROR AL EXPORTAR CSV:",
                error
            );

            avisar(error.message);

        }
        finally {

            boton.disabled = false;

        }

    }


    /* =====================================================
       ACCIONES DE LA LISTA
       ===================================================== */

    async function alternarActiva(id, activaActual) {

        try {

            await pedir(
                `/evaluaciones/personalizadas/${id}`,
                {
                    method: "PATCH",
                    body: JSON.stringify({ activa: !activaActual })
                }
            );

            await mostrarLista();

        }
        catch (error) {

            console.error(
                "ERROR AL CAMBIAR ESTADO DE EVALUACIÓN:",
                error
            );

            avisar(error.message);

        }

    }


    async function eliminarEvaluacion(id) {

        const evaluacion =
            evaluaciones.find((item) => item.id === id);

        const confirmado =
            await confirmDialog(
                `¿Estás seguro de que quieres eliminar "${evaluacion?.titulo || "esta evaluación"}"? Se borrarán también todas sus respuestas y resultados. Esta acción no se puede deshacer.`,
                {
                    danger: true,
                    acceptLabel: "Sí, eliminar",
                    cancelLabel: "Cancelar"
                }
            );

        if (!confirmado) return;

        try {

            await pedir(
                `/evaluaciones/personalizadas/${id}`,
                {
                    method: "DELETE"
                }
            );

            await mostrarLista();

        }
        catch (error) {

            console.error(
                "ERROR AL ELIMINAR EVALUACIÓN PERSONALIZADA:",
                error
            );

            avisar(error.message);

        }

    }


    async function mostrarLista() {

        if (await cargarLista()) {

            pintarLista();

        }

    }


    /* =====================================================
       EVENTOS
       ===================================================== */

    contenedor.addEventListener("input", alEditarCampo);
    contenedor.addEventListener("change", alEditarCampo);


    contenedor.addEventListener(
        "change",
        async (event) => {

            const filtro =
                event.target.dataset?.filtro;

            if (!filtro || pantalla !== "resultados") return;

            if (filtro === "departamento") {
                filtroDepartamento = event.target.value;
            }
            else {
                filtroArea = event.target.value;
            }

            await abrirResultados(resultados.evaluacion.id, true);

        }
    );


    contenedor.addEventListener(
        "submit",
        (event) => {

            event.preventDefault();

            if (pantalla === "responder") {

                enviarRespuestas(event.target);

            }

        }
    );


    contenedor.addEventListener(
        "click",
        async (event) => {

            const boton =
                event.target.closest("[data-accion]");

            if (!boton) {

                /* clic en el cuerpo de una tarjeta: acción principal */

                const tarjeta =
                    event.target.closest(".eval-card");

                if (tarjeta && pantalla === "lista") {

                    const id =
                        Number(tarjeta.dataset.id);

                    const evaluacion =
                        evaluaciones.find((item) => item.id === id);

                    if (!evaluacion) return;

                    if (puedeVerResultados) {
                        abrirResultados(id);
                    }
                    else if (evaluacion.vigente && !evaluacion.yaRespondido) {
                        abrirResponder(id);
                    }

                }

                return;

            }

            const accion =
                boton.dataset.accion;

            const id =
                Number(boton.dataset.id);

            if (accion === "nueva") {
                abrirEditor();
            }
            else if (accion === "cancelar" || accion === "volver") {
                await mostrarLista();
            }
            else if (accion === "guardar") {
                guardarBorrador(boton);
            }
            else if (accion === "responder") {
                abrirResponder(id);
            }
            else if (accion === "resultados") {
                abrirResultados(id);
            }
            else if (accion === "alternar") {
                alternarActiva(id, boton.dataset.activa === "1");
            }
            else if (accion === "eliminar") {
                eliminarEvaluacion(id);
            }
            else if (accion === "exportar") {
                exportarCSV(boton);
            }
            else if (pantalla === "editor") {
                accionEditor(accion, boton);
            }

        }
    );


    /* =====================================================
       RENDER PRINCIPAL
       ---------------------------------------------------------
       Al entrar a la vista se vuelve a la lista de tarjetas y
       se descarta cualquier borrador sin guardar.
       ===================================================== */

    async function render() {

        borrador = null;
        resultados = null;

        await mostrarLista();

    }


    return {
        render
    };

}
