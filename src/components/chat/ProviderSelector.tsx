interface ProviderOption {
  id: string;
  name: string;
}

interface ProviderSelectorProps {
  providers: ProviderOption[];
  selected: string;
  onSelect: (providerId: string) => void;
  disabled?: boolean;
}

export function ProviderSelector({
  providers,
  selected,
  onSelect,
  disabled,
}: ProviderSelectorProps) {
  if (providers.length === 0) {
    return (
      <div className="model-selector-empty">
        <span>No providers available</span>
      </div>
    );
  }

  return (
    <div className="model-selector">
      <label
        className="model-selector-label"
        htmlFor="provider-select"
      >
        Provider
      </label>
      <select
        id="provider-select"
        className="model-selector-dropdown"
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        disabled={disabled}
      >
        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.name}
          </option>
        ))}
      </select>
    </div>
  );
}