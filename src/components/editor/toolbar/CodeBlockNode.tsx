"use client"

import React, { useRef, useState } from 'react'
import { NodeKey, LexicalNode, DecoratorNode, SerializedLexicalNode } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { Copy, Check, Edit3 } from 'lucide-react'

export interface CodeBlockPayload {
  key?: NodeKey
  language?: string
  code?: string
  showLineNumbers?: boolean
}

export interface SerializedCodeBlockNode extends SerializedLexicalNode {
  language: string
  code: string
  showLineNumbers: boolean
  type: 'custom-codeblock'
  version: 1
}

interface CodeBlockComponentProps {
  language: string
  code: string
  showLineNumbers: boolean
  nodeKey: NodeKey
}

// Language display names and their extensions
const LANGUAGE_INFO: Record<string, { label: string; extension: string }> = {
  javascript: { label: 'JavaScript', extension: 'js' },
  typescript: { label: 'TypeScript', extension: 'ts' },
  python: { label: 'Python', extension: 'py' },
  java: { label: 'Java', extension: 'java' },
  cpp: { label: 'C++', extension: 'cpp' },
  c: { label: 'C', extension: 'c' },
  csharp: { label: 'C#', extension: 'cs' },
  php: { label: 'PHP', extension: 'php' },
  ruby: { label: 'Ruby', extension: 'rb' },
  go: { label: 'Go', extension: 'go' },
  rust: { label: 'Rust', extension: 'rs' },
  sql: { label: 'SQL', extension: 'sql' },
  html: { label: 'HTML', extension: 'html' },
  css: { label: 'CSS', extension: 'css' },
  json: { label: 'JSON', extension: 'json' },
  xml: { label: 'XML', extension: 'xml' },
  yaml: { label: 'YAML', extension: 'yml' },
  bash: { label: 'Bash', extension: 'sh' },
  powershell: { label: 'PowerShell', extension: 'ps1' },
  dockerfile: { label: 'Dockerfile', extension: 'dockerfile' },
  markdown: { label: 'Markdown', extension: 'md' },
  plaintext: { label: 'Plain Text', extension: 'txt' },
}

function CodeBlockComponent({ language, code, showLineNumbers, nodeKey }: CodeBlockComponentProps) {
  const [editor] = useLexicalComposerContext()
  const [isCopied, setIsCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [localCode, setLocalCode] = useState(code)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const languageInfo = LANGUAGE_INFO[language] || { label: language, extension: language }
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localCode)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }
  
  const handleDoubleClick = () => {
    setIsEditing(true)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(localCode.length, localCode.length)
      }
    }, 0)
  }
  
  const handleSingleClick = () => {
    if (!isEditing) {
      setIsEditing(true)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(0, 0)
        }
      }, 0)
    }
  }
  
  const handleBlur = () => {
    setIsEditing(false)
    // Update the node's code when editing is finished
    editor.update(() => {
      const node = editor.getEditorState()._nodeMap.get(nodeKey)
      if (node instanceof CodeBlockNode) {
        const writableNode = node.getWritable()
        writableNode.__code = localCode
      }
    })
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false)
      if (textareaRef.current) {
        textareaRef.current.blur()
      }
    }
    // Allow Tab key in textarea
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = localCode.substring(0, start) + '  ' + localCode.substring(end)
        setLocalCode(newValue)
        // Set cursor position after the inserted spaces
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2
        }, 0)
      }
    }
  }
  
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalCode(e.target.value)
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }
  
  // Auto-resize textarea when entering edit mode
  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
    }
  }, [isEditing])
  
  // Sync local code with prop when it changes from outside
  React.useEffect(() => {
    setLocalCode(code)
  }, [code])
  
  const lines = localCode.split('\n')
  
  return (
    <div className="relative group my-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {languageInfo.label}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
            {languageInfo.extension}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title={isEditing ? "Stop editing" : "Edit code"}
          >
            <Edit3 className="h-3 w-3" />
            <span>{isEditing ? "Done" : "Edit"}</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Copy code"
          >
            {isCopied ? (
              <>
                <Check className="h-3 w-3" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Code Content */}
      <div className="relative">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={localCode}
            onChange={handleTextareaChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-auto min-h-[100px] p-4 bg-white dark:bg-gray-800 text-sm font-mono text-gray-800 dark:text-gray-200 border-2 border-blue-500 dark:border-blue-400 rounded outline-none resize-none"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              lineHeight: '1.5',
            }}
            placeholder="Enter your code here..."
            autoFocus
          />
        ) : (
          <div 
            className="flex cursor-text"
            onClick={handleSingleClick}
            onDoubleClick={handleDoubleClick}
            title="Click to edit code"
          >
            {showLineNumbers && (
              <div className="flex-shrink-0 px-4 py-4 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {lines.map((_, index) => (
                    <div key={index} className="leading-6">
                      {index + 1}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex-1 p-4">
              <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                <code>{localCode}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export class CodeBlockNode extends DecoratorNode<React.ReactElement> {
  __language: string
  __code: string
  __showLineNumbers: boolean

  static getType(): string {
    return 'custom-codeblock'
  }

  static clone(node: CodeBlockNode): CodeBlockNode {
    return new CodeBlockNode(node.__language, node.__code, node.__showLineNumbers, node.__key)
  }

  constructor(language: string, code: string, showLineNumbers: boolean = false, key?: NodeKey) {
    super(key)
    this.__language = language
    this.__code = code
    this.__showLineNumbers = showLineNumbers
  }

  getLanguage(): string {
    return this.__language
  }

  getCode(): string {
    return this.__code
  }

  getShowLineNumbers(): boolean {
    return this.__showLineNumbers
  }

  setLanguage(language: string): void {
    const writable = this.getWritable()
    writable.__language = language
  }

  setCode(code: string): void {
    const writable = this.getWritable()
    writable.__code = code
  }

  setShowLineNumbers(showLineNumbers: boolean): void {
    const writable = this.getWritable()
    writable.__showLineNumbers = showLineNumbers
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'custom-codeblock-wrapper'
    return div
  }

  updateDOM(prevNode: CodeBlockNode): boolean {
    // Return true if the node needs to be re-rendered
    return (
      prevNode.__language !== this.__language ||
      prevNode.__code !== this.__code ||
      prevNode.__showLineNumbers !== this.__showLineNumbers
    )
  }

  decorate(): React.ReactElement {
    return (
      <CodeBlockComponent
        language={this.__language}
        code={this.__code}
        showLineNumbers={this.__showLineNumbers}
        nodeKey={this.__key}
      />
    )
  }

  static importJSON(serializedNode: SerializedCodeBlockNode): CodeBlockNode {
    const { language, code, showLineNumbers } = serializedNode
    const node = $createCodeBlockNode({
      language,
      code,
      showLineNumbers,
    })
    return node
  }

  exportJSON(): SerializedCodeBlockNode {
    return {
      language: this.__language,
      code: this.__code,
      showLineNumbers: this.__showLineNumbers,
      type: 'custom-codeblock',
      version: 1,
    }
  }

  isInline(): false {
    return false
  }
}

export function $createCodeBlockNode({
  language = 'javascript',
  code = '',
  showLineNumbers = false,
  key,
}: CodeBlockPayload): CodeBlockNode {
  return new CodeBlockNode(language, code, showLineNumbers, key)
}

export function $isCodeBlockNode(node: LexicalNode | null | undefined): node is CodeBlockNode {
  return node instanceof CodeBlockNode
} 