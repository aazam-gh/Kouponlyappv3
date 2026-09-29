interface AdminReadLogFields {
    page?: number
    pageSize?: number
    docsFetched?: number
    docsDisplayed?: number
    totalCount?: number
    [key: string]: unknown
}

export function logAdminRead(label: string, fields: AdminReadLogFields) {
    if (!import.meta.env.DEV) return
    console.debug(`[admin-read] ${label}`, fields)
}
