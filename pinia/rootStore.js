import { getCurrentInstance, inject } from '../src/index.js'
export let activePinia
export const setActivePinia = pinia => (activePinia = pinia)
export const getActivePinia = () =>
  (getCurrentInstance() && inject(piniaSymbol)) || activePinia
export const piniaSymbol = Symbol('pinia')
