"use client"

import { Bold, Italic, Underline, Link } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND } from 'lexical'
import { $createLinkNode } from '@lexical/link'
import { $getSelection, $isRangeSelection, $createTextNode } from 'lexical'

export default function TextFormatting() {
  const [editor] = useLexicalComposerContext()

  const handleFormatting = (format: 'bold' | 'italic' | 'underline') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
  }

  const handleLink = () => {
    const url = prompt('Enter URL:')
    if (url) {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const selectedText = selection.getTextContent()
          const linkNode = $createLinkNode(url)
          const textNode = $createTextNode(selectedText || 'Link')
          linkNode.append(textNode)
          selection.insertNodes([linkNode])
        }
      })
    }
  }

  return (
    <>
      {/* Text Formatting */}
      <div className="flex items-center space-x-1">
        <button 
          onClick={() => handleFormatting('bold')}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button 
          onClick={() => handleFormatting('italic')}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button 
          onClick={() => handleFormatting('underline')}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Underline (Ctrl+U)"
        >
          <Underline className="h-4 w-4" />
        </button>
      </div>

      {/* Link Button */}
      <button 
        onClick={handleLink}
        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
        title="Insert Link"
      >
        <Link className="h-4 w-4" />
      </button>
    </>
  )
} 