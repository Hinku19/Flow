import { API_URL } from "./config.js";
import { headerUsuario } from "../services/auth.service.js";

const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

function formatoFecha(value) {
    if (!value) return "Fecha no disponible";
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!match) return value;
    const [, year, month, day, hour, minute] = match;
    return `${day}/${month}/${year}${hour ? ` · ${hour}:${minute}` : ""}`;
}

export function initMinutesView() {
    const list = document.querySelector("#minutes-list");
    const message = document.querySelector("#minutes-message");
    const frame = document.querySelector("#minutes-pdf");
    const empty = document.querySelector("#minutes-preview-empty");
    const title = document.querySelector("#minutes-preview-title");
    const print = document.querySelector("#minutes-print");
    if (!list || !frame) return { render: async () => {} };

    let objectUrl = null;

    function mostrarMensaje(texto = "") {
        message.textContent = texto;
        message.hidden = !texto;
    }

    function liberarPDF() {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        frame.removeAttribute("src");
        frame.hidden = true;
        empty.hidden = false;
        print.disabled = true;
        title.textContent = "Selecciona una minuta";
    }

    async function abrir(minuta, boton) {
        mostrarMensaje("");
        list.querySelectorAll(".minutes-view__item").forEach(item => item.classList.remove("is-selected"));
        boton.classList.add("is-selected");
        liberarPDF();
        title.textContent = minuta.Titulo || "Minuta de reunión";
        try {
            const response = await fetch(`${API_URL}/minutas/${encodeURIComponent(minuta.ReunionId)}/pdf`, {
                headers: { ...headerUsuario() }
            });
            if (!response.ok) {
                let data = {};
                try { data = await response.json(); } catch {}
                throw new Error(data.mensaje || "No fue posible abrir el PDF.");
            }
            objectUrl = URL.createObjectURL(await response.blob());
            frame.src = objectUrl;
            frame.hidden = false;
            empty.hidden = true;
            print.disabled = false;
        } catch (error) {
            mostrarMensaje(error.message || "Ocurrió un error al abrir la minuta.");
            title.textContent = "No se pudo abrir la minuta";
        }
    }

    print.addEventListener("click", () => {
        try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
        } catch {
            mostrarMensaje("No fue posible iniciar la impresión. Intenta abrir el PDF desde la vista previa del navegador.");
        }
    });

    window.addEventListener("beforeunload", liberarPDF, { once: true });

    async function render() {
        liberarPDF();
        mostrarMensaje("");
        list.innerHTML = '<p class="minutes-view__empty">Cargando minutas…</p>';
        try {
            const response = await fetch(`${API_URL}/minutas`, { headers: { ...headerUsuario() } });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error(data.mensaje || "No fue posible cargar las minutas.");
            const minutas = data.minutas || [];
            if (!minutas.length) {
                list.innerHTML = '<p class="minutes-view__empty">Aún no hay minutas guardadas.</p>';
                return;
            }
            list.replaceChildren();
            for (const minuta of minutas) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "minutes-view__item";
                button.innerHTML = `<strong>${escapeHTML(minuta.Titulo || "Reunión")}</strong><span>${escapeHTML(formatoFecha(minuta.FechaReunion))}</span>`;
                button.addEventListener("click", () => abrir(minuta, button));
                list.append(button);
            }
        } catch (error) {
            list.replaceChildren();
            mostrarMensaje(error.message || "Ocurrió un error al cargar las minutas.");
        }
    }

    return { render };
}
