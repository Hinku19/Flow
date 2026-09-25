const vistas = {

    dashboard:
        document.querySelector("#vista-dashboard"),

    historial:
        document.querySelector("#vista-historial"),

    usuarios:
        document.querySelector("#vista-usuarios"),

    registroUsuario:
        document.querySelector("#vista-registro-usuario"),

    editarUsuario:
        document.querySelector("#vista-editar-usuario"),

    reunion:
        document.querySelector("#vista-reunion"),

    compromisos:
        document.querySelector("#vista-compromisos"),

    actividades:
        document.querySelector("#vista-actividades"),

    innovaciones:
        document.querySelector("#vista-innovaciones"),

    evaluaciones:
        document.querySelector("#vista-evaluaciones"),

    archivo:
        document.querySelector("#vista-archivo"),

    archivos:
        document.querySelector("#vista-archivos"),

    innovacionDetalle:
        document.querySelector("#vista-innovacion-detalle")

};


/*
 * Solo estas vistas generan una entrada en el historial del
 * navegador (para que Atrás/Adelante funcionen). Los pasos
 * intermedios de un formulario (registroUsuario, editarUsuario)
 * quedan fuera a propósito, para no complicar ese flujo.
 */
const VISTAS_CON_HISTORIAL = [
    "dashboard",
    "historial",
    "usuarios",
    "reunion",
    "compromisos",
    "actividades",
    "innovaciones",
    "evaluaciones",
    "archivo",
    "archivos",
    "innovacionDetalle"
];


/*
 * Se pone en true mientras un popstate (Atrás/Adelante) está
 * aplicando el cambio de vista, para no volver a empujar esa
 * misma vista al historial (eso crearía un ciclo).
 */
let sincronizandoConHistorial = false;


/**
 * Muestra una vista y oculta todas las demás, sin tocar el
 * historial del navegador. Uso interno (popstate) y de
 * showView() más abajo.
 */
function aplicarVista(nombre) {

    for (const clave in vistas) {

        const vista = vistas[clave];

        if (!vista) {
            continue;
        }

        vista.classList.toggle(
            "view--hidden",
            clave !== nombre
        );

    }

}


/**
 * Muestra una vista y oculta todas las demás. Además, si es
 * una de las vistas principales, registra el cambio en el
 * historial del navegador (pushState la primera vez que se
 * entra a esa vista, replaceState si es la primerísima vista
 * de la sesión).
 *
 * Vistas disponibles:
 *
 * dashboard
 * historial
 * usuarios
 * registroUsuario
 * editarUsuario
 * reunion
 * compromisos
 * actividades
 * innovaciones
 * evaluaciones
 * archivo
 * archivos
 * innovacionDetalle
 */
export function showView(nombre) {

    aplicarVista(nombre);

    if (
        sincronizandoConHistorial ||
        !VISTAS_CON_HISTORIAL.includes(nombre)
    ) {

        return;

    }

    if (!history.state) {

        history.replaceState(
            { flowView: nombre },
            ""
        );

    }
    else if (history.state.flowView !== nombre) {

        history.pushState(
            { flowView: nombre },
            ""
        );

    }

}


/**
 * Regresa el nombre de la vista actualmente visible.
 */
export function getCurrentView() {

    for (const clave in vistas) {

        const vista = vistas[clave];

        if (
            vista &&
            !vista.classList.contains(
                "view--hidden"
            )
        ) {

            return clave;

        }

    }

    return null;

}


/**
 * Conecta el botón Atrás/Adelante del navegador con las
 * vistas principales de la app. onPopState recibe el nombre
 * de la vista de destino (o null si ya no queda historial
 * propio de la app) y decide qué hacer — puede llamar a
 * aplicarVistaDesdeHistorial() para aceptar el cambio, o
 * cancelarlo reafirmando la posición actual con pushState.
 */
export function initNavegacionHistorial({ onPopState }) {

    window.addEventListener(
        "popstate",
        (event) => {

            onPopState(
                event.state?.flowView || null
            );

        }
    );

}


/**
 * Aplica una vista como consecuencia de un popstate ya
 * aceptado, sin volver a empujarla al historial.
 */
export function aplicarVistaDesdeHistorial(nombre) {

    sincronizandoConHistorial = true;

    aplicarVista(nombre);

    sincronizandoConHistorial = false;

}
