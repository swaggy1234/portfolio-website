/**
 * Classify dataset columns into numeric visualization dimensions vs metadata.
 */

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
    if (!data || !data.length || !columnName) return false
    const values = data
        .map(function (row) { return row[columnName] })
        .filter(function (v) { return v !== null && v !== undefined && v !== "" })

    if (values.length === 0) return false

    const numericCount = values.filter(function (v) { return Number.isFinite(+v) }).length
    const numericRatio = numericCount / values.length

    return numericRatio >= 0.9
}

function detectYeastColumn(columns) {
    if (!columns || !columns.length) return null
    for (let i = 0; i < YEAST_COLUMN_CANDIDATES.length; i++) {
        const candidate = YEAST_COLUMN_CANDIDATES[i]
        if (columns.indexOf(candidate) !== -1) return candidate
    }
    return null
}

function classifyDatasetColumns(data) {
    if (!data || !data.length) {
        return {
            allColumns: [],
            numericDimensions: [],
            metadataColumns: [],
            yeastColumn: null
        }
    }

    const allColumns = Object.keys(data[0])
    const numericDimensions = allColumns.filter(function (col) {
        return !METADATA_COLUMN_NAMES.has(col)
            && !isInternalProgrammaticColumn(col)
            && isNumericDimension(data, col)
    })
    const metadataColumns = allColumns.filter(function (col) {
        return METADATA_COLUMN_NAMES.has(col)
            || isInternalProgrammaticColumn(col)
            || !isNumericDimension(data, col)
    })
    const yeastColumn = detectYeastColumn(allColumns)

    return {
        allColumns: allColumns,
        numericDimensions: numericDimensions,
        metadataColumns: metadataColumns,
        yeastColumn: yeastColumn
    }
}

function getUniqueMetadataValues(data, columnName) {
    if (!data || !columnName) return []
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
    classifyDatasetColumns: classifyDatasetColumns,
    getUniqueMetadataValues: getUniqueMetadataValues,
    getRowsForSelectedMetadataValues: getRowsForSelectedMetadataValues
}
