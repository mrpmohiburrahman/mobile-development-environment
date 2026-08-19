Type: prototype
Status: resolved
Blocked by: 02

## Question

How do screens behave differently inside the blueprint? The talk threads a `designing` prop into every screen so navigation is suppressed and a tap renders inline. Under Expo Router, a context provider may beat prop-drilling. Prototype both and pick.

## Answer

Context, not a prop.

The talk threads a `designing` prop into every screen. Under Expo Router that doesn't fit: the router owns screen mounting, so there is no single call site to pass a prop from, and threading it would grow an argument on every intermediate component that doesn't care.

`src/ide/designing.tsx` provides `DesigningProvider` + `useNavigate()`. Screens call `useNavigate()` instead of `useRouter()`; inside the artboard it no-ops. Screens are identical in both contexts, with no prop to forget.
