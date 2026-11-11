import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import * as Location from 'expo-location';
import { NearbyProvider, useNearby } from '@/lib/nearby';
import { fetchVendorMapLocations } from '@/lib/nearby-vendors';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'undetermined', canAskAgain: true })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted', canAskAgain: true })),
  hasServicesEnabledAsync: jest.fn(async () => true),
}));
jest.mock('@/lib/location', () => ({ getCurrentPosition: async () => ({ coords: { latitude: 25.3, longitude: 51.5 } }) }));
jest.mock('@/lib/nearby-vendors', () => ({ fetchVendorMapLocations: jest.fn(async () => []) }));

function Probe() {
  const nearby = useNearby();
  return <>
    <Text>{nearby.status}</Text>
    <Pressable accessibilityLabel="Check nearby" onPress={() => void nearby.load()} />
    <Pressable accessibilityLabel="Allow nearby" onPress={() => void nearby.load({ askForPermission: true })} />
  </>;
}

it('starts idle, checks permission without prompting, then loads branches after an explicit grant', async () => {
  const view = await render(<NearbyProvider><Probe /></NearbyProvider>);
  expect(view.getByText('idle')).toBeTruthy();
  expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(fetchVendorMapLocations).not.toHaveBeenCalled();

  await fireEvent.press(view.getByLabelText('Check nearby'));
  await view.findByText('permission');
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(fetchVendorMapLocations).not.toHaveBeenCalled();

  await fireEvent.press(view.getByLabelText('Allow nearby'));
  await waitFor(() => expect(view.getByText('ready')).toBeTruthy());
  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(fetchVendorMapLocations).toHaveBeenCalledTimes(1);
});
