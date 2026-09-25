import { avisoDialog } from "../services/confirmDialog.js";

/* =========================================================
   FLOW - CONTROL DE USUARIOS
   ========================================================= */

const API_URL =
    "http://localhost:3000/api/usuarios";


export function initUsuariosView() {

    const tablaBody =
        document.querySelector(
            "#usuarios-tabla-body"
        );

    const tablaContenedor =
        document.querySelector(
            "#usuarios-tabla-contenedor"
        );

    const empty =
        document.querySelector(
            "#usuarios-empty"
        );

    const loading =
        document.querySelector(
            "#usuarios-loading"
        );


    if (!tablaBody) {

        console.warn(
            "No se encontró #usuarios-tabla-body"
        );

        return;

    }


    /*
     * Cargar usuarios inicialmente
     */

    cargarUsuarios();


    /*
     * También recargar cuando
     * se registra un usuario nuevo.
     */

    document.addEventListener(
        "flow:usuario-registrado",
        () => {

            cargarUsuarios();

        }
    );


    async function cargarUsuarios() {

        try {

            /*
             * Mostrar loading
             */

            if (loading) {

                loading.hidden =
                    false;

            }


            if (empty) {

                empty.hidden =
                    true;

            }


            tablaBody.innerHTML =
                "";


            /*
             * Consultar API
             */

            const response =
                await fetch(
                    API_URL
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    "No fue posible obtener los usuarios."
                );

            }


            const usuarios =
                data.usuarios || [];


            /*
             * No hay usuarios
             */

            if (
                usuarios.length === 0
            ) {

                if (empty) {

                    empty.hidden =
                        false;

                }

                return;

            }


            /*
             * Crear filas
             */

            usuarios.forEach(
                (usuario) => {

                    const fila =
                        document.createElement(
                            "tr"
                        );


                    const activo =
                        Number(
                            usuario.activo
                        ) === 1;


                    fila.innerHTML = `

                        <td>
                            ${escapeHtml(
                                usuario.nombre
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                usuario.departamento
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                usuario.area
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                usuario.correo_electronico
                            )}
                        </td>

                        <td>

                            <span
                                class="
                                    user-status
                                    ${
                                        activo
                                            ? "user-status--active"
                                            : "user-status--inactive"
                                    }
                                "
                            >
                                ${
                                    activo
                                        ? "Activo"
                                        : "Inactivo"
                                }
                            </span>

                        </td>

                        <td>

                            <button
                                type="button"
                                class="user-status-button ${
                                    activo
                                    ? "user-status-button--deactivate"
                                    : "user-status-button--activate"
                                }"
                                data-id="${usuario.id}"
                                data-activo="${activo ? 1 : 0}"
                            >

                                ${
                                    activo
                                        ? "Desactivar"
                                        : "Activar"
                                }

                            </button>

                        </td>

                    `;


                    /*
                     * Botón de estado
                     */

                    const boton =
                        fila.querySelector(
                            ".user-status-button"
                        );

                        /*
                        *El botón siempre debe iniciar habilitado.
                        */
                       boton.disabled = false;
                       boton.removeAttribute("disabled");

                       /*
                       *Cambio de estado
                       */

                    boton.addEventListener(
                        "click",
                        async () => {

                            /*
                            *Evitar doble clic mientras
                            *se actualiza el registro
                            */
                           
                            boton.disabled = true;

                            try {

                            await cambiarEstado(
                                usuario.id,
                                activo ? 0 : 1
                            );
                        }finally{

                            /*
                            *Volver a habilitar el botón
                            * después de terminar
                            */
                           boton.disabled = false;
                        }

                        }
                    );


                    tablaBody.appendChild(
                        fila
                    );

                }
            );


        } catch (error) {

            console.error(
                "Error al cargar usuarios:",
                error
            );


            tablaBody.innerHTML =
                "";


            if (empty) {

                empty.hidden =
                    false;

                empty.querySelector(
                    "h2"
                ).textContent =
                    "Error al cargar usuarios";

                empty.querySelector(
                    "p"
                ).textContent =
                    error.message;

            }


        } finally {

            /*
             * Ocultar loading
             */

            if (loading) {

                loading.hidden =
                    true;

            }

        }

    }


    /*
     * =====================================================
     * CAMBIAR ESTADO
     * =====================================================
     */

    async function cambiarEstado(
        id,
        activo
    ) {

        try {

            const response =
                await fetch(
                    `${API_URL}/${id}/estado`,
                    {

                        method:
                            "PATCH",

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


            /*
             * Volver a consultar MySQL
             */

            await cargarUsuarios();


        } catch (error) {

            console.error(
                "Error al actualizar estado:",
                error
            );


            avisoDialog(
                error.message ||
                "No fue posible actualizar el estado."
            );

        }

    }

}


/* =========================================================
   PROTEGER TEXTO HTML
   ========================================================= */

function escapeHtml(
    valor
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        valor === null ||
        valor === undefined
            ? ""
            : String(valor);


    return div.innerHTML;

}