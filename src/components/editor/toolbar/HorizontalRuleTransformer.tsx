import { ElementTransformer } from '@lexical/markdown'
import { ElementNode, LexicalNode } from 'lexical'
import { $createHorizontalRuleNode } from './HorizontalRuleNode'

export const HORIZONTAL_RULE: ElementTransformer = {
  export: () => {
    return '---'
  },
  regExp: /^---$/,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  replace: (parentNode: ElementNode, _children: LexicalNode[], _match: string[], _isImport: boolean) => {
    const horizontalRuleNode = $createHorizontalRuleNode()
    parentNode.append(horizontalRuleNode)
    return true
  },
  type: 'element',
  dependencies: [],
} 