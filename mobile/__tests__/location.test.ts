jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getCurrentPositionAsync: jest.fn(() => new Promise(() => {})),
}));

import { getCurrentPosition } from '../lib/location';

it('rejects when iOS never returns a location fix', async () => {
  jest.useFakeTimers();
  const result = getCurrentPosition();
  const rejection = expect(result).rejects.toThrow('Could not determine your location. Please try again.');
  await jest.advanceTimersByTimeAsync(15_000);
  await rejection;
  jest.useRealTimers();
});
