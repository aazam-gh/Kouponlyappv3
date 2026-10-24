import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoreProvider } from "../lib/store";
import { NearbyProvider } from "../lib/nearby";
import { router, useLocalSearchParams } from "expo-router";
import { loadFixture, clearFixture } from '../test/catalogue-fixture';
import MapScreen from "../components/screens/explore-screen";
import MeScreen from "../app/(tabs)/me";

import DealScreen from "../app/deal/[id]";
import VendorRoute from "../app/realx/vendor/[id]";
import HistoryScreen from '../app/realx/history';

jest.mock('../lib/benefits', () => ({ useBenefits: () => ({benefits: null, isAdmin: false}), isCouponOfferUsed: () => false }));

jest.mock('supercluster', () => ({
  __esModule: true,
  default: class {
    points: any[] = [];
    load(points: any[]) { this.points = points; }
    getClusters() {
      if (this.points.length < 2) return this.points;
      const longitude = this.points.reduce((sum, point) => sum + point.geometry.coordinates[0], 0) / this.points.length;
      const latitude = this.points.reduce((sum, point) => sum + point.geometry.coordinates[1], 0) / this.points.length;
      return [{ type: 'Feature', id: 'cluster-test', properties: { cluster: true, cluster_id: 1, point_count: this.points.length }, geometry: { type: 'Point', coordinates: [longitude, latitude] } }];
    }
    getLeaves() { return this.points; }
  },
}));

jest.mock('../context/AppThemeContext', () => ({ useAppTheme: () => ({ isDark: false, theme: { background: '#fff', surfaceElevated: '#fff', cardMuted: '#f1f4ef', brand: '#18b852', brandText: '#128a43', text: '#0a0f0c', mutedText: '#5f6861', border: '#e2e8e1', icon: '#111713', danger: '#d92d20', actionSolid: '#0e7a38', onActionSolid: '#fff' } }) }));
jest.mock('../context/LocaleContext', () => ({ useAppLocale: () => ({ locale: 'en', isRTL: false }) }));
jest.mock('../lib/auth', () => ({ useAuth: () => ({ user: null, signOut: jest.fn(async () => {}) }) }));
jest.mock('../lib/profile', () => ({ useProfile: () => ({ profile: { full_name: '', email: '' }, avatarUrl: null }) }));

jest.mock('expo-crypto',()=>({randomUUID:jest.fn(()=>'12345678-1234-1234-1234-123456789012')}));
jest.mock('react-native-maps',()=>({__esModule:true,default:require('react-native').View,Marker:require('react-native').View,Callout:require('react-native').View}));
jest.mock('expo-location',()=>({Accuracy:{Balanced:1},getForegroundPermissionsAsync:jest.fn(async()=>({status:'granted',canAskAgain:true})),hasServicesEnabledAsync:jest.fn(async()=>true),getCurrentPositionAsync:jest.fn(async()=>({coords:{latitude:10,longitude:76}}))}));
jest.mock('../lib/nearby-vendors',()=>({fetchNearbyFoodOffers:jest.fn(async()=>[]),fetchVendorMapLocations:jest.fn(async()=>[
  {...require('../test/catalogue-fixture').fixture().deals[0],vendorId:'vendor-1',locationId:'branch-1',branchName:'Waterfront',latitude:25.2854,longitude:51.531},
  {...require('../test/catalogue-fixture').fixture().deals[0],vendorId:'vendor-1',locationId:'branch-2',branchName:'Marina',place:'Marina road',latitude:25.2855,longitude:51.5311},
])}));
beforeEach(loadFixture);
const params = useLocalSearchParams as jest.Mock;
const frame = { x: 0, y: 0, width: 393, height: 852 };
const wrap = async (node: React.ReactNode) => render(
  <SafeAreaProvider initialMetrics={{ frame, insets: { top: 59, left: 0, right: 0, bottom: 34 } }}>
    <NearbyProvider><StoreProvider>{node}</StoreProvider></NearbyProvider>
  </SafeAreaProvider>,
);

afterEach(() => {
  cleanup();
  clearFixture();
  params.mockReturnValue({});
  jest.clearAllMocks();
});

describe("reachable route coverage", () => {
  it('uses the source guest auth prompt for redemption history', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await wrap(<HistoryScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/realx/profile'));
    expect(alert).toHaveBeenCalledWith('Create an account to continue', 'Log in or sign up to view redemption history.', expect.any(Array));
    alert.mockRestore();
  });

  it("matches the guest profile menu and opens sign in", async () => {
    const view = await wrap(<MeScreen />);
    expect(view.getByText("You're browsing as a guest")).toBeTruthy();
    expect(view.getByText("Terms and Conditions")).toBeTruthy();
    expect(view.getByText("Privacy Policy")).toBeTruthy();
    await fireEvent.press(view.getByText("LOG IN"));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/realx/onboarding', params: { flow: 'login' } });
    await fireEvent.press(view.getByText("Create Account"));
    expect(router.push).toHaveBeenCalledWith('/realx/welcome');
  });

  it("shows Kouponly partner map locations and directions", async () => {
    const view = await wrap(<MapScreen />);
    expect(view.getByTestId("couponly-map-screen")).toBeTruthy();
    expect(view.getByTestId("map-search")).toBeTruthy();
    for (const label of ["Cafe", "Gym", "Food", "Salon"]) {
      expect(view.queryByLabelText(`Filter ${label}`)).toBeNull();
    }
    await waitFor(() => expect(view.getByLabelText("2 nearby places")).toBeTruthy());
    await fireEvent.press(view.getByLabelText("2 nearby places"));
    expect(StyleSheet.flatten(view.getByTestId('map-cluster-preview').props.style).bottom).toBe(64 + 34 + 12);
    await fireEvent.press(view.getByLabelText("Open Test Kitchen Waterfront"));
    expect(view.getByText("Test Kitchen")).toBeTruthy();
    expect(view.getByText("Waterfront · Waterfront road")).toBeTruthy();
    await waitFor(() => expect(view.getByText(/\d+\.\d+ km/)).toBeTruthy());
    expect(view.getByText("Directions")).toBeTruthy();
    expect(view.getByLabelText("Save partner")).toBeTruthy();
    expect(StyleSheet.flatten(view.getByTestId('map-vendor-callout').props.style).bottom).toBe(64 + 34 + 12);
  });

  it("covers real deal details, save, and redemption entry", async () => {
    params.mockReturnValue({ id: "101" });
    const view = await wrap(<DealScreen />);
    expect(view.getByText("Test Kitchen")).toBeTruthy();
    expect(view.getByText("Rice lunch discount")).toBeTruthy();
    expect(view.getByTestId("redeem-offer-1")).toBeTruthy();
  });

  it('shows all vendor offers and branches in deal details',async()=>{
    params.mockReturnValue({id:'101',offer:'2'});
    const view=await wrap(<DealScreen/>);
    expect(view.getAllByText('Sweets discount').length).toBeGreaterThan(0);
    expect(view.getAllByText('Lunch saving')).toHaveLength(1);
    await fireEvent.press(view.getByLabelText('Show details for Sweets discount'));
    expect(view.getByText('Dessert details')).toBeTruthy();
    expect(view.getByText('Terms and exclusions')).toBeTruthy();
    expect(view.getByText('Valid weekdays')).toBeTruthy();
    expect(view.getByText('How to redeem')).toBeTruthy();
    expect(view.getByText('Show this offer at the counter')).toBeTruthy();
    expect(view.getByLabelText('Hide details for Sweets discount').props.accessibilityState.expanded).toBe(true);
    await fireEvent.press(view.getByLabelText('Hide details for Sweets discount'));
    expect(view.queryByText('Dessert details')).toBeNull();
    expect(view.getByLabelText('Show details for Sweets discount').props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(view.getByLabelText('Show details for Sweets discount'));
    expect(view.getByLabelText(/^Show vendor location/)).toBeTruthy();
    expect(view.getByTestId('redeem-offer-2')).toBeTruthy();
    await fireEvent.press(view.getByLabelText(/^Show vendor location/));
    expect(view.getByText('Branches')).toBeTruthy();
    expect(view.getByText('Second branch')).toBeTruthy();
  });

  it('renders vendor details directly from the catalogue vendor ID',async()=>{
    params.mockReturnValue({id:'vendor-1'});
    const view=await wrap(<VendorRoute/>);
    expect(view.getByTestId('deal-detail')).toBeTruthy();
    expect(view.getByText('Test Kitchen')).toBeTruthy();
  });
});
