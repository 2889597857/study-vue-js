## 函数
### 插值表达式相关函数

  toDisplayString 处理插值表达式 "{{ interpolation  }}"
### 指令相关函数
resolveDirective 编译指令
invokeDirectiveHook 指令生命周期

### 内置组件 component
resolveDynamicComponent



## 常见参数/属性 
### type

1. 组件中写的JS

```js
{
    components:{},
    props:{},
    emits:[],
    setup(){},
 	
	...
}
```



### vnode instance 和 render函数渲染结果



### ReactiveEffect

 在四个地方被调用

1.  setupRenderEffect()

   创建组件更新函数，一定会执行。

   ```js
   const effect = (instance.effect = new ReactiveEffect(
       componentUpdateFn,
       () => queueJob(instance.update),
       instance.scope
   ))
   ```

2.  ComputedRefImpl

   创建computed时才会被调用

   ```js
   const Num = computed(()=>{})
   ```

   ```js
   this.effect = new ReactiveEffect(getter, () => {
       if (!this._dirty) {
           this._dirty = true
           triggerRefValue(this)
       }
   })
   ```

3. doWatch

   使用watch时才会被调用

   ```js
   watch(()=>{},()=>{})
   ```

   ```js
   const effect = new ReactiveEffect(getter, scheduler)
   ```

4. effect

   ```js
    const _effect = new ReactiveEffect(fn)
   ```

   



1. 如何确保 
2.  
3. 