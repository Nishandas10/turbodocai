# Editor Components

This directory contains modular, reusable components for the notebook editor functionality.

## Components

### `EditorToolbar.tsx`
- **Purpose**: Main toolbar with all editing controls
- **Features**: Font controls, text formatting, insert options, alignment, line spacing
- **Props**: All toolbar state and handlers passed as props
- **Reusable**: Can be used in any document editor

### `AIAssistant.tsx`
- **Purpose**: Right sidebar AI assistant interface
- **Features**: Chat interface, AI suggestions, input controls
- **Props**: None (self-contained)
- **Reusable**: Can be used in any AI-powered editor

### `FloatingToolbar.tsx`
- **Purpose**: Context-aware floating toolbar for text selection
- **Features**: Bold, italic, underline, link, comment, AI assistance
- **Props**: Position, visibility, and action handlers
- **Reusable**: Can be used in any rich text editor

### `DocumentOutline.tsx`
- **Purpose**: Document structure and table of contents panel
- **Features**: Header navigation, document structure display
- **Props**: Visibility and close handler
- **Reusable**: Can be used in any document editor

### `editorUtils.ts`
- **Purpose**: Utility functions for editor operations
- **Features**: Text formatting, image handling, table creation, alignment, etc.
- **Exports**: Pure functions that can be imported anywhere
- **Reusable**: Can be used in any editor component

### `index.ts`
- **Purpose**: Clean exports for all editor components
- **Usage**: `import { EditorToolbar, AIAssistant } from './editor'`
- **Benefits**: Single import point, cleaner code

## Benefits of Modular Structure

✅ **Maintainability**: Each component has a single responsibility
✅ **Reusability**: Components can be used in other editors
✅ **Testability**: Each component can be tested independently
✅ **Readability**: Main component is much cleaner and easier to understand
✅ **Scalability**: Easy to add new features or modify existing ones
✅ **Team Development**: Different developers can work on different components

## Usage Example

```tsx
import {
  EditorToolbar,
  AIAssistant,
  FloatingToolbar,
  DocumentOutline
} from './editor'

// Use components with proper props
<EditorToolbar
  title={title}
  onTitleChange={setTitle}
  fontSize={fontSize}
  onFontSizeChange={setFontSize}
  // ... other props
/>
```

## File Structure

```
src/components/editor/
├── EditorToolbar.tsx      # Main toolbar component
├── AIAssistant.tsx        # AI sidebar component
├── FloatingToolbar.tsx    # Selection toolbar component
├── DocumentOutline.tsx    # Document structure component
├── editorUtils.ts         # Utility functions
├── index.ts              # Clean exports
└── README.md             # This documentation
``` 