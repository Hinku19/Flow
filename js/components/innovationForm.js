/* =========================================================
   FORMULARIO DE INNOVACIONES
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    normalizarImagen
} from "../utils/normalizarImagen.js";

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


    const contenedorAccionesExtra =
        form.querySelector(
            "#innovacion-acciones-extra"
        );

    const botonAgregarAccion =
        form.querySelector(
            ".innovation-form__agregar-accion"
        );


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

    async function construirFormData() {

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
            "accionesExtra",
            JSON.stringify(
                accionesExtra()
                    .map(
                        (grupo) =>
                            grupo.querySelector("textarea").value.trim()
                    )
                    .filter(Boolean)
            )
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

        /*
         * Se reducen y pasan a WebP antes de subirlas (ver
         * normalizarImagen). Si alguna no se puede leer, el error
         * llega al catch del envío y se muestra en el formulario.
         */

        for (const archivo of Array.from(evidenciaImagenes)) {

            formData.append(
                "evidenciaImagenes",
                await normalizarImagen(
                    archivo
                )
            );

        }


        return formData;

    }


    /* =====================================================
       ACCIONES ADICIONALES (6 A 10)
       ---------------------------------------------------------
       Las 5 primeras son fijas en el HTML (1 a 3 obligatorias).
       Estas son opcionales: se agregan con "+ Agregar acción"
       y se pueden quitar; se renumeran al quitar una.
       ===================================================== */

    const ACCIONES_FIJAS =
        5;

    const MAX_ACCIONES =
        10;


    function accionesExtra() {

        return contenedorAccionesExtra
            ? Array.from(
                contenedorAccionesExtra.querySelectorAll(
                    ".innovation-form__accion-extra"
                )
            )
            : [];

    }


    function renumerarAccionesExtra() {

        accionesExtra().forEach(
            (grupo, indice) => {

                const numero =
                    ACCIONES_FIJAS + indice + 1;

                const textarea =
                    grupo.querySelector(
                        "textarea"
                    );

                textarea.id =
                    `innovacion-accion-${numero}`;

                grupo.querySelector(
                    "label"
                ).htmlFor =
                    textarea.id;

                grupo.querySelector(
                    ".innovation-form__accion-numero"
                ).textContent =
                    `Acción ${numero}`;

            }
        );


        if (botonAgregarAccion) {

            botonAgregarAccion.hidden =
                ACCIONES_FIJAS + accionesExtra().length >= MAX_ACCIONES;

        }

    }


    function agregarAccionExtra() {

        if (
            !contenedorAccionesExtra ||
            ACCIONES_FIJAS + accionesExtra().length >= MAX_ACCIONES
        ) {

            return;

        }


        const grupo =
            document.createElement(
                "div"
            );

        grupo.classList.add(
            "form-group",
            "innovation-form__accion-extra"
        );

        grupo.innerHTML = `
            <div class="innovation-form__accion-encabezado">
                <label>
                    <span class="innovation-form__accion-numero"></span>
                </label>
                <button
                    type="button"
                    class="innovation-form__quitar-accion"
                >
                    Quitar
                </button>
            </div>
            <textarea rows="3"></textarea>
        `;


        contenedorAccionesExtra.appendChild(
            grupo
        );

        renumerarAccionesExtra();

        grupo.querySelector(
            "textarea"
        ).focus();

    }


    function limpiarAccionesExtra() {

        accionesExtra().forEach(
            (grupo) =>
                grupo.remove()
        );

        renumerarAccionesExtra();

    }


    botonAgregarAccion?.addEventListener(
        "click",
        agregarAccionExtra
    );


    contenedorAccionesExtra?.addEventListener(
        "click",
        (event) => {

            const boton =
                event.target.closest(
                    ".innovation-form__quitar-accion"
                );

            if (!boton) {

                return;

            }

            boton.closest(
                ".innovation-form__accion-extra"
            ).remove();

            renumerarAccionesExtra();

        }
    );


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
                                await construirFormData()

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

                limpiarAccionesExtra();

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
