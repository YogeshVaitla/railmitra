import React from 'react';
import { Redirect } from 'expo-router';
// Legacy demo deep links are retired from the passenger release.
export default function RetiredRoute() { return <Redirect href="/"/>; }
