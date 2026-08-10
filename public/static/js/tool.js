//"use strict";

//var lasso = require ('./lasso.js')
const  d3  = require('d3');

 
const scaterplot = require('./scaterplot.js')
const sploom = require('./splom.js')
const chartRender = require('./chartRenderShared.js')
const polyparser = require('./polyparser.js')
const sel = require('./selection.js')
const firebase = require('./save.js') 
const loader = require('./loader.js') 
const datasetStore = require('./datasetStore.js')
const dimensionFamilies = require('./dimensionFamilies.js')
const comparisonDataset = require('./comparisonDataset.js')
const datasetColumns = require('./datasetColumns.js')
const soucheComparison = require('./soucheComparison.js')
const soucheComparisonStorage = require('./soucheComparisonStorage.js')

const  math  = require('mathjs')
const cloneDeep = require('lodash/clonedeep');
var update = require('react-addons-update');

var $ = require('jquery');
const { array } = require('stardust-core');
const { range } = require('mathjs');
const { active } = require('d3');
window.$ = $; 
//require('bootstrap');

// ==========================
// PERFORMANCE INSTRUMENTATION
// ==========================

const PERF_PREFIX = "[Perf]"

function isPerfLoggingEnabled() {
    if (typeof window !== "undefined" && window.__vispromPerfLogging === false) return false
    return true
}

function perfStart(label) {
    if (!isPerfLoggingEnabled()) return function () {}
    const fullLabel = label.indexOf(PERF_PREFIX) === 0 ? label : PERF_PREFIX + " " + label
    console.time(fullLabel)
    return function () {
        console.timeEnd(fullLabel)
    }
}

function timeBlock(label, fn) {
    if (!isPerfLoggingEnabled()) return fn()
    const fullLabel = label.indexOf(PERF_PREFIX) === 0 ? label : PERF_PREFIX + " " + label
    console.time(fullLabel)
    try {
        return fn()
    } finally {
        console.timeEnd(fullLabel)
    }
}

function timeBlockIfSlow(label, fn, thresholdMs) {
    if (!isPerfLoggingEnabled()) return fn()
    const limit = thresholdMs == null ? 8 : thresholdMs
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()
    const result = fn()
    const elapsed = ((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - t0
    if (elapsed >= limit) {
        console.log(PERF_PREFIX + " " + label + " (slow)", elapsed.toFixed(1) + "ms")
    }
    return result
}

if (typeof window !== "undefined") {
    window.__vispromPerfLogging = window.__vispromPerfLogging !== false
    console.log(PERF_PREFIX + " instrumentation active (set window.__vispromPerfLogging = false to disable)")
}

// ==========================
// VISUAL CONFIG
// ==========================

const VIS_CONFIG = {
    point: {
        defaultOpacity: 0.25,
        selectedOpacity: 0.95,
        brushPreviewOpacity: 0.98,
        brushOutsideOpacity: 0.25,
        brushOutsideDensityOpacity: 0.12,
        defaultRadius: 2.5,
        selectedRadius: 4,
        overlapRadius: 5,
        overlapStroke: "#111827",
        overlapStrokeWidth: 2,
        selectedStrokeWidth: 1,
        brushPreviewColor: "#00ff00",
        fallbackChipColor: "#888888",
        chipBorder: "#111827"
    },
    splom: {
        domainPadding: 0.08
    },
    selectionPanel: {
        fullRefreshDebounceMs: 120,
        overlapRefreshDebounceMs: 80
    }
}

function getBrushOutsideOpacity() {
    return mainChartMode === "density"
        ? VIS_CONFIG.point.brushOutsideDensityOpacity
        : VIS_CONFIG.point.brushOutsideOpacity
}

let cEnum = {

    RED :       {string : "#e66465"                         , array: [1, 0, 0, 1]          ,  order:0 },
    GREEN:      {string : "#00ff00"            , array: [0, 1, 0, 1]          ,  order:1 },
    BLUE:       {string : "#0000ff"            , array: [0, 0, 1, 1]          ,  order:2 },
    ORANGE:     {string : "#eb9532"         , array: [0.9, 0.6, 0.2, 1]    ,  order:3 },
    PINK:       {string : "#ff1493"         , array: [1, 0.1, 0.6, 1]      ,  order:4 },
    CIAN:       {string : "#00ffff"             , array: [0, 1, 1, 1]          ,  order:5 },
    YELLOW :    {string : "#ffff00"          , array:  [1, 1, 0, 1]         ,  order:6 },
    PURPLE:     {string : "#9500ff"          , array:  [0.6, 0, 1, 1]       ,  order:7 },
    BROWN:      {string : "#502800"            , array:  [0.4, 0.2, 0, 1]     ,  order:8 },

    OLIVE :       {string : "#93c00a"                         , array: [0.576, 0.752, 0.039]          ,  order:9 },
    RASPBERRY:    {string : "#a23963"            , array: [0.6, 0.2, 0.4]          ,  order:10 },
    LAVENDER:     {string : "#9c59b1"            , array: [0.6, 0.3, 0.7]          ,  order:11 },
    GOLD:         {string : "#f1ad13"         , array: [0.9, 0.7, 0.1]    ,  order:12 },
    STRAWBERRY:   {string : "#bb0346"         , array: [0.7, 0.0, 0.3]      ,  order:13 },
    JADE:         {string : "#01a586"             , array: [0.0, 0.6, 0.5]          ,  order:14 },
    GRAPE:        {string : "#6f61ab"          , array:  [0.4, 0.4, 0.7]         ,  order:15 },
    DUNE:         {string : "#d1b345"          , array:  [0.8, 0.7, 0.3]       ,  order:16 },
    CLEMENTINE:   {string : "#e67504"            , array:  [0.9, 0.4, 0.0]     ,  order:17 },
    

  };


let selections = [
    {color: cEnum.BLUE  , displayName: "Non Selected"   , cname: "Blue"   , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.GREEN , displayName: "Selection 1"          , cname: "Green"  , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.RED   , displayName: "Selection 2"            , cname: "Red"    , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.ORANGE, displayName: "Selection 3"         , cname: "Orange" , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.PINK  , displayName: "Selection 4"           , cname: "Pink"   , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.CIAN  , displayName: "Selection 5"           , cname: "Cian"   , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
] 

let reserve = [
    {color: cEnum.PURPLE , displayName: "Selection 17" , cname: "Purple"  , content: new Set(),  originCol: [], originOP: null,    rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.YELLOW , displayName: "Selection 16" , cname:"Yellow"   , content: new Set(),  originCol: [], originOP: null,    rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.BROWN  , displayName: "Selection 15"  , cname: "Brown"   , content: new Set(),  originCol: [] , originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    
    {color: cEnum.OLIVE , displayName: "Selection 14"   , cname: "olive"  , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.RASPBERRY   , displayName: "Selection 13"     , cname: "raspberry"    , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.LAVENDER, displayName: "Selection 12"  , cname: "lavender" , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.GOLD  , displayName: "Selection 11"    , cname: "gold"   , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.STRAWBERRY  , displayName: "Selection 10"    , cname: "strawberry"   , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},

    {color: cEnum.JADE , displayName: "Selection 9"   , cname: "jade"  , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.GRAPE   , displayName: "Selection 8"     , cname: "grape"    , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.DUNE, displayName: "Selection 7"  , cname: "dune" , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},
    {color: cEnum.CLEMENTINE  , displayName: "Selection 6"    , cname: "clementine"   , content: new Set(),  originCol: [], originOP: null,   rep: null, class:"", visibility : true, isolate: false},

]

//let selMinMax = [ //{ [cEnum.BLUE] : ""  , [cEnum.GREEN] : ""   , [cEnum.RED] : ""   , [cEnum.ORANGE] : "",  [cEnum.PINK] : "", [cEnum.CIAN] : "" }, 
                    //]

//const obj = {nameAction :"---", callparam:[], data : [], timestamp : Date.now()}

let current_selectionType = 1       ;
let current_color = []//selections[2],];

let provOn = false


let nonDispDims     = null 

let datum           = null
let sampleData      = []
let ranges          = {}
let dimensions      = null
let allDimensions   = []
let allColumns      = []
let metadataColumns = []
let numericDimensions = []
let yeastColumn     = null
let availableYeastTypes = []
let currentSoucheIndex = 0
let currentSouche = null
let selectedYeastTypes = []
let yeastMode = "overlay"
let soucheTriangleCompareActive = false
let triangleLowerYeast = null
let triangleUpperYeast = null
let mainChartYeastView = "overlay"
// "Main Chart Settings" controls for user-tunable UI (selection layers + density contours).
let mainChartSettingsSelectionsTarget = 10
let mainChartSettingsContourLevels = 8
let savedYeastPairComparisons = []
let openedSoucheComparisons = []
let selectionTarget = "active"
let selectionMemoryByContext = {}
let splomClickTimer = null
let pendingSplomClickRevert = null
let splomCellClickState = {}
let setYeastPanelStatus = null
let selectedColumns = []
let currentDimensionFamilies = {}
let expandedFamilies = new Set()
let familyMapWarningsEl = null
let setFamilyPanelStatus = null
let setSplomColumnFilterStatus = null
let tableDimCheckboxDelegationBound = false
let customDimensionExpressions = []
///////////////
let mainviewSvg     = null
let mvX             = null
let mvY             = null
let selList         = null
let colpick         = null
let selType_buttons = null
let colorOp_buttons = null
let grpAct_buttons  = null
let tableView_table = null
let countTable      = null
let splom           = null

let variance    = {}
let mean        = {}

let historySvg3 = null
let historySvg2 = null

///////
//Logging
let userId = "anonymous"
let maxSplomAcc   = { v : 1}

let viewHistory   = []
let savedFavs = []
let savedFavsEntries = []

let dimVisitcount = {}
let totalDimVisitcount = 0

let viewVisitcount = {}

let history = null
let favorites = null
let favIndex = []

let globalLoss = 0

let cache = []
let finalLog  = []


let savedEntries =[]

let onlineLogActive = true

let mainChartMode = "original"
let mainChartMvX = null
let mainChartMvY = null

let comparisonDatasetRows = null
let primaryDatasetLabel = "Dataset 1"
let comparisonDatasetLabel = "Dataset 2"
let sharedDimensions = []
let unmatchedPrimaryDimensions = []
let unmatchedComparisonDimensions = []
let splomMode = "single"
let mainChartViewMode = "overlay"
let activeDatasetSource = "primary"
let comparisonDatasetVersion = 0
let rowById = new Map()
let soucheRowsIndex = null
let soucheRowsIndexVersion = -1
let soucheRowsIndexVersionSeed = 0
let splomDisplayRowsCache = null
let splomDisplayRowsCacheKey = null
let splomZoomScale = 1
let splomBaseWidth = null
let splomBaseHeight = null

const SPLOM_MIN_ZOOM = 0.02
const SPLOM_MAX_ZOOM = 4
const SPLOM_ZOOM_SPEED = 0.002
const SPLOM_FOCUS_BUFFER_PX = 72

////////////////
//Main container
let c = d3.select(".grid-container")
// 


function isPointInVisibleSplomSelection(d) {
    if (!d || !selections) return false
    if (!selectionMembershipIndexDirty) {
        const rowId = d.__rowId != null ? d.__rowId : d.id
        const memberships = getSelectionMembershipsFast(rowId, getSoucheKeyForPoint(d))
        for (let i = 0; i < memberships.length; i++) {
            const layer = memberships[i].layer
            if (layer && layer.visibility !== false) return true
        }
        return false
    }
    for (let i = 0; i < selections.length; i++) {
        const layer = selections[i]
        if (layer && layer.cname !== "Blue" && layer.visibility !== false && layer.content.has(d)) {
            return true
        }
    }
    return false
}

function getActiveSelectionLayer() {
    if (!current_color || !current_color.length) return null
    return current_color[0]
}

function isPointInActiveSelection(d) {
    const layer = getActiveSelectionLayer()
    if (!layer || !d) return false
    return layer.content.has(d)
}

function isPointInAnyColoredSelection(d) {
    if (!d || !selections) return false
    if (!selectionMembershipIndexDirty) {
        const rowId = d.__rowId != null ? d.__rowId : d.id
        return getSelectionMembershipsFast(rowId, getSoucheKeyForPoint(d)).length > 0
    }
    for (let i = 1; i < selections.length; i++) {
        const layer = selections[i]
        if (layer && layer.content.has(d)) return true
    }
    return false
}

function findSelectionLayerByCname(cname) {
    if (!cname || !selections) return null
    for (let i = 0; i < selections.length; i++) {
        const layer = selections[i]
        if (layer && layer.cname === cname) return layer
    }
    return null
}

let selectionOverlapPanel = null
let annotationDebounceTimers = {}
let selectedIntersectionLayerIds = []

function getColoredSelectionLayers() {
    const layers = []
    if (!selections) return layers
    for (let i = 1; i < selections.length; i++) {
        const layer = selections[i]
        if (layer) {
            ensureSelectionLayerMeta(layer)
            layers.push(layer)
        }
    }
    return layers
}

function ensureSelectionLayerMeta(layer) {
    if (!layer || layer.cname === "Blue") return layer
    if (!layer.id) layer.id = layer.cname || ("selection-" + Date.now())
    if (!layer.label) layer.label = layer.displayName || layer.cname || layer.id
    if (layer.annotation == null) layer.annotation = ""
    if (!layer.createdAt) layer.createdAt = new Date().toISOString()
    if (!layer.updatedAt) layer.updatedAt = layer.createdAt
    if (!layer.selectionsBySouche) layer.selectionsBySouche = {}
    if (!layer.displayName) layer.displayName = layer.label
    return layer
}

function ensureAllColoredSelectionLayersMeta() {
    getColoredSelectionLayers()
}

function findSelectionLayerById(layerId) {
    if (!layerId) return null
    for (let i = 1; i < selections.length; i++) {
        const layer = selections[i]
        if (!layer) continue
        ensureSelectionLayerMeta(layer)
        if (layer.id === layerId || layer.cname === layerId) return layer
    }
    return null
}

// ==========================
// SELECTION MEMBERSHIP INDEX
// ==========================

let selectionMembershipIndex = new Map()
let selectionMembershipIndexDirty = true

function getSelectionMembershipIndexKey(soucheKey, rowId) {
    return String(soucheKey || "__ALL__") + "::" + String(rowId)
}

function invalidateSelectionMembershipIndex() {
    selectionMembershipIndexDirty = true
}

function buildSelectionMembershipEntry(layer) {
    ensureSelectionLayerMeta(layer)
    return {
        layerId: layer.id,
        layer: layer,
        label: layer.label || layer.displayName || layer.id,
        color: layer.color && layer.color.string ? layer.color.string : "",
        annotation: layer.annotation || ""
    }
}

function addSelectionMembershipToIndex(nextIndex, soucheKey, rowId, layer, membershipBase) {
    const key = getSelectionMembershipIndexKey(soucheKey, rowId)
    let bucket = nextIndex.get(key)
    if (!bucket) {
        bucket = { entries: [], layerIds: new Set() }
        nextIndex.set(key, bucket)
    }
    if (bucket.layerIds.has(layer.id)) return
    bucket.layerIds.add(layer.id)
    bucket.entries.push(membershipBase)
}

function rebuildSelectionMembershipIndex() {
    const endPerf = perfStart("rebuildSelectionMembershipIndex")
    try {
        const nextIndex = new Map()
        for (let i = 1; i < selections.length; i++) {
            const layer = selections[i]
            if (!layer || layer.cname === "Blue") continue
            const membershipBase = buildSelectionMembershipEntry(layer)

            const buckets = layer.selectionsBySouche || {}
            const soucheKeys = Object.keys(buckets)
            for (let sk = 0; sk < soucheKeys.length; sk++) {
                const soucheKey = soucheKeys[sk]
                const rowIds = buckets[soucheKey] || []
                for (let j = 0; j < rowIds.length; j++) {
                    addSelectionMembershipToIndex(nextIndex, soucheKey, rowIds[j], layer, membershipBase)
                }
            }

            if (layer.content) {
                layer.content.forEach(function (d) {
                    if (!d) return
                    const rowId = d.__rowId != null ? d.__rowId : d.id
                    if (rowId == null) return
                    addSelectionMembershipToIndex(
                        nextIndex,
                        getSoucheKeyForPoint(d),
                        rowId,
                        layer,
                        membershipBase
                    )
                })
            }
        }
        const flatIndex = new Map()
        nextIndex.forEach(function (bucket, key) {
            flatIndex.set(key, bucket.entries)
        })
        selectionMembershipIndex = flatIndex
        selectionMembershipIndexDirty = false
    } finally {
        endPerf()
    }
}

function ensureSelectionMembershipIndex() {
    if (selectionMembershipIndexDirty) {
        rebuildSelectionMembershipIndex()
    }
}

function getSelectionMembershipsFast(rowId, soucheKey) {
    if (rowId == null) return []
    ensureSelectionMembershipIndex()
    return selectionMembershipIndex.get(getSelectionMembershipIndexKey(soucheKey, rowId)) || []
}

function getSelectionMembershipsForRowSlow(rowId, soucheKey) {
    const memberships = []
    for (let i = 1; i < selections.length; i++) {
        const layer = selections[i]
        if (!layer) continue
        ensureSelectionLayerMeta(layer)
        if (!isRowIdInLayer(rowId, layer, soucheKey)) continue
        memberships.push({
            layerId: layer.id,
            label: layer.label || layer.displayName || layer.id,
            color: layer.color && layer.color.string ? layer.color.string : "",
            annotation: layer.annotation || ""
        })
    }
    return memberships
}

function getSoucheKeyForPoint(d) {
    if (!d) return currentSouche || "__ALL__"
    if (yeastColumn && d[yeastColumn] != null && d[yeastColumn] !== "") {
        return String(d[yeastColumn])
    }
    return currentSouche || getCurrentVisibleSouche() || "__ALL__"
}

function getCurrentVisibleSouche() {
    if (isMainChartSoucheNavigatorActive() && currentSouche) return currentSouche
    if (selectedYeastTypes && selectedYeastTypes.length === 1) return selectedYeastTypes[0]
    return currentSouche
}

function getSplomSoucheKey(cellEl) {
    if (cellEl) {
        const cellKey = cellEl.getAttribute("data-visit-souche-key")
        if (cellKey) return cellKey
        if (isSoucheCompareModeActive()) {
            const tri = cellEl.getAttribute("data-triangle-source")
            if (tri === "upper" && triangleUpperYeast) return String(triangleUpperYeast)
            if (tri === "lower" && triangleLowerYeast) return String(triangleLowerYeast)
        }
    }
    return getActiveSplomSoucheKey()
}

function getActiveSplomSoucheKey() {
    if (isSoucheCompareModeActive()) {
        if (activeDatasetSource === "comparison") {
            return triangleUpperYeast != null ? String(triangleUpperYeast) : "upper"
        }
        return triangleLowerYeast != null ? String(triangleLowerYeast) : "lower"
    }
    const visible = getCurrentVisibleSouche()
    if (visible) return String(visible)
    if (selectedYeastTypes && selectedYeastTypes.length > 1) {
        return selectedYeastTypes.slice().map(String).sort().join("|")
    }
    return "__ALL__"
}

function getSplomVisitCountKey(xDim, yDim, cellEl) {
    return getSplomSoucheKey(cellEl) + "|" + xDim + "_" + yDim
}

function getMainChartVisitCountKey(xDim, yDim) {
    if (isSoucheCompareModeActive()) {
        const soucheKey = activeDatasetSource === "comparison"
            ? String(triangleUpperYeast || "upper")
            : String(triangleLowerYeast || "lower")
        return soucheKey + "|" + xDim + "_" + yDim
    }
    if (isSplomCompareModeActive()) {
        const soucheKey = activeDatasetSource === "comparison"
            ? String(comparisonDatasetLabel || "upper")
            : String(primaryDatasetLabel || "lower")
        return soucheKey + "|" + xDim + "_" + yDim
    }
    return getSplomVisitCountKey(xDim, yDim, null)
}

function getSoucheKeyForSelectionContext(ctxKey) {
    const soucheKeys = getSoucheKeysFromSelectionContextKey(ctxKey)
    if (soucheKeys.length === 1) return soucheKeys[0]
    if (soucheKeys.length > 1) return soucheKeys.join("|")
    return currentSouche || "__ALL__"
}

function addRowIdToLayerSouche(layer, rowId, soucheKey) {
    if (!layer || rowId == null || layer.cname === "Blue") return
    ensureSelectionLayerMeta(layer)
    if (!layer.selectionsBySouche[soucheKey]) layer.selectionsBySouche[soucheKey] = []
    if (layer.selectionsBySouche[soucheKey].indexOf(rowId) === -1) {
        layer.selectionsBySouche[soucheKey].push(rowId)
    }
    layer.updatedAt = new Date().toISOString()
}

function removeRowIdFromLayerSouche(layer, rowId, soucheKey) {
    if (!layer || rowId == null || layer.cname === "Blue") return
    ensureSelectionLayerMeta(layer)
    const bucket = layer.selectionsBySouche[soucheKey]
    if (!bucket) return
    const idx = bucket.indexOf(rowId)
    if (idx !== -1) bucket.splice(idx, 1)
    if (!bucket.length) delete layer.selectionsBySouche[soucheKey]
    layer.updatedAt = new Date().toISOString()
}

function clearLayerSelectionsBySouche(layer) {
    if (!layer || layer.cname === "Blue") return
    ensureSelectionLayerMeta(layer)
    layer.selectionsBySouche = {}
    layer.updatedAt = new Date().toISOString()
    invalidateSelectionMembershipIndex()
}

function clearAllLayerSelectionsBySouche() {
    getColoredSelectionLayers().forEach(clearLayerSelectionsBySouche)
}

function syncCurrentContextToLayerSouche() {
    for (let i = 1; i < selections.length; i++) {
        const layer = selections[i]
        if (!layer || !layer.content) continue
        ensureSelectionLayerMeta(layer)
        layer.content.forEach(function (d) {
            if (!d) return
            const rowId = d.__rowId != null ? d.__rowId : d.id
            if (rowId == null) return
            addRowIdToLayerSouche(layer, rowId, getSoucheKeyForPoint(d))
        })
    }
    invalidateSelectionMembershipIndex()
}

function bumpSoucheRowsIndexVersion() {
    soucheRowsIndexVersionSeed += 1
    soucheRowsIndex = null
    invalidateSplomDisplayRowsCache()
}

function invalidateSplomDisplayRowsCache() {
    splomDisplayRowsCache = null
    splomDisplayRowsCacheKey = null
}

function buildSoucheRowsIndex() {
    if (soucheRowsIndex && soucheRowsIndexVersion === soucheRowsIndexVersionSeed) {
        return soucheRowsIndex
    }
    const index = new Map()
    if (datum && yeastColumn) {
        for (let i = 0; i < datum.length; i++) {
            const row = datum[i]
            if (!row) continue
            const raw = row[yeastColumn]
            if (raw == null || raw === "") continue
            const key = String(raw)
            let bucket = index.get(key)
            if (!bucket) {
                bucket = []
                index.set(key, bucket)
            }
            bucket.push(row)
        }
    }
    soucheRowsIndex = index
    soucheRowsIndexVersion = soucheRowsIndexVersionSeed
    return index
}

function getSplomDisplayRowsCacheKey() {
    if (isSoucheCompareModeActive()) {
        return "compare|" + triangleLowerYeast + "|" + triangleUpperYeast
    }
    if (!yeastColumn) return "all"
    if (selectedYeastTypes.length > 1) {
        return "multi|" + selectedYeastTypes.slice().map(String).sort().join("|")
    }
    if (selectedYeastTypes.length === 1) {
        return "one|" + selectedYeastTypes[0]
    }
    if (isMainChartSoucheNavigatorActive() && currentSouche) {
        return "nav|" + currentSouche
    }
    return "all"
}

/** Same row scope as SPLOM: single/filtered souche, or compare lower+upper combined. */
function getSplomDisplayRows() {
    if (!datum) return []
    const cacheKey = getSplomDisplayRowsCacheKey()
    if (splomDisplayRowsCache && splomDisplayRowsCacheKey === cacheKey) {
        return splomDisplayRowsCache
    }
    let rows
    if (isSoucheCompareModeActive()) {
        const lower = getRowsForSouche(triangleLowerYeast)
        const upper = getRowsForSouche(triangleUpperYeast)
        rows = lower.length ? (upper.length ? lower.concat(upper) : lower.slice()) : upper.slice()
    } else {
        rows = getSplomVisualizationData()
    }
    splomDisplayRowsCache = rows
    splomDisplayRowsCacheKey = cacheKey
    return rows
}

function clearColoredSelectionContentOnly() {
    for (let i = 1; i < selections.length; i++) {
        const layer = selections[i]
        if (!layer || !layer.content) continue
        const points = Array.from(layer.content)
        for (let j = 0; j < points.length; j++) {
            const d = points[j]
            layer.content.delete(d)
            if (d && d.color && layer.color) {
                d.color.delete(layer.color)
            }
        }
    }
}

function resolveDatumByRowId(rowId) {
    if (rowId == null) return null
    return rowById.get(rowId) || null
}

function rebuildColoredSelectionContentFromSoucheKeys(options) {
    const opts = options || {}
    if (!datum || !selections) return
    syncCurrentContextToLayerSouche()
    const displayRows = getSplomDisplayRows()
    const displayRowIds = new Set()
    for (let i = 0; i < displayRows.length; i++) {
        const d = displayRows[i]
        if (!d) continue
        const rid = d.__rowId != null ? d.__rowId : d.id
        if (rid != null) displayRowIds.add(rid)
    }

    clearColoredSelectionContentOnly()

    for (let i = 1; i < selections.length; i++) {
        const layer = selections[i]
        if (!layer) continue
        ensureSelectionLayerMeta(layer)
        const buckets = layer.selectionsBySouche || {}
        const soucheKeys = Object.keys(buckets)
        for (let sk = 0; sk < soucheKeys.length; sk++) {
            const ids = buckets[soucheKeys[sk]] || []
            for (let j = 0; j < ids.length; j++) {
                if (!displayRowIds.has(ids[j])) continue
                const d = rowById.get(ids[j])
                if (d) layer.content.add(d)
            }
        }
    }

    for (let i = 0; i < displayRows.length; i++) {
        const d = displayRows[i]
        if (!d) continue
        syncPointColorMembership(d)
        if (isPointInAnyColoredSelection(d)) {
            recomputePointDisplayLayer(d)
        } else {
            delete d.__displayLayerCname
        }
    }
    invalidateSelectionMembershipIndex()
    setpointvisGloabl(datum, selections)
    if (!opts.skipViewRefresh) {
        requestSelectionRestyle()
    }
}

function isRowIdInLayer(rowId, layer, soucheKey) {
    if (!layer || rowId == null) return false
    ensureSelectionLayerMeta(layer)
    if (soucheKey) {
        const ids = layer.selectionsBySouche[soucheKey] || []
        if (ids.indexOf(rowId) !== -1) return true
    } else {
        const buckets = layer.selectionsBySouche || {}
        for (const key of Object.keys(buckets)) {
            if ((buckets[key] || []).indexOf(rowId) !== -1) return true
        }
    }
    if (layer.content) {
        for (const d of layer.content) {
            if (!d) continue
            const rid = d.__rowId != null ? d.__rowId : d.id
            if (rid === rowId) return true
        }
    }
    return false
}

function getRowIdsForSelectionLayer(layerId, options) {
    const layer = findSelectionLayerById(layerId)
    if (!layer) return new Set()
    ensureSelectionLayerMeta(layer)
    const opts = options || {}
    const ids = new Set()
    Object.entries(layer.selectionsBySouche || {}).forEach(function (entry) {
        const soucheKey = entry[0]
        const rowIds = entry[1] || []
        if (opts.souche && soucheKey !== opts.souche) return
        rowIds.forEach(function (id) { ids.add(id) })
    })
    if (layer.content) {
        layer.content.forEach(function (d) {
            if (!d) return
            const rid = d.__rowId != null ? d.__rowId : d.id
            if (rid == null) return
            if (opts.souche && getSoucheKeyForPoint(d) !== opts.souche) return
            ids.add(rid)
        })
    }
    return ids
}

function getIntersectionRowIdsForSelectionLayers(layerIds, options) {
    if (!layerIds || layerIds.length < 2) {
        console.warn("[Intersection] Need at least two selection layers")
        return new Set()
    }
    const sets = layerIds.map(function (layerId) {
        return getRowIdsForSelectionLayer(layerId, options || {})
    })
    if (!sets.length) return new Set()
    const firstSet = sets[0]
    const restSets = sets.slice(1)
    const intersection = new Set(
        Array.from(firstSet).filter(function (rowId) {
            return restSets.every(function (set) { return set.has(rowId) })
        })
    )
    console.log("[Intersection] computed", {
        layerIds: layerIds,
        souche: (options && options.souche) || "ALL",
        counts: sets.map(function (set) { return set.size }),
        intersectionCount: intersection.size
    })
    return intersection
}

function getUnionRowIdsForSelectionLayers(layerIds, options) {
    const union = new Set()
    ;(layerIds || []).forEach(function (layerId) {
        const ids = getRowIdsForSelectionLayer(layerId, options || {})
        ids.forEach(function (id) { union.add(id) })
    })
    return union
}

function getSelectionMembershipsForRow(rowId, soucheKey) {
    if (selectionMembershipIndexDirty) {
        return getSelectionMembershipsForRowSlow(rowId, soucheKey)
    }
    return getSelectionMembershipsFast(rowId, soucheKey).map(function (m) {
        return {
            layerId: m.layerId,
            label: m.label,
            color: m.color,
            annotation: m.annotation
        }
    })
}

function getSelectionMembershipsForPoint(d) {
    if (!d) return []
    const rowId = d.__rowId != null ? d.__rowId : d.id
    return getSelectionMembershipsForRow(rowId, getSoucheKeyForPoint(d))
}

function getPointVisualStyleFromMemberships(memberships) {
    const cfg = VIS_CONFIG.point
    if (!memberships || !memberships.length) {
        return {
            selected: false,
            overlap: false,
            fill: selections[0] ? selections[0].color : null,
            stroke: "none",
            strokeWidth: 0,
            opacity: cfg.defaultOpacity,
            radius: cfg.defaultRadius
        }
    }
    const top = memberships[memberships.length - 1]
    const topColor = findSelectionLayerById(top.layerId)
    const fill = topColor && topColor.color ? topColor.color : null
    return {
        selected: true,
        overlap: memberships.length > 1,
        fill: fill,
        stroke: memberships.length > 1 ? cfg.overlapStroke : (top.color || "none"),
        strokeWidth: memberships.length > 1 ? cfg.overlapStrokeWidth : cfg.selectedStrokeWidth,
        opacity: cfg.selectedOpacity,
        radius: memberships.length > 1 ? cfg.overlapRadius : cfg.selectedRadius
    }
}

function getPointStrokeForChart(d) {
    const style = getPointVisualStyleFromMemberships(getSelectionMembershipsForPoint(d))
    const cfg = VIS_CONFIG.point
    if (!style.selected) return null
    if (style.overlap) return { stroke: cfg.overlapStroke, strokeWidth: cfg.overlapStrokeWidth }
    return { stroke: style.stroke, strokeWidth: style.strokeWidth }
}

function buildExportRowsFromRowIds(rowIds, metadata) {
    const meta = metadata || {}
    const rows = []
    const excludedExportColumns = new Set(["visibility", "color", "__rowId", "id"])
    rowIds.forEach(function (rowId) {
        const row = rowById.get(rowId)
        if (!row) {
            console.warn("[CSV export] Missing row for rowId", rowId)
            return
        }
        const rowSouche = yeastColumn ? row[yeastColumn] : (meta.souche || "__ALL__")
        const memberships = getSelectionMembershipsForRow(rowId, rowSouche)
        const exportRow = {}
        const selectionNames = memberships.map(function (m) { return m.label || "" }).join("; ")
        const selectionAnnotations = memberships.map(function (m) { return m.annotation || "" }).join("; ")
        const selectionColorNames = memberships.map(function (m) {
            const layer = findSelectionLayerById(m.layerId)
            if (!layer) return ""
            return layer.cname || layer.displayName || layer.id || ""
        }).join("; ")

        // Keep selection metadata at the beginning of CSV columns.
        exportRow.selection_color = selectionColorNames
        exportRow.selection_name = selectionNames
        exportRow.selection_annotations = selectionAnnotations
        exportRow.__rowId = rowId

        if (allColumns && allColumns.length) {
            allColumns.forEach(function (col) {
                if (excludedExportColumns.has(col)) return
                exportRow[col] = row[col]
            })
        } else {
            Object.keys(row).forEach(function (key) {
                if (excludedExportColumns.has(key)) return
                exportRow[key] = row[key]
            })
        }
        rows.push(exportRow)
    })
    rows.sort(function (a, b) { return d3.ascending(a.__rowId, b.__rowId) })
    return rows
}

function updateSelectionLayerLabel(layerId, label) {
    const layer = findSelectionLayerById(layerId)
    if (!layer) return
    ensureSelectionLayerMeta(layer)
    layer.label = label || layer.id
    layer.displayName = layer.label
    layer.updatedAt = new Date().toISOString()
    invalidateSelectionMembershipIndex()
    scheduleSelectionPanelLightRefresh()
    logProvenanceAction("rename_selection_layer", {
        layerId: layer.id,
        label: layer.label
    })
}

function updateSelectionLayerAnnotation(layerId, annotation) {
    const layer = findSelectionLayerById(layerId)
    if (!layer) return
    ensureSelectionLayerMeta(layer)
    layer.annotation = annotation || ""
    layer.updatedAt = new Date().toISOString()
    invalidateSelectionMembershipIndex()
    logProvenanceAction("annotate_selection_layer", {
        layerId: layer.id,
        annotation: layer.annotation
    })
}

function scheduleSelectionLayerAnnotationUpdate(layerId, annotation) {
    if (annotationDebounceTimers[layerId]) {
        clearTimeout(annotationDebounceTimers[layerId])
    }
    annotationDebounceTimers[layerId] = setTimeout(function () {
        updateSelectionLayerAnnotation(layerId, annotation)
        delete annotationDebounceTimers[layerId]
    }, 400)
}

function downloadSelectionLayerCsv(layerId, options) {
    const layer = findSelectionLayerById(layerId)
    if (!layer) {
        alert("Selection layer not found.")
        return
    }
    const opts = options || {}
    const rowIds = getRowIdsForSelectionLayer(layerId, {
        souche: opts.currentSoucheOnly ? (getCurrentVisibleSouche() || currentSouche) : null
    })
    if (!rowIds.size) {
        alert("No rows in this selection.")
        return
    }
    const rows = buildExportRowsFromRowIds(rowIds, {
        exportType: "selection",
        exportName: layer.label || layer.id,
        layerIds: [layer.id],
        layerNames: [layer.label || layer.id]
    })
    const csv = rowsToCsv(rows)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const safeName = (layer.label || layer.id).replace(/[^a-z0-9-_]+/gi, "_")
    downloadCsv("visprom_" + safeName + "_" + timestamp + ".csv", csv)
    logProvenanceAction("download_selection_layer_csv", {
        layerId: layer.id,
        label: layer.label,
        rowCount: rows.length
    })
}

function downloadSelectionIntersectionCsv(layerIds, options) {
    if (!layerIds || layerIds.length < 2) {
        alert("Choose at least two selections to export an intersection.")
        return
    }
    const layers = layerIds.map(findSelectionLayerById).filter(Boolean)
    const opts = options || {}
    const souche = opts.currentSoucheOnly
        ? (getCurrentVisibleSouche() || currentSouche)
        : null
    const intersectionIds = getIntersectionRowIdsForSelectionLayers(layerIds, { souche: souche })
    if (!intersectionIds.size) {
        alert("No overlapping points found for the selected selections.")
        return
    }
    const layerNames = layers.map(function (l) { return l.label || l.id })
    const exportName = layerNames.join(" intersection ")
    const rows = buildExportRowsFromRowIds(intersectionIds, {
        exportType: "intersection",
        exportName: exportName,
        layerIds: layerIds,
        layerNames: layerNames
    })
    const csv = rowsToCsv(rows)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const safeName = layerNames.join("_INTERSECT_").replace(/[^a-z0-9-_]+/gi, "_")
    downloadCsv("visprom_intersection_" + safeName + "_" + timestamp + ".csv", csv)
    logProvenanceAction("download_selection_intersection_csv", {
        layerIds: layerIds,
        layerNames: layerNames,
        rowCount: rows.length,
        currentSoucheOnly: !!opts.currentSoucheOnly,
        souche: souche || "ALL"
    })
}

function computePairwiseSelectionIntersections(options) {
    const opts = options || {}
    const souche = opts.currentSoucheOnly
        ? (getCurrentVisibleSouche() || currentSouche)
        : null
    const results = []
    const coloredLayers = getColoredSelectionLayers()
    for (let i = 0; i < coloredLayers.length; i++) {
        for (let j = i + 1; j < coloredLayers.length; j++) {
            const a = coloredLayers[i]
            const b = coloredLayers[j]
            const ids = getIntersectionRowIdsForSelectionLayers([a.id, b.id], { souche: souche })
            results.push({
                layerIds: [a.id, b.id],
                label: (a.label || a.id) + " ∩ " + (b.label || b.id),
                colors: [a.color, b.color],
                count: ids.size,
                rowIds: Array.from(ids)
            })
        }
    }
    return results.sort(function (a, b) { return d3.descending(a.count, b.count) })
}

function layerChipColor(layer) {
    if (!layer || !layer.color || !layer.color.string) return VIS_CONFIG.point.fallbackChipColor
    return layer.color.string.substr(0, 7)
}

function getColorSwatchesForTableRow(row, fallbackColorSet) {
    const layers = getColoredLayersForPoint(row)
    if (layers.length) {
        return layers.map(function (layer) { return layerChipColor(layer) })
    }
    if (fallbackColorSet && fallbackColorSet.size > 0) {
        return Array.from(fallbackColorSet).map(function (color) {
            return color && color.string ? color.string.substr(0, 7) : VIS_CONFIG.point.fallbackChipColor
        })
    }
    return [layerChipColor(selections[0])]
}

let soucheComparisonBroadcast = null

function getSoucheComparisonBroadcast() {
    if (typeof BroadcastChannel === "undefined") return null
    if (!soucheComparisonBroadcast) {
        soucheComparisonBroadcast = new BroadcastChannel("visprom_souche_comparison")
    }
    return soucheComparisonBroadcast
}

function syncOpenSoucheComparisonSelections() {
    if (!openedSoucheComparisons || !openedSoucheComparisons.length) return
    let selectionLayers = []
    try {
        selectionLayers = buildSelectionLayersSnapshotForComparison()
    } catch (err) {
        console.warn("[Souche comparison] Could not sync selection layers:", err)
        return
    }
    const sessionId = (typeof window !== "undefined" && window.vispromSessionId)
        ? String(window.vispromSessionId)
        : "default"

    openedSoucheComparisons.forEach(function (tab) {
        if (!tab || !tab.comparisonId) return
        try {
            let state = soucheComparisonStorage.readComparisonState(tab.comparisonId, sessionId)
            if (!state) {
                state = {
                    comparisonId: tab.comparisonId,
                    xDim: tab.xDim,
                    yDim: tab.yDim,
                    yeastColumn: tab.yeastColumn,
                    souchesToCompare: tab.souchesToCompare
                }
            }
            state.selectionLayers = selectionLayers
            tryWriteComparisonState(tab.comparisonId, state)
            try {
                sessionStorage.setItem(tab.comparisonId, JSON.stringify(state))
            } catch (e) { /* ignore */ }
        } catch (err) {
            console.warn("[Souche comparison] Could not update tab state:", tab.comparisonId, err)
        }
    })

    const channel = getSoucheComparisonBroadcast()
    if (channel) {
        channel.postMessage({
            type: "visprom_comparison_selection_update",
            sessionId: sessionId,
            selectionLayers: selectionLayers
        })
    }
}

function getSelectionLayerTotalPoints() {
    return datum && datum.length ? datum.length : 0
}

function getSelectionCountForLayer(layerOrId) {
    const layerId = layerOrId && typeof layerOrId === "object"
        ? (layerOrId.id || layerOrId.cname)
        : layerOrId
    return layerId ? getRowIdsForSelectionLayer(layerId).size : 0
}

function formatSelectionLayerCount(layerId) {
    return getSelectionCountForLayer(layerId) + "/" + getSelectionLayerTotalPoints()
}

// Lightweight in-place refresh of per-row "X/total" counts and the − button
// disabled state. Safe to call after any selection mutation without rebuilding
// the whole table.
function refreshSelectionLayerCounts() {
    const container = d3.select("#selection-layer-table")
    if (!container.empty()) {
        container.selectAll(".selection-layer-row").each(function (layer) {
            const row = d3.select(this)
            const count = getSelectionCountForLayer(layer)
            row.select(".selection-count-cell").text(formatSelectionLayerCount(layer.id))
            row.select(".selection-layer-row-btn.remove").property("disabled", count === 0)
        })
    }

    const intContainer = d3.select("#intersection-selection-list")
    if (!intContainer.empty()) {
        intContainer.selectAll(".intersection-choice-row").each(function (layer) {
            d3.select(this).select(".intersection-choice-label")
                .text((layer.label || layer.id) + " (" + formatSelectionLayerCount(layer.id) + ")")
        })
    }
}

const SELECTION_ICON_VISIBLE = "static/imgs/visible.svg"
const SELECTION_ICON_HIDDEN = "static/imgs/notvisible.svg"
const SELECTION_ICON_ISOLATE = "static/imgs/target.svg"
const SELECTION_ICON_NOT_ISOLATE = "static/imgs/nottarget.svg"

function updateSelectionLayerRowIcons(rowSel, layer) {
    if (!rowSel || rowSel.empty() || !layer) return
    rowSel.select(".selection-visibility-icon").attr("src",
        layer.visibility === true ? SELECTION_ICON_VISIBLE : SELECTION_ICON_HIDDEN)
    rowSel.select(".selection-isolate-icon").attr("src",
        layer.isolate === true ? SELECTION_ICON_ISOLATE : SELECTION_ICON_NOT_ISOLATE)
}

function refreshSelectionLayerRowHighlights() {
    const container = d3.select("#selection-layer-table")
    if (container.empty()) return
    container.selectAll(".selection-layer-row")
        .classed("active2", function (d) { return current_color.indexOf(d) !== -1 })
        .each(function (d) { updateSelectionLayerRowIcons(d3.select(this), d) })
}

function syncSelectionCountsAfterChange() {
    return timeBlock("syncSelectionCountsAfterChange", function () {
        refreshSelectionLayerCounts()
        if (datum && countTable) updateCountTable(datum, countTable)
    })
}

let selectionPanelFullRefreshTimer = null
let selectionPanelOverlapRefreshTimer = null
let selectionPanelLightRefreshPending = false

function refreshSelectionExportUILight() {
    return timeBlock("refreshSelectionExportUILight", function () {
        refreshSelectionLayerCounts()
        updateIntersectionPreview()
    })
}

function refreshSelectionExportUIFull() {
    return timeBlock("refreshSelectionExportUI", function () {
        renderSelectionLayerTable()
        renderIntersectionPicker()
        updateIntersectionPreview()
        renderNonZeroPairwiseOverlapSummary()
        refreshSelectionLayerCounts()
    })
}

function cancelDeferredSelectionPanelRefreshes() {
    cancelPendingSelectionPanelRefresh()
    if (selectionPanelFullRefreshTimer) {
        clearTimeout(selectionPanelFullRefreshTimer)
        selectionPanelFullRefreshTimer = null
    }
    if (selectionPanelOverlapRefreshTimer) {
        clearTimeout(selectionPanelOverlapRefreshTimer)
        selectionPanelOverlapRefreshTimer = null
    }
    selectionPanelLightRefreshPending = false
}

function scheduleSelectionExportOverlapRefresh() {
    if (selectionPanelOverlapRefreshTimer) clearTimeout(selectionPanelOverlapRefreshTimer)
    selectionPanelOverlapRefreshTimer = setTimeout(function () {
        selectionPanelOverlapRefreshTimer = null
        timeBlock("refreshSelectionOverlapPanels", function () {
            updateIntersectionPreview()
            renderNonZeroPairwiseOverlapSummary()
        })
    }, VIS_CONFIG.selectionPanel.overlapRefreshDebounceMs)
}

function scheduleSelectionPanelFullRefresh() {
    if (selectionPanelFullRefreshTimer) return
    selectionPanelFullRefreshTimer = setTimeout(function () {
        selectionPanelFullRefreshTimer = null
        refreshSelectionExportUIFull()
    }, VIS_CONFIG.selectionPanel.fullRefreshDebounceMs)
}

function scheduleSelectionPanelLightRefresh() {
    if (selectionPanelLightRefreshPending) return
    selectionPanelLightRefreshPending = true
    requestAnimationFrame(function () {
        selectionPanelLightRefreshPending = false
        refreshSelectionExportUILight()
        scheduleSelectionExportOverlapRefresh()
    })
}

function refreshSelectionExportUI(options) {
    const opts = options || {}
    if (opts.immediate && opts.full) {
        cancelDeferredSelectionPanelRefreshes()
        return refreshSelectionExportUIFull()
    }
    if (opts.immediate && opts.light) {
        return refreshSelectionExportUILight()
    }
    if (opts.full) {
        scheduleSelectionPanelFullRefresh()
        return
    }
    scheduleSelectionPanelLightRefresh()
}

function needsSelectionLayerTableRebuild(layers) {
    const container = d3.select("#selection-layer-table")
    if (container.empty()) return true
    const tbody = container.select("tbody")
    if (tbody.empty()) return true
    const existing = tbody.selectAll("tr.selection-layer-row")
    if (existing.size() !== layers.length) return true
    const ids = new Set(layers.map(function (layer) { return layer.id }))
    let matches = true
    existing.each(function (d) {
        if (!d || !ids.has(d.id)) matches = false
    })
    return !matches
}

function renderSelectionLayerTable() {
    const container = d3.select("#selection-layer-table")
    if (container.empty()) return

    const layers = getColoredSelectionLayers()
    if (!needsSelectionLayerTableRebuild(layers)) {
        refreshSelectionLayerRowHighlights()
        refreshSelectionLayerCounts()
        return
    }

    container.html("")

    const table = container.append("table").attr("class", "selection-layer-table")
        .style("width", "100%")
        .style("box-sizing", "border-box")
        .style("border-collapse", "collapse")
        .style("table-layout", "fixed")
    const thead = table.append("thead").append("tr")
    ;[
        { label: "", cls: "selection-col-color" },
        { label: "Name", cls: "selection-col-name" },
        { label: "Count", cls: "selection-col-count" },
        { label: "Annotation", cls: "selection-col-annotation" },
        { label: "Export", cls: "selection-col-export" },
        { label: "", cls: "selection-col-controls" }
    ].forEach(function (col) {
        thead.append("th").attr("class", col.cls).text(col.label)
    })

    const tbody = table.append("tbody")
    selList = tbody

    const rows = tbody.selectAll("tr")
        .data(layers, function (d) { return d.id })
        .join("tr")
        .attr("class", "selection-layer-row")
        .attr("id", function (d) { return d.cname })
        .classed("active2", function (d) { return current_color.indexOf(d) !== -1 })

    rows.each(function (d) {
        d.rep = d3.select(this)
    })

    rows.append("td")
        .attr("class", "selection-color-cell")
        .each(function (d) {
            const cell = d3.select(this)
            cell.append("span")
                .attr("class", "selection-chip")
                .style("display", "inline-block")
                .style("width", "12px")
                .style("height", "12px")
                .style("border-radius", "50%")
                .style("background", layerChipColor(d))
                .style("border", "1px solid " + VIS_CONFIG.point.chipBorder)
                .style("vertical-align", "middle")
                .style("margin-right", "4px")

            cell.append("input")
                .attr("type", "color")
                .attr("class", "selection-color-input")
                .attr("value", layerChipColor(d))
                .on("input", function () {
                    const inputValue = d3.select(this).property("value")
                    d.color.string = inputValue.concat("80")
                    d.color.array = hexToRgbA(inputValue, 1)
                    d3.select(this.parentNode).select(".selection-chip")
                        .style("background", inputValue)
                    invalidateSelectionMembershipIndex()
                    refreshSplomAfterSelection()
                })
                .on("click", function (evt) {
                    if (evt && evt.stopPropagation) evt.stopPropagation()
                })

            const actions = cell.append("span").attr("class", "selection-layer-actions")
            actions.append("img")
                .attr("class", "selection-layer-action-icon selection-visibility-icon")
                .attr("height", 16)
                .attr("width", 16)
                .attr("src", function () {
                    return d.visibility === true
                        ? SELECTION_ICON_VISIBLE
                        : SELECTION_ICON_HIDDEN
                })
                .on("click", function (evt) {
                    if (evt && evt.stopPropagation) evt.stopPropagation()
                    d.visibility = !d.visibility
                    for (const p of d.content) {
                        setpointvisLocal(p, selections)
                    }
                    updateSelectionLayerRowIcons(d3.select(this.closest("tr")), d)
                    setTimeout(function () {
                        scaterplot.updatePoints(getMainChartPrimaryData(), mainviewSvg)
                        refreshSplomAfterSelection()
                    }, 0)
                    scheduleSelectionPanelLightRefresh()
                })

            actions.append("img")
                .attr("class", "selection-layer-action-icon selection-isolate-icon")
                .attr("height", 16)
                .attr("width", 16)
                .attr("src", function () {
                    return d.isolate === true
                        ? SELECTION_ICON_ISOLATE
                        : SELECTION_ICON_NOT_ISOLATE
                })
                .on("click", function (evt) {
                    if (evt && evt.stopPropagation) evt.stopPropagation()
                    d.isolate = !d.isolate
                    setpointvisGloabl(datum, selections)
                    updateSelectionLayerRowIcons(d3.select(this.closest("tr")), d)
                    setTimeout(function () {
                        scaterplot.updatePoints(getMainChartPrimaryData(), mainviewSvg)
                        refreshSplomAfterSelection()
                    }, 0)
                    scheduleSelectionPanelLightRefresh()
                })
        })

    rows.append("td")
        .append("input")
        .attr("type", "text")
        .attr("class", "selection-name-input")
        .attr("placeholder", "Selection name")
        .property("value", function (d) { return d.label || d.displayName || d.id })
        .on("input", function (d) {
            d.label = this.value
            d.displayName = this.value
        })
        .on("change", function (d) {
            updateSelectionLayerLabel(d.id, this.value)
        })
        .on("click", function (evt) {
            if (evt && evt.stopPropagation) evt.stopPropagation()
        })

    rows.append("td")
        .attr("class", "selection-count-cell")
        .text(function (d) { return formatSelectionLayerCount(d.id) })

    rows.append("td")
        .append("input")
        .attr("type", "text")
        .attr("class", "selection-annotation-input")
        .attr("placeholder", "Add note...")
        .property("value", function (d) { return d.annotation || "" })
        .on("input", function (d) {
            d.annotation = this.value
            scheduleSelectionLayerAnnotationUpdate(d.id, this.value)
        })
        .on("click", function (evt) {
            if (evt && evt.stopPropagation) evt.stopPropagation()
        })

    rows.append("td")
        .append("button")
        .attr("type", "button")
        .attr("class", "small-export-btn")
        .text("CSV")
        .on("click", function (d) {
            if (d3.event && d3.event.stopPropagation) d3.event.stopPropagation()
            downloadSelectionLayerCsv(d.id)
        })

    rows.append("td")
        .attr("class", "selection-layer-row-controls")
        .each(function (d) {
            const cell = d3.select(this)
            const count = getSelectionCountForLayer(d)
            cell.append("button")
                .attr("type", "button")
                .attr("class", "selection-layer-row-btn remove")
                .attr("title", "Clear all points in this selection")
                .property("disabled", count === 0)
                .text("\u2212")
                .on("click", function (d) {
                    if (d3.event && d3.event.stopPropagation) d3.event.stopPropagation()
                    clearSelectionLayerPoints(d)
                })
        })

    const footer = table.append("tfoot").append("tr").attr("class", "selection-layer-add-row")
    footer.append("td").attr("colspan", 5)
    footer.append("td")
        .attr("class", "selection-layer-row-controls")
        .append("button")
        .attr("type", "button")
        .attr("class", "selection-layer-row-btn add")
        .attr("title", "Add a new selection layer")
        .text("+")
        .on("click", function () {
            if (d3.event && d3.event.stopPropagation) d3.event.stopPropagation()
            addSelectionLayer()
        })

    rows.on("click", function (d) {
        const target = d3.event && d3.event.target
        if (target && (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "BUTTON" ||
            target.tagName === "IMG"
        )) {
            return
        }
        if (d3.event.ctrlKey || d3.event.metaKey) {
            if (current_color.indexOf(d) === -1) {
                current_color.push(d)
                d3.select(this).classed("active2", true)
                refreshAllSelectionViews()
            }
        } else {
            current_color = [d]
            refreshTableView()
            updateCountTable(datum, countTable)
            tbody.selectAll("tr").classed("active2", false)
            d3.select(this).classed("active2", true)
            refreshAllSelectionViews()
        }
    })
}

function renderIntersectionPicker() {
    const container = d3.select("#intersection-selection-list")
    if (container.empty()) return

    const layers = getColoredSelectionLayers()
    selectedIntersectionLayerIds = selectedIntersectionLayerIds.filter(function (id) {
        return layers.some(function (layer) { return layer.id === id })
    })

    container.html("")

    const rows = container.selectAll(".intersection-choice-row")
        .data(layers, function (d) { return d.id })
        .join("label")
        .attr("class", "intersection-choice-row")

    rows.append("input")
        .attr("type", "checkbox")
        .property("checked", function (d) {
            return selectedIntersectionLayerIds.indexOf(d.id) !== -1
        })
        .on("change", function (d) {
            if (this.checked) {
                if (selectedIntersectionLayerIds.indexOf(d.id) === -1) {
                    selectedIntersectionLayerIds.push(d.id)
                }
            } else {
                selectedIntersectionLayerIds = selectedIntersectionLayerIds.filter(function (id) {
                    return id !== d.id
                })
            }
            updateIntersectionPreview()
        })
        .on("click", function (evt) {
            if (evt && evt.stopPropagation) evt.stopPropagation()
        })

    rows.append("span")
        .attr("class", "intersection-choice-chip")
        .style("display", "inline-block")
        .style("width", "10px")
        .style("height", "10px")
        .style("border-radius", "50%")
        .style("background", function (d) { return layerChipColor(d) })
        .style("border", "1px solid " + VIS_CONFIG.point.chipBorder)
        .style("margin-right", "4px")
        .style("vertical-align", "middle")

    rows.append("span")
        .attr("class", "intersection-choice-label")
        .text(function (d) {
            return (d.label || d.id) + " (" + formatSelectionLayerCount(d.id) + ")"
        })
}

function updateIntersectionPreview() {
    return timeBlock("updateIntersectionPreview", function () {
        const preview = d3.select("#intersection-preview")
        const downloadBtn = d3.select("#download-intersection-csv-btn")
        if (preview.empty()) return

        if (selectedIntersectionLayerIds.length < 2) {
            preview.text("Choose at least two selections to compute an intersection.")
            if (!downloadBtn.empty()) downloadBtn.property("disabled", true)
            return
        }

        const layers = selectedIntersectionLayerIds
            .map(findSelectionLayerById)
            .filter(Boolean)

        const ids = getIntersectionRowIdsForSelectionLayers(selectedIntersectionLayerIds)
        const label = layers.map(function (layer) { return layer.label || layer.id }).join(" ∩ ")

        preview.text(label + " = " + ids.size + " points")
        if (!downloadBtn.empty()) downloadBtn.property("disabled", ids.size === 0)
    })
}

function renderNonZeroPairwiseOverlapSummary() {
    return timeBlock("renderNonZeroPairwiseOverlapSummary", function () {
        const container = d3.select("#pairwise-overlap-list")
        if (container.empty()) return

        container.html("")

        const groups = computePairwiseSelectionIntersections().filter(function (group) {
            return group.count > 0
        })

        if (!groups.length) {
            container.append("div")
                .attr("class", "pairwise-overlap-empty")
                .text("No overlaps yet.")
            return
        }

        const rows = container.selectAll(".pairwise-overlap-row")
            .data(groups, function (d) { return d.layerIds.join("||") })
            .join("div")
            .attr("class", "pairwise-overlap-row")

        rows.append("span")
            .text(function (group) { return group.label + ": " + group.count })

        rows.append("button")
            .attr("type", "button")
            .attr("class", "tiny-export-btn")
            .text("CSV")
            .on("click", function (group) {
                downloadSelectionIntersectionCsv(group.layerIds)
            })
    })
}

function updateSelectionCounts() {
    syncSelectionCountsAfterChange()
}

function updateSelectionPanel() {
    return timeBlock("updateSelectionPanel", function () {
        scheduleSelectionPanelLightRefresh()
    })
}

function updateSelectionOverlapPanel() {
    scheduleSelectionExportOverlapRefresh()
}

function escapeHtml(str) {
    return String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
}

function renderSelectionChipsForRow(row) {
    if (!row) return ""
    const rowId = row.__rowId != null ? row.__rowId : row.id
    const soucheKey = row[yeastColumn] || currentSouche || getCurrentVisibleSouche() || "__ALL__"
    const memberships = getSelectionMembershipsForRow(rowId, soucheKey)
    if (!memberships.length) return ""
    return memberships.map(function (m) {
        const tip = escapeHtml(m.label + (m.annotation ? ": " + m.annotation : ""))
        return '<span class="selection-chip" title="' + tip + '" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
            (m.color || VIS_CONFIG.point.fallbackChipColor) + ';margin-right:4px;border:1px solid ' + VIS_CONFIG.point.chipBorder + ';"></span>'
    }).join("")
}

function getColoredLayersForPoint(d) {
    if (!d || !selections) return []
    if (!selectionMembershipIndexDirty) {
        const rowId = d.__rowId != null ? d.__rowId : d.id
        const memberships = getSelectionMembershipsFast(rowId, getSoucheKeyForPoint(d))
        if (memberships.length) {
            return memberships.map(function (m) { return m.layer }).filter(Boolean)
        }
    }
    const layers = []
    for (let i = 1; i < selections.length; i++) {
        const layer = selections[i]
        if (layer && layer.content && layer.content.has(d)) layers.push(layer)
    }
    return layers
}

function getSelectionLayerPriority(layer) {
    if (!layer || !layer.color || layer.color.order == null) return 0
    return layer.color.order
}

function syncPointColorMembership(d) {
    if (!d || !selections || !selections[0]) return
    const layers = getColoredLayersForPoint(d)
    d.color = d.color || new Set()
    d.color.clear()
    if (!layers.length) {
        selections[0].content.add(d)
        d.color.add(selections[0].color)
        delete d.__displayLayerCname
        return
    }
    selections[0].content.delete(d)
    for (let i = 0; i < layers.length; i++) {
        d.color.add(layers[i].color)
    }
}

function setPointDisplayLayer(d, layer) {
    if (!d || !layer || !layer.cname) return
    d.__displayLayerCname = layer.cname
}

function recomputePointDisplayLayer(d) {
    const layers = getColoredLayersForPoint(d)
    if (!layers.length) {
        delete d.__displayLayerCname
        return null
    }
    const preferred = findSelectionLayerByCname(d.__displayLayerCname)
    if (preferred && preferred.content.has(d)) {
        return preferred
    }
    let best = layers[0]
    for (let i = 1; i < layers.length; i++) {
        if (getSelectionLayerPriority(layers[i]) > getSelectionLayerPriority(best)) {
            best = layers[i]
        }
    }
    setPointDisplayLayer(d, best)
    return best
}

function addPointToSelectionLayer(layer, d) {
    if (!layer || !d || layer.cname === "Blue") return
    layer.content.add(d)
    const rowId = d.__rowId != null ? d.__rowId : d.id
    addRowIdToLayerSouche(layer, rowId, getSoucheKeyForPoint(d))
    invalidateSelectionMembershipIndex()
    syncPointColorMembership(d)
    setPointDisplayLayer(d, layer)
}

function removePointFromSelectionLayer(layer, d) {
    if (!layer || !d || layer.cname === "Blue") return
    layer.content.delete(d)
    const rowId = d.__rowId != null ? d.__rowId : d.id
    removeRowIdFromLayerSouche(layer, rowId, getSoucheKeyForPoint(d))
    invalidateSelectionMembershipIndex()
    syncPointColorMembership(d)
    if (isPointInAnyColoredSelection(d)) {
        recomputePointDisplayLayer(d)
    }
}

function getPointDisplayColor(d) {
    if (!d || !selections || !selections[0]) return null
    if (!isPointInAnyColoredSelection(d)) {
        return selections[0].color
    }
    const displayLayer = recomputePointDisplayLayer(d)
    if (displayLayer && displayLayer.color) return displayLayer.color
    const colors = Array.from(d.color || [])
    return colors.length ? colors[colors.length - 1] : selections[0].color
}

function refreshMainChartRendering() {
    if (!mainviewSvg || !datum) return
    syncMainChartLayout()
    updateMainChartSoucheNavigator()
    updateMainChartPairTitle()
}

function ensureMainChartModeControl() {
    let select = document.getElementById("mainChartModeSelect")
    if (!select) {
        let host = document.querySelector(".main-chart-head-actions")
        if (!host) {
            const panelHead = document.querySelector(".panel-main .panel-head")
            if (panelHead) {
                panelHead.classList.add("panel-head-with-actions")
                host = document.createElement("div")
                host.className = "main-chart-head-actions"
                panelHead.appendChild(host)
            }
        }
        if (host) {
            const label = document.createElement("label")
            label.className = "main-chart-mode-label"
            label.title = "Original: classic points. Density: low-opacity points with contour overlay."
            label.appendChild(document.createTextNode("Main Chart Mode: "))
            select = document.createElement("select")
            select.id = "mainChartModeSelect"
            const optOriginal = document.createElement("option")
            optOriginal.value = "original"
            optOriginal.textContent = "Original"
            const optDensity = document.createElement("option")
            optDensity.value = "density"
            optDensity.textContent = "Density"
            select.appendChild(optOriginal)
            select.appendChild(optDensity)
            label.appendChild(select)
            host.appendChild(label)
        }
    }
    if (!select || select.__vispromBound) return
    select.__vispromBound = true
    select.value = mainChartMode
    select.addEventListener("change", function () {
        mainChartMode = select.value === "density" ? "density" : "original"
        scaterplot.setRenderMode(mainChartMode)
        refreshMainChartRendering()
    })
}

function syncMainChartSettingsFromWindow() {
    if (typeof window === "undefined" || !window.__vispromMainChartSettings) return
    const w = window.__vispromMainChartSettings
    if (Number.isFinite(w.selections)) mainChartSettingsSelectionsTarget = w.selections
    if (Number.isFinite(w.contourLevels)) mainChartSettingsContourLevels = w.contourLevels
}

function registerMainChartSettingsApplyHook() {
    if (typeof window === "undefined") return
    window.__vispromApplyMainChartSettings = function (selectionTargetColored, contourLevels) {
        if (Number.isFinite(selectionTargetColored)) {
            mainChartSettingsSelectionsTarget = selectionTargetColored
        }
        if (Number.isFinite(contourLevels)) {
            mainChartSettingsContourLevels = contourLevels
        }
        if (window.__vispromMainChartSettings) {
            window.__vispromMainChartSettings.selections = mainChartSettingsSelectionsTarget
            window.__vispromMainChartSettings.contourLevels = mainChartSettingsContourLevels
        }
        applyMainChartSettingsFromUI(selectionTargetColored, contourLevels)
    }
}

function ensureMainChartSettingsControls() {
    try {
        syncMainChartSettingsFromWindow()
        registerMainChartSettingsApplyHook()

        // Inline script in index.html owns open/close UI; bundle only applies values.
        if (typeof window !== "undefined" && window.__vispromSettingsModalReady) {
            const s = window.__vispromMainChartSettings
            if (s) {
                applyMainChartSettingsFromUI(s.selections, s.contourLevels)
            }
            return
        }

        let btn = document.getElementById("mainChartSettingsToggleBtn")
        let overlay = document.getElementById("mainChartSettingsOverlay")
        let panel = document.getElementById("mainChartSettingsPanel")
        const selInput = document.getElementById("mainChartSettingsSelectionsInput")
        const contourInput = document.getElementById("mainChartSettingsContourLevelsInput")
        const applyBtn = document.getElementById("mainChartSettingsApplyBtn")
        const cancelBtn = document.getElementById("mainChartSettingsCancelBtn")
        if (!btn || !overlay || !panel || !selInput || !contourInput || !applyBtn || !cancelBtn) return

        const coloredNow = Math.max(0, selections.length - 1)
        const maxColored = coloredNow + (reserve ? reserve.length : 0)
        const desiredColored = clamp(mainChartSettingsSelectionsTarget, 1, Math.max(1, maxColored))
        selInput.value = String(desiredColored)

        const contourNow = (typeof scaterplot.getContourLevels === "function")
            ? scaterplot.getContourLevels()
            : mainChartSettingsContourLevels
        contourInput.value = String(contourNow)

        function openSettingsModal() {
            const currentColoredNow = Math.max(0, selections.length - 1)
            const maxColoredNow = currentColoredNow + (reserve ? reserve.length : 0)
            selInput.value = String(clamp(mainChartSettingsSelectionsTarget, 1, Math.max(1, maxColoredNow)))
            contourInput.value = String(
                typeof scaterplot.getContourLevels === "function"
                    ? scaterplot.getContourLevels()
                    : mainChartSettingsContourLevels
            )
            overlay.removeAttribute("hidden")
            btn.setAttribute("aria-expanded", "true")
            setTimeout(function () { selInput.focus() }, 0)
        }

        function closeSettingsModal() {
            overlay.setAttribute("hidden", "")
            btn.setAttribute("aria-expanded", "false")
        }

        btn.onclick = openSettingsModal
        cancelBtn.onclick = closeSettingsModal

        if (!overlay.__vispromBound) {
            overlay.__vispromBound = true
            overlay.addEventListener("click", function (ev) {
                if (ev.target === overlay) closeSettingsModal()
            })
            document.addEventListener("keydown", function (ev) {
                if (ev && ev.key === "Escape" && overlay && !overlay.hasAttribute("hidden")) {
                    closeSettingsModal()
                }
            })
        }

        function applyAndCloseSettingsModal() {
            const newSelTarget = parseInt(selInput.value, 10)
            const newContourLevels = parseInt(contourInput.value, 10)
            mainChartSettingsSelectionsTarget = newSelTarget
            mainChartSettingsContourLevels = newContourLevels
            applyMainChartSettingsFromUI(newSelTarget, newContourLevels)
            closeSettingsModal()
        }
        applyBtn.onclick = applyAndCloseSettingsModal
        selInput.onkeydown = function (ev) {
            if (ev && ev.key === "Enter") applyAndCloseSettingsModal()
        }
        contourInput.onkeydown = function (ev) {
            if (ev && ev.key === "Enter") applyAndCloseSettingsModal()
        }
    } catch (e) {
        console.warn("[Main Chart Settings] init failed:", e)
    }
}

function setSelectionLayersToColoredCount(targetColored, options) {
    const opts = options || {}
    const abortOnNonEmpty = opts.abortOnNonEmpty !== false

    const currentColored = Math.max(0, selections.length - 1)
    const maxColored = currentColored + (reserve ? reserve.length : 0)
    const target = clamp(parseInt(targetColored, 10), 1, Math.max(1, maxColored))
    if (target === currentColored) return false

    let changed = false

    if (target > currentColored) {
        const toAdd = target - currentColored
        for (let i = 0; i < toAdd; i++) {
            const newS = sel.add(reserve, selections)
            if (!newS) break
            ensureSelectionLayerMeta(newS)
        }
        changed = true
    } else {
        // Removing layers can clear user selections in those layers. Avoid data loss unless empty.
        const keepBluePlus = target // colored layers to keep (excluding Blue)
        const layersToRemove = selections.slice(keepBluePlus + 1) // remove from the tail
        if (abortOnNonEmpty && layersToRemove.some(function (l) { return l && l.content && l.content.size > 0 })) {
            alert("Can’t reduce selection layers while those extra layers still contain selected points. Clear them first.");
            return false
        }

        // Remove from tail.
        for (let i = layersToRemove.length - 1; i >= 0; i--) {
            const layer = layersToRemove[i]
            if (!layer) continue
            // Move its colored points back to Blue.
            sel.remove(reserve, selections, layer)
            syncSelectionMemoryAfterLayerClear(layer)
            changed = true
        }

        // Restore active selection if needed.
        if (current_color && current_color.length) {
            const active = current_color[0]
            if (active && !selections.includes(active)) {
                current_color = selections.length > 1 ? [selections[selections.length - 1]] : []
            }
        } else {
            current_color = selections.length > 1 ? [selections[selections.length - 1]] : []
        }
    }

    return changed
}

function applyMainChartSettingsFromUI(selectionTargetColored, contourLevels) {
    let didSelectionChange = false

    if (Number.isFinite(selectionTargetColored)) {
        didSelectionChange = setSelectionLayersToColoredCount(selectionTargetColored, { abortOnNonEmpty: true })
    }

    if (Number.isFinite(contourLevels) && typeof scaterplot.setContourLevels === "function") {
        scaterplot.setContourLevels(contourLevels)
        if (mainviewSvg) scaterplot.invalidateContourCache(mainviewSvg)
        refreshMainChartRendering()
    }

    if (didSelectionChange) {
        // Rebuild the selection UI once after the bulk change.
        invalidateSelectionMembershipIndex()
        refreshTableView()
        refreshSelectionExportUI({ immediate: true, full: true })
        refreshAllSelectionViews()
    }
}

const PROVENANCE_EXPORT_LABEL = "visprom-provenance-export"
const LEGACY_PROVENANCE_LABELS = ["visprom-provenance-v2"]

function getSplomOverviewOptionsFromUI() {
    return {
        // Keep robust axes always on; no manual toggle needed.
        useRobustDomain: true,
        padding: VIS_CONFIG.splom.domainPadding
    }
}

function ensureSplomViewControls() {
    ensureSplomZoomResetControl()
    const host = document.querySelector(".splom-head-actions")
    if (host) {
        const existingCompareControl = host.querySelector(".splom-mode-control")
        if (existingCompareControl) existingCompareControl.remove()
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
}

function getSplomScrollContainer() {
    return (
        document.querySelector(".panel-splom .splom") ||
        document.querySelector("#splom-scroll-container") ||
        document.querySelector("#splom-container") ||
        document.querySelector(".splom-scroll-container") ||
        document.querySelector(".splom-container") ||
        (splom && !splom.empty() ? splom.node() : null) ||
        document.querySelector(".splom-wrapper") ||
        document.querySelector(".splom")
    )
}

function getSplomZoomLayer() {
    const direct = document.querySelector("#splom-zoom-layer") || document.querySelector(".splom-zoom-layer")
    if (direct) return direct
    const splomSvg = document.querySelector(".splom-svg")
    if (splomSvg && splomSvg.parentElement) return splomSvg.parentElement
    const container = getSplomScrollContainer()
    if (!container) return null
    return container.querySelector(".splom-zoom-layer")
}

function updateSplomScaledScrollArea() {
    const scrollContent = document.querySelector(".splom-scroll-content") || document.querySelector("#splom-scroll-content")
    if (!scrollContent || !splomBaseWidth || !splomBaseHeight) return
    scrollContent.style.width = (splomBaseWidth * splomZoomScale) + "px"
    scrollContent.style.height = (splomBaseHeight * splomZoomScale) + "px"
}

function setSplomBaseSize(width, height) {
    const w = Number(width)
    const h = Number(height)
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return
    splomBaseWidth = w
    splomBaseHeight = h
    updateSplomScaledScrollArea()
}

function splomLayoutStrokeForScreen(targetScreenPx, minScreenPx, maxScreenPx) {
    const zoom = Math.max(Number(splomZoomScale) || 1, SPLOM_MIN_ZOOM)
    const minScreen = Number.isFinite(minScreenPx) ? minScreenPx : 2
    const maxScreen = Number.isFinite(maxScreenPx) ? maxScreenPx : 10
    const screen = Math.min(maxScreen, Math.max(minScreen, targetScreenPx))
    const layout = screen / zoom
    return Math.min(220, Math.max(1, layout))
}

function updateSplomZoomVisualScale() {
    const splomRoot = document.querySelector(".splom")
    if (!splomRoot) return
    const px = function (value, minScreen, maxScreen) {
        return splomLayoutStrokeForScreen(value, minScreen, maxScreen) + "px"
    }
    splomRoot.style.setProperty("--splom-active-stroke-min", px(2.5, 2, 8))
    splomRoot.style.setProperty("--splom-active-stroke-base", px(3.5, 2.5, 9))
    splomRoot.style.setProperty("--splom-active-stroke-pulse1", px(6, 3, 12))
    splomRoot.style.setProperty("--splom-active-stroke-pulse2", px(5, 2.5, 10))
    splomRoot.style.setProperty("--splom-active-stroke-glow1", px(3.5, 2, 10))
    splomRoot.style.setProperty("--splom-active-stroke-glow2", px(5, 2.5, 12))
    splomRoot.style.setProperty("--splom-hover-stroke", px(4, 2.5, 9))
}

function applySplomZoom() {
    const zoomLayer = getSplomZoomLayer()
    if (!zoomLayer) {
        console.warn("[SPLOM pinch zoom] Missing zoom layer")
        return
    }

    zoomLayer.style.transformOrigin = "0 0"
    zoomLayer.style.transform = "scale(" + splomZoomScale + ")"
    zoomLayer.style.willChange = "transform"

    updateSplomScaledScrollArea()
    updateSplomZoomVisualScale()

    console.log("[SPLOM pinch zoom applied]", {
        splomZoomScale: splomZoomScale
    })
}

function ensureSplomZoomLayerStructure() {
    const container = getSplomScrollContainer()
    if (!container) return null

    let scrollContent = container.querySelector(".splom-scroll-content")
    let zoomLayer = container.querySelector(".splom-zoom-layer")

    if (scrollContent && zoomLayer && zoomLayer.parentElement === scrollContent) {
        return { container: container, scrollContent: scrollContent, zoomLayer: zoomLayer }
    }

    scrollContent = document.createElement("div")
    scrollContent.className = "splom-scroll-content"
    scrollContent.style.position = "relative"
    scrollContent.style.width = "max-content"
    scrollContent.style.height = "max-content"

    zoomLayer = document.createElement("div")
    zoomLayer.className = "splom-zoom-layer"
    zoomLayer.style.display = "inline-block"
    zoomLayer.style.transformOrigin = "0 0"

    while (container.firstChild) {
        zoomLayer.appendChild(container.firstChild)
    }
    scrollContent.appendChild(zoomLayer)
    container.appendChild(scrollContent)

    return { container: container, scrollContent: scrollContent, zoomLayer: zoomLayer }
}

function syncSplomZoomBaseFromLayout() {
    const refs = ensureSplomZoomLayerStructure()
    if (!refs || !refs.zoomLayer) return
    const baseWidth = refs.zoomLayer.scrollWidth || refs.zoomLayer.offsetWidth
    const baseHeight = refs.zoomLayer.scrollHeight || refs.zoomLayer.offsetHeight
    setSplomBaseSize(baseWidth, baseHeight)
    applySplomZoom()
}

function zoomSplomAroundPointer(container, zoomLayer, event, oldScale, newScale) {
    const rect = container.getBoundingClientRect()
    const pointerX = event.clientX - rect.left
    const pointerY = event.clientY - rect.top

    const scrollX = container.scrollLeft
    const scrollY = container.scrollTop

    const contentX = (scrollX + pointerX) / oldScale
    const contentY = (scrollY + pointerY) / oldScale

    splomZoomScale = newScale
    applySplomZoom()

    container.scrollLeft = contentX * newScale - pointerX
    container.scrollTop = contentY * newScale - pointerY

    console.log("[SPLOM pinch zoom]", {
        oldScale: oldScale,
        newScale: newScale,
        pointerX: pointerX,
        pointerY: pointerY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop
    })
}

function installSplomPinchZoom() {
    const refs = ensureSplomZoomLayerStructure()
    if (!refs) {
        console.warn("[SPLOM pinch zoom] Could not install", { container: null, zoomLayer: null })
        return
    }
    const container = refs.container
    const zoomLayer = refs.zoomLayer

    if (!container || !zoomLayer) {
        console.warn("[SPLOM pinch zoom] Could not install", {
            container: container,
            zoomLayer: zoomLayer
        })
        return
    }

    if (container.__splomPinchZoomInstalled) {
        syncSplomZoomBaseFromLayout()
        return
    }

    container.__splomPinchZoomInstalled = true

    container.addEventListener("wheel", function (event) {
        if (!event.ctrlKey) {
            return
        }

        event.preventDefault()
        event.stopPropagation()

        const oldScale = splomZoomScale
        const zoomFactor = 1 - event.deltaY * SPLOM_ZOOM_SPEED
        const newScale = clamp(oldScale * zoomFactor, SPLOM_MIN_ZOOM, SPLOM_MAX_ZOOM)

        if (newScale === oldScale) return
        zoomSplomAroundPointer(container, zoomLayer, event, oldScale, newScale)
    }, { passive: false })

    console.log("[SPLOM pinch zoom] Installed without changing scroll behavior")
}

function installSplomWheelDebug() {
    const container = getSplomScrollContainer()
    if (!container || container.__splomWheelDebugInstalled) return
    container.__splomWheelDebugInstalled = true

    container.addEventListener("wheel", function (event) {
        console.log("[SPLOM wheel debug]", {
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            ctrlKey: event.ctrlKey,
            zoomScale: splomZoomScale,
            scrollLeft: container.scrollLeft,
            scrollTop: container.scrollTop,
            defaultPrevented: event.defaultPrevented
        })
    }, { passive: true })
}

function resetSplomZoom() {
    const container = getSplomScrollContainer()
    splomZoomScale = 1
    applySplomZoom()
    if (container) {
        container.scrollLeft = 0
        container.scrollTop = 0
    }
    console.log("[SPLOM pinch zoom reset]")
}

function getSplomCellsForPair(xDim, yDim) {
    const cells = []
    if (!splom || splom.empty() || !xDim || !yDim) return cells
    const pairKey = comparisonDataset.getPairKey(xDim, yDim)
    splom.selectAll(".splom-cell").each(function () {
        const cell = this
        if (isSplomTriangleCompareActive()) {
            if (cell.getAttribute("data-pair-key") === pairKey) cells.push(cell)
            return
        }
        if (cell.getAttribute("data-x-dim") === xDim && cell.getAttribute("data-y-dim") === yDim) {
            cells.push(cell)
        }
    })
    return cells
}

function getSplomCellContentRect(cell, zoomLayer) {
    const scale = splomZoomScale || 1
    const cellR = cell.getBoundingClientRect()
    const layerR = zoomLayer.getBoundingClientRect()
    const left = (cellR.left - layerR.left) / scale
    const top = (cellR.top - layerR.top) / scale
    const width = cellR.width / scale
    const height = cellR.height / scale
    return {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height,
        width: width,
        height: height
    }
}

function areSplomCellsFullyInView(cells, container, bufferPx) {
    if (!container || !cells.length) return true
    const buf = bufferPx != null ? bufferPx : SPLOM_FOCUS_BUFFER_PX
    const view = container.getBoundingClientRect()
    for (let i = 0; i < cells.length; i++) {
        const r = cells[i].getBoundingClientRect()
        if (r.left < view.left + buf || r.right > view.right - buf ||
            r.top < view.top + buf || r.bottom > view.bottom - buf) {
            return false
        }
    }
    return true
}

function focusSplomOnPair(xDim, yDim, options) {
    const opts = options || {}
    if (!splom || splom.empty() || !xDim || !yDim) return false
    const refs = ensureSplomZoomLayerStructure()
    const container = refs && refs.container
    const zoomLayer = refs && refs.zoomLayer
    if (!container || !zoomLayer) return false

    syncSplomZoomBaseFromLayout()

    const cells = getSplomCellsForPair(xDim, yDim)
    if (!cells.length) return false

    let minL = Infinity
    let minT = Infinity
    let maxR = -Infinity
    let maxB = -Infinity
    cells.forEach(function (cell) {
        const r = getSplomCellContentRect(cell, zoomLayer)
        minL = Math.min(minL, r.left)
        minT = Math.min(minT, r.top)
        maxR = Math.max(maxR, r.right)
        maxB = Math.max(maxB, r.bottom)
    })

    const buffer = opts.buffer != null ? opts.buffer : SPLOM_FOCUS_BUFFER_PX
    const boxW = Math.max(1, (maxR - minL) + buffer * 2)
    const boxH = Math.max(1, (maxB - minT) + buffer * 2)
    const centerX = (minL + maxR) / 2
    const centerY = (minT + maxB) / 2

    const needFit = opts.forceFit || !areSplomCellsFullyInView(cells, container, buffer)
    let targetScale = splomZoomScale
    if (needFit && container.clientWidth > 0 && container.clientHeight > 0) {
        const fitScale = Math.min(
            container.clientWidth / boxW,
            container.clientHeight / boxH
        )
        targetScale = Math.max(SPLOM_MIN_ZOOM, Math.min(SPLOM_MAX_ZOOM, Math.min(splomZoomScale, fitScale)))
    }

    if (Math.abs(targetScale - splomZoomScale) > 0.0001) {
        splomZoomScale = targetScale
        applySplomZoom()
    }

    const scaledCenterX = centerX * splomZoomScale
    const scaledCenterY = centerY * splomZoomScale
    const maxScrollLeft = Math.max(0, (splomBaseWidth || zoomLayer.scrollWidth) * splomZoomScale - container.clientWidth)
    const maxScrollTop = Math.max(0, (splomBaseHeight || zoomLayer.scrollHeight) * splomZoomScale - container.clientHeight)
    container.scrollLeft = Math.max(0, Math.min(maxScrollLeft, scaledCenterX - container.clientWidth / 2))
    container.scrollTop = Math.max(0, Math.min(maxScrollTop, scaledCenterY - container.clientHeight / 2))
    return true
}

function scheduleSplomFocusOnPair(xDim, yDim, options) {
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            focusSplomOnPair(xDim, yDim, options)
        })
    })
}

function applySplomHoverForCell(cellEl, event) {
    if (!cellEl || !cellEl.classList || !cellEl.classList.contains("splom-cell")) return
    if (cellEl.classList.contains("splom-diag-cell")) return
    const xDim = cellEl.getAttribute("data-x-dim")
    const yDim = cellEl.getAttribute("data-y-dim")
    if (!xDim || !yDim) return
    const triangleSource = cellEl.getAttribute("data-triangle-source")
    if (isSplomTriangleCompareActive()) {
        highlightMatchingSplomPair(xDim, yDim, triangleSource)
    } else {
        splom.selectAll(".splom-cell").classed("splom-cell-hovered", false).classed("splom-cell-matching-pair", false)
        d3.select(cellEl).classed("splom-cell-hovered", true)
    }
    if (event) {
        showVispromFloatingTooltip(formatSplomHoverText(yDim, xDim), event)
    }
}

function clearSplomHoverHighlights() {
    clearMatchingSplomPairHighlights()
}

function ensureSplomHoverHandlers() {
    const root = getSplomNavEventRoot() || (splom && !splom.empty() ? splom.node() : null)
    if (!root || root.__splomHoverBound) return
    root.__splomHoverBound = true

    root.addEventListener("mouseover", function (event) {
        const cell = event.target && event.target.closest ? event.target.closest(".splom-cell") : null
        if (!cell || !root.contains(cell) || cell.classList.contains("splom-diag-cell")) return
        if (cell.__splomHoverActive) return
        cell.__splomHoverActive = true
        applySplomHoverForCell(cell, event)
    }, true)

    root.addEventListener("mouseout", function (event) {
        const cell = event.target && event.target.closest ? event.target.closest(".splom-cell") : null
        if (!cell || !root.contains(cell)) return
        const related = event.relatedTarget
        if (related && cell.contains(related)) return
        cell.__splomHoverActive = false
        clearSplomHoverHighlights()
        hideVispromFloatingTooltip()
    }, true)
}

function ensureSplomZoomResetControl() {
    const host = document.querySelector(".splom-head-actions")
    if (!host || document.getElementById("splomResetZoomBtn")) return
    const button = document.createElement("button")
    button.type = "button"
    button.id = "splomResetZoomBtn"
    button.textContent = "Reset SPLOM Zoom"
    button.addEventListener("click", resetSplomZoom)
    host.appendChild(button)
}

function ensureMainChartViewControl() {
    if (document.getElementById("mainChartViewOverlay")) return
    const host = document.querySelector(".main-chart-head-actions")
    if (!host) return

    const group = document.createElement("div")
    group.className = "main-chart-view-control"
    group.id = "mainChartViewControl"
    group.style.display = comparisonDatasetRows ? "" : "none"
    group.innerHTML = "<span class=\"main-chart-view-label\">Main Chart View:</span>"

    const modes = [
        { id: "mainChartViewPrimary", value: "primary", label: "Primary only" },
        { id: "mainChartViewComparison", value: "comparison", label: "Comparison only" },
        { id: "mainChartViewOverlay", value: "overlay", label: "Overlay comparison" }
    ]
    modes.forEach(function (mode) {
        const label = document.createElement("label")
        const input = document.createElement("input")
        input.type = "radio"
        input.name = "mainChartViewMode"
        input.id = mode.id
        input.value = mode.value
        input.checked = mainChartViewMode === mode.value
        label.appendChild(input)
        label.appendChild(document.createTextNode(" " + mode.label))
        group.appendChild(label)
    })

    host.insertBefore(group, host.firstChild)

    group.addEventListener("change", function () {
        const selected = document.querySelector("input[name='mainChartViewMode']:checked")
        mainChartViewMode = selected ? selected.value : "overlay"
        refreshMainChartRendering()
    })
}

function refreshMainChartViewControlVisibility() {
    const group = document.getElementById("mainChartViewControl")
    if (group) group.style.display = comparisonDatasetRows ? "" : "none"
}

function applyComparisonDatasetUpload(file) {
    return comparisonDataset.parseComparisonFile(file).then(function (parsed) {
        const prepared = comparisonDataset.prepareComparisonDataset(parsed.rows)
        const compDims = comparisonDataset.getNumericColumnNames(prepared)
        const match = comparisonDataset.analyzeDimensionMatch(allDimensions, compDims)

        if (match.sharedDimensions.length < comparisonDataset.MIN_SHARED_DIMENSIONS) {
            alert("The uploaded comparison dataset does not share enough dimensions with the current dataset.")
            return
        }

        comparisonDatasetRows = prepared
        comparisonDatasetLabel = parsed.label || "Dataset 2"
        sharedDimensions = match.sharedDimensions
        unmatchedPrimaryDimensions = match.unmatchedPrimaryDimensions
        unmatchedComparisonDimensions = match.unmatchedComparisonDimensions
        comparisonDatasetVersion += 1

        for (let i = 0; i < comparisonDatasetRows.length; i++) {
            const d = comparisonDatasetRows[i]
            selections[0].content.add(d)
            d.color.add(selections[0].color)
        }

        deactivateSoucheTriangleCompare({ keepSplomCompare: true, skipRadioSync: true })
        splomMode = "compare"
        mainChartViewMode = "overlay"
        activeDatasetSource = "primary"
        sploom.invalidateSplomCaches("comparison upload")

        const summary = comparisonDataset.formatComparisonSummary(datum, comparisonDatasetRows, match)
        alert(summary)

        const compareRadio = document.getElementById("splomModeCompare")
        if (compareRadio) compareRadio.checked = true
        const overlayRadio = document.getElementById("mainChartViewOverlay")
        if (overlayRadio) overlayRadio.checked = true
        refreshMainChartViewControlVisibility()
        ensureMainChartViewControl()

        if (setComparisonUploadStatus) {
            setComparisonUploadStatus(summary.replace(/\n/g, " · "), false)
        }

        if (datum && splom && !splom.empty()) {
            rebuildSplomWithDimensions(getSplomDimensionsForDisplay())
        }
        refreshMainChartRendering()
    })
}

let setComparisonUploadStatus = null
let setDatasetLoadStatus = null
let renderYeastFilterPanel = null
let renderSplomSoucheDropdown = null

function refreshAllSelectionViews() {
    return timeBlock("refreshAllSelectionViews", function () {
        if (mainviewSvg && datum) {
            scaterplot.updatePoints(getMainChartPrimaryData(), mainviewSvg)
        }
        refreshSplomAfterSelection()
        syncOpenSoucheComparisonSelections()
    })
}

function canDatasetSplomCompare() {
    return !!(comparisonDatasetRows && comparisonDatasetRows.length &&
        sharedDimensions.length >= comparisonDataset.MIN_SHARED_DIMENSIONS)
}

function canSoucheSplomCompare() {
    return !!(yeastColumn && selectedYeastTypes.length === 2)
}

function syncSplomModeRadios() {
    const compareRadio = document.getElementById("splomModeCompare")
    const singleRadio = document.getElementById("splomModeSingle")
    if (!compareRadio || !singleRadio) return
    const compareOn = splomMode === "compare" && (soucheTriangleCompareActive || canDatasetSplomCompare())
    compareRadio.checked = compareOn
    singleRadio.checked = !compareOn
}

function deactivateSoucheTriangleCompare(options) {
    const opts = options || {}
    const previousContextKey = getSelectionContextKey()
    soucheTriangleCompareActive = false
    yeastMode = "overlay"
    triangleLowerYeast = null
    triangleUpperYeast = null
    switchSelectionContext(getSelectionContextKey(), previousContextKey)
    if (!opts.keepSplomCompare && !canDatasetSplomCompare()) {
        splomMode = "single"
    }
    if (!opts.skipRadioSync) syncSplomModeRadios()
    syncYeastTrianglePickerUI()
    ensureMainChartYeastViewControl()
    ensureSelectionTargetControl()
}

function activateSoucheTriangleCompare(options) {
    const opts = options || {}
    if (!canSoucheSplomCompare()) return false
    const previousContextKey = getSelectionContextKey()
    const wasActive = soucheTriangleCompareActive
    soucheTriangleCompareActive = true
    yeastMode = "compare"
    splomMode = "compare"
    triangleLowerYeast = selectedYeastTypes[0]
    triangleUpperYeast = selectedYeastTypes[1]
    switchSelectionContext(getSelectionContextKey(), previousContextKey)
    if (!opts.skipRadioSync) syncSplomModeRadios()
    syncYeastTrianglePickerUI()
    ensureMainChartYeastViewControl()
    ensureSelectionTargetControl()
    if (!wasActive) {
        logProvenanceAction("set_souche_triangle_comparison", {
            lower: triangleLowerYeast,
            upper: triangleUpperYeast,
            selectedYeastTypes: selectedYeastTypes.slice()
        })
    }
    if (!opts.skipRebuild) {
        if (datum && splom && !splom.empty()) {
            sploom.invalidateSplomCaches("souche triangle compare")
            rebuildSplomWithDimensions(getSplomDimensionsForDisplay())
        }
        refreshTableView()
        refreshMainChartRendering()
    }
    if (!opts.silent && setYeastPanelStatus) {
        setYeastPanelStatus(
            "Triangle compare: " + triangleLowerYeast + " (lower) vs " + triangleUpperYeast + " (upper).",
            false
        )
    }
    return true
}

function tryEnableSplomCompareMode() {
    if (canSoucheSplomCompare()) {
        activateSoucheTriangleCompare({ skipRebuild: true })
        splomMode = "compare"
        syncSplomModeRadios()
        sploom.invalidateSplomCaches("splom mode")
        if (datum && splom && !splom.empty()) {
            rebuildSplomWithDimensions(getSplomDimensionsForDisplay())
        }
        refreshMainChartRendering()
        if (setYeastPanelStatus) {
            setYeastPanelStatus(
                "SPLOM compare: " + triangleLowerYeast + " vs " + triangleUpperYeast + ".",
                false
            )
        }
        return true
    }
    if (canDatasetSplomCompare()) {
        deactivateSoucheTriangleCompare({ keepSplomCompare: true, skipRadioSync: true })
        splomMode = "compare"
        syncSplomModeRadios()
        sploom.invalidateSplomCaches("splom mode")
        if (datum && splom && !splom.empty()) {
            rebuildSplomWithDimensions(getSplomDimensionsForDisplay())
        }
        refreshMainChartRendering()
        return true
    }
    if (yeastColumn) {
        alert("Select exactly 2 Souches in the Data panel, or upload a comparison dataset first.")
    } else {
        alert("Upload a comparison dataset with enough shared dimensions first.")
    }
    return false
}

function applySplomSingleMode() {
    deactivateSoucheTriangleCompare({ skipRadioSync: true })
    splomMode = "single"
    syncSplomModeRadios()
    sploom.invalidateSplomCaches("splom mode")
    if (datum && splom && !splom.empty()) {
        rebuildSplomWithDimensions(getSplomDimensionsForDisplay())
    }
    refreshTableView()
    refreshMainChartRendering()
    if (setYeastPanelStatus) setYeastPanelStatus("", false)
}

function applyYeastOverlayFilter(source) {
    const previousContextKey = getSelectionContextKey()
    yeastMode = soucheTriangleCompareActive ? "compare" : "overlay"
    syncYeastPanelCheckboxes()
    invalidateSplomDisplayRowsCache()

    if (datum && splom && !splom.empty()) {
        sploom.invalidateSplomCaches("yeast filter")
        rebuildSplomWithDimensions(getSplomDimensionsForDisplay())
    }
    switchSelectionContext(getSelectionContextKey(), previousContextKey)
    refreshTableView()
    refreshMainChartRendering()
    updateMainChartSoucheNavigator()
    selectionsList(selections, selList)
    updateCountTable(datum, countTable)
    refreshSplomHeatFromVisitCounts()
    ensureMainChartYeastViewControl()
    ensureSelectionTargetControl()
    logProvenanceAction("set_souche_filter", {
        yeastColumn: yeastColumn,
        selectedYeastTypes: selectedYeastTypes.slice(),
        yeastMode: yeastMode,
        soucheTriangleCompareActive: soucheTriangleCompareActive,
        source: source || "yeast_panel"
    })
}

function normalizeSoucheSelection(nextSelected) {
    if (!Array.isArray(nextSelected)) return []
    const availableSet = new Set((availableYeastTypes || []).map(String))
    const deduped = []
    const seen = new Set()
    nextSelected.forEach(function (value) {
        const normalized = String(value)
        if (seen.has(normalized)) return
        if (availableSet.size && !availableSet.has(normalized)) return
        seen.add(normalized)
        deduped.push(normalized)
    })
    return deduped
}

function syncSplomSoucheDropdownSelection() {
    try {
        const select = document.getElementById("splom-souche-select")
        const upperSelect = document.getElementById("splom-upper-souche-select")
        if (!select && !upperSelect) return
        const selected = selectedYeastTypes && selectedYeastTypes.length ? String(selectedYeastTypes[0]) : ""
        if (select && selected) {
            select.value = selected
        } else if (select && select.options && select.options.length) {
            select.selectedIndex = 0
        }
        if (upperSelect) {
            const upperValue = soucheTriangleCompareActive && triangleUpperYeast ? String(triangleUpperYeast) : ""
            upperSelect.value = upperValue
        }
    } catch (err) {
        console.warn("[Souche dropdown] sync failed", err)
    }
}

function applyUpperTriangleSoucheSelection(nextUpperSouche, options) {
    const opts = options || {}
    const source = opts.source || "splom-upper-souche-dropdown"
    const normalizedUpper = nextUpperSouche ? String(nextUpperSouche) : null
    const normalizedMain = currentSouche ? String(currentSouche) : null

    if (!normalizedMain) return

    if (!normalizedUpper) {
        soucheTriangleCompareActive = false
        yeastMode = "overlay"
        triangleLowerYeast = null
        triangleUpperYeast = null
        selectedYeastTypes = [normalizedMain]
        if (splomMode === "compare" && !canDatasetSplomCompare()) splomMode = "single"
    } else {
        soucheTriangleCompareActive = true
        yeastMode = "compare"
        splomMode = "compare"
        triangleLowerYeast = normalizedMain
        triangleUpperYeast = normalizedUpper
        selectedYeastTypes = normalizedMain === normalizedUpper
            ? [normalizedMain]
            : [normalizedMain, normalizedUpper]
    }

    syncSplomModeRadios()
    syncYeastTrianglePickerUI()
    ensureMainChartYeastViewControl()
    ensureSelectionTargetControl()
    syncYeastPanelCheckboxes()
    syncSplomSoucheDropdownSelection()

    syncCurrentContextToLayerSouche()

    invalidateSplomDisplayRowsCache()
    if (datum && splom && !splom.empty()) {
        sploom.invalidateSplomCaches("souche upper dropdown")
        rebuildSplomWithDimensions(getSplomDimensionsForDisplay())
    }
    refreshSplomHeatFromVisitCounts()
    refreshTableView()
    rebuildColoredSelectionContentFromSoucheKeys()
    refreshMainChartRendering()
    if (renderSplomSoucheDropdown) renderSplomSoucheDropdown()
    logProvenanceAction("set_upper_triangle_souche", {
        source: source,
        main: normalizedMain,
        upper: normalizedUpper,
        soucheTriangleCompareActive: soucheTriangleCompareActive
    })
}

function applySoucheSelection(nextSelected, options) {
    const opts = options || {}
    const source = opts.source || "unknown"
    let normalizedSelection = normalizeSoucheSelection(nextSelected)

    if (opts.enforceSingle && normalizedSelection.length > 1 &&
        !soucheTriangleCompareActive && splomMode !== "compare") {
        normalizedSelection = [normalizedSelection[normalizedSelection.length - 1]]
    }

    selectedYeastTypes = normalizedSelection
    syncYeastPanelCheckboxes()
    syncSplomSoucheDropdownSelection()

    if (soucheTriangleCompareActive) {
        if (selectedYeastTypes.length !== 2) {
            deactivateSoucheTriangleCompare({ skipRadioSync: true })
            splomMode = canDatasetSplomCompare() ? "compare" : "single"
            syncSplomModeRadios()
        } else {
            triangleLowerYeast = selectedYeastTypes[0]
            triangleUpperYeast = selectedYeastTypes[1]
            syncYeastTrianglePickerUI()
        }
    }

    if (!soucheTriangleCompareActive && splomMode !== "compare" && selectedYeastTypes.length === 1) {
        goToSoucheByName(selectedYeastTypes[0], source)
        return
    }

    applyYeastOverlayFilter(source)
}

function onYeastFilterChanged() {
    const domEvent = d3.event
    const target = domEvent && domEvent.target

    // Pick one souche = switch (Shift+click keeps multi-overlay).
    if (target && target.classList && target.classList.contains("yeast-type-checkbox") &&
        target.checked && domEvent && !domEvent.shiftKey &&
        !soucheTriangleCompareActive && splomMode !== "compare") {
        document.querySelectorAll(".yeast-type-checkbox").forEach(function (box) {
            if (box !== target) box.checked = false
        })
    }

    const boxes = document.querySelectorAll(".yeast-type-checkbox")
    const nextSelected = []
    boxes.forEach(function (box) {
        if (box.checked) nextSelected.push(box.getAttribute("data-yeast"))
    })
    applySoucheSelection(nextSelected, {
        source: "yeast_panel",
        enforceSingle: !!(target && target.classList && target.classList.contains("yeast-type-checkbox") &&
            target.checked && domEvent && !domEvent.shiftKey)
    })
}

function getSessionUiState() {
    return {
        mainChartMode: mainChartMode,
        selectedColumns: selectedColumns.slice(),
        dimensionFamilies: dimensionFamilies.cloneFamilies(currentDimensionFamilies),
        expandedFamilies: Array.from(expandedFamilies),
        yeastColumn: yeastColumn,
        availableYeastTypes: availableYeastTypes.slice(),
        currentSouche: currentSouche,
        currentSoucheIndex: currentSoucheIndex,
        selectedYeastTypes: selectedYeastTypes.slice(),
        yeastMode: yeastMode,
        soucheTriangleCompareActive: soucheTriangleCompareActive,
        triangleLowerYeast: triangleLowerYeast,
        triangleUpperYeast: triangleUpperYeast,
        mainChartYeastView: mainChartYeastView,
        savedYeastPairComparisons: savedYeastPairComparisons.slice(),
        selectionTarget: selectionTarget,
        currentPair: { xDim: mainChartMvX, yDim: mainChartMvY },
        visibleSplomDimensions: getVisibleSplomDimensions(),
        visibleTableColumns: getVisibleTableColumns(),
        splomOverviewFromUI: getSplomOverviewOptionsFromUI(),
        splomOverviewRuntime: sploom.getSplomOverviewOptions(),
        currentSelectionType: current_selectionType,
        splomMode: splomMode,
        mainChartViewMode: mainChartViewMode,
        activeDatasetSource: activeDatasetSource,
        primaryDatasetLabel: primaryDatasetLabel,
        comparisonDatasetLabel: comparisonDatasetLabel
    }
}

function applySessionUiState(ui) {
    if (!ui) return
    if (ui.mainChartMode) {
        mainChartMode = ui.mainChartMode === "density" ? "density" : "original"
        scaterplot.setRenderMode(mainChartMode)
        const modeSelect = document.getElementById("mainChartModeSelect")
        if (modeSelect) modeSelect.value = mainChartMode
    }
    if (ui.selectedColumns) {
        selectedColumns = ui.selectedColumns.filter(function (d) {
            return numericDimensions.indexOf(d) !== -1
        })
    }
    if (ui.dimensionFamilies) {
        currentDimensionFamilies = dimensionFamilies.cloneFamilies(ui.dimensionFamilies)
        syncDimensionFamiliesState()
    }
    if (ui.expandedFamilies) {
        expandedFamilies = new Set(ui.expandedFamilies)
    }
    if (ui.availableYeastTypes) availableYeastTypes = ui.availableYeastTypes.slice()
    if (ui.currentSoucheIndex != null) currentSoucheIndex = ui.currentSoucheIndex
    if (ui.currentSouche != null) currentSouche = ui.currentSouche
    syncCurrentSoucheState()
    if (ui.selectedYeastTypes) selectedYeastTypes = ui.selectedYeastTypes.slice()
    if (ui.soucheTriangleCompareActive && ui.triangleLowerYeast && ui.triangleUpperYeast) {
        soucheTriangleCompareActive = true
        yeastMode = "compare"
        triangleLowerYeast = ui.triangleLowerYeast
        triangleUpperYeast = ui.triangleUpperYeast
    } else if (ui.yeastMode === "compare" && ui.triangleLowerYeast && ui.triangleUpperYeast) {
        soucheTriangleCompareActive = true
        yeastMode = "compare"
        triangleLowerYeast = ui.triangleLowerYeast
        triangleUpperYeast = ui.triangleUpperYeast
    } else {
        soucheTriangleCompareActive = false
        yeastMode = "overlay"
        if (!ui.soucheTriangleCompareActive) {
            triangleLowerYeast = null
            triangleUpperYeast = null
        }
    }
    if (ui.mainChartYeastView) mainChartYeastView = ui.mainChartYeastView
    if (ui.savedYeastPairComparisons) savedYeastPairComparisons = ui.savedYeastPairComparisons.slice()
    openedSoucheComparisons = []
    syncSoucheComparisonListsToStorage()
    if (ui.selectionTarget) selectionTarget = ui.selectionTarget
    if (ui.currentPair && ui.currentPair.xDim) mainChartMvX = ui.currentPair.xDim
    if (ui.currentPair && ui.currentPair.yDim) mainChartMvY = ui.currentPair.yDim
    if (renderYeastFilterPanel) renderYeastFilterPanel()
    ensureMainChartYeastViewControl()
    syncColumnHighlightUI()
    renderFamilyDimensionPanel()
    sploom.setSplomOverviewOptions(
        Object.assign({}, sploom.getSplomOverviewOptions(), ui.splomOverviewRuntime || {}, getSplomOverviewOptionsFromUI())
    )
    if (ui.currentSelectionType != null) {
        current_selectionType = ui.currentSelectionType
    }
    if (ui.splomMode) {
        splomMode = ui.splomMode === "compare" ? "compare" : "single"
    }
    if (splomMode === "compare") {
        if (soucheTriangleCompareActive && canSoucheSplomCompare()) {
            activateSoucheTriangleCompare({ silent: true, skipRebuild: true, skipRadioSync: true })
        } else if (canDatasetSplomCompare()) {
            deactivateSoucheTriangleCompare({ keepSplomCompare: true, skipRadioSync: true })
        } else {
            splomMode = "single"
            deactivateSoucheTriangleCompare({ skipRadioSync: true })
        }
    } else {
        deactivateSoucheTriangleCompare({ skipRadioSync: true })
    }
    syncSplomModeRadios()
    if (ui.mainChartViewMode) {
        mainChartViewMode = ui.mainChartViewMode
    }
    if (ui.activeDatasetSource) {
        activeDatasetSource = ui.activeDatasetSource === "comparison" ? "comparison" : "primary"
    }
    if (ui.primaryDatasetLabel) primaryDatasetLabel = ui.primaryDatasetLabel
    if (ui.comparisonDatasetLabel) comparisonDatasetLabel = ui.comparisonDatasetLabel
    if (datum && splom && !splom.empty()) {
        applySelectedDimensions()
    }
    if (datum && tableView_table) {
        refreshTableView()
    }
    ensureMainChartSoucheNavigator()
    updateMainChartSoucheNavigator()
    updateMainChartPairTitle()
    if (mainviewSvg && mainChartMvX && mainChartMvY) {
        syncMainChartLayout()
    }
}

function applyLightSessionContextForRestore(session) {
    if (!session) return
    if (session.currentSoucheIndex != null) currentSoucheIndex = session.currentSoucheIndex
    if (session.currentSouche != null) currentSouche = session.currentSouche
    syncCurrentSoucheState()
    if (session.selectedYeastTypes) selectedYeastTypes = session.selectedYeastTypes.slice()
    if (session.yeastMode) yeastMode = session.yeastMode
    if (session.soucheTriangleCompareActive && session.triangleLowerYeast && session.triangleUpperYeast) {
        soucheTriangleCompareActive = true
        yeastMode = "compare"
        triangleLowerYeast = session.triangleLowerYeast
        triangleUpperYeast = session.triangleUpperYeast
    } else if (!session.soucheTriangleCompareActive && session.yeastMode !== "compare") {
        soucheTriangleCompareActive = false
        triangleLowerYeast = null
        triangleUpperYeast = null
    }
    if (session.mainChartYeastView) mainChartYeastView = session.mainChartYeastView
    if (session.selectionTarget) selectionTarget = session.selectionTarget
    if (session.mainChartViewMode) mainChartViewMode = session.mainChartViewMode
    if (session.activeDatasetSource) {
        activeDatasetSource = session.activeDatasetSource === "comparison" ? "comparison" : "primary"
    }
    if (session.currentSelectionType != null) current_selectionType = session.currentSelectionType
    ensureMainChartSoucheNavigator()
    updateMainChartSoucheNavigator()
}

function normalizeSelectionsOrder() {
    const blueIdx = selections.findIndex(function (s) { return s && s.cname === "Blue" })
    if (blueIdx > 0) {
        const blue = selections.splice(blueIdx, 1)[0]
        selections.unshift(blue)
    }
}

function getRestoreChartDims(entry, opts) {
    const historyDims = (opts && opts.historyDims) || {}
    const sessionPair = entry.session && entry.session.currentPair
    return {
        xDim: entry.mvX || (sessionPair && sessionPair.xDim) || historyDims.xDim,
        yDim: entry.mvY || (sessionPair && sessionPair.yDim) || historyDims.yDim,
        source: (entry.session && entry.session.activeDatasetSource === "comparison") ? "comparison" : "primary"
    }
}

function getCurrentDatasetMeta() {
    return {
        id: (typeof datasetStore.getSelectedDatasetId === "function") ? datasetStore.getSelectedDatasetId() : null,
        rowCount: datum ? datum.length : 0,
        dimensions: dimensions ? dimensions.slice() : []
    }
}

function getRestoreSnapshot(payload) {
    if (!payload) return null
    if (Array.isArray(payload.savedStates) && payload.savedStates.length) {
        return payload.savedStates[payload.savedStates.length - 1]
    }
    return payload.sessionSnapshot || null
}

function inferRowCountFromState(entry) {
    if (!entry) return null
    let maxIdx = -1
    if (entry.selections) {
        Object.keys(entry.selections).forEach(function (key) {
            const sel = entry.selections[key]
            const points = sel && sel.points ? sel.points : []
            for (let i = 0; i < points.length; i++) {
                if (points[i] > maxIdx) maxIdx = points[i]
            }
        })
    }
    return maxIdx >= 0 ? maxIdx + 1 : null
}

function inferDimensionsFromState(entry) {
    const dims = new Set()
    if (!entry) return []
    if (entry.mvX) dims.add(entry.mvX)
    if (entry.mvY) dims.add(entry.mvY)
    if (entry.viewsCount) {
        Object.keys(entry.viewsCount).forEach(function (key) {
            key.split("_").forEach(function (d) {
                if (d) dims.add(d)
            })
        })
    }
    if (entry.dimVisitcount) {
        Object.keys(entry.dimVisitcount).forEach(function (d) {
            if (d) dims.add(d)
        })
    }
    return Array.from(dims)
}

function getLogDatasetMeta(payload) {
    if (payload.datasetMeta) return payload.datasetMeta
    const snap = getRestoreSnapshot(payload)
    return {
        id: payload.dataset || null,
        rowCount: inferRowCountFromState(snap),
        dimensions: inferDimensionsFromState(snap)
    }
}

function validateUploadedLogDatasetMatch(payload) {
    const warnings = []
    const logMeta = getLogDatasetMeta(payload)
    const current = getCurrentDatasetMeta()

    if (logMeta.rowCount != null && current.rowCount && logMeta.rowCount !== current.rowCount) {
        warnings.push(
            "Row count mismatch: log has " + logMeta.rowCount + " rows, current dataset has " + current.rowCount + "."
        )
    }

    if (logMeta.dimensions && logMeta.dimensions.length && current.dimensions.length) {
        const missing = logMeta.dimensions.filter(function (d) {
            return current.dimensions.indexOf(d) === -1
        })
        if (missing.length) {
            warnings.push(
                "Dimension mismatch: log references columns not in the current dataset (" + missing.join(", ") + ")."
            )
        }
        if (logMeta.dimensions.length !== current.dimensions.length) {
            warnings.push(
                "Dimension count mismatch: log uses " + logMeta.dimensions.length +
                " columns, current dataset has " + current.dimensions.length + "."
            )
        }
    }

    if (payload.dataset && current.id && payload.dataset !== current.id) {
        warnings.push(
            "Dataset id mismatch: log was saved on \"" + payload.dataset + "\", current is \"" + current.id + "\"."
        )
    }

    return warnings
}

function isAcceptedProvenanceExport(payload) {
    if (!payload || typeof payload !== "object") return false
    if (payload.formatLabel === PROVENANCE_EXPORT_LABEL) return true
    return LEGACY_PROVENANCE_LABELS.indexOf(payload.formatLabel) !== -1
}

function buildProvenanceExport() {
    const statesWithUi = savedEntries.map(function (entry) {
        return Object.assign({}, entry, { ui: entry.ui || getSessionUiState() })
    })
    const exportedViewHistory = (viewHistory || []).map(function (entry) {
        return {
            xDim: entry && entry.xDim ? entry.xDim : null,
            yDim: entry && entry.yDim ? entry.yDim : null,
            state: entry && entry.state ? cloneDeep(entry.state) : null
        }
    })
    return {
        formatVersion: 2,
        formatLabel: PROVENANCE_EXPORT_LABEL,
        exportedAt: new Date().toISOString(),
        userId: userId,
        dataset: getCurrentDatasetMeta().id,
        datasetMeta: getCurrentDatasetMeta(),
        session: getSessionUiState(),
        customDimensions: customDimensionExpressions.slice(),
        familyMap: dimensionFamilies.familiesForExport(currentDimensionFamilies),
        expandedFamilies: Array.from(expandedFamilies),
        selectionMemoryByContext: JSON.parse(JSON.stringify(selectionMemoryByContext || {})),
        sessionSnapshot: saveState("export_snapshot", ""),
        viewHistory: exportedViewHistory,
        favoriteIndices: favIndex.slice(),
        savedYeastPairComparisons: savedYeastPairComparisons.slice(),
        savedStates: statesWithUi,
        actionLogRaw: finalLog.slice()
    }
}

function downloadProvenanceLog() {
    const payload = buildProvenanceExport()
    download(userId + "_" + Date.now() + "_visprom_log.json", JSON.stringify(payload, null, 2))
}

function setupUploadSavedLogButton() {
    const btn = document.getElementById("upload-log-btn")
    const input = document.getElementById("upload-log-input")
    if (!btn || !input || btn.__vispromBound) return
    btn.__vispromBound = true
    btn.addEventListener("click", function () {
        input.click()
    })
    input.addEventListener("change", function () {
        const file = input.files && input.files[0]
        input.value = ""
        if (!file) return
        const reader = new FileReader()
        reader.onload = function () {
            try {
                const parsed = JSON.parse(String(reader.result || ""))
                applyUploadedProvenanceLog(parsed)
            } catch (e) {
                alert("Could not read log file. Please upload a valid VisProm JSON export.")
            }
        }
        reader.readAsText(file)
    })
}

function rebuildFavoritesFromIndices() {
    savedFavs = []
    savedFavsEntries = []
    for (let i = 0; i < favIndex.length; i++) {
        const idx = favIndex[i]
        const st = savedEntries[idx]
        if (!st) continue
        savedFavsEntries.push(st)
        savedFavs.push({
            xDim: st.mvX,
            yDim: st.mvY,
            data: cloneDeep(datum)
        })
    }
    updateFavorites(savedFavs)
}

function applyCustomDimensionsFromPayload(payload) {
    const customDims = Array.isArray(payload && payload.customDimensions)
        ? payload.customDimensions
        : []
    customDimensionExpressions = []
    for (let i = 0; i < customDims.length; i++) {
        const expr = String(customDims[i] || "").trim()
        if (!expr) continue
        if (dimensions.indexOf(expr) !== -1) continue
        try {
            polyparser.addPolyDim(expr, datum, dimensions)
            if (allColumns.indexOf(expr) === -1) allColumns.push(expr)
            if (numericDimensions.indexOf(expr) === -1) numericDimensions.push(expr)
            dimensions.push(expr)
            allDimensions = dimensions.slice()
            dimVisitcount[expr] = dimVisitcount[expr] || 0
            for (let d = 0; d < dimensions.length; d++) {
                viewVisitcount[getSplomVisitCountKey(dimensions[d], expr)] = viewVisitcount[getSplomVisitCountKey(dimensions[d], expr)] || 0
            }
            customDimensionExpressions.push(expr)
        } catch (err) {
            console.warn("[Provenance] Could not restore custom dimension:", expr, err)
        }
    }
}

function applyUploadedProvenanceLog(payload) {
    if (!datum || !dimensions || !dimensions.length) {
        alert("Load a dataset first, then upload a saved log.")
        return
    }
    if (!isAcceptedProvenanceExport(payload)) {
        alert("This file does not look like a VisProm provenance export (expected formatLabel \"" + PROVENANCE_EXPORT_LABEL + "\").")
        return
    }
    if (!payload.savedStates && !payload.sessionSnapshot) {
        alert("This provenance file has no saved state to restore.")
        return
    }

    applyCustomDimensionsFromPayload(payload)

    if (payload.familyMap) {
        const normalized = dimensionFamilies.normalizeFamilyMap(payload.familyMap, allDimensions)
        currentDimensionFamilies = normalized.families
        setFamilyMapWarnings(normalized.warnings || [])
    }
    if (Array.isArray(payload.expandedFamilies)) {
        expandedFamilies = new Set(payload.expandedFamilies)
    }

    const warnings = validateUploadedLogDatasetMatch(payload)
    if (warnings.length) {
        const proceed = window.confirm(
            "Warning:\n\n" + warnings.join("\n") + "\n\nRestore analysis state anyway?"
        )
        if (!proceed) return
    }

    resetSoucheComparisonSession()
    if (payload.session) applySessionUiState(payload.session)

    const snapshot = getRestoreSnapshot(payload)
    if (Array.isArray(payload.savedStates) && payload.savedStates.length) {
        savedEntries = payload.savedStates.slice()
        finalLog = Array.isArray(payload.actionLogRaw) ? payload.actionLogRaw.slice() : []
        if (snapshot) {
            if (snapshot.ui) applySessionUiState(snapshot.ui)
            loadState(snapshot)
        }
    } else if (payload.sessionSnapshot) {
        loadState(payload.sessionSnapshot)
    }

    selectionMemoryByContext = payload.selectionMemoryByContext
        ? JSON.parse(JSON.stringify(payload.selectionMemoryByContext))
        : {}

    if (Array.isArray(payload.viewHistory)) {
        viewHistory = payload.viewHistory
            .map(function (entry) {
                if (!entry || !entry.xDim || !entry.yDim) return null
                return {
                    xDim: entry.xDim,
                    yDim: entry.yDim,
                    data: cloneDeep(datum),
                    state: entry.state ? cloneDeep(entry.state) : null
                }
            })
            .filter(Boolean)
        updateViewHistory(viewHistory)
    } else {
        viewHistory = []
        updateViewHistory(viewHistory)
    }

    if (Array.isArray(payload.favoriteIndices)) {
        favIndex = payload.favoriteIndices.slice()
        rebuildFavoritesFromIndices()
    } else {
        favIndex = []
        rebuildFavoritesFromIndices()
    }

    if (Array.isArray(payload.savedYeastPairComparisons)) {
        savedYeastPairComparisons = payload.savedYeastPairComparisons.slice()
        syncSoucheComparisonListsToStorage()
    }

    const contextKey = getSelectionContextKey()
    const hasContextSelectionMemory = !!(
        selectionMemoryByContext &&
        selectionMemoryByContext[contextKey] &&
        Object.keys(selectionMemoryByContext[contextKey]).length
    )
    // Keep selections restored by loadState unless we actually have context-scoped
    // selection memory to apply from the uploaded log.
    if (hasContextSelectionMemory) {
        clearColoredSelections()
        restoreColoredSelectionRows(selectionMemoryByContext[contextKey])
        rebuildColoredSelectionContentFromSoucheKeys()
    }

    refreshAllSelectionViews()
    setTimeout(function () {
        updateCountTable(datum, countTable)
    }, 0)

    const stateCount = payload.savedStates ? payload.savedStates.length : 1
    reopenSoucheComparisonsFromProvenance()
    alert("Loaded saved log (" + stateCount + " state(s)).")
}

function recordSavedSouchePair(xDim, yDim, souchesToCompare, source) {
    if (!xDim || !yDim) return { ok: false, reason: "missing_dims" }
    const key = soucheComparisonStorage.getPairKey(xDim, yDim)
    if (savedYeastPairComparisons.some(function (p) {
        return soucheComparisonStorage.getPairKey(p.xDim, p.yDim) === key
    })) {
        return { ok: false, reason: "exists" }
    }
    if (savedYeastPairComparisons.length >= soucheComparisonStorage.MAX_SAVED_PAIR_COMPARISONS) {
        return { ok: false, reason: "limit" }
    }
    savedYeastPairComparisons.push({
        xDim: xDim,
        yDim: yDim,
        souchesToCompare: (souchesToCompare || []).slice(),
        savedAt: new Date().toISOString()
    })
    syncSoucheComparisonListsToStorage()
    logProvenanceAction("save_souche_pair", {
        xDim: xDim,
        yDim: yDim,
        souchesToCompare: souchesToCompare || [],
        source: source || "comparison_tab"
    })
    return { ok: true, pairs: savedYeastPairComparisons.slice() }
}

function handleSouchePairSavedFromComparisonTab(payload) {
    if (!payload || !payload.xDim || !payload.yDim) return
    const result = recordSavedSouchePair(
        payload.xDim,
        payload.yDim,
        payload.souchesToCompare,
        "comparison_tab"
    )
    if (setYeastPanelStatus) {
        if (result.ok) {
            setYeastPanelStatus("Saved pair " + payload.xDim + " vs " + payload.yDim + " to provenance.", false)
        } else if (result.reason === "exists") {
            setYeastPanelStatus("Pair already saved in provenance.", true)
        }
    }
}

function setupSoucheComparisonMessageListener() {
    if (typeof window === "undefined" || window.__vispromSoucheMsgBound) return
    window.__vispromSoucheMsgBound = true
    window.addEventListener("message", function (event) {
        const data = event && event.data
        if (!data || data.type !== "visprom_save_souche_pair") return
        handleSouchePairSavedFromComparisonTab(data)
    })
}

function reopenSoucheComparisonsFromProvenance() {
    if (!datum || !yeastColumn) return
    const toOpen = []
    const seen = {}

    function addPair(xDim, yDim, souchesToCompare) {
        const key = soucheComparisonStorage.getPairKey(xDim, yDim)
        if (!xDim || !yDim || seen[key]) return
        seen[key] = true
        toOpen.push({ xDim: xDim, yDim: yDim, souchesToCompare: souchesToCompare })
    }

    savedYeastPairComparisons.forEach(function (pair) {
        addPair(pair.xDim, pair.yDim, pair.souchesToCompare)
    })

    refreshAvailableYeastTypes()
    const allSouches = availableYeastTypes.length ? availableYeastTypes.slice() : null
    toOpen.forEach(function (pair, index) {
        setTimeout(function () {
            openSoucheComparisonInNewTab(pair.xDim, pair.yDim, true)
        }, index * 350)
    })
}

function getSplomHighlightColors() {
    const colors = []
    for (let i = 0; i < selections.length; i++) {
        const layer = selections[i]
        if (layer && layer.cname !== "Blue" && layer.visibility !== false && layer.color && layer.color.string) {
            colors.push(layer.color)
        }
    }
    return colors
}

function getSelectedSplomRows() {
    const seen = new Set()
    const rows = []
    if (!selections) return rows
    for (let i = 0; i < selections.length; i++) {
        const layer = selections[i]
        if (!layer || layer.cname === "Blue" || layer.visibility === false) continue
        layer.content.forEach(function (d) {
            if (!d) return
            const rowKey = d.__rowId != null ? ("rid:" + d.__rowId) : (d.id != null ? ("id:" + d.id) : null)
            if (rowKey != null) {
                if (seen.has(rowKey)) return
                seen.add(rowKey)
                rows.push(d)
                return
            }
            if (!seen.has(d)) {
                seen.add(d)
                rows.push(d)
            }
        })
    }
    return rows
}

function getSelectedIdSet() {
    const set = new Set()
    const rows = getSelectedSplomRows()
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (row && row.id != null) set.add(row.id)
        if (row && row.__rowId != null) set.add(row.__rowId)
    }
    return set
}

function syncSplomHighlightColors() {
    if (!splom || splom.empty()) return
    sploom.setSplomHighlightColors(splom, getSplomHighlightColors())
}

function getSplomDisplayData() {
    return getSplomVisualizationData()
}

function executeSplomSelectionRefresh(previewIdSet) {
    return timeBlock("executeSplomSelectionRefresh", function () {
        if (!datum || !splom || splom.empty()) return
        syncSplomCacheRowScope()
        if (!previewIdSet) ensureSelectionMembershipIndex()
        syncSplomHighlightColors()
        const visData = getSplomDisplayData()
        const selectedRows = getSelectedSplomRows()
        if (previewIdSet) {
            const layer = getActiveSelectionLayer()
            const rgba = layer && layer.color && layer.color.array
                ? layer.color.array.slice()
                : [0, 1, 0, 0.92]
            splom.property("__splomPreviewHighlightRgba", rgba)
        } else {
            splom.property("__splomPreviewHighlightRgba", null)
        }
        sploom.updateSplomSelectionOverlay(
            visData,
            splom,
            sampleData,
            selectedRows,
            getSplomHighlightColors(),
            maxSplomAcc,
            viewVisitcount,
            previewIdSet || null
        )
        if (!previewIdSet) {
            updateActiveSplomCellHighlight(mainChartMvX, mainChartMvY)
        }
    })
}

let pendingSplomSelectionFrame = null
let selectionRestylePending = false
let pendingSelectionPanelFrame = null

function restyleMainChartSelections() {
    if (!mainviewSvg || !datum) return
    scaterplot.updatePointsAfterSelection(getMainChartPrimaryData(), mainviewSvg)
}

function restyleSplomSelections() {
    cancelPendingSplomSelectionUpdate()
    executeSplomSelectionRefresh(null)
}

function updateSelectionCountsLight() {
    refreshSelectionLayerCounts()
    if (datum && countTable) updateCountTable(datum, countTable)
}

function requestSelectionRestyle() {
    if (selectionRestylePending) return
    selectionRestylePending = true
    requestAnimationFrame(function () {
        selectionRestylePending = false
        rebuildSelectionMembershipIndex()
        restyleMainChartSelections()
        restyleSplomSelections()
        updateSelectionCountsLight()
    })
}

function scheduleSelectionPanelRefresh() {
    scheduleSelectionPanelLightRefresh()
}

function cancelPendingSelectionPanelRefresh() {
    if (pendingSelectionPanelFrame) {
        cancelAnimationFrame(pendingSelectionPanelFrame)
        pendingSelectionPanelFrame = null
    }
}

function cancelPendingSplomSelectionUpdate() {
    if (pendingSplomSelectionFrame) {
        cancelAnimationFrame(pendingSplomSelectionFrame)
        pendingSplomSelectionFrame = null
    }
}

function scheduleSplomSelectionUpdate() {
    if (pendingSplomSelectionFrame) return
    pendingSplomSelectionFrame = requestAnimationFrame(function () {
        pendingSplomSelectionFrame = null
        executeSplomSelectionRefresh(null)
    })
}

function refreshSplomAfterSelection(previewIdSet, forceImmediate) {
    return timeBlock("refreshSplomAfterSelection", function () {
        if (mainChartBrushActive && !forceImmediate && !previewIdSet) {
            return
        }
        if (previewIdSet) {
            executeSplomSelectionRefresh(previewIdSet)
            return
        }
        if (forceImmediate) {
            cancelPendingSplomSelectionUpdate()
            executeSplomSelectionRefresh(null)
            return
        }
        scheduleSplomSelectionUpdate()
    })
}

// Force an immediate, consistent refresh of every selection-aware view after a
// layer is added or cleared: SPLOM highlight colors + cached selected rows,
// the main scatterplot points, and the SPLOM overlay.
function refreshViewsAfterLayerSelectionChange() {
    cancelPendingSplomSelectionUpdate()
    rebuildSelectionMembershipIndex()
    if (splom && !splom.empty()) {
        syncSplomHighlightColors()
        splom.property("__splomSelectedRows", getSelectedSplomRows())
        splom.property("__splomSelectedIdSet", getSelectedIdSet())
    }
    if (mainviewSvg && datum) {
        scaterplot.updatePointsAfterSelection(getMainChartPrimaryData(), mainviewSvg)
    }
    refreshSplomAfterSelection(null, true)
    refreshSplomHeatFromVisitCounts()
}

function updateSplomView(renderOptions) {
    return timeBlock("updateSplomView", function () {
        if (!datum || !splom || splom.empty()) return
        syncSplomHighlightColors()
        sploom.updateSplom(getVisualizationData(), splom, sampleData, maxSplomAcc, viewVisitcount, renderOptions || null)
    })
}

function hasDimensionFamilies() {
    return dimensionFamilies.hasUserFamilies(currentDimensionFamilies)
}

function syncDimensionFamiliesState() {
    if (dimensionFamilies.hasUserFamilies(currentDimensionFamilies)) {
        dimensionFamilies.syncOthersFamily(currentDimensionFamilies, allDimensions)
    } else {
        delete currentDimensionFamilies[dimensionFamilies.OTHER_FAMILY]
    }
}

function expandAllFamilies() {
    expandedFamilies = new Set(
        dimensionFamilies.sortFamilyNames(Object.keys(currentDimensionFamilies))
    )
}

function getSplomFamilyLayout() {
    if (!hasDimensionFamilies()) return null
    syncDimensionFamiliesState()
    return dimensionFamilies.buildSplomFamilyLayout(
        currentDimensionFamilies, expandedFamilies, allDimensions
    )
}

function ensureSplomFamilyToolbar() {
    if (!splom || splom.empty()) return
    if (!hasDimensionFamilies()) {
        sploom.renderSplomFamilyToolbarOnly(splom, null)
        return
    }
    sploom.renderSplomFamilyToolbarOnly(splom, getSplomFamilyLayout())
}

function getVisibleSplomDimensionsFromFamilies() {
    syncDimensionFamiliesState()
    return dimensionFamilies.getVisibleDimensionsFromFamilies(
        currentDimensionFamilies, expandedFamilies, allDimensions
    )
}

function applyDatasetColumnClassification(data) {
    const classified = datasetColumns.classifyDatasetColumns(data)
    allColumns = classified.allColumns.slice()
    metadataColumns = classified.metadataColumns.slice()
    numericDimensions = classified.numericDimensions.slice()
    dimensions = numericDimensions.slice()
    allDimensions = numericDimensions.slice()
    yeastColumn = classified.yeastColumn
    selectedColumns = selectedColumns.filter(function (d) {
        return numericDimensions.indexOf(d) !== -1
    })

    console.log("[Dataset] all columns:", allColumns)
    console.log("[Dataset] numeric dimensions:", numericDimensions)
    console.log("[Dataset] metadata columns:", metadataColumns)
    console.log("[Dataset] yeast column:", yeastColumn)

    return classified
}

function isMetadataTableColumn(col) {
    return col && metadataColumns.indexOf(col) !== -1
}

function logProvenanceAction(nameAction, callparam) {
    const log = { nameAction: nameAction, callparam: callparam || {}, data: datum, timestamp: Date.now() }
    const svState = saveState(nameAction, "")
    savedEntries.push(svState)
    if (onlineLogActive) {
        firebase.save(svState, globalLoss, userId)
    }
    finalLog.push(JSON.stringify(log, Set_toJSON))
    cache = []
}

function refreshAvailableYeastTypes() {
    if (!datum || !yeastColumn) {
        availableYeastTypes = []
        selectedYeastTypes = []
        soucheTriangleCompareActive = false
        triangleLowerYeast = null
        triangleUpperYeast = null
        syncCurrentSoucheState()
        return
    }
    availableYeastTypes = datasetColumns.getUniqueMetadataValues(datum, yeastColumn)
    syncCurrentSoucheState()
    const availableSet = new Set(availableYeastTypes.map(String))
    selectedYeastTypes = (selectedYeastTypes || [])
        .map(String)
        .filter(function (s) { return availableSet.has(s) })
    if (!selectedYeastTypes.length && currentSouche != null) {
        selectedYeastTypes = [String(currentSouche)]
    }
    if (triangleLowerYeast && !availableSet.has(String(triangleLowerYeast))) triangleLowerYeast = null
    if (triangleUpperYeast && !availableSet.has(String(triangleUpperYeast))) triangleUpperYeast = null
    if (soucheTriangleCompareActive && (!triangleLowerYeast || !triangleUpperYeast)) {
        soucheTriangleCompareActive = false
        yeastMode = "overlay"
        triangleLowerYeast = null
        triangleUpperYeast = null
    }
}

function syncCurrentSoucheState() {
    if (!availableYeastTypes.length) {
        currentSouche = null
        currentSoucheIndex = 0
        return
    }
    if (currentSouche != null) {
        const idx = availableYeastTypes.indexOf(currentSouche)
        if (idx !== -1) {
            currentSoucheIndex = idx
            return
        }
    }
    if (currentSoucheIndex < 0 || currentSoucheIndex >= availableYeastTypes.length) {
        currentSoucheIndex = 0
    }
    currentSouche = availableYeastTypes[currentSoucheIndex]
}

function getRowsForCurrentSouche() {
    if (!datum) return []
    if (!yeastColumn || currentSouche == null) return datum
    const target = String(currentSouche)
    return datum.filter(function (row) {
        return row[yeastColumn] != null && String(row[yeastColumn]) === target
    })
}

function isMainChartMultiSoucheOverlay() {
    if (isSoucheCompareModeActive() && mainChartYeastView === "overlay") return true
    if (comparisonDatasetRows && comparisonDatasetRows.length) {
        return mainChartViewMode === "overlay" || mainChartViewMode === "comparison"
    }
    return false
}

function shouldShowMainChartSoucheNavigator() {
    if (!yeastColumn || availableYeastTypes.length < 2) return false
    if (isSoucheCompareModeActive()) return false
    if (isMainChartMultiSoucheOverlay()) return false
    return true
}

function isMainChartSoucheNavigatorActive() {
    return shouldShowMainChartSoucheNavigator() && currentSouche != null
}

function updateSoucheNavigatorLabel() {
    const label = document.getElementById("current-souche-label")
    if (!label) return
    if (!isMainChartSoucheNavigatorActive()) {
        label.textContent = ""
        return
    }
    const total = availableYeastTypes.length
    const index = currentSoucheIndex + 1
    label.textContent = "Souche " + index + "/" + total + ": " + currentSouche
}

function updateMainChartPairTitle() {
    const el = document.getElementById("main-chart-pair-title")
    if (!el) return
    const dims = getMainChartDims()
    const xDim = dims.xDim
    const yDim = dims.yDim
    if (!xDim || !yDim) {
        el.hidden = true
        return
    }
    let title = xDim + " vs " + yDim
    if (isMainChartSoucheNavigatorActive()) {
        title += " — Souche " + (currentSoucheIndex + 1) + "/" + availableYeastTypes.length + ": " + currentSouche
    }
    el.textContent = title
    el.hidden = false
}

function updateMainChartSoucheNavigator() {
    const nav = document.getElementById("main-chart-souche-navigator")
    if (!nav) return
    const show = shouldShowMainChartSoucheNavigator()
    nav.hidden = !show
    if (!show) return

    updateSoucheNavigatorLabel()

    const select = document.getElementById("souche-select")
    if (select && !select.__vispromSyncing) {
        select.__vispromSyncing = true
        const prev = currentSouche
        select.innerHTML = availableYeastTypes.map(function (s) {
            return "<option value=\"" + String(s).replace(/"/g, "&quot;") + "\">" + s + "</option>"
        }).join("")
        if (prev != null) select.value = String(prev)
        select.__vispromSyncing = false
    }

    const prevBtn = document.getElementById("prev-souche-btn")
    const nextBtn = document.getElementById("next-souche-btn")
    if (prevBtn) prevBtn.disabled = availableYeastTypes.length < 2
    if (nextBtn) nextBtn.disabled = availableYeastTypes.length < 2
}

function getSelectionContextKey() {
    if (isSoucheCompareModeActive()) {
        const a = triangleLowerYeast || "none"
        const b = triangleUpperYeast || "none"
        return "souche-compare:" + a + "|" + b + "|target:" + selectionTarget
    }
    if (yeastColumn && selectedYeastTypes && selectedYeastTypes.length) {
        const sorted = selectedYeastTypes.slice().map(String).sort().join("|")
        return "yeast-filter:" + sorted
    }
    return "global"
}

function snapshotColoredSelectionRows() {
    syncCurrentContextToLayerSouche()
    const snapshot = {}
    for (let i = 1; i < selections.length; i++) {
        const layer = selections[i]
        if (!layer) continue
        const ids = []
        layer.content.forEach(function (d) {
            if (!d) return
            if (d.__rowId != null) ids.push(d.__rowId)
            else if (d.id != null) ids.push(d.id)
        })
        snapshot[layer.cname] = ids
    }
    return snapshot
}

function getSoucheKeysFromSelectionContextKey(ctxKey) {
    if (!ctxKey) return []
    if (ctxKey === "global") return []
    if (ctxKey.indexOf("souche-single:") === 0) {
        const souche = ctxKey.slice("souche-single:".length)
        return souche && souche !== "none" ? [souche] : []
    }
    if (ctxKey.indexOf("yeast-filter:") === 0) {
        const raw = ctxKey.slice("yeast-filter:".length)
        if (!raw) return []
        return raw.split("|").filter(Boolean)
    }
    if (ctxKey.indexOf("souche-compare:") === 0) {
        const body = ctxKey.slice("souche-compare:".length)
        const pairPart = body.split("|target:")[0] || ""
        return pairPart.split("|").filter(function (s) { return s && s !== "none" })
    }
    return []
}

function getAllSelectedRowsForExport() {
    const layerIds = getColoredSelectionLayers().map(function (l) { return l.id })
    const rowIds = getUnionRowIdsForSelectionLayers(layerIds)
    return buildExportRowsFromRowIds(rowIds, {
        exportType: "all_selected",
        exportName: "All selected points",
        layerIds: layerIds,
        layerNames: getColoredSelectionLayers().map(function (l) { return l.label || l.id })
    })
}

function escapeCsvValue(value) {
    if (value === null || value === undefined) return ""
    const str = String(value)
    if (str.indexOf(",") !== -1 || str.indexOf("\"") !== -1 || str.indexOf("\n") !== -1) {
        return "\"" + str.replace(/"/g, "\"\"") + "\""
    }
    return str
}

function rowsToCsv(rows) {
    if (!rows || !rows.length) return ""
    const columns = Object.keys(rows[0])
    const header = columns.map(escapeCsvValue).join(",")
    const body = rows.map(function (row) {
        return columns.map(function (col) { return escapeCsvValue(row[col]) }).join(",")
    }).join("\n")
    return header + "\n" + body
}

function downloadCsv(filename, csvText) {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

function downloadAllSelectedCsv() {
    const rows = getAllSelectedRowsForExport()
    if (!rows.length) {
        alert("No selected rows to export.")
        console.warn("[CSV export] No selected rows")
        return
    }
    const csv = rowsToCsv(rows)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = "visprom_selected_points_" + timestamp + ".csv"
    downloadCsv(filename, csv)

    const layers = selections.slice(1).map(function (layer) {
        return {
            id: layer.cname,
            label: layer.displayName || layer.cname,
            color: layer.color && layer.color.string ? layer.color.string : "",
            selectedCount: layer.content ? layer.content.size : 0
        }
    })

    console.log("[CSV export] Downloaded selected points CSV", {
        filename: filename,
        rowCount: rows.length,
        selectionLayerCount: layers.length
    })
    logProvenanceAction("download_selected_points_csv", {
        filename: filename,
        rowCount: rows.length,
        selectionLayerCount: layers.length,
        layers: layers
    })
}

function clearColoredSelections() {
    for (let i = 1; i < selections.length; i++) {
        const layer = selections[i]
        if (!layer || !layer.content) continue
        const points = Array.from(layer.content)
        for (let j = 0; j < points.length; j++) {
            removePointFromSelectionLayer(layer, points[j])
        }
        layer.originOp = null
        layer.originCol = []
    }
}

function resetColoredSelectionsForSoucheNavigation() {
    clearColoredSelections()
    if (current_color && current_color.length) {
        current_color = [current_color[0]]
    }
}

// Adds a brand new colored selection layer (the "+" control at the bottom of
// the Selections panel). Pulls the next available color/name from `reserve`
// and makes the new layer the active selection (current_color).
function addSelectionLayer() {
    selections.forEach(function (s) {
        if (s && s.rep) s.rep.classed("active2", false)
    })

    const newS = sel.add(reserve, selections)
    if (newS === undefined || newS === null) return null

    ensureSelectionLayerMeta(newS)

    current_color = [newS]

    const log = {
        nameAction: "add_selection_layer",
        callparam: { addedColor: newS.cname },
        data: datum,
        timestamp: Date.now()
    }
    logProvenanceAction("add_selection_layer", { addedColor: newS.cname })
    try {
        const svState = saveState("add_selection_layer", "")
        savedEntries.push(svState)
        if (onlineLogActive) {
            firebase.save(svState, globalLoss, userId)
        }
        finalLog.push(JSON.stringify(log, Set_toJSON))
        cache = []
    } catch (e) { /* logging best-effort */ }

    syncSelectionCountsAfterChange()
    refreshSelectionExportUI({ immediate: true, full: true })
    refreshTableView()
    refreshAllSelectionViews()
    return newS
}

// Clears every point out of a single selection layer (the per-row "−"
// control). The points lose this layer's color everywhere (main chart, SPLOM,
// comparison views) and fall back to the base layer when they belong to no
// other colored selection. Counts and all views refresh afterwards.
function clearSelectionLayerPoints(layer) {
    if (!layer || layer.cname === "Blue") return false
    ensureSelectionLayerMeta(layer)

    const pointsToUpdate = new Set()
    Array.from(layer.content || []).forEach(function (d) {
        if (d) pointsToUpdate.add(d)
    })

    const rowIds = getRowIdsForSelectionLayer(layer.id)
    if (datum) {
        for (let i = 0; i < datum.length; i++) {
            const d = datum[i]
            if (!d) continue
            const rid = d.__rowId != null ? d.__rowId : d.id
            if (rid != null && rowIds.has(rid)) pointsToUpdate.add(d)
        }
    }

    layer.originOp = null
    layer.originCol = []

    const contentSnapshot = Array.from(layer.content || [])
    for (let i = 0; i < contentSnapshot.length; i++) {
        const e = contentSnapshot[i]
        if (!e || !e.color) continue
        e.color.delete(layer.color)
        if (e.color.size === 0 && selections[0]) {
            selections[0].content.add(e)
        }
    }
    layer.content = new Set()
    clearLayerSelectionsBySouche(layer)
    layer.updatedAt = new Date().toISOString()

    pointsToUpdate.forEach(function (d) {
        syncPointColorMembership(d)
        delete d.__displayLayerCname
    })

    if (datum) setpointvisGloabl(datum, selections)
    pointsToUpdate.forEach(function (p) {
        setpointvisLocal(p, selections)
    })

    syncSelectionMemoryAfterLayerClear(layer)

    // Update counts immediately before chart redraw so the table cell drops to 0 right away.
    refreshSelectionLayerCounts()
    if (datum && countTable) updateCountTable(datum, countTable)
    refreshTableView()

    try {
        refreshViewsAfterLayerSelectionChange()
    } catch (e) {
        console.warn("[clear selection] view refresh failed", e)
    }

    updateIntersectionPreview()
    scheduleSelectionExportOverlapRefresh()

    const log = {
        nameAction: "clear_selection_layer",
        callparam: { clearedColor: layer.cname },
        data: datum,
        timestamp: Date.now()
    }
    logProvenanceAction("clear_selection_layer", { clearedColor: layer.cname })
    try {
        const svState = saveState("clear_selection_layer", "")
        savedEntries.push(svState)
        if (onlineLogActive) {
            firebase.save(svState, globalLoss, userId)
        }
        finalLog.push(JSON.stringify(log, Set_toJSON))
        cache = []
    } catch (e) { /* logging best-effort */ }

    return true
}

// Keep the per-souche selection memory consistent after a layer is cleared so
// switching souches does not resurrect the cleared points.
function syncSelectionMemoryAfterLayerClear(layer) {
    if (!layer || !layer.cname) return
    const cname = layer.cname
    Object.keys(selectionMemoryByContext || {}).forEach(function (key) {
        if (selectionMemoryByContext[key]) {
            selectionMemoryByContext[key][cname] = []
        }
    })
    selectionMemoryByContext[getSelectionContextKey()] = snapshotColoredSelectionRows()
}

function restoreColoredSelectionRows(snapshot) {
    if (!snapshot) return
    const rowByIdLocal = new Map()
    for (let i = 0; i < datum.length; i++) {
        const d = datum[i]
        if (!d) continue
        if (d.__rowId != null) rowByIdLocal.set(d.__rowId, d)
        else if (d.id != null) rowByIdLocal.set(d.id, d)
    }
    for (let i = 1; i < selections.length; i++) {
        const layer = selections[i]
        if (!layer) continue
        const ids = snapshot[layer.cname] || []
        for (let j = 0; j < ids.length; j++) {
            const d = rowByIdLocal.get(ids[j])
            if (d) addPointToSelectionLayer(layer, d)
        }
    }
    for (let i = 0; i < datum.length; i++) {
        const d = datum[i]
        if (d && isPointInAnyColoredSelection(d)) {
            syncPointColorMembership(d)
            recomputePointDisplayLayer(d)
        }
    }
    syncCurrentContextToLayerSouche()
}

function switchSelectionContext(nextContextKey, previousContextKey) {
    syncCurrentContextToLayerSouche()
    invalidateSplomDisplayRowsCache()
    rebuildColoredSelectionContentFromSoucheKeys()
}

function updateViewsForCurrentSouche(source, previousContextKey) {
    const nextContextKey = getSelectionContextKey()
    invalidateSplomDisplayRowsCache()
    switchSelectionContext(nextContextKey, previousContextKey)
    refreshMainChartRendering()
    if (datum && splom && !splom.empty()) {
        sploom.invalidateSplomCaches("souche navigator")
        rebuildSplomWithDimensions(getSplomDimensionsForDisplay())
    }
    selectionsList(selections, selList)
    updateSelectionOverlapPanel()
    updateCountTable(datum, countTable)
    refreshTableView()
    refreshSplomHeatFromVisitCounts()
    logProvenanceAction("change_current_souche", {
        source: source,
        yeastColumn: yeastColumn,
        currentSouche: currentSouche,
        currentSoucheIndex: currentSoucheIndex,
        xDim: mainChartMvX,
        yDim: mainChartMvY
    })
}

function goToPreviousSouche() {
    if (!availableYeastTypes.length) return
    const previousContextKey = getSelectionContextKey()
    currentSoucheIndex = (currentSoucheIndex - 1 + availableYeastTypes.length) % availableYeastTypes.length
    currentSouche = availableYeastTypes[currentSoucheIndex]
    yeastMode = "single"
    selectedYeastTypes = [currentSouche]
    syncYeastPanelCheckboxes()
    updateViewsForCurrentSouche("previous", previousContextKey)
}

function goToNextSouche() {
    if (!availableYeastTypes.length) return
    const previousContextKey = getSelectionContextKey()
    currentSoucheIndex = (currentSoucheIndex + 1) % availableYeastTypes.length
    currentSouche = availableYeastTypes[currentSoucheIndex]
    yeastMode = "single"
    selectedYeastTypes = [currentSouche]
    syncYeastPanelCheckboxes()
    updateViewsForCurrentSouche("next", previousContextKey)
}

function goToSoucheByName(soucheName, source) {
    const index = availableYeastTypes.indexOf(soucheName)
    if (index === -1) return
    const previousContextKey = getSelectionContextKey()
    currentSoucheIndex = index
    currentSouche = soucheName
    yeastMode = "single"
    selectedYeastTypes = [currentSouche]
    syncYeastPanelCheckboxes()
    updateViewsForCurrentSouche(source || "dropdown", previousContextKey)
}

function ensureMainChartSoucheNavigator() {
    const prevBtn = document.getElementById("prev-souche-btn")
    const nextBtn = document.getElementById("next-souche-btn")
    const select = document.getElementById("souche-select")
    if (!prevBtn || !nextBtn) return
    if (prevBtn.__vispromBound) return
    prevBtn.__vispromBound = true
    nextBtn.__vispromBound = true

    prevBtn.addEventListener("click", goToPreviousSouche)
    nextBtn.addEventListener("click", goToNextSouche)
    if (select) {
        select.addEventListener("change", function () {
            if (select.__vispromSyncing) return
            goToSoucheByName(select.value)
        })
    }
}

function getRowsForSouche(soucheValue) {
    if (!datum || !yeastColumn || soucheValue == null || soucheValue === "") return []
    const index = buildSoucheRowsIndex()
    return index.get(String(soucheValue)) || []
}

function getRowsForSelectedYeasts(data) {
    if (!data) return data
    if (data === datum && yeastColumn) {
        return getRowsForSelectedYeastsFromIndex(selectedYeastTypes)
    }
    return datasetColumns.getRowsForSelectedMetadataValues(data, yeastColumn, selectedYeastTypes)
}

function getRowsForSelectedYeastsFromIndex(soucheKeys) {
    if (!soucheKeys || !soucheKeys.length) return []
    const index = buildSoucheRowsIndex()
    const out = []
    for (let i = 0; i < soucheKeys.length; i++) {
        const rows = index.get(String(soucheKeys[i]))
        if (!rows) continue
        for (let j = 0; j < rows.length; j++) out.push(rows[j])
    }
    return out
}

function syncSoucheComparisonListsToStorage() {
    soucheComparisonStorage.writeSavedSouchePairs(savedYeastPairComparisons)
}

function resetSoucheComparisonSession() {
    savedYeastPairComparisons = []
    openedSoucheComparisons = []
    soucheComparisonStorage.clearSoucheComparisonSession()
}

function loadSoucheComparisonListsFromStorage() {
    savedYeastPairComparisons = soucheComparisonStorage.readSavedSouchePairs()
    openedSoucheComparisons = soucheComparisonStorage.readOpenedSoucheComparisonTabs()
}

function syncTriangleYeastsFromSelection() {
    if (selectedYeastTypes.length >= 2) {
        if (!triangleLowerYeast || selectedYeastTypes.indexOf(triangleLowerYeast) === -1) {
            triangleLowerYeast = selectedYeastTypes[0]
        }
        if (!triangleUpperYeast || selectedYeastTypes.indexOf(triangleUpperYeast) === -1) {
            triangleUpperYeast = selectedYeastTypes[1]
        }
        if (triangleLowerYeast === triangleUpperYeast) {
            triangleUpperYeast = selectedYeastTypes.find(function (s) { return s !== triangleLowerYeast }) || selectedYeastTypes[1]
        }
    } else {
        triangleLowerYeast = null
        triangleUpperYeast = null
    }
}

function isSoucheCompareModeActive() {
    return !!(soucheTriangleCompareActive &&
        triangleLowerYeast &&
        triangleUpperYeast &&
        yeastColumn &&
        triangleLowerYeast !== triangleUpperYeast)
}

function isSplomTriangleCompareActive() {
    return isSoucheCompareModeActive() || isSplomCompareModeActive()
}

function getActiveRows() {
    if (!datum) return []
    if (!yeastColumn || !selectedYeastTypes.length) return datum
    return getRowsForSelectedYeastsFromIndex(selectedYeastTypes)
}

function getMainChartSelectionDataset() {
    if (isSoucheCompareModeActive() || isMainChartSoucheNavigatorActive()) {
        return getBrushEligibleDataset()
    }
    return getActiveSelectionDataset()
}

function getBrushEligibleDataset() {
    if (isMainChartSoucheNavigatorActive()) return getRowsForCurrentSouche()
    if (isSoucheCompareModeActive()) return getSplomDisplayRows()
    return getActiveSelectionDataset()
}

function getMainChartPrimaryData() {
    if (isSoucheCompareModeActive()) {
        return getRowsForSouche(triangleLowerYeast)
    }
    if (isMainChartSoucheNavigatorActive()) return getRowsForCurrentSouche()
    return getVisualizationData()
}

function getSplomVisualizationData() {
    if (!datum) return []
    if (!yeastColumn) return datum
    if (selectedYeastTypes.length > 1) {
        return getActiveRows()
    }
    if (selectedYeastTypes.length === 1) {
        return getRowsForSouche(selectedYeastTypes[0])
    }
    if (isMainChartSoucheNavigatorActive()) {
        return getRowsForCurrentSouche()
    }
    return datum
}

function getVisualizationData() {
    return getSplomDisplayRows()
}

function getComparisonVisualizationData() {
    if (!comparisonDatasetRows) return null
    return getRowsForSelectedYeasts(comparisonDatasetRows)
}

function ensureValidMainChartDimensions() {
    if (!dimensions || !dimensions.length) return
    if (!dimensions.includes(mainChartMvX)) mainChartMvX = dimensions[0]
    if (!dimensions.includes(mainChartMvY)) {
        mainChartMvY = dimensions[1] != null ? dimensions[1] : dimensions[0]
    }
    mvX = mainChartMvX
    mvY = mainChartMvY
}

function formatDatasetLoadSummary(classified) {
    const lines = [
        "Dataset loaded.",
        "Numeric dimensions: " + (classified.numericDimensions ? classified.numericDimensions.length : 0)
    ]
    if (classified.metadataColumns && classified.metadataColumns.length) {
        lines.push("Metadata columns: " + classified.metadataColumns.join(", "))
    }
    if (classified.yeastColumn) {
        lines.push("Yeast column detected: " + classified.yeastColumn)
    }
    return lines.join("\n")
}

function isSplomCompareModeActive() {
    return splomMode === "compare" && comparisonDatasetRows && comparisonDatasetRows.length && sharedDimensions.length >= comparisonDataset.MIN_SHARED_DIMENSIONS
}

function getVisibleSplomDimensions() {
    let dims = numericDimensions.slice()

    if (hasDimensionFamilies()) {
        dims = getVisibleSplomDimensionsFromFamilies()
    } else if (selectedColumns.length) {
        dims = selectedColumns.filter(function (d) {
            return numericDimensions.indexOf(d) !== -1
        })
    }

    if (isSplomCompareModeActive()) {
        const sharedSet = new Set(sharedDimensions)
        dims = dims.filter(function (d) { return sharedSet.has(d) })
    }

    return dims.filter(function (dim) { return numericDimensions.indexOf(dim) !== -1 })
}

function getTableNumericColumns() {
    return numericDimensions.slice()
}

function buildTableFamilyGroups(columnsForTable) {
    if (!hasDimensionFamilies()) return null
    syncDimensionFamiliesState()
    const numericCols = columnsForTable.filter(function (c) {
        return numericDimensions.indexOf(c) !== -1
    })
    if (!numericCols.length) return null

    const groups = []
    const assigned = new Set()
    const names = dimensionFamilies.sortFamilyNames(Object.keys(currentDimensionFamilies))
    for (let i = 0; i < names.length; i++) {
        const name = names[i]
        const cols = (currentDimensionFamilies[name] || []).filter(function (c) {
            return numericCols.indexOf(c) !== -1
        })
        if (cols.length) {
            groups.push({ family: name, cols: cols })
            for (let j = 0; j < cols.length; j++) assigned.add(cols[j])
        }
    }
    const leftover = numericCols.filter(function (c) { return !assigned.has(c) })
    if (leftover.length) {
        groups.push({ family: "Unassigned", cols: leftover })
    }
    return groups.length ? groups : null
}

function getSplomDimensionsForDisplay() {
    return getVisibleSplomDimensions()
}

function getVisibleTableColumns() {
    const cols = []

    if (yeastColumn) cols.push(yeastColumn)

    let numericCols
    if (hasDimensionFamilies()) {
        numericCols = getTableNumericColumns()
    } else if (selectedColumns.length) {
        numericCols = selectedColumns.filter(function (d) {
            return numericDimensions.indexOf(d) !== -1
        })
    } else {
        numericCols = numericDimensions
    }

    numericCols.forEach(function (col) {
        if (cols.indexOf(col) === -1) cols.push(col)
    })

    return cols
}

function refreshTableView() {
    return timeBlockIfSlow("refreshTableView", function () {
        if (!tableView_table || !datum) return
        const rowsForTable = getVisualizationData()
        const columnsForTable = getVisibleTableColumns()
        const numericColsForStats = columnsForTable.filter(function (c) {
            return numericDimensions.indexOf(c) !== -1
        })
        if (current_color && current_color.length && current_color[0] && current_color[0].content) {
            minMaxMed(current_color[0].content, numericColsForStats, rowsForTable)
        }
        updateTableView(rowsForTable, tableView_table, columnsForTable)
    }, 12)
}

function getMainChartOverlayOptions() {
    if (isSoucheCompareModeActive()) {
        return {
            viewMode: "overlay",
            comparisonData: getRowsForSouche(triangleUpperYeast),
            primaryLabel: triangleLowerYeast,
            comparisonLabel: triangleUpperYeast
        }
    }
    if (!comparisonDatasetRows || !comparisonDatasetRows.length) return null
    return {
        viewMode: mainChartViewMode,
        comparisonData: getComparisonVisualizationData() || comparisonDatasetRows,
        primaryLabel: primaryDatasetLabel,
        comparisonLabel: comparisonDatasetLabel
    }
}

function getActiveSelectionDataset() {
    if (activeDatasetSource === "comparison" && comparisonDatasetRows && comparisonDatasetRows.length) {
        return comparisonDatasetRows
    }
    return datum
}

function highlightMatchingSplomPair(xDim, yDim, sourceTriangle) {
    if (!splom || splom.empty() || !isSplomTriangleCompareActive()) return
    const pairKey = comparisonDataset.getPairKey(xDim, yDim)
    const hoveredTriangle = sourceTriangle || "lower"
    splom.selectAll(".splom-cell")
        .classed("splom-cell-hovered", function () {
            return this.getAttribute("data-pair-key") === pairKey &&
                this.getAttribute("data-triangle-source") === hoveredTriangle
        })
        .classed("splom-cell-matching-pair", function () {
            return this.getAttribute("data-pair-key") === pairKey &&
                this.getAttribute("data-triangle-source") !== hoveredTriangle
        })
}

function clearMatchingSplomPairHighlights() {
    if (!splom || splom.empty()) return
    splom.selectAll(".splom-cell").each(function () {
        this.__splomHoverActive = false
    })
    splom.selectAll(".splom-cell")
        .classed("splom-cell-matching-pair", false)
        .classed("splom-cell-hovered", false)
}

function rebuildSplomFromFamilyState() {
    return timeBlock("rebuildSplomFromFamilyState", function () {
        if (!datum || !splom || splom.empty()) return
        const dims = getVisibleSplomDimensions()
        const layout = getSplomFamilyLayout()

        if (hasDimensionFamilies() && !dims.length) {
            splom.html("")
            ensureSplomFamilyToolbar()
            splom.append("div")
                .attr("class", "splom-empty-family-message")
                .text("Expand one or more families in the toolbar above to show their variables.")
            refreshTableView()
            return
        }

        rebuildSplomWithDimensions(dims)
        ensureSplomFamilyToolbar()
        refreshTableView()
    })
}

function getSplomFrontsCacheKey() {
    return "all-fronts"
}

function getSplomDataFilterCacheSuffix() {
    if (isSoucheCompareModeActive()) {
        return "|souche|" + triangleLowerYeast + "|" + triangleUpperYeast
    }
    if (isSplomCompareModeActive()) {
        return "|compare|" + comparisonDatasetVersion
    }
    return "|ctx:" + getSelectionContextKey()
}

function syncSplomCacheRowScope() {
    if (typeof sploom.setSplomRowScopeKey === "function") {
        sploom.setSplomRowScopeKey(getSplomDataFilterCacheSuffix())
    }
}

function rebuildSplomWithDimensions(dimsForSplom) {
    const endPerf = perfStart("rebuildSplomWithDimensions")
    try {
    if (!datum || !splom || splom.empty() || !dimsForSplom || !dimsForSplom.length) return

    syncSplomCacheRowScope()

    dimsForSplom = dimsForSplom.filter(function (dim) { return allDimensions.indexOf(dim) !== -1 })
    if (!dimsForSplom.length) {
        alert("No numeric dimensions found for SPLOM.")
        return
    }

    const soucheCompareActive = isSoucheCompareModeActive()
    const datasetCompareActive = !soucheCompareActive && isSplomCompareModeActive()
    const compareActive = soucheCompareActive || datasetCompareActive

    let visData = getSplomVisualizationData()
    let visComparisonData = null
    if (soucheCompareActive) {
        visData = getRowsForSouche(triangleLowerYeast)
        visComparisonData = getRowsForSouche(triangleUpperYeast)
    } else if (datasetCompareActive) {
        visComparisonData = getComparisonVisualizationData() || comparisonDatasetRows
    }

    sploom.setSplomSelectionCheckProvider(isPointInVisibleSplomSelection)
    sploom.setSplomVisitCountKeyProvider(getSplomVisitCountKey)
    chartRender.setSelectionCheckProvider(isPointInVisibleSplomSelection)
    chartRender.setDisplayColorProvider(getPointDisplayColor)
    syncSplomHighlightColors()
    splom.property("__splomSelectedRows", getSelectedSplomRows())
    splom.property("__splomSelectedIdSet", getSelectedIdSet())

    const overviewOpts = getSplomOverviewOptionsFromUI()
    const frontsKey = getSplomFrontsCacheKey()
    const familyLayout = getSplomFamilyLayout()
    const dataFilterSuffix = getSplomDataFilterCacheSuffix()
    const dimSetKey = sploom.getDimensionSetCacheKey(dimsForSplom, overviewOpts, frontsKey, familyLayout) + dataFilterSuffix
    const cachedSet = sploom.getCachedDimensionSet(dimSetKey)
    const restoreOpts = compareActive ? {
        compareMode: true,
        comparisonData: visComparisonData,
        primaryLabel: soucheCompareActive ? triangleLowerYeast : primaryDatasetLabel,
        comparisonLabel: soucheCompareActive ? triangleUpperYeast : comparisonDatasetLabel,
        lowerSouche: soucheCompareActive ? triangleLowerYeast : null,
        upperSouche: soucheCompareActive ? triangleUpperYeast : null,
        visitSoucheKey: getSplomSoucheKey(),
        familyLayout: familyLayout
    } : { visitSoucheKey: getSplomSoucheKey(), familyLayout: familyLayout }

    if (cachedSet && cachedSet.dimsForSplom && cachedSet.domainMap) {
        sploom.restoreSplomDimensionSet(cachedSet, visData, splom, sampleData, viewVisitcount, overviewOpts, allDimensions, frontsKey, restoreOpts)
        cachedSet.familyLayout = familyLayout
    } else {
        const domainMap = compareActive
            ? (soucheCompareActive
                ? soucheComparison.buildSoucheComparisonDomainMap(visData, visComparisonData, dimsForSplom, overviewOpts)
                : comparisonDataset.buildComparisonDomainMap(visData, visComparisonData, dimsForSplom, overviewOpts))
            : sploom.getOrComputeSplomDomainMap(visData, dimsForSplom, allDimensions, overviewOpts)
        const createOpts = {
            domainMap: domainMap,
            lazyRender: true,
            frontsKey: frontsKey,
            familyLayout: familyLayout,
            visitSoucheKey: getSplomSoucheKey()
        }
        if (compareActive) {
            createOpts.compareMode = true
            createOpts.comparisonData = visComparisonData
            createOpts.primaryLabel = soucheCompareActive ? triangleLowerYeast : primaryDatasetLabel
            createOpts.comparisonLabel = soucheCompareActive ? triangleUpperYeast : comparisonDatasetLabel
            createOpts.lowerSouche = soucheCompareActive ? triangleLowerYeast : null
            createOpts.upperSouche = soucheCompareActive ? triangleUpperYeast : null
        }
        sploom.createSplom(visData, splom, dimsForSplom, sampleData, viewVisitcount, overviewOpts, allDimensions, createOpts)
        sploom.setCachedDimensionSet(dimSetKey, {
            dimsForSplom: dimsForSplom.slice(),
            domainMap: domainMap,
            cellW: splom.property("__splomCellSize"),
            familyLayout: familyLayout,
            compareMode: compareActive
        })
    }

    // renderPendingVisibleSplomCells already paints visible cells with selection +
    // heat applied. Avoid a redundant second full redraw here (it doubled startup work).
    sploom.renderPendingVisibleSplomCells(visData, splom, viewVisitcount, maxSplomAcc)
    refreshSplomAfterSelection(null, true)
    refreshSplomHeatFromVisitCounts()
    updateMainViewClickCount(mainChartMvX, mainChartMvY)
    bindSplomPlotHandlers()
    ensureSplomZoomResetControl()
    installSplomPinchZoom()
    syncSplomZoomBaseFromLayout()
    installSplomWheelDebug()
    updateActiveSplomCellHighlight(mainChartMvX, mainChartMvY)
    ensureSplomFamilyToolbar()
    } finally {
        endPerf()
    }
}

function applySelectedDimensions() {
    if (hasDimensionFamilies()) {
        rebuildSplomFromFamilyState()
        if (setSplomColumnFilterStatus) {
            const visible = getVisibleSplomDimensions().length
            if (!visible) {
                setSplomColumnFilterStatus("Expand one or more family chips in the SPLOM toolbar.", true)
            } else {
                setSplomColumnFilterStatus("SPLOM: " + visible + " dimension(s) from expanded families.", false)
            }
        }
        return
    }
    if (!selectedColumns.length) {
        if (setSplomColumnFilterStatus) {
            setSplomColumnFilterStatus("Showing all dimensions.", false)
        }
        rebuildSplomWithDimensions(numericDimensions.slice())
        refreshTableView()
        return
    }
    const dims = getVisibleSplomDimensions()
    if (!dims.length) {
        if (setSplomColumnFilterStatus) {
            setSplomColumnFilterStatus("Select at least one dimension.", true)
        }
        return
    }
    if (dims.length === 1) {
        if (setSplomColumnFilterStatus) {
            setSplomColumnFilterStatus("One dimension selected — single comparison cell.", false)
        }
    } else if (setSplomColumnFilterStatus) {
        setSplomColumnFilterStatus("SPLOM: " + dims.length + " dimensions.", false)
    }
    rebuildSplomWithDimensions(dims)
    refreshTableView()
}

function resetSplomColumns() {
    selectedColumns = []
    currentDimensionFamilies = {}
    expandedFamilies = new Set()
    setFamilyMapWarnings([])
    syncColumnHighlightUI()
    renderFamilyDimensionPanel()
    ensureSplomFamilyToolbar()
    if (setSplomColumnFilterStatus) {
        setSplomColumnFilterStatus("Showing all dimensions.", false)
    }
    if (setFamilyPanelStatus) {
        setFamilyPanelStatus("Families cleared — showing all dimensions.", false)
    }
    rebuildSplomWithDimensions(numericDimensions.slice())
    refreshTableView()
}

function setFamilyMapWarnings(messages) {
    if (!familyMapWarningsEl) return
    const list = messages && messages.length ? messages : []
    familyMapWarningsEl.html("")
    if (!list.length) {
        familyMapWarningsEl.style("display", "none")
        return
    }
    familyMapWarningsEl.style("display", "block")
    list.forEach(function (msg) {
        familyMapWarningsEl.append("div")
            .attr("class", "family-map-warning")
            .text(msg)
    })
}

function toggleFamilyExpanded(familyName) {
    if (expandedFamilies.has(familyName)) {
        expandedFamilies.delete(familyName)
    } else {
        expandedFamilies.add(familyName)
    }
    renderFamilyDimensionPanel()
    rebuildSplomFromFamilyState()
    if (setFamilyPanelStatus) {
        const visible = getVisibleSplomDimensionsFromFamilies().length
        const expandedNames = dimensionFamilies.sortFamilyNames(Array.from(expandedFamilies))
        let msg
        if (!expandedNames.length) {
            msg = "All families collapsed — SPLOM is empty. Expand one or more family chips to show variables."
        } else if (expandedNames.length === 1) {
            msg = "SPLOM showing " + visible + " variable(s) from \"" + expandedNames[0] + "\"."
        } else {
            msg = "SPLOM showing " + visible + " variable(s) from " + expandedNames.length + " families."
        }
        setFamilyPanelStatus(msg, false)
    }
}

function setFamilySelection(familyName, checked) {
    const dims = currentDimensionFamilies[familyName] || []
    for (let i = 0; i < dims.length; i++) {
        const dim = dims[i]
        const idx = selectedColumns.indexOf(dim)
        if (checked) {
            if (idx === -1) selectedColumns.push(dim)
        } else if (idx !== -1) {
            selectedColumns.splice(idx, 1)
        }
    }
    syncColumnHighlightUI()
}

function setDimensionSelection(dim, checked) {
    if (!dim || numericDimensions.indexOf(dim) === -1) return
    const idx = selectedColumns.indexOf(dim)
    if (checked) {
        if (idx === -1) selectedColumns.push(dim)
    } else if (idx !== -1) {
        selectedColumns.splice(idx, 1)
    }
    syncColumnHighlightUI()
}

function createFamilyFromSelected(familyName) {
    const name = String(familyName || "").trim()
    if (!name) {
        if (setFamilyPanelStatus) setFamilyPanelStatus("Enter a family name first.", true)
        return
    }
    if (dimensionFamilies.isOthersFamily(name)) {
        if (setFamilyPanelStatus) setFamilyPanelStatus('"' + dimensionFamilies.OTHER_FAMILY + '" is reserved for unassigned dimensions.', true)
        return
    }
    if (currentDimensionFamilies[name]) {
        if (setFamilyPanelStatus) setFamilyPanelStatus('Family "' + name + '" already exists.', true)
        return
    }
    const dims = selectedColumns.filter(function (d) {
        return numericDimensions.indexOf(d) !== -1
    })
    if (!dims.length) {
        if (setFamilyPanelStatus) {
            setFamilyPanelStatus("Select dimensions in the table first.", true)
        }
        return
    }
    currentDimensionFamilies[name] = []
    for (let i = 0; i < dims.length; i++) {
        dimensionFamilies.assignDimensionToFamily(currentDimensionFamilies, dims[i], name)
    }
    syncDimensionFamiliesState()
    expandAllFamilies()
    selectedColumns = []
    syncColumnHighlightUI()
    renderFamilyDimensionPanel()
    rebuildSplomFromFamilyState()
    if (setFamilyPanelStatus) {
        const visible = getVisibleSplomDimensionsFromFamilies().length
        setFamilyPanelStatus(
            'Created family "' + name + '" with ' + dims.length + " dimension(s). All families expanded — SPLOM showing " + visible + " variable(s).",
            false
        )
    }
}

function promptCreateFamilyFromSelected() {
    const dims = selectedColumns.filter(function (d) {
        return numericDimensions.indexOf(d) !== -1
    })
    if (!dims.length) {
        if (setFamilyPanelStatus) setFamilyPanelStatus("Select dimensions in the table first.", true)
        return
    }
    const familyCount = dimensionFamilies.sortFamilyNames(Object.keys(currentDimensionFamilies)).length
    const suggested = "Family " + (familyCount + 1)
    const name = window.prompt(
        "Create family from selected dimensions:\n" + dims.join(", ") + "\n\nFamily name:",
        suggested
    )
    if (name == null) return
    createFamilyFromSelected(name)
}

function renameFamily(oldName, newName) {
    const next = String(newName || "").trim()
    if (!next || next === oldName) return
    if (dimensionFamilies.isOthersFamily(oldName) || dimensionFamilies.isOthersFamily(next)) return
    if (currentDimensionFamilies[next]) {
        if (setFamilyPanelStatus) setFamilyPanelStatus('Family "' + next + '" already exists.', true)
        return
    }
    currentDimensionFamilies[next] = (currentDimensionFamilies[oldName] || []).slice()
    delete currentDimensionFamilies[oldName]
    if (expandedFamilies.has(oldName)) {
        expandedFamilies.delete(oldName)
        expandedFamilies.add(next)
    }
    syncDimensionFamiliesState()
    renderFamilyDimensionPanel()
    rebuildSplomFromFamilyState()
    if (setFamilyPanelStatus) setFamilyPanelStatus('Renamed family to "' + next + '".', false)
}

function deleteFamily(familyName) {
    if (!familyName || dimensionFamilies.isOthersFamily(familyName)) return
    if (!currentDimensionFamilies[familyName]) return
    delete currentDimensionFamilies[familyName]
    expandedFamilies.delete(familyName)
    syncDimensionFamiliesState()
    renderFamilyDimensionPanel()
    rebuildSplomFromFamilyState()
    if (setFamilyPanelStatus) setFamilyPanelStatus('Deleted family "' + familyName + '".', false)
}

function applyUploadedFamilyMap(familyMap) {
    const normalized = dimensionFamilies.normalizeFamilyMap(familyMap, allDimensions)
    currentDimensionFamilies = normalized.families
    expandAllFamilies()
    setFamilyMapWarnings(normalized.warnings)
    if (normalized.unmatched && normalized.unmatched.length) {
        console.warn("[Families] Unmatched uploaded variables:", normalized.unmatched)
    }
    renderFamilyDimensionPanel()
    rebuildSplomFromFamilyState()
    if (setFamilyPanelStatus) {
        const count = Object.keys(dimensionFamilies.familiesForExport(currentDimensionFamilies)).length
        const visible = getVisibleSplomDimensionsFromFamilies().length
        setFamilyPanelStatus(
            "Loaded " + count + " families (" + visible + " variables visible in SPLOM). Click family chips to expand or collapse.",
            false
        )
    }
}

function exportFamilyMapDownload() {
    const json = dimensionFamilies.exportFamilyMapJson(currentDimensionFamilies)
    download("dimension_families_" + Date.now() + ".json", json)
}

function renderFamilyDimensionPanel() {
    const root = d3.select("#family-dimension-list")
    if (root.empty()) return

    const familyNames = dimensionFamilies.sortFamilyNames(Object.keys(currentDimensionFamilies))
    root.html("")

    if (!familyNames.length) {
        root.append("div")
            .attr("class", "family-empty-hint")
            .text("Select dimensions in the table and click Create Family. You will be prompted for a family name. Unassigned dimensions stay in " + dimensionFamilies.OTHER_FAMILY + ".")
        return
    }

    root.append("div")
        .attr("class", "family-panel-hint")
        .text("Select dimensions in the table and click Create Family. SPLOM follows expanded family chips only.")

    familyNames.forEach(function (familyName) {
        const dims = currentDimensionFamilies[familyName] || []
        const expanded = expandedFamilies.has(familyName)
        const section = root.append("div")
            .attr("class", "family-group-section" + (dimensionFamilies.isOthersFamily(familyName) ? " is-others" : ""))

        const header = section.append("div").attr("class", "family-group-header")
        header.append("span")
            .attr("class", "family-summary-state")
            .text(expanded ? "shown in SPLOM" : "hidden in SPLOM")
        header.append("span")
            .attr("class", "family-summary-name")
            .text(familyName)
        header.append("span")
            .attr("class", "family-summary-count")
            .text("(" + dims.length + ")")
        if (!dimensionFamilies.isOthersFamily(familyName)) {
            header.append("button")
                .attr("type", "button")
                .attr("class", "selection-layer-row-btn remove family-remove-btn")
                .attr("title", "Remove family")
                .text("−")
                .on("click", function () { deleteFamily(familyName) })
        }

        if (dims.length) {
            const list = section.append("div").attr("class", "family-dim-list")
            dims.forEach(function (dim) {
                list.append("div")
                    .attr("class", "family-dim-item")
                    .attr("data-dim", dim)
                    .text(dim)
            })
        }
    })
}

function syncColumnHighlightUI() {
    const tableRoot = d3.select("#tableView_table")
    if (tableRoot.empty()) return

    tableRoot.selectAll(".table-dim-checkbox")
        .property("checked", function () {
            const dim = this.dataset.dim
            return dim && selectedColumns.indexOf(dim) !== -1
        })

    tableRoot.selectAll("th[data-dim], td[data-dim]")
        .classed("selected-column", function () {
            const dim = this.dataset.dim
            return dim && selectedColumns.indexOf(dim) !== -1
        })
}

function setupTableDimCheckboxDelegation() {
    if (tableDimCheckboxDelegationBound) return
    tableDimCheckboxDelegationBound = true

    d3.select(document).on("change.tableDimCheckbox", function () {
        const target = d3.event && d3.event.target
        if (!target || !target.classList || !target.classList.contains("table-dim-checkbox")) return

        setDimensionSelection(target.dataset.dim, target.checked)
    })

    d3.select(document).on("click.tableDimSelect", function () {
        const target = d3.event && d3.event.target
        if (!target) return
        if (target.classList && target.classList.contains("table-dim-checkbox")) return
        if (target.closest && target.closest("label.table-dim-header")) return

        const cell = target.closest && (target.closest("th[data-dim]") || target.closest("td[data-dim]"))
        if (!cell) return
        const dim = cell.dataset.dim
        if (!dim || numericDimensions.indexOf(dim) === -1) return

        setDimensionSelection(dim, selectedColumns.indexOf(dim) === -1)
    })
}

function getActiveSelectionLabel() {
    if (!current_color || !current_color.length || !current_color[0]) return ""
    const layer = current_color[0]
    return layer.cname || layer.color || ""
}

function ensureVispromFloatingTooltip() {
    let el = document.getElementById("vispromFloatingTooltip")
    if (!el) {
        el = document.createElement("div")
        el.id = "vispromFloatingTooltip"
        el.className = "visprom-floating-tooltip"
        el.setAttribute("role", "tooltip")
        document.body.appendChild(el)
    }
    return el
}

function showVispromFloatingTooltip(text, event) {
    const tip = ensureVispromFloatingTooltip()
    tip.textContent = text
    tip.style.display = "block"
    const offset = 14
    const x = (event && (event.pageX || event.clientX)) || 0
    const y = (event && (event.pageY || event.clientY)) || 0
    tip.style.left = (x + offset) + "px"
    tip.style.top = (y + offset) + "px"
}

function hideVispromFloatingTooltip() {
    const tip = document.getElementById("vispromFloatingTooltip")
    if (tip) tip.style.display = "none"
}

function formatSplomHoverText(yDim, xDim) {
    const sel = getActiveSelectionLabel()
    let text = "Y: " + yDim + "  ·  X: " + xDim
    if (sel) text += "  ·  Selecting: " + sel
    return text
}

function setSplomCellTooltipVisible(canvasNode, visible) {
    if (!canvasNode || !canvasNode.closest) return
    const cell = canvasNode.closest(".splom-cell")
    if (!cell) return
    const tip = cell.querySelector(".tooltiptext")
    if (tip) tip.style.visibility = visible ? "visible" : "hidden"
    if (visible) cell.classList.add("splom-cell-hovered")
    else cell.classList.remove("splom-cell-hovered")
}

function bindMainChartHoverHandlers() {
    if (!mainviewSvg || mainviewSvg.empty()) return
    mainviewSvg.on("mousemove.vispromTip", null).on("mouseleave.vispromTip", null)
    hideVispromFloatingTooltip()
}

function refreshSplomHeatFromVisitCounts() {
    if (!splom || splom.empty()) return
    sploom.updateSplomHeat(splom, maxSplomAcc, viewVisitcount)
}

function applySplomVisitIncrement(canvasNode) {
    const c = d3.select(canvasNode)
    const xDim = c.attr("xDim") || c.attr("data-x-dim")
    const yDim = c.attr("yDim") || c.attr("data-y-dim")
    if (!xDim || !yDim) return null

    const cellNode = canvasNode.parentNode
    const visitKey = getSplomVisitCountKey(xDim, yDim, cellNode)
    const prevCount = viewVisitcount[visitKey] || 0
    const prevLevel = sploom.getHeatLevel(prevCount)

    if (viewVisitcount[visitKey] === undefined) viewVisitcount[visitKey] = 0
    viewVisitcount[visitKey] += 1
    const newCount = viewVisitcount[visitKey]
    const newLevel = sploom.getHeatLevel(newCount)

    if (dimVisitcount[xDim] === undefined) dimVisitcount[xDim] = 0
    if (dimVisitcount[yDim] === undefined) dimVisitcount[yDim] = 0
    dimVisitcount[xDim] += 1
    dimVisitcount[yDim] += 1
    totalDimVisitcount += 1

    if (newLevel !== prevLevel || prevCount === 0) {
        sploom.applySplomHeatForVisitKey(splom, visitKey, newCount, maxSplomAcc)
    }

    updateMainViewClickCount(xDim, yDim)
    updateCountTable(datum, countTable)

    return {
        visitKey: visitKey,
        xDim: xDim,
        yDim: yDim,
        cellNode: cellNode,
        prevCount: prevCount,
        prevLevel: prevLevel
    }
}

function revertSplomVisitIncrement(info) {
    if (!info) return
    const prevCount = info.prevCount || 0
    viewVisitcount[info.visitKey] = prevCount
    if (info.xDim) {
        dimVisitcount[info.xDim] = Math.max(0, (dimVisitcount[info.xDim] || 1) - 1)
    }
    if (info.yDim) {
        dimVisitcount[info.yDim] = Math.max(0, (dimVisitcount[info.yDim] || 1) - 1)
    }
    totalDimVisitcount = Math.max(0, totalDimVisitcount - 1)
    const prevLevel = sploom.getHeatLevel(prevCount)
    const bumpedLevel = sploom.getHeatLevel(prevCount + 1)
    if (prevCount === 0 || bumpedLevel !== prevLevel) {
        sploom.applySplomHeatForVisitKey(splom, info.visitKey, prevCount, maxSplomAcc)
    }
    updateMainViewClickCount(info.xDim, info.yDim)
    updateCountTable(datum, countTable)
}

function commitSplomCellNavigation(canvasNode) {
    const c = d3.select(canvasNode)
    const xDim = c.attr("xDim") || c.attr("data-x-dim")
    const yDim = c.attr("yDim") || c.attr("data-y-dim")
    if (!xDim || !yDim) return

    const cellNode = canvasNode.parentNode
    const cellSource = cellNode ? cellNode.getAttribute("data-dataset-source") : null
    const datasetSource = cellSource === "comparison" ? "comparison" : "primary"
    activateSplomPair(xDim, yDim, datasetSource)

    pushViewHistorySnapshot(xDim, yDim, datum)
    setTimeout(function () { updateViewHistory(viewHistory) }, 0)

    const log = { nameAction: "change_view", callparam: { xDim: xDim, yDim: yDim }, data: datum, timestamp: Date.now() }
    const svState = saveState("change_view", "")
    savedEntries.push(svState)
    if (onlineLogActive) {
        firebase.save(svState, globalLoss, userId)
    }
    finalLog.push(JSON.stringify(log, Set_toJSON))
    cache = []
}

function scheduleSplomCellNavigation(canvasNode) {
    if (splomClickTimer) clearTimeout(splomClickTimer)
    splomClickTimer = setTimeout(function () {
        splomClickTimer = null
        pendingSplomClickRevert = null
        commitSplomCellNavigation(canvasNode)
    }, 280)
}

function handleSplomCellClick(canvasNode) {
    hideVispromFloatingTooltip()
    applySplomVisitIncrement(canvasNode)
    commitSplomCellNavigation(canvasNode)
}

function syncDatasetSnapshotForComparison() {
    if (!datum || !datum.length) return { ok: false, reason: "empty" }
    const datasetId = datasetStore.getSelectedDatasetId()
    return datasetStore.syncCurrentDatasetSnapshot(datum, datasetId)
}

function buildSelectionLayersSnapshotForComparison() {
    syncCurrentContextToLayerSouche()

    const colorByName = {}
    const metaByName = {}
    selections.concat(reserve).forEach(function (layer) {
        if (!layer || !layer.cname || !layer.color || !layer.color.string) return
        colorByName[layer.cname] = layer.color.string.substr(0, 7)
        ensureSelectionLayerMeta(layer)
        metaByName[layer.cname] = {
            id: layer.id,
            label: layer.label || layer.displayName || layer.cname,
            annotation: layer.annotation || ""
        }
    })

    const layersByName = {}
    function ensureLayer(cname) {
        if (!layersByName[cname]) {
            const meta = metaByName[cname] || {}
            layersByName[cname] = {
                id: meta.id || ("selection-" + String(cname).toLowerCase()),
                cname: cname,
                label: meta.label || cname,
                color: colorByName[cname] || "#22c55e",
                annotation: meta.annotation || "",
                selectionsBySouche: {}
            }
        }
        return layersByName[cname]
    }

    function addIdsForSouche(cname, souche, ids) {
        if (!cname || cname === "Blue" || !souche || !ids || !ids.length) return
        const layer = ensureLayer(cname)
        if (!layer.selectionsBySouche[souche]) layer.selectionsBySouche[souche] = []
        const set = new Set(layer.selectionsBySouche[souche])
        ids.forEach(function (id) {
            if (id != null) set.add(id)
        })
        layer.selectionsBySouche[souche] = Array.from(set)
    }

    function collectRowIdsForLayer(layer) {
        const ids = new Set()
        if (layer.content) {
            layer.content.forEach(function (d) {
                if (!d) return
                const rid = d.__rowId != null ? d.__rowId : d.id
                if (rid != null) ids.add(rid)
            })
        }
        ensureSelectionLayerMeta(layer)
        Object.keys(layer.selectionsBySouche || {}).forEach(function (key) {
            (layer.selectionsBySouche[key] || []).forEach(function (rid) {
                if (rid != null) ids.add(rid)
            })
        })
        return ids
    }

    function bucketRowIdsBySouche(cname, rowIds) {
        rowIds.forEach(function (rowId) {
            const row = rowById && rowById.get ? rowById.get(rowId) : null
            let souche = null
            if (row && yeastColumn && row[yeastColumn] != null && row[yeastColumn] !== "") {
                souche = String(row[yeastColumn])
            }
            if (souche) {
                addIdsForSouche(cname, souche, [rowId])
            } else {
                addIdsForSouche(cname, "__ALL__", [rowId])
            }
        })
    }

    for (let i = 1; i < selections.length; i++) {
        const layer = selections[i]
        if (!layer || !layer.cname || layer.cname === "Blue") continue
        bucketRowIdsBySouche(layer.cname, collectRowIdsForLayer(layer))
    }

    Object.keys(selectionMemoryByContext || {}).forEach(function (ctxKey) {
        const soucheKeys = getSoucheKeysFromSelectionContextKey(ctxKey)
        const snapshot = selectionMemoryByContext[ctxKey]
        if (!snapshot) return
        Object.keys(snapshot).forEach(function (cname) {
            const ids = snapshot[cname] || []
            if (!ids.length) return
            if (soucheKeys.length === 1 && soucheKeys[0] !== "__ALL__" && soucheKeys[0].indexOf("|") === -1) {
                addIdsForSouche(cname, soucheKeys[0], ids)
            } else {
                bucketRowIdsBySouche(cname, new Set(ids))
            }
        })
    })

    return Object.keys(layersByName)
        .filter(function (cname) { return cname !== "Blue" })
        .map(function (cname) { return layersByName[cname] })
}

function notifySoucheComparisonIssue(message, isError) {
    const text = message || ""
    if (isError) {
        console.warn("[Souche comparison]", text)
    }
    if (setYeastPanelStatus) {
        setYeastPanelStatus(text, isError)
    }
    if (isError && text) {
        alert(text)
    }
}

function tryWriteComparisonState(comparisonId, state) {
    try {
        return soucheComparisonStorage.writeComparisonState(comparisonId, state)
    } catch (err) {
        console.warn("[Souche comparison] writeComparisonState failed:", err)
        return false
    }
}

function openSoucheComparisonInNewTab(xDim, yDim, silent) {
    return timeBlock("openSoucheComparisonInNewTab", function () {
    if (!xDim || !yDim) {
        notifySoucheComparisonIssue("Could not open comparison: missing X/Y dimensions.", true)
        return
    }
    if (!datum || !datum.length) {
        notifySoucheComparisonIssue("Could not open comparison: dataset is not loaded.", true)
        return
    }

    refreshAvailableYeastTypes()
    if (!yeastColumn) {
        applyDatasetColumnClassification(datum)
    }
    if (!yeastColumn) {
        notifySoucheComparisonIssue(
            "No Souche column in this dataset. Switch to \"Fermentations (1000 rows)\" in the dataset dropdown.",
            true
        )
        return
    }

    const souchesToCompare = availableYeastTypes.slice()
    if (!souchesToCompare.length) {
        notifySoucheComparisonIssue("No Souche values found in dataset.", true)
        return
    }

    const comparisonId = "souche-comparison-" + Date.now()
    const openedAt = new Date().toISOString()
    const datasetId = datasetStore.getSelectedDatasetId()
    const sessionId = (typeof window !== 'undefined' && window.vispromSessionId)
        ? String(window.vispromSessionId)
        : 'default'

    let selectionLayers = []
    try {
        selectionLayers = buildSelectionLayersSnapshotForComparison()
    } catch (err) {
        console.warn("[Souche comparison] Could not snapshot selection layers:", err)
    }

    const comparisonState = {
        comparisonId: comparisonId,
        vispromSessionId: sessionId,
        xDim: xDim,
        yDim: yDim,
        yeastColumn: yeastColumn,
        souchesToCompare: souchesToCompare,
        selectedYeastTypes: selectedYeastTypes.slice(),
        availableYeastTypes: availableYeastTypes.slice(),
        datasetId: datasetId,
        selectionLayers: selectionLayers,
        openedAt: openedAt
    }

    // Save state synchronously BEFORE opening tab (tab reads on load).
    try {
        sessionStorage.setItem(comparisonId, JSON.stringify(comparisonState))
    } catch (err) {
        console.warn("[Open comparison] sessionStorage write failed:", err)
    }
    syncDatasetSnapshotForComparison()
    tryWriteComparisonState(comparisonId, comparisonState)

    const url = window.location.origin + "/static/souche-comparison.html?comparisonId="
        + encodeURIComponent(comparisonId)
        + "&sessionId=" + encodeURIComponent(sessionId)

    console.log("[Open comparison requested]", {
        comparisonId: comparisonId,
        xDim: xDim,
        yDim: yDim,
        yeastColumn: yeastColumn,
        souchesToCompare: souchesToCompare,
        selectionLayerCount: selectionLayers.length
    })

    const win = window.open(url, "_blank")

    console.log("[Open comparison result]", {
        comparisonId: comparisonId,
        url: url,
        opened: !!win
    })

    if (!win) {
        notifySoucheComparisonIssue(
            "Pop-up blocked. Allow pop-ups for this site to open Souche comparison.",
            true
        )
        return
    }

    // Optional: store full rows after tab is open (not required for tab to load).
    try {
        const withRows = Object.assign({}, comparisonState, {
            datasetRows: datasetStore.rowsToStoragePlain(datum)
        })
        const payload = JSON.stringify(withRows)
        if (datasetStore.byteSize(payload) <= datasetStore.MAX_COMPARISON_SNAPSHOT_BYTES) {
            tryWriteComparisonState(comparisonId, withRows)
        }
    } catch (err) {
        /* ignore */
    }

    const tabEntry = {
        comparisonId: comparisonId,
        xDim: xDim,
        yDim: yDim,
        yeastColumn: yeastColumn,
        souchesToCompare: souchesToCompare,
        openedAt: openedAt
    }
    openedSoucheComparisons.push(tabEntry)
    syncSoucheComparisonListsToStorage()

    logProvenanceAction("open_souche_comparison_new_tab", {
        xDim: xDim,
        yDim: yDim,
        yeastColumn: yeastColumn,
        souchesToCompare: souchesToCompare,
        comparisonId: comparisonId,
        openedAt: openedAt,
        includesAllSouches: true,
        includesSelections: !!(selectionLayers && selectionLayers.length),
        selectionLayerCount: selectionLayers ? selectionLayers.length : 0
    })

    if (!silent && setYeastPanelStatus) {
        setYeastPanelStatus("Opened comparison in new tab: " + xDim + " vs " + yDim, false)
    }
    })
}

function getSplomPlotCanvasFromCell(cellEl) {
    if (!cellEl) return null
    return cellEl.querySelector("canvas.splom-plot") || cellEl.querySelector("canvas.splom-bg-canvas")
}

function isSplomCellPlotTarget(cellEl, target) {
    if (!cellEl || !target) return false
    if (cellEl !== target && !cellEl.contains(target)) return false
    return !!getSplomPlotCanvasFromCell(cellEl)
}

function getSplomCellDimensions(cellEl) {
    if (!cellEl) return { xDim: null, yDim: null }
    const canvas = getSplomPlotCanvasFromCell(cellEl)
    const xDim = cellEl.getAttribute("data-x-dim") ||
        (canvas ? (canvas.getAttribute("xDim") || canvas.getAttribute("data-x-dim")) : null)
    const yDim = cellEl.getAttribute("data-y-dim") ||
        (canvas ? (canvas.getAttribute("yDim") || canvas.getAttribute("data-y-dim")) : null)
    return { xDim: xDim, yDim: yDim }
}

function triggerSplomCellDblClick(cellEl, meta) {
    return timeBlock("triggerSplomCellDblClick", function () {
    if (!cellEl) return
    if (splomClickTimer) {
        clearTimeout(splomClickTimer)
        splomClickTimer = null
    }
    if (pendingSplomClickRevert) {
        revertSplomVisitIncrement(pendingSplomClickRevert)
        pendingSplomClickRevert = null
    }
    splomCellClickState = {}
    const dims = getSplomCellDimensions(cellEl)
    console.log("[SPLOM dblclick fired]", Object.assign({
        xDim: dims.xDim,
        yDim: dims.yDim
    }, meta || {}))
    if (!dims.xDim || !dims.yDim) {
        notifySoucheComparisonIssue("Could not read X/Y dimensions from SPLOM cell.", true)
        return
    }
    openSoucheComparisonInNewTab(dims.xDim, dims.yDim)
    })
}

function ensureDocumentSplomDblClickHandler() {
    if (typeof document === "undefined") return
    if (document.__vispromSplomDocDblBound) return
    document.__vispromSplomDocDblBound = true
    document.addEventListener("dblclick", function (e) {
        const cell = e.target && e.target.closest ? e.target.closest(".splom-cell") : null
        if (!cell || !cell.closest(".splom")) return
        const xDim = cell.getAttribute("data-x-dim")
        const yDim = cell.getAttribute("data-y-dim")
        if (!xDim || !yDim) return
        e.preventDefault()
        e.stopPropagation()
        triggerSplomCellDblClick(cell, {
            target: e.target,
            via: "document-capture"
        })
    }, true)
}

function wireNativeSplomDblClickHandlers() {
    if (!splom || splom.empty()) return
    splom.selectAll(".splom-cell").each(function () {
        const cell = this
        const xDim = cell.getAttribute("data-x-dim")
        const yDim = cell.getAttribute("data-y-dim")
        if (!xDim || !yDim) return
        if (cell.__vispromNativeDblClick) return
        cell.__vispromNativeDblClick = true

        function onNativeDbl(e) {
            e.preventDefault()
            e.stopImmediatePropagation()
            triggerSplomCellDblClick(cell, { via: "native-cell", target: e.target })
        }

        cell.addEventListener("dblclick", onNativeDbl, false)
        const canvas = cell.querySelector("canvas.splom-plot")
        if (canvas && !canvas.__vispromNativeDblClick) {
            canvas.__vispromNativeDblClick = true
            canvas.addEventListener("dblclick", onNativeDbl, false)
        }
    })
}

function getSplomNavEventRoot() {
    if (splom && !splom.empty()) return splom.node()
    return document.querySelector(".panel-splom .splom") || document.querySelector(".splom")
}

function isEditableTarget(target) {
    if (!target) return false
    const tag = target.tagName ? String(target.tagName).toLowerCase() : ""
    return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select"
}

function isNavigableSplomCell(cell, root) {
    if (!cell || !root || !root.contains(cell)) return false
    if (!cell.getAttribute("data-x-dim") || !cell.getAttribute("data-y-dim")) return false
    if (!getSplomPlotCanvasFromCell(cell)) return false
    if (cell.offsetParent === null) return false
    const rect = cell.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
}

function buildSplomCellNavigationMap(root) {
    const rows = []
    root.querySelectorAll(".splom-row").forEach(function (rowEl) {
        if (rowEl.offsetParent === null) return
        const rowDim = rowEl.getAttribute("data-dim")
        if (rowDim) rows.push(rowDim)
    })

    const cols = []
    root.querySelectorAll(".splom-col-header").forEach(function (headerEl) {
        if (headerEl.offsetParent === null) return
        const colDim = headerEl.getAttribute("data-dim")
        if (colDim) cols.push(colDim)
    })
    if (!cols.length) {
        root.querySelectorAll(".splom-cell").forEach(function (cell) {
            if (!isNavigableSplomCell(cell, root)) return
            const colDim = cell.getAttribute("data-col-dim")
            if (colDim && cols.indexOf(colDim) === -1) cols.push(colDim)
        })
    }

    const byGridKey = new Map()
    const cells = []
    root.querySelectorAll(".splom-cell").forEach(function (cell) {
        if (!isNavigableSplomCell(cell, root)) return
        const rowEl = cell.closest(".splom-row")
        const rowDim = rowEl ? rowEl.getAttribute("data-dim") : null
        const colDim = cell.getAttribute("data-col-dim")
        if (!rowDim || !colDim) return
        const rowIndex = rows.indexOf(rowDim)
        const colIndex = cols.indexOf(colDim)
        if (rowIndex < 0 || colIndex < 0) return
        byGridKey.set(rowDim + "::" + colDim, cell)
        cells.push({
            cell: cell,
            rowDim: rowDim,
            colDim: colDim,
            rowIndex: rowIndex,
            colIndex: colIndex
        })
    })

    return { rows: rows, cols: cols, byGridKey: byGridKey, cells: cells }
}

function getCurrentActiveSplomCell(root, navState) {
    const active = root.querySelector(".splom-cell.active-splom-cell")
    if (active && isNavigableSplomCell(active, root)) return active
    const xDim = mainChartMvX || mvX
    const yDim = mainChartMvY || mvY
    const preferredSource = activeDatasetSource === "comparison" ? "comparison" : "primary"
    for (let i = 0; i < navState.cells.length; i++) {
        const candidate = navState.cells[i].cell
        if (candidate.getAttribute("data-x-dim") !== xDim) continue
        if (candidate.getAttribute("data-y-dim") !== yDim) continue
        const source = candidate.getAttribute("data-dataset-source") || "primary"
        if (source === preferredSource) return candidate
    }
    return navState.cells.length ? navState.cells[0].cell : null
}

function getSplomCellNeighbor(root, direction) {
    const navState = buildSplomCellNavigationMap(root)
    if (!navState.cells.length) return null
    const activeCell = getCurrentActiveSplomCell(root, navState)
    if (!activeCell) return null
    const rowEl = activeCell.closest(".splom-row")
    const rowDim = rowEl ? rowEl.getAttribute("data-dim") : null
    const colDim = activeCell.getAttribute("data-col-dim")
    if (!rowDim || !colDim) return null
    let rowIndex = navState.rows.indexOf(rowDim)
    let colIndex = navState.cols.indexOf(colDim)
    if (rowIndex < 0 || colIndex < 0) return null

    const step = direction === "up" || direction === "left" ? -1 : 1
    const moveAlongRows = direction === "up" || direction === "down"
    while (true) {
        if (moveAlongRows) rowIndex += step
        else colIndex += step
        if (rowIndex < 0 || colIndex < 0 || rowIndex >= navState.rows.length || colIndex >= navState.cols.length) return null
        const candidate = navState.byGridKey.get(navState.rows[rowIndex] + "::" + navState.cols[colIndex])
        if (candidate && isNavigableSplomCell(candidate, root)) return candidate
    }
}

function navigateSplomByArrowKey(root, direction) {
    const nextCell = getSplomCellNeighbor(root, direction)
    if (!nextCell) return false
    const canvas = getSplomPlotCanvasFromCell(nextCell)
    if (!canvas) return false
    hideVispromFloatingTooltip()
    pendingSplomClickRevert = applySplomVisitIncrement(canvas)
    commitSplomCellNavigation(canvas)
    pendingSplomClickRevert = null
    return true
}

function ensureSplomCellNavHandlers() {
    ensureDocumentSplomDblClickHandler()
    const root = getSplomNavEventRoot()
    if (!root) return

    if (root.__splomDblClickHandler) {
        root.removeEventListener("dblclick", root.__splomDblClickHandler, true)
    }
    if (root.__splomClickHandler) {
        root.removeEventListener("click", root.__splomClickHandler, true)
    }
    if (root.__splomKeydownHandler) {
        root.removeEventListener("keydown", root.__splomKeydownHandler, true)
    }

    root.__splomDblClickHandler = function (e) {
        const cell = e.target && e.target.closest ? e.target.closest(".splom-cell") : null
        if (!cell || !root.contains(cell)) return
        const xDim = cell.getAttribute("data-x-dim")
        const yDim = cell.getAttribute("data-y-dim")
        if (!xDim || !yDim) return
        e.preventDefault()
        e.stopPropagation()
        triggerSplomCellDblClick(cell, { via: "splom-capture", target: e.target })
    }

    root.__splomClickHandler = function (e) {
        const cell = e.target && e.target.closest ? e.target.closest(".splom-cell") : null
        if (!cell || !root.contains(cell) || !isSplomCellPlotTarget(cell, e.target)) return
        const canvas = getSplomPlotCanvasFromCell(cell)
        if (!canvas) return
        if (typeof root.focus === "function") root.focus()
        e.stopImmediatePropagation()
        hideVispromFloatingTooltip()
        pendingSplomClickRevert = applySplomVisitIncrement(canvas)
        scheduleSplomCellNavigation(canvas)
    }

    root.__splomKeydownHandler = function (e) {
        if (!e) return
        if (isEditableTarget(e.target)) return
        let direction = null
        if (e.key === "ArrowUp") direction = "up"
        else if (e.key === "ArrowDown") direction = "down"
        else if (e.key === "ArrowLeft") direction = "left"
        else if (e.key === "ArrowRight") direction = "right"
        if (!direction) return
        if (splomClickTimer) {
            clearTimeout(splomClickTimer)
            splomClickTimer = null
        }
        const moved = navigateSplomByArrowKey(root, direction)
        if (!moved) return
        e.preventDefault()
        e.stopPropagation()
    }

    root.setAttribute("tabindex", "0")

    root.addEventListener("dblclick", root.__splomDblClickHandler, true)
    root.addEventListener("click", root.__splomClickHandler, true)
    root.addEventListener("keydown", root.__splomKeydownHandler, true)
}

function syncYeastPanelCheckboxes() {
    document.querySelectorAll(".yeast-type-checkbox").forEach(function (box) {
        const val = box.getAttribute("data-yeast")
        box.checked = selectedYeastTypes.indexOf(val) !== -1
    })
    syncSplomSoucheDropdownSelection()
}

function syncYeastTrianglePickerUI() {
    const wrap = document.getElementById("yeastTrianglePicker")
    if (!wrap) return
    const show = soucheTriangleCompareActive && selectedYeastTypes.length >= 2
    wrap.style.display = show ? "" : "none"
    if (!show) return
    const lowerSel = document.getElementById("yeastTriangleLower")
    const upperSel = document.getElementById("yeastTriangleUpper")
    if (!lowerSel || !upperSel) return
    const opts = selectedYeastTypes.map(function (s) {
        return "<option value=\"" + s + "\">" + s + "</option>"
    }).join("")
    lowerSel.innerHTML = opts
    upperSel.innerHTML = opts
    lowerSel.value = triangleLowerYeast || selectedYeastTypes[0]
    upperSel.value = triangleUpperYeast || selectedYeastTypes[1]
}

function ensureMainChartYeastViewControl() {
    const group = document.getElementById("mainChartYeastViewControl")
    if (group) group.remove()
}

function ensureSelectionTargetControl() {
    let group = document.getElementById("yeastSelectionTargetControl")
    if (!group) return
    group.style.display = isSoucheCompareModeActive() ? "" : "none"
    document.querySelectorAll("input[name='selectionTarget']").forEach(function (input) {
        input.checked = input.value === selectionTarget
    })
}

function bindSplomPlotHandlers() {
    if (!splom || splom.empty()) return
    ensureSplomCellNavHandlers()
    ensureSplomHoverHandlers()
    wireNativeSplomDblClickHandlers()
    splom.selectAll(".splom-plot").style("cursor", "pointer")

    function onSplomDblClick() {
        const node = this
        const cellEl = node.classList && node.classList.contains("splom-cell")
            ? node
            : (node.closest ? node.closest(".splom-cell") : null)
        if (!cellEl) return
        if (d3.event) {
            d3.event.preventDefault()
            d3.event.stopPropagation()
        }
        triggerSplomCellDblClick(cellEl, {
            via: node.classList && node.classList.contains("splom-plot") ? "d3-canvas" : "d3-cell"
        })
    }

    splom.selectAll(".splom-cell")
        .on("dblclick.splomCompare", onSplomDblClick)
        .on("click.splomNav", function () {
            if (splomClickTimer) return
            const cellEl = this
            const canvas = getSplomPlotCanvasFromCell(cellEl)
            if (!canvas) return
            hideVispromFloatingTooltip()
            pendingSplomClickRevert = applySplomVisitIncrement(canvas)
            scheduleSplomCellNavigation(canvas)
        })

    splom.selectAll(".splom-plot")
        .on("dblclick.splomCompare", onSplomDblClick)
        .on("mousemove", function () {
        const c = d3.select(this)
        const cellNode = c.node() && c.node().parentNode ? c.node().parentNode : null
        const xDim = c.attr("xDim") || c.attr("data-x-dim")
        const yDim = c.attr("yDim") || c.attr("data-y-dim")
        if (xDim && yDim && d3.event) {
            showVispromFloatingTooltip(formatSplomHoverText(yDim, xDim), d3.event)
        }
    })

    console.log("[SPLOM dblclick debug]", {
        cellCount: splom.selectAll(".splom-cell").size(),
        plotCount: splom.selectAll("canvas.splom-plot").size(),
        comparisonFnExists: typeof openSoucheComparisonInNewTab === "function"
    })
}

function getMainPlotSize() {
    const fallback = 700;
    let el = document.getElementById("mainview");
    if (!el) el = document.querySelector(".mainView");
    if (!el) el = document.querySelector(".panel-main .panel-body");
    if (!el) return { width: fallback, height: fallback };
    const width = Math.max(200, Math.floor(el.clientWidth || 0));
    const height = Math.max(200, Math.floor(el.clientHeight || 0));
    if (width > 0 && height > 0) return { width: width, height: height };
    const rect = el.getBoundingClientRect();
    return {
        width: Math.max(200, Math.floor(rect.width || fallback)),
        height: Math.max(200, Math.floor(rect.height || fallback))
    };
}

function syncMainChartLayout() {
    if (!mainviewSvg || !datum) return;
    ensureValidMainChartDimensions();
    const xDim = mainChartMvX || mainviewSvg.attr("xDim");
    const yDim = mainChartMvY || mainviewSvg.attr("yDim");
    if (!xDim || !yDim) return;
    const size = getMainPlotSize();
    scaterplot.chooseDims(size.width, size.height, getMainChartPrimaryData(), xDim, yDim, mainviewSvg, null, getMainChartOverlayOptions());
    updateMainViewClickCount(xDim, yDim);
    updateMainChartBrushLayout(mainviewSvg);
}

let mainChartResizeDebounceTimer = null
let splomResizeObserver = null
let splomResizeTimer = null
let splomInitialLayoutDone = false

function onMainChartResize() {
    refreshMainChartRendering()
}

function onSplomPanelResize() {
    if (!splomInitialLayoutDone || !datum || !splom || splom.empty()) return
    const dims = getSplomDimensionsForDisplay()
    if (!dims || !dims.length) {
        if (hasDimensionFamilies()) {
            ensureSplomFamilyToolbar()
        }
        return
    }
    const node = splom.node()
    const newW = sploom.getSplomCellSize(node, dims.length, dims)
    const oldW = splom.property("__splomCellSize")
    if (Math.abs((newW || 0) - (oldW || 0)) < 1) return
    rebuildSplomWithDimensions(dims)
}

function ensureSplomResizeObserver() {
    if (splomResizeObserver || typeof ResizeObserver === "undefined") return
    const el = document.querySelector(".panel-splom .panel-body")
    if (!el) return
    splomResizeObserver = new ResizeObserver(function () {
        if (splomResizeTimer) clearTimeout(splomResizeTimer)
        splomResizeTimer = setTimeout(function () {
            splomResizeTimer = null
            onSplomPanelResize()
        }, 150)
    })
    splomResizeObserver.observe(el)
}

let mainChartResizeObserver = null;

function ensureMainChartResizeObserver() {
    if (mainChartResizeObserver || typeof ResizeObserver === "undefined") return;
    const el = document.getElementById("mainview") || document.querySelector(".mainView");
    if (!el) return;
    mainChartResizeObserver = new ResizeObserver(function () {
        if (mainChartResizeDebounceTimer != null) clearTimeout(mainChartResizeDebounceTimer)
        mainChartResizeDebounceTimer = setTimeout(function () {
            mainChartResizeDebounceTimer = null
            onMainChartResize()
        }, 120)
    });
    mainChartResizeObserver.observe(el);
}

function scheduleMainChartLayoutSync() {
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            refreshMainChartRendering()
        });
    });
}

function ensureMainChartHost() {
    const panel = c.select(".mainView");
    let mainview = panel.select("#mainview");
    if (mainview.empty()) {
        mainview = panel.append("div")
            .attr("id", "mainview")
            .style("width", "100%")
            .style("height", "100%")
            .style("max-width", "100%")
            .style("max-height", "100%")
            .style("overflow", "hidden")
            .style("box-sizing", "border-box");
    }
    mainview.selectAll("svg").each(function (d, i) {
        if (i > 0) d3.select(this).remove();
    });
    let svg = mainview.select("svg.bigView");
    if (svg.empty()) {
        svg = mainview.append("svg").attr("class", "bigView");
    }
    mainviewSvg = svg;
    if (!svg.property("__mainChartInited")) {
        scaterplot.init(svg);
        svg.property("__mainChartInited", true);
    }
    return svg;
}

function updateMainChart(chartMvX, chartMvY, zoom) {
    return timeBlock("updateMainChart", function () {
        if (!datum || !chartMvX || !chartMvY || !mainviewSvg) return null;
        mainChartMvX = chartMvX;
        mainChartMvY = chartMvY;
        mvX = chartMvX;
        mvY = chartMvY;
        ensureValidMainChartDimensions();
        const size = getMainPlotSize();
        scaterplot.chooseDims(size.width, size.height, getMainChartPrimaryData(), mainChartMvX, mainChartMvY, mainviewSvg, zoom || null, getMainChartOverlayOptions());
        return mainviewSvg;
    })
}

const TIME_DIM_REGEX = /^T\d+$/
const TIME_PLAY_SPEEDS = {
    "0.5x": 1200,
    "1x": 700,
    "2x": 350,
    "4x": 175
}

let timePlayInterval = null
let isPlayingTime = false
let timeSliderSyncInProgress = false

function isTimeDimension(dim) {
    return !!dim && TIME_DIM_REGEX.test(String(dim))
}

function getTimeDimensions(dimList) {
    return (dimList || allDimensions || [])
        .filter(isTimeDimension)
        .sort(function (a, b) {
            return parseInt(String(a).slice(1), 10) - parseInt(String(b).slice(1), 10)
        })
}

function shouldShowTimeControls(xDim, yDim) {
    return isTimeDimension(xDim) && !isTimeDimension(yDim)
}

function getMainChartDims() {
    const xDim = mainChartMvX || (mainviewSvg ? mainviewSvg.attr("xDim") : null)
    const yDim = mainChartMvY || (mainviewSvg ? mainviewSvg.attr("yDim") : null)
    return { xDim: xDim, yDim: yDim }
}

function showTimeControls() {
    const el = document.getElementById("main-chart-time-controls")
    if (el) el.hidden = false
}

function hideTimeControls() {
    const el = document.getElementById("main-chart-time-controls")
    if (el) el.hidden = true
}

function setTimeSliderLabel(label) {
    const el = document.getElementById("time-slider-label")
    if (el) el.textContent = label
}

function refreshTimeSliderRange() {
    const timeDims = getTimeDimensions(allDimensions)
    const slider = document.getElementById("time-slider")
    if (!slider) return
    slider.min = 0
    slider.max = Math.max(0, timeDims.length - 1)
    slider.step = 1
}

function setTimeSliderIndex(index) {
    timeSliderSyncInProgress = true
    const slider = document.getElementById("time-slider")
    if (slider) slider.value = String(index)
    timeSliderSyncInProgress = false
}

function updateTimeSliderUI(index, label) {
    setTimeSliderIndex(index)
    setTimeSliderLabel(label)
}

function updateTimeSliderForMainChart() {
    const dims = getMainChartDims()
    const xDim = dims.xDim
    const yDim = dims.yDim

    if (!shouldShowTimeControls(xDim, yDim)) {
        hideTimeControls()
        stopTimePlay()
        window.mainChartTimeControlAxis = null
        return
    }

    window.mainChartTimeControlAxis = "x"
    const timeDims = getTimeDimensions(allDimensions)
    const currentIndex = Math.max(0, timeDims.indexOf(xDim))

    refreshTimeSliderRange()
    showTimeControls()
    updateTimeSliderUI(currentIndex, xDim)
}

function updateActiveSplomCellHighlight(xDim, yDim) {
    if (!splom || splom.empty() || !xDim || !yDim) return
    splom.selectAll(".splom-cell").classed("active-splom-cell", false)
    splom.selectAll(".splom-plot").classed("splom-active", false).classed("splom-hover", false)
    if (isSplomTriangleCompareActive()) {
        const pairKey = comparisonDataset.getPairKey(xDim, yDim)
        splom.selectAll(".splom-cell")
            .filter(function () { return this.getAttribute("data-pair-key") === pairKey })
            .classed("active-splom-cell", true)
        return
    }
    const match = splom.selectAll(".splom-cell").filter(function () {
        const cell = d3.select(this)
        return cell.attr("data-x-dim") === xDim && cell.attr("data-y-dim") === yDim
    })
    if (!match.empty()) {
        match.classed("active-splom-cell", true)
    }
}

function activateSplomPair(xDim, yDim, sourceDataset, options) {
    const opts = options || {}
    if (typeof sourceDataset === "string" && sourceDataset.indexOf("splom") === 0) {
        sourceDataset = "primary"
    }
    sourceDataset = sourceDataset === "comparison" ? "comparison" : "primary"
    if (!datum || !xDim || !yDim || !mainviewSvg) return

    activeDatasetSource = sourceDataset
    mainChartMvX = xDim
    mainChartMvY = yDim
    mvX = xDim
    mvY = yDim
    ensureValidMainChartDimensions()

    const mainPlotSize = getMainPlotSize()
    scaterplot.chooseDims(mainPlotSize.width, mainPlotSize.height, getMainChartPrimaryData(), mainChartMvX, mainChartMvY, mainviewSvg, null, getMainChartOverlayOptions())
    updateMainViewClickCount(xDim, yDim)
    updateMainChartBrushLayout(mainviewSvg)
    updateActiveSplomCellHighlight(xDim, yDim)
    updateTimeSliderForMainChart()
    updateMainChartSoucheNavigator()
    updateMainChartPairTitle()
    if (opts.skipSplomFocus !== true) {
        scheduleSplomFocusOnPair(xDim, yDim, {
            forceFit: !!opts.forceSplomFit,
            buffer: opts.splomFocusBuffer
        })
    }
}

function applyTimeIndex(index, source) {
    const timeDims = getTimeDimensions(allDimensions)
    if (!timeDims.length || index < 0 || index >= timeDims.length) return

    const newTimeDim = timeDims[index]
    const dims = getMainChartDims()
    const newX = newTimeDim
    const newY = dims.yDim

    activateSplomPair(newX, newY, source || "time-slider")
    updateTimeSliderUI(index, newTimeDim)
}

function getSelectedPlayInterval() {
    const select = document.getElementById("time-speed-select")
    const speed = select ? select.value : "1x"
    return TIME_PLAY_SPEEDS[speed] || TIME_PLAY_SPEEDS["1x"]
}

function stopTimePlay() {
    isPlayingTime = false
    if (timePlayInterval) clearInterval(timePlayInterval)
    timePlayInterval = null
    const btn = document.getElementById("time-play-btn")
    if (btn) btn.textContent = "Play"
}

function restartTimePlayWithNewSpeed() {
    if (!isPlayingTime) return
    if (timePlayInterval) clearInterval(timePlayInterval)
    timePlayInterval = setInterval(stepTimeForward, getSelectedPlayInterval())
}

function stepTimeForward() {
    const slider = document.getElementById("time-slider")
    const timeDims = getTimeDimensions(allDimensions)
    if (!slider || !timeDims.length) {
        stopTimePlay()
        return
    }

    const nextIndex = Number(slider.value) + 1
    if (nextIndex >= timeDims.length) {
        stopTimePlay()
        return
    }

    applyTimeIndex(nextIndex, "time-play")
}

function startTimePlay() {
    if (isPlayingTime) return
    const dims = getMainChartDims()
    if (!shouldShowTimeControls(dims.xDim, dims.yDim)) return

    isPlayingTime = true
    const btn = document.getElementById("time-play-btn")
    if (btn) btn.textContent = "Pause"
    timePlayInterval = setInterval(stepTimeForward, getSelectedPlayInterval())
}

function toggleTimePlay() {
    if (isPlayingTime) stopTimePlay()
    else startTimePlay()
}

function ensureMainChartTimeControls() {
    let host = document.getElementById("main-chart-time-controls")
    if (!host) {
        const actions = document.querySelector(".main-chart-head-actions")
        if (!actions) return
        host = document.createElement("div")
        host.id = "main-chart-time-controls"
        host.className = "main-chart-time-controls"
        host.hidden = true
        host.innerHTML = [
            '<button type="button" id="time-play-btn">Play</button>',
            '<label class="time-speed-label">Speed:',
            '<select id="time-speed-select">',
            '<option value="0.5x">0.5x</option>',
            '<option value="1x" selected>1x</option>',
            '<option value="2x">2x</option>',
            '<option value="4x">4x</option>',
            '</select></label>',
            '<input id="time-slider" type="range" min="0" max="10" step="1" />',
            '<span id="time-slider-label">T0</span>'
        ].join(" ")
        actions.insertBefore(host, actions.firstChild)
    }

    if (host.__vispromBound) return
    host.__vispromBound = true

    const playBtn = document.getElementById("time-play-btn")
    const slider = document.getElementById("time-slider")
    const speedSelect = document.getElementById("time-speed-select")

    if (playBtn) {
        playBtn.addEventListener("click", toggleTimePlay)
    }
    if (slider) {
        slider.addEventListener("input", function () {
            if (timeSliderSyncInProgress) return
            applyTimeIndex(Number(slider.value), "time-slider")
        })
    }
    if (speedSelect) {
        speedSelect.addEventListener("change", restartTimePlayWithNewSpeed)
    }
}

const USER_STORAGE_KEY = 'visprom_user_id_v1';
const USER_NAME_OK_KEY = 'visprom_name_ok_v1';

(function clearStoredNameIfRequested() {
    try {
        if (new URLSearchParams(window.location.search).has('resetName')) {
            localStorage.removeItem(USER_STORAGE_KEY);
            localStorage.removeItem(USER_NAME_OK_KEY);
        }
    } catch (e) {}
})();

function getStoredUserId() {
    if (typeof window.__vispromUserId === 'string' && window.__vispromUserId.trim()) {
        return window.__vispromUserId.trim();
    }
    try {
        const saved = localStorage.getItem(USER_STORAGE_KEY);
        if (saved && saved.trim()) return saved.trim();
    } catch (e) {}
    return null;
}

function sessionUserNameProvided() {
    return typeof window.vispromUserName === 'string' && window.vispromUserName.trim().length > 0;
}

function hasConfirmedUserName() {
    if (window.__vispromUserInitBoot && sessionUserNameProvided()) return true;
    if (sessionUserNameProvided()) return true;
    try {
        return localStorage.getItem(USER_NAME_OK_KEY) === '1';
    } catch (e) {
        return false;
    }
}

function needsUserNamePrompt() {
    if (window.__vispromUserInitBoot) return false;
    if (sessionUserNameProvided()) return false;
    return !hasConfirmedUserName();
}

function hideNameModal() {
    const modal = document.getElementById('vispromNameModal');
    if (!modal) return;
    modal.classList.remove('visprom-name-visible');
    modal.style.display = 'none';
}

function showNameModalInPage() {
    if (window.__vispromUserInitBoot || sessionUserNameProvided()) return false;
    const modal = document.getElementById('vispromNameModal');
    const input = document.getElementById('vispromNameInput');
    const btn = document.getElementById('vispromNameContinue');
    if (!modal || !input || !btn) return false;

    if (typeof window.vispromSetLoading === 'function') {
        window.vispromSetLoading(false);
    }
    const loader = document.getElementById('appLoadingScreen');
    if (loader) loader.style.display = 'none';

    modal.classList.add('visprom-name-visible');
    modal.style.display = 'flex';
    modal.style.zIndex = '2147483647';

    const saved = getStoredUserId();
    input.value = (saved && !/^anonymous_\d+$/.test(saved) && saved !== 'anonymous') ? saved : '';

    function submit() {
        let name = input.value.trim();
        const confirmed = !!name;
        if (!name) {
            name = 'anonymous_' + Date.now();
        }
        try {
            localStorage.setItem(USER_STORAGE_KEY, name);
            if (confirmed) {
                localStorage.setItem(USER_NAME_OK_KEY, '1');
            } else {
                localStorage.removeItem(USER_NAME_OK_KEY);
            }
        } catch (e) {}
        window.__vispromUserId = name;
        userId = name;
        hideNameModal();
    }

    btn.onclick = submit;
    input.onkeydown = function (e) {
        if (e.key === 'Enter') submit();
    };
    input.focus();
    return true;
}

let namePromptScheduled = false;

function scheduleNamePromptAfterReveal() {
    // Name is collected in userInit.js before startup (Feature 1).
    if (window.__vispromUserInitBoot) return;
    if (typeof window.vispromUserName === 'string' && window.vispromUserName.trim()) return;
    if (namePromptScheduled) return;
    namePromptScheduled = true;

    function attemptPrompt(triesLeft) {
        if (!needsUserNamePrompt()) return;
        promptUserIdIfNeeded();
        if (needsUserNamePrompt() && triesLeft > 0) {
            setTimeout(function () { attemptPrompt(triesLeft - 1); }, 250);
        }
    }

    setTimeout(function () { attemptPrompt(4); }, 50);
}

function promptUserIdIfNeeded() {
    if (window.__vispromUserInitBoot || sessionUserNameProvided()) return;
    if (!needsUserNamePrompt()) return;

    if (showNameModalInPage()) return;

    const overlay = document.createElement('div');
    overlay.id = 'vispromNameModalFallback';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Enter your name');
    overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483647',
        'background:rgba(0,0,0,0.45)', 'display:flex',
        'align-items:center', 'justify-content:center'
    ].join(';');

    const box = document.createElement('div');
    box.style.cssText = [
        'background:#fff', 'padding:24px 28px', 'border-radius:10px',
        'min-width:320px', 'max-width:90vw',
        'box-shadow:0 8px 32px rgba(0,0,0,0.18)', 'font-family:Arial,Helvetica,sans-serif'
    ].join(';');

    const title = document.createElement('p');
    title.textContent = 'Please enter your name';
    title.style.cssText = 'margin:0 0 14px;font-size:15px;font-weight:600;color:#111';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Your name';
    input.autocomplete = 'name';
    input.style.cssText = [
        'display:block', 'width:100%', 'box-sizing:border-box',
        'padding:10px 12px', 'font-size:14px', 'margin-bottom:14px',
        'border:1px solid #767676', 'border-radius:6px'
    ].join(';');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Continue';
    btn.style.cssText = [
        'padding:8px 18px', 'font-size:14px', 'cursor:pointer',
        'border:1px solid #3a80c2', 'border-radius:6px',
        'background:#d4f0ff', 'color:#202020'
    ].join(';');

    function submit() {
        let name = input.value.trim();
        const confirmed = !!name;
        if (!name) {
            name = 'anonymous_' + Date.now();
        }
        try {
            localStorage.setItem(USER_STORAGE_KEY, name);
            if (confirmed) {
                localStorage.setItem(USER_NAME_OK_KEY, '1');
            } else {
                localStorage.removeItem(USER_NAME_OK_KEY);
            }
        } catch (e) {}
        window.__vispromUserId = name;
        userId = name;
        overlay.remove();
    }

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submit();
    });

    box.appendChild(title);
    box.appendChild(input);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    input.focus();
}

const LOADER_BUFFER_MS = 150;
const LOADER_MAX_MS = 90000;
let revealDone = false;
let revealTimerId = null;

function runWhenIdle(fn, timeoutMs) {
    const run = function () {
        try { fn() } catch (e) { console.error('[Startup] deferred task failed:', e) }
    }
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: timeoutMs || 2500 })
    } else {
        setTimeout(run, 0)
    }
}

function showAppLoader() {
    revealDone = false;
    if (revealTimerId) {
        clearTimeout(revealTimerId);
        revealTimerId = null;
    }
    if (typeof window.vispromSetLoading === 'function') {
        window.vispromSetLoading(true);
    }
}

function revealApp() {
    if (revealDone) {
        scheduleNamePromptAfterReveal();
        return;
    }
    revealDone = true;
    if (revealTimerId) {
        clearTimeout(revealTimerId);
        revealTimerId = null;
    }
    if (typeof window.vispromSetLoading === 'function') {
        window.vispromSetLoading(false);
    }
    const screen = document.getElementById('appLoadingScreen');
    if (screen) screen.setAttribute('aria-busy', 'false');
    scheduleNamePromptAfterReveal();
    scheduleMainChartLayoutSync();
}

function scheduleRevealAfterBuffer() {
    if (revealDone) {
        scheduleNamePromptAfterReveal();
        return;
    }
    revealTimerId = setTimeout(function () {
        revealApp();
    }, LOADER_BUFFER_MS);
}

function buildSplomDeferred() {
    try {
        if (datum && splom) {
            rebuildSplomWithDimensions(getSplomDimensionsForDisplay())
            splomInitialLayoutDone = true
            ensureSplomResizeObserver()
        }
        if (mainChartMvX && mainChartMvY && datum) {
            updateMainViewClickCount(mainChartMvX, mainChartMvY);
        }
    } catch (e) {
        console.error('SPLOM deferred build failed:', e);
    }
}

function finalizeAppReady() {
    // Reveal the app immediately (main chart is already scheduled to render).
    // The SPLOM is the heaviest part, so build it AFTER the first paint: the
    // visible cells render first via the lazy observer, and the rest stream in
    // as you scroll. This keeps initial load snappy.
    revealApp();
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            buildSplomDeferred();
        });
    });
}

function runDeferredStartupWork() {
    requestAnimationFrame(function () {
        try {
            refreshTableView()
            updateCountTable(datum, countTable)
        } catch (e) {
            console.error('[Startup] table init failed:', e)
        }
        finalizeAppReady()
    })
    runWhenIdle(function () {
        syncDatasetSnapshotForComparison()
    }, 3000)
}

function initAppWithData(rawData) {
    const endPerf = perfStart("initAppWithData")
    let initStage = "start"
    try {
    initStage = "extend_data"
    selectionMemoryByContext = {}
    const data = rawData.map((d,i) => extendData(d,i));
    
    datum = data;
    rowById = new Map(datum.map(function (row) { return [row.__rowId, row] }))
    bumpSoucheRowsIndexVersion()
    ensureAllColoredSelectionLayersMeta()
    invalidateSelectionMembershipIndex()

    for (const d of datum) {
        selections[0].content.add(d) 
    }
    
    initStage = "classify_columns"
    const classified = applyDatasetColumnClassification(datum)
    selectedColumns = []
    selectedYeastTypes = []
    yeastMode = "overlay"
    soucheTriangleCompareActive = false
    triangleLowerYeast = null
    triangleUpperYeast = null
    mainChartYeastView = "overlay"
    selectionTarget = "active"
    availableYeastTypes = []
    currentSoucheIndex = 0
    currentSouche = null
    splomCellClickState = {}
    currentDimensionFamilies = {}
    expandedFamilies = new Set()
    customDimensionExpressions = []
    comparisonDatasetRows = null
    sharedDimensions = []
    unmatchedPrimaryDimensions = []
    unmatchedComparisonDimensions = []
    splomMode = "single"
    mainChartViewMode = "overlay"
    activeDatasetSource = "primary"
    comparisonDatasetVersion = 0
    primaryDatasetLabel = "Dataset 1"
    comparisonDatasetLabel = "Dataset 2"
    for (const d of dimensions) {
        dimVisitcount[d] = 0
    }

    initStage = "build_custom_panel"
    let custDim = c.select(".customInput")
    custDim_input(custDim)

    if (setDatasetLoadStatus) {
        setDatasetLoadStatus(formatDatasetLoadSummary(classified).replace(/\n/g, " · "), false)
    }
    refreshAvailableYeastTypes()
    if (yeastColumn && currentSouche && !selectedYeastTypes.length && !soucheTriangleCompareActive) {
        selectedYeastTypes = [currentSouche]
        yeastMode = "single"
    }
    initStage = "render_yeast_panel"
    if (renderYeastFilterPanel) {
        renderYeastFilterPanel()
    }
    setupSoucheComparisonMessageListener()
    ensureMainChartYeastViewControl()

    initStage = "init_splom"
    splom = c.select(".splom")
    ensureSplomCellNavHandlers()
    sploom.setSplomCellDblClickHandler(function (cellEl) {
        triggerSplomCellDblClick(cellEl, { via: "splom-cell-create" })
    })
    sploom.setSplomSelectionCheckProvider(isPointInVisibleSplomSelection)
    sploom.setSplomVisitCountKeyProvider(getSplomVisitCountKey)
    sploom.setSplomFamilyToggleHandler(toggleFamilyExpanded)
    chartRender.setSelectionCheckProvider(isPointInVisibleSplomSelection)
    chartRender.setDisplayColorProvider(getPointDisplayColor)
    const dsId = (typeof datasetStore.getSelectedDatasetId === "function") ? datasetStore.getSelectedDatasetId() : "default"
    sploom.bumpSplomDatasetVersion(dsId)
    sploom.invalidateSplomCaches("dataset load")
    syncSplomCacheRowScope()
    splomInitialLayoutDone = false

    initStage = "init_main_chart"
    let mainview = c.select(".mainView").append("div").attr("id", "mainview")
    mainviewSvg = mainview.append("svg").attr("class", "bigView")
    scaterplot.init(mainviewSvg)

    const initDim = getDefaultMainChartDimension()
    const initMvX = initDim
    const initMvY = dimensions.length > 1 ? dimensions[1] : initDim
    mainChartMvX = initMvX
    mainChartMvY = initMvY
    ensureValidMainChartDimensions()
    
    initStage = "init_remaining_ui"
    history = c.select(".viewHistory")
    .append("div")
    .attr("height", 170)
    .attr("width", "100 %")
    favorites = c.select(".viewHistory").append("div")

    let saveBActions = c.select(".saveB-log-icons")
    if (saveBActions.empty()) saveBActions = c.select(".saveB")

    let resetProvbutton = saveBActions.append("img").attr("class","buttonIm")
    .attr("src","static/imgs/resetprov.svg")
    .attr("title", "Reset provenance heatmap and range bars")
    .attr("height", 50) 
    .attr("width", 150)
    .on("click", function(d, i) {
        resetProv()
     }); 
    
    let savebutton = saveBActions.append("img").attr("class","buttonIm")
    .attr("src","static/imgs/save_log.svg")
    .attr("height", 50) 
    .attr("width", 150)
    .on("click", function(d, i) {
        downloadProvenanceLog()
     }); 

     let favoritebutton = saveBActions.append("img").attr("class","buttonIm")
     .attr("src","static/imgs/favorite.svg")
     .attr("height", 50)
     .attr("width", 50)
     .on("click", function(d, i) {
        savedFavs.push({ "xDim": mainviewSvg.attr("xDim") ,"yDim": mainviewSvg.attr("yDim"), "data": cloneDeep(datum ) })
        savedFavsEntries.push(saveState("favorite",""))
        updateFavorites(savedFavs)
        pushViewHistorySnapshot()
        setTimeout( ()=>{
            updateViewHistory(viewHistory)
            },0 )
        let log =  {nameAction :"favorite_add", callparam: {}, data : datum, timestamp : Date.now()}
            let svState = saveState("favorite_add","")
            savedEntries.push(svState)
            favIndex.push(savedEntries.length-1)
            if(onlineLogActive){
                firebase.save(svState, globalLoss, userId)
            }
      });

    scaterplot.setRenderModeProvider(function () { return mainChartMode })
    scaterplot.setSelectionCheckProvider(isPointInVisibleSplomSelection)
    scaterplot.setDisplayColorProvider(getPointDisplayColor)
    if (typeof scaterplot.setPointStrokeProvider === "function") {
        scaterplot.setPointStrokeProvider(getPointStrokeForChart)
    }
    chartRender.setDisplayColorProvider(getPointDisplayColor)
    scaterplot.setRenderMode(mainChartMode)
    ensureMainChartModeControl()
    ensureMainChartSettingsControls()
    ensureMainChartSoucheNavigator()
    ensureSplomViewControls()
    ensureMainChartViewControl()
    ensureMainChartTimeControls()
    setupUploadSavedLogButton()

    addbrush(mainviewSvg)
    bindMainChartDensityClick()
    const mainChartNode = mainviewSvg.node()
    if (mainChartNode) mainChartNode.__brushLayoutHook = updateMainChartBrushLayout
    ensureMainChartResizeObserver()
    scheduleMainChartLayoutSync()
    bindMainChartHoverHandlers()

    countTable = c.select(".selectionTable").append("table")
    countTable.attr('id',"countTable")
    .style("width","100%")
    .style("height","25%")
    .style("overflow","auto")
    countTable.append("thead").append("tr")
    countTable.append("tbody")

    const selectionTableRoot = c.select(".selectionTable")

    selectionTableRoot.append("button")
        .attr("type", "button")
        .attr("id", "download-selected-csv-btn")
        .attr("class", "selection-download-all-btn")
        .text("Download all selected CSV")
        .on("click", downloadAllSelectedCsv)

    selectionTableRoot.append("div")
        .attr("class", "selection-panel-section-title")
        .text("Selection layers")

    selectionTableRoot.append("div")
        .attr("id", "selection-layer-table")

    const intersectionPanel = selectionTableRoot.append("div")
        .attr("id", "intersection-export-panel")
    intersectionPanel.append("div")
        .attr("class", "panel-title")
        .text("Intersection export")
    intersectionPanel.append("div")
        .attr("class", "intersection-section-label")
        .text("Choose selections:")
    intersectionPanel.append("div")
        .attr("id", "intersection-selection-list")
    intersectionPanel.append("div")
        .attr("id", "intersection-preview")
    intersectionPanel.append("button")
        .attr("type", "button")
        .attr("id", "download-intersection-csv-btn")
        .text("Download intersection CSV")
        .property("disabled", true)
        .on("click", function () {
            downloadSelectionIntersectionCsv(selectedIntersectionLayerIds)
        })

    selectionTableRoot.append("details")
        .attr("id", "pairwise-overlap-summary")
        .append("summary")
        .text("Show non-zero pairwise overlaps")
    selectionTableRoot.select("#pairwise-overlap-summary")
        .append("div")
        .attr("id", "pairwise-overlap-list")

    ensureAllColoredSelectionLayersMeta()
    colpick = selectionTableRoot.append("div").attr('id', "colorpicker").attr('class', "popup")
    refreshSelectionExportUI({ immediate: true, full: true })

    selType_buttons = c.select(".groupOp").append('div').style("width",300).append('table').attr('id',"selType_buttons")
    .attr("width", 300)
    selectionsTypeChooser(selType_buttons);

    colorOp_buttons = c.select(".colorOp").append('table').attr('id',"colorOp_buttons")
    colorOp(colorOp_buttons);

    grpAct_buttons  = c.select(".groupOp").append('div').style("width",160).append('table').attr('id',"grpAct_buttons")
    .attr("width", 160)
    GroupActionChooser(grpAct_buttons);
   
    c.select(".groupOp").style('display','grid')
    c.select(".groupOp").style('grid-template-columns',"repeat(2, minmax(0, 1fr))" )

    let tableView = c.select(".tableView").append("div")
        .style("resize","horizontal")
        .style("width","100%")
        .style("height","100%")
        .style("overflow","auto");

    tableView_table = tableView.append("table").attr('id','tableView_table')
    tableView_table.append("thead").append("tr")
    tableView_table.append("tbody")

    setupTableDimCheckboxDelegation()
    initViewHistory(viewHistory)

    bindSplomPlotHandlers();
    updateTimeSliderForMainChart();

    window.addEventListener("resize", onMainChartResize)
    window.addEventListener("resize", onSplomPanelResize)

    current_color.push(selections[1])
    if (selList && !selList.empty()) {
        selList.select("#" + current_color[0].cname).classed("active2", true)
    }

    userId = (typeof window.vispromUserName === 'string' && window.vispromUserName.trim())
        ? window.vispromUserName.trim()
        : ('anonymous_' + Date.now());
    hideNameModal();
    revealApp();
    initStage = "deferred_startup"
    runDeferredStartupWork();
    } catch (err) {
        if (err && !err.__initStage) err.__initStage = initStage
        throw err
    } finally {
        endPerf()
    }
}

function handleLoadError(err, message) {
    console.error("[VisProm load error]", {
        message: err && err.message ? err.message : String(err),
        stage: err && err.__initStage ? err.__initStage : "unknown",
        stack: err && err.stack ? err.stack : null
    });
    revealApp();
    const detail = err && err.message ? ("Details: " + err.message) : ""
    const stage = err && err.__initStage ? ("Stage: " + err.__initStage) : ""
    alert([message, detail, stage].filter(Boolean).join("\n"));
}

setTimeout(function () {
    if (!revealDone) {
        console.warn('VisProm: loader max time reached, revealing app');
        revealApp();
        onMainChartResize();
    }
}, LOADER_MAX_MS);

function onSplomViewClick() {
    updateMainViewClickCount(mainChartMvX, mainChartMvY)
    updateCountTable(datum, countTable)
}

function updateMainViewClickCount(xDim, yDim) {
    if (!mainviewSvg) return

    xDim = xDim || mainviewSvg.attr("xDim")
    yDim = yDim || mainviewSvg.attr("yDim")
    if (!xDim || !yDim) return

    const count = viewVisitcount[getMainChartVisitCountKey(xDim, yDim)] || 0
    const w = parseInt(mainviewSvg.attr("width")) || getMainPlotSize().width

    mainviewSvg.select(".clickCountLabel")
        .attr("x", w - 14)
        .attr("y", 22)
        .attr("text-anchor", "end")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .style("fill", "#374151")
        .text("Click count: " + count)
}

function extendData (d, i){
    d.color = new Set()
    d.pointSize = 0.5
    d.id = i
    d.__rowId = i
    d.visibility = true
    
    return d
}


let appBootStarted = false;

function bootVispromDataLoad() {
    console.log("[Startup] loading dataset");
    showAppLoader();
    datasetStore.initDatasetSelector(d3.select('.section-bar-dataset'));
    datasetStore.registerDatasetSwitchHandler(promptSaveLogBeforeDatasetSwitch);

    datasetStore.loadDatasetById(datasetStore.getSelectedDatasetId())
        .then(function (rawData) {
            console.log("[Startup] data length:", rawData && rawData.length);
            try {
                initAppWithData(rawData);
            } catch (initErr) {
                handleLoadError(initErr, 'Could not initialize the app. Try reloading or another dataset.');
            }
        })
        .catch(function (err) {
            handleLoadError(err, 'Could not load dataset. Try another one from the dropdown.');
        });
}

function startVispromApplication() {
    if (appBootStarted) {
        console.warn("[Startup] startVispromApplication skipped (already started)");
        return;
    }
    appBootStarted = true;
    ensureDocumentSplomDblClickHandler();
    // Clear ephemeral tab payloads only; keep saved pairs in sessionStorage for this login.
    soucheComparisonStorage.clearAllComparisonStates();
    openedSoucheComparisons = [];
    loadSoucheComparisonListsFromStorage();
    bootVispromDataLoad();
}

if (typeof window !== 'undefined') {
    window.startVispromApplication = startVispromApplication;
    window.openSoucheComparisonInNewTab = openSoucheComparisonInNewTab;
    console.log("[Comparison tab function exists]", {
        exists: typeof openSoucheComparisonInNewTab === "function"
    });
    if (!window.__vispromUserInitBoot) {
        startVispromApplication();
    }
}

var idleTimeout
function idled() { idleTimeout = null; }

function getDefaultMainChartDimension() {
    if (!dimensions || !dimensions.length) return null
    for (let i = 0; i < dimensions.length; i++) {
        if (String(dimensions[i]).toLowerCase() === "n0") return dimensions[i]
    }
    return dimensions[0]
}

function getMainChartBrushExtent(mv) {
    const size = getMainPlotSize()
    const w = parseInt(mv.attr("width"), 10) || size.width
    const h = parseInt(mv.attr("height"), 10) || size.height
    return [[0, 0], [Math.max(1, w), Math.max(1, h)]]
}

function getMainChartPointerFromEvent(event, svgNode) {
    if (!event || !svgNode) return null
    if (typeof svgNode.createSVGPoint === "function" && typeof svgNode.getScreenCTM === "function") {
        const pt = svgNode.createSVGPoint()
        pt.x = event.clientX
        pt.y = event.clientY
        const ctm = svgNode.getScreenCTM()
        if (ctm) {
            const svgPt = pt.matrixTransform(ctm.inverse())
            return [svgPt.x, svgPt.y]
        }
    }
    const rect = svgNode.getBoundingClientRect()
    return [event.clientX - rect.left, event.clientY - rect.top]
}

function isTinyBrushExtent(extent) {
    if (!extent) return true
    const w = Math.abs(extent[1][0] - extent[0][0])
    const h = Math.abs(extent[1][1] - extent[0][1])
    return w < 6 && h < 6
}

function triggerMainChartDensitySelectionAtEvent(event, mv) {
    if (mainChartMode !== "density") return false
    if (!mv || mv.empty()) return false
    if (!current_color.length || !current_color[0] || !current_color[0].visibility) return false
    if (current_selectionType === 4) return false

    const node = mv.node()
    const pt = getMainChartPointerFromEvent(event, node)
    if (!pt || pt.length < 2) return false

    if (event) {
        event.preventDefault()
        event.stopPropagation()
    }
    return applyDensityContourSelectionAtPoint(pt[0], pt[1])
}

function tryDensityContourSelectionFromBrushEnd(mv) {
    if (mainChartMode !== "density" || current_selectionType === 4) return false
    const sourceEvent = d3.event && d3.event.sourceEvent
    if (!sourceEvent || !mv || mv.empty()) return false
    return triggerMainChartDensitySelectionAtEvent(sourceEvent, mv)
}

function styleMainChartBrush(mv) {
    const brushSel = mv.select(".brush")
    if (brushSel.empty()) return
    const ext = getMainChartBrushExtent(mv)
    brushSel.selectAll(".overlay")
        .attr("x", ext[0][0])
        .attr("y", ext[0][1])
        .attr("width", Math.max(0, ext[1][0] - ext[0][0]))
        .attr("height", Math.max(0, ext[1][1] - ext[0][1]))
        .attr("fill", "rgba(255, 255, 255, 0)")
        .style("pointer-events", "all")
        .on("click.density", function () {
            triggerMainChartDensitySelectionAtEvent(d3.event, mv)
        })
    brushSel.selectAll(".selection")
        .attr("fill", "rgba(0, 0, 0, 0.2)")
        .attr("stroke", "#000000")
        .attr("stroke-width", 1.5)
        .style("display", mainChartBrushActive ? null : "none")
        .style("visibility", mainChartBrushActive ? "visible" : "hidden")
    brushSel.raise()
}

function getStoredMainChartBrush(mv) {
    const node = mv && !mv.empty() ? mv.node() : null
    return node ? node.__mainChartBrush : null
}

function setStoredMainChartBrush(mv, brush) {
    const node = mv && !mv.empty() ? mv.node() : null
    if (node) node.__mainChartBrush = brush
}

let mainChartBrushPreviewFrame = null
let mainChartSplomPreviewFrame = null
let pendingBrushPreviewMv = null
let pendingBrushPreviewExtent = null
let mainChartBrushActive = false
let mainChartBrushCommitLock = false
let mainChartBrushSuppressEnd = false
let lastDensityContourSelectAt = 0

function cancelMainChartBrushPreviewFrames() {
    if (mainChartBrushPreviewFrame) {
        cancelAnimationFrame(mainChartBrushPreviewFrame)
        mainChartBrushPreviewFrame = null
    }
    if (mainChartSplomPreviewFrame) {
        cancelAnimationFrame(mainChartSplomPreviewFrame)
        mainChartSplomPreviewFrame = null
    }
    pendingBrushPreviewMv = null
    pendingBrushPreviewExtent = null
}

function clearMainChartBrushSelectionBox(mv) {
    if (!mv || mv.empty()) return
    const brush = getStoredMainChartBrush(mv)
    if (!brush) return
    mainChartBrushSuppressEnd = true
    try {
        mv.call(brush.move, null)
    } finally {
        mainChartBrushSuppressEnd = false
    }
}

function clearMainChartBrushPreviewState(mv) {
    cancelMainChartBrushPreviewFrames()
    if (!mv || mv.empty()) return false
    const node = mv.node()
    const hadPreview = !!(node && node.__hasBrushPreview)
    if (node) {
        node.__brushPreviewIds = null
        node.__hasBrushPreview = false
    }
    return hadPreview
}

function resetMainChartBrushPreviewVisuals(mv) {
    const hadPreview = clearMainChartBrushPreviewState(mv)
    if (hadPreview && mv && !mv.empty()) {
        scaterplot.updatePointsAfterSelection(getMainChartPrimaryData(), mv)
    }
}

function clearMainChartBrushPreview(mv) {
    const hadPreview = clearMainChartBrushPreviewState(mv)
    if (hadPreview && mv && !mv.empty()) {
        scaterplot.updatePointsAfterSelection(getMainChartPrimaryData(), mv)
        refreshSplomAfterSelection(null, true)
    }
}

function stripMainChartBrushPreviewStyles(mv) {
    if (!mv || mv.empty()) return
    mv.selectAll(".plot-points circle, .plot-points-bg circle")
        .style("opacity", null)
        .style("fill", null)
}

function collectBrushPreviewIds(mv, extent) {
    const previewIds = new Set()
    if (!mv || mv.empty() || !extent) return previewIds
    const x = mv.scalex
    const y = mv.scaley
    const xcol = mv.xcol
    const ycol = mv.ycol
    if (!x || !y || !xcol || !ycol) return previewIds

    const circles = mv.selectAll(".plot-points circle, .plot-points-bg circle")
    if (!circles.empty()) {
        circles.each(function (d) {
            if (!d || d.visibility === false) return
            const cx = x(d[xcol])
            const cy = y(d[ycol])
            if (!Number.isFinite(cx) || !Number.isFinite(cy)) return
            if (isBrushed(extent, cx, cy, null, d)) {
                if (d.id != null) previewIds.add(d.id)
                if (d.__rowId != null) previewIds.add(d.__rowId)
            }
        })
        return previewIds
    }

    const brushData = getMainChartSelectionDataset()
    for (let i = 0; i < brushData.length; i++) {
        const d = brushData[i]
        if (!d || !d.visibility) continue
        const cx = x(d[xcol])
        const cy = y(d[ycol])
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue
        if (isBrushed(extent, cx, cy, null, d)) {
            if (d.id != null) previewIds.add(d.id)
            if (d.__rowId != null) previewIds.add(d.__rowId)
        }
    }
    return previewIds
}

function releaseBrushHighlightImmediately(mv, extent) {
    if (!mv || mv.empty()) return
    mainChartBrushActive = false

    const node = mv.node()
    const cachedIds = node && node.__brushPreviewIds
    const previewIds = (cachedIds && cachedIds.size)
        ? cachedIds
        : (extent ? collectBrushPreviewIds(mv, extent) : null)

    clearMainChartBrushPreviewState(mv)

    const activeLayer = getActiveSelectionLayer()
    const previewColor = activeLayer && activeLayer.color && activeLayer.color.string
        ? activeLayer.color.string
        : null

    const inPreview = function (d) {
        if (!previewIds || !d) return false
        return previewIds.has(d.id) || (d.__rowId != null && previewIds.has(d.__rowId))
    }

    mv.selectAll(".plot-points circle, .plot-points-bg circle")
        .style("opacity", null)
        .style("fill", function (d) {
            if (!d) return null
            if (previewColor && inPreview(d)) return previewColor
            const base = getPointDisplayColor(d)
            return base && base.string ? base.string : null
        })
        .attr("stroke", function (d) {
            const s = getPointStrokeForChart(d)
            return s ? s.stroke : null
        })
        .attr("stroke-width", function (d) {
            const s = getPointStrokeForChart(d)
            return s ? s.strokeWidth : null
        })

    styleMainChartBrush(mv)
    clearMainChartBrushSelectionBox(mv)
    if (node) node.__lastBrushExtent = null
    styleMainChartBrush(mv)
}

function previewMainChartBrushImmediate(mv, extent) {
    if (!mv || mv.empty() || !extent || !datum || current_selectionType === 4) return
    const x = mv.scalex
    const y = mv.scaley
    const xcol = mv.xcol
    const ycol = mv.ycol
    if (!x || !y || !xcol || !ycol) return

    const previewIds = collectBrushPreviewIds(mv, extent)
    const node = mv.node()
    if (node) {
        node.__brushPreviewIds = previewIds
        node.__hasBrushPreview = true
        node.__lastBrushExtent = extent
    }

    const activeLayer = getActiveSelectionLayer()
    const previewColor = activeLayer && activeLayer.color && activeLayer.color.string
        ? activeLayer.color.string
        : VIS_CONFIG.point.brushPreviewColor

    const inPreview = function (d) {
        return d && (previewIds.has(d.id) || (d.__rowId != null && previewIds.has(d.__rowId)))
    }
    const outsideOpacity = getBrushOutsideOpacity()
    mv.selectAll(".plot-points circle, .plot-points-bg circle")
        .style("opacity", function (d) { return inPreview(d) ? VIS_CONFIG.point.brushPreviewOpacity : outsideOpacity })
        .style("fill", function (d) {
            if (!d) return null
            if (inPreview(d)) return previewColor
            const base = getPointDisplayColor(d)
            return base && base.string ? base.string : null
        })
}

function scheduleMainChartBrushPreview(mv, extent) {
    pendingBrushPreviewMv = mv
    pendingBrushPreviewExtent = extent
    if (mainChartBrushPreviewFrame) return
    mainChartBrushPreviewFrame = requestAnimationFrame(function () {
        mainChartBrushPreviewFrame = null
        const previewMv = pendingBrushPreviewMv
        const previewExtent = pendingBrushPreviewExtent
        pendingBrushPreviewMv = null
        pendingBrushPreviewExtent = null
        if (!previewMv || !previewExtent) return
        timeBlockIfSlow("previewMainChartBrush", function () {
            previewMainChartBrushImmediate(previewMv, previewExtent)
        }, 5)
    })
}

function previewMainChartBrush(mv, extent) {
    scheduleMainChartBrushPreview(mv, extent)
}

function commitMainChartBrushInteraction(mv, extent) {
    return timeBlock("commitMainChartBrushInteraction", function () {
    if (!mv || mv.empty() || mainChartBrushCommitLock) return
    mainChartBrushCommitLock = true

    releaseBrushHighlightImmediately(mv, extent)

    requestAnimationFrame(function () {
        if (!mv || mv.empty()) {
            mainChartBrushCommitLock = false
            return
        }

        if (!current_color.length || !current_color[0] || !current_color[0].visibility) {
            scaterplot.updatePointsAfterSelection(getMainChartPrimaryData(), mv)
            mainChartBrushCommitLock = false
            return
        }

        if (current_selectionType == 4) {
            const xDim = mainviewSvg.attr("xDim")
            const yDim = mainviewSvg.attr("yDim")
            if (!extent) {
                updateMainChart(xDim, yDim, null)
            } else {
                const x0 = extent[0][0], x1 = extent[1][0], y0 = extent[0][1], y1 = extent[1][1]
                updateMainChart(xDim, yDim, { xrange: [x0, x1], yrange: [y0, y1] })
            }
        } else if (extent && current_color.length >= 1) {
            applyBrushSelectionFromExtent(mv, extent)
        }

        setTimeout(function () {
            if (current_color.length >= 1 && extent) {
                finalizeActiveSelectionChange("brush_selection", {
                    selectionType: current_selectionType,
                    color: getValuesOfKey("cname", current_color)
                })
            } else {
                requestSelectionRestyle()
            }
            mainChartBrushCommitLock = false
        }, 0)
    })
    })
}

function onMainChartBrushEnd(mv) {
    return timeBlock("onMainChartBrushEnd", function () {
        if (mainChartBrushSuppressEnd) return
        const extent = d3.event && d3.event.selection
        commitMainChartBrushInteraction(mv, extent)
    })
}

function reinstallMainChartBrush(mv) {
    if (!mv || mv.empty()) return
    const brush = d3.brush()
    setStoredMainChartBrush(mv, brush)
    mv.selectAll(".brush").remove()
    mv.call(
        brush
            .extent(getMainChartBrushExtent(mv))
            .on("start", function () {
                mainChartBrushActive = true
                mainChartBrushCommitLock = false
                cancelMainChartBrushPreviewFrames()
                if (mv.node()) mv.node().__lastBrushExtent = null
                styleMainChartBrush(mv)
            })
            .on("brush", function () {
                if (mainChartBrushSuppressEnd) return
                if (current_selectionType === 4) return
                if (!current_color.length || !current_color[0].visibility) return
                const extent = d3.event && d3.event.selection
                if (mv.node()) mv.node().__lastBrushExtent = extent || null
                if (extent) scheduleMainChartBrushPreview(mv, extent)
                else stripMainChartBrushPreviewStyles(mv)
            })
            .on("end", function () {
                if (mainChartBrushSuppressEnd) return
                const extent = d3.event && d3.event.selection
                if (mainChartMode === "density" && isTinyBrushExtent(extent)) {
                    if (tryDensityContourSelectionFromBrushEnd(mv)) {
                        releaseBrushHighlightImmediately(mv, extent)
                        requestAnimationFrame(function () {
                            requestSelectionRestyle()
                        })
                        return
                    }
                }
                onMainChartBrushEnd(mv)
            })
    )
    styleMainChartBrush(mv)
}

function updateMainChartBrushLayout(mv) {
    if (!mv || mv.empty()) return
    const brush = getStoredMainChartBrush(mv)
    if (!brush || mv.select(".brush").empty()) {
        reinstallMainChartBrush(mv)
        return
    }
    brush.extent(getMainChartBrushExtent(mv))
    styleMainChartBrush(mv)
}

function addbrush(mv) {
    reinstallMainChartBrush(mv)
}

function initViewHistory(viewHistory){
    //console.lag(viewHistory)

    history.append("div").text("History")
   
    historySvg3 = history.append("svg").attr("class", "historyView");
    scaterplot.init(historySvg3)
    
    historySvg2 = history.append("svg").attr("class", "historyView");
    scaterplot.init(historySvg2)

    historySvg = history.append("svg").attr("class", "historyView");
    scaterplot.init(historySvg)

    scaterplot.chooseDimsSmall(80,80,[],"","", historySvg3);
    scaterplot.chooseDimsSmall(80,80,[],"","", historySvg2);
    scaterplot.chooseDimsSmall(80,80,[],"","", historySvg);

}


function pushViewHistorySnapshot(xDim, yDim, dataSnapshot) {
    if (!mainviewSvg) return
    const x = xDim || mainviewSvg.attr("xDim")
    const y = yDim || mainviewSvg.attr("yDim")
    if (!x || !y) return
    const snapData = dataSnapshot || datum
    viewHistory.push({
        xDim: x,
        yDim: y,
        data: cloneDeep(snapData),
        state: saveState("history_snapshot", "")
    })
}

function loadHistoryEntryByOffset(offsetFromEnd) {
    const idx = viewHistory.length - offsetFromEnd
    if (idx < 0 || idx >= viewHistory.length) return
    const entry = viewHistory[idx]
    if (!entry) return
    if (entry.state) {
        loadState(entry.state, {
            preserveFavorites: true,
            historyDims: { xDim: entry.xDim, yDim: entry.yDim }
        })
        return
    }
    if (entry.xDim && entry.yDim) {
        activateSplomPair(entry.xDim, entry.yDim, activeDatasetSource, { forceSplomFit: isSplomTriangleCompareActive() })
        scaterplot.updatePointsAfterSelection(getMainChartPrimaryData(), mainviewSvg)
        refreshSplomAfterSelection(null, true)
        return
    }
    const fallback = savedEntries[savedEntries.length - offsetFromEnd]
    if (fallback) {
        loadState(fallback, { preserveFavorites: true })
    }
}

function updateViewHistory(viewHistory){
    // console.log("AFTER CHECK")
    // console.log(viewHistory) 
    // console.log(savedEntries) 
    // console.log("#######################")

    if(viewHistory.length>2){
        scaterplot.chooseDimsSmall(80,80,viewHistory[viewHistory.length-3].data,viewHistory[viewHistory.length-3].xDim,viewHistory[viewHistory.length-3].yDim, historySvg3);
        historySvg3.style("cursor", "pointer")
        historySvg3.on("click", function() {
            loadHistoryEntryByOffset(3)
        });
    }
    if(viewHistory.length>1){
        scaterplot.chooseDimsSmall(80,80,viewHistory[viewHistory.length-2].data,viewHistory[viewHistory.length-2].xDim,viewHistory[viewHistory.length-2].yDim, historySvg2);
        historySvg2.style("cursor", "pointer")
        historySvg2.on("click", function() {
            loadHistoryEntryByOffset(2)
        }); 
    }
    if(viewHistory.length>0){
        scaterplot.chooseDimsSmall(80,80,viewHistory[viewHistory.length-1].data,viewHistory[viewHistory.length-1].xDim,viewHistory[viewHistory.length-1].yDim, historySvg);
        historySvg.style("cursor", "pointer")
        historySvg.on("click", function() {
            loadHistoryEntryByOffset(1)
        });
    };
        
    

}

function updateFavorites(savedFavs){
    //console.lag(viewHistory)

    favorites.html("")
    favorites.append("div")
    favorites.append("div").text("Favorites")

    if(savedFavs.length>4){
        let favSvg3 = favorites.append("svg").attr("class", "favorites");
        scaterplot.init(favSvg3)
        scaterplot.chooseDimsSmall(80,80,savedFavs[savedFavs.length-5].data,savedFavs[savedFavs.length-5].xDim,savedFavs[savedFavs.length-5].yDim, favSvg3);

        favSvg3.on("click", function(d, i) {
            loadState(savedFavsEntries[savedFavsEntries.length-5], { preserveFavorites: true })

            //LOGGING HISTORY
            //DONE
            pushViewHistorySnapshot()
            setTimeout( ()=>{
                updateViewHistory(viewHistory)
                },0 )

            let log =  {nameAction :"load_favorite_state", callparam: {xDim: mainviewSvg.attr("xDim") , yDim: mainviewSvg.attr("yDim")}, data : datum, timestamp : Date.now()} 
            let svState = saveState("load_favorite_state","")
            savedEntries.push(svState)
            if(onlineLogActive){
                firebase.save(svState, globalLoss, userId)
            }
            
            finalLog.push( JSON.stringify(log,Set_toJSON) ) 
            cache = []     
            ///////////


        });
    }

    if(savedFavs.length>3){
        let favSvg3 = favorites.append("svg").attr("class", "favorites");
        scaterplot.init(favSvg3)
        scaterplot.chooseDimsSmall(80,80,savedFavs[savedFavs.length-4].data,savedFavs[savedFavs.length-4].xDim,savedFavs[savedFavs.length-4].yDim, favSvg3);

        favSvg3.on("click", function(d, i) {
            loadState(savedFavsEntries[savedFavsEntries.length-4], { preserveFavorites: true })

            //LOGGING HISTORY
            //DONE
            pushViewHistorySnapshot()
            setTimeout( ()=>{
                updateViewHistory(viewHistory)
                },0 )

            let log =  {nameAction :"load_favorite_state", callparam: {xDim: mainviewSvg.attr("xDim") , yDim: mainviewSvg.attr("yDim")}, data : datum, timestamp : Date.now()} 
            let svState = saveState("load_favorite_state","")
            savedEntries.push(svState)
            if(onlineLogActive){
                firebase.save(svState, globalLoss, userId)
            }
            
            finalLog.push( JSON.stringify(log,Set_toJSON) ) 
            cache = []     
            ///////////


        });
    }

    if(savedFavs.length>2){
        let favSvg3 = favorites.append("svg").attr("class", "favorites");
        scaterplot.init(favSvg3)
        scaterplot.chooseDimsSmall(80,80,savedFavs[savedFavs.length-3].data,savedFavs[savedFavs.length-3].xDim,savedFavs[savedFavs.length-3].yDim, favSvg3);

        favSvg3.on("click", function(d, i) {
            loadState(savedFavsEntries[savedFavsEntries.length-3], { preserveFavorites: true })

            //LOGGING HISTORY
            //DONE
            pushViewHistorySnapshot()
            setTimeout( ()=>{
                updateViewHistory(viewHistory)
                },0 )

            let log =  {nameAction :"load_favorite_state", callparam: {xDim: mainviewSvg.attr("xDim") , yDim: mainviewSvg.attr("yDim")}, data : datum, timestamp : Date.now()} 
            let svState = saveState("load_favorite_state","")
            savedEntries.push(svState)
            if(onlineLogActive){
                firebase.save(svState, globalLoss, userId)
            }
            
            finalLog.push( JSON.stringify(log,Set_toJSON) ) 
            cache = []     
            ///////////


        });
    }
    if(savedFavs.length>1){
        let favSvg2 = favorites.append("svg").attr("class", "favorites");
        scaterplot.init(favSvg2)
        scaterplot.chooseDimsSmall(80,80,savedFavs[savedFavs.length-2].data,savedFavs[savedFavs.length-2].xDim,savedFavs[savedFavs.length-2].yDim, favSvg2);

        favSvg2.on("click", function(d, i) {
            loadState(savedFavsEntries[savedFavsEntries.length-2], { preserveFavorites: true })

             //LOGGING HISTORY
            //DONE
            pushViewHistorySnapshot()
            setTimeout( ()=>{
                updateViewHistory(viewHistory)
                },0 )

            let log =  {nameAction :"load_favorite_state", callparam: {xDim: mainviewSvg.attr("xDim") , yDim: mainviewSvg.attr("yDim")}, data : datum, timestamp : Date.now()} 
            let svState = saveState("load_favorite_state","")
            savedEntries.push(svState)
            if(onlineLogActive){
                firebase.save(svState, globalLoss, userId)
            }
            
            finalLog.push( JSON.stringify(log,Set_toJSON) ) 
            cache = []     
            ///////////

        });
    }
    if(savedFavs.length>0){
        let favSvg = favorites.append("svg").attr("class", "favorites");
        scaterplot.init(favSvg)
        scaterplot.chooseDimsSmall(80,80,savedFavs[savedFavs.length-1].data,savedFavs[savedFavs.length-1].xDim,savedFavs[savedFavs.length-1].yDim, favSvg);

        favSvg.on("click", function(d, i) {
            loadState(savedFavsEntries[savedFavsEntries.length-1], { preserveFavorites: true })

             //LOGGING HISTORY
            //DONE
            pushViewHistorySnapshot()
            setTimeout( ()=>{
                updateViewHistory(viewHistory)
                },0 )

            let log =  {nameAction :"load_favorite_state", callparam: {xDim: mainviewSvg.attr("xDim") , yDim: mainviewSvg.attr("yDim")}, data : datum, timestamp : Date.now()} 
            let svState = saveState("load_favorite_state","")
            savedEntries.push(svState)
            if(onlineLogActive){
                firebase.save(svState, globalLoss, userId)
            }
            
            finalLog.push( JSON.stringify(log,Set_toJSON) ) 
            cache = []     
            ///////////


        });
    };
        
}




function applySelectionMembership(isPointSelected) {
    return timeBlock("applySelectionMembership", function () {
        const selectionData = getMainChartSelectionDataset()
        if (!selectionData || !current_color.length || !current_color[0] || !current_color[0].visibility) return
        if (current_selectionType === 4) return

        const activeLayer = current_color[0]

        for (let i = 0; i < selectionData.length; i++) {
            const d = selectionData[i]
            if (!d.visibility) continue
            const inBrush = isPointSelected(d)

            if (current_selectionType === 1) {
                if (inBrush) {
                    addPointToSelectionLayer(activeLayer, d)
                } else if (activeLayer.content.has(d)) {
                    removePointFromSelectionLayer(activeLayer, d)
                }
            } else if (current_selectionType === 2) {
                if (inBrush) {
                    addPointToSelectionLayer(activeLayer, d)
                }
            } else if (current_selectionType === 3) {
                if (inBrush && activeLayer.content.has(d)) {
                    removePointFromSelectionLayer(activeLayer, d)
                }
            }
        }
    })
}

function finalizeActiveSelectionChange(logActionName, callparam) {
    const endPerf = perfStart("finalizeActiveSelectionChange")
    try {
    if (!mainviewSvg || !current_color.length || current_color.length !== 1) return

    current_color[0].originOp = null
    current_color[0].originCol = []

    const log = {
        nameAction: logActionName,
        callparam: callparam || {},
        data: datum,
        timestamp: Date.now()
    }

    requestSelectionRestyle()
    rebuildColoredSelectionContentFromSoucheKeys()

    setTimeout(function () {
        scheduleSelectionExportOverlapRefresh()
        refreshTableView()

        pushViewHistorySnapshot()
        updateViewHistory(viewHistory)

        const svState = saveState(logActionName, "")
        savedEntries.push(svState)
        if (onlineLogActive) {
            firebase.save(svState, globalLoss, userId)
        }
        finalLog.push(JSON.stringify(log, Set_toJSON))
        cache = []
    }, 0)
    } finally {
        endPerf()
    }
}

function applyDensityContourSelectionAtPoint(px, py) {
    if (!mainviewSvg || mainChartMode !== "density") return false
    if (!datum || !current_color.length || !current_color[0] || !current_color[0].visibility) return false
    if (current_selectionType === 4) return false

    const now = Date.now()
    if (now - lastDensityContourSelectAt < 120) return false

    const contours = scaterplot.getMainChartContours(mainviewSvg)
    const hit = scaterplot.findContourPolygonAtPoint(contours, px, py)
    if (!hit || !hit.polygon) return false

    const selectedPoints = scaterplot.getPointsInsidePolygonComponent(
        datum, mainviewSvg, hit.polygon
    )
    if (!selectedPoints.length) return false

    const selectedIds = new Set(selectedPoints.map(function (d) { return d.id }))
    applySelectionMembership(function (d) {
        return selectedIds.has(d.id)
    })

    lastDensityContourSelectAt = now
    finalizeActiveSelectionChange("density_contour_selection", {
        source: "density-contour-click",
        xDim: mainviewSvg.attr("xDim"),
        yDim: mainviewSvg.attr("yDim"),
        contourValue: hit.contour.value,
        pointCount: selectedPoints.length
    })
    return true
}

function bindMainChartDensityClick() {
    if (!mainviewSvg || mainviewSvg.empty()) return
    const node = mainviewSvg.node()
    if (!node || node.__densityClickBound) return
    node.__densityClickBound = true

    node.addEventListener("click", function (event) {
        if (mainChartMode !== "density" || current_selectionType === 4) return
        triggerMainChartDensitySelectionAtEvent(event, mainviewSvg)
    }, true)
}

function applyBrushSelectionFromExtent(mv, extent) {
    return timeBlock("applyBrushSelectionFromExtent", function () {
        if (!extent || !mv || !datum || current_selectionType === 4) return
        if (!current_color.length || !current_color[0] || !current_color[0].visibility) return

        const x = mv.scalex
        const y = mv.scaley
        const xcol = mv.xcol
        const ycol = mv.ycol
        if (!x || !y || !xcol || !ycol) return

        applySelectionMembership(function (d) {
            const cx = x(d[xcol])
            const cy = y(d[ycol])
            if (!Number.isFinite(cx) || !Number.isFinite(cy)) return false
            return isBrushed(extent, cx, cy, null, d)
        })
    })
}

function updateChart(mv) {
    const extent = d3.event.selection
    if (!extent) return
    previewMainChartBrush(mv, extent)
  }

  // A function that return TRUE or FALSE according if a dot is in the selection or not
  function isBrushed(brush_coords, cx, cy, ele,d) {
        var x0 = Math.min(brush_coords[0][0], brush_coords[1][0]),
            x1 = Math.max(brush_coords[0][0], brush_coords[1][0]),
            y0 = Math.min(brush_coords[0][1], brush_coords[1][1]),
            y1 = Math.max(brush_coords[0][1], brush_coords[1][1]);
            return (x0 - 0.5) <= cx && cx <= (x1 + 0.5) && (y0 - 0.5) <= cy && cy <= (y1 + 0.5);
  }
  function setpointvisGloabl(data,selections) {
    if (!data || !selections) return
    let iso = false
    let hasHiddenLayer = false

    for (let i = 0; i < selections.length; i++) {
        const s = selections[i]
        if (!s) continue
        if (s.isolate === true) iso = true
        if (s !== selections[0] && s.visibility === false) hasHiddenLayer = true
    }

    if (!iso && !hasHiddenLayer) {
        for (let i = 0; i < data.length; i++) {
            if (data[i]) data[i].visibility = true
        }
        return
    }

    for (let pi = 0; pi < data.length; pi++) {
        const p = data[pi]
        if (!p) continue
        if (iso) {
            p.visibility = false
            for (let si = 0; si < selections.length; si++) {
                const s = selections[si]
                if (s && s.isolate && s.content.has(p) && s !== selections[0]) {
                    p.visibility = true
                }
            }
        } else {
            p.visibility = true
            for (let si = 0; si < selections.length; si++) {
                const s = selections[si]
                if (s && s.content.has(p) && s !== selections[0]) {
                    p.visibility = (p.visibility && s.visibility)
                }
            }
        }
    }
}

  function setpointvisLocal(p,selections) {
    p.visibility = true
    
    let iso = false

    for (const s of selections) {
        if (s.isolate === true ){
            iso = true
        }
    }

    if(iso){
        p.visibility = false

        for (const s of selections) {
                if (s.isolate && s.content.has(p) && s != selections[0] ){
                    p.visibility = true
                }
          }
          
    }else{
        for (const s of selections) {
            if (s.content.has(p) && s != selections[0] ){
                p.visibility = (p.visibility && s.visibility)
            }
          }
    }
      

      
}

function hexToRgbA(hex,alpha){
    var c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return [((c>>16)&255)/255, ((c>>8)&255)/255, (c&255)/255 ,alpha ] ;
    }
    throw new Error('Bad Hex');
}
  

function selectionsList(data, container) {
    scheduleSelectionPanelLightRefresh()
}

// function selectionsTypeChooser(container){
//     let width = 50

//     let panel = container
//         .append("tr")
        
//         let replace = panel.append("td").attr("class","tooltip")

//         replace.append("span").attr("class","tooltiptext")
//         .text("Replace Selection") 

//         let replaceB = replace.append("img")
//             .attr("class","buttonIm")
//             .attr("src","static/imgs/sel_square.svg")
//             .attr("height", width)
//             .attr("width", width)
//             .classed("active",true)
            
//             .on("click", function(d, i) {
//                 replaceB.classed("active",true)
//                 additiveB.classed("active",false)
//                 substractiveB.classed("active",false)

//                 current_selectionType = 1
//              });

//         let additive = panel.append("td").attr("class","tooltip")

//         additive.append("span").attr("class","tooltiptext")
//         .text("Additive Selection") 

//         let additiveB = additive.append("img")
//             .attr("class","buttonIm")
//             .attr("src","static/imgs/sel_additiv.svg")
//             .attr("height", width)
//             .attr("width", width)

//             .on("click", function(d, i) {
//                 replaceB.classed("active",false)
//                 additiveB.classed("active",true)
//                 substractiveB.classed("active",false)
//                 current_selectionType = 2
//              }); 

//         let substractive = panel.append("td").attr("class","tooltip")

//         substractive.append("span").attr("class","tooltiptext")
//         .text("Substractive Selection") 

//         let substractiveB = substractive.append("img")
//             .attr("class","buttonIm")
//             .attr("src","static/imgs/sel_substractiv.svg")
//             .attr("height", width)
//             .attr("width", width)
             
//             .on("click", function(d, i) {

//                 replaceB.classed("active",false)
//                 additiveB.classed("active",false)
//                 substractiveB.classed("active",true)
                
//                 current_selectionType = 3
//                 //console.lag(finalLog)
//                 ///finalLog.push({nameAction :"add_color", callparam: {addedColor: selections[0] , selectionsBefore : selections }} ) //, data : datum, timestamp : Date.now()} )
               
//                 //console.lag(finalLog.join("_"))
               
//                 //download(Date.now()+".txt", finalLog)
//              });

//         let add = panel.append("div").attr("class","tooltip")

//         add.append("span").attr("class","tooltiptext")
//         .text("Add Selection") 

//         add.append("img")
//         .attr("class","buttonIm")
//         .attr("src","static/imgs/add_sel.svg")
//         .attr("height", width)
//         .attr("width", width)
//         .classed("active",false)
         
//         .on("click", function(d, i) {
//             for (s of selections){
//                 s.rep.classed("active2",false)
//             }

//             let newS = sel.add(reserve, selections)
//             if(newS !== undefined){
//                 let log = {nameAction :"add_color", callparam: {addedColor: newS["cname"] }, data : datum, timestamp : Date.now()} 
//                 finalLog.push( JSON.stringify(log,Set_toJSON) ) 
//                 cache = []

//                 current_color = [newS]    
//                 setTimeout( ()=>{
//                     selectionsList(selections, selList) ;
//                     selectionsList(selections, selList) ;
//                     newS.rep.classed("active2",true) 
//                 },0 )
//             }
            
//         });

//         let remove = panel.append("div").attr("class","tooltip")
        
//         remove.append("span").attr("class","tooltiptext")
//         .text("Remove Selection") 

//         remove.append("img")
//         .attr("class","buttonIm")
//         .attr("src","static/imgs/remove_sel.svg")
//         .attr("height", width)
//         .attr("width", width)
//         .classed("active",false)
        
//         .on("click", function(d, i) {
//             let log = {nameAction :"remove_color", callparam: {removedColors: getValuesOfKey("cname",current_color ) }, data : datum, timestamp : Date.now()} 
//             finalLog.push( JSON.stringify(log,Set_toJSON) ) 
//             cache = []

//             if(selections.length > 2){
//                 for( cc of current_color ){
//                     cc.rep.classed("active2",false)
//                     sel.remove(reserve, selections,cc)
//                 }
//                 setTimeout( ()=>{

//                     selectionsList(selections, selList) ;
//                     selectionsList(selections, selList) ;
//                     if(selections.length>1){
//                         current_color = [selections[selections.length-1]]
//                         current_color[0].rep.classed("active2",true)
//                     } 

//                 },0 )              
                
               

//                 setTimeout( ()=>{
//                     scaterplot.updatePoints(getMainChartPrimaryData(), mainviewSvg)

//                     //LOGGING HISTORY/
//                     //DONE
//                     viewHistory.push({ "xDim": mainviewSvg.attr("xDim") ,"yDim": mainviewSvg.attr("yDim"), "data": cloneDeep(datum ) })
//                     updateViewHistory(viewHistory)
//                     ///////////

//                 },0 )
                
//                 setTimeout( ()=>{
//                     sploom.updateSplom(datum, splom, sampleData,maxSplomAcc); 
//                 },0 )

//                 setTimeout( ()=>{
//                     refreshTableView()
//                 },0 )
                

//             }
            
//         });

//         let clearAll = panel.append("div").attr("class","tooltip")
        
//         clearAll.append("span").attr("class","tooltiptext")
//         .text("Clear All Selections") 

//         clearAll.append("img")
//         .attr("class","buttonIm")
//         .attr("src","static/imgs/clearAll_sel.svg")
//         .attr("height", width)
//         .attr("width", width)
//         .classed("active",false)
        
//         .on("click", function(d, i) { 
               
//             let log =  {nameAction :"clear_all_selections", callparam: {}, data : datum, timestamp : Date.now()} 
//             finalLog.push( JSON.stringify(log,Set_toJSON) ) 
//             cache = []

//             sel.clearAll(reserve, selections)

//             setTimeout( ()=>{
//                 selectionsList(selections, selList) ;
//                 selectionsList(selections, selList) ;

//                 scaterplot.updatePoints(getMainChartPrimaryData(), mainviewSvg)

//                 //LOGGING HISTORY
//                 //DONE
//                 viewHistory.push({ "xDim": mainviewSvg.attr("xDim") ,"yDim": mainviewSvg.attr("yDim"), "data": cloneDeep(datum ) })
//                 updateViewHistory(viewHistory)
//                 ///////////
                
//             },0 )

//             setTimeout( ()=>{
//                 scaterplot.updatePoints(getMainChartPrimaryData(), mainviewSvg)
//             },0 )
            
//             setTimeout( ()=>{
//                 sploom.updateSplom(datum, splom, sampleData,maxSplomAcc); 
//             },0 )

//             setTimeout( ()=>{
//                 refreshTableView()
//             },0 )
            

            
            
//         });
//}

        
function selectionsTypeChooser(container){
    let width = 50

    let panel = container
        .append("tr")
        
        let replace = panel.append("td").attr("class","tooltip")

        replace.append("span").attr("class","tooltiptext")
        .text("Replace Selection") 

        let replaceB = replace.append("img")
            .attr("class","buttonIm")
            .attr("src","static/imgs/sel_square.svg")
            .attr("height", width)
            .attr("width", width)
            .classed("active",true)
            
            .on("click", function(d, i) {
                replaceB.classed("active",true)
                additiveB.classed("active",false)
                substractiveB.classed("active",false)
                zoomB.classed("active",false)

                current_selectionType = 1
             });

        let additive = panel.append("td").attr("class","tooltip")

        additive.append("span").attr("class","tooltiptext")
        .text("Additive Selection") 

        let additiveB = additive.append("img")
            .attr("class","buttonIm")
            .attr("src","static/imgs/sel_additiv.svg")
            .attr("height", width)
            .attr("width", width)

            .on("click", function(d, i) {
                replaceB.classed("active",false)
                additiveB.classed("active",true)
                substractiveB.classed("active",false)
                zoomB.classed("active",false)

                current_selectionType = 2
             }); 

        let substractive = panel.append("td").attr("class","tooltip")

        substractive.append("span").attr("class","tooltiptext")
        .text("Substractive Selection") 

        let substractiveB = substractive.append("img")
            .attr("class","buttonIm")
            .attr("src","static/imgs/sel_substractiv.svg")
            .attr("height", width)
            .attr("width", width)
             
            .on("click", function(d, i) {

                replaceB.classed("active",false)
                additiveB.classed("active",false)
                substractiveB.classed("active",true)
                zoomB.classed("active",false)

                current_selectionType = 3
                //console.lag(finalLog)
                ///finalLog.push({nameAction :"add_color", callparam: {addedColor: selections[0] , selectionsBefore : selections }} ) //, data : datum, timestamp : Date.now()} )
               
                //console.lag(finalLog.join("_"))
               
                //download(Date.now()+".txt", finalLog)
             });

        let zoom = panel.append("td").attr("class","tooltip")

        zoom.append("span").attr("class","tooltiptext")
        .text("Zoom") 
        
        let zoomB = zoom.append("img")
        .attr("class","buttonIm")
        .attr("src","static/imgs/sel_zoom.svg")
        .attr("height", width)
        .attr("width", width)
            
        .on("click", function(d, i) {

            replaceB.classed("active",false)
            additiveB.classed("active",false)
            substractiveB.classed("active",false)
            zoomB.classed("active",true)
            
            current_selectionType = 4
            //console.lag(finalLog)
            ///finalLog.push({nameAction :"add_color", callparam: {addedColor: selections[0] , selectionsBefore : selections }} ) //, data : datum, timestamp : Date.now()} )
            
            //console.lag(finalLog.join("_"))
            
            //download(Date.now()+".txt", finalLog)
            });

        
    }

    function colorOp(container){
            let width = 50
        
            let panel = container
                .append("tr")
        
                let add = panel.append("div").attr("class","tooltip")
        
                add.append("span").attr("class","tooltiptext")
                .text("Add Selection") 
        
                add.append("img")
                .attr("class","buttonIm")
                .attr("src","static/imgs/add_sel.svg")
                .attr("height", width)
                .attr("width", width)
                .classed("active",false)
                 
                .on("click", function(d, i) {
                    for (s of selections){
                        s.rep.classed("active2",false)
                    }
        
                    let newS = sel.add(reserve, selections)
                    if(newS !== undefined){
                        ensureSelectionLayerMeta(newS)
                        let log = {nameAction :"add_color", callparam: {addedColor: newS["cname"] }, data : datum, timestamp : Date.now()} 
                        let svState = saveState("add_color","")
                        savedEntries.push(svState)
                        if(onlineLogActive){
                            firebase.save(svState, globalLoss, userId)
                        }


                        finalLog.push( JSON.stringify(log,Set_toJSON) ) 
                        cache = []
                        
        
                        current_color = [newS]    
                        setTimeout( ()=>{
                            updateSelectionPanel()
                            updateSelectionOverlapPanel()
                            newS.rep.classed("active2",true) 
                            refreshSplomAfterSelection()
                        },0 )
                    }
                    
                });
        
                panel = panel.append("tr")
                
                let remove = panel.append("div").attr("class","tooltip")
                
                remove.append("span").attr("class","tooltiptext")
                .text("Remove Selection") 
        
                remove.append("img")
                .attr("class","buttonIm")
                .attr("src","static/imgs/remove_sel.svg")
                .attr("height", width)
                .attr("width", width)
                .classed("active",false)
                
                .on("click", function(d, i) {
                    
                   



                    
                    if(selections.length > 2){
                        for( cc of current_color ){
                            cc.rep.classed("active2",false)
                            sel.remove(reserve, selections,cc)
                        }
                        setTimeout( ()=>{
        
                            selectionsList(selections, selList) ;
                            selectionsList(selections, selList) ;
                            if(selections.length>1){
                                current_color = [selections[selections.length-1]]
                                current_color[0].rep.classed("active2",true)
                            } 
        
                        },0 )              
                        
                       
        
                        setTimeout( ()=>{
                            scaterplot.updatePoints(getMainChartPrimaryData(), mainviewSvg)
                            
                            let log = {nameAction :"remove_color", callparam: {removedColors: getValuesOfKey("cname",current_color ) }, data : datum, timestamp : Date.now()} 
                            let svState = saveState("remove_color","")
                            savedEntries.push(svState)
                            if(onlineLogActive){
                                firebase.save(svState, globalLoss, userId)
                            }
                            
                            finalLog.push( JSON.stringify(log,Set_toJSON) ) 
                            cache = []

                            //LOGGING HISTORY/
                            //DONE
                            pushViewHistorySnapshot()
                            updateViewHistory(viewHistory)
                            
                            ///////////
        
                        },0 )
                        
                        setTimeout( ()=>{
                            refreshSplomAfterSelection()
                        },0 )
        
                        setTimeout( ()=>{
                            refreshTableView()
                            updateCountTable (datum, countTable);
                        },0 )
                        
        
                    }
                    
                });
        
                panel = panel.append("tr")

                let clearAll = panel.append("div").attr("class","tooltip")
                
                clearAll.append("span").attr("class","tooltiptext")
                .text("Clear All Selections") 
        
                clearAll.append("img")
                .attr("class","buttonIm")
                .attr("src","static/imgs/clearAll_sel.svg")
                .attr("height", width)
                .attr("width", width)
                .classed("active",false)
                
                .on("click", function(d, i) { 
                       
                    
                    
        
                    sel.clearAll(reserve, selections)
                    clearAllLayerSelectionsBySouche()
        
                    setTimeout( ()=>{
                        updateSelectionPanel()
                        updateSelectionOverlapPanel()
        
                        scaterplot.updatePoints(getMainChartPrimaryData(), mainviewSvg)
                        
                        let log =  {nameAction :"clear_all_selections", callparam: {}, data : datum, timestamp : Date.now()} 
                        let svState = saveState("clear_all_selections","")
                        savedEntries.push(svState)
                        if(onlineLogActive){
                            firebase.save(svState, globalLoss, userId)
                        }
                        
                        
                        finalLog.push( JSON.stringify(log,Set_toJSON) ) 
                        cache = []

                        //LOGGING HISTORY
                        //DONE
                        pushViewHistorySnapshot()
                        updateViewHistory(viewHistory)
                        ///////////
                        
                    },0 )
        
                    setTimeout( ()=>{
                        scaterplot.updatePoints(getMainChartPrimaryData(), mainviewSvg)
                    },0 )
                    
                    setTimeout( ()=>{
                        refreshSplomAfterSelection()
                    },0 )
        
                    setTimeout( ()=>{
                        refreshTableView()
                        updateCountTable (datum, countTable);
                    },0 )       
                    
                });

                panel = panel.append("tr")

                let saveSelection = panel.append("div").attr("class","tooltip")
                
                saveSelection.append("span").attr("class","tooltiptext")
                .text("Save Selection") 
        
                saveSelection.append("img")
                .attr("class","buttonIm")
                .attr("src","static/imgs/save_selection.svg")
                .attr("height", width)
                .attr("width", width)
                .classed("active",false)
                
                .on("click", function(d, i) { 
                       
                    let log =  {nameAction :"saved_selections", callparam: {}, data : datum, timestamp : Date.now()} 
                    
                    let svState = saveState("saved_selections","")
                    savedEntries.push(svState)
                    if(onlineLogActive){
                        firebase.save(svState, globalLoss, userId)
                    }
                    
                    finalLog.push( JSON.stringify(log,Set_toJSON) )  
         
                    for (cc of current_color){
                        sel.save(cc)
                    }
                    
                });

    
}


let custDim_input = (container) => {
    const datasetSummaryPanel = container.append("div")
        .attr("class", "dataset-summary-panel")
        .style("margin-bottom", "10px")
        .style("padding-bottom", "8px")
        .style("border-bottom", "1px solid #e5e7eb")

    datasetSummaryPanel.append("div")
        .style("font-weight", "600")
        .style("font-size", "12px")
        .style("margin-bottom", "4px")
        .text("Dataset columns")

    const datasetLoadStatus = datasetSummaryPanel.append("div")
        .attr("class", "dataset-load-status")
        .style("font-size", "12px")
        .style("min-height", "16px")
        .style("color", "#4b5563")

    setDatasetLoadStatus = function (msg, isError) {
        datasetLoadStatus.text(msg || "")
        datasetLoadStatus.style("color", isError ? "#b42318" : "#0b6b2e")
    }

    const yeastPanel = container.append("div")
        .attr("class", "yeast-filter-panel")
        .style("margin-bottom", "10px")
        .style("padding-bottom", "8px")
        .style("border-bottom", "1px solid #e5e7eb")
        .style("display", "none")

    yeastPanel.append("div")
        .style("font-weight", "600")
        .style("font-size", "12px")
        .style("margin-bottom", "4px")
        .text("Souche compare options")

    const yeastFilterList = yeastPanel.append("div")
        .attr("class", "yeast-filter-list")
        .style("display", "none")

    const yeastTrianglePicker = yeastPanel.append("div")
        .attr("id", "yeastTrianglePicker")
        .attr("class", "yeast-triangle-picker")
        .style("display", "none")
        .style("margin", "6px 0")
    yeastTrianglePicker.append("div").style("font-size", "11px").style("font-weight", "600").text("Triangle assignment:")
    const triRow = yeastTrianglePicker.append("div").style("display", "flex").style("gap", "8px").style("flex-wrap", "wrap")
    triRow.append("label").html("Lower: <select id=\"yeastTriangleLower\"></select>")
    triRow.append("label").html("Upper: <select id=\"yeastTriangleUpper\"></select>")
    yeastTrianglePicker.selectAll("select").on("change", function () {
        const lowerSel = document.getElementById("yeastTriangleLower")
        const upperSel = document.getElementById("yeastTriangleUpper")
        if (lowerSel) triangleLowerYeast = lowerSel.value
        if (upperSel) triangleUpperYeast = upperSel.value
        if (triangleLowerYeast === triangleUpperYeast) {
            triangleUpperYeast = selectedYeastTypes.find(function (s) { return s !== triangleLowerYeast })
        }
        logProvenanceAction("set_souche_triangle_comparison", {
            lower: triangleLowerYeast,
            upper: triangleUpperYeast
        })
        sploom.invalidateSplomCaches("triangle yeast")
        rebuildSplomWithDimensions(getSplomDimensionsForDisplay())
        refreshMainChartRendering()
        refreshSplomHeatFromVisitCounts()
    })

    const yeastSelectionTargetControl = yeastPanel.append("div")
        .attr("id", "yeastSelectionTargetControl")
        .attr("class", "yeast-selection-target-control")
        .style("display", "none")
        .style("margin", "6px 0")
    yeastSelectionTargetControl.append("div").style("font-size", "11px").style("font-weight", "600").text("Selection target:")
    ;[
        { value: "active", label: "Active Souche" },
        { value: "lower", label: "Lower Souche" },
        { value: "upper", label: "Upper Souche" },
        { value: "both", label: "Both Souches" }
    ].forEach(function (opt) {
        const label = yeastSelectionTargetControl.append("label")
            .style("display", "inline-flex")
            .style("align-items", "center")
            .style("gap", "4px")
            .style("font-size", "12px")
            .style("margin-right", "8px")
        label.append("input")
            .attr("type", "radio")
            .attr("name", "selectionTarget")
            .attr("value", opt.value)
            .property("checked", selectionTarget === opt.value)
            .on("change", function () {
                const previousContextKey = getSelectionContextKey()
                const selected = document.querySelector("input[name='selectionTarget']:checked")
                selectionTarget = selected ? selected.value : "active"
                switchSelectionContext(getSelectionContextKey(), previousContextKey)
                refreshMainChartRendering()
                refreshSplomAfterSelection(null, true)
                refreshSplomHeatFromVisitCounts()
                selectionsList(selections, selList)
                updateCountTable(datum, countTable)
                refreshTableView()
                logProvenanceAction("set_selection_target", { selectionTarget: selectionTarget })
            })
        label.append("span").text(opt.label)
    })

    const yeastPanelStatus = yeastPanel.append("div")
        .attr("class", "yeast-panel-status")
        .style("font-size", "11px")
        .style("min-height", "14px")
        .style("color", "#6b7280")
    setYeastPanelStatus = function (msg, isError) {
        yeastPanelStatus.text(msg || "")
        yeastPanelStatus.style("color", isError ? "#b42318" : "#0b6b2e")
    }

    renderSplomSoucheDropdown = function () {
        try {
            const host = d3.select(".panel-splom .panel-head")
            if (host.empty()) {
                console.warn("[Souche dropdown] Missing .panel-splom .panel-head container")
                return
            }
            const hasSoucheData = !!(yeastColumn && datum && datum.length && availableYeastTypes && availableYeastTypes.length)
            const existing = document.getElementById("splomSoucheDropdownControl")
            if (!hasSoucheData) {
                if (existing) existing.remove()
                return
            }
            const souches = availableYeastTypes && availableYeastTypes.length
                ? availableYeastTypes.slice()
                : []

            let control = host.select("#splomSoucheDropdownControl")
            if (control.empty()) {
                control = host.insert("div", ".splom-head-actions")
                    .attr("id", "splomSoucheDropdownControl")
                    .attr("class", "splom-souche-dropdown-control")
                control.append("label")
                    .attr("class", "splom-souche-label")
                    .attr("for", "splom-souche-select")
                    .text("Souche / Yeast")
                control.append("select")
                    .attr("id", "splom-souche-select")
                    .attr("class", "splom-souche-select")
                    .on("change", function () {
                        const selectedValue = this.value
                        const upperSel = document.getElementById("splom-upper-souche-select")
                        const upperValue = upperSel ? (upperSel.value || null) : null
                        applySoucheSelection(selectedValue ? [selectedValue] : [], {
                            source: "splom-dropdown",
                            enforceSingle: true
                        })
                        if (upperValue) {
                            applyUpperTriangleSoucheSelection(upperValue, {
                                source: "splom-main-souche-dropdown"
                            })
                        }
                    })
                control.append("label")
                    .attr("class", "splom-souche-label")
                    .attr("for", "splom-upper-souche-select")
                    .text("Upper triangle")
                control.append("select")
                    .attr("id", "splom-upper-souche-select")
                    .attr("class", "splom-souche-select")
                    .on("change", function () {
                        applyUpperTriangleSoucheSelection(this.value || null, {
                            source: "splom-upper-souche-dropdown"
                        })
                    })
            }
            const select = control.select("#splom-souche-select")
            select.selectAll("option")
                .data(souches)
                .join("option")
                .attr("value", function (d) { return d })
                .text(function (d) { return d })
            const upperSelect = control.select("#splom-upper-souche-select")
            const upperOptions = [{ label: "None", value: "" }].concat(souches.map(function (s) {
                return { label: s, value: s }
            }))
            upperSelect.selectAll("option")
                .data(upperOptions)
                .join("option")
                .attr("value", function (d) { return d.value })
                .text(function (d) { return d.label })
            syncSplomSoucheDropdownSelection()
        } catch (err) {
            console.warn("[Souche dropdown] render failed", err)
        }
    }

    renderYeastFilterPanel = function () {
        yeastFilterList.selectAll("*").remove()
        refreshAvailableYeastTypes()
        if (renderSplomSoucheDropdown) renderSplomSoucheDropdown()
        if (!yeastColumn || !datum || !datum.length) {
            yeastPanel.style("display", "none")
            return
        }
        // Legacy side souche controls are superseded by SPLOM header dropdowns.
        yeastPanel.style("display", "none")
        if (!yeastFilterList.node().__yeastChangeBound) {
            yeastFilterList.node().__yeastChangeBound = true
            yeastFilterList.on("change", function () {
                onYeastFilterChanged()
            })
        }
        syncYeastTrianglePickerUI()
        syncSplomModeRadios()
        ensureSelectionTargetControl()
        ensureMainChartYeastViewControl()
        updateMainChartSoucheNavigator()
        updateMainChartPairTitle()
    }

    let row = container.append("div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "6px")
        .style("flex-wrap", "wrap");

    let inputF = row.append('input')
        .attr('type','text')
        .attr('placeholder', "custom dim (e.g. sepal length + petal width)")
        .style("min-width", "220px");

    let addBtn = row.append("button")
        .attr("type", "button")
        .text("Add");

    let status = container.append("div")
        .style("font-size", "12px")
        .style("margin-top", "4px")
        .style("min-height", "16px");

    let addedLogWrap = container.append("div")
        .style("margin-top", "6px")
        .style("font-size", "12px");
    addedLogWrap.append("div")
        .style("font-weight", "600")
        .text("Custom dims added:");
    let addedLogList = addedLogWrap.append("div")
        .style("margin-top", "2px")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "2px");

    let showStatus = (msg, isError) => {
        status.text(msg || "");
        status.style("color", isError ? "#b42318" : "#0b6b2e");
    };

    let appendAddedDimLog = (name) => {
        addedLogList.insert("div", ":first-child")
            .style("color", "#1f2937")
            .style("font-family", "monospace")
            .text(name);
    };

    const familyPanel = container.append("div")
        .attr("class", "family-dim-panel")
        .style("margin-top", "10px")
        .style("border-top", "1px solid #e5e7eb")
        .style("padding-top", "8px")

    familyPanel.append("div")
        .style("font-weight", "600")
        .style("font-size", "12px")
        .style("margin-bottom", "4px")
        .text("Dimension families")

    const familyActions = familyPanel.append("div")
        .attr("class", "family-dim-actions")

    familyActions.append("button")
        .attr("type", "button")
        .attr("id", "upload-family-map-btn")
        .text("Upload Family Map")

    familyActions.append("input")
        .attr("id", "upload-family-map-input")
        .attr("type", "file")
        .attr("accept", ".csv,.json,.xlsx,.xls")
        .style("display", "none")

    familyActions.append("button")
        .attr("type", "button")
        .attr("id", "export-family-map-btn")
        .text("Export Family Map")
        .on("click", exportFamilyMapDownload)

    const familyManual = familyPanel.append("div")
        .attr("class", "family-manual-create")

    familyManual.append("button")
        .attr("type", "button")
        .attr("id", "create-family-btn")
        .text("Create Family")
        .on("click", promptCreateFamilyFromSelected)

    const familyStatus = familyPanel.append("div")
        .attr("class", "family-panel-status")
        .style("font-size", "12px")
        .style("min-height", "16px")
        .style("margin", "4px 0")

    setFamilyPanelStatus = function (msg, isError) {
        familyStatus.text(msg || "")
        familyStatus.style("color", isError ? "#b42318" : "#0b6b2e")
    }

    familyMapWarningsEl = familyPanel.append("div")
        .attr("id", "family-map-warnings")
        .attr("class", "family-map-warnings")
        .style("display", "none")

    familyPanel.append("div")
        .attr("id", "family-dimension-list")
        .attr("class", "family-dimension-list")

    const uploadFamilyBtn = document.getElementById("upload-family-map-btn")
    const uploadFamilyInput = document.getElementById("upload-family-map-input")
    if (uploadFamilyBtn && uploadFamilyInput) {
        uploadFamilyBtn.addEventListener("click", function () {
            uploadFamilyInput.click()
        })
        uploadFamilyInput.addEventListener("change", function () {
            const file = uploadFamilyInput.files && uploadFamilyInput.files[0]
            uploadFamilyInput.value = ""
            if (!file) return
            dimensionFamilies.parseFamilyMappingFile(file)
                .then(function (map) {
                    applyUploadedFamilyMap(map)
                })
                .catch(function (err) {
                    console.error(err)
                    if (setFamilyPanelStatus) {
                        setFamilyPanelStatus(err && err.message ? err.message : "Could not parse family map.", true)
                    }
                })
        })
    }

    renderFamilyDimensionPanel()

    const splomDimPanel = container.append("div")
        .attr("class", "splom-dim-panel")
        .style("margin-top", "10px")
        .style("border-top", "1px solid #e5e7eb")
        .style("padding-top", "8px");

    splomDimPanel.append("div")
        .style("font-weight", "600")
        .style("font-size", "12px")
        .style("margin-bottom", "4px")
        .text("SPLOM column filter");

    splomDimPanel.append("div")
        .style("font-size", "12px")
        .style("margin-bottom", "6px")
        .style("color", "#4b5563")
        .text("Use table header checkboxes to highlight columns. With families loaded, SPLOM visibility is controlled by family chips above the matrix.");

    const splomFilterStatus = splomDimPanel.append("div")
        .style("font-size", "12px")
        .style("min-height", "16px")
        .style("margin-bottom", "4px");

    setSplomColumnFilterStatus = (msg, isError) => {
        splomFilterStatus.text(msg || "");
        splomFilterStatus.style("color", isError ? "#b42318" : "#0b6b2e");
    };

    const splomDimButtons = splomDimPanel.append("div")
        .style("display", "flex")
        .style("flex-wrap", "wrap")
        .style("gap", "6px");

    splomDimButtons.append("button")
        .attr("type", "button")
        .attr("id", "vispromApplySplomDims")
        .text("Apply Selected Dimensions")
        .on("click", applySelectedDimensions);

    splomDimButtons.append("button")
        .attr("type", "button")
        .attr("id", "vispromResetSplomCols")
        .text("Reset Columns")
        .attr("title", "Clear column filters and remove all dimension families")
        .on("click", resetSplomColumns);

    setSplomColumnFilterStatus("Showing all dimensions.", false);

    let addCustomDim = () => {
        let inputValue = (inputF.property("value") || "").trim();
        if(!inputValue){
            showStatus("Enter an expression first.", true);
            return;
        }
        if(dimensions.includes(inputValue)){
            showStatus("This custom dim already exists: " + inputValue, true);
            return;
        }

        try {
            polyparser.addPolyDim(inputValue, datum, dimensions);
        } catch (err) {
            showStatus("Invalid expression. Use existing column names only.", true);
            return;
        }

        if (allColumns.indexOf(inputValue) === -1) {
            allColumns.push(inputValue);
        }
        if (numericDimensions.indexOf(inputValue) === -1) {
            numericDimensions.push(inputValue);
        }
        dimensions.push(inputValue);
        allDimensions = dimensions.slice();
        if (customDimensionExpressions.indexOf(inputValue) === -1) {
            customDimensionExpressions.push(inputValue)
        }
        // If the user is actively filtering SPLOM columns, include new custom dims by default
        // so they appear immediately after creation.
        if (selectedColumns && selectedColumns.length && selectedColumns.indexOf(inputValue) === -1) {
            selectedColumns.push(inputValue)
        }
        if (Object.keys(currentDimensionFamilies).length && hasDimensionFamilies()) {
            syncDimensionFamiliesState()
            renderFamilyDimensionPanel()
        }
        dimVisitcount[inputValue] = 0;
        for (let d of dimensions){
            viewVisitcount[getSplomVisitCountKey(d, inputValue)] = 0;
        }

        rebuildSplomWithDimensions(getSplomDimensionsForDisplay());
        setTimeout( ()=>{
            refreshTableView();
            updateCountTable (datum, countTable);
            syncColumnHighlightUI();
        },0 );
        inputF.property("value", "");
        appendAddedDimLog(inputValue);
        let sample = datum && datum.length ? datum[0] : null;
        let sampleVal = sample ? Number(sample[inputValue]) : NaN;
        if (Number.isFinite(sampleVal)) {
            showStatus("Added custom dim: " + inputValue + " (row1=" + sampleVal.toFixed(2) + ")", false);
        } else {
            showStatus("Added custom dim: " + inputValue, false);
        }
    };

    addBtn.on("click", addCustomDim);
    inputF.on("keypress", function(){
        if(d3.event.keyCode === 13){
            addCustomDim();
        }
    });
}

function GroupActionChooser(container){
    let width = 50

    let panel = container
        .append("tr")
        
        let union = panel.append("td").attr("class","tooltip")
        
        union.append("span").attr("class","tooltiptext")
        .text("Union") 

        union.append("img")
            .attr("class","buttonIm")
            .attr("src","static/imgs/union.svg")
            .attr("height", width)
            .attr("width", width)

            .on("click", function(d, i) {
                //console.lag(current_color)
          
                let newS = sel.add(reserve, selections)
                if(newS !== undefined){
                    doUnion(current_color,newS)
                }
                
             })
             



            let intersection = panel.append("td").attr("class","tooltip")
        
            intersection.append("span").attr("class","tooltiptext")
            .text("Intersection") 
    
            intersection.append("img")
            .attr("class","buttonIm")
            .attr("src","static/imgs/intersection.svg")
            .attr("height", width)
            .attr("width", width)
            
            .on("click", function(d, i) {
                if(current_color.length>1){
                    let newS = sel.add(reserve, selections)
                    if(newS !== undefined){
                        doIntersection(current_color,newS)
                    }
                }
             });

            let difference = panel.append("td").attr("class","tooltip")
        
            difference.append("span").attr("class","tooltiptext")
            .text("Difference") 
    
            difference.append("img")
            .attr("class","buttonIm")
            .attr("src","static/imgs/difference.svg")
            .attr("height", width)
            .attr("width", width)

            .on("click", function(d, i) {
               
                if(current_color.length>1){
                    let newS = sel.add(reserve, selections)
                    if(newS !== undefined){
                        doDifference(current_color,newS)
                    }
                }
             });

}

function updateTableView(data, container, columnsForTable){
    if (!columnsForTable) columnsForTable = getVisibleTableColumns()
    const numericColsInTable = columnsForTable.filter(function (c) {
        return numericDimensions.indexOf(c) !== -1
    })
    setRanges(data, numericColsInTable)
    container.select("thead").html("")

    const familyGroups = buildTableFamilyGroups(columnsForTable)
    const headerColumns = [...columnsForTable, "color"]

    if (familyGroups) {
        const familyRow = container.select("thead").append("tr")
            .attr("class", "table-family-header-row")
        for (let i = 0; i < headerColumns.length; i++) {
            const col = headerColumns[i]
            if (col === "color") {
                familyRow.append("th").attr("class", "table-family-spacer")
                continue
            }
            if (numericDimensions.indexOf(col) === -1) {
                familyRow.append("th").attr("class", "table-family-spacer")
                continue
            }
            let group = null
            for (let g = 0; g < familyGroups.length; g++) {
                if (familyGroups[g].cols.indexOf(col) !== -1) {
                    group = familyGroups[g]
                    break
                }
            }
            if (!group || group.cols[0] !== col) continue
            const familyCell = familyRow.append("th")
                .attr("class", "table-family-label" + (dimensionFamilies.isOthersFamily(group.family) ? " is-others" : ""))
                .attr("colspan", group.cols.length)
            familyCell.append("span").text(group.family)
            if (!dimensionFamilies.isOthersFamily(group.family)) {
                familyCell.append("button")
                    .attr("type", "button")
                    .attr("class", "selection-layer-row-btn remove table-family-remove-btn")
                    .attr("title", "Remove family")
                    .text("−")
                    .on("click", function () { deleteFamily(group.family) })
            }
        }
    }
    
    let th = container.select("thead").append("tr")
    .selectAll("th")
    .data( headerColumns )

    let thEnter = th.join("th")

    thEnter.each(function (d) {
        const cell = d3.select(this)
        if (d === "color" || d === "selections") {
            cell.attr("data-dim", null).text(d)
            return
        }
        cell.attr("data-dim", d).html("")
        if (isMetadataTableColumn(d)) {
            cell.append("span").text(d)
            return
        }
        const label = cell.append("label").attr("class", "table-dim-header")
        label.append("input")
            .attr("type", "checkbox")
            .attr("class", "table-dim-checkbox")
            .attr("data-dim", d)
        label.append("span").text(d)
    })

    thEnter.filter(function (d) { return d === "color" })
        .on("dblclick", function () {
            tr.sort(function (a, b) {
                let aaa = -1
                let aa = Array.from(a.color)
                if (aa.length > 0) {
                     aaa = aa[0].order
                } 
                let bbb = -1
                let bb = Array.from(b.color)
                if (bb.length > 0) {
                     bbb = bb[0].order
                } 
                return aaa - bbb
            })
        })

    thEnter.filter(function (d) { return d !== "color" })
        .on("dblclick", function (d) {
            tr.sort(function (a, b) {
                if (isMetadataTableColumn(d)) {
                    return String(a[d]).localeCompare(String(b[d]))
                }
                return b[d] - a[d]
            })
        })

    let barwidth = d3.scaleLinear()
    .domain([0,totalDimVisitcount])
    .range([ 0, 40 ])

    let prov = container.select("thead").append("tr")
    .selectAll("th")
    .data( columnsForTable )

    let thEnter2 = prov.join("th")
    .attr("data-dim", function (d) {
        return numericDimensions.indexOf(d) !== -1 ? d : null
    })
    .each(function (d) {
        if (numericDimensions.indexOf(d) === -1) return
        const cell = d3.select(this)
        const svg = cell.append("svg")
    .attr("width", 40).attr("height", 20)
        const bar = svg.append("g")
    bar.append("rect").attr("width", "100%").attr("height", "100%").attr("fill", "lightgray")
        bar.append("rect")
            .attr("width", function () { return barwidth(dimVisitcount[d]) })
            .attr("height", "100%")
            .attr("fill", "DeepSkyBlue")
    })

    let minMaxDisplay = container.select("thead").append("tr")
    .selectAll("th") 
    .data( columnsForTable )

    let thEnter3 = minMaxDisplay.join("th")
    .attr("data-dim", function (d) {
        return numericDimensions.indexOf(d) !== -1 ? d : null
    })
    .text(function (d) {
        if (numericDimensions.indexOf(d) === -1) return ""
        return MinOrMax(variance[d], mean[d], ranges[d])
    })

    // let th = container.select("thead").selectAll("tr")
    // .data([[...dimensions, "color"],[...dimensions, "bobo"]])

    // let thEnter = th.join("tr")
    //     .selectAll("th")
    //     .data( d => {return d} )
        
    //     let thEnter2 = thEnter.join("th")
    //     .text(function(d) {
    //         return d;
    //     }) 
        


    

    let nDims = columnsForTable.length
    let nColorCol = nDims
    let tr= container.select("tbody").selectAll("tr")
        .data(data, function (d){ return d.id})
        
    let enter= tr.join("tr")
        
        let td= enter.selectAll("td")
             .data(function (row) { 
                 let res = []
                 for (const col of columnsForTable) {
                     res.push({ kind: "value", col: col, value: row[col], row: row })
                 }
                 res.push({ kind: "color", value: row["color"], row: row })
                 return res
             })
        let enter2 = td.join("td")
            .attr("data-dim", function (d, i) {
                if (i < nDims) return d.col
                return null
            })
            .text(function (d, i) {
                if (i >= nDims || d.kind !== "value") return
                const col = d.col
                if (isMetadataTableColumn(col)) {
                    return d.value == null ? "" : String(d.value)
                }
                return Number(Number(d.value).toFixed(2))
            })

        enter2.filter(function (d, i) { return i === nColorCol })
            .each(function (d) {
                const cell = d3.select(this)
                cell.html("")
                const swatches = getColorSwatchesForTableRow(d.row, d.value)
                const wrap = cell.append("span").attr("class", "selection-color-swatches")
                swatches.forEach(function (fill) {
                    wrap.append("span")
                        .attr("class", "selection-color-swatch")
                        .style("display", "inline-block")
                        .style("width", "10px")
                        .style("height", "10px")
                        .style("border-radius", "2px")
                        .style("border", "1px solid " + VIS_CONFIG.point.chipBorder)
                        .style("margin-right", "2px")
                        .style("vertical-align", "middle")
                        .style("background", fill)
                })
            })
    
    syncColumnHighlightUI()
}


const uni = ( acc , sel) =>{
  
    return [...acc, ...sel.content]
}

const doUnion = ( selectArr , resultSelection) =>{
    
    let res = selectArr.reduce(uni, [] );
    //console.lag(res)

    resultSelection.content = new Set(res);
    resultSelection.originCol = selectArr ;
    resultSelection.originOp = "static/imgs/union.svg" ;
    let unionArr = Array.from(resultSelection.content)
    
    for(const dPoint of datum){
        dPoint.color.delete(resultSelection.color)    
    }

    for(const dPoint of unionArr){
        dPoint.color.add(resultSelection.color)
    }

    scaterplot.updatePoints(getMainChartPrimaryData(), mainviewSvg)

    //LOGGING HISTORY
    //DONE
    pushViewHistorySnapshot()
    setTimeout( ()=>{
        updateViewHistory(viewHistory)
        },0 )


    let log = {nameAction :"groupOp_union", callparam: {colors: getValuesOfKey("cname",current_color ), xDim: mainviewSvg.attr("xDim") , yDim: mainviewSvg.attr("yDim")}, data : datum, timestamp : Date.now()} 
    let svState = saveState("groupOp_union","")
    savedEntries.push(svState)
    if(onlineLogActive){
        firebase.save(svState, globalLoss, userId)
    }

    

    finalLog.push( JSON.stringify(log,Set_toJSON) ) 
    cache = []
    ///////////
    
    selectionsList(selections, selList) ;
    selectionsList(selections, selList) ;
    refreshTableView()
    updateCountTable (datum, countTable);
    refreshSplomAfterSelection()

}

const inter = ( acc , sel) =>{
    return {content : new Set([...acc.content].filter(x => sel.content.has(x)))}
}

const doIntersection = ( selectArr , resultSelection) =>{
    if(selectArr.length > 1 ){
        let res = selectArr.slice(1, selectArr.length).reduce(inter, selectArr[0]);

        resultSelection.content = res.content

        resultSelection.originCol = selectArr ;
        resultSelection.originOp = "static/imgs/intersection.svg" ;

        let intersectionArr = Array.from(resultSelection.content)
        
        for(const dPoint of datum){
            dPoint.color.delete(resultSelection.color)    
        }

        for(const dPoint of intersectionArr){
            dPoint.color.add(resultSelection.color)
        }

        scaterplot.updatePoints(getMainChartPrimaryData(), mainviewSvg)

        //LOGGING HISTORY
        //DONE
        pushViewHistorySnapshot()
        setTimeout( ()=>{
            updateViewHistory(viewHistory)
            },0 )


        let log = {nameAction :"groupOp_intersection", callparam: {colors: getValuesOfKey("cname",current_color ) , xDim: mainviewSvg.attr("xDim") , yDim: mainviewSvg.attr("yDim")}, data : datum, timestamp : Date.now()} 
        let svState = saveState("groupOp_intersection","")
        savedEntries.push(svState)
        if(onlineLogActive){
            firebase.save(svState, globalLoss, userId)
        }
        
        finalLog.push( JSON.stringify(log,Set_toJSON) ) 
        cache = []
        ///////////
        
        selectionsList (selections, selList)
        selectionsList (selections, selList)
        refreshTableView()
        updateCountTable (datum, countTable);    
        refreshSplomAfterSelection()
    }

}


const diff = ( acc , sel) =>{
    let oneTow = new Set(  [...acc.content].filter(x => !sel.content.has(x)) );
    let towOne = new Set(  [...sel.content].filter(x => !acc.content.has(x)) );
    
    return {content :  new Set([...oneTow, ...towOne]) }
}


const doDifference = ( selectArr , resultSelection) =>{
    if(selectArr.length > 1 ){
        let res = selectArr.slice(1, selectArr.length).reduce(diff, selectArr[0]);

        resultSelection.content = res.content

        resultSelection.originCol = selectArr ;
        resultSelection.originOp = "static/imgs/difference.svg" ;
 
        let differenceArr = Array.from(resultSelection.content)
        
        for(const dPoint of datum){
            dPoint.color.delete(resultSelection.color)    
        }

        for(const dPoint of differenceArr){
            dPoint.color.add(resultSelection.color)
        }

        scaterplot.updatePoints(getMainChartPrimaryData(), mainviewSvg)

        //LOGGING HISTORY
        //DONE
        pushViewHistorySnapshot()
        setTimeout( ()=>{
            updateViewHistory(viewHistory)
            },0 )


        let log = {nameAction :"groupOp_difference", callparam: {colors: getValuesOfKey("cname",current_color ) , xDim: mainviewSvg.attr("xDim") , yDim: mainviewSvg.attr("yDim")}, data : datum, timestamp : Date.now()} 
        let svState = saveState("groupOp_difference","")
        savedEntries.push(svState)
        if(onlineLogActive){
            firebase.save(svState, globalLoss, userId)
        }
       
        finalLog.push( JSON.stringify(log,Set_toJSON) ) 
        cache = []
        ///////////
        
        selectionsList (selections, selList)
        selectionsList (selections, selList)
        refreshTableView()
        updateCountTable (datum, countTable);
        refreshSplomAfterSelection()
    }
}


function getcol(arr, column) {
    return arr.map(x => Number(Number(x[column]).toFixed(2)) )
}


const setRanges = (data, dimensions) => {
    for (dim of dimensions){
        let dataDim = getcol (data,dim)
        ranges[dim] = d3.extent(dataDim)
       // console.log( ranges[dim])
    }
}

const minMaxMed = (selcontent, dimensions,data) => {
    
    for(dim of dimensions){
        if(selcontent.size > 0){
            let array = getcol([...selcontent], dim)
            variance[dim] = math.variance(array)/math.variance( getcol([...data], dim))
            mean[dim] = math.mean(array)
            // console.log(variance[dim])
        }else{
            variance[dim] = null
            mean[dim] = null

        } 
                 
    } 

    //console.lag (variance)
    //console.lag (mean)
    
} 

const MinOrMax = (variance, mean, range) => {
    //console.lag(range)
    
    let min=parseFloat(range[0])
    let max=parseFloat(range[1])

    let mid = min + (max - min)/2 
    let midMinus =min + (mid - min)/2   
    let midPlus = mid + (max - mid)/2   

    // console.log("r0   :",min)
    // console.log("minus:",midMinus)
    // console.log("mid  :",mid     )
    // console.log("plus :",midPlus )
    // console.log("r1   :",max )
    
    if(variance !== null && variance<0.1 ){
        if( mean >= min && mean < midMinus ){
            return "Min";
        }
        else if(mean >= midMinus && mean < midPlus){
            return "Mid";
        }
        else if(mean >= midPlus && mean <= max){
            return "Max";
        }
        else{
            //console.lag("min:",min) 
            //console.lag("max:",max) 
            //console.lag("mean:",mean)   
            return "/"
        }
    }else{
        return "---";
    }

} 

function Set_toJSON(key, value) {
    if (typeof value === 'object' && value instanceof Set) {
        return [...value];
    }
    
      return value;
  }

let getValuesOfKey = (key, arr) =>{
    let acc = [] 
    for (e of arr){
        acc.push(e[key]) 
    }
    return acc
  }

  function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
  
    element.style.display = 'none';
    document.body.appendChild(element);
  
    element.click();
  
    document.body.removeChild(element);

  }

  let saveState = (aName, parameters) => {
    let curCol = []
    let sels = {}
    let resv = []

    for ( c of current_color){
        curCol.push(c.cname)    
    }

    for ( s of selections ){
       // if(s.cname !== "Blue"){
            ensureSelectionLayerMeta(s)
            sels[s.cname] = {
                points: loader.pointsAToiArray(s.content),
                dispName: s.displayName,
                id: s.id,
                label: s.label,
                annotation: s.annotation || "",
                color: s.color && s.color.string ? s.color.string : "",
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                // Snapshot by value so history entries do not drift as runtime state changes.
                selectionsBySouche: cloneDeep(s.selectionsBySouche || {})
            }
        //}
    }

    for ( r of reserve ){
        resv.push(r.cname)
    }



    
    let entry = {
        actName: aName                                  , 
        param : parameters                              ,
        currentColor: curCol                            ,
        active_selectiontype : current_selectionType    ,  //
        selections: sels                                , 
        reserve: resv                                   , 
        
        mvX: mainviewSvg.attr("xDim")                   , 
        mvY: mainviewSvg.attr("yDim")                   ,
        // Store immutable counters per snapshot.
        viewsCount : Object.assign({}, viewVisitcount)  ,
        dimVisitcount: Object.assign({}, dimVisitcount) ,
        mainChartMode: mainChartMode                    ,
        favorites : favIndex.slice()                    ,
        session: getSessionUiState()                    ,
    }

    return entry
    //console.lag(entry)

  }

  
  let loadState = (entry, options) => {
    const opts = options || {}
    let colPool = selections.concat(reserve);
    
    selections = []
    reserve    = []
    current_color = []
    viewVisitcount = Object.assign({}, entry.viewsCount || {})

    if (entry.dimVisitcount) {
        dimVisitcount = Object.assign({}, entry.dimVisitcount)
        totalDimVisitcount = 0
        Object.keys(dimVisitcount).forEach(function (key) {
            totalDimVisitcount += dimVisitcount[key] || 0
        })
    } else {
    viewToDimCount()
    }

    if (entry.mainChartMode) {
        mainChartMode = entry.mainChartMode === "density" ? "density" : "original"
        scaterplot.setRenderMode(mainChartMode)
        const modeSelect = document.getElementById("mainChartModeSelect")
        if (modeSelect) modeSelect.value = mainChartMode
    }

    applyLightSessionContextForRestore(entry.session)
    if (entry.active_selectiontype != null && (!entry.session || entry.session.currentSelectionType == null)) {
        current_selectionType = entry.active_selectiontype
    }

    Object.keys(maxSplomAcc).forEach(function(key) {
        maxSplomAcc[key] = 0
    })
    maxSplomAcc["v"] = 1
    
    for (var di = 0; di < datum.length; di++) {
        var d = datum[di]
        if (!d) continue
        if (!d.color) d.color = new Set()
        else d.color.clear()
    }

    for ( c of entry.currentColor){
        current_color.push(colPool.find(itm=>itm.cname === c))
    }

    const selectionNames = Object.keys(entry.selections || {})
    selectionNames.sort(function (a, b) {
        if (a === "Blue") return -1
        if (b === "Blue") return 1
        return 0
    })

    selectionNames.forEach(function(s) {
            let temp = colPool.find(itm=>itm.cname === s)
            selections.push(temp) 
            const saved = entry.selections[s]
            temp.displayName = saved.dispName
            if (saved.id) temp.id = saved.id
            if (saved.label) temp.label = saved.label
            else temp.label = saved.dispName
            temp.annotation = saved.annotation || ""
            if (saved.createdAt) temp.createdAt = saved.createdAt
            if (saved.updatedAt) temp.updatedAt = saved.updatedAt
            if (saved.selectionsBySouche) temp.selectionsBySouche = cloneDeep(saved.selectionsBySouche)
            else temp.selectionsBySouche = {}
            ensureSelectionLayerMeta(temp)
            temp.content = new Set(loader.indexAToPArray(saved.points, datum))

            for(p of saved.points ){
                if(temp.color != selections[0].color){
                    datum[p].color.add(temp.color)
                }
                
            }
    });
    normalizeSelectionsOrder()
    ensureAllColoredSelectionLayersMeta()

    getColoredSelectionLayers().forEach(function (layer) {
        if (!layer.selectionsBySouche || !Object.keys(layer.selectionsBySouche).length) {
            layer.content.forEach(function (d) {
                if (!d) return
                const rowId = d.__rowId != null ? d.__rowId : d.id
                if (rowId == null) return
                addRowIdToLayerSouche(layer, rowId, getSoucheKeyForPoint(d))
            })
        }
    })

    for ( r of entry.reserve ){
        let temp = colPool.find(itm=>itm.cname === r)
        reserve.push(temp)
        temp.content.clear()
    }

    if (!opts.preserveFavorites && entry.favorites) {
        favIndex = entry.favorites.slice()
        rebuildFavoritesFromIndices()
    }

    const chartDims = getRestoreChartDims(entry, opts)

    setTimeout(function () {
        invalidateSelectionMembershipIndex()
        rebuildSelectionMembershipIndex()
        rebuildColoredSelectionContentFromSoucheKeys()

        if (chartDims.xDim && chartDims.yDim) {
            activateSplomPair(chartDims.xDim, chartDims.yDim, chartDims.source, {
                forceSplomFit: isSplomTriangleCompareActive()
            })
            scaterplot.updatePointsAfterSelection(getMainChartPrimaryData(), mainviewSvg)
        }

        refreshSelectionExportUI({ immediate: true, full: true })

        if (selList && !selList.empty()) {
            selList.selectAll("tr").classed("active2", false)
            for ( c of entry.currentColor){
                selList.select("#"+c).classed("active2", true)
            }
        }

        refreshTableView()
        updateCountTable(datum, countTable)
        refreshSplomAfterSelection(null, true)
        bindSplomPlotHandlers()
    }, 0)

  }


  function updateCountTable(data, container){
   
    //console.log(dimVisitcount)
    //console.log(totalDimVisitcount)

    const activeSelection = current_color && current_color[0] && current_color[0].content
        ? current_color[0].content
        : new Set()

    setRanges(data, dimensions)
    minMaxMed(activeSelection, dimensions, data)
    container.select("thead").html("")
    
    let th = container.select("thead").append("tr")
    .selectAll("th")
    .data( [...dimensions] )
    let thEnter = th.join("th")
    .text(function(d) {
        return d;
    })

    let barwidth = d3.scaleLinear()
    .domain([0, Math.max(1, totalDimVisitcount)])
    .range([ 0, 40 ])

    let prov = container.select("thead").append("tr")
    .selectAll("th")
    .data( [...dimensions] )

    let thEnter2 = prov.join("th")
    .append("svg")
    .attr("width", 40).attr("height", 20)
    let bar = thEnter2.append("g")
    bar.append("rect").attr("width", "100%").attr("height", "100%").attr("fill", "lightgray")
    bar.append("rect").attr("width", d => {
        if (!totalDimVisitcount) return 0
        return barwidth(dimVisitcount[d] || 0)
    }).attr("height", "100%").attr("fill", "DeepSkyBlue"  ) //d => { return barcolor(  dimVisitcount[d])} 

    //////
    let minMaxDisplay = container.select("thead").append("tr")
    .selectAll("th") 
    .data( [...dimensions] )

    //console.lag([...dimensions] )
    let thEnter3 = minMaxDisplay.join("th")
    .text((d)=>{
       //console.lag(variance[d], mean[d],ranges[d], MinOrMax(variance[d], mean[d],ranges[d]) ); 
       return MinOrMax(variance[d], mean[d],ranges[d])
    })
 

}

let resetProv = () => {
    Object.keys(viewVisitcount).forEach(function(key) {
        viewVisitcount[key] = 0
    })
    d3.selectAll(".splom .splom-plot").classed("splom-active", false).classed("splom-hover", false);
    d3.select(".splom").classed("has-active", false);

    Object.keys(dimVisitcount).forEach(function(key) {
        dimVisitcount[key] = 0
    })
    Object.keys(maxSplomAcc).forEach(function(key) {
        maxSplomAcc[key] = 0
    })
    maxSplomAcc["v"] = 1

     
    totalDimVisitcount = 0
    refreshSplomHeatFromVisitCounts()
    if (datum && countTable) updateCountTable(datum, countTable)
    if (tableView_table) refreshTableView()
    refreshSplomAfterSelection(null, true)
    updateMainViewClickCount()

}

function resetSessionHistory() {
    resetProv();
    savedEntries = [];
    viewHistory = [];
    savedFavs = [];
    savedFavsEntries = [];
    favIndex = [];
    finalLog = [];
    cache = [];
    globalLoss = 0;
}

function downloadLogFile(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function showDatasetSwitchModal(proceed, cancel) {
    if (document.getElementById('vispromDatasetSwitchModal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'vispromDatasetSwitchModal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Switch dataset');
    overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483647',
        'background:rgba(0,0,0,0.45)', 'display:flex',
        'align-items:center', 'justify-content:center'
    ].join(';');

    const box = document.createElement('div');
    box.style.cssText = [
        'background:#fff', 'padding:24px 28px', 'border-radius:10px',
        'min-width:360px', 'max-width:92vw',
        'box-shadow:0 8px 32px rgba(0,0,0,0.18)', 'font-family:Arial,Helvetica,sans-serif'
    ].join(';');

    const title = document.createElement('p');
    title.textContent = 'Switch dataset?';
    title.style.cssText = 'margin:0 0 10px;font-size:16px;font-weight:600;color:#111';

    const message = document.createElement('p');
    message.textContent = 'Do you want to save your history/log before switching datasets?';
    message.style.cssText = 'margin:0 0 18px;font-size:14px;line-height:1.45;color:#374151';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end';

    function closeModal() {
        overlay.remove();
    }

    function makeBtn(label, primary) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.style.cssText = [
            'padding:8px 14px', 'font-size:13px', 'cursor:pointer',
            'border-radius:6px', 'border:1px solid #767676',
            primary ? 'background:#d4f0ff;border-color:#3a80c2;font-weight:600' : 'background:#f8f8f8'
        ].join(';');
        return btn;
    }

    const saveBtn = makeBtn('Save log & switch', true);
    const discardBtn = makeBtn('Switch without saving', false);
    const stayBtn = makeBtn('Cancel', false);

    saveBtn.addEventListener('click', function () {
        downloadProvenanceLog();
        closeModal();
        proceed();
    });

    discardBtn.addEventListener('click', function () {
        resetSessionHistory();
        closeModal();
        proceed();
    });

    stayBtn.addEventListener('click', function () {
        closeModal();
        if (typeof cancel === 'function') cancel();
    });

    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
            closeModal();
            if (typeof cancel === 'function') cancel();
        }
    });

    actions.appendChild(stayBtn);
    actions.appendChild(discardBtn);
    actions.appendChild(saveBtn);
    box.appendChild(title);
    box.appendChild(message);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    saveBtn.focus();
}

function sessionHasHistory() {
    return savedEntries.length > 0 || viewHistory.length > 0;
}

function promptSaveLogBeforeDatasetSwitch(proceed, cancel) {
    if (!sessionHasHistory()) {
        proceed();
        return;
    }

    showDatasetSwitchModal(proceed, cancel);
}

let viewToDimCount = () => {
    Object.keys(dimVisitcount).forEach(function(key) {
        dimVisitcount[key] = 0
    }) 
    totalDimVisitcount  = 0

    for(ds of Object.keys(viewVisitcount)){
        const pairPart = ds.indexOf("|") >= 0 ? ds.slice(ds.indexOf("|") + 1) : ds
        let d = pairPart.split('_')
        //console.log(d)
        dimVisitcount[d[0]] += viewVisitcount[ds]
        dimVisitcount[d[1]] += viewVisitcount[ds]
        totalDimVisitcount  += viewVisitcount[ds]
    }

}