import { makeMap, isVoidTag, isHTMLTag, isSVGTag } from '../shared/index.js'
import { decodeHtmlBrowser } from './decodeHtmlBrowser.js'
import { isBuiltInType } from '../compiler-core/utils.js'
import { TRANSITION } from './runtimeHelpers.js'
const isRawTextContainer = /*#__PURE__*/ makeMap(
  'style,iframe,script,noscript',
  true
)
export const parserOptions = {
  isVoidTag,
  isNativeTag: tag => isHTMLTag(tag) || isSVGTag(tag),
  isPreTag: tag => tag === 'pre',
  decodeEntities: decodeHtmlBrowser,
  isBuiltInComponent: tag => {
    if (isBuiltInType(tag, `Transition`)) {
      return TRANSITION
    } else if (isBuiltInType(tag, `TransitionGroup`)) {
      return TRANSITION_GROUP
    }
  },
  getNamespace (tag, parent) {
    let ns = parent ? parent.ns : 0
    if (parent && ns === 2) {
      if (parent.tag === 'annotation-xml') {
        if (tag === 'svg') {
          return 1
        }
        if (
          parent.props.some(
            a =>
              a.type === 6 &&
              a.name === 'encoding' &&
              a.value != null &&
              (a.value.content === 'text/html' ||
                a.value.content === 'application/xhtml+xml')
          )
        ) {
          ns = 0
        }
      } else if (
        /^m(?:[ions]|text)$/.test(parent.tag) &&
        tag !== 'mglyph' &&
        tag !== 'malignmark'
      ) {
        ns = 0
      }
    } else if (parent && ns === 1) {
      if (
        parent.tag === 'foreignObject' ||
        parent.tag === 'desc' ||
        parent.tag === 'title'
      ) {
        ns = 0
      }
    }
    if (ns === 0) {
      if (tag === 'svg') {
        return 1
      }
      if (tag === 'math') {
        return 2
      }
    }
    return ns
  },
  getTextMode ({ tag, ns }) {
    if (ns === 0) {
      if (tag === 'textarea' || tag === 'title') {
        return 1
      }
      if (isRawTextContainer(tag)) {
        return 2
      }
    }
    return 0
  }
}
