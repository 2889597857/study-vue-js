import { isString } from '../shared/index.js'

import { OPEN_BLOCK, WITH_DIRECTIVES } from './runtimeHelpers.js'

import { getVNodeBlockHelper, getVNodeHelper } from './utils.js'
export const locStub = {
  source: '',
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 }
}

export function createRoot (children, loc = locStub) {
  return {
    type: 0,
    children,
    helpers: [],
    components: [],
    directives: [],
    hoists: [],
    imports: [],
    cached: 0,
    temps: 0,
    codegenNode: undefined,
    loc
  }
}
export function createVNodeCall (
  context,
  tag,
  props,
  children,
  patchFlag,
  dynamicProps,
  directives,
  isBlock = false,
  disableTracking = false,
  isComponent = false,
  loc = locStub
) {
  if (context) {
    if (isBlock) {
      context.helper(OPEN_BLOCK)
      context.helper(getVNodeBlockHelper(context.inSSR, isComponent))
    } else {
      context.helper(getVNodeHelper(context.inSSR, isComponent))
    }
    if (directives) {
      context.helper(WITH_DIRECTIVES)
    }
  }
  return {
    type: 13,
    tag,
    props,
    children,
    patchFlag,
    dynamicProps,
    directives,
    isBlock,
    disableTracking,
    isComponent,
    loc
  }
}
export function createArrayExpression (elements, loc = locStub) {
  return { type: 17, loc, elements }
}
export function createObjectExpression (properties, loc = locStub) {
  return { type: 15, loc, properties }
}
export function createObjectProperty (key, value) {
  return {
    type: 16,
    loc: locStub,
    key: isString(key) ? createSimpleExpression(key, true) : key,
    value
  }
}
export function createSimpleExpression (
  content,
  isStatic = false,
  loc = locStub,
  constType = 0
) {
  return {
    type: 4,
    loc,
    content,
    isStatic,
    constType: isStatic ? 3 : constType
  }
}
export function createCompoundExpression (children, loc = locStub) {
  return { type: 8, loc, children }
}
export function createCallExpression (callee, args = [], loc = locStub) {
  return { type: 14, loc, callee, arguments: args }
}
export function createFunctionExpression (
  params,
  returns = undefined,
  newline = false,
  isSlot = false,
  loc = locStub
) {
  return { type: 18, params, returns, newline, isSlot, loc }
}
export function createConditionalExpression (
  test,
  consequent,
  alternate,
  newline = true
) {
  return { type: 19, test, consequent, alternate, newline, loc: locStub }
}
export function createCacheExpression (index, value, isVNode = false) {
  return { type: 20, index, value, isVNode, loc: locStub }
}
export function createBlockStatement (body) {
  return { type: 21, body, loc: locStub }
}
