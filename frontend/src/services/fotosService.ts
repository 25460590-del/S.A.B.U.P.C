import {
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { comprimirImagenAWebP } from '../lib/imageCompression'
import type { FotoPerfil } from '../types'

/**
 * Escucha la fotografía WebP del usuario en `fotos_perfiles/{uid}` (caché offline incluida).
 */
export function escucharFotoPerfil(
  uid: string,
  alCambiar: (foto: FotoPerfil | null) => void,
  alFallar?: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'fotos_perfiles', uid),
    (snap) => {
      alCambiar(snap.exists() ? (snap.data() as FotoPerfil) : null)
    },
    (err) => {
      if (alFallar) alFallar(err)
      else console.warn('[SABUPC] Error al leer foto de perfil:', err.code)
    },
  )
}

/**
 * Comprime la foto en cliente a WebP (~40–70 KB) y la guarda atómicamente en
 * `fotos_perfiles/{uid}` actualizando `tiene_foto: true` en `usuarios/{uid}`.
 */
export async function guardarFotoPerfil(uid: string, archivo: File): Promise<{ bytes: number }> {
  const { dataUrl, bytes } = await comprimirImagenAWebP(archivo, {
    ladoMaximo: 480,
    recorteCuadrado: true,
    maxBytes: 70 * 1024,
  })

  const lote = writeBatch(db)
  lote.set(doc(db, 'fotos_perfiles', uid), {
    uid,
    imagen_webp_base64: dataUrl,
    actualizado_en: serverTimestamp(),
  })
  lote.update(doc(db, 'usuarios', uid), {
    tiene_foto: true,
    actualizado_en: serverTimestamp(),
  })
  await lote.commit()

  return { bytes }
}
