/* =========================================================
   RESULTADOS DE EVALUACIONES (SOLO LÍDERES Y ADMINISTRADORES)
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    esAdmin,
    getUsuarioActual,
    headerUsuario
} from "../services/auth.service.js";

import {
    confirmDialog
} from "../services/confirmDialog.js";

import {
    obtenerFormulario,
    obtenerEtiquetaLikert
} from "./evaluacionesCatalogo.js";


export function initEvaluacionesResultados() {

    const seccion =
        document.querySelector("#evaluaciones-resultados");

    const panelAdmin =
        document.querySelector("#evaluaciones-periodos-admin");

    const selectPeriodo =
        document.querySelector("#evaluaciones-resultados-periodo");

    const selectFormulario =
        document.querySelector("#evaluaciones-resultados-formulario");

    const selectDepartamento =
        document.querySelector("#evaluaciones-resultados-departamento");

    const checksFormularios =
        document.querySelectorAll("#evaluaciones-periodo-formularios input[type=\"checkbox\"]");

    const botonAbrir =
        document.querySelector("#evaluaciones-periodo-abrir");

    const botonCerrar =
        document.querySelector("#evaluaciones-periodo-cerrar");

    const listaResultados =
        document.querySelector("#evaluaciones-resultados-lista");

    const totalResultados =
        document.querySelector("#evaluaciones-resultados-total");

    const vacioResultados =
        document.querySelector("#evaluaciones-resultados-vacio");

    const periodoFechas =
        document.querySelector("#evaluaciones-resultados-periodo-fechas");

    const botonPDF =
        document.querySelector("#evaluaciones-resultados-pdf");


    if (!seccion) {

        return {
            render: async () => {}
        };

    }


    let periodos = [];
    let departamentosCargados = false;
    let ultimoContextoResultados = null;


    function formatearFecha(valor) {

        if (!valor) return null;

        const fecha =
            new Date(`${String(valor).slice(0, 10)}T00:00:00`);

        if (Number.isNaN(fecha.getTime())) {
            return null;
        }

        return fecha.toLocaleDateString(
            "es-MX",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );

    }


    function formatearRangoFechas(periodo) {

        const inicio =
            formatearFecha(periodo.fecha_inicio);

        const fin =
            formatearFecha(periodo.fecha_fin);

        if (!inicio) return "sin fechas definidas";

        return `${inicio} al ${fin || "sin fecha de cierre"}`;

    }


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
       PERIODOS
       ===================================================== */

    async function cargarPeriodos() {

        try {

            const response =
                await fetch(
                    `${API_URL}/evaluaciones/periodos`,
                    {
                        headers: headerUsuario()
                    }
                );

            const data =
                await response.json();

            if (!response.ok || !data.ok) {

                throw new Error(
                    data.mensaje ||
                    "No fue posible obtener los periodos de evaluación."
                );

            }

            periodos =
                data.periodos || [];

        }
        catch (error) {

            console.error(
                "ERROR AL CARGAR PERIODOS DE EVALUACIÓN:",
                error
            );

            periodos = [];

        }

    }


    /* =====================================================
       DEPARTAMENTOS (PARA EL FILTRO DE RESULTADOS)
       ===================================================== */

    async function cargarDepartamentos() {

        if (departamentosCargados || !selectDepartamento) return;

        try {

            const response =
                await fetch(`${API_URL}/subsidiaries`);

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    "No fue posible obtener los departamentos."
                );

            }

            const departamentos =
                data.datos || [];

            departamentos.forEach(
                (departamento) => {

                    const option =
                        document.createElement("option");

                    option.value =
                        departamento.SubsidiaryName;

                    option.textContent =
                        departamento.SubsidiaryName;

                    selectDepartamento.appendChild(option);

                }
            );

            departamentosCargados = true;

        }
        catch (error) {

            console.error(
                "ERROR AL CARGAR DEPARTAMENTOS:",
                error
            );

        }

    }


    function pintarSelectPeriodos() {

        if (!selectPeriodo) return;

        const valorPrevio =
            selectPeriodo.value;

        if (periodos.length === 0) {

            selectPeriodo.innerHTML =
                `<option value="">Sin periodos registrados</option>`;

            return;

        }

        selectPeriodo.innerHTML =
            periodos.map(
                (periodo) => `
                    <option value="${periodo.id}">
                        ${escaparHTML(periodo.nombre)}${periodo.activo ? " (activo)" : ""} — ${escaparHTML(formatearRangoFechas(periodo))}
                    </option>
                `
            ).join("");

        const existePrevio =
            periodos.some((periodo) => String(periodo.id) === valorPrevio);

        if (existePrevio) {

            selectPeriodo.value = valorPrevio;

        }
        else {

            const activo =
                periodos.find((periodo) => periodo.activo);

            selectPeriodo.value =
                String((activo || periodos[0]).id);

        }

        pintarDetallePeriodo();

    }


    function pintarDetallePeriodo() {

        if (!periodoFechas) return;

        const periodo =
            periodos.find(
                (item) => String(item.id) === String(selectPeriodo?.value)
            );

        periodoFechas.textContent =
            periodo
                ? `Vigencia: ${formatearRangoFechas(periodo)}`
                : "";

    }


    function pintarPanelAdmin() {

        if (!panelAdmin) return;

        const esAdministrador =
            esAdmin();

        panelAdmin.style.display =
            esAdministrador ? "" : "none";

        if (!esAdministrador) return;

        const periodoActivo =
            periodos.find((periodo) => periodo.activo);

        if (botonCerrar) {

            botonCerrar.hidden = !periodoActivo;

            botonCerrar.dataset.periodoId =
                periodoActivo ? String(periodoActivo.id) : "";

        }

    }


    /* =====================================================
       RESULTADOS
       ===================================================== */

    async function cargarResultados() {

        if (!listaResultados) return;

        const periodoId =
            selectPeriodo?.value;

        const formularioSlug =
            selectFormulario?.value;

        const departamento =
            selectDepartamento?.value || "todos";

        if (!periodoId || !formularioSlug) {

            listaResultados.innerHTML = "";

            if (totalResultados) totalResultados.textContent = "";
            if (vacioResultados) vacioResultados.hidden = false;

            ultimoContextoResultados = null;
            actualizarDisponibilidadPDF();

            return;

        }

        try {

            const response =
                await fetch(
                    `${API_URL}/evaluaciones/resultados?periodoId=${encodeURIComponent(periodoId)}&formulario=${encodeURIComponent(formularioSlug)}&departamento=${encodeURIComponent(departamento)}`,
                    {
                        headers: headerUsuario()
                    }
                );

            const data =
                await response.json();

            if (!response.ok || !data.ok) {

                throw new Error(
                    data.mensaje ||
                    "No fue posible obtener los resultados."
                );

            }

            ultimoContextoResultados = {

                periodo:
                    periodos.find((periodo) => String(periodo.id) === String(periodoId)) || null,

                formularioSlug,

                departamento,

                data

            };

            pintarResultados(formularioSlug, data);

        }
        catch (error) {

            console.error(
                "ERROR AL CARGAR RESULTADOS DE EVALUACIONES:",
                error
            );

            listaResultados.innerHTML = "";

            if (totalResultados) totalResultados.textContent = "";

            if (vacioResultados) {
                vacioResultados.hidden = false;
                vacioResultados.textContent =
                    error.message ||
                    "No fue posible obtener los resultados.";
            }

            ultimoContextoResultados = null;

        }

        actualizarDisponibilidadPDF();

    }


    function pintarResultados(formularioSlug, data) {

        const catalogo =
            obtenerFormulario(formularioSlug);

        if (totalResultados) {

            totalResultados.textContent =
                `${data.total} respuesta${data.total === 1 ? "" : "s"} recibida${data.total === 1 ? "" : "s"} en este periodo.`;

        }

        if (!data.total) {

            listaResultados.innerHTML = "";

            if (vacioResultados) {
                vacioResultados.hidden = false;
                vacioResultados.textContent =
                    "Aún no hay respuestas para este formulario en el periodo seleccionado.";
            }

            return;

        }

        if (vacioResultados) vacioResultados.hidden = true;

        listaResultados.innerHTML =
            data.preguntas.map(
                (pregunta) => {

                    const texto =
                        catalogo?.preguntas.find((p) => p.id === pregunta.id)?.texto ||
                        pregunta.id;

                    return `
                        <article class="evaluations-resultados__pregunta">

                            <div class="evaluations-resultados__pregunta-top">
                                <p class="evaluations-resultados__pregunta-texto">${escaparHTML(texto)}</p>
                                <span class="evaluations-resultados__promedio">
                                    ${pregunta.promedio !== null ? `${pregunta.promedio} / 5` : "Sin datos"}
                                </span>
                            </div>

                            <div class="evaluations-resultados__barra">
                                ${construirSegmentos(pregunta.distribucion, pregunta.totalRespuestas)}
                            </div>

                        </article>
                    `;

                }
            ).join("");

    }


    /* =====================================================
       EXPORTAR RESULTADOS A PDF
       ===================================================== */

    function actualizarDisponibilidadPDF() {

        if (!botonPDF) return;

        botonPDF.disabled =
            !ultimoContextoResultados ||
            !ultimoContextoResultados.data?.total;

    }


    function generarPDFResultados() {

        if (!ultimoContextoResultados || !ultimoContextoResultados.data?.total) {
            return;
        }

        if (!window.jspdf?.jsPDF) {

            alert(
                "No fue posible generar el PDF: la librería jsPDF no está disponible."
            );

            return;

        }

        const {
            periodo,
            formularioSlug,
            departamento,
            data
        } = ultimoContextoResultados;

        const catalogo =
            obtenerFormulario(formularioSlug);

        const { jsPDF } = window.jspdf;

        const doc =
            new jsPDF({ unit: "pt", format: "letter" });

        const margenIzq = 48;
        const anchoUtil = 516;
        let y = 56;

        function saltoDePaginaSiNecesario(espacioRequerido) {

            if (y + espacioRequerido <= 760) return;

            doc.addPage();
            y = 56;

        }

        function escribirParrafo(texto, tamaño, estilo, interlineado) {

            doc.setFont("helvetica", estilo || "normal");
            doc.setFontSize(tamaño);

            const lineas =
                doc.splitTextToSize(texto, anchoUtil);

            saltoDePaginaSiNecesario(lineas.length * interlineado);

            doc.text(lineas, margenIzq, y);

            y += lineas.length * interlineado;

        }

        escribirParrafo(
            "Resultados de evaluación",
            18,
            "bold",
            22
        );

        y += 6;

        escribirParrafo(
            `Encuesta: ${catalogo?.titulo || formularioSlug}`,
            11,
            "normal",
            15
        );

        escribirParrafo(
            `Periodo: ${periodo?.nombre || "—"} (${formatearRangoFechas(periodo || {})})`,
            11,
            "normal",
            15
        );

        escribirParrafo(
            `Departamento: ${departamento === "todos" ? "Todos los departamentos" : departamento}`,
            11,
            "normal",
            15
        );

        escribirParrafo(
            `Total de respuestas: ${data.total}`,
            11,
            "normal",
            15
        );

        y += 10;

        const ordenLikert = [
            "totalmente_acuerdo",
            "de_acuerdo",
            "neutral",
            "en_desacuerdo",
            "totalmente_desacuerdo"
        ];

        data.preguntas.forEach(
            (pregunta, indice) => {

                const texto =
                    catalogo?.preguntas.find((p) => p.id === pregunta.id)?.texto ||
                    pregunta.id;

                saltoDePaginaSiNecesario(30);

                doc.setDrawColor(200);
                doc.line(margenIzq, y - 8, margenIzq + anchoUtil, y - 8);

                escribirParrafo(
                    `${indice + 1}. ${texto}`,
                    12,
                    "bold",
                    16
                );

                escribirParrafo(
                    `Promedio: ${pregunta.promedio !== null ? `${pregunta.promedio} / 5` : "Sin datos"}`,
                    10,
                    "normal",
                    14
                );

                ordenLikert.forEach(
                    (valor) => {

                        const cantidad =
                            pregunta.distribucion[valor] || 0;

                        const porcentaje =
                            pregunta.totalRespuestas
                                ? Math.round((cantidad / pregunta.totalRespuestas) * 100)
                                : 0;

                        escribirParrafo(
                            `• ${obtenerEtiquetaLikert(valor)}: ${cantidad} (${porcentaje}%)`,
                            10,
                            "normal",
                            13
                        );

                    }
                );

                y += 8;

            }
        );

        const nombreArchivo =
            `evaluacion_${formularioSlug}_${(periodo?.nombre || "periodo").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;

        doc.save(nombreArchivo);

    }


    if (botonPDF) {

        botonPDF.addEventListener(
            "click",
            generarPDFResultados
        );

    }


    function construirSegmentos(distribucion, total) {

        if (!total) return "";

        const orden = [
            "totalmente_acuerdo",
            "de_acuerdo",
            "neutral",
            "en_desacuerdo",
            "totalmente_desacuerdo"
        ];

        return orden.map(
            (valor) => {

                const cantidad =
                    distribucion[valor] || 0;

                if (!cantidad) return "";

                const porcentaje =
                    (cantidad / total) * 100;

                return `
                    <div
                        class="evaluations-resultados__segmento evaluations-resultados__segmento--${valor}"
                        style="width: ${porcentaje}%"
                        title="${cantidad} de ${total}"
                    ></div>
                `;

            }
        ).join("");

    }


    /* =====================================================
       ACCIONES DE ADMINISTRADOR
       ===================================================== */

    if (botonAbrir) {

        botonAbrir.addEventListener(
            "click",
            async () => {

                const nombre =
                    document.querySelector("#evaluaciones-periodo-nombre")?.value.trim();

                const fechaInicio =
                    document.querySelector("#evaluaciones-periodo-inicio")?.value;

                const fechaFin =
                    document.querySelector("#evaluaciones-periodo-fin")?.value;

                if (!nombre || !fechaInicio) {

                    alert("El nombre y la fecha de inicio son obligatorios.");

                    return;

                }


                const formularios =
                    Array.from(checksFormularios)
                        .filter((casilla) => casilla.checked)
                        .map((casilla) => casilla.value);

                if (formularios.length === 0) {

                    alert("Selecciona al menos una encuesta para incluir en el periodo.");

                    return;

                }


                const periodoActivo =
                    periodos.find((periodo) => periodo.activo);

                if (periodoActivo) {

                    const confirmado =
                        await confirmDialog(
                            `Ya hay un periodo activo ("${periodoActivo.nombre}"). Al abrir uno nuevo, ese periodo se cerrará automáticamente. ¿Continuar?`
                        );

                    if (!confirmado) return;

                }

                try {

                    const response =
                        await fetch(
                            `${API_URL}/evaluaciones/periodos`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    ...headerUsuario()
                                },
                                body: JSON.stringify({
                                    nombre,
                                    fechaInicio,
                                    fechaFin: fechaFin || null,
                                    formularios
                                })
                            }
                        );

                    const data =
                        await response.json();

                    if (!response.ok || !data.ok) {

                        throw new Error(
                            data.mensaje ||
                            "No fue posible crear el periodo."
                        );

                    }

                    await cargarPeriodos();

                    pintarSelectPeriodos();
                    pintarPanelAdmin();
                    await cargarResultados();

                }
                catch (error) {

                    console.error(
                        "ERROR AL ABRIR PERIODO DE EVALUACIÓN:",
                        error
                    );

                    alert(
                        error.message ||
                        "No fue posible crear el periodo."
                    );

                }

            }
        );

    }


    if (botonCerrar) {

        botonCerrar.addEventListener(
            "click",
            async () => {

                const periodoId =
                    botonCerrar.dataset.periodoId;

                if (!periodoId) return;

                const confirmado =
                    await confirmDialog(
                        "¿Cerrar el periodo de evaluación activo? Nadie podrá responder formularios hasta que abras uno nuevo.",
                        { danger: true }
                    );

                if (!confirmado) return;

                try {

                    const response =
                        await fetch(
                            `${API_URL}/evaluaciones/periodos/${periodoId}`,
                            {
                                method: "PATCH",
                                headers: {
                                    "Content-Type": "application/json",
                                    ...headerUsuario()
                                },
                                body: JSON.stringify({ activo: false })
                            }
                        );

                    const data =
                        await response.json();

                    if (!response.ok || !data.ok) {

                        throw new Error(
                            data.mensaje ||
                            "No fue posible cerrar el periodo."
                        );

                    }

                    await cargarPeriodos();

                    pintarSelectPeriodos();
                    pintarPanelAdmin();
                    await cargarResultados();

                }
                catch (error) {

                    console.error(
                        "ERROR AL CERRAR PERIODO DE EVALUACIÓN:",
                        error
                    );

                    alert(
                        error.message ||
                        "No fue posible cerrar el periodo."
                    );

                }

            }
        );

    }


    if (selectPeriodo) {

        selectPeriodo.addEventListener(
            "change",
            () => {

                pintarDetallePeriodo();
                cargarResultados();

            }
        );

    }

    if (selectFormulario) {

        selectFormulario.addEventListener(
            "change",
            cargarResultados
        );

    }

    if (selectDepartamento) {

        selectDepartamento.addEventListener(
            "change",
            cargarResultados
        );

    }


    /* =====================================================
       RENDER PRINCIPAL
       ===================================================== */

    async function render() {

        const usuario =
            getUsuarioActual();

        const puedeVer =
            usuario?.rol === "administrador" ||
            usuario?.rol === "lider";

        seccion.hidden = !puedeVer;

        if (!puedeVer) return;

        await cargarPeriodos();
        await cargarDepartamentos();

        pintarSelectPeriodos();
        pintarPanelAdmin();
        await cargarResultados();

    }


    return {
        render
    };

}
