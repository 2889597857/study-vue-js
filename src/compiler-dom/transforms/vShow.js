import { V_SHOW } from '../runtimeHelpers.js'

export const transformShow = (dir, node, context) => {
  return { props: [], needRuntime: context.helper(V_SHOW) }
}