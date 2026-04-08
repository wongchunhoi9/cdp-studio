// Parameter Dependency Resolver
// Provides dynamic min/max values based on input/output durations and cross-param constraints

/**
 * Dependency types for parameter limits
 * @typedef {Object} Dependency
 * @property {string} type - 'constant' | 'inputDuration' | 'outputDuration' | 'param' | 'expression' | 'computed'
 * @property {*} [value] - For 'constant': the literal value
 * @property {string} [param] - For 'param': reference to another parameter ID
 * @property {string} [outputParam] - For 'outputDuration': the param that controls output duration
 * @property {Function} [fn] - For 'expression'/'computed': function receiving context
 * @property {*} [fallback] - Default value if dependency cannot be resolved
 * @property {number} [scale] - Multiplier for duration-based deps (e.g., 0.5 for half duration)
 * @property {number} [offset] - Added to the resolved value
 */

/**
 * Resolves parameter limits based on dependencies
 * @param {Object} param - Parameter definition with optional dependsOn
 * @param {Object} context - Resolution context
 * @param {number} context.inputDuration - Duration of input file in seconds
 * @param {number} context.outputDuration - Expected output duration in seconds
 * @param {Object} context.paramValues - Current parameter values
 * @returns {{min: number, max: number}} Resolved limits
 */
export function resolveParamLimits(param, context = {}) {
  const { inputDuration = 0, outputDuration = 0, paramValues = {} } = context

  if (!param) return { min: 0, max: 1 }

  const resolveDep = (dep) => {
    if (dep === undefined || dep === null) return undefined

    switch (dep.type) {
      case 'constant':
        return dep.value

      case 'inputDuration':
        const inputBase = inputDuration > 0 ? inputDuration : (dep.fallback ?? 1)
        const inputScaled = dep.scale !== undefined ? inputBase * dep.scale : inputBase
        return dep.offset !== undefined ? inputScaled + dep.offset : inputScaled

      case 'outputDuration':
        const outParam = dep.param || dep.outputParam
        const outBase = outParam && paramValues[outParam] > 0
          ? paramValues[outParam]
          : (outputDuration > 0 ? outputDuration : (dep.fallback ?? 1))
        const outScaled = dep.scale !== undefined ? outBase * dep.scale : outBase
        return dep.offset !== undefined ? outScaled + dep.offset : outScaled

      case 'param':
        const refValue = paramValues[dep.param]
        if (refValue !== undefined) {
          const scaled = dep.scale !== undefined ? refValue * dep.scale : refValue
          return dep.offset !== undefined ? scaled + dep.offset : scaled
        }
        return dep.fallback ?? 0

      case 'expression':
        if (typeof dep.fn === 'function') {
          try {
            return dep.fn(context)
          } catch (e) {
            console.warn('Expression evaluation failed:', e)
            return dep.fallback ?? 0
          }
        }
        return dep.fallback ?? 0

      case 'computed':
        if (typeof dep.compute === 'function') {
          try {
            return dep.compute(context)
          } catch (e) {
            console.warn('Computed value failed:', e)
            return dep.fallback ?? 0
          }
        }
        return dep.fallback ?? 0

      default:
        return dep.fallback ?? 0
    }
  }

  // Resolve min and max
  let min = param.min ?? 0
  let max = param.max ?? 1

  if (param.dependsOn?.min !== undefined) {
    const resolved = resolveDep(param.dependsOn.min)
    if (resolved !== undefined) min = resolved
  }

  if (param.dependsOn?.max !== undefined) {
    const resolved = resolveDep(param.dependsOn.max)
    if (resolved !== undefined) max = resolved
  }

  // Ensure min <= max
  if (min > max) {
    // For cyclic or inverted dependencies, use the original static bounds
    min = param.min ?? 0
    max = param.max ?? 1
  }

  return { min, max }
}

/**
 * Validates a parameter value against its resolved limits
 * @param {Object} param - Parameter definition
 * @param {*} value - Value to validate
 * @param {Object} context - Resolution context
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateParamValue(param, value, context) {
  if (!param || value === undefined || value === null) {
    return { valid: true }
  }

  const { min, max } = resolveParamLimits(param, context)

  // Type validation
  if (param.type === 'number' && typeof value !== 'number') {
    return { valid: false, error: `Expected number, got ${typeof value}` }
  }

  if (param.type === 'number') {
    if (value < min) {
      return { valid: false, error: `Value ${value} below minimum ${min.toFixed(3)}` }
    }
    if (value > max) {
      return { valid: false, error: `Value ${value} above maximum ${max.toFixed(3)}` }
    }
  }

  // Cross-parameter constraints (e.g., endlevel >= startlevel)
  if (param.constraints) {
    for (const constraint of param.constraints) {
      const result = evaluateConstraint(constraint, value, context)
      if (!result.valid) return result
    }
  }

  return { valid: true }
}

/**
 * Evaluates a cross-parameter constraint
 * @param {Object} constraint
 * @param {*} value - Current parameter value
 * @param {Object} context
 * @returns {{valid: boolean, error?: string}}
 */
function evaluateConstraint(constraint, value, context) {
  const { paramValues = {} } = context

  switch (constraint.type) {
    case 'gteParam':
      const gteRef = paramValues[constraint.param]
      if (gteRef !== undefined && value < gteRef) {
        return {
          valid: false,
          error: `Must be >= ${constraint.param} (${gteRef})`
        }
      }
      return { valid: true }

    case 'lteParam':
      const lteRef = paramValues[constraint.param]
      if (lteRef !== undefined && value > lteRef) {
        return {
          valid: false,
          error: `Must be <= ${constraint.param} (${lteRef})`
        }
      }
      return { valid: true }

    case 'gtParam':
      const gtRef = paramValues[constraint.param]
      if (gtRef !== undefined && value <= gtRef) {
        return {
          valid: false,
          error: `Must be > ${constraint.param} (${gtRef})`
        }
      }
      return { valid: true }

    case 'ltParam':
      const ltRef = paramValues[constraint.param]
      if (ltRef !== undefined && value >= ltRef) {
        return {
          valid: false,
          error: `Must be < ${constraint.param} (${ltRef})`
        }
      }
      return { valid: true }

    case 'custom':
      if (typeof constraint.fn === 'function') {
        try {
          const result = constraint.fn(value, context)
          if (result === true) return { valid: true }
          return { valid: false, error: typeof result === 'string' ? result : 'Invalid value' }
        } catch (e) {
          return { valid: false, error: 'Constraint evaluation failed' }
        }
      }
      return { valid: true }

    default:
      return { valid: true }
  }
}

/**
 * Resolves the time domain for breakpoint curves
 * @param {Object} param - Parameter with supportsBreakpoint
 * @param {Object} context
 * @returns {{min: number, max: number, label: string}} Time domain for curve editor
 */
export function resolveBreakpointTimeDomain(param, context = {}) {
  const { inputDuration = 0, outputDuration = 0, paramValues = {} } = context

  if (!param?.supportsBreakpoint) {
    return { min: 0, max: 10, label: 's' }
  }

  const domain = param.breakpointTimeDomain || { type: 'outputDuration', param: 'outdur' }

  switch (domain.type) {
    case 'inputDuration':
      return {
        min: 0,
        max: Math.max(inputDuration, 1),
        label: 's (input duration)'
      }

    case 'outputDuration':
      const outDur = domain.param && paramValues[domain.param] > 0
        ? paramValues[domain.param]
        : (outputDuration > 0 ? outputDuration : 10)
      return {
        min: 0,
        max: outDur,
        label: 's (output duration)'
      }

    case 'constant':
      return {
        min: domain.min ?? 0,
        max: domain.max ?? 100,
        label: domain.label ?? 's'
      }

    case 'computed':
      if (typeof domain.compute === 'function') {
        try {
          return domain.compute(context)
        } catch (e) {
          console.warn('Time domain computation failed:', e)
        }
      }
      return { min: 0, max: 10, label: 's' }

    default:
      return { min: 0, max: 10, label: 's' }
  }
}

/**
 * Converts breakpoint curve points to CDP text file format
 * @param {Array<{time: number, value: number}>} points - Curve points in display coords
 * @param {Object} param - Parameter definition
 * @param {Object} context
 * @returns {Array<{time: number, value: number}>} Points in CDP format
 */
export function convertBreakpointToCDP(points, param, context = {}) {
  if (!Array.isArray(points) || points.length < 2) return []

  const { min, max } = resolveParamLimits(param, context)
  const timeDomain = resolveBreakpointTimeDomain(param, context)

  return points.map(p => ({
    time: p.time, // Already in seconds
    value: min + (p.value / 100) * (max - min) // Convert from percentage to actual
  }))
}

/**
 * Factory for common dependency patterns
 */
export const Dep = {
  /** Constant value */
  constant: (value) => ({ type: 'constant', value }),

  /** Input file duration */
  inputDuration: (options = {}) => ({
    type: 'inputDuration',
    ...options
  }),

  /** Output duration from a parameter */
  outputDuration: (param, options = {}) => ({
    type: 'outputDuration',
    param,
    ...options
  }),

  /** Reference to another parameter's value */
  param: (paramId, options = {}) => ({
    type: 'param',
    param: paramId,
    ...options
  }),

  /** Half of input duration (for ambitus) */
  halfInputDuration: (options = {}) => ({
    type: 'inputDuration',
    scale: 0.5,
    ...options
  }),

  /** Expression that must be > another param */
  greaterThan: (paramId, delta = 0) => ({
    type: 'param',
    param: paramId,
    offset: delta,
    fallback: 0
  }),

  /** Custom expression function */
  expr: (fn, fallback = 0) => ({
    type: 'expression',
    fn,
    fallback
  })
}

/**
 * Factory for common constraint patterns
 */
export const Constraint = {
  /** Value must be >= another parameter */
  gte: (paramId) => ({ type: 'gteParam', param: paramId }),

  /** Value must be <= another parameter */
  lte: (paramId) => ({ type: 'lteParam', param: paramId }),

  /** Value must be > another parameter */
  gt: (paramId) => ({ type: 'gtParam', param: paramId }),

  /** Value must be < another parameter */
  lt: (paramId) => ({ type: 'ltParam', param: paramId }),

  /** Custom validation function */
  custom: (fn) => ({ type: 'custom', fn })
}
