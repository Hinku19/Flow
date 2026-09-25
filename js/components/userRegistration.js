import {
    API_URL
} from "./config.js";

import {
    headerUsuario
} from "../services/auth.service.js";

import {
    avisoDialog
} from "../services/confirmDialog.js";


/* =========================================================
   INICIALIZAR REGISTRO
   ========================================================= */

export function initUserRegistration() {

    console.log(
        "USER REGISTRATION: inicializando..."
    );


    const form =
        document.querySelector(
            "#form-registro-usuario"
        );


    if (!form) {

        console.warn(
            "No se encontró #form-registro-usuario"
        );

        return;
    }


    const departamento =
        document.querySelector(
            "#usuario-departamento"
        );


    const area =
        document.querySelector(
            "#usuario-area"
        );


    /* =====================================================
       CARGAR DEPARTAMENTOS
       ===================================================== */

    cargarDepartamentos(
        departamento,
        area
    );


    /* =====================================================
       CAMBIO DE DEPARTAMENTO
       ===================================================== */

    departamento.addEventListener(
        "change",
        () => {

            const subsidiaryId =
                departamento.value;


            cargarAreas(
                subsidiaryId,
                area
            );

        }
    );


    /* =====================================================
       SUBMIT
       ===================================================== */

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const nombre =
                document
                    .querySelector(
                        "#usuario-nombre"
                    )
                    .value
                    .trim();


            const departamentoTexto =
                departamento
                    .options[
                        departamento.selectedIndex
                    ]
                    .text;


            const areaTexto =
                area
                    .options[
                        area.selectedIndex
                    ]
                    .text;


            const correo =
                document
                    .querySelector(
                        "#usuario-correo"
                    )
                    .value
                    .trim();


            const password =
                document
                    .querySelector(
                        "#usuario-password"
                    )
                    .value;


            if (
                !nombre ||
                !departamento.value ||
                !area.value ||
                !correo ||
                !password
            ) {

                avisoDialog(
                    "Todos los campos son obligatorios."
                );

                return;
            }


            try {

                const response =
                    await fetch(
                        `${API_URL}/usuarios`,
                        {

                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",

                                ...headerUsuario()
                            },

                            body:
                                JSON.stringify({

                                    nombre,

                                    departamento:
                                        departamentoTexto,

                                    area:
                                        areaTexto,

                                    correo_electronico:
                                        correo,

                                    password

                                })

                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.mensaje ||
                        data.error ||
                        "No fue posible registrar el usuario."
                    );

                }


                avisoDialog(
                    "Usuario registrado correctamente."
                );


                form.reset();


                area.innerHTML = `
                    <option value="">
                        Seleccione primero un departamento
                    </option>
                `;


                area.disabled = true;


                document.dispatchEvent(
                    new CustomEvent(
                        "flow:usuario-registrado"
                    )
                );


            } catch (error) {

                console.error(
                    "Error al registrar usuario:",
                    error
                );


                avisoDialog(
                    error.message ||
                    "Ocurrió un error al registrar el usuario."
                );

            }

        }
    );

}


/* =========================================================
   CARGAR DEPARTAMENTOS
   ========================================================= */

async function cargarDepartamentos(
    selectDepartamento,
    selectArea
) {

    try {

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


        selectDepartamento.innerHTML = `
            <option value="">
                Seleccione un departamento
            </option>
        `;


        data.datos.forEach(
            (departamento) => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    departamento.SubsidiaryId;


                option.textContent =
                    departamento.SubsidiaryName;


                selectDepartamento.appendChild(
                    option
                );

            }
        );


        selectArea.innerHTML = `
            <option value="">
                Seleccione primero un departamento
            </option>
        `;


        selectArea.disabled =
            true;


    } catch (error) {

        console.error(
            "Error cargando departamentos:",
            error
        );

    }

}


/* =========================================================
   CARGAR ÁREAS
   ========================================================= */

async function cargarAreas(
    subsidiaryId,
    selectArea
) {

    if (!subsidiaryId) {

        selectArea.innerHTML = `
            <option value="">
                Seleccione primero un departamento
            </option>
        `;

        selectArea.disabled =
            true;

        return;
    }


    try {

        selectArea.disabled =
            true;


        selectArea.innerHTML = `
            <option value="">
                Cargando áreas...
            </option>
        `;


        const response =
            await fetch(
                `${API_URL}/areas?subsidiaryId=${encodeURIComponent(subsidiaryId)}`
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.mensaje ||
                "No fue posible cargar las áreas."
            );

        }


        selectArea.innerHTML = `
            <option value="">
                Seleccione un área
            </option>
        `;


        data.datos.forEach(
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


        selectArea.disabled =
            data.datos.length === 0;


        if (
            data.datos.length === 0
        ) {

            selectArea.innerHTML = `
                <option value="">
                    No hay áreas disponibles
                </option>
            `;

        }


    } catch (error) {

        console.error(
            "Error cargando áreas:",
            error
        );


        selectArea.innerHTML = `
            <option value="">
                Error al cargar áreas
            </option>
        `;

        selectArea.disabled =
            true;

    }

}