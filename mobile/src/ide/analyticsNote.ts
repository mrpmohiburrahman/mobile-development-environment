export const MIXPANEL_PROJECT_URL = 'https://mixpanel.com/project/4074212';

const BOUNDARY =
  'Analytics come from the app on a device or simulator. This studio sends nothing.';

const NOT_CONFIGURED = 'Mixpanel: not configured';

const WEB_CAVEAT =
  'A token in this web build does not prove the native app is configured, and it does not prove an event arrived.';

export type AnalyticsNote = {
  boundary: string;
  projectUrl: string;
  configured: boolean;
  status: string | null;
  caveat: string | null;
};

export function analyticsNote(configured: boolean): AnalyticsNote {
  return {
    boundary: BOUNDARY,
    projectUrl: MIXPANEL_PROJECT_URL,
    configured,
    status: configured ? null : NOT_CONFIGURED,
    caveat: configured ? WEB_CAVEAT : null,
  };
}
