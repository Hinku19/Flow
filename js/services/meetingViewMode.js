/* =========================================================
   MODO HORIZONTAL DE LA REUNIÓN
   ---------------------------------------------------------
   Alterna entre la vista normal (todas las secciones
   apiladas) y una vista por "ventanas": una sección visible
   a la vez, con botones Anterior/Siguiente. Siempre arranca
   en modo normal cada vez que se monta una reunión (ver
   reiniciar() en main.js).

   En Desarrollo, además, se ve un objetivo a la vez:
   Anterior/Siguiente recorren primero los objetivos y, al
   llegar al primero/último, pasan a la sección vecina. Debajo
   de la barra se muestran unas barras (una por objetivo) para
   saltar directo a cualquiera.
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

const SECCION_DESARROLLO = "desarrollo";

export function initMeetingViewMode() {
  const body = document.querySelector("#meeting__body");
  const toggleBtn = document.querySelector("#btn-vista-horizontal");
  const pager = document.querySelector("#meeting-pager");
  const label = document.querySelector("#meeting-pager-label");
  const btnAnterior = document.querySelector("#meeting-pager-anterior");
  const btnSiguiente = document.querySelector("#meeting-pager-siguiente");
  const barras = document.querySelector("#meeting-objective-bars");

  if (!body || !toggleBtn || !pager || !label || !btnAnterior || !btnSiguiente) {
    console.warn("No se encontraron los elementos del modo horizontal de la reunión.");
    return { reiniciar: () => {}, irASeccion: () => {} };
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

  /*
   * developmentTable.js vuelve a pintar todas sus filas en
   * cada cambio (agregar un punto, abrir un objetivo…), lo que
   * borra las clases que ocultan los demás objetivos. Este
   * observador las vuelve a aplicar después de cada pintado.
   */
  let observadorDesarrollo = null;

  function recargarSecciones() {
    secciones = SECCION_IDS
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    observadorDesarrollo?.disconnect();

    const tabla = document.querySelector(`#${SECCION_DESARROLLO} .development__table`);

    if (tabla) {
      observadorDesarrollo = new MutationObserver(() => aplicar());
      observadorDesarrollo.observe(tabla, { childList: true });
    }
  }

  let horizontal = false;
  let indice = 0;

  /* objetivo visible dentro de Desarrollo */
  let indiceObjetivo = 0;

  function tituloDe(seccion) {
    return seccion.querySelector("h2")?.textContent.trim() || "";
  }

  function filasDesarrollo() {
    return [
      ...document.querySelectorAll(`#${SECCION_DESARROLLO} .development__row`),
    ];
  }

  function textoObjetivo(fila) {
    return fila.querySelector(".development__objective > span")?.textContent.trim() || "";
  }

  function enDesarrollo() {
    return horizontal && secciones[indice]?.id === SECCION_DESARROLLO;
  }

  function pintarBarras(filas) {
    if (!barras) return;

    const visibles = enDesarrollo() && filas.length > 1;
    barras.hidden = !visibles;

    if (!visibles) {
      barras.replaceChildren();
      return;
    }

    barras.replaceChildren(
      ...filas.map((fila, i) => {
        const texto = textoObjetivo(fila);
        const barra = document.createElement("button");

        barra.type = "button";
        barra.classList.add("meeting-objective-bars__bar");
        barra.classList.toggle("meeting-objective-bars__bar--activa", i === indiceObjetivo);
        barra.dataset.indice = i;
        barra.dataset.titulo = `${i + 1}. ${texto}`;
        barra.setAttribute("aria-label", `Objetivo ${i + 1}: ${texto}`);

        if (i === indiceObjetivo) {
          barra.setAttribute("aria-current", "true");
        }

        return barra;
      })
    );
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

    const filas = filasDesarrollo();

    /* se pudo haber borrado un objetivo */
    indiceObjetivo = Math.min(indiceObjetivo, Math.max(filas.length - 1, 0));

    filas.forEach((fila, i) => {
      fila.classList.toggle(
        "development__row--oculta-horizontal",
        horizontal && i !== indiceObjetivo
      );
    });

    pintarBarras(filas);

    if (horizontal && secciones[indice]) {
      const posicion = `${tituloDe(secciones[indice])} · ${indice + 1} de ${secciones.length}`;

      label.textContent =
        enDesarrollo() && filas.length > 0
          ? `${posicion} — Objetivo ${indiceObjetivo + 1} de ${filas.length}`
          : posicion;

      btnAnterior.disabled = indice === 0;
      btnSiguiente.disabled =
        indice === secciones.length - 1 &&
        !(enDesarrollo() && indiceObjetivo < filas.length - 1);
    }
  }

  /*
   * Un objetivo puede ser muy largo: si el usuario bajó con el
   * scroll y cambia de objetivo, se regresa al inicio de
   * Desarrollo para no quedar a media página.
   */
  function cambiarObjetivo(nuevoIndice) {
    indiceObjetivo = nuevoIndice;
    aplicar();

    const seccion = secciones[indice];

    /* 64px de la cabecera fija (.app-header) + un respiro */
    const margenCabecera = 80;
    const arriba = seccion?.getBoundingClientRect().top ?? 0;

    if (arriba < margenCabecera) {
      window.scrollBy({ top: arriba - margenCabecera, behavior: "smooth" });
    }
  }

  /*
   * Al entrar a Desarrollo hacia adelante se empieza en el
   * primer objetivo; hacia atrás, en el último.
   */
  function irAIndice(nuevoIndice, haciaAtras = false) {
    indice = nuevoIndice;

    if (secciones[indice]?.id === SECCION_DESARROLLO) {
      indiceObjetivo = haciaAtras ? Math.max(filasDesarrollo().length - 1, 0) : 0;
    }

    aplicar();
  }

  toggleBtn.addEventListener("click", () => {
    horizontal = !horizontal;
    indice = 0;
    indiceObjetivo = 0;
    aplicar();
  });

  btnAnterior.addEventListener("click", () => {
    if (enDesarrollo() && indiceObjetivo > 0) {
      cambiarObjetivo(indiceObjetivo - 1);
      return;
    }

    if (indice > 0) {
      irAIndice(indice - 1, true);
    }
  });

  btnSiguiente.addEventListener("click", () => {
    if (enDesarrollo() && indiceObjetivo < filasDesarrollo().length - 1) {
      cambiarObjetivo(indiceObjetivo + 1);
      return;
    }

    if (indice < secciones.length - 1) {
      irAIndice(indice + 1);
    }
  });

  barras?.addEventListener("click", (event) => {
    const barra = event.target.closest(".meeting-objective-bars__bar");
    if (!barra) return;

    cambiarObjetivo(Number(barra.dataset.indice) || 0);
  });

  function reiniciar() {
    recargarSecciones();
    horizontal = false;
    indice = 0;
    indiceObjetivo = 0;
    aplicar();
  }

  /*
   * En modo horizontal, muestra la sección indicada (p. ej.
   * "desarrollo" al llegar con doble clic desde Objetivos) y,
   * si se indica, el objetivo con ese id; en modo normal no
   * hace nada, todas están visibles.
   */
  function irASeccion(id, objetivoId = null) {
    if (!horizontal) return;

    const nuevoIndice = secciones.findIndex((seccion) => seccion.id === id);
    if (nuevoIndice === -1) return;

    indice = nuevoIndice;

    if (id === SECCION_DESARROLLO) {
      const posicion = filasDesarrollo().findIndex((fila) => fila.dataset.id === String(objetivoId));
      indiceObjetivo = posicion === -1 ? 0 : posicion;
    }

    aplicar();
  }

  recargarSecciones();
  aplicar();

  return { reiniciar, irASeccion };
}
