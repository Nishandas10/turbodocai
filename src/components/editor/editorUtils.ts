import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  LexicalEditor,
  TextFormatType,
  ElementNode,
} from "lexical";
import { $createParagraphNode, $createTextNode } from "lexical";
import { $createLinkNode } from "@lexical/link";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";

export const handleFormatting = (
  editor: LexicalEditor,
  format: TextFormatType
) => {
  editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
};

export const handleTextColor = (editor: LexicalEditor, color: string) => {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      selection.getNodes().forEach((node) => {
        if (node instanceof ElementNode) {
          node.setStyle("color: " + color);
        }
      });
    }
  });
};

export const handleHighlight = (editor: LexicalEditor, color: string) => {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      selection.getNodes().forEach((node) => {
        if (node instanceof ElementNode) {
          node.setStyle("background-color: " + color);
        }
      });
    }
  });
};

export const handleLink = (editor: LexicalEditor, url: string) => {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const linkNode = $createLinkNode(url);
      selection.insertNodes([linkNode]);
    }
  });
};

export const handleImage = (editor: LexicalEditor, file: File) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    editor.update(() => {
      const imageNode = $createTextNode(
        "![" + file.name + "](" + e.target?.result + ")"
      );
      const paragraphNode = $createParagraphNode();
      paragraphNode.append(imageNode);
      $getSelection()?.insertNodes([paragraphNode]);
    });
  };
  reader.readAsDataURL(file);
};

export const handleTable = (
  editor: LexicalEditor,
  rows: number,
  cols: number
) => {
  editor.dispatchCommand(INSERT_TABLE_COMMAND, {
    rows: rows.toString(),
    columns: cols.toString(),
  });
};

export const handleAlignment = (
  editor: LexicalEditor,
  align: "left" | "center" | "right" | "justify"
) => {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      selection.getNodes().forEach((node) => {
        if (node instanceof ElementNode) {
          node.setStyle("text-align: " + align);
        }
      });
    }
  });
};

export const handleLineSpacing = (editor: LexicalEditor, spacing: string) => {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      selection.getNodes().forEach((node) => {
        if (node instanceof ElementNode) {
          node.setStyle("line-height: " + spacing);
        }
      });
    }
  });
};

export const handleList = (
  editor: LexicalEditor,
  type: "ordered" | "unordered"
) => {
  editor.dispatchCommand(
    type === "ordered"
      ? INSERT_ORDERED_LIST_COMMAND
      : INSERT_UNORDERED_LIST_COMMAND,
    undefined
  );
};

export const handleUndo = (editor: LexicalEditor) => {
  editor.dispatchCommand(UNDO_COMMAND, undefined);
};

export const handleRedo = (editor: LexicalEditor) => {
  editor.dispatchCommand(REDO_COMMAND, undefined);
};

export const handleAddComment = () => {
  alert("💬 Comment feature: This would add a comment to the selected text");
};

export const handleAskTurbo = () => {
  alert("🚀 Ask Turbo: This would open the AI assistant for the selected text");
};
