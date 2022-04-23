import { inject } from '../apiInject.js'

export const ssrContextKey = Symbol(`ssrContext`)
export const useSSRContext = () => inject(ssrContextKey)
