import { createSimpleExpression } from '../../compiler-core/index.js'
import { parseStringStyle } from '../../shared/index.js'
export const transformStyle = node => {
  if (node.type === 1) {
    node.props.forEach((p, i) => {
      if (p.type === 6 && p.name === 'style' && p.value) {
        node.props[i] = {
          type: 7,
          name: `bind`,
          arg: createSimpleExpression(`style`, true, p.loc),
          exp: parseInlineCSS(p.value.content, p.loc),
          modifiers: [],
          loc: p.loc
        }
      }
    })
  }
}
const parseInlineCSS = (cssText, loc) => {
  const normalized = parseStringStyle(cssText)
  return createSimpleExpression(JSON.stringify(normalized), false, loc, 3)
}
