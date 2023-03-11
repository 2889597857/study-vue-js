import { ref } from '../reactivity/index.js';
import { isFunction, isObject } from '../shared/index.js';
import { currentInstance } from './component.js';
import { isKeepAlive } from './components/KeepAlive.js';
import { queueJob } from './scheduler.js';
import { createVNode } from './vnode.js';

export const isAsyncWrapper = (i) => !!i.type.__asyncLoader;
/**
 * 定义异步组件
 * @param {object|function} source
 * @returns
 */
export function defineAsyncComponent(source) {
  if (isFunction(source)) {
    source = { loader: source };
  }
  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    timeout,
    suspensible = true,
    onError: userOnError,
  } = source;
  let pendingRequest = null;
  let resolvedComp;
  // 重试次数
  let retries = 0;
  // 加载失败，重试
  const retry = () => {
    retries++;
    pendingRequest = null;
    return load();
  };
  // loader常用来结合import()引入单文件组件来构成异步组件。
  // 加载异步组件
  const load = () => {
    let thisRequest;
    return (
      pendingRequest ||
      (thisRequest = pendingRequest =
        loader()
          .catch((err) => {
            err = err instanceof Error ? err : new Error(String(err));
            // 有userOnError时，失败重试
            if (userOnError) {
              return new Promise((resolve, reject) => {
                const userRetry = () => resolve(retry());
                const userFail = () => reject(err);
                userOnError(err, userRetry, userFail, retries + 1);
              });
            } else {
              throw err;
            }
          })
          .then((comp) => {
            if (thisRequest !== pendingRequest && pendingRequest) {
              return pendingRequest;
            }
            // 处理 es 模块
            // interop module default
            if (
              comp &&
              (comp.__esModule || comp[Symbol.toStringTag] === 'Module')
            ) {
              comp = comp.default;
            }
            if (comp && !isObject(comp) && !isFunction(comp)) {
              throw new Error(`Invalid async component load result: ${comp}`);
            }
            resolvedComp = comp;
            return comp;
          }))
    );
  };
  return defineComponent({
    name: 'AsyncComponentWrapper',
    __asyncLoader: load,
    get __asyncResolved() {
      return resolvedComp;
    },
    setup() {
      const instance = currentInstance;
      // 组件加载完成 createVNode
      if (resolvedComp) {
        return () => createInnerComp(resolvedComp, instance);
      }
      const onError = () => {
        pendingRequest = null;
      };
      // Suspense 加载并返回
      if ((suspensible && instance.suspense) || false) {
        return load()
          .then((comp) => {
            return () => createInnerComp(comp, instance);
          })
          .catch((err) => {
            onError(err);
            return () =>
              errorComponent
                ? createVNode(errorComponent, { error: err })
                : null;
          });
      }
      const loaded = ref(false);
      const error = ref();
      // 默认值 !!200 = true
      const delayed = ref(!!delay);
      // 默认值 200ms
      if (delay) {
        setTimeout(() => {
          delayed.value = false;
        }, delay);
      }
      if (timeout != null) {
        setTimeout(() => {
          // 既没有拿到结果，又没有异常，则超时处理
          if (!loaded.value && !error.value) {
            const err = new Error(
              `Async component timed out after ${timeout}ms.`
            );
            onError(err);
            error.value = err;
          }
        }, timeout);
      }
      // 开始加载异步组件
      load()
        .then(() => {
          loaded.value = true;
          // 对于KeepAlive的内容，加载成功后进行强制更新
          if (instance.parent && isKeepAlive(instance.parent.vnode)) {
            queueJob(instance.parent.update);
          }
        })
        .catch((err) => {
          onError(err);
          error.value = err;
        });
      return () => {
        if (loaded.value && resolvedComp) {
          // 加载成功
          return createInnerComp(resolvedComp, instance);
        } else if (error.value && errorComponent) {
          // 加载异常
          return createVNode(errorComponent, { error: error.value });
        } else if (loadingComponent && !delayed.value) {
          // 加载中
          return createVNode(loadingComponent);
        }
      };
    },
  });
}

export function createInnerComp(comp, { vnode: { ref, props, children } }) {
  const vnode = createVNode(comp, props, children);
  vnode.ref = ref;
  return vnode;
}
