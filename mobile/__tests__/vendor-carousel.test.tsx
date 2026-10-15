import React from 'react';
import { AppState } from 'react-native';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DealDetail from '../app/deal/[id]';
import { AppThemeProvider } from '../context/AppThemeContext';
import { LocaleProvider } from '../context/LocaleContext';
let mockReduceMotion = false;
const mockStoreState = { saved: [] as number[], savedOffers: [] as string[] };
const mockToggleSavedOffer = jest.fn();
jest.mock('../lib/theme', () => ({ ...jest.requireActual('../lib/theme'), useMotionPreferences: () => ({ reduceMotion: mockReduceMotion }) }));

jest.mock('expo-router', () => ({useLocalSearchParams:()=>({id:'1'}),useRouter:()=>({push:jest.fn()}),useFocusEffect:(effect:()=>void)=>require('react').useEffect(effect,[effect])}));
jest.mock('../lib/nearby',()=>({useNearbyDistances:()=>({distanceByVendor:new Map()})}));
jest.mock('../lib/catalogue',()=>({useCatalogue:()=>({status:'cloud'})}));
jest.mock('../lib/auth',()=>({useAuth:()=>({user:null})}));
jest.mock('../lib/benefits',()=>({useBenefits:()=>({benefits:null}),isCouponOfferUsed:()=>false}));
jest.mock('../lib/store',()=>({useStore:()=>({state:mockStoreState,notify:jest.fn(),toggleSaved:jest.fn(),toggleSavedOffer:mockToggleSavedOffer})}));
jest.mock('posthog-react-native',()=>({usePostHog:()=>({capture:jest.fn()})}));
jest.mock('../lib/data',()=>({dealById:()=>({id:1,name:'Vendor',image:'first.jpg',galleryImages:['first.jpg','second.jpg'],offers:[{id:'offer',index:0,title:'Offer',description:'Description'}],distanceKm:0})}));
const wrap=()=>render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:393,height:852},insets:{top:59,bottom:34,left:0,right:0}}}><AppThemeProvider><LocaleProvider><DealDetail /></LocaleProvider></AppThemeProvider></SafeAreaProvider>);
beforeEach(()=>{mockReduceMotion=false;jest.useFakeTimers();Object.defineProperty(AppState,'currentState',{value:'active',writable:true,configurable:true});});
afterEach(()=>{cleanup();jest.useRealTimers();});
it('plays in the banner, wraps, and has no gallery tap target',async()=>{
 const view=await wrap();expect(view.getByText('1 / 2')).toBeTruthy();expect(view.queryByRole('imagebutton')).toBeNull();
 await act(async()=>jest.advanceTimersByTime(4500));expect(view.getByText('2 / 2')).toBeTruthy();
 await act(async()=>jest.advanceTimersByTime(4500));expect(view.getByText('1 / 2')).toBeTruthy();expect(view.queryByLabelText('Close gallery')).toBeNull();
});
it('continues from a swiped slide and pauses in the background',async()=>{
 const view=await wrap();await fireEvent(view.getByTestId('vendor-header-carousel'),'momentumScrollEnd',{nativeEvent:{contentOffset:{x:393}}});
 expect(view.getByText('2 / 2')).toBeTruthy();AppState.currentState='background';
 await act(async()=>jest.advanceTimersByTime(4500));expect(view.getByText('2 / 2')).toBeTruthy();AppState.currentState='active';
 await act(async()=>jest.advanceTimersByTime(4500));expect(view.getByText('1 / 2')).toBeTruthy();
});
it('stops autoplay with reduced motion and still accepts manual swipes', async () => {
 mockReduceMotion=true;
 const view=await wrap();
 await act(async()=>jest.advanceTimersByTime(9000));expect(view.getByText('1 / 2')).toBeTruthy();
 await fireEvent(view.getByTestId('vendor-header-carousel'),'momentumScrollEnd',{nativeEvent:{contentOffset:{x:393}}});
 expect(view.getByText('2 / 2')).toBeTruthy();
});
it('saves an offer from the vendor screen', async () => {
 const view=await wrap();
 await fireEvent.press(view.getByLabelText('Save Offer'));
 expect(mockToggleSavedOffer).toHaveBeenCalledWith('offer');
});
