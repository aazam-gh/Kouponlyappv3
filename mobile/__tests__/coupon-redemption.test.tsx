import React from 'react';
import { Alert } from 'react-native';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RedeemScreen from '../app/redeem/[id]';
import { AppThemeProvider } from '../context/AppThemeContext';
import { LocaleProvider } from '../context/LocaleContext';
let mockUser: {id:string}|null={id:'alice'};
let mockBenefits: any={subscription:{roundId:'round-one'},usedVendorIds:[]};
const mockRedeem=jest.fn(); const mockRefresh=jest.fn(async()=>{}); const mockRetry=jest.fn(async()=>{}); const mockCapture=jest.fn();
jest.mock('../lib/auth',()=>({useAuth:()=>({user:mockUser})}));
jest.mock('../lib/catalogue',()=>({useCatalogue:()=>({status:'ready'})}));
jest.mock('../lib/data',()=>({dealById:()=>({name:'Test vendor',vendorId:'vendor-one',offers:[{index:0,id:'offer-one',title:'Test offer',description:'Test description',redemption:'inStore',discountType:'percentage',discountValue:25},{index:1,id:'offer-two',title:'Second offer',redemption:'inStore',discountType:'percentage',discountValue:25}]})}));
jest.mock('../lib/benefits',()=>({benefitsError:(message:string)=>message,isCouponOfferUsed:(benefits:any,offerId:string,vendorId?:string|null)=>Array.isArray(benefits?.usedOfferIds)?benefits.usedOfferIds.includes(offerId):Boolean(vendorId&&benefits?.usedVendorIds?.includes(vendorId)),useBenefits:()=>({benefits:mockBenefits,refresh:mockRefresh}),makeMutationId:()=> 'operation-one',redeemSubscriptionCoupon:(...args:any[])=>mockRedeem(...args)}));
jest.mock('../lib/store',()=>({useStore:()=>({retrySync:mockRetry})}));
jest.mock('posthog-react-native',()=>({usePostHog:()=>({capture:mockCapture})}));
const params=useLocalSearchParams as jest.Mock;
const wrap=(node:React.ReactNode)=>render(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:393,height:852},insets:{top:59,bottom:34,left:0,right:0}}}><AppThemeProvider><LocaleProvider>{node}</LocaleProvider></AppThemeProvider></SafeAreaProvider>);
const result={id:'coupon-receipt',code:'AB7K2',vendorName:'Test vendor',offerTitle:'Test offer',consumedAt:Date.now(),billAmount:125.50,currency:'INR'};
beforeEach(()=>{jest.spyOn(Alert,'alert').mockImplementation(()=>{});params.mockReturnValue({id:'1',offerIndex:'0'});mockUser={id:'alice'};mockBenefits={subscription:{roundId:'round-one'},usedVendorIds:[]};mockRedeem.mockReset();mockCapture.mockReset();mockRefresh.mockReset().mockResolvedValue(undefined);mockRetry.mockReset().mockResolvedValue(undefined);});
afterEach(()=>{cleanup();jest.restoreAllMocks();});
it('keeps a successful receipt when analytics and synchronization fail',async()=>{
 mockRedeem.mockResolvedValue(result);mockCapture.mockImplementation(()=>{throw Error('analytics');});mockRefresh.mockRejectedValue(Error('offline'));mockRetry.mockRejectedValue(Error('offline'));
 const view=await wrap(<RedeemScreen/>);await fireEvent.changeText(view.getByTestId('bill-amount'),'125.50');await fireEvent.press(view.getByText('Confirm redemption'));
 await waitFor(()=>expect(view.getByLabelText('Unique redemption code').props.children).toBe('AB7K2'));expect(view.queryByText('Coupon redeemed')).toBeNull();expect(view.queryByText('TEST OFFER')).toBeNull();expect(view.queryByText('Your coupon has been redeemed.')).toBeNull();expect(view.getByLabelText('Redeemed at')).toBeTruthy();
 expect(mockRedeem).toHaveBeenCalledWith('offer-one','round-one','operation-one',125.50);
});
it('retries the same operation after a transport failure',async()=>{
 mockRedeem.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(result);
 const view=await wrap(<RedeemScreen/>);await fireEvent.changeText(view.getByTestId('bill-amount'),'125.50');await fireEvent.press(view.getByText('Confirm redemption'));await waitFor(()=>expect(view.getByText('offline')).toBeTruthy());
 expect(view.getByTestId('bill-amount').props.editable).toBe(false);await fireEvent.press(view.getByText('Confirm redemption'));await waitFor(()=>expect(view.getByLabelText('Unique redemption code')).toBeTruthy());expect(mockRedeem.mock.calls[0]).toEqual(mockRedeem.mock.calls[1]);
});
it('keeps another offer redeemable after a coupon at the vendor is used',async()=>{
 mockBenefits.usedOfferIds=['offer-one'];mockBenefits.usedVendorIds=['vendor-one'];params.mockReturnValue({id:'1',offerIndex:'1'});
 const view=await wrap(<RedeemScreen/>);expect(view.queryByText('This offer’s coupon is already used.')).toBeNull();expect(view.getByText('Confirm redemption')).toBeTruthy();
});
it('ignores a redemption response from the previous account',async()=>{
 let resolve:(value:any)=>void=()=>{};mockRedeem.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const view=await wrap(<RedeemScreen/>);await fireEvent.changeText(view.getByTestId('bill-amount'),'125.50');await fireEvent.press(view.getByText('Confirm redemption'));mockUser={id:'bob'};mockBenefits={subscription:null,usedVendorIds:[]};
 await view.rerender(<SafeAreaProvider><AppThemeProvider><LocaleProvider><RedeemScreen/></LocaleProvider></AppThemeProvider></SafeAreaProvider>);
 await act(async()=>resolve(result));expect(view.queryByLabelText('Unique redemption code')).toBeNull();expect(view.getByText('Verify your email to access free coupons.')).toBeTruthy();
});

it('confirms directly without opening a second dialog',async()=>{
 mockRedeem.mockResolvedValue(result);
 const view=await wrap(<RedeemScreen/>);await fireEvent.changeText(view.getByTestId('bill-amount'),'125.50');await fireEvent.press(view.getByText('Confirm redemption'));
 await waitFor(()=>expect(mockRedeem).toHaveBeenCalledTimes(1));expect(Alert.alert).not.toHaveBeenCalled();
});

it('recovers an uncertain result using the original round even after coupons refresh',async()=>{
 mockRedeem.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(result);
 const view=await wrap(<RedeemScreen/>);await fireEvent.changeText(view.getByTestId('bill-amount'),'125.50');await fireEvent.press(view.getByText('Confirm redemption'));await waitFor(()=>expect(view.getByText('offline')).toBeTruthy());
 mockBenefits={subscription:{roundId:'round-two'},usedVendorIds:['vendor-one']};
 await view.rerender(<SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:393,height:852},insets:{top:59,bottom:34,left:0,right:0}}}><AppThemeProvider><LocaleProvider><RedeemScreen/></LocaleProvider></AppThemeProvider></SafeAreaProvider>);
 await fireEvent.press(view.getByText('Recover confirmation'));await waitFor(()=>expect(view.getByLabelText('Unique redemption code')).toBeTruthy());expect(mockRedeem.mock.calls[0]).toEqual(mockRedeem.mock.calls[1]);
});

it('blocks duplicate taps while confirmation is pending',async()=>{
 let resolve:(value:any)=>void=()=>{};mockRedeem.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const view=await wrap(<RedeemScreen/>);await fireEvent.changeText(view.getByTestId('bill-amount'),'125.50');await fireEvent.press(view.getByText('Confirm redemption'));
 await fireEvent.press(view.getByText('Confirming…'));expect(mockRedeem).toHaveBeenCalledTimes(1);
 await act(async()=>resolve(result));expect(view.getByLabelText('Unique redemption code')).toBeTruthy();
});

it('rejects missing, zero, negative, and over-precise bills before consuming a coupon',async()=>{
 const view=await wrap(<RedeemScreen/>);
 for(const value of ['', '0', '-10', '1.234']) {
  await fireEvent.changeText(view.getByTestId('bill-amount'),value);await fireEvent.press(view.getByText('Confirm redemption'));
  expect(view.getByText('Enter a positive bill amount with at most two decimal places.')).toBeTruthy();
 }
 expect(mockRedeem).not.toHaveBeenCalled();
});
it('shows the recorded bill amount on the successful receipt',async()=>{
 mockRedeem.mockResolvedValue(result);const view=await wrap(<RedeemScreen/>);
 await fireEvent.changeText(view.getByTestId('bill-amount'),'125.50');await fireEvent.press(view.getByText('Confirm redemption'));
 await waitFor(()=>expect(view.getByTestId('redemption-bill-amount').props.children.join('')).toContain('INR 125.50'));
});
