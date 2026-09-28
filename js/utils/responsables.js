/*
 * Responsables de un objetivo o de un compromiso como arreglo
 * [{ id, nombre }]. (Los compromisos usan el mismo formato desde
 * que admiten varios responsables.)
 *
 * Los objetivos guardan "responsables" (uno o varios). Los que
 * se asignaron antes de permitir varios traen un solo
 * usuarioAsignadoId / usuarioAsignadoNombre: se leen como un
 * arreglo de uno para que el resto del código no distinga.
 */
export function obtenerResponsables(objetivo) {
  if (Array.isArray(objetivo?.responsables)) return objetivo.responsables;

  if (objetivo?.usuarioAsignadoId) {
    return [{ id: objetivo.usuarioAsignadoId, nombre: objetivo.usuarioAsignadoNombre || "?" }];
  }

  return [];
}

/* "Ana, Luis y Marta" (o "" si no hay responsables). */
export function nombresResponsables(item) {
  const nombres = obtenerResponsables(item).map((responsable) => responsable.nombre);

  if (nombres.length <= 1) return nombres[0] || "";

  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/*
 * Solo se puede asignar a personas del mismo departamento que quien
 * asigna (el servidor lo vuelve a validar en POST /api/compromisos).
 */
export function mismoDepartamento(usuario, otro) {
  const departamento = String(usuario?.departamento || "").trim();
  return departamento !== "" && departamento === String(otro?.departamento || "").trim();
}

export function esResponsable(item, usuarioId) {
  return obtenerResponsables(item).some((responsable) => Number(responsable.id) === Number(usuarioId));
}

/*
 * Los responsables de un compromiso solo pueden ser del mismo
 * departamento y área que quien lo crea (el servidor lo vuelve a
 * validar en POST /api/compromisos).
 */
export function mismaArea(usuario, otro) {
  const area = String(usuario?.area || "").trim();
  return mismoDepartamento(usuario, otro) && area !== "" && area === String(otro?.area || "").trim();
}

/*
 * Personas involucradas de un compromiso como arreglo [{ id, nombre }].
 * Antes eran texto libre: esos compromisos traen un string y no
 * tienen personas que marcar en el selector.
 */
export function obtenerInvolucrados(item) {
  return Array.isArray(item?.personasInvolucradas) ? item.personasInvolucradas : [];
}

/* Texto para la ficha: "Ana, Luis y Marta", o el texto libre de antes. */
export function textoInvolucrados(item) {
  const valor = item?.personasInvolucradas;

  if (!Array.isArray(valor)) return String(valor || "").trim();

  return nombresResponsables({ responsables: valor });
}
