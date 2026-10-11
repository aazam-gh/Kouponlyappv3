import React from 'react';
import {act,cleanup,render,waitFor} from '@testing-library/react-native';
import {Text} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {StoreProvider,useStore} from '../lib/store';
let mockUser:any={id:'alice'};
const mockApply=jest.fn(),mockFetch=jest.fn();let mockId=0;
jest.mock('../lib/auth',()=>({useAuth:()=>({user:mockUser})}));
jest.mock('../lib/backend',()=>({applyMutation:(item:any)=>mockApply(item),fetchCloudState:()=>mockFetch(),makeMutationId:()=>String(++mockId),subscribeToUser:()=>({unsubscribe:jest.fn()})}));
let reader:ReturnType<typeof useStore>;
function Probe(){reader=useStore();return <Text>{reader.hydrated?'ready':'loading'}:{reader.state.saved.join(',')}</Text>;}
const tree=()=> <StoreProvider><Probe/></StoreProvider>;
beforeEach(async()=>{await AsyncStorage.clear();mockUser={id:'alice'};mockApply.mockReset();mockFetch.mockReset();mockFetch.mockResolvedValue({saved:[]});});afterEach(cleanup);
it('serializes queued saves and retains an action enqueued during an upload',async()=>{
 let finish!:(value?:any)=>void;mockApply.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue(undefined);
 const view=await render(tree());await waitFor(()=>expect(view.getByText('ready:')).toBeTruthy());
 await act(async()=>reader.toggleSaved(1));await waitFor(()=>expect(mockApply).toHaveBeenCalledTimes(1));
 await act(async()=>reader.toggleSaved(2));expect(mockApply).toHaveBeenCalledTimes(1);
 await act(async()=>finish());await waitFor(()=>expect(mockApply).toHaveBeenCalledTimes(2));
 await waitFor(async()=>expect(JSON.parse((await AsyncStorage.getItem('kouponly.user.alice.pending.v1'))!)).toEqual([]));
});
it('retains offline saved state when refreshing cannot sync the draft',async()=>{
 await AsyncStorage.setItem('kouponly.user.alice.state.v3',JSON.stringify({saved:[1]}));await AsyncStorage.setItem('kouponly.user.alice.pending.v1',JSON.stringify([{id:'pending',userId:'alice',kind:'save-deal',entityId:'1',operation:'upsert',attempts:0}]));mockApply.mockRejectedValue(Error('offline'));
 const view=await render(tree());await waitFor(()=>expect(view.getByText('ready:1')).toBeTruthy());expect(mockFetch).not.toHaveBeenCalled();
});
it('does not write the previous account state into another account cache',async()=>{
 await AsyncStorage.setItem('kouponly.user.alice.state.v3',JSON.stringify({saved:[1]}));mockFetch.mockRejectedValue(Error('offline'));
 const view=await render(tree());await waitFor(()=>expect(view.getByText('ready:1')).toBeTruthy());mockUser={id:'bob'};await view.rerender(tree());await waitFor(()=>expect(view.getByText('ready:')).toBeTruthy());
 const cached=JSON.parse((await AsyncStorage.getItem('kouponly.user.bob.state.v3'))!);expect(cached.saved).toEqual([]);
});

it('keeps queued operations ordered when an earlier save fails',async()=>{
 const pending=[{id:'save',userId:'alice',kind:'save-deal',entityId:'1',operation:'upsert',attempts:0},{id:'unsave',userId:'alice',kind:'save-deal',entityId:'1',operation:'delete',attempts:0}];
 await AsyncStorage.setItem('kouponly.user.alice.pending.v1',JSON.stringify(pending));mockApply.mockRejectedValue(Error('offline'));
 const view=await render(tree());await waitFor(()=>expect(view.getByText('ready:')).toBeTruthy());expect(mockApply).toHaveBeenCalledTimes(1);
 const retained=JSON.parse((await AsyncStorage.getItem('kouponly.user.alice.pending.v1'))!);expect(retained.map((entry:any)=>entry.id)).toEqual(['save','unsave']);expect(retained[0].attempts).toBe(1);
});
