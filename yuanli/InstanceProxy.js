const hasOwn = (val, key) => hasOwnProperty.call(val, key);
const PublicInstanceProxy = {
  get({ _: instance }, key) {
    const { ctx, setupState, props, accessCache } = instance;
    const n = accessCache[key];
    if (n !== undefined) {
      switch (n) {
        case 1:
          return setupState[key];
        case 2:
          return ctx[key];
        case 3:
          return props[key];
      }
    } else if (hasOwn(setupState, key)) {
      accessCache[key] = 1;
      return setupState[key];
    } else if (hasOwn(ctx, key)) {
      accessCache[key] = 2;
      return ctx[key];
    } else if (hasOwn(props, key)) {
      accessCache[key] = 3;
      return props[key];
    }
  },
};

function createInstance() {
  const instance = {
    ctx: {},
    proxy: null,
    withProxy: null,
    props: { a: 123 },
    setupState: {},
    accessCache: {},
  };
  instance.ctx = { _: instance };
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxy);
  return instance;
}

const render = (ctx) => {
  console.log(ctx.props);

};
const instance = createInstance();
render.call(instance.proxy, instance.proxy);

