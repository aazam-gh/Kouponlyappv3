import { createFileRoute } from '@tanstack/react-router'
import { Label } from "@/components/ui/label"

export const Route = createFileRoute('/(vendor-panel)/_vendor/contact-us')({
    component: ContactUsPage,
})

function ContactUsPage() {
    const contactInfo = {
        fullName: "Aazam",
        phoneNumber: "+974 70450340",
        email: "aazamthakur@gmail.com"
    }

    return (
        <div className="flex flex-1 flex-col p-6 lg:p-10">
            <div className="max-w-3xl space-y-8">
                <div className="space-y-4">
                    <h1 className="text-2xl font-bold tracking-tight text-[#020817]">Contact Account Manager</h1>
                    <p className="text-[#020817] text-lg font-medium leading-relaxed max-w-2xl">
                        Please contact your Account Manager using the info below for any inquiries or assistance
                    </p>
                </div>

                <div className="space-y-8 mt-10">
                    <div className="space-y-3">
                        <Label className="text-base font-bold text-[#020817]">Full Name</Label>
                        <div className="bg-[#E5E7EB] h-14 flex items-center px-6 rounded-3xl text-[#020817] font-semibold text-lg">
                            {contactInfo.fullName}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-base font-bold text-[#020817]">Phone Number</Label>
                        <div className="bg-[#E5E7EB] h-14 flex items-center px-6 rounded-3xl text-[#020817] font-semibold text-lg">
                            {contactInfo.phoneNumber}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-base font-bold text-[#020817]">Email</Label>
                        <div className="bg-[#E5E7EB] h-14 flex items-center px-6 rounded-3xl text-[#020817] font-semibold text-lg">
                            {contactInfo.email}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
