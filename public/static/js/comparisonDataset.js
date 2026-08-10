/**
 * Multi-dataset / Pareto-front comparison helpers.
 */

const d3 = require("d3")
const datasetStore = require("./datasetStore.js")
const datasetColumns = require("./datasetColumns.js")

const MIN_SHARED_DIMENSIONS = 2

const COMPARISON_POINT_RGBA = [0.92, 0.45, 0.1, 0.28]
const COMPARISON_POINT_RGBA_HIGHLIGHT = [0.92, 0.45, 0.1, 0.92]

function computeSharedDimensions(primaryDims, comparisonDims) {
    const compSet = new Set(comparisonDims || [])
    return (primaryDims || []).filter(function (dim) { return compSet.has(dim) })
}

function analyzeDimensionMatch(primaryDims, comparisonDims) {
    const shared = computeSharedDimensions(primaryDims, comparisonDims)
    const sharedSet = new Set(shared)
    const unmatchedPrimary = (primaryDims || []).filter(function (d) { return !sharedSet.has(d) })
    const unmatchedComparison = (comparisonDims || []).filter(function (d) { return !sharedSet.has(d) })
    return {
        sharedDimensions: shared,
        unmatchedPrimaryDimensions: unmatchedPrimary,
        unmatchedComparisonDimensions: unmatchedComparison
    }
}

function getNumericColumnNames(rows) {
    if (!rows || !rows.length) return []
    const classified = datasetColumns.classifyDatasetColumns(rows)
    return classified.numericDimensions
}

function extendComparisonRow(d, i) {
    d.color = new Set()
    d.pointSize = 0.5
    d.id = i
    d.__rowId = i
    d.__comparisonRow = true
    d.visibility = true
    return d
}

function prepareComparisonDataset(rawRows) {
    return (rawRows || []).map(function (d, i) { return extendComparisonRow(Object.assign({}, d), i) })
}

function parseComparisonFile(file) {
    return new Promise(function (resolve, reject) {
        if (!file) {
            reject(new Error("No file selected."))
            return
        }
        const reader = new FileReader()
        reader.onload = function (evt) {
            try {
                const text = String(evt.target.result || "")
                const name = String(file.name || "Comparison dataset")
                    .replace(/\.(csv|json|txt|tsv)$/i, "")
                    .trim() || "Comparison dataset"
                let rows
                if (/\.json$/i.test(file.name || "")) {
                    const parsed = JSON.parse(text)
                    rows = Array.isArray(parsed) ? parsed : (parsed && parsed.data) || []
                    if (!Array.isArray(rows) || !rows.length) {
                        throw new Error("JSON must be an array of row objects.")
                    }
                } else {
                    rows = datasetStore.parseDatasetText(text)
                }
                if (!rows.length) throw new Error("Comparison dataset is empty.")
                resolve({ rows: rows, label: name })
            } catch (err) {
                reject(err)
            }
        }
        reader.onerror = function () { reject(new Error("Could not read file.")) }
        reader.readAsText(file)
    })
}

function buildComparisonDomainMap(primaryData, comparisonData, dimensions, overviewOptions) {
    const splomMod = require("./splom.js")
    const opts = Object.assign({}, overviewOptions || {})
    const map = {}
    for (let i = 0; i < dimensions.length; i++) {
        const dim = dimensions[i]
        const values = []
        const addValues = function (data) {
            if (!data) return
            for (let j = 0; j < data.length; j++) {
                const v = Number(data[j][dim])
                if (Number.isFinite(v)) values.push(v)
            }
        }
        addValues(primaryData)
        addValues(comparisonData)
        if (!values.length) {
            map[dim] = [0, 1]
            continue
        }
        const pseudoRow = values.map(function (v, idx) {
            const row = {}
            row[dim] = v
            row.__rowId = idx
            return row
        })
        map[dim] = splomMod.getGlobalDomain(pseudoRow, dim, opts.padding, opts)
    }
    return map
}

function getPairKey(xDim, yDim) {
    return [xDim, yDim].sort().join("|")
}

function formatComparisonSummary(primaryRows, comparisonRows, matchInfo) {
    const lines = [
        "Comparison dataset loaded.",
        "Primary rows: " + (primaryRows ? primaryRows.length : 0),
        "Comparison rows: " + (comparisonRows ? comparisonRows.length : 0),
        "Shared dimensions: " + ((matchInfo.sharedDimensions && matchInfo.sharedDimensions.length) || 0),
        "Primary-only dimensions: " + ((matchInfo.unmatchedPrimaryDimensions && matchInfo.unmatchedPrimaryDimensions.length) || 0),
        "Comparison-only dimensions: " + ((matchInfo.unmatchedComparisonDimensions && matchInfo.unmatchedComparisonDimensions.length) || 0)
    ]
    if ((matchInfo.unmatchedPrimaryDimensions && matchInfo.unmatchedPrimaryDimensions.length) ||
        (matchInfo.unmatchedComparisonDimensions && matchInfo.unmatchedComparisonDimensions.length)) {
        lines.push("Some dimensions do not match and will be hidden in comparison mode.")
    }
    return lines.join("\n")
}

module.exports = {
    MIN_SHARED_DIMENSIONS: MIN_SHARED_DIMENSIONS,
    COMPARISON_POINT_RGBA: COMPARISON_POINT_RGBA,
    COMPARISON_POINT_RGBA_HIGHLIGHT: COMPARISON_POINT_RGBA_HIGHLIGHT,
    computeSharedDimensions: computeSharedDimensions,
    analyzeDimensionMatch: analyzeDimensionMatch,
    getNumericColumnNames: getNumericColumnNames,
    prepareComparisonDataset: prepareComparisonDataset,
    parseComparisonFile: parseComparisonFile,
    buildComparisonDomainMap: buildComparisonDomainMap,
    getPairKey: getPairKey,
    formatComparisonSummary: formatComparisonSummary
}
