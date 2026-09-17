/* =========================================================
   CATÁLOGO DE EVALUACIONES (ESCALA DE LIKERT)
   ---------------------------------------------------------
   Fuente de verdad de los 5 formularios y sus preguntas,
   usada por el formulario (evaluacionesForm.js) y por el
   panel de resultados (evaluacionesResultados.js). El
   backend (js/server/evaluacionesCatalogo.js) mantiene una
   copia equivalente en CommonJS para validar los envíos,
   mismo patrón que ROLES_VALIDOS/ROL_LABEL.
   ========================================================= */

export const ESCALA_LIKERT = [

    { valor: "totalmente_acuerdo", etiqueta: "Totalmente de acuerdo", puntaje: 5 },
    { valor: "de_acuerdo", etiqueta: "De acuerdo", puntaje: 4 },
    { valor: "neutral", etiqueta: "Neutral", puntaje: 3 },
    { valor: "en_desacuerdo", etiqueta: "En desacuerdo", puntaje: 2 },
    { valor: "totalmente_desacuerdo", etiqueta: "Totalmente en desacuerdo", puntaje: 1 }

];


/*
 * objetivo:
 *   "autoevaluacion"    -> sin selección de destinatario, el usuario se evalúa a sí mismo
 *   "area_fija"         -> el destinatario es un área fija (areaObjetivo)
 *   "lider_area"        -> el destinatario es el líder de la propia área del usuario
 *   "colega_area"       -> el usuario elige un compañero de su misma área
 *   "sin_destinatario"  -> opinión general, sin destinatario (p.ej. clima organizacional)
 */
export const FORMULARIOS_EVALUACION = [

    {
        slug: "general",
        titulo: "Evaluación General",
        subtitulo: "Autoevaluación sobre tu desempeño general.",
        objetivo: "autoevaluacion",
        soloRoles: null,
        ocultarParaAreas: null,
        preguntas: [
            { id: "general_1", texto: "Cuenta con espíritu de servicio" },
            { id: "general_2", texto: "Cuenta con calidad en el trabajo" },
            { id: "general_3", texto: "Está abierto a sugerencias" }
        ]
    },

    {
        slug: "otros_dptos_ti",
        titulo: "Evaluación de otros dptos a TI",
        subtitulo: "Cómo calificas el servicio que recibes del departamento de Tecnologías de la Información.",
        objetivo: "area_fija",
        areaObjetivo: "Tecnologías de la Información",
        soloRoles: null,
        ocultarParaAreas: ["Tecnologías de la Información"],
        preguntas: [
            { id: "ti_1", texto: "Desarrollo y mantenimiento de sistemas de información" },
            { id: "ti_2", texto: "Administración de cuentas de correos electrónicos" },
            { id: "ti_3", texto: "Administración de usuarios de sistemas de información" },
            { id: "ti_4", texto: "Administración de servicios de internet" },
            { id: "ti_5", texto: "Administración de líneas telefónicas" },
            { id: "ti_6", texto: "Servicio de cableado de redes" },
            { id: "ti_7", texto: "Asesoría y soporte de software y hardware" }
        ]
    },

    {
        slug: "lider_dpto",
        titulo: "Evaluación a líder de dpto.",
        subtitulo: "Evalúa al líder de tu área.",
        objetivo: "lider_area",
        soloRoles: ["operador"],
        ocultarParaAreas: null,
        preguntas: [
            { id: "lider_1", texto: "Dirige de acuerdo a los valores incuestionables de la empresa (Responsabilidad, trabajo en equipo, honestidad, liderazgo, creatividad empresarial, integridad, calidad)" },
            { id: "lider_2", texto: "Actúa de manera consistente con lo que dice, decide y espera de su equipo." },
            { id: "lider_3", texto: "Muestra espíritu de servicio (en términos de asesoría, gestión y desarrollo de sus equipos de trabajo)" },
            { id: "lider_4", texto: "Atiende al colaborador con respeto, amabilidad y disposición para resolver sus necesidades." },
            { id: "lider_5", texto: "Mantiene una comunicación permanente y adecuada con sus colaboradores (trasmite claramente lo que desea y sabe escuchar)" },
            { id: "lider_6", texto: "Promueve la integración del equipo de trabajo, e inspira a que sus colaboradores trabajen en equipo." },
            { id: "lider_7", texto: "Motiva a los colaboradores a lograr los resultados del equipo" }
        ]
    },

    {
        slug: "clima_organizacional",
        titulo: "Evaluación de clima organizacional",
        subtitulo: "Tu opinión sobre el ambiente de trabajo en la empresa.",
        objetivo: "sin_destinatario",
        soloRoles: null,
        ocultarParaAreas: null,
        preguntas: [
            { id: "clima_1", texto: "La empresa actúa de acuerdo con sus valores fundamentales (responsabilidad, trabajo en equipo, honestidad, liderazgo, creatividad empresarial, integridad y calidad)." },
            { id: "clima_2", texto: "Tengo claridad sobre las responsabilidades de mi puesto." },
            { id: "clima_3", texto: "La carga de trabajo está distribuida equitativamente en mi equipo." },
            { id: "clima_4", texto: "Cuento con las herramientas y el equipo necesarios para realizar bien mi trabajo." },
            { id: "clima_5", texto: "La empresa promueve el trabajo en equipo y fomenta la participación de todos en la toma de decisiones." },
            { id: "clima_6", texto: "Existe una comunicación efectiva y respetuosa con mi líder para alcanzar los objetivos." },
            { id: "clima_7", texto: "El trato que recibo del personal directivo (director general, Director Operativo y Comité) me parece adecuado." },
            { id: "clima_8", texto: "La capacitación que recibo es suficiente y me ayuda a desempeñar mejor mi trabajo." },
            { id: "clima_9", texto: "Estoy conforme con mi sueldo y prestaciones (seguro social, vacaciones, aguinaldo, fondo de ahorro, etc.) en relación con mis responsabilidades." },
            { id: "clima_10", texto: "En la empresa existe el ambiente adecuado para hacer propuestas de mejora." },
            { id: "clima_11", texto: "Tengo autonomía para tomar decisiones relacionadas con mis tareas." },
            { id: "clima_12", texto: "En general, me siento satisfecho/a con el ambiente de trabajo y veo un futuro en esta empresa." }
        ]
    },

    {
        slug: "colaborador_colaborador",
        titulo: "De colaborador a colaborador",
        subtitulo: "Selecciona a un compañero de tu área y evalúalo.",
        objetivo: "colega_area",
        soloRoles: null,
        ocultarParaAreas: null,
        preguntas: [
            { id: "colab_1", texto: "¿Desempeña su trabajo en base a los valores de la empresa? (Responsabilidad, trabajo en equipo, honestidad, liderazgo, creatividad empresarial, integridad, calidad)" },
            { id: "colab_2", texto: "¿Cumple con sus actividades y da un extra para cumplir con los objetivos del Micronegocio?" },
            { id: "colab_3", texto: "¿Es puntual y participativo en las reuniones, citas, capacitación, etc.?" },
            { id: "colab_4", texto: "¿Mantiene una actitud de cortesía, amabilidad y disponibilidad para realizar su trabajo?" },
            { id: "colab_5", texto: "¿Trabaja en equipo?" },
            { id: "colab_6", texto: "¿Mantiene una comunicación adecuada con los demás integrantes del micronegocio?" },
            { id: "colab_7", texto: "¿Trabaja en base a la mejora continua (creatividad e innovación en su quehacer)?" },
            { id: "colab_8", texto: "¿Muestra interés por utilizar la tecnología en sus actividades (Equipo/software nuevo)?" },
            { id: "colab_9", texto: "En general, califico al colaborador como:" }
        ]
    }

];


export function obtenerFormulario(slug) {

    return FORMULARIOS_EVALUACION.find(
        (formulario) => formulario.slug === slug
    ) || null;

}


export function obtenerEtiquetaLikert(valor) {

    return ESCALA_LIKERT.find(
        (opcion) => opcion.valor === valor
    )?.etiqueta || valor;

}
