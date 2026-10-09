import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { ArrowLeft, User, Tag, Receipt, CreditCard, Ticket } from 'lucide-react'

export const Route = createLazyFileRoute('/admin/transactions/$id')({
    component: TransactionDetailsRoute,
})

function TransactionDetailsRoute() {
    const transaction = Route.useLoaderData()

    return (
        <div className="p-8 space-y-6 w-full max-w-[1200px] mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Link to="/admin/transactions" search={{ page: 1, pageSize: 10 }}>
                    <Button variant="ghost" size="icon" className="h-10 w-10">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center p-2.5 rounded-xl bg-blue-50/80 border border-blue-100">
                        <Receipt className="w-6 h-6 text-blue-600"/>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Transaction Details</h1>
                        <p className="text-sm text-muted-foreground mt-1">Review full transaction information and redemption stats</p>
                    </div>
                </div>
            </div>

            <Card className="max-w-4xl border-none shadow-sm shadow-blue-100/50 bg-white">
                <CardHeader className="flex flex-col md:flex-row flex-wrap items-start md:items-center justify-between gap-4 border-b border-gray-100 bg-gray-50/50 pb-6 rounded-t-xl">
                    <div className="space-y-1.5">
                        <CardDescription className="text-sm text-muted-foreground uppercase tracking-wide font-semibold">Transaction ID</CardDescription>
                        <CardTitle className="text-xl md:text-2xl font-bold font-mono tracking-tight text-gray-900">{transaction.id}</CardTitle>
                        <div className="flex flex-col">
                            <p className="text-sm text-muted-foreground">{transaction.date}</p>
                            {transaction.rawDate && (
                                <p className="text-[10px] text-muted-foreground font-mono opacity-60">{transaction.rawDate}</p>
                            )}
                        </div>
                    </div>
                    <Badge
                        variant="default"
                        className={`text-sm px-4 py-1.5 rounded-full font-semibold uppercase tracking-wider ${
                            transaction.type?.includes('offer')
                                ? 'bg-brand-green hover:bg-brand-green/90 text-white'
                                : 'bg-blue-600 hover:bg-blue-600/90 text-white'
                        }`}
                    >
                        {(transaction.type || 'N/A').replace(/_/g, ' ')}
                    </Badge>
                </CardHeader>

                <CardContent className="p-6 md:p-8 space-y-8">
                    {/* Core Information Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Transaction Details */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                                <CreditCard className="h-5 w-5 text-indigo-500" />
                                Payment Summary
                            </h3>
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl space-y-4 border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-center flex-wrap gap-2">
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground text-sm font-medium">Vendor</span>
                                        {transaction.vendorId ? (
                                            <Link
                                                to="/admin/vendors/$vendorId/settings"
                                                params={{ vendorId: transaction.vendorId as string }}
                                                search={{ page: 1, pageSize: 10 }}
                                                className="text-blue-600 hover:text-blue-700 font-bold text-base hover:underline flex items-center gap-1.5"
                                            >
                                                {transaction.vendorName}
                                                <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                                            </Link>
                                        ) : (
                                            <span className="font-bold text-base text-gray-500">{transaction.vendorName}</span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Vendor ID</span>
                                        <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-gray-200">{transaction.vendorId || 'N/A'}</span>
                                    </div>
                                </div>
                                <Separator className="bg-gray-200" />
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground text-sm font-medium">
                                        {transaction.type === 'online_redemption' ? 'Redemption Channel' : 'Original Total'}
                                    </span>
                                    <span className="font-medium text-gray-700">
                                        {transaction.type === 'online_redemption' ? 'Online store' : transaction.totalAmount}
                                    </span>
                                </div>

                                {transaction.discountAmount !== undefined && transaction.discountAmount > 0 && (
                                    <div className="flex justify-between items-center text-red-500 font-medium">
                                        <div className="flex flex-col">
                                            <span className="text-sm">Discount</span>
                                            {transaction.discountType && (
                                                <span className="text-[10px] uppercase font-bold tracking-tight opacity-80">{transaction.discountType} Type</span>
                                            )}
                                        </div>
                                        <span>-QAR {transaction.discountAmount}</span>
                                    </div>
                                )}

                                {transaction.redemptionCardAmount !== undefined && transaction.redemptionCardAmount > 0 && (
                                    <div className="flex justify-between items-center text-blue-600 font-medium">
                                        <span className="text-sm">Gift Card Benefit</span>
                                        <span>-QAR {transaction.redemptionCardAmount}</span>
                                    </div>
                                )}

                                {transaction.remainingAmount !== undefined && transaction.remainingAmount > 0 && (
                                    <div className="flex justify-between items-center text-gray-600 font-medium">
                                        <span className="text-sm">Remaining Bal. (Redeemed)</span>
                                        <span>QAR {transaction.remainingAmount}</span>
                                    </div>
                                )}

                                {transaction.type === 'online_redemption' && (
                                    <>
                                        <Separator className="my-2 bg-gray-200" />
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground text-sm font-medium">Discount Code</span>
                                                <span className="font-mono font-black text-lg text-blue-700 bg-white px-3 py-1 rounded-lg border border-blue-100">
                                                    {transaction.discountCode || 'N/A'}
                                                </span>
                                            </div>
                                            {transaction.purchaseUrl && (
                                                <div className="flex justify-between items-center gap-4">
                                                    <span className="text-muted-foreground text-sm font-medium">Purchase URL</span>
                                                    <a className="text-blue-600 text-sm font-bold hover:underline truncate" href={transaction.purchaseUrl} target="_blank" rel="noreferrer">
                                                        {transaction.purchaseUrl}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {transaction.type !== 'online_redemption' && (transaction.finalAmount !== undefined || transaction.type?.includes('offer') || transaction.type?.includes('giftcard')) && (
                                    <>
                                        <Separator className="my-2 bg-gray-200" />
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Final Net Paid</span>
                                                <span className="text-lg font-bold text-gray-900">Final Total</span>
                                            </div>
                                            <span className="text-2xl font-black text-brand-green">
                                                QAR {transaction.finalAmount ?? transaction.totalAmount?.toString().replace(/[^\d.]/g, '')}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Reference Information */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                                <User className="h-5 w-5 text-indigo-500" />
                                System Identifiers
                            </h3>
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl space-y-5 border border-gray-100 shadow-sm">
                                <div className="space-y-2 flex flex-col">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> User ID</span>
                                    {transaction.userId ? (
                                        <Link
                                            to="/admin/students/$studentId/settings"
                                            params={{ studentId: transaction.userId as string }}
                                            search={{ page: 1, pageSize: 10, search: '' }}
                                            className="font-mono text-xs md:text-sm text-blue-600 font-bold break-all bg-white p-3 rounded-xl border border-blue-100 hover:bg-blue-50 transition-colors flex justify-between items-center group"
                                        >
                                            {transaction.userId}
                                            <ArrowLeft className="w-4 h-4 rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </Link>
                                    ) : (
                                        <div className="font-mono text-xs md:text-sm text-gray-500 break-all bg-white p-3 rounded-xl border border-gray-100 shadow-inner">
                                            Not Available
                                        </div>
                                    )}
                                </div>

                                {transaction.offerId && (
                                    <div className="space-y-2 flex flex-col">
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" /> Linked Offer ID</span>
                                        <div className="font-mono text-xs md:text-sm text-gray-800 break-all bg-white p-3 rounded-xl border border-gray-100 shadow-inner flex justify-between items-center group">
                                            {transaction.offerId}
                                            <Tag className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2 flex flex-col">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Transaction Reference</span>
                                    <span className="font-mono text-lg font-extrabold text-blue-700 tracking-wider bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-center">
                                        {transaction.transactionId || 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Rewards Section */}
                    {(transaction.cashbackAmount !== undefined || transaction.creatorCashbackAmount !== undefined || transaction.creatorCode) && (
                        <div className="space-y-4 pt-6 border-t border-gray-100">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                                <Tag className="h-5 w-5 text-brand-green" />
                                Rewards & Commission
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="bg-gradient-to-br from-green-50 to-green-100/30 p-5 rounded-2xl border border-green-200/50 flex flex-col justify-center space-y-2 shadow-sm transition-transform hover:scale-[1.02]">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-brand-green animate-pulse"></div>
                                        <p className="text-[10px] text-brand-green font-black uppercase tracking-widest">User Cashback Earned</p>
                                    </div>
                                    <p className="font-black text-4xl text-brand-green">QAR {transaction.cashbackAmount || 0}</p>
                                </div>

                                <div className="bg-gradient-to-br from-amber-50 to-amber-100/30 p-5 rounded-2xl border border-amber-200/50 flex flex-col justify-center space-y-2 shadow-sm transition-transform hover:scale-[1.02]">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                                        <p className="text-[10px] text-amber-700 font-black uppercase tracking-widest">Creator Referral Earned</p>
                                    </div>
                                    <p className="font-black text-4xl text-amber-600">QAR {transaction.creatorCashbackAmount || 0}</p>
                                </div>

                                {(transaction.creatorCode || transaction.creatorUid) && (
                                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/30 p-5 rounded-2xl border border-indigo-200/50 flex flex-col justify-center space-y-2 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                                            <p className="text-[10px] text-indigo-700 font-black uppercase tracking-widest">Referrer Metadata</p>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground font-medium">Referral Code</span>
                                                <span className="font-black text-xl text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100">{transaction.creatorCode || 'None'}</span>
                                            </div>
                                            {transaction.creatorUid && (
                                                <div className="p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                                                    <span className="block text-[8px] text-indigo-500 font-bold uppercase mb-0.5">Creator ID</span>
                                                    <p className="text-[10px] text-indigo-600 font-mono break-all leading-tight">{transaction.creatorUid}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
