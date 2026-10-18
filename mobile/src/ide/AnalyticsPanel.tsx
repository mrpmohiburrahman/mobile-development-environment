import { createElement } from 'react';
import { View } from 'react-native';
import { CHROME } from './chrome';
import { Label } from './Label';
import { analyticsNote } from './analyticsNote';

function mixpanelConfigured(): boolean {
  const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;
  return typeof token === 'string' && token.trim() !== '';
}

function ProjectLink({ href }: { href: string }) {
  return createElement(
    'a',
    {
      href,
      target: '_blank',
      rel: 'noreferrer',
      style: { color: '#D9481E', fontSize: 13, fontWeight: '600', lineHeight: '18px' },
    },
    href,
  );
}

export function AnalyticsPanel() {
  const note = analyticsNote(mixpanelConfigured());
  return (
    <View nativeID="analytics-note" style={{ gap: 12 }}>
      <Label role="body">{note.boundary}</Label>
      {note.status ? (
        <Label role="label" color={CHROME.text}>
          {note.status}
        </Label>
      ) : null}
      {note.caveat ? (
        <Label role="caption" color={CHROME.textMuted}>
          {note.caveat}
        </Label>
      ) : null}
      <ProjectLink href={note.projectUrl} />
    </View>
  );
}
