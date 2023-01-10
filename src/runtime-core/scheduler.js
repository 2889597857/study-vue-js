import { isArray } from '../shared/index.js'
/**
 * 队列是否正在执行
 */
let isFlushing = false
/**
 * 队列是否在等待执行
 */
let isFlushPending = false

/**
 * 组件更新队列
 * 执行组件DOM更新
 * 允许插队，按 id 从小到大执行
 */
const queue = []
/**
 * 当前正在执行的的 job
 */
let flushIndex = 0
/**
 * 组件更新前队列
 * 执行组件更新前的操作
 * mounted、updated 等生命周期
 * watch
 */
const pendingPreFlushCbs = []
let activePreFlushCbs = null
let preFlushIndex = 0
/**
 * 组件更新后队列
 * 执行组件 DOM 更新之后的任务
 * 允许插队，按 id 从小到大执行
 */
const pendingPostFlushCbs = []
let activePostFlushCbs = null
let postFlushIndex = 0
// 组件更新时异步的
const resolvedPromise = Promise.resolve()
let currentFlushPromise = null
let currentPreFlushParentJob = null

export function nextTick(fn) {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(this ? fn.bind(this) : fn) : p
}
/**
 * 计算出需要插入的位置
 * @param {*} id
 */
function findInsertionIndex(id) {
  let start = flushIndex + 1
  let end = queue.length
  while (start < end) {
    const middle = (start + end) >>> 1
    const middleJobId = getId(queue[middle])
    middleJobId < id ? (start = middle + 1) : (end = middle)
  }
  return start
}
/**
 *
 * job:{
 * id?: number id越小越先执行
 * active?: boolean 是否失效
 * allowRecurse?: boolean 是否允许递归
 * }
 */
// 加入queue
export function queueJob(job) {
  // 去重
  if (
    (!queue.length ||
      !queue.includes(
        job,
        // 如果job允许递归,当前正在执行的 job 不去重
        isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex
      )) &&
    job !== currentPreFlushParentJob
  ) {
    if (job.id == null) {
      // 没有 id 放在队列最后
      queue.push(job)
    } else {
      // 按照 id 大小排序,id越小越先执行,
      queue.splice(findInsertionIndex(job.id), 0, job)
    }
    queueFlush()
  }
}
/**
 * 开始执行队列任务。
 */
function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    // 等待所有组件数据都更新完,开始执行队列
    // 异步执行
    currentFlushPromise = resolvedPromise.then(flushJobs)
  }
}
/**
 * 删除job
 * @param {*} job
 */
export function invalidateJob(job) {
  const i = queue.indexOf(job)
  if (i > flushIndex) {
    queue.splice(i, 1)
  }
}
/**
 * 加入 pre / post 队列
 * @param {*} cb
 * @param {*} activeQueue
 * @param {*} pendingQueue
 * @param {*} index
 */
function queueCb(cb, activeQueue, pendingQueue, index) {
  if (!isArray(cb)) {
    // 去重
    if (
      !activeQueue ||
      !activeQueue.includes(cb, cb.allowRecurse ? index + 1 : index)
    ) {
      pendingQueue.push(cb)
    }
  } else {
    // 如果 cb 是一个数组，它只能是在一个 job 内触发的组件生命周期 hook（而且这些 cb 已经去重过了，可以跳过去重判断）
    pendingQueue.push(...cb)
  }
  queueFlush()
}
/**
 *  加入 Pre 队列
 * @param {Function} callback
 */
export function queuePreFlushCb(cb) {
  queueCb(cb, activePreFlushCbs, pendingPreFlushCbs, preFlushIndex)
}
/**
 * 加入 Post 队列
 * @param {Function} callback
 */
export function queuePostFlushCb(cb) {
  queueCb(cb, activePostFlushCbs, pendingPostFlushCbs, postFlushIndex)
}
/**
 * 执行Pre队列
 */
export function flushPreFlushCbs(seen, parentJob = null) {
  if (pendingPreFlushCbs.length) {
    currentPreFlushParentJob = parentJob
    // 执行前去重
    activePreFlushCbs = [...new Set(pendingPreFlushCbs)]
    // 清空队列
    pendingPreFlushCbs.length = 0

    for (
      preFlushIndex = 0;
      preFlushIndex < activePreFlushCbs.length;
      preFlushIndex++
    ) {
      // 执行任务函数
      activePreFlushCbs[preFlushIndex]()
    }
    // 任务执行完，清空队列
    activePreFlushCbs = null
    preFlushIndex = 0
    currentPreFlushParentJob = null
    // 递归
    flushPreFlushCbs(seen, parentJob)
  }
}
/**
 * 执行Post队列
 */
export function flushPostFlushCbs() {
  if (pendingPostFlushCbs.length) {
    // 执行前去重
    const deduped = [...new Set(pendingPostFlushCbs)]
    pendingPostFlushCbs.length = 0
    if (activePostFlushCbs) {
      activePostFlushCbs.push(...deduped)
      return
    }
    activePostFlushCbs = deduped
    // 按照id从小到大进行排序
    activePostFlushCbs.sort((a, b) => getId(a) - getId(b))
    for (
      postFlushIndex = 0;
      postFlushIndex < activePostFlushCbs.length;
      postFlushIndex++
    ) {
      activePostFlushCbs[postFlushIndex]()
    }
    activePostFlushCbs = null
    postFlushIndex = 0
  }
}
/**
 * 获取组件更新函数 id
 */
const getId = job => (job.id == null ? Infinity : job.id)
/**
 * 开始执行三个队列中的任务
 */
function flushJobs() {
  isFlushPending = false
  isFlushing = true

  // 执行pre队列
  flushPreFlushCbs()

  // 按照id从小到大进行排序
  // 组件更新从父级到子级
  // 父组件更新期间卸载了组件,可以跳过子组件更新
  queue.sort((a, b) => getId(a) - getId(b))
  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex]
      if (job && job.active !== false) {
        // 执行组件更新函数
        job()
      }
    }
  } finally {
    // 队列执行完成后,清空队列
    flushIndex = 0
    queue.length = 0
    // 执行 post 队列
    flushPostFlushCbs()
    isFlushing = false
    currentFlushPromise = null
    // post 执行中可能会有新的job加入队列
    // 循环重新执行所有队列
    if (
      queue.length ||
      pendingPreFlushCbs.length ||
      pendingPostFlushCbs.length
    ) {
      flushJobs()
    }
  }
}
