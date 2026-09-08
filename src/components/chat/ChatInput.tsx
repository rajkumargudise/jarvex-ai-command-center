import { useRef, useEffect, type KeyboardEvent } from 'react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isGenerating,
  disabled,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isGenerating && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isGenerating]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isGenerating) {
        onStop();
      } else if (value.trim()) {
        onSend();
      }
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  };

  const canSend = !isGenerating && !disabled && value.trim().length > 0;

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={
            disabled
              ? 'No model selected...'
              : isGenerating
                ? 'Generating...'
                : 'Message JARVEX AI...'
          }
          disabled={disabled || isGenerating}
          rows={1}
          maxLength={10000}
        />
        <button
          className={`chat-send-button ${isGenerating ? 'stop' : 'send'}`}
          onClick={isGenerating ? onStop : onSend}
          disabled={!isGenerating && !canSend}
          type="button"
          aria-label={isGenerating ? 'Stop generation' : 'Send message'}
        >
          {isGenerating ? '■' : '➤'}
        </button>
      </div>
      <div className="chat-input-hint">
        <span>Enter to send</span>
        <span>Shift+Enter for newline</span>
      </div>
    </div>
  );
}
