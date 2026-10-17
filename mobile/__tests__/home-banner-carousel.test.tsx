import React from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import HomeBannerCarousel from '../components/home/HomeBannerCarousel';
import PromoBanner from '../components/home/PromoBanner';
import { recordCmsClick } from '@/lib/cms-clicks';

let mockReduceMotion = false;
const mockBanners = Array.from({ length: 5 }, (_, index) => ({
  id: String(index), vendorId: String(index), vendorIds: [`vendor-${index}`, 'vendor-2'], vendorNames: { [`vendor-${index}`]: `Vendor ${index}`, 'vendor-2': 'Vendor 2' }, bannerId: String(index),
  images: { mobile: 'banner.jpg' }, imageUrl: 'banner.jpg', isActive: true,
}));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: mockBanners }) }));
jest.mock('../utils/homeQueries', () => ({ homeQueryOptions: { featuredBanner: () => ({}), promoBanners: () => ({}) } }));
jest.mock('../components/home/FeaturedBanner', () => () => null);
jest.mock('../components/ScalePressable', () => require('react-native').Pressable);
jest.mock('@/lib/cms-clicks', () => ({ recordCmsClick: jest.fn().mockResolvedValue(undefined) }));
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

it('contains promotional banner images without cropping', async () => {
  const view = await render(<PromoBanner />);
  expect(view.getAllByLabelText('Banner Image').every(image => (
    image.props.contentFit === 'contain'
    && image.parent?.props.style.borderRadius === 30
    && image.parent?.props.style.borderCurve === 'circular'
    && image.parent?.props.style.overflow === 'hidden'
  ))).toBe(true);
  const carousel = view.getByTestId('home-promo-carousel');
  expect(carousel.props.contentContainerStyle.gap).toBe(carousel.props.contentContainerStyle.paddingHorizontal);
});

it('rounds the visible image bounds without cropping wide or tall artwork', async () => {
  const view = await render(<PromoBanner />);
  const carousel = view.getByTestId('home-promo-carousel');
  const bannerWidth = carousel.props.snapToInterval - carousel.props.contentContainerStyle.gap;
  for (const [width, height] of [[1600, 1000], [600, 1200]]) {
    await fireEvent(view.getAllByLabelText('Banner Image')[0], 'load', { nativeEvent: { source: { width, height } } });
    const style = StyleSheet.flatten(view.getAllByLabelText('Banner Image')[0].props.style);
    expect(style.width / style.height).toBeCloseTo(width / height);
    expect(style.height).toBeLessThanOrEqual(240);
    expect(style.width).toBeLessThanOrEqual(bannerWidth);
    expect(style.borderRadius).toBe(30);
  }
});

it('records a partner banner tap before offering its named vendor destinations', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const onBannerPress = jest.fn();
  const view = await render(<PromoBanner onBannerPress={onBannerPress} />);
  await act(async () => { fireEvent.press(view.getAllByRole('button')[0]); });
  await waitFor(() => expect(alert).toHaveBeenCalled());
  expect(recordCmsClick).toHaveBeenCalledWith('banner', '4');
  expect(alert).toHaveBeenCalledWith('Choose a vendor', 'Select where you would like to go.', expect.arrayContaining([
    expect.objectContaining({ text: 'Vendor 4', onPress: expect.any(Function) }),
    expect.objectContaining({ text: 'Vendor 2', onPress: expect.any(Function) }),
  ]));
  alert.mockRestore();
});
