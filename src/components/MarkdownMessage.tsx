"use client";
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// Basic syntax highlighting using prismjs already in project
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';

// Lightweight hook to highlight after render
function usePrismHighlight(dep: string) {
  React.useEffect(() => { try { Prism.highlightAll(); } catch {} }, [dep]);
}

// Function to get contextual emoji for headings
function getEmojiForHeading(content: string, level: number): string {
  const text = content.toLowerCase();
  
  // Common patterns and their emojis
  const patterns = [
    // Tech & Development
    { keywords: ['api', 'endpoint', 'request', 'response'], emoji: '🔌' },
    { keywords: ['database', 'db', 'sql', 'query'], emoji: '🗄️' },
    { keywords: ['code', 'function', 'method', 'implementation'], emoji: '💻' },
    { keywords: ['bug', 'error', 'fix', 'debug'], emoji: '🐛' },
    { keywords: ['test', 'testing', 'unit test'], emoji: '🧪' },
    { keywords: ['deploy', 'deployment', 'production'], emoji: '🚀' },
    { keywords: ['security', 'auth', 'authentication'], emoji: '🔒' },
    { keywords: ['performance', 'optimization', 'speed'], emoji: '⚡' },
    { keywords: ['config', 'configuration', 'settings'], emoji: '⚙️' },
    
    // Documentation & Learning
    { keywords: ['example', 'demo', 'sample'], emoji: '📋' },
    { keywords: ['tutorial', 'guide', 'how to'], emoji: '📚' },
    { keywords: ['note', 'notes', 'important'], emoji: '📝' },
    { keywords: ['tip', 'tips', 'advice'], emoji: '💡' },
    { keywords: ['warning', 'caution', 'alert'], emoji: '⚠️' },
    { keywords: ['summary', 'conclusion', 'overview'], emoji: '📊' },
    { keywords: ['features', 'capabilities'], emoji: '✨' },
    { keywords: ['benefits', 'advantages'], emoji: '✅' },
    { keywords: ['requirements', 'prerequisites'], emoji: '📋' },
    
    // Process & Workflow
    { keywords: ['step', 'steps', 'process'], emoji: '👣' },
    { keywords: ['install', 'installation', 'setup'], emoji: '📦' },
    { keywords: ['getting started', 'introduction'], emoji: '🎯' },
    { keywords: ['usage', 'how to use'], emoji: '🛠️' },
    { keywords: ['troubleshooting', 'problems'], emoji: '🔧' },
    { keywords: ['solution', 'solutions', 'fix'], emoji: '💡' },
    { keywords: ['result', 'results', 'output'], emoji: '📈' },
    
    // Content Types
    { keywords: ['question', 'questions', 'faq'], emoji: '❓' },
    { keywords: ['answer', 'answers', 'response'], emoji: '💬' },
    { keywords: ['list', 'items', 'options'], emoji: '📝' },
    { keywords: ['comparison', 'vs', 'versus'], emoji: '⚖️' },
    { keywords: ['pros', 'cons'], emoji: '📊' },
    
    // General Actions
    { keywords: ['create', 'creating', 'build'], emoji: '🏗️' },
    { keywords: ['update', 'updating', 'modify'], emoji: '🔄' },
    { keywords: ['delete', 'remove', 'clean'], emoji: '🗑️' },
    { keywords: ['add', 'adding', 'include'], emoji: '➕' },
    { keywords: ['manage', 'management', 'organize'], emoji: '📁' },
    
    // Default emojis by heading level
    { keywords: [''], emoji: level === 1 ? '🎯' : level === 2 ? '📌' : level === 3 ? '💡' : '🔸' }
  ];
  
  // Find the first matching pattern
  for (const pattern of patterns) {
    if (pattern.keywords[0] === '' || pattern.keywords.some(keyword => text.includes(keyword))) {
      return pattern.emoji;
    }
  }
  
  return level === 1 ? '🎯' : level === 2 ? '📌' : level === 3 ? '💡' : '🔸';
}

export interface MarkdownMessageProps {
  content: string;
}

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  usePrismHighlight(content);
  return (
    <div className="prose prose-invert max-w-none prose-headings:mt-6 prose-headings:mb-4 prose-p:my-4 prose-p:leading-7 prose-ul:my-4 prose-ol:my-4 prose-li:my-2 prose-pre:rounded-xl prose-pre:bg-[#111]/80 prose-code:text-blue-300 prose-code:before:hidden prose-code:after:hidden prose-table:mt-6 prose-table:mb-8 prose-blockquote:my-6" style={{ fontSize: '15px' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: (p) => {
            const content = String(p.children);
            const emoji = getEmojiForHeading(content, 1);
            return (
              <h1 className="text-2xl font-semibold tracking-tight mb-4 mt-8 border-b border-border/30 pb-2 text-white" {...p}>
                {emoji && <span className="mr-2">{emoji}</span>}
                {p.children}
              </h1>
            );
          },
          h2: (p) => {
            const content = String(p.children);
            const emoji = getEmojiForHeading(content, 2);
            return (
              <h2 className="text-xl font-semibold tracking-tight border-b border-border/50 pb-2 mb-4 mt-8 text-white" {...p}>
                {emoji && <span className="mr-2">{emoji}</span>}
                {p.children}
              </h2>
            );
          },
          h3: (p) => {
            const content = String(p.children);
            const emoji = getEmojiForHeading(content, 3);
            return (
              <h3 className="text-lg font-semibold tracking-tight mb-3 mt-6 text-white" {...p}>
                {emoji && <span className="mr-2">{emoji}</span>}
                {p.children}
              </h3>
            );
          },
          h4: (p) => {
            const content = String(p.children);
            const emoji = getEmojiForHeading(content, 4);
            return (
              <h4 className="text-base font-semibold tracking-tight mb-2 mt-4 text-white" {...p}>
                {emoji && <span className="mr-2">{emoji}</span>}
                {p.children}
              </h4>
            );
          },
          p: (p) => <p className="mb-4 leading-7 text-foreground break-words text-[15px]" style={{ lineHeight: '1.7', letterSpacing: '0.01em' }} {...p} />,
          ul: (p) => <ul className="mb-4 mt-2 space-y-1 pl-6 list-disc marker:text-foreground/60" {...p} />,
          ol: (p) => <ol className="mb-4 mt-2 space-y-1 pl-6 list-decimal marker:text-foreground/60" {...p} />,
          li: (p) => (
            <li 
              className="leading-7 text-[15px] mb-2" 
              style={{ lineHeight: '1.7' }}
              {...p}
            />
          ),
          code(codeProps: { inline?: boolean; className?: string; children?: React.ReactNode }) {
            const inline = codeProps.inline;
            const className = codeProps.className;
            const children = codeProps.children as React.ReactNode;
            const props = {} as Record<string, unknown>;
            const lang = /language-(\w+)/.exec(className || '')?.[1];
            if (inline || !lang) {
              return <code className="px-1.5 py-0.5 rounded bg-muted text-[0.85em] border border-border/30" {...props}>{children}</code>
            }
            return (
              <pre className="relative group my-6 border border-border/30 rounded-xl overflow-hidden">
                <code className={(className || '') + ' block overflow-x-auto p-4 text-sm bg-[#0f0f0f]'} {...props}>{children}</code>
                <button
                  type="button"
                  onClick={() => { try { navigator.clipboard.writeText(String(children)); } catch {} }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition"
                >Copy</button>
              </pre>
            )
          },
          table: (p) => <div className="overflow-x-auto my-6 border border-border/30 rounded-lg"><table className="min-w-full border-collapse text-sm" {...p} /></div>,
          th: (p) => <th className="bg-muted/60 px-4 py-3 text-left font-medium border-b border-r border-border/40 last:border-r-0" {...p} />,
          td: (p) => <td className="px-4 py-3 align-top border-b border-r border-border/30 last:border-r-0" {...p} />,
          blockquote: (p) => <blockquote className="border-l-4 border-blue-500/50 pl-6 my-6 italic text-foreground/90 bg-muted/20 py-2 rounded-r-lg" {...p} />,
          a: (p) => <a className="text-blue-400 hover:underline hover:text-blue-300 transition-colors" target="_blank" rel="noopener noreferrer" {...p} />,
          hr: () => <hr className="my-8 border-border/60" />,
          strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
          em: (p) => <em className="italic text-foreground/90" {...p} />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
