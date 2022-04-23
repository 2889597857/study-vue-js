export const transformVHtml = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    context.onError(createDOMCompilerError(50, loc))
  }
  if (node.children.length) {
    context.onError(createDOMCompilerError(51, loc))
    node.children.length = 0
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`innerHTML`, true, loc),
        exp || createSimpleExpression('', true)
      )
    ]
  }
}