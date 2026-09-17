/* =========================================================
   CATÁLOGO DE EVALUACIONES (ESCALA DE LIKERT) - BACKEND
   ---------------------------------------------------------
   Copia en CommonJS de js/components/evaluacionesCatalogo.js,
   usada solo para validar los envíos en server.js (mismo
   patrón que ROLES_VALIDOS/ROL_LABEL, duplicados a propósito
   entre frontend y backend).
   ========================================================= */

const VALORES_LIKERT_VALIDOS = [
    "totalmente_acuerdo",
    "de_acuerdo",
    "neutral",
    "en_desacuerdo",
    "totalmente_desacuerdo"
];

const PUNTAJE_LIKERT = {
    totalmente_acuerdo: 5,
    de_acuerdo: 4,
    neutral: 3,
    en_desacuerdo: 2,
    totalmente_desacuerdo: 1
};

const FORMULARIOS_EVALUACION = {

    general: {
        objetivo: "autoevaluacion",
        soloRoles: null,
        ocultarParaAreas: null,
        preguntaIds: ["general_1", "general_2", "general_3"]
    },

    otros_dptos_ti: {
        objetivo: "area_fija",
        areaObjetivo: "Tecnologías de la Información",
        soloRoles: null,
        ocultarParaAreas: ["Tecnologías de la Información"],
        preguntaIds: ["ti_1", "ti_2", "ti_3", "ti_4", "ti_5", "ti_6", "ti_7"]
    },

    lider_dpto: {
        objetivo: "lider_area",
        soloRoles: ["operador"],
        ocultarParaAreas: null,
        preguntaIds: ["lider_1", "lider_2", "lider_3", "lider_4", "lider_5", "lider_6", "lider_7"]
    },

    clima_organizacional: {
        objetivo: "sin_destinatario",
        soloRoles: null,
        ocultarParaAreas: null,
        preguntaIds: [
            "clima_1", "clima_2", "clima_3", "clima_4", "clima_5", "clima_6",
            "clima_7", "clima_8", "clima_9", "clima_10", "clima_11", "clima_12"
        ]
    },

    colaborador_colaborador: {
        objetivo: "colega_area",
        soloRoles: null,
        ocultarParaAreas: null,
        preguntaIds: [
            "colab_1", "colab_2", "colab_3", "colab_4",
            "colab_5", "colab_6", "colab_7", "colab_8", "colab_9"
        ]
    }

};

const FORMULARIOS_VALIDOS = Object.keys(FORMULARIOS_EVALUACION);


module.exports = {
    VALORES_LIKERT_VALIDOS,
    PUNTAJE_LIKERT,
    FORMULARIOS_EVALUACION,
    FORMULARIOS_VALIDOS
};
