import imageCompression from "browser-image-compression";

const DEFAULT_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: "image/webp" as const,
};

/**
 * Compacta uma imagem no client antes do upload (reduz custo/banda no
 * Firebase Storage). Mantido sempre ativo em qualquer fluxo de upload de
 * imagem do app, conforme regra do projeto.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Arquivo selecionado nao e uma imagem.");
  }
  try {
    return await imageCompression(file, DEFAULT_OPTIONS);
  } catch (err) {
    console.error("Erro ao compactar imagem, enviando original:", err);
    return file;
  }
}
