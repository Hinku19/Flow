import { API_URL } from "./config.js";
import { headerUsuario } from "../services/auth.service.js";
import { avisoDialog } from "../services/confirmDialog.js";


export function initUserEdit() {

    const form =
        document.querySelector(
            "#editar-usuario-form"
        );


    if (!form) {

        console.warn(
            "No se encontró #editar-usuario-form"
        );

        return;

    }


    const id =
        document.querySelector(
            "#editar-usuario-id"
        );


    const nombre =
        document.querySelector(
            "#editar-nombre"
        );


    const departamento =
        document.querySelector(
            "#editar-departamento"
        );


    const area =
        document.querySelector(
            "#editar-area"
        );


    const correo =
        document.querySelector(
            "#editar-correo"
        );


    const password =
        document.querySelector(
            "#editar-password"
        );


    const passwordConfirmar =
        document.querySelector(
            "#editar-password-confirmacion"
        );


    const error =
        document.querySelector(
            "#editar-usuario-error"
        );


    const botonGuardar =
        document.querySelector(
            "#btn-guardar-usuario"
        );


    let usuarioActual = null;



    /* =====================================================
       CARGAR DEPARTAMENTOS
       ===================================================== */

    async function cargarDepartamentos() {

        const response =
            await fetch(
                `${API_URL}/subsidiaries`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.mensaje ||
                "No fue posible cargar los departamentos."
            );

        }


        departamento.innerHTML = `
            <option value="">
                Seleccione un departamento
            </option>
        `;


        data.datos.forEach(
            item => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    item.SubsidiaryId;


                option.textContent =
                    item.SubsidiaryName;


                departamento.appendChild(
                    option
                );

            }
        );

    }



    /* =====================================================
       CARGAR ÁREAS
       ===================================================== */

    async function cargarAreas(
        subsidiaryId,
        areaSeleccionada = ""
    ) {

        area.disabled = true;


        area.innerHTML = `
            <option value="">
                Cargando áreas...
            </option>
        `;


        if (!subsidiaryId) {

            area.innerHTML = `
                <option value="">
                    Seleccione primero un departamento
                </option>
            `;

            return;
        }


        const response =
            await fetch(
                `${API_URL}/areas?subsidiaryId=${encodeURIComponent(
                    subsidiaryId
                )}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.mensaje ||
                "No fue posible cargar las áreas."
            );

        }


        area.innerHTML = `
            <option value="">
                Seleccione un área
            </option>
        `;


        data.datos.forEach(
            item => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    item.AreaId;


                option.textContent =
                    item.AreaName;


                area.appendChild(
                    option
                );

            }
        );


        area.disabled =
            data.datos.length === 0;


        /*
         * Seleccionar área actual
         */

        if (areaSeleccionada) {

            const opcion =
                Array.from(
                    area.options
                ).find(
                    option =>
                        option.textContent
                            .trim()
                            .toLowerCase() ===
                        areaSeleccionada
                            .trim()
                            .toLowerCase()
                );


            if (opcion) {

                area.value =
                    opcion.value;

            }

        }

    }



    /* =====================================================
       CARGAR USUARIO
       ===================================================== */

     async function cargarUsuario() {

    console.log(
        "USER EDIT: intentando cargar usuario..."
    );


    const almacenado =
        sessionStorage.getItem(
            "flow.usuario.editar"
        );


    console.log(
        "USER EDIT: sessionStorage:",
        almacenado
    );


    if (!almacenado) {

        console.warn(
            "USER EDIT: no existe flow.usuario.editar"
        );

        return;

    }


    usuarioActual =
        JSON.parse(
            almacenado
        );


    console.log(
        "USER EDIT: usuario encontrado:",
        usuarioActual
    );


        id.value =
            usuarioActual.id;


        nombre.value =
            usuarioActual.nombre || "";


        correo.value =
            usuarioActual.correo_electronico || "";


        password.value =
            "";


        passwordConfirmar.value =
            "";


        /*
         * Cargar departamentos
         */

        await cargarDepartamentos();


        /*
         * Buscar departamento por nombre
         */

        const opcionDepartamento =
            Array.from(
                departamento.options
            ).find(
                option =>
                    option.textContent
                        .trim()
                        .toLowerCase() ===
                    String(
                        usuarioActual.departamento || ""
                    )
                        .trim()
                        .toLowerCase()
            );


        if (opcionDepartamento) {

            departamento.value =
                opcionDepartamento.value;


            await cargarAreas(
                opcionDepartamento.value,
                usuarioActual.area
            );

        }

    }



    /* =====================================================
       CAMBIO DE DEPARTAMENTO
       ===================================================== */

    departamento.addEventListener(
        "change",
        async function () {

            try {

                await cargarAreas(
                    departamento.value
                );

            }
            catch (err) {

                console.error(
                    "Error cargando áreas:",
                    err
                );

            }

        }
    );



    /* =====================================================
       GUARDAR CAMBIOS
       ===================================================== */

    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            if (error) {

                error.hidden =
                    true;

            }


            /*
             * Validar contraseña
             */

            if (
                password.value !==
                passwordConfirmar.value
            ) {

                if (error) {

                    error.textContent =
                        "Las contraseñas no coinciden.";

                    error.hidden =
                        false;

                }

                return;

            }


            /*
             * Obtener textos
             */

            const departamentoTexto =
                departamento.options[
                    departamento.selectedIndex
                ]?.text || "";


            const areaTexto =
                area.options[
                    area.selectedIndex
                ]?.text || "";


            try {

                botonGuardar.disabled =
                    true;


                botonGuardar.textContent =
                    "Guardando...";


                const datos = {

                    nombre:
                        nombre.value.trim(),

                    departamento:
                        departamentoTexto,

                    area:
                        areaTexto,

                    correo_electronico:
                        correo.value.trim()

                };


                /*
                 * Solo enviamos password
                 * si el usuario escribió una nueva.
                 */

                if (
                    password.value.trim() !== ""
                ) {

                    datos.password =
                        password.value;

                }


                const response =
                    await fetch(
                        `${API_URL}/usuarios/${id.value}`,
                        {

                            method: "PUT",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                ...headerUsuario()
                            },

                            body:
                                JSON.stringify(
                                    datos
                                )

                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.mensaje ||
                        data.error ||
                        "No fue posible actualizar el usuario."
                    );

                }


                await avisoDialog(
                    datos.password
                        ? "Contraseña y datos del usuario actualizados correctamente."
                        : "Usuario actualizado correctamente."
                );


                sessionStorage.removeItem(
                    "flow.usuario.editar"
                );


                /*
                 * Regresar a usuarios
                 */

                const {
                    showView
                } =
                    await import(
                        "../services/viewManager.js"
                    );


                showView(
                    "usuarios"
                );


                /*
                 * Recargar tabla
                 */

                if (
                    window.flowCargarUsuarios
                ) {

                    await window.flowCargarUsuarios();

                }

            }
            catch (err) {

                console.error(
                    "ERROR AL EDITAR USUARIO:",
                    err
                );


                if (error) {

                    error.textContent =
                        err.message ||
                        "No fue posible actualizar el usuario.";

                    error.hidden =
                        false;

                }

            }
            finally {

                botonGuardar.disabled =
                    false;


                botonGuardar.textContent =
                    "Guardar cambios";

            }

        }
    );

        /* =====================================================
   EVENTO: EDITAR USUARIO
   ===================================================== */

document.addEventListener(
    "flow:editar-usuario",
    function () {

        console.log(
            "USER EDIT: evento recibido."
        );


        cargarUsuario()
            .catch(
                error => {

                    console.error(
                        "ERROR CARGANDO USUARIO:",
                        error
                    );

                }
            );

    }
);


}