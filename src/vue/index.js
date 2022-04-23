import { registerRuntimeCompiler } from '../runtime-core/index.js'
import { isString, extend } from '../shared/index.js'
import { compile } from '../compiler-dom/index.js'
import * as runtimeDom from '../runtime-dom/index.js'

const compileCache = Object.create(null)

function compileToFunction (template, options) {
  if (!isString(template)) {
    if (template.nodeType) {
      template = template.innerHTML
    }
  }
  const key = template
  const cached = compileCache[key]
  if (cached) {
    return cached
  }
  if (template[0] === '#') {
    const el = document.querySelector(template)
    template = el ? el.innerHTML : ``
  }
  const { code } = compile(template, extend({ hoistStatic: true }, options))

  const render = new Function('Vue', code)(runtimeDom)

  render._rc = true
  return (compileCache[key] = render)
}

registerRuntimeCompiler(compileToFunction)
export { compileToFunction as compile }
