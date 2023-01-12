import { extend, isString } from '../shared/index.js'
import { generate } from './codegen.js'
import { baseParse } from './parse.js'
import { transform } from './transform.js'
import { transformElement } from './transforms/transformElement.js'
import { transformExpression } from './transforms/transformExpression.js'
import { transformSlotOutlet } from './transforms/transformSlotOutlet.js'
import { transformText } from './transforms/transformText.js'
import { transformBind } from './transforms/vBind.js'
import { transformFor } from './transforms/vFor.js'
import { transformIf } from './transforms/vIf.js'
import { transformMemo } from './transforms/vMemo.js'
import { transformModel } from './transforms/vModel.js'
import { transformOn } from './transforms/vOn.js'
import { transformOnce } from './transforms/vOnce.js'
import { trackSlotScopes } from './transforms/vSlot.js'

export function getBaseTransformPreset (prefixIdentifiers) {
  return [
    [
      transformOnce,
      transformIf,
      transformMemo,
      transformFor,
      ...[],
      ...[transformExpression],
      transformSlotOutlet,
      transformElement,
      trackSlotScopes,
      transformText
    ],
    { on: transformOn, bind: transformBind, model: transformModel }
  ]
}
export function baseCompile (template, options = {}) {
  const prefixIdentifiers = !true

  const ast = isString(template) ? baseParse(template, options) : template
  console.log(ast);
  const [nodeTransforms, directiveTransforms] = getBaseTransformPreset()
  transform(
    ast,
    extend({}, options, {
      prefixIdentifiers,
      nodeTransforms: [...nodeTransforms, ...(options.nodeTransforms || [])],
      directiveTransforms: extend(
        {},
        directiveTransforms,
        options.directiveTransforms || {}
      )
    })
  )
  return generate(ast, extend({}, options, { prefixIdentifiers }))
}
