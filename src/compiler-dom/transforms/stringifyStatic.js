/**
 * This module is Node-only.
 */
import {
  NodeTypes,
  createCallExpression,
  ElementTypes,
  ConstantTypes
} from '../../compiler-core/index.js'
import {
  isVoidTag,
  isString,
  isSymbol,
  isKnownHtmlAttr,
  escapeHtml,
  toDisplayString,
  normalizeClass,
  normalizeStyle,
  stringifyStyle,
  makeMap,
  isKnownSvgAttr
} from '../../shared/index.js'
import { DOMNamespaces } from '../parserOptions.js'

const expReplaceRE = /__VUE_EXP_START__(.*?)__VUE_EXP_END__/g

export const stringifyStatic = (children, context, parent) => {
  // bail stringification for slot content
  if (context.scopes.vSlot > 0) {
    return
  }

  let nc = 0 // current node count
  let ec = 0 // current element with binding count
  const currentChunk = []

  const stringifyCurrentChunk = currentIndex => {
    if (
      nc >= StringifyThresholds.NODE_COUNT ||
      ec >= StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
    ) {
      // combine all currently eligible nodes into a single static vnode call
      const staticCall = createCallExpression(context.helper(), [
        JSON.stringify(
          currentChunk.map(node => stringifyNode(node, context)).join('')
        ).replace(expReplaceRE, `" + $1 + "`),
        // the 2nd argument indicates the number of DOM nodes this static vnode
        // will insert / hydrate
        String(currentChunk.length)
      ])
      // replace the first node's hoisted expression with the static vnode call
      replaceHoist(currentChunk[0], staticCall, context)

      if (currentChunk.length > 1) {
        for (let i = 1; i < currentChunk.length; i++) {
          // for the merged nodes, set their hoisted expression to null
          replaceHoist(currentChunk[i], null, context)
        }

        // also remove merged nodes from children
        const deleteCount = currentChunk.length - 1
        children.splice(currentIndex - currentChunk.length + 1, deleteCount)
        return deleteCount
      }
    }
    return 0
  }

  let i = 0
  for (; i < children.length; i++) {
    const child = children[i]
    const hoisted = getHoistedNode(child)
    if (hoisted) {
      // presence of hoisted means child must be a stringifiable node
      const node = child
      const result = analyzeNode(node)
      if (result) {
        // node is stringifiable, record state
        nc += result[0]
        ec += result[1]
        currentChunk.push(node)
        continue
      }
    }

    i -= stringifyCurrentChunk(i)
    nc = 0
    ec = 0
    currentChunk.length = 0
  }
  stringifyCurrentChunk(i)
}

const getHoistedNode = node =>
  ((node.type === NodeTypes.ELEMENT && node.tagType === ElementTypes.ELEMENT) ||
    node.type == NodeTypes.TEXT_CALL) &&
  node.codegenNode &&
  node.codegenNode.type === NodeTypes.SIMPLE_EXPRESSION &&
  node.codegenNode.hoisted

const dataAriaRE = /^(data|aria)-/
const isStringifiableAttr = (name, ns) => {
  return (
    (ns === DOMNamespaces.HTML
      ? isKnownHtmlAttr(name)
      : ns === DOMNamespaces.SVG
      ? isKnownSvgAttr(name)
      : false) || dataAriaRE.test(name)
  )
}

const replaceHoist = (node, replacement, context) => {
  const hoistToReplace = node.codegenNode.hoisted
  context.hoists[context.hoists.indexOf(hoistToReplace)] = replacement
}

const isNonStringifiable = /*#__PURE__*/ makeMap(
  `caption,thead,tr,th,tbody,td,tfoot,colgroup,col`
)

/**
 * for a hoisted node, analyze it and return:
 * - false: bailed (contains non-stringifiable props or runtime constant)
 * - [nc, ec] where
 *   - nc is the number of nodes inside
 *   - ec is the number of element with bindings inside
 */
function analyzeNode (node) {
  if (node.type === NodeTypes.ELEMENT && isNonStringifiable(node.tag)) {
    return false
  }

  if (node.type === NodeTypes.TEXT_CALL) {
    return [1, 0]
  }

  let nc = 1 // node count
  let ec = node.props.length > 0 ? 1 : 0 // element w/ binding count
  let bailed = false
  const bail = () => {
    bailed = true
    return false
  }

  // TODO: check for cases where using innerHTML will result in different
  // output compared to imperative node insertions.
  // probably only need to check for most common case
  // i.e. non-phrasing-content tags inside `<p>`
  function walk (node) {
    for (let i = 0; i < node.props.length; i++) {
      const p = node.props[i]
      // bail on non-attr bindings
      if (
        p.type === NodeTypes.ATTRIBUTE &&
        !isStringifiableAttr(p.name, node.ns)
      ) {
        return bail()
      }
      if (p.type === NodeTypes.DIRECTIVE && p.name === 'bind') {
        // bail on non-attr bindings
        if (
          p.arg &&
          (p.arg.type === NodeTypes.COMPOUND_EXPRESSION ||
            (p.arg.isStatic && !isStringifiableAttr(p.arg.content, node.ns)))
        ) {
          return bail()
        }
        if (
          p.exp &&
          (p.exp.type === NodeTypes.COMPOUND_EXPRESSION ||
            p.exp.constType < ConstantTypes.CAN_STRINGIFY)
        ) {
          return bail()
        }
      }
    }
    for (let i = 0; i < node.children.length; i++) {
      nc++
      const child = node.children[i]
      if (child.type === NodeTypes.ELEMENT) {
        if (child.props.length > 0) {
          ec++
        }
        walk(child)
        if (bailed) {
          return false
        }
      }
    }
    return true
  }

  return walk(node) ? [nc, ec] : false
}

function stringifyNode (node, context) {
  if (isString(node)) {
    return node
  }
  if (isSymbol(node)) {
    return ``
  }
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return stringifyElement(node, context)
    case NodeTypes.TEXT:
      return escapeHtml(node.content)
    case NodeTypes.COMMENT:
      return `<!--${escapeHtml(node.content)}-->`
    case NodeTypes.INTERPOLATION:
      return escapeHtml(toDisplayString(evaluateConstant(node.content)))
    case NodeTypes.COMPOUND_EXPRESSION:
      return escapeHtml(evaluateConstant(node))
    case NodeTypes.TEXT_CALL:
      return stringifyNode(node.content, context)
    default:
      // static trees will not contain if/for nodes
      return ''
  }
}

function stringifyElement (node, context) {
  let res = `<${node.tag}`
  for (let i = 0; i < node.props.length; i++) {
    const p = node.props[i]
    if (p.type === NodeTypes.ATTRIBUTE) {
      res += ` ${p.name}`
      if (p.value) {
        res += `="${escapeHtml(p.value.content)}"`
      }
    } else if (p.type === NodeTypes.DIRECTIVE && p.name === 'bind') {
      const exp = p.exp
      if (exp.content[0] === '_') {
        // internally generated string constant references
        // e.g. imported URL strings via compiler-sfc transformAssetUrl plugin
        res += ` ${p.arg.content}="__VUE_EXP_START__${exp.content}__VUE_EXP_END__"`
        continue
      }
      // constant v-bind, e.g. :foo="1"
      let evaluated = evaluateConstant(exp)
      if (evaluated != null) {
        const arg = p.arg && p.arg.content
        if (arg === 'class') {
          evaluated = normalizeClass(evaluated)
        } else if (arg === 'style') {
          evaluated = stringifyStyle(normalizeStyle(evaluated))
        }
        res += ` ${p.arg.content}="${escapeHtml(evaluated)}"`
      }
    }
  }
  if (context.scopeId) {
    res += ` ${context.scopeId}`
  }
  res += `>`
  for (let i = 0; i < node.children.length; i++) {
    res += stringifyNode(node.children[i], context)
  }
  if (!isVoidTag(node.tag)) {
    res += `</${node.tag}>`
  }
  return res
}

// __UNSAFE__
// Reason: eval.
// It's technically safe to eval because only constant expressions are possible
// here, e.g. `{{ 1 }}` or `{{ 'foo' }}`
// in addition, constant exps bail on presence of parens so you can't even
// run JSFuck in here. But we mark it unsafe for security review purposes.
// (see compiler-core/src/transformExpressions)
function evaluateConstant (exp) {
  if (exp.type === NodeTypes.SIMPLE_EXPRESSION) {
    return new Function(`return ${exp.content}`)()
  } else {
    // compound
    let res = ``
    exp.children.forEach(c => {
      if (isString(c) || isSymbol(c)) {
        return
      }
      if (c.type === NodeTypes.TEXT) {
        res += c.content
      } else if (c.type === NodeTypes.INTERPOLATION) {
        res += toDisplayString(evaluateConstant(c.content))
      } else {
        res += evaluateConstant(c)
      }
    })
    return res
  }
}
