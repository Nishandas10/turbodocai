# Modular Toolbar Components

This directory contains modular, reusable components that make up the Lexical editor toolbar. Each component is responsible for a specific functionality, making the codebase cleaner, more maintainable, and easier to test.

## Components Overview

### 🎯 **HeaderBar** (`HeaderBar.tsx`)
- **Purpose**: Top header with document title and action buttons
- **Features**: 
  - Document title input
  - Upgrade to Premium button
  - Share button
  - Menu button (⋮)

### 🔤 **FontControls** (`FontControls.tsx`)
- **Purpose**: Font family and size controls
- **Features**:
  - Font family dropdown (Clarika, Arial, Times New Roman, etc.)
  - Font size controls with +/- buttons
  - Click-outside-to-close functionality

### ✏️ **TextFormatting** (`TextFormatting.tsx`)
- **Purpose**: Basic text formatting tools
- **Features**:
  - Bold, Italic, Underline buttons
  - Link insertion
  - Uses Lexical's `FORMAT_TEXT_COMMAND`

### 🎨 **ColorPicker** (`ColorPicker.tsx`)
- **Purpose**: Text color selection
- **Features**:
  - Color swatch grid
  - Hex color input
  - Advanced text node manipulation for color application

### 🖍️ **Highlighter** (`Highlighter.tsx`)
- **Purpose**: Text highlighting with advanced color picker
- **Features**:
  - HSL color picker with draggable sliders
  - Preset color swatches
  - Hex color input
  - Advanced text node manipulation for highlighting

### 📝 **ParagraphStyle** (`ParagraphStyle.tsx`)
- **Purpose**: Paragraph and heading styles
- **Features**:
  - Normal, H1, H2, H3, Quote, Code styles
  - Dropdown interface
  - Uses Lexical's `FORMAT_ELEMENT_COMMAND`

### ➕ **InsertTools** (`InsertTools.tsx`)
- **Purpose**: Insert various content types
- **Features**:
  - Tables
  - Ordered/Unordered lists
  - Quotes
  - Code blocks
  - Uses Lexical's insert commands

### ↔️ **AlignmentTools** (`AlignmentTools.tsx`)
- **Purpose**: Text alignment controls
- **Features**:
  - Left, Center, Right, Justify alignment
  - Uses Lexical's `FORMAT_ELEMENT_COMMAND`

### 🔠 **CaseTools** (`CaseTools.tsx`)
- **Purpose**: Text case transformation
- **Features**:
  - UPPERCASE, lowercase, Capitalize Each Word, Sentence case
  - Direct text manipulation in Lexical

## Benefits of Modular Architecture

### 🧹 **Clean Code**
- Each component has a single responsibility
- Easier to read and understand
- Reduced cognitive load

### 🔧 **Maintainability**
- Bug fixes isolated to specific components
- Easier to add new features
- Simpler testing and debugging

### ♻️ **Reusability**
- Components can be reused in other parts of the app
- Consistent UI patterns across the application
- Easy to swap out components

### 🧪 **Testing**
- Each component can be tested independently
- Smaller, focused test suites
- Better test coverage

### 👥 **Team Development**
- Multiple developers can work on different components
- Reduced merge conflicts
- Clear ownership and responsibilities

## Usage

```tsx
import { 
  HeaderBar,
  FontControls,
  TextFormatting,
  ColorPicker,
  Highlighter,
  ParagraphStyle,
  InsertTools,
  AlignmentTools,
  CaseTools
} from './toolbar'

// Use in main toolbar
<HeaderBar title={title} onTitleChange={setTitle} />
<FontControls fontSize={fontSize} onFontSizeChange={setFontSize} />
<TextFormatting />
<ColorPicker />
<Highlighter />
// ... etc
```

## File Structure

```
toolbar/
├── index.ts              # Exports all components
├── HeaderBar.tsx         # Document header
├── FontControls.tsx      # Font controls
├── TextFormatting.tsx    # Basic formatting
├── ColorPicker.tsx       # Text color picker
├── Highlighter.tsx       # Text highlighter
├── ParagraphStyle.tsx    # Paragraph styles
├── InsertTools.tsx       # Insert tools
├── AlignmentTools.tsx    # Text alignment
├── CaseTools.tsx         # Text case tools
└── README.md             # This documentation
```

## State Management

Each component manages its own local state (dropdown visibility, color values, etc.) and communicates with the parent through props and Lexical's context. This keeps components self-contained and reduces prop drilling.

## Future Enhancements

- Add keyboard shortcuts for each tool
- Implement tool state persistence
- Add tooltips and accessibility features
- Create theme-aware color schemes
- Add undo/redo for formatting operations 