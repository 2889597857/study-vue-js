(function anonymous(Vue
) {
    const _Vue = Vue
    const { createCommentVNode: _createCommentVNode } = _Vue

    const _hoisted_1 = { key: 0 }

    return function render(_ctx, _cache) {
        with (_ctx) {
            const { renderList: _renderList, Fragment: _Fragment, openBlock: _openBlock, createElementBlock: _createElementBlock, toDisplayString: _toDisplayString, createCommentVNode: _createCommentVNode } = _Vue

            return (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(data, (item) => {
                return (_openBlock(), _createElementBlock("h1", { key: item.title }, [
                    (item.show)
                        ? (_openBlock(), _createElementBlock("p", _hoisted_1, _toDisplayString(item.title), 1))
                        : _createCommentVNode("v-if", true)
                ]))
            }), 128))
        }
    }
})
