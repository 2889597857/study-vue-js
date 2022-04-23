import {
  addTransitionClass,
  removeTransitionClass,
  getTransitionInfo,
  resolveTransitionProps,
  TransitionPropsValidators,
  forceReflow
} from './Transition.js'
import {
  Fragment,
  resolveTransitionHooks,
  useTransitionState,
  getTransitionRawChildren,
  getCurrentInstance,
  setTransitionHooks,
  createVNode,
  onUpdated,
  toRaw
} from '../../runtime-core/index.js'
import { extend } from '../../shared/index.js'

const positionMap = new WeakMap()
const newPositionMap = new WeakMap()
const TransitionGroupImpl = {
  name: 'TransitionGroup',
  props: /*#__PURE__*/ extend({}, TransitionPropsValidators, {
    tag: String,
    moveClass: String
  }),
  setup (props, { slots }) {
    const instance = getCurrentInstance()
    const state = useTransitionState()
    let prevChildren
    let children
    onUpdated(() => {
      // children is guaranteed to exist after initial render
      if (!prevChildren.length) {
        return
      }
      const moveClass = props.moveClass || `${props.name || 'v'}-move`
      if (!hasCSSTransform(prevChildren[0].el, instance.vnode.el, moveClass)) {
        return
      }
      // we divide the work into three loops to avoid mixing DOM reads and writes
      // in each iteration - which helps prevent layout thrashing.
      prevChildren.forEach(callPendingCbs)
      prevChildren.forEach(recordPosition)
      const movedChildren = prevChildren.filter(applyTranslation)
      // force reflow to put everything in position
      forceReflow()
      movedChildren.forEach(c => {
        const el = c.el
        const style = el.style
        addTransitionClass(el, moveClass)
        style.transform = style.webkitTransform = style.transitionDuration = ''
        const cb = (el._moveCb = e => {
          if (e && e.target !== el) {
            return
          }
          if (!e || /transform$/.test(e.propertyName)) {
            el.removeEventListener('transitionend', cb)
            el._moveCb = null
            removeTransitionClass(el, moveClass)
          }
        })
        el.addEventListener('transitionend', cb)
      })
    })
    return () => {
      const rawProps = toRaw(props)
      const cssTransitionProps = resolveTransitionProps(rawProps)
      let tag = rawProps.tag || Fragment
      prevChildren = children
      children = slots.default ? getTransitionRawChildren(slots.default()) : []
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (child.key != null) {
          setTransitionHooks(
            child,
            resolveTransitionHooks(child, cssTransitionProps, state, instance)
          )
        }
      }
      if (prevChildren) {
        for (let i = 0; i < prevChildren.length; i++) {
          const child = prevChildren[i]
          setTransitionHooks(
            child,
            resolveTransitionHooks(child, cssTransitionProps, state, instance)
          )
          positionMap.set(child, child.el.getBoundingClientRect())
        }
      }
      return createVNode(tag, null, children)
    }
  }
}

/**
 * TransitionGroup does not support "mode" so we need to remove it from the
 * props declarations, but direct delete operation is considered a side effect
 * and will make the entire transition feature non-tree-shakeable, so we do it
 * in a function and mark the function's invocation as pure.
 */
const removeMode = props => delete props.mode
/*#__PURE__*/ removeMode(TransitionGroupImpl.props)

export const TransitionGroup = TransitionGroupImpl

function callPendingCbs (c) {
  const el = c.el
  if (el._moveCb) {
    el._moveCb()
  }
  if (el._enterCb) {
    el._enterCb()
  }
}
function recordPosition (c) {
  newPositionMap.set(c, c.el.getBoundingClientRect())
}
function applyTranslation (c) {
  const oldPos = positionMap.get(c)
  const newPos = newPositionMap.get(c)
  const dx = oldPos.left - newPos.left
  const dy = oldPos.top - newPos.top
  if (dx || dy) {
    const s = c.el.style
    s.transform = s.webkitTransform = `translate(${dx}px,${dy}px)`
    s.transitionDuration = '0s'
    return c
  }
}
function hasCSSTransform (el, root, moveClass) {
  // Detect whether an element with the move class applied has
  // CSS transitions. Since the element may be inside an entering
  // transition at this very moment, we make a clone of it and remove
  // all other transition classes applied to ensure only the move class
  // is applied.
  const clone = el.cloneNode()
  if (el._vtc) {
    el._vtc.forEach(cls => {
      cls.split(/\s+/).forEach(c => c && clone.classList.remove(c))
    })
  }
  moveClass.split(/\s+/).forEach(c => c && clone.classList.add(c))
  clone.style.display = 'none'
  const container = root.nodeType === 1 ? root : root.parentNode
  container.appendChild(clone)
  const { hasTransform } = getTransitionInfo(clone)
  container.removeChild(clone)
  return hasTransform
}
