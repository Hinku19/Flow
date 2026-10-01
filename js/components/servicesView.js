import { API_URL } from "./config.js";
import { headerUsuario } from "../services/auth.service.js";
import { confirmDialog } from "../services/confirmDialog.js";

export function initServicesView() {
    const department = document.querySelector("#services-department");
    const area = document.querySelector("#services-area");
    const addButton = document.querySelector("#services-add");
    const historyButton = document.querySelector("#services-history");
    const list = document.querySelector("#services-list");
    const message = document.querySelector("#services-message");
    let showingHistory = false;
    let adding = false;
    let areaRequired = true;

    async function request(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: { ...headerUsuario(), ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.mensaje || "No fue posible completar la operación.");
        return data;
    }

    function setMessage(text = "") {
        message.textContent = text;
        message.hidden = !text;
    }

    function selectedScope() {
        return department.value && (!areaRequired || area.value);
    }

    function updateButtons() {
        const enabled = Boolean(selectedScope());
        addButton.disabled = !enabled || showingHistory || adding;
        historyButton.disabled = !enabled || adding;
        historyButton.textContent = showingHistory ? "Ocultar Anteriores" : "Revisar Anteriores";
    }

    function option(select, value, label) {
        const item = document.createElement("option");
        item.value = value;
        item.textContent = label;
        select.append(item);
    }

    async function loadAreas() {
        area.replaceChildren();
        option(area, "", "Selecciona un área");
        area.disabled = true;
        if (!department.value) {
            areaRequired = true;
            updateButtons();
            list.replaceChildren();
            return;
        }
        const data = await request(`${API_URL}/servicios/opciones?departamento=${encodeURIComponent(department.value)}`);
        areaRequired = Boolean(data.requiereArea);
        area.options[0].textContent = areaRequired ? "Selecciona un área" : "Sin área (opcional)";
        for (const name of data.areas || []) option(area, name, name);
        area.disabled = false;
        updateButtons();
        list.replaceChildren();
        if (areaRequired && !data.areas?.length) setMessage("No se encontraron áreas para este departamento.");
    }

    function makeServiceRow(service, archived = false) {
        const row = document.createElement("div");
        row.className = "services-view__row";
        const name = document.createElement("span");
        name.className = "services-view__name";
        name.textContent = service.nombre;
        row.append(name);
        if (!area.value && service.area) {
            const areaLabel = document.createElement("small");
            areaLabel.className = "services-view__area-label";
            areaLabel.textContent = service.area;
            row.append(areaLabel);
        }
        if (!archived) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "services-view__remove";
            remove.textContent = "−";
            remove.title = "Eliminar registro";
            remove.setAttribute("aria-label", "Eliminar registro");
            remove.addEventListener("click", async () => {
                const accepted = await confirmDialog("¿Seguro que desea eliminar el servicio?", {
                    danger: true, acceptLabel: "Eliminar", cancelLabel: "Cancelar"
                });
                if (!accepted) return;
                try {
                    await request(`${API_URL}/servicios/${service.id}`, { method: "DELETE" });
                    await loadServices();
                } catch (error) { setMessage(error.message); }
            });
            row.append(remove);
        }
        return row;
    }

    function makeNewRow() {
        const row = document.createElement("form");
        row.className = "services-view__row services-view__row--new";
        const input = document.createElement("input");
        input.className = "services-view__input";
        input.type = "text";
        input.maxLength = 150;
        input.placeholder = "Nombre del servicio";
        input.setAttribute("aria-label", "Nombre del servicio");
        input.required = true;
        const save = document.createElement("button");
        save.className = "services-view__save";
        save.type = "submit";
        save.textContent = "Guardar";
        const cancel = document.createElement("button");
        cancel.className = "services-view__cancel";
        cancel.type = "button";
        cancel.textContent = "Cancelar";
        cancel.addEventListener("click", () => { adding = false; loadServices(); });
        row.append(input, save, cancel);
        row.addEventListener("submit", async (event) => {
            event.preventDefault();
            const nombre = input.value.trim();
            if (!nombre) return input.focus();
            save.disabled = true;
            try {
                await request(`${API_URL}/servicios`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ departamento: department.value, area: area.value, nombre })
                });
                adding = false;
                await loadServices();
            } catch (error) {
                save.disabled = false;
                setMessage(error.message);
            }
        });
        return row;
    }

    async function loadServices() {
        setMessage("");
        list.replaceChildren();
        if (!selectedScope()) { updateButtons(); return; }
        updateButtons();
        try {
            const query = new URLSearchParams({ departamento: department.value, area: area.value, estado: "activo" });
            const data = await request(`${API_URL}/servicios?${query}`);
            if (!data.servicios?.length && !adding && !showingHistory) {
                const empty = document.createElement("p");
                empty.className = "services-view__empty";
                empty.textContent = "No hay servicios registrados en esta área.";
                list.append(empty);
            }
            for (const service of data.servicios || []) list.append(makeServiceRow(service));
            if (adding && !showingHistory) {
                list.append(makeNewRow());
                list.querySelector("input")?.focus();
            }
            if (showingHistory) {
                const historyTitle = document.createElement("h2");
                historyTitle.className = "services-view__history-title";
                historyTitle.textContent = "Servicios eliminados";
                list.append(historyTitle);
                const historyQuery = new URLSearchParams({ departamento: department.value, area: area.value, estado: "inactivo" });
                const historyData = await request(`${API_URL}/servicios?${historyQuery}`);
                if (!historyData.servicios?.length) {
                    const emptyHistory = document.createElement("p");
                    emptyHistory.className = "services-view__empty";
                    emptyHistory.textContent = "No hay servicios anteriores en esta área.";
                    list.append(emptyHistory);
                } else {
                    for (const service of historyData.servicios) list.append(makeServiceRow(service, true));
                }
            }
        } catch (error) { setMessage(error.message); }
    }

    department.addEventListener("change", async () => {
        showingHistory = false;
        adding = false;
        setMessage("");
        try { await loadAreas(); } catch (error) { setMessage(error.message); }
    });
    area.addEventListener("change", () => {
        showingHistory = false;
        adding = false;
        loadServices();
    });
    addButton.addEventListener("click", () => { adding = true; loadServices(); });
    historyButton.addEventListener("click", () => { showingHistory = !showingHistory; adding = false; loadServices(); });

    async function render() {
        setMessage("");
        if (department.options.length <= 1) {
            try {
                const data = await request(`${API_URL}/servicios/opciones`);
                for (const name of data.departamentos || []) option(department, name, name);
            } catch (error) { setMessage(error.message); }
        }
        updateButtons();
        if (selectedScope()) await loadServices();
    }

    return { render };
}
