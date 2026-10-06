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
const MAX_VALOR_RESPUESTA = 1000;
const MAX_LIMITE_RESPUESTAS = 100000;

/* roles que pueden responder evaluaciones (los administradores no) */
const ROLES_DESTINATARIOS = [

    { valor: "lider", etiqueta: "Líder" },
    { valor: "operador", etiqueta: "Operador" }

];


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

    /* usuarios que pueden recibir la evaluación y filtros del editor */
    let usuariosDestino = [];
    let filtroDestino = {
        departamento: "",
        area: "",
        rol: "",
        busqueda: ""
    };

    let evaluacionActiva = null;
    let resultados = null;
    let filtroDepartamento = "todos";
    let filtroArea = "todas";

    /* filtros de la lista de tarjetas (se conservan al volver a ella) */
    let busquedaLista = "";
    let estadoLista = "todas";
    let ordenLista = "creado_desc";


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


    /*
     * creado_en es fecha y hora (llega en UTC); a diferencia de
     * fecha_cierre no se puede cortar a 10 caracteres sin
     * arriesgar que salga el día siguiente por la zona horaria.
     */
    function formatearCreacion(valor) {

        const fecha =
            new Date(valor);

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
                : `<span class="eval-card__estado eval-card__estado--cerrada">● Cerrada${evaluacion.activa && evaluacion.limiteAlcanzado ? " · límite alcanzado" : ""}</span>`;

        const respuestasTexto =
            evaluacion.limiteRespuestas !== null
                ? `${evaluacion.totalRespuestas} / ${evaluacion.limiteRespuestas} respuestas`
                : `${evaluacion.totalRespuestas} respuesta${evaluacion.totalRespuestas === 1 ? "" : "s"}`;

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
                    ${evaluacion.creadoEn ? `Creada el ${escaparHTML(formatearCreacion(evaluacion.creadoEn))} · ` : ""}
                    ${evaluacion.preguntas.length} pregunta${evaluacion.preguntas.length === 1 ? "" : "s"}
                    ${puedeVerResultados ? ` · ${respuestasTexto}` : ""}
                    ${puedeAdministrar && evaluacion.totalDestinatarios ? ` · enviada a ${evaluacion.totalDestinatarios} usuario${evaluacion.totalDestinatarios === 1 ? "" : "s"}` : ""}
                </p>

                <div class="innovation-card__files eval-card__acciones">
                    ${acciones.join("")}
                </div>

            </article>
        `;

    }


    const OPCIONES_ORDEN = [
        { valor: "creado_desc", texto: "Más recientes primero" },
        { valor: "creado_asc", texto: "Más antiguas primero" },
        { valor: "cierre_asc", texto: "Cierre más próximo" },
        { valor: "cierre_desc", texto: "Cierre más lejano" },
        { valor: "titulo_asc", texto: "Título (A-Z)" },
        { valor: "titulo_desc", texto: "Título (Z-A)" },
        { valor: "respuestas_desc", texto: "Más respuestas", soloResultados: true }
    ];


    function marcaDeTiempo(valor) {

        const tiempo =
            valor ? new Date(valor).getTime() : NaN;

        return Number.isNaN(tiempo) ? null : tiempo;

    }


    /*
     * Compara por fecha dejando siempre al final las que no
     * tienen (p. ej. "Sin fecha de cierre"), sin importar si el
     * orden es ascendente o descendente.
     */
    function compararFechas(a, b, descendente) {

        if (a === null && b === null) return 0;
        if (a === null) return 1;
        if (b === null) return -1;

        return descendente ? b - a : a - b;

    }


    function evaluacionesFiltradas() {

        const texto =
            busquedaLista.trim().toLowerCase();

        const filtradas =
            evaluaciones.filter(
                (evaluacion) =>
                    (
                        estadoLista === "todas" ||
                        (estadoLista === "activas") === evaluacion.vigente
                    ) &&
                    (
                        !texto ||
                        `${evaluacion.titulo} ${evaluacion.descripcion || ""}`
                            .toLowerCase()
                            .includes(texto)
                    )
            );

        const [criterio, direccion] =
            ordenLista.split("_");

        const descendente =
            direccion === "desc";

        return filtradas.sort(
            (a, b) => {

                if (criterio === "titulo") {

                    const resultado =
                        a.titulo.localeCompare(b.titulo, "es", { sensitivity: "base", numeric: true });

                    return descendente ? -resultado : resultado;

                }

                if (criterio === "respuestas") {

                    return (b.totalRespuestas || 0) - (a.totalRespuestas || 0);

                }

                const campo =
                    criterio === "cierre" ? "fechaCierre" : "creadoEn";

                return (
                    compararFechas(marcaDeTiempo(a[campo]), marcaDeTiempo(b[campo]), descendente) ||
                    compararFechas(marcaDeTiempo(a.creadoEn), marcaDeTiempo(b.creadoEn), true)
                );

            }
        );

    }


    /*
     * Solo se repintan las tarjetas (no la barra de filtros)
     * para que el cuadro de búsqueda no pierda el foco al
     * escribir.
     */
    function pintarTarjetas() {

        const lista =
            contenedor.querySelector(".eval-custom__lista");

        if (!lista) return;

        const visibles =
            evaluacionesFiltradas();

        lista.innerHTML =
            visibles.length
                ? `<div class="innovations-list__grid">${visibles.map(construirTarjeta).join("")}</div>`
                : `<p class="evaluations-empty">No hay evaluaciones que coincidan con estos filtros.</p>`;

        const contador =
            contenedor.querySelector(".eval-custom__contador");

        if (contador) {

            contador.textContent =
                visibles.length === evaluaciones.length
                    ? `${evaluaciones.length} evaluación${evaluaciones.length === 1 ? "" : "es"}`
                    : `${visibles.length} de ${evaluaciones.length} evaluaciones`;

        }

    }


    function construirFiltrosLista() {

        /* quien no administra solo recibe evaluaciones vigentes */
        const filtroEstado =
            puedeAdministrar
                ? `
                    <div class="evaluations-resultados__campo">
                        <label for="eval-lista-estado">Estado</label>
                        <select id="eval-lista-estado" data-filtro-lista="estado">
                            <option value="todas" ${estadoLista === "todas" ? "selected" : ""}>Todas</option>
                            <option value="activas" ${estadoLista === "activas" ? "selected" : ""}>Activas</option>
                            <option value="cerradas" ${estadoLista === "cerradas" ? "selected" : ""}>Cerradas</option>
                        </select>
                    </div>
                `
                : "";

        const opcionesOrden =
            OPCIONES_ORDEN
                .filter((opcion) => !opcion.soloResultados || puedeVerResultados)
                .map((opcion) => `<option value="${opcion.valor}" ${opcion.valor === ordenLista ? "selected" : ""}>${opcion.texto}</option>`)
                .join("");

        return `
            <div class="evaluations-resultados__controles eval-custom__filtros">

                <div class="evaluations-resultados__campo">
                    <label for="eval-lista-busqueda">Buscar</label>
                    <input
                        type="search"
                        id="eval-lista-busqueda"
                        data-filtro-lista="busqueda"
                        placeholder="Título o descripción"
                        value="${escaparHTML(busquedaLista)}"
                    >
                </div>

                ${filtroEstado}

                <div class="evaluations-resultados__campo">
                    <label for="eval-lista-orden">Ordenar por</label>
                    <select id="eval-lista-orden" data-filtro-lista="orden">
                        ${opcionesOrden}
                    </select>
                </div>

                <span class="eval-custom__contador"></span>

            </div>
        `;

    }


    function pintarLista() {

        pantalla = "lista";

        /* "Más respuestas" no existe para quien no ve resultados */
        if (!OPCIONES_ORDEN.some((opcion) => opcion.valor === ordenLista && (!opcion.soloResultados || puedeVerResultados))) {

            ordenLista = "creado_desc";

        }

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
                    ? `${construirFiltrosLista()}<div class="eval-custom__lista"></div>`
                    : `<p class="evaluations-empty">${vacio}</p>`
            }
        `;

        pintarTarjetas();

    }


    /* =====================================================
       EDITOR
       ===================================================== */

    function opcionNueva(posicion) {

        return {
            texto: ``,
            valor: 0
        };

    }


    function valoresLikertPorDefecto() {

        return Object.fromEntries(
            ESCALA_LIKERT.map((opcion) => [opcion.valor, opcion.puntaje])
        );

    }


    function preguntaNueva(tipo = "opcion_multiple") {

        return {

            tipo,
            texto: "",
            requerida: true,

            opciones:
                tipo === "opcion_multiple" || tipo === "casillas"
                    ? [opcionNueva(1), opcionNueva(2)]
                    : [],

            valoresLikert: valoresLikertPorDefecto()

        };

    }


    async function abrirEditor() {

        try {

            const data =
                await pedir("/usuarios");

            usuariosDestino =
                (data.usuarios || [])
                    .filter(
                        (usuario) =>
                            Number(usuario.activo) === 1 &&
                            ROLES_DESTINATARIOS.some((rol) => rol.valor === usuario.rol)
                    )
                    .map((usuario) => ({
                        id: Number(usuario.id),
                        nombre: usuario.nombre || "",
                        departamento: String(usuario.departamento || "").trim(),
                        area: String(usuario.area || "").trim(),
                        rol: usuario.rol
                    }));

        }
        catch (error) {

            console.error(
                "ERROR AL CARGAR USUARIOS PARA DESTINATARIOS:",
                error
            );

            avisar(`No fue posible cargar los usuarios: ${error.message}`);

            return;

        }

        filtroDestino = {
            departamento: "",
            area: "",
            rol: "",
            busqueda: ""
        };

        borrador = {
            titulo: "",
            descripcion: "",
            fechaCierre: "",
            limiteRespuestas: "",
            usuarios: new Set(),
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
                                        value="${escaparHTML(opcion.texto)}"
                                        placeholder="Opción ${posicion + 1}"
                                        maxlength="200"
                                        data-campo="q-opcion"
                                        data-o="${posicion}"
                                        aria-label="Opción ${posicion + 1}"
                                    >

                                    
                                    <label class="eval-editor__valor" title="Valor (puntos) de esta respuesta">
                                        <input
                                            type="number"
                                            step="any"
                                            min="-${MAX_VALOR_RESPUESTA}"
                                            max="${MAX_VALOR_RESPUESTA}"
                                            value="${escaparHTML(opcion.valor)}"
                                            data-campo="q-opcion-valor"
                                            data-o="${posicion}"
                                            aria-label="Valor de la opción ${posicion + 1}"
                                        >
                                        <span>pts</span>
                                    </label>
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
                        <div class="eval-editor__opciones">
                            ${ESCALA_LIKERT.map(
                                (opcion) => `
                                    <div class="eval-editor__opcion eval-editor__opcion--likert">
                                        <span class="eval-editor__marca eval-editor__marca--likert"></span>
                                        <span class="eval-editor__likert-etiqueta">${escaparHTML(opcion.etiqueta)}</span>
                                        <label class="eval-editor__valor" title="Valor (puntos) de esta respuesta">
                                            <input
                                                type="number"
                                                step="any"
                                                min="-${MAX_VALOR_RESPUESTA}"
                                                max="${MAX_VALOR_RESPUESTA}"
                                                value="${escaparHTML(pregunta.valoresLikert?.[opcion.valor] ?? opcion.puntaje)}"
                                                data-campo="q-likert-valor"
                                                data-nivel="${opcion.valor}"
                                                aria-label="Valor de ${escaparHTML(opcion.etiqueta)}"
                                            >
                                            <span>pts</span>
                                        </label>
                                    </div>
                                `
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

                    <div class="eval-editor__ajustes">

                        <div class="evaluations-resultados__campo">
                            <label for="eval-editor-cierre">Fecha de cierre (opcional)</label>
                            <input
                                type="date"
                                id="eval-editor-cierre"
                                value="${escaparHTML(borrador.fechaCierre)}"
                                data-campo="fechaCierre"
                            >
                        </div>

                        <div class="evaluations-resultados__campo">
                            <label for="eval-editor-limite">Límite de respuestas (opcional)</label>
                            <input
                                type="number"
                                id="eval-editor-limite"
                                min="1"
                                max="${MAX_LIMITE_RESPUESTAS}"
                                step="1"
                                placeholder="Sin límite"
                                value="${escaparHTML(borrador.limiteRespuestas)}"
                                data-campo="limiteRespuestas"
                            >
                        </div>

                    </div>

                    <p class="eval-editor__ayuda">
                        Al llegar al límite de respuestas la evaluación se cierra sola. Asigna a cada respuesta un valor en puntos para obtener un puntaje por evaluación respondida.
                    </p>

                </div>

                <section class="eval-editor__cabecera eval-destinos" aria-labelledby="eval-destinos-titulo">

                    <div class="eval-destinos__encabezado">
                        <h3 id="eval-destinos-titulo" class="eval-destinos__titulo">Enviar a</h3>
                        <span class="eval-destinos__contador"></span>
                    </div>

                    <div class="eval-destinos__filtros">
                        ${construirFiltrosDestino()}
                    </div>

                    <div class="eval-destinos__dinamico"></div>

                </section>

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

        pintarDestinatarios();

    }


    /* =====================================================
       EDITOR: DESTINATARIOS
       ---------------------------------------------------------
       Filtros Departamento → Área → Rol (mismo criterio que la
       gestión de usuarios: valores tomados de los propios
       usuarios) y casillas por usuario. La selección se
       conserva al cambiar los filtros, así que se pueden
       combinar varios departamentos o áreas.
       ===================================================== */

    function ordenarTexto(lista) {

        return [...new Set(lista.filter(Boolean))]
            .sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        "es",
                        {
                            sensitivity: "base"
                        }
                    )
            );

    }


    function etiquetaRol(rol) {

        return ROLES_DESTINATARIOS.find((item) => item.valor === rol)?.etiqueta || rol;

    }


    function usuariosDestinoFiltrados() {

        const texto =
            filtroDestino.busqueda.trim().toLowerCase();

        return usuariosDestino.filter(
            (usuario) =>
                (!filtroDestino.departamento || usuario.departamento === filtroDestino.departamento) &&
                (!filtroDestino.area || usuario.area === filtroDestino.area) &&
                (!filtroDestino.rol || usuario.rol === filtroDestino.rol) &&
                (!texto || usuario.nombre.toLowerCase().includes(texto))
        );

    }


    function construirFiltrosDestino() {

        const departamentos =
            ordenarTexto(usuariosDestino.map((usuario) => usuario.departamento));

        const areas =
            filtroDestino.departamento
                ? ordenarTexto(
                    usuariosDestino
                        .filter((usuario) => usuario.departamento === filtroDestino.departamento)
                        .map((usuario) => usuario.area)
                )
                : [];

        const opciones = (lista, actual, etiquetaTodos, etiqueta = (valor) => valor) =>
            [`<option value="">${etiquetaTodos}</option>`]
                .concat(
                    lista.map(
                        (valor) => `<option value="${escaparHTML(valor)}" ${valor === actual ? "selected" : ""}>${escaparHTML(etiqueta(valor))}</option>`
                    )
                )
                .join("");

        return `
            <div class="evaluations-resultados__campo">
                <label for="eval-destino-departamento">Departamento</label>
                <select id="eval-destino-departamento" data-campo="dest-departamento">
                    ${opciones(departamentos, filtroDestino.departamento, "Todos los departamentos")}
                </select>
            </div>

            <div class="evaluations-resultados__campo">
                <label for="eval-destino-area">Área</label>
                <select id="eval-destino-area" data-campo="dest-area" ${areas.length ? "" : "disabled"}>
                    ${opciones(areas, filtroDestino.area, "Todas las áreas")}
                </select>
            </div>

            <div class="evaluations-resultados__campo">
                <label for="eval-destino-rol">Rol</label>
                <select id="eval-destino-rol" data-campo="dest-rol">
                    ${opciones(ROLES_DESTINATARIOS.map((rol) => rol.valor), filtroDestino.rol, "Todos los roles", etiquetaRol)}
                </select>
            </div>

            <div class="evaluations-resultados__campo">
                <label for="eval-destino-busqueda">Buscar</label>
                <input
                    type="search"
                    id="eval-destino-busqueda"
                    placeholder="Nombre del usuario"
                    value="${escaparHTML(filtroDestino.busqueda)}"
                    data-campo="dest-busqueda"
                >
            </div>
        `;

    }


    /*
     * Solo se repinta la lista (no los filtros) para que el
     * cuadro de búsqueda no pierda el foco al escribir.
     */
    function pintarDestinatarios() {

        const zona =
            contenedor.querySelector(".eval-destinos__dinamico");

        if (!zona || !borrador) return;

        const listaAnterior =
            zona.querySelector(".eval-destinos__lista");

        const scroll =
            listaAnterior ? listaAnterior.scrollTop : 0;

        const visibles =
            usuariosDestinoFiltrados();

        const seleccionadosVisibles =
            visibles.filter((usuario) => borrador.usuarios.has(usuario.id)).length;

        const todosMarcados =
            visibles.length > 0 &&
            seleccionadosVisibles === visibles.length;

        /* resumen de la selección por departamento */
        const porDepartamento = {};

        usuariosDestino
            .filter((usuario) => borrador.usuarios.has(usuario.id))
            .forEach(
                (usuario) => {

                    const clave =
                        usuario.departamento || "Sin departamento";

                    porDepartamento[clave] = (porDepartamento[clave] || 0) + 1;

                }
            );

        const resumen =
            ordenarTexto(Object.keys(porDepartamento))
                .map((departamento) => `<span class="eval-destinos__chip">${escaparHTML(departamento)} · ${porDepartamento[departamento]}</span>`)
                .join("");

        zona.innerHTML = `
            <div class="eval-destinos__barra">

                <label class="eval-destinos__todos">
                    <input
                        type="checkbox"
                        data-campo="dest-todos"
                        ${todosMarcados ? "checked" : ""}
                        ${visibles.length ? "" : "disabled"}
                    >
                    Seleccionar todos los mostrados (${visibles.length})
                </label>

                <button
                    type="button"
                    class="eval-destinos__limpiar"
                    data-accion="dest-limpiar"
                    ${borrador.usuarios.size ? "" : "disabled"}
                >Quitar toda la selección</button>

            </div>

            ${
                visibles.length
                    ? `
                        <ul class="eval-destinos__lista">
                            ${visibles.map(
                                (usuario) => `
                                    <li>
                                        <label class="eval-destinos__usuario">
                                            <input
                                                type="checkbox"
                                                value="${usuario.id}"
                                                data-campo="dest-usuario"
                                                ${borrador.usuarios.has(usuario.id) ? "checked" : ""}
                                            >
                                            <span class="eval-destinos__nombre">${escaparHTML(usuario.nombre)}</span>
                                            <span class="eval-destinos__detalle">
                                                ${escaparHTML(usuario.departamento || "Sin departamento")} · ${escaparHTML(usuario.area || "Sin área")} · ${escaparHTML(etiquetaRol(usuario.rol))}
                                            </span>
                                        </label>
                                    </li>
                                `
                            ).join("")}
                        </ul>
                    `
                    : `<p class="evaluations-form__intro">No hay usuarios que coincidan con estos filtros.</p>`
            }

            ${resumen ? `<div class="eval-destinos__resumen">${resumen}</div>` : ""}
        `;

        const listaNueva =
            zona.querySelector(".eval-destinos__lista");

        if (listaNueva) {
            listaNueva.scrollTop = scroll;
        }

        const contador =
            contenedor.querySelector(".eval-destinos__contador");

        if (contador) {

            contador.textContent =
                `${borrador.usuarios.size} usuario${borrador.usuarios.size === 1 ? "" : "s"} seleccionado${borrador.usuarios.size === 1 ? "" : "s"}`;

        }

    }


    /*
     * Devuelve true si el cambio pertenecía a los destinatarios.
     * Las casillas y los select disparan "input" y "change":
     * solo se atiende "change" para no procesarlos dos veces.
     */
    function alEditarDestinatarios(event, campo) {

        if (!campo.startsWith("dest-")) return false;

        if (campo === "dest-busqueda") {

            if (event.type === "input") {

                filtroDestino.busqueda = event.target.value;

                pintarDestinatarios();

            }

            return true;

        }

        if (event.type !== "change") return true;

        if (campo === "dest-departamento") {

            filtroDestino.departamento = event.target.value;
            filtroDestino.area = "";

            contenedor.querySelector(".eval-destinos__filtros").innerHTML =
                construirFiltrosDestino();

        }
        else if (campo === "dest-area") {

            filtroDestino.area = event.target.value;

        }
        else if (campo === "dest-rol") {

            filtroDestino.rol = event.target.value;

        }
        else if (campo === "dest-usuario") {

            const id =
                Number(event.target.value);

            if (event.target.checked) {
                borrador.usuarios.add(id);
            }
            else {
                borrador.usuarios.delete(id);
            }

        }
        else if (campo === "dest-todos") {

            usuariosDestinoFiltrados().forEach(
                (usuario) => {

                    if (event.target.checked) {
                        borrador.usuarios.add(usuario.id);
                    }
                    else {
                        borrador.usuarios.delete(usuario.id);
                    }

                }
            );

        }

        pintarDestinatarios();

        return true;

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

        if (
            campo === "titulo" ||
            campo === "descripcion" ||
            campo === "fechaCierre" ||
            campo === "limiteRespuestas"
        ) {

            borrador[campo] = event.target.value;

            return;

        }

        if (alEditarDestinatarios(event, campo)) return;

        const contexto =
            preguntaDesdeElemento(event.target);

        if (!contexto) return;

        const { pregunta } =
            contexto;

        if (campo === "q-texto") {

            pregunta.texto = event.target.value;

        }
        else if (campo === "q-opcion") {

            pregunta.opciones[Number(event.target.dataset.o)].texto =
                event.target.value;

        }
        else if (campo === "q-opcion-valor") {

            pregunta.opciones[Number(event.target.dataset.o)].valor =
                event.target.value;

        }
        else if (campo === "q-likert-valor") {

            pregunta.valoresLikert = {
                ...valoresLikertPorDefecto(),
                ...pregunta.valoresLikert,
                [event.target.dataset.nivel]: event.target.value
            };

        }
        else if (campo === "q-requerida") {

            pregunta.requerida = event.target.checked;

        }
        else if (campo === "q-tipo" && event.type === "change") {

            pregunta.tipo = event.target.value;

            if (pregunta.tipo === "opcion_multiple" || pregunta.tipo === "casillas") {

                if (pregunta.opciones.length < 2) {
                    pregunta.opciones = [opcionNueva(1), opcionNueva(2)];
                }

            }
            else {

                pregunta.opciones = [];

            }

            if (!pregunta.valoresLikert) {
                pregunta.valoresLikert = valoresLikertPorDefecto();
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

                pregunta.opciones.push(opcionNueva(pregunta.opciones.length + 1));

                pintarEditor();

                contenedor
                    .querySelectorAll(`[data-q="${indice}"] .eval-editor__opcion input[data-campo="q-opcion"]`)
                    ?.[pregunta.opciones.length - 1]
                    ?.select();

            }

        }
        else if (accion === "dest-limpiar") {

            borrador.usuarios.clear();

            pintarDestinatarios();

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

        if (borrador.usuarios.size === 0) {
            return "Selecciona al menos un usuario en “Enviar a”.";
        }

        if (String(borrador.limiteRespuestas).trim() !== "") {

            const limite =
                Number(borrador.limiteRespuestas);

            if (!Number.isInteger(limite) || limite < 1 || limite > MAX_LIMITE_RESPUESTAS) {
                return `El límite de respuestas debe ser un número entero entre 1 y ${MAX_LIMITE_RESPUESTAS}, o dejarse vacío.`;
            }

        }

        const valorInvalido = (valor) =>
            String(valor ?? "").trim() !== "" &&
            (!Number.isFinite(Number(valor)) || Math.abs(Number(valor)) > MAX_VALOR_RESPUESTA);

        for (let i = 0; i < borrador.preguntas.length; i++) {

            const pregunta = borrador.preguntas[i];

            if (!pregunta.texto.trim()) {
                return `La pregunta ${i + 1} no tiene texto.`;
            }

            if (pregunta.tipo === "likert" && Object.values(pregunta.valoresLikert || {}).some(valorInvalido)) {
                return `Un valor de la escala de la pregunta ${i + 1} no es válido (número entre -${MAX_VALOR_RESPUESTA} y ${MAX_VALOR_RESPUESTA}).`;
            }

            if (pregunta.tipo === "opcion_multiple" || pregunta.tipo === "casillas") {

                if (pregunta.opciones.some((opcion) => valorInvalido(opcion.valor))) {
                    return `Un valor de la pregunta ${i + 1} no es válido (número entre -${MAX_VALOR_RESPUESTA} y ${MAX_VALOR_RESPUESTA}).`;
                }

                const opciones =
                    pregunta.opciones.map((opcion) => opcion.texto.trim());

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
                        limiteRespuestas:
                            String(borrador.limiteRespuestas).trim() !== ""
                                ? Number(borrador.limiteRespuestas)
                                : null,
                        usuarios: [...borrador.usuarios],
                        preguntas:
                            borrador.preguntas.map(
                                (pregunta) => ({
                                    tipo: pregunta.tipo,
                                    texto: pregunta.texto.trim(),
                                    requerida: pregunta.requerida,
                                    opciones:
                                        pregunta.opciones.map((opcion) => ({
                                            texto: opcion.texto.trim(),
                                            valor: Number(opcion.valor) || 0
                                        })),
                                    ...(
                                        pregunta.tipo === "likert"
                                            ? {
                                                valoresLikert:
                                                    Object.fromEntries(
                                                        Object.entries(pregunta.valoresLikert || valoresLikertPorDefecto())
                                                            .map(([nivel, valor]) => [nivel, Number(valor) || 0])
                                                    )
                                            }
                                            : {}
                                    )
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


    function formatearPuntos(valor) {

        return `${valor} pt${Math.abs(valor) === 1 ? "" : "s"}`;

    }


    function construirGrafica(pregunta) {

        const conPuntaje =
            Boolean(resultados.puntaje);

        if (pregunta.tipo === "opcion_multiple" || pregunta.tipo === "casillas") {

            return `
                <div class="eval-grafica">
                    ${pregunta.opciones.map(
                        (opcion) => {

                            const pct =
                                porcentaje(opcion.cantidad, pregunta.totalRespuestas);

                            return `
                                <div class="eval-grafica__fila">
                                    <span class="eval-grafica__etiqueta">
                                        ${escaparHTML(opcion.texto)}
                                        ${conPuntaje ? `<small class="eval-grafica__puntos">${formatearPuntos(opcion.valor)}</small>` : ""}
                                    </span>
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
                                        ${conPuntaje ? `<small class="eval-grafica__puntos">${formatearPuntos(pregunta.valoresLikert?.[opcion.valor] ?? opcion.puntaje)}</small>` : ""}
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
            puntaje,
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
                    puntaje && puntaje.promedio !== null
                        ? `
                            <div class="eval-resumen__tarjeta">
                                <span class="eval-resumen__valor">${puntaje.promedio} <small>/ ${puntaje.maximoPosible} pts</small></span>
                                <span class="eval-resumen__etiqueta">Puntaje promedio por respuesta (mín. ${puntaje.minimo} · máx. ${puntaje.maximo})</span>
                                <div class="eval-grafica__pista"><div class="eval-grafica__relleno" style="width: ${Math.max(0, Math.min(100, porcentaje(puntaje.promedio, puntaje.maximoPosible)))}%"></div></div>
                            </div>
                        `
                        : ""
                }

                <div class="eval-resumen__tarjeta">
                    <span class="eval-resumen__valor eval-resumen__valor--${evaluacion.vigente ? "activa" : "cerrada"}">${evaluacion.vigente ? "Activa" : "Cerrada"}</span>
                    <span class="eval-resumen__etiqueta">${evaluacion.fechaCierre ? `Cierra el ${escaparHTML(formatearFecha(evaluacion.fechaCierre))}` : "Sin fecha de cierre"}</span>
                    ${
                        evaluacion.limiteRespuestas !== null
                            ? `<span class="eval-resumen__etiqueta">Límite: ${totalGeneral} de ${evaluacion.limiteRespuestas} respuestas${totalGeneral >= evaluacion.limiteRespuestas ? " (alcanzado)" : ""}</span>`
                            : ""
                    }
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
                                                    puntaje && pregunta.promedio !== undefined
                                                        ? (pregunta.promedio !== null ? `${pregunta.promedio} / ${pregunta.puntajeMaximo} pts` : "Sin datos")
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
                ...(data.usaPuntaje ? ["Puntaje"] : []),
                ...data.preguntas.map((pregunta) => pregunta.texto)
            ];

            const filas =
                data.respuestas.map(
                    (fila) => [
                        formatearFecha(fila.creadoEn),
                        fila.departamento || "",
                        fila.area || "",
                        ...(data.usaPuntaje ? [fila.puntaje] : []),
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


    function alFiltrarLista(event) {

        const filtro =
            event.target.dataset?.filtroLista;

        if (!filtro || pantalla !== "lista") return;

        if (filtro === "busqueda") {

            busquedaLista = event.target.value;

        }
        else if (filtro === "estado") {

            estadoLista = event.target.value;

        }
        else if (filtro === "orden") {

            ordenLista = event.target.value;

        }

        pintarTarjetas();

    }

    contenedor.addEventListener("input", alFiltrarLista);
    contenedor.addEventListener("change", alFiltrarLista);


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
