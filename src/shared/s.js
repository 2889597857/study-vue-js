export const ShapeFlags = {
  ELEMENT: 1,
  FUNCTIONAL_COMPONENT: 1 << 1,
  STATEFUL_COMPONENT: 1 << 2,
  TEXT_CHILDREN: 1 << 3,
  ARRAY_CHILDREN: 1 << 4,
  SLOTS_CHILDREN: 1 << 5,
  TELEPORT: 1 << 6,
  SUSPENSE: 1 << 7,
  COMPONENT_SHOULD_KEEP_ALIVE: 1 << 8,
  COMPONENT_KEPT_ALIVE: 1 << 9,
  COMPONENT
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
