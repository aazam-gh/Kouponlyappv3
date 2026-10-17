import { projectVendorCatalogue } from '../lib/vendor-catalogue';
import { fixture, vendor, taxonomy, offers, locations } from '../test/catalogue-fixture';

describe('normalized vendor catalogue projection',()=>{
  it('uses database category IDs and preserves every current offer and branch',()=>{
    const result=fixture();
    expect(result.deals[0]).toMatchObject({id:101,name:'Test Kitchen',category:'Food',categoryId:'food',subcategoryIds:['rice','sweets'],latitude:10,longitude:76});
    expect(result.deals[0].offers?.map(row=>row.index)).toEqual([1,2]);
    expect(result.deals[0].locations).toHaveLength(2);
    expect(result.deals[0].locations?.[1].latitude).toBeUndefined();
    expect(result.partners[0].keywords).toContain('Sweets');
    expect(result.offers[1]).toMatchObject({offerIndex:2,title:'Sweets discount',subcategoryIds:['rice','sweets']});
  });
  it('omits inactive, uncategorized, expired, future, or offerless vendors',()=>{
    for(const change of [{status:'Inactive'},{category_id:'missing'}]) expect(projectVendorCatalogue([{...vendor,...change}],offers,locations,taxonomy).deals).toEqual([]);
    expect(projectVendorCatalogue([vendor],[offers[0],{...offers[1],starts_at:'2099-01-01'},{...offers[2],active:false}],locations,taxonomy).deals).toEqual([]);
    expect(projectVendorCatalogue([vendor],[],locations,taxonomy).deals).toEqual([]);
  });
  it('uses uploaded cover photos and the vendor logo for every offer',()=>{
    const uploaded={...vendor,logo_path:'https://example.test/logo.png',cover_image_url:'https://example.test/banner.jpg',description:'Business description',gallery_images:['https://example.test/gallery.jpg'],payload:{logo:'https://example.test/stale-logo.png'}};
    const result=projectVendorCatalogue([uploaded],offers,locations,taxonomy);
    expect(result.deals[0]).toMatchObject({image:'https://example.test/banner.jpg',logo:'https://example.test/logo.png',description:'Business description'});
    expect(result.deals[0].galleryImages).toEqual(['https://example.test/gallery.jpg']);
    expect(result.deals[0].offers?.every(offer => offer.logo === uploaded.logo_path)).toBe(true);
    expect(result.offers.every(offer => offer.logo === uploaded.logo_path)).toBe(true);
    const fallback=projectVendorCatalogue([uploaded],[{...offers[1],image_url:''}],locations,taxonomy);
    expect(fallback.deals[0].image).toBe('https://example.test/banner.jpg');
    expect(fallback.offers[0].image).toBe('https://example.test/banner.jpg');
    expect(fallback.deals[0].logo).toBe('https://example.test/logo.png');
  });
  it('uses one vendor badge regardless of offer order, availability or legacy labels',()=>{
    const branded={...vendor,card_label:'Student favourite'};
    const legacyOffers=offers.map(offer=>({...offer,payload:{cardLabels:['Offer badge','Extra badge']}}));
    const label=(rows: typeof legacyOffers)=>projectVendorCatalogue([branded],rows,locations,taxonomy).deals[0].cardLabel;
    expect(label(legacyOffers)).toBe('Student favourite');
    expect(label(legacyOffers.map(offer=>({...offer,sort_order:-offer.sort_order})))).toBe('Student favourite');
    expect(label(legacyOffers.map(offer=>offer.id==='rice-offer'?{...offer,active:false}:offer))).toBe('Student favourite');
    const cleared=projectVendorCatalogue([{...branded,card_label:null}],legacyOffers,locations,taxonomy);
    expect(cleared.deals[0].cardLabel).toBeUndefined();
    expect(cleared.deals[0].offers?.[0]).not.toHaveProperty('cardLabels');
  });
  it('uses only the vendor website for an online offer',()=>{
    const result=projectVendorCatalogue([{...vendor,website:'https://example.test/store'}],[{...offers[1],redemption_mode:'online'}],locations,taxonomy);
    expect(result.deals[0]).toMatchObject({redemption:'online',externalUrl:'https://example.test/store'});
  });
  it('preserves redemption fields and the XCard flag from Supabase rows',()=>{
    const result=projectVendorCatalogue([{...vendor,payload:{...vendor.payload,xcard:true}}],[{...offers[1],discount_type:'percentage',discount_value:20}],locations,taxonomy);
    expect(result.deals[0]).toMatchObject({xcard:true});
    expect(result.deals[0].offers?.[0]).toMatchObject({discountType:'percentage',discountValue:20});
  });
});
