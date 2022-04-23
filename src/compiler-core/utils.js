import { createCallExpression, createObjectExpression } from './ast.js'
import {
  MERGE_PROPS,
  TELEPORT,
  SUSPENSE,
  KEEP_ALIVE,
  BASE_TRANSITION,
  TO_HANDLERS,
  NORMALIZE_PROPS,
  GUARD_REACTIVE_PROPS,
  CREATE_BLOCK,
  CREATE_ELEMENT_BLOCK,
  CREATE_VNODE,
  CREATE_ELEMENT_VNODE,
  WITH_MEMO,
  OPEN_BLOCK
} from './runtimeHelpers.js'
import { isString, hyphenate, extend } from '../shared/index.js'

export const isStaticExp = p => p.type === 4 && p.isStatic
export const isBuiltInType = (tag, expected) =>
  tag === expected || tag === hyphenate(expected)
export function isCoreComponent (tag) {
  if (isBuiltInType(tag, 'Teleport')) {
    return TELEPORT
  } else if (isBuiltInType(tag, 'Suspense')) {
    return SUSPENSE
  } else if (isBuiltInType(tag, 'KeepAlive')) {
    return KEEP_ALIVE
  } else if (isBuiltInType(tag, 'BaseTransition')) {
    return BASE_TRANSITION
  }
}
const nonIdentifierRE = /^\d|[^\$\w]/
export const isSimpleIdentifier = name => !nonIdentifierRE.test(name)
const validFirstIdentCharRE = /[A-Za-z_$\xA0-\uFFFF]/
const validIdentCharRE = /[\.\?\w$\xA0-\uFFFF]/
const whitespaceRE = /\s+[.[]\s*|\s*[.[]\s+/g
export const isMemberExpressionBrowser = path => {
  path = path.trim().replace(whitespaceRE, s => s.trim())
  let state = 0
  let stateStack = []
  let currentOpenBracketCount = 0
  let currentOpenParensCount = 0
  let currentStringType = null
  for (let i = 0; i < path.length; i++) {
    const char = path.charAt(i)
    switch (state) {
      case 0:
        if (char === '[') {
          stateStack.push(state)
          state = 1
          currentOpenBracketCount++
        } else if (char === '(') {
          stateStack.push(state)
          state = 2
          currentOpenParensCount++
        } else if (
          !(i === 0 ? validFirstIdentCharRE : validIdentCharRE).test(char)
        ) {
          return false
        }
        break
      case 1:
        if (char === `'` || char === `"` || char === '`') {
          stateStack.push(state)
          state = 3
          currentStringType = char
        } else if (char === `[`) {
          currentOpenBracketCount++
        } else if (char === `]`) {
          if (!--currentOpenBracketCount) {
            state = stateStack.pop()
          }
        }
        break
      case 2:
        if (char === `'` || char === `"` || char === '`') {
          stateStack.push(state)
          state = 3
          currentStringType = char
        } else if (char === `(`) {
          currentOpenParensCount++
        } else if (char === `)`) {
          if (i === path.length - 1) {
            return false
          }
          if (!--currentOpenParensCount) {
            state = stateStack.pop()
          }
        }
        break
      case 3:
        if (char === currentStringType) {
          state = stateStack.pop()
          currentStringType = null
        }
        break
    }
  }
  return !currentOpenBracketCount && !currentOpenParensCount
}
export const isMemberExpression = isMemberExpressionBrowser
export function getInnerRange (loc, offset, length) {
  const source = loc.source.slice(offset, offset + length)
  const newLoc = {
    source,
    start: advancePositionWithClone(loc.start, loc.source, offset),
    end: loc.end
  }
  if (length != null) {
    newLoc.end = advancePositionWithClone(
      loc.start,
      loc.source,
      offset + length
    )
  }
  return newLoc
}
export function advancePositionWithClone (
  pos,
  source,
  numberOfCharacters = source.length
) {
  return advancePositionWithMutation(
    extend({}, pos),
    source,
    numberOfCharacters
  )
}
export function advancePositionWithMutation (
  pos,
  source,
  numberOfCharacters = source.length
) {
  let linesCount = 0
  let lastNewLinePos = -1
  for (let i = 0; i < numberOfCharacters; i++) {
    if (source.charCodeAt(i) === 10) {
      linesCount++
      lastNewLinePos = i
    }
  }
  pos.offset += numberOfCharacters
  pos.line += linesCount
  pos.column =
    lastNewLinePos === -1
      ? pos.column + numberOfCharacters
      : numberOfCharacters - lastNewLinePos
  return pos
}
export function assert (condition, msg) {
  if (!condition) {
    throw new Error(msg || `unexpected compiler condition`)
  }
}
export function findDir (node, name, allowEmpty = false) {
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (
      p.type === 7 &&
      (allowEmpty || p.exp) &&
      (isString(name) ? p.name === name : name.test(p.name))
    ) {
      return p
    }
  }
}
export function findProp (node, name, dynamicOnly = false, allowEmpty = false) {
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (p.type === 6) {
      if (dynamicOnly) continue
      if (p.name === name && (p.value || allowEmpty)) {
        return p
      }
    } else if (
      p.name === 'bind' &&
      (p.exp || allowEmpty) &&
      isStaticArgOf(p.arg, name)
    ) {
      return p
    }
  }
}
export function isStaticArgOf (arg, name) {
  return !!(arg && isStaticExp(arg) && arg.content === name)
}
export function hasDynamicKeyVBind (node) {
  return node.props.some(
    p =>
      p.type === 7 &&
      p.name === 'bind' &&
      (!p.arg || p.arg.type !== 4 || !p.arg.isStatic)
  )
}
export function isText (node) {
  return node.type === 5 || node.type === 2
}
export function isVSlot (p) {
  return p.type === 7 && p.name === 'slot'
}
export function isTemplateNode (node) {
  return node.type === 1 && node.tagType === 3
}
export function isSlotOutlet (node) {
  return node.type === 1 && node.tagType === 2
}
export function getVNodeHelper (ssr, isComponent) {
  return ssr || isComponent ? CREATE_VNODE : CREATE_ELEMENT_VNODE
}
export function getVNodeBlockHelper (ssr, isComponent) {
  return ssr || isComponent ? CREATE_BLOCK : CREATE_ELEMENT_BLOCK
}
const propsHelperSet = new Set([NORMALIZE_PROPS, GUARD_REACTIVE_PROPS])
export function getUnnormalizedProps (props, callPath = []) {
  if (props && !isString(props) && props.type === 14) {
    const callee = props.callee
    if (!isString(callee) && propsHelperSet.has(callee)) {
      return getUnnormalizedProps(props.arguments[0], callPath.concat(props))
    }
  }
  return [props, callPath]
}
export function injectProp (node, prop, context) {
  let propsWithInjection
  let props = node.type === 13 ? node.props : node.arguments[2]
  let callPath = []
  let parentCall
  if (props && !isString(props) && props.type === 14) {
    const ret = getUnnormalizedProps(props)
    props = ret[0]
    callPath = ret[1]
    parentCall = callPath[callPath.length - 1]
  }
  if (props == null || isString(props)) {
    propsWithInjection = createObjectExpression([prop])
  } else if (props.type === 14) {
    const first = props.arguments[0]
    if (!isString(first) && first.type === 15) {
      first.properties.unshift(prop)
    } else {
      if (props.callee === TO_HANDLERS) {
        propsWithInjection = createCallExpression(context.helper(MERGE_PROPS), [
          createObjectExpression([prop]),
          props
        ])
      } else {
        props.arguments.unshift(createObjectExpression([prop]))
      }
    }
    !propsWithInjection && (propsWithInjection = props)
  } else if (props.type === 15) {
    let alreadyExists = false
    if (prop.key.type === 4) {
      const propKeyName = prop.key.content
      alreadyExists = props.properties.some(
        p => p.key.type === 4 && p.key.content === propKeyName
      )
    }
    if (!alreadyExists) {
      props.properties.unshift(prop)
    }
    propsWithInjection = props
  } else {
    propsWithInjection = createCallExpression(context.helper(MERGE_PROPS), [
      createObjectExpression([prop]),
      props
    ])
    if (parentCall && parentCall.callee === GUARD_REACTIVE_PROPS) {
      parentCall = callPath[callPath.length - 2]
    }
  }
  if (node.type === 13) {
    if (parentCall) {
      parentCall.arguments[0] = propsWithInjection
    } else {
      node.props = propsWithInjection
    }
  } else {
    if (parentCall) {
      parentCall.arguments[0] = propsWithInjection
    } else {
      node.arguments[2] = propsWithInjection
    }
  }
}
export function toValidAssetId (name, type) {
  return `_${type}_${name.replace(/[^\w]/g, (searchValue, replaceValue) => {
    return searchValue === '-' ? '_' : name.charCodeAt(replaceValue).toString()
  })}`
}
export function getMemoedVNodeCall (node) {
  if (node.type === 14 && node.callee === WITH_MEMO) {
    return node.arguments[1].returns
  } else {
    return node
  }
}
export function makeBlock (node, { helper, removeHelper, inSSR }) {
  if (!node.isBlock) {
    node.isBlock = true
    removeHelper(getVNodeHelper(inSSR, node.isComponent))
    helper(OPEN_BLOCK)
    helper(getVNodeBlockHelper(inSSR, node.isComponent))
  }
}
