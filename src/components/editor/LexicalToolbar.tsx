/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { 
  FontControls,
  TextFormatting,
  ColorPicker,
  TextHighlighter,
  ParagraphStyle,
  InsertTools,
  AlignmentTools,
  CaseTools
} from './toolbar'

export default function LexicalToolbar({
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange
}: any) {
  return (
    <>
      {/* Main Toolbar (secondary header removed) */}
      <div 
        className="h-14 border-b border-border flex items-center px-6 overflow-x-auto relative"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent'
        }}
      >
        <div className="flex items-center space-x-4 min-w-max">
        {/* Paragraph Style Dropdown */}
        <ParagraphStyle />

        {/* Font Controls */}
        <FontControls
          fontSize={fontSize}
          onFontSizeChange={onFontSizeChange}
          fontFamily={fontFamily}
          onFontFamilyChange={onFontFamilyChange}
        />

        {/* Vertical Separator */}
          <div className="w-px h-6 bg-border flex-shrink-0"></div>

        {/* Text Formatting */}
        <TextFormatting />

        {/* Text Color Dropdown */}
        <ColorPicker />

        {/* Highlighter */}
        <TextHighlighter />

        {/* Case Change Dropdown */}
        <CaseTools />

        {/* Vertical Separator */}
          <div className="w-px h-6 bg-border flex-shrink-0"></div>

        {/* Insert Dropdown */}
        <InsertTools />

        {/* Vertical Separator */}
          <div className="w-px h-6 bg-border flex-shrink-0"></div>

        {/* Alignment Dropdown */}
        <AlignmentTools />

          {/* Progress bar placeholder - only show when there's enough space */}
          <div className="hidden xl:flex flex-1 mx-4">
          <div className="w-full bg-muted rounded-full h-1">
            <div className="bg-blue-600 h-1 rounded-full" style={{ width: '0%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}