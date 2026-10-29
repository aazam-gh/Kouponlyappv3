import { supabase } from '@/lib/supabase'

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

    const objectPath = path.replace(/\.[^.]+$/, '.webp')
    const { error } = await supabase.storage.from('kouponly-public-media').upload(objectPath, compressed, {
        contentType: 'image/webp', cacheControl, upsert: true,
    })
    if (error) throw error
    const { data } = supabase.storage.from('kouponly-public-media').getPublicUrl(objectPath)
    const published = new URL(data.publicUrl)
    published.searchParams.set('v', String(Date.now()))
    return published.toString()
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
