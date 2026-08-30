    const d3 = require('d3');
    const columnMetadata = require('./columnMetadata.js');

    let renderMode = "original"
    let renderModeProvider = function () { return "original" }
    let selectionCheckProvider = function () { return false }
    let displayColorProvider = function () { return null }
    let legendGroupClickHandler = null

    const DENSITY_BASE_ALPHA = 0.16
    const DENSITY_HIGHLIGHT_ALPHA = 0.92
    const MIN_CONTOUR_POINTS = 25
    // Density contour "number of lines" (threshold count) is configurable.
    let densityContourLevels = 8
    const POINT_TRANSITION_MS = 650

    function densityBandwidthForSize(w, h) {
        const base = Math.min(Math.max(1, w), Math.max(1, h))
        return Math.max(12, Math.min(36, Math.round(base * 0.09)))
    }

    function resolveDisplayColor(d) {
        try {
            const fromProvider = displayColorProvider(d)
            if (fromProvider && fromProvider.string) return fromProvider
        } catch (e) { /* ignore */ }
        try {
            const catFill = columnMetadata.getCategoryFillForRow(d)
            if (catFill) {
                return {
                    string: catFill,
                    array: columnMetadata.hexToRgbaArray(catFill, 0.85)
                }
            }
        } catch (e) { /* ignore */ }
        const color = Array.from(d.color || []).pop()
        return color || null
    }

    function pointFillOriginal(d) {
        const color = resolveDisplayColor(d)
        if (!color || !color.string) return "rgba(0, 0, 255, 0.5)"
        return color.string
    }

    function axisPlotValue(d, column) {
        if (!d || !column) return null
        if (columnMetadata.isCategoricalDimension(column)) {
            return columnMetadata.getCategoryLabel(column, d[column])
        }
        const n = Number(d[column])
        return Number.isFinite(n) ? n : d[column]
    }

    function plotPointX(d, xScale, xColumn) {
        let px = xScale(axisPlotValue(d, xColumn))
        if (columnMetadata.isCategoricalDimension(xColumn) && Number.isFinite(px)) {
            const id = d.__rowId != null ? d.__rowId : d.id
            px += columnMetadata.jitterValue(id, xColumn, 12)
        }
        return px
    }

    function plotPointY(d, yScale, yColumn) {
        let py = yScale(axisPlotValue(d, yColumn))
        if (columnMetadata.isCategoricalDimension(yColumn) && Number.isFinite(py)) {
            const id = d.__rowId != null ? d.__rowId : d.id
            py += columnMetadata.jitterValue(id, yColumn, 12)
        }
        return py
    }

    let thumbClipCounter = 0

    function thumbPlotPadding(svg) {
        const w = parseInt(svg.attr("width"), 10) || 80
        const h = parseInt(svg.attr("height"), 10) || 80
        return {
            x: Math.max(6, Math.floor(w / 10)),
            y: Math.max(6, Math.floor(h / 10))
        }
    }

    function thumbJitterAmplitude(svg, column, isXAxis) {
        const w = parseInt(svg.attr("width"), 10) || 80
        const h = parseInt(svg.attr("height"), 10) || 80
        const pad = thumbPlotPadding(svg)
        const plotSpan = isXAxis ? (w - 2 * pad.x) : (h - 2 * pad.y)
        if (columnMetadata.isCategoricalDimension(column)) {
            const domain = columnMetadata.getCategoryDomain(column)
            const n = Math.max(1, domain ? domain.length : 1)
            return Math.max(0.4, (plotSpan / n) * 0.32)
        }
        return Math.max(1, Math.min(w, h) / 14)
    }

    function plotPointXThumb(d, xScale, xColumn, svg) {
        let px = xScale(axisPlotValue(d, xColumn))
        if (columnMetadata.isCategoricalDimension(xColumn) && Number.isFinite(px)) {
            const id = d.__rowId != null ? d.__rowId : d.id
            px += columnMetadata.jitterValue(id, xColumn, thumbJitterAmplitude(svg, xColumn, true))
        }
        return px
    }

    function plotPointYThumb(d, yScale, yColumn, svg) {
        let py = yScale(axisPlotValue(d, yColumn))
        if (columnMetadata.isCategoricalDimension(yColumn) && Number.isFinite(py)) {
            const id = d.__rowId != null ? d.__rowId : d.id
            py += columnMetadata.jitterValue(id, yColumn, thumbJitterAmplitude(svg, yColumn, false))
        }
        return py
    }

    function applyThumbPlotClip(svg, paddingX, paddingY) {
        const width = parseInt(svg.attr("width"), 10) || 80
        const height = parseInt(svg.attr("height"), 10) || 80
        const clipId = "history-thumb-clip-" + (++thumbClipCounter)
        svg.select("defs").remove()
        svg.append("defs")
            .append("clipPath")
            .attr("id", clipId)
            .append("rect")
            .attr("x", paddingX)
            .attr("y", paddingY)
            .attr("width", Math.max(1, width - 2 * paddingX))
            .attr("height", Math.max(1, height - 2 * paddingY))
        svg.select(".plot-points").attr("clip-path", "url(#" + clipId + ")")
    }

    function shouldAnimatePointTransition(svg, xColumn, yColumn, zoom) {
        if (zoom !== undefined && zoom !== null) return false
        const prevX = svg.property("__prevViewXCol")
        const prevY = svg.property("__prevViewYCol")
        if (!prevX || !prevY) return false
        if (prevX === xColumn && prevY === yColumn) return false
        const layer = getActiveRenderMode() === "density"
            ? svg.select(".plot-points-bg")
            : svg.select(".plot-points")
        return !layer.selectAll("circle").empty()
    }

    function transitionPointLayer(layerSel, visible, x, y, xColumn, yColumn, r, fillFn, extraAttrs) {
        if (!layerSel || layerSel.empty()) return
        const dur = POINT_TRANSITION_MS
        const ease = d3.easeCubicInOut
        const sel = layerSel.selectAll("circle").data(visible, function (d) { return d.id })

        sel.exit()
            .transition()
            .duration(Math.round(dur * 0.45))
            .ease(ease)
            .attr("r", 0)
            .style("opacity", 0)
            .remove()

        const entered = sel.enter().append("circle")
            .attr("id", function (d) { return "point-" + d.id })
            .attr("pointer-events", "none")
            .attr("cx", function (d) { return plotPointX(d, x, xColumn) })
            .attr("cy", function (d) { return plotPointY(d, y, yColumn) })
            .attr("r", 0)
            .style("opacity", 0)
            .style("fill", fillFn)

        if (extraAttrs) extraAttrs(entered)

        entered.transition()
            .duration(dur)
            .ease(ease)
            .attr("r", r)
            .style("opacity", null)

        const updated = sel.merge(entered)
        updated.transition()
            .duration(dur)
            .ease(ease)
            .attr("cx", function (d) { return plotPointX(d, x, xColumn) })
            .attr("cy", function (d) { return plotPointY(d, y, yColumn) })
            .attr("r", r)
            .style("fill", fillFn)
            .style("opacity", null)

        if (extraAttrs) extraAttrs(updated)
    }

    function markViewColumns(svg, xColumn, yColumn) {
        if (svg && svg.property) {
            svg.property("__prevViewXCol", xColumn)
            svg.property("__prevViewYCol", yColumn)
        }
    }

    exports.setRenderMode = (mode) => {
        renderMode = mode === "density" ? "density" : "original"
    }

    exports.getRenderMode = () => renderMode

    exports.setRenderModeProvider = (fn) => {
        renderModeProvider = typeof fn === "function" ? fn : function () { return "original" }
    }

    exports.setSelectionCheckProvider = (fn) => {
        selectionCheckProvider = typeof fn === "function" ? fn : function () { return false }
    }

    exports.setDisplayColorProvider = (fn) => {
        displayColorProvider = typeof fn === "function" ? fn : function () { return null }
    }

    /** Lets the comparison legend labels act as group activation controls. */
    exports.setComparisonLegendClickHandler = (fn) => {
        legendGroupClickHandler = typeof fn === "function" ? fn : null
    }

    function getActiveRenderMode() {
        const fromProvider = renderModeProvider()
        return fromProvider === "density" ? "density" : renderMode
    }

    function isPointSelected(d) {
        try {
            return !!selectionCheckProvider(d)
        } catch (e) {
            return false
        }
    }

    function getcol(arr, column) {
        return arr.map(x => Number(Number(x[column]).toFixed(2)))
    }

    function colorWithAlpha(colorStr, alpha) {
        if (!colorStr) return "rgba(0, 0, 255, " + alpha + ")"
        const parsed = d3.color(colorStr)
        if (parsed) {
            parsed.opacity = alpha
            return parsed + ""
        }
        if (colorStr.indexOf("rgba(") === 0) {
            return colorStr.replace(/,\s*[\d.]+\s*\)$/, ", " + alpha + ")")
        }
        if (colorStr.indexOf("rgb(") === 0) {
            return colorStr.replace("rgb(", "rgba(").replace(")", ", " + alpha + ")")
        }
        return colorStr
    }

    function topPointColor(d) {
        const color = resolveDisplayColor(d)
        return color && color.string ? color.string : "rgba(0, 0, 255, 0.5)"
    }

    function fillForBackgroundPoint(d) {
        const base = topPointColor(d)
        if (getActiveRenderMode() !== "density") return base
        return colorWithAlpha(base, DENSITY_BASE_ALPHA)
    }

    function fillForSelectedPoint(d) {
        const fill = topPointColor(d)
        if (getActiveRenderMode() === "density") {
            return colorWithAlpha(fill, DENSITY_HIGHLIGHT_ALPHA)
        }
        return fill
    }

    function getMainPointFill(d, densityMode) {
        if (!densityMode) return pointFillOriginal(d)
        return isPointSelected(d) ? fillForSelectedPoint(d) : fillForBackgroundPoint(d)
    }

    function syncPointLayerStyles(svg) {
        if (!svg || svg.empty()) return
        const w = parseInt(svg.attr("width"), 10)
        const h = parseInt(svg.attr("height"), 10)
        if (!w || !h) return

        const densityMode = getActiveRenderMode() === "density"
        const r = (w + h) / (4 * 90)
        const overlay = getOverlayConfig(svg)
        const showOverlay = overlay && overlay.viewMode === "overlay" && overlay.comparisonData
        const layer = densityMode ? svg.select(".plot-points-bg") : svg.select(".plot-points")
        const x = svg.scalex
        const y = svg.scaley
        const xColumn = svg.xcol
        const yColumn = svg.ycol
        const primaryData = svg.property("__lastPrimaryData") || null

        if (!densityMode && showOverlay && x && y && primaryData) {
            renderSoucheOverlayView(primaryData, svg, {})
            return
        }

        layer.selectAll("circle")
            .style("fill", function (d) { return getMainPointFill(d, densityMode) })
            .style("opacity", null)
            .attr("r", r)
        if (!showOverlay) {
            if (!densityMode && x && y && xColumn && yColumn && primaryData) {
                renderSelectedPrimaryPoints(primaryData, svg, x, y, xColumn, yColumn, r, { overlayMode: false })
            } else {
                svg.select(".plot-points-selected").selectAll("circle").remove()
            }
            svg.select(".plot-points-compare-selected").selectAll("*").remove()
        }
    }

    function getDensityContourSourceData(primaryData, overlay) {
        const viewMode = overlay && overlay.viewMode ? overlay.viewMode : "primary"
        if (viewMode === "comparison" && overlay && overlay.comparisonData) {
            return overlay.comparisonData
        }
        const showOverlay = viewMode === "overlay" && overlay && overlay.comparisonData
        if (!showOverlay) return primaryData || []
        const active = normalizeActiveGroup(overlay)
        if (active === "upper") return overlay.comparisonData || []
        if (active === "lower") return primaryData || []
        const combined = []
        const seen = new Set()
        function add(rows) {
            if (!rows) return
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i]
                if (!row) continue
                const rowId = row.__rowId != null ? row.__rowId : row.id
                if (rowId != null) {
                    if (seen.has(rowId)) continue
                    seen.add(rowId)
                }
                combined.push(row)
            }
        }
        add(primaryData)
        add(overlay.comparisonData)
        return combined
    }

    function contourCacheSignature(svg, dataLength) {
        const overlay = getOverlayConfig(svg)
        const active = overlay ? normalizeActiveGroup(overlay) : "primary"
        return [
            getActiveRenderMode(),
            svg.attr("xDim"),
            svg.attr("yDim"),
            svg.attr("width"),
            svg.attr("height"),
            densityContourLevels,
            active,
            dataLength
        ].join("|")
    }

    exports.invalidateContourCache = (svg) => {
        if (svg && svg.property) {
            svg.property("__contourCacheKey", null)
            svg.property("__mainChartContours", [])
        }
    }

    exports.getContourLevels = () => densityContourLevels

    exports.setContourLevels = (n) => {
        const v = parseInt(n, 10)
        if (!Number.isFinite(v)) return
        // Need at least 2 thresholds to produce meaningful contours.
        densityContourLevels = Math.max(2, v)
    }

    function getOverlayConfig(svg) {
        if (!svg || !svg.property) return null
        return svg.property("__comparisonOverlay") || null
    }

    function combinedExtent(primaryData, comparisonData, col) {
        const vals = []
        const pull = function (data) {
            if (!data) return
            for (let i = 0; i < data.length; i++) {
                const d = data[i]
                if (!d || d.visibility === false) continue
                const v = Number(d[col])
                if (Number.isFinite(v)) vals.push(v)
            }
        }
        pull(primaryData)
        pull(comparisonData)
        if (!vals.length) return [0, 1]
        return d3.extent(vals)
    }

    function comparisonMarkerStroke(d, overlayMode, selected, inactive) {
        if (inactive && !selected) return INACTIVE_GROUP_COLOR
        const color = resolveDisplayColor(d)
        if (color && color.string) {
            if (selected) return color.string
            if (!overlayMode) return color.string
            const parsed = d3.color(color.string)
            if (parsed) {
                parsed.opacity = 0.65
                return parsed + ""
            }
            return color.string
        }
        const base = pointFillOriginal(d)
        const parsedBase = d3.color(base)
        if (parsedBase && overlayMode && !selected) {
            parsedBase.opacity = Math.min(parsedBase.opacity || 1, 0.55)
            return parsedBase + ""
        }
        return parsedBase ? (parsedBase + "") : base
    }

    // Styling-only emphasis for the Main Chart comparison groups: the inactive
    // group stays plotted as faded context and never loses its stored identity.
    const INACTIVE_GROUP_OPACITY = 0.28
    const INACTIVE_GROUP_COLOR = "#9ca3af"

    function normalizeActiveGroup(overlay) {
        const active = overlay && overlay.activeGroup
        if (active === "lower" || active === "primary") return "lower"
        if (active === "upper" || active === "comparison") return "upper"
        return "both"
    }

    /**
     * Group-level opacity only. Point fills/strokes of the inactive group are
     * decided by the render functions so animated repaints cannot undo them.
     */
    function applyGroupEmphasis(svg, overlay) {
        const active = normalizeActiveGroup(overlay)
        const lowerOpacity = active === "upper" ? INACTIVE_GROUP_OPACITY : null
        const upperOpacity = active === "lower" ? INACTIVE_GROUP_OPACITY : null
        svg.select(".plot-points").style("opacity", lowerOpacity)
        // Density mode draws the primary group into .plot-points-bg instead.
        svg.select(".plot-points-bg").style("opacity", lowerOpacity)
        svg.select(".plot-points-selected").style("opacity", lowerOpacity)
        svg.select(".plot-points-compare").style("opacity", upperOpacity)
        svg.select(".plot-points-compare-selected").style("opacity", upperOpacity)
    }

    function truncateLegendLabel(text, maxLen) {
        const s = String(text || "")
        if (s.length <= maxLen) return s
        return s.slice(0, Math.max(1, maxLen - 1)) + "\u2026"
    }

    function xMarkerPath(cx, cy, size) {
        const s = Math.max(2, size)
        return [
            "M", (cx - s), ",", (cy - s),
            "L", (cx + s), ",", (cy + s),
            "M", (cx - s), ",", (cy + s),
            "L", (cx + s), ",", (cy - s)
        ].join("")
    }

    function renderComparisonStars(comparisonData, svg, x, y, xColumn, yColumn, r, options) {
        const opts = options || {}
        const overlayMode = !!opts.overlayMode
        const layer = svg.select(".plot-points-compare")
        const selectedLayer = svg.select(".plot-points-compare-selected")
        if (!comparisonData || !comparisonData.length || !x || !y) {
            layer.selectAll("*").remove()
            selectedLayer.selectAll("*").remove()
            return
        }
        const visible = comparisonData.filter(function (d) { return d.visibility === true })
        const unselected = visible.filter(function (d) { return !isPointSelected(d) })
        const selected = visible.filter(function (d) { return isPointSelected(d) })
        const markerR = r * (overlayMode ? 1.85 : 1.45)
        const selectedMarkerR = markerR * (overlayMode ? 1.08 : 1.05)

        function bindMarkers(targetLayer, rows, className, strokeWidth, size, isSelected) {
            targetLayer.selectAll("path." + className)
                .data(rows, function (d) { return d.id })
                .join("path")
                .attr("class", className)
                .attr("d", function (d) {
                    const cx = x(Number(d[xColumn]))
                    const cy = y(Number(d[yColumn]))
                    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null
                    return xMarkerPath(cx, cy, size)
                })
                .style("fill", "none")
                .attr("stroke", function (d) { return comparisonMarkerStroke(d, overlayMode, isSelected, !!opts.inactive) })
                .attr("stroke-width", strokeWidth)
                .attr("stroke-linecap", "round")
                .attr("pointer-events", "none")
        }

        bindMarkers(
            layer,
            unselected,
            "comparison-star",
            overlayMode ? 1.5 : 1.25,
            markerR,
            false
        )
        bindMarkers(
            selectedLayer,
            selected,
            "comparison-star-selected",
            overlayMode ? 2.6 : 2.1,
            selectedMarkerR,
            true
        )
    }

    function updateComparisonLegend(svg, primaryLabel, comparisonLabel, show, activeGroup) {
        if (!svg || svg.empty()) return
        if (!show) {
            svg.select(".comparison-legend").remove()
            return
        }
        let legend = svg.select(".comparison-legend")
        if (legend.empty()) {
            legend = svg.append("g").attr("class", "comparison-legend").style("pointer-events", "none")
        }
        const active = activeGroup === "lower" || activeGroup === "upper" ? activeGroup : "both"
        const height = parseInt(svg.attr("height"), 10) || 400
        const legendX = 12
        const line1Y = height - 28
        const line2Y = height - 12
        const activeSuffix = " \u2190 selecting"
        const line1 = "\u25CF " + truncateLegendLabel(primaryLabel || "Dataset 1", 32)
            + (active === "lower" ? activeSuffix : "")
        const line2 = "\u2715 " + truncateLegendLabel(comparisonLabel || "Dataset 2", 32)
            + (active === "upper" ? activeSuffix : "")
        const boxW = Math.max(160, Math.max(line1.length, line2.length) * 6.8)

        legend.selectAll("*").remove()
        legend.append("rect")
            .attr("x", legendX - 6)
            .attr("y", height - 46)
            .attr("width", boxW)
            .attr("height", 40)
            .attr("rx", 4)
            .style("fill", "rgba(255, 255, 255, 0.94)")
            .style("stroke", "#d1d5db")

        const clickable = typeof legendGroupClickHandler === "function"
        const addLine = function (y, text, title, group) {
            const dimmed = active !== "both" && active !== group
            const node = legend.append("text")
                .attr("x", legendX)
                .attr("y", y)
                .attr("text-anchor", "start")
                .style("font-size", "12px")
                .style("font-weight", dimmed ? "500" : "600")
                .style("fill", dimmed ? "#9ca3af" : "#1f2937")
                .attr("title", title)
                .text(text)
            if (!clickable) return
            node.style("pointer-events", "auto")
                .style("cursor", "pointer")
                .on("click", function () {
                    if (d3.event) d3.event.stopPropagation()
                    legendGroupClickHandler(group === "lower" ? "primary" : "comparison")
                })
        }
        addLine(line1Y, line1, primaryLabel || "Dataset 1", "lower")
        addLine(line2Y, line2, comparisonLabel || "Dataset 2", "upper")
        legend.raise()
    }

    function raiseCompareOverlayLayers(svg) {
        if (!svg || svg.empty()) return
        svg.select(".plot-contours").raise()
        svg.select(".plot-points-bg").raise()
        svg.select(".plot-points-compare").raise()
        svg.select(".plot-points-compare-selected").raise()
        svg.select(".plot-points").raise()
        svg.select(".plot-points-selected").raise()
        svg.select(".comparison-legend").raise()
        svg.select(".xLabel").raise()
        svg.select(".yLabel").raise()
        svg.select(".clickCountLabel").raise()
        svg.select("#plot-hover").raise()
        const brushSel = svg.select(".brush")
        if (!brushSel.empty()) brushSel.raise()
    }

    function renderSoucheOverlayView(primaryData, svg, options) {
        const opts = options || {}
        const overlay = getOverlayConfig(svg)
        if (!overlay || overlay.viewMode !== "overlay" || !overlay.comparisonData) {
            renderBackgroundPoints(primaryData, svg, { overlayMode: false, animate: !!opts.animate })
            svg.select(".plot-points-compare").selectAll("*").remove()
            svg.select(".plot-points-compare-selected").selectAll("*").remove()
            updateComparisonLegend(svg, null, null, false)
            return
        }
        const w = parseInt(svg.attr("width"), 10)
        const h = parseInt(svg.attr("height"), 10)
        const r = (w + h) / (4 * 90)
        const x = svg.scalex
        const y = svg.scaley
        const xColumn = svg.xcol
        const yColumn = svg.ycol
        if (!x || !y || !xColumn || !yColumn) return
        const activeGroup = normalizeActiveGroup(overlay)
        // Upper triangle (comparison): X markers underneath.
        renderComparisonStars(overlay.comparisonData, svg, x, y, xColumn, yColumn, r, {
            overlayMode: true,
            inactive: activeGroup === "lower"
        })
        updateComparisonLegend(svg, overlay.primaryLabel, overlay.comparisonLabel, true, activeGroup)
        // Lower triangle (primary): circles on top of the X layer.
        renderBackgroundPoints(primaryData, svg, {
            overlayMode: true,
            animate: !!opts.animate,
            inactive: activeGroup === "upper"
        })
        applyGroupEmphasis(svg, overlay)
        raiseCompareOverlayLayers(svg)
    }

    function refreshComparisonOverlay(svg, primaryData) {
        if (!svg || svg.empty()) return
        const overlay = getOverlayConfig(svg)
        if (!overlay || overlay.viewMode !== "overlay" || !overlay.comparisonData) {
            svg.select(".plot-points-compare").selectAll("*").remove()
            svg.select(".plot-points-compare-selected").selectAll("*").remove()
            updateComparisonLegend(svg, null, null, false)
            return
        }
        renderSoucheOverlayView(primaryData, svg, {})
    }

    function ensureChartLayers(svg) {
        if (!svg || svg.empty()) return
        if (svg.select(".xAxis").empty()) {
            svg.append("g").attr("class", "xAxis").style("pointer-events", "none")
        }
        if (svg.select(".yAxis").empty()) {
            svg.append("g").attr("class", "yAxis").style("pointer-events", "none")
        }
        svg.select(".xAxis").style("pointer-events", "none")
        svg.select(".yAxis").style("pointer-events", "none")
        if (svg.select(".plot-points").empty()) {
            svg.append("g").attr("class", "plot-points").style("pointer-events", "none")
        }
        svg.select(".plot-points").style("pointer-events", "none")
        svg.select(".plot-points-bg").style("pointer-events", "none")
        if (svg.select(".plot-contours").empty()) {
            svg.append("g").attr("class", "plot-contours").style("pointer-events", "none")
        }
        if (svg.select(".plot-points-bg").empty()) {
            svg.append("g").attr("class", "plot-points-bg")
        }
        if (svg.select(".plot-points-selected").empty()) {
            svg.append("g").attr("class", "plot-points-selected").style("pointer-events", "none")
        }
        if (svg.select(".plot-points-compare").empty()) {
            svg.append("g").attr("class", "plot-points-compare").style("pointer-events", "none")
        }
        if (svg.select(".plot-points-compare-selected").empty()) {
            svg.append("g").attr("class", "plot-points-compare-selected").style("pointer-events", "none")
        }
        if (svg.select(".xLabel").empty()) {
            svg.append("text").attr("class", "xLabel").style("pointer-events", "none")
        }
        if (svg.select(".yLabel").empty()) {
            svg.append("text").attr("class", "yLabel").style("pointer-events", "none")
        }
        svg.select(".xLabel").style("pointer-events", "none")
        svg.select(".yLabel").style("pointer-events", "none")
        if (svg.select(".clickCountLabel").empty()) {
            svg.append("text").attr("class", "clickCountLabel").attr("pointer-events", "none")
        }
        if (svg.select("#plot-hover").empty()) {
            svg.append("rect").attr("id", "plot-hover")
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("fill", "rgba(255, 255, 255, 0)")
                .style("pointer-events", "none")
        }
        svg.select(".plot-contours").raise()
        svg.select(".plot-points-bg").raise()
        raiseCompareOverlayLayers(svg)
    }

    function polygonComponentContainsPoint(polygon, point) {
        if (!polygon || !polygon.length) return false
        const outer = polygon[0]
        if (!outer || !outer.length) return false
        if (!d3.polygonContains(outer, point)) return false
        const holes = polygon.slice(1)
        return !holes.some(function (hole) {
            return hole && hole.length && d3.polygonContains(hole, point)
        })
    }

    function pointInsideContour(point, contour, polygonOnly) {
        if (!contour || !contour.coordinates) return false
        if (polygonOnly) {
            return polygonComponentContainsPoint(polygonOnly, point)
        }
        return contour.coordinates.some(function (polygon) {
            return polygonComponentContainsPoint(polygon, point)
        })
    }

    function findPolygonContainingPoint(contour, point) {
        if (!contour || !contour.coordinates) return null
        for (let j = 0; j < contour.coordinates.length; j++) {
            const polygon = contour.coordinates[j]
            if (polygonComponentContainsPoint(polygon, point)) return polygon
        }
        return null
    }

    /**
     * Pick the topmost filled contour layer under the click (matches how shading is drawn).
     * Selection is the full interior of that circle — including any nested circles inside it.
     */
    function findContourPolygonAtPoint(contours, px, py) {
        if (!contours || !contours.length) return null
        const point = [px, py]
        const sorted = contours.slice().sort(function (a, b) {
            return (a.value || 0) - (b.value || 0)
        })

        for (let i = sorted.length - 1; i >= 0; i--) {
            const polygon = findPolygonContainingPoint(sorted[i], point)
            if (polygon) {
                return { contour: sorted[i], polygon: polygon, holePolygon: null }
            }
        }
        return null
    }

    function findHighestDensityContourAtPoint(contours, px, py) {
        const hit = findContourPolygonAtPoint(contours, px, py)
        return hit ? hit.contour : null
    }

    function getPointsInsidePolygonComponent(data, svg, polygon) {
        if (!data || !svg || !polygon) return []
        const x = svg.scalex
        const y = svg.scaley
        const xColumn = svg.xcol
        const yColumn = svg.ycol
        if (!x || !y || !xColumn || !yColumn) return []

        const selected = []
        for (let i = 0; i < data.length; i++) {
            const d = data[i]
            if (d.visibility === false) continue
            const xv = +d[xColumn]
            const yv = +d[yColumn]
            if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue
            const px = x(xv)
            const py = y(yv)
            if (!Number.isFinite(px) || !Number.isFinite(py)) continue
            if (polygonComponentContainsPoint(polygon, [px, py])) selected.push(d)
        }
        return selected
    }

    function getPointsInsideContour(data, svg, contour, polygon) {
        if (polygon) return getPointsInsidePolygonComponent(data, svg, polygon)
        if (!contour || !contour.coordinates) return []
        const selected = []
        const seen = new Set()
        for (let p = 0; p < contour.coordinates.length; p++) {
            const pts = getPointsInsidePolygonComponent(data, svg, contour.coordinates[p])
            for (let i = 0; i < pts.length; i++) {
                const d = pts[i]
                if (!seen.has(d.id)) {
                    seen.add(d.id)
                    selected.push(d)
                }
            }
        }
        return selected
    }

    function getPointsInContourLayer(data, svg, outerPolygon, holePolygon) {
        const inOuter = getPointsInsidePolygonComponent(data, svg, outerPolygon)
        if (!holePolygon || !inOuter.length) return inOuter

        const x = svg.scalex
        const y = svg.scaley
        const xColumn = svg.xcol
        const yColumn = svg.ycol
        if (!x || !y || !xColumn || !yColumn) return inOuter

        const holes = Array.isArray(holePolygon) ? holePolygon : [holePolygon]
        return inOuter.filter(function (d) {
            const xv = +d[xColumn]
            const yv = +d[yColumn]
            if (!Number.isFinite(xv) || !Number.isFinite(yv)) return false
            const px = x(xv)
            const py = y(yv)
            if (!Number.isFinite(px) || !Number.isFinite(py)) return false
            for (let h = 0; h < holes.length; h++) {
                if (holes[h] && polygonComponentContainsPoint(holes[h], [px, py])) return false
            }
            return true
        })
    }

    exports.getMainChartContours = (svg) => {
        if (!svg || typeof svg.property !== "function") return []
        return svg.property("__mainChartContours") || []
    }
    exports.pointInsideContour = pointInsideContour
    exports.polygonComponentContainsPoint = polygonComponentContainsPoint
    exports.findContourPolygonAtPoint = findContourPolygonAtPoint
    exports.findHighestDensityContourAtPoint = findHighestDensityContourAtPoint
    exports.getPointsInsidePolygonComponent = getPointsInsidePolygonComponent
    exports.getPointsInsideContour = getPointsInsideContour
    exports.getPointsInContourLayer = getPointsInContourLayer

    function drawDensityContours(data, svg, forceRedraw) {
        if (!svg || typeof svg.property !== "function" || svg.empty()) return
        const contourLayer = svg.select(".plot-contours")
        if (getActiveRenderMode() !== "density") {
            contourLayer.selectAll("*").remove()
            svg.property("__contourCacheKey", null)
            svg.property("__mainChartContours", [])
            contourLayer.style("pointer-events", "none")
            return
        }

        const overlay = getOverlayConfig(svg)
        const source = getDensityContourSourceData(data, overlay)
        const sig = contourCacheSignature(svg, source ? source.length : 0)
        if (!forceRedraw && svg.property("__contourCacheKey") === sig) return

        contourLayer.selectAll("*").remove()

        const w = parseInt(svg.attr("width"), 10)
        const h = parseInt(svg.attr("height"), 10)
        const x = svg.scalex
        const y = svg.scaley
        const xColumn = svg.xcol
        const yColumn = svg.ycol
        if (!x || !y || !xColumn || !yColumn || !w || !h) return
        if (columnMetadata.shouldSkipNumericMethod(xColumn) ||
            columnMetadata.shouldSkipNumericMethod(yColumn)) {
            contourLayer.selectAll("*").remove()
            svg.property("__contourCacheKey", null)
            svg.property("__mainChartContours", [])
            return
        }

        const projected = []
        for (const d of source) {
            if (d.visibility === false) continue
            const xv = +d[xColumn]
            const yv = +d[yColumn]
            if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue
            const px = x(xv)
            const py = y(yv)
            if (Number.isFinite(px) && Number.isFinite(py)) {
                projected.push([px, py])
            }
        }
        if (projected.length < MIN_CONTOUR_POINTS) {
            svg.property("__mainChartContours", [])
            return
        }

        const bandwidth = densityBandwidthForSize(w, h)
        let contours
        try {
            contours = d3.contourDensity()
                .x(function (pt) { return pt[0] })
                .y(function (pt) { return pt[1] })
                .size([Math.max(1, w), Math.max(1, h)])
                .bandwidth(bandwidth)
                .thresholds(densityContourLevels)(projected)
        } catch (e) {
            svg.property("__mainChartContours", [])
            return
        }
        if (!contours || !contours.length) {
            svg.property("__mainChartContours", [])
            return
        }

        svg.property("__mainChartContours", contours)
        svg.property("__densityBandwidth", bandwidth)

        const sortedContours = contours.slice().sort(function (a, b) {
            return (a.value || 0) - (b.value || 0)
        })
        const valueExtent = d3.extent(contours, function (d) { return d.value })
        const contourColorScale = d3.scaleLinear()
            .domain(valueExtent)
            .range(["#fecaca", "#7f1d1d"])
        const fillOpacityScale = d3.scaleLinear()
            .domain(valueExtent)
            .range([0.07, 0.32])
        const strokeOpacityScale = d3.scaleLinear()
            .domain(valueExtent)
            .range([0.45, 0.92])
        const strokeWidthScale = d3.scaleLinear()
            .domain(valueExtent)
            .range([0.75, 1.6])
        const n = sortedContours.length

        const path = d3.geoPath()
        contourLayer
            .style("pointer-events", "none")
            .selectAll("path.density-contour")
            .data(sortedContours)
            .join("path")
            .attr("class", "density-contour")
            .attr("d", path)
            .attr("fill", function (d) { return contourColorScale(d.value) })
            .attr("fill-opacity", function (d) { return fillOpacityScale(d.value) })
            .attr("stroke", function (d) { return contourColorScale(d.value) })
            .attr("stroke-opacity", function (d) { return strokeOpacityScale(d.value) })
            .attr("stroke-width", function (d) { return strokeWidthScale(d.value) })
            .attr("pointer-events", "none")

        svg.property("__contourCacheKey", sig)
    }

    exports.drawDensityContours = (data, svg, forceRedraw) => drawDensityContours(data, svg, forceRedraw)

    exports.init = (svg) => {
        if (!svg || svg.empty()) return
        if (svg.property("__mainChartInited")) {
            ensureChartLayers(svg)
            return
        }
        ensureChartLayers(svg)
        svg.property("__mainChartInited", true)
    }

    function primaryOverlayFill(d) {
        if (isPointSelected(d)) {
            return pointFillOriginal(d)
        }
        const base = pointFillOriginal(d)
        const parsed = d3.color(base)
        if (parsed) {
            parsed.opacity = Math.min(parsed.opacity || 1, 0.42)
            return parsed + ""
        }
        return "rgba(37, 99, 235, 0.42)"
    }

    function renderSelectedPrimaryPoints(data, svg, x, y, xColumn, yColumn, r, options) {
        const opts = options || {}
        if (!data || !x || !y) return
        const selected = data.filter(function (d) {
            return d.visibility !== false && isPointSelected(d)
        })
        const layer = svg.select(".plot-points-selected")
        if (!selected.length) {
            layer.selectAll("circle").remove()
            return
        }
        const fillFn = opts.overlayMode ? pointFillOriginal : fillForSelectedPoint
        layer.selectAll("circle")
            .data(selected, function (d) { return d.id })
            .join("circle")
            .style("fill", function (d) { return fillFn(d) })
            .attr("cx", function (d) { return plotPointX(d, x, xColumn) })
            .attr("cy", function (d) { return plotPointY(d, y, yColumn) })
            .attr("id", function (d) { return "point-selected-" + d.id })
            .attr("r", r * (opts.overlayMode ? 1.05 : 1))
            .style("opacity", null)
            .attr("stroke", opts.overlayMode ? function (d) {
                const fill = pointFillOriginal(d)
                const parsed = d3.color(fill)
                return parsed ? parsed.darker(0.6) + "" : "#1f2937"
            } : null)
            .attr("stroke-width", opts.overlayMode ? 0.8 : null)
            .attr("pointer-events", "none")
    }

    function renderBackgroundPoints(data, svg, options) {
        const opts = options || {}
        const w = parseInt(svg.attr("width"), 10)
        const h = parseInt(svg.attr("height"), 10)
        const x = svg.scalex
        const y = svg.scaley
        const xColumn = svg.xcol
        const yColumn = svg.ycol
        if (!x || !y || !xColumn || !yColumn) return

        const densityMode = getActiveRenderMode() === "density"
        const overlayMode = !!opts.overlayMode
        const r = (w + h) / (4 * 90) * (overlayMode ? 0.88 : 1)
        const visibleAll = data.filter(function (d) { return d.visibility === true })
        const visible = overlayMode
            ? visibleAll.filter(function (d) { return !isPointSelected(d) })
            : visibleAll
        const animate = !!opts.animate

        if (!densityMode) {
            svg.select(".plot-points-bg").selectAll("circle").remove()
            svg.select(".plot-points-selected").selectAll("circle").remove()
            svg.select(".plot-contours").selectAll("*").remove()
            const layer = svg.select(".plot-points")
            const inactive = !!opts.inactive
            const fillFn = inactive
                ? function () { return INACTIVE_GROUP_COLOR }
                : (overlayMode ? primaryOverlayFill : pointFillOriginal)
            if (animate) {
                transitionPointLayer(layer, visible, x, y, xColumn, yColumn, r, fillFn)
            } else {
                layer
                    .selectAll("circle")
                    .data(visible, function (d) { return d.id })
                    .join("circle")
                    .style("fill", fillFn)
                    .attr("cx", function (d) { return plotPointX(d, x, xColumn) })
                    .attr("cy", function (d) { return plotPointY(d, y, yColumn) })
                    .attr("id", function (d) { return "point-" + d.id })
                    .attr("r", r)
                    .style("opacity", null)
                    .attr("stroke", overlayMode ? (inactive ? INACTIVE_GROUP_COLOR : "#2563eb") : null)
                    .attr("stroke-width", overlayMode ? 0.7 : null)
                    .attr("pointer-events", "none")
            }
            if (overlayMode) {
                renderSelectedPrimaryPoints(data, svg, x, y, xColumn, yColumn, r, { overlayMode: true })
            } else {
                renderSelectedPrimaryPoints(data, svg, x, y, xColumn, yColumn, r, { overlayMode: false })
            }
            return
        }

        svg.select(".plot-points").selectAll("circle").remove()

        svg.select(".plot-points-selected").selectAll("circle").remove()

        const bgLayer = svg.select(".plot-points-bg")
        if (animate) {
            transitionPointLayer(
                bgLayer,
                visible,
                x,
                y,
                xColumn,
                yColumn,
                r,
                function (d) { return getMainPointFill(d, true) },
                function (selection) {
                    selection.attr("class", "plot-point-bg")
                }
            )
        } else {
            bgLayer
                .selectAll("circle")
                .data(visible, function (d) { return d.id })
                .join("circle")
                .attr("class", "plot-point-bg")
                .attr("cx", function (d) { return plotPointX(d, x, xColumn) })
                .attr("cy", function (d) { return plotPointY(d, y, yColumn) })
                .attr("id", function (d) { return "point-" + d.id })
                .attr("r", r)
                .style("fill", function (d) { return getMainPointFill(d, true) })
                .style("opacity", null)
                .attr("pointer-events", "none")
        }
    }

    exports.updateSelectionOverlay = (data, svg) => {
        if (!svg || svg.empty()) return
        syncPointLayerStyles(svg)
        const brushLayer = svg.select(".brush")
        if (!brushLayer.empty()) brushLayer.raise()
    }

    exports.chooseDims = (w, h, data, xColumn, yColumn, svg, zoom, overlayOptions) => {
        if (!svg || svg.empty()) return
        if (!xColumn || !yColumn) return

        const prevTimer = svg.property("__chooseDimsTimer")
        if (prevTimer) clearTimeout(prevTimer)

        const gen = (svg.property("__chooseDimsGen") || 0) + 1
        svg.property("__chooseDimsGen", gen)

        svg.attr("xDim", xColumn)
            .attr("yDim", yColumn)
        svg.xcol = xColumn
        svg.ycol = yColumn
        svg.property("__comparisonOverlay", overlayOptions || null)

        const runChooseDims = function () {
            if (svg.property("__chooseDimsGen") !== gen) return
            if (!svg || svg.empty()) return
            ensureChartLayers(svg)

            const overlay = getOverlayConfig(svg)
            const viewMode = overlay && overlay.viewMode ? overlay.viewMode : "primary"
            const comparisonData = overlay ? overlay.comparisonData : null
            const showOverlay = viewMode === "overlay" && comparisonData && comparisonData.length
            const renderData = viewMode === "comparison" && comparisonData ? comparisonData : data

            const width = Math.max(1, Math.floor(w))
            const height = Math.max(1, Math.floor(h))
            let paddingX = Math.max(52, Math.floor(width / 10))
            let paddingY = Math.max(56, Math.floor(height / 10))
            let axisLabelSize = Math.max(13, Math.min(16, Math.floor(Math.min(width, height) / 45)))
            let tickSize = Math.max(10, Math.min(13, Math.floor(Math.min(width, height) / 60)))
            let dataX
            let dataY
            if (viewMode === "comparison" && comparisonData) {
                dataX = getcol(comparisonData, xColumn)
                dataY = getcol(comparisonData, yColumn)
            } else if (showOverlay) {
                dataX = combinedExtent(data, comparisonData, xColumn)
                dataY = combinedExtent(data, comparisonData, yColumn)
            } else {
                dataX = getcol(data, xColumn)
                dataY = getcol(data, yColumn)
            }

            svg.attr("width", width)
                .attr("height", height)
                .style("width", "100%")
                .style("height", "100%")
                .style("display", "block")
                .style("box-sizing", "border-box")
                .attr("xDim", xColumn)
                .attr("yDim", yColumn)

            svg.select("#plot-hover")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", width)
                .attr("height", height)

            let x
            const xCat = columnMetadata.isCategoricalDimension(xColumn)
            const yCat = columnMetadata.isCategoricalDimension(yColumn)
            const allowZoom = !xCat && !yCat && zoom !== undefined && zoom !== null

            if (xCat) {
                x = d3.scalePoint()
                    .domain(columnMetadata.getCategoryDomain(xColumn))
                    .range([paddingX, width - paddingX])
                    .padding(0.5)
            } else if (!allowZoom) {
                x = d3.scaleLinear()
                    .domain(d3.extent(dataX))
                    .range([paddingX, width - paddingX])
            } else {
                x = svg.scalex
                let x0 = x.invert(zoom.xrange[0])
                let x1 = x.invert(zoom.xrange[1])
                x.domain([x0, x1])
                    .range([paddingX, width - paddingX])
            }

            svg.select(".xAxis")
                .attr("transform", "translate(" + 0 + "," + (height - paddingY) + ")")
                .call(d3.axisBottom(x).tickFormat(function (d) { return String(d) }))
                .selectAll("text")
                .style("font-size", tickSize + "px")
                .each(function () {
                    if (!xCat) return
                    const t = d3.select(this)
                    const label = String(t.text())
                    if (label.length > 10) t.text(label.slice(0, 9) + "…")
                })

            svg.select(".xAxis")
                .selectAll("line,path")
                .style("stroke-width", "1px")
            svg.select(".xAxis").style("pointer-events", "none")

            svg.select(".xLabel")
                .style("font-size", axisLabelSize + "px")
                .style("font-weight", "600")
                .style("fill", "black")
                .attr("x", width / 2)
                .attr("y", height - 24)
                .attr("dominant-baseline", "middle")
                .style("text-anchor", "middle")
                .text(xColumn + (xCat ? " [categorical]" : ""))

            let y
            if (yCat) {
                y = d3.scalePoint()
                    .domain(columnMetadata.getCategoryDomain(yColumn))
                    .range([height - paddingY, paddingY])
                    .padding(0.5)
            } else if (!allowZoom) {
                y = d3.scaleLinear()
                    .domain(d3.extent(dataY))
                    .range([height - paddingY, paddingY])
            } else {
                y = svg.scaley
                let y1 = y.invert(zoom.yrange[0])
                let y0 = y.invert(zoom.yrange[1])
                y.domain([y0, y1])
                    .range([height - paddingY, paddingY])
            }

            svg.select(".yAxis")
                .attr("transform", "translate(" + paddingX + "," + 0 + ")")
                .call(d3.axisLeft(y).tickFormat(function (d) { return String(d) }))
                .selectAll("text")
                .style("font-size", tickSize + "px")
                .each(function () {
                    if (!yCat) return
                    const t = d3.select(this)
                    const label = String(t.text())
                    if (label.length > 10) t.text(label.slice(0, 9) + "…")
                })

            svg.select(".yAxis")
                .selectAll("line,path")
                .style("stroke-width", "1px")
            svg.select(".yAxis").style("pointer-events", "none")

            svg.scalex = x
            svg.scaley = y
            svg.property("__xCategorical", xCat)
            svg.property("__yCategorical", yCat)

            const yPivotX = 16
            const yPivotY = height / 2
            svg.select(".yLabel")
                .style("font-size", axisLabelSize + "px")
                .style("font-weight", "600")
                .style("fill", "black")
                .attr("transform", "rotate(-90," + yPivotX + "," + yPivotY + ")")
                .attr("x", yPivotX)
                .attr("y", yPivotY)
                .attr("dominant-baseline", "middle")
                .style("text-anchor", "middle")
                .text(yColumn + (yCat ? " [categorical]" : ""))
                .style("text-anchor", "middle")
                .text(yColumn)

            svg.xcol = xColumn
            svg.ycol = yColumn
            svg.scalex = x
            svg.scaley = y

            const animatePoints = shouldAnimatePointTransition(svg, xColumn, yColumn, zoom)
            svg.property("__lastPrimaryData", data)

            exports.invalidateContourCache(svg)
            drawDensityContours(data, svg, true)
            if (viewMode === "comparison") {
                svg.select(".plot-points").selectAll("circle").remove()
                svg.select(".plot-points-bg").selectAll("circle").remove()
                const wPlot = parseInt(svg.attr("width"), 10)
                const hPlot = parseInt(svg.attr("height"), 10)
                const rPlot = (wPlot + hPlot) / (4 * 90)
                renderComparisonStars(comparisonData, svg, x, y, xColumn, yColumn, rPlot, { overlayMode: false })
                updateComparisonLegend(svg, null, null, false)
            } else {
                if (showOverlay) {
                    renderSoucheOverlayView(data, svg, { animate: animatePoints })
                } else {
                    renderBackgroundPoints(renderData, svg, {
                        animate: animatePoints,
                        overlayMode: false
                    })
                    svg.select(".plot-points-compare").selectAll("*").remove()
                    svg.select(".plot-points-compare-selected").selectAll("*").remove()
                    updateComparisonLegend(svg, null, null, false)
                }
            }
            exports.updateSelectionOverlay(renderData, svg)
            markViewColumns(svg, xColumn, yColumn)
            svg.select(".plot-points").style("pointer-events", "none")
            svg.select(".plot-points-bg").style("pointer-events", "none")
            svg.select(".plot-points-compare").style("pointer-events", "none")
            svg.select(".xAxis").style("pointer-events", "none")
            svg.select(".yAxis").style("pointer-events", "none")
            svg.select(".xLabel").style("pointer-events", "none")
            svg.select(".yLabel").style("pointer-events", "none")
            const chartNode = svg.node()
            const brushHook = chartNode && chartNode.__brushLayoutHook
            if (typeof brushHook === "function") brushHook(svg)
        }

        runChooseDims()
    }

    exports.updatePoints = (data, svg) => {
        if (!svg || svg.empty()) return
        ensureChartLayers(svg)
        svg.property("__lastPrimaryData", data)
        const overlay = getOverlayConfig(svg)
        const viewMode = overlay && overlay.viewMode ? overlay.viewMode : "primary"
        const showOverlay = viewMode === "overlay" && overlay && overlay.comparisonData
        exports.invalidateContourCache(svg)
        drawDensityContours(data, svg, true)
        if (viewMode === "comparison" && overlay && overlay.comparisonData) {
            svg.select(".plot-points").selectAll("circle").remove()
            svg.select(".plot-points-bg").selectAll("circle").remove()
            const w = parseInt(svg.attr("width"), 10)
            const h = parseInt(svg.attr("height"), 10)
            const r = (w + h) / (4 * 90)
            renderComparisonStars(overlay.comparisonData, svg, svg.scalex, svg.scaley, svg.xcol, svg.ycol, r, { overlayMode: false })
        } else if (showOverlay) {
            renderSoucheOverlayView(data, svg, {})
        } else {
            renderBackgroundPoints(data, svg, { overlayMode: false })
            svg.select(".plot-points-compare").selectAll("*").remove()
            svg.select(".plot-points-compare-selected").selectAll("*").remove()
            updateComparisonLegend(svg, null, null, false)
        }
        exports.updateSelectionOverlay(data, svg)
    }

    /** Fast path after brush/selection: repaint points only, skip contour recompute. */
    exports.updatePointsAfterSelection = (data, svg) => {
        if (!svg || svg.empty()) return
        ensureChartLayers(svg)
        svg.property("__lastPrimaryData", data)
        const overlay = getOverlayConfig(svg)
        const viewMode = overlay && overlay.viewMode ? overlay.viewMode : "primary"
        const showOverlay = viewMode === "overlay" && overlay && overlay.comparisonData
        if (viewMode === "comparison" && overlay && overlay.comparisonData) {
            const w = parseInt(svg.attr("width"), 10)
            const h = parseInt(svg.attr("height"), 10)
            const r = (w + h) / (4 * 90)
            renderComparisonStars(overlay.comparisonData, svg, svg.scalex, svg.scaley, svg.xcol, svg.ycol, r, { overlayMode: false })
        } else if (showOverlay) {
            renderSoucheOverlayView(data, svg, {})
        } else {
            renderBackgroundPoints(data, svg, { overlayMode: false })
            svg.select(".plot-points-compare").selectAll("*").remove()
            svg.select(".plot-points-compare-selected").selectAll("*").remove()
            updateComparisonLegend(svg, null, null, false)
        }
        exports.updateSelectionOverlay(data, svg)
    }

    exports.chooseDimsSmall = (w, h, data, xColumn, yColumn, svg) => {
        setTimeout(function () {
            if (!svg || svg.empty()) return
            ensureChartLayers(svg)

            const width = Math.max(1, Math.floor(w))
            const height = Math.max(1, Math.floor(h))
            const paddingX = Math.max(6, Math.floor(width / 10))
            const paddingY = Math.max(6, Math.floor(height / 10))

            svg.attr("width", width)
                .attr("height", height)
                .attr("xDim", xColumn || "")
                .attr("yDim", yColumn || "")

            svg.select(".plot-points-bg").selectAll("circle").remove()
            svg.select(".plot-points-selected").selectAll("circle").remove()
            svg.select(".plot-contours").selectAll("*").remove()

            if (!data || !data.length || !xColumn || !yColumn) {
                svg.select(".xAxis").selectAll("*").remove()
                svg.select(".yAxis").selectAll("*").remove()
                return
            }

            const xCat = columnMetadata.isCategoricalDimension(xColumn)
            const yCat = columnMetadata.isCategoricalDimension(yColumn)
            const visible = data.filter(function (d) {
                if (!d || d.visibility === false) return false
                if (xCat) {
                    const lx = columnMetadata.getCategoryLabel(xColumn, d[xColumn])
                    if (lx === "" || lx == null) return false
                } else if (!Number.isFinite(Number(d[xColumn]))) {
                    return false
                }
                if (yCat) {
                    const ly = columnMetadata.getCategoryLabel(yColumn, d[yColumn])
                    if (ly === "" || ly == null) return false
                } else if (!Number.isFinite(Number(d[yColumn]))) {
                    return false
                }
                return true
            })

            let x
            if (xCat) {
                x = d3.scalePoint()
                    .domain(columnMetadata.getCategoryDomain(xColumn))
                    .range([paddingX, width - paddingX])
                    .padding(0.5)
            } else {
                const dataX = visible.map(function (d) { return Number(d[xColumn]) }).filter(Number.isFinite)
                x = d3.scaleLinear()
                    .domain(d3.extent(dataX.length ? dataX : [0, 1]))
                    .range([paddingX, width - paddingX])
            }

            svg.select(".xAxis")
                .attr("transform", "translate(0," + (height - paddingY) + ")")
                .call(d3.axisBottom(x).tickValues([]))

            let y
            if (yCat) {
                y = d3.scalePoint()
                    .domain(columnMetadata.getCategoryDomain(yColumn))
                    .range([height - paddingY, paddingY])
                    .padding(0.5)
            } else {
                const dataY = visible.map(function (d) { return Number(d[yColumn]) }).filter(Number.isFinite)
                y = d3.scaleLinear()
                    .domain(d3.extent(dataY.length ? dataY : [0, 1]))
                    .range([height - paddingY, paddingY])
            }

            svg.select(".yAxis")
                .attr("transform", "translate(" + paddingX + ",0)")
                .call(d3.axisLeft(y).tickValues([]))

            svg.xcol = xColumn
            svg.ycol = yColumn
            svg.scalex = x
            svg.scaley = y
            svg.property("__xCategorical", xCat)
            svg.property("__yCategorical", yCat)

            applyThumbPlotClip(svg, paddingX, paddingY)
            exports.updatePointsSmall(visible, svg)
        }, 0)
    }

    exports.updatePointsSmall = (data, svg) => {
        const w = parseInt(svg.attr("width"), 10)
        const h = parseInt(svg.attr("height"), 10)
        const x = svg.scalex
        const y = svg.scaley
        const xColumn = svg.xcol
        const yColumn = svg.ycol
        if (!x || !y || !xColumn || !yColumn || !data || !data.length) return

        const r = (w + h) / 90

        const pointsLayer = svg.select(".plot-points")
        pointsLayer
            .selectAll("circle")
            .data(data.filter(function (d) { return d.visibility === true }), function (d) { return d.id })
            .join("circle")
            .style("fill", function (d) {
                const colors = d.color ? Array.from(d.color) : []
                const top = colors.pop()
                if (top && top.string) return top.string
                return "rgba(0, 0, 255, 0.5)"
            })
            .attr("cx", function (d) { return plotPointXThumb(d, x, xColumn, svg) })
            .attr("cy", function (d) { return plotPointYThumb(d, y, yColumn, svg) })
            .attr("id", function (d) { return "point-" + d.id })
            .attr("r", r)
    }

    exports.getPlotScreenCoords = function (d, svg) {
        if (!svg || svg.empty() || !d) return { cx: NaN, cy: NaN }
        const x = svg.scalex
        const y = svg.scaley
        const xColumn = svg.xcol
        const yColumn = svg.ycol
        if (!x || !y || !xColumn || !yColumn) return { cx: NaN, cy: NaN }
        return {
            cx: plotPointX(d, x, xColumn),
            cy: plotPointY(d, y, yColumn)
        }
    }
