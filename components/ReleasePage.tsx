import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
export function ReleaseButton({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button,disabled && {opacity:0.5}]}><Text style={s.buttonText}>{title}</Text></Pressable>;
}
export function ReleasePage({title,children,home=false}:{title:string;children:React.ReactNode;home?:boolean}) {
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}>{!home && <ReleaseButton title="Back" onPress={() => router.back()}/>}<Text accessibilityRole="header" style={s.title}>{title}</Text>{children}</ScrollView></SafeAreaView>;
}
export function Paragraph({children}:{children:React.ReactNode}) { return <Text style={s.copy}>{children}</Text>; }
const s = StyleSheet.create({safe:{flex:1,backgroundColor:'#FFF8F3'},content:{padding:24,gap:20,paddingBottom:40},title:{fontSize:30,fontWeight:'700',color:'#28313D'},copy:{fontSize:17,lineHeight:26,color:'#475569'},button:{minHeight:48,backgroundColor:'#A83D16',padding:16,borderRadius:12},buttonText:{color:'#fff',fontSize:17,fontWeight:'600',textAlign:'center'}});
