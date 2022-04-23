export const transformExpression = (node, context) => {
  if (node.type === 5) {
    node.content = processExpression(node.content, context)
  } else if (node.type === 1) {
    for (let i = 0; i < node.props.length; i++) {
      const dir = node.props[i]
      if (dir.type === 7 && dir.name !== 'for') {
        const exp = dir.exp
        const arg = dir.arg
        if (exp && exp.type === 4 && !(dir.name === 'on' && arg)) {
          dir.exp = processExpression(exp, context, dir.name === 'slot')
        }
        if (arg && arg.type === 4 && !arg.isStatic) {
          dir.arg = processExpression(arg, context)
        }
      }
    }
  }
}
export function processExpression (
  node,
  context,
  asParams = false,
  asRawStatements = false,
  localVars = Object.create(context.identifiers)
) {
  {
    return node
  }
}
