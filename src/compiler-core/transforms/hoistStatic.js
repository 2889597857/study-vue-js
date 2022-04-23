import { createArrayExpression } from '../ast.js'
import { isString, isSymbol, isArray } from '../../shared/index.js'
import { getVNodeBlockHelper, getVNodeHelper, isSlotOutlet } from '../utils.js'
import {
  OPEN_BLOCK,
  GUARD_REACTIVE_PROPS,
  NORMALIZE_CLASS,
  NORMALIZE_PROPS,
  NORMALIZE_STYLE
} from '../runtimeHelpers.js'

export function hoistStatic (root, context) {
  walk(root, context, isSingleElementRoot(root, root.children[0]))
}
export function isSingleElementRoot (root, child) {
  const { children } = root
  return children.length === 1 && child.type === 1 && !isSlotOutlet(child)
}
function walk (node, context, doNotHoistNode = false) {
  const { children } = node
  const originalCount = children.length
  let hoistedCount = 0
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.type === 1 && child.tagType === 0) {
      const constantType = doNotHoistNode ? 0 : getConstantType(child, context)
      if (constantType > 0) {
        if (constantType >= 2) {
          child.codegenNode.patchFlag = -1 + ` /* HOISTED */`
          child.codegenNode = context.hoist(child.codegenNode)
          hoistedCount++
          continue
        }
      } else {
        const codegenNode = child.codegenNode
        if (codegenNode.type === 13) {
          const flag = getPatchFlag(codegenNode)
          if (
            (!flag || flag === 512 || flag === 1) &&
            getGeneratedPropsConstantType(child, context) >= 2
          ) {
            const props = getNodeProps(child)
            if (props) {
              codegenNode.props = context.hoist(props)
            }
          }
          if (codegenNode.dynamicProps) {
            codegenNode.dynamicProps = context.hoist(codegenNode.dynamicProps)
          }
        }
      }
    } else if (
      child.type === 12 &&
      getConstantType(child.content, context) >= 2
    ) {
      child.codegenNode = context.hoist(child.codegenNode)
      hoistedCount++
    }
    if (child.type === 1) {
      const isComponent = child.tagType === 1
      if (isComponent) {
        context.scopes.vSlot++
      }
      walk(child, context)
      if (isComponent) {
        context.scopes.vSlot--
      }
    } else if (child.type === 11) {
      walk(child, context, child.children.length === 1)
    } else if (child.type === 9) {
      for (let i = 0; i < child.branches.length; i++) {
        walk(
          child.branches[i],
          context,
          child.branches[i].children.length === 1
        )
      }
    }
  }
  if (hoistedCount && context.transformHoist) {
    context.transformHoist(children, context, node)
  }
  if (
    hoistedCount &&
    hoistedCount === originalCount &&
    node.type === 1 &&
    node.tagType === 0 &&
    node.codegenNode &&
    node.codegenNode.type === 13 &&
    isArray(node.codegenNode.children)
  ) {
    node.codegenNode.children = context.hoist(
      createArrayExpression(node.codegenNode.children)
    )
  }
}
export function getConstantType (node, context) {
  const { constantCache } = context
  switch (node.type) {
    case 1:
      if (node.tagType !== 0) {
        return 0
      }
      const cached = constantCache.get(node)
      if (cached !== undefined) {
        return cached
      }
      const codegenNode = node.codegenNode
      if (codegenNode.type !== 13) {
        return 0
      }
      if (
        codegenNode.isBlock &&
        node.tag !== 'svg' &&
        node.tag !== 'foreignObject'
      ) {
        return 0
      }
      const flag = getPatchFlag(codegenNode)
      if (!flag) {
        let returnType = 3
        const generatedPropsType = getGeneratedPropsConstantType(node, context)
        if (generatedPropsType === 0) {
          constantCache.set(node, 0)
          return 0
        }
        if (generatedPropsType < returnType) {
          returnType = generatedPropsType
        }
        for (let i = 0; i < node.children.length; i++) {
          const childType = getConstantType(node.children[i], context)
          if (childType === 0) {
            constantCache.set(node, 0)
            return 0
          }
          if (childType < returnType) {
            returnType = childType
          }
        }
        if (returnType > 1) {
          for (let i = 0; i < node.props.length; i++) {
            const p = node.props[i]
            if (p.type === 7 && p.name === 'bind' && p.exp) {
              const expType = getConstantType(p.exp, context)
              if (expType === 0) {
                constantCache.set(node, 0)
                return 0
              }
              if (expType < returnType) {
                returnType = expType
              }
            }
          }
        }
        if (codegenNode.isBlock) {
          context.removeHelper(OPEN_BLOCK)
          context.removeHelper(
            getVNodeBlockHelper(context.inSSR, codegenNode.isComponent)
          )
          codegenNode.isBlock = false
          context.helper(getVNodeHelper(context.inSSR, codegenNode.isComponent))
        }
        constantCache.set(node, returnType)
        return returnType
      } else {
        constantCache.set(node, 0)
        return 0
      }
    case 2:
    case 3:
      return 3
    case 9:
    case 11:
    case 10:
      return 0
    case 5:
    case 12:
      return getConstantType(node.content, context)
    case 4:
      return node.constType
    case 8:
      let returnType = 3
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        if (isString(child) || isSymbol(child)) {
          continue
        }
        const childType = getConstantType(child, context)
        if (childType === 0) {
          return 0
        } else if (childType < returnType) {
          returnType = childType
        }
      }
      return returnType
    default:
      return 0
  }
}
const allowHoistedHelperSet = new Set([
  NORMALIZE_CLASS,
  NORMALIZE_STYLE,
  NORMALIZE_PROPS,
  GUARD_REACTIVE_PROPS
])
function getConstantTypeOfHelperCall (value, context) {
  if (
    value.type === 14 &&
    !isString(value.callee) &&
    allowHoistedHelperSet.has(value.callee)
  ) {
    const arg = value.arguments[0]
    if (arg.type === 4) {
      return getConstantType(arg, context)
    } else if (arg.type === 14) {
      return getConstantTypeOfHelperCall(arg, context)
    }
  }
  return 0
}
function getGeneratedPropsConstantType (node, context) {
  let returnType = 3
  const props = getNodeProps(node)
  if (props && props.type === 15) {
    const { properties } = props
    for (let i = 0; i < properties.length; i++) {
      const { key, value } = properties[i]
      const keyType = getConstantType(key, context)
      if (keyType === 0) {
        return keyType
      }
      if (keyType < returnType) {
        returnType = keyType
      }
      let valueType
      if (value.type === 4) {
        valueType = getConstantType(value, context)
      } else if (value.type === 14) {
        valueType = getConstantTypeOfHelperCall(value, context)
      } else {
        valueType = 0
      }
      if (valueType === 0) {
        return valueType
      }
      if (valueType < returnType) {
        returnType = valueType
      }
    }
  }
  return returnType
}
function getNodeProps (node) {
  const codegenNode = node.codegenNode
  if (codegenNode.type === 13) {
    return codegenNode.props
  }
}
function getPatchFlag (node) {
  const flag = node.patchFlag
  return flag ? parseInt(flag, 10) : undefined
}
