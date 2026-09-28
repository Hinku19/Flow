import { loadData, saveData } from "../services/storage.service.js";
import { API_URL } from "./config.js";
import { confirmarEliminacion, avisoDialog } from "../services/confirmDialog.js";
import { headerUsuario } from "../services/auth.service.js";
import { normalizarImagen } from "../utils/normalizarImagen.js";
import {generarUUID } from "../utils/generarUUID.js";

export function createLinkList({ container, storageKey, reunionId }) {
  const list = container.querySelector(".link-list__list");
  const titleInput = container.querySelector(".link-list__title");
  const urlInput = container.querySelector(".link-list__url");
  const fileInput = container.querySelector(".link-list__file");
  const addBtn = container.querySelector(".link-list__add");

  let items = loadData(storageKey);

  function esUrlValida(url) {
    return url.startsWith("http://") || url.startsWith("https://");
  }

  function urlDelItem(data) {
    return data.tipo === "archivo"
      ? `${API_URL}/enlaces/archivos/${data.archivoId}`
      : data.url;
  }

  function esImagen(data) {
    return data.tipo === "archivo" && (data.tipoMime || "").startsWith("image/");
  }

  function createItem(data) {
    const item = document.createElement("li");
    item.classList.add("link-list__item");
    item.dataset.id = data.id;

    const link = document.createElement("a");
    link.classList.add("link-list__link");
    link.href = urlDelItem(data);
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    if (esImagen(data)) {
      item.classList.add("link-list__item--imagen");

      const thumb = document.createElement("img");
      thumb.classList.add("link-list__thumb");
      thumb.src = urlDelItem(data);
      thumb.alt = data.titulo;
      thumb.loading = "lazy";

      const caption = document.createElement("span");
      caption.classList.add("link-list__caption");
      caption.textContent = data.titulo;

      link.append(thumb, caption);
    } else {
      link.textContent = data.tipo === "archivo" ? `📎 ${data.titulo}` : data.titulo;
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.classList.add("link-list__delete");
    deleteBtn.textContent = "✕";
    deleteBtn.setAttribute("aria-label", "Eliminar enlace");

    item.append(link, deleteBtn);
    return item;
  }

  function render() {
    const elements = items.map(createItem);
    list.replaceChildren(...elements);
    saveData(storageKey, items);
  }

  function addItem(data) {
    items.push({ id: generarUUID(), ...data });
    render();
  }

  async function eliminarArchivo(archivoId) {
    try {
      await fetch(`${API_URL}/enlaces/archivos/${archivoId}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("ERROR ELIMINANDO ARCHIVO DE ENLACE:", error);
    }
  }

  function removeItem(id) {
    const item = items.find((item) => item.id === id);
    items = items.filter((item) => item.id !== id);
    render();

    if (item?.tipo === "archivo") {
      eliminarArchivo(item.archivoId);
    }
  }

  /*
   * Sube el archivo (imagen o PDF) al servidor, que lo guarda
   * como BLOB en reunion_enlace_archivos. Devuelve el metadato
   * (archivoId, tipoMime) que se guarda en el JSON de "enlaces";
   * el contenido del archivo nunca viaja por ese JSON.
   */
  async function subirArchivo(file) {
    if (!reunionId) {
      avisoDialog("No hay una reunión activa para subir el archivo.");
      return null;
    }

    let archivo = file;

    try {
      // Los PDF se suben tal cual; las imágenes se reducen y pasan a WebP.
      if (file.type !== "application/pdf") archivo = await normalizarImagen(file);
    } catch (error) {
      avisoDialog(error.message);
      return null;
    }

    const formData = new FormData();
    formData.append("archivo", archivo);

    try {
      const response = await fetch(
        `${API_URL}/reuniones/${reunionId}/enlaces/archivo`,
        {
          method: "POST",
          headers: headerUsuario(),
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.mensaje || data.error || "No fue posible subir el archivo.");
      }

      return data;
    } catch (error) {
      console.error("ERROR SUBIENDO ARCHIVO DE ENLACE:", error);
      avisoDialog(error.message || "No fue posible subir el archivo.");
      return null;
    }
  }

  async function handleAdd() {
    const titulo = titleInput.value.trim();
    const url = urlInput.value.trim();
    const file = fileInput?.files?.[0] || null;

    if (titulo === "") return;

    if (file) {
      addBtn.disabled = true;
      const subido = await subirArchivo(file);
      addBtn.disabled = false;

      if (!subido) return;

      addItem({
        tipo: "archivo",
        titulo,
        archivoId: subido.archivoId,
        tipoMime: subido.tipoMime,
      });
    } else if (url !== "") {
      if (!esUrlValida(url)) {
        avisoDialog("La URL debe empezar por http:// o https://");
        return;
      }

      addItem({ tipo: "url", titulo, url });
    } else {
      return;
    }

    titleInput.value = "";
    urlInput.value = "";
    if (fileInput) fileInput.value = "";
    titleInput.focus();
  }

  addBtn.addEventListener("click", handleAdd);

  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleAdd();
  });

  list.addEventListener("click", (event) => {
    if (!event.target.matches(".link-list__delete")) return;

    const item = event.target.closest(".link-list__item");
    const id = item.dataset.id;
    const esArchivo = items.find((data) => data.id === id)?.tipo === "archivo";

    confirmarEliminacion(
      esArchivo
        ? "¿Eliminar este archivo? Se borrará del servidor y no se puede deshacer."
        : "¿Eliminar este enlace? Esta acción no se puede deshacer."
    ).then((confirmado) => {
      if (confirmado) removeItem(id);
    });
  });

  render();
}
