export const ignoreSideEffectTags = (node, context) => {
  if (
    node.type === 1 &&
    node.tagType === 0 &&
    (node.tag === 'script' || node.tag === 'style')
  ) {
    context.removeNode()
  }
}
