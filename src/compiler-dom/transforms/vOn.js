import {
  transformOn as baseTransform,
  createObjectProperty,
  createCallExpression,
  createSimpleExpression,
  createCompoundExpression,
  isStaticExp,
} from '../../compiler-core/index.js'
import { V_ON_WITH_MODIFIERS, V_ON_WITH_KEYS } from '../runtimeHelpers.js'
import { makeMap, capitalize } from '../../shared/index.js'

const isEventOptionModifier = makeMap(`passive,once,capture`)
const isNonKeyModifier = makeMap(
  `stop,prevent,self,` + `ctrl,shift,alt,meta,exact,` + `middle`
)
const maybeKeyModifier = makeMap('left,right')
const isKeyboardEvent = makeMap(`onkeyup,onkeydown,onkeypress`, true)
const resolveModifiers = (key, modifiers, context, loc) => {
  const keyModifiers = []
  const nonKeyModifiers = []
  const eventOptionModifiers = []
  for (let i = 0; i < modifiers.length; i++) {
    const modifier = modifiers[i]
    if (isEventOptionModifier(modifier)) {
      eventOptionModifiers.push(modifier)
    } else {
      if (maybeKeyModifier(modifier)) {
        if (isStaticExp(key)) {
          if (isKeyboardEvent(key.content)) {
            keyModifiers.push(modifier)
          } else {
            nonKeyModifiers.push(modifier)
          }
        } else {
          keyModifiers.push(modifier)
          nonKeyModifiers.push(modifier)
        }
      } else {
        if (isNonKeyModifier(modifier)) {
          nonKeyModifiers.push(modifier)
        } else {
          keyModifiers.push(modifier)
        }
      }
    }
  }
  return { keyModifiers, nonKeyModifiers, eventOptionModifiers }
}
const transformClick = (key, event) => {
  const isStaticClick =
    isStaticExp(key) && key.content.toLowerCase() === 'onclick'
  return isStaticClick
    ? createSimpleExpression(event, true)
    : key.type !== 4
      ? createCompoundExpression([
        `(`,
        key,
        `) === "onClick" ? "${event}" : (`,
        key,
        `)`
      ])
      : key
}
export const transformOn = (dir, node, context) => {
  return baseTransform(dir, node, context, baseResult => {
    const { modifiers } = dir
    if (!modifiers.length) return baseResult
    let { key, value: handlerExp } = baseResult.props[0]
    const {
      keyModifiers,
      nonKeyModifiers,
      eventOptionModifiers
    } = resolveModifiers(key, modifiers, context, dir.loc)
    if (nonKeyModifiers.includes('right')) {
      key = transformClick(key, `onContextmenu`)
    }
    if (nonKeyModifiers.includes('middle')) {
      key = transformClick(key, `onMouseup`)
    }
    if (nonKeyModifiers.length) {
      handlerExp = createCallExpression(context.helper(V_ON_WITH_MODIFIERS), [
        handlerExp,
        JSON.stringify(nonKeyModifiers)
      ])
    }
    if (
      keyModifiers.length &&
      (!isStaticExp(key) || isKeyboardEvent(key.content))
    ) {
      handlerExp = createCallExpression(context.helper(V_ON_WITH_KEYS), [
        handlerExp,
        JSON.stringify(keyModifiers)
      ])
    }
    if (eventOptionModifiers.length) {
      const modifierPostfix = eventOptionModifiers.map(capitalize).join('')
      key = isStaticExp(key)
        ? createSimpleExpression(`${key.content}${modifierPostfix}`, true)
        : createCompoundExpression([`(`, key, `) + "${modifierPostfix}"`])
    }
    return { props: [createObjectProperty(key, handlerExp)] }
  })
}
