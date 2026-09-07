/* =========================================================
   AUTENTICACIÓN FLOW
   ========================================================= */

const USER_KEY = "flow.usuario";


/* =========================================================
   OBTENER USUARIO ACTUAL
   ========================================================= */

export function getUsuarioActual() {

    const usuario =
        sessionStorage.getItem(USER_KEY);

    if (!usuario) {
        return null;
    }

    try {

        return JSON.parse(usuario);

    }
    catch (error) {

        console.error(
            "Error al leer la sesión:",
            error
        );

        sessionStorage.removeItem(USER_KEY);

        return null;

    }

}


/* =========================================================
   VALIDAR SESIÓN
   ========================================================= */

export function usuarioAutenticado() {

    return getUsuarioActual() !== null;

}


/* =========================================================
   ROL DEL USUARIO ACTUAL
   ========================================================= */

export function esAdmin() {

    return getUsuarioActual()?.rol === "administrador";

}


/* =========================================================
   ENCABEZADO PARA IDENTIFICARSE ANTE EL SERVIDOR
   ---------------------------------------------------------
   No hay tokens de sesión: las rutas que necesitan saber
   quién pregunta (permisos, compromisos por rol) leen este
   encabezado en vez de un Authorization real. Ver
   obtenerUsuarioSolicitante() en server.js.
   ========================================================= */

export function headerUsuario() {

    const usuario =
        getUsuarioActual();

    return usuario
        ? { "X-Usuario-Id": String(usuario.id) }
        : {};

}


/* =========================================================
   CERRAR SESIÓN
   ========================================================= */

export function cerrarSesion() {

    sessionStorage.removeItem(USER_KEY);

    window.location.href =
        "./vista-login.html";

}