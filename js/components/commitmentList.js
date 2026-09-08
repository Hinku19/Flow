import { loadData, saveData } from "../services/storage.service.js";
import { API_URL } from "./config.js";
import { capitalizar } from "../utils/capitalize.js";

export const ESTADO_LABEL = {
  "pendiente": "Pendiente",
  "en-progreso": "En progreso",
  "completado": "Completado",
  "vencido": "Vencido",
};

export const PRIORIDAD_LABEL = {
  "alta": "Prioridad alta",
  "media": "Prioridad media",
  "baja": "Prioridad baja",
};

function formatearFechaCompletado(fechaISO) {
  if (!fechaISO) return "";

  const d = new Date(fechaISO);
  if (Number.isNaN(d.getTime())) return "";

  const dia = String(d.getDate()).padStart(2, "0");
  const mes = capitalizar(d.toLocaleDateString("es-MX", { month: "short" }));

  return `${dia}/${mes}/${d.getFullYear()}`;
}

/*
 * "flow:punto-a-compromiso" es un evento global (document), y
 * createCommitmentList() se vuelve a llamar una vez por cada
 * reunión que se inicia en la misma pestaña. Sin este control,
 * cada llamada dejaría su propio listener pegado a document
 * (acumulando uno por reunión, con un `dialog` cada vez más
 * viejo/desmontado del documento).
 */
let quitarListenerPuntoACompromiso = null;

export function createCommitmentList({ container, storageKey, sincronizarTabla }) {
  const list = container.querySelector(".commitment-list__list");
  const addBtn = container.querySelector(".commitment-list__add");
  const dialog = container.querySelector(".commitment-list__dialog");
  const cancelBtn = container.querySelector(".commitment-list__cancel");
  const form = container.querySelector(".commitment-list__form");
  const formTitle = container.querySelector(".commitment-list__form-title");
  const saveBtn = container.querySelector(".commitment-list__save");
  const usuarioSelect = container.querySelector(".commitment-list__usuarios");

  let items = loadData(storageKey);
  let editingId = null; //* NULL significa "modo alta" y cualquier id significa "modo edición"
  let origenPunto = null; //* { objetivoId, blockId } cuando el compromiso viene de un punto de desarrollo

  async function cargarUsuarios() {
    if (!usuarioSelect) return;

    try {
      const response = await fetch(`${API_URL}/usuarios`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.mensaje || data.error || "No fue posible cargar los usuarios.");
      }

      const usuarios = (data.usuarios || [])
        .filter((usuario) => Number(usuario.activo) === 1)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      usuarioSelect.innerHTML = `<option value="">Seleccione un responsable</option>`;

      usuarios.forEach((usuario) => {
        const option = document.createElement("option");
        option.value = usuario.id;
        option.textContent = usuario.nombre;
        usuarioSelect.appendChild(option);
      });
    } catch (error) {
      console.error("ERROR CARGANDO USUARIOS PARA COMPROMISOS:", error);
    }
  }

  function createCard(data) {
    const card = document.createElement("li");
    card.classList.add("commitment-card");
    card.dataset.id = data.id;

    if (data.vencidoInformativo) {
      card.classList.add("commitment-card--vencido");
    } else {
      card.classList.add(`commitment-card--${data.prioridad}`);
      card.title = "clic para editar";
    }

    const header = document.createElement("div");
    header.classList.add("commitment-card__header");

    const title = document.createElement("span");
    title.classList.add("commitment-card__title");
    title.textContent = data.descripcion;

    const actions = document.createElement("div");
    actions.classList.add("commitment-card__actions");

    const badge = document.createElement("span");
    badge.classList.add("commitment-card__badge");
    badge.classList.add(`commitment-card__badge--${data.vencidoInformativo ? "vencido" : data.estado}`);
    badge.textContent = data.vencidoInformativo ? "Vencido" : ESTADO_LABEL[data.estado];

    actions.append(badge);

    if (!data.vencidoInformativo) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.classList.add("commitment-card__delete");
      deleteBtn.textContent = "✕";
      deleteBtn.setAttribute("aria-label", "Eliminar compromiso");
      actions.append(deleteBtn);
    }

    header.append(title, actions);
    card.append(header);

    if (data.vencidoInformativo) {
      const completeBtn = document.createElement("button");
      completeBtn.type = "button";
      completeBtn.classList.add("commitment-card__complete-vencido");
      completeBtn.textContent = "Marcar como completado";
      card.append(completeBtn);
    }

    const meta = document.createElement("div");
    meta.classList.add("commitment-card__meta");
    meta.textContent = `${data.usuarioAsignadoNombre || "?"} · ${data.fechaInicio || "?"} → ${data.fechaLimite || "?"} · ${data.vencidoInformativo ? "Vencido de la reunión anterior" : ESTADO_LABEL[data.estado]} · ${PRIORIDAD_LABEL[data.prioridad]}`;

    card.append(meta);

    if (data.estado === "completado" && data.fechaCompletado) {
      const completado = document.createElement("div");
      completado.classList.add("commitment-card__completado");
      completado.textContent = `Completado: ${formatearFechaCompletado(data.fechaCompletado)}`;
      card.append(completado);
    }

    return card;
  }

  /*
   * Solo aplica cuando esta lista pertenece a una reunión ya
   * finalizada que sigue editable el mismo día (ver
   * archiveView.js). Mantiene la tabla `compromisos` (registro
   * permanente) sincronizada con cada cambio, no solo con lo
   * que ya se guarda en reunion_secciones.
   */
  async function sincronizarConTablaSiAplica() {
    if (!sincronizarTabla?.reunionId) return;

    try {
      const response = await fetch(
        `${API_URL}/reuniones/${sincronizarTabla.reunionId}/compromisos`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ compromisos: items }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.mensaje || data.error || "No fue posible sincronizar los compromisos.");
      }
    } catch (error) {
      console.error("ERROR SINCRONIZANDO COMPROMISOS CON LA TABLA:", error);
      alert(error.message || "No fue posible sincronizar los compromisos con la base de datos.");
    }
  }

  function render() {
    const cards = items.map(createCard);
    list.replaceChildren(...cards);
    saveData(storageKey, items);
    sincronizarConTablaSiAplica();
  }

  function addCommitment(data) {
    items.push({ id: crypto.randomUUID(), ...data });
    render();
  }

  function updateCommitment(id, data) {
    items = items.map((item) => {
      if (item.id !== id) return item;

      const pasaACompletado = data.estado === "completado" && item.estado !== "completado";
      const dejaDeCompletado = data.estado && data.estado !== "completado" && item.estado === "completado";

      return {
        ...item,
        ...data,
        fechaCompletado: pasaACompletado
          ? new Date().toISOString()
          : dejaDeCompletado
            ? null
            : item.fechaCompletado,
      };
    });
    render();
  }

  function removeCommitment(id) {
    items = items.filter((item) => item.id !== id);
    render();
  }

  /*
   * Marca un compromiso vencido (heredado de una reunión anterior)
   * como completado: deja de mostrarse como "Vencido" y ya no se
   * vuelve a heredar en la siguiente reunión (ver server.js).
   */
  function completarVencido(id) {
    updateCommitment(id, { estado: "completado", vencidoInformativo: false });
  }

  function readForm() {
    const formData = new FormData(form);

    const usuarioAsignadoId = Number(formData.get("usuarioAsignadoId"));
    const opcionSeleccionada = usuarioSelect?.selectedOptions?.[0];

    return {
      usuarioAsignadoId,
      usuarioAsignadoNombre: opcionSeleccionada?.textContent || "",
      descripcion: formData.get("descripcion").trim(),
      fechaInicio: formData.get("fechaInicio"),
      fechaLimite: formData.get("fechaLimite"),
      estado: formData.get("estado"),
      prioridad: formData.get("prioridad"),

    };
  }

  function fillForm(data) {
    form.elements.usuarioAsignadoId.value = data.usuarioAsignadoId || "";
    form.elements.descripcion.value = data.descripcion;
    form.elements.fechaInicio.value = data.fechaInicio || "";
    form.elements.fechaLimite.value = data.fechaLimite || "";
    form.elements.estado.value = data.estado;
    form.elements.prioridad.value = data.prioridad;
  }

  function openDialogForNew(descripcionInicial, origen) {
    editingId = null;
    origenPunto = origen || null;
    formTitle.textContent = "Nuevo compromiso";
        saveBtn.textContent = "Guardar"

    dialog.showModal();

    if (descripcionInicial) {
      form.elements.descripcion.value = descripcionInicial;
    }
  }

  function openDialogForEdit(id) {
    const data = items.find((item) => item.id === id);
    if (!data) return;
    editingId = id;
    fillForm(data);
    formTitle.textContent = "Editar compromiso";
    saveBtn.textContent = "Actualizar"
    dialog.showModal();
  }

  function closeDialog() {
    dialog.close();
    form.reset();
    editingId = null;
    origenPunto = null;
  }

  addBtn.addEventListener("click", () => openDialogForNew());

  if (quitarListenerPuntoACompromiso) {
    quitarListenerPuntoACompromiso();
  }

  function alPuntoConvertidoEnCompromiso(event) {
    openDialogForNew(event.detail?.descripcion, {
      objetivoId: event.detail?.objetivoId,
      blockId: event.detail?.blockId,
    });
  }

  document.addEventListener(
    "flow:punto-a-compromiso",
    alPuntoConvertidoEnCompromiso
  );

  quitarListenerPuntoACompromiso = () =>
    document.removeEventListener(
      "flow:punto-a-compromiso",
      alPuntoConvertidoEnCompromiso
    );

  cancelBtn.addEventListener("click", closeDialog);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = readForm();

    if (editingId === null) {
      addCommitment(data);

      if (origenPunto?.objetivoId && origenPunto?.blockId) {
        document.dispatchEvent(
          new CustomEvent("flow:compromiso-creado-desde-punto", {
            detail: origenPunto,
          })
        );
      }
    } else {
      updateCommitment(editingId, data);
    }

    closeDialog();
  });

  list.addEventListener("click", (event) => {
    const card = event.target.closest(".commitment-card");
    if (!card) return;

    if (event.target.matches(".commitment-card__delete")) {
      removeCommitment(card.dataset.id);
      return;
    }

    if (event.target.matches(".commitment-card__complete-vencido")) {
      completarVencido(card.dataset.id);
    }
  });

  list.addEventListener("dblclick", (event)=>{
    const card = event.target.closest(".commitment-card");
    if(!card) return;
    if (card.classList.contains("commitment-card--vencido")) return;

    openDialogForEdit(card.dataset.id)
  })

  cargarUsuarios();
  render();
}