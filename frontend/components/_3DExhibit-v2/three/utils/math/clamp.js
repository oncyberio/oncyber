/**
 * Clamp a number
 *
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} value - value
 * @return {number}
 * @memberof Math
 * @example
 *
 *     Clamp(0,1, 10)
 */

const Clamp = function clamp(min, max, value) {
    return Math.min(Math.max(value, min), max)
}

export default Clamp;
