import {
  createCallExpression,
  createArrayExpression,
  createObjectProperty,
  createSimpleExpression,
  createObjectExpression,
  createVNodeCall
} from '../ast.js'
import {
  PatchFlagNames,
  isSymbol,
  isOn,
  isObject,
  isReservedProp,
  isBuiltInDirective
} from '../../shared/index.js'
import {
  RESOLVE_DIRECTIVE,
  RESOLVE_COMPONENT,
  RESOLVE_DYNAMIC_COMPONENT,
  MERGE_PROPS,
  NORMALIZE_CLASS,
  NORMALIZE_STYLE,
  NORMALIZE_PROPS,
  TO_HANDLERS,
  TELEPORT,
  KEEP_ALIVE,
  SUSPENSE,
  GUARD_REACTIVE_PROPS
} from '../runtimeHelpers.js'
import {
  getInnerRange,
  toValidAssetId,
  findProp,
  isCoreComponent,
  isStaticArgOf,
  findDir,
  isStaticExp
} from '../utils.js'
import { buildSlots } from './vSlot.js'
import { getConstantType } from './hoistStatic.js'

const directiveImportMap = new WeakMap()
export const transformElement = (node, context) => {
  return function postTransformElement () {
    node = context.currentNode
    if (!(node.type === 1 && (node.tagType === 0 || node.tagType === 1))) {
      return
    }
    const { tag, props } = node
    const isComponent = node.tagType === 1
    let vnodeTag = isComponent
      ? resolveComponentType(node, context)
      : `"${tag}"`
    const isDynamicComponent =
      isObject(vnodeTag) && vnodeTag.callee === RESOLVE_DYNAMIC_COMPONENT
    let vnodeProps
    let vnodeChildren
    let vnodePatchFlag
    let patchFlag = 0
    let vnodeDynamicProps
    let dynamicPropNames
    let vnodeDirectives
    let shouldUseBlock =
      isDynamicComponent ||
      vnodeTag === TELEPORT ||
      vnodeTag === SUSPENSE ||
      (!isComponent && (tag === 'svg' || tag === 'foreignObject'))
    if (props.length > 0) {
      const propsBuildResult = buildProps(node, context)
      vnodeProps = propsBuildResult.props
      patchFlag = propsBuildResult.patchFlag
      dynamicPropNames = propsBuildResult.dynamicPropNames
      const directives = propsBuildResult.directives
      vnodeDirectives =
        directives && directives.length
          ? createArrayExpression(
              directives.map(dir => buildDirectiveArgs(dir, context))
            )
          : undefined
      if (propsBuildResult.shouldUseBlock) {
        shouldUseBlock = true
      }
    }
    if (node.children.length > 0) {
      if (vnodeTag === KEEP_ALIVE) {
        shouldUseBlock = true
        patchFlag |= 1024
        if (node.children.length > 1) {
        }
      }
      const shouldBuildAsSlots =
        isComponent && vnodeTag !== TELEPORT && vnodeTag !== KEEP_ALIVE
      if (shouldBuildAsSlots) {
        const { slots, hasDynamicSlots } = buildSlots(node, context)
        vnodeChildren = slots
        if (hasDynamicSlots) {
          patchFlag |= 1024
        }
      } else if (node.children.length === 1 && vnodeTag !== TELEPORT) {
        const child = node.children[0]
        const type = child.type
        const hasDynamicTextChild = type === 5 || type === 8
        if (hasDynamicTextChild && getConstantType(child, context) === 0) {
          patchFlag |= 1
        }
        if (hasDynamicTextChild || type === 2) {
          vnodeChildren = child
        } else {
          vnodeChildren = node.children
        }
      } else {
        vnodeChildren = node.children
      }
    }
    if (patchFlag !== 0) {
      {
        if (patchFlag < 0) {
          vnodePatchFlag = patchFlag + ` /* ${PatchFlagNames[patchFlag]} */`
        } else {
          const flagNames = Object.keys(PatchFlagNames)
            .map(Number)
            .filter(n => n > 0 && patchFlag & n)
            .map(n => PatchFlagNames[n])
            .join(`, `)
          vnodePatchFlag = patchFlag + ` /* ${flagNames} */`
        }
      }
      if (dynamicPropNames && dynamicPropNames.length) {
        vnodeDynamicProps = stringifyDynamicPropNames(dynamicPropNames)
      }
    }
    node.codegenNode = createVNodeCall(
      context,
      vnodeTag,
      vnodeProps,
      vnodeChildren,
      vnodePatchFlag,
      vnodeDynamicProps,
      vnodeDirectives,
      !!shouldUseBlock,
      false,
      isComponent,
      node.loc
    )
  }
}
function resolveComponentType (node, context, ssr = false) {
  let { tag } = node
  const isExplicitDynamic = isComponentTag(tag)
  const isProp = findProp(node, 'is')
  if (isProp) {
    if (isExplicitDynamic || false) {
      const exp =
        isProp.type === 6
          ? isProp.value && createSimpleExpression(isProp.value.content, true)
          : isProp.exp
      if (exp) {
        return createCallExpression(context.helper(RESOLVE_DYNAMIC_COMPONENT), [
          exp
        ])
      }
    } else if (isProp.type === 6 && isProp.value.content.startsWith('vue:')) {
      tag = isProp.value.content.slice(4)
    }
  }
  const isDir = !isExplicitDynamic && findDir(node, 'is')
  if (isDir && isDir.exp) {
    return createCallExpression(context.helper(RESOLVE_DYNAMIC_COMPONENT), [
      isDir.exp
    ])
  }
  const builtIn = isCoreComponent(tag) || context.isBuiltInComponent(tag)
  if (builtIn) {
    if (!ssr) context.helper(builtIn)
    return builtIn
  }
  context.helper(RESOLVE_COMPONENT)
  context.components.add(tag)
  return toValidAssetId(tag, `component`)
}
export function buildProps (node, context, props = node.props, ssr = false) {
  const { tag, loc: elementLoc, children } = node
  const isComponent = node.tagType === 1
  let properties = []
  const mergeArgs = []
  const runtimeDirectives = []
  const hasChildren = children.length > 0
  let shouldUseBlock = false
  let patchFlag = 0
  let hasRef = false
  let hasClassBinding = false
  let hasStyleBinding = false
  let hasHydrationEventBinding = false
  let hasDynamicKeys = false
  let hasVnodeHook = false
  const dynamicPropNames = []
  const analyzePatchFlag = ({ key, value }) => {
    if (isStaticExp(key)) {
      const name = key.content
      const isEventHandler = isOn(name)
      if (
        !isComponent &&
        isEventHandler &&
        name.toLowerCase() !== 'onclick' &&
        name !== 'onUpdate:modelValue' &&
        !isReservedProp(name)
      ) {
        hasHydrationEventBinding = true
      }
      if (isEventHandler && isReservedProp(name)) {
        hasVnodeHook = true
      }
      if (
        value.type === 20 ||
        ((value.type === 4 || value.type === 8) &&
          getConstantType(value, context) > 0)
      ) {
        return
      }
      if (name === 'ref') {
        hasRef = true
      } else if (name === 'class') {
        hasClassBinding = true
      } else if (name === 'style') {
        hasStyleBinding = true
      } else if (name !== 'key' && !dynamicPropNames.includes(name)) {
        dynamicPropNames.push(name)
      }
      if (
        isComponent &&
        (name === 'class' || name === 'style') &&
        !dynamicPropNames.includes(name)
      ) {
        dynamicPropNames.push(name)
      }
    } else {
      hasDynamicKeys = true
    }
  }
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    if (prop.type === 6) {
      const { loc, name, value } = prop
      let isStatic = true
      if (name === 'ref') {
        hasRef = true
        if (context.scopes.vFor > 0) {
          properties.push(
            createObjectProperty(
              createSimpleExpression('ref_for', true),
              createSimpleExpression('true')
            )
          )
        }
      }
      if (
        name === 'is' &&
        (isComponentTag(tag) ||
          (value && value.content.startsWith('vue:')) ||
          false)
      ) {
        continue
      }
      properties.push(
        createObjectProperty(
          createSimpleExpression(
            name,
            true,
            getInnerRange(loc, 0, name.length)
          ),
          createSimpleExpression(
            value ? value.content : '',
            isStatic,
            value ? value.loc : loc
          )
        )
      )
    } else {
      const { name, arg, exp, loc } = prop
      const isVBind = name === 'bind'
      const isVOn = name === 'on'
      if (name === 'slot') {
        if (!isComponent) {
        }
        continue
      }
      if (name === 'once' || name === 'memo') {
        continue
      }
      if (
        name === 'is' ||
        (isVBind && isStaticArgOf(arg, 'is') && (isComponentTag(tag) || false))
      ) {
        continue
      }
      if (isVOn && ssr) {
        continue
      }
      if (
        (isVBind && isStaticArgOf(arg, 'key')) ||
        (isVOn && hasChildren && isStaticArgOf(arg, 'vue:before-update'))
      ) {
        shouldUseBlock = true
      }
      if (isVBind && isStaticArgOf(arg, 'ref') && context.scopes.vFor > 0) {
        properties.push(
          createObjectProperty(
            createSimpleExpression('ref_for', true),
            createSimpleExpression('true')
          )
        )
      }
      if (!arg && (isVBind || isVOn)) {
        hasDynamicKeys = true
        if (exp) {
          if (properties.length) {
            mergeArgs.push(
              createObjectExpression(dedupeProperties(properties), elementLoc)
            )
            properties = []
          }
          if (isVBind) {
            mergeArgs.push(exp)
          } else {
            mergeArgs.push({
              type: 14,
              loc,
              callee: context.helper(TO_HANDLERS),
              arguments: [exp]
            })
          }
        } else {
        }
        continue
      }
      const directiveTransform = context.directiveTransforms[name]
      if (directiveTransform) {
        const { props, needRuntime } = directiveTransform(prop, node, context)
        !ssr && props.forEach(analyzePatchFlag)
        properties.push(...props)
        if (needRuntime) {
          runtimeDirectives.push(prop)
          if (isSymbol(needRuntime)) {
            directiveImportMap.set(prop, needRuntime)
          }
        }
      } else if (!isBuiltInDirective(name)) {
        runtimeDirectives.push(prop)
        if (hasChildren) {
          shouldUseBlock = true
        }
      }
    }
  }
  let propsExpression = undefined
  if (mergeArgs.length) {
    if (properties.length) {
      mergeArgs.push(
        createObjectExpression(dedupeProperties(properties), elementLoc)
      )
    }
    if (mergeArgs.length > 1) {
      propsExpression = createCallExpression(
        context.helper(MERGE_PROPS),
        mergeArgs,
        elementLoc
      )
    } else {
      propsExpression = mergeArgs[0]
    }
  } else if (properties.length) {
    propsExpression = createObjectExpression(
      dedupeProperties(properties),
      elementLoc
    )
  }
  if (hasDynamicKeys) {
    patchFlag |= 16
  } else {
    if (hasClassBinding && !isComponent) {
      patchFlag |= 2
    }
    if (hasStyleBinding && !isComponent) {
      patchFlag |= 4
    }
    if (dynamicPropNames.length) {
      patchFlag |= 8
    }
    if (hasHydrationEventBinding) {
      patchFlag |= 32
    }
  }
  if (
    !shouldUseBlock &&
    (patchFlag === 0 || patchFlag === 32) &&
    (hasRef || hasVnodeHook || runtimeDirectives.length > 0)
  ) {
    patchFlag |= 512
  }
  if (!context.inSSR && propsExpression) {
    switch (propsExpression.type) {
      case 15:
        let classKeyIndex = -1
        let styleKeyIndex = -1
        let hasDynamicKey = false
        for (let i = 0; i < propsExpression.properties.length; i++) {
          const key = propsExpression.properties[i].key
          if (isStaticExp(key)) {
            if (key.content === 'class') {
              classKeyIndex = i
            } else if (key.content === 'style') {
              styleKeyIndex = i
            }
          } else if (!key.isHandlerKey) {
            hasDynamicKey = true
          }
        }
        const classProp = propsExpression.properties[classKeyIndex]
        const styleProp = propsExpression.properties[styleKeyIndex]
        if (!hasDynamicKey) {
          if (classProp && !isStaticExp(classProp.value)) {
            classProp.value = createCallExpression(
              context.helper(NORMALIZE_CLASS),
              [classProp.value]
            )
          }
          if (
            styleProp &&
            !isStaticExp(styleProp.value) &&
            (hasStyleBinding || styleProp.value.type === 17)
          ) {
            styleProp.value = createCallExpression(
              context.helper(NORMALIZE_STYLE),
              [styleProp.value]
            )
          }
        } else {
          propsExpression = createCallExpression(
            context.helper(NORMALIZE_PROPS),
            [propsExpression]
          )
        }
        break
      case 14:
        break
      default:
        propsExpression = createCallExpression(
          context.helper(NORMALIZE_PROPS),
          [
            createCallExpression(context.helper(GUARD_REACTIVE_PROPS), [
              propsExpression
            ])
          ]
        )
        break
    }
  }
  return {
    props: propsExpression,
    directives: runtimeDirectives,
    patchFlag,
    dynamicPropNames,
    shouldUseBlock
  }
}
function dedupeProperties (properties) {
  const knownProps = new Map()
  const deduped = []
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i]
    if (prop.key.type === 8 || !prop.key.isStatic) {
      deduped.push(prop)
      continue
    }
    const name = prop.key.content
    const existing = knownProps.get(name)
    if (existing) {
      if (name === 'style' || name === 'class' || isOn(name)) {
        mergeAsArray$1(existing, prop)
      }
    } else {
      knownProps.set(name, prop)
      deduped.push(prop)
    }
  }
  return deduped
}
function mergeAsArray$1 (existing, incoming) {
  if (existing.value.type === 17) {
    existing.value.elements.push(incoming.value)
  } else {
    existing.value = createArrayExpression(
      [existing.value, incoming.value],
      existing.loc
    )
  }
}
function buildDirectiveArgs (dir, context) {
  const dirArgs = []
  const runtime = directiveImportMap.get(dir)
  if (runtime) {
    dirArgs.push(context.helperString(runtime))
  } else {
    {
      context.helper(RESOLVE_DIRECTIVE)
      context.directives.add(dir.name)
      dirArgs.push(toValidAssetId(dir.name, `directive`))
    }
  }
  const { loc } = dir
  if (dir.exp) dirArgs.push(dir.exp)
  if (dir.arg) {
    if (!dir.exp) {
      dirArgs.push(`void 0`)
    }
    dirArgs.push(dir.arg)
  }
  if (Object.keys(dir.modifiers).length) {
    if (!dir.arg) {
      if (!dir.exp) {
        dirArgs.push(`void 0`)
      }
      dirArgs.push(`void 0`)
    }
    const trueExpression = createSimpleExpression(`true`, false, loc)
    dirArgs.push(
      createObjectExpression(
        dir.modifiers.map(modifier =>
          createObjectProperty(modifier, trueExpression)
        ),
        loc
      )
    )
  }
  return createArrayExpression(dirArgs, dir.loc)
}
function stringifyDynamicPropNames (props) {
  let propsNamesString = `[`
  for (let i = 0, l = props.length; i < l; i++) {
    propsNamesString += JSON.stringify(props[i])
    if (i < l - 1) propsNamesString += ', '
  }
  return propsNamesString + `]`
}
function isComponentTag (tag) {
  return tag === 'component' || tag === 'Component'
}
