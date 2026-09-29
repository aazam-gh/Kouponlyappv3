import {
    getDocs,
    limit,
    query,
    startAfter,
    type CollectionReference,
    type DocumentData,
    type QueryConstraint,
    type QueryDocumentSnapshot,
} from 'firebase/firestore'

const cursorCache = new Map<string, Map<number, QueryDocumentSnapshot<DocumentData>>>()

export function resetFirestorePaginationCursors(cacheKeyPrefix?: string) {
    if (!cacheKeyPrefix) {
        cursorCache.clear()
        return
    }

    for (const cacheKey of cursorCache.keys()) {
        if (cacheKey.startsWith(cacheKeyPrefix)) {
            cursorCache.delete(cacheKey)
        }
    }
}

export async function getCursorPage(
    collRef: CollectionReference<DocumentData>,
    constraints: QueryConstraint[],
    page: number,
    pageSize: number,
    cacheKey: string,
) {
    const targetPage = Math.max(1, page)
    const pageCursors = cursorCache.get(cacheKey) ?? new Map<number, QueryDocumentSnapshot<DocumentData>>()
    cursorCache.set(cacheKey, pageCursors)

    let currentPage = 1
    let cursor: QueryDocumentSnapshot<DocumentData> | undefined

    for (const [cursorPage, cursorDoc] of pageCursors.entries()) {
        if (cursorPage <= targetPage && cursorPage > currentPage) {
            currentPage = cursorPage
            cursor = cursorDoc
        }
    }

    let docsFetched = 0

    while (currentPage < targetPage) {
        const cursorConstraints = cursor ? [...constraints, startAfter(cursor)] : constraints
        const snapshot = await getDocs(query(collRef, ...cursorConstraints, limit(pageSize)))
        docsFetched += snapshot.size

        if (snapshot.empty) {
            return { docs: [], docsFetched }
        }

        cursor = snapshot.docs[snapshot.docs.length - 1]
        currentPage += 1
        pageCursors.set(currentPage, cursor)
    }

    const pageConstraints = cursor ? [...constraints, startAfter(cursor)] : constraints
    const snapshot = await getDocs(query(collRef, ...pageConstraints, limit(pageSize)))
    docsFetched += snapshot.size

    if (!snapshot.empty) {
        pageCursors.set(targetPage + 1, snapshot.docs[snapshot.docs.length - 1])
    }

    return { docs: snapshot.docs, docsFetched }
}
