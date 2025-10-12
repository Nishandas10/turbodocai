/* eslint-disable @next/next/no-img-element */
import { DecoratorNode, NodeKey, LexicalNode, SerializedLexicalNode, Spread, $getNodeByKey } from 'lexical'
import { ReactNode, useState, useRef, useCallback, useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { RotateCcw, RotateCw, Move, Maximize2, Minimize2 } from 'lucide-react'

export interface ImagePayload {
  altText: string
  src: string
  maxWidth?: number
  key?: NodeKey
}

export type SerializedImageNode = Spread<
  {
    altText: string
    src: string
    maxWidth?: number
  },
  SerializedLexicalNode
>

interface ResizableImageProps {
  src: string
  altText: string
  maxWidth?: number
  nodeKey: NodeKey
}

function ResizableImage({ src, altText, maxWidth = 500, nodeKey }: ResizableImageProps) {
  const [editor] = useLexicalComposerContext()
  const [isSelected, setIsSelected] = useState(false)
  const [currentWidth, setCurrentWidth] = useState(maxWidth)
  const [isResizing, setIsResizing] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const [rotation, setRotation] = useState(0)
  
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLElement | null>(null)

  // Find the editor container for boundary constraints
  useEffect(() => {
    if (containerRef.current) {
      const editorElement = containerRef.current.closest('.prose') || 
                           containerRef.current.closest('[contenteditable="true"]') ||
                           containerRef.current.closest('.min-h-[500px]')
      editorRef.current = editorElement as HTMLElement
    }
  }, [])

  // Initialize crop area when image loads
  useEffect(() => {
    if (imageRef.current) {
      const img = imageRef.current
      img.onload = () => {
        // Image loaded successfully
      }
    }
  }, [])

  const updateNodeInEditor = useCallback((updates: Partial<{ maxWidth: number; rotation: number; position: { x: number; y: number } }>) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if (node && $isImageNode(node)) {
        if (updates.maxWidth !== undefined) {
          node.setMaxWidth(updates.maxWidth)
        }
        // Add rotation and position methods to ImageNode if needed
      }
    })
  }, [editor, nodeKey])

  // Handle dragging
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!isSelected || isResizing) return
    
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startY = e.clientY
    const startPos = { ...position }

    const handleMouseMove = (e: MouseEvent) => {
      if (!editorRef.current || !containerRef.current) return

      const deltaX = e.clientX - startX
      const deltaY = e.clientY - startY

      // Calculate new position
      let newX = startPos.x + deltaX
      let newY = startPos.y + deltaY

      // Get editor and container dimensions
      const editorRect = editorRef.current.getBoundingClientRect()
      const containerRect = containerRef.current.getBoundingClientRect()

      // Calculate boundaries
      const minX = -containerRect.width / 4 // Allow some movement to the left
      const maxX = editorRect.width - (containerRect.width * 3/4) // Allow some movement to the right
      const minY = 0
      const maxY = editorRect.height - containerRect.height

      // Apply constraints
      newX = Math.max(minX, Math.min(maxX, newX))
      newY = Math.max(minY, Math.min(maxY, newY))

      setPosition({ x: newX, y: newY })
      updateNodeInEditor({ position: { x: newX, y: newY } })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [isSelected, isResizing, position, updateNodeInEditor])

  // Handle resize with aspect ratio lock
  const handleResize = useCallback((direction: string, startX: number, startY: number, startWidth: number) => {
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX
      const deltaY = e.clientY - startY
      
      let newWidth = startWidth

      // Calculate new dimensions based on direction
      if (direction.includes('right')) {
        newWidth = startWidth + deltaX
      }
      if (direction.includes('left')) {
        newWidth = startWidth - deltaX
      }
      if (direction.includes('bottom')) {
        // For bottom resize, calculate width based on height change
        if (aspectRatio) {
          const currentHeight = startWidth / aspectRatio
          const newHeightFromDelta = currentHeight + deltaY
          newWidth = newHeightFromDelta * aspectRatio
        } else {
          newWidth = startWidth + deltaY // Use deltaY for vertical resize
        }
      }
      if (direction.includes('top')) {
        // For top resize, calculate width based on height change
        if (aspectRatio) {
          const currentHeight = startWidth / aspectRatio
          const newHeightFromDelta = currentHeight - deltaY
          newWidth = newHeightFromDelta * aspectRatio
        } else {
          newWidth = startWidth - deltaY // Use deltaY for vertical resize
        }
      }

      // For corner handles, use both deltaX and deltaY
      if (direction.includes('top') && direction.includes('left')) {
        newWidth = startWidth - Math.max(deltaX, deltaY)
      }
      if (direction.includes('top') && direction.includes('right')) {
        newWidth = startWidth + Math.max(deltaX, -deltaY)
      }
      if (direction.includes('bottom') && direction.includes('left')) {
        newWidth = startWidth - Math.max(deltaX, -deltaY)
      }
      if (direction.includes('bottom') && direction.includes('right')) {
        newWidth = startWidth + Math.max(deltaX, deltaY)
      }

      // Constrain dimensions
      newWidth = Math.max(100, Math.min(800, newWidth))

      setCurrentWidth(newWidth)
      updateNodeInEditor({ maxWidth: newWidth })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [aspectRatio, updateNodeInEditor])

  const handleMouseDown = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = currentWidth

    handleResize(direction, startX, startY, startWidth)
  }, [currentWidth, handleResize])

  const handleQuickResize = useCallback((width: number) => {
    setCurrentWidth(width)
    updateNodeInEditor({ maxWidth: width })
  }, [updateNodeInEditor])

  const toggleAspectRatio = useCallback(() => {
    if (aspectRatio === null) {
      // Lock to current aspect ratio
      const img = imageRef.current
      if (img) {
        setAspectRatio(img.naturalWidth / img.naturalHeight)
      }
    } else {
      // Unlock aspect ratio
      setAspectRatio(null)
    }
  }, [aspectRatio])

  const rotateImage = useCallback((direction: 'left' | 'right') => {
    const newRotation = direction === 'left' ? rotation - 90 : rotation + 90
    setRotation(newRotation)
    updateNodeInEditor({ rotation: newRotation })
  }, [rotation, updateNodeInEditor])

  const resetImage = useCallback(() => {
    setRotation(0)
    setAspectRatio(null)
    setCurrentWidth(maxWidth)
    setPosition({ x: 0, y: 0 })
    updateNodeInEditor({ maxWidth, rotation: 0, position: { x: 0, y: 0 } })
  }, [maxWidth, updateNodeInEditor])

  return (
    <div
      ref={containerRef}
      className={`relative inline-block group ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      onClick={() => setIsSelected(true)}
      onBlur={() => setIsSelected(false)}
      tabIndex={0}
      style={{
        width: currentWidth,
        margin: '0 8px 0 0',
        display: 'inline-block',
        position: 'relative',
        left: position.x,
        top: position.y,
        cursor: isSelected && !isResizing ? 'move' : 'default',
        userSelect: 'none',
        transition: 'none',
        verticalAlign: 'top',
        maxWidth: '100%',
        height: 'auto',
      }}
      onMouseDown={handleDragStart}
    >
      {/* Main Image Container */}
      <div className="relative overflow-hidden" style={{ borderRadius: '8px', display: 'inline-block' }}>
        <img
          ref={imageRef}
          src={src}
          alt={altText}
          style={{
            width: '100%',
            height: 'auto',
            transform: `rotate(${rotation}deg)`,
            transition: isResizing ? 'none' : 'transform 0.2s ease',
            display: 'block',
            maxWidth: '100%',
          }}
          draggable={false}
        />
      </div>

      {/* Selection UI - Only show when selected */}
      {isSelected && (
        <>
          {/* Main Toolbar */}
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 flex items-center space-x-1 bg-blue-500 border border-blue-600 rounded-lg shadow-lg px-3 py-2 z-50">
            
            <button
              onClick={toggleAspectRatio}
              className={`p-1.5 rounded ${aspectRatio ? 'bg-white text-blue-600' : 'text-white hover:bg-blue-400'}`}
              title={aspectRatio ? 'Unlock Aspect Ratio' : 'Lock Aspect Ratio'}
            >
              {aspectRatio ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            
            <div className="w-px h-5 bg-blue-400 mx-1" /> {/* Divider */}
            
            <button
              onClick={() => rotateImage('left')}
              className="p-1.5 rounded text-white hover:bg-blue-400"
              title="Rotate Left"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => rotateImage('right')}
              className="p-1.5 rounded text-white hover:bg-blue-400"
              title="Rotate Right"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            
            <div className="w-px h-5 bg-blue-400 mx-1" /> {/* Divider */}
            
            <button
              onClick={resetImage}
              className="p-1.5 rounded text-white hover:bg-blue-400"
              title="Reset Image"
            >
              <Move className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Size Buttons */}
          <div className="absolute top-2 right-2 flex space-x-1">
            <button
              className="bg-white bg-opacity-90 hover:bg-opacity-100 p-1 rounded shadow text-xs font-medium"
              onClick={() => handleQuickResize(300)}
              title="Small (300px)"
            >
              S
            </button>
            <button
              className="bg-white bg-opacity-90 hover:bg-opacity-100 p-1 rounded shadow text-xs font-medium"
              onClick={() => handleQuickResize(500)}
              title="Medium (500px)"
            >
              M
            </button>
            <button
              className="bg-white bg-opacity-90 hover:bg-opacity-100 p-1 rounded shadow text-xs font-medium"
              onClick={() => handleQuickResize(700)}
              title="Large (700px)"
            >
              L
            </button>
          </div>

          {/* Resize Handles */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner handles */}
            <div
              className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-nw-resize pointer-events-auto"
              onMouseDown={(e) => handleMouseDown(e, 'top-left')}
            />
            <div
              className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-ne-resize pointer-events-auto"
              onMouseDown={(e) => handleMouseDown(e, 'top-right')}
            />
            <div
              className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-sw-resize pointer-events-auto"
              onMouseDown={(e) => handleMouseDown(e, 'bottom-left')}
            />
            <div
              className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize pointer-events-auto"
              onMouseDown={(e) => handleMouseDown(e, 'bottom-right')}
            />

            {/* Edge handles */}
            <div
              className="absolute top-1/2 -left-1 w-3 h-6 bg-blue-500 rounded cursor-ew-resize pointer-events-auto transform -translate-y-1/2"
              onMouseDown={(e) => handleMouseDown(e, 'left')}
            />
            <div
              className="absolute top-1/2 -right-1 w-3 h-6 bg-blue-500 rounded cursor-ew-resize pointer-events-auto transform -translate-y-1/2"
              onMouseDown={(e) => handleMouseDown(e, 'right')}
            />
            <div
              className="absolute -top-1 left-1/2 w-6 h-3 bg-blue-500 rounded cursor-ns-resize pointer-events-auto transform -translate-x-1/2"
              onMouseDown={(e) => handleMouseDown(e, 'top')}
            />
            <div
              className="absolute -bottom-1 left-1/2 w-6 h-3 bg-blue-500 rounded cursor-ns-resize pointer-events-auto transform -translate-x-1/2"
              onMouseDown={(e) => handleMouseDown(e, 'bottom')}
            />
          </div>

          {/* Image Info */}
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
            {Math.round(currentWidth)}px × {imageRef.current ? Math.round((imageRef.current.naturalHeight / imageRef.current.naturalWidth) * currentWidth) : 'auto'}px
            {aspectRatio && ` • ${aspectRatio.toFixed(2)}:1`}
            {rotation !== 0 && ` • ${rotation}°`}
          </div>
        </>
      )}
    </div>
  )
}

export class ImageNode extends DecoratorNode<ReactNode> {
  __src: string
  __altText: string
  __maxWidth?: number
  __position: { x: number; y: number }

  static getType(): string {
    return 'custom-image'
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__maxWidth,
      node.__position,
      node.__key
    )
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { altText, src, maxWidth } = serializedNode
    const node = $createImageNode({
      altText,
      src,
      maxWidth,
    })
    return node
  }

  constructor(
    src: string,
    altText: string,
    maxWidth?: number,
    position: { x: number; y: number } = { x: 0, y: 0 },
    key?: NodeKey
  ) {
    super(key)
    this.__src = src
    this.__altText = altText
    this.__maxWidth = maxWidth
    this.__position = position
  }

  createDOM(): HTMLElement {
    const span = document.createElement('span')
    span.style.display = 'inline-block'
    span.style.verticalAlign = 'top'
    span.style.margin = '0 8px 0 0'
    span.style.whiteSpace = 'nowrap'
    return span
  }

  updateDOM(): false {
    return false
  }

  isInline(): boolean {
    return true
  }

  getSrc(): string {
    return this.__src
  }

  getAltText(): string {
    return this.__altText
  }

  getPosition(): { x: number; y: number } {
    return this.__position
  }

  setAltText(altText: string): void {
    const writable = this.getWritable()
    writable.__altText = altText
  }

  setMaxWidth(maxWidth: number): void {
    const writable = this.getWritable()
    writable.__maxWidth = maxWidth
  }

  setPosition(position: { x: number; y: number }): void {
    const writable = this.getWritable()
    writable.__position = position
  }

  exportJSON(): SerializedImageNode {
    return {
      altText: this.getAltText(),
      src: this.getSrc(),
      maxWidth: this.__maxWidth,
      type: 'custom-image',
      version: 1,
    }
  }

  // Ensure HTML export includes <img> with attributes
  exportDOM(): { element: HTMLElement } {
    const img = document.createElement('img')
    img.src = this.__src
    img.alt = this.__altText || ''
    if (this.__maxWidth) img.style.maxWidth = `${this.__maxWidth}px`
    img.style.height = 'auto'
    return { element: img }
  }

  decorate(): ReactNode {
    return (
      <ResizableImage
        src={this.__src}
        altText={this.__altText}
        maxWidth={this.__maxWidth}
        nodeKey={this.__key}
      />
    )
  }
}

export function $createImageNode({
  altText,
  src,
  maxWidth,
  key,
}: ImagePayload): ImageNode {
  return new ImageNode(src, altText, maxWidth, { x: 0, y: 0 }, key)
}

export function $isImageNode(
  node: LexicalNode | null | undefined
): node is ImageNode {
  return node instanceof ImageNode
} 