// export
 const ShapeFlags = {
  ELEMENT: 1, // 1 表示一个普通的HTML元素
  FUNCTIONAL_COMPONENT: 1 << 1,// 2 函数式组件
  STATEFUL_COMPONENT: 1 << 2,// 4 有状态组件
  TEXT_CHILDREN: 1 << 3, // 8 子节点是文本
  ARRAY_CHILDREN: 1 << 4,// 16 子节点是数组
  SLOTS_CHILDREN: 1 << 5,// 32 子节点是插槽
  TELEPORT: 1 << 6, // 64 表示vnode描述的是个teleport组件
  SUSPENSE: 1 << 7, // 128 表示vnode描述的是个suspense组件
  COMPONENT_SHOULD_KEEP_ALIVE: 1 << 8, // 256 表示需要被keep-live的有状态组件
  COMPONENT_KEPT_ALIVE: 1 << 9,// 512 已经被keep-live的有状态组件
  COMPONENT: 1 << 1 | 1 << 2// 6 组件，有状态组件和函数式组件的统称
}

COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT

ReactiveFlags = {
  skip: '__v_skip' /* 跳过，不对target做响应式处理 */,
  isReactive: '__v_isReactive' /* target是响应式的 */,
  isReadonly: '__v_isReadonly' /* target是只读的 */,
  raw: '__v_raw' /* target对应的原始数据源，未经过响应式代理 */,
  reactive: '__v_reactive' /* target经过响应式代理后的数据源 */,
  readonly: '__v_readonly' /* target经过响应式代理后的只读数据源 */
}

PatchFlags = {
  // 表示vnode具有动态textContent的元素
  TEXT : 1, // 1
  // 表示vnode具有动态的class
  CLASS : 1 << 1,// 2
  // 表示具有动态的style
  STYLE : 1 << 2,// 4
  // 表示具有动态的非class和style的props
  PROPS : 1 << 3,// 8
  // 表示props具有动态的key，与CLASS、STYLE、PROPS冲突
  FULL_PROPS : 1 << 4,// 16
  // 表示有监听事件(在同构期间需要添加)
  HYDRATE_EVENTS : 1 << 5,// 32
  // 表示vnode是个children顺序不会改变的fragment
  STABLE_FRAGMENT : 1 << 6,// 64
  // 表示children带有key的fragment
  KEYED_FRAGMENT : 1 << 7,// 128
  // 表示children没有key的fragment
  UNKEYED_FRAGMENT : 1 << 8,// 256
  // 表示vnode只需要非props的patch。例如只有标签中只有ref或指令
  NEED_PATCH : 1 << 9,
  // 表示vnode存在动态的插槽。例如动态的插槽名
  DYNAMIC_SLOTS : 1 << 10,
  // 表示用户在模板的根级别存在注释而创建的片段，这是一个仅用于开发的标志，因为注释在生产中被剥离
  DEV_ROOT_FRAGMENT : 1 << 11,
  
  // 以下都是一些特殊的flag，它们不能使用位运算进行匹配
  // 表示vnode经过静态提升
  HOISTED : -1,
  // diff算法应该退出优化模式
  BAIL : -2
}