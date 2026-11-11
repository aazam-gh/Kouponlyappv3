import type { HomeBannerItem } from '../../utils/homeQueries';
import PromoBanner from './PromoBanner';

type PartnerBannerCarouselProps = {
  banners: HomeBannerItem[];
  onBannerPress?: (banner: { vendorId?: string }) => void;
  onFirstImageDisplay?: () => void;
};

/** Optional admin-managed partner carousel, separate from the featured showcase. */
export default function PartnerBannerCarousel({ banners, onBannerPress, onFirstImageDisplay }: PartnerBannerCarouselProps) {
  return banners.length > 0
    ? <PromoBanner banners={banners} onBannerPress={onBannerPress} onFirstImageDisplay={onFirstImageDisplay} />
    : null;
}
