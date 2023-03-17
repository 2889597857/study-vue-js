import {
  invokeArrayFns,
  isArray,
  isString,
  remove
} from '../../shared/index.js';
import { isAsyncWrapper } from '../apiAsyncComponent.js';
import {
  injectHook,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  onUpdated
} from '../apiLifecycle.js';
import { watch } from '../apiWatch.js';
import {
  currentInstance,
  getComponentName,
  getCurrentInstance
} from '../component.js';
import { queuePostRenderEffect } from '../renderer.js';
import { cloneVNode, invokeVNodeHook, isVNode } from '../vnode.js';
import { setTransitionHooks } from './BaseTransition.js';
// import { isSuspense } from './Suspense'

export const isKeepAlive = (vnode) => vnode.type.__isKeepAlive;
export const KeepAliveImpl = {
  name: `KeepAlive`,
  __isKeepAlive: true,
  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number],
  },
  setup(props, { slots }) {
    const instance = getCurrentInstance();
    const sharedContext = instance.ctx;
    if (!sharedContext.renderer) {
      return slots.default;
    }
    const cache = new Map();
    const keys = new Set();
    let current = null;

    const parentSuspense = instance.suspense;
    const {
      renderer: {
        p: patch,
        m: move,
        um: _unmount,
        o: { createElement },
      },
    } = sharedContext;
    console.log(sharedContext);
    /** 创建隐藏容器 */
    const storageContainer = createElement('div');
    // processComponent
    sharedContext.activate = (vnode, container, anchor, isSVG, optimized) => {
      const instance = vnode.component;
      move(vnode, container, anchor, 0, parentSuspense);
      patch(
        instance.vnode,
        vnode,
        container,
        anchor,
        instance,
        parentSuspense,
        isSVG,
        vnode.slotScopeIds,
        optimized
      );
      console.log(instance);
      queuePostRenderEffect(() => {
        instance.isDeactivated = false;
        if (instance.a) {
          invokeArrayFns(instance.a);
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeMounted;
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode);
        }
      }, parentSuspense);
    };
    // unmount
    sharedContext.deactivate = (vnode) => {
      const instance = vnode.component;
      move(vnode, storageContainer, null, 1, parentSuspense);
      queuePostRenderEffect(() => {
        // 执行生命周期函数 onDeactivated
        if (instance.da) {
          invokeArrayFns(instance.da);
        }
        const vnodeHook = vnode.props && vnode.props.onVnodeUnmounted;
        if (vnodeHook) {
          invokeVNodeHook(vnodeHook, instance.parent, vnode);
        }
        instance.isDeactivated = true;
      }, parentSuspense);
    };
    function unmount(vnode) {
      resetShapeFlag(vnode);
      _unmount(vnode, instance, parentSuspense, true);
    }
    function pruneCache(filter) {
      cache.forEach((vnode, key) => {
        const name = getComponentName(vnode.type);
        if (name && (!filter || !filter(name))) {
          pruneCacheEntry(key);
        }
      });
    }
    /**
     * 删除缓存
     * @param {*} key
     */
    function pruneCacheEntry(key) {
      const cached = cache.get(key);
      if (!current || cached.type !== current.type) {
        unmount(cached);
      } else if (current) {
        resetShapeFlag(current);
      }
      cache.delete(key);
      keys.delete(key);
    }
    watch(
      () => [props.include, props.exclude],
      ([include, exclude]) => {
        include && pruneCache((name) => matches(include, name));
        exclude && pruneCache((name) => !matches(exclude, name));
      },
      { flush: 'post', deep: true }
    );
    let pendingCacheKey = null;
    const cacheSubtree = () => {
      if (pendingCacheKey != null) {
        cache.set(pendingCacheKey, getInnerChild(instance.subTree));
      }
    };
    onMounted(cacheSubtree);
    onUpdated(cacheSubtree);
    onBeforeUnmount(() => {
      cache.forEach((cached) => {
        const { subTree, suspense } = instance;
        const vnode = getInnerChild(subTree);
        if (cached.type === vnode.type) {
          resetShapeFlag(vnode);
          const da = vnode.component.da;
          da && queuePostRenderEffect(da, suspense);
          return;
        }
        unmount(cached);
      });
    });
    // 返回渲染函数
    return () => {
      pendingCacheKey = null;
      if (!slots.default) {
        return null;
      }
      // 获取默认插槽内容，VNode 数组（需要被 KeepAlive 的组件），
      const children = slots.default();
      const rawVNode = children[0];
      // keep-alive 只允许有一个子组件
      if (children.length > 1) {
        current = null;
        return children;
      } else if (
        !isVNode(rawVNode) ||
        (!(rawVNode.shapeFlag & 4) && !(rawVNode.shapeFlag & 128))
      ) {
        current = null;
        return rawVNode;
      }
      // 组件vnode
      let vnode = getInnerChild(rawVNode);
      // vnode.type = type { render,setup,template,... }
      const comp = vnode.type;
      const name = getComponentName(
        isAsyncWrapper(vnode) ? vnode.type.__asyncResolved || {} : comp
      );
      //
      const { include, exclude, max } = props;
      if (
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      ) {
        current = vnode;
        return rawVNode;
      }
      /**
       * vnode.key == null ? vnode.type : vnode.key
       */
      const key = vnode.key == null ? comp : vnode.key;
      /** 获取缓存的组件vnode */
      const cachedVNode = cache.get(key);
      if (vnode.el) {
        vnode = cloneVNode(vnode);
        if (rawVNode.shapeFlag & 128) {
          rawVNode.ssContent = vnode;
        }
      }
      pendingCacheKey = key;
      if (cachedVNode) {
        // 有缓存内容，不执行挂载组件逻辑，激活组件
        vnode.el = cachedVNode.el;
        vnode.component = cachedVNode.component;
        if (vnode.transition) {
          setTransitionHooks(vnode, vnode.transition);
        }
        vnode.shapeFlag |= 512;
        // key 添加到 keys(set) 末尾
        keys.delete(key);
        keys.add(key);
      } else {
        // 没有缓存，添加缓存中
        keys.add(key);
        // 判断有没有达到最大缓存数量
        if (max && keys.size > parseInt(max, 10)) {
          // 从 set 中删除第一个key
          pruneCacheEntry(keys.values().next().value);
        }
      }
      vnode.shapeFlag |= 256;
      current = vnode;
      return rawVNode;
    };
  },
};
export const KeepAlive = KeepAliveImpl;
/**
 * 检测 pattern 中是否包含 name
 * 正则 test
 * @param {*} pattern
 * @param {*} name
 * @returns
 */
function matches(pattern, name) {
  if (isArray(pattern)) {
    return pattern.some((p) => matches(p, name));
  } else if (isString(pattern)) {
    return pattern.split(',').includes(name);
  } else if (pattern.test) {
    return pattern.test(name);
  }
  return false;
}
/**
 * keepAlive生命周期函数
 * 调用时机为首次挂载
 * 以及每次从缓存中被重新插入时
 * @param {*} hook
 * @param {*} target
 */
export function onActivated(hook, target) {
  registerKeepAliveHook(hook, 'a', target);
}
/**
 * keepAlive生命周期函数
 * 在从 DOM 上移除、进入缓存
 * 以及组件卸载时调用
 * @param {*} hook
 * @param {*} target
 */
export function onDeactivated(hook, target) {
  registerKeepAliveHook(hook, 'da', target);
}
// 函数在 keep-alive 的子组件中被调用
function registerKeepAliveHook(hook, type, target = currentInstance) {
  // .__wdc = with deactivation check
  const wrappedHook =
    hook.__wdc ||
    (hook.__wdc = () => {
      let current = target;
      while (current) {
        if (current.isDeactivated) {
          return;
        }
        current = current.parent;
      }
      return hook();
    });
  // 把生命周期 hook 注入到子组件中

  injectHook(type, wrappedHook, target);

  if (target) {
    /** keep-alive 组件 */
    let current = target.parent;
    // keep-alive的祖先keep-alive实例上注册,
    // <keep-alive> <keep-alive></keep-alive> </keep-alive>
    while (current && current.parent) {
      if (isKeepAlive(current.parent.vnode)) {
        injectToKeepAliveRoot(wrappedHook, type, target, current);
      }
      current = current.parent;
    }
  }
}
function injectToKeepAliveRoot(hook, type, target, keepAliveRoot) {
  // 把 hook 放到 keepAliveRoot[type] 对应的钩子列表的前面
  const injected = injectHook(type, hook, keepAliveRoot, true);
  // 组件(调用keepAlive生命周期函数的组件)卸载时
  // 移除钩子
  onUnmounted(() => {
    remove(keepAliveRoot[type], injected);
  }, target);
}
/**
 * shapeFlag 是否等于 256 / 512
 * 等于,归零.不等于,不变
 * 256 表示需要被keep-live的有状态组件
 * 512 已经被keep-live的有状态组件
 * @param {*} vnode
 */
function resetShapeFlag(vnode) {
  let shapeFlag = vnode.shapeFlag;
  if (shapeFlag & 256) {
    shapeFlag -= 256;
  }
  if (shapeFlag & 512) {
    shapeFlag -= 512;
  }
  vnode.shapeFlag = shapeFlag;
}
/**
 * 是不是 SUSPENSE 组件
 * @param {*} vnode
 * @returns
 */
function getInnerChild(vnode) {
  return vnode.shapeFlag & 128 ? vnode.ssContent : vnode;
}
