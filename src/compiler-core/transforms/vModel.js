import {
  createSimpleExpression,
  createObjectProperty,
  createCompoundExpression,
} from '../ast.js'
import {
  isMemberExpression,
  isSimpleIdentifier,
  isStaticExp
} from '../utils.js'


export const transformModel = (dir, node, context) => {
  const { exp, arg } = dir
  if (!exp) {
    return createTransformProps()
  }
  const rawExp = exp.loc.source
  const expString = exp.type === 4 ? exp.content : rawExp
  context.bindingMetadata[rawExp]
  const maybeRef = !true
  if (!expString.trim() || (!isMemberExpression(expString) && !maybeRef)) {
    return createTransformProps()
  }
  const propName = arg ? arg : createSimpleExpression('modelValue', true)
  const eventName = arg
    ? isStaticExp(arg)
      ? `onUpdate:${arg.content}`
      : createCompoundExpression(['"onUpdate:" + ', arg])
    : `onUpdate:modelValue`
  let assignmentExp
  const eventArg = context.isTS ? `($event: any)` : `$event`
  {
    assignmentExp = createCompoundExpression([
      `${eventArg} => ((`,
      exp,
      `) = $event)`
    ])
  }
  const props = [
    createObjectProperty(propName, dir.exp),
    createObjectProperty(eventName, assignmentExp)
  ]
  if (dir.modifiers.length && node.tagType === 1) {
    const modifiers = dir.modifiers
      .map(m => (isSimpleIdentifier(m) ? m : JSON.stringify(m)) + `: true`)
      .join(`, `)
    const modifiersKey = arg
      ? isStaticExp(arg)
        ? `${arg.content}Modifiers`
        : createCompoundExpression([arg, ' + "Modifiers"'])
      : `modelModifiers`
    props.push(
      createObjectProperty(
        modifiersKey,
        createSimpleExpression(`{ ${modifiers} }`, false, dir.loc, 2)
      )
    )
  }
  return createTransformProps(props)
}

function createTransformProps(props = []) {
  return { props }
}