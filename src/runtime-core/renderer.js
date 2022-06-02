import { createAppAPI } from './apiCreateApp.js'
import {
  Text,
  Fragment,
  Comment,
  cloneIfMounted,
  normalizeVNode,
  createVNode,
  isSameVNodeType,
  Static,
  invokeVNodeHook
} from './vnode.js'
import { createComponentInstance, setupComponent } from './component.js'
import { isKeepAlive } from './components/KeepAlive.js'
import { ReactiveEffect } from '../reactivity/index.js'
import { isAsyncWrapper } from './apiAsyncComponent.js'
import {
  renderComponentRoot,
  shouldUpdateComponent,
  updateHOCHostEl
} from './componentRenderUtils.js'
import { updateProps } from './componentProps.js'
import { updateSlots } from './componentSlots.js'
import { invokeDirectiveHook } from './directives.js'
import {
  queueJob,
  flushPostFlushCbs,
  invalidateJob,
  flushPreFlushCbs
} from './scheduler.js'
import { queueEffectWithSuspense } from './components/Suspense.js'
import {
  isReservedProp,
  isArray,
  EMPTY_OBJ,
  invokeArrayFns,
  EMPTY_ARR
} from '../shared/index.js'
import { setRef } from './rendererTemplateRef.js'
import { pauseTracking, resetTracking } from '../reactivity/index.js'

export const queuePostRenderEffect = queueEffectWithSuspense

export function createRenderer(options) {
  return baseCreateRenderer(options)
}

function baseCreateRenderer(options) {
  // options 来自runtime-dom nodeOps.js和patchProps
  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    setScopeId: hostSetScopeId = NOOP,
    cloneNode: hostCloneNode,
    insertStaticContent: hostInsertStaticContent
  } = options

  const patch = (
    n1,
    n2,
    container,
    anchor = null,
    parentComponent = null,
    parentSuspense = null,
    isSVG = false,
    slotScopeIds = null
  ) => {
    if (n1 === n2) return
    // 如果不是相同类型的节点（tag、key都相同才算相同节点）
    // 直接卸载旧的vnode
    if (n1 && !isSameVNodeType(n1, n2)) {
      anchor = getNextHostNode(n1)
      unmount(n1, parentComponent, parentSuspense, true)
      n1 = null
    }
    // 不做diff优化
    if (n2.patchFlag === -2) {
      n2.dynamicChildren = null
    }
    const { type, ref, shapeFlag } = n2
    switch (type) {
      case Text:
        processText(n1, n2, container, anchor)
        break
      case Comment:
        processCommentNode(n1, n2, container, anchor)
        break
      case Static:
        if (n1 == null) {
          mountStaticNode(n2, container, anchor, isSVG)
        }
        break
      case Fragment:
        processFragment(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds
        )
        break
      default:
        if (shapeFlag & 1) {
          processElement(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds
          )
        } else if (shapeFlag & 6) {
          //
          processComponent(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds
          )
        } else if (shapeFlag & 64) {
          type.process(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds,
            internals
          )
        } else if (shapeFlag & 128) {
          type.process(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds,
            internals
          )
        }
    }
    if (ref != null && parentComponent) {
      setRef(ref, n1 && n1.ref, parentSuspense, n2 || n1, !n2)
    }
  }
  const processText = (n1, n2, container, anchor) => {
    if (n1 == null) {
      hostInsert((n2.el = hostCreateText(n2.children)), container, anchor)
    } else {
      const el = (n2.el = n1.el)
      if (n2.children !== n1.children) {
        hostSetText(el, n2.children)
      }
    }
  }
  const processCommentNode = (n1, n2, container, anchor) => {
    if (n1 == null) {
      hostInsert(
        (n2.el = hostCreateComment(n2.children || '')),
        container,
        anchor
      )
    } else {
      n2.el = n1.el
    }
  }
  const mountStaticNode = (n2, container, anchor, isSVG) => {
    ;[n2.el, n2.anchor] = hostInsertStaticContent(
      n2.children,
      container,
      anchor,
      isSVG,
      n2.el,
      n2.anchor
    )
  }
  const moveStaticNode = ({ el, anchor }, container, nextSibling) => {
    let next
    while (el && el !== anchor) {
      next = hostNextSibling(el)
      hostInsert(el, container, nextSibling)
      el = next
    }
    hostInsert(anchor, container, nextSibling)
  }
  const removeStaticNode = ({ el, anchor }) => {
    let next
    while (el && el !== anchor) {
      next = hostNextSibling(el)
      hostRemove(el)
      el = next
    }
    hostRemove(anchor)
  }
  const processElement = (
    n1,
    n2,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds
  ) => {
    isSVG = isSVG || n2.type === 'svg'
    if (n1 == null) {
      mountElement(
        n2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds
      )
    } else {
      patchElement(n1, n2, parentComponent, parentSuspense, isSVG, slotScopeIds)
    }
  }
  const mountElement = (
    vnode,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds
  ) => {
    let el
    let vnodeHook
    const { type, props, shapeFlag, transition, patchFlag, dirs } = vnode

    el = vnode.el = hostCreateElement(
      vnode.type,
      isSVG,
      props && props.is,
      props
    )
    if (shapeFlag & 8) {
      hostSetElementText(el, vnode.children)
    } else if (shapeFlag & 16) {
      mountChildren(
        vnode.children,
        el,
        null,
        parentComponent,
        parentSuspense,
        isSVG && type !== 'foreignObject',
        slotScopeIds
      )
    }
    // 指令
    if (dirs) {
      // console.log('指令：created')
      invokeDirectiveHook(vnode, null, parentComponent, 'created')
    }
    if (props) {
      for (const key in props) {
        if (key !== 'value' && !isReservedProp(key)) {
          hostPatchProp(
            el,
            key,
            null,
            props[key],
            isSVG,
            vnode.children,
            parentComponent,
            parentSuspense,
            unmountChildren
          )
        }
      }
      if ('value' in props) {
        hostPatchProp(el, 'value', null, props.value)
      }
      if ((vnodeHook = props.onVnodeBeforeMount)) {
        invokeVNodeHook(vnodeHook, parentComponent, vnode)
      }
    }
    setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent)
    if (dirs) {
      // console.log('指令：beforeMount')
      invokeDirectiveHook(vnode, null, parentComponent, 'beforeMount')
    }
    const needCallTransitionHooks =
      (!parentSuspense || (parentSuspense && !parentSuspense.pendingBranch)) &&
      transition &&
      !transition.persisted
    if (needCallTransitionHooks) {
      transition.beforeEnter(el)
    }
    // 挂载元素
    hostInsert(el, container, anchor)
    if (
      (vnodeHook = props && props.onVnodeMounted) ||
      needCallTransitionHooks ||
      dirs
    ) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode)
        needCallTransitionHooks && transition.enter(el)
        dirs && invokeDirectiveHook(vnode, null, parentComponent, 'mounted')
      }, parentSuspense)
    }
  }
  const setScopeId = (el, vnode, scopeId, slotScopeIds, parentComponent) => {
    if (scopeId) {
      hostSetScopeId(el, scopeId)
    }
    if (slotScopeIds) {
      for (let i = 0; i < slotScopeIds.length; i++) {
        hostSetScopeId(el, slotScopeIds[i])
      }
    }
    if (parentComponent) {
      let subTree = parentComponent.subTree
      if (vnode === subTree) {
        const parentVNode = parentComponent.vnode
        setScopeId(
          el,
          parentVNode,
          parentVNode.scopeId,
          parentVNode.slotScopeIds,
          parentComponent.parent
        )
      }
    }
  }
  const mountChildren = (
    children,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds,

    start = 0
  ) => {
    for (let i = start; i < children.length; i++) {
      const child = (children[i] = normalizeVNode(children[i]))
      patch(
        null,
        child,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds
      )
    }
  }
  const patchElement = (
    n1,
    n2,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds
  ) => {
    const el = (n2.el = n1.el)
    let { patchFlag, dynamicChildren, dirs } = n2
    patchFlag |= n1.patchFlag & 16
    const oldProps = n1.props || EMPTY_OBJ
    const newProps = n2.props || EMPTY_OBJ
    let vnodeHook
    parentComponent && toggleRecurse(parentComponent, false)
    if ((vnodeHook = newProps.onVnodeBeforeUpdate)) {
      invokeVNodeHook(vnodeHook, parentComponent, n2, n1)
    }
    if (dirs) {
      // console.log('指令：beforeUpdate')
      invokeDirectiveHook(n2, n1, parentComponent, 'beforeUpdate')
    }
    parentComponent && toggleRecurse(parentComponent, true)

    const areChildrenSVG = isSVG && n2.type !== 'foreignObject'
    if (dynamicChildren) {
      patchBlockChildren(
        n1.dynamicChildren,
        dynamicChildren,
        el,
        parentComponent,
        parentSuspense,
        areChildrenSVG,
        slotScopeIds
      )
    } else {
      patchChildren(
        n1,
        n2,
        el,
        null,
        parentComponent,
        parentSuspense,
        areChildrenSVG,
        slotScopeIds,
        false
      )
    }
    if (patchFlag > 0) {
      if (patchFlag & 16) {
        patchProps(
          el,
          n2,
          oldProps,
          newProps,
          parentComponent,
          parentSuspense,
          isSVG
        )
      } else {
        if (patchFlag & 2) {
          if (oldProps.class !== newProps.class) {
            hostPatchProp(el, 'class', null, newProps.class, isSVG)
          }
        }
        if (patchFlag & 4) {
          hostPatchProp(el, 'style', oldProps.style, newProps.style, isSVG)
        }
        if (patchFlag & 8) {
          const propsToUpdate = n2.dynamicProps
          for (let i = 0; i < propsToUpdate.length; i++) {
            const key = propsToUpdate[i]
            const prev = oldProps[key]
            const next = newProps[key]
            if (next !== prev || key === 'value') {
              hostPatchProp(
                el,
                key,
                prev,
                next,
                isSVG,
                n1.children,
                parentComponent,
                parentSuspense,
                unmountChildren
              )
            }
          }
        }
      }
      if (patchFlag & 1) {
        if (n1.children !== n2.children) {
          hostSetElementText(el, n2.children)
        }
      }
    } else if (dynamicChildren == null) {
      patchProps(
        el,
        n2,
        oldProps,
        newProps,
        parentComponent,
        parentSuspense,
        isSVG
      )
    }
    if ((vnodeHook = newProps.onVnodeUpdated) || dirs) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1)
        dirs && invokeDirectiveHook(n2, n1, parentComponent, 'updated')
      }, parentSuspense)
    }
  }
  const patchBlockChildren = (
    oldChildren,
    newChildren,
    fallbackContainer,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds
  ) => {
    for (let i = 0; i < newChildren.length; i++) {
      const oldVNode = oldChildren[i]
      const newVNode = newChildren[i]
      const container =
        oldVNode.el &&
          (oldVNode.type === Fragment ||
            !isSameVNodeType(oldVNode, newVNode) ||
            oldVNode.shapeFlag & (6 | 64))
          ? hostParentNode(oldVNode.el)
          : fallbackContainer
      patch(
        oldVNode,
        newVNode,
        container,
        null,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,
        true
      )
    }
  }
  const patchProps = (
    el,
    vnode,
    oldProps,
    newProps,
    parentComponent,
    parentSuspense,
    isSVG
  ) => {
    if (oldProps !== newProps) {
      for (const key in newProps) {
        if (isReservedProp(key)) continue
        const next = newProps[key]
        const prev = oldProps[key]
        if (next !== prev && key !== 'value') {
          hostPatchProp(
            el,
            key,
            prev,
            next,
            isSVG,
            vnode.children,
            parentComponent,
            parentSuspense,
            unmountChildren
          )
        }
      }
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (!isReservedProp(key) && !(key in newProps)) {
            hostPatchProp(
              el,
              key,
              oldProps[key],
              null,
              isSVG,
              vnode.children,
              parentComponent,
              parentSuspense,
              unmountChildren
            )
          }
        }
      }
      if ('value' in newProps) {
        hostPatchProp(el, 'value', oldProps.value, newProps.value)
      }
    }
  }
  const processFragment = (
    n1,
    n2,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds
  ) => {
    const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(''))
    const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(''))
    let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2
    if (fragmentSlotScopeIds) {
      slotScopeIds = slotScopeIds
        ? slotScopeIds.concat(fragmentSlotScopeIds)
        : fragmentSlotScopeIds
    }
    if (n1 == null) {
      hostInsert(fragmentStartAnchor, container, anchor)
      hostInsert(fragmentEndAnchor, container, anchor)
      mountChildren(
        n2.children,
        container,
        fragmentEndAnchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds
      )
    } else {
      if (
        patchFlag > 0 &&
        patchFlag & 64 &&
        dynamicChildren &&
        n1.dynamicChildren
      ) {
        patchBlockChildren(
          n1.dynamicChildren,
          dynamicChildren,
          container,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds
        )
        if (
          n2.key != null ||
          (parentComponent && n2 === parentComponent.subTree)
        ) {
          traverseStaticChildren(n1, n2, true)
        }
      } else {
        patchChildren(
          n1,
          n2,
          container,
          fragmentEndAnchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds
        )
      }
    }
  }
  const processComponent = (
    n1,
    n2,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds
  ) => {
    n2.slotScopeIds = slotScopeIds
    if (n1 == null) {
      if (n2.shapeFlag & 512) {
        parentComponent.ctx.activate(n2, container, anchor, isSVG)
      } else {
        mountComponent(
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG
        )
      }
    } else {
      updateComponent(n1, n2)
    }
  }
  const mountComponent = (
    initialVNode,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG
  ) => {
    // 创建组件实例
    const instance = (initialVNode.component = createComponentInstance(
      initialVNode,
      parentComponent,
      parentSuspense
    ))
    // 是否是 keep-alive 组件
    if (isKeepAlive(initialVNode)) {
      instance.ctx.renderer = internals
    }
    setupComponent(instance)
    if (instance.asyncDep) {
      parentSuspense && parentSuspense.registerDep(instance, setupRenderEffect)
      if (!initialVNode.el) {
        const placeholder = (instance.subTree = createVNode(Comment))
        processCommentNode(null, placeholder, container, anchor)
      }
      return
    }
    setupRenderEffect(
      instance,
      initialVNode,
      container,
      anchor,
      parentSuspense,
      isSVG
    )
  }
  const updateComponent = (n1, n2) => {
    const instance = (n2.component = n1.component)
    if (shouldUpdateComponent(n1, n2)) {
      if (instance.asyncDep && !instance.asyncResolved) {
        updateComponentPreRender(instance, n2)
        return
      } else {
        instance.next = n2
        invalidateJob(instance.update)
        instance.update()
      }
    } else {
      n2.component = n1.component
      n2.el = n1.el
      instance.vnode = n2
    }
  }
  const setupRenderEffect = (
    instance,
    initialVNode,
    container,
    anchor,
    parentSuspense,
    isSVG
  ) => {
    // 组件更新函数
    const componentUpdateFn = () => {
      // 组件是否挂载
      if (!instance.isMounted) {
        // 初次挂载
        let vnodeHook
        const { props } = initialVNode
        const { bm, m, parent } = instance
        const isAsyncWrapperVNode = isAsyncWrapper(initialVNode)
        toggleRecurse(instance, false)
        if (bm) {
          invokeArrayFns(bm)
        }
        if (
          !isAsyncWrapperVNode &&
          (vnodeHook = props && props.onVnodeBeforeMount)
        ) {
          invokeVNodeHook(vnodeHook, parent, initialVNode)
        }
        toggleRecurse(instance, true)

        const subTree = (instance.subTree = renderComponentRoot(instance))
        patch(null, subTree, container, anchor, instance, parentSuspense, isSVG)

        initialVNode.el = subTree.el
        if (m) {
          queuePostRenderEffect(m, parentSuspense)
        }
        if (
          !isAsyncWrapperVNode &&
          (vnodeHook = props && props.onVnodeMounted)
        ) {
          const scopedInitialVNode = initialVNode
          queuePostRenderEffect(
            () => invokeVNodeHook(vnodeHook, parent, scopedInitialVNode),
            parentSuspense
          )
        }
        if (initialVNode.shapeFlag & 256) {
          instance.a && queuePostRenderEffect(instance.a, parentSuspense)
        }
        instance.isMounted = true

        initialVNode = container = anchor = null
      } else {
        // 组件更新
        let { next, bu, u, parent, vnode } = instance
        let originNext = next
        let vnodeHook
        toggleRecurse(instance, false)
        if (next) {
          next.el = vnode.el
          updateComponentPreRender(instance, next)
        } else {
          next = vnode
        }
        if (bu) {
          invokeArrayFns(bu)
        }
        if ((vnodeHook = next.props && next.props.onVnodeBeforeUpdate)) {
          invokeVNodeHook(vnodeHook, parent, next, vnode)
        }
        toggleRecurse(instance, true)

        const nextTree = renderComponentRoot(instance)

        const prevTree = instance.subTree
        instance.subTree = nextTree

        patch(
          prevTree,
          nextTree,
          hostParentNode(prevTree.el),
          getNextHostNode(prevTree),
          instance,
          parentSuspense,
          isSVG
        )
        next.el = nextTree.el
        if (originNext === null) {
          updateHOCHostEl(instance, nextTree.el)
        }
        if (u) {
          queuePostRenderEffect(u, parentSuspense)
        }
        if ((vnodeHook = next.props && next.props.onVnodeUpdated)) {
          queuePostRenderEffect(
            () => invokeVNodeHook(vnodeHook, parent, next, vnode),
            parentSuspense
          )
        }
      }
    }
    const effect = (instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queueJob(instance.update),
      instance.scope
    ))
    const update = (instance.update = effect.run.bind(effect))
    update.id = instance.uid
    toggleRecurse(instance, true)
    update()
  }

  const updateComponentPreRender = (instance, nextVNode) => {
    nextVNode.component = instance
    const prevProps = instance.vnode.props
    instance.vnode = nextVNode
    instance.next = null
    updateProps(instance, nextVNode.props, prevProps)
    updateSlots(instance, nextVNode.children)
    pauseTracking()
    flushPreFlushCbs(undefined, instance.update)
    resetTracking()
  }
  const patchChildren = (
    n1,
    n2,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds
  ) => {
    const c1 = n1 && n1.children
    const prevShapeFlag = n1 ? n1.shapeFlag : 0
    const c2 = n2.children
    const { patchFlag, shapeFlag } = n2
    if (patchFlag > 0) {
      if (patchFlag & 128) {
        patchKeyedChildren(
          c1,
          c2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds
        )
        return
      } else if (patchFlag & 256) {
        patchUnkeyedChildren(
          c1,
          c2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds
        )
        return
      }
    }
    if (shapeFlag & 8) {
      if (prevShapeFlag & 16) {
        unmountChildren(c1, parentComponent, parentSuspense)
      }
      if (c2 !== c1) {
        hostSetElementText(container, c2)
      }
    } else {
      if (prevShapeFlag & 16) {
        if (shapeFlag & 16) {
          patchKeyedChildren(
            c1,
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds
          )
        } else {
          unmountChildren(c1, parentComponent, parentSuspense, true)
        }
      } else {
        if (prevShapeFlag & 8) {
          hostSetElementText(container, '')
        }
        if (shapeFlag & 16) {
          mountChildren(
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds
          )
        }
      }
    }
  }
  const patchUnkeyedChildren = (
    c1,
    c2,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds
  ) => {
    c1 = c1 || EMPTY_ARR
    c2 = c2 || EMPTY_ARR
    const oldLength = c1.length
    const newLength = c2.length
    const commonLength = Math.min(oldLength, newLength)
    let i
    for (i = 0; i < commonLength; i++) {
      const nextChild = (c2[i] = normalizeVNode(c2[i]))
      patch(
        c1[i],
        nextChild,
        container,
        null,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds
      )
    }
    if (oldLength > newLength) {
      unmountChildren(c1, parentComponent, parentSuspense, true, commonLength)
    } else {
      mountChildren(
        c2,
        container,
        anchor,
        parentComponent,
        parentSuspense,
        isSVG,
        slotScopeIds,

        commonLength
      )
    }
  }
  const patchKeyedChildren = (
    c1,
    c2,
    container,
    parentAnchor,
    parentComponent,
    parentSuspense,
    isSVG,
    slotScopeIds
  ) => {
    let i = 0
    const l2 = c2.length
    let e1 = c1.length - 1
    let e2 = l2 - 1
    while (i <= e1 && i <= e2) {
      const n1 = c1[i]
      const n2 = (c2[i] = normalizeVNode(c2[i]))
      if (isSameVNodeType(n1, n2)) {
        patch(
          n1,
          n2,
          container,
          null,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds
        )
      } else {
        break
      }
      i++
    }
    while (i <= e1 && i <= e2) {
      const n1 = c1[e1]
      const n2 = (c2[e2] = normalizeVNode(c2[e2]))
      if (isSameVNodeType(n1, n2)) {
        patch(
          n1,
          n2,
          container,
          null,
          parentComponent,
          parentSuspense,
          isSVG,
          slotScopeIds
        )
      } else {
        break
      }
      e1--
      e2--
    }
    if (i > e1) {
      if (i <= e2) {
        const nextPos = e2 + 1
        const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor
        while (i <= e2) {
          patch(
            null,
            (c2[i] = normalizeVNode(c2[i])),
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds
          )
          i++
        }
      }
    } else if (i > e2) {
      while (i <= e1) {
        unmount(c1[i], parentComponent, parentSuspense, true)
        i++
      }
    } else {
      const s1 = i
      const s2 = i
      const keyToNewIndexMap = new Map()
      for (i = s2; i <= e2; i++) {
        const nextChild = (c2[i] = normalizeVNode(c2[i]))
        if (nextChild.key != null) {
          keyToNewIndexMap.set(nextChild.key, i)
        }
      }
      let j
      let patched = 0
      const toBePatched = e2 - s2 + 1
      let moved = false
      let maxNewIndexSoFar = 0
      const newIndexToOldIndexMap = new Array(toBePatched)
      for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0
      for (i = s1; i <= e1; i++) {
        const prevChild = c1[i]
        if (patched >= toBePatched) {
          unmount(prevChild, parentComponent, parentSuspense, true)
          continue
        }
        let newIndex
        if (prevChild.key != null) {
          newIndex = keyToNewIndexMap.get(prevChild.key)
        } else {
          for (j = s2; j <= e2; j++) {
            if (
              newIndexToOldIndexMap[j - s2] === 0 &&
              isSameVNodeType(prevChild, c2[j])
            ) {
              newIndex = j
              break
            }
          }
        }
        if (newIndex === undefined) {
          unmount(prevChild, parentComponent, parentSuspense, true)
        } else {
          newIndexToOldIndexMap[newIndex - s2] = i + 1
          if (newIndex >= maxNewIndexSoFar) {
            maxNewIndexSoFar = newIndex
          } else {
            moved = true
          }
          patch(
            prevChild,
            c2[newIndex],
            container,
            null,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds
          )
          patched++
        }
      }
      // keep-alive 报错
      const increasingNewIndexSequence = moved
        ? getSequence(newIndexToOldIndexMap)
        : EMPTY_ARR
      j = increasingNewIndexSequence.length - 1
      for (i = toBePatched - 1; i >= 0; i--) {
        const nextIndex = s2 + i
        const nextChild = c2[nextIndex]
        const anchor = nextIndex + 1 < l2 ? c2[nextIndex + 1].el : parentAnchor
        if (newIndexToOldIndexMap[i] === 0) {
          patch(
            null,
            nextChild,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            slotScopeIds
          )
        } else if (moved) {
          if (j < 0 || i !== increasingNewIndexSequence[j]) {
            move(nextChild, container, anchor, 2)
          } else {
            j--
          }
        }
      }
    }
  }
  const move = (vnode, container, anchor, moveType, parentSuspense = null) => {
    const { el, type, transition, children, shapeFlag } = vnode
    if (shapeFlag & 6) {
      move(vnode.component.subTree, container, anchor, moveType)
      return
    }
    if (shapeFlag & 128) {
      vnode.suspense.move(container, anchor, moveType)
      return
    }
    if (shapeFlag & 64) {
      type.move(vnode, container, anchor, internals)
      return
    }
    if (type === Fragment) {
      hostInsert(el, container, anchor)
      for (let i = 0; i < children.length; i++) {
        move(children[i], container, anchor, moveType)
      }
      hostInsert(vnode.anchor, container, anchor)
      return
    }
    if (type === Static) {
      moveStaticNode(vnode, container, anchor)
      return
    }
    const needTransition = moveType !== 2 && shapeFlag & 1 && transition
    if (needTransition) {
      if (moveType === 0) {
        transition.beforeEnter(el)
        hostInsert(el, container, anchor)
        queuePostRenderEffect(() => transition.enter(el), parentSuspense)
      } else {
        const { leave, delayLeave, afterLeave } = transition
        const remove = () => hostInsert(el, container, anchor)
        const performLeave = () => {
          leave(el, () => {
            remove()
            afterLeave && afterLeave()
          })
        }
        if (delayLeave) {
          delayLeave(el, remove, performLeave)
        } else {
          performLeave()
        }
      }
    } else {
      hostInsert(el, container, anchor)
    }
  }
  const unmount = (
    vnode,
    parentComponent,
    parentSuspense,
    doRemove = false
  ) => {
    const {
      type,
      props,
      ref,
      children,
      dynamicChildren,
      shapeFlag,
      patchFlag,
      dirs
    } = vnode
    if (ref != null) {
      setRef(ref, null, parentSuspense, vnode, true)
    }
    if (shapeFlag & 256) {
      parentComponent.ctx.deactivate(vnode)
      return
    }
    const shouldInvokeDirs = shapeFlag & 1 && dirs
    const shouldInvokeVnodeHook = !isAsyncWrapper(vnode)
    let vnodeHook
    if (
      shouldInvokeVnodeHook &&
      (vnodeHook = props && props.onVnodeBeforeUnmount)
    ) {
      invokeVNodeHook(vnodeHook, parentComponent, vnode)
    }
    if (shapeFlag & 6) {
      unmountComponent(vnode.component, parentSuspense, doRemove)
    } else {
      if (shapeFlag & 128) {
        vnode.suspense.unmount(parentSuspense, doRemove)
        return
      }
      if (shouldInvokeDirs) {
        invokeDirectiveHook(vnode, null, parentComponent, 'beforeUnmount')
      }
      if (shapeFlag & 64) {
        vnode.type.remove(
          vnode,
          parentComponent,
          parentSuspense,
          internals,
          doRemove
        )
      } else if (
        dynamicChildren &&
        (type !== Fragment || (patchFlag > 0 && patchFlag & 64))
      ) {
        unmountChildren(dynamicChildren, parentComponent, parentSuspense, false)
      } else if (
        (type === Fragment && patchFlag & (128 | 256)) ||
        shapeFlag & 16
      ) {
        unmountChildren(children, parentComponent, parentSuspense)
      }
      if (doRemove) {
        remove(vnode)
      }
    }
    if (
      (shouldInvokeVnodeHook &&
        (vnodeHook = props && props.onVnodeUnmounted)) ||
      shouldInvokeDirs
    ) {
      queuePostRenderEffect(() => {
        vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode)
        shouldInvokeDirs &&
          invokeDirectiveHook(vnode, null, parentComponent, 'unmounted')
      }, parentSuspense)
    }
  }
  const remove = vnode => {
    const { type, el, anchor, transition } = vnode
    if (type === Fragment) {
      removeFragment(el, anchor)
      return
    }
    if (type === Static) {
      removeStaticNode(vnode)
      return
    }
    const performRemove = () => {
      hostRemove(el)
      if (transition && !transition.persisted && transition.afterLeave) {
        transition.afterLeave()
      }
    }
    if (vnode.shapeFlag & 1 && transition && !transition.persisted) {
      const { leave, delayLeave } = transition
      const performLeave = () => leave(el, performRemove)
      if (delayLeave) {
        delayLeave(vnode.el, performRemove, performLeave)
      } else {
        performLeave()
      }
    } else {
      performRemove()
    }
  }
  const removeFragment = (cur, end) => {
    let next
    while (cur !== end) {
      next = hostNextSibling(cur)
      hostRemove(cur)
      cur = next
    }
    hostRemove(end)
  }
  const unmountComponent = (instance, parentSuspense, doRemove) => {
    const { bum, scope, update, subTree, um } = instance
    if (bum) {
      // console.log('bum:组件卸载前')
      invokeArrayFns(bum)
    }
    // 清除响应式效果
    scope.stop()
    if (update) {
      update.active = false
      unmount(subTree, instance, parentSuspense, doRemove)
    }
    if (um) {
      queuePostRenderEffect(um, parentSuspense)
    }
    queuePostRenderEffect(() => {
      instance.isUnmounted = true
    }, parentSuspense)
    if (
      parentSuspense &&
      parentSuspense.pendingBranch &&
      !parentSuspense.isUnmounted &&
      instance.asyncDep &&
      !instance.asyncResolved &&
      instance.suspenseId === parentSuspense.pendingId
    ) {
      parentSuspense.deps--
      if (parentSuspense.deps === 0) {
        parentSuspense.resolve()
      }
    }
  }
  const unmountChildren = (
    children,
    parentComponent,
    parentSuspense,
    doRemove = false,
    start = 0
  ) => {
    for (let i = start; i < children.length; i++) {
      unmount(children[i], parentComponent, parentSuspense, doRemove)
    }
  }
  const getNextHostNode = vnode => {
    if (vnode.shapeFlag & 6) {
      return getNextHostNode(vnode.component.subTree)
    }
    if (vnode.shapeFlag & 128) {
      return vnode.suspense.next()
    }
    return hostNextSibling(vnode.anchor || vnode.el)
  }
  const render = (vnode, container, isSVG) => {
    if (vnode == null) {
      if (container._vnode) {
        unmount(container._vnode, null, null, true)
      }
    } else {
      patch(container._vnode || null, vnode, container, null, null, null, isSVG)
    }
    flushPostFlushCbs()
    container._vnode = vnode
  }
  const internals = {
    p: patch,
    um: unmount,
    m: move,
    r: remove,
    mt: mountComponent,
    mc: mountChildren,
    pc: patchChildren,
    pbc: patchBlockChildren,
    n: getNextHostNode,
    o: options
  }

  return {
    render,
    createApp: createAppAPI(render)
  }
}

function toggleRecurse({ effect, update }, allowed) {
  effect.allowRecurse = update.allowRecurse = allowed
}
export function traverseStaticChildren(n1, n2, shallow = false) {
  const ch1 = n1.children
  const ch2 = n2.children
  if (isArray(ch1) && isArray(ch2)) {
    for (let i = 0; i < ch1.length; i++) {
      const c1 = ch1[i]
      let c2 = ch2[i]
      if (c2.shapeFlag & 1 && !c2.dynamicChildren) {
        if (c2.patchFlag <= 0 || c2.patchFlag === 32) {
          c2 = ch2[i] = cloneIfMounted(ch2[i])
          c2.el = c1.el
        }
        if (!shallow) traverseStaticChildren(c1, c2)
      }
    }
  }
}
function getSequence(arr) {
  const p = arr.slice()
  const result = [0]
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          v = c
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}
