/**
 * CONTRACT FILE: the five hooks every screen uses. Frozen while workers run in parallel.
 * Providers live elsewhere: fixtures in src/ui/dev during UI work, the real ones in src/game/providers.tsx.
 */
import { createContext, useContext } from 'react';
import type { ConfigApi, ConfigEditApi, DataApi, GameActions, GameView, PlatformApi, SettingsApi } from './api';

export interface GameApi {
  view: GameView;
  actions: GameActions;
}

export const ConfigContext = createContext<ConfigApi | null>(null);
export const GameContext = createContext<GameApi | null>(null);
export const PlatformContext = createContext<PlatformApi | null>(null);
export const SettingsContext = createContext<SettingsApi | null>(null);
export const DataContext = createContext<DataApi | null>(null);
export const ConfigEditContext = createContext<ConfigEditApi | null>(null);

function required<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`${name} is missing: wrap the app in its provider.`);
  return value;
}

export const useConfig = (): ConfigApi => required(useContext(ConfigContext), 'ConfigContext');
export const useGame = (): GameApi => required(useContext(GameContext), 'GameContext');
export const usePlatform = (): PlatformApi => required(useContext(PlatformContext), 'PlatformContext');
export const useSettings = (): SettingsApi => required(useContext(SettingsContext), 'SettingsContext');
export const useData = (): DataApi => required(useContext(DataContext), 'DataContext');
export const useConfigEdit = (): ConfigEditApi => required(useContext(ConfigEditContext), 'ConfigEditContext');
