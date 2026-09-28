/*
 * Lista desplegable con casillas para elegir una o varias
 * personas dentro de un formulario (compromisos). Cerrada por
 * defecto: solo muestra quiénes están elegidos; al abrirla
 * aparecen el buscador por nombre y las casillas. Reutiliza el
 * aspecto de la lista del diálogo de asignar responsables
 * (asignar-dialog).
 *
 * Con conFiltros: true agrega dos filtros (departamento y área)
 * para dar con alguien de cualquier departamento (personas
 * involucradas). Los valores salen de los mismos usuarios.
 *
 * Conserva el orden en que se marcaron: el primero es el
 * responsable "principal" (de él toma el servidor el
 * departamento y área del compromiso).
 */
export function crearSelectorResponsables(
  contenedor,
  {
    etiqueta = "Responsables",
    singular = "Responsable",
    plural = "responsables",
    conFiltros = false,
  } = {}
) {
  contenedor.classList.add("selector-responsables");
  contenedor.innerHTML = `
    <button
      type="button"
      class="field__input selector-responsables__toggle"
      aria-expanded="false"
    >
      <span class="selector-responsables__resumen"></span>
      <span class="selector-responsables__flecha" aria-hidden="true">▾</span>
    </button>
    <div class="selector-responsables__panel" hidden>
      ${conFiltros ? `
        <div class="selector-responsables__filtros">
          <select class="field__input selector-responsables__departamento" aria-label="Filtrar por departamento">
            <option value="">Todos los departamentos</option>
          </select>
          <select class="field__input selector-responsables__area" aria-label="Filtrar por área">
            <option value="">Todas las áreas</option>
          </select>
        </div>
      ` : ""}
      <input
        type="search"
        class="field__input selector-responsables__buscar"
        placeholder="Buscar por nombre..."
        aria-label="Buscar persona"
      >
      <div class="asignar-dialog__opciones selector-responsables__opciones" role="group"></div>
    </div>
  `;

  const toggle = contenedor.querySelector(".selector-responsables__toggle");
  const panel = contenedor.querySelector(".selector-responsables__panel");
  const buscador = contenedor.querySelector(".selector-responsables__buscar");
  const opciones = contenedor.querySelector(".selector-responsables__opciones");
  const resumen = contenedor.querySelector(".selector-responsables__resumen");
  const filtroDepartamento = contenedor.querySelector(".selector-responsables__departamento");
  const filtroArea = contenedor.querySelector(".selector-responsables__area");

  opciones.setAttribute("aria-label", etiqueta);

  let usuarios = [];
  let seleccionados = [];

  function nombreDe(id) {
    return usuarios.find((usuario) => usuario.id === id)?.nombre || "?";
  }

  function valoresUnicos(lista) {
    return [...new Set(lista.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function llenarSelect(select, valores, textoTodos) {
    const actual = select.value;

    const todos = document.createElement("option");
    todos.value = "";
    todos.textContent = textoTodos;

    select.replaceChildren(
      todos,
      ...valores.map((valor) => {
        const option = document.createElement("option");
        option.value = valor;
        option.textContent = valor;
        return option;
      })
    );

    select.value = valores.includes(actual) ? actual : "";
  }

  /* Las áreas dependen del departamento elegido */
  function pintarFiltroArea() {
    if (!filtroArea) return;

    const departamento = filtroDepartamento.value;

    llenarSelect(
      filtroArea,
      valoresUnicos(
        usuarios
          .filter((usuario) => !departamento || usuario.departamento === departamento)
          .map((usuario) => usuario.area)
      ),
      "Todas las áreas"
    );
  }

  function pintarFiltros() {
    if (!filtroDepartamento) return;

    llenarSelect(
      filtroDepartamento,
      valoresUnicos(usuarios.map((usuario) => usuario.departamento)),
      "Todos los departamentos"
    );

    pintarFiltroArea();
  }

  function pintarResumen() {
    resumen.textContent = seleccionados.length === 0
      ? "Ninguna persona seleccionada"
      : `${seleccionados.length === 1 ? singular : `${seleccionados.length} ${plural}`}: ${seleccionados.map(nombreDe).join(", ")}`;

    resumen.classList.toggle("selector-responsables__resumen--vacio", seleccionados.length === 0);
  }

  function pintar() {
    const texto = buscador.value.trim().toLowerCase();
    const departamento = filtroDepartamento?.value || "";
    const area = filtroArea?.value || "";

    const visibles = usuarios.filter(
      (usuario) =>
        (!texto || usuario.nombre.toLowerCase().includes(texto)) &&
        (!departamento || usuario.departamento === departamento) &&
        (!area || usuario.area === area)
    );

    opciones.replaceChildren(
      ...visibles.map((usuario) => {
        const label = document.createElement("label");
        label.classList.add("asignar-dialog__opcion");

        const check = document.createElement("input");
        check.type = "checkbox";
        check.value = usuario.id;
        check.checked = seleccionados.includes(usuario.id);

        const nombre = document.createElement("span");
        nombre.textContent = usuario.nombre;

        label.append(check, nombre);

        /* sin filtros no hace falta: todos son del mismo equipo */
        if (conFiltros && (usuario.departamento || usuario.area)) {
          const equipo = document.createElement("small");
          equipo.classList.add("selector-responsables__equipo");
          equipo.textContent = [usuario.departamento, usuario.area].filter(Boolean).join(" · ");
          label.append(equipo);
        }

        return label;
      })
    );

    if (visibles.length === 0) {
      const vacio = document.createElement("p");
      vacio.classList.add("selector-responsables__sin-resultados");
      vacio.textContent = usuarios.length === 0 ? "No hay usuarios disponibles." : "Nadie coincide con la búsqueda.";
      opciones.appendChild(vacio);
    }

    pintarResumen();
  }

  function abrir(abierto) {
    panel.hidden = !abierto;
    toggle.setAttribute("aria-expanded", String(abierto));
    contenedor.classList.toggle("selector-responsables--abierto", abierto);
  }

  toggle.addEventListener("click", () => {
    abrir(panel.hidden);
    if (!panel.hidden) buscador.focus();
  });

  opciones.addEventListener("change", (event) => {
    const id = Number(event.target.value);
    if (!id) return;

    seleccionados = event.target.checked
      ? [...seleccionados.filter((actual) => actual !== id), id]
      : seleccionados.filter((actual) => actual !== id);

    pintarResumen();
  });

  buscador.addEventListener("input", pintar);

  filtroDepartamento?.addEventListener("change", () => {
    pintarFiltroArea();
    pintar();
  });

  filtroArea?.addEventListener("change", pintar);

  /* Enter en el buscador no debe enviar el formulario; Escape solo cierra la lista */
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target === buscador) event.preventDefault();

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      abrir(false);
      toggle.focus();
    }
  });

  pintar();

  return {
    /* usuarios: [{ id, nombre, departamento?, area? }] ya filtrados y ordenados */
    setUsuarios(lista) {
      /* conserva a los ya elegidos que no vengan en la lista nueva */
      const faltantes = usuarios.filter(
        (usuario) =>
          seleccionados.includes(usuario.id) &&
          !lista.some((otro) => Number(otro.id) === usuario.id)
      );

      usuarios = [
        ...lista.map((usuario) => ({
          id: Number(usuario.id),
          nombre: usuario.nombre,
          departamento: String(usuario.departamento || "").trim(),
          area: String(usuario.area || "").trim(),
        })),
        ...faltantes,
      ];

      pintarFiltros();
      pintar();
    },

    /*
     * Al editar, alguien ya asignado puede no estar en la lista
     * (usuario desactivado, de otra área, etc.): se agrega para
     * no quitarlo sin que se note.
     */
    setSeleccionados(personas) {
      personas.forEach((persona) => {
        if (!usuarios.some((usuario) => usuario.id === Number(persona.id))) {
          usuarios.push({ id: Number(persona.id), nombre: persona.nombre || "?", departamento: "", area: "" });
        }
      });

      seleccionados = [...new Set(personas.map((persona) => Number(persona.id)))];
      pintar();
    },

    getSeleccionados() {
      return seleccionados.map((id) => ({ id, nombre: nombreDe(id) }));
    },

    limpiar() {
      seleccionados = [];
      buscador.value = "";

      if (filtroDepartamento) {
        filtroDepartamento.value = "";
        pintarFiltroArea();
      }

      abrir(false);
      pintar();
    },

    enfocar() {
      toggle.focus();
    },
  };
}
