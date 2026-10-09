import { useQuery } from '@tanstack/react-query';

import { homeQueryOptions } from '../../utils/homeQueries';
import PromoBanner from './PromoBanner';

type PartnerBannerCarouselProps = {
  onBannerPress?: (banner: { vendorId?: string }) => void;
};

/** Optional admin-managed partner carousel, separate from the featured showcase. */
export default function PartnerBannerCarousel({ onBannerPress }: PartnerBannerCarouselProps) {
  const { data: banners = [] } = useQuery(homeQueryOptions.promoBanners());

  return banners.length > 0
    ? <PromoBanner banners={banners} onBannerPress={onBannerPress} />
    : null;
}
