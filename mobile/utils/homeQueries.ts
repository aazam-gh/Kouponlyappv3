import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { getSupabase } from '@/lib/supabase';
import { fetchCloudCatalogue } from '@/lib/backend';
import { queryClient, queryKeys } from './queryClient';
import type { Opportunity } from '../types/opportunities';
export type HomeLocale='en';
export type HomeCategoryItem={id:string;name:string;englishName?:string;image?:string|number;icon?:string};
export type HomeBannerItem={bannerId:string;altText:string;id?:string;images:{desktop?:string;mobile?:string};isActive:boolean;vendorId?:string;lastUpdated?:string};
export type HomeFeaturedBannerItem={id:string;vendorId:string;title?:string;imageUrl?:string;imagePositionY?:number;ctaText?:string;isActive:boolean;order?:number};
export type HomeBrandItem={id:string;name:string;logoUrl:string;vendorId:string;isActive:boolean};
export type HomeOfferCard={id:string;vendorId:string;nameEn?:string;vendorName?:string;shortDescription?:string;brandDescription?:string;descriptionEn?:string;bannerImage?:string;coverImage?:string;vendorProfilePicture?:string;profilePicture?:string;distance?:string;isTrending?:boolean;xcard?:boolean;[key:string]:any};
export const isValidHomeFeaturedBanner=(row:HomeFeaturedBannerItem)=>Boolean(row?.id&&row?.vendorId&&row?.isActive!==false&&row?.imageUrl);
const catalogue=()=>queryClient.fetchQuery({queryKey:queryKeys.catalogueHome(),queryFn:fetchCloudCatalogue});
const vendorCards=async()=>{const catalog=await catalogue();return catalog.deals.map(deal=>({id:String(deal.vendorId||deal.id),vendorId:String(deal.vendorId||deal.id),nameEn:deal.name,vendorName:deal.name,shortDescription:deal.description,bannerImage:deal.image,coverImage:deal.image,vendorProfilePicture:deal.logo,profilePicture:deal.logo,distance:deal.distanceKm>0?deal.distance:undefined,xcard:deal.xcard,isTrending:deal.trend>0} as HomeOfferCard))};
const cms=async<T>(id:string)=>{const {data,error}=await getSupabase().from('realx_cms_documents').select('payload').eq('id',id).maybeSingle();if(error)throw error;return (data?.payload||{}) as T};
export const homeQueryOptions={
 categories:(locale:HomeLocale)=>queryOptions<HomeCategoryItem[]>({queryKey:queryKeys.categories(locale),queryFn:async()=>{const catalog=await catalogue();return catalog.categories.map(row=>({id:String(row.id),name:row.name,englishName:row.name,image:row.image,icon:row.icon}))}}),
 promoBanners:()=>queryOptions<HomeBannerItem[]>({queryKey:queryKeys.cmsDocument('banner'),queryFn:async()=>{const result=await cms<{banners?:HomeBannerItem[]}>('banner');return (result.banners||[]).filter(row=>row.isActive)}}),
 offers:()=>queryOptions<HomeOfferCard[]>({queryKey:queryKeys.trendingOffers(),queryFn:async()=>vendorCards().then(cards=>cards.slice().sort((a,b)=>(b.isTrending?1:0)-(a.isTrending?1:0)))}),
 featuredBanner:()=>queryOptions<HomeFeaturedBannerItem[]>({queryKey:queryKeys.cmsDocument('featuredBrandShowcase'),queryFn:async()=>{const result=await cms<{items?:HomeFeaturedBannerItem[]}>('featuredBrandShowcase');return (result.items||[]).filter(isValidHomeFeaturedBanner).sort((a,b)=>(a.order||0)-(b.order||0))}}),
 brands:()=>queryOptions<HomeBrandItem[]>({queryKey:queryKeys.cmsDocument('brand'),queryFn:async()=>{const result=await cms<{brands?:HomeBrandItem[]}>('brand');return (result.brands||[]).filter(row=>row.isActive)}}),
 opportunities:()=>queryOptions<Opportunity[]>({queryKey:queryKeys.opportunities(),queryFn:async()=>{const {data,error}=await getSupabase().from('realx_opportunities').select('*').eq('published',true).order('created_at',{ascending:false}).limit(20);if(error)throw error;return data as Opportunity[]}}),
};
export function preloadHomeData(locale:HomeLocale,client:QueryClient=queryClient){const criticalReady=Promise.all([client.fetchQuery(homeQueryOptions.categories(locale)),client.fetchQuery(homeQueryOptions.offers())]).then(()=>undefined);return {criticalReady,completion:criticalReady}}
