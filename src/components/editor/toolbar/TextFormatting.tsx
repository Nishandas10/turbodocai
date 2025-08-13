"use client"

import { Bold, Italic, Underline, Link } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND } from 'lexical'
import { TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $getSelection, $isRangeSelection, $createTextNode } from 'lexical'
import { $createLinkNode } from '@lexical/link'

export default function TextFormatting() {
  const [editor] = useLexicalComposerContext()

  const handleFormatting = (format: 'bold' | 'italic' | 'underline') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
  }

  const handleLink = () => {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const selectedText = selection.getTextContent()
        
        // Check if we already have selected text
        if (selectedText.trim().length > 0) {
          // If text is selected, prompt for URL and apply link
          const url = prompt('Enter URL:')
          if (url) {
            // Ensure URL has protocol
            const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, fullUrl)
          }
        } else {
          // If no text selected, prompt for both text and URL
          const linkText = prompt('Enter link text:')
          if (linkText) {
            const url = prompt('Enter URL:')
            if (url) {
              // Ensure URL has protocol
              const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
              
              // Create link node with text
              const linkNode = $createLinkNode(fullUrl)
              const textNode = $createTextNode(linkText)
          linkNode.append(textNode)
              
              // Insert the link node
          selection.insertNodes([linkNode])
            }
          }
        }
        }
      })
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