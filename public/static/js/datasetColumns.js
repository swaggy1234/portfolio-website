/**
 * Classify dataset columns into numeric visualization dimensions vs metadata / categorical.
 */

const columnMetadata = require('./columnMetadata')

const METADATA_COLUMN_NAMES = new Set([
    "Souche",
    "souche",
    "slouche",
    "Slouche",
    "yeast",
    "yeast_type",
    "strain",
    "Strain"
])

/** Case-insensitive exact names for extendData / visprom runtime fields (not SPLOM axes). */
const INTERNAL_PROGRAMMATIC_COLUMN_NAMES = new Set([
    "id",
    "__rowid",
    "rowid",
    "visibility",
    "color",
    "pointsize",
    "point size",
    "r",
    "__comparisonrow"
])

function normalizeColumnName(columnName) {
    return String(columnName || "").trim().toLowerCase()
}

function isInternalProgrammaticColumn(columnName) {
    if (!columnName) return true
    const norm = normalizeColumnName(columnName)
    if (!norm) return true
    if (INTERNAL_PROGRAMMATIC_COLUMN_NAMES.has(norm)) return true
    if (norm.indexOf("visprom") === 0) return true
    if (String(columnName).indexOf("__") === 0) return true
    return false
}

const YEAST_COLUMN_CANDIDATES = [
    "Souche",
    "souche",
    "slouche",
    "Slouche",
    "yeast",
    "yeast_type",
    "strain",
    "Strain"
]

function isNumericDimension(data, columnName) {
    if (!columnName || isInternalProgrammaticColumn(columnName)) return false
    if (columnMetadata.getColumnMetadata(columnName)) {
        return columnMetadata.isNumericDimensionMeta(columnName)
    }
    if (!data || !data.length) return false
    const values = columnMetadata.collectColumnValues(data, columnName)
    if (!values.length) return false
    return columnMetadata.inferColumnType(values, columnName, {}) === "numeric"
}

function detectYeastColumn(columns) {
    if (!columns || !columns.length) return null
    for (let i = 0; i < YEAST_COLUMN_CANDIDATES.length; i++) {
        const candidate = YEAST_COLUMN_CANDIDATES[i]
        if (columns.indexOf(candidate) !== -1) return candidate
    }
    return null
}

/** A column usable to split rows into groups: categorical with at least 2 values. */
function isCategoricalGroupingColumn(data, columnName) {
    if (!columnName || isInternalProgrammaticColumn(columnName)) return false
    if (columnMetadata.getColumnMetadata(columnName)) {
        if (!columnMetadata.isCategoricalDimension(columnName)) return false
        const cats = columnMetadata.getRawCategoryDomain(columnName)
        if (cats.length < 2) return false
        if (data && data.length && cats.length >= data.length) return false
        return true
    }
    const values = columnMetadata.collectColumnValues(data, columnName)
    if (values.length < 2) return false
    const type = columnMetadata.inferColumnType(values, columnName, {
        categoricalColumns: METADATA_COLUMN_NAMES.has(columnName) ? [columnName] : []
    })
    if (type !== "categorical") return false
    const uniqueValues = []
    const seen = new Set()
    for (let i = 0; i < values.length; i++) {
        const key = String(values[i])
        if (!seen.has(key)) {
            seen.add(key)
            uniqueValues.push(key)
        }
    }
    if (uniqueValues.length < 2) return false
    if (data && data.length && uniqueValues.length >= data.length) return false
    return true
}

function detectCategoricalColumns(data, columns) {
    const cols = columns || (data && data.length ? Object.keys(data[0]) : [])
    return cols.filter(function (col) {
        return isCategoricalGroupingColumn(data, col)
    })
}

function classifyDatasetColumns(data, options) {
    const opts = options || {}
    if (!data || !data.length) {
        return {
            allColumns: [],
            numericDimensions: [],
            metadataColumns: [],
            categoricalColumns: [],
            splomDimensions: [],
            yeastColumn: null,
            columnMetadata: {}
        }
    }

    const allColumns = Object.keys(data[0])
    const yeastColumn = detectYeastColumn(allColumns)

    // Known yeast/souche names are always categorical hints.
    const forcedCategorical = allColumns.filter(function (col) {
        return METADATA_COLUMN_NAMES.has(col)
    })

    const skip = allColumns.filter(isInternalProgrammaticColumn)
    const meta = columnMetadata.buildColumnMetadata(data, {
        columns: allColumns,
        skipColumns: skip,
        categoricalColumns: forcedCategorical.concat(opts.categoricalColumns || []),
        numericColumns: opts.numericColumns || [],
        padding: opts.padding
    })

    const numericDimensions = []
    const categoricalColumns = []
    const metadataColumns = []
    const splomDimensions = []

    allColumns.forEach(function (col) {
        if (isInternalProgrammaticColumn(col)) {
            metadataColumns.push(col)
            return
        }
        const entry = meta[col]
        const type = entry && entry.type ? entry.type : "numeric"
        if (type === "categorical") {
            categoricalColumns.push(col)
            metadataColumns.push(col)
            // Categorical columns are eligible SPLOM axes (including Souche).
            if ((entry.categories && entry.categories.length >= 2) ||
                (entry.rawCategories && entry.rawCategories.length >= 2)) {
                splomDimensions.push(col)
            }
        } else {
            numericDimensions.push(col)
            splomDimensions.push(col)
        }
    })

    if (yeastColumn) {
        const yeastIndex = categoricalColumns.indexOf(yeastColumn)
        if (yeastIndex > 0) {
            categoricalColumns.splice(yeastIndex, 1)
            categoricalColumns.unshift(yeastColumn)
        } else if (yeastIndex === -1) {
            categoricalColumns.unshift(yeastColumn)
            if (splomDimensions.indexOf(yeastColumn) === -1) splomDimensions.unshift(yeastColumn)
        }
    }

    return {
        allColumns: allColumns,
        numericDimensions: numericDimensions,
        metadataColumns: metadataColumns,
        categoricalColumns: categoricalColumns,
        splomDimensions: splomDimensions,
        yeastColumn: yeastColumn,
        columnMetadata: meta
    }
}

function getUniqueMetadataValues(data, columnName) {
    if (!data || !columnName) return []
    if (columnMetadata.isCategoricalDimension(columnName)) {
        const raw = columnMetadata.getRawCategoryDomain(columnName)
        if (raw.length) return raw.slice()
    }
    const seen = new Set()
    const out = []
    for (let i = 0; i < data.length; i++) {
        const raw = data[i][columnName]
        if (raw === null || raw === undefined || raw === "") continue
        const val = String(raw)
        if (!seen.has(val)) {
            seen.add(val)
            out.push(val)
        }
    }
    return out.sort()
}

function getRowsForSelectedMetadataValues(data, columnName, selectedValues) {
    if (!data || !columnName || !selectedValues || !selectedValues.length) return data
    const selected = new Set(selectedValues.map(String))
    return data.filter(function (row) {
        return selected.has(String(row[columnName]))
    })
}

module.exports = {
    METADATA_COLUMN_NAMES: METADATA_COLUMN_NAMES,
    INTERNAL_PROGRAMMATIC_COLUMN_NAMES: INTERNAL_PROGRAMMATIC_COLUMN_NAMES,
    YEAST_COLUMN_CANDIDATES: YEAST_COLUMN_CANDIDATES,
    normalizeColumnName: normalizeColumnName,
    isInternalProgrammaticColumn: isInternalProgrammaticColumn,
    isNumericDimension: isNumericDimension,
    detectYeastColumn: detectYeastColumn,
    isCategoricalGroupingColumn: isCategoricalGroupingColumn,
    detectCategoricalColumns: detectCategoricalColumns,
    classifyDatasetColumns: classifyDatasetColumns,
    getUniqueMetadataValues: getUniqueMetadataValues,
    getRowsForSelectedMetadataValues: getRowsForSelectedMetadataValues
}
