import { type Category, type Deal, type DirectoryItem } from '@/lib/data';

export type MarketplaceVendorRow = Record<string, any> & { id: string; status?: string };
export type MarketplaceOfferRow = Record<string, any> & { id: string; vendor_id: string; active?: boolean };

const stringValue = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value : fallback;
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function isOfferAvailable(offer: MarketplaceOfferRow, now: number) {
  if (offer.active === false) return false;
  const start = offer.starts_at ? Date.parse(offer.starts_at) : Number.NEGATIVE_INFINITY;
  const end = offer.ends_at ? Date.parse(offer.ends_at) : Number.POSITIVE_INFINITY;
  return start <= now && end > now;
}

export function projectVendorCatalogue(
  vendors: MarketplaceVendorRow[],
  offers: MarketplaceOfferRow[],
  locations: Record<string, any>[],
  taxonomy: { categories: Record<string, any>[]; subcategories: Record<string, any>[]; assignments: Record<string, any>[]; categoryAssignments?: Record<string, any>[] },
  now = Date.now(),
): { deals: Deal[]; partners: DirectoryItem[]; offers: DirectoryItem[]; categories: Category[] } {
  const categories: Category[] = taxonomy.categories.filter(row => row.active !== false).map(row => ({
    id: row.id, slug: row.slug, name: stringValue(row.payload?.nameEnglish, row.name), search: stringValue(row.payload?.nameEnglish, row.name), icon: row.payload?.icon || 'ShoppingBag',
    image: row.image_path || '', description: row.payload?.description || '', match: [],
    subcategories: [{ label: 'All', terms: [] }, ...taxonomy.subcategories.filter(sub => sub.category_id === row.id).map(sub => ({ id: sub.id, label: sub.name, terms: [], image: stringValue(sub.image_path) || undefined }))],
  }));
  const activeOffers = new Map<string, MarketplaceOfferRow[]>();
  const offerIndexes = new Map<string, number>();
  const vendorIndexes = new Map<string, number>();
  for (const offer of [...offers].sort((a,b) => numberValue(a.sort_order)-numberValue(b.sort_order) || String(a.id).localeCompare(String(b.id)))) {
    const index = vendorIndexes.get(offer.vendor_id) ?? 0;
    offerIndexes.set(offer.id, index);
    vendorIndexes.set(offer.vendor_id, index + 1);
    if (!isOfferAvailable(offer, now)) continue;
    const list = activeOffers.get(offer.vendor_id) ?? [];
    list.push(offer);
    activeOffers.set(offer.vendor_id, list);
  }
  const byVendorLocations = new Map<string, Record<string, any>[]>();
  for (const location of locations) {
    const list = byVendorLocations.get(location.vendor_id) ?? [];
    list.push(location);
    byVendorLocations.set(location.vendor_id, list);
  }

  const deals: Deal[] = [];
  const partners: DirectoryItem[] = [];
  const offerItems: DirectoryItem[] = [];
  for (const vendor of vendors) {
    if (vendor.status && vendor.status.toLowerCase() !== 'active') continue;
    const vendorOffers = (activeOffers.get(vendor.id) ?? []).sort((a, b) =>
      numberValue(a.sort_order) - numberValue(b.sort_order) || String(a.id).localeCompare(String(b.id)),
    );
    const offer = vendorOffers[0];
    if (!offer) continue;

    const payload = vendor.payload && typeof vendor.payload === 'object' ? vendor.payload : {};
    const primaryLocation = (byVendorLocations.get(vendor.id) ?? [])
      .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || numberValue(a.sort_order) - numberValue(b.sort_order))[0];
    const id = numberValue(vendor.catalogue_deal_id ?? payload.id, NaN);
    if (!Number.isInteger(id) || id < 1) continue;
    const name = stringValue(vendor.name, stringValue(payload.name, 'Kouponly partner'));
    const mainCategory = categories.find(category => category.id === vendor.category_id);
    if (!mainCategory) continue;
    const categoryIds = [...new Set([vendor.category_id, ...(taxonomy.categoryAssignments ?? []).filter(row => row.vendor_id === vendor.id).map(row => row.category_id)].filter((id): id is string => typeof id === 'string' && categories.some(category => category.id === id)))];
    if (!categoryIds.includes(mainCategory.id!)) categoryIds.unshift(mainCategory.id!);
    const categoryNames = categories.filter(category => categoryIds.includes(category.id!)).map(category => category.name);
    const category = mainCategory.name;
    const subcategoryIds = taxonomy.assignments.filter(row => row.vendor_id === vendor.id && row.category_id === mainCategory.id).map(row => row.subcategory_id);
    const subcategoryNames = mainCategory.subcategories.filter(sub => sub.id && subcategoryIds.includes(sub.id)).map(sub => sub.label);
    const place = stringValue(vendor.place_label, stringValue(primaryLocation?.address, stringValue(payload.address, 'Nearby')));
    const vendorImage = stringValue(vendor.cover_image_url, stringValue(vendor.image_url, stringValue(vendor.logo_path, stringValue(payload.profilePicture, ''))));
    const image = vendorImage;
    const offerTitle = stringValue(offer.title, stringValue(offer.payload?.titleEn, 'Member offer'));
    const description = stringValue(offer.description, stringValue(offer.payload?.descriptionEn, stringValue(vendor.description, '')));
    const saving = stringValue(offer.saving_label, stringValue(offer.payload?.savingLabel, stringValue(vendor.saving_label, 'Member offer')));
    const offerValue = numberValue(offer.offer_value ?? offer.discount_value ?? vendor.offer_value);
    const distanceKm = numberValue(vendor.distance_km, 0);
    const rating = vendor.rating == null ? '' : numberValue(vendor.rating).toFixed(1);
    const redemption: Deal['redemption'] = offer.redemption_mode === 'online' ? 'online' : 'inStore';
    const externalUrl = stringValue(vendor.website, stringValue(payload.website, '')) || undefined;
    const vendorLogo = stringValue(vendor.logo_path, stringValue(payload.profilePicture, stringValue(payload.logo))) || undefined;
    const deal: Deal = {
      id, vendorId: vendor.id, categoryId: mainCategory.id, categoryIds, subcategoryIds,
      offers: vendorOffers.map(row => {
        const badgeLabel = stringValue(row.payload?.badgeLabel);
        return { redemptionLimit: row.redemption_limit ?? undefined, redemptionCount: numberValue(row.redemption_count), branchIds: Array.isArray(row.payload?.branchIds) ? row.payload.branchIds.filter((id: unknown): id is string => typeof id === 'string') : [], currency: stringValue(row.currency) || undefined, id: row.id, index: offerIndexes.get(row.id)!, title: row.title, ...(badgeLabel ? { badgeLabel } : {}),
          logo: vendorLogo, description: row.description || '', saving: row.saving_label || '', terms: row.terms || undefined, redemptionInstructions: row.redemption_instructions || undefined,
          redemption: row.redemption_mode === 'online' ? 'online' : 'inStore', discountType: row.discount_type || row.payload?.discountType, discountValue: numberValue(row.discount_value ?? row.payload?.discountValue, NaN) };
      }),
      galleryImages: Array.isArray(vendor.gallery_images) ? vendor.gallery_images.filter((url: unknown) => typeof url === "string" && url.trim()) : [],
      phoneNumber: stringValue(vendor.phone, stringValue(payload.phoneNumber, stringValue(payload.phone, ''))) || undefined,
      openingHours: payload.openingHours ?? payload.opening_hours,
      vendorInformation: payload.vendorInformation ?? (payload.vendorInformationTitle || payload.vendorInformationMessage ? { title: payload.vendorInformationTitle, message: payload.vendorInformationMessage } : undefined),
      locations: (byVendorLocations.get(vendor.id) ?? []).map(row => ({id: row.id, branchId: row.payload?.id || row.id, name: row.name || '', address: row.address || '', phoneNumber: row.phone || row.payload?.phoneNumber,
        openingHours: row.payload?.openingHours ?? row.payload?.opening_hours,
        latitude: row.latitude == null ? undefined : numberValue(row.latitude), longitude: row.longitude == null ? undefined : numberValue(row.longitude) })),
      latitude: primaryLocation?.latitude == null ? undefined : numberValue(primaryLocation.latitude),
      longitude: primaryLocation?.longitude == null ? undefined : numberValue(primaryLocation.longitude),
      name,
      place,
      category,
      distance: distanceKm ? `${distanceKm.toFixed(1)} km` : 'Nearby',
      distanceKm,
      rating,
      offer: offerTitle,
      saving,
      cardLabel: stringValue(vendor.card_label).trim() || undefined,
      isSuggested: vendor.is_suggested === true,
      offerValue,
      newest: numberValue(vendor.new_deals_priority),
      trend: numberValue(vendor.trending_priority),
      image,
      logo: vendorLogo,
      color: stringValue(vendor.color, '#eef6ef'),
      description: stringValue(vendor.description, stringValue(payload.shortDescription, description)),
      redemption,
      externalUrl,
      instagramUrl: stringValue(payload.instagramUrl, stringValue(payload.instagram, '')) || undefined,
      keywords: [...(Array.isArray(payload.searchTokens) ? payload.searchTokens : []), ...categoryNames, ...subcategoryNames].filter(Boolean).join(' '),
      xcard: payload.xcard === true,
    };
    // Old deal metadata may identify its original subcategory (Dining/Cafes) as category.
    // After taxonomy normalization, retain the canonical Food parent for UI grouping.
    deal.category = mainCategory.name;
    deal.place = stringValue(vendor.place_label, stringValue(primaryLocation?.address, stringValue(payload.address, 'Nearby')));
    deals.push(deal);
    partners.push({
      id: `couponly-vendor-${vendor.id}`,
      type: 'Vendor', categoryId: mainCategory.id, categoryIds, subcategoryIds,
      title: name,
      subtitle: `${category} · ${place}`,
      tag: saving,
      offer: offerValue,
      newest: deal.newest,
      trend: deal.trend,
      distance: distanceKm,
      image,
      logo: deal.logo,
      dealId: id,
      keywords: [...(Array.isArray(payload.searchTokens) ? payload.searchTokens : []), name, ...categoryNames, ...subcategoryNames, place, ...vendorOffers.map(row => row.title)].filter(Boolean).join(' '),
      description,
      action: 'View offers',
      redemption: deal.redemption,
      externalUrl: deal.externalUrl,
    });
    for (const vendorOffer of vendorOffers) {
      const title = stringValue(vendorOffer.title, stringValue(vendorOffer.payload?.titleEn, 'Member offer'));
      const detail = stringValue(vendorOffer.description, stringValue(vendorOffer.payload?.descriptionEn, description));
      const offerSaving = stringValue(vendorOffer.saving_label, stringValue(vendorOffer.payload?.savingLabel, saving));
      offerItems.push({
        id: `couponly-offer-${vendorOffer.id}`,
        type: 'Offer', categoryId: mainCategory.id, categoryIds, subcategoryIds, offerIndex: offerIndexes.get(vendorOffer.id),
        title,
        subtitle: `${name} · ${place}`,
        tag: offerSaving,
        offer: numberValue(vendorOffer.offer_value ?? vendorOffer.discount_value ?? vendor.offer_value),
        newest: deal.newest,
        trend: deal.trend,
        distance: distanceKm,
        image,
        logo: vendorLogo,
        dealId: id,
        keywords: `${name} ${categoryNames.join(" ")} ${subcategoryNames.join(" ")} ${place} ${title}`,
        description: detail,
        action: 'Unlock offer',
        redemption: vendorOffer.redemption_mode === 'online' ? 'online' : 'inStore',
        externalUrl: deal.externalUrl,
      });
    }
  }
  return { deals, partners, offers: offerItems, categories };
}
