export type Deal = {
  id:number; vendorId?:string; categoryId?:string; categoryIds?:string[]; subcategoryIds?:string[]; offers?:VendorOffer[]; locations?:VendorLocation[]; galleryImages?:string[]; phoneNumber?:string; openingHours?:unknown; vendorInformation?:{title?:string;message?:string}; name:string; place:string; category:string; distance:string; distanceKm:number; rating:string;
  offer:string; saving:string; offerValue:number; newest:number; trend:number; image:string; logo?:string; cardLabel?:string;
  color?:string; description:string; redemption?:"online"|"inStore"; externalUrl?:string; instagramUrl?:string; keywords?:string; latitude?:number; longitude?:number; xcard?:boolean;
};

export const onlineUrlFor = (name:string, explicitUrl?:string) => explicitUrl || `https://www.google.com/search?q=${encodeURIComponent(name)}`;
export type VendorOffer = {currency?:string; id:string; index:number; title:string; badgeLabel?:string; logo?:string; description:string; saving:string; terms?:string; redemptionInstructions?:string; redemption:"online"|"inStore"; discountType?:string; discountValue?:number};
export function dealDiscountLabel(deal: Deal): string | undefined {
  const offer = deal.offers?.filter(row => ['percentage', 'amount'].includes(row.discountType || '') && Number.isFinite(row.discountValue) && row.discountValue! > 0)
    .reduce<VendorOffer | undefined>((highest, row) => !highest || row.discountValue! > highest.discountValue! ? row : highest, undefined) ?? deal.offers?.[0];
  if (offer?.badgeLabel?.trim()) return offer.badgeLabel.trim();
  if (offer?.discountType === 'percentage' && Number.isFinite(offer.discountValue) && offer.discountValue! > 0) return `${offer.discountValue}% OFF`;
  if (offer?.discountType === 'amount' && Number.isFinite(offer.discountValue) && offer.discountValue! > 0) return `${offer.currency === 'INR' ? '₹' : offer.currency || 'INR'} ${offer.discountValue} OFF`;
  if (offer?.discountType === 'free') return 'FREE';
  if (offer && ['combo', 'fixed_price'].includes(offer.discountType || '')) return `Kouponly Exclusive Price ${offer.currency === 'INR' ? '₹' : offer.currency || 'INR'} ${offer.discountValue}`;
  if (offer?.discountType === 'buy1get1') return 'Buy 1, Get 1';
  const saving = offer?.saving?.trim() || deal.saving?.trim();
  if (saving && !/^member offer$/i.test(saving)) return saving;
  const title = offer?.title?.trim() || deal.offer?.trim();
  return title && !/^member offer$/i.test(title) ? title : undefined;
}
export type VendorLocation = {id:string; name:string; address:string; phoneNumber?:string; openingHours?:unknown; latitude?:number; longitude?:number};
export type Subcategory = { id?:string; label:string; terms:string[]; image?:string };
export type Category = { id?:string; slug?:string; name:string; search:string; icon:string; image:string; description:string; match:string[]; subcategories:Subcategory[] };
export type DirectoryType = "Vendor"|"Offer"|"Experience"|"Course"|"Internship"|"Freelance"|"Job"|"Prize";
export type DirectoryItem = {
  id:string; categoryId?:string; categoryIds?:string[]; subcategoryIds?:string[]; offerIndex?:number; type:DirectoryType; title:string; subtitle:string; tag:string; offer:number; newest:number; trend:number;
  distance:number; image:string; logo?:string; dealId?:number; keywords:string; description:string; action:string;
  destination?:"work"|"rewards"; externalUrl?:string; redemption?:"online"|"inStore";
};
export type HeroSlide = {brand:string;kicker:string;title:string;copy:string;cta:string;image:string;logo?:string;dealId:number};
export type Reward = {id:string;name:string;detail:string;points:number;image:string};
export type AccountSection = "personal"|"savings"|"earnings"|"membership"|"settings"|"help"|"feedback"|"legal";

// Supabase owns catalogue content. Empty arrays are the initial and empty states.
export const deals:Deal[]=[];
export const categories:Category[]=[];
export const heroSlides:HeroSlide[]=[];
export const directoryItems:DirectoryItem[]=[];
export const rewards:Reward[]=[];

export const searchDirectory=(query:string,filter="All",sort="Trending")=>{
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered=directoryItems.filter(item=>(filter==="All"||item.type===filter)&&terms.every(term=>`${item.title} ${item.subtitle} ${item.keywords} ${item.type}`.toLowerCase().includes(term)));
  return [...filtered].sort((a,b)=>sort==="A-Z"?a.title.localeCompare(b.title):sort==="Highest offer"?b.offer-a.offer:sort==="Newest"?b.newest-a.newest:sort==="Nearest"?a.distance-b.distance:b.trend-a.trend);
};
export const categoryItems=(category:Category,subcategory="All",query="")=>{
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const sub=category.subcategories.find(item=>item.label===subcategory);
  return directoryItems.filter(item=>{
    const hay=`${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
    return (item.categoryId===category.id || item.categoryIds?.includes(category.id || '')) && (subcategory==="All" || !!sub?.id && !!item.subcategoryIds?.includes(sub.id))
      && terms.every(term=>hay.includes(term));
  });
};
export const dealById=(id:string|number)=>deals.find(deal=>deal.id===Number(id));
export const listingById=(id:string)=>directoryItems.find(item=>item.id===id);
export const categoryBySlug=(slug:string)=>categories.find(category=>(category.slug??category.name.toLowerCase().replace(/\s+/g,"-"))===slug.toLowerCase());

export type CataloguePatch={deals?:Deal[];categories?:Category[];heroSlides?:HeroSlide[];directoryItems?:DirectoryItem[];rewards?:Reward[]};
export function applyCataloguePatch(patch:CataloguePatch){
  if(patch.deals!==undefined)deals.splice(0,deals.length,...patch.deals);
  if(patch.categories!==undefined)categories.splice(0,categories.length,...patch.categories);
  if(patch.heroSlides!==undefined)heroSlides.splice(0,heroSlides.length,...patch.heroSlides);
  if(patch.directoryItems!==undefined)directoryItems.splice(0,directoryItems.length,...patch.directoryItems);
  if(patch.rewards!==undefined)rewards.splice(0,rewards.length,...patch.rewards);
}
