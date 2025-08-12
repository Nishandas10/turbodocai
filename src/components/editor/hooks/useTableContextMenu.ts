import { useState, useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection } from "lexical";
import { $getTableCellNodeFromLexicalNode } from "@lexical/table";

export function useTableContextMenu() {
  const [editor] = useLexicalComposerContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedTableKey, setSelectedTableKey] = useState<string>("");
  const [selectedCellKey, setSelectedCellKey] = useState<string>("");

  const handleTableClick = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if the clicked element is a table cell
      if (target.tagName === "TD" || target.tagName === "TH") {
        event.preventDefault();
        event.stopPropagation();

        // Get the position for the context menu
        const rect = target.getBoundingClientRect();
        setMenuPosition({
          x: rect.left,
          y: rect.bottom + 5,
        });

        // Get the table and cell node keys
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const anchorNode = selection.anchor.getNode();
            const cellNode = $getTableCellNodeFromLexicalNode(anchorNode);

            if (cellNode) {
              // Find the parent table node
              let tableNode = cellNode.getParent();
              while (tableNode && tableNode.getType() !== "table") {
                tableNode = tableNode.getParent();
              }

              if (tableNode) {
                setSelectedTableKey(tableNode.getKey());
                setSelectedCellKey(cellNode.getKey());
                setIsMenuOpen(true);
              }
            }
          }
        });
      }
    },
    [editor]
  );

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    setSelectedTableKey("");
    setSelectedCellKey("");
  }, []);

  return {
    isMenuOpen,
    menuPosition,
    selectedTableKey,
    selectedCellKey,
    handleTableClick,
    closeMenu,
  };
}
