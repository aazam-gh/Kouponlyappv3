import { deleteObject, ref } from 'firebase/storage'
import { storage } from '@/firebase/config'

export const VENDOR_GALLERY_LIMIT = 12

export function getRemovedGalleryImages(
    originalImages: string[] | undefined,
    nextImages: string[] | undefined,
) {
    const nextImageSet = new Set(nextImages || [])
    return (originalImages || []).filter((imageUrl) => !nextImageSet.has(imageUrl))
}

export async function deleteGalleryImages(imageUrls: string[]) {
    const results = await Promise.allSettled(
        imageUrls.map((imageUrl) => deleteObject(ref(storage, imageUrl))),
    )

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error('Failed to delete vendor gallery image:', imageUrls[index], result.reason)
        }
    })
}
