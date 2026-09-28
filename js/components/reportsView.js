import { API_URL } from "./config.js";
import { getUsuarioActual, headerUsuario } from "../services/auth.service.js";

const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function fechaCorta(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("es-MX", {
        day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC"
    }).format(date);
}

export function initReportsView() {
    const view = document.querySelector("#vista-reportes");
    if (!view) return { render: async () => {} };

    const tipo = view.querySelector("#reporte-tipo");
    const filtros = view.querySelector("#reporte-compromisos-filtros");
    const departamento = view.querySelector("#reporte-departamento");
    const colaborador = view.querySelector("#reporte-colaborador");
    const error = view.querySelector("#reporte-error");
    const resultados = view.querySelector("#reporte-resultados");
    const documento = view.querySelector("#reporte-documento");
    const proximamente = view.querySelector("#reporte-proximamente");
    const usuario = getUsuarioActual();
    let opcionesCargadas = false;

    const ocultarReporte = () => {
        resultados.hidden = true;
        documento.replaceChildren();
    };

    function actualizarTipo() {
        const compromisos = tipo.value === "compromisos";
        filtros.hidden = !compromisos;
        proximamente.hidden = compromisos;
        error.hidden = true;
        ocultarReporte();
    }

    async function cargarOpciones(depto = "") {
        const query = new URLSearchParams();
        if (depto) query.set("departamento", depto);
        const response = await fetch(`${API_URL}/reportes/compromisos/opciones?${query}`, {
            headers: { ...headerUsuario() }
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.mensaje || "No fue posible cargar los filtros.");

        if (usuario?.rol === "lider") {
            departamento.replaceChildren(new Option(data.departamentoFijo || "Mi departamento", data.departamentoFijo || ""));
            departamento.disabled = true;
        } else {
            departamento.disabled = false;
            departamento.replaceChildren(new Option("Todos los departamentos", "todos"));
            for (const nombre of data.departamentos || []) departamento.add(new Option(nombre, nombre));
            if (depto && depto !== "todos") departamento.value = depto;
        }

        colaborador.replaceChildren(new Option("Todos los colaboradores", "todos"));
        for (const persona of data.colaboradores || []) colaborador.add(new Option(persona.nombre, String(persona.id)));
    }

    async function cargarOpcionesIniciales() {
        if (opcionesCargadas) return;
        await cargarOpciones(usuario?.rol === "lider" ? "" : "todos");
        opcionesCargadas = true;
    }

    tipo.addEventListener("change", async () => {
        actualizarTipo();
        if (tipo.value === "compromisos") {
            try {
                await cargarOpcionesIniciales();
            } catch (err) {
                error.textContent = err.message;
                error.hidden = false;
            }
        }
    });
    departamento.addEventListener("change", async () => {
        ocultarReporte();
        error.hidden = true;
        try {
            await cargarOpciones(departamento.value);
        } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
        }
    });

    for (const selector of ["#reporte-desde", "#reporte-hasta", "#reporte-colaborador", "#reporte-estatus"]) {
        view.querySelector(selector).addEventListener("change", () => {
            ocultarReporte();
            error.hidden = true;
        });
    }

    filtros.addEventListener("submit", async (event) => {
        event.preventDefault();
        error.hidden = true;
        ocultarReporte();
        const desde = view.querySelector("#reporte-desde").value;
        const hasta = view.querySelector("#reporte-hasta").value;
        if (desde && hasta && desde > hasta) {
            error.textContent = "La fecha Desde no puede ser posterior a Hasta.";
            error.hidden = false;
            return;
        }

        const params = new URLSearchParams({
            desde,
            hasta,
            departamento: usuario?.rol === "lider" ? "" : departamento.value,
            colaborador: colaborador.value,
            estado: view.querySelector("#reporte-estatus").value
        });
        const button = view.querySelector(".reports-view__generate");
        button.disabled = true;
        button.textContent = "Generando…";
        try {
            const response = await fetch(`${API_URL}/reportes/compromisos?${params}`, {
                headers: { ...headerUsuario() }
            });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error(data.mensaje || "No fue posible generar el reporte.");
            renderizarReporte(data, {
                desde,
                hasta,
                estado: view.querySelector("#reporte-estatus").selectedOptions[0]?.textContent || "Todos",
                colaborador: colaborador.selectedOptions[0]?.textContent || "Todos los colaboradores"
            });
        } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
        } finally {
            button.disabled = false;
            button.textContent = "Generar";
        }
    });

    view.querySelector("#reporte-imprimir").addEventListener("click", () => window.print());

    function renderizarReporte(data, filtrosAplicados) {
        const compromisos = data.compromisos || [];
        const fechaGeneracion = new Intl.DateTimeFormat("es-MX", {
            dateStyle: "long", timeStyle: "short"
        }).format(new Date());
        const filas = compromisos.map((item) => `
            <tr>
                <td>${escapeHTML(item.titulo || item.descripcion)}</td>
                <td>${escapeHTML(item.colaborador)}</td>
                <td>${escapeHTML(item.departamento)}</td>
                <td>${escapeHTML(item.estado)}</td>
                <td>${escapeHTML(fechaCorta(item.fechaLimite))}</td>
                <td>${escapeHTML(item.reunion || "Compromiso independiente")}</td>
            </tr>
        `).join("");
        documento.innerHTML = `
            <div class="report-output__heading">
                <h3>Reporte general de compromisos</h3>
                <p><strong>Departamento:</strong> ${escapeHTML(data.departamento)}</p>
                <p><strong>Colaborador:</strong> ${escapeHTML(filtrosAplicados.colaborador)}</p>
                <p><strong>Periodo de vencimiento:</strong> ${escapeHTML(fechaCorta(filtrosAplicados.desde))} a ${escapeHTML(fechaCorta(filtrosAplicados.hasta))}</p>
                <p><strong>Estatus:</strong> ${escapeHTML(filtrosAplicados.estado)}</p>
                <p><strong>Generado:</strong> ${escapeHTML(fechaGeneracion)}</p>
                <p><strong>Total de compromisos:</strong> ${compromisos.length}</p>
            </div>
            ${compromisos.length ? `
                <div class="report-output__table-wrap"><table class="report-output__table">
                    <thead><tr><th>Compromiso</th><th>Colaborador</th><th>Departamento</th><th>Estatus</th><th>Fecha límite</th><th>Reunión</th></tr></thead>
                    <tbody>${filas}</tbody>
                </table></div>
            ` : '<p class="report-output__empty">No se encontraron compromisos con los filtros seleccionados.</p>'}
        `;
        resultados.hidden = false;
    }

    actualizarTipo();
    return {
        render: async () => {
            error.hidden = true;
            ocultarReporte();
            if (tipo.value === "compromisos") {
                try {
                    await cargarOpcionesIniciales();
                } catch (err) {
                    error.textContent = err.message;
                    error.hidden = false;
                }
            }
        }
    };
}
