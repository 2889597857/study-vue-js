import { getCurrentInstance, onUnmounted } from '../src/index.js'

export const noop = () => {}

export function addSubscription (
  subscriptions,
  callback,
  detached,
  onCleanup = noop
) {
  subscriptions.push(callback)
  const removeSubscription = () => {
    const idx = subscriptions.indexOf(callback)
    if (idx > -1) {
      subscriptions.splice(idx, 1)
      onCleanup()
    }
  }
  if (!detached && getCurrentInstance()) {
    onUnmounted(removeSubscription)
  }
  return removeSubscription
}

export function triggerSubscriptions (subscriptions, ...args) {
  subscriptions.slice().forEach(callback => {
    callback(...args)
  })
}
