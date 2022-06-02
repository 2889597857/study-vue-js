(function anonymous(Vue
) {
    const _Vue = Vue
    const { createElementVNode: _createElementVNode, createCommentVNode: _createCommentVNode } = _Vue

    const _hoisted_1 = ["onUpdate:modelValue"]
    const _hoisted_2 = ["onUpdate:modelValue"]
    const _hoisted_3 = ["onClick"]

    return function render(_ctx, _cache) {
        with (_ctx) {
            const { vModelText: _vModelText, withDirectives: _withDirectives, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, createElementVNode: _createElementVNode, KeepAlive: _KeepAlive, createBlock: _createBlock, Fragment: _Fragment } = _Vue

            return (_openBlock(), _createElementBlock(_Fragment, null, [
                (_openBlock(), _createBlock(_KeepAlive, null, [
                    _createElementVNode("div", null, [
                        show
                            ? _withDirectives((_openBlock(), _createElementBlock("input", {
                                key: 0,
                                "onUpdate:modelValue": $event => ((data1) = $event),
                                type: "text"
                            }, null, 8 /* PROPS */, _hoisted_1)), [
                                [_vModelText, data1]
                            ])
                            : _createCommentVNode("v-if", true),
                        (!show)
                            ? _withDirectives((_openBlock(), _createElementBlock("input", {
                                key: 1,
                                "onUpdate:modelValue": $event => ((data2) = $event),
                                type: "text"
                            }, null, 8 /* PROPS */, _hoisted_2)), [
                                [_vModelText, data2]
                            ])
                            : _createCommentVNode("v-if", true)
                    ])
                ], 1024 /* DYNAMIC_SLOTS */)),
                _createElementVNode("button", {
                    onClick: $event => (show = !show)
                }, "show", 8 /* PROPS */, _hoisted_3)
            ], 64 /* STABLE_FRAGMENT */))
        }
    }
})
    (function anonymous(Vue
    ) {
        const _Vue = Vue
        const { createElementVNode: _createElementVNode, createCommentVNode: _createCommentVNode } = _Vue

        const _hoisted_1 = ["onUpdate:modelValue"]
        const _hoisted_2 = ["onUpdate:modelValue"]
        const _hoisted_3 = ["onClick"]

        return function render(_ctx, _cache) {
            with (_ctx) {
                const { vModelText: _vModelText, withDirectives: _withDirectives, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, createElementVNode: _createElementVNode, KeepAlive: _KeepAlive, createBlock: _createBlock, Fragment: _Fragment } = _Vue

                return (_openBlock(), _createElementBlock(_Fragment, null, [
                    (_openBlock(), _createBlock(_KeepAlive, null, [
                        _createElementVNode("div", null, [
                            show
                                ? _withDirectives((_openBlock(), _createElementBlock("input", {
                                    key: 0,
                                    "onUpdate:modelValue": $event => ((data1) = $event),
                                    type: "text"
                                }, null, 8 /* PROPS */, _hoisted_1)), [
                                    [_vModelText, data1]
                                ])
                                : _createCommentVNode("v-if", true),
                            (!show)
                                ? _withDirectives((_openBlock(), _createElementBlock("input", {
                                    key: 1,
                                    "onUpdate:modelValue": $event => ((data2) = $event),
                                    type: "text"
                                }, null, 8 /* PROPS */, _hoisted_2)), [
                                    [_vModelText, data2]
                                ])
                                : _createCommentVNode("v-if", true)
                        ])
                    ], 1024 /* DYNAMIC_SLOTS */)),
                    _createElementVNode("button", {
                        onClick: $event => (show = !show)
                    }, "show", 8 /* PROPS */, _hoisted_3)
                ], 64 /* STABLE_FRAGMENT */))
            }
        }
    })