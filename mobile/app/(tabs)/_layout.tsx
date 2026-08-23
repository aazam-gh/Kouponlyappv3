import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Bookmark, Home, Map, Search, UserRound } from "lucide-react-native";
import { Platform, StyleSheet, View } from "react-native";
import { GlassSurface } from "@/components/ui";
import { F, useAppTheme } from "@/lib/theme";

const icons={index:Home,search:Search,map:Map,saved:Bookmark,me:UserRound};

function AppleTabs(){
  const {colors:C,dark}=useAppTheme();
  return <NativeTabs tintColor={C.ink} iconColor={{default:C.muted,selected:C.ink}} labelStyle={{fontFamily:F.bodySemi,fontSize:11,color:C.muted}} blurEffect={dark?"systemChromeMaterialDark":"systemChromeMaterialLight"} minimizeBehavior="onScrollDown" shadowColor={C.line}>
    <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Icon sf={{default:"house",selected:"house.fill"}}/><NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="search"><NativeTabs.Trigger.Icon sf="magnifyingglass"/><NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="map"><NativeTabs.Trigger.Icon sf={{default:"map",selected:"map.fill"}}/><NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="saved" hidden><NativeTabs.Trigger.Icon sf="bookmark.fill"/><NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="me"><NativeTabs.Trigger.Icon sf={{default:"person",selected:"person.fill"}}/><NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}

function FallbackTabs(){
  const {colors:C}=useAppTheme();
  return <Tabs screenOptions={({route})=>{const Icon=icons[route.name as keyof typeof icons]??Home;return {headerShown:false,tabBarIcon:({focused})=><View style={[styles.icon,focused&&{backgroundColor:C.lime}]}><Icon size={focused?21:20} strokeWidth={focused?2.7:2} color={focused?C.ink:C.muted}/></View>,tabBarActiveTintColor:C.ink,tabBarInactiveTintColor:C.muted,tabBarLabelStyle:styles.label,tabBarStyle:[styles.tab,{borderTopColor:C.line}],tabBarBackground:()=> <GlassSurface style={StyleSheet.absoluteFill} intensity={78}><View/></GlassSurface>};}}>
    <Tabs.Screen name="index" options={{title:"Home"}}/><Tabs.Screen name="search" options={{title:"Search"}}/><Tabs.Screen name="map" options={{title:"Map"}}/><Tabs.Screen name="saved" options={{title:"Saved",href:null}}/><Tabs.Screen name="me" options={{title:"Me"}}/>
  </Tabs>;
}

export default function TabsLayout(){return Platform.OS==="ios"?<AppleTabs/>:<FallbackTabs/>}
const styles=StyleSheet.create({tab:{position:"absolute",height:78,paddingTop:8,paddingBottom:10,backgroundColor:"transparent"},label:{fontFamily:F.bodyBold,fontSize:11},icon:{width:36,height:36,borderRadius:12,alignItems:"center",justifyContent:"center"}});
