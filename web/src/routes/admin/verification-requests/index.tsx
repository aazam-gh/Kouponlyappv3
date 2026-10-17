import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/verification-requests/')({
    beforeLoad: () => { throw redirect({ to: '/admin/students', search: { page: 1, pageSize: 10, search: '', sort: 'created_desc' } }) },
})
