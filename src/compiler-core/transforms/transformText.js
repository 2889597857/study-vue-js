import { createCallExpression } from '../ast.js'
import { isText } from '../utils.js'
import { CREATE_TEXT } from '../runtimeHelpers.js'
import { PatchFlagNames } from '../../shared/index.js'
import { getConstantType } from './hoistStatic.js'

export const transformText = (node, context) => {
  if (
    node.type === 0 ||
    node.type === 1 ||
    node.type === 11 ||
    node.type === 10
  ) {
    return () => {
      const children = node.children
      let currentContainer = undefined
      let hasText = false
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          hasText = true
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]
            if (isText(next)) {
              if (!currentContainer) {
                currentContainer = children[i] = {
                  type: 8,
                  loc: child.loc,
                  children: [child]
                }
              }
              currentContainer.children.push(` + `, next)
              children.splice(j, 1)
              j--
            } else {
              currentContainer = undefined
              break
            }
          }
        }
      }
      if (
        !hasText ||
        (children.length === 1 &&
          (node.type === 0 ||
            (node.type === 1 &&
              node.tagType === 0 &&
              !node.props.find(
                p => p.type === 7 && !context.directiveTransforms[p.name]
              ) &&
              !false)))
      ) {
        return
      }
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child) || child.type === 8) {
          const callArgs = []
          if (child.type !== 2 || child.content !== ' ') {
            callArgs.push(child)
          }
          if (!context.ssr && getConstantType(child, context) === 0) {
            callArgs.push(1 + ` /* ${PatchFlagNames[1]} */`)
          }
          children[i] = {
            type: 12,
            content: child,
            loc: child.loc,
            codegenNode: createCallExpression(
              context.helper(CREATE_TEXT),
              callArgs
            )
          }
        }
      }
    }
  }
}
