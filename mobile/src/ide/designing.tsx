import { createContext, useContext, type ReactNode } from 'react';
import { useRouter } from 'expo-router';

/**
 * Screens rendered inside the blueprint need to behave slightly differently:
 * a tap must not navigate, or the whole artboard would sail off to one route.
 *
 * The talk this is modelled on threaded a `designing` prop through every screen.
 * Context is better here — Expo Router owns screen mounting, so there is no
 * single call site to pass a prop from, and prop-drilling it would mean every
 * intermediate component grows an argument it doesn't care about.
 */
const DesigningContext = createContext(false);

export const DesigningProvider = ({ children }: { children: ReactNode }) => (
  <DesigningContext.Provider value={true}>{children}</DesigningContext.Provider>
);

export const useDesigning = () => useContext(DesigningContext);

/**
 * Navigation that no-ops inside the blueprint. Screens call this instead of
 * `useRouter` so they work unchanged in both contexts.
 */
export function useNavigate() {
  const designing = useDesigning();
  const router = useRouter();
  return (href: string) => {
    if (designing) return;
    router.push(href as never);
  };
}
