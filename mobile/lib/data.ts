import raw from "./catalogue.generated.json";

export type Deal = {
  id:number; name:string; place:string; category:string; distance:string; distanceKm:number; rating:string;
  offer:string; saving:string; offerValue:number; newest:number; trend:number; image:string; logo?:string;
  color?:string; description:string; redemption?:"online"|"inStore"; externalUrl?:string;
};

const onlineCategories = new Set(["Shopping", "Travel", "Entertainment"]);
const knownPartnerUrls:Record<string,string> = {
  "Westside":"https://www.westside.com/",
  "IndiGo":"https://www.goindigo.in/",
  "PVR Cinemas":"https://www.pvrcinemas.com/",
  "Croma":"https://www.croma.com/",
  "Cinepolis":"https://cinepolisindia.com/",
};
const partnerSearchUrl = (name:string) => `https://www.google.com/search?q=${encodeURIComponent(`${name} Kerala`)}`;
export const onlineUrlFor = (name:string, explicitUrl?:string) => explicitUrl ?? knownPartnerUrls[name] ?? partnerSearchUrl(name);
export type Subcategory = { label:string; terms:string[] };
export type Category = { name:string; search:string; icon:string; image:string; description:string; match:string[]; subcategories:Subcategory[] };
export type DirectoryType = "Vendor"|"Offer"|"Experience"|"Course"|"Internship"|"Freelance"|"Job"|"Prize";
export type DirectoryItem = {
  id:string; type:DirectoryType; title:string; subtitle:string; tag:string; offer:number; newest:number; trend:number;
  distance:number; image:string; logo?:string; dealId?:number; keywords:string; description:string; action:string;
  destination?:"work"|"rewards"; externalUrl?:string; redemption?:"online"|"inStore";
};
export type HeroSlide = {brand:string;kicker:string;title:string;copy:string;cta:string;image:string;logo?:string;dealId:number};
export type Campaign = {id:string;brand:string;title:string;payment:string;due:string;method:string;image:string;brief:string;deliverables?:string[]};
export type Reward = {id:string;name:string;detail:string;points:number;image:string};
export type AccountSection = "personal"|"savings"|"earnings"|"membership"|"gifts"|"settings"|"help"|"feedback"|"legal";

type Seed=[string,string,string,string,number,number,string,string];
const source=raw as unknown as {
  deals:Deal[];
  categories:{name:string;search:string;icon:string;image:string}[];
  categoryDetails:Record<string,{description:string;match:string[];subcategories:Subcategory[]}>;
  placeholderPartnerSeeds:Seed[];supplementalPartnerSeeds:Seed[];foodCategorySeeds:Seed[];
  heroSlides:Omit<HeroSlide,"dealId">[];jobPlaceholderItems:DirectoryItem[];directoryExtras:DirectoryItem[];
};

export const deals:Deal[]=source.deals.map(deal=>({
  ...deal,
  redemption:onlineCategories.has(deal.category)?"online":"inStore",
  externalUrl:onlineCategories.has(deal.category)?onlineUrlFor(deal.name):undefined,
}));
export const categories:Category[]=source.categories.map(item=>({
  ...item,
  description:source.categoryDetails[item.name]?.description??`Discover ${item.name.toLowerCase()} around Kerala.`,
  match:source.categoryDetails[item.name]?.match??[item.name.toLowerCase(),item.search],
  subcategories:source.categoryDetails[item.name]?.subcategories??[{label:"All",terms:[]}],
}));
export const heroSlides:HeroSlide[]=source.heroSlides.map(slide=>({
  ...slide,
  dealId:deals.find(deal=>deal.name.toLowerCase().replace(/[’']/g,"")===slide.brand.toLowerCase().replace(/[’']/g,""))?.id??1,
}));

const allPartnerSeeds=[...source.placeholderPartnerSeeds,...source.supplementalPartnerSeeds,...source.foodCategorySeeds.map(([category,name,place,tag,offer,distance,keywords,image])=>[name,category,place,tag,offer,distance,keywords,image] as Seed)];
const placeholderPartners:DirectoryItem[]=allPartnerSeeds.map(([name,category,place,tag,offer,distance,keywords,image],index)=>({
  id:`partner-placeholder-${index+1}`,type:category==="Learn"?"Course":category==="Internships"?"Internship":category==="Freelance"?"Freelance":"Vendor",
  title:name,subtitle:`${category} · ${place}`,tag,offer,newest:70-(index%50),trend:96-(index%13),distance,image,
  keywords:`${category} ${keywords} partner place offer Kerala`,description:`${name} is a Kouponly partner listing for ${category.toLowerCase()} discovery. Offer details, availability and redemption instructions are shown before use.`,
  action:category==="Learn"?"Open learning page":category==="Internships"?"View internship":category==="Freelance"?"View project":"Redeem offer",
  redemption:["Shopping","Travel"].includes(category)?"online":category==="Learn"||category==="Internships"||category==="Freelance"?undefined:"inStore",
  externalUrl:["Shopping","Travel"].includes(category)?onlineUrlFor(name):undefined,
}));

const normalizedExtras=source.directoryExtras.map(item=>({
  ...item,
  redemption:item.redemption??(["Experience"].includes(item.type)?"online":undefined),
  externalUrl:(item.redemption??(["Experience"].includes(item.type)?"online":undefined))==="online"?onlineUrlFor(item.title,item.externalUrl):item.externalUrl,
})) as DirectoryItem[];
export const directoryItems:DirectoryItem[]=[
  ...deals.map(deal=>({id:`partner-${deal.id}`,type:"Vendor" as const,title:deal.name,subtitle:`${deal.category} · ${deal.place}`,tag:deal.saving,offer:deal.offerValue,newest:deal.newest,trend:deal.trend,distance:deal.distanceKm,image:deal.image,logo:deal.logo,dealId:deal.id,keywords:`${deal.category} offer brand partner place Kochi`,description:deal.description,action:"View offers",redemption:deal.redemption,externalUrl:deal.externalUrl})),
  ...placeholderPartners,
  ...deals.slice(0,6).map(deal=>({id:`offer-${deal.id}`,type:"Offer" as const,title:deal.offer,subtitle:`${deal.name} · ${deal.place}`,tag:deal.saving,offer:deal.offerValue,newest:deal.newest+2,trend:deal.trend-2,distance:deal.distanceKm,image:deal.image,dealId:deal.id,keywords:`${deal.category} deal discount save`,description:deal.description,action:"Unlock offer",redemption:deal.redemption,externalUrl:deal.externalUrl})),
  ...normalizedExtras,
  ...source.jobPlaceholderItems,
];

export const foodSubcategoryItems:DirectoryItem[]=source.foodCategorySeeds.flatMap(([category,name,place,baseTag,offer,distance,,image],vendorIndex)=>{
  const detail=source.categoryDetails[category];
  return (detail?.subcategories??[]).filter(sub=>sub.label!=="All").map((sub,subIndex)=>({
    id:`food-subcategory-${category.toLowerCase()}-${sub.label.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-${vendorIndex}`,
    type:"Vendor",title:name,subtitle:`${category} · ${sub.label} · ${place}`,tag:`${sub.label} offer · ${baseTag}`,offer,
    newest:80-subIndex-vendorIndex,trend:96-((vendorIndex+subIndex*2)%11),distance,image,
    keywords:`${category} ${sub.label} ${sub.terms.join(" ")} partner food Kerala`,description:`${name} is featured for ${sub.label.toLowerCase()} in ${place}. Open the listing to view the member offer and redemption details.`,action:"Redeem offer",redemption:"inStore",
  } as DirectoryItem));
});

export const campaigns:Campaign[]=[
  {id:"paragon-reel",brand:"Paragon",title:"Film a dinner-for-two Reel",payment:"₹4,500",due:"Apply by Aug 8",method:"Visit the restaurant",image:deals[0].image,brief:"You will receive a clear shot list and one review round. Submit the clean final video plus the approved social post.",deliverables:["Visit the restaurant","One vertical video, 20–35 seconds","Pay: ₹4,500 after approval and posting","Apply by Aug 8"]},
  {id:"beauty-unbox",brand:"Nykaa Luxe",title:"Create a beauty unboxing",payment:"₹6,000",due:"Apply by Aug 10",method:"Package sent to you",image:deals[7].image,brief:"Unbox your favourites naturally, then submit the clean final video and the approved social post.",deliverables:["Package sent to you","One vertical video, 20–35 seconds","Pay: ₹6,000 after approval and posting","Apply by Aug 10"]},
  {id:"pool-day",brand:"Kochi Marriott",title:"Capture a pool-day story",payment:"₹7,500",due:"Apply by Aug 12",method:"Visit the property",image:deals[6].image,brief:"Capture arrival, pool and lunch moments before submitting your approved story set.",deliverables:["Visit the property","Four vertical stories","Pay: ₹7,500 after approval and posting","Apply by Aug 12"]},
];
export const rewards:Reward[]=[
  {id:"coffee",name:"Free coffee",detail:"Any regular drink",points:200,image:deals[1].image},
  {id:"burger",name:"Free burger meal",detail:"Burger, fries and drink",points:450,image:deals[3].image},
  {id:"pottery",name:"Pottery workshop",detail:"Mattancherry · 90 minutes",points:650,image:source.directoryExtras.find(x=>x.id==="pottery")?.image??deals[4].image},
  {id:"kayak",name:"Kayaking experience",detail:"Kadamakkudy morning",points:900,image:source.directoryExtras.find(x=>x.id==="kayak")?.image??deals[12].image},
];

export const searchDirectory=(query:string,filter="All",sort="Trending")=>{
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered=directoryItems.filter(item=>(filter==="All"||item.type===filter)&&terms.every(term=>`${item.title} ${item.subtitle} ${item.keywords} ${item.type}`.toLowerCase().includes(term)));
  return [...filtered].sort((a,b)=>sort==="A-Z"?a.title.localeCompare(b.title):sort==="Highest offer"?b.offer-a.offer:sort==="Newest"?b.newest-a.newest:sort==="Nearest"?a.distance-b.distance:b.trend-a.trend);
};
export const categoryItems=(category:Category,subcategory="All",query="")=>{
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const sub=category.subcategories.find(item=>item.label===subcategory);
  const pool=subcategory==="All"?directoryItems:foodSubcategoryItems;
  return pool.filter(item=>{
    const hay=`${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
    const categoryMatch=category.match.some(term=>hay.includes(term.toLowerCase()));
    const subMatch=!sub?.terms.length||sub.terms.some(term=>hay.includes(term.toLowerCase()));
    return categoryMatch&&subMatch&&terms.every(term=>hay.includes(term));
  });
};
export const dealById=(id:string|number)=>deals.find(deal=>deal.id===Number(id));
export const listingById=(id:string)=>[...directoryItems,...foodSubcategoryItems].find(item=>item.id===id);
export const categoryBySlug=(slug:string)=>categories.find(category=>category.name.toLowerCase().replace(/\s+/g,"-")===slug.toLowerCase());

export type CataloguePatch={deals?:Deal[];categories?:Category[];heroSlides?:HeroSlide[];directoryItems?:DirectoryItem[];campaigns?:Campaign[];rewards?:Reward[]};
export function applyCataloguePatch(patch:CataloguePatch){
  if(patch.deals?.length)deals.splice(0,deals.length,...patch.deals.map(deal=>({...deal,
    redemption:deal.redemption??(onlineCategories.has(deal.category)?"online":"inStore"),
    externalUrl:deal.externalUrl??(onlineCategories.has(deal.category)?onlineUrlFor(deal.name):undefined),
  })));
  if(patch.categories?.length)categories.splice(0,categories.length,...patch.categories);
  if(patch.heroSlides?.length)heroSlides.splice(0,heroSlides.length,...patch.heroSlides);
  if(patch.directoryItems?.length)directoryItems.splice(0,directoryItems.length,...patch.directoryItems);
  if(patch.campaigns?.length)campaigns.splice(0,campaigns.length,...patch.campaigns);
  if(patch.rewards?.length)rewards.splice(0,rewards.length,...patch.rewards);
}
