/* =========================================================
   FICHA DE AVATAR DE USUARIO
   ---------------------------------------------------------
   Genera el elemento visual (foto de perfil o iniciales)
   usado tanto en el encabezado de la reunión activa como en
   la lista de participantes al programarla.
   ========================================================= */

import {
    API_URL
} from "../components/config.js";


/* =========================================================
   PALETA DE COLORES PARA INICIALES
   ========================================================= */

const PALETA_AVATAR = [
    "#e57373",
    "#f06292",
    "#ba68c8",
    "#9575cd",
    "#7986cb",
    "#4fc3f7",
    "#4dd0e1",
    "#4db6ac",
    "#81c784",
    "#aed581",
    "#ffb74d",
    "#ff8a65"
];


/* =========================================================
   INICIALES A PARTIR DE UN NOMBRE
   ========================================================= */

export function obtenerIniciales(
    nombre
) {

    if (!nombre) {

        return "?";

    }


    return nombre
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(
            parte =>
                parte[0].toUpperCase()
        )
        .join("");

}


/* =========================================================
   COLOR DETERMINISTA A PARTIR DEL NOMBRE
   ---------------------------------------------------------
   El mismo nombre siempre produce el mismo color, para que
   cada persona sea reconocible aunque no tenga foto.
   ========================================================= */

export function obtenerColorAvatar(
    nombre
) {

    const texto =
        nombre ||
        "";


    let hash =
        0;


    for (
        let i = 0;
        i < texto.length;
        i++
    ) {

        hash =
            texto.charCodeAt(i) +
            ((hash << 5) - hash);

    }


    const indice =
        Math.abs(hash) %
        PALETA_AVATAR.length;


    return PALETA_AVATAR[indice];

}


/* =========================================================
   CREAR FICHA DE AVATAR (FOTO O INICIALES)
   ---------------------------------------------------------
   participante: { id, nombre, tieneFoto }
   ========================================================= */

export function crearFichaAvatar({
    id,
    nombre,
    tieneFoto,
    className = ""
} = {}) {

    const ficha =
        document.createElement(
            "span"
        );


    ficha.className =
        `avatar-ficha ${className}`.trim();


    ficha.title =
        nombre ||
        "";


    function mostrarIniciales() {

        ficha.classList.add(
            "avatar-ficha--iniciales"
        );

        ficha.style.backgroundColor =
            obtenerColorAvatar(
                nombre
            );

        ficha.textContent =
            obtenerIniciales(
                nombre
            );

    }


    if (
        tieneFoto &&
        id
    ) {

        const img =
            document.createElement(
                "img"
            );


        img.className =
            "avatar-ficha__img";


        img.src =
            `${API_URL}/usuarios/${id}/foto`;


        img.alt =
            nombre ||
            "";


        img.loading =
            "lazy";


        /*
         * Si la foto no carga (por ejemplo,
         * se borró después de armar la lista),
         * caemos de vuelta a las iniciales.
         */

        img.onerror =
            () => {

                img.remove();

                mostrarIniciales();

            };


        ficha.appendChild(
            img
        );

    }
    else {

        mostrarIniciales();

    }


    return ficha;

}


/* =========================================================
   CREAR GRUPO DE FICHAS SUPERPUESTAS
   ---------------------------------------------------------
   Usado en el encabezado de la reunión: muestra hasta
   "maxVisibles" fichas y agrupa el resto en un "+N".
   ========================================================= */

export function crearGrupoAvatares(
    participantes,
    maxVisibles = 6,
    claseFicha = ""
) {

    const grupo =
        document.createElement(
            "div"
        );


    grupo.className =
        "avatar-group";


    const lista =
        Array.isArray(participantes)
            ? participantes
            : [];


    if (lista.length === 0) {

        return grupo;

    }


    const visibles =
        lista.slice(
            0,
            maxVisibles
        );


    const restantes =
        lista.length -
        visibles.length;


    visibles.forEach(
        participante => {

            grupo.appendChild(
                crearFichaAvatar({

                    ...participante,

                    className:
                        claseFicha

                })
            );

        }
    );


    if (restantes > 0) {

        const extra =
            document.createElement(
                "span"
            );


        extra.className =
            `avatar-ficha avatar-group__overflow ${claseFicha}`.trim();


        extra.title =
            lista
                .slice(maxVisibles)
                .map(
                    participante =>
                        participante.nombre
                )
                .join(", ");


        extra.textContent =
            `+${restantes}`;


        grupo.appendChild(
            extra
        );

    }


    return grupo;

}
