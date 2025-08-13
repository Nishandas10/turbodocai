"use client"

import { useState, useRef, useEffect } from 'react'
import { Plus, ChevronDown, Grid3X3, List, Quote, Code, Image, Minus, ChevronRight } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { INSERT_TABLE_COMMAND } from '@lexical/table'
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import { $createQuoteNode } from '@lexical/rich-text'
import { $getSelection, $isRangeSelection, $createTextNode, $createParagraphNode, $getRoot } from 'lexical'
import { $createImageNode } from './ImageNode'
import { $createHorizontalRuleNode } from './HorizontalRuleNode'
import { $createCodeBlockNode } from './CodeBlockNode'
import TablePicker from './TablePicker'
import { createPortal } from 'react-dom'

// Supported programming languages for code blocks
const SUPPORTED_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', extension: 'js' },
  { id: 'typescript', label: 'TypeScript', extension: 'ts' },
  { id: 'python', label: 'Python', extension: 'py' },
  { id: 'java', label: 'Java', extension: 'java' },
  { id: 'cpp', label: 'C++', extension: 'cpp' },
  { id: 'c', label: 'C', extension: 'c' },
  { id: 'csharp', label: 'C#', extension: 'cs' },
  { id: 'php', label: 'PHP', extension: 'php' },
  { id: 'ruby', label: 'Ruby', extension: 'rb' },
  { id: 'go', label: 'Go', extension: 'go' },
  { id: 'rust', label: 'Rust', extension: 'rs' },
  { id: 'sql', label: 'SQL', extension: 'sql' },
  { id: 'html', label: 'HTML', extension: 'html' },
  { id: 'css', label: 'CSS', extension: 'css' },
  { id: 'json', label: 'JSON', extension: 'json' },
  { id: 'xml', label: 'XML', extension: 'xml' },
  { id: 'yaml', label: 'YAML', extension: 'yml' },
  { id: 'bash', label: 'Bash', extension: 'sh' },
  { id: 'powershell', label: 'PowerShell', extension: 'ps1' },
  { id: 'dockerfile', label: 'Dockerfile', extension: 'dockerfile' },
  { id: 'markdown', label: 'Markdown', extension: 'md' },
  { id: 'plaintext', label: 'Plain Text', extension: 'txt' },
]

export default function InsertTools() {
  const [editor] = useLexicalComposerContext()
  const [showInsertDropdown, setShowInsertDropdown] = useState(false)
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [showCodeLanguages, setShowCodeLanguages] = useState(false)
  const [showLineNumbers, setShowLineNumbers] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const insertDropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (insertDropdownRef.current && !insertDropdownRef.current.contains(target)) {
        setShowInsertDropdown(false)
        setShowTablePicker(false)
        setShowCodeLanguages(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleButtonClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      })
    }
    setShowInsertDropdown(!showInsertDropdown)
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string
        
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            // Create the ImageNode using our custom node
            const imageNode = $createImageNode({
              altText: file.name,
              src: imageUrl,
              maxWidth: 500,
            })
            
            // Insert the image node at the current selection
            selection.insertNodes([imageNode])
            
            // Move cursor after the image for better inline flow
            imageNode.selectNext(0, 0)
            
            console.log('Image node inserted:', file.name)
          } else {
            // No selection - insert at root level
            const root = $getRoot()
            const imageNode = $createImageNode({
              altText: file.name,
              src: imageUrl,
              maxWidth: 500,
            })
            
            root.append(imageNode)
            
            // Create a new paragraph after the image and position cursor there
            const paragraphNode = $createParagraphNode()
            imageNode.insertAfter(paragraphNode)
            
            // Position cursor at the beginning of the new paragraph
            paragraphNode.select(0, 0)
            
            console.log('Image node inserted at root:', file.name)
          }
        })
      }
      reader.readAsDataURL(file)
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setShowInsertDropdown(false)
  }

  const handleInsert = (type: string, language?: string) => {
    switch (type) {
      case 'table':
        setShowTablePicker(!showTablePicker)
        return // Don't close dropdown yet
      case 'image':
        fileInputRef.current?.click()
        break
      case 'ordered-list':
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        break
      case 'unordered-list':
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        break
      case 'horizontal-rule':
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            // Clear any selected text and insert horizontal rule
            selection.removeText()
            const horizontalRuleNode = $createHorizontalRuleNode()
            selection.insertNodes([horizontalRuleNode])
            
            // Create a new paragraph after the horizontal rule
            const paragraphNode = $createParagraphNode()
            horizontalRuleNode.insertAfter(paragraphNode)
            
            // Position cursor at the beginning of the new paragraph
            paragraphNode.select(0, 0)
          } else {
            // No selection - insert at root level
            const root = $getRoot()
            const horizontalRuleNode = $createHorizontalRuleNode()
            root.append(horizontalRuleNode)
            
            // Create a new paragraph after the horizontal rule and position cursor there
            const paragraphNode = $createParagraphNode()
            horizontalRuleNode.insertAfter(paragraphNode)
            
            // Position cursor at the beginning of the new paragraph
            paragraphNode.select(0, 0)
          }
        })
        break
      case 'quote':
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            // Create a quote node with proper structure
            const quoteNode = $createQuoteNode()
            
            // If there's selected text, use it as quote content
            const selectedText = selection.getTextContent()
            const textContent = selectedText || 'Quote text here...'
            
            const textNode = $createTextNode(textContent)
            quoteNode.append(textNode)
            
            // Clear selection and insert the quote
            selection.removeText()
            selection.insertNodes([quoteNode])
            
            // Position cursor at the end of the quote text
            quoteNode.selectEnd()
          } else {
            // No selection - insert at root level
            const root = $getRoot()
            const quoteNode = $createQuoteNode()
            const textNode = $createTextNode('Quote text here...')
            quoteNode.append(textNode)
            root.append(quoteNode)
            
            // Position cursor at the end of the quote text
            quoteNode.selectEnd()
          }
        })
        break
      case 'code':
        // Show language picker instead of directly inserting code
        setShowCodeLanguages(!showCodeLanguages)
        return // Don't close dropdown yet
      case 'code-with-language':
        const selectedLanguage = language || 'javascript'
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            // Create a code block node with the selected language
            const selectedText = selection.getTextContent()
            const textContent = selectedText || getLanguageTemplate(selectedLanguage)
            
            const codeBlockNode = $createCodeBlockNode({
              language: selectedLanguage,
              code: textContent,
              showLineNumbers: showLineNumbers
            })
            
            // Clear selection and insert the code block
            selection.removeText()
            selection.insertNodes([codeBlockNode])
            
            // Position cursor after the code block
            const paragraphNode = $createParagraphNode()
            codeBlockNode.insertAfter(paragraphNode)
            paragraphNode.select(0, 0)
          } else {
            // No selection - insert at root level
            const root = $getRoot()
            const textContent = getLanguageTemplate(selectedLanguage)
            
            const codeBlockNode = $createCodeBlockNode({
              language: selectedLanguage,
              code: textContent,
              showLineNumbers: showLineNumbers
            })
            
            root.append(codeBlockNode)
            
            // Position cursor after the code block
            const paragraphNode = $createParagraphNode()
            codeBlockNode.insertAfter(paragraphNode)
            paragraphNode.select(0, 0)
          }
        })
        break
    }
    
    setShowInsertDropdown(false)
    setShowTablePicker(false)
    setShowCodeLanguages(false)
  }

  const handleTableSelect = (rows: number, cols: number) => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: rows.toString(), columns: cols.toString() })
    setShowInsertDropdown(false)
    setShowTablePicker(false)
  }

  const getLanguageTemplate = (language: string): string => {
    const templates: Record<string, string> = {
      javascript: '// JavaScript code here...\nconsole.log("Hello, World!");',
      typescript: '// TypeScript code here...\nconst message: string = "Hello, World!";\nconsole.log(message);',
      python: '# Python code here...\nprint("Hello, World!")',
      java: '// Java code here...\npublic class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
      cpp: '// C++ code here...\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
      c: '// C code here...\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
      csharp: '// C# code here...\nusing System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}',
      php: '<?php\n// PHP code here...\necho "Hello, World!";\n?>',
      ruby: '# Ruby code here...\nputs "Hello, World!"',
      go: '// Go code here...\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}',
      rust: '// Rust code here...\nfn main() {\n    println!("Hello, World!");\n}',
      sql: '-- SQL code here...\nSELECT "Hello, World!" AS message;',
      html: '<!-- HTML code here... -->\n<!DOCTYPE html>\n<html>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>',
      css: '/* CSS code here... */\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}',
      json: '{\n  "message": "Hello, World!",\n  "timestamp": "2024-01-01T00:00:00Z"\n}',
      xml: '<?xml version="1.0" encoding="UTF-8"?>\n<!-- XML code here... -->\n<root>\n    <message>Hello, World!</message>\n</root>',
      yaml: '# YAML code here...\nmessage: "Hello, World!"\ntimestamp: "2024-01-01T00:00:00Z"',
      bash: '#!/bin/bash\n# Bash script here...\necho "Hello, World!"',
      powershell: '# PowerShell script here...\nWrite-Host "Hello, World!"',
      dockerfile: '# Dockerfile here...\nFROM node:18-alpine\nWORKDIR /app\nCOPY package*.json .//\nRUN npm install\nCOPY . .\nEXPOSE 3000\nCMD ["npm", "start"]',
      markdown: '# Markdown content here...\n\nHello, **World**!\n\n- Item 1\n- Item 2\n- Item 3',
      plaintext: 'Plain text content here...\nHello, World!',
    }
    return templates[language] || '// Code here...'
  }

  return (
    <div className="relative" ref={insertDropdownRef}>
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />
      
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        className="flex items-center space-x-2 px-3 py-2 text-foreground hover:bg-muted rounded border border-border"
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm">Insert</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {showInsertDropdown && createPortal(
        <div 
          className="fixed bg-background border border-border rounded-lg shadow-lg z-[9999] min-w-[140px]"
          style={{
            top: dropdownPosition.top + 4,
            left: dropdownPosition.left
          }}
        >
          <div className="relative">
            <button 
              onClick={() => handleInsert('table')} 
              className={`
                w-full flex items-center justify-between px-3 py-2 text-foreground hover:bg-muted text-sm
                ${showTablePicker ? 'bg-muted' : ''}
              `}
            >
              <div className="flex items-center space-x-3">
                <Grid3X3 className="h-4 w-4" />
                <span>Table</span>
              </div>
              <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
            </button>
            {showTablePicker && (
              <TablePicker onSelect={handleTableSelect} maxSize={20} />
            )}
          </div>
          <button onClick={() => handleInsert('image')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Image className="h-4 w-4" />
            <span>Image</span>
          </button>
          <button onClick={() => handleInsert('horizontal-rule')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Minus className="h-4 w-4" />
            <span>Horizontal Rule</span>
          </button>
          <button onClick={() => handleInsert('ordered-list')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <List className="h-4 w-4" />
            <span>Numbered List</span>
          </button>
          <button onClick={() => handleInsert('unordered-list')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <List className="h-4 w-4" />
            <span>Bullet List</span>
          </button>
          <button onClick={() => handleInsert('quote')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Quote className="h-4 w-4" />
            <span>Quote</span>
          </button>
          <div className="relative">
            <button 
              onClick={() => handleInsert('code')} 
              className={`
                w-full flex items-center justify-between px-3 py-2 text-foreground hover:bg-muted text-sm
                ${showCodeLanguages ? 'bg-muted' : ''}
              `}
            >
              <div className="flex items-center space-x-3">
                <Code className="h-4 w-4" />
                <span>Code Block</span>
              </div>
              <ChevronRight className="h-3 w-3" />
            </button>
            {showCodeLanguages && (
              <div className="absolute right-full top-0 mr-1 bg-background border border-border rounded-lg shadow-lg z-[9999] min-w-[160px] max-h-60 overflow-y-auto">
                <div className="py-1">
                  {/* Line numbers toggle */}
                  <div className="px-3 py-2 border-b border-border">
                    <label className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showLineNumbers}
                        onChange={(e) => setShowLineNumbers(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span className="text-foreground">Show line numbers</span>
                    </label>
                  </div>
                  
                  {/* Language options */}
                  {SUPPORTED_LANGUAGES.map((language) => (
                    <button
                      key={language.id}
                      onClick={() => handleInsert('code-with-language', language.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-foreground hover:bg-muted text-sm"
                    >
                      <span>{language.label}</span>
                      <span className="text-xs text-muted-foreground">{language.extension}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
} 