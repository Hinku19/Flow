import { loadData, saveData } from "../services/storage.service.js";
import { API_URL } from "./config.js";
import { capitalizar } from "../utils/capitalize.js";
import { confirmarEliminacion, confirmDialog, avisoDialog } from "../services/confirmDialog.js";
import { getUsuarioActual, headerUsuario } from "../services/auth.service.js";
import { obtenerResponsables, nombresResponsables, esResponsable, mismaArea, obtenerInvolucrados, textoInvolucrados } from "../utils/responsables.js";
import { crearSelectorResponsables } from "../utils/selectorResponsables.js";
import { generarUUID } from "../utils/generarUUID.js";
import { reagendarDialog, crearAvisoReagenda, fechaInputReagenda } from "../services/reagendarDialog.js";

export const ESTADO_LABEL = {
  "pendiente": "Pendiente",
  "vencido": "Vencido",
  "en-revision": "En espera de visto bueno",
  "completado": "Completado",
  "completado-destiempo": "Completado a destiempo",
};

function fechaLocalISO(fecha) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";

  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");

  return `${d.getFullYear()}-${mes}-${dia}`;
}

/*
 * Estatus visible de un compromiso de la reunión (mismo criterio
 * que el servidor, ver SQL_ESTADO_COMPROMISO en server.js). En el
 * JSON solo se guarda "pendiente"/"completado" más `aprobado`; el
 * resto se calcula: a tiempo o a destiempo según la fecha en que
 * el responsable lo marcó (fechaCompletado) contra la fecha límite.
 */
export function estadoCompromiso(data) {
  if (data.estado === "completado") {
    if (!data.aprobado) return "en-revision";

    const completadoEl = data.fechaCompletado ? fechaLocalISO(data.fechaCompletado) : "";

    return data.fechaLimite && completadoEl && completadoEl > data.fechaLimite
      ? "completado-destiempo"
      : "completado";
  }

  return data.fechaLimite && data.fechaLimite < fechaLocalISO(new Date())
    ? "vencido"
    : "pendiente";
}

/*
 * "Completado: ... · Visto bueno: ..." para vistas de solo
 * lectura (Archivo, PDF de la reunión).
 */
export function textoFechasCompromiso(data) {
  if (data.estado !== "completado") return "";

  return [
    data.fechaCompletado ? `Completado: ${formatearFechaCompletado(data.fechaCompletado)}` : "",
    data.aprobado && data.fechaAprobacion ? `Visto bueno: ${formatearFechaCompletado(data.fechaAprobacion)}` : "",
  ].filter(Boolean).join(" · ");
}

function esLiderOAdmin(usuario) {
  return usuario?.rol === "lider" || usuario?.rol === "administrador";
}

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
  const selectorResponsables = crearSelectorResponsables(container.querySelector(".commitment-list__responsables"));
  const selectorInvolucrados = crearSelectorResponsables(container.querySelector(".commitment-list__involucrados"), {
    etiqueta: "Personas involucradas",
    singular: "Involucrado",
    plural: "involucrados",
    conFiltros: true,
  });

  let items = loadData(storageKey);
  let editingId = null; //* NULL significa "modo alta" y cualquier id significa "modo edición"
  let origenPunto = null; //* { objetivoId, blockId } cuando el compromiso viene de un punto de desarrollo

  async function cargarUsuarios() {
    try {
      const response = await fetch(`${API_URL}/usuarios`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.mensaje || data.error || "No fue posible cargar los usuarios.");
      }

      const activos = (data.usuarios || [])
        .filter((usuario) => Number(usuario.activo) === 1)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      /* responsables: solo del mismo departamento y área; involucrados: cualquiera */
      selectorResponsables.setUsuarios(activos.filter((usuario) => mismaArea(usuario, getUsuarioActual())));
      selectorInvolucrados.setUsuarios(activos);
    } catch (error) {
      console.error("ERROR CARGANDO USUARIOS PARA COMPROMISOS:", error);
    }
  }

  /*
   * Solo un responsable del compromiso (cualquiera, si tiene
   * varios) o un administrador pueden marcarlo como completado.
   * El líder que no es responsable solo da el visto bueno, una
   * vez que el responsable lo completó.
   */
  function puedeCompletar(data) {
    const usuario = getUsuarioActual();

    return (
      usuario?.rol === "administrador" ||
      esResponsable(data, usuario?.id)
    );
  }

  function crearBotonSecundario(accion, texto) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.classList.add("commitment-card__secundario");
    boton.dataset.accion = accion;
    boton.textContent = texto;
    return boton;
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

    const estado = estadoCompromiso(data);

    const badge = document.createElement("span");
    badge.classList.add("commitment-card__badge");
    badge.classList.add(`commitment-card__badge--${estado}`);
    badge.textContent = ESTADO_LABEL[estado];

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

    const botones = document.createElement("div");
    botones.classList.add("commitment-card__botones");
    const liderOAdmin = esLiderOAdmin(getUsuarioActual());

    if (data.estado !== "completado" && puedeCompletar(data)) {
      const completeBtn = document.createElement("button");
      completeBtn.type = "button";
      completeBtn.classList.add("commitment-card__complete-vencido");
      completeBtn.textContent = "Marcar como completado";
      botones.append(completeBtn);
    }

    if (estado === "en-revision" && liderOAdmin) {
      const aprobarBtn = document.createElement("button");
      aprobarBtn.type = "button";
      aprobarBtn.classList.add("commitments-view__aprobar");
      aprobarBtn.textContent = "Dar visto bueno";
      botones.append(aprobarBtn);
    }

    /*
     * Deshacer el completado: el responsable (o administrador),
     * mientras no tenga visto bueno; si ya lo tiene, solo si además
     * es líder o administrador (quien puede quitar el visto bueno).
     */
    if (data.estado === "completado" && puedeCompletar(data) && (!data.aprobado || liderOAdmin)) {
      botones.append(crearBotonSecundario("deshacer-completado", "↶ Deshacer completado"));
    }

    if (data.estado === "completado" && data.aprobado && liderOAdmin) {
      botones.append(crearBotonSecundario("deshacer-visto-bueno", "↶ Deshacer visto bueno"));
    }

    if (data.estado !== "completado" && liderOAdmin) {
      const reagendarBtn = crearBotonSecundario("reagendar", "Re-agendar");
      reagendarBtn.classList.add("commitment-card__reagendar");
      botones.append(reagendarBtn);
    }

    if (botones.children.length > 0) {
      card.append(botones);
    }

    const meta = document.createElement("div");
    meta.classList.add("commitment-card__meta");
    meta.textContent = `${nombresResponsables(data) || "?"} · ${data.fechaInicio || "?"} → ${data.fechaLimite || "?"} · ${data.vencidoInformativo ? "Vencido de la reunión anterior" : ESTADO_LABEL[estado]} · ${PRIORIDAD_LABEL[data.prioridad]}`;

    card.append(meta);

    if (textoInvolucrados(data)) {
      const involucrados = document.createElement("div");
      involucrados.classList.add("commitment-card__involucrados");
      involucrados.textContent = `Involucrados: ${textoInvolucrados(data)}`;
      card.append(involucrados);
    }

    const avisoReagenda = crearAvisoReagenda(data);
    if (avisoReagenda) card.append(avisoReagenda);

    /*
     * Dos fechas: cuando el responsable lo marcó como completado
     * y cuando el líder dio el visto bueno.
     */
    if (data.estado === "completado" && data.fechaCompletado) {
      const completado = document.createElement("div");
      completado.classList.add("commitment-card__completado");
      completado.textContent = `Completado: ${formatearFechaCompletado(data.fechaCompletado)}`;
      card.append(completado);
    }

    if (data.estado === "completado" && data.aprobado && data.fechaAprobacion) {
      const vistoBueno = document.createElement("div");
      vistoBueno.classList.add("commitment-card__completado");
      vistoBueno.textContent = `Visto bueno: ${formatearFechaCompletado(data.fechaAprobacion)}`;
      card.append(vistoBueno);
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
          headers: { "Content-Type": "application/json", ...headerUsuario() },
          body: JSON.stringify({ compromisos: items }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.mensaje || data.error || "No fue posible sincronizar los compromisos.");
      }
    } catch (error) {
      console.error("ERROR SINCRONIZANDO COMPROMISOS CON LA TABLA:", error);
      avisoDialog(error.message || "No fue posible sincronizar los compromisos con la base de datos.");
    }
  }

  function render() {
    const cards = items.map(createCard);
    list.replaceChildren(...cards);
    saveData(storageKey, items);
    sincronizarConTablaSiAplica();
  }

  function addCommitment(data) {
    items.push({ id: generarUUID(), estado: "pendiente", ...data });
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
        ...(dejaDeCompletado ? { aprobado: false, aprobadoPorId: null, fechaAprobacion: null } : {}),
      };
    });
    render();
  }

  function removeCommitment(id) {
    items = items.filter((item) => item.id !== id);
    render();
  }

  /*
   * El responsable lo marca como completado: queda en espera del
   * visto bueno, salvo que quien lo marca sea líder (o
   * administrador), que no se da el visto bueno a sí mismo y
   * queda aprobado de una vez. Ya no se vuelve a heredar en la
   * siguiente reunión (ver server.js).
   */
  function completarCompromiso(id) {
    const usuario = getUsuarioActual();

    updateCommitment(id, {
      estado: "completado",
      vencidoInformativo: false,
      ...(esLiderOAdmin(usuario)
        ? { aprobado: true, aprobadoPorId: usuario.id, fechaAprobacion: new Date().toISOString() }
        : {}),
    });
  }

  /*
   * Visto bueno del líder dentro de la reunión: al finalizarla,
   * el servidor valida que aprobadoPorId sea de verdad líder o
   * administrador (ver insertarCompromiso en server.js).
   */
  function darVistoBueno(id) {
    const usuario = getUsuarioActual();

    if (!esLiderOAdmin(usuario)) return;

    updateCommitment(id, {
      aprobado: true,
      aprobadoPorId: usuario.id,
      fechaAprobacion: new Date().toISOString(),
    });
  }

  /*
   * Quitar el visto bueno dentro de la reunión: vuelve a quedar en
   * espera de visto bueno (sigue completado, con su fecha).
   */
  function deshacerVistoBueno(id) {
    if (!esLiderOAdmin(getUsuarioActual())) return;

    updateCommitment(id, { aprobado: false, aprobadoPorId: null, fechaAprobacion: null });
  }

  /*
   * Re-agendar dentro de la reunión (solo líder / administrador):
   * conserva la primera fecha límite en fechaLimiteOriginal y
   * agrega la re-agenda al historial; al finalizar la reunión el
   * servidor lo pasa a la tabla (ver combinarReagendas en
   * server.js).
   */
  async function reagendarCompromiso(id) {
    const usuario = getUsuarioActual();
    const data = items.find((item) => item.id === id);
    if (!data || !esLiderOAdmin(usuario)) return;

    const resultado = await reagendarDialog(data);
    if (!resultado) return;

    updateCommitment(id, {
      fechaLimiteOriginal: data.fechaLimiteOriginal || data.fechaLimite,
      fechaLimite: resultado.fechaLimite,
      reagendas: [
        ...(Array.isArray(data.reagendas) ? data.reagendas : []),
        {
          fechaAnterior: fechaInputReagenda(data.fechaLimite) || null,
          fechaNueva: resultado.fechaLimite,
          motivo: resultado.motivo,
          usuarioId: usuario.id,
          usuarioNombre: usuario.nombre,
          fecha: new Date().toISOString(),
        },
      ],
      vencidoInformativo: resultado.fechaLimite < fechaLocalISO(new Date()),
    });
  }

  /*
   * usuarioAsignadoId / usuarioAsignadoNombre se siguen guardando
   * con el primer responsable (el principal) por compatibilidad con
   * lo que todavía lee un solo responsable.
   */
  function readForm() {
    const formData = new FormData(form);
    const responsables = selectorResponsables.getSeleccionados();

    return {
      responsables,
      usuarioAsignadoId: responsables[0]?.id || null,
      usuarioAsignadoNombre: responsables[0]?.nombre || "",
      personasInvolucradas: selectorInvolucrados.getSeleccionados(),
      descripcion: formData.get("descripcion").trim(),
      fechaInicio: formData.get("fechaInicio"),
      fechaLimite: formData.get("fechaLimite"),
      prioridad: formData.get("prioridad"),

    };
  }

  function fillForm(data) {
    selectorResponsables.setSeleccionados(obtenerResponsables(data));
    selectorInvolucrados.setSeleccionados(obtenerInvolucrados(data));
    form.elements.descripcion.value = data.descripcion;
    form.elements.fechaInicio.value = data.fechaInicio || "";
    form.elements.fechaLimite.value = data.fechaLimite || "";
    // Una vez establecida, la fecha límite ya no se puede cambiar.
    form.elements.fechaLimite.readOnly = Boolean(data.fechaLimite);
    form.elements.prioridad.value = data.prioridad;
  }

  function openDialogForNew(descripcionInicial, origen) {
    editingId = null;
    origenPunto = origen || null;
    form.elements.fechaLimite.readOnly = false;
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
    selectorResponsables.limpiar();
    selectorInvolucrados.limpiar();
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

    if (data.responsables.length === 0) {
      avisoDialog("Selecciona al menos un responsable.");
      return;
    }

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
      const id = card.dataset.id;

      confirmarEliminacion(
        "¿Eliminar este compromiso? Esta acción no se puede deshacer."
      ).then((confirmado) => {
        if (confirmado) removeCommitment(id);
      });

      return;
    }

    if (event.target.matches(".commitment-card__complete-vencido")) {
      completarCompromiso(card.dataset.id);
      return;
    }

    if (event.target.matches(".commitments-view__aprobar")) {
      darVistoBueno(card.dataset.id);
      return;
    }

    const accion = event.target.closest("[data-accion]")?.dataset.accion;

    if (accion === "deshacer-completado") {
      confirmDialog("¿Deshacer el completado? El compromiso vuelve a quedar pendiente.").then((confirmado) => {
        if (confirmado) updateCommitment(card.dataset.id, { estado: "pendiente" });
      });
      return;
    }

    if (accion === "deshacer-visto-bueno") {
      confirmDialog("¿Quitar el visto bueno? El compromiso vuelve a quedar en espera de visto bueno.").then((confirmado) => {
        if (confirmado) deshacerVistoBueno(card.dataset.id);
      });
      return;
    }

    if (accion === "reagendar") {
      reagendarCompromiso(card.dataset.id);
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