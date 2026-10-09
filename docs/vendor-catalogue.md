# Vendor catalogue

Supabase is the mobile catalogue source. Main categories are Food, Stays, Entertainment, Beauty, Fitness, Shopping, and Travel. Dining/Cafes migrate to Food, Staycations becomes Stays, and Activities joins Entertainment. IDs of retained categories remain stable.

| Table | Purpose |
| --- | --- |
| `couponly_categories` | Main categories; active flag, ordering, optional category image |
| `couponly_vendors` | Business; exactly one required `category_id` |
| `couponly_subcategories` | Subcategory with a required parent category |
| `couponly_vendor_subcategories` | Many assignments per vendor; composite foreign keys enforce the same main category |
| `couponly_offers` | Vendor's individual offers, dates, terms, images, redemption mode |
| `couponly_vendor_locations` | Vendor's branches, addresses, and optional coordinates |

Food includes Rice, Biryani, Mains, Snacks, Drinks, Sweets, Dietary, Vegetarian, Vegan, Breakfast, Buffet, Cuisines, and Cafes. Stays includes Homestays, Hotels, Resorts, and Staycations. A vendor may select multiple subcategories, such as Rice and Sweets. These are explicit assignments; mobile does not guess them from text.

The existing admin category editor and vendor main-category/multiple-subcategory picker remain the management interface. Database triggers translate their embedded JSON writes to normalized rows in the same transaction. Mobile reads normalized rows. Current vendors have no inferred subcategory assignments; select their actual tags in the admin.

Mobile starts empty, loads active categories/vendors and current offers, and updates on database changes. Empty responses clear old records. Refresh errors keep only the previously fetched Supabase content and offer retry. The detail screen exposes all current offers and branches; an offer link selects that specific offer. Missing coordinates do not create map markers at 0,0.

Bundled sample vendors, generated category listings, fabricated rewards, demo profile details, pre-saved vendors, and default demo points are removed. Legacy discovery/offer/category/promotion/reward rows are unpublished rather than deleted. The separate root website showcase keeps its own demo file outside the mobile app.

Existing imported vendor records in Supabase are preserved. This source migration does not certify those offers as real partner offers or delete those records.

Checks: `npm test --prefix mobile`, `npm run typecheck --prefix mobile`, `npm run check --prefix web`, and `supabase db query --linked --file supabase/tests/uniform_vendor_taxonomy.sql`. The SQL check rolls back all test records. An iOS JavaScript export checks bundling, not installation or native device behavior.

Schema enforcement uses [PostgreSQL foreign keys](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-FK) and [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
