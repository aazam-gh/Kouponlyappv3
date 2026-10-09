import React from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { CatalogueProvider, CatalogueNotice, useCatalogue } from '../lib/catalogue';
import { ThemeProvider } from '../lib/theme';
import { fetchCloudCatalogue } from '../lib/backend';
import { fixture, clearFixture } from '../test/catalogue-fixture';
import { deals } from '../lib/data';
import { queryClient } from '../utils/queryClient';

jest.mock('../lib/backend',()=>({...jest.requireActual('../lib/backend'),fetchCloudCatalogue:jest.fn(),subscribeToCatalogue:()=>({unsubscribe:jest.fn()})}));
const mockFetch = fetchCloudCatalogue as jest.Mock;
const empty = {deals:[],categories:[],partners:[],offers:[],heroSlides:[],rewards:[],source:'cloud',updatedAt:0};
function StatusProbe(){const {status}=useCatalogue();return <Text>{status}</Text>;}
const screen=(children: React.ReactNode=<StatusProbe/>)=>render(<ThemeProvider><CatalogueProvider>{children}</CatalogueProvider></ThemeProvider>);
beforeEach(()=>queryClient.clear());
afterEach(()=>{cleanup();clearFixture();mockFetch.mockReset();queryClient.clear();});

it('loads only cloud content after the asynchronous refresh',async()=>{
  let resolve!: (value:any)=>void;
  mockFetch.mockReturnValueOnce(new Promise(done=>{resolve=done;}));
  const view=await screen();
  expect(view.getByText('loading')).toBeTruthy();
  expect(view.queryByText('Test Kitchen')).toBeNull();
  await act(async()=>resolve({...empty,...fixture()}));
  await waitFor(()=>expect(view.getByText('cloud')).toBeTruthy());
  expect(deals[0]?.name).toBe('Test Kitchen');
});
it('shows an empty Supabase catalogue without sample fallback',async()=>{
  mockFetch.mockResolvedValue(empty);
  const view=await screen(<><StatusProbe/><CatalogueNotice empty/></>);
  await waitFor(()=>expect(view.getByText('No offers available yet')).toBeTruthy());
  expect(deals).toEqual([]);
});
it('keeps a failed initial load empty and permits retry',async()=>{
  mockFetch.mockRejectedValueOnce(new Error('Connection unavailable')).mockRejectedValueOnce(new Error('Connection unavailable')).mockResolvedValue(empty);
  const view=await screen(<><StatusProbe/><CatalogueNotice empty/></>);
  await waitFor(()=>expect(view.getByText('Connection unavailable')).toBeTruthy(), { timeout: 5000 });
  expect(deals).toEqual([]);
  await fireEvent.press(view.getByText('Retry offers'));
  await waitFor(()=>expect(view.getByText('No offers available yet')).toBeTruthy());
});
