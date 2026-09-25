/*
 * Estandariza una imagen antes de subirla: corrige la rotación
 * de las fotos de celular (EXIF), la reduce a un tamaño máximo
 * y la convierte a WebP. Una foto de celular de varios MB queda
 * en unos cuantos cientos de KB (o ~20 KB como foto de perfil),
 * que es lo que se guarda en MySQL y viaja cada vez que se ve.
 *
 * El servidor valida por su cuenta el formato real (JPG, PNG o
 * WebP), así que esto no es la única barrera; ver
 * detectarTipoArchivo() en server.js.
 *
 * Opciones:
 *   tamanoMaximo: lado más largo en píxeles (por defecto 1920).
 *   cuadrado:     recorta al centro en cuadrado (foto de perfil).
 *   calidad:      0 a 1 para la compresión WebP.
 */

const TIPOS_NO_SOPORTADOS = ["image/svg+xml"];

export async function normalizarImagen(archivo, { tamanoMaximo = 1920, cuadrado = false, calidad = 0.85 } = {}) {
  if (TIPOS_NO_SOPORTADOS.includes(archivo.type)) {
    throw new Error(`"${archivo.name}" es un SVG; solo se permiten imágenes JPG, PNG o WebP.`);
  }

  let bitmap;

  try {
    bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      `No se pudo leer la imagen "${archivo.name}". Usa JPG, PNG o WebP (las fotos HEIC de iPhone no son compatibles; expórtalas como JPG).`
    );
  }

  const lado = Math.min(bitmap.width, bitmap.height);

  const origen = cuadrado
    ? { x: (bitmap.width - lado) / 2, y: (bitmap.height - lado) / 2, ancho: lado, alto: lado }
    : { x: 0, y: 0, ancho: bitmap.width, alto: bitmap.height };

  const escala = Math.min(1, tamanoMaximo / Math.max(origen.ancho, origen.alto));
  const ancho = Math.round(origen.ancho * escala);
  const alto = Math.round(origen.alto * escala);

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  canvas
    .getContext("2d")
    .drawImage(bitmap, origen.x, origen.y, origen.ancho, origen.alto, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", calidad));

  if (!blob) {
    throw new Error(`No fue posible procesar la imagen "${archivo.name}".`);
  }

  /*
   * Si la original ya era un formato permitido, no hubo que
   * recortarla ni reducirla y pesa menos que la convertida (p. ej.
   * una captura PNG pequeña), se sube tal cual.
   */
  const sinCambiosDeTamano = !cuadrado && escala === 1;
  const formatoPermitido = ["image/jpeg", "image/png", "image/webp"].includes(archivo.type);

  if (sinCambiosDeTamano && formatoPermitido && archivo.size <= blob.size) {
    return archivo;
  }

  const nombreBase = archivo.name.replace(/\.[^.]+$/, "") || "imagen";

  return new File([blob], `${nombreBase}.webp`, { type: "image/webp" });
}
