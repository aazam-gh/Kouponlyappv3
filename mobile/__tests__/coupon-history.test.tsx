import React from 'react';
import { Alert } from 'react-native';
import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider } from '../context/AppThemeContext';
import { LocaleProvider } from '../context/LocaleContext';
import History from '../app/kouponly/history';
let mockUser:{id:string}|null={id:'alice'}; let mockAuthLoading=false; let mockFocused=true; const mockRows=jest.fn();
jest.mock('expo-router',()=>({router:{push:jest.fn(),replace:jest.fn(),back:jest.fn()},useIsFocused:()=>mockFocused,useFocusEffect:(callback:any)=>require('react').useEffect(callback,[callback])}));
jest.mock('../lib/auth',()=>({useAuth:()=>({user:mockUser,loading:mockAuthLoading})}));
jest.mock('../lib/data',()=>({deals:[]}));
jest.mock('../lib/supabase',()=>({getSupabase:()=>({from:(table:string)=>{let owner='';const q:any={select:()=>q,eq:(field:string,value:string)=>{if(field==='student_id'||field==='user_id')owner=value;return q;},not:()=>q,order:()=>q,limit:()=>mockRows(table,owner)};return q;}})}));
const node=()=> <SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:393,height:852},insets:{top:59,bottom:34,left:0,right:0}}}><AppThemeProvider><LocaleProvider><History/></LocaleProvider></AppThemeProvider></SafeAreaProvider>;
const receipt=(name:string)=>({redemption_id:'coupon-'+name,code:'CODE123',vendor_id:'vendor',offer_snapshot:{vendorName:name,title:'Test offer'},consumed_at:'2026-10-08T10:00:00Z'});
beforeEach(()=>{mockFocused=true;mockAuthLoading=false;mockUser={id:'alice'};mockRows.mockReset();});afterEach(cleanup);
it('renders preserved coupon snapshots with status instead of a fabricated paid amount',async()=>{
 mockRows.mockImplementation((table:string)=>Promise.resolve({data:table==='redemptions'?[receipt('Original vendor')]:[],error:null}));
 const view=await render(node());await waitFor(()=>expect(view.getByText('Original vendor')).toBeTruthy());expect(view.getByText('Status')).toBeTruthy();expect(view.getByText('Redeemed')).toBeTruthy();expect(view.getByText('Code: CODE123')).toBeTruthy();expect(view.queryByText('Total Paid')).toBeNull();
});
it('ignores receipt responses from a previous account',async()=>{
 let resolveAlice:(value:any)=>void=()=>{};
 mockRows.mockImplementation((table:string,owner:string)=>table!=='redemptions'?Promise.resolve({data:[],error:null}):owner==='alice'?new Promise(resolve=>{resolveAlice=resolve;}):Promise.resolve({data:[receipt('Bob vendor')],error:null}));
 const view=await render(node());mockUser={id:'bob'};await view.rerender(node());await waitFor(()=>expect(view.getByText('Bob vendor')).toBeTruthy());await act(async()=>resolveAlice({data:[receipt('Alice vendor')],error:null}));expect(view.queryByText('Alice vendor')).toBeNull();expect(view.getByText('Bob vendor')).toBeTruthy();
});

it('waits for authentication before showing a guest prompt',async()=>{
 const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{}); mockUser=null; mockAuthLoading=true;
 mockRows.mockImplementation((table:string)=>Promise.resolve({data:table==='redemptions'?[receipt('Verified vendor')]:[],error:null}));
 const view=await render(node());expect(alert).not.toHaveBeenCalled();mockUser={id:'alice'};mockAuthLoading=false;await view.rerender(node());
 await waitFor(()=>expect(view.getByText('Verified vendor')).toBeTruthy());expect(alert).not.toHaveBeenCalled();alert.mockRestore();
});

it('does not prompt for authentication from a hidden history screen',async()=>{
 mockFocused=false;const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>{});mockUser=null;
 await render(node());expect(alert).not.toHaveBeenCalled();alert.mockRestore();
});
