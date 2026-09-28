/*
 * Reordenar elementos arrastrándolos, al estilo de Notion: cada
 * elemento lleva un asa de seis puntitos (⋮⋮) que aparece al pasar
 * el mouse; al arrastrarla, una copia del elemento sigue al cursor
 * y una línea azul marca dónde va a caer.
 *
 * Usa pointer events (no el drag and drop nativo de HTML) para que
 * también funcione con el dedo en pantallas táctiles. Con el asa
 * enfocada, las flechas ↑ / ↓ mueven el elemento un lugar.
 *
 * Solo reordena entre hermanos: los elementos que comparten el
 * mismo padre en el DOM (p. ej. los bloques de un mismo objetivo).
 * El componente es quien mueve sus datos y vuelve a pintar, en
 * alMover(desde, hacia, elemento).
 */

const ICONO_ASA = `
  <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true" focusable="false">
    <circle cx="2.5" cy="3" r="1.4" />
    <circle cx="7.5" cy="3" r="1.4" />
    <circle cx="2.5" cy="8" r="1.4" />
    <circle cx="7.5" cy="8" r="1.4" />
    <circle cx="2.5" cy="13" r="1.4" />
    <circle cx="7.5" cy="13" r="1.4" />
  </svg>
`;

/* píxeles que hay que mover el puntero para que empiece el arrastre */
const UMBRAL_ARRASTRE = 4;

/* distancia al borde de la zona visible a la que empieza el auto-scroll */
const MARGEN_AUTOSCROLL = 60;

export function crearAsaArrastre(etiqueta) {
  const asa = document.createElement("button");
  asa.type = "button";
  asa.classList.add("asa-arrastre");
  asa.innerHTML = ICONO_ASA;
  asa.title = "Arrastra para mover";
  asa.setAttribute("aria-label", `Mover ${etiqueta} (flechas arriba y abajo)`);
  return asa;
}

function contenedorConScroll(elemento) {
  let actual = elemento.parentElement;

  while (actual && actual !== document.body) {
    const { overflowY } = getComputedStyle(actual);

    if (/(auto|scroll)/.test(overflowY) && actual.scrollHeight > actual.clientHeight) {
      return actual;
    }

    actual = actual.parentElement;
  }

  return document.scrollingElement || document.documentElement;
}

export function habilitarArrastre({
  contenedor,
  selectorElemento,
  alMover,
  obtenerClave = (elemento) => elemento.dataset.id || elemento.dataset.blockId,
}) {
  let arrastre = null;

  function hermanosDe(elemento) {
    return [...elemento.parentElement.children].filter((hermano) => hermano.matches(selectorElemento));
  }

  /*
   * Después de mover, el componente vuelve a pintar la lista: se
   * busca el mismo elemento (por su clave) para devolverle el foco
   * al asa y poder seguir moviéndolo con el teclado.
   */
  function enfocarAsa(clave) {
    const elemento = [...contenedor.querySelectorAll(selectorElemento)].find(
      (candidato) => obtenerClave(candidato) === clave
    );

    elemento?.querySelector(".asa-arrastre")?.focus({ preventScroll: false });
  }

  function mover(desde, hacia, elemento) {
    if (desde === hacia) return;

    const clave = obtenerClave(elemento);
    alMover(desde, hacia, elemento);
    enfocarAsa(clave);
  }

  /* ---------- cálculo del destino y de la línea indicadora ---------- */

  function calcularDestino() {
    const { elemento, hermanos, desde, indicador, ultimoY } = arrastre;
    const otros = hermanos.filter((hermano) => hermano !== elemento);

    if (otros.length === 0) {
      arrastre.hacia = desde;
      indicador.hidden = true;
      return;
    }

    const antesDe = otros.find((hermano) => {
      const rect = hermano.getBoundingClientRect();
      return ultimoY < rect.top + rect.height / 2;
    });

    /* índice final dentro del arreglo ya sin el elemento arrastrado */
    arrastre.hacia = antesDe ? otros.indexOf(antesDe) : otros.length;

    if (arrastre.hacia === desde) {
      indicador.hidden = true;
      return;
    }

    const referencia = (antesDe || otros[otros.length - 1]).getBoundingClientRect();
    const anterior = antesDe ? otros[otros.indexOf(antesDe) - 1] : null;

    let y;

    if (!antesDe) {
      y = referencia.bottom + 2;
    } else if (anterior) {
      y = (anterior.getBoundingClientRect().bottom + referencia.top) / 2;
    } else {
      y = referencia.top - 2;
    }

    const rectPadre = elemento.parentElement.getBoundingClientRect();

    indicador.hidden = false;
    indicador.style.top = `${y - 1.5}px`;
    indicador.style.left = `${referencia.left}px`;
    indicador.style.width = `${Math.min(referencia.width, rectPadre.right - referencia.left)}px`;
  }

  function autoScroll() {
    if (!arrastre?.activo) return;

    const { scroller, ultimoY } = arrastre;
    const esVentana = scroller === document.scrollingElement || scroller === document.documentElement;
    const arriba = esVentana ? 0 : scroller.getBoundingClientRect().top;
    const abajo = esVentana ? window.innerHeight : scroller.getBoundingClientRect().bottom;

    let velocidad = 0;

    if (ultimoY < arriba + MARGEN_AUTOSCROLL) {
      velocidad = -Math.ceil((arriba + MARGEN_AUTOSCROLL - ultimoY) / 4);
    } else if (ultimoY > abajo - MARGEN_AUTOSCROLL) {
      velocidad = Math.ceil((ultimoY - (abajo - MARGEN_AUTOSCROLL)) / 4);
    }

    if (velocidad !== 0) {
      scroller.scrollTop += velocidad;
      calcularDestino();
    }

    arrastre.frame = requestAnimationFrame(autoScroll);
  }

  /* ---------- ciclo del arrastre ---------- */

  function iniciar() {
    const { elemento } = arrastre;
    const rect = elemento.getBoundingClientRect();

    const fantasma = elemento.cloneNode(true);
    fantasma.classList.add("asa-arrastre__fantasma");
    fantasma.removeAttribute("id");
    fantasma.setAttribute("aria-hidden", "true");
    fantasma.style.width = `${rect.width}px`;
    fantasma.style.height = `${rect.height}px`;
    fantasma.style.left = `${rect.left}px`;
    fantasma.style.top = `${rect.top}px`;
    document.body.appendChild(fantasma);

    const indicador = document.createElement("div");
    indicador.classList.add("asa-arrastre__indicador");
    indicador.hidden = true;
    document.body.appendChild(indicador);

    elemento.classList.add("asa-arrastre--origen");
    document.body.classList.add("asa-arrastre--activo");

    Object.assign(arrastre, {
      activo: true,
      fantasma,
      indicador,
      offsetX: arrastre.inicioX - rect.left,
      offsetY: arrastre.inicioY - rect.top,
      scroller: contenedorConScroll(elemento),
    });

    arrastre.frame = requestAnimationFrame(autoScroll);
  }

  function alMoverPuntero(event) {
    if (!arrastre || event.pointerId !== arrastre.pointerId) return;

    arrastre.ultimoY = event.clientY;

    if (!arrastre.activo) {
      const distancia = Math.hypot(event.clientX - arrastre.inicioX, event.clientY - arrastre.inicioY);
      if (distancia < UMBRAL_ARRASTRE) return;
      iniciar();
    }

    event.preventDefault();

    arrastre.fantasma.style.left = `${event.clientX - arrastre.offsetX}px`;
    arrastre.fantasma.style.top = `${event.clientY - arrastre.offsetY}px`;

    calcularDestino();
  }

  function terminar(aplicar) {
    if (!arrastre) return;

    const { activo, elemento, desde, hacia, fantasma, indicador, frame } = arrastre;

    window.removeEventListener("pointermove", alMoverPuntero);
    window.removeEventListener("pointerup", alSoltar);
    window.removeEventListener("pointercancel", alCancelar);
    window.removeEventListener("keydown", alTeclaDuranteArrastre, true);

    cancelAnimationFrame(frame);
    fantasma?.remove();
    indicador?.remove();
    elemento.classList.remove("asa-arrastre--origen");
    document.body.classList.remove("asa-arrastre--activo");

    arrastre = null;

    if (aplicar && activo && hacia !== null && hacia !== desde) {
      mover(desde, hacia, elemento);
    }
  }

  function alSoltar(event) {
    if (arrastre && event.pointerId === arrastre.pointerId) terminar(true);
  }

  function alCancelar() {
    terminar(false);
  }

  function alTeclaDuranteArrastre(event) {
    if (event.key !== "Escape") return;

    event.preventDefault();
    event.stopPropagation();
    terminar(false);
  }

  contenedor.addEventListener("pointerdown", (event) => {
    if (arrastre || event.button !== 0) return;

    const asa = event.target.closest(".asa-arrastre");
    const elemento = asa?.closest(selectorElemento);

    if (!asa || !elemento || !contenedor.contains(elemento)) return;

    /* evita que se seleccione texto o que el navegador haga scroll con el dedo */
    event.preventDefault();

    const hermanos = hermanosDe(elemento);

    arrastre = {
      activo: false,
      pointerId: event.pointerId,
      elemento,
      hermanos,
      desde: hermanos.indexOf(elemento),
      hacia: null,
      inicioX: event.clientX,
      inicioY: event.clientY,
      ultimoY: event.clientY,
      frame: 0,
    };

    window.addEventListener("pointermove", alMoverPuntero);
    window.addEventListener("pointerup", alSoltar);
    window.addEventListener("pointercancel", alCancelar);
    window.addEventListener("keydown", alTeclaDuranteArrastre, true);
  });

  contenedor.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    const asa = event.target.closest(".asa-arrastre");
    const elemento = asa?.closest(selectorElemento);

    if (!asa || !elemento || arrastre) return;

    event.preventDefault();

    const hermanos = hermanosDe(elemento);
    const desde = hermanos.indexOf(elemento);
    const hacia = event.key === "ArrowUp" ? desde - 1 : desde + 1;

    if (hacia < 0 || hacia >= hermanos.length) return;

    mover(desde, hacia, elemento);
  });
}

/* Mueve un elemento de un arreglo de la posición desde a la posición hacia (en sitio). */
export function moverEnArreglo(arreglo, desde, hacia) {
  const [elemento] = arreglo.splice(desde, 1);
  arreglo.splice(hacia, 0, elemento);
  return arreglo;
}
