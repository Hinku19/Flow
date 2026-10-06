import { esAdmin } from "../services/auth.service.js";
import { avisoDialog } from "../services/confirmDialog.js";

/* =========================================================
   MENÚ DE CONFIGURACIÓN (TUERCA)
   ========================================================= */

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

            if (!esAdmin()) {
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


    panel.addEventListener(
        "click",
        (event) => {

            if (
                event.target.matches(
                    ".settings-menu__item"
                )
            ) {

                cerrar();

            }

        }
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
