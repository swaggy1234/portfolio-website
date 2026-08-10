/**
 * SPLOM caches — rows, contours, and dimension-set layout only.
 * Selection state is never cached.
 */

const ROWS_CACHE_MAX = 512
const CONTOUR_CACHE_MAX = 256
const DIMENSION_SET_CACHE_MAX = 32
const DOMAIN_CACHE_MAX = 256

const DEBUG_SPLOM_CACHE = false

const splomRowsCache = new Map()
const splomContourCache = new Map()
const splomDimensionSetCache = new Map()
const splomDomainCache = new Map()

let datasetVersion = 0
let datasetLabel = "current"
let rowScopeKey = "all"

function bumpDatasetVersion(label) {
    datasetVersion += 1
    if (label) datasetLabel = String(label)
}

function getDatasetId() {
    return datasetLabel + "@v" + datasetVersion
}

function setRowScopeKey(scopeKey) {
    rowScopeKey = scopeKey ? String(scopeKey) : "all"
}

function getRowScopeKey() {
    return rowScopeKey
}

function invalidateSplomRowsCache(reason) {
    if (DEBUG_SPLOM_CACHE) console.log("[SPLOM cache] invalidate rows:", reason)
    splomRowsCache.clear()
    splomContourCache.clear()
}

function invalidateSplomDomainCache(reason) {
    if (DEBUG_SPLOM_CACHE) console.log("[SPLOM cache] invalidate domains:", reason)
    splomDomainCache.clear()
}

function invalidateSplomCaches(reason) {
    if (DEBUG_SPLOM_CACHE) console.log("[SPLOM cache] invalidate all:", reason)
    splomRowsCache.clear()
    splomContourCache.clear()
    splomDimensionSetCache.clear()
    splomDomainCache.clear()
}

function staticOptionsKeyPart(options) {
    const o = options || {}
    return [
        o.useRobustDomain ? "robust" : "full",
        o.drawContours !== false ? "contours" : "no-contours",
        o.baseAlpha != null ? o.baseAlpha : "",
        o.contourThresholds != null ? o.contourThresholds : "",
        o.contourBandwidth != null ? o.contourBandwidth : "",
        o.contourStrokeOpacity != null ? o.contourStrokeOpacity : "",
        o.contourStrokeWidth != null ? o.contourStrokeWidth : "",
        o.padding != null ? o.padding : ""
    ].join(":")
}

function getRowsCacheKey(xDim, yDim, cacheTag, dataLength) {
    return [
        getDatasetId(),
        getRowScopeKey(),
        xDim,
        yDim,
        dataLength != null ? "n" + dataLength : "n0",
        cacheTag || "primary"
    ].join("|")
}

function getDomainCacheKey(dimension, overviewOptions, dataLength) {
    return [
        getDatasetId(),
        getRowScopeKey(),
        dimension,
        dataLength != null ? "n" + dataLength : "n0",
        staticOptionsKeyPart(overviewOptions)
    ].join("|")
}

function getContourCacheKey(xDim, yDim, cellW, cellH, overviewOptions) {
    return [
        getDatasetId(),
        getRowScopeKey(),
        xDim,
        yDim,
        cellW,
        cellH,
        staticOptionsKeyPart(overviewOptions)
    ].join("|")
}

function getFamilyLayoutKeyPart(familyLayout) {
    if (!familyLayout || !familyLayout.allFamilies || !familyLayout.allFamilies.length) {
        return "no-fam"
    }
    const famPart = familyLayout.allFamilies
        .map(function (f) { return f.name + ":" + f.dimCount })
        .join(",")
    const expPart = (familyLayout.expanded || []).slice().sort().join(",")
    return "fam:" + famPart + "|exp:" + expPart
}

function getDimensionSetCacheKey(dimsForSplom, overviewOptions, frontsKey, familyLayout) {
    return [
        getDatasetId(),
        (dimsForSplom || []).join(","),
        staticOptionsKeyPart(overviewOptions),
        frontsKey || "all-fronts",
        getFamilyLayoutKeyPart(familyLayout)
    ].join("|")
}

function trimMap(map, max) {
    while (map.size > max) {
        map.delete(map.keys().next().value)
    }
}

function getCachedDomain(key) {
    const hit = splomDomainCache.get(key)
    if (hit && DEBUG_SPLOM_CACHE) console.log("[SPLOM] domain cache hit", key)
    return hit || null
}

function setCachedDomain(key, domain) {
    if (DEBUG_SPLOM_CACHE) console.log("[SPLOM] domain cache miss", key)
    splomDomainCache.set(key, domain)
    trimMap(splomDomainCache, DOMAIN_CACHE_MAX)
}

function getCachedRows(key) {
    const hit = splomRowsCache.get(key)
    if (hit && DEBUG_SPLOM_CACHE) console.log("[SPLOM] rows cache hit", key)
    return hit || null
}

function setCachedRows(key, rows) {
    if (DEBUG_SPLOM_CACHE) console.log("[SPLOM] rows cache miss", key)
    splomRowsCache.set(key, rows)
    trimMap(splomRowsCache, ROWS_CACHE_MAX)
}

function getCachedContour(key) {
    const hit = splomContourCache.get(key)
    if (hit && DEBUG_SPLOM_CACHE) console.log("[SPLOM] contour cache hit", key)
    return hit || null
}

function setCachedContour(key, contourSvg) {
    if (DEBUG_SPLOM_CACHE) console.log("[SPLOM] contour cache miss", key)
    splomContourCache.set(key, contourSvg)
    trimMap(splomContourCache, CONTOUR_CACHE_MAX)
}

function getCachedDimensionSet(key) {
    const hit = splomDimensionSetCache.get(key)
    if (hit && DEBUG_SPLOM_CACHE) console.log("[SPLOM cache] dimension set hit", key)
    return hit || null
}

function setCachedDimensionSet(key, entry) {
    if (DEBUG_SPLOM_CACHE) console.log("[SPLOM cache] dimension set miss", key)
    splomDimensionSetCache.set(key, entry)
    trimMap(splomDimensionSetCache, DIMENSION_SET_CACHE_MAX)
}

module.exports = {
    bumpDatasetVersion: bumpDatasetVersion,
    getDatasetId: getDatasetId,
    setRowScopeKey: setRowScopeKey,
    getRowScopeKey: getRowScopeKey,
    invalidateSplomCaches: invalidateSplomCaches,
    invalidateSplomRowsCache: invalidateSplomRowsCache,
    invalidateSplomDomainCache: invalidateSplomDomainCache,
    getRowsCacheKey: getRowsCacheKey,
    getDomainCacheKey: getDomainCacheKey,
    getContourCacheKey: getContourCacheKey,
    getDimensionSetCacheKey: getDimensionSetCacheKey,
    getFamilyLayoutKeyPart: getFamilyLayoutKeyPart,
    getCachedRows: getCachedRows,
    setCachedRows: setCachedRows,
    getCachedDomain: getCachedDomain,
    setCachedDomain: setCachedDomain,
    getCachedContour: getCachedContour,
    setCachedContour: setCachedContour,
    getCachedDimensionSet: getCachedDimensionSet,
    setCachedDimensionSet: setCachedDimensionSet,
    staticOptionsKeyPart: staticOptionsKeyPart
}
