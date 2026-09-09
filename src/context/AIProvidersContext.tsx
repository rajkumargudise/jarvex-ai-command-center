import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { useAIProviders } from '../hooks/useAIProviders';
import type { UseAIProvidersResult } from '../hooks/useAIProviders';
import { useOllama } from '../hooks/useOllama';
import type { UseOllamaResult } from '../hooks/useOllama';

export interface AIState {
  ollama: UseOllamaResult;
  providers: UseAIProvidersResult;
}

export const AIProvidersContext = createContext<AIState | null>(null);

export function AIProvidersProvider({ children }: { children: ReactNode }) {
  const ollama: UseOllamaResult = useOllama();
  const providersState: UseAIProvidersResult = useAIProviders();

  return (
    <AIProvidersContext.Provider value={{ ollama, providers: providersState }}>
      {children}
    </AIProvidersContext.Provider>
  );
}

export function useAIState(): AIState {
  const state = useContext(AIProvidersContext);
  if (!state) {
    throw new Error('useAIState must be used within <AIProvidersProvider>');
  }
  return state;
}

