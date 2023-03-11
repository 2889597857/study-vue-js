import { isString } from '../../shared/index.js'
import {
  traverseStaticChildren
} from '../renderer.js'

export const isTeleport = type => type.__isTeleport

const isTeleportDisabled = props =>
  props && (props.disabled || props.disabled === '')

const isTargetSVG = target =>
  typeof SVGElement !== 'undefined' && target instanceof SVGElement

const resolveTarget = (props, select) => {
  const targetSelector = props && props.to
  if (isString(targetSelector)) {
    if (!select) {
      warn$1(
        `Current renderer does not support string target for Teleports. ` +
        `(missing querySelector renderer option)`
      )
      return null
    } else {
      const target = select(targetSelector)
      if (!target) {
        warn$1(
          `Failed to locate Teleport target with selector "${targetSelector}". ` +
          `Note the target element must exist before the component is mounted - ` +
          `i.e. the target cannot be rendered by the component itself, and ` +
          `ideally should be outside of the entire Vue component tree.`
        )
      }
      return target
    }
  } else {
    if (!targetSelector && !isTeleportDisabled(props)) {
      warn$1(`Invalid Teleport target: ${targetSelector}`)
    }
    return targetSelector
  }
}

export const TeleportImpl = {
  __isTeleport: true,
  process(
    n1,
    n2,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds,
    optimized,
    internals
  ) {
    const {
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      o: { insert, querySelector, createText, createComment }
    } = internals
    const disabled = isTeleportDisabled(n2.props)
    let { shapeFlag, children, dynamicChildren } = n2
    // #3302
    // HMR updated, force full diff
    // if (isHmrUpdating) {
    //   optimized = false
    //   dynamicChildren = null
    // }
    if (n1 == null) {
      // insert anchors in the main view
      const placeholder = (n2.el = createComment('teleport start'))
      const mainAnchor = (n2.anchor = createComment('teleport end'))
      insert(placeholder, container, anchor)
      insert(mainAnchor, container, anchor)
      const target = (n2.target = resolveTarget(n2.props, querySelector))
      const targetAnchor = (n2.targetAnchor = createText(''))
      if (target) {
        insert(targetAnchor, target)
        // #2652 we could be teleporting from a non-SVG tree into an SVG tree
        isSVG = isSVG || isTargetSVG(target)
      } else if (!disabled) {
        warn$1(
          'Invalid Teleport target on mount:',
          target,
          `(${typeof target})`
        )
      }
      const mount = (container, anchor) => {
        // Teleport *always* has Array children. This is enforced in both the
        // compiler and vnode children normalization.
        if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
          mountChildren(
            children,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds,
            optimized
          )
        }
      }
      if (disabled) {
        mount(container, mainAnchor)
      } else if (target) {
        mount(target, targetAnchor)
      }
    } else {
      // update content
      n2.el = n1.el
      const mainAnchor = (n2.anchor = n1.anchor)
      const target = (n2.target = n1.target)
      const targetAnchor = (n2.targetAnchor = n1.targetAnchor)
      const wasDisabled = isTeleportDisabled(n1.props)
      const currentContainer = wasDisabled ? container : target
      const currentAnchor = wasDisabled ? mainAnchor : targetAnchor
      isSVG = isSVG || isTargetSVG(target)
      if (dynamicChildren) {
        // fast path when the teleport happens to be a block root
        patchBlockChildren(
          n1.dynamicChildren,
          dynamicChildren,
          currentContainer,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds
        )
        // even in block tree mode we need to make sure all root-level nodes
        // in the teleport inherit previous DOM references so that they can
        // be moved in future patches.
        traverseStaticChildren(n1, n2, true)
      } else if (!optimized) {
        patchChildren(
          n1,
          n2,
          currentContainer,
          currentAnchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds,
          false
        )
      }
      if (disabled) {
        if (!wasDisabled) {
          // enabled -> disabled
          // move into main container
          moveTeleport(n2, container, mainAnchor, internals, 1 /* TOGGLE */)
        }
      } else {
        // target changed
        if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
          const nextTarget = (n2.target = resolveTarget(
            n2.props,
            querySelector
          ))
          if (nextTarget) {
            moveTeleport(n2, nextTarget, null, internals, 0 /* TARGET_CHANGE */)
          } else {
            warn$1(
              'Invalid Teleport target on update:',
              target,
              `(${typeof target})`
            )
          }
        } else if (wasDisabled) {
          // disabled -> enabled
          // move into teleport target
          moveTeleport(n2, target, targetAnchor, internals, 1 /* TOGGLE */)
        }
      }
    }
  },
  remove(
    vnode,
    parentComponent,
    parentSuspense,
    optimized,
    { um: unmount, o: { remove: hostRemove } },
    doRemove
  ) {
    const { shapeFlag, children, anchor, targetAnchor, target, props } = vnode
    if (target) {
      hostRemove(targetAnchor)
    }
    // an unmounted teleport should always remove its children if not disabled
    if (doRemove || !isTeleportDisabled(props)) {
      hostRemove(anchor)
      if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i]
          unmount(
            child,
            parentComponent,
            parentSuspense,
            true,
            !!child.dynamicChildren
          )
        }
      }
    }
  },
  move: moveTeleport,
  hydrate: hydrateTeleport
}

function moveTeleport(
  vnode,
  container,
  parentAnchor,
  { o: { insert }, m: move },
  moveType = 2 /* REORDER */
) {
  // move target anchor if this is a target change.
  if (moveType === 0 /* TARGET_CHANGE */) {
    insert(vnode.targetAnchor, container, parentAnchor)
  }
  const { el, anchor, shapeFlag, children, props } = vnode
  const isReorder = moveType === 2 /* REORDER */
  // move main view anchor if this is a re-order.
  if (isReorder) {
    insert(el, container, parentAnchor)
  }
  // if this is a re-order and teleport is enabled (content is in target)
  // do not move children. So the opposite is: only move children if this
  // is not a reorder, or the teleport is disabled
  if (!isReorder || isTeleportDisabled(props)) {
    // Teleport has either Array children or no children.
    if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
      for (let i = 0; i < children.length; i++) {
        move(children[i], container, parentAnchor, 2 /* REORDER */)
      }
    }
  }
  // move main view anchor if this is a re-order.
  if (isReorder) {
    insert(anchor, container, parentAnchor)
  }
}

function hydrateTeleport(
  node,
  vnode,
  parentComponent,
  parentSuspense,
  slotScopeIds,
  optimized,
  { o: { nextSibling, parentNode, querySelector } },
  hydrateChildren
) {
  const target = (vnode.target = resolveTarget(vnode.props, querySelector))
  if (target) {
    // if multiple teleports rendered to the same target element, we need to
    // pick up from where the last teleport finished instead of the first node
    const targetNode = target._lpa || target.firstChild
    if (vnode.shapeFlag & 16 /* ARRAY_CHILDREN */) {
      if (isTeleportDisabled(vnode.props)) {
        vnode.anchor = hydrateChildren(
          nextSibling(node),
          vnode,
          parentNode(node),
          parentComponent,
          parentSuspense,
          slotScopeIds,
          optimized
        )
        vnode.targetAnchor = targetNode
      } else {
        vnode.anchor = nextSibling(node)
        vnode.targetAnchor = hydrateChildren(
          targetNode,
          vnode,
          target,
          parentComponent,
          parentSuspense,
          slotScopeIds,
          optimized
        )
      }
      target._lpa = vnode.targetAnchor && nextSibling(vnode.targetAnchor)
    }
  }
  return vnode.anchor && nextSibling(vnode.anchor)
}

// Force-casted public typing for h and TSX props inference
export const Teleport = TeleportImpl                                                    