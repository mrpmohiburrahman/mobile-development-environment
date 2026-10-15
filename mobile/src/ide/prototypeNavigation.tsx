import { createContext, useContext } from 'react';

export type PrototypeAction = 'push' | 'tab' | 'back';
export const PrototypeNavigationContext = createContext<((action: PrototypeAction, href?: string) => void) | null>(null);
export const usePrototypeNavigation = () => useContext(PrototypeNavigationContext);
