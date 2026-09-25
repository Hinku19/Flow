/* =========================================================
   DETALLE DE INNOVACIÓN (VISOR)
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    showView
} from "../services/viewManager.js";

import {
    pintarInnovacionEnElementos
} from "../utils/innovacionRender.js";

import {
    avisoDialog
} from "../services/confirmDialog.js";


export function initInnovationDetail() {

    const nombre =
        document.querySelector("#innovacion-detalle-nombre");

    if (!nombre) {

        console.warn(
            "No se encontró #innovacion-detalle-nombre"
        );

        return {
            abrir: () => {}
        };

    }


    const elementos = {

        nombre,

        area:
            document.querySelector("#innovacion-detalle-area"),

        responsable:
            document.querySelector("#innovacion-detalle-responsable"),

        fecha:
            document.querySelector("#innovacion-detalle-fecha"),

        actividad:
            document.querySelector("#innovacion-detalle-actividad"),

        servicio:
            document.querySelector("#innovacion-detalle-servicio"),

        problematica:
            document.querySelector("#innovacion-detalle-problematica"),

        objetivo:
            document.querySelector("#innovacion-detalle-objetivo"),

        estrategia:
            document.querySelector("#innovacion-detalle-estrategia"),

        debilidad:
            document.querySelector("#innovacion-detalle-debilidad"),

        acciones:
            document.querySelector("#innovacion-detalle-acciones"),

        justificacion:
            document.querySelector("#innovacion-detalle-justificacion"),

        vpnContenedor:
            document.querySelector("#innovacion-detalle-vpn"),

        sinVpn:
            document.querySelector("#innovacion-detalle-sin-vpn"),

        vpnValores: {

            inversionTotal:
                document.querySelector("#vpn-inversion-total"),

            costosTotal:
                document.querySelector("#vpn-costos-total"),

            beneficiosTotal:
                document.querySelector("#vpn-beneficios-total"),

            flujoNeto:
                document.querySelector("#vpn-flujo-neto"),

            resultado:
                document.querySelector("#vpn-resultado")

        },

        archivosContenedor:
            document.querySelector("#innovacion-detalle-archivos")

    };


    const btnImprimir =
        document.querySelector("#btn-imprimir-innovacion");


    /* =====================================================
       ABRIR
       ===================================================== */

    async function abrir(innovacionId) {

        try {

            const response =
                await fetch(
                    `${API_URL}/innovaciones/${innovacionId}`
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.mensaje ||
                    data.error ||
                    "No fue posible obtener la innovación."
                );

            }

            pintarInnovacionEnElementos(
                elementos,
                data.innovacion
            );

            showView("innovacionDetalle");

        }
        catch (error) {

            console.error(
                "ERROR AL ABRIR DETALLE DE INNOVACIÓN:",
                error
            );

            avisoDialog(
                error.message ||
                "No fue posible abrir la innovación."
            );

        }

    }


    /* =====================================================
       IMPRIMIR
       ===================================================== */

    if (btnImprimir) {

        btnImprimir.addEventListener(
            "click",
            () => {

                window.print();

            }
        );

    }


    return {
        abrir
    };

}
