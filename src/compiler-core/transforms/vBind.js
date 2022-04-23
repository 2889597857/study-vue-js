import { createObjectProperty, createSimpleExpression } from '../ast.js'
import { camelize } from '../../shared/index.js'
import { CAMELIZE } from '../runtimeHelpers.js'

export const transformBind = (dir, _node, context) => {
  const { exp, modifiers, loc } = dir
  const arg = dir.arg
  if (arg.type !== 4) {
    arg.children.unshift(`(`)
    arg.children.push(`) || ""`)
  } else if (!arg.isStatic) {
    arg.content = `${arg.content} || ""`
  }
  if (modifiers.includes('camel')) {
    if (arg.type === 4) {
      if (arg.isStatic) {
        arg.content = camelize(arg.content)
      } else {
        arg.content = `${context.helperString(CAMELIZE)}(${arg.content})`
      }
    } else {
      arg.children.unshift(`${context.helperString(CAMELIZE)}(`)
      arg.children.push(`)`)
    }
  }
  if (!context.inSSR) {
    if (modifiers.includes('prop')) {
      injectPrefix(arg, '.')
    }
    if (modifiers.includes('attr')) {
      injectPrefix(arg, '^')
    }
  }
  if (!exp || (exp.type === 4 && !exp.content.trim())) {
    return {
      props: [createObjectProperty(arg, createSimpleExpression('', true, loc))]
    }
  }
  return { props: [createObjectProperty(arg, exp)] }
}
const injectPrefix = (arg, prefix) => {
  if (arg.type === 4) {
    if (arg.isStatic) {
      arg.content = prefix + arg.content
    } else {
      arg.content = `\`${prefix}\${${arg.content}}\``
    }
  } else {
    arg.children.unshift(`'${prefix}' + (`)
    arg.children.push(`)`)
  }
}
