import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase/config'

export function compressImage(file: File, maxWidth: number, quality: number): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const source = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(source)
            try {
            const canvas = document.createElement('canvas')
            let { width, height } = img
            if (width > maxWidth) {
                height = (height * maxWidth) / width
                width = maxWidth
            }
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (!ctx) throw new Error('Image compression is unavailable')
            ctx.drawImage(img, 0, 0, width, height)
            canvas.toBlob(
                (blob) => {
                    if (!blob) return reject(new Error('Compression failed'))
                    resolve(new File([blob], file.name, { type: 'image/webp' }))
                },
                'image/webp',
                quality
            )
            } catch (error) { reject(error) }
        }
        img.onerror = () => {
            URL.revokeObjectURL(source)
            reject(new Error('Image could not be decoded'))
        }
        img.src = source
    })
}

export async function uploadImage(
    path: string,
    file: File,
    options?: { maxWidth?: number; quality?: number; cacheControl?: string }
): Promise<string> {
    const { maxWidth = 1920, quality = 0.8, cacheControl } = options ?? {}
    const compressed = await compressImage(file, maxWidth, quality)

    const storageRef = ref(storage, path.replace(/\.[^.]+$/, '.webp'))
    const uploadTask = uploadBytesResumable(storageRef, compressed, {
        contentType: 'image/webp',
        ...(cacheControl ? { cacheControl } : {}),
    })

    return new Promise<string>((resolve, reject) => {
        uploadTask.on(
            'state_changed',
            null,
            reject,
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref)
                // A replacement at the same Storage path must invalidate image caches.
                const published = new URL(url)
                published.searchParams.set('v', String(Date.now()))
                resolve(published.toString())
            }
        )
    })
}
