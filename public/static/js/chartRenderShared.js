/**
 * Shared chart row preparation and mini-scatter drawing for Main Chart + SPLOM.
 * Selection/highlight classification uses the same provider semantics as scaterplot.js.
 */

const d3 = require("d3")
const columnMetadata = require("./columnMetadata")

const DEFAULT_BASE_ALPHA = 0.12
const DEFAULT_HIGHLIGHT_ALPHA = 0.92
const DEFAULT_BASE_RADIUS = 1.4
const DEFAULT_HIGHLIGHT_RADIUS = 2

let selectionCheckProvider = function () { return false }
let densityModeProvider = function () { return false }
let displayColorProvider = function () { return null }

function setSelectionCheckProvider(fn) {
    selectionCheckProvider = typeof fn === "function" ? fn : function () { return false }
}

function setDensityModeProvider(fn) {
    densityModeProvider = typeof fn === "function" ? fn : function () { return false }
}

function setDisplayColorProvider(fn) {
    displayColorProvider = typeof fn === "function" ? fn : function () { return null }
}

function isRowSelected(row) {
    if (!row) return false
    try {
        return !!selectionCheckProvider(row)
    } catch (e) {
        return false
    }
}

function colorObjectToRgbaArray(colorObj) {
    if (!colorObj) return null
    if (colorObj.string) {
        try {
            const parsed = d3.color(colorObj.string)
            if (parsed) {
                return [
                    parsed.r / 255,
                    parsed.g / 255,
                    parsed.b / 255,
                    parsed.opacity != null ? parsed.opacity : 1
                ]
            }
        } catch (e) { /* ignore */ }
    }
    if (colorObj.array && colorObj.array.length >= 3) {
        return colorObj.array.slice()
    }
    return null
}

function topPointColor(row) {
    if (!row) return null
    try {
        const fromProvider = displayColorProvider(row.row || row)
        if (fromProvider) {
            const rgba = colorObjectToRgbaArray(fromProvider)
            if (rgba) return rgba
        }
    } catch (e) { /* ignore */ }
    try {
        const raw = row.row || row
        const catFill = columnMetadata.getCategoryFillForRow(raw)
        if (catFill) return columnMetadata.hexToRgbaArray(catFill, DEFAULT_HIGHLIGHT_ALPHA)
    } catch (e) { /* ignore */ }
    const colorSet = row.color ? row.color : (row.row && row.row.color)
    const top = colorSet ? Array.from(colorSet).pop() : null
    if (!top) return null
    return colorObjectToRgbaArray(top)
}

function rgbaToStardust(rgba) {
    const out = rgba ? rgba.slice() : [0, 0, 1, 1]
    while (out.length < 3) out.push(0)
    if (out.length < 4) out.push(1)
    return out
}

function getChartRenderRows(data, xDim, yDim) {
    const rows = []
    if (!data || !xDim || !yDim) return rows
    const xCat = columnMetadata.isCategoricalDimension(xDim)
    const yCat = columnMetadata.isCategoricalDimension(yDim)
    for (let i = 0; i < data.length; i++) {
        const row = data[i]
        if (!row || row.visibility === false) continue
        let x
        let y
        if (xCat) {
            x = columnMetadata.getCategoryLabel(xDim, row[xDim])
            if (x === "" || x == null) continue
        } else {
            x = Number(row[xDim])
            if (!Number.isFinite(x)) continue
        }
        if (yCat) {
            y = columnMetadata.getCategoryLabel(yDim, row[yDim])
            if (y === "" || y == null) continue
        } else {
            y = Number(row[yDim])
            if (!Number.isFinite(y)) continue
        }
        const rowId = row.__rowId != null ? row.__rowId : (row.id != null ? row.id : i)
        rows.push({
            row: row,
            rowId: rowId,
            x: x,
            y: y,
            xCategorical: xCat,
            yCategorical: yCat,
            selected: false,
            highlighted: false
        })
    }
    return rows
}

function applySelectionToRows(rows, selectedIdSet) {
    if (!rows || !rows.length) return rows
    const hasSet = selectedIdSet && typeof selectedIdSet.has === "function"
    for (let i = 0; i < rows.length; i++) {
        const entry = rows[i]
        const selected = hasSet
            ? (selectedIdSet.has(entry.rowId) || isRowSelected(entry.row))
            : isRowSelected(entry.row)
        entry.selected = selected
        entry.highlighted = selected
    }
    return rows
}

function buildPairScales(domainMap, xDim, yDim, cellW, cellH, pad) {
    const cw = Math.max(1, Math.round(cellW))
    const ch = Math.max(1, Math.round(cellH))
    const padding = pad != null ? pad : Math.max(2, Math.floor(Math.min(cw, ch) * 0.08))
    const xCat = columnMetadata.isCategoricalDimension(xDim)
    const yCat = columnMetadata.isCategoricalDimension(yDim)

    let xScale
    let yScale
    if (xCat) {
        const xDomain = (domainMap && domainMap[xDim] && domainMap[xDim].categories)
            ? domainMap[xDim].categories
            : columnMetadata.getCategoryDomain(xDim)
        xScale = d3.scalePoint().domain(xDomain.length ? xDomain : ["?"]).range([padding, cw - padding]).padding(0.5)
    } else {
        const xDomain = (domainMap && domainMap[xDim] && Array.isArray(domainMap[xDim]))
            ? domainMap[xDim]
            : ((domainMap && domainMap[xDim] && domainMap[xDim].extent) || [0, 1])
        xScale = d3.scaleLinear().domain(xDomain).range([padding, cw - padding])
    }
    if (yCat) {
        const yDomain = (domainMap && domainMap[yDim] && domainMap[yDim].categories)
            ? domainMap[yDim].categories
            : columnMetadata.getCategoryDomain(yDim)
        yScale = d3.scalePoint().domain(yDomain.length ? yDomain : ["?"]).range([ch - padding, padding]).padding(0.5)
    } else {
        const yDomain = (domainMap && domainMap[yDim] && Array.isArray(domainMap[yDim]))
            ? domainMap[yDim]
            : ((domainMap && domainMap[yDim] && domainMap[yDim].extent) || [0, 1])
        yScale = d3.scaleLinear().domain(yDomain).range([ch - padding, padding])
    }
    return {
        xScale: xScale,
        yScale: yScale,
        cw: cw,
        ch: ch,
        pad: padding,
        xCategorical: xCat,
        yCategorical: yCat,
        xDim: xDim,
        yDim: yDim
    }
}

function countColoredMemberships(entry) {
    if (!entry) return 0
    const row = entry.row || entry
    const colorSet = row && row.color
    if (!colorSet || typeof colorSet.size !== "number") return entry.selected ? 1 : 0
    let n = 0
    colorSet.forEach(function (c) {
        if (c && c.cname && c.cname !== "Blue") n += 1
    })
    return n
}

function getPointStyle(entry, options) {
    const opts = options || {}
    const densityMode = opts.densityMode != null ? opts.densityMode : densityModeProvider()
    const baseAlpha = opts.baseAlpha != null ? opts.baseAlpha : DEFAULT_BASE_ALPHA
    const highlightAlpha = opts.highlightAlpha != null ? opts.highlightAlpha : DEFAULT_HIGHLIGHT_ALPHA
    const selected = !!(opts.forceHighlight || (entry && (entry.selected || entry.highlighted)))
    const overlapCount = countColoredMemberships(entry)
    const isOverlap = overlapCount > 1
    const hasActiveSelection = !!opts.hasActiveSelection

    if (!selected) {
        let baseRgba = opts.baseColorRgba || [0, 0, 1, baseAlpha]
        try {
            const raw = entry && (entry.row || entry)
            const catFill = columnMetadata.getCategoryFillForRow(raw)
            if (catFill) {
                baseRgba = columnMetadata.hexToRgbaArray(
                    catFill,
                    hasActiveSelection ? Math.min(baseAlpha, 0.18) : 0.55
                )
            }
        } catch (e) { /* ignore */ }
        return {
            rgba: baseRgba.slice(),
            radius: opts.baseRadius != null ? opts.baseRadius : DEFAULT_BASE_RADIUS,
            overlap: false
        }
    }

    const radius = opts.highlightRadius != null
        ? opts.highlightRadius
        : (opts.baseRadius != null ? opts.baseRadius : DEFAULT_HIGHLIGHT_RADIUS)
    const overlapRadius = isOverlap ? Math.max(radius + 0.8, 2.6) : radius
    if (opts.previewHighlightRgba) {
        return {
            rgba: opts.previewHighlightRgba.slice(),
            radius: overlapRadius,
            overlap: isOverlap
        }
    }
    if (opts.highlightColorRgba) {
        return {
            rgba: opts.highlightColorRgba.slice(),
            radius: overlapRadius,
            overlap: isOverlap
        }
    }
    const top = topPointColor(entry.row)
    if (!top) {
        return {
            rgba: [0, 1, 0, highlightAlpha],
            radius: overlapRadius,
            overlap: isOverlap
        }
    }
    const rgba = rgbaToStardust(top)
    rgba[3] = densityMode ? highlightAlpha : (top[3] != null ? top[3] : highlightAlpha)
    return {
        rgba: rgba,
        radius: overlapRadius,
        overlap: isOverlap
    }
}

function rgbaToCanvasStyle(rgba) {
    const r = Math.round(Math.max(0, Math.min(1, rgba[0] || 0)) * 255)
    const g = Math.round(Math.max(0, Math.min(1, rgba[1] || 0)) * 255)
    const b = Math.round(Math.max(0, Math.min(1, rgba[2] || 0)) * 255)
    const a = rgba[3] != null ? rgba[3] : 1
    return "rgba(" + r + "," + g + "," + b + "," + a + ")"
}

function projectPoint(d, xScale, yScale, options) {
    const opts = options || {}
    const xCat = opts.xCategorical != null ? opts.xCategorical : !!(d && d.xCategorical)
    const yCat = opts.yCategorical != null ? opts.yCategorical : !!(d && d.yCategorical)
    const xDim = opts.xDim
    const yDim = opts.yDim
    let px = xScale(d.x)
    let py = yScale(d.y)
    const jitterAmt = opts.jitterAmount != null
        ? opts.jitterAmount
        : Math.max(3, Math.min(8, Math.floor(Math.min(
            (opts.width || 40),
            (opts.height || 40)
        ) * 0.12)))
    if (xCat && Number.isFinite(px)) {
        px += columnMetadata.jitterValue(d.rowId, xDim || "x", jitterAmt)
    }
    if (yCat && Number.isFinite(py)) {
        py += columnMetadata.jitterValue(d.rowId, yDim || "y", jitterAmt)
    }
    return { px: px, py: py }
}

function drawMiniScatterplot(Stardust, tempCanvas, targetCanvas, rows, xScale, yScale, options) {
    const opts = options || {}
    const cw = opts.width || targetCanvas.width || (tempCanvas && tempCanvas.width)
    const ch = opts.height || targetCanvas.height || (tempCanvas && tempCanvas.height)
    const ctx = targetCanvas.getContext("2d")
    if (!ctx || !cw || !ch) return

    ctx.clearRect(0, 0, cw, ch)
    if (!rows || !rows.length) return

    const drawOpts = Object.assign({}, opts, {
        width: cw,
        height: ch
    })

    let needsSort = false
    for (let i = 0; i < rows.length; i++) {
        if (rows[i] && (rows[i].selected || rows[i].highlighted)) {
            needsSort = true
            break
        }
    }
    const drawList = needsSort
        ? rows.slice().sort(function (a, b) {
            const as = (a.selected || a.highlighted) ? 1 : 0
            const bs = (b.selected || b.highlighted) ? 1 : 0
            return as - bs
        })
        : rows

    for (let i = 0; i < drawList.length; i++) {
        const d = drawList[i]
        const pos = projectPoint(d, xScale, yScale, drawOpts)
        const px = pos.px
        const py = pos.py
        if (!Number.isFinite(px) || !Number.isFinite(py)) continue
        const style = getPointStyle(d, opts)
        if (opts.pointShape === "x") {
            const half = Math.max(2, style.radius + 0.4)
            ctx.strokeStyle = rgbaToCanvasStyle(style.rgba)
            ctx.lineWidth = d && (d.selected || d.highlighted) ? 1.8 : 1.1
            ctx.beginPath()
            ctx.moveTo(px - half, py - half)
            ctx.lineTo(px + half, py + half)
            ctx.moveTo(px - half, py + half)
            ctx.lineTo(px + half, py - half)
            ctx.stroke()
        } else {
            ctx.beginPath()
            ctx.arc(px, py, style.radius, 0, Math.PI * 2)
            ctx.fillStyle = rgbaToCanvasStyle(style.rgba)
            ctx.fill()
            const colorBy = columnMetadata.getActiveColorBy()
            if (style.overlap || (d && d.selected && colorBy && colorBy !== "selection")) {
                ctx.strokeStyle = "#111827"
                ctx.lineWidth = style.overlap ? 1.5 : 1.2
                ctx.stroke()
            }
        }
    }
}

module.exports = {
    DEFAULT_BASE_ALPHA: DEFAULT_BASE_ALPHA,
    DEFAULT_HIGHLIGHT_ALPHA: DEFAULT_HIGHLIGHT_ALPHA,
    setSelectionCheckProvider: setSelectionCheckProvider,
    setDensityModeProvider: setDensityModeProvider,
    setDisplayColorProvider: setDisplayColorProvider,
    isRowSelected: isRowSelected,
    getChartRenderRows: getChartRenderRows,
    applySelectionToRows: applySelectionToRows,
    buildPairScales: buildPairScales,
    getPointStyle: getPointStyle,
    projectPoint: projectPoint,
    drawMiniScatterplot: drawMiniScatterplot
}
