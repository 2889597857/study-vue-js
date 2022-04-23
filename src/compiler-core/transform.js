import {
  createSimpleExpression,
  createCacheExpression,
  createVNodeCall
} from './ast.js'
import {
  isString,
  isArray,
  NOOP,
  PatchFlagNames,
  EMPTY_OBJ,
  capitalize,
  camelize
} from '../shared/index.js'
import {
  TO_DISPLAY_STRING,
  FRAGMENT,
  helperNameMap,
  CREATE_COMMENT
} from './runtimeHelpers.js'
import { isVSlot, makeBlock } from './utils.js'
import { hoistStatic, isSingleElementRoot } from './transforms/hoistStatic.js'

export function createTransformContext (
  root,
  {
    filename = '',
    prefixIdentifiers = false,
    hoistStatic = false,
    cacheHandlers = false,
    nodeTransforms = [],
    directiveTransforms = {},
    transformHoist = null,
    isBuiltInComponent = NOOP,
    isCustomElement = NOOP,
    expressionPlugins = [],
    scopeId = null,
    slotted = true,
    ssr = false,
    inSSR = false,
    ssrCssVars = ``,
    bindingMetadata = EMPTY_OBJ,
    inline = false,
    isTS = false,
    compatConfig
  }
) {
  const nameMatch = filename.replace(/\?.*$/, '').match(/([^/\\]+)\.\w+$/)
  const context = {
    selfName: nameMatch && capitalize(camelize(nameMatch[1])),
    prefixIdentifiers,
    hoistStatic,
    cacheHandlers,
    nodeTransforms,
    directiveTransforms,
    transformHoist,
    isBuiltInComponent,
    isCustomElement,
    expressionPlugins,
    scopeId,
    slotted,
    ssr,
    inSSR,
    ssrCssVars,
    bindingMetadata,
    inline,
    isTS,
    compatConfig,
    root,
    helpers: new Map(),
    components: new Set(),
    directives: new Set(),
    hoists: [],
    imports: [],
    constantCache: new Map(),
    temps: 0,
    cached: 0,
    identifiers: Object.create(null),
    scopes: { vFor: 0, vSlot: 0, vPre: 0, vOnce: 0 },
    parent: null,
    currentNode: root,
    childIndex: 0,
    inVOnce: false,
    helper (name) {
      const count = context.helpers.get(name) || 0
      context.helpers.set(name, count + 1)
      return name
    },
    removeHelper (name) {
      const count = context.helpers.get(name)
      if (count) {
        const currentCount = count - 1
        if (!currentCount) {
          context.helpers.delete(name)
        } else {
          context.helpers.set(name, currentCount)
        }
      }
    },
    helperString (name) {
      return `_${helperNameMap[context.helper(name)]}`
    },
    replaceNode (node) {
      {
        if (!context.currentNode) {
          throw new Error(`Node being replaced is already removed.`)
        }
        if (!context.parent) {
          throw new Error(`Cannot replace root node.`)
        }
      }
      context.parent.children[context.childIndex] = context.currentNode = node
    },
    removeNode (node) {
      if (!context.parent) {
        throw new Error(`Cannot remove root node.`)
      }
      const list = context.parent.children
      const removalIndex = node
        ? list.indexOf(node)
        : context.currentNode
        ? context.childIndex
        : -1
      if (removalIndex < 0) {
        throw new Error(`node being removed is not a child of current parent`)
      }
      if (!node || node === context.currentNode) {
        context.currentNode = null
        context.onNodeRemoved()
      } else {
        if (context.childIndex > removalIndex) {
          context.childIndex--
          context.onNodeRemoved()
        }
      }
      context.parent.children.splice(removalIndex, 1)
    },
    onNodeRemoved: () => {},
    addIdentifiers (exp) {},
    removeIdentifiers (exp) {},
    hoist (exp) {
      if (isString(exp)) exp = createSimpleExpression(exp)
      context.hoists.push(exp)
      const identifier = createSimpleExpression(
        `_hoisted_${context.hoists.length}`,
        false,
        exp.loc,
        2
      )
      identifier.hoisted = exp
      return identifier
    },
    cache (exp, isVNode = false) {
      return createCacheExpression(context.cached++, exp, isVNode)
    }
  }
  return context
}
export function transform (root, options) {
  const context = createTransformContext(root, options)
  traverseNode(root, context)
  if (options.hoistStatic) {
    hoistStatic(root, context)
  }
  if (!options.ssr) {
    createRootCodegen(root, context)
  }
  root.helpers = [...context.helpers.keys()]
  root.components = [...context.components]
  root.directives = [...context.directives]
  root.imports = context.imports
  root.hoists = context.hoists
  root.temps = context.temps
  root.cached = context.cached
}
export function createRootCodegen (root, context) {
  const { helper } = context
  const { children } = root
  if (children.length === 1) {
    const child = children[0]
    if (isSingleElementRoot(root, child) && child.codegenNode) {
      const codegenNode = child.codegenNode
      if (codegenNode.type === 13) {
        makeBlock(codegenNode, context)
      }
      root.codegenNode = codegenNode
    } else {
      root.codegenNode = child
    }
  } else if (children.length > 1) {
    let patchFlag = 64
    let patchFlagText = PatchFlagNames[64]
    if (children.filter(c => c.type !== 3).length === 1) {
      patchFlag |= 2048
      patchFlagText += `, ${PatchFlagNames[2048]}`
    }
    root.codegenNode = createVNodeCall(
      context,
      helper(FRAGMENT),
      undefined,
      root.children,
      patchFlag + ` /* ${patchFlagText} */`,
      undefined,
      undefined,
      true,
      undefined,
      false
    )
  } else;
}
export function traverseChildren (parent, context) {
  let i = 0
  const nodeRemoved = () => {
    i--
  }
  for (; i < parent.children.length; i++) {
    const child = parent.children[i]
    if (isString(child)) continue
    context.parent = parent
    context.childIndex = i
    context.onNodeRemoved = nodeRemoved
    traverseNode(child, context)
  }
}
export function traverseNode (node, context) {
  context.currentNode = node
  const { nodeTransforms } = context
  const exitFns = []
  for (let i = 0; i < nodeTransforms.length; i++) {
    const onExit = nodeTransforms[i](node, context)
    if (onExit) {
      if (isArray(onExit)) {
        exitFns.push(...onExit)
      } else {
        exitFns.push(onExit)
      }
    }
    if (!context.currentNode) {
      return
    } else {
      node = context.currentNode
    }
  }
  switch (node.type) {
    case 3:
      if (!context.ssr) {
        context.helper(CREATE_COMMENT)
      }
      break
    case 5:
      if (!context.ssr) {
        context.helper(TO_DISPLAY_STRING)
      }
      break
    case 9:
      for (let i = 0; i < node.branches.length; i++) {
        traverseNode(node.branches[i], context)
      }
      break
    case 10:
    case 11:
    case 1:
    case 0:
      traverseChildren(node, context)
      break
  }
  context.currentNode = node
  let i = exitFns.length
  while (i--) {
    exitFns[i]()
  }
}
export function createStructuralDirectiveTransform (name, fn) {
  const matches = isString(name) ? n => n === name : n => name.test(n)
  return (node, context) => {
    if (node.type === 1) {
      const { props } = node
      if (node.tagType === 3 && props.some(isVSlot)) {
        return
      }
      const exitFns = []
      for (let i = 0; i < props.length; i++) {
        const prop = props[i]
        if (prop.type === 7 && matches(prop.name)) {
          props.splice(i, 1)
          i--
          const onExit = fn(node, prop, context)
          if (onExit) exitFns.push(onExit)
        }
      }
      return exitFns
    }
  }
}
