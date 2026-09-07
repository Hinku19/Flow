import {
    showView
} from "../services/viewManager.js";


import {
    API_URL
} from "./config.js";

import {
    headerUsuario,
    getUsuarioActual
} from "../services/auth.service.js";

const ROL_LABEL = {
    administrador: "Administrador",
    lider: "Líder",
    operador: "Operador"
};

/* =========================================================
   CONTROL DE USUARIOS
   ========================================================= */

export function initUserManagement() {

    const tbody =
        document.querySelector("#usuarios-tabla-body");

    const empty =
        document.querySelector("#usuarios-empty");

    const loading =
        document.querySelector("#usuarios-loading");

    const filtroDepartamento =
        document.querySelector("#filtro-departamento");

    const filtroArea =
        document.querySelector("#filtro-area");

    const btnLimpiarFiltros =
        document.querySelector("#btn-limpiar-filtros");


    /* =========================================================
       VALIDAR ELEMENTOS
       ========================================================= */

    if (!tbody) {

        console.warn(
            "No se encontró #usuarios-tabla-body"
        );

        return;
    }


    /* =========================================================
       ESTADO
       ========================================================= */

    let usuarios = [];


    /* =========================================================
       ESCAPAR HTML
       ========================================================= */

    function escaparHTML(valor) {

        if (
            valor === null ||
            valor === undefined
        ) {
            return "";
        }

        return String(valor)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =========================================================
       CARGAR USUARIOS
       ========================================================= */

    async function cargarUsuarios() {

        try {

            if (loading) {
                loading.hidden = false;
            }

            if (empty) {
                empty.hidden = true;
            }


            console.log(
                "Cargando usuarios..."
            );


            const response =
                await fetch(
                    `${API_URL}/usuarios`
                );


            const data =
                await response.json();


            console.log(
                "RESPUESTA API USUARIOS:",
                data
            );


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible obtener los usuarios."
                );

            }


            usuarios =
                data.usuarios ||
                data.resultado ||
                [];


            console.log(
                "USUARIOS:",
                usuarios
            );


            console.log(
                "TOTAL DE USUARIOS:",
                usuarios.length
            );


            /* =================================================
               CARGAR DEPARTAMENTOS DEL FILTRO
               ================================================= */

            cargarFiltroDepartamentos();


            /* =================================================
               MOSTRAR USUARIOS
               ================================================= */

            aplicarFiltros();


        }
        catch (error) {

            console.error(
                "ERROR AL CARGAR USUARIOS:",
                error
            );


            tbody.innerHTML = "";


            if (empty) {

                empty.hidden = false;


                const titulo =
                    empty.querySelector("h2");


                if (titulo) {

                    titulo.textContent =
                        "No fue posible cargar los usuarios.";

                }

            }

        }
        finally {

            if (loading) {
                loading.hidden = true;
            }

        }

    }

    /* =========================================================
   ABRIR EDICIÓN DE USUARIO
   ========================================================= */

function abrirEdicionUsuario(usuario) {

    console.log(
        "USUARIO SELECCIONADO PARA EDITAR:",
        usuario
    );


    /* =====================================================
       GUARDAR USUARIO SELECCIONADO
       ===================================================== */

    sessionStorage.setItem(
        "flow.usuario.editar",
        JSON.stringify(usuario)
    );


    /* =====================================================
       ABRIR VISTA DE EDICIÓN
       ===================================================== */

    showView(
        "editarUsuario"
    );

}


    /* =========================================================
       CARGAR DEPARTAMENTOS
       ========================================================= */

    function cargarFiltroDepartamentos() {

        if (!filtroDepartamento) {
            return;
        }


        const departamentos =
            [
                ...new Set(

                    usuarios
                        .map(
                            usuario =>
                                String(
                                    usuario.departamento || ""
                                ).trim()
                        )
                        .filter(
                            departamento =>
                                departamento !== ""
                        )

                )
            ]
            .sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        "es",
                        {
                            sensitivity: "base"
                        }
                    )
            );


        filtroDepartamento.innerHTML = `
            <option value="">
                Todos los departamentos
            </option>
        `;


        departamentos.forEach(
            departamento => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    departamento;


                option.textContent =
                    departamento;


                filtroDepartamento.appendChild(
                    option
                );

            }
        );


        /* =====================================================
           REINICIAR ÁREA
           ===================================================== */

        if (filtroArea) {

            filtroArea.innerHTML = `
                <option value="">
                    Todas las áreas
                </option>
            `;

            filtroArea.disabled = true;

        }

    }


    /* =========================================================
       CARGAR ÁREAS SEGÚN DEPARTAMENTO
       ========================================================= */

    function cargarFiltroAreas() {

        if (
            !filtroDepartamento ||
            !filtroArea
        ) {
            return;
        }


        const departamento =
            filtroDepartamento.value;


        /* =====================================================
           REINICIAR ÁREAS
           ===================================================== */

        filtroArea.innerHTML = `
            <option value="">
                Todas las áreas
            </option>
        `;


        /* =====================================================
           SI NO HAY DEPARTAMENTO
           ===================================================== */

        if (!departamento) {

            filtroArea.disabled = true;

            return;

        }


        /* =====================================================
           OBTENER ÁREAS DEL DEPARTAMENTO
           ===================================================== */

        const areas =
            [
                ...new Set(

                    usuarios
                        .filter(
                            usuario => {

                                const usuarioDepartamento =
                                    String(
                                        usuario.departamento || ""
                                    )
                                    .trim()
                                    .toLowerCase();


                                return (
                                    usuarioDepartamento ===
                                    departamento
                                        .trim()
                                        .toLowerCase()
                                );

                            }
                        )
                        .map(
                            usuario =>
                                String(
                                    usuario.area || ""
                                ).trim()
                        )
                        .filter(
                            area =>
                                area !== ""
                        )

                )
            ]
            .sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        "es",
                        {
                            sensitivity: "base"
                        }
                    )
            );


        console.log(
            "Áreas encontradas para:",
            departamento,
            areas
        );


        /* =====================================================
           AGREGAR ÁREAS
           ===================================================== */

        areas.forEach(
            area => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    area;


                option.textContent =
                    area;


                filtroArea.appendChild(
                    option
                );

            }
        );


        filtroArea.disabled =
            areas.length === 0;

    }


    /* =========================================================
       APLICAR FILTROS
       ========================================================= */

    function aplicarFiltros() {

        if (!tbody) {
            return;
        }


        const departamento =
            filtroDepartamento
                ? filtroDepartamento.value
                : "";


        const area =
            filtroArea
                ? filtroArea.value
                : "";


        console.log(
            "APLICANDO FILTROS:",
            {
                departamento,
                area
            }
        );


        const usuariosFiltrados =
            usuarios.filter(
                usuario => {

                    const usuarioDepartamento =
                        String(
                            usuario.departamento || ""
                        )
                        .trim()
                        .toLowerCase();


                    const usuarioArea =
                        String(
                            usuario.area || ""
                        )
                        .trim()
                        .toLowerCase();


                    const departamentoSeleccionado =
                        String(
                            departamento
                        )
                        .trim()
                        .toLowerCase();


                    const areaSeleccionada =
                        String(
                            area
                        )
                        .trim()
                        .toLowerCase();


                    const coincideDepartamento =
                        !departamentoSeleccionado ||
                        usuarioDepartamento ===
                        departamentoSeleccionado;


                    const coincideArea =
                        !areaSeleccionada ||
                        usuarioArea ===
                        areaSeleccionada;


                    return (
                        coincideDepartamento &&
                        coincideArea
                    );

                }
            );


        console.log(
            "USUARIOS FILTRADOS:",
            usuariosFiltrados
        );


        renderUsuarios(
            usuariosFiltrados
        );

    }


    /* =========================================================
       MOSTRAR USUARIOS
       ========================================================= */

    function renderUsuarios(
        listaUsuarios
    ) {

        if (!tbody) {
            return;
        }


        tbody.innerHTML = "";


        if (
            !listaUsuarios ||
            listaUsuarios.length === 0
        ) {

            if (empty) {
                empty.hidden = false;
            }

            return;

        }


        if (empty) {
            empty.hidden = true;
        }


        listaUsuarios.forEach(
            usuario => {

                const tr =
                    document.createElement(
                        "tr"
                    );


                const activo =
                    Number(
                        usuario.activo
                    ) === 1;


                const usuarioActual =
                    getUsuarioActual();

                const esPropio =
                    usuarioActual &&
                    Number(usuarioActual.id) === Number(usuario.id);


tr.innerHTML = `

    <!-- NOMBRE -->
    <td>
        ${escaparHTML(usuario.nombre)}
    </td>


    <!-- DEPARTAMENTO -->
    <td>
        ${escaparHTML(usuario.departamento)}
    </td>


    <!-- ÁREA -->
    <td>
        ${escaparHTML(usuario.area)}
    </td>


    <!-- CORREO -->
    <td>
        ${escaparHTML(usuario.correo_electronico)}
    </td>


    <!-- ROL -->
    <td>

        <select
            class="user-rol-select"
            data-user-id="${usuario.id}"
            ${esPropio ? `disabled title="No puedes cambiar tu propio rol desde aquí."` : ""}
        >

            ${Object.entries(ROL_LABEL).map(([valor, etiqueta]) => `
                <option value="${valor}" ${usuario.rol === valor ? "selected" : ""}>
                    ${etiqueta}
                </option>
            `).join("")}

        </select>

    </td>


    <!-- ESTADO -->
    <td>

        <span
            class="user-status ${
                activo
                    ? "user-status--active"
                    : "user-status--inactive"
            }"
        >

            ${
                activo
                    ? "● Activo"
                    : "● Inactivo"
            }

        </span>

    </td>


    <!-- ACCIÓN -->
    <td>

        <div class="user-actions">

            <!-- EDITAR -->
            <button
                type="button"
                class="user-edit-button"
                data-user-id="${usuario.id}"
            >
                Editar
            </button>


            <!-- ACTIVAR / DESACTIVAR -->
            <button
                type="button"
                class="user-status-button ${
                    activo
                        ? "user-status-button--deactivate"
                        : "user-status-button--activate"
                }"
                data-user-id="${usuario.id}"
                data-user-status="${usuario.activo}"
            >

                ${
                    activo
                        ? "Desactivar"
                        : "Activar"
                }

            </button>

        </div>

    </td>

`;


                tbody.appendChild(
                    tr
                );

                /* =====================================================
   BOTÓN EDITAR
   ===================================================== */

const btnEditar =
    tr.querySelector(
        ".user-edit-button"
    );


if (btnEditar) {

    btnEditar.addEventListener(
    "click",
    function () {

        const usuarioId =
            Number(
                this.dataset.userId
            );


        const usuarioSeleccionado =
            usuarios.find(
                usuario =>
                    Number(usuario.id) ===
                    usuarioId
            );


        if (!usuarioSeleccionado) {

            console.error(
                "No se encontró el usuario:",
                usuarioId
            );

            return;

        }


        console.log(
            "USUARIO SELECCIONADO:",
            usuarioSeleccionado
        );


        /* =============================================
           GUARDAR USUARIO
           ============================================= */

        sessionStorage.setItem(
            "flow.usuario.editar",
            JSON.stringify(
                usuarioSeleccionado
            )
        );


        /* =============================================
           ABRIR VISTA
           ============================================= */

        showView(
            "editarUsuario"
        );


        /* =============================================
           AVISAR A userEdit.js
           ============================================= */

        document.dispatchEvent(
            new CustomEvent(
                "flow:editar-usuario"
            )
        );

    }
);


        }    



            }
        );

    }


    /* =========================================================
       EVENTO CAMBIO DE DEPARTAMENTO
       ========================================================= */

    if (filtroDepartamento) {

        filtroDepartamento.addEventListener(
            "change",
            function () {

                console.log(
                    "Departamento seleccionado:",
                    filtroDepartamento.value
                );


                /* Primero cargar áreas */
                cargarFiltroAreas();


                /* Después aplicar filtro */
                aplicarFiltros();

            }
        );

    }


    /* =========================================================
       EVENTO CAMBIO DE ÁREA
       ========================================================= */

    if (filtroArea) {

        filtroArea.addEventListener(
            "change",
            function () {

                console.log(
                    "Área seleccionada:",
                    filtroArea.value
                );


                aplicarFiltros();

            }
        );

    }


    /* =========================================================
       LIMPIAR FILTROS
       ========================================================= */

    if (btnLimpiarFiltros) {

        btnLimpiarFiltros.addEventListener(
            "click",
            function () {

                if (filtroDepartamento) {

                    filtroDepartamento.value =
                        "";

                }


                if (filtroArea) {

                    filtroArea.innerHTML = `
                        <option value="">
                            Todas las áreas
                        </option>
                    `;

                    filtroArea.value =
                        "";

                    filtroArea.disabled =
                        true;

                }


                renderUsuarios(
                    usuarios
                );

            }
        );

    }


    /* =========================================================
       CAMBIAR ESTADO
       ========================================================= */

    async function cambiarEstadoUsuario(
        id,
        estadoActual
    ) {

        const nuevoEstado =
            Number(
                estadoActual
            ) === 1
                ? 0
                : 1;


        try {

            console.log(
                "Actualizando usuario:",
                id,
                "Nuevo estado:",
                nuevoEstado
            );


            const response =
                await fetch(
                    `${API_URL}/usuarios/${id}/estado`,
                    {
                        method: "PATCH",

                        headers: {
                            "Content-Type":
                                "application/json",

                            ...headerUsuario()
                        },

                        body:
                            JSON.stringify({
                                activo:
                                    nuevoEstado
                            })

                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible actualizar el estado."
                );

            }


            await cargarUsuarios();

        }
        catch (error) {

            console.error(
                "ERROR AL ACTUALIZAR ESTADO:",
                error
            );


            alert(
                error.message ||
                "No fue posible cambiar el estado del usuario."
            );

        }

    }


    async function cambiarRolUsuario(
        id,
        rol,
        select
    ) {

        try {

            const response =
                await fetch(
                    `${API_URL}/usuarios/${id}/rol`,
                    {
                        method: "PATCH",

                        headers: {
                            "Content-Type":
                                "application/json",

                            ...headerUsuario()
                        },

                        body:
                            JSON.stringify({
                                rol
                            })

                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible actualizar el rol."
                );

            }


            const usuario =
                usuarios.find(
                    u => Number(u.id) === Number(id)
                );

            if (usuario) {
                usuario.rol = rol;
            }

        }
        catch (error) {

            console.error(
                "ERROR AL ACTUALIZAR ROL:",
                error
            );

            alert(
                error.message ||
                "No fue posible cambiar el rol del usuario."
            );

            await cargarUsuarios();

        }

    }


 tbody.addEventListener(
    "click",
    function (event) {

        /* =====================================================
           EDITAR USUARIO
           ===================================================== */

        const botonEditar =
            event.target.closest(
                ".user-edit-button"
            );


        if (botonEditar) {

            const id =
                Number(
                    botonEditar.dataset.userId
                );


            const usuario =
                usuarios.find(
                    u =>
                        Number(u.id) === id
                );


            if (!usuario) {

                console.error(
                    "No se encontró el usuario:",
                    id
                );

                return;
            }


            console.log(
                "Usuario seleccionado para editar:",
                usuario
            );


            /*
             * Guardamos temporalmente
             * el usuario seleccionado.
             */

            sessionStorage.setItem(
                "flow.usuario.editar",
                JSON.stringify(usuario)
            );


            /*
             * Abrimos la vista
             */

            showView(
                "editarUsuario"
            );


            return;
        }



        /* =====================================================
           ACTIVAR / DESACTIVAR
           ===================================================== */

        const botonEstado =
            event.target.closest(
                ".user-status-button"
            );


        if (!botonEstado) {
            return;
        }


        const id =
            Number(
                botonEstado.dataset.userId
            );


        const estadoActual =
            Number(
                botonEstado.dataset.userStatus
            );


        if (!id) {

            console.error(
                "ID de usuario no válido:",
                botonEstado.dataset.userId
            );

            return;
        }


        cambiarEstadoUsuario(
            id,
            estadoActual
        );

    }
);


tbody.addEventListener(
    "change",
    function (event) {

        const select =
            event.target.closest(
                ".user-rol-select"
            );

        if (!select) {
            return;
        }

        const id =
            Number(
                select.dataset.userId
            );

        if (!id) {

            console.error(
                "ID de usuario no válido:",
                select.dataset.userId
            );

            return;
        }

        select.disabled =
            true;

        cambiarRolUsuario(
            id,
            select.value,
            select
        ).finally(
            () => {
                select.disabled = false;
            }
        );

    }
);


    /* =========================================================
       ACTUALIZAR DESPUÉS DE REGISTRAR USUARIO
       ========================================================= */

    document.addEventListener(
        "flow:usuario-registrado",
        function () {

            cargarUsuarios();

        }
    );


    /* =========================================================
       EXPONER CARGA
       ========================================================= */

    window.flowCargarUsuarios =
        cargarUsuarios;


    /* =========================================================
       CARGA INICIAL
       ========================================================= */

    cargarUsuarios();

}
