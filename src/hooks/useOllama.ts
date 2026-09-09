import { useCallback, useEffect, useState } from "react";
import type { AIModel, OllamaStatus } from "../types/ai";
import { checkOllama } from "../services/ollama";

export interface UseOllamaResult {
  status: OllamaStatus;
  models: AIModel[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const initialStatus: OllamaStatus = {
  connected: false,
};

export function useOllama(): UseOllamaResult {
  const [status, setStatus] = useState<OllamaStatus>(initialStatus);
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const result = await checkOllama();

      setStatus(result.status);
      setModels(result.models);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    models,
    loading,
    refresh,
  };
}