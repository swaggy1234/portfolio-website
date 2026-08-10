const d3 = require("d3")
const Stardust = require("stardust-core")
const StardustWebGL = require("stardust-webgl")
const splomCache = require("./splomCache.js")
const chartRender = require("./chartRenderShared.js")
const comparisonDataset = require("./comparisonDataset.js")

const SPLom_CELL_BASE_PX = 72
const SPLOM_REDRAW_BATCH = 16

let splomOverviewOptions = {
    padding: 0.06,
    useRobustDomain: false,
    robustLow: 0.01,
    robustHigh: 0.99,
    drawContours: false,
    contourThresholds: 8,
    contourBandwidth: 20,
    contourStrokeOpacity: 0.3,
    contourStrokeWidth: 0.85,
    minContourPoints: 25,
    baseAlpha: 0.22,
    highlightAlpha: 0.92
}

let splomLazyObserver = null
let splomLazyScrollRoot = null
let splomLazyScrollHandler = null
let splomLazyScrollFrame = null
let splomRedrawToken = 0
let splomFamilyToggleHandler = null
let splomVisitCountKeyFn = null
let splomCellDblClickHandler = null
let temp = document.createElement("canvas")

const resolveSplomVisitKey = (xDim, yDim, cellEl) => {
    if (typeof splomVisitCountKeyFn === "function") {
        return splomVisitCountKeyFn(xDim, yDim, cellEl || null)
    }
    return xDim + "_" + yDim
}

const getVisitSoucheKeyForCell = (compareMode, triangleSource, opts) => {
    if (compareMode) {
        if (triangleSource === "upper") {
            return String(opts.upperSouche || opts.comparisonLabel || "upper")
        }
        return String(opts.lowerSouche || opts.primaryLabel || "lower")
    }
    if (opts && opts.visitSoucheKey) return String(opts.visitSoucheKey)
    if (typeof splomVisitCountKeyFn === "function") {
        const fullKey = splomVisitCountKeyFn("", "", null)
        const pipeIdx = fullKey.indexOf("|")
        return pipeIdx >= 0 ? fullKey.slice(0, pipeIdx) : "__ALL__"
    }
    return "__ALL__"
}

const roundSplomPx = (n) => Math.max(1, Math.round(Number(n) || 0))

const measureSplomGrid = (cellSize, numDims, dims) => {
    const w = roundSplomPx(cellSize)
    const gap = getSplomGap(w)
    const labelColWidth = dims && dims.length ? getLabelColWidth(dims, w) : w + 36
    const headerH = getSplomHeaderHeight(w)
    const totalW = labelColWidth + numDims * w + gap * numDims
    const totalH = headerH + numDims * w + gap * numDims
    return { w: w, gap: gap, labelColWidth: labelColWidth, headerH: headerH, totalW: totalW, totalH: totalH }
}

const getSplomCellSize = () => SPLom_CELL_BASE_PX

const getSplomGap = (cellSize) => Math.max(4, Math.floor(cellSize * 0.1))

const getLabelColWidth = (dims, cellSize) => {
    const maxChars = dims.reduce((m, d) => Math.max(m, String(d).length), 0)
    return Math.min(280, Math.max(cellSize + 36, maxChars * 8))
}

const splitLabelLines = (text, maxCharsPerLine) => {
    const words = String(text).split(/\s+/).filter(Boolean)
    if (!words.length) return [""]
    const lines = []
    let current = words[0]
    for (let i = 1; i < words.length; i++) {
        const candidate = current + " " + words[i]
        if (candidate.length <= maxCharsPerLine) current = candidate
        else {
            lines.push(current)
            current = words[i]
        }
    }
    lines.push(current)
    return lines
}

const drawWrappedLabel = (svg, text, maxWidth, x, y, anchor) => {
    const charsPerLine = Math.max(5, Math.floor(maxWidth / 7))
    const lines = splitLabelLines(text, charsPerLine)
    const lineHeight = 13
    const startY = y - ((lines.length - 1) * lineHeight) / 2
    const label = svg.append("text")
        .attr("x", x)
        .attr("y", startY)
        .attr("text-anchor", anchor)
        .style("font-size", "12px")
        .style("font-weight", "600")
    lines.forEach((line, idx) => {
        label.append("tspan").attr("x", x).attr("dy", idx === 0 ? 0 : lineHeight).text(line)
    })
}

const getSplomHeaderHeight = (cellW) => roundSplomPx(cellW)

const getSplomToolbarMount = (splomContainer) => {
    if (!splomContainer || splomContainer.empty()) return null
    const explicit = document.getElementById("splom-family-toolbar-mount")
    if (explicit) return d3.select(explicit)
    const splomNode = splomContainer.node()
    if (!splomNode || !splomNode.closest) return null
    const panelBody = splomNode.closest(".panel-splom .panel-body")
    if (!panelBody) return null
    let mount = panelBody.querySelector("#splom-family-toolbar-mount")
    if (!mount) {
        mount = document.createElement("div")
        mount.id = "splom-family-toolbar-mount"
        mount.className = "splom-family-toolbar-mount"
        panelBody.insertBefore(mount, splomNode)
    }
    return d3.select(mount)
}

const setSplomToolbarMountVisible = (mount, visible) => {
    if (!mount || mount.empty()) return
    const node = mount.node()
    if (!node) return
    if (visible) {
        node.hidden = false
        mount.style("display", null)
    } else {
        node.hidden = true
        mount.style("display", "none")
    }
}

const renderSplomFamilyToolbar = (container, familyLayout) => {
    if (!familyLayout || !familyLayout.allFamilies || !familyLayout.allFamilies.length) return
    const expandedSet = new Set(familyLayout.expanded || [])
    const toolbar = container.append("div")
        .attr("class", "splom-family-toolbar")

    toolbar.append("span")
        .attr("class", "splom-family-toolbar-label")
        .text("Families:")

    familyLayout.allFamilies.forEach(function (fam) {
        const isExpanded = expandedSet.has(fam.name)
        toolbar.append("button")
            .attr("type", "button")
            .attr("class", "splom-family-chip" + (isExpanded ? " is-expanded" : " is-collapsed"))
            .attr("data-family", fam.name)
            .attr("title", isExpanded ? "Collapse " + fam.name : "Expand " + fam.name)
            .text((isExpanded ? "– " : "+ ") + fam.name + " (" + fam.dimCount + ")")
            .on("click", function () {
                if (typeof splomFamilyToggleHandler === "function") {
                    splomFamilyToggleHandler(fam.name)
                }
            })
    })
}

const renderSplomFamilyColumnBand = (parent, familyLayout, labelColWidth, w, gap, rowTemplate) => {
    if (!familyLayout || !familyLayout.groups || !familyLayout.groups.length) return
    const band = parent.append("div")
        .attr("class", "splom-family-col-band")
        .style("display", "grid")
        .style("grid-template-columns", rowTemplate)
        .style("column-gap", gap + "px")
        .style("align-items", "stretch")

    band.append("div")
        .attr("class", "splom-family-band-corner")
        .style("width", labelColWidth + "px")

    let colIndex = 2
    familyLayout.groups.forEach(function (group, gi) {
        const span = group.dims.length
        const cell = band.append("div")
            .attr("class", "splom-family-col-group")
            .attr("data-family", group.name)
            .style("grid-column", colIndex + " / span " + span)
        colIndex += span

        cell.append("button")
            .attr("type", "button")
            .attr("class", "splom-family-band-toggle")
            .text("– " + group.name)
            .on("click", function () {
                if (typeof splomFamilyToggleHandler === "function") {
                    splomFamilyToggleHandler(group.name)
                }
            })

        if (gi < familyLayout.groups.length - 1) {
            cell.style("border-right", "2px solid #cbd5e1")
        }
    })
}

const drawColumnHeaderLabel = (svg, text, w, headerH) => {
    const label = String(text)
    const fontSize = Math.min(11, Math.max(7, Math.floor(Math.min(w, headerH) / Math.max(3.5, label.length * 0.55))))
    const cx = w / 2
    const cy = headerH / 2
    svg.style("overflow", "hidden")
    svg.append("text")
        .attr("x", cx)
        .attr("y", cy)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("transform", "rotate(-90," + cx + "," + cy + ")")
        .style("font-size", fontSize + "px")
        .style("font-weight", "600")
        .text(label)
}

const getNumericValues = (data, dimension) => {
    const values = []
    if (!data || !dimension) return values
    for (const row of data) {
        const v = Number(row[dimension])
        if (Number.isFinite(v)) values.push(v)
    }
    return values
}

const getGlobalDomain = (data, dimension, padding, options) => {
    const pad = padding != null ? padding : splomOverviewOptions.padding
    const opts = options || splomOverviewOptions
    const values = getNumericValues(data, dimension)
    if (!values.length) return [0, 1]

    let min = d3.min(values)
    let max = d3.max(values)

    if (opts.useRobustDomain) {
        const sorted = values.slice().sort((a, b) => a - b)
        const lo = d3.quantile(sorted, opts.robustLow != null ? opts.robustLow : 0.01)
        const hi = d3.quantile(sorted, opts.robustHigh != null ? opts.robustHigh : 0.99)
        min = lo != null ? lo : sorted[0]
        max = hi != null ? hi : sorted[sorted.length - 1]
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
    if (min === max) {
        const flatPad = min === 0 ? 1 : Math.abs(min) * 0.1
        return [min - flatPad, max + flatPad]
    }

    const span = max - min
    const padAmt = span * pad
    return [min - padAmt, max + padAmt]
}

const getGlobalDomainCached = (data, dimension, padding, options) => {
    const opts = options || splomOverviewOptions
    const dataLength = data && data.length != null ? data.length : 0
    const key = splomCache.getDomainCacheKey(dimension, opts, dataLength)
    const cached = splomCache.getCachedDomain(key)
    if (cached) return cached.slice()
    const domain = getGlobalDomain(data, dimension, padding, opts)
    splomCache.setCachedDomain(key, domain.slice())
    return domain
}

const buildSplomDomainMap = (data, dimensions, options) => {
    const opts = Object.assign({}, splomOverviewOptions, options || {})
    const globalDomains = {}
    for (const dim of dimensions) {
        globalDomains[dim] = getGlobalDomainCached(data, dim, opts.padding, opts)
    }
    return globalDomains
}

const splomCanvasSel = (canvas) => (canvas && canvas.node ? canvas : d3.select(canvas))

const splomCellSel = (canvas) => {
    const canvasSel = splomCanvasSel(canvas)
    const node = canvasSel.node()
    if (!node || !node.parentNode) return canvasSel
    return d3.select(node.parentNode)
}

const getSplomPlotCanvas = (cellEl) => {
    if (!cellEl) return null
    return cellEl.querySelector("canvas.splom-plot") || cellEl.querySelector("canvas.splom-bg-canvas")
}

const heatBorderColors = [
    "#d1d5db",
    "#fca5a5",
    "#f87171",
    "#ef4444",
    "#b91c1c"
]

const heatBorderWidths = [
    "1.25px",
    "2px",
    "2.5px",
    "3px",
    "3.5px"
]

const heatShadows = [
    "none",
    "inset 0 0 0 1px rgba(248, 113, 113, 0.14)",
    "inset 0 0 0 1px rgba(239, 68, 68, 0.20)",
    "inset 0 0 0 1px rgba(220, 38, 38, 0.26)",
    "inset 0 0 0 1px rgba(185, 28, 28, 0.32)"
]

const heatBackgrounds = [
    "rgba(255, 255, 255, 0)",
    "rgba(254, 242, 242, 0.28)",
    "rgba(254, 202, 202, 0.38)",
    "rgba(252, 165, 165, 0.46)",
    "rgba(248, 113, 113, 0.54)"
]

const heatAlphas = [
    "0",
    "0.18",
    "0.24",
    "0.30",
    "0.38"
]

const heatOverlayColors = [
    "transparent",
    "rgba(248, 113, 113, 0.18)",
    "rgba(239, 68, 68, 0.24)",
    "rgba(220, 38, 38, 0.30)",
    "rgba(185, 28, 28, 0.38)"
]

/** Stepped ramp: 0, 1–3, 4–6, 7–10, 11+ clicks. */
function getHeatLevel(count) {
    if (!count || count <= 0) return 0
    if (count <= 3) return 1
    if (count <= 6) return 2
    if (count <= 10) return 3
    return 4
}

function applySplomHeatToCell(cellSelection, count) {
    const level = getHeatLevel(count)
    const safeCount = Number(count) || 0
    cellSelection
        .style("border-color", heatBorderColors[level])
        .style("border-width", heatBorderWidths[level])
        .style("border-style", "solid")
        .style("background-color", heatBackgrounds[level])
        .style("box-shadow", heatShadows[level])
        .attr("data-heat-level", String(level))
        .attr("data-heat-count", String(safeCount))
        .style("--splom-heat-alpha", heatAlphas[level])
        .style("--splom-heat-overlay", heatOverlayColors[level])
}

const configureSplomCell = (cellSel, w, h) => {
    const cw = roundSplomPx(w)
    const ch = roundSplomPx(h)
    cellSel
        .style("width", cw + "px")
        .style("height", ch + "px")
        .style("min-width", cw + "px")
        .style("min-height", ch + "px")
        .style("max-width", cw + "px")
        .style("max-height", ch + "px")
        .style("overflow", "hidden")
        .style("box-sizing", "border-box")
        .style("padding", "0")
        .style("margin", "0")
        .style("display", "block")
        .style("position", "relative")
    return { cw: cw, ch: ch }
}

const applySplomCanvasSize = (canvasSel, w, h) => {
    const cw = roundSplomPx(w)
    const ch = roundSplomPx(h)
    canvasSel
        .attr("width", cw)
        .attr("height", ch)
        .style("width", cw + "px")
        .style("height", ch + "px")
        .style("display", "block")
        .style("max-width", cw + "px")
        .style("max-height", ch + "px")
        .style("margin", "0")
        .style("padding", "0")
        .style("box-sizing", "border-box")
        .style("vertical-align", "top")
        .style("position", "relative")
        .style("z-index", "1")
    return { cw: cw, ch: ch }
}

const getOrCacheRenderRows = (data, xDim, yDim, cacheTag) => {
    const dataLength = data && data.length != null ? data.length : 0
    const key = splomCache.getRowsCacheKey(xDim, yDim, cacheTag, dataLength)
    const cached = splomCache.getCachedRows(key)
    if (cached) return cached
    const rows = chartRender.getChartRenderRows(data, xDim, yDim)
    splomCache.setCachedRows(key, rows)
    return rows
}

const buildContourSvgHtml = (rows, xScale, yScale, cw, ch, overviewOptions) => {
    const opts = Object.assign({}, splomOverviewOptions, overviewOptions || {})
    if (opts.drawContours === false) return null
    if (!rows || rows.length < (opts.minContourPoints || 25)) return null

    const projected = []
    for (let i = 0; i < rows.length; i++) {
        const px = xScale(rows[i].x)
        const py = yScale(rows[i].y)
        if (Number.isFinite(px) && Number.isFinite(py)) projected.push([px, py])
    }
    if (projected.length < (opts.minContourPoints || 25)) return null

    const cellSize = Math.max(1, Math.floor(Math.min(cw, ch)))
    const bandwidth = opts.contourBandwidth != null
        ? opts.contourBandwidth
        : Math.max(8, Math.min(24, Math.round(cellSize * 0.28)))

    let contours
    try {
        contours = d3.contourDensity()
            .x((d) => d[0])
            .y((d) => d[1])
            .size([Math.max(1, Math.floor(cw)), Math.max(1, Math.floor(ch))])
            .bandwidth(bandwidth)
            .thresholds(opts.contourThresholds || 8)(projected)
    } catch (e) {
        return null
    }
    if (!contours || !contours.length) return null

    const sortedContours = contours.slice().sort((a, b) => (a.value || 0) - (b.value || 0))
    const valueExtent = d3.extent(sortedContours, (d) => d.value)
    const contourColorScale = d3.scaleLinear()
        .domain(valueExtent)
        .range(["#fecaca", "#7f1d1d"])
    const fillOpacityScale = d3.scaleLinear()
        .domain(valueExtent)
        .range([0.06, 0.28])
    const strokeOpacityScale = d3.scaleLinear()
        .domain(valueExtent)
        .range([0.4, 0.88])

    const path = d3.geoPath()
    const holder = document.createElement("div")
    const svg = d3.select(holder).append("svg")
        .attr("class", "splom-contour-svg")
        .attr("width", cw)
        .attr("height", ch)
        .style("position", "absolute")
        .style("left", "0")
        .style("top", "0")
        .style("pointer-events", "none")
        .style("z-index", "0")
        .style("overflow", "hidden")

    svg.append("g")
        .selectAll("path")
        .data(sortedContours)
        .join("path")
        .attr("d", path)
        .attr("fill", (d) => contourColorScale(d.value))
        .attr("fill-opacity", (d) => fillOpacityScale(d.value))
        .attr("stroke", (d) => contourColorScale(d.value))
        .attr("stroke-width", opts.contourStrokeWidth || 0.85)
        .attr("stroke-opacity", (d) => strokeOpacityScale(d.value))

    return holder.innerHTML
}

const restoreContourSvg = (cell, contourHtml, cw, ch) => {
    cell.select(".splom-contour-svg").remove()
    if (!contourHtml) return
    const holder = cell.insert("div", ":first-child")
    holder.html(contourHtml)
    const svg = holder.select("svg")
    if (!svg.empty()) {
        svg.attr("width", cw).attr("height", ch)
            .style("width", cw + "px")
            .style("height", ch + "px")
    }
}

const ensureSplomContours = (cell, rows, scales, xDim, yDim, overviewOptions, cacheTag) => {
    const key = splomCache.getContourCacheKey(xDim, yDim, scales.cw, scales.ch, overviewOptions) + (cacheTag ? "|" + cacheTag : "")
    let contourHtml = splomCache.getCachedContour(key)
    if (!contourHtml) {
        contourHtml = buildContourSvgHtml(rows, scales.xScale, scales.yScale, scales.cw, scales.ch, overviewOptions)
        if (contourHtml) splomCache.setCachedContour(key, contourHtml)
    }
    restoreContourSvg(cell, contourHtml, scales.cw, scales.ch)
}

const applySplomHeat = (canvas, count) => {
    applySplomHeatToCell(splomCellSel(canvas), Number(count) || 0)
    splomCanvasSel(canvas)
        .style("border", "none")
        .style("outline", "none")
        .style("background-color", "transparent")
        .style("box-shadow", "none")
}

/** Same X/Y orientation for a dimension pair in both SPLOM triangles (lower-index dim on X). */
const getSplomCellAxes = (dim1, dim2, i, j, compareMode) => {
    if (compareMode && j > i) {
        return { xDim: dim1, yDim: dim2 }
    }
    return { xDim: dim2, yDim: dim1 }
}

const getSplomCellDataset = (cellEl, splomContainer, primaryData) => {
    const datasetSource = cellEl.getAttribute("data-dataset-source") || "primary"
    if (splomContainer.property("__splomCompareMode") && datasetSource === "comparison") {
        return splomContainer.property("__splomComparisonData") || primaryData
    }
    return primaryData
}

const redrawOneSplomCell = (cellEl, data, splomContainer, selectedIdSet, viewVisitcount, maxSplomAcc, options) => {
    const opts = options || {}
    const canvas = getSplomPlotCanvas(cellEl)
    if (!canvas) return false

    const xDim = canvas.getAttribute("xDim") || canvas.getAttribute("data-x-dim")
    const yDim = canvas.getAttribute("yDim") || canvas.getAttribute("data-y-dim")
    if (!xDim || !yDim) return false

    const datasetSource = cellEl.getAttribute("data-dataset-source") || "primary"
    const triangleSource = cellEl.getAttribute("data-triangle-source") || null
    const cellData = getSplomCellDataset(cellEl, splomContainer, data)

    const domainMap = splomContainer.property("__splomDomainMap")
    const overviewOptions = splomContainer.property("__splomOverviewOptions") || splomOverviewOptions
    const cellW = splomContainer.property("__splomCellSize")
    const cell = d3.select(cellEl)
    const canvasSel = d3.select(canvas)

    configureSplomCell(cell, cellW, cellW)
    const plotPad = Math.max(2, Math.floor(cellW * 0.04))
    const scales = chartRender.buildPairScales(domainMap, xDim, yDim, cellW, cellW, plotPad)
    applySplomCanvasSize(canvasSel, scales.cw, scales.ch)
    const baseRadius = Math.max(1.2, Math.min(2.8, cellW / 36))

    const baseRows = getOrCacheRenderRows(cellData, xDim, yDim, datasetSource)
    const rows = chartRender.applySelectionToRows(
        baseRows.map(function (r) {
            return { row: r.row, rowId: r.rowId, x: r.x, y: r.y, selected: false, highlighted: false }
        }),
        selectedIdSet
    )

    if (opts.drawContours !== false && overviewOptions.drawContours !== false && !opts.selectionOnly) {
        ensureSplomContours(cell, baseRows, scales, xDim, yDim, overviewOptions, datasetSource)
    } else if (opts.selectionOnly) {
        // Keep existing contours when only selection colors change.
    } else {
        cell.select(".splom-contour-svg").remove()
    }

    temp.width = scales.cw
    temp.height = scales.ch

    const drawOpts = {
        width: scales.cw,
        height: scales.ch,
        baseAlpha: overviewOptions.baseAlpha,
        highlightAlpha: overviewOptions.highlightAlpha,
        baseRadius: baseRadius,
        highlightRadius: Math.max(baseRadius + 0.6, 2),
        densityMode: false,
        previewHighlightRgba: opts.previewHighlightRgba || null
    }
    if (triangleSource === "upper") {
        drawOpts.pointShape = "x"
    }

    chartRender.drawMiniScatterplot(Stardust, temp, canvas, rows, scales.xScale, scales.yScale, drawOpts)

    canvasSel
        .attr("xDim", xDim)
        .attr("yDim", yDim)
        .attr("data-x-dim", xDim)
        .attr("data-y-dim", yDim)

    const acc = viewVisitcount && viewVisitcount[resolveSplomVisitKey(xDim, yDim, cellEl)]
    if (maxSplomAcc && parseInt(acc, 10) > maxSplomAcc.v) maxSplomAcc.v = parseInt(acc, 10)
    applySplomHeatToCell(cell, Number(acc) || 0)
    return true
}

const getSplomScrollRoot = (container) => {
    if (!container || !container.node) return null
    const node = container.node()
    // SPLOM scrolls inside .splom (overflow:auto), not .splom-panel-body (overflow:visible).
    if (node.classList && node.classList.contains("splom")) return node
    const scrollEl = node.closest ? node.closest(".panel-splom .splom") : null
    if (scrollEl) return scrollEl
    return node
}

const isSplomCellVisible = (cellEl, root) => {
    if (!cellEl) return false
    if (!root) return true
    const rect = cellEl.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    return rect.bottom >= rootRect.top - 300 && rect.top <= rootRect.bottom + 300
}

const getRenderedSplomCells = (splom) => {
    const cells = []
    if (!splom || splom.empty()) return cells
    splom.selectAll(".splom-cell[data-splom-rendered='1']").each(function () { cells.push(this) })
    return cells
}

const redrawSplomCellsInChunks = (cells, data, splom, selectedIdSet, viewVisitcount, maxSplomAcc, drawOptions, startIndex, token, onDone) => {
    if (token !== splomRedrawToken) return

    const end = Math.min(startIndex + SPLOM_REDRAW_BATCH, cells.length)
    let updated = 0

    for (let i = startIndex; i < end; i++) {
        if (redrawOneSplomCell(cells[i], data, splom, selectedIdSet, viewVisitcount, maxSplomAcc, drawOptions)) {
            updated += 1
        }
    }

    if (end < cells.length) {
        setTimeout(function () {
            redrawSplomCellsInChunks(cells, data, splom, selectedIdSet, viewVisitcount, maxSplomAcc, drawOptions, end, token, onDone)
        }, 0)
        return
    }

    if (onDone) onDone(updated)
}

const buildSelectedIdSetFromRows = (selectedRows) => {
    const set = new Set()
    if (!selectedRows) return set
    for (let i = 0; i < selectedRows.length; i++) {
        const row = selectedRows[i]
        if (!row) continue
        if (row.__rowId != null) set.add(row.__rowId)
        if (row.id != null) set.add(row.id)
    }
    return set
}

/** null => use live selectionCheckProvider (layer colors stay in sync with main chart). */
const resolveSplomSelectionIdSet = (selectedIdSet) => {
    if (selectedIdSet && typeof selectedIdSet.has === "function") return selectedIdSet
    return null
}

const renderSplomCellIfNeeded = (cellEl, splomContainer, data, selectedIdSet, overviewOptions, viewVisitcount, maxSplomAcc) => {
    if (!cellEl || cellEl.getAttribute("data-splom-rendered") === "1") return
    redrawOneSplomCell(
        cellEl,
        data,
        splomContainer,
        resolveSplomSelectionIdSet(selectedIdSet),
        viewVisitcount,
        maxSplomAcc,
        {}
    )
    cellEl.setAttribute("data-splom-rendered", "1")
    cellEl.removeAttribute("data-splom-pending")
}

const teardownSplomLazyObserver = (container) => {
    if (splomLazyObserver) {
        splomLazyObserver.disconnect()
        splomLazyObserver = null
    }
    if (splomLazyScrollRoot && splomLazyScrollHandler) {
        splomLazyScrollRoot.removeEventListener("scroll", splomLazyScrollHandler)
        splomLazyScrollRoot = null
        splomLazyScrollHandler = null
    }
    if (splomLazyScrollFrame) {
        cancelAnimationFrame(splomLazyScrollFrame)
        splomLazyScrollFrame = null
    }
    if (container && container.property) container.property("__splomLazyObserver", null)
}

const setupSplomLazyObserver = (container, data, selectedIdSet, overviewOptions, viewVisitcount, maxSplomAcc) => {
    teardownSplomLazyObserver(container)
    const root = getSplomScrollRoot(container)

    const runVisible = function () {
        container.selectAll(".splom-cell[data-splom-pending='1']").each(function () {
            if (!root) {
                renderSplomCellIfNeeded(this, container, data, selectedIdSet, overviewOptions, viewVisitcount, maxSplomAcc)
                return
            }
            const rect = this.getBoundingClientRect()
            const rootRect = root.getBoundingClientRect()
            if (rect.bottom >= rootRect.top - 300 && rect.top <= rootRect.bottom + 300) {
                renderSplomCellIfNeeded(this, container, data, selectedIdSet, overviewOptions, viewVisitcount, maxSplomAcc)
            }
        })
    }

    if (!root || typeof IntersectionObserver === "undefined") {
        runVisible()
        return
    }

    splomLazyObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                renderSplomCellIfNeeded(entry.target, container, data, selectedIdSet, overviewOptions, viewVisitcount, maxSplomAcc)
            }
        })
    }, { root: root, rootMargin: "300px", threshold: 0.01 })

    container.property("__splomLazyObserver", splomLazyObserver)
    container.selectAll(".splom-cell[data-splom-pending='1']").each(function () {
        splomLazyObserver.observe(this)
    })
    runVisible()

    if (root && root.addEventListener) {
        splomLazyScrollRoot = root
        splomLazyScrollHandler = function () {
            if (splomLazyScrollFrame) return
            splomLazyScrollFrame = requestAnimationFrame(function () {
                splomLazyScrollFrame = null
                runVisible()
            })
        }
        root.addEventListener("scroll", splomLazyScrollHandler, { passive: true })
    }
}

exports.setSplomSelectionCheckProvider = (fn) => {
    chartRender.setSelectionCheckProvider(fn)
}

exports.setSplomHighlightColors = (splom, colors) => {
    if (splom && !splom.empty()) splom.property("__splomHighlightColors", colors || [])
}

exports.setSplomFamilyToggleHandler = (fn) => {
    splomFamilyToggleHandler = typeof fn === "function" ? fn : null
}

exports.setSplomVisitCountKeyProvider = (fn) => {
    splomVisitCountKeyFn = typeof fn === "function" ? fn : null
}

function bindSplomCellDblClickHandlers(cellSel) {
    if (!splomCellDblClickHandler || !cellSel || !cellSel.node) return
    const node = cellSel.node()
    if (!node || node.__vispromSplomDblBound) return
    node.__vispromSplomDblBound = true

    function fireDblClick(e) {
        if (e) {
            e.preventDefault()
            e.stopPropagation()
        }
        const xDim = cellSel.attr("data-x-dim")
        const yDim = cellSel.attr("data-y-dim")
        splomCellDblClickHandler(node, xDim, yDim)
    }

    cellSel.on("dblclick.vispromCompare", fireDblClick)
    cellSel.select("canvas.splom-plot").on("dblclick.vispromCompare", fireDblClick)
}

exports.setSplomCellDblClickHandler = (fn) => {
    splomCellDblClickHandler = typeof fn === "function" ? fn : null
}

exports.renderSplomFamilyToolbarOnly = (container, familyLayout) => {
    if (!container || container.empty()) return
    const mount = getSplomToolbarMount(container)
    if (!mount || mount.empty()) return
    mount.selectAll(".splom-family-toolbar").remove()
    if (!familyLayout || !familyLayout.allFamilies || !familyLayout.allFamilies.length) {
        setSplomToolbarMountVisible(mount, false)
        return
    }
    setSplomToolbarMountVisible(mount, true)
    renderSplomFamilyToolbar(mount, familyLayout)
}

exports.createSplom = (data, container, dimensions, sampleData, viewVisitcount, overviewOptions, domainSourceDims, createOptions) => {
    if (!container || typeof container.property !== "function" || container.empty()) return

    const opts = createOptions || {}
    const mergedOverview = Object.assign({}, splomOverviewOptions, overviewOptions || {})
    splomOverviewOptions = Object.assign(splomOverviewOptions, mergedOverview)

    if (sampleData) sampleData.length = 0
    const dims = dimensions
    const domainDims = (domainSourceDims && domainSourceDims.length) ? domainSourceDims : dims
    const domainMap = opts.domainMap || buildSplomDomainMap(data, domainDims, mergedOverview)
    const splomNode = container.node ? container.node() : container
    const lazyRender = opts.lazyRender !== false

    const w = roundSplomPx(getSplomCellSize(splomNode, dims.length, dims))
    const h = w
    const headerH = getSplomHeaderHeight(w)

    teardownSplomLazyObserver(container)

    container.property("__splomDomainMap", domainMap)
    container.property("__splomOverviewData", data)
    container.property("__splomDimensions", dims.slice())
    container.property("__splomCellSize", w)
    container.property("__splomHighlightColors", container.property("__splomHighlightColors") || [])
    container.property("__splomFrontsKey", opts.frontsKey || "all-fronts")
    container.property("__splomOverviewOptions", mergedOverview)

    const familyLayout = opts.familyLayout || null
    container.property("__splomFamilyLayout", familyLayout)

    const compareMode = !!(opts.compareMode && opts.comparisonData && opts.comparisonData.length)
    container.property("__splomCompareMode", compareMode)
    container.property("__splomComparisonData", compareMode ? opts.comparisonData : null)
    container.property("__splomPrimaryLabel", opts.primaryLabel || "Dataset 1")
    container.property("__splomComparisonLabel", opts.comparisonLabel || "Dataset 2")

    const gap = getSplomGap(w)
    const labelColWidth = getLabelColWidth(dims, w)
    const rowTemplate = labelColWidth + "px repeat(" + dims.length + "," + w + "px)"

    container.html("")
    const splom = container

    splom.style("display", "flex")
        .style("flex-direction", "column")
        .style("row-gap", gap + "px")
        .style("width", "100%")

    if (compareMode) {
        const lowerLabel = opts.lowerSouche || opts.primaryLabel || "Dataset 1"
        const upperLabel = opts.upperSouche || opts.comparisonLabel || "Dataset 2"
        const legend = splom.append("div").attr("class", "splom-compare-legend")
        legend.append("span").attr("class", "splom-compare-legend-lower")
            .text("\u25CF Lower: " + lowerLabel)
        legend.append("span").attr("class", "splom-compare-legend-upper")
            .text("\u2715 Upper: " + upperLabel)
    }

    if (familyLayout && familyLayout.groups && familyLayout.groups.length) {
        renderSplomFamilyColumnBand(splom, familyLayout, labelColWidth, w, gap, rowTemplate)
    }

    const labelrow = splom.append("div").attr("id", "labels").attr("class", "splom-labels")
        .style("display", "grid")
        .style("grid-template-columns", rowTemplate)
        .style("column-gap", gap + "px")
        .style("align-items", "center")

    labelrow.append("div").style("width", labelColWidth + "px").style("height", headerH + "px")

    const dimToFamily = {}
    if (familyLayout && familyLayout.groups) {
        familyLayout.groups.forEach(function (group) {
            group.dims.forEach(function (d) { dimToFamily[d] = group.name })
        })
    }

    for (const dim2 of dims) {
        const headerCell = labelrow.append("svg")
            .attr("data-dim", dim2)
            .attr("data-family", dimToFamily[dim2] || "")
            .attr("class", "splom-col-header")
            .attr("width", w)
            .attr("height", headerH)
        drawColumnHeaderLabel(headerCell, dim2, w, headerH)
    }

    let plotIndex = 0
    let prevRowFamily = null
        
    for (const [i, dim1] of dims.entries()) {
        const rowFamily = dimToFamily[dim1] || ""
        const isFamilyStart = rowFamily && rowFamily !== prevRowFamily
        prevRowFamily = rowFamily
        
        const row = splom.append("div").attr("id", "row-" + dim1).attr("class", "splom-row")
            .attr("data-dim", dim1)
            .attr("data-family", rowFamily)
            .classed("splom-row-family-start", isFamilyStart)
            .style("display", "grid")
            .style("grid-template-columns", rowTemplate)
            .style("column-gap", gap + "px")
            .style("align-items", "center")

        const rowLabel = row.append("div")
            .attr("class", "splom-row-label-wrap")
            .style("width", labelColWidth + "px")
            .style("height", h + "px")
            .style("position", "relative")

        if (isFamilyStart) {
            rowLabel.append("button")
                .attr("type", "button")
                .attr("class", "splom-family-row-band")
                .text("– " + rowFamily)
                .on("click", function () {
                    if (typeof splomFamilyToggleHandler === "function") {
                        splomFamilyToggleHandler(rowFamily)
                    }
                })
        }

        rowLabel.append("svg")
            .attr("data-dim", dim1)
            .attr("width", labelColWidth)
        .attr("height", h)
        .style("overflow", "visible")
            .each(function () {
                drawWrappedLabel(d3.select(this), dim1, labelColWidth - 10, labelColWidth - 6, h / 2, "end")
            })

        for (const [j, dim2] of dims.entries()) {
            const pairKey = comparisonDataset.getPairKey(dim2, dim1)
            const shouldPlot = compareMode ? (j !== i) : (j <= i)
            const isDiagonal = compareMode && j === i

            if (isDiagonal) {
                const diag = row.append("div")
                    .attr("class", "splom-diag-cell")
                    .attr("data-col-dim", dim2)
                    .style("width", w + "px")
                    .style("height", h + "px")
                    .style("display", "flex")
                    .style("align-items", "center")
                    .style("justify-content", "center")
                    .style("font-size", "11px")
                    .style("font-weight", "600")
                    .style("color", "#6b7280")
                    .style("background", "#f9fafb")
                    .style("border", "1px solid #e5e7eb")
                    .style("box-sizing", "border-box")
                diag.append("span").text(dim1)
            } else if (shouldPlot) {
                const datasetSource = (compareMode && j > i) ? "comparison" : "primary"
                const triangleSource = compareMode ? ((j > i) ? "upper" : "lower") : null
                const soucheLabel = compareMode
                    ? ((j > i) ? (opts.upperSouche || opts.comparisonLabel || "upper") : (opts.lowerSouche || opts.primaryLabel || "lower"))
                    : null
                const axes = getSplomCellAxes(dim1, dim2, i, j, compareMode)
                const visitSoucheKey = getVisitSoucheKeyForCell(compareMode, triangleSource, opts)
                const curr = row.append("div").attr("class", "splom-cell")
                    .attr("data-col-dim", dim2)
                    .attr("data-x-dim", axes.xDim)
                    .attr("data-y-dim", axes.yDim)
                    .attr("data-plot-index", plotIndex)
                    .attr("data-pair-key", pairKey)
                    .attr("data-dataset-source", datasetSource)
                    .attr("data-triangle-source", triangleSource)
                    .attr("data-souche", soucheLabel)
                    .attr("data-visit-souche-key", visitSoucheKey)

                configureSplomCell(curr, w, h)

                const canvas = curr.append("canvas")
                    .attr("class", "splom-plot")
                    .attr("xDim", axes.xDim)
                    .attr("yDim", axes.yDim)
                    .attr("data-x-dim", axes.xDim)
                    .attr("data-y-dim", axes.yDim)
                    .attr("data-dataset-source", datasetSource)
                    .attr("acc", "0")

                applySplomCanvasSize(canvas, w, h)

                bindSplomCellDblClickHandlers(curr)

                if (viewVisitcount !== null) {
                    const visitKey = resolveSplomVisitKey(axes.xDim, axes.yDim, curr.node())
                    if (viewVisitcount[visitKey] === undefined) viewVisitcount[visitKey] = 0
                    applySplomHeatToCell(curr, Number(viewVisitcount[visitKey]) || 0)
                }

                if (lazyRender) {
                    curr.attr("data-splom-pending", "1").attr("data-splom-rendered", "0")
                } else {
                    redrawOneSplomCell(curr.node(), data, container, selectedIdSet, viewVisitcount, { v: 0 }, {})
                    curr.attr("data-splom-rendered", "1")
                }
                plotIndex += 1
            } else {
                row.append("div")
                    .attr("class", "splom-empty")
                    .attr("data-col-dim", dim2)
                    .style("width", w + "px")
                    .style("height", h + "px")
            }
        }
    }

    if (lazyRender) {
        setupSplomLazyObserver(container, data, null, mergedOverview, viewVisitcount, { v: 0 })
    }

    exports.renderSplomFamilyToolbarOnly(container, familyLayout)
}

exports.restoreSplomDimensionSet = (cachedSet, data, container, sampleData, viewVisitcount, overviewOptions, domainSourceDims, frontsKey, restoreOptions) => {
    if (!cachedSet || !container) return
    const extra = restoreOptions || {}
    const familyLayout = extra.familyLayout != null
        ? extra.familyLayout
        : (cachedSet.familyLayout || null)
    exports.createSplom(data, container, cachedSet.dimsForSplom, sampleData, viewVisitcount, overviewOptions, domainSourceDims, {
        domainMap: cachedSet.domainMap,
        lazyRender: true,
        frontsKey: frontsKey,
        familyLayout: familyLayout,
        compareMode: extra.compareMode,
        comparisonData: extra.comparisonData,
        primaryLabel: extra.primaryLabel,
        comparisonLabel: extra.comparisonLabel,
        lowerSouche: extra.lowerSouche,
        upperSouche: extra.upperSouche,
        visitSoucheKey: extra.visitSoucheKey
    })
}

exports.getHeatLevel = getHeatLevel

exports.applySplomHeatForVisitKey = (splom, visitKey, count, maxSplomAcc) => {
    if (!splom || splom.empty() || !visitKey) return
    const safeCount = Number(count) || 0
    if (maxSplomAcc && safeCount > maxSplomAcc.v) maxSplomAcc.v = safeCount
    splom.selectAll(".splom-cell").each(function () {
        const cell = d3.select(this)
        const xDim = cell.attr("data-x-dim")
        const yDim = cell.attr("data-y-dim")
        if (!xDim || !yDim) return
        if (resolveSplomVisitKey(xDim, yDim, this) !== visitKey) return
        applySplomHeatToCell(cell, safeCount)
    })
}

exports.updateSplomHeat = (splom, maxSplomAcc, viewVisitcount) => {
    if (!splom || splom.empty() || !viewVisitcount) return
    splom.selectAll(".splom-cell").each(function () {
        const cell = d3.select(this)
        const xDim = cell.attr("data-x-dim")
        const yDim = cell.attr("data-y-dim")
        if (!xDim || !yDim) return
        const acc = Number(viewVisitcount[resolveSplomVisitKey(xDim, yDim, this)]) || 0
        if (maxSplomAcc && acc > maxSplomAcc.v) maxSplomAcc.v = acc
        applySplomHeatToCell(cell, acc)
    })
}

exports.redrawSplomSelection = (data, splom, sampleData, selectedRows, highlightColors, maxSplomAcc, viewVisitcount, overrideIdSet) => {
    if (!splom || splom.empty()) return

    if (highlightColors) splom.property("__splomHighlightColors", highlightColors)
    const isPreview = overrideIdSet && typeof overrideIdSet.has === "function"
    const selectedIdSet = isPreview
        ? overrideIdSet
        : buildSelectedIdSetFromRows(selectedRows || [])
    if (!isPreview) {
        splom.property("__splomSelectedIdSet", selectedIdSet)
        splom.property("__splomSelectedRows", selectedRows || [])
    }

    const root = getSplomScrollRoot(splom)
    const allCells = getRenderedSplomCells(splom)
    const visibleCells = []
    const offscreenCells = []
    const drawOptions = {
        previewHighlightRgba: isPreview ? splom.property("__splomPreviewHighlightRgba") : null,
        selectionOnly: !isPreview
    }

    allCells.forEach(function (cellEl) {
        if (isSplomCellVisible(cellEl, root)) visibleCells.push(cellEl)
        else offscreenCells.push(cellEl)
    })

    splomRedrawToken += 1
    const token = splomRedrawToken

    for (let i = 0; i < visibleCells.length; i++) {
        if (token !== splomRedrawToken) return
        redrawOneSplomCell(visibleCells[i], data, splom, selectedIdSet, viewVisitcount, maxSplomAcc, drawOptions)
    }

    if (viewVisitcount) {
        exports.updateSplomHeat(splom, maxSplomAcc, viewVisitcount)
    }

    // Brush preview updates run frequently; keep them lightweight to avoid UI stalls.
    if (isPreview) return

    if (!offscreenCells.length) return

    redrawSplomCellsInChunks(offscreenCells, data, splom, selectedIdSet, viewVisitcount, maxSplomAcc, drawOptions, 0, token, null)
}

exports.updateSplomSelectionOverlay = exports.redrawSplomSelection
exports.scheduleSplomSelectionOverlayUpdate = exports.redrawSplomSelection
exports.refreshSplomDynamicLayers = exports.redrawSplomSelection
exports.refreshSplomHighlightPoints = exports.redrawSplomSelection

exports.updateSplom = (data, splom, sampleData, maxSplomAcc, viewVisitcount) => {
    if (!splom || splom.empty()) return
    const selectedRows = splom.property("__splomSelectedRows") || []
    exports.redrawSplomSelection(data, splom, sampleData, selectedRows, splom.property("__splomHighlightColors") || [], maxSplomAcc, viewVisitcount)
}

exports.buildSplomDomainMap = buildSplomDomainMap
exports.getOrComputeSplomDomainMap = (data, dimensions, domainSourceDims, overviewOptions) => {
    const domainDims = (domainSourceDims && domainSourceDims.length) ? domainSourceDims : dimensions
    return buildSplomDomainMap(data, domainDims, overviewOptions)
}
exports.getGlobalDomain = getGlobalDomain
exports.setSplomRowScopeKey = splomCache.setRowScopeKey
exports.getSplomRowScopeKey = splomCache.getRowScopeKey
exports.invalidateSplomCaches = splomCache.invalidateSplomCaches
exports.invalidateSplomRowsCache = splomCache.invalidateSplomRowsCache
exports.invalidateSplomDomainCache = splomCache.invalidateSplomDomainCache
exports.bumpSplomDatasetVersion = splomCache.bumpDatasetVersion
exports.getDimensionSetCacheKey = splomCache.getDimensionSetCacheKey
exports.getCachedDimensionSet = splomCache.getCachedDimensionSet
exports.setCachedDimensionSet = splomCache.setCachedDimensionSet
exports.teardownSplomLazyObserver = teardownSplomLazyObserver
exports.setSplomOverviewOptions = (options) => {
    splomOverviewOptions = Object.assign(splomOverviewOptions, options || {})
}
exports.getSplomOverviewOptions = () => Object.assign({}, splomOverviewOptions)
exports.getSplomCellSize = getSplomCellSize
exports.measureSplomGrid = measureSplomGrid

exports.relayoutSplomToFit = (data, container, sampleData, viewVisitcount, overviewOptions, domainSourceDims, createOptions) => {
    if (!container || container.empty()) return false
    const dims = container.property("__splomDimensions")
    if (!dims || !dims.length) return false
    const node = container.node()
    const newW = roundSplomPx(getSplomCellSize(node, dims.length, dims))
    const oldW = container.property("__splomCellSize")
    if (oldW === newW) return false
    const opts = createOptions || {}
    exports.createSplom(
        data,
        container,
        dims,
        sampleData,
        viewVisitcount,
        overviewOptions || container.property("__splomOverviewOptions"),
        domainSourceDims,
        {
            domainMap: container.property("__splomDomainMap"),
            lazyRender: opts.lazyRender !== false,
            frontsKey: container.property("__splomFrontsKey") || "all-fronts",
            familyLayout: container.property("__splomFamilyLayout") || null
        }
    )
    return true
}

exports.reSyncSampleData = () => {}

/** Paint visible lazy-pending cells once (selection included). */
exports.renderPendingVisibleSplomCells = (data, splom, viewVisitcount, maxSplomAcc) => {
    if (!splom || splom.empty()) return
    const overviewOptions = splom.property("__splomOverviewOptions") || splomOverviewOptions
    const root = getSplomScrollRoot(splom)
    splom.selectAll(".splom-cell[data-splom-pending='1']").each(function () {
        if (!root || isSplomCellVisible(this, root)) {
            renderSplomCellIfNeeded(this, splom, data, null, overviewOptions, viewVisitcount, maxSplomAcc)
        }
    })
}
