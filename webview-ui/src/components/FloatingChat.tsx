import React, { useState, useEffect, useRef } from 'react';
import {
  postMessage,
  onMessage,
  type ExtToWebviewMessage,
} from '../vscode-api';
import MarkdownRenderer from './MarkdownRenderer';

interface FloatingChatProps {
  onClose: () => void;
}

interface QuickMessage {
  role: 'user' | 'assistant';
  content: string;
}

const FloatingChat: React.FC<FloatingChatProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Listen for quick-ask responses
  useEffect(() => {
    const unsubscribe = onMessage((message: ExtToWebviewMessage) => {
      if (message.type === 'quickAskResponse') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: message.response },
        ]);
        setLoading(false);
      } else if (message.type === 'error') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${message.message}` },
        ]);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);

    postMessage({ type: 'quickAsk', prompt: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.headerTitle}>Quick Ask</span>
          <button style={styles.closeBtn} onClick={onClose}>
            X
          </button>
        </div>

        {/* Messages */}
        <div style={styles.messages}>
          {messages.length === 0 && (
            <p style={styles.emptyText}>
              Ask a quick question. This is ephemeral and does not affect the
              tree.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.message,
                ...(msg.role === 'user'
                  ? styles.userMsg
                  : styles.assistantMsg),
              }}
            >
              <div style={styles.msgRole}>
                {msg.role === 'user' ? 'You' : 'Claude'}
              </div>
              <div style={styles.msgContent}>
                {msg.role === 'assistant' ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={styles.loadingMsg}>Thinking...</div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={styles.inputRow}>
          <textarea
            style={styles.textarea}
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <button
            style={{
              ...styles.sendBtn,
              opacity: loading ? 0.5 : 1,
            }}
            onClick={handleSend}
            disabled={loading}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: 1000,
  },
  panel: {
    width: '380px',
    height: '460px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
    border: '1px solid var(--vscode-panel-border, #333)',
    borderRadius: '8px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--vscode-panel-border, #333)',
  },
  headerTitle: {
    fontWeight: 600,
    fontSize: '13px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--vscode-foreground, #ccc)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 6px',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  emptyText: {
    opacity: 0.5,
    textAlign: 'center',
    fontSize: '12px',
    marginTop: '40px',
  },
  message: {
    padding: '8px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    lineHeight: 1.5,
  },
  userMsg: {
    backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground, #2a2a2a)',
    marginLeft: '20px',
  },
  assistantMsg: {
    backgroundColor: 'var(--vscode-editor-selectionBackground, #264f78)',
    marginRight: '20px',
  },
  msgRole: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    opacity: 0.6,
    marginBottom: '2px',
  },
  msgContent: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  loadingMsg: {
    opacity: 0.5,
    fontStyle: 'italic',
    fontSize: '12px',
    padding: '4px 0',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    padding: '8px 12px',
    borderTop: '1px solid var(--vscode-panel-border, #333)',
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    padding: '6px 8px',
    backgroundColor: 'var(--vscode-input-background, #3c3c3c)',
    color: 'var(--vscode-input-foreground, #ccc)',
    border: '1px solid var(--vscode-input-border, #555)',
    borderRadius: '3px',
    fontSize: '12px',
    fontFamily: 'inherit',
    resize: 'none',
    outline: 'none',
  },
  sendBtn: {
    padding: '6px 14px',
    backgroundColor: 'var(--vscode-button-background, #0e639c)',
    color: 'var(--vscode-button-foreground, #fff)',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
  },
};

export default FloatingChat;
