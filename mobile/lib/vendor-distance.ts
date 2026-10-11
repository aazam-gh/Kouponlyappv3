export type Coordinates = { latitude: number; longitude: number };

export type LocatedVendor = { vendorId: string; latitude?: number; longitude?: number };

export type NearestVendorLocation<T extends LocatedVendor> = {
  location: T;
  distanceKm: number;
  label: string;
};

export function distanceBetweenKm(from: Coordinates, to: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLng = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestLocationsByVendor<T extends LocatedVendor>(locations: T[], position: Coordinates) {
  const nearestByVendor = new Map<string, NearestVendorLocation<T>>();
  for (const location of locations) {
    const { latitude, longitude } = location;
    if (typeof latitude !== 'number' || !Number.isFinite(latitude)
      || typeof longitude !== 'number' || !Number.isFinite(longitude)) continue;
    const distanceKm = distanceBetweenKm(position, { latitude, longitude });
    const current = nearestByVendor.get(location.vendorId);
    if (!current || distanceKm < current.distanceKm) {
      nearestByVendor.set(location.vendorId, {
        location,
        distanceKm,
        label: `${distanceKm.toFixed(2)} km`,
      });
    }
  }
  return nearestByVendor;
}
