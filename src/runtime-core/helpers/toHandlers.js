import { toHandlerKey } from '../../shared/index.js'

/**
 * For prefixing keys in v-on="obj" with "on"
 * @private
 */
export function toHandlers (obj) {
  const ret = {}
  for (const key in obj) {
    ret[toHandlerKey(key)] = obj[key]
  }
  return ret
}
