import { useState } from 'react'

interface TablePickerProps {
  onSelect: (rows: number, cols: number) => void
  maxSize?: number
}

export default function TablePicker({ onSelect, maxSize = 20 }: TablePickerProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  const [dimensions, setDimensions] = useState<string>('0 × 0')

  // Create a grid of cells (maxSize x maxSize) - exactly 20x20
  const grid = Array.from({ length: maxSize }, (_, rowIndex) => (
    Array.from({ length: maxSize }, (_, colIndex) => ({
      row: rowIndex + 1,
      col: colIndex + 1
    }))
  ))

  // Handle mouse hover on a cell
  const handleCellHover = (row: number, col: number) => {
    setHoveredCell({ row, col })
    setDimensions(`${row} × ${col}`)
  }

  // Handle mouse leave from the grid
  const handleMouseLeave = () => {
    setHoveredCell(null)
    setDimensions('0 × 0')
  }

  // Handle cell click
  const handleCellClick = (row: number, col: number) => {
    onSelect(row, col)
  }

  return (
    <div className="absolute right-full top-0 mr-1 bg-background border border-border rounded-lg shadow-lg z-50 p-4">
      <div className="text-sm font-medium text-foreground mb-2 px-1">
        Table size: {dimensions} (Max: {maxSize}×{maxSize})
      </div>
      <div className="text-xs text-muted-foreground mb-2 px-1">
        Grid: {grid.length} rows × {grid[0]?.length || 0} columns
      </div>
      <div 
        className="grid gap-[1px] bg-border p-1 rounded-md"
        style={{ 
          gridTemplateColumns: `repeat(${maxSize}, 18px)`,
          width: `${maxSize * 18 + 2}px`,
          height: `${maxSize * 18 + 2}px`
        }}
        onMouseLeave={handleMouseLeave}
      >
        {grid.map((row, rowIndex) => (
          row.map((cell, colIndex) => {
            const isHighlighted = hoveredCell && 
              rowIndex <= hoveredCell.row - 1 && 
              colIndex <= hoveredCell.col - 1

            return (
              <div
                key={`${cell.row}-${cell.col}`}
                className={`
                  w-[18px] h-[18px] cursor-pointer
                  transition-all duration-75
                  ${isHighlighted 
                    ? 'bg-blue-400 shadow-sm' 
                    : 'bg-background hover:bg-blue-200/50'}
                  ${rowIndex === 0 ? 'rounded-t-[2px]' : ''}
                  ${rowIndex === maxSize - 1 ? 'rounded-b-[2px]' : ''}
                  ${colIndex === 0 ? 'rounded-l-[2px]' : ''}
                  ${colIndex === maxSize - 1 ? 'rounded-r-[2px]' : ''}
                `}
                onMouseEnter={() => handleCellHover(cell.row, cell.col)}
                onClick={() => handleCellClick(cell.row, cell.col)}
                title={`${cell.row} × ${cell.col}`}
              />
            )
          }))
        )}
      </div>
      <div className="text-xs text-muted-foreground mt-2 px-1">
        Click to insert table
      </div>
    </div>
  )
} 