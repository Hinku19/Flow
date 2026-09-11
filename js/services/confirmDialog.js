const dialog = document.querySelector(".confirm-dialog");
const message = dialog.querySelector(".confirm-dialog__message");
const acceptBtn = dialog.querySelector(".confirm-dialog__accept");
const cancelBtn = dialog.querySelector(".confirm-dialog__cancel");

export function confirmDialog(texto, { danger = false, acceptLabel = "Sí", cancelLabel = "No" } = {}) {
  message.textContent = texto;
  acceptBtn.textContent = acceptLabel;
  cancelBtn.textContent = cancelLabel;
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