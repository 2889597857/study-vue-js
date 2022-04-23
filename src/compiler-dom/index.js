import {
    baseCompile,
    baseParse,
    noopDirectiveTransform,
} from '../compiler-core/index.js';
import { extend } from '../shared/index.js';
import { parserOptions } from './parserOptions.js';
import { ignoreSideEffectTags } from './transforms/ignoreSideEffectTags.js'
import { transformStyle } from './transforms/transformStyle.js'
import { transformVHtml } from './transforms/vHtml.js'
import { transformVText } from './transforms/vText.js'
import { transformModel } from './transforms/vModel.js'
import { transformOn } from './transforms/vOn.js'
import { transformShow } from './transforms/vShow.js'


export const DOMNodeTransforms = [transformStyle]
export const DOMDirectiveTransforms = {
    cloak: noopDirectiveTransform,
    html: transformVHtml,
    text: transformVText,
    model: transformModel,
    on: transformOn,
    show: transformShow
}

export function compile(template, options = {}) {
    return baseCompile(
        template,
        extend({}, parserOptions, options, {
            nodeTransforms: [
                ignoreSideEffectTags,
                ...DOMNodeTransforms,
                ...(options.nodeTransforms || [])
            ],
            directiveTransforms: extend(
                {},
                DOMDirectiveTransforms,
                options.directiveTransforms || {}
            ),
            transformHoist: null
        })
    )
}