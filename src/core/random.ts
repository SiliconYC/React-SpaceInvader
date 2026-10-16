/** xorshift32；独立于 Math.random，所有平台上使用无符号 32 位算术。 */
export function validateSeed(seed: number): number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('随机种子必须是 0～4294967295 的整数');
  }
  return seed >>> 0;
}
export function initialRandomState(seed: number): number {
  return validateSeed(seed) || 0x6d2b79f5;
}
export function nextRandomState(state: number): number {
  let value = state >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}
