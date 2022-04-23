import { findDir } from '../utils.js'
import { SET_BLOCK_TRACKING } from '../runtimeHelpers.js'

const seen = new WeakSet()

export const transformOnce = (node, context) => {
  if (node.type === 1 && findDir(node, 'once', true)) {
    if (seen.has(node) || context.inVOnce) {
      return
    }
    seen.add(node)
    context.inVOnce = true
    context.helper(SET_BLOCK_TRACKING)
    return () => {
      context.inVOnce = false
      const cur = context.currentNode
      if (cur.codegenNode) {
        cur.codegenNode = context.cache(cur.codegenNode, true)
      }
    }
  }
}
