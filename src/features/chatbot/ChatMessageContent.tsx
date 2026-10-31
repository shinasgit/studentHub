import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface ChatMessageContentProps {
  content: string;
  isUser?: boolean;
}

/**
 * Formatted Code Block component with Copy button, language tag, and horizontal scroll.
 */
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      style={{
        margin: '14px 0',
        borderRadius: 'var(--radius-md)',
        background: '#0d1117',
        border: '1px solid #21262d',
        overflow: 'hidden',
        color: '#e6edf3',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: '#161b22',
          borderBottom: '1px solid #21262d',
          fontSize: '0.72rem',
          fontWeight: 600,
          color: '#8b949e',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Terminal size={12} color="var(--accent-primary)" />
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: copied ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
            border: copied ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid transparent',
            color: copied ? '#3fb950' : '#8b949e',
            fontSize: '0.72rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: 'var(--radius-xs)',
            transition: 'all var(--transition-fast)',
          }}
          title="Copy code to clipboard"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      <pre
        style={{
          margin: 0,
          padding: '14px 16px',
          fontFamily: 'var(--font-mono, "JetBrains Mono", "Fira Code", Consolas, monospace)',
          fontSize: '0.84rem',
          lineHeight: 1.55,
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
};

/**
 * Format inline markdown tokens: bold (**text**), italic (*text*), and inline code (`code`).
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }

    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      const code = token.slice(1, -1);
      parts.push(
        <code
          key={match.index}
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.85em',
            padding: '2px 6px',
            borderRadius: '4px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent-primary)',
          }}
        >
          {code}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    }

    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts;
}

/**
 * ChatMessageContent:
 * Renders assistant messages with structured markdown formatting
 * (headings, bullet points, numbered lists, tables, code blocks, bold text).
 */
export const ChatMessageContent: React.FC<ChatMessageContentProps> = ({ content, isUser }) => {
  if (isUser) {
    return (
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>
        {content}
      </div>
    );
  }

  // Parse blocks: code blocks ``` ... ```, tables, headings, lists, blockquotes, paragraphs
  type ParsedBlock =
    | { type: 'code'; language: string; code: string }
    | { type: 'heading'; level: number; text: string }
    | { type: 'list_bullet'; items: string[] }
    | { type: 'list_number'; items: string[] }
    | { type: 'table'; headers: string[]; rows: string[][] }
    | { type: 'blockquote'; text: string }
    | { type: 'paragraph'; text: string };

  const blocks: ParsedBlock[] = [];
  const rawLines = content.split('\n');

  let inCode = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let currentBulletItems: string[] = [];
  let currentNumberItems: string[] = [];
  let tableLines: string[] = [];

  const flushLists = () => {
    if (currentBulletItems.length > 0) {
      blocks.push({ type: 'list_bullet', items: [...currentBulletItems] });
      currentBulletItems = [];
    }
    if (currentNumberItems.length > 0) {
      blocks.push({ type: 'list_number', items: [...currentNumberItems] });
      currentNumberItems = [];
    }
  };

  const flushTable = () => {
    if (tableLines.length >= 2) {
      // Split header row
      const parseRow = (line: string) =>
        line
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseRow(tableLines[0]);
      // Skip delimiter row (line 1 is typically |---|---|)
      const dataRows: string[][] = [];
      for (let i = 1; i < tableLines.length; i++) {
        const row = parseRow(tableLines[i]);
        // If delimiter row (all hyphens or colons), skip
        if (row.every((cell) => /^[:\s-]+$/.test(cell))) {
          continue;
        }
        dataRows.push(row);
      }
      blocks.push({ type: 'table', headers, rows: dataRows });
    } else if (tableLines.length === 1) {
      blocks.push({ type: 'paragraph', text: tableLines[0] });
    }
    tableLines = [];
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Check code fences
    if (trimmed.startsWith('```')) {
      if (!inCode) {
        flushLists();
        flushTable();
        inCode = true;
        codeLang = trimmed.substring(3).trim();
        codeLines = [];
      } else {
        inCode = false;
        blocks.push({ type: 'code', language: codeLang, code: codeLines.join('\n') });
        codeLines = [];
        codeLang = '';
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Markdown Table lines: starts with '|' and contains '|'
    if (trimmed.startsWith('|') && trimmed.includes('|', 1)) {
      flushLists();
      tableLines.push(trimmed);
      continue;
    } else if (tableLines.length > 0) {
      flushTable();
    }

    // Bullet lists: '- item' or '* item'
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (currentNumberItems.length > 0) flushLists();
      currentBulletItems.push(bulletMatch[2]);
      continue;
    }

    // Numbered lists: '1. item'
    const numberMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (numberMatch) {
      if (currentBulletItems.length > 0) flushLists();
      currentNumberItems.push(numberMatch[2]);
      continue;
    }

    // Any other regular line flushes lists
    if (currentBulletItems.length > 0 || currentNumberItems.length > 0) {
      flushLists();
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'heading', level: 3, text: trimmed.substring(4) });
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'heading', level: 2, text: trimmed.substring(3) });
      continue;
    }
    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'heading', level: 1, text: trimmed.substring(2) });
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      blocks.push({ type: 'blockquote', text: trimmed.substring(2) });
      continue;
    }

    // Blank line
    if (!trimmed) {
      continue;
    }

    // Regular paragraph
    blocks.push({ type: 'paragraph', text: line });
  }

  // Flush remaining buffers
  if (inCode && codeLines.length > 0) {
    blocks.push({ type: 'code', language: codeLang, code: codeLines.join('\n') });
  }
  flushLists();
  flushTable();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', wordBreak: 'break-word' }}>
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return <CodeBlock key={idx} language={block.language} code={block.code} />;
        }

        if (block.type === 'heading') {
          const fontSize = block.level === 1 ? '1.18rem' : block.level === 2 ? '1.05rem' : '0.96rem';
          return (
            <div
              key={idx}
              style={{
                fontSize,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: idx > 0 ? '10px' : 0,
                marginBottom: '2px',
                borderBottom: block.level <= 2 ? '1px solid var(--border-subtle)' : 'none',
                paddingBottom: block.level <= 2 ? '6px' : 0,
              }}
            >
              {renderInlineMarkdown(block.text)}
            </div>
          );
        }

        if (block.type === 'list_bullet') {
          return (
            <ul
              key={idx}
              style={{
                margin: '4px 0 8px 20px',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {block.items.map((it, itemIdx) => (
                <li key={itemIdx} style={{ lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {renderInlineMarkdown(it)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'list_number') {
          return (
            <ol
              key={idx}
              style={{
                margin: '4px 0 8px 22px',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {block.items.map((it, itemIdx) => (
                <li key={itemIdx} style={{ lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {renderInlineMarkdown(it)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'table') {
          return (
            <div
              key={idx}
              style={{
                margin: '12px 0',
                overflowX: 'auto',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.88rem',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border-medium)' }}>
                    {block.headers.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        style={{
                          padding: '10px 14px',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {renderInlineMarkdown(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: rIdx < block.rows.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        background: rIdx % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                      }}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          style={{
                            padding: '10px 14px',
                            color: 'var(--text-primary)',
                            lineHeight: 1.5,
                          }}
                        >
                          {renderInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <div
              key={idx}
              style={{
                margin: '8px 0',
                padding: '8px 14px',
                borderLeft: '3px solid var(--accent-primary)',
                background: 'var(--bg-tertiary)',
                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                fontSize: '0.90rem',
              }}
            >
              {renderInlineMarkdown(block.text)}
            </div>
          );
        }

        // Paragraph
        return (
          <div key={idx} style={{ lineHeight: 1.65, color: 'var(--text-primary)' }}>
            {renderInlineMarkdown(block.text)}
          </div>
        );
      })}
    </div>
  );
};
