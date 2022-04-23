import { registerRuntimeHelpers } from '../compiler-core/index.js'

export const V_MODEL_RADIO = Symbol(`vModelRadio`)
export const V_MODEL_CHECKBOX = Symbol(`vModelCheckbox`)
export const V_MODEL_TEXT = Symbol(`vModelText`)
export const V_MODEL_SELECT = Symbol(`vModelSelect`)
export const V_MODEL_DYNAMIC = Symbol(`vModelDynamic`)
export const V_ON_WITH_MODIFIERS = Symbol(`vOnModifiersGuard`)
export const V_ON_WITH_KEYS = Symbol(`vOnKeysGuard`)
export const V_SHOW = Symbol(`vShow`)
export const TRANSITION = Symbol(`Transition`)
export const TRANSITION_GROUP = Symbol(`TransitionGroup`)

registerRuntimeHelpers({
    [V_MODEL_RADIO]: `vModelRadio`,
    [V_MODEL_CHECKBOX]: `vModelCheckbox`,
    [V_MODEL_TEXT]: `vModelText`,
    [V_MODEL_SELECT]: `vModelSelect`,
    [V_MODEL_DYNAMIC]: `vModelDynamic`,
    [V_ON_WITH_MODIFIERS]: `withModifiers`,
    [V_ON_WITH_KEYS]: `withKeys`,
    [V_SHOW]: `vShow`,
    [TRANSITION]: `Transition`,
    [TRANSITION_GROUP]: `TransitionGroup`
})