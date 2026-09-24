/* =========================================================
   STORAGE SERVICE
   ========================================================= */
import {
    API_URL
} from "../components/config.js";

import {
    headerUsuario
} from "./auth.service.js";


/*
 * Caché de datos cargados desde MySQL.
 *
 * Ejemplo:
 *
 * flow.reunion.15.objetivos
 *
 */

const databaseCache =
    new Map();


/* =========================================================
   IDENTIFICAR SECCIÓN DE REUNIÓN
   ========================================================= */

function obtenerInfoSeccion(
    key
) {

    const match =
        /^flow\.reunion\.(\d+)\.([a-zA-Z0-9_-]+)$/
            .exec(
                key
            );


    if (!match) {

        return null;

    }


    const reunionId =
        Number(
            match[1]
        );


    const seccion =
        match[2];


    /*
     * "meta" todavía se maneja
     * localmente durante la migración.
     */

    if (
        seccion ===
        "meta"
    ) {

        return null;

    }


    return {

        reunionId:
            reunionId,

        seccion:
            seccion

    };

}


/* =========================================================
   CARGAR SECCIONES DESDE MYSQL
   ========================================================= */

export async function cargarSeccionesDesdeBD(
    reunionId
) {

    if (!reunionId) {

        return;

    }


    const response =
        await fetch(
            `${API_URL}/reuniones/${reunionId}/secciones`,
            {

                headers:
                    headerUsuario()

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.mensaje ||
            "No fue posible cargar las secciones."
        );

    }


    /*
     * Prefijo de la reunión actual.
     */

    const prefijo =
        `flow.reunion.${reunionId}.`;


    /*
     * Limpiar caché anterior
     * de esta reunión.
     */

    Array.from(
        databaseCache.keys()
    )
        .filter(
            key =>
                key.startsWith(
                    prefijo
                )
        )
        .forEach(
            key =>
                databaseCache.delete(
                    key
                )
        );


    /*
     * Cargar las secciones
     * provenientes de MySQL.
     */

    (
        data.secciones ||
        []
    ).forEach(
        seccion => {

            const key =
                `${prefijo}${seccion.Seccion}`;


            databaseCache.set(
                key,
                seccion.Contenido
            );


            /*
             * Respaldo temporal
             * en localStorage.
             */

            try {

                localStorage.setItem(
                    key,
                    JSON.stringify(
                        seccion.Contenido
                    )
                );

            }
            catch (error) {

                console.error(
                    `No se pudo respaldar "${key}" en localStorage:`,
                    error
                );

            }

        }
    );


    console.log(
        `Secciones cargadas desde MySQL para reunión ${reunionId}`
    );

}


/* =========================================================
   OBTENER DATOS
   ========================================================= */

export function loadData(
    key,
    fallback = []
) {

    /*
     * 1. Buscar primero en caché.
     */

    if (
        databaseCache.has(
            key
        )
    ) {

        return databaseCache.get(
            key
        );

    }


    /*
     * 2. Si todavía no está en caché,
     * intentar localStorage.
     */

    try {

        const raw =
            localStorage.getItem(
                key
            );


        if (!raw) {

            return fallback;

        }


        const data =
            JSON.parse(
                raw
            );


        /*
         * Guardar también en caché.
         */

        databaseCache.set(
            key,
            data
        );


        return data;

    }
    catch (error) {

        console.error(
            `No se pudo leer "${key}" del almacenamiento:`,
            error
        );


        return fallback;

    }

}


/* =========================================================
   GUARDAR DATOS
   ========================================================= */

export function saveData(
    key,
    data
) {

    /*
     * 1. Guardar inmediatamente
     * en caché.
     */

    databaseCache.set(
        key,
        data
    );


    /*
     * 2. Mantener localStorage
     * temporalmente como respaldo.
     */

    try {

        localStorage.setItem(
            key,
            JSON.stringify(
                data
            )
        );

    }
    catch (error) {

        console.error(
            `No se pudo guardar "${key}" en localStorage:`,
            error
        );

    }


    /*
     * 3. Determinar si es una
     * sección de reunión.
     */

    const info =
        obtenerInfoSeccion(
            key
        );


    if (!info) {

        return;

    }


    /*
     * 4. Sincronizar con MySQL.
     *
     * No usamos await aquí porque
     * saveData() sigue siendo síncrona
     * para no romper los componentes
     * existentes.
     */

    guardarSeccionBD(
        info.reunionId,
        info.seccion,
        data
    )
        .catch(
            error => {

                console.error(
                    `No se pudo sincronizar la sección "${info.seccion}" con MySQL:`,
                    error
                );

            }
        );

}


/* =========================================================
   GUARDAR SECCIÓN EN MYSQL
   ========================================================= */

async function guardarSeccionBD(
    reunionId,
    seccion,
    contenido
) {

    const response =
        await fetch(
            `${API_URL}/reuniones/${reunionId}/secciones/${encodeURIComponent(
                seccion
            )}`,
            {

                method:
                    "PUT",

                headers: {

                    "Content-Type":
                        "application/json",

                    ...headerUsuario()

                },

                body:
                    JSON.stringify({

                        contenido:
                            contenido

                    })

            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.mensaje ||
            data.error ||
            "No fue posible guardar la sección."
        );

    }


    return data;

}


/* =========================================================
   LIMPIAR CACHÉ DE UNA REUNIÓN
   ========================================================= */

export function limpiarCacheReunion(
    reunionId
) {

    const prefijo =
        `flow.reunion.${reunionId}.`;


    Array.from(
        databaseCache.keys()
    )
        .filter(
            key =>
                key.startsWith(
                    prefijo
                )
        )
        .forEach(
            key =>
                databaseCache.delete(
                    key
                )
        );

}