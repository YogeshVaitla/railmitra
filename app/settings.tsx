import React, { useState } from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { Paragraph, ReleaseButton, ReleasePage } from '../components/ReleasePage';
import { eraseExchangeData } from '../services/exchange';
export default function Settings() {
  const [busy,setBusy] = useState(false);
  const contact=process.env.EXPO_PUBLIC_SUPPORT_EMAIL || '';
  const policy=process.env.EXPO_PUBLIC_PRIVACY_URL || '';
  const open=(url:string)=>{void Linking.openURL(url).catch(()=>Alert.alert('Unable to open link','Please try again or check your device settings.'));};
  return <ReleasePage title="Settings">
    <Paragraph>Release language: English. Nearby updates run only while the swap screen is open in the foreground.</Paragraph>
    <ReleaseButton title="About RailMitra" onPress={()=>router.push('/about')}/>
    <ReleaseButton title="Privacy policy" onPress={()=>router.push('/privacy')}/>
    <ReleaseButton title="Usage terms" onPress={()=>router.push('/terms')}/>
    {!!policy && <ReleaseButton title="Public privacy policy" onPress={()=>open(policy)}/>}
    {contact ? <ReleaseButton title="Contact support / privacy help" onPress={()=>open('mailto:'+contact+'?subject=RailMitra%20support')}/> : <Paragraph>Developer support contact must be configured before release.</Paragraph>}
    <ReleaseButton title={busy?'Deleting…':'Delete app data'} disabled={busy} onPress={()=>Alert.alert('Delete app data?','Cloud deletion must succeed before your key and local retry queue are removed. Previously delivered peer copies expire automatically. This cannot be undone.',[{text:'Keep data',style:'cancel'},{text:'Delete data',style:'destructive',onPress:()=>{setBusy(true);void eraseExchangeData().then(()=>router.replace('/')).catch(e=>Alert.alert('Deletion not completed',e.message+' Your key is retained so you can retry.')).finally(()=>setBusy(false));}}])}/>
    <Paragraph>Rate and review links will be added after a real Play Store listing exists.</Paragraph>
  </ReleasePage>;
}
