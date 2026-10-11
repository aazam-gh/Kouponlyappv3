import '@/src/localization/i18n';
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
import { ActivityIndicator, LogBox, View } from "react-native";
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

// The app deliberately applies the student's reduced-motion preference globally.
LogBox.ignoreLogs(['[Reanimated] Reduced motion setting is overwritten with mode']);

function AppNavigation(){
  const theme=useAppTheme();
  const { user, session }=useAuth();
  const posthog=usePostHog();
  const segments=useSegments();
  const screen=segments.filter(segment=>!segment.startsWith('(')).join('/')||'home';
  const previousUserId=React.useRef<string|null>(null);
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
  React.useEffect(()=>{void setupCouponlyNotificationChannels().catch(()=>{});},[]);
  React.useEffect(()=>{
    if(!user)return;
    void syncCouponlyPushToken(user.id,false);
    const tokenSubscription=Notifications.addPushTokenListener(()=>{void syncCouponlyPushToken(user.id,false);});
    return ()=>tokenSubscription.remove();
  },[user?.id]);
  React.useEffect(()=>{
    const openNotification=(response:Notifications.NotificationResponse|null)=>{
      if(!response)return;
      const path=response.notification.request.content.data?.path;
      const supported=new Set(['/realx','/realx/history','/realx/map','/realx/opportunities','/realx/saved','/realx/search','/notifications']);
      if(typeof path==='string'&&supported.has(path))router.push(path as any);
    };
    void Notifications.getLastNotificationResponseAsync().then(openNotification).catch(()=>{});
    const subscription=Notifications.addNotificationResponseReceivedListener(openNotification);
    return ()=>subscription.remove();
  },[]);
  return <><ReducedMotionConfig mode={theme.motion.reduceMotion ? ReduceMotion.Always : ReduceMotion.System}/><StatusBar style={theme.dark?"light":"dark"}/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:theme.colors.paper},animation:theme.motion.reduceMotion?"fade":"default"}}><Stack.Screen name="wakti" options={{presentation:'modal',animation:theme.motion.reduceMotion?'fade':'slide_from_bottom',animationMatchesGesture:true}} /></Stack><Toast/></>;
}

export default function RootLayout(){
  const [loaded]=useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });
  if(!loaded)return <View style={{flex:1,backgroundColor:"#FAFAFA",alignItems:"center",justifyContent:"center"}}><ActivityIndicator color="#0A0A0A"/></View>;
  return <AnalyticsProvider><SafeAreaProvider><QueryClientProvider client={queryClient}><AppThemeProvider><LocaleProvider><ThemeProvider><AuthProvider><ProfileProvider><BenefitsProvider><CatalogueProvider><NearbyProvider><StoreProvider><AppNavigation/></StoreProvider></NearbyProvider></CatalogueProvider></BenefitsProvider></ProfileProvider></AuthProvider></ThemeProvider></LocaleProvider></AppThemeProvider></QueryClientProvider></SafeAreaProvider></AnalyticsProvider>;
}
