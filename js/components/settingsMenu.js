import { getUsuarioActual } from "../services/auth.service.js";
import { avisoDialog } from "../services/confirmDialog.js";

/* =========================================================
   MENÚ DE ADMINISTRACIÓN (TUERCA)
   ---------------------------------------------------------
   Se abre para administrador y líder; main.js oculta las
   opciones que no le tocan a cada rol.
   ========================================================= */

const ROLES_ADMINISTRACION = [
    "administrador",
    "lider"
];

export function initSettingsMenu() {

    const boton =
        document.querySelector(
            "#btn-configuracion"
        );


    const panel =
        document.querySelector(
            "#settings-menu-panel"
        );


    if (
        !boton ||
        !panel
    ) {

        console.warn(
            "No se encontró el botón o el panel de configuración."
        );

        return;

    }


    function abrir() {

        panel.hidden =
            false;

        boton.setAttribute(
            "aria-expanded",
            "true"
        );

    }


    function cerrar() {

        panel.hidden =
            true;

        boton.setAttribute(
            "aria-expanded",
            "false"
        );

    }


    boton.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            if (
                !ROLES_ADMINISTRACION.includes(
                    getUsuarioActual()?.rol
                )
            ) {
                cerrar();
                avisoDialog(
                    "Su usuario no cuenta con el tipo de Rol necesario para acceder a esta opción."
                );
                return;
            }

            if (panel.hidden) {
                abrir();
            } else {
                cerrar();
            }

        }
    );


    /*
     * En captura: las opciones son botones con data-view, que
     * detienen la propagación en burbuja y el panel nunca se
     * enteraría del clic.
     */

    panel.addEventListener(
        "click",
        (event) => {

            if (
                event.target.closest(
                    ".settings-menu__item"
                )
            ) {

                cerrar();

            }

        },
        true
    );


    /*
     * Fase de captura: muchos botones de la app (tarjetas del
     * dashboard, botones con data-view) llaman a
     * event.stopPropagation() en la fase de burbuja, lo que
     * impediría que un listener normal en document se entere
     * del clic. La captura ocurre antes, de document hacia
     * el elemento, así que no se ve afectada por eso.
     */

    document.addEventListener(
        "click",
        (event) => {

            if (
                !panel.hidden &&
                !event.target.closest(
                    ".settings-menu"
                )
            ) {

                cerrar();

            }

        },
        true
    );


    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Escape") {
                cerrar();
            }

        }
    );

}
