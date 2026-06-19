import React, { useState, useRef, useEffect } from 'react';
import { postMessage, type ZygoteNode } from '../vscode-api';
import MarkdownRenderer from './MarkdownRenderer';

interface NodeChatProps {
  node: ZygoteNode;
}

const NodeChat: React.FC<NodeChatProps> = ({ node }) => {
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [node.chat.length]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Append the user message
    postMessage({
      type: 'appendChatMessage',
      nodeId: node.id,
      role: 'user',
      content: trimmed,
    });

    // Trigger the AI to respond
    postMessage({
      type: 'requestChatResponse',
      nodeId: node.id,
    });

    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.sectionTitle}>Chat</h3>

      {/* Messages */}
      <div style={styles.messages}>
        {node.chat.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              ...(msg.role === 'user' ? styles.userMsg : styles.assistantMsg),
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
            <div style={styles.msgTime}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      {(node.status === 'draft' || node.status === 'committed') && (
        <div style={styles.inputRow}>
          <textarea
            style={styles.textarea}
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <button style={styles.sendBtn} onClick={handleSend}>
            Send
          </button>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '4px',
    marginTop: 0,
  },
  messages: {
    maxHeight: '300px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  message: {
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    lineHeight: 1.5,
  },
  userMsg: {
    backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground, #2a2a2a)',
    marginLeft: '24px',
  },
  assistantMsg: {
    backgroundColor: 'var(--vscode-editor-selectionBackground, #264f78)',
    marginRight: '24px',
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
  msgTime: {
    fontSize: '9px',
    opacity: 0.4,
    textAlign: 'right',
    marginTop: '4px',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
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
    resize: 'vertical',
    outline: 'none',
  },
  sendBtn: {
    padding: '6px 16px',
    backgroundColor: 'var(--vscode-button-background, #0e639c)',
    color: 'var(--vscode-button-foreground, #fff)',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    alignSelf: 'flex-end',
  },
};

export default NodeChat;
