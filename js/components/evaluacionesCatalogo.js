/* =========================================================
   ESCALA DE LIKERT
   ---------------------------------------------------------
   Usada por las evaluaciones personalizadas
   (evaluacionesPersonalizadas.js). El backend
   (js/server/evaluacionesCatalogo.js) mantiene una copia
   equivalente en CommonJS para validar los envios.
   ========================================================= */

export const ESCALA_LIKERT = [

    { valor: "totalmente_acuerdo", etiqueta: "Totalmente de acuerdo", puntaje: 5 },
    { valor: "de_acuerdo", etiqueta: "De acuerdo", puntaje: 4 },
    { valor: "neutral", etiqueta: "Neutral", puntaje: 3 },
    { valor: "en_desacuerdo", etiqueta: "En desacuerdo", puntaje: 2 },
    { valor: "totalmente_desacuerdo", etiqueta: "Totalmente en desacuerdo", puntaje: 1 }

];


export function obtenerEtiquetaLikert(valor) {

    return ESCALA_LIKERT.find(
        (opcion) => opcion.valor === valor
    )?.etiqueta || valor;

}
