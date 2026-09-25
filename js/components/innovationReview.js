/* =========================================================
   REVISIÓN DE LA INNOVACIÓN DEL MES (SOLO LÍDER)
   ---------------------------------------------------------
   Dentro de la pestaña "Innovaciones del mes", agrega arriba
   de las tarjetas un visor de solo lectura de la innovación de
   este mes para el área del líder, con un botón para darle el
   visto bueno. Para el resto de los roles queda oculto.
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    getUsuarioActual,
    headerUsuario
} from "../services/auth.service.js";

import {
    confirmDialog,
    avisoDialog
} from "../services/confirmDialog.js";

import {
    pintarInnovacionEnElementos
} from "../utils/innovacionRender.js";


export function initInnovationReview() {

    const seccion =
        document.querySelector("#innovacion-review");

    const pendiente =
        document.querySelector("#innovacion-review-pendiente");

    const visor =
        document.querySelector("#innovacion-review-visor");

    const badge =
        document.querySelector("#innovacion-review-badge");

    const btnAprobar =
        document.querySelector("#btn-dar-visto-bueno");


    if (!seccion) {

        console.warn(
            "No se encontró #innovacion-review"
        );

        return {
            render: () => {}
        };

    }


    const elementos = {

        nombre:
            document.querySelector("#innovacion-review-nombre"),

        area:
            document.querySelector("#innovacion-review-area"),

        responsable:
            document.querySelector("#innovacion-review-responsable"),

        fecha:
            document.querySelector("#innovacion-review-fecha"),

        actividad:
            document.querySelector("#innovacion-review-actividad"),

        servicio:
            document.querySelector("#innovacion-review-servicio"),

        problematica:
            document.querySelector("#innovacion-review-problematica"),

        objetivo:
            document.querySelector("#innovacion-review-objetivo"),

        estrategia:
            document.querySelector("#innovacion-review-estrategia"),

        debilidad:
            document.querySelector("#innovacion-review-debilidad"),

        acciones:
            document.querySelector("#innovacion-review-acciones"),

        justificacion:
            document.querySelector("#innovacion-review-justificacion"),

        vpnContenedor:
            document.querySelector("#innovacion-review-vpn"),

        sinVpn:
            document.querySelector("#innovacion-review-sin-vpn"),

        vpnValores: {

            inversionTotal:
                document.querySelector("#innovacion-review-vpn-inversion"),

            costosTotal:
                document.querySelector("#innovacion-review-vpn-costos"),

            beneficiosTotal:
                document.querySelector("#innovacion-review-vpn-beneficios"),

            flujoNeto:
                document.querySelector("#innovacion-review-vpn-flujo"),

            resultado:
                document.querySelector("#innovacion-review-vpn-resultado")

        },

        archivosContenedor:
            document.querySelector("#innovacion-review-archivos")

    };


    /* =====================================================
       RENDER
       ===================================================== */

    async function render() {

        const usuario =
            getUsuarioActual();

        const esLider =
            usuario?.rol === "lider";

        seccion.hidden = !esLider;

        if (!esLider) return;

        try {

            const response =
                await fetch(
                    `${API_URL}/innovaciones/estado-mes`,
                    {
                        headers: headerUsuario()
                    }
                );

            const data =
                await response.json();

            if (!data.ok) {

                throw new Error(
                    data.mensaje ||
                    "No fue posible obtener el estado de la innovación del mes."
                );

            }

            if (!data.innovacionId) {

                pendiente.hidden = false;
                visor.hidden = true;

                return;

            }

            pendiente.hidden = true;
            visor.hidden = false;

            const detalleResponse =
                await fetch(
                    `${API_URL}/innovaciones/${data.innovacionId}`
                );

            const detalleData =
                await detalleResponse.json();

            if (!detalleData.ok) {

                throw new Error(
                    detalleData.mensaje ||
                    "No fue posible obtener la innovación."
                );

            }

            pintarInnovacionEnElementos(
                elementos,
                detalleData.innovacion
            );

            const aprobada =
                data.estado === 100;

            badge.hidden = !aprobada;
            btnAprobar.hidden = aprobada;
            btnAprobar.dataset.id = data.innovacionId;

        }
        catch (error) {

            console.error(
                "ERROR AL CARGAR LA REVISIÓN DE INNOVACIÓN:",
                error
            );

            pendiente.hidden = false;
            visor.hidden = true;

        }

    }


    /* =====================================================
       DAR VISTO BUENO
       ===================================================== */

    if (btnAprobar) {

        btnAprobar.addEventListener(
            "click",
            async () => {

                const innovacionId =
                    btnAprobar.dataset.id;

                if (!innovacionId) return;

                const confirmado =
                    await confirmDialog(
                        "¿Dar visto bueno a esta innovación? Pasará al 100% en el perfil de todos los operadores de tu área.",
                        {
                            acceptLabel: "Dar visto bueno",
                            cancelLabel: "Cancelar"
                        }
                    );

                if (!confirmado) return;

                try {

                    const response =
                        await fetch(
                            `${API_URL}/innovaciones/${innovacionId}/aprobar`,
                            {
                                method: "POST",
                                headers: headerUsuario()
                            }
                        );

                    const data =
                        await response.json();

                    if (!data.ok) {

                        throw new Error(
                            data.mensaje ||
                            "No fue posible dar el visto bueno."
                        );

                    }

                    await render();

                }
                catch (error) {

                    console.error(
                        "ERROR AL DAR VISTO BUENO:",
                        error
                    );

                    avisoDialog(
                        error.message ||
                        "No fue posible dar el visto bueno."
                    );

                }

            }
        );

    }


    return {
        render
    };

}
