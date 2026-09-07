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

    innovaciones:
        document.querySelector("#vista-innovaciones"),

    archivo:
        document.querySelector("#vista-archivo")

};


/**
 * Muestra una vista y oculta todas las demás.
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
 * innovaciones
 * archivo
 */
export function showView(nombre) {

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