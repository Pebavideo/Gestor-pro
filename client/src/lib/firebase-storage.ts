import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth } from "./firebase";
import { compressImage } from "./image-compressor";

const storage = getStorage();

/**
 * Compacta e envia uma imagem para "/users/{uid}/{folder}/{timestamp}-{nome}"
 * no Firebase Storage, retornando a URL publica de download.
 */
export async function uploadCompressedImage(file: File, folder: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("Voce precisa estar autenticado para enviar imagens.");
  }

  const compressed = await compressImage(file);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `users/${uid}/${folder}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, compressed, { contentType: compressed.type });
  return getDownloadURL(storageRef);
}
