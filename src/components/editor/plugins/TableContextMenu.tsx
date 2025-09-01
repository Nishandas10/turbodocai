import { useRef, useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { 
  $getNodeByKey,
  $createParagraphNode,
  $getRoot
} from 'lexical'
import { 
  $isTableNode, 
  $isTableCellNode,
  $getTableColumnIndexFromTableCellNode,
  $getTableRowIndexFromTableCellNode,
  $createTableRowNode,
  $createTableCellNode,
  TableRowNode
} from '@lexical/table'
import { Plus, Trash2 } from 'lucide-react'

interface TableContextMenuProps {
  isOpen: boolean
  onClose: () => void
  position: { x: number; y: number }
  tableNodeKey: string
  cellNodeKey: string
}

export default function TableContextMenu({ 
  isOpen, 
  onClose, 
  position, 
  tableNodeKey, 
  cellNodeKey 
}: TableContextMenuProps) {
  const [editor] = useLexicalComposerContext()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        // Use setTimeout to allow other click handlers to execute first
        setTimeout(() => {
          onClose()
        }, 0)
      }
    }

    if (isOpen) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen, onClose])

  const handleInsertRowAbove = () => {
    editor.update(() => {
      const tableNode = $getNodeByKey(tableNodeKey)
      const cellNode = $getNodeByKey(cellNodeKey)
      
      if ($isTableNode(tableNode) && $isTableCellNode(cellNode)) {
        const rowIndex = $getTableRowIndexFromTableCellNode(cellNode)
        const children = tableNode.getChildren()
        const firstRow = children[0] as TableRowNode
        const columnCount = firstRow.getChildrenSize()
        
        // Create a new row with the same number of columns
        const newRow = $createTableRowNode()
        for (let i = 0; i < columnCount; i++) {
          const newCell = $createTableCellNode(0) // Use 0 for normal cell type
          // Add a paragraph node as initial content for the cell
          const paragraphNode = $createParagraphNode()
          newCell.append(paragraphNode)
          newRow.append(newCell)
        }
        
        // Insert the new row at the specified index
        if (rowIndex === 0) {
          tableNode.insertBefore(newRow)
        } else {
          const targetRow = children[rowIndex]
          targetRow.insertBefore(newRow)
        }
      }
    })
    onClose()
  }

  const handleInsertRowBelow = () => {
    editor.update(() => {
      const tableNode = $getNodeByKey(tableNodeKey)
      const cellNode = $getNodeByKey(cellNodeKey)
      
      if ($isTableNode(tableNode) && $isTableCellNode(cellNode)) {
        const rowIndex = $getTableRowIndexFromTableCellNode(cellNode)
        const children = tableNode.getChildren()
        const firstRow = children[0] as TableRowNode
        const columnCount = firstRow.getChildrenSize()
        
        // Create a new row with the same number of columns
        const newRow = $createTableRowNode()
        for (let i = 0; i < columnCount; i++) {
          const newCell = $createTableCellNode(0) // Use 0 for normal cell type
          // Add a paragraph node as initial content for the cell
          const paragraphNode = $createParagraphNode()
          newCell.append(paragraphNode)
          newRow.append(newCell)
        }
        
        // Insert the new row after the current row
        const currentRow = children[rowIndex]
        currentRow.insertAfter(newRow)
      }
    })
    onClose()
  }

  const handleInsertColumnLeft = () => {
    editor.update(() => {
      const tableNode = $getNodeByKey(tableNodeKey)
      const cellNode = $getNodeByKey(cellNodeKey)
      
      if ($isTableNode(tableNode) && $isTableCellNode(cellNode)) {
        const columnIndex = $getTableColumnIndexFromTableCellNode(cellNode)
        const children = tableNode.getChildren()
        
        // Insert a new cell in each row at the specified column index
        children.forEach((row) => {
          if (row instanceof TableRowNode) {
            const newCell = $createTableCellNode(0) // Use 0 for normal cell type
            // Add a paragraph node as initial content for the cell
            const paragraphNode = $createParagraphNode()
            newCell.append(paragraphNode)
            const rowChildren = row.getChildren()
            if (columnIndex === 0) {
              row.insertBefore(newCell)
            } else {
              const targetCell = rowChildren[columnIndex]
              targetCell.insertBefore(newCell)
            }
          }
        })
      }
    })
    onClose()
  }

  const handleInsertColumnRight = () => {
    editor.update(() => {
      const tableNode = $getNodeByKey(tableNodeKey)
      const cellNode = $getNodeByKey(cellNodeKey)
      
      if ($isTableNode(tableNode) && $isTableCellNode(cellNode)) {
        const columnIndex = $getTableColumnIndexFromTableCellNode(cellNode)
        const children = tableNode.getChildren()
        
        // Insert a new cell in each row after the specified column index
        children.forEach((row) => {
          if (row instanceof TableRowNode) {
            const newCell = $createTableCellNode(0) // Use 0 for normal cell type
            // Add a paragraph node as initial content for the cell
            const paragraphNode = $createParagraphNode()
            newCell.append(paragraphNode)
            const rowChildren = row.getChildren()
            const currentCell = rowChildren[columnIndex]
            currentCell.insertAfter(newCell)
          }
        })
      }
    })
    onClose()
  }

  const handleDeleteRow = () => {
    editor.update(() => {
      const tableNode = $getNodeByKey(tableNodeKey)
      const cellNode = $getNodeByKey(cellNodeKey)
      
      if ($isTableNode(tableNode) && $isTableCellNode(cellNode)) {
        const rowIndex = $getTableRowIndexFromTableCellNode(cellNode)
        const children = tableNode.getChildren()
        
        if (children.length > 1) {
          // Remove the row at the specified index
          const rowToRemove = children[rowIndex]
          rowToRemove.remove()
        }
      }
    })
    onClose()
  }

  const handleDeleteColumn = () => {
    editor.update(() => {
      const tableNode = $getNodeByKey(tableNodeKey)
      const cellNode = $getNodeByKey(cellNodeKey)
      
      if ($isTableNode(tableNode) && $isTableCellNode(cellNode)) {
        const columnIndex = $getTableColumnIndexFromTableCellNode(cellNode)
        const children = tableNode.getChildren()
        
        // Remove the cell at the specified column index from each row
        children.forEach((row) => {
          if (row instanceof TableRowNode) {
            const rowChildren = row.getChildren()
            if (rowChildren.length > 1) {
              const cellToRemove = rowChildren[columnIndex]
              cellToRemove.remove()
            }
          }
        })
      }
    })
    onClose()
  }

  const handleDeleteTable = () => {
    editor.update(() => {
      const tableNode = $getNodeByKey(tableNodeKey)
      if ($isTableNode(tableNode)) {
        const root = $getRoot()
        tableNode.remove()
        
        // Insert a paragraph after the deleted table
        const paragraphNode = $createParagraphNode()
        root.append(paragraphNode)
        paragraphNode.select(0, 0)
      }
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-background border border-border rounded-lg shadow-lg min-w-[200px]"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Insert Row Options */}
      <div className="p-2">
        <div className="text-xs font-medium text-muted-foreground mb-2 px-2">Insert Row</div>
        <button
          onClick={handleInsertRowAbove}
          className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-foreground hover:bg-muted rounded"
        >
          <Plus className="h-4 w-4" />
          <span>Insert row above</span>
        </button>
        <button
          onClick={handleInsertRowBelow}
          className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-foreground hover:bg-muted rounded"
        >
          <Plus className="h-4 w-4" />
          <span>Insert row below</span>
        </button>
      </div>

      <div className="w-full h-px bg-border"></div>

      {/* Insert Column Options */}
      <div className="p-2">
        <div className="text-xs font-medium text-muted-foreground mb-2 px-2">Insert Column</div>
        <button
          onClick={handleInsertColumnLeft}
          className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-foreground hover:bg-muted rounded"
        >
          <Plus className="h-4 w-4" />
          <span>Insert column left</span>
        </button>
        <button
          onClick={handleInsertColumnRight}
          className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-foreground hover:bg-muted rounded"
        >
          <Plus className="h-4 w-4" />
          <span>Insert column right</span>
        </button>
      </div>

      <div className="w-full h-px bg-border"></div>

      {/* Delete Options */}
      <div className="p-2">
        <div className="text-xs font-medium text-muted-foreground mb-2 px-2">Delete</div>
        <button
          onClick={handleDeleteRow}
          className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-foreground hover:bg-muted rounded"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete row</span>
        </button>
        <button
          onClick={handleDeleteColumn}
          className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-foreground hover:bg-muted rounded"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete column</span>
        </button>
        <button
          onClick={handleDeleteTable}
          className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-foreground hover:bg-muted rounded"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete table</span>
        </button>
      </div>
    </div>
  )
} 