import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { TRANSFORMERS } from '@lexical/markdown'
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ImageNode } from './toolbar/ImageNode'
import { HorizontalRuleNode } from './toolbar/HorizontalRuleNode'
import { CodeBlockNode } from './toolbar/CodeBlockNode'
import { HORIZONTAL_RULE } from './toolbar/HorizontalRuleTransformer'
import CustomTablePlugin from './plugins/TablePlugin'
import TableContextMenu from './plugins/TableContextMenu'
import { useTableContextMenu } from './hooks/useTableContextMenu'
import { useEffect } from 'react'

// Theme styling
const theme = {
  paragraph: 'mb-2',
  heading: {
    h1: 'text-3xl font-bold mb-4',
    h2: 'text-2xl font-bold mb-3',
    h3: 'text-xl font-bold mb-2',
    h4: 'text-lg font-bold mb-2',
    h5: 'text-base font-bold mb-2',
  },
  list: {
    ol: 'list-decimal ml-6 mb-2',
    ul: 'list-disc ml-6 mb-2',
    listitem: 'mb-1',
  },
  quote: 'border-l-4 border-gray-300 pl-4 italic mb-4',
  horizontalRule: 'my-6 border-t border-gray-300',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: 'underline line-through',
  },
  table: 'min-w-full border-collapse my-4',
  tableRow: '',
  tableCell: 'border border-border p-2 min-w-[3rem] min-h-[2rem]',
  tableCellHeader: '',
  code: 'bg-gray-100 rounded px-2 py-1 font-mono',
  codeHighlight: {
    atrule: 'text-blue-600',
    attr: 'text-purple-600',
    boolean: 'text-red-600',
    builtin: 'text-yellow-600',
    cdata: 'text-gray-600',
    char: 'text-green-600',
    class: 'text-blue-600',
    'class-name': 'text-blue-600',
    comment: 'text-gray-500 italic',
    constant: 'text-purple-600',
    deleted: 'text-red-600',
    doctype: 'text-gray-600',
    entity: 'text-yellow-600',
    function: 'text-green-600',
    important: 'text-purple-600',
    inserted: 'text-green-600',
    keyword: 'text-purple-600',
    namespace: 'text-yellow-600',
    number: 'text-red-600',
    operator: 'text-purple-600',
    prolog: 'text-gray-600',
    property: 'text-blue-600',
    punctuation: 'text-gray-600',
    regex: 'text-red-600',
    selector: 'text-purple-600',
    string: 'text-green-600',
    symbol: 'text-yellow-600',
    tag: 'text-blue-600',
    url: 'text-blue-600',
    variable: 'text-purple-600',
  },
}

// Editor nodes
const nodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  CodeBlockNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  LinkNode,
  AutoLinkNode,
  ImageNode,
  HorizontalRuleNode,
]

// Error Boundary Component
function LexicalErrorBoundary({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

interface EditorConfigProps {
  children: React.ReactNode
  fontSize?: number
  fontFamily?: string
}

function EditorContent({ children, fontSize = 16, fontFamily = 'inherit' }: EditorConfigProps) {
  const { 
    isMenuOpen, 
    menuPosition, 
    selectedTableKey, 
    selectedCellKey, 
    handleTableClick, 
    closeMenu 
  } = useTableContextMenu()

  // Add click event listener for table cells
  useEffect(() => {
    const handleClick = (event: Event) => {
      if (event instanceof MouseEvent) {
        handleTableClick(event)
      }
    }
    
    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [handleTableClick])

  return (
    <div className="relative min-h-[500px] prose prose-sm max-w-none">
      {/* Render children (toolbar) at the top */}
      {children}

      <RichTextPlugin
        contentEditable={
          <ContentEditable
            className="min-h-[500px] outline-none p-6"
            style={{
              fontSize: `${fontSize}px`,
              fontFamily
            }}
          />
        }
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <AutoFocusPlugin />
      <LinkPlugin />
      <ListPlugin />
      <TabIndentationPlugin />
      <CustomTablePlugin />
      <MarkdownShortcutPlugin transformers={[...TRANSFORMERS, HORIZONTAL_RULE]} />

      {/* Table Context Menu */}
      {isMenuOpen && (
        <TableContextMenu
          isOpen={isMenuOpen}
          onClose={closeMenu}
          position={menuPosition}
          tableNodeKey={selectedTableKey}
          cellNodeKey={selectedCellKey}
        />
      )}
    </div>
  )
}

export default function EditorConfig({ children, fontSize = 16, fontFamily = 'inherit' }: EditorConfigProps) {
  const initialConfig = {
    namespace: 'NotebookEditor',
    theme,
    nodes,
    onError: (error: Error) => {
      console.error('Editor error:', error)
    },
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <EditorContent fontSize={fontSize} fontFamily={fontFamily}>
        {children}
      </EditorContent>
    </LexicalComposer>
  )
} 