/*
 * Responsables de un objetivo como arreglo [{ id, nombre }].
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
