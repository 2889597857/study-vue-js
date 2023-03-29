const arrayInstrumentations = createArrayInstrumentations()
function createArrayInstrumentations() {
    const instrumentations = {}
        // 查询遍历方法
        ;[('includes', 'indexOf', 'lastIndexOf')].forEach(key => {
            instrumentations[key] = function (...args) {
                // 数组每一项都收集依赖
                for (let i = 0, l = this.length; i < l; i++) {
                    track(this, 'get', i + '')
                }
                // [].includes() / [].indexOf / [].lastIndexOf()
                const res = this[key](...args)

                // 参数有可能是响应式的，函数执行后返回值为 -1 或 false，那就用参数的原始值再试一遍
                if (res === -1 || res === false) {
                    // 没有查询到对应的值，有可能是包装后的响应式数据，有wrapper，引用不同所以
                    // 有可能查不到，尝试去掉wrapper再查询
                    return this[key](...args.map(toRaw))
                } else {
                    return res
                }
            }
        })
        // 改变数组长度的方法
        ;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(key => {
            instrumentations[key] = function (...args) {
                const res = this[key].apply(this, args)
                return res
            }
        })
    return instrumentations
}
function cerateProxy(target) {
    return new Proxy(target, {
        get(target, key, receiver) {
            const result = Reflect.get(target, key, receiver)
            console.log('---get----')
            console.log(key);
            console.log(result);
            return result
        },
        set(target, key, value, receiver) {
            // 设置成功 true 失败 false
            const result = Reflect.set(target, key, value, receiver)
            console.log('---set----')
            console.log(key);
            console.log(value);
            return result
        }
    })
}

let a = cerateProxy([...'abcd'])
// a['push'] == a.push
// 先触发 2 次get，在触发 2 次set
// 第一次 get 获取 push 函数
// 第二次 get 获取当前数组长度
// 第一次 set 设置新值
// 第二次 set 设置了新值，length 发生变化，再次触发 set
// a.push(123)

// 修改值触发一次 set
// a[0] = 1

// 添加新值，索引大于数组长度，触发一次 set
// a[100] = 1

// 触发 3 次 get, indexOf length '0'
a.indexOf('a')

