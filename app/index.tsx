import { router } from 'expo-router';
import React from 'react';
import { Paragraph, ReleaseButton, ReleasePage } from '../components/ReleasePage';
export default function Home() {
  return <ReleasePage title="RailMitra" home>
    <Paragraph>Find a willing passenger to exchange seats with you.</Paragraph>
    <Paragraph>Post your seat and preferences, find a compatible passenger, and confirm independently on both phones.</Paragraph>
    <ReleaseButton title="Find a seat exchange" onPress={() => router.push('/swap')}/>
    <ReleaseButton title="My offer history" onPress={() => router.push('/history')}/>
    <ReleaseButton title="Settings and privacy" onPress={() => router.push('/settings')}/>
    <Paragraph>Works through nearby Bluetooth/Wi-Fi and cloud sync when available. Nearby exchange needs compatible app users and permissions. Keep the swap screen open on both phones.</Paragraph>
    <Paragraph>Independent app. Not affiliated with Indian Railways or IRCTC. App confirmation does not change an official reservation.</Paragraph>
  </ReleasePage>;
}
