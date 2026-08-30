/**
 * Central column metadata: categorical vs numeric typing, labels, scales, jitter.
 *
 * Typing rule (modular):
 * - numeric  → values mostly parse as numbers → continuous SPLOM/main axes
 * - categorical → non-numeric values with ≥2 distinct categories (or explicit hint/override)
 * - known yeast/souche names are hinted categorical so coded 1/2/3 still group correctly
 *
 * Complexity (n = rows, c = columns, k = categories << n):
 * - buildColumnMetadata: O(n * c) once per dataset load
 * - type/label/color lookups: O(1)
 * - draw: O(n) per cell
 */
const d3 = require('d3')

const DEFAULT_THRESHOLDS = {
  numericRatioMin: 0.9,
  maxUniqueForCategorical: 12,
  uniqueRatioMax: 0.2,
  encodedMaxUnique: 12,
  encodedUniqueRatioMax: 0.15
}

const DEFAULT_CATEGORY_PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
  '#393b79', '#637939', '#8c6d31', '#843c39', '#7b4173'
]

let thresholds = Object.assign({}, DEFAULT_THRESHOLDS)
let columnMetadataStore = {}
let categoryMappingsStore = {}
let categoryColorState = {}
let activeColorBy = null
let userForcedCategorical = {}
let userForcedNumeric = {}
const hexRgbaCache = Object.create(null)

function setThresholds(next) {
  thresholds = Object.assign({}, DEFAULT_THRESHOLDS, next || {})
}

function getThresholds() {
  return Object.assign({}, thresholds)
}

function setCategoryMappings(mappings) {
  categoryMappingsStore = mappings && typeof mappings === 'object' ? mappings : {}
}

function getCategoryMappings() {
  return categoryMappingsStore
}

function setUserColumnTypeOverride(columnName, type) {
  if (!columnName) return
  if (type === 'categorical') {
    userForcedCategorical[columnName] = true
    delete userForcedNumeric[columnName]
  } else if (type === 'numeric') {
    userForcedNumeric[columnName] = true
    delete userForcedCategorical[columnName]
  } else {
    delete userForcedCategorical[columnName]
    delete userForcedNumeric[columnName]
  }
}

function clearUserColumnTypeOverrides() {
  userForcedCategorical = {}
  userForcedNumeric = {}
}

/** O(n) collect — prefer analyzeColumnInOnePass for load. */
function collectColumnValues(data, columnName) {
  const values = []
  if (!data || !columnName) return values
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row) continue
    const v = row[columnName]
    if (v === null || v === undefined || v === '') continue
    values.push(v)
  }
  return values
}

/**
 * Single O(n) pass: unique keys, numeric ratio, min/max.
 * Avoids separate collect + unique + extent scans.
 */
function analyzeColumnInOnePass(data, columnName) {
  let nonEmpty = 0
  let numericCount = 0
  let min = Infinity
  let max = -Infinity
  const seen = new Set()
  const uniqueRaw = []

  if (!data || !columnName) {
    return {
      nonEmpty: 0,
      numericCount: 0,
      uniqueRaw: uniqueRaw,
      min: 0,
      max: 1
    }
  }

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row) continue
    const v = row[columnName]
    if (v === null || v === undefined || v === '') continue
    nonEmpty += 1
    const key = String(v)
    if (!seen.has(key)) {
      seen.add(key)
      uniqueRaw.push(key)
    }
    const num = Number(v)
    if (Number.isFinite(num)) {
      numericCount += 1
      if (num < min) min = num
      if (num > max) max = num
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0
    max = 1
  }

  return {
    nonEmpty: nonEmpty,
    numericCount: numericCount,
    uniqueRaw: uniqueRaw,
    min: min,
    max: max
  }
}

function inferColumnTypeFromStats(stats, columnName, metaHints) {
  const meta = metaHints || {}
  if (userForcedCategorical[columnName]) return 'categorical'
  if (userForcedNumeric[columnName]) return 'numeric'

  const catSet = meta.categoricalSet
  const numSet = meta.numericSet
  if (catSet && catSet.has(columnName)) return 'categorical'
  if (numSet && numSet.has(columnName)) return 'numeric'
  if (!catSet && meta.categoricalColumns && meta.categoricalColumns.indexOf(columnName) !== -1) {
    return 'categorical'
  }
  if (!numSet && meta.numericColumns && meta.numericColumns.indexOf(columnName) !== -1) {
    return 'numeric'
  }

  const nonEmpty = stats.nonEmpty || 0
  if (!nonEmpty) return 'numeric'

  const uniqueCount = (stats.uniqueRaw && stats.uniqueRaw.length) || 0
  const numericRatio = (stats.numericCount || 0) / Math.max(nonEmpty, 1)

  // Mostly-parseable numbers stay numeric — even with few unique levels
  // (DoE factors like temperature / N_ini). Low-cardinality alone must NOT
  // force categorical; that collapsed continuous SPLOM axes into point bands.
  // True categoricals are either non-numeric (species) or name-hinted (Souche).
  if (numericRatio >= thresholds.numericRatioMin) return 'numeric'

  if (uniqueCount >= 2) return 'categorical'
  return 'numeric'
}

/** Back-compat wrapper used by tests / external callers. */
function inferColumnType(values, columnName, metadata) {
  const list = values || []
  let numericCount = 0
  let min = Infinity
  let max = -Infinity
  const seen = new Set()
  const uniqueRaw = []
  for (let i = 0; i < list.length; i++) {
    const v = list[i]
    if (v === null || v === undefined || v === '') continue
    const key = String(v)
    if (!seen.has(key)) {
      seen.add(key)
      uniqueRaw.push(key)
    }
    const num = Number(v)
    if (Number.isFinite(num)) {
      numericCount += 1
      if (num < min) min = num
      if (num > max) max = num
    }
  }
  return inferColumnTypeFromStats({
    nonEmpty: list.length,
    numericCount: numericCount,
    uniqueRaw: uniqueRaw,
    min: min,
    max: max
  }, columnName, metadata)
}

function sortCategoryKeys(keys) {
  return keys.slice().sort(function (a, b) {
    const na = Number(a)
    const nb = Number(b)
    const aNum = Number.isFinite(na) && String(na) === String(a).trim()
    const bNum = Number.isFinite(nb) && String(nb) === String(b).trim()
    if (aNum && bNum) return na - nb
    if (aNum) return -1
    if (bNum) return 1
    return String(a).localeCompare(String(b))
  })
}

function buildValueToLabel(columnName, uniqueRawKeys) {
  const mapping = categoryMappingsStore[columnName] || {}
  const valueToLabel = Object.create(null)
  const categories = []
  const labelSeen = new Set()
  const sorted = sortCategoryKeys(uniqueRawKeys)
  for (let i = 0; i < sorted.length; i++) {
    const rawKey = sorted[i]
    const label = mapping[rawKey] != null
      ? String(mapping[rawKey])
      : (mapping[Number(rawKey)] != null ? String(mapping[Number(rawKey)]) : String(rawKey))
    valueToLabel[rawKey] = label
    if (!labelSeen.has(label)) {
      labelSeen.add(label)
      categories.push(label)
    }
  }
  return { valueToLabel: valueToLabel, categories: categories, rawCategories: sorted }
}

function extentFromMinMax(min, max, padding) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) {
    const flat = min === 0 ? 1 : Math.abs(min) * 0.1
    return [min - flat, max + flat]
  }
  const pad = padding != null ? padding : 0.08
  const span = max - min
  return [min - span * pad, max + span * pad]
}

function toHintSets(opts) {
  const categoricalColumns = opts.categoricalColumns || []
  const numericColumns = opts.numericColumns || []
  return {
    categoricalColumns: categoricalColumns,
    numericColumns: numericColumns,
    categoricalSet: new Set(categoricalColumns),
    numericSet: new Set(numericColumns)
  }
}

/**
 * O(n * c) once per load. One pass per column.
 */
function buildColumnMetadata(data, options) {
  const opts = options || {}
  const columns = opts.columns || (data && data.length ? Object.keys(data[0]) : [])
  const skipSet = new Set(opts.skipColumns || [])
  const hints = toHintSets(opts)
  const store = Object.create(null)

  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci]
    if (!col || skipSet.has(col)) continue

    const stats = analyzeColumnInOnePass(data, col)
    const type = inferColumnTypeFromStats(stats, col, hints)

    if (type === 'categorical') {
      const mapped = buildValueToLabel(col, stats.uniqueRaw)
      store[col] = {
        type: 'categorical',
        categories: mapped.categories,
        rawCategories: mapped.rawCategories,
        valueToLabel: mapped.valueToLabel
      }
    } else {
      store[col] = {
        type: 'numeric',
        extent: extentFromMinMax(stats.min, stats.max, opts.padding)
      }
    }
  }

  columnMetadataStore = store
  return store
}

function setColumnMetadata(store) {
  columnMetadataStore = store || Object.create(null)
}

function getColumnMetadata(dim) {
  if (!dim) return null
  return columnMetadataStore[dim] || null
}

function getAllColumnMetadata() {
  return columnMetadataStore
}

function isCategoricalDimension(dim) {
  const meta = columnMetadataStore[dim]
  return !!(meta && meta.type === 'categorical')
}

function isNumericDimensionMeta(dim) {
  const meta = columnMetadataStore[dim]
  if (meta) return meta.type === 'numeric'
  return true
}

function getColumnType(dim) {
  const meta = columnMetadataStore[dim]
  return meta && meta.type ? meta.type : 'numeric'
}

/** O(1) map lookup. */
function getCategoryLabel(dim, value) {
  if (value === null || value === undefined || value === '') return ''
  const key = String(value)
  const meta = columnMetadataStore[dim]
  if (meta && meta.valueToLabel && meta.valueToLabel[key] != null) {
    return meta.valueToLabel[key]
  }
  const mapping = categoryMappingsStore[dim]
  if (mapping) {
    if (mapping[key] != null) return String(mapping[key])
    if (mapping[Number(key)] != null) return String(mapping[Number(key)])
  }
  return key
}

/** Returns cached domain array (do not mutate). O(1). */
function getCategoryDomain(dim) {
  const meta = columnMetadataStore[dim]
  if (meta && meta.categories) return meta.categories
  return EMPTY_ARRAY
}

function getRawCategoryDomain(dim) {
  const meta = columnMetadataStore[dim]
  if (meta && meta.rawCategories) return meta.rawCategories
  return getCategoryDomain(dim)
}

const EMPTY_ARRAY = Object.freeze([])

function getNumericExtent(dim) {
  const meta = columnMetadataStore[dim]
  if (meta && meta.extent) return meta.extent
  return DEFAULT_EXTENT
}

const DEFAULT_EXTENT = Object.freeze([0, 1])

function getDimensionScale(dim, range, options) {
  const opts = options || {}
  const r = range || [0, 1]
  if (isCategoricalDimension(dim)) {
    return d3.scalePoint()
      .domain(getCategoryDomain(dim))
      .range(r)
      .padding(opts.pointPadding != null ? opts.pointPadding : 0.5)
  }
  const extent = opts.domain || getNumericExtent(dim)
  return d3.scaleLinear()
    .domain(extent)
    .range(r)
}

function simpleHash(str) {
  let h = 2166136261
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** O(1) for numeric ids; O(|axisName|) otherwise. Deterministic. */
function jitterValue(pointId, axisName, amount) {
  const amt = amount != null ? amount : 6
  let hash
  if (typeof pointId === 'number' && Number.isFinite(pointId)) {
    // Mix numeric id with a short axis salt — no string alloc of the id.
    hash = (Math.imul(pointId | 0, 2654435761) ^ simpleHash(axisName)) >>> 0
  } else {
    hash = simpleHash(String(pointId) + '-' + String(axisName))
  }
  return ((hash % 1000) / 1000 - 0.5) * amt
}

function getAxisPlotValue(dim, row) {
  if (!row || !dim) return null
  if (isCategoricalDimension(dim)) return getCategoryLabel(dim, row[dim])
  const n = Number(row[dim])
  return Number.isFinite(n) ? n : null
}

function defaultCategoryColor(label, index) {
  const idx = index != null ? index : (simpleHash(label) % DEFAULT_CATEGORY_PALETTE.length)
  return DEFAULT_CATEGORY_PALETTE[idx % DEFAULT_CATEGORY_PALETTE.length]
}

/** O(k) once when switching color-by — not per point. */
function ensureCategoryColors(dim) {
  if (!dim || !isCategoricalDimension(dim)) return EMPTY_OBJECT
  if (!categoryColorState[dim]) categoryColorState[dim] = Object.create(null)
  const colors = categoryColorState[dim]
  const domain = getCategoryDomain(dim)
  for (let i = 0; i < domain.length; i++) {
    const label = domain[i]
    if (!colors[label]) colors[label] = defaultCategoryColor(label, i)
  }
  return colors
}

const EMPTY_OBJECT = Object.freeze({})

/** O(1) after ensureCategoryColors was called for this dim. */
function getCategoryColor(dim, valueOrLabel) {
  if (!dim) return null
  const label = getCategoryLabel(dim, valueOrLabel)
  const colors = categoryColorState[dim]
  if (colors && colors[label]) return colors[label]
  return defaultCategoryColor(label)
}

function setCategoryColor(dim, label, color) {
  if (!dim || !label) return
  if (!categoryColorState[dim]) categoryColorState[dim] = Object.create(null)
  categoryColorState[dim][String(label)] = color
}

function getCategoryColorState() {
  return categoryColorState
}

function setCategoryColorState(state) {
  categoryColorState = state && typeof state === 'object' ? state : {}
}

function getActiveColorBy() {
  return activeColorBy
}

function setActiveColorBy(dim) {
  if (!dim || dim === 'none' || dim === 'None') {
    activeColorBy = null
    return activeColorBy
  }
  if (dim === 'selection' || dim === 'Selection') {
    activeColorBy = 'selection'
    return activeColorBy
  }
  activeColorBy = dim
  if (isCategoricalDimension(dim)) ensureCategoryColors(dim)
  return activeColorBy
}

/** O(1) fill lookup for draw loops. */
function getCategoryFillForRow(row) {
  if (!activeColorBy || activeColorBy === 'selection' || !row) return null
  const meta = columnMetadataStore[activeColorBy]
  if (!meta || meta.type !== 'categorical') return null
  return getCategoryColor(activeColorBy, row[activeColorBy])
}

function hexToRgbaArray(hex, alpha) {
  const a = alpha != null ? alpha : 1
  const key = String(hex || '') + '|' + a
  if (hexRgbaCache[key]) return hexRgbaCache[key].slice()
  const h = String(hex || '').replace('#', '')
  let rgba
  if (h.length !== 3 && h.length !== 6) {
    rgba = [0.2, 0.4, 0.8, a]
  } else {
    const full = h.length === 3
      ? h.split('').map(function (c) { return c + c }).join('')
      : h
    rgba = [
      parseInt(full.slice(0, 2), 16) / 255,
      parseInt(full.slice(2, 4), 16) / 255,
      parseInt(full.slice(4, 6), 16) / 255,
      a
    ]
  }
  hexRgbaCache[key] = rgba
  return rgba.slice()
}

function shouldSkipNumericMethod(dim) {
  return isCategoricalDimension(dim)
}

function formatDimensionBadge(dim) {
  return isCategoricalDimension(dim) ? 'categorical' : 'numeric'
}

module.exports = {
  DEFAULT_THRESHOLDS: DEFAULT_THRESHOLDS,
  DEFAULT_CATEGORY_PALETTE: DEFAULT_CATEGORY_PALETTE,
  setThresholds: setThresholds,
  getThresholds: getThresholds,
  setCategoryMappings: setCategoryMappings,
  getCategoryMappings: getCategoryMappings,
  setUserColumnTypeOverride: setUserColumnTypeOverride,
  clearUserColumnTypeOverrides: clearUserColumnTypeOverrides,
  inferColumnType: inferColumnType,
  analyzeColumnInOnePass: analyzeColumnInOnePass,
  buildColumnMetadata: buildColumnMetadata,
  setColumnMetadata: setColumnMetadata,
  getColumnMetadata: getColumnMetadata,
  getAllColumnMetadata: getAllColumnMetadata,
  isCategoricalDimension: isCategoricalDimension,
  isNumericDimensionMeta: isNumericDimensionMeta,
  getColumnType: getColumnType,
  getCategoryLabel: getCategoryLabel,
  getCategoryDomain: getCategoryDomain,
  getRawCategoryDomain: getRawCategoryDomain,
  getNumericExtent: getNumericExtent,
  getDimensionScale: getDimensionScale,
  simpleHash: simpleHash,
  jitterValue: jitterValue,
  getAxisPlotValue: getAxisPlotValue,
  defaultCategoryColor: defaultCategoryColor,
  ensureCategoryColors: ensureCategoryColors,
  getCategoryColor: getCategoryColor,
  setCategoryColor: setCategoryColor,
  getCategoryColorState: getCategoryColorState,
  setCategoryColorState: setCategoryColorState,
  getActiveColorBy: getActiveColorBy,
  setActiveColorBy: setActiveColorBy,
  getCategoryFillForRow: getCategoryFillForRow,
  hexToRgbaArray: hexToRgbaArray,
  shouldSkipNumericMethod: shouldSkipNumericMethod,
  formatDimensionBadge: formatDimensionBadge,
  collectColumnValues: collectColumnValues
}
