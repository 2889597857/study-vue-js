import { createStructuralDirectiveTransform } from '../transform.js'
import {
  createSimpleExpression,
  createCallExpression,
  createFunctionExpression,
  createObjectExpression,
  createObjectProperty,
  createVNodeCall,
  createBlockStatement,
  createCompoundExpression
} from '../ast.js'
import {
  getInnerRange,
  findProp,
  isTemplateNode,
  isSlotOutlet,
  injectProp,
  getVNodeBlockHelper,
  getVNodeHelper,
  findDir
} from '../utils.js'
import {
  RENDER_LIST,
  OPEN_BLOCK,
  FRAGMENT,
  IS_MEMO_SAME
} from '../runtimeHelpers.js'
import { validateBrowserExpression } from '../validateExpression.js'
import { PatchFlagNames } from '../../shared/index.js'

export const transformFor = createStructuralDirectiveTransform(
  'for',
  (node, dir, context) => {
    const { helper, removeHelper } = context
    return processFor(node, dir, context, forNode => {
      const renderExp = createCallExpression(helper(RENDER_LIST), [
        forNode.source
      ])
      const isTemplate = isTemplateNode(node)
      const memo = findDir(node, 'memo')
      const keyProp = findProp(node, `key`)
      const keyExp =
        keyProp &&
        (keyProp.type === 6
          ? createSimpleExpression(keyProp.value.content, true)
          : keyProp.exp)
      const keyProperty = keyProp ? createObjectProperty(`key`, keyExp) : null
      const isStableFragment =
        forNode.source.type === 4 && forNode.source.constType > 0
      const fragmentFlag = isStableFragment ? 64 : keyProp ? 128 : 256
      forNode.codegenNode = createVNodeCall(
        context,
        helper(FRAGMENT),
        undefined,
        renderExp,
        fragmentFlag + ` /* ${PatchFlagNames[fragmentFlag]} */`,
        undefined,
        undefined,
        true,
        !isStableFragment,
        false,
        node.loc
      )
      return () => {
        let childBlock
        const { children } = forNode
        if (isTemplate) {
          node.children.some(c => {
            if (c.type === 1) {
              const key = findProp(c, 'key')
              if (key) {
                return true
              }
            }
          })
        }
        const needFragmentWrapper =
          children.length !== 1 || children[0].type !== 1
        const slotOutlet = isSlotOutlet(node)
          ? node
          : isTemplate &&
            node.children.length === 1 &&
            isSlotOutlet(node.children[0])
          ? node.children[0]
          : null
        if (slotOutlet) {
          childBlock = slotOutlet.codegenNode
          if (isTemplate && keyProperty) {
            injectProp(childBlock, keyProperty, context)
          }
        } else if (needFragmentWrapper) {
          childBlock = createVNodeCall(
            context,
            helper(FRAGMENT),
            keyProperty ? createObjectExpression([keyProperty]) : undefined,
            node.children,
            64 + ` /* ${PatchFlagNames[64]} */`,
            undefined,
            undefined,
            true,
            undefined,
            false
          )
        } else {
          childBlock = children[0].codegenNode
          if (isTemplate && keyProperty) {
            injectProp(childBlock, keyProperty, context)
          }
          if (childBlock.isBlock !== !isStableFragment) {
            if (childBlock.isBlock) {
              removeHelper(OPEN_BLOCK)
              removeHelper(
                getVNodeBlockHelper(context.inSSR, childBlock.isComponent)
              )
            } else {
              removeHelper(
                getVNodeHelper(context.inSSR, childBlock.isComponent)
              )
            }
          }
          childBlock.isBlock = !isStableFragment
          if (childBlock.isBlock) {
            helper(OPEN_BLOCK)
            helper(getVNodeBlockHelper(context.inSSR, childBlock.isComponent))
          } else {
            helper(getVNodeHelper(context.inSSR, childBlock.isComponent))
          }
        }
        if (memo) {
          const loop = createFunctionExpression(
            createForLoopParams(forNode.parseResult, [
              createSimpleExpression(`_cached`)
            ])
          )
          loop.body = createBlockStatement([
            createCompoundExpression([`const _memo = (`, memo.exp, `)`]),
            createCompoundExpression([
              `if (_cached`,
              ...(keyExp ? [` && _cached.key === `, keyExp] : []),
              ` && ${context.helperString(
                IS_MEMO_SAME
              )}(_cached, _memo)) return _cached`
            ]),
            createCompoundExpression([`const _item = `, childBlock]),
            createSimpleExpression(`_item.memo = _memo`),
            createSimpleExpression(`return _item`)
          ])
          renderExp.arguments.push(
            loop,
            createSimpleExpression(`_cache`),
            createSimpleExpression(String(context.cached++))
          )
        } else {
          renderExp.arguments.push(
            createFunctionExpression(
              createForLoopParams(forNode.parseResult),
              childBlock,
              true
            )
          )
        }
      }
    })
  }
)

// target-agnostic transform used for both Client and SSR
export function processFor (node, dir, context, processCodegen) {
  if (!dir.exp) {
    return
  }
  const parseResult = parseForExpression(dir.exp, context)
  if (!parseResult) {
    return
  }
  const { addIdentifiers, removeIdentifiers, scopes } = context
  const { source, value, key, index } = parseResult
  const forNode = {
    type: 11,
    loc: dir.loc,
    source,
    valueAlias: value,
    keyAlias: key,
    objectIndexAlias: index,
    parseResult,
    children: isTemplateNode(node) ? node.children : [node]
  }
  context.replaceNode(forNode)
  scopes.vFor++
  const onExit = processCodegen && processCodegen(forNode)
  return () => {
    scopes.vFor--
    if (onExit) onExit()
  }
}

const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
// This regex doesn't cover the case if key or index aliases have destructuring,
// but those do not make sense in the first place, so this works in practice.
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
const stripParensRE = /^\(|\)$/g

export function parseForExpression (input, context) {
  const loc = input.loc
  const exp = input.content
  const inMatch = exp.match(forAliasRE)
  if (!inMatch) return
  const [, LHS, RHS] = inMatch
  const result = {
    source: createAliasExpression(
      loc,
      RHS.trim(),
      exp.indexOf(RHS, LHS.length)
    ),
    value: undefined,
    key: undefined,
    index: undefined
  }
  {
    validateBrowserExpression(result.source, context)
  }
  let valueContent = LHS.trim()
    .replace(stripParensRE, '')
    .trim()
  const trimmedOffset = LHS.indexOf(valueContent)
  const iteratorMatch = valueContent.match(forIteratorRE)
  if (iteratorMatch) {
    valueContent = valueContent.replace(forIteratorRE, '').trim()
    const keyContent = iteratorMatch[1].trim()
    let keyOffset
    if (keyContent) {
      keyOffset = exp.indexOf(keyContent, trimmedOffset + valueContent.length)
      result.key = createAliasExpression(loc, keyContent, keyOffset)
      {
        validateBrowserExpression(result.key, context, true)
      }
    }
    if (iteratorMatch[2]) {
      const indexContent = iteratorMatch[2].trim()
      if (indexContent) {
        result.index = createAliasExpression(
          loc,
          indexContent,
          exp.indexOf(
            indexContent,
            result.key
              ? keyOffset + keyContent.length
              : trimmedOffset + valueContent.length
          )
        )
        {
          validateBrowserExpression(result.index, context, true)
        }
      }
    }
  }
  if (valueContent) {
    result.value = createAliasExpression(loc, valueContent, trimmedOffset)
    {
      validateBrowserExpression(result.value, context, true)
    }
  }
  return result
}
function createAliasExpression (range, content, offset) {
  return createSimpleExpression(
    content,
    false,
    getInnerRange(range, offset, content.length)
  )
}

export function createForLoopParams ({ value, key, index }, memoArgs = []) {
  return createParamsList([value, key, index, ...memoArgs])
}
function createParamsList (args) {
  let i = args.length
  while (i--) {
    if (args[i]) break
  }
  return args
    .slice(0, i + 1)
    .map((arg, i) => arg || createSimpleExpression(`_`.repeat(i + 1), false))
}
