/**
 * 判断一个值是否在字符串内
 * @param {*} str 字符串
 * @param {*} expectsLowerCase 是否要求小写
 * @returns 返回一个函数
 */
export function makeMap (str, expectsLowerCase) {
  const map = Object.create(null)
  const list = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  // !undefined => true
  // !!undefined => false
  // !!true => true
  return expectsLowerCase ? val => !!map[val.toLowerCase()] : val => !!map[val]
}
