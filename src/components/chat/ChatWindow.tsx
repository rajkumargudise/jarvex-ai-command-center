import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../../hooks/useChat';
import { ProviderSelector } from './ProviderSelector';
import { ModelSelector } from './ModelSelector';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

export function ChatWindow() {
  const {
    messages,
    isGenerating,
    error,
    selectedModel,
    setSelectedModel,
    selectedProvider,
    setSelectedProvider,
    providerId,
    providerOptions,
    providerModels,
    providerModelsLoading,
    providerOffline,
    providerHasNoModels,
    sendMessage,
    stopGeneration,
    clearChat,
    refreshProviderModels,
  } = useChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    shouldAutoScrollRef.current = isNearBottom;
  };

  const handleSend = () => {
    const content = input.trim();
    if (!content || isGenerating) return;
    setInput('');
    void sendMessage(content);
  };

  const handleStop = () => {
    stopGeneration();
  };

  const handleClear = () => {
    if (messages.length === 0) return;
    if (messages.length > 2) {
      const confirmed = window.confirm(
        'Start a new chat? This will clear the current conversation.',
      );
      if (!confirmed) return;
    }
    clearChat();
  };

  const providerName =
    providerId === 'gemini'
      ? 'Gemini'
      : providerId === 'nvidia'
        ? 'NVIDIA NIM'
        : providerId === 'ollama'
          ? 'Ollama'
          : providerId;

  const isOffline = providerOffline;
  const hasNoModels = providerHasNoModels;
  const chatDisabled = isOffline || hasNoModels;

  return (
    <section className="chat-window">
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="eyebrow">JARVEX AI</span>
          <h2>AI Chat</h2>
        </div>
        <div className="chat-header-right">
          <ProviderSelector
            providers={providerOptions}
            selected={selectedProvider}
            onSelect={setSelectedProvider}
            disabled={isGenerating}
          />
          <ModelSelector
            models={providerModels}
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
            disabled={isGenerating}
          />
          <button
            className="ghost-button"
            onClick={handleClear}
            disabled={isGenerating}
            type="button"
          >
            New Chat
          </button>
          <button
            className="ghost-button"
            onClick={() => void refreshProviderModels()}
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>

      {isOffline ? (
        <div className="chat-offline-state">
          <div className="offline-icon">○</div>
          <strong>
            {providerId === 'gemini'
              ? 'Gemini is unavailable'
              : providerId === 'nvidia'
                ? 'NVIDIA NIM is unavailable'
                : 'Ollama is offline'}
          </strong>
          <p>
            {providerId === 'gemini' || providerId === 'nvidia'
              ? 'Check the API key and network connection in Settings → AI Providers.'
              : 'Start Ollama on this computer to use local AI.'}
          </p>
          <button
            className="ghost-button retry-button"
            onClick={() => void refreshProviderModels()}
            type="button"
          >
            Retry Connection
          </button>
        </div>
      ) : hasNoModels ? (
        <div className="chat-offline-state">
          <div className="offline-icon">◇</div>
          <strong>No {providerName} models available</strong>
          <p>
            {providerId === 'gemini'
              ? 'No chat-capable Gemini models were discovered.'
              : providerId === 'nvidia'
                ? 'No chat-capable NVIDIA NIM models were discovered.'
                : 'Install an Ollama model to start chatting.'}
          </p>
          <button
            className="ghost-button retry-button"
            onClick={() => void refreshProviderModels()}
            type="button"
          >
            Refresh
          </button>
        </div>
      ) : (
        <>
          <div
            className="chat-messages"
            ref={chatContainerRef}
            onScroll={handleScroll}
          >
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <div className="empty-icon">✦</div>
                <strong>JARVEX AI</strong>
                <p>Your AI command center.</p>
                <p>Ask anything using {providerName}.</p>
                <div className="empty-model-info">
                  {selectedModel ? (
                    <span>Using: <strong>{selectedModel}</strong></span>
                  ) : providerModelsLoading ? (
                    <span>Loading models...</span>
                  ) : (
                    <span>No model selected</span>
                  )}
                </div>
                <p className="empty-hint">Start a conversation below.</p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                {error && <div className="chat-error">{error}</div>}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onStop={handleStop}
            isGenerating={isGenerating}
            disabled={chatDisabled}
          />
        </>
      )}
    </section>
  );
}
