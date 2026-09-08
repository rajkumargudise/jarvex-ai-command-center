import type { ChatMessage as ChatMessageType } from '../../types/ai';

interface ChatMessageProps {
  message: ChatMessageType;
}

function formatMarkdown(content: string): string {
  // Escape HTML first
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (```language\ncode```)
  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_, lang, code) => {
      const langLabel = lang ? `<div class="code-lang">${lang}</div>` : '';
      return `<div class="code-block">${langLabel}<pre><code>${code.trim()}</code></pre></div>`;
    },
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Bullet lists
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Line breaks
  html = html.replace(/\n/g, '<br />');

  // Clean up extra breaks around block elements
  html = html.replace(/<br \/>=<pre>/g, '<pre>');
  html = html.replace(/<\/pre>=<br \/>/g, '</pre>');

  return html;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="chat-message system">
        <div className="chat-bubble">{message.content}</div>
      </div>
    );
  }

  const formattedContent = formatMarkdown(message.content);

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      <div className="chat-avatar">
        {isUser ? 'U' : 'J'}
      </div>
      <div className="chat-content">
        <div className="chat-role">{isUser ? 'You' : 'JARVEX'}</div>
        <div
          className="chat-bubble"
          dangerouslySetInnerHTML={{ __html: formattedContent }}
        />
      </div>
    </div>
  );
}
