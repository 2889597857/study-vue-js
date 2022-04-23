import { findDir, makeBlock } from '../utils.js'
import { createCallExpression, createFunctionExpression } from '../ast.js'
import { WITH_MEMO } from '../runtimeHelpers.js'

const seen = new WeakSet()

export const transformMemo = (node, context) => {
  if (node.type === 1) {
    const dir = findDir(node, 'memo')
    if (!dir || seen.has(node)) {
      return
    }
    seen.add(node)
    return () => {
      const codegenNode = node.codegenNode || context.currentNode.codegenNode
      if (codegenNode && codegenNode.type === 13) {
        if (node.tagType !== 1) {
          makeBlock(codegenNode, context)
        }
        node.codegenNode = createCallExpression(context.helper(WITH_MEMO), [
          dir.exp,
          createFunctionExpression(undefined, codegenNode),
          `_cache`,
          String(context.cached++)
        ])
      }
    }
  }
}
