import { avisoDialog } from "../services/confirmDialog.js";

const API_URL =
    "http://localhost:3000/api";


export function initUsersView() {

    const container =
        document.querySelector(
            "#usuarios-lista"
        );


    if (!container) {

        console.warn(
            "No se encontró #usuarios-lista"
        );

        return;
    }


    cargarUsuarios(
        container
    );


    document.addEventListener(
        "flow:usuario-registrado",
        () => {

            cargarUsuarios(
                container
            );

        }
    );

}


/* =========================================================
   CARGAR USUARIOS
   ========================================================= */

async function cargarUsuarios(
    container
) {

    try {

        container.innerHTML = `
            <div class="users-view__loading">
                Cargando usuarios...
            </div>
        `;


        const response =
            await fetch(
                `${API_URL}/usuarios`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.mensaje ||
                "No fue posible cargar los usuarios."
            );

        }


        if (
            !data.datos ||
            data.datos.length === 0
        ) {

            container.innerHTML = `
                <div class="users-view__empty">
                    <div class="users-view__empty-icon">
                        <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
                            />

                            <circle
                                cx="9"
                                cy="7"
                                r="4"
                            />

                            <path
                                d="M22 21v-2a4 4 0 0 0-3-3.87"
                            />

                            <path
                                d="M16 3.13a4 4 0 0 1 0 7.75"
                            />
                        </svg>
                    </div>

                    <h2>
                        No hay usuarios registrados
                    </h2>

                    <p>
                        Utiliza "+ Nuevo usuario"
                        para registrar el primero.
                    </p>
                </div>
            `;

            return;
        }


        container.innerHTML = "";


        data.datos.forEach(
            (usuario) => {

                const fila =
                    document.createElement(
                        "div"
                    );


                fila.className =
                    "users-table__row";


                fila.innerHTML = `

                    <div class="users-table__name">
                        ${escapeHtml(usuario.nombre)}
                    </div>

                    <div>
                        ${escapeHtml(usuario.departamento)}
                    </div>

                    <div>
                        ${escapeHtml(usuario.correo_electronico)}
                    </div>

                    <div class="users-table__status">

                        <label
                            class="status-switch"
                        >

                            <input
                                type="checkbox"
                                ${usuario.activo ? "checked" : ""}
                                data-user-id="${usuario.id}"
                            >

                            <span
                                class="status-switch__slider"
                            ></span>

                        </label>

                        <span
                            class="users-table__status-text"
                        >
                            ${usuario.activo ? "Activo" : "Inactivo"}
                        </span>

                    </div>

                `;


                const checkbox =
                    fila.querySelector(
                        "input[type='checkbox']"
                    );


                const statusText =
                    fila.querySelector(
                        ".users-table__status-text"
                    );


                checkbox.addEventListener(
                    "change",
                    async () => {

                        const nuevoEstado =
                            checkbox.checked;


                        checkbox.disabled =
                            true;


                        try {

                            await actualizarEstado(
                                usuario.id,
                                nuevoEstado
                            );


                            statusText.textContent =
                                nuevoEstado
                                    ? "Activo"
                                    : "Inactivo";


                        } catch (error) {

                            checkbox.checked =
                                !nuevoEstado;


                            avisoDialog(
                                error.message
                            );

                        } finally {

                            checkbox.disabled =
                                false;

                        }

                    }
                );


                container.appendChild(
                    fila
                );

            }
        );


    } catch (error) {

        console.error(
            "Error cargando usuarios:",
            error
        );


        container.innerHTML = `
            <div class="users-view__error">
                ${escapeHtml(error.message)}
            </div>
        `;

    }

}


/* =========================================================
   ACTUALIZAR ESTADO
   ========================================================= */

async function actualizarEstado(
    id,
    activo
) {

    const response =
        await fetch(
            `${API_URL}/usuarios/${id}/estado`,
            {

                method:
                    "PUT",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        activo
                    })

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.mensaje ||
            "No fue posible actualizar el estado."
        );

    }


    return data;

}


/* =========================================================
   SEGURIDAD BÁSICA PARA HTML
   ========================================================= */

function escapeHtml(
    texto
) {

    return String(
        texto ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}