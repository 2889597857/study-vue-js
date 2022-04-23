import {
  transformModel as baseTransform,
  findProp,
  hasDynamicKeyVBind
} from '../../compiler-core/index.js'

import {
  V_MODEL_CHECKBOX,
  V_MODEL_RADIO,
  V_MODEL_SELECT,
  V_MODEL_TEXT,
  V_MODEL_DYNAMIC
} from '../runtimeHelpers.js'
export const transformModel = (dir, node, context) => {
  const baseResult = baseTransform(dir, node, context)
  if (!baseResult.props.length || node.tagType === 1) {
    return baseResult
  }
  if (dir.arg) {
    context.onError(createDOMCompilerError(55, dir.arg.loc))
  }
  function checkDuplicatedValue () {
    const value = findProp(node, 'value')
    if (value) {
      context.onError(createDOMCompilerError(57, value.loc))
    }
  }
  const { tag } = node
  const isCustomElement = context.isCustomElement(tag)
  if (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    isCustomElement
  ) {
    let directiveToUse = V_MODEL_TEXT
    let isInvalidType = false
    if (tag === 'input' || isCustomElement) {
      const type = findProp(node, `type`)
      if (type) {
        if (type.type === 7) {
          directiveToUse = V_MODEL_DYNAMIC
        } else if (type.value) {
          switch (type.value.content) {
            case 'radio':
              directiveToUse = V_MODEL_RADIO
              break
            case 'checkbox':
              directiveToUse = V_MODEL_CHECKBOX
              break
            case 'file':
              isInvalidType = true
              context.onError(createDOMCompilerError(56, dir.loc))
              break
            default:
              checkDuplicatedValue()
              break
          }
        }
      } else if (hasDynamicKeyVBind(node)) {
        directiveToUse = V_MODEL_DYNAMIC
      } else {
        checkDuplicatedValue()
      }
    } else if (tag === 'select') {
      directiveToUse = V_MODEL_SELECT
    } else {
      checkDuplicatedValue()
    }
    if (!isInvalidType) {
      baseResult.needRuntime = context.helper(directiveToUse)
    }
  } else {
    context.onError(createDOMCompilerError(54, dir.loc))
  }
  baseResult.props = baseResult.props.filter(
    p => !(p.key.type === 4 && p.key.content === 'modelValue')
  )
  return baseResult
}
