import React from 'react';
import { Paragraph, ReleasePage } from '../components/ReleasePage';
import { PRIVACY_PARAGRAPHS } from '../constants/releasePolicy';
export default function Privacy() { return <ReleasePage title="Privacy policy">{PRIVACY_PARAGRAPHS.map(p => <Paragraph key={p}>{p}</Paragraph>)}</ReleasePage>; }
