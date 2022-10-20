import { extend, isArray, makeMap, NO } from '../shared/index.js';
import { createRoot } from './ast.js';
import {
  advancePositionWithClone,
  advancePositionWithMutation,
  isCoreComponent,
  isStaticArgOf
} from './utils.js';

const decodeRE = /&(gt|lt|amp|apos|quot);/g;
const decodeMap = { gt: '>', lt: '<', amp: '&', apos: "'", quot: '"' };
const defaultParserOptions = {
  delimiters: [`{{`, `}}`],
  getNamespace: () => 0,
  getTextMode: () => 0,
  isVoidTag: NO,
  isPreTag: NO,
  isCustomElement: NO,
  decodeEntities: (rawText) =>
    rawText.replace(decodeRE, (_, p1) => decodeMap[p1]),
  comments: true,
};
export function baseParse(content, options = {}) {
  const context = createParserContext(content, options);
  const start = getCursor(context);
  return createRoot(
    parseChildren(context, 0, []),
    getSelection(context, start)
  );
}

function createParserContext(content, rawOptions) {
  const options = extend({}, defaultParserOptions);
  let key;
  for (key in rawOptions) {
    options[key] =
      rawOptions[key] === undefined
        ? defaultParserOptions[key]
        : rawOptions[key];
  }
  return {
    options,
    column: 1,
    line: 1,
    offset: 0,
    originalSource: content,
    source: content,
    inPre: false,
    inVPre: false,
    onWarn: options.onWarn,
  };
}
function parseChildren(context, mode, ancestors) {
  const parent = last(ancestors);
  const ns = parent ? parent.ns : 0;
  const nodes = [];
  while (!isEnd(context, mode, ancestors)) {
    const s = context.source;
    let node = undefined;
    if (mode === 0 || mode === 1) {
      // 是不是插值表达式
      if (!context.inVPre && startsWith(s, context.options.delimiters[0])) {
        // context.options.delimiters = ['{{','}}'];
        node = parseInterpolation(context, mode);
      }
      // 是否以 '<' 开头
      else if (mode === 0 && s[0] === '<') {
        if (s.length === 1) {
          emitError(context, 5, 1);
        } else if (s[1] === '!') {
          if (startsWith(s, '<!--')) {
            // 注释
            node = parseComment(context);
          } else if (startsWith(s, '<!DOCTYPE')) {
            // html
            node = parseBogusComment(context);
          } else if (startsWith(s, '<![CDATA[')) {
            // xml
            if (ns !== 0) {
              node = parseCDATA(context, ancestors);
            } else {
              emitError(context, 1);
              node = parseBogusComment(context);
            }
          } else {
            emitError(context, 11);
            node = parseBogusComment(context);
          }
        } else if (s[1] === '/') {
          if (s.length === 2) {
            emitError(context, 5, 2);
          } else if (s[2] === '>') {
            emitError(context, 14, 2);
            advanceBy(context, 3);
            continue;
          } else if (/[a-z]/i.test(s[2])) {
            emitError(context, 23);
            parseTag(context, 1, parent);
            continue;
          } else {
            emitError(context, 12, 2);
            node = parseBogusComment(context);
          }
        } else if (/[a-z]/i.test(s[1])) {
          // 字母
          node = parseElement(context, ancestors);
        } else if (s[1] === '?') {
          emitError(context, 21, 1);
          node = parseBogusComment(context);
        } else {
          emitError(context, 12, 1);
        }
      }
    }
    if (!node) {
      node = parseText(context, mode);
    }
    if (isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        pushNode(nodes, node[i]);
      }
    } else {
      pushNode(nodes, node);
    }
  }
  let removedWhitespace = false;
  if (mode !== 2 && mode !== 1) {
    const shouldCondense = context.options.whitespace !== 'preserve';
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!context.inPre && node.type === 2) {
        // 匹配非空字符开头字符
        if (!/[^\t\r\n\f ]/.test(node.content)) {
          const prev = nodes[i - 1];
          const next = nodes[i + 1];
          if (
            !prev ||
            !next ||
            (shouldCondense &&
              (prev.type === 3 ||
                next.type === 3 ||
                (prev.type === 1 &&
                  next.type === 1 &&
                  /[\r\n]/.test(node.content))))
          ) {
            removedWhitespace = true;
            nodes[i] = null;
          } else {
            node.content = ' ';
          }
        } else if (shouldCondense) {
          // 多个空格替换成一个空格
          node.content = node.content.replace(/[\t\r\n\f ]+/g, ' ');
        }
      } else if (node.type === 3 && !context.options.comments) {
        removedWhitespace = true;
        nodes[i] = null;
      }
    }
    if (context.inPre && parent && context.options.isPreTag(parent.tag)) {
      const first = nodes[0];
      if (first && first.type === 2) {
        first.content = first.content.replace(/^\r?\n/, '');
      }
    }
  }
  return removedWhitespace ? nodes.filter(Boolean) : nodes;
}
function pushNode(nodes, node) {
  if (node.type === 2) {
    const prev = last(nodes);
    if (
      prev &&
      prev.type === 2 &&
      prev.loc.end.offset === node.loc.start.offset
    ) {
      prev.content += node.content;
      prev.loc.end = node.loc.end;
      prev.loc.source += node.loc.source;
      return;
    }
  }
  nodes.push(node);
}
function parseCDATA(context, ancestors) {
  advanceBy(context, 9);
  const nodes = parseChildren(context, 3, ancestors);
  if (context.source.length === 0) {
    emitError(context, 6);
  } else {
    advanceBy(context, 3);
  }
  return nodes;
}
/**
 * 解析注释
 * @param {*} context
 * @returns
 */
function parseComment(context) {
  const start = getCursor(context);
  let content;
  const match = /--(\!)?>/.exec(context.source);
  if (!match) {
    content = context.source.slice(4);
    advanceBy(context, context.source.length);
    emitError(context, 7);
  } else {
    if (match.index <= 3) {
      emitError(context, 0);
    }
    if (match[1]) {
      emitError(context, 10);
    }
    content = context.source.slice(4, match.index);
    const s = context.source.slice(0, match.index);
    let prevIndex = 1,
      nestedIndex = 0;
    while ((nestedIndex = s.indexOf('<!--', prevIndex)) !== -1) {
      advanceBy(context, nestedIndex - prevIndex + 1);
      if (nestedIndex + 4 < s.length) {
        emitError(context, 16);
      }
      prevIndex = nestedIndex + 1;
    }
    advanceBy(context, match.index + match[0].length - prevIndex + 1);
  }
  return { type: 3, content, loc: getSelection(context, start) };
}
/**
 * 解析虚假注释 <22>
 * @param {*} context
 * @returns
 */
function parseBogusComment(context) {
  const start = getCursor(context);
  const contentStart = context.source[1] === '?' ? 1 : 2;
  let content;
  const closeIndex = context.source.indexOf('>');
  if (closeIndex === -1) {
    content = context.source.slice(contentStart);
    advanceBy(context, context.source.length);
  } else {
    content = context.source.slice(contentStart, closeIndex);
    advanceBy(context, closeIndex + 1);
  }
  return { type: 3, content, loc: getSelection(context, start) };
}
function parseElement(context, ancestors) {
  const wasInPre = context.inPre;
  const wasInVPre = context.inVPre;
  const parent = last(ancestors);
  // 解析标签及标签的属性
  const element = parseTag(context, 0, parent);
  const isPreBoundary = context.inPre && !wasInPre;
  const isVPreBoundary = context.inVPre && !wasInVPre;
  if (element.isSelfClosing || context.options.isVoidTag(element.tag)) {
    if (isPreBoundary) {
      context.inPre = false;
    }
    if (isVPreBoundary) {
      context.inVPre = false;
    }
    return element;
  }
  ancestors.push(element);
  // 更换解析模式
  const mode = context.options.getTextMode(element, parent);
  const children = parseChildren(context, mode, ancestors);
  ancestors.pop();
  element.children = children;
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, 1, parent);
  } else {
    emitError(context, 24, 0, element.loc.start);
    if (context.source.length === 0 && element.tag.toLowerCase() === 'script') {
      const first = children[0];
      if (first && startsWith(first.loc.source, '<!--')) {
        emitError(context, 8);
      }
    }
  }
  element.loc = getSelection(context, element.loc.start);
  if (isPreBoundary) {
    context.inPre = false;
  }
  if (isVPreBoundary) {
    context.inVPre = false;
  }
  return element;
}
/**
 * 特殊模板指令
 * if else else-if for slot
 */
const isSpecialTemplateDirective = makeMap(`if,else,else-if,for,slot`);
/**
 * 解析标签
 * @param {object} context
 * @param {number} type
 * @param {*} parent
 * @returns
 */
function parseTag(context, type, parent) {
  const start = getCursor(context);
  // 获取标签 div h1 ... ['<h1','h1']  
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source);
  // 标签名
  const tag = match[1];
  const ns = context.options.getNamespace(tag, parent);
  advanceBy(context, match[0].length);
  advanceSpaces(context);
  const cursor = getCursor(context);
  const currentSource = context.source;
  if (context.options.isPreTag(tag)) {
    context.inPre = true;
  }
  // 解析标签的属性
  let props = parseAttributes(context, type);
  if (
    type === 0 &&
    !context.inVPre &&
    props.some((p) => p.type === 7 && p.name === 'pre')
  ) {
    context.inVPre = true;
    extend(context, cursor);
    context.source = currentSource;
    props = parseAttributes(context, type).filter((p) => p.name !== 'v-pre');
  }
  /**
   * 是否是自闭合标签
   */
  let isSelfClosing = false;
  if (context.source.length === 0) {
    emitError(context, 9);
  } else {
    isSelfClosing = startsWith(context.source, '/>');
    if (type === 1 && isSelfClosing) {
      emitError(context, 4);
    }
    // 自闭和标签 '/>' 一般标签 '>'
    // 消费 '/>' 或 '>'
    advanceBy(context, isSelfClosing ? 2 : 1);
  }
  if (type === 1) {
    return;
  }
  let tagType = 0;
  if (!context.inVPre) {
    if (tag === 'slot') {
      tagType = 2;
    } else if (tag === 'template') {
      if (
        props.some((p) => p.type === 7 && isSpecialTemplateDirective(p.name))
      ) {
        tagType = 3;
      }
    } else if (isComponent(tag, props, context)) {
      tagType = 1;
    }
  }
  return {
    type: 1,
    ns,
    tag,
    tagType,
    props,
    isSelfClosing,
    children: [],
    loc: getSelection(context, start),
    codegenNode: undefined,
  };
}
/**
 * 是不是组件标签
 */
function isComponent(tag, props, context) {
  const options = context.options;
  if (options.isCustomElement(tag)) {
    return false;
  }
  if (
    tag === 'component' ||
    /^[A-Z]/.test(tag) ||
    isCoreComponent(tag) ||
    // 是不是 'Transition' or 'TransitionGroup'
    (options.isBuiltInComponent && options.isBuiltInComponent(tag)) ||
    // 是不是 html 标签 或 SVG 标签
    (options.isNativeTag && !options.isNativeTag(tag))
  ) {
    return true;
  }
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.type === 6) {
      // 属性
      //  <component :is="components" />
      if (p.name === 'is' && p.value) {
        if (p.value.content.startsWith('vue:')) {
          return true;
        }
      }
    } else {
      // 指令
      if (p.name === 'is') {
        return true;
      } else if (p.name === 'bind' && isStaticArgOf(p.arg, 'is') && false) {
        return true;
      }
    }
  }
}
/**
 * 解析标签的属性
 * @param {object} context
 * @param {number} type
 * @returns
 */
function parseAttributes(context, type) {
  const props = [];
  const attributeNames = new Set();
  // 循环解析每个 prop , 直到字符串结束或标签闭合处 '>'  '/>'
  while (
    context.source.length > 0 &&
    !startsWith(context.source, '>') &&
    !startsWith(context.source, '/>')
  ) {
    if (startsWith(context.source, '/')) {
      emitError(context, 22);
      advanceBy(context, 1);
      advanceSpaces(context);
      continue;
    }
    if (type === 1) {
      emitError(context, 3);
    }
    const attr = parseAttribute(context, attributeNames);
    if (attr.type === 6 && attr.value && attr.name === 'class') {
      // 一个空白替换多个空白
      attr.value.content = attr.value.content.replace(/\s+/g, ' ').trim();
    }
    if (type === 0) {
      props.push(attr);
    }
    if (/^[^\t\r\n\f />]/.test(context.source)) {
      emitError(context, 15);
    }
    // 删除空格
    advanceSpaces(context);
  }
  return props;
}
function parseAttribute(context, nameSet) {
  const start = getCursor(context);
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
  /**
   * 属性名
   */
  const name = match[0];
  if (nameSet.has(name)) {
    emitError(context, 2);
  }
  nameSet.add(name);
  if (name[0] === '=') {
    emitError(context, 19);
  }
  {
    const pattern = /["'<]/g;
    let m;
    // 属性名有 " 、' 或 <
    while ((m = pattern.exec(name))) {
      emitError(context, 17, m.index);
    }
  }
  advanceBy(context, name.length);
  /**
   * 属性值
   */
  let value = undefined;
  // 匹配任意数量空白字符 + "="
  if (/^[\t\r\n\f ]*=/.test(context.source)) {
    // 消费空白字符
    advanceSpaces(context);
    // 消费 "="
    advanceBy(context, 1);
    // 消费空白字符
    advanceSpaces(context);
    // 获取属性值
    value = parseAttributeValue(context);
    if (!value) {
      emitError(context, 13);
    }
  }
  /**
   * ref = "h1"
   * :title = "title"
   * 完整的prop
   * loc.source
   */
  const loc = getSelection(context, start);
  // 处理特殊属性 指令 v- 属性绑定 :
  if (!context.inVPre && /^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
    const match =
      /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(
        name
      );
    let isPropShorthand = startsWith(name, '.');
    // 判断属性类型
    // bind on slot
    let dirName =
      match[1] ||
      (isPropShorthand || startsWith(name, ':')
        ? 'bind'
        : startsWith(name, '@')
        ? 'on'
        : 'slot');
    let arg;
    if (match[2]) {
      const isSlot = dirName === 'slot';
      // @click
      const startOffset = name.lastIndexOf(match[2]);
      const loc = getSelection(
        context,
        getNewPosition(context, start, startOffset),
        getNewPosition(
          context,
          start,
          startOffset + match[2].length + ((isSlot && match[3]) || '').length
        )
      );
      let content = match[2];
      let isStatic = true;
      if (content.startsWith('[')) {
        isStatic = false;
        if (!content.endsWith(']')) {
          emitError(context, 27);
          content = content.slice(1);
        } else {
          content = content.slice(1, content.length - 1);
        }
      } else if (isSlot) {
        content += match[3] || '';
      }
      arg = { type: 4, content, isStatic, constType: isStatic ? 3 : 0, loc };
    }
    if (value && value.isQuoted) {
      const valueLoc = value.loc;
      valueLoc.start.offset++;
      valueLoc.start.column++;
      valueLoc.end = advancePositionWithClone(valueLoc.start, value.content);
      valueLoc.source = valueLoc.source.slice(1, -1);
    }
    const modifiers = match[3] ? match[3].slice(1).split('.') : [];
    if (isPropShorthand) modifiers.push('prop');
    return {
      type: 7,
      name: dirName,
      exp: value && {
        type: 4,
        content: value.content,
        isStatic: false,
        constType: 0,
        loc: value.loc,
      },
      arg,
      modifiers,
      loc,
    };
  }
  if (!context.inVPre && startsWith(name, 'v-')) {
    emitError(context, 26);
  }
  return {
    type: 6,
    name,
    value: value && { type: 2, content: value.content, loc: value.loc },
    loc,
  };
}
/**
 * 属性值
 * @param {*} context
 * @returns
 */
function parseAttributeValue(context) {
  const start = getCursor(context);
  let content;
  const quote = context.source[0];
  const isQuoted = quote === `"` || quote === `'`;
  // 属性值是否被引号引用
  if (isQuoted) {
    // 删除第一个引号
    advanceBy(context, 1);
    // 寻找第二个引号位置
    const endIndex = context.source.indexOf(quote);
    if (endIndex === -1) {
      content = parseTextData(context, context.source.length, 4);
    } else {
      // 获取属性值
      content = parseTextData(context, endIndex, 4);
      // 删除第二个引号
      advanceBy(context, 1);
    }
  } else {
    const match = /^[^\t\r\n\f >]+/.exec(context.source);
    if (!match) {
      return undefined;
    }
    const unexpectedChars = /["'<=`]/g;
    let m;
    while ((m = unexpectedChars.exec(match[0]))) {
      emitError(context, 18, m.index);
    }
    content = parseTextData(context, match[0].length, 4);
  }
  return { content, isQuoted, loc: getSelection(context, start) };
}
/**
 *
 * @param {object} context
 * @param {number} mode
 * @returns
 */
function parseInterpolation(context, mode) {
  //  ['{{','}}']
  const [open, close] = context.options.delimiters;
  const closeIndex = context.source.indexOf(close, open.length);
  if (closeIndex === -1) {
    emitError(context, 25);
    return undefined;
  }
  const start = getCursor(context);
  advanceBy(context, open.length);
  const innerStart = getCursor(context);
  const innerEnd = getCursor(context);
  const rawContentLength = closeIndex - open.length;
  const rawContent = context.source.slice(0, rawContentLength);
  const preTrimContent = parseTextData(context, rawContentLength, mode);
  const content = preTrimContent.trim();
  const startOffset = preTrimContent.indexOf(content);
  if (startOffset > 0) {
    advancePositionWithMutation(innerStart, rawContent, startOffset);
  }
  const endOffset =
    rawContentLength - (preTrimContent.length - content.length - startOffset);
  advancePositionWithMutation(innerEnd, rawContent, endOffset);
  advanceBy(context, close.length);
  return {
    type: 5,
    content: {
      type: 4,
      isStatic: false,
      constType: 0,
      content,
      loc: getSelection(context, innerStart, innerEnd),
    },
    loc: getSelection(context, start),
  };
}
/**
 * 找到 ']]>' '<' '{{' 位置，
 * 对位置前的字符串进行处理并返回
 * @param {*} context
 * @param {*} mode
 * @returns
 */
function parseText(context, mode) {
  // endTokens 为 [']]>'] or ['<','{{']
  const endTokens = mode === 3 ? [']]>'] : ['<', context.options.delimiters[0]];
  // context.source 为模板字符串
  let endIndex = context.source.length;
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1);
    if (index !== -1 && endIndex > index) {
      // 找到字符，并且字符串长度大于字符出现的位置
      endIndex = index;
    }
  }
  const start = getCursor(context);
  const content = parseTextData(context, endIndex, mode);
  return { type: 2, content, loc: getSelection(context, start) };
}
/**
 * 处理文本
 * @param {*} context
 * @param {*} length
 * @param {*} mode
 * @returns
 */
function parseTextData(context, length, mode) {
  const rawText = context.source.slice(0, length);
  advanceBy(context, length);
  if (mode === 2 || mode === 3 || !rawText.includes('&')) {
    return rawText;
  } else {
    return context.options.decodeEntities(rawText, mode === 4);
  }
}
function getCursor(context) {
  const { column, line, offset } = context;
  return { column, line, offset };
}
function getSelection(context, start, end) {
  end = end || getCursor(context);
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset),
  };
}
/**
 * 返回数组最后一项
 * @param {array} xs
 * @returns
 */
function last(xs) {
  return xs[xs.length - 1];
}
/**
 *
 * @param {string} source
 * @param {string} searchString
 * @returns
 */
function startsWith(source, searchString) {
  return source.startsWith(searchString);
}
/**
 * 消费指定长度的字符串
 * @param {object} context 模板
 * @param {number} numberOfCharacters 消费的字符长度
 */
function advanceBy(context, numberOfCharacters) {
  const { source } = context;
  // 寻找 numberOfCharacters 位置前的换行符，更新 offset line column
  advancePositionWithMutation(context, source, numberOfCharacters);
  // 删除 numberOfCharacters 之前字符
  context.source = source.slice(numberOfCharacters);
}
/**
 * 消费空白字符串
 * @param {*} context
 */
function advanceSpaces(context) {
  const match = /^[\t\r\n\f ]+/.exec(context.source);
  if (match) {
    advanceBy(context, match[0].length);
  }
}
/**
 * 获取新字符串裁切位置
 * @param {*} context
 * @param {*} start
 * @param {*} numberOfCharacters
 * @returns
 */
function getNewPosition(context, start, numberOfCharacters) {
  return advancePositionWithClone(
    start,
    context.originalSource.slice(start.offset, numberOfCharacters),
    numberOfCharacters
  );
}
function emitError(context, code, offset, loc = getCursor(context)) {
  if (offset) {
    loc.offset += offset;
    loc.column += offset;
  }
}
/**
 * 判断是结束标签
 * @param {*} context
 * @param {*} mode
 * @param {*} ancestors
 * @returns
 */
function isEnd(context, mode, ancestors) {
  const s = context.source;
  switch (mode) {
    case 0:
      if (startsWith(s, '</')) {
        for (let i = ancestors.length - 1; i >= 0; --i) {
          // 祖先中有相同标签
          if (startsWithEndTagOpen(s, ancestors[i].tag)) {
            return true;
          }
        }
      }
      break;
    case 1:
    case 2: {
      const parent = last(ancestors);
      if (parent && startsWithEndTagOpen(s, parent.tag)) {
        return true;
      }
      break;
    }
    case 3:
      if (startsWith(s, ']]>')) {
        return true;
      }
      break;
  }
  return !s;
}
function startsWithEndTagOpen(source, tag) {
  return (
    startsWith(source, '</') &&
    // 祖先中有相同标签
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    //  </ + 标签 后的字符为 空字符 或 / 或 >
    /[\t\r\n\f />]/.test(source[2 + tag.length] || '>')
  );
}
