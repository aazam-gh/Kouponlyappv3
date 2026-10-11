import React from 'react';
import {act,cleanup,render,waitFor} from '@testing-library/react-native';
import {Text} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ProfileProvider,useProfile} from '../lib/profile';
let mockUser:any={id:'alice',email:'alice@example.edu',user_metadata:{}};
const mockProfile=jest.fn(),mockUpdate=jest.fn(),mockPick=jest.fn(),mockUpload=jest.fn();
jest.mock('../lib/auth',()=>({useAuth:()=>({user:mockUser})}));
jest.mock('../lib/backend',()=>({fetchProfile:()=>mockProfile(),fetchPreferences:async()=>null,updateProfile:(value:any)=>mockUpdate(value),updatePreferences:async()=>{},signedUrl:async()=>{throw Error('Photo unavailable');},uploadStorageAsset:(...args:any[])=>mockUpload(...args)}));
jest.mock('../lib/media',()=>({pickAvatar:()=>mockPick()}));
let reader:ReturnType<typeof useProfile>;
function Probe(){reader=useProfile();const {profile}=reader;return <Text>{profile.full_name||'empty'}</Text>;}
const tree=()=> <ProfileProvider><Probe/></ProfileProvider>;
beforeEach(async()=>{await AsyncStorage.clear();mockUser={id:'alice',email:'alice@example.edu',user_metadata:{}};mockUpdate.mockReset();mockProfile.mockReset();});
afterEach(cleanup);
it('ignores a previous account profile response',async()=>{
 let resolve!:(value:any)=>void;mockProfile.mockReturnValueOnce(new Promise(done=>{resolve=done;})).mockResolvedValue({full_name:'Bob'});
 const view=await render(tree());await waitFor(()=>expect(mockProfile).toHaveBeenCalledTimes(1));
 mockUser={id:'bob',email:'bob@example.edu',user_metadata:{}};await view.rerender(tree());await waitFor(()=>expect(view.getByText('Bob')).toBeTruthy());
 await act(async()=>resolve({full_name:'Alice'}));expect(view.queryByText('Alice')).toBeNull();
});
it('uses authoritative edit flags after a pending profile is synced',async()=>{
 await AsyncStorage.setItem('kouponly.user.alice.profile.pending.v1',JSON.stringify({full_name:'Alice',first_name_edit_used:false}));mockUpdate.mockResolvedValue(undefined);mockProfile.mockResolvedValue({full_name:'Server Alice',first_name_edit_used:true});
 const view=await render(tree());await waitFor(()=>expect(view.getByText('Server Alice')).toBeTruthy());expect(await AsyncStorage.getItem('kouponly.user.alice.profile.pending.v1')).toBeNull();
});
it('loads the server profile even when a local draft is malformed or its photo is unavailable',async()=>{
 await AsyncStorage.setItem('kouponly.user.alice.profile.pending.v1','broken JSON');mockProfile.mockResolvedValue({full_name:'Alice',avatar_path:'missing.jpg'});
 const view=await render(tree());await waitFor(()=>expect(view.getByText('Alice')).toBeTruthy());
});

it('keeps a completed avatar update when only the signed URL request fails',async()=>{
 mockProfile.mockResolvedValue({full_name:'Alice'});mockPick.mockResolvedValue({path:'alice/photo.jpg'});mockUpload.mockReturnValue({promise:Promise.resolve(),cancel:jest.fn()});
 const view=await render(tree());await waitFor(()=>expect(view.getByText('Alice')).toBeTruthy());
 await act(async()=>{await expect(reader.chooseAvatar()).resolves.toBeUndefined();});
 expect(reader.profile.avatar_path).toBe('alice/photo.jpg');expect(reader.profile.avatar_edit_used).toBe(true);expect(reader.uploading).toBe(false);
});

it('does not cache a permanently rejected one-time edit as an offline draft',async()=>{
 mockProfile.mockResolvedValue({full_name:'Alice',first_name_edit_used:true});mockUpdate.mockRejectedValue(Object.assign(Error('First name can only be changed once'),{code:'P0001'}));
 const view=await render(tree());await waitFor(()=>expect(view.getByText('Alice')).toBeTruthy());
 await act(async()=>{await expect(reader.saveProfile({...reader.profile,full_name:'Forbidden'})).rejects.toThrow('only be changed once');});
 expect(reader.profile.full_name).toBe('Alice');expect(await AsyncStorage.getItem('kouponly.user.alice.profile.pending.v1')).toBeNull();
});
