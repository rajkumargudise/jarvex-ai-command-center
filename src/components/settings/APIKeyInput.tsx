import { useState } from 'react';

interface APIKeyInputProps {
  providerId: string;
  hasKey: boolean;
  onSave: (providerId: string, key: string) => Promise<void>;
  onRemove: (providerId: string) => void;
  disabled?: boolean;
}

export function APIKeyInput({
  providerId,
  hasKey,
  onSave,
  onRemove,
  disabled,
}: APIKeyInputProps) {
  const [value, setValue] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      await onSave(providerId, trimmed);
      setValue('');
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    onRemove(providerId);
  };

  return (
    <div className="api-key-input">
      {hasKey ? (
        <div className="api-key-configured">
          <span className="api-key-mask">••••••••••••••••••</span>
          <button
            className="text-button"
            onClick={handleRemove}
            type="button"
            disabled={disabled}
          >
            Remove API Key
          </button>
        </div>
      ) : (
        <div className="api-key-form">
          <div className="api-key-field">
            <input
              type={reveal ? 'text' : 'password'}
              className="api-key-textfield"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste API key"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className="icon-button"
              onClick={() => setReveal((prev) => !prev)}
              type="button"
              title={reveal ? 'Hide key' : 'Show key'}
            >
              {reveal ? '🙈' : '👁'}
            </button>
          </div>
          <button
            className="ghost-button"
            onClick={() => void handleSave()}
            disabled={disabled || !value.trim() || saving}
            type="button"
          >
            {saving ? 'Saving...' : 'Save Key'}
          </button>
        </div>
      )}
      {saved && <span className="api-key-saved">Key saved securely.</span>}
    </div>
  );
}