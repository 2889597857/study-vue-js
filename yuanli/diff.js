function diff(node1, node2) {
  // 如果节点类型不同，直接替换
  if (node1.type !== node2.type) {
    return node2;
  }

  // 如果节点是文本节点并且内容不同，直接替换
  if (node1.type === 'text' && node1.content !== node2.content) {
    return node2;
  }

  // 如果节点的属性不同，更新属性
  if (node1.props !== node2.props) {
    updateProps(node1, node2);
  }

  // 比较子节点
  const patches = diffChildren(node1.children, node2.children);

  // 如果有子节点的更新，返回新节点
  if (patches.length > 0) {
    return Object.assign({}, node2, { patches });
  }

  // 否则返回旧节点
  return node1;
}

function diffChildren(children1, children2) {
  const patches = [];

  // 遍历子节点列表，比较每个节点
  children2.forEach((child2, i) => {
    const child1 = children1[i];
    const patch = diff(child1, child2);

    // 如果有节点更新，记录更新信息
    if (patch !== child1) {
      patches.push({
        type: 'UPDATE',
        index: i,
        node: patch,
      });
    }
  });

  // 如果新节点有多余的子节点，删除这些节点
  if (children2.length < children1.length) {
    patches.push({
      type: 'REMOVE',
      index: children2.length,
      count: children1.length - children2.length,
    });
  }

  // 如果新节点有缺失的子节点，添加这些节点
  if (children2.length > children1.length) {
    patches.push({
      type: 'ADD',
      index: children1.length,
      nodes: children2.slice(children1.length),
    });
  }

  return patches;
}

function updateProps(node1, node2) {
  const props1 = node1.props || {};
  const props2 = node2.props || {};

  Object.keys(props2).forEach((key) => {
    const value2 = props2[key];
    const value1 = props1[key];

    // 如果属性值不同，更新属性
    if (value1 !== value2) {
      node1.dom.setAttribute(key, value2);
    }
  });

  Object.keys(props1).forEach((key) => {
    if (!(key in props2)) {
      node1.dom.removeAttribute(key);
    }
  });
}


// Vue3 的编译器和 Vue2 有所不同，它采用了基于静态分析的编译方式，能够在编译阶段对模板进行优化，从而提高应用的性能。

// Vue3 的编译过程可以分为三个阶段：

// 1. 解析阶段：将模板字符串解析成 AST（抽象语法树），并进行预处理。在预处理阶段，Vue3 会对模板进行静态分析，找出其中的静态节点和动态节点，并进行标记。静态节点是指在编译期间不会发生变化的节点，如纯文本、静态属性等。动态节点是指在运行时才能确定的节点，如插值表达式、指令等。Vue3 会通过标记静态节点的方式，优化渲染过程，减少不必要的操作。

// 2. 转换阶段：将 AST 转换为可执行的代码。在转换阶段，Vue3 会根据 AST 生成一份 render 函数，该函数用于将模板渲染成 VNode（虚拟节点）树。Vue3 采用了基于模板的代码生成方式，将模板转换为一份 JS 代码，从而避免了运行时解析模板的开销。

// 3. 优化阶段：对生成的代码进行优化，进一步提高渲染性能。在优化阶段，Vue3 会对生成的 render 函数进行静态分析，找出其中的静态节点，并将其缓存起来，从而避免了重复渲染静态节点的开销。此外，Vue3 还采用了一种称为“Patch Flag”的技术，用于标记 VNode 的更新类型，从而在更新阶段能够更快地比较两个 VNode 的差异并进行更新。

// 总的来说，Vue3 的编译过程具有以下几个特点：

// 1. 静态分析：Vue3 会在编译阶段对模板进行静态分析，找出其中的静态节点和动态节点，并进行标记，从而优化渲染过程。

// 2. 基于模板的代码生成：Vue3 会将模板转换为一份 JS 代码，从而避免了运行时解析模板的开销。

// 3. 优化渲染性能：Vue3 会对生成的代码进行优化，缓存静态节点，采用 Patch Flag 技术等，从而提高渲染性能。

// 总之，Vue3 的编译器是 Vue3 的一个重要特点，它为开发者提供了更好的性能和更灵活的模板语法。