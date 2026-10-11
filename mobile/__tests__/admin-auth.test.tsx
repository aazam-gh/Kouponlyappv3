import React from 'react';
import {act,cleanup,render,waitFor} from '@testing-library/react-native';
import {Text} from 'react-native';
let mockListener:(event:string,session:any)=>void;
const mockRole=jest.fn(),mockClear=jest.fn();
jest.mock('../lib/supabase',()=>({supabase:{auth:{onAuthStateChange:(listener:any)=>{mockListener=listener;return {data:{subscription:{unsubscribe:jest.fn()}}};}},from:()=>({select:()=>({eq:()=>({maybeSingle:()=>mockRole()})})})}}));
jest.mock('../../web/src/analytics',()=>({identifyAnalyticsUser:jest.fn(),resetAnalyticsUser:jest.fn()}));
jest.mock('@tanstack/react-query',()=>({...jest.requireActual('@tanstack/react-query'),useQueryClient:()=>({clear:mockClear})}));
jest.doMock(require.resolve('react',{paths:[require.resolve('../../web/package.json')]}),()=>React);
jest.doMock(require.resolve('@tanstack/react-query',{paths:[require.resolve('../../web/package.json')]}),()=>({useQueryClient:()=>mockClient}));
const mockClient={clear:mockClear};
const {AuthContextProvider,useAuth}=require('../../web/src/auth');
function Probe(){const auth=useAuth();return <Text>{auth.user?.id||'guest'}:{auth.isAdmin?'admin':'denied'}</Text>;}
afterEach(()=>{cleanup();mockRole.mockReset();mockClear.mockReset();});
it('does not restore admin privileges when an old role lookup resolves after logout',async()=>{
 let resolve!:(value:any)=>void;mockRole.mockReturnValue(new Promise(done=>{resolve=done;}));const view=await render(<AuthContextProvider><Probe/></AuthContextProvider>);
 await act(async()=>mockListener('SIGNED_IN',{user:{id:'alice',user_metadata:{}}}));await waitFor(()=>expect(mockRole).toHaveBeenCalled());
 await act(async()=>mockListener('SIGNED_OUT',null));await act(async()=>resolve({data:{role:'admin'},error:null}));expect(view.getByText('guest:denied')).toBeTruthy();expect(mockClear).toHaveBeenCalled();
});
