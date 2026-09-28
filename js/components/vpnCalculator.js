/* =========================================================
   CALCULADORA DE VALOR PRESENTE NETO (VPN)
   ---------------------------------------------------------
   Reemplaza la carga del formato Excel de VPN: se capturan
   aquí los mismos datos (capital humano, inversiones, costos
   y beneficios) y se calcula el resultado con la misma
   fórmula que traía ese archivo (ver utils/calcularVPN.js).
   ========================================================= */

import {
    calcularVPN
} from "../utils/calcularVPN.js";

import {
    confirmarEliminacion
} from "../services/confirmDialog.js";

import {
    generarUUID
} from "../utils/generarUUID.js";


const MESES_PROYECCION =
    36;


const LISTAS = {

    capitalHumano: {

        columnas: [

            {
                campo: "nombre",
                etiqueta: "Colaborador",
                tipo: "text"
            },

            {
                campo: "horas",
                etiqueta: "Horas",
                tipo: "number"
            },

            {
                campo: "salarioDiario",
                etiqueta: "Salario diario",
                tipo: "number"
            }

        ],

        botonAgregar:
            "+ Colaborador"

    },

    inversiones: {

        columnas: [

            {
                campo: "concepto",
                etiqueta: "Concepto",
                tipo: "text"
            },

            {
                campo: "total",
                etiqueta: "Monto",
                tipo: "number"
            }

        ],

        botonAgregar:
            "+ Inversión"

    },

    costos: {

        columnas: [

            {
                campo: "concepto",
                etiqueta: "Concepto",
                tipo: "text"
            },

            {
                campo: "total",
                etiqueta: "Monto",
                tipo: "number"
            }

        ],

        botonAgregar:
            "+ Costo"

    },

    beneficios: {

        columnas: [

            {
                campo: "concepto",
                etiqueta: "Concepto",
                tipo: "text"
            },

            {
                campo: "total",
                etiqueta: "Monto",
                tipo: "number"
            }

        ],

        botonAgregar:
            "+ Beneficio"

    }

};


function formatoMoneda(
    valor
) {

    const numero =
        Number(
            valor
        );

    if (
        !Number.isFinite(
            numero
        )
    ) {

        return "$0.00";

    }

    return numero.toLocaleString(
        "es-MX",
        {

            style:
                "currency",

            currency:
                "MXN"

        }
    );

}


export function createVpnCalculator({
    container
}) {

    let tasaDescuentoAnual =
        "";

    const estado = {

        capitalHumano:
            [],

        inversiones:
            [],

        costos:
            [],

        beneficios:
            []

    };


    /* =====================================================
       FILAS
       ===================================================== */

    function agregarFila(
        nombreLista
    ) {

        const fila = {

            id:
                generarUUID()

        };

        LISTAS[nombreLista].columnas.forEach(
            (columna) => {

                fila[columna.campo] =
                    "";

            }
        );

        estado[nombreLista].push(
            fila
        );

        render();

    }


    function quitarFila(
        nombreLista,
        filaId
    ) {

        estado[nombreLista] =
            estado[nombreLista].filter(
                (fila) =>
                    fila.id !== filaId
            );

        render();

    }


    function actualizarCampo(
        nombreLista,
        filaId,
        campo,
        valor
    ) {

        const fila =
            estado[nombreLista].find(
                (fila) =>
                    fila.id === filaId
            );

        if (fila) {

            fila[campo] =
                valor;

        }

        actualizarResumen();

    }


    /* =====================================================
       CÁLCULO
       ===================================================== */

    function obtenerResultado() {

        return calcularVPN({

            tasaDescuentoAnual,

            mesesProyeccion:
                MESES_PROYECCION,

            capitalHumano:
                estado.capitalHumano,

            inversiones:
                estado.inversiones,

            costos:
                estado.costos,

            beneficios:
                estado.beneficios

        });

    }


    function actualizarResumen() {

        if (!resumenEl) {

            return;

        }

        const resultado =
            obtenerResultado();

        resumenEl.querySelector(
            '[data-campo="capitalHumanoTotal"]'
        ).textContent =
            formatoMoneda(
                resultado.capitalHumanoTotal
            );

        resumenEl.querySelector(
            '[data-campo="inversionesTotal"]'
        ).textContent =
            formatoMoneda(
                resultado.inversionesTotal
            );

        resumenEl.querySelector(
            '[data-campo="costosTotal"]'
        ).textContent =
            formatoMoneda(
                resultado.costosTotal
            );

        resumenEl.querySelector(
            '[data-campo="beneficiosTotal"]'
        ).textContent =
            formatoMoneda(
                resultado.beneficiosTotal
            );

        resumenEl.querySelector(
            '[data-campo="flujoNetoMensual"]'
        ).textContent =
            formatoMoneda(
                resultado.flujoNetoMensual
            );

        resumenEl.querySelector(
            '[data-campo="inversionTotal"]'
        ).textContent =
            formatoMoneda(
                resultado.inversionTotal
            );

        const resultadoEl =
            resumenEl.querySelector(
                '[data-campo="resultadoVPN"]'
            );

        resultadoEl.textContent =
            formatoMoneda(
                resultado.resultadoVPN
            );

        resultadoEl.classList.toggle(
            "vpn-calculator__resultado-valor--negativo",
            resultado.resultadoVPN < 0
        );

    }


    /* =====================================================
       CONSTRUIR DOM
       ===================================================== */

    function crearFilaInput(
        nombreLista,
        fila,
        columna
    ) {

        const input =
            document.createElement(
                "input"
            );

        input.type =
            columna.tipo;

        if (
            columna.tipo === "number"
        ) {

            input.step =
                "0.01";

            input.min =
                "0";

        }

        input.classList.add(
            "vpn-calculator__input"
        );

        input.value =
            fila[columna.campo];

        input.dataset.lista =
            nombreLista;

        input.dataset.filaId =
            fila.id;

        input.dataset.campo =
            columna.campo;

        input.setAttribute(
            "aria-label",
            columna.etiqueta
        );

        input.addEventListener(
            "input",
            () => {

                actualizarCampo(
                    nombreLista,
                    fila.id,
                    columna.campo,
                    input.value
                );

            }
        );

        return input;

    }


    function crearFila(
        nombreLista,
        fila
    ) {

        const filaEl =
            document.createElement(
                "div"
            );

        filaEl.classList.add(
            "vpn-calculator__row"
        );

        LISTAS[nombreLista].columnas.forEach(
            (columna) => {

                filaEl.appendChild(
                    crearFilaInput(
                        nombreLista,
                        fila,
                        columna
                    )
                );

            }
        );

        const quitarBtn =
            document.createElement(
                "button"
            );

        quitarBtn.type =
            "button";

        quitarBtn.classList.add(
            "vpn-calculator__delete"
        );

        quitarBtn.textContent =
            "✕";

        quitarBtn.setAttribute(
            "aria-label",
            "Quitar fila"
        );

        quitarBtn.addEventListener(
            "click",
            async () => {

                const confirmado =
                    await confirmarEliminacion(
                        "¿Eliminar esta fila? Esta acción no se puede deshacer."
                    );

                if (!confirmado) return;

                quitarFila(
                    nombreLista,
                    fila.id
                );

            }
        );

        filaEl.appendChild(
            quitarBtn
        );

        return filaEl;

    }


    function crearEncabezado(
        nombreLista
    ) {

        const encabezado =
            document.createElement(
                "div"
            );

        encabezado.classList.add(
            "vpn-calculator__row",
            "vpn-calculator__row--header"
        );

        LISTAS[nombreLista].columnas.forEach(
            (columna) => {

                const span =
                    document.createElement(
                        "span"
                    );

                span.textContent =
                    columna.etiqueta;

                encabezado.appendChild(
                    span
                );

            }
        );

        encabezado.appendChild(
            document.createElement(
                "span"
            )
        );

        return encabezado;

    }


    function crearBloqueLista(
        nombreLista,
        titulo
    ) {

        const bloque =
            document.createElement(
                "div"
            );

        bloque.classList.add(
            "vpn-calculator__block"
        );

        const tituloEl =
            document.createElement(
                "h4"
            );

        tituloEl.classList.add(
            "vpn-calculator__block-title"
        );

        tituloEl.textContent =
            titulo;

        bloque.appendChild(
            tituloEl
        );

        const tabla =
            document.createElement(
                "div"
            );

        tabla.classList.add(
            "vpn-calculator__table"
        );

        tabla.appendChild(
            crearEncabezado(
                nombreLista
            )
        );

        if (
            estado[nombreLista].length === 0
        ) {

            const vacio =
                document.createElement(
                    "p"
                );

            vacio.classList.add(
                "vpn-calculator__vacio"
            );

            vacio.textContent =
                "Sin filas capturadas.";

            tabla.appendChild(
                vacio
            );

        }
        else {

            estado[nombreLista].forEach(
                (fila) => {

                    tabla.appendChild(
                        crearFila(
                            nombreLista,
                            fila
                        )
                    );

                }
            );

        }

        bloque.appendChild(
            tabla
        );

        const agregarBtn =
            document.createElement(
                "button"
            );

        agregarBtn.type =
            "button";

        agregarBtn.classList.add(
            "vpn-calculator__add"
        );

        agregarBtn.textContent =
            LISTAS[nombreLista].botonAgregar;

        agregarBtn.addEventListener(
            "click",
            () => {

                agregarFila(
                    nombreLista
                );

            }
        );

        bloque.appendChild(
            agregarBtn
        );

        return bloque;

    }


    function crearTasaInput() {

        const grupo =
            document.createElement(
                "div"
            );

        grupo.classList.add(
            "form-group"
        );

        const label =
            document.createElement(
                "label"
            );

        label.textContent =
            "Tasa de descuento anual (%) ";

        const requerido =
            document.createElement(
                "span"
            );

        requerido.classList.add(
            "innovation-form__required"
        );

        requerido.textContent =
            "*";

        label.appendChild(
            requerido
        );

        const input =
            document.createElement(
                "input"
            );

        input.type =
            "number";

        input.step =
            "0.01";

        input.min =
            "0";

        input.required =
            true;

        input.value =
            tasaDescuentoAnual;

        input.setAttribute(
            "aria-label",
            "Tasa de descuento anual"
        );

        input.addEventListener(
            "input",
            () => {

                tasaDescuentoAnual =
                    input.value;

                actualizarResumen();

            }
        );

        tasaInputEl =
            input;

        const hint =
            document.createElement(
                "p"
            );

        hint.classList.add(
            "innovation-form__hint"
        );

        hint.textContent =
            `Proyección fija a ${MESES_PROYECCION} meses, igual que el formato de VPN.`;

        grupo.append(
            label,
            input,
            hint
        );

        return grupo;

    }


    function crearResumen() {

        const resumen =
            document.createElement(
                "div"
            );

        resumen.classList.add(
            "vpn-calculator__resumen"
        );

        const filas = [

            [
                "capitalHumanoTotal",
                "Capital Humano"
            ],

            [
                "inversionesTotal",
                "Inversiones"
            ],

            [
                "costosTotal",
                "Costos"
            ],

            [
                "beneficiosTotal",
                "Beneficios"
            ],

            [
                "flujoNetoMensual",
                "Flujo neto mensual"
            ],

            [
                "inversionTotal",
                "Inversión total"
            ]

        ];

        filas.forEach(
            ([campo, etiqueta]) => {

                const fila =
                    document.createElement(
                        "div"
                    );

                fila.classList.add(
                    "vpn-calculator__resumen-fila"
                );

                const span =
                    document.createElement(
                        "span"
                    );

                span.textContent =
                    etiqueta;

                const strong =
                    document.createElement(
                        "strong"
                    );

                strong.dataset.campo =
                    campo;

                fila.append(
                    span,
                    strong
                );

                resumen.appendChild(
                    fila
                );

            }
        );

        const resultadoFila =
            document.createElement(
                "div"
            );

        resultadoFila.classList.add(
            "vpn-calculator__resumen-fila",
            "vpn-calculator__resultado"
        );

        const resultadoLabel =
            document.createElement(
                "span"
            );

        resultadoLabel.textContent =
            "VPN resultado";

        const resultadoValor =
            document.createElement(
                "strong"
            );

        resultadoValor.dataset.campo =
            "resultadoVPN";

        resultadoValor.classList.add(
            "vpn-calculator__resultado-valor"
        );

        resultadoFila.append(
            resultadoLabel,
            resultadoValor
        );

        resumen.appendChild(
            resultadoFila
        );

        return resumen;

    }


    let resumenEl =
        null;

    let tasaInputEl =
        null;


    function render() {

        const focoLista =
            document.activeElement?.dataset?.lista;

        const focoCampo =
            document.activeElement?.dataset?.campo;

        const focoFilaId =
            document.activeElement?.dataset?.filaId;

        container.replaceChildren();

        container.appendChild(
            crearTasaInput()
        );

        container.appendChild(
            crearBloqueLista(
                "capitalHumano",
                "Capital Humano"
            )
        );

        container.appendChild(
            crearBloqueLista(
                "inversiones",
                "Inversiones"
            )
        );

        container.appendChild(
            crearBloqueLista(
                "costos",
                "Costos"
            )
        );

        container.appendChild(
            crearBloqueLista(
                "beneficios",
                "Beneficios"
            )
        );

        resumenEl =
            crearResumen();

        container.appendChild(
            resumenEl
        );

        actualizarResumen();

        if (
            focoLista &&
            focoFilaId
        ) {

            const selector =
                `[data-lista="${focoLista}"][data-fila-id="${focoFilaId}"][data-campo="${focoCampo}"]`;

            const campo =
                container.querySelector(
                    selector
                );

            if (campo) {

                campo.focus();

            }

        }

    }


    /* =====================================================
       API PÚBLICA
       ===================================================== */

    function getDatos() {

        const resultado =
            obtenerResultado();

        return {

            tasaDescuentoAnual:
                Number(tasaDescuentoAnual) ||
                0,

            mesesProyeccion:
                MESES_PROYECCION,

            capitalHumano:
                estado.capitalHumano,

            inversiones:
                estado.inversiones,

            costos:
                estado.costos,

            beneficios:
                estado.beneficios,

            ...resultado

        };

    }


    function reset() {

        tasaDescuentoAnual =
            "";

        estado.capitalHumano =
            [];

        estado.inversiones =
            [];

        estado.costos =
            [];

        estado.beneficios =
            [];

        render();

    }


    render();


    return {

        getDatos,
        reset

    };

}
