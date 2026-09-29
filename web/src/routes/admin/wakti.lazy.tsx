import { createLazyFileRoute } from '@tanstack/react-router'
import { WaktiStudentVerificationSidebar } from '@/components/admin/wakti-student-verification-sidebar'

export const Route = createLazyFileRoute('/admin/wakti')({
    component: RouteComponent,
})

function RouteComponent() {
    return (
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
            <WaktiStudentVerificationSidebar />
        </div>
    )
}
