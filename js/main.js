import {
    reiniciarContenedor
} from "./utils/reiniciarContenedor.js";

import {
    createEditableList
} from "./components/editableList.js";

import {
    createCommitmentList
} from "./components/commitmentList.js";

import {
    createDevelopmentTable
} from "./components/developmentTable.js";

import {
    createTextSection
} from "./components/textSection.js";

import {
    createLinkList
} from "./components/linkList.js";

import {
    showView
} from "./services/viewManager.js";

import {
    initMeetingViewMode
} from "./services/meetingViewMode.js";

import {
    initMeetingLifecycle
} from "./services/meetingLifecycle.js";

import {
    sectionKey,
    getReunionActivaId
} from "./services/session.js";

import {
    cargarSeccionesDesdeBD
} from "./services/storage.service.js";

import {
    createTimer
} from "./services/timer.js";

import {
    createHistoryView
} from "./components/historyView.js";

import {
    capitalizar
} from "./utils/capitalize.js";

import {
    createArchiveView
} from "./components/archiveView.js";

import {
    initUserRegistration
} from "./components/userRegistration.js";

import {
    initUserManagement
} from "./components/userManagement.js";

import {
    initUserEdit
} from "./components/userEdit.js";

import {
    initCommitmentsView
} from "./components/commitmentsView.js";

import {
    initInnovationForm
} from "./components/innovationForm.js";

import {
    initSettingsMenu
} from "./components/settingsMenu.js";

import {
    initLogin
} from "./components/login.js";

import {
    cerrarSesion,
    usuarioAutenticado,
    esAdmin
} from "./services/auth.service.js";


/* =========================================================
   ALARMA
   ========================================================= */

const alarma =
    new Audio(
        "assets/alarma.mp3"
    );


/* =========================================================
   ARCHIVO
   ========================================================= */

const archiveView =
    createArchiveView();


/* =========================================================
   HISTORIAL
   ========================================================= */

const historyView =
    createHistoryView({

        container:
            document.querySelector(
                "#vista-historial"
            ),

        onOpen:
            (reunionId) => {

                archiveView.render(
                    reunionId
                );

            }

    });


historyView.render();


/* =========================================================
   TIMER
   ========================================================= */

const timer =
    createTimer({

        onFinish:
            () => {

                alarma.play();

            }

    });


/* =========================================================
   NAVEGACIÓN
   ========================================================= */

function inicializarNavegacion() {

    /*
     * =====================================================
     * TARJETAS DEL DASHBOARD
     * =====================================================
     */

    /*
     * =====================================================
     * NAVEGAR A UNA VISTA
     * =====================================================
     *
     * Centraliza el cambio de vista para poder
     * refrescar datos según la vista de destino.
     */

    function navegarAVista(
        vista
    ) {

        if (
            vista === "compromisos"
        ) {

            commitmentsView.render();

        }


        if (
            vista === "historial"
        ) {

            historyView.render();

        }


        showView(
            vista
        );

    }


    const tarjetas =
        document.querySelectorAll(
            ".dashboard-card[data-view]"
        );


    tarjetas.forEach(
        (tarjeta) => {

            tarjeta.addEventListener(
                "click",
                (event) => {

                    /*
                     * Evitar que algún botón
                     * interno interfiera.
                     */

                    event.preventDefault();

                    event.stopPropagation();


                    const vista =
                        tarjeta.getAttribute(
                            "data-view"
                        );


                    if (!vista) {

                        console.warn(
                            "Tarjeta sin data-view:",
                            tarjeta
                        );

                        return;

                    }


                    console.log(
                        "Navegando a:",
                        vista
                    );


                    navegarAVista(
                        vista
                    );

                }
            );

        }
    );


    /*
     * =====================================================
     * BOTONES CON data-view
     * =====================================================
     *
     * Esto permite que funcionen:
     *
     * Volver al inicio
     * Volver a usuarios
     * Cancelar
     * etc.
     */

    const botonesVista =
        document.querySelectorAll(
            "button[data-view]"
        );


    botonesVista.forEach(
        (boton) => {

            /*
             * Si el botón ya es una
             * tarjeta del Dashboard,
             * no agregamos otro evento.
             */

            if (
                boton.classList.contains(
                    "dashboard-card"
                )
            ) {

                return;

            }


            boton.addEventListener(
                "click",
                (event) => {

                    event.preventDefault();

                    event.stopPropagation();


                    const vista =
                        boton.getAttribute(
                            "data-view"
                        );


                    if (!vista) {
                        return;
                    }


                    console.log(
                        "Botón navegando a:",
                        vista
                    );


                    navegarAVista(
                        vista
                    );

                }
            );

        }
    );


    /*
     * =====================================================
     * PROGRAMAR REUNIÓN DESDE DASHBOARD
     * =====================================================
     */

    const btnDashboard =
        document.querySelector(
            "#dashboard-iniciar-reunion"
        );


    const btnIniciar =
        document.querySelector(
            "#btn-iniciar"
        );


    if (
        btnDashboard &&
        btnIniciar
    ) {

        btnDashboard.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                event.stopPropagation();


                console.log(
                    "Abriendo diálogo de nueva reunión..."
                );


                btnIniciar.click();

            }
        );

    }

}


/* =========================================================
   MONTAR REUNIÓN
   ========================================================= */

function montarReunion() {

    console.log(
        "montarReunion ejecutada"
    );


    /*
     * =====================================================
     * DESARROLLO
     * =====================================================
     */

    const developmentTable =
        createDevelopmentTable({

            container:
                reiniciarContenedor(
                    "#desarrollo"
                ),

            storageKey:
                sectionKey(
                    "desarrollo"
                )

        });


    /*
     * =====================================================
     * OBJETIVOS
     * =====================================================
     */

    createEditableList({

        container:
            reiniciarContenedor(
                "#objetivos"
            ),

        itemName:
            "objetivo",

        storageKey:
            sectionKey(
                "objetivos"
            ),

        onChange:
            (objetivos) => {

                developmentTable.setObjetivos(
                    objetivos
                );

            }

    });


    /*
     * =====================================================
     * ASUNTOS
     * =====================================================
     */

    createEditableList({

        container:
            reiniciarContenedor(
                "#asuntos"
            ),

        itemName:
            "asunto",

        storageKey:
            sectionKey(
                "asuntos"
            )

    });


    /*
     * =====================================================
     * COMPROMISOS
     * =====================================================
     */

    createCommitmentList({

        container:
            reiniciarContenedor(
                "#compromisos"
            ),

        storageKey:
            sectionKey(
                "compromisos"
            )

    });


    /*
     * =====================================================
     * OTROS ASUNTOS
     * =====================================================
     */

    createTextSection({

        container:
            reiniciarContenedor(
                "#otros"
            ),

        storageKey:
            sectionKey(
                "otros"
            ),

        placeholder:
            "Otros asuntos tratados…"

    });


    /*
     * =====================================================
     * COMPETITIVIDAD (incluye sus enlaces, mismo contenedor)
     * =====================================================
     */

    const competitividadContainer =
        reiniciarContenedor(
            "#competitividad"
        );

    createTextSection({

        container:
            competitividadContainer,

        storageKey:
            sectionKey(
                "competitividad"
            ),

        placeholder:
            "Notas sobre competitividad…"

    });

    createLinkList({

        container:
            competitividadContainer,

        storageKey:
            sectionKey(
                "enlaces"
            ),

        reunionId:
            getReunionActivaId()

    });


    /*
     * =====================================================
     * ACUERDOS
     * =====================================================
     */

    createTextSection({

        container:
            reiniciarContenedor(
                "#acuerdos"
            ),

        storageKey:
            sectionKey(
                "acuerdos"
            ),

        placeholder:
            "Acuerdos…"

    });


    /*
     * =====================================================
     * REFLEXIÓN
     * =====================================================
     */

    createTextSection({

        container:
            reiniciarContenedor(
                "#reflexion"
            ),

        storageKey:
            sectionKey(
                "reflexion"
            ),

        placeholder:
            "Reflexión grupal de la reunión…"

    });


}


/* =========================================================
   LLENAR ENCABEZADO DE REUNIÓN
   ========================================================= */

function llenarEncabezado(
    reunion
) {

    const meta =
        document.querySelector(
            ".meeting__meta"
        );


    if (!meta) {
        return;
    }


    /*
     * =====================================================
     * FECHA
     * =====================================================
     */

    const d =
        new Date(
            reunion.fecha
        );


    const dia =
        String(
            d.getDate()
        ).padStart(
            2,
            "0"
        );


    const mes =
        capitalizar(
            d.toLocaleDateString(
                "es-MX",
                {
                    month: "long"
                }
            )
        );


    const fecha =
        `${dia} de ${mes} de ${d.getFullYear()}`;


    const fechaElemento =
        meta.querySelector(
            '[data-campo="fecha"]'
        );


    if (fechaElemento) {

        fechaElemento.textContent =
            fecha;

    }


    /*
     * =====================================================
     * PARTICIPANTES
     * =====================================================
     */

    const miembrosElemento =
        meta.querySelector(
            '[data-campo="miembros"]'
        );


    if (miembrosElemento) {

        miembrosElemento.textContent =
            (
                reunion.participantes ||
                []
            ).join(
                ", "
            );

    }


    /*
     * =====================================================
     * ESTADO
     * =====================================================
     */

    const estadoElemento =
        meta.querySelector(
            '[data-campo="estado"]'
        );


    if (!estadoElemento) {
        return;
    }


    estadoElemento.innerHTML =
        "";


    const badge =
        document.createElement(
            "span"
        );


    badge.classList.add(
        "status-badge",
        "status-badge--en-curso"
    );


    badge.textContent =
        "● En curso";


    estadoElemento.appendChild(
        badge
    );

}


/* =========================================================
   LIMPIAR ENCABEZADO
   ========================================================= */

function limpiarEncabezado() {

    const meta =
        document.querySelector(
            ".meeting__meta"
        );


    if (!meta) {
        return;
    }


    meta
        .querySelectorAll(
            ".meeting__meta-value"
        )
        .forEach(
            (elemento) => {

                elemento.textContent =
                    "-";

            }
        );

}


/* =========================================================
   AJUSTAR CAMPOS DEL DESARROLLO
   ========================================================= */

function ajustarCamposDesarrollo() {

    requestAnimationFrame(
        () => {

            document
                .querySelectorAll(
                    ".development-block__field"
                )
                .forEach(
                    (field) => {

                        field.style.height =
                            "auto";


                        field.style.height =
                            `${field.scrollHeight}px`;

                    }
                );

        }
    );

}


/* =========================================================
   CICLO DE VIDA DE LA REUNIÓN
   ========================================================= */

initMeetingLifecycle({

    /*
     * =====================================================
     * INICIAR REUNIÓN
     * =====================================================
     */

    onStart:
       async (reunion) => {

        console.log(
            "Reunión iniciada:",
            reunion
        );


        /* =====================================================
           OBTENER ID DE REUNIÓN
           ===================================================== */

        const reunionId =
            Number(
                reunion.id
            );


        if (!reunionId) {

            console.error(
                "La reunión no tiene un ReunionId válido:",
                reunion
            );

            return;

        }


        /* =====================================================
           CARGAR DETALLE DESDE MYSQL
           ===================================================== */

        try {

            await cargarSeccionesDesdeBD(
                reunionId
            );


            console.log(
                "Detalle de reunión cargado desde MySQL:",
                reunionId
            );

        }
        catch (error) {

            console.error(
                "ERROR CARGANDO DETALLE DE REUNIÓN:",
                error
            );


            /*
             * Por ahora no detenemos la reunión.
             * storage.service.js conserva localStorage
             * como respaldo temporal.
             */

        }


        /* =====================================================
           MOSTRAR VISTA DE REUNIÓN
           ===================================================== */

        showView(
            "reunion"
        );


        /* =====================================================
           CREAR COMPONENTES
           ===================================================== */

        montarReunion();

        meetingViewMode.reiniciar();


        /* =====================================================
           ENCABEZADO
           ===================================================== */

        llenarEncabezado(
            reunion
        );


        /* =====================================================
           TIMER
           ===================================================== */

        timer.iniciar(
            reunion.duracion
        );


        /* =====================================================
           AJUSTAR CAMPOS
           ===================================================== */

        ajustarCamposDesarrollo();

    },


    /*
     * =====================================================
     * PAUSAR
     * =====================================================
     */

    onPause:
        () => {

            timer.detener();

        },


    /*
     * =====================================================
     * REANUDAR
     * =====================================================
     */

    onResume:
        () => {

            timer.reanudar();

        },


    /*
     * =====================================================
     * TERMINAR
     * =====================================================
     */

    onEnd:
        () => {

            timer.reset();


            limpiarEncabezado();


            historyView.render();


            showView(
                "historial"
            );

        }

});

/* =========================================================
   VALIDAR SESIÓN
   ========================================================= */

if (!usuarioAutenticado()) {

    window.location.href =
        "./vista-login.html";

}

/* =========================================================
   MOSTRAR USUARIO ACTUAL
   ========================================================= */

const usuarioNombre =
    document.querySelector(
        "#usuario-actual-nombre"
    );


if (usuarioNombre) {

    const usuario =
        sessionStorage.getItem(
            "flow.usuario"
        );


    if (usuario) {

        try {

            const datosUsuario =
                JSON.parse(usuario);


            usuarioNombre.textContent =
                " " + datosUsuario.nombre;

        }
        catch (error) {

            console.error(
                "No fue posible obtener el usuario:",
                error
            );

        }

    }

}

/* =========================================================
   INICIALIZAR NAVEGACIÓN
   ========================================================= */


inicializarNavegacion();


/* =========================================================
   REGISTRO DE USUARIOS
   ========================================================= */

initUserRegistration();


/* =========================================================
   CONTROL DE USUARIOS
   ========================================================= */

initUserManagement();

initUserEdit();


/* =========================================================
   VISTA GLOBAL DE COMPROMISOS
   ========================================================= */

const commitmentsView =
    initCommitmentsView();


/* =========================================================
   MODO HORIZONTAL DE LA REUNIÓN
   ========================================================= */

const meetingViewMode =
    initMeetingViewMode();


/* =========================================================
   FORMULARIO DE INNOVACIONES
   ========================================================= */

initInnovationForm();


/* =========================================================
   MENÚ DE CONFIGURACIÓN
   ========================================================= */

initSettingsMenu();


/*
 * "Control de Usuarios" (con el rol de cada quien incluido)
 * es solo para administrador. El backend también rechaza
 * estas acciones si alguien las alcanza sin serlo (ver
 * server.js), esto solo evita mostrarlas de entrada.
 */

if (!esAdmin()) {

    document
        .querySelectorAll(
            '.settings-menu__item[data-view="usuarios"]'
        )
        .forEach(
            (boton) => {

                boton.hidden =
                    true;

            }
        );

}


/* =========================================================
   VISTA INICIAL
   ========================================================= */

showView(
    "dashboard"
);

/* =========================================================
   CERRAR SESIÓN
   ========================================================= */

const btnCerrarSesion =
    document.querySelector(
        "#btn-cerrar-sesion"
    );


if (btnCerrarSesion) {

    btnCerrarSesion.addEventListener(
        "click",
        function () {

            cerrarSesion();

        }
    );

}

/* =========================================================
   MENSAJE DE DEPURACIÓN
   ========================================================= */

console.log(
    "FLOW: main.js inicializado correctamente."
);