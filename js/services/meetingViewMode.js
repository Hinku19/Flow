/* =========================================================
   MODO HORIZONTAL DE LA REUNIÓN
   ---------------------------------------------------------
   Alterna entre la vista normal (todas las secciones
   apiladas) y una vista por "ventanas": una sección visible
   a la vez, con botones Anterior/Siguiente. Siempre arranca
   en modo normal cada vez que se monta una reunión (ver
   reiniciar() en main.js).
   ========================================================= */

const SECCION_IDS = [
  "objetivos",
  "asuntos",
  "desarrollo",
  "compromisos",
  "otros",
  "competitividad",
  "acuerdos",
  "reflexion",
];

export function initMeetingViewMode() {
  const body = document.querySelector("#meeting__body");
  const toggleBtn = document.querySelector("#btn-vista-horizontal");
  const pager = document.querySelector("#meeting-pager");
  const label = document.querySelector("#meeting-pager-label");
  const btnAnterior = document.querySelector("#meeting-pager-anterior");
  const btnSiguiente = document.querySelector("#meeting-pager-siguiente");

  if (!body || !toggleBtn || !pager || !label || !btnAnterior || !btnSiguiente) {
    console.warn("No se encontraron los elementos del modo horizontal de la reunión.");
    return { reiniciar: () => {} };
  }

  /*
   * reiniciarContenedor() (usado por main.js al montar cada
   * reunión) reemplaza el elemento de cada sección por un
   * clon, así que las referencias de más abajo quedan
   * apuntando a nodos ya desmontados. Hay que releer las
   * secciones cada vez que se reinicia (después de montar la
   * reunión), no solo una vez al cargar la página.
   */
  let secciones = [];

  function recargarSecciones() {
    secciones = SECCION_IDS
      .map((id) => document.getElementById(id))
      .filter(Boolean);
  }

  recargarSecciones();

  let horizontal = false;
  let indice = 0;

  function tituloDe(seccion) {
    return seccion.querySelector("h2")?.textContent.trim() || "";
  }

  function aplicar() {
    body.classList.toggle("meeting__body--horizontal", horizontal);
    pager.hidden = !horizontal;

    toggleBtn.textContent = horizontal ? "Vista normal" : "Vista horizontal";

    secciones.forEach((seccion, i) => {
      seccion.classList.toggle(
        "meeting-section--oculta-horizontal",
        horizontal && i !== indice
      );
    });

    if (horizontal && secciones[indice]) {
      label.textContent = `${tituloDe(secciones[indice])} · ${indice + 1} de ${secciones.length}`;
      btnAnterior.disabled = indice === 0;
      btnSiguiente.disabled = indice === secciones.length - 1;
    }
  }

  toggleBtn.addEventListener("click", () => {
    horizontal = !horizontal;
    indice = 0;
    aplicar();
  });

  btnAnterior.addEventListener("click", () => {
    if (indice > 0) {
      indice -= 1;
      aplicar();
    }
  });

  btnSiguiente.addEventListener("click", () => {
    if (indice < secciones.length - 1) {
      indice += 1;
      aplicar();
    }
  });

  function reiniciar() {
    recargarSecciones();
    horizontal = false;
    indice = 0;
    aplicar();
  }

  aplicar();

  return { reiniciar };
}
