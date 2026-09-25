/* =========================================================
   MENÚ DE PERFIL (AVATAR ESQUINA SUPERIOR DERECHA)
   ========================================================= */

import {
    API_URL
} from "./config.js";

import {
    normalizarImagen
} from "../utils/normalizarImagen.js";

import {
    confirmarEliminacion,
    avisoDialog
} from "../services/confirmDialog.js";

import {
    getUsuarioActual,
    headerUsuario
} from "../services/auth.service.js";


export function initProfileMenu() {

    const usuario =
        getUsuarioActual();

    if (!usuario) {
        return;
    }


    const boton =
        document.querySelector(
            "#btn-perfil"
        );

    const panel =
        document.querySelector(
            "#profile-menu-panel"
        );

    const dialogo =
        document.querySelector(
            "#profile-info-dialog"
        );

    if (
        !boton ||
        !panel ||
        !dialogo
    ) {

        console.warn(
            "No se encontró el menú de perfil."
        );

        return;

    }


    const btnAbrirPerfil =
        document.querySelector(
            "#btn-abrir-perfil"
        );

    const btnCerrarPerfil =
        document.querySelector(
            "#btn-cerrar-perfil"
        );

    const inputFoto =
        document.querySelector(
            "#perfil-foto-input"
        );

    const btnQuitarFoto =
        document.querySelector(
            "#btn-quitar-foto"
        );

    const avatarImgHeader =
        document.querySelector(
            "#perfil-avatar-img"
        );

    const avatarInicialesHeader =
        document.querySelector(
            "#perfil-avatar-iniciales"
        );

    const avatarImgDialogo =
        document.querySelector(
            "#perfil-info-avatar-img"
        );

    const avatarInicialesDialogo =
        document.querySelector(
            "#perfil-info-avatar-iniciales"
        );


    /* =====================================================
       AVATAR (FOTO O INICIALES)
       ===================================================== */

    function iniciales(nombre) {

        if (!nombre) return "?";

        return nombre
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((parte) => parte[0].toUpperCase())
            .join("");

    }

    /*
     * El servidor responde la foto con ETag, así que el navegador
     * la guarda en caché y solo la vuelve a descargar si cambió.
     * La versión solo cambia al subir una foto nueva, para que el
     * <img> se refresque al instante (antes era Date.now() en cada
     * pintado, que obligaba a descargarla siempre).
     */
    let versionFoto =
        0;

    function urlFoto() {

        return versionFoto
            ? `${API_URL}/usuarios/${usuario.id}/foto?v=${versionFoto}`
            : `${API_URL}/usuarios/${usuario.id}/foto`;

    }

    function pintarAvatar() {

        const tieneFoto =
            Boolean(usuario.tieneFoto);

        [
            { img: avatarImgHeader, span: avatarInicialesHeader },
            { img: avatarImgDialogo, span: avatarInicialesDialogo }
        ].forEach(({ img, span }) => {

            if (!img || !span) return;

            if (tieneFoto) {

                img.src = urlFoto();
                img.hidden = false;
                span.hidden = true;

            } else {

                img.hidden = true;
                span.hidden = false;
                span.textContent = iniciales(usuario.nombre);

            }

        });

    }

    pintarAvatar();


    /* =====================================================
       ABRIR / CERRAR EL DROPDOWN
       ===================================================== */

    function abrirPanel() {

        panel.hidden = false;

        boton.setAttribute(
            "aria-expanded",
            "true"
        );

    }

    function cerrarPanel() {

        panel.hidden = true;

        boton.setAttribute(
            "aria-expanded",
            "false"
        );

    }

    boton.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            if (panel.hidden) {
                abrirPanel();
            } else {
                cerrarPanel();
            }

        }
    );

    document.addEventListener(
        "click",
        (event) => {

            if (
                !panel.hidden &&
                !event.target.closest(".profile-menu")
            ) {

                cerrarPanel();

            }

        },
        true
    );

    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Escape") {
                cerrarPanel();
            }

        }
    );


    /* =====================================================
       DIÁLOGO "INFORMACIÓN DE PERFIL"
       ===================================================== */

    async function abrirDialogoPerfil() {

        cerrarPanel();

        pintarAvatar();

        document.querySelector("#perfil-info-nombre").textContent =
            usuario.nombre || "";

        document.querySelector("#perfil-info-correo").textContent =
            usuario.correo_electronico || "";

        document.querySelector("#perfil-info-departamento").textContent =
            usuario.departamento || "";

        dialogo.showModal();

        await cargarResumenActividad();

        await cargarEstadoInnovacion();

    }

    if (btnAbrirPerfil) {

        btnAbrirPerfil.addEventListener(
            "click",
            abrirDialogoPerfil
        );

    }

    if (btnCerrarPerfil) {

        btnCerrarPerfil.addEventListener(
            "click",
            () => dialogo.close()
        );

    }

    /*
     * Los accesos rápidos usan data-view (los navega el
     * listener global de main.js): aquí solo se cierra el
     * diálogo para que no quede flotando sobre la vista nueva.
     */
    dialogo.addEventListener(
        "click",
        (event) => {

            if (event.target.matches("[data-view]")) {
                dialogo.close();
            }

        }
    );


    /* =====================================================
       RESUMEN DE ACTIVIDAD
       ===================================================== */

    async function cargarResumenActividad() {

        const elPendientes =
            document.querySelector(
                "#perfil-stat-pendientes"
            );

        const elCompletados =
            document.querySelector(
                "#perfil-stat-completados"
            );

        try {

            const response =
                await fetch(
                    `${API_URL}/compromisos`,
                    {
                        headers: headerUsuario()
                    }
                );

            const data =
                await response.json();

            if (!data.ok) return;

            const propios =
                data.compromisos.filter(
                    (compromiso) =>
                        compromiso.usuarioAsignadoId === usuario.id
                );

            const ahora =
                new Date();

            const enMesActual =
                (fecha) => {

                    if (!fecha) return false;

                    const d =
                        new Date(fecha);

                    return (
                        !Number.isNaN(d.getTime()) &&
                        d.getFullYear() === ahora.getFullYear() &&
                        d.getMonth() === ahora.getMonth()
                    );

                };

            const completados =
                propios.filter(
                    (compromiso) =>
                        compromiso.estado === "completado" &&
                        enMesActual(
                            compromiso.fechaCompletado ||
                            compromiso.fechaLimite
                        )
                ).length;

            const pendientes =
                propios.filter(
                    (compromiso) =>
                        compromiso.estado !== "completado" &&
                        enMesActual(
                            compromiso.fechaLimite
                        )
                ).length;

            if (elPendientes) elPendientes.textContent = String(pendientes);
            if (elCompletados) elCompletados.textContent = String(completados);

        }
        catch (error) {

            console.error(
                "No fue posible obtener el resumen de actividad:",
                error
            );

        }

    }


    /* =====================================================
       INNOVACIÓN DEL MES (SOLO OPERADORES)
       ---------------------------------------------------------
       0%  -> no se ha subido la innovación del área este mes
       95% -> ya se subió, falta el visto bueno del líder
       100% -> el líder ya dio el visto bueno
       ===================================================== */

    function diasRestantesDelMes() {

        const hoy =
            new Date();

        const ultimoDiaDelMes =
            new Date(
                hoy.getFullYear(),
                hoy.getMonth() + 1,
                0
            ).getDate();

        return ultimoDiaDelMes - hoy.getDate();

    }


    async function cargarEstadoInnovacion() {

        const contenedor =
            document.querySelector("#perfil-innovacion");

        if (!contenedor) return;

        if (usuario.rol !== "operador") {

            contenedor.hidden = true;

            return;

        }

        contenedor.hidden = false;

        const barra =
            document.querySelector("#perfil-innovacion-bar");

        const texto =
            document.querySelector("#perfil-innovacion-texto");

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

            if (!data.ok) return;

            if (barra) barra.style.width = `${data.estado}%`;

            if (texto) {

                if (data.estado === 0) {

                    texto.textContent =
                        "0% — aún no se sube la innovación de este mes.";

                } else if (data.estado === 95) {

                    texto.textContent =
                        "95% — subida, en espera del visto bueno del líder.";

                } else {

                    texto.textContent =
                        "100% — aprobada por el líder.";

                }

            }

            contenedor.classList.toggle(
                "profile-info__innovacion--urgente",
                data.estado !== 100 &&
                diasRestantesDelMes() <= 10
            );

        }
        catch (error) {

            console.error(
                "No fue posible obtener el estado de la innovación del mes:",
                error
            );

        }

    }


    /* =====================================================
       SUBIR / QUITAR FOTO DE PERFIL
       ===================================================== */

    if (inputFoto) {

        inputFoto.addEventListener(
            "change",
            async () => {

                const archivo =
                    inputFoto.files[0];

                if (!archivo) return;

                try {

                    /*
                     * Cuadrada de 256 px: se muestra como avatar
                     * pequeño en toda la app, no hace falta más.
                     */
                    const foto =
                        await normalizarImagen(
                            archivo,
                            {
                                tamanoMaximo:
                                    256,

                                cuadrado:
                                    true
                            }
                        );

                    const formData =
                        new FormData();

                    formData.append(
                        "foto",
                        foto
                    );

                    const response =
                        await fetch(
                            `${API_URL}/usuarios/${usuario.id}/foto`,
                            {
                                method: "POST",
                                headers: headerUsuario(),
                                body: formData
                            }
                        );

                    const data =
                        await response.json();

                    if (!data.ok) {

                        avisoDialog(
                            data.mensaje ||
                            "No fue posible subir la foto."
                        );

                        return;

                    }

                    usuario.tieneFoto = true;

                    versionFoto =
                        Date.now();

                    sessionStorage.setItem(
                        "flow.usuario",
                        JSON.stringify(usuario)
                    );

                    pintarAvatar();

                }
                catch (error) {

                    console.error(
                        "Error al subir la foto de perfil:",
                        error
                    );

                    avisoDialog(
                        error.message ||
                        "No fue posible subir la foto."
                    );

                }
                finally {

                    inputFoto.value = "";

                }

            }
        );

    }

    if (btnQuitarFoto) {

        btnQuitarFoto.addEventListener(
            "click",
            async () => {

                const confirmado =
                    await confirmarEliminacion(
                        "¿Eliminar tu foto de perfil?"
                    );

                if (!confirmado) return;

                try {

                    const response =
                        await fetch(
                            `${API_URL}/usuarios/${usuario.id}/foto`,
                            {
                                method: "DELETE",
                                headers: headerUsuario()
                            }
                        );

                    const data =
                        await response.json();

                    if (!data.ok) return;

                    usuario.tieneFoto = false;

                    sessionStorage.setItem(
                        "flow.usuario",
                        JSON.stringify(usuario)
                    );

                    pintarAvatar();

                }
                catch (error) {

                    console.error(
                        "Error al quitar la foto de perfil:",
                        error
                    );

                }

            }
        );

    }

}
