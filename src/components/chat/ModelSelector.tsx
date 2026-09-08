import type { AIModel } from '../../types/ai';

interface ModelSelectorProps {
  models: AIModel[];
  selectedModel: string | null;
  onSelect: (model: string) => void;
  disabled?: boolean;
}

export function ModelSelector({
  models,
  selectedModel,
  onSelect,
  disabled,
}: ModelSelectorProps) {
  if (models.length === 0) {
    return (
      <div className="model-selector-empty">
        <span>No models available</span>
      </div>
    );
  }

  return (
    <div className="model-selector">
      <label className="model-selector-label" htmlFor="model-select">
        Model
      </label>
      <select
        id="model-select"
        className="model-selector-dropdown"
        value={selectedModel ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled}
      >
        {models.map((model) => (
          <option key={model.name} value={model.name}>
            {model.name}
          </option>
        ))}
      </select>
    </div>
  );
}
