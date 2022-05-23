const doc = typeof document !== 'undefined' ? document : null
const svgNS = 'http://www.w3.org/2000/svg'

export const nodeOps = {
  /**
   * 插入节点
   * @param {*} child
   * @param {*} parent
   * @param {*} anchor
   */
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null)
  },
  /**
   * 删除节点
   * @param {Element} child
   */
  remove: child => {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },
  /**
   * 创建标签
   * @param {String} tag 标签名称
   * @param {Boolean} isSVG 是否是SVG
   * @param {Object} is
   * @param {Object} props
   * @returns
   */
  createElement: (tag, isSVG, is, props) => {
    const el = isSVG
      ? doc.createElementNS(svgNS, tag)
      : doc.createElement(tag, is ? { is } : undefined)
    // select 是否可以多选
    if (tag === 'select' && props && props.multiple != null) {
      el.setAttribute('multiple', props.multiple)
    }
    return el
  },
  /**
   * 创建文本节点
   * @param {*} text
   * @returns
   */
  createText: text => doc.createTextNode(text),
  createComment: text => doc.createComment(text),
  setText: (node, text) => {
    node.nodeValue = text
  },
  setElementText: (el, text) => {
    el.textContent = text
  },
  parentNode: node => node.parentNode,
  nextSibling: node => node.nextSibling,
  querySelector: selector => doc.querySelector(selector),
  setScopeId (el, id) {
    el.setAttribute(id, '')
  },
  cloneNode (el) {
    const cloned = el.cloneNode(true)

    if (`_value` in el) {
      cloned._value = el._value
    }
    return cloned
  },

  insertStaticContent (content, parent, anchor, isSVG) {
    // <parent> before | first ... last | anchor </parent>
    const before = anchor ? anchor.previousSibling : parent.lastChild
    let template = staticTemplateCache.get(content)
    if (!template) {
      const t = doc.createElement('template')
      t.innerHTML = isSVG ? `<svg>${content}</svg>` : content
      template = t.content
      if (isSVG) {
        // remove outer svg wrapper
        const wrapper = template.firstChild
        while (wrapper.firstChild) {
          template.appendChild(wrapper.firstChild)
        }
        template.removeChild(wrapper)
      }
      staticTemplateCache.set(content, template)
    }
    parent.insertBefore(template.cloneNode(true), anchor)
    return [
      // first
      before ? before.nextSibling : parent.firstChild,
      // last
      anchor ? anchor.previousSibling : parent.lastChild
    ]
  }
}
