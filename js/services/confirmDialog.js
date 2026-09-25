const dialog = document.querySelector(".confirm-dialog");
const message = dialog.querySelector(".confirm-dialog__message");
const acceptBtn = dialog.querySelector(".confirm-dialog__accept");
const cancelBtn = dialog.querySelector(".confirm-dialog__cancel");

/*
 * Pregunta antes de eliminar cualquier cosa. Toda acción de
 * borrado de la app debe pasar por aquí: devuelve una promesa
 * que resuelve true solo si el usuario confirma.
 */
export function confirmarEliminacion(texto = "¿Eliminar este elemento? Esta acción no se puede deshacer.") {
  return confirmDialog(texto, {
    danger: true,
    acceptLabel: "Eliminar",
    cancelLabel: "Cancelar",
  });
}

/*
 * Reemplazo de alert() con la estética de la app: el mismo
 * diálogo, pero solo con el botón de aceptar.
 */
export function avisoDialog(texto, { acceptLabel = "Aceptar" } = {}) {
  return confirmDialog(texto, { acceptLabel, soloAceptar: true });
}

export function confirmDialog(texto, { danger = false, acceptLabel = "Sí", cancelLabel = "No", soloAceptar = false } = {}) {
  message.textContent = texto;
  acceptBtn.textContent = acceptLabel;
  cancelBtn.textContent = cancelLabel;
  cancelBtn.hidden = soloAceptar;
  acceptBtn.classList.toggle("confirm-dialog__accept--danger", danger);
  dialog.showModal();

  return new Promise((resolve) => {
    function cleanup(resultado) {
      acceptBtn.removeEventListener("click", onAccept);
      cancelBtn.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      dialog.close();
      resolve(resultado);
    }

    function onAccept() {
      cleanup(true);
    }

    function onCancel() {
      cleanup(false);
    }

    acceptBtn.addEventListener("click", onAccept);
    cancelBtn.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel);
  });
}