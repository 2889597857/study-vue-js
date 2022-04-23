import {
  createCompoundExpression,
  createObjectProperty,
  createSimpleExpression
} from '../ast.js'
import { camelize, toHandlerKey } from '../../shared/index.js'
import { validateBrowserExpression } from '../validateExpression.js'
import { isMemberExpression } from '../utils.js'
import { TO_HANDLER_KEY } from '../runtimeHelpers.js'

const fnExpRE = /^\s*([\w$_]+|(async\s*)?\([^)]*?\))\s*=>|^\s*(async\s+)?function(?:\s+[\w$]+)?\s*\(/

export const transformOn = (dir, node, context, augmentor) => {
  const { loc, modifiers, arg } = dir
  let eventName
  if (arg.type === 4) {
    if (arg.isStatic) {
      let rawName = arg.content
      if (rawName.startsWith('vue:')) {
        rawName = `vnode-${rawName.slice(4)}`
      }
      eventName = createSimpleExpression(
        toHandlerKey(camelize(rawName)),
        true,
        arg.loc
      )
    } else {
      eventName = createCompoundExpression([
        `${context.helperString(TO_HANDLER_KEY)}(`,
        arg,
        `)`
      ])
    }
  } else {
    eventName = arg
    eventName.children.unshift(`${context.helperString(TO_HANDLER_KEY)}(`)
    eventName.children.push(`)`)
  }
  let exp = dir.exp
  if (exp && !exp.content.trim()) {
    exp = undefined
  }
  let shouldCache = context.cacheHandlers && !exp && !context.inVOnce
  if (exp) {
    const isMemberExp = isMemberExpression(exp.content)
    const isInlineStatement = !(isMemberExp || fnExpRE.test(exp.content))
    const hasMultipleStatements = exp.content.includes(`;`)
    {
      validateBrowserExpression(exp, context, false, hasMultipleStatements)
    }
    if (isInlineStatement || (shouldCache && isMemberExp)) {
      exp = createCompoundExpression([
        `${isInlineStatement ? `$event` : `${``}(...args)`} => ${
          hasMultipleStatements ? `{` : `(`
        }`,
        exp,
        hasMultipleStatements ? `}` : `)`
      ])
    }
  }
  let ret = {
    props: [
      createObjectProperty(
        eventName,
        exp || createSimpleExpression(`() => {}`, false, loc)
      )
    ]
  }
  if (augmentor) {
    ret = augmentor(ret)
  }
  if (shouldCache) {
    ret.props[0].value = context.cache(ret.props[0].value)
  }
  ret.props.forEach(p => (p.key.isHandlerKey = true))
  return ret
}
