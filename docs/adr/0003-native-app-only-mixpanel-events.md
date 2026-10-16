# Only the native app sends Mixpanel events

The studio on web renders the same screens as the native app. Only the native app sends Mixpanel events. The studio sends none, in dev and on the GitHub Pages build. The app is unpublished, so verification runs the app in the iOS Simulator.

## Reason

Mixpanel data must describe what users do in the app. A developer who taps a screen inside the studio is not a user. Events from the studio would mix developer activity into product analytics.

## Alternatives

- Send from the studio too, tagged `studio: true`, and filter in Mixpanel. Every report then depends on a filter that a reader can forget.
- Send from the studio only, as a demo. That demonstrates the API but measures nothing real.

## Consequences

- The analytics transport runs in native code paths only. A guard refuses to send on `Platform.OS === 'web'`.
- Ticket 01's browser `/track` findings are reference material, not the shipping transport.
- The Pages workflow needs no Mixpanel secret.
- The studio's Analytics tab cannot show "what this session sent". Ticket 07 decides what it shows instead.

See [ticket 07](../../.scratch/five-bullets-built/issues/07-mixpanel-event-design.md).
