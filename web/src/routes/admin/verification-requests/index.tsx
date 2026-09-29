import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const verificationRequestsSearchSchema = z.object({
    pageSize: z.coerce.number().int().min(5).max(50).catch(10),
    page: z.coerce.number().int().min(1).catch(1),
    status: z.enum(["all", "pending", "approved", "rejected"]).catch("all"),
})

export const Route = createFileRoute('/admin/verification-requests/')({
    validateSearch: (search) => verificationRequestsSearchSchema.parse(search),
})
