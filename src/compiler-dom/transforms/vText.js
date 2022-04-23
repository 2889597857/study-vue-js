import {
  createObjectProperty,
  createSimpleExpression,
  createCallExpression
} from '../../compiler-core/index.js'

export const transformVText = (dir, node, context) => {
  const { exp, loc } = dir
  if (node.children.length) {
    node.children.length = 0
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`textContent`, true),
        exp
          ? createCallExpression(
            [exp],
            loc
          )
          : createSimpleExpression('', true)
      )
    ]
  }
}