import * as Location from 'expo-location';

const LOCATION_TIMEOUT_MS = 15_000;

export function getCurrentPosition() {
  let timeout: ReturnType<typeof setTimeout>;
  return Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<Location.LocationObject>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Could not determine your location. Please try again.')), LOCATION_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timeout));
}
