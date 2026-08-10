/**
 * Shared chart row preparation and mini-scatter drawing for Main Chart + SPLOM.
 * Selection/highlight classification uses the same provider semantics as scaterplot.js.
 */

const d3 = require("d3")

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

function topPointColor(row) {
    if (!row) return null
    try {
        const fromProvider = displayColorProvider(row.row || row)
        if (fromProvider && fromProvider.array) return fromProvider.array.slice()
    } catch (e) { /* ignore */ }
    const colorSet = row.color ? row.color : (row.row && row.row.color)
    const top = colorSet ? Array.from(colorSet).pop() : null
    if (!top || !top.array) return null
    return top.array.slice()
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
    for (let i = 0; i < data.length; i++) {
        const row = data[i]
        if (!row || row.visibility === false) continue
        const x = Number(row[xDim])
        const y = Number(row[yDim])
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue
        const rowId = row.__rowId != null ? row.__rowId : (row.id != null ? row.id : i)
        rows.push({
            row: row,
            rowId: rowId,
            x: x,
            y: y,
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
    const xDomain = (domainMap && domainMap[xDim]) || [0, 1]
    const yDomain = (domainMap && domainMap[yDim]) || [0, 1]
    const xScale = d3.scaleLinear().domain(xDomain).range([padding, cw - padding])
    const yScale = d3.scaleLinear().domain(yDomain).range([ch - padding, padding])
    return { xScale: xScale, yScale: yScale, cw: cw, ch: ch, pad: padding }
}

function getPointStyle(entry, options) {
    const opts = options || {}
    const densityMode = opts.densityMode != null ? opts.densityMode : densityModeProvider()
    const baseAlpha = opts.baseAlpha != null ? opts.baseAlpha : DEFAULT_BASE_ALPHA
    const highlightAlpha = opts.highlightAlpha != null ? opts.highlightAlpha : DEFAULT_HIGHLIGHT_ALPHA
    const selected = !!(opts.forceHighlight || (entry && (entry.selected || entry.highlighted)))

    if (!selected) {
        const baseRgba = opts.baseColorRgba || [0, 0, 1, baseAlpha]
        return {
            rgba: baseRgba.slice(),
            radius: opts.baseRadius != null ? opts.baseRadius : DEFAULT_BASE_RADIUS
        }
    }

    const radius = opts.highlightRadius != null
        ? opts.highlightRadius
        : (opts.baseRadius != null ? opts.baseRadius : DEFAULT_HIGHLIGHT_RADIUS)
    if (opts.previewHighlightRgba) {
        return {
            rgba: opts.previewHighlightRgba.slice(),
            radius: radius
        }
    }
    if (opts.highlightColorRgba) {
        return {
            rgba: opts.highlightColorRgba.slice(),
            radius: radius
        }
    }
    const top = topPointColor(entry.row)
    if (!top) {
        return {
            rgba: [0, 1, 0, highlightAlpha],
            radius: radius
        }
    }
    const rgba = rgbaToStardust(top)
    rgba[3] = densityMode ? highlightAlpha : (top[3] != null ? top[3] : highlightAlpha)
    return {
        rgba: rgba,
        radius: radius
    }
}

function rgbaToCanvasStyle(rgba) {
    const r = Math.round(Math.max(0, Math.min(1, rgba[0] || 0)) * 255)
    const g = Math.round(Math.max(0, Math.min(1, rgba[1] || 0)) * 255)
    const b = Math.round(Math.max(0, Math.min(1, rgba[2] || 0)) * 255)
    const a = rgba[3] != null ? rgba[3] : 1
    return "rgba(" + r + "," + g + "," + b + "," + a + ")"
}

function drawMiniScatterplot(Stardust, tempCanvas, targetCanvas, rows, xScale, yScale, options) {
    const opts = options || {}
    const cw = opts.width || targetCanvas.width || (tempCanvas && tempCanvas.width)
    const ch = opts.height || targetCanvas.height || (tempCanvas && tempCanvas.height)
    const ctx = targetCanvas.getContext("2d")
    if (!ctx || !cw || !ch) return

    ctx.clearRect(0, 0, cw, ch)
    if (!rows || !rows.length) return

    // Draw unselected first, selected last so highlights sit on top in one pass.
    const sorted = rows.slice().sort(function (a, b) {
        const as = (a.selected || a.highlighted) ? 1 : 0
        const bs = (b.selected || b.highlighted) ? 1 : 0
        return as - bs
    })

    // Canvas2D is more reliable than WebGL→drawImage in Chrome (preserveDrawingBuffer).
    for (let i = 0; i < sorted.length; i++) {
        const d = sorted[i]
        const px = xScale(d.x)
        const py = yScale(d.y)
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
    drawMiniScatterplot: drawMiniScatterplot
}
