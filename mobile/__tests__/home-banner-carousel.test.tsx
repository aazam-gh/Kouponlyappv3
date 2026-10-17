import React from 'react';
import { ScrollView } from 'react-native';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import HomeBannerCarousel from '../components/home/HomeBannerCarousel';
import PromoBanner from '../components/home/PromoBanner';

let mockReduceMotion = false;
const mockBanners = Array.from({ length: 5 }, (_, index) => ({
  id: String(index), vendorId: String(index), bannerId: String(index),
  images: { mobile: 'banner.jpg' }, imageUrl: 'banner.jpg', isActive: true,
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: mockBanners }) }));
jest.mock('../utils/homeQueries', () => ({ homeQueryOptions: { featuredBanner: () => ({}), promoBanners: () => ({}) } }));
jest.mock('../components/home/FeaturedBanner', () => () => null);
jest.mock('../components/ScalePressable', () => require('react-native').Pressable);
jest.mock('../lib/theme', () => ({ useMotionPreferences: () => ({ reduceMotion: mockReduceMotion }) }));
jest.mock('../context/AppThemeContext', () => ({ useAppTheme: () => ({ theme: {} }) }));

beforeEach(() => { mockReduceMotion = false; jest.useFakeTimers(); });
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.useRealTimers(); });

for (const Component of [HomeBannerCarousel, PromoBanner]) {
  describe(Component.name, () => {
    it('lets momentum cross several banners and autoplays from the landing banner', async () => {
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
      const view = await render(<Component />);
      const scroll = view.getByTestId(Component === HomeBannerCarousel ? 'home-featured-carousel' : 'home-promo-carousel');
      const interval = scroll.props.snapToInterval;
      expect(interval).toBeGreaterThan(0);
      expect(scroll.props.pagingEnabled).toBeFalsy();
      expect(scroll.props.disableIntervalMomentum).toBeFalsy();
      expect(scroll.props.decelerationRate).toBe('fast');
      scrollTo.mockClear();

      await fireEvent(scroll, 'scrollBeginDrag');
      await act(async () => jest.advanceTimersByTime(4000));
      expect(scrollTo).not.toHaveBeenCalled();
      await fireEvent(scroll, 'scrollEndDrag', { nativeEvent: { contentOffset: { x: interval * 0.8 } } });
      await fireEvent(scroll, 'momentumScrollBegin');
      await act(async () => jest.advanceTimersByTime(1000));
      expect(scrollTo).not.toHaveBeenCalled();
      await fireEvent(scroll, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: interval * 3 } } });
      expect(scrollTo).not.toHaveBeenCalled();
      await act(async () => jest.advanceTimersByTime(4000));
      expect(scrollTo).toHaveBeenLastCalledWith({ x: interval * 4, animated: true });
      await act(async () => jest.advanceTimersByTime(4000));
      expect(scrollTo).toHaveBeenLastCalledWith({ x: interval * 5, animated: true });
      await fireEvent(scroll, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: interval * 6 } } });
      expect(scrollTo).toHaveBeenLastCalledWith({ x: interval, animated: false });
      await fireEvent(scroll, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 0 } } });
      expect(scrollTo).toHaveBeenLastCalledWith({ x: interval * 5, animated: false });
    });

    it('keeps autoplay off with reduced motion', async () => {
      mockReduceMotion = true;
      const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
      await render(<Component />);
      scrollTo.mockClear();
      await act(async () => jest.advanceTimersByTime(12000));
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
}
