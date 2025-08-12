import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { INSERT_TABLE_COMMAND, TableCellNode } from '@lexical/table'
import { useEffect } from 'react'
import { $createParagraphNode, $insertNodes } from 'lexical'
import { $createTableNodeWithDimensions } from '@lexical/table'

export default function CustomTablePlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      INSERT_TABLE_COMMAND,
      (payload) => {
        const { rows, columns } = payload
        
        // Convert string values to numbers
        const numRows = Number(rows)
        const numColumns = Number(columns)

        editor.update(() => {
          const tableNode = $createTableNodeWithDimensions(numRows, numColumns)
          
          // Insert table at current selection or at the end
          $insertNodes([tableNode])
          
          // Insert a paragraph after the table for better editing flow
          const paragraphNode = $createParagraphNode()
          tableNode.insertAfter(paragraphNode)
          
          // Select the first cell of the table
          const firstCell = tableNode.getFirstDescendant()
          if (firstCell instanceof TableCellNode) {
            firstCell.selectStart()
          }
        })

        return true
      },
      COMMAND_PRIORITY_EDITOR
    )
  }, [editor])

  return null
}

// Command priority constant
const COMMAND_PRIORITY_EDITOR = 0 