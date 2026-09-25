const dialog = document.querySelector(".asignar-dialog");
const form = dialog.querySelector(".asignar-dialog__form");
const objetivo = dialog.querySelector(".asignar-dialog__objetivo");
const opciones = dialog.querySelector(".asignar-dialog__opciones");
const error = dialog.querySelector(".asignar-dialog__error");
const cancelBtn = dialog.querySelector(".asignar-dialog__cancelar");

/*
 * Pide elegir a los responsables de un objetivo (uno o varios)
 * entre los participantes de la reunión. Resuelve un arreglo
 * [{ id, nombre }] con los elegidos, o null si se canceló.
 */
export function asignarResponsableDialog({ texto, participantes, seleccionadosIds = [] }) {
  objetivo.textContent = texto;
  error.hidden = true;

  const seleccionados = new Set(seleccionadosIds.map(Number));

  opciones.replaceChildren(
    ...participantes.map((participante) => {
      const label = document.createElement("label");
      label.classList.add("asignar-dialog__opcion");

      const check = document.createElement("input");
      check.type = "checkbox";
      check.value = participante.id;
      check.checked = seleccionados.has(Number(participante.id));

      const nombre = document.createElement("span");
      nombre.textContent = participante.nombre;

      label.append(check, nombre);
      return label;
    })
  );

  dialog.showModal();
  opciones.querySelector("input")?.focus();

  return new Promise((resolve) => {
    function cleanup(resultado) {
      form.removeEventListener("submit", onSubmit);
      opciones.removeEventListener("change", onChange);
      cancelBtn.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      dialog.close();
      resolve(resultado);
    }

    function onSubmit(event) {
      event.preventDefault();

      const ids = [...opciones.querySelectorAll("input:checked")].map((check) => check.value);

      const elegidos = participantes
        .filter((participante) => ids.includes(String(participante.id)))
        .map((participante) => ({ id: participante.id, nombre: participante.nombre }));

      if (elegidos.length === 0) {
        error.hidden = false;
        return;
      }

      cleanup(elegidos);
    }

    function onChange() {
      error.hidden = true;
    }

    function onCancel(event) {
      event?.preventDefault();
      cleanup(null);
    }

    form.addEventListener("submit", onSubmit);
    opciones.addEventListener("change", onChange);
    cancelBtn.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel);
  });
}
