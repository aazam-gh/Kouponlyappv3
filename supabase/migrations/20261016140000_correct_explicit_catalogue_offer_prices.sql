-- Correct only unchanged catalogue samples whose titles state an exact rate or price.
-- Update the CMS source so its normal trigger keeps normalized offers in agreement.
with corrections(vendor_id,title,old_value,kind,value,label) as (values
 ('catalogue-vendor-3','Two Zinger combos for ₹499',260::numeric,'combo',499::numeric,'Kouponly Exclusive Price ₹499'),
 ('catalogue-vendor-6','Hair spa and styling, 40% off',900,'percentage',40,'40% off'),
 ('catalogue-vendor-8','20% off selected beauty favourites',800,'percentage',20,'20% off'),
 ('catalogue-vendor-10','Extra 15% off your member basket',1250,'percentage',15,'15% off'),
 ('catalogue-vendor-12','Two premium tickets for ₹499',350,'fixed_price',499,'Kouponly Exclusive Price ₹499'),
 ('catalogue-vendor-13','Waterpark entry, 25% off',750,'percentage',25,'25% off'),
 ('catalogue-vendor-14','10% off selected accessories',1500,'percentage',10,'10% off'),
 ('catalogue-vendor-15','Family chicken bucket at ₹699',420,'fixed_price',699,'Kouponly Exclusive Price ₹699')
)
update public.couponly_vendors v set payload=jsonb_set(v.payload,'{offers,0}',
 (v.payload#>'{offers,0}') || jsonb_build_object('discountType',c.kind,'discountValue',c.value,'savingLabel',c.label))
from corrections c join public.couponly_offers o on o.vendor_id=c.vendor_id and o.id=c.vendor_id||':embedded:1'
where v.id=c.vendor_id and o.title=c.title and o.discount_type='amount' and o.discount_value=c.old_value
 and v.payload#>>'{offers,0,titleEn}'=c.title and v.payload#>>'{offers,0,discountType}'='amount'
 and v.payload#>'{offers,0,discountValue}'=to_jsonb(c.old_value);
notify pgrst,'reload schema';
