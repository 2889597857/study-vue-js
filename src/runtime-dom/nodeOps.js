const doc = typeof document !== 'undefined' ? document : null;
const svgNS = 'http://www.w3.org/2000/svg';

export const nodeOps = {
  /**
   * 插入节点
   * @param {*} child
   * @param {*} parent
   * @param {*} anchor
   */
  insert: (child, parent, anchor) => {
    parent.insertBefore(child, anchor || null);
  },
  /**
   * 删除节点
   * @param {Element} child
   */
  remove: (child) => {
    const parent = child.parentNode;
    if (parent) {
      parent.removeChild(child);
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
      : doc.createElement(tag, is ? { is } : undefined);
    // select 是否可以多选
    if (tag === 'select' && props && props.multiple != null) {
      el.setAttribute('multiple', props.multiple);
    }
    return el;
  },
  /**
   * 创建文本节点
   * @param {*} text
   * @returns
   */
  createText: (text) => doc.createTextNode(text),
  /**
   * 创建注释节点
   * @param {*} text
   * @returns
   */
  createComment: (text) => doc.createComment(text),
 /**
   * 设置文本节点的文字
   * @param {*} text
   * @returns
   */
  setText: (node, text) => {
    node.nodeValue = text;
  },
  setElementText: (el, text) => {
    el.textContent = text;
  },
  /** 父节点 */
  parentNode: (node) => node.parentNode,
  /** 下一个兄弟节点，如果改节点为最后一个节点，返回 null */
  nextSibling: (node) => node.nextSibling,
  /** 选择元素 */
  querySelector: (selector) => doc.querySelector(selector),
  /** 设置 css ScopeId */
  setScopeId(el, id) {
    el.setAttribute(id, '');
  },
  /** 克隆节点 */
  cloneNode(el) {
    const cloned = el.cloneNode(true);

    if (`_value` in el) {
      cloned._value = el._value;
    }
    return cloned;
  },

  insertStaticContent(content, parent, anchor, isSVG, start, end) {
    // <parent> before | first ... last | anchor </parent>
    const before = anchor ? anchor.previousSibling : parent.lastChild
    // #5308 can only take cached path if:
    // - has a single root node
    // - nextSibling info is still available
    if (start && (start === end || start.nextSibling)) {
      // cached
      while (true) {
        parent.insertBefore(start.cloneNode(true), anchor)
        if (start === end || !(start = start.nextSibling)) break
      }
    } else {
      // fresh insert
      templateContainer.innerHTML = isSVG ? `<svg>${content}</svg>` : content
      const template = templateContainer.content
      if (isSVG) {
        // remove outer svg wrapper
        const wrapper = template.firstChild
        while (wrapper.firstChild) {
          template.appendChild(wrapper.firstChild)
        }
        template.removeChild(wrapper)
      }
      parent.insertBefore(template, anchor)
    }
    return [
      // first
      before ? before.nextSibling : parent.firstChild,
      // last
      anchor ? anchor.previousSibling : parent.lastChild
    ]
  }
};
