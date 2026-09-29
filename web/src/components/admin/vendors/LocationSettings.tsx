import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Vendor, VendorLocation } from "@/queries"
import { MapPin, Phone, Plus, Trash2 } from "lucide-react"

interface LocationSettingsProps {
    formData: Vendor
    setFormData: (val: Vendor) => void
    vendorId: string
}

const newLocationId = () => `branch-${Date.now()}`

const readLocations = (vendor: Vendor): VendorLocation[] => {
    if (Array.isArray(vendor.locations) && vendor.locations.length > 0) {
        return vendor.locations.map((location, index) => ({
            ...location,
            id: location.id || (index === 0 ? 'primary' : `branch-${index + 1}`),
            isPrimary: location.isPrimary === true || index === 0,
        }))
    }

    return [{
        id: 'primary',
        address: vendor.address,
        addressAr: vendor.addressAr,
        latitude: vendor.latitude,
        longitude: vendor.longitude,
        geohash: vendor.geohash,
        isPrimary: true,
    }]
}

const syncPrimaryLocation = (vendor: Vendor, locations: VendorLocation[]): Vendor => {
    const normalized = locations.map((location, index) => ({
        ...location,
        isPrimary: location.isPrimary === true || index === 0,
    }))
    const primary = normalized.find((location) => location.isPrimary) || normalized[0]

    return {
        ...vendor,
        locations: normalized,
        latitude: primary?.latitude,
        longitude: primary?.longitude,
        lat: primary?.latitude,
        lng: primary?.longitude,
        address: primary?.address,
        addressAr: primary?.addressAr,
        geohash: primary?.geohash,
    }
}

const toNumber = (value: string) => value === "" ? undefined : parseFloat(value)

export function LocationSettings({ formData, setFormData }: LocationSettingsProps) {
    const locations = readLocations(formData)
    const primaryLocation = locations.find((location) => location.isPrimary) || locations[0]
    const hasCoordinates = typeof primaryLocation?.latitude === 'number' && typeof primaryLocation?.longitude === 'number'
    const latValid = locations.every((location) => location.latitude == null || (location.latitude >= -90 && location.latitude <= 90))
    const lngValid = locations.every((location) => location.longitude == null || (location.longitude >= -180 && location.longitude <= 180))

    const updateLocations = (nextLocations: VendorLocation[]) => {
        setFormData(syncPrimaryLocation(formData, nextLocations))
    }

    const updateLocation = (id: string, patch: Partial<VendorLocation>) => {
        updateLocations(locations.map((location) => location.id === id ? { ...location, ...patch } : location))
    }

    const addLocation = () => {
        updateLocations([
            ...locations,
            {
                id: newLocationId(),
                name: '',
                nameAr: '',
                phoneNumber: '',
                address: '',
                addressAr: '',
                isPrimary: false,
            },
        ])
    }

    const removeLocation = (id: string) => {
        if (locations.length === 1) return
        const nextLocations = locations.filter((location) => location.id !== id)
        if (!nextLocations.some((location) => location.isPrimary)) {
            nextLocations[0] = { ...nextLocations[0], isPrimary: true }
        }
        updateLocations(nextLocations)
    }

    const setPrimary = (id: string) => {
        updateLocations(locations.map((location) => ({
            ...location,
            isPrimary: location.id === id,
        })))
    }

    return (
        <div className="space-y-8">
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-5 py-4 text-sm text-blue-800">
                Add one row per branch. The primary branch also syncs <span className="font-mono">latitude/longitude</span> and <span className="font-mono">lat/lng</span> for existing mobile screens.
            </div>

            <div className="space-y-6">
                {locations.map((location, index) => {
                    const locationLatValid = location.latitude == null || (location.latitude >= -90 && location.latitude <= 90)
                    const locationLngValid = location.longitude == null || (location.longitude >= -180 && location.longitude <= 180)

                    return (
                        <div key={location.id} className="rounded-lg border border-slate-200 p-5">
                            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <MapPin className="h-5 w-5 text-brand-green" />
                                    <div>
                                        <p className="text-base font-semibold text-slate-800">Branch {index + 1}</p>
                                        {location.isPrimary && <p className="text-xs font-medium text-brand-green">Primary location</p>}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {!location.isPrimary && (
                                        <Button type="button" variant="outline" size="sm" onClick={() => setPrimary(location.id)}>
                                            Make Primary
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeLocation(location.id)}
                                        disabled={locations.length === 1}
                                        aria-label="Remove branch"
                                    >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold text-slate-700">Branch Name</Label>
                                    <Input
                                        placeholder="Villaggio"
                                        value={location.name || ""}
                                        onChange={(event) => updateLocation(location.id, { name: event.target.value })}
                                        className="h-12 rounded-lg border-none bg-slate-50 px-4 text-sm ring-0 focus-visible:ring-1 focus-visible:ring-blue-400"
                                    />
                                </div>

                                <div className="space-y-3 text-right">
                                    <Label className="text-sm font-semibold text-slate-700">Branch Name (Arabic)</Label>
                                    <Input
                                        placeholder="فيلاجيو"
                                        value={location.nameAr || ""}
                                        onChange={(event) => updateLocation(location.id, { nameAr: event.target.value })}
                                        dir="rtl"
                                        className="h-12 rounded-lg border-none bg-slate-50 px-4 text-sm ring-0 focus-visible:ring-1 focus-visible:ring-blue-400"
                                    />
                                </div>

                                <div className="space-y-3 md:col-span-2">
                                    <Label className="text-sm font-semibold text-slate-700">Branch Phone Number</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            type="tel"
                                            inputMode="tel"
                                            placeholder="+974 4432 9958"
                                            value={location.phoneNumber || ""}
                                            onChange={(event) => updateLocation(location.id, { phoneNumber: event.target.value })}
                                            className="h-12 rounded-lg border-none bg-slate-50 px-4 pl-11 text-sm ring-0 focus-visible:ring-1 focus-visible:ring-blue-400"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold text-slate-700">Latitude</Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        placeholder="25.2854"
                                        value={location.latitude ?? ""}
                                        onChange={(event) => updateLocation(location.id, { latitude: toNumber(event.target.value) })}
                                        className={`h-12 rounded-lg border-none bg-slate-50 px-4 text-sm ring-0 focus-visible:ring-1 ${!locationLatValid ? 'focus-visible:ring-red-400' : 'focus-visible:ring-blue-400'}`}
                                    />
                                    {!locationLatValid && <p className="text-xs text-red-500">Latitude must be between -90 and 90</p>}
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold text-slate-700">Longitude</Label>
                                    <Input
                                        type="number"
                                        step="any"
                                        placeholder="51.5310"
                                        value={location.longitude ?? ""}
                                        onChange={(event) => updateLocation(location.id, { longitude: toNumber(event.target.value) })}
                                        className={`h-12 rounded-lg border-none bg-slate-50 px-4 text-sm ring-0 focus-visible:ring-1 ${!locationLngValid ? 'focus-visible:ring-red-400' : 'focus-visible:ring-blue-400'}`}
                                    />
                                    {!locationLngValid && <p className="text-xs text-red-500">Longitude must be between -180 and 180</p>}
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold text-slate-700">Address (English)</Label>
                                    <Input
                                        placeholder="Villaggio Mall, Level 2"
                                        value={location.address || ""}
                                        onChange={(event) => updateLocation(location.id, { address: event.target.value })}
                                        className="h-12 rounded-lg border-none bg-slate-50 px-4 text-sm ring-0 focus-visible:ring-1 focus-visible:ring-blue-400"
                                    />
                                </div>

                                <div className="space-y-3 text-right">
                                    <Label className="text-sm font-semibold text-slate-700">Address (Arabic)</Label>
                                    <Input
                                        placeholder="فيلاجيو مول، الطابق الثاني"
                                        value={location.addressAr || ""}
                                        onChange={(event) => updateLocation(location.id, { addressAr: event.target.value })}
                                        dir="rtl"
                                        className="h-12 rounded-lg border-none bg-slate-50 px-4 text-sm ring-0 focus-visible:ring-1 focus-visible:ring-blue-400"
                                    />
                                </div>

                                <div className="space-y-3 md:col-span-2">
                                    <Label className="text-sm font-semibold text-slate-700">Geohash</Label>
                                    <div className="flex h-12 items-center gap-2 rounded-lg bg-slate-50 px-4 text-sm text-slate-500">
                                        <MapPin className="h-4 w-4" />
                                        <span className="font-mono">
                                            {location.geohash || "Will be computed on save"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <Button type="button" variant="outline" className="gap-2" onClick={addLocation}>
                <Plus className="h-4 w-4" />
                Add Branch
            </Button>

            {hasCoordinates && latValid && lngValid && (
                <div className="overflow-hidden rounded-lg border border-slate-100">
                    <iframe
                        title="Primary Location Preview"
                        width="100%"
                        height="300"
                        frameBorder="0"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${primaryLocation.longitude! - 0.005},${primaryLocation.latitude! - 0.005},${primaryLocation.longitude! + 0.005},${primaryLocation.latitude! + 0.005}&layer=mapnik&marker=${primaryLocation.latitude},${primaryLocation.longitude}`}
                    />
                </div>
            )}
        </div>
    )
}
