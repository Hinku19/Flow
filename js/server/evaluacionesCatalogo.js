/* =========================================================
   ESCALA DE LIKERT - BACKEND
   ---------------------------------------------------------
   Copia en CommonJS de ESCALA_LIKERT (frontend:
   js/components/evaluacionesCatalogo.js), usada para validar
   y puntuar las respuestas de las evaluaciones personalizadas
   (mismo patron que ROLES_VALIDOS/ROL_LABEL, duplicados a
   proposito entre frontend y backend).
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

module.exports = {
    VALORES_LIKERT_VALIDOS,
    PUNTAJE_LIKERT
};
