import {
  createStructuralDirectiveTransform,
  traverseNode
} from '../transform.js'
import {
  createCallExpression,
  createConditionalExpression,
  createSimpleExpression,
  createObjectProperty,
  createObjectExpression,
  createVNodeCall,
  locStub
} from '../ast.js'
import { validateBrowserExpression } from '../validateExpression.js'
import { FRAGMENT, CREATE_COMMENT } from '../runtimeHelpers.js'
import {
  injectProp,
  findDir,
  findProp,
  isBuiltInType,
  makeBlock
} from '../utils.js'
import { PatchFlagNames } from '../../shared/index.js'
import { getMemoedVNodeCall } from '../index.js'

export const transformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  (node, dir, context) => {
    return processIf(node, dir, context, (ifNode, branch, isRoot) => {
      const siblings = context.parent.children
      let i = siblings.indexOf(ifNode)
      let key = 0
      while (i-- >= 0) {
        const sibling = siblings[i]
        if (sibling && sibling.type === 9) {
          key += sibling.branches.length
        }
      }
      return () => {
        if (isRoot) {
          ifNode.codegenNode = createCodegenNodeForBranch(branch, key, context)
        } else {
          const parentCondition = getParentCondition(ifNode.codegenNode)
          parentCondition.alternate = createCodegenNodeForBranch(
            branch,
            key + ifNode.branches.length - 1,
            context
          )
        }
      }
    })
  }
)

export function processIf (node, dir, context, processCodegen) {
  if (dir.name !== 'else' && (!dir.exp || !dir.exp.content.trim())) {
    const loc = dir.exp ? dir.exp.loc : node.loc
    dir.exp = createSimpleExpression(`true`, false, loc)
  }
  if (dir.exp) {
    validateBrowserExpression(dir.exp, context)
  }
  if (dir.name === 'if') {
    const branch = createIfBranch(node, dir)
    const ifNode = { type: 9, loc: node.loc, branches: [branch] }
    context.replaceNode(ifNode)
    if (processCodegen) {
      return processCodegen(ifNode, branch, true)
    }
  } else {
    const siblings = context.parent.children
    const comments = []
    let i = siblings.indexOf(node)
    while (i-- >= -1) {
      const sibling = siblings[i]
      if (sibling && sibling.type === 3) {
        context.removeNode(sibling)
        comments.unshift(sibling)
        continue
      }
      if (sibling && sibling.type === 2 && !sibling.content.trim().length) {
        context.removeNode(sibling)
        continue
      }
      if (sibling && sibling.type === 9) {
        if (
          dir.name === 'else-if' &&
          sibling.branches[sibling.branches.length - 1].condition === undefined
        ) {
        }
        context.removeNode()
        const branch = createIfBranch(node, dir)
        if (
          comments.length &&
          !(
            context.parent &&
            context.parent.type === 1 &&
            isBuiltInType(context.parent.tag, 'transition')
          )
        ) {
          branch.children = [...comments, ...branch.children]
        }
        {
          const key = branch.userKey
          if (key) {
            sibling.branches.forEach(({ userKey }) => {
              if (isSameKey(userKey, key)) {
              }
            })
          }
        }
        sibling.branches.push(branch)
        const onExit = processCodegen && processCodegen(sibling, branch, false)
        traverseNode(branch, context)
        if (onExit) onExit()
        context.currentNode = null
      } else {
      }
      break
    }
  }
}
function createIfBranch (node, dir) {
  return {
    type: 10,
    loc: node.loc,
    condition: dir.name === 'else' ? undefined : dir.exp,
    children:
      node.tagType === 3 && !findDir(node, 'for') ? node.children : [node],
    userKey: findProp(node, `key`)
  }
}
function createCodegenNodeForBranch (branch, keyIndex, context) {
  if (branch.condition) {
    return createConditionalExpression(
      branch.condition,
      createChildrenCodegenNode(branch, keyIndex, context),
      createCallExpression(context.helper(CREATE_COMMENT), ['"v-if"', 'true'])
    )
  } else {
    return createChildrenCodegenNode(branch, keyIndex, context)
  }
}
function createChildrenCodegenNode (branch, keyIndex, context) {
  const { helper } = context
  const keyProperty = createObjectProperty(
    `key`,
    createSimpleExpression(`${keyIndex}`, false, locStub, 2)
  )
  const { children } = branch
  const firstChild = children[0]
  const needFragmentWrapper = children.length !== 1 || firstChild.type !== 1
  if (needFragmentWrapper) {
    if (children.length === 1 && firstChild.type === 11) {
      const vnodeCall = firstChild.codegenNode
      injectProp(vnodeCall, keyProperty, context)
      return vnodeCall
    } else {
      let patchFlag = 64
      let patchFlagText = PatchFlagNames[64]
      if (children.filter(c => c.type !== 3).length === 1) {
        patchFlag |= 2048
        patchFlagText += `, ${PatchFlagNames[2048]}`
      }
      return createVNodeCall(
        context,
        helper(FRAGMENT),
        createObjectExpression([keyProperty]),
        children,
        patchFlag + ` /* ${patchFlagText} */`,
        undefined,
        undefined,
        true,
        false,
        false,
        branch.loc
      )
    }
  } else {
    const ret = firstChild.codegenNode
    const vnodeCall = getMemoedVNodeCall(ret)
    if (vnodeCall.type === 13) {
      makeBlock(vnodeCall, context)
    }
    injectProp(vnodeCall, keyProperty, context)
    return ret
  }
}
function isSameKey (a, b) {
  if (!a || a.type !== b.type) {
    return false
  }
  if (a.type === 6) {
    if (a.value.content !== b.value.content) {
      return false
    }
  } else {
    const exp = a.exp
    const branchExp = b.exp
    if (exp.type !== branchExp.type) {
      return false
    }
    if (
      exp.type !== 4 ||
      exp.isStatic !== branchExp.isStatic ||
      exp.content !== branchExp.content
    ) {
      return false
    }
  }
  return true
}
function getParentCondition (node) {
  while (true) {
    if (node.type === 19) {
      if (node.alternate.type === 19) {
        node = node.alternate
      } else {
        return node
      }
    } else if (node.type === 20) {
      node = node.value
    }
  }
}
