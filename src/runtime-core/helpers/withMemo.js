import { currentBlock, isBlockTreeEnabled } from '../vnode.js'

export function withMemo (memo, render, cache, index) {
  const cached = cache[index]
  if (cached && isMemoSame(cached, memo)) {
    return cached
  }
  const ret = render()

  // shallow clone
  ret.memo = memo.slice()
  return (cache[index] = ret)
}

export function isMemoSame (cached, memo) {
  const prev = cached.memo
  if (prev.length != memo.length) {
    return false
  }
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== memo[i]) {
      return false
    }
  }

  // make sure to let parent block track it when returning cached
  if (isBlockTreeEnabled > 0 && currentBlock) {
    currentBlock.push(cached)
  }
  return true
}
