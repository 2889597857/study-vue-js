import {
  createObjectExpression,
  createObjectProperty,
  createSimpleExpression,
  createFunctionExpression,
  createConditionalExpression,
  createCallExpression,
  createArrayExpression
} from '../ast.js'
import { findDir, isTemplateNode, isStaticExp } from '../utils.js'
import { CREATE_SLOTS, RENDER_LIST, WITH_CTX } from '../runtimeHelpers.js'
import { parseForExpression, createForLoopParams } from './vFor.js'
import { slotFlagsText } from '../../shared/index.js'

const defaultFallback = createSimpleExpression(`undefined`, false)

export const trackSlotScopes = (node, context) => {
  if (node.type === 1 && (node.tagType === 1 || node.tagType === 3)) {
    const vSlot = findDir(node, 'slot')
    if (vSlot) {
      vSlot.exp
      context.scopes.vSlot++
      return () => {
        context.scopes.vSlot--
      }
    }
  }
}

const buildClientSlotFn = (props, children, loc) =>
  createFunctionExpression(
    props,
    children,
    false,
    true,
    children.length ? children[0].loc : loc
  )

export function buildSlots (node, context, buildSlotFn = buildClientSlotFn) {
  context.helper(WITH_CTX)
  const { children, loc } = node
  const slotsProperties = []
  const dynamicSlots = []
  let hasDynamicSlots = context.scopes.vSlot > 0 || context.scopes.vFor > 0
  const onComponentSlot = findDir(node, 'slot', true)
  if (onComponentSlot) {
    const { arg, exp } = onComponentSlot
    if (arg && !isStaticExp(arg)) {
      hasDynamicSlots = true
    }
    slotsProperties.push(
      createObjectProperty(
        arg || createSimpleExpression('default', true),
        buildSlotFn(exp, children, loc)
      )
    )
  }
  let hasTemplateSlots = false
  let hasNamedDefaultSlot = false
  const implicitDefaultChildren = []
  const seenSlotNames = new Set()
  for (let i = 0; i < children.length; i++) {
    const slotElement = children[i]
    let slotDir
    if (
      !isTemplateNode(slotElement) ||
      !(slotDir = findDir(slotElement, 'slot', true))
    ) {
      if (slotElement.type !== 3) {
        implicitDefaultChildren.push(slotElement)
      }
      continue
    }
    if (onComponentSlot) {
      break
    }
    hasTemplateSlots = true
    const { children: slotChildren, loc: slotLoc } = slotElement
    const {
      arg: slotName = createSimpleExpression(`default`, true),
      exp: slotProps,
      loc: dirLoc
    } = slotDir
    let staticSlotName
    if (isStaticExp(slotName)) {
      staticSlotName = slotName ? slotName.content : `default`
    } else {
      hasDynamicSlots = true
    }
    const slotFunction = buildSlotFn(slotProps, slotChildren, slotLoc)
    let vIf
    let vElse
    let vFor
    if ((vIf = findDir(slotElement, 'if'))) {
      hasDynamicSlots = true
      dynamicSlots.push(
        createConditionalExpression(
          vIf.exp,
          buildDynamicSlot(slotName, slotFunction),
          defaultFallback
        )
      )
    } else if ((vElse = findDir(slotElement, /^else(-if)?$/, true))) {
      let j = i
      let prev
      while (j--) {
        prev = children[j]
        if (prev.type !== 3) {
          break
        }
      }
      if (prev && isTemplateNode(prev) && findDir(prev, 'if')) {
        children.splice(i, 1)
        i--
        let conditional = dynamicSlots[dynamicSlots.length - 1]
        while (conditional.alternate.type === 19) {
          conditional = conditional.alternate
        }
        conditional.alternate = vElse.exp
          ? createConditionalExpression(
              vElse.exp,
              buildDynamicSlot(slotName, slotFunction),
              defaultFallback
            )
          : buildDynamicSlot(slotName, slotFunction)
      } else {
      }
    } else if ((vFor = findDir(slotElement, 'for'))) {
      hasDynamicSlots = true
      const parseResult =
        vFor.parseResult || parseForExpression(vFor.exp, context)
      if (parseResult) {
        dynamicSlots.push(
          createCallExpression(context.helper(RENDER_LIST), [
            parseResult.source,
            createFunctionExpression(
              createForLoopParams(parseResult),
              buildDynamicSlot(slotName, slotFunction),
              true
            )
          ])
        )
      } else {
      }
    } else {
      if (staticSlotName) {
        if (seenSlotNames.has(staticSlotName)) {
          continue
        }
        seenSlotNames.add(staticSlotName)
        if (staticSlotName === 'default') {
          hasNamedDefaultSlot = true
        }
      }
      slotsProperties.push(createObjectProperty(slotName, slotFunction))
    }
  }
  if (!onComponentSlot) {
    const buildDefaultSlotProperty = (props, children) => {
      const fn = buildSlotFn(props, children, loc)
      return createObjectProperty(`default`, fn)
    }
    if (!hasTemplateSlots) {
      slotsProperties.push(buildDefaultSlotProperty(undefined, children))
    } else if (
      implicitDefaultChildren.length &&
      implicitDefaultChildren.some(node => isNonWhitespaceContent(node))
    ) {
      if (hasNamedDefaultSlot) {
      } else {
        slotsProperties.push(
          buildDefaultSlotProperty(undefined, implicitDefaultChildren)
        )
      }
    }
  }
  const slotFlag = hasDynamicSlots
    ? 2
    : hasForwardedSlots(node.children)
    ? 3
    : 1
  let slots = createObjectExpression(
    slotsProperties.concat(
      createObjectProperty(
        `_`,
        createSimpleExpression(
          slotFlag + ` /* ${slotFlagsText[slotFlag]} */`,
          false
        )
      )
    ),
    loc
  )
  if (dynamicSlots.length) {
    slots = createCallExpression(context.helper(CREATE_SLOTS), [
      slots,
      createArrayExpression(dynamicSlots)
    ])
  }
  return { slots, hasDynamicSlots }
}
function buildDynamicSlot (name, fn) {
  return createObjectExpression([
    createObjectProperty(`name`, name),
    createObjectProperty(`fn`, fn)
  ])
}
function hasForwardedSlots (children) {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    switch (child.type) {
      case 1:
        if (child.tagType === 2 || hasForwardedSlots(child.children)) {
          return true
        }
        break
      case 9:
        if (hasForwardedSlots(child.branches)) return true
        break
      case 10:
      case 11:
        if (hasForwardedSlots(child.children)) return true
        break
    }
  }
  return false
}
function isNonWhitespaceContent (node) {
  if (node.type !== 2 && node.type !== 12) return true
  return node.type === 2
    ? !!node.content.trim()
    : isNonWhitespaceContent(node.content)
}
