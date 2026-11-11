import { supabase } from '@/lib/supabase'

function compressImage(file: File, maxSize: number, quality: number, constrainHeight: boolean): Promise<{ blob: Blob; width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const source = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(source)
            try {
                const canvas = document.createElement('canvas')
                const scale = Math.min(1, maxSize / (constrainHeight ? Math.max(img.width, img.height) : img.width))
                const width = Math.max(1, Math.round(img.width * scale))
                const height = Math.max(1, Math.round(img.height * scale))
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                if (!ctx) throw new Error('Image compression is unavailable')
                ctx.drawImage(img, 0, 0, width, height)
                canvas.toBlob(blob => {
                    if (blob?.type !== 'image/webp') return reject(new Error('WebP encoding failed'))
                    resolve({ blob, width, height })
                }, 'image/webp', quality)
            } catch (error) { reject(error) }
        }
        img.onerror = () => {
            URL.revokeObjectURL(source)
            reject(new Error('Image could not be decoded'))
        }
        img.src = source
    })
}

type UploadOptions = { maxWidth?: number; quality?: number; cacheControl?: string; versioned?: boolean }

export async function uploadImage(path: string, file: File, options?: UploadOptions): Promise<string> {
    return (await uploadImageWithDimensions(path, file, options)).url
}

export async function uploadImageWithDimensions(path: string, file: File, options?: UploadOptions) {
    const { maxWidth = 1920, quality = 0.8, cacheControl, versioned = false } = options ?? {}
    const { blob, width, height } = await compressImage(file, maxWidth, quality, versioned)
    const basePath = path.replace(/\.[^/.]+$/, '')
    const objectPath = versioned ? `${basePath}-${crypto.randomUUID()}.webp` : `${basePath}.webp`
    const bucket = supabase.storage.from('kouponly-public-media')
    const { error } = await bucket.upload(objectPath, blob, {
        contentType: 'image/webp', cacheControl: cacheControl ?? (versioned ? '31536000' : undefined), upsert: !versioned,
    })
    if (error) throw error
    const { data } = bucket.getPublicUrl(objectPath)
    const published = new URL(data.publicUrl)
    if (!versioned) published.searchParams.set('v', String(Date.now()))
    return { url: published.toString(), width, height }
}

export async function deletePublicMedia(url: string): Promise<void> {
    const parsed = new URL(url)
    const marker = '/storage/v1/object/public/kouponly-public-media/'
    const index = parsed.pathname.indexOf(marker)
    if (index < 0) throw new Error('Not a public media URL')
    const path = parsed.pathname.slice(index + marker.length).split('/').map(decodeURIComponent).join('/')
    const { error } = await supabase.storage.from('kouponly-public-media').remove([path])
    if (error) throw error
}
