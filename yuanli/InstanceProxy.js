function createInstance() {
  const instance = {
    ctx: {},
    proxy: null,
    withProxy: null,
    props: { a: 123 },
  };
  instance.ctx = { _: instance };
  instance.proxy = new Proxy(instance.ctx, {
    get(target, key, receiver) {
      console.log('target', '---', target);
      console.log('key', '---', key);
      console.log('receiver', '---', receiver);
      return Reflect.get(target, key,  receiver);
    },
  });
  return instance;
}

const render = (ctx) => {

};
const instance = createInstance();
console.log(instance.proxy._.props);
