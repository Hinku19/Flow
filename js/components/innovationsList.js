/* =========================================================
   INNOVACIONES REGISTRADAS (TARJETAS)
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    esAdmin,
    headerUsuario
} from "../services/auth.service.js";

import {
    confirmDialog
} from "../services/confirmDialog.js";


export function initInnovationsList({ onOpen } = {}) {

    const grid =
        document.querySelector("#innovaciones-tarjetas");

    const empty =
        document.querySelector("#innovaciones-empty");

    const loading =
        document.querySelector("#innovaciones-loading");

    const filtroTexto =
        document.querySelector("#filtro-innovaciones-texto");


    if (!grid) {

        console.warn(
            "No se encontró #innovaciones-tarjetas"
        );

        return {
            render: () => {}
        };

    }


    /* =====================================================
       ESTADO
       ===================================================== */

    let innovaciones = [];


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


    function formatearFecha(fechaISO) {

        if (!fechaISO) return "";

        const d = new Date(fechaISO);

        if (Number.isNaN(d.getTime())) return "";

        return d.toLocaleDateString("es-MX");

    }


    /* =====================================================
       CARGAR INNOVACIONES
       ===================================================== */

    async function cargarInnovaciones() {

        try {

            if (loading) loading.hidden = false;
            if (empty) empty.hidden = true;

            const response =
                await fetch(
                    `${API_URL}/innovaciones`
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible obtener las innovaciones."
                );

            }

            innovaciones =
                data.innovaciones ||
                [];

            aplicarFiltro();

        }
        catch (error) {

            console.error(
                "ERROR AL CARGAR INNOVACIONES:",
                error
            );

            grid.innerHTML = "";

            if (empty) {

                empty.hidden = false;

                const parrafo =
                    empty.querySelector("p");

                if (parrafo) {

                    parrafo.textContent =
                        "No fue posible cargar las innovaciones.";

                }

            }

        }
        finally {

            if (loading) loading.hidden = true;

        }

    }


    /* =====================================================
       FILTRO
       ===================================================== */

    function aplicarFiltro() {

        const texto =
            filtroTexto
                ? filtroTexto.value.trim().toLowerCase()
                : "";

        const innovacionesFiltradas =
            innovaciones.filter(
                (innovacion) => {

                    if (!texto) return true;

                    return (
                        String(innovacion.nombreInnovacion || "").toLowerCase().includes(texto) ||
                        String(innovacion.responsableNombre || "").toLowerCase().includes(texto) ||
                        String(innovacion.areaNombre || "").toLowerCase().includes(texto)
                    );

                }
            );

        renderTarjetas(innovacionesFiltradas);

    }


    /* =====================================================
       RENDER
       ===================================================== */

    function renderTarjetas(listaInnovaciones) {

        grid.innerHTML = "";

        if (
            !listaInnovaciones ||
            listaInnovaciones.length === 0
        ) {

            if (empty) empty.hidden = false;

            return;

        }

        if (empty) empty.hidden = true;

        listaInnovaciones.forEach(
            (innovacion) => {

                grid.appendChild(
                    crearTarjeta(innovacion)
                );

            }
        );

    }


    function crearTarjeta(innovacion) {

        const card =
            document.createElement("article");

        card.classList.add("innovation-card");

        card.dataset.id = innovacion.id;

        const archivosHTML =
            innovacion.archivos && innovacion.archivos.length > 0
                ? innovacion.archivos.map(
                    (archivo) => `
                        <a
                            class="innovation-card__file"
                            href="${API_URL}/innovaciones/archivos/${archivo.id}"
                            target="_blank"
                            rel="noopener"
                        >
                            📎 ${escaparHTML(archivo.nombreOriginal)}
                        </a>
                    `
                ).join("")
                : `<span class="innovation-card__no-files">Sin archivos adjuntos</span>`;

        card.innerHTML = `
            <header class="innovation-card__header">
                <span class="innovation-card__area">${escaparHTML(innovacion.areaNombre)}</span>
                <span class="innovation-card__date">${escaparHTML(formatearFecha(innovacion.fechaCreacion))}</span>
                ${
                    esAdmin()
                        ? `<button type="button" class="innovation-card__delete" data-id="${innovacion.id}" aria-label="Eliminar innovación">✕</button>`
                        : ""
                }
            </header>

            <h3 class="innovation-card__title">${escaparHTML(innovacion.nombreInnovacion)}</h3>

            ${
                innovacion.aprobada
                    ? `<span class="innovation-card__badge">✓ Aprobada</span>`
                    : ""
            }

            <p class="innovation-card__responsable">${escaparHTML(innovacion.responsableNombre)}</p>

            <div class="innovation-card__files">
                ${archivosHTML}
            </div>
        `;

        return card;

    }


    /* =====================================================
       ELIMINAR (SOLO ADMINISTRADOR)
       ===================================================== */

    async function eliminarInnovacion(innovacionId) {

        const confirmado =
            await confirmDialog(
                "¿Eliminar esta innovación? Se borrará junto con sus archivos adjuntos. Esta acción no se puede deshacer.",
                { danger: true }
            );

        if (!confirmado) return;

        try {

            const response =
                await fetch(
                    `${API_URL}/innovaciones/${innovacionId}`,
                    {
                        method: "DELETE",
                        headers: headerUsuario()
                    }
                );

            const data =
                await response.json();

            if (!data.ok) {

                throw new Error(
                    data.mensaje ||
                    "No fue posible eliminar la innovación."
                );

            }

            await cargarInnovaciones();

        }
        catch (error) {

            console.error(
                "ERROR AL ELIMINAR INNOVACIÓN:",
                error
            );

            alert(
                error.message ||
                "No fue posible eliminar la innovación."
            );

        }

    }


    /* =====================================================
       CLIC EN TARJETA (ABRIR DETALLE)
       ---------------------------------------------------------
       Los enlaces de descarga (.innovation-card__file) se dejan
       navegar tal cual: solo se abre el detalle si el clic cae
       en el resto de la tarjeta.
       ===================================================== */

    grid.addEventListener(
        "click",
        (event) => {

            const botonEliminar =
                event.target.closest(".innovation-card__delete");

            if (botonEliminar) {

                event.stopPropagation();

                const idAEliminar =
                    Number(botonEliminar.dataset.id);

                if (idAEliminar) {
                    eliminarInnovacion(idAEliminar);
                }

                return;

            }

            if (event.target.closest(".innovation-card__file")) {
                return;
            }

            const card =
                event.target.closest(".innovation-card");

            if (!card) return;

            const innovacionId =
                Number(card.dataset.id);

            if (
                innovacionId &&
                typeof onOpen === "function"
            ) {

                onOpen(innovacionId);

            }

        }
    );


    /* =====================================================
       EVENTOS
       ===================================================== */

    if (filtroTexto) {

        filtroTexto.addEventListener(
            "input",
            aplicarFiltro
        );

    }


    return {
        render: cargarInnovaciones
    };

}
