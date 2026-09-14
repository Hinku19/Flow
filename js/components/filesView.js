/* =========================================================
   VISOR DE ARCHIVOS (SOLO ADMINISTRADOR)
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    headerUsuario
} from "../services/auth.service.js";


export function initFilesView() {

    const grid =
        document.querySelector("#archivos-tarjetas");

    const empty =
        document.querySelector("#archivos-empty");

    const loading =
        document.querySelector("#archivos-loading");

    const filtroTexto =
        document.querySelector("#filtro-archivos-texto");


    if (!grid) {

        console.warn(
            "No se encontró #archivos-tarjetas"
        );

        return {
            render: () => {}
        };

    }


    /* =====================================================
       ESTADO
       ===================================================== */

    let archivos = [];


    /* =====================================================
       ESCAPAR HTML
       ===================================================== */

    function escaparHTML(valor) {

        if (
            valor === null ||
            valor === undefined
        ) {
            return "";
        }

        return String(valor)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function urlDescarga(archivo) {

        return `${API_URL}/enlaces/archivos/${archivo.archivoId}`;

    }


    function formatearFecha(fechaISO) {

        if (!fechaISO) return "";

        const d = new Date(fechaISO);

        if (Number.isNaN(d.getTime())) return String(fechaISO);

        return d.toLocaleDateString("es-MX");

    }


    /* =====================================================
       CARGAR ARCHIVOS
       ===================================================== */

    async function cargarArchivos() {

        try {

            if (loading) loading.hidden = false;
            if (empty) empty.hidden = true;

            const response =
                await fetch(
                    `${API_URL}/archivos`,
                    {
                        headers: headerUsuario()
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible obtener los archivos."
                );

            }

            archivos =
                data.archivos ||
                [];

            aplicarFiltros();

        }
        catch (error) {

            console.error(
                "ERROR AL CARGAR ARCHIVOS:",
                error
            );

            grid.innerHTML = "";

            if (empty) {

                empty.hidden = false;

                const titulo =
                    empty.querySelector("h2");

                if (titulo) {

                    titulo.textContent =
                        "No fue posible cargar los archivos.";

                }

            }

        }
        finally {

            if (loading) loading.hidden = true;

        }

    }


    /* =====================================================
       FILTROS
       ===================================================== */

    function aplicarFiltros() {

        const texto =
            filtroTexto
                ? filtroTexto.value.trim().toLowerCase()
                : "";

        const archivosFiltrados =
            archivos.filter(
                (archivo) => {

                    if (!texto) return true;

                    return (
                        String(archivo.nombreArchivo || "").toLowerCase().includes(texto) ||
                        String(archivo.referenciaTitulo || "").toLowerCase().includes(texto) ||
                        String(archivo.referenciaSubtitulo || "").toLowerCase().includes(texto) ||
                        String(archivo.departamentoNombre || "").toLowerCase().includes(texto) ||
                        String(archivo.areaNombre || "").toLowerCase().includes(texto)
                    );

                }
            );

        renderArchivos(archivosFiltrados);

    }


    /* =====================================================
       RENDER
       ===================================================== */

    function renderArchivos(listaArchivos) {

        grid.innerHTML = "";

        if (
            !listaArchivos ||
            listaArchivos.length === 0
        ) {

            if (empty) empty.hidden = false;

            return;

        }

        if (empty) empty.hidden = true;

        listaArchivos.forEach(
            (archivo) => {

                grid.appendChild(
                    crearTarjeta(archivo)
                );

            }
        );

    }


    function crearTarjeta(archivo) {

        const card =
            document.createElement("article");

        card.classList.add("file-card");

        card.innerHTML = `
            <header class="file-card__header">
                <span class="file-card__department">${escaparHTML(archivo.departamentoNombre || "Sin departamento")}</span>
                <span class="file-card__date">${escaparHTML(formatearFecha(archivo.fechaCreacion))}</span>
            </header>

            <span class="file-card__area">${escaparHTML(archivo.areaNombre || "Sin área")}</span>

            <h3 class="file-card__title">${escaparHTML(archivo.nombreArchivo)}</h3>

            <p class="file-card__reference">
                ${escaparHTML(archivo.referenciaTitulo)}
                ${
                    archivo.referenciaSubtitulo
                        ? `<span class="file-card__subtexto">${escaparHTML(archivo.referenciaSubtitulo)}</span>`
                        : ""
                }
            </p>

            <a
                class="file-card__download"
                href="${urlDescarga(archivo)}"
                target="_blank"
                rel="noopener"
            >
                Descargar
            </a>
        `;

        return card;

    }


    /* =====================================================
       EVENTOS DE FILTRO
       ===================================================== */

    if (filtroTexto) {

        filtroTexto.addEventListener(
            "input",
            aplicarFiltros
        );

    }


    return {
        render: cargarArchivos
    };

}
