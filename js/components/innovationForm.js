/* =========================================================
   FORMULARIO DE INNOVACIONES
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    getUsuarioActual
} from "../services/auth.service.js";

import {
    createVpnCalculator
} from "./vpnCalculator.js";


/* =========================================================
   INICIALIZAR FORMULARIO
   ========================================================= */

export function initInnovationForm() {

    const form =
        document.querySelector(
            "#form-innovacion"
        );


    if (!form) {

        console.warn(
            "No se encontró #form-innovacion"
        );

        return {

            render:
                () => {}

        };

    }


    const selectArea =
        form.querySelector(
            "#innovacion-area"
        );

    const inputResponsableNombre =
        form.querySelector(
            "#innovacion-responsable-nombre"
        );

    const inputResponsableApellido =
        form.querySelector(
            "#innovacion-responsable-apellido"
        );

    const feedback =
        form.querySelector(
            ".innovation-form__feedback"
        );

    const toast =
        form.querySelector(
            ".innovation-form__toast"
        );

    const botonEnviar =
        form.querySelector(
            ".innovation-form__submit"
        );

    const vpnCalculator =
        createVpnCalculator({

            container:
                form.querySelector(
                    "#innovacion-vpn-calculadora"
                )

        });


    let areasCargadas =
        false;

    let toastTimeoutId =
        null;


    /* =====================================================
       CARGAR ÁREAS DISPONIBLES
       ===================================================== */

    async function cargarAreas() {

        try {

            const response =
                await fetch(
                    `${API_URL}/areas`
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible obtener las áreas."
                );

            }


            const areas =
                data.datos ||
                [];


            selectArea.innerHTML = `
                <option value="">
                    -Select-
                </option>
            `;

            areas.forEach(
                (area) => {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        area.AreaId;

                    option.textContent =
                        area.AreaName;

                    selectArea.appendChild(
                        option
                    );

                }
            );


            preseleccionarAreaUsuario(
                areas
            );

            areasCargadas =
                true;

        }
        catch (error) {

            console.error(
                "ERROR CARGANDO ÁREAS:",
                error
            );

            selectArea.innerHTML = `
                <option value="">
                    Error al cargar áreas
                </option>
            `;

        }

    }


    /* =====================================================
       PRESELECCIONAR ÁREA DEL USUARIO EN SESIÓN
       ===================================================== */

    function preseleccionarAreaUsuario(
        areas
    ) {

        const usuario =
            getUsuarioActual();

        if (
            !usuario ||
            !usuario.area
        ) {

            return;

        }


        const coincidencia =
            areas.find(
                (area) =>
                    area.AreaName.trim().toLowerCase() ===
                    usuario.area.trim().toLowerCase()
            );

        if (coincidencia) {

            selectArea.value =
                coincidencia.AreaId;

        }

    }


    /* =====================================================
       PRELLENAR RESPONSABLE CON EL USUARIO EN SESIÓN
       ===================================================== */

    function prellenarResponsable() {

        const usuario =
            getUsuarioActual();

        if (!usuario) {

            return;

        }


        inputResponsableNombre.value =
            usuario.nombre ||
            "";

    }


    /* =====================================================
       MOSTRAR RETROALIMENTACIÓN
       ===================================================== */

    function mostrarFeedback(
        mensaje,
        esError
    ) {

        if (!feedback) {

            return;

        }


        feedback.textContent =
            mensaje;

        feedback.hidden =
            !mensaje;

        feedback.classList.toggle(
            "innovation-form__feedback--error",
            Boolean(esError)
        );

        feedback.classList.toggle(
            "innovation-form__feedback--success",
            !esError
        );

    }


    /* =====================================================
       MOSTRAR AVISO TEMPORAL (TOAST)
       ===================================================== */

    function mostrarToast(
        mensaje
    ) {

        if (!toast) {

            return;

        }


        if (toastTimeoutId) {

            clearTimeout(
                toastTimeoutId
            );

        }


        toast.textContent =
            mensaje;

        toast.classList.add(
            "innovation-form__toast--visible"
        );


        toastTimeoutId =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "innovation-form__toast--visible"
                    );

                },
                1000
            );

    }


    /* =====================================================
       CONSTRUIR FormData A PARTIR DEL FORMULARIO
       ===================================================== */

    function construirFormData() {

        const usuario =
            getUsuarioActual();

        const areaSeleccionada =
            selectArea.options[
                selectArea.selectedIndex
            ];

        const formData =
            new FormData();


        formData.append(
            "usuarioId",
            usuario ? usuario.id : ""
        );

        formData.append(
            "areaId",
            selectArea.value
        );

        formData.append(
            "areaNombre",
            areaSeleccionada ?
                areaSeleccionada.textContent.trim() :
                ""
        );

        formData.append(
            "responsableNombre",
            inputResponsableNombre.value.trim()
        );

        formData.append(
            "responsableApellido",
            inputResponsableApellido.value.trim()
        );

        [
            "nombre",
            "actividad",
            "servicio",
            "problematica",
            "objetivo",
            "estrategia",
            "debilidad",
            "accion-1",
            "accion-2",
            "accion-3",
            "accion-4",
            "accion-5",
            "justificacion"
        ].forEach(
            (campo) => {

                const elemento =
                    form.querySelector(
                        `#innovacion-${campo}`
                    );

                formData.append(
                    campo.replace(
                        /-([a-z0-9])/g,
                        (match, letra) =>
                            letra.toUpperCase()
                    ),
                    elemento ?
                        elemento.value.trim() :
                        ""
                );

            }
        );


        formData.append(
            "vpnDatos",
            JSON.stringify(
                vpnCalculator.getDatos()
            )
        );


        const evidenciaArchivo =
            form.querySelector(
                "#innovacion-evidencia-archivo"
            ).files[0];

        if (evidenciaArchivo) {

            formData.append(
                "evidenciaArchivo",
                evidenciaArchivo
            );

        }


        const evidenciaImagenes =
            form.querySelector(
                "#innovacion-evidencia-imagenes"
            ).files;

        Array.from(
            evidenciaImagenes
        ).forEach(
            (archivo) => {

                formData.append(
                    "evidenciaImagenes",
                    archivo
                );

            }
        );


        return formData;

    }


    /* =====================================================
       ENVIAR FORMULARIO
       ===================================================== */

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            if (
                !form.checkValidity()
            ) {

                form.reportValidity();

                return;

            }


            botonEnviar.disabled =
                true;

            mostrarFeedback(
                "Enviando innovación...",
                false
            );


            try {

                const response =
                    await fetch(
                        `${API_URL}/innovaciones`,
                        {

                            method:
                                "POST",

                            body:
                                construirFormData()

                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {

                    throw new Error(
                        data.mensaje ||
                        data.error ||
                        "No fue posible registrar la innovación."
                    );

                }


                mostrarFeedback(
                    "",
                    false
                );

                mostrarToast(
                    "Innovación registrada correctamente."
                );

                form.reset();

                vpnCalculator.reset();

                prellenarResponsable();

                if (areasCargadas) {

                    cargarAreas();

                }

            }
            catch (error) {

                console.error(
                    "ERROR AL REGISTRAR INNOVACIÓN:",
                    error
                );

                mostrarFeedback(
                    error.message ||
                    "Ocurrió un error al registrar la innovación.",
                    true
                );

            }
            finally {

                botonEnviar.disabled =
                    false;

            }

        }
    );


    /* =====================================================
       INICIALIZACIÓN
       ===================================================== */

    prellenarResponsable();

    cargarAreas();


    return {

        render:
            () => {}

    };

}
