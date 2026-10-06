import { capitalizar } from "../utils/capitalize.js";

const dialog = document.querySelector(".reagendar-dialog");
const form = dialog.querySelector(".reagendar-dialog__form");
const compromiso = dialog.querySelector(".reagendar-dialog__compromiso");
const original = dialog.querySelector(".reagendar-dialog__original");
const actual = dialog.querySelector(".reagendar-dialog__actual");
const error = dialog.querySelector(".reagendar-dialog__error");
const historial = dialog.querySelector(".reagendar-dialog__historial");
const listaHistorial = dialog.querySelector(".reagendar-dialog__lista");
const cancelBtn = dialog.querySelector(".reagendar-dialog__cancelar");

/*
 * "YYYY-MM-DD" se interpreta en hora local (new Date() la tomaría
 * como UTC y en México mostraría el día anterior); cualquier otra
 * fecha (ISO con hora, Date) se usa tal cual.
 */
function aFecha(valor) {
  if (!valor) return null;

  const soloFecha = typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const d = soloFecha ? new Date(`${valor}T00:00:00`) : new Date(valor);

  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatearFechaReagenda(valor) {
  const d = aFecha(valor);
  if (!d) return "-";

  const dia = String(d.getDate()).padStart(2, "0");
  const mes = capitalizar(d.toLocaleDateString("es-MX", { month: "short" }));

  return `${dia}/${mes}/${d.getFullYear()}`;
}

/* "YYYY-MM-DD" (hora local) para <input type="date"> y comparaciones */
export function fechaInputReagenda(valor) {
  const d = aFecha(valor);
  if (!d) return "";

  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");

  return `${d.getFullYear()}-${mes}-${dia}`;
}

/*
 * Primera fecha límite del compromiso: la guardada al re-agendar
 * por primera vez o, si nunca se re-agendó, la actual.
 */
function fechaOriginal(data) {
  return data.fechaLimiteOriginal || data.reagendas?.[0]?.fechaAnterior || data.fechaLimite;
}

function crearItemsHistorial(reagendas) {
  return reagendas.map((reagenda) => {
    const item = document.createElement("li");
    item.classList.add("reagenda-historial__item");

    const cambio = document.createElement("span");
    cambio.classList.add("reagenda-historial__cambio");
    cambio.textContent = `${formatearFechaReagenda(reagenda.fechaAnterior)} → ${formatearFechaReagenda(reagenda.fechaNueva)}`;

    const quien = document.createElement("span");
    quien.classList.add("reagenda-historial__quien");
    quien.textContent = `${reagenda.usuarioNombre || "?"} · ${formatearFechaReagenda(reagenda.fecha)}`;

    const motivo = document.createElement("p");
    motivo.classList.add("reagenda-historial__motivo");
    motivo.textContent = reagenda.motivo || "";

    item.append(cambio, quien, motivo);
    return item;
  });
}

/*
 * Aviso para la tarjeta del compromiso cuando ya se re-agendó:
 * "Re-agendado (N) · Fecha límite original: ...", desplegable
 * con el historial (fechas, quién y por qué). null si nunca se
 * re-agendó.
 */
export function crearAvisoReagenda(data) {
  const reagendas = Array.isArray(data.reagendas) ? data.reagendas : [];
  if (reagendas.length === 0) return null;

  const aviso = document.createElement("details");
  aviso.classList.add("reagenda-aviso");

  const resumen = document.createElement("summary");
  resumen.classList.add("reagenda-aviso__resumen");
  resumen.textContent =
    `↻ Re-agendado${reagendas.length > 1 ? ` (${reagendas.length})` : ""}` +
    ` · Fecha límite original: ${formatearFechaReagenda(fechaOriginal(data))}`;

  const lista = document.createElement("ol");
  lista.classList.add("reagenda-historial");
  lista.append(...crearItemsHistorial(reagendas));

  aviso.append(resumen, lista);
  return aviso;
}

/*
 * Pide la nueva fecha límite y el motivo (obligatorio).
 * Resuelve { fechaLimite, motivo } o null si se canceló.
 */
export function reagendarDialog(data) {
  const reagendas = Array.isArray(data.reagendas) ? data.reagendas : [];
  const fechaActual = fechaInputReagenda(data.fechaLimite);
  const fechaInicio = fechaInputReagenda(data.fechaInicio);

  form.reset();
  error.hidden = true;
  compromiso.textContent = data.descripcion || "";
  original.textContent = formatearFechaReagenda(fechaOriginal(data));
  actual.textContent = formatearFechaReagenda(data.fechaLimite);
  form.elements.fechaLimite.min = fechaInicio;

  historial.hidden = reagendas.length === 0;
  historial.open = false;
  listaHistorial.replaceChildren(...crearItemsHistorial(reagendas));

  dialog.showModal();
  form.elements.fechaLimite.focus();

  function mostrarError(texto) {
    error.textContent = texto;
    error.hidden = false;
  }

  return new Promise((resolve) => {
    function cleanup(resultado) {
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("input", onInput);
      cancelBtn.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      dialog.close();
      resolve(resultado);
    }

    function onSubmit(event) {
      event.preventDefault();

      const fechaLimite = form.elements.fechaLimite.value;
      const motivo = form.elements.motivo.value.trim();

      if (!fechaLimite) return mostrarError("Elige la nueva fecha límite.");
      if (fechaLimite === fechaActual) return mostrarError("La nueva fecha límite es igual a la actual.");
      if (fechaInicio && fechaLimite < fechaInicio) {
        return mostrarError("La nueva fecha límite no puede ser anterior a la fecha de inicio.");
      }
      if (!motivo) return mostrarError("Explica por qué se re-agenda el compromiso.");

      cleanup({ fechaLimite, motivo });
    }

    function onInput() {
      error.hidden = true;
    }

    function onCancel(event) {
      event?.preventDefault();
      cleanup(null);
    }

    form.addEventListener("submit", onSubmit);
    form.addEventListener("input", onInput);
    cancelBtn.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel);
  });
}
