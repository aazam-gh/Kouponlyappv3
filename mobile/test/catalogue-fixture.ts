import { applyCataloguePatch } from '../lib/data';
import { projectVendorCatalogue } from '../lib/vendor-catalogue';

export const taxonomy = {
  categories: [{id:'food',name:'Food',slug:'food',active:true}, {id:'stays',name:'Stays',slug:'stays',active:true}],
  subcategories: [{id:'rice',category_id:'food',name:'Rice'}, {id:'sweets',category_id:'food',name:'Sweets'}, {id:'homestays',category_id:'stays',name:'Homestays'}],
  assignments: [{vendor_id:'vendor-1',subcategory_id:'rice',category_id:'food'}, {vendor_id:'vendor-1',subcategory_id:'sweets',category_id:'food'}],
};
export const vendor = {id:'vendor-1',name:'Test Kitchen',status:'Active',catalogue_deal_id:101,category_id:'food',image_url:'https://example.test/kitchen.jpg',featured:true,payload:{mainCategory:'Wrong legacy label'}};
export const offers = [
  {id:'expired',vendor_id:'vendor-1',title:'Expired offer',active:true,sort_order:0,ends_at:'2020-01-01T00:00:00Z'},
  {id:'rice-offer',vendor_id:'vendor-1',title:'Rice lunch discount',image_url:'https://example.test/rice.jpg',description:'Lunch offer details',saving_label:'Lunch saving',active:true,sort_order:1,redemption_mode:'inStore'},
  {id:'sweets-offer',vendor_id:'vendor-1',title:'Sweets discount',image_url:'https://example.test/sweets.jpg',description:'Dessert details',terms:'Valid weekdays',redemption_instructions:'Show this offer at the counter',active:true,sort_order:2,redemption_mode:'inStore'},
];
export const locations = [{id:'branch-1',vendor_id:'vendor-1',name:'Waterfront',address:'Waterfront road',latitude:10,longitude:76,is_primary:true}, {id:'branch-2',vendor_id:'vendor-1',address:'Second branch',latitude:null,longitude:null}];
export const fixture = () => projectVendorCatalogue([vendor],offers,locations,taxonomy);
export const loadFixture = () => { const catalog=fixture(); applyCataloguePatch({...catalog,directoryItems:[...catalog.partners,...catalog.offers],heroSlides:[],rewards:[]}); };
export const clearFixture = () => applyCataloguePatch({deals:[],categories:[],directoryItems:[],heroSlides:[],rewards:[]});
