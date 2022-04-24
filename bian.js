;(function anonymous (Vue) {
  const _Vue = Vue
  const {
    createVNode: _createVNode,
    createElementVNode: _createElementVNode
  } = _Vue

  const _hoisted_1 = ['onClick']

  return function render (_ctx, _cache) {
    with (_ctx) {
      const {
        createElementVNode: _createElementVNode,
        resolveComponent: _resolveComponent,
        createVNode: _createVNode,
        resolveDynamicComponent: _resolveDynamicComponent,
        openBlock: _openBlock,
        createBlock: _createBlock,
        Fragment: _Fragment,
        createElementBlock: _createElementBlock
      } = _Vue

      const _component_button_counter = _resolveComponent('button-counter')

      return (
        _openBlock(),
        _createElementBlock(
          _Fragment,
          null,
          [
            _createElementVNode(
              'h1',
              {
                onClick: $event => changeComponent()
              },
              '父组件：App.component',
              8 /* PROPS */,
              _hoisted_1
            ),
            _createVNode(
              _component_button_counter,
              {
                style: { border: '1px solid red' },
                title: components,
                onChangeComponent: changeComponent
              },
              null,
              8 /* PROPS */,
              ['title', 'onChangeComponent']
            ),
            (_openBlock(), _createBlock(_resolveDynamicComponent(components)))
          ],
          64 /* STABLE_FRAGMENT */
        )
      )
    }
  }
})
