import '@/src/localization/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from "expo-font";
import {
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import { router, Stack, useSegments } from "expo-router";
import * as Notifications from "expo-notifications";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { AppState, LogBox, View } from "react-native";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toast } from "@/components/ui";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider, useAppTheme } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { CatalogueProvider } from "@/lib/catalogue";
import { BenefitsProvider } from "@/lib/benefits";
import { ProfileProvider } from "@/lib/profile";
import { NearbyProvider } from "@/lib/nearby";
import { useAuth } from "@/lib/auth";
import { setupCouponlyNotificationChannels, syncCouponlyPushToken } from "@/lib/couponlyPush";
import { AppThemeProvider } from '@/context/AppThemeContext';
import { LocaleProvider } from '@/context/LocaleContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/utils/queryClient';
import { AnalyticsProvider } from '@/lib/analytics';
import { usePostHog } from 'posthog-react-native';
import { ReduceMotion, ReducedMotionConfig } from 'react-native-reanimated';
import AppLaunchPosterModal from '@/components/AppLaunchPosterModal';

// The app deliberately applies the student's reduced-motion preference globally.
LogBox.ignoreLogs(['[Reanimated] Reduced motion setting is overwritten with mode']);

// Keep the native logo visible until the first app layout has rendered.
void SplashScreen.preventAutoHideAsync().catch(() => {});

type FirstRunStatus = 'checking' | 'new' | 'existing';

function AppNavigation({ firstRunStatus }: { firstRunStatus: Exclude<FirstRunStatus, 'checking'> }){
  const theme=useAppTheme();
  const { user, session }=useAuth();
  const posthog=usePostHog();
  const segments=useSegments();
  const screen=segments.filter(segment=>!segment.startsWith('(')).join('/')||'home';
  const isHomeRoute=screen==='home'||screen==='index';
  const previousUserId=React.useRef<string|null>(null);
  const firstRunRedirected=React.useRef(false);
  React.useEffect(()=>{
    const userId=session?.user.id??null;
    if(userId&&previousUserId.current&&previousUserId.current!==userId)posthog.reset();
    if(userId)posthog.identify(userId);
    else if(previousUserId.current)posthog.reset();
    previousUserId.current=userId;
  },[posthog,session?.user.id]);
  React.useEffect(()=>{
    posthog.screen(screen);
  },[posthog,screen]);
  React.useEffect(()=>{
    const routeSegments=segments as string[];
    if(firstRunStatus!=='new'||firstRunRedirected.current)return;
    firstRunRedirected.current=true;
    if(routeSegments.includes('welcome'))return;
    router.replace('/realx/welcome' as any);
  },[firstRunStatus,segments]);
  React.useEffect(()=>{void setupCouponlyNotificationChannels().catch(()=>{});},[]);
  React.useEffect(()=>{
    if(!user)return;
    // Existing accounts may have never reached onboarding's permission request.
    void syncCouponlyPushToken(user.id,true);
    const tokenSubscription=Notifications.addPushTokenListener(()=>{void syncCouponlyPushToken(user.id,false);});
    const resumeSubscription=AppState.addEventListener("change",state=>{if(state==="active")void syncCouponlyPushToken(user.id,false);});
    return ()=>{tokenSubscription.remove();resumeSubscription.remove();};
  },[user?.id]);
  React.useEffect(()=>{
    const openNotification=(response:Notifications.NotificationResponse|null)=>{
      if(!response)return;
      const path=response.notification.request.content.data?.path;
      const supported=new Set(['/realx','/realx/history','/realx/map','/realx/opportunities','/realx/saved','/realx/search','/notifications']);
      if(typeof path==='string'&&supported.has(path)){
        router.push(path as any);
        void Notifications.clearLastNotificationResponseAsync().catch(()=>{});
      }
    };
    void Notifications.getLastNotificationResponseAsync().then(openNotification).catch(()=>{});
    const subscription=Notifications.addNotificationResponseReceivedListener(openNotification);
    return ()=>subscription.remove();
  },[]);
  return <><ReducedMotionConfig mode={theme.motion.reduceMotion ? ReduceMotion.Always : ReduceMotion.System}/><StatusBar style={theme.dark?"light":"dark"}/><Stack initialRouteName={firstRunStatus==='new'?'realx/welcome':'(tabs)'} screenOptions={{headerShown:false,contentStyle:{backgroundColor:theme.colors.paper},animation:theme.motion.reduceMotion?"fade":"default"}}/><AppLaunchPosterModal userId={session?.user.id??null} enabled={isHomeRoute}/><Toast/></>;
}

export default function RootLayout(){
  const [firstRunStatus,setFirstRunStatus]=React.useState<FirstRunStatus>('checking');
  const [loaded, fontError]=useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  const onAppLayout=React.useCallback(()=>{
    if(loaded||fontError)void SplashScreen.hideAsync().catch(()=>{});
  },[loaded,fontError]);
  React.useEffect(()=>{
    let active=true;
    void AsyncStorage.getAllKeys().then(keys=>{
      if(!active)return;
      const hasExistingAppState=keys.some(key=>
        key==='kouponly.guest.state.v3'||key==='kouponly.prototype.state.v1'||key==='kouponly.prototype.state.v2'||key==='kouponly.prototype.state.v3'||
        (key.startsWith('kouponly.user.')&&key.endsWith('.state.v3'))
      );
      setFirstRunStatus(hasExistingAppState?'existing':'new');
    }).catch(()=>{if(active)setFirstRunStatus('existing')});
    return()=>{active=false};
  },[]);
  if((!loaded&&!fontError)||firstRunStatus==='checking')return <View style={{flex:1,backgroundColor:"#FFFFFF",alignItems:"center",justifyContent:"center"}}><StatusBar style="dark"/><Image source={require('../assets/images/kouponly-logo.webp')} style={{width:240,height:240}} contentFit="contain" accessibilityLabel="Kouponly logo"/></View>;
  return <View style={{flex:1}} onLayout={onAppLayout}><AnalyticsProvider><SafeAreaProvider><QueryClientProvider client={queryClient}><AppThemeProvider><LocaleProvider><ThemeProvider><AuthProvider><ProfileProvider><BenefitsProvider><CatalogueProvider><NearbyProvider><StoreProvider><AppNavigation firstRunStatus={firstRunStatus}/></StoreProvider></NearbyProvider></CatalogueProvider></BenefitsProvider></ProfileProvider></AuthProvider></ThemeProvider></LocaleProvider></AppThemeProvider></QueryClientProvider></SafeAreaProvider></AnalyticsProvider></View>;
}
