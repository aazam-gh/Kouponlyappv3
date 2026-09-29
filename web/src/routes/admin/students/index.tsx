import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

export const studentsSearchSchema = z.object({
    pageSize: z.coerce.number().int().min(5).max(50).catch(10),
    page: z.coerce.number().int().min(1).catch(1),
    search: z.string().catch(''),
})

export type StudentSearch = z.infer<typeof studentsSearchSchema>

export const Route = createFileRoute('/admin/students/')({
    validateSearch: (search) => studentsSearchSchema.parse(search),
})
