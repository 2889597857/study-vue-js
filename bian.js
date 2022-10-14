(function anonymous(Vue) {
  const _Vue = Vue;
  const { createVNode: _createVNode, createElementVNode: _createElementVNode } =
    _Vue;

  const _hoisted_1 = ['onClick'];
  const _hoisted_2 = { style: { border: '1px solid red' } };
  const _hoisted_3 = /*#__PURE__*/ _createElementVNode(
    'h1',
    null,
    '动态组件 component',
    -1 /* HOISTED */
  );

  return function render(_ctx, _cache) {
    with (_ctx) {
      const {
        createElementVNode: _createElementVNode,
        resolveComponent: _resolveComponent,
        normalizeStyle: _normalizeStyle,
        createVNode: _createVNode,
        resolveDynamicComponent: _resolveDynamicComponent,
        openBlock: _openBlock,
        createBlock: _createBlock,
        Fragment: _Fragment,
        createElementBlock: _createElementBlock,
      } = _Vue;

      const _component_button_counter = _resolveComponent('button-counter');
      const _component_component_c = _resolveComponent('component-c');

      return (
        _openBlock(),
        _createElementBlock(
          _Fragment,
          null,
          [
            _createElementVNode(
              'h1',
              {
                ref: 'h1',
                onClick: ($event) => changeComponent(),
              },
              '父组件：App.component',
              8 /* PROPS */,
              _hoisted_1
            ),
            _createVNode(
              _component_button_counter,
              {
                class: 'fade-enter-activ',
                style: _normalizeStyle({
                  border: '1px solid yellow',
                  color: textColor,
                }),
                title: components,
                onChangeComponent: changeComponent,
              },
              null,
              8 /* PROPS */,
              ['style', 'title', 'onChangeComponent']
            ),
            _createVNode(_component_component_c),
            _createElementVNode('div', _hoisted_2, [
              _hoisted_3,
              (_openBlock(),
              _createBlock(_resolveDynamicComponent(components))),
            ]),
          ],
          64 /* STABLE_FRAGMENT */
        )
      );
    }
  };
});
