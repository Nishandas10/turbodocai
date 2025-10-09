"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6 } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createHeadingNode, $isHeadingNode } from '@lexical/rich-text'
import { $getSelection, $isRangeSelection, $createParagraphNode } from 'lexical'
import { HeadingTagType } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { mergeRegister } from '@lexical/utils'
import { SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_CRITICAL } from 'lexical'
import { createPortal } from 'react-dom'

type FormatType = 'normal' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

export default function ParagraphStyle() {
  const [editor] = useLexicalComposerContext()
  const [showParagraphDropdown, setShowParagraphDropdown] = useState(false)
  const [currentFormat, setCurrentFormat] = useState<FormatType>('normal')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const paragraphDropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Function to get format label and icon
  const getFormatDisplay = (format: FormatType) => {
    const displays = {
      normal: { label: 'Normal', icon: null },
      h1: { label: 'H1', icon: <Heading1 className="h-4 w-4" /> },
      h2: { label: 'H2', icon: <Heading2 className="h-4 w-4" /> },
      h3: { label: 'H3', icon: <Heading3 className="h-4 w-4" /> },
      h4: { label: 'H4', icon: <Heading4 className="h-4 w-4" /> },
      h5: { label: 'H5', icon: <Heading5 className="h-4 w-4" /> },
      h6: { label: 'H6', icon: <Heading6 className="h-4 w-4" /> }
    }
    return displays[format]
  }

  // Function to detect current format from selection (based on block type only)
  const updateCurrentFormat = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode()
        const element = anchorNode.getKey() === 'root'
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow()

        if ($isHeadingNode(element)) {
          const tag = element.getTag()
          setCurrentFormat(tag as FormatType)
        } else {
          setCurrentFormat('normal')
        }
      }
    })
  }, [editor])

  // Listen for selection changes to update current format
  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateCurrentFormat()
          return false
        },
        COMMAND_PRIORITY_CRITICAL
      ),
      // Also listen for any editor updates (e.g., block type changes without selection move)
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateCurrentFormat()
        })
      })
    )
  }, [editor, updateCurrentFormat])

  // Update format on mount
  useEffect(() => {
    updateCurrentFormat()
  }, [updateCurrentFormat])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      // Check if click is outside both the button and any dropdown content
      if (buttonRef.current && !buttonRef.current.contains(target)) {
        // Check if click is on dropdown content (which is now in portal)
        const dropdownElement = document.querySelector('[data-paragraph-dropdown]')
        if (dropdownElement && !dropdownElement.contains(target)) {
          // Use setTimeout to allow other click handlers to execute first
          setTimeout(() => {
            setShowParagraphDropdown(false)
          }, 0)
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleParagraphStyle = (style: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        if (style === 'normal') {
          $setBlocksType(selection, () => $createParagraphNode())
        } else if (style.startsWith('h')) {
          const level = parseInt(style.substring(1))
          if (level >= 1 && level <= 6) {
            const headingTag = `h${level}` as HeadingTagType
            $setBlocksType(selection, () => $createHeadingNode(headingTag))
          }
        }
      }
    })
    setShowParagraphDropdown(false)
  }

  const handleButtonClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      })
    }
    setShowParagraphDropdown(!showParagraphDropdown)
  }

  const currentDisplay = getFormatDisplay(currentFormat)

  return (
    <div className="relative" ref={paragraphDropdownRef}>
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        className="flex items-center space-x-2 px-3 py-2 text-foreground hover:bg-muted rounded border border-border"
      >
        {currentDisplay.icon || (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
        <span className="text-sm">{currentDisplay.label}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {showParagraphDropdown && createPortal(
        <div 
          className="fixed bg-background border border-border rounded-lg shadow-lg z-[9999] min-w-[160px]"
          style={{
            top: dropdownPosition.top + 4,
            left: dropdownPosition.left
          }}
          data-paragraph-dropdown
        >
          <button onClick={() => handleParagraphStyle('normal')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Normal</span>
          </button>
          <button onClick={() => handleParagraphStyle('h1')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Heading1 className="h-4 w-4" />
            <span>Heading 1</span>
          </button>
          <button onClick={() => handleParagraphStyle('h2')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Heading2 className="h-4 w-4" />
            <span>Heading 2</span>
          </button>
          <button onClick={() => handleParagraphStyle('h3')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Heading3 className="h-4 w-4" />
            <span>Heading 3</span>
          </button>
          <button onClick={() => handleParagraphStyle('h4')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Heading4 className="h-4 w-4" />
            <span>Heading 4</span>
          </button>
          <button onClick={() => handleParagraphStyle('h5')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Heading5 className="h-4 w-4" />
            <span>Heading 5</span>
          </button>
          <button onClick={() => handleParagraphStyle('h6')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Heading6 className="h-4 w-4" />
            <span>Heading 6</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  )
} 