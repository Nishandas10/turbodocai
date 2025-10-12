import { ElementNode, NodeKey, SerializedElementNode } from 'lexical'

export type SerializedHorizontalRuleNode = SerializedElementNode

export class HorizontalRuleNode extends ElementNode {
  static getType(): string {
    return 'horizontal-rule'
  }

  static clone(node: HorizontalRuleNode): HorizontalRuleNode {
    return new HorizontalRuleNode(node.__key)
  }

  constructor(key?: NodeKey) {
    super(key)
  }

  createDOM(): HTMLElement {
    const hr = document.createElement('hr')
    hr.className = 'my-4 border-t border-gray-300'
    return hr
  }

  updateDOM(): boolean {
    return false
  }

  static importJSON(serializedNode: SerializedHorizontalRuleNode): HorizontalRuleNode {
    const node = $createHorizontalRuleNode()
    node.setFormat(serializedNode.format)
    node.setIndent(serializedNode.indent)
    node.setDirection(serializedNode.direction)
    return node
  }

  exportJSON(): SerializedHorizontalRuleNode {
    return {
      ...super.exportJSON(),
      type: 'horizontal-rule',
      version: 1,
    }
  }

  // Ensure HTML export includes an <hr/>
  exportDOM(): { element: HTMLElement } {
    const hr = document.createElement('hr')
    return { element: hr }
  }

  insertNewAfter(): null {
    return null
  }

  collapseAtStart(): true {
    return true
  }

  isInline(): false {
    return false
  }
}

export function $createHorizontalRuleNode(): HorizontalRuleNode {
  return new HorizontalRuleNode()
}

export function $isHorizontalRuleNode(
  node: unknown,
): node is HorizontalRuleNode {
  return node instanceof HorizontalRuleNode
} 