/* =========================================================
   RENDER COMPARTIDO DE UNA INNOVACIÓN
   ---------------------------------------------------------
   Usado tanto por el visor de detalle (innovationDetail.js)
   como por la revisión del líder (innovationReview.js), que
   muestran los mismos campos en dos vistas distintas.
   ========================================================= */

import {
    API_URL
} from "../components/config.js";


export function formatearFechaInnovacion(fechaISO) {

    if (!fechaISO) return "";

    const d = new Date(fechaISO);

    if (Number.isNaN(d.getTime())) return "";

    return d.toLocaleDateString("es-MX");

}


export function formatearMonedaInnovacion(valor) {

    const numero =
        Number(valor);

    if (Number.isNaN(numero)) return "-";

    return numero.toLocaleString(
        "es-MX",
        {
            style: "currency",
            currency: "MXN"
        }
    );

}


/*
 * "elementos" son los nodos del DOM ya resueltos por quien
 * llama (cada vista tiene sus propios ids), en este orden:
 * nombre, area, responsable, fecha, actividad, servicio,
 * problematica, objetivo, estrategia, debilidad, acciones,
 * justificacion, vpnContenedor, sinVpn, vpnValores (objeto con
 * inversionTotal/costosTotal/beneficiosTotal/flujoNeto/
 * resultado), archivosContenedor.
 */
export function pintarInnovacionEnElementos(elementos, innovacion) {

    elementos.nombre.textContent =
        innovacion.nombreInnovacion || "";

    elementos.area.textContent =
        innovacion.areaNombre || "";

    elementos.responsable.textContent =
        innovacion.responsableNombre || "";

    elementos.fecha.textContent =
        formatearFechaInnovacion(innovacion.fechaCreacion);

    elementos.actividad.textContent =
        innovacion.actividadImpacta || "";

    elementos.servicio.textContent =
        innovacion.servicioRelacionado || "";

    elementos.problematica.textContent =
        innovacion.problematica || "";

    elementos.objetivo.textContent =
        innovacion.objetivo || "";

    elementos.estrategia.textContent =
        innovacion.estrategia || "";

    elementos.debilidad.textContent =
        innovacion.debilidad || "";

    elementos.acciones.innerHTML = "";

    (innovacion.acciones || []).forEach(
        (texto) => {

            const li =
                document.createElement("li");

            li.textContent = texto;

            elementos.acciones.appendChild(li);

        }
    );

    elementos.justificacion.textContent =
        innovacion.justificacionValuacion || "";


    if (!innovacion.vpn) {

        elementos.vpnContenedor.hidden = true;
        elementos.sinVpn.hidden = false;

    } else {

        elementos.vpnContenedor.hidden = false;
        elementos.sinVpn.hidden = true;

        elementos.vpnValores.inversionTotal.textContent =
            formatearMonedaInnovacion(innovacion.vpn.inversion_total);

        elementos.vpnValores.costosTotal.textContent =
            formatearMonedaInnovacion(innovacion.vpn.costos_total);

        elementos.vpnValores.beneficiosTotal.textContent =
            formatearMonedaInnovacion(innovacion.vpn.beneficios_total);

        elementos.vpnValores.flujoNeto.textContent =
            formatearMonedaInnovacion(innovacion.vpn.flujo_neto_mensual);

        elementos.vpnValores.resultado.textContent =
            formatearMonedaInnovacion(innovacion.vpn.resultado_vpn);

    }


    elementos.archivosContenedor.innerHTML = "";

    if (
        !innovacion.archivos ||
        innovacion.archivos.length === 0
    ) {

        elementos.archivosContenedor.innerHTML =
            `<span class="innovation-card__no-files">Sin archivos adjuntos</span>`;

    } else {

        innovacion.archivos.forEach(
            (archivo) => {

                const link =
                    document.createElement("a");

                link.classList.add("innovation-card__file");
                link.href = `${API_URL}/innovaciones/archivos/${archivo.id}`;
                link.target = "_blank";
                link.rel = "noopener";
                link.textContent = `📎 ${archivo.nombreOriginal}`;

                elementos.archivosContenedor.appendChild(link);

            }
        );

    }

}
