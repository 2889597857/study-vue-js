const blockStack = [];
let currentBlock = null;

let getNumber = () => `${blockStack.length}}`;

function openBlock(disableTracking = false) {
  blockStack.push((currentBlock = disableTracking ? null : []));
}

function closeBlock() {
  blockStack.pop();
  currentBlock = blockStack.at(-1) || null;
}

function createElementBlock(vnode = {}) {
  vnode.dynamicChildren = currentBlock;
  closeBlock();
  if (currentBlock) {
    currentBlock.push(vnode);
  }
  return vnode;
}

function createElementVNode(type) {
  return {
    type: type
      ? `特殊的动态节点${getNumber()}`
      : `普通的动态节点${getNumber()}`,
  };
}

function createDynamicNode() {
  if (!currentBlock) openBlock();
  const vnode = createElementVNode(false);
  currentBlock.push(vnode);
  return vnode;
}

function createSpecialNode(fn) {
  openBlock();
  const vnode = createElementVNode(true);
  currentBlock.push(createDynamicNode());
  if (fn) fn();
  createElementBlock(vnode);
}

// 创建 Block
openBlock();

// 普通的动态节点
createDynamicNode();

// 特殊的动态节点(Block)
createSpecialNode();

// 普通的动态节点
createDynamicNode();

console.log(createElementBlock());
