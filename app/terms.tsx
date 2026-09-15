import React from 'react';
import { Paragraph, ReleasePage } from '../components/ReleasePage';
import { TERMS_PARAGRAPHS } from '../constants/releasePolicy';
export default function Terms() { return <ReleasePage title="Usage terms">{TERMS_PARAGRAPHS.map(p => <Paragraph key={p}>{p}</Paragraph>)}</ReleasePage>; }
