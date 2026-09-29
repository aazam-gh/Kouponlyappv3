import { BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque";
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toast } from "@/components/ui";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider, useAppTheme } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { CatalogueProvider, useCatalogue } from "@/lib/catalogue";
import { ProfileProvider } from "@/lib/profile";
import { useAuth } from "@/lib/auth";
import { setupRealXNotificationChannels, syncRealXPushToken } from "@/lib/realxPush";

function AppNavigation(){
  const theme=useAppTheme();
  const { user }=useAuth();
  useCatalogue();
  React.useEffect(()=>{void setupRealXNotificationChannels().catch(()=>{});},[]);
  React.useEffect(()=>{
    if(!user)return;
    void syncRealXPushToken(user.id,false);
    const tokenSubscription=Notifications.addPushTokenListener(()=>{void syncRealXPushToken(user.id,false);});
    return ()=>tokenSubscription.remove();
  },[user?.id]);
  React.useEffect(()=>{
    const openNotification=(response:Notifications.NotificationResponse|null)=>{
      if(!response)return;
      const path=response.notification.request.content.data?.path;
      const supported=new Set(['/realx','/realx/badrgo','/realx/history','/realx/map','/realx/offers','/realx/opportunities','/realx/saved','/realx/search','/realx/wallet']);
      if(path==='/pilot/badrgo')router.push('/realx/badrgo' as any);
      else if(typeof path==='string'&&supported.has(path))router.push(path as any);
    };
    void Notifications.getLastNotificationResponseAsync().then(openNotification).catch(()=>{});
    const subscription=Notifications.addNotificationResponseReceivedListener(openNotification);
    return ()=>subscription.remove();
  },[]);
  return <><StatusBar style={theme.dark?"light":"dark"}/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:theme.colors.paper},animation:theme.motion.reduceMotion?"none":"slide_from_right"}}/><Toast/></>;
}

export default function RootLayout(){
  const [loaded]=useFonts({BricolageGrotesque_600SemiBold,BricolageGrotesque_700Bold,Manrope_500Medium,Manrope_600SemiBold,Manrope_800ExtraBold});
  if(!loaded)return <View style={{flex:1,backgroundColor:"#FAFAFA",alignItems:"center",justifyContent:"center"}}><ActivityIndicator color="#0A0A0A"/></View>;
  return <SafeAreaProvider><ThemeProvider><AuthProvider><ProfileProvider><CatalogueProvider><StoreProvider><AppNavigation/></StoreProvider></CatalogueProvider></ProfileProvider></AuthProvider></ThemeProvider></SafeAreaProvider>;
}
