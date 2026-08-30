/**
 * Souche / yeast strain comparison helpers.
 */

const d3 = require("d3")
const comparisonDataset = require("./comparisonDataset.js")

const MAX_SAVED_PAIR_COMPARISONS = 4
const MAX_OVERLAY_SOUCHES = 4

const SOUCHE_SERIES_COLORS = [
    "#2563eb", "#ea731a", "#22c55e", "#a855f7",
    "#ef4444", "#14b8a6", "#f59e0b", "#ec4899"
]

const MATCHING_INPUT_DIMS = ["temperature", "N_ini", "N_add"]

function makeExperimentConditionKey(row) {
    if (!row) return ""
    return MATCHING_INPUT_DIMS.map(function (dim) {
        return dim + ":" + row[dim]
    }).join("|")
}

function buildSoucheRowIndex(allRows, yeastColumn) {
    const index = new Map()
    if (!allRows || !yeastColumn) return index
    for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i]
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
    return index
}

function buildExperimentConditionIndex(allRows, yeastColumn, souches) {
    const byKey = new Map()
    const rowKeyBySoucheId = new Map()
    const rowLookup = new Map()
    const rowIndex = buildSoucheRowIndex(allRows, yeastColumn)

    ;(souches || []).forEach(function (souche) {
        getRowsForSouche(allRows, yeastColumn, souche, rowIndex).forEach(function (row) {
            const rowId = row && row.__rowId != null ? row.__rowId : row && row.id
            if (rowId == null) return
            const key = makeExperimentConditionKey(row)
            if (!key) return
            if (!byKey.has(key)) byKey.set(key, {})
            const bucket = byKey.get(key)
            if (!bucket[souche]) bucket[souche] = []
            bucket[souche].push(rowId)
            rowKeyBySoucheId.set(souche + "|" + rowId, key)
            rowLookup.set(souche + "|" + rowId, row)
        })
    })

    return { byKey: byKey, rowKeyBySoucheId: rowKeyBySoucheId, rowLookup: rowLookup }
}

function matchedSoucheRowTokensForKey(index, key) {
    const set = new Set()
    if (!index || !key) return set
    const bucket = index.byKey.get(key)
    if (!bucket) return set
    Object.keys(bucket).forEach(function (souche) {
        ;(bucket[souche] || []).forEach(function (rowId) {
            set.add(souche + "|" + rowId)
        })
    })
    return set
}

function matchedSoucheRowTokensForLayer(index, layer) {
    const set = new Set()
    if (!index || !layer) return set
    Object.keys(layer.selectionsBySouche || {}).forEach(function (souche) {
        ;(layer.selectionsBySouche[souche] || []).forEach(function (rowId) {
            const key = index.rowKeyBySoucheId.get(souche + "|" + rowId)
            matchedSoucheRowTokensForKey(index, key).forEach(function (token) {
                set.add(token)
            })
        })
    })
    return set
}

function createComparisonHighlightController(index, souches) {
    const panels = {}
    let hoverKey = null
    let activeLayer = null

    function applyHighlights() {
        const hoverSet = matchedSoucheRowTokensForKey(index, hoverKey)
        const layerSet = matchedSoucheRowTokensForLayer(index, activeLayer)

        Object.keys(panels).forEach(function (souche) {
            const circles = panels[souche]
            if (!circles) return
            circles.each(function (d) {
                const rowId = d && d.__rowId != null ? d.__rowId : d && d.id
                const token = souche + "|" + rowId
                const el = d3.select(this)
                const isHover = hoverSet.has(token)
                const isLayer = layerSet.has(token)
                el.classed("is-match-hover", isHover)
                el.classed("is-match-layer", isLayer && !isHover)
                if (isHover || isLayer) el.raise()
            })
        })
    }

        return {
        registerPanel: function (souche, circles) {
            panels[souche] = circles
            applyHighlights()
        },
        setHoverFromRow: function (row) {
            hoverKey = row ? makeExperimentConditionKey(row) : null
            applyHighlights()
            return hoverKey
        },
        clearHover: function () {
            hoverKey = null
            applyHighlights()
        },
        setActiveLayer: function (layer) {
            activeLayer = layer || null
            applyHighlights()
        },
        getHoverKey: function () { return hoverKey },
        getActiveLayer: function () { return activeLayer },
        getMatchedTokensForKey: function (key) {
            return matchedSoucheRowTokensForKey(index, key)
        },
        formatMatchTooltip: function (conditionKey, xDim, yDim) {
            if (!conditionKey) return ""
            const lines = ["Matched condition:"]
            conditionKey.split("|").forEach(function (part) {
                const colon = part.indexOf(":")
                if (colon === -1) return
                lines.push("  " + part.slice(0, colon) + " = " + part.slice(colon + 1))
            })
            lines.push("")
            lines.push((xDim || "") + " / " + (yDim || "") + " across souches:")
            ;(souches || []).forEach(function (souche) {
                const bucket = index.byKey.get(conditionKey)
                const ids = bucket && bucket[souche] ? bucket[souche] : []
                if (!ids.length) {
                    lines.push(souche + ": (no match)")
                    return
                }
                ids.forEach(function (rowId) {
                    const row = index.rowLookup.get(souche + "|" + rowId)
                    if (!row) {
                        lines.push(souche + ": row " + rowId)
                        return
                    }
                    const xv = row[xDim]
                    const yv = row[yDim]
                    lines.push(souche + ": " + xDim + "=" + xv + ", " + yDim + "=" + yv)
                })
            })
            return lines.join("\n")
        }
    }
}

function createTabId() {
    return "souche-tab-" + Date.now() + "-" + Math.floor(Math.random() * 10000)
}

function getRowsForSouche(data, yeastColumn, soucheValue, rowIndex) {
    if (!data || !yeastColumn || soucheValue == null || soucheValue === "") return []
    const target = String(soucheValue)
    if (rowIndex) return rowIndex.get(target) || []
    return data.filter(function (row) { return String(row[yeastColumn]) === target })
}

function getSoucheFromRow(row, yeastColumn) {
    if (!row || !yeastColumn) return null
    const raw = row[yeastColumn]
    return raw == null || raw === "" ? null : String(raw)
}

function buildSoucheComparisonDomainMap(lowerRows, upperRows, dimensions, overviewOptions) {
    return comparisonDataset.buildComparisonDomainMap(lowerRows, upperRows, dimensions, overviewOptions)
}

function getPairKey(xDim, yDim) {
    return comparisonDataset.getPairKey(xDim, yDim)
}

function combinedExtent(rowsList, dim) {
    const values = []
    for (let i = 0; i < rowsList.length; i++) {
        const rows = rowsList[i]
        if (!rows) continue
        for (let j = 0; j < rows.length; j++) {
            const v = Number(rows[j][dim])
            if (Number.isFinite(v)) values.push(v)
        }
    }
    if (!values.length) return [0, 1]
    const ext = d3.extent(values)
    const pad = (ext[1] - ext[0]) * 0.05 || 0.5
    return [ext[0] - pad, ext[1] + pad]
}

function paddedExtent(values) {
    if (!values || !values.length) return [0, 1]
    const ext = d3.extent(values)
    const pad = (ext[1] - ext[0]) * 0.05 || 0.5
    return [ext[0] - pad, ext[1] + pad]
}

function getSelectionMembershipsForRow(selectionLayers, rowId, souche) {
    const memberships = []
    ;(selectionLayers || []).forEach(function (layer) {
        const ids = layer && layer.selectionsBySouche ? (layer.selectionsBySouche[souche] || []) : []
        if (ids.indexOf(rowId) !== -1) {
            memberships.push({
                layerId: layer.id,
                label: layer.label || layer.cname || layer.id,
                color: layer.color,
                annotation: layer.annotation || ""
            })
        }
    })
    return memberships
}

function normalizeComparisonColor(color) {
    if (!color) return "#22c55e"
    const s = String(color)
    if (s.charAt(0) === "#" && s.length >= 7) return s.substr(0, 7)
    return s
}

function getComparisonPointVisual(memberships) {
    if (!memberships.length) {
        return {
            selected: false,
            overlap: false,
            fill: "#2563eb",
            stroke: "none",
            strokeWidth: 0,
            opacity: 0.18,
            radius: 2
        }
    }
    const top = memberships[memberships.length - 1]
    const fill = normalizeComparisonColor(top.color)
    return {
        selected: true,
        overlap: memberships.length > 1,
        fill: fill,
        stroke: memberships.length > 1 ? "#111827" : fill,
        strokeWidth: memberships.length > 1 ? 2 : 1,
        opacity: 0.95,
        radius: memberships.length > 1 ? 5 : 4
    }
}

function filterRowsForComparisonChart(rows, xDim, yDim) {
    return (rows || []).filter(function (row) {
        return Number.isFinite(Number(row[xDim])) && Number.isFinite(Number(row[yDim]))
    })
}

function computeComparisonDomainsAcrossSouches(rows, xDim, yDim, yeastColumn, souches) {
    const rowIndex = buildSoucheRowIndex(rows, yeastColumn)
    const lists = (souches || []).map(function (souche) {
        return filterRowsForComparisonChart(getRowsForSouche(rows, yeastColumn, souche, rowIndex), xDim, yDim)
    })
    return {
        xDomain: combinedExtent(lists, xDim),
        yDomain: combinedExtent(lists, yDim)
    }
}

function drawSoucheComparisonChart(options) {
    const opts = options || {}
    const container = opts.container
    const rows = opts.rows || []
    const souche = opts.souche
    const xDim = opts.xDim
    const yDim = opts.yDim
    const selectionLayers = opts.selectionLayers || []
    const xDomain = opts.xDomain
    const yDomain = opts.yDomain
    const width = opts.width || 340
    const height = opts.height || 280
    const highlightController = opts.highlightController || null
    const onPointHover = typeof opts.onPointHover === "function" ? opts.onPointHover : null
    const onPointLeave = typeof opts.onPointLeave === "function" ? opts.onPointLeave : null
    const onPointMove = typeof opts.onPointMove === "function" ? opts.onPointMove : null

    const root = d3.select(container)
    root.selectAll("*").remove()

    const chartRows = filterRowsForComparisonChart(rows, xDim, yDim)
    const selectedRows = chartRows.filter(function (row) {
        const rowId = row && row.__rowId != null ? row.__rowId : row && row.id
        return getSelectionMembershipsForRow(selectionLayers, rowId, souche).length > 0
    })
    const overlapRows = chartRows.filter(function (row) {
        const rowId = row && row.__rowId != null ? row.__rowId : row && row.id
        return getSelectionMembershipsForRow(selectionLayers, rowId, souche).length > 1
    })

    root.append("div")
        .attr("class", "comparison-title souche-mini-title")
        .text(String(souche))

    root.append("div")
        .attr("class", "comparison-count")
        .style("font-size", "12px")
        .style("color", "#6b7280")
        .style("margin-bottom", "6px")
        .text(chartRows.length + " points, " + selectedRows.length + " selected, " + overlapRows.length + " overlaps")

    const margin = { top: 12, right: 16, bottom: 40, left: 48 }
    const innerWidth = Math.max(40, width - margin.left - margin.right)
    const innerHeight = Math.max(40, height - margin.top - margin.bottom)

    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerWidth])
    const yScale = d3.scaleLinear().domain(yDomain).range([innerHeight, 0])

    const svg = root.append("svg")
        .attr("width", width)
        .attr("height", height)

    const g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

    g.append("g")
        .attr("transform", "translate(0," + innerHeight + ")")
        .call(d3.axisBottom(xScale).ticks(5))
        .selectAll("text")
        .style("font-size", "9px")

    g.append("g")
        .call(d3.axisLeft(yScale).ticks(5))
        .selectAll("text")
        .style("font-size", "9px")

    g.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 32)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("font-weight", "600")
        .text(xDim)

    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -36)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("font-weight", "600")
        .text(yDim)

    const points = g.selectAll(".comparison-point")
        .data(chartRows, function (d) { return d && d.__rowId != null ? d.__rowId : d && d.id })
        .join("circle")
        .attr("class", "comparison-point")
        .attr("data-row-id", function (d) { return d && d.__rowId != null ? d.__rowId : d && d.id })
        .attr("data-souche", souche)
        .attr("cx", function (d) { return xScale(Number(d[xDim])) })
        .attr("cy", function (d) { return yScale(Number(d[yDim])) })
        .each(function (d) {
            const rowId = d && d.__rowId != null ? d.__rowId : d && d.id
            const memberships = getSelectionMembershipsForRow(selectionLayers, rowId, souche)
            const visual = getComparisonPointVisual(memberships)
            const circle = d3.select(this)
            circle
                .classed("is-selected", visual.selected)
                .classed("is-overlap-selected", visual.overlap)
                .attr("r", visual.radius)
                .attr("fill", visual.fill)
                .attr("stroke", visual.stroke)
                .attr("stroke-width", visual.strokeWidth)
                .attr("opacity", visual.opacity)
            const titleText = !memberships.length
                ? souche + "\nrow " + rowId
                : souche + "\nrow " + rowId + "\nSelections: " + memberships.map(function (m) { return m.label }).join(", ")
            circle.append("title").text(titleText)
        })

    if (highlightController || onPointHover || onPointLeave || onPointMove) {
        points
            .style("cursor", "pointer")
            .on("mouseenter", function (d, i, nodes) {
                if (onPointHover) {
                    onPointHover(d, souche, d3.event, nodes[i])
                } else if (highlightController) {
                    highlightController.setHoverFromRow(d)
                }
            })
            .on("mousemove", function (d) {
                if (onPointMove) {
                    onPointMove(d, souche, d3.event)
                }
            })
        svg.on("mouseleave", function () {
            if (onPointLeave) {
                onPointLeave(souche, d3.event)
            } else if (highlightController) {
                highlightController.clearHover()
            }
        })
    }

    if (highlightController) {
        highlightController.registerPanel(souche, points)
    }
}

function starPath(cx, cy, outerR, innerR) {
    const points = []
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR
        const a = Math.PI / 2 + i * Math.PI / 5
        points.push([cx + r * Math.cos(a), cy - r * Math.sin(a)])
    }
    return "M" + points.map(function (p) { return p[0] + "," + p[1] }).join("L") + "Z"
}

function renderSoucheMiniChart(container, options) {
    const opts = options || {}
    const xDim = opts.xDim
    const yDim = opts.yDim
    const series = opts.series || []
    const width = opts.width || 280
    const height = opts.height || 220
    const title = opts.title || ""

    const root = d3.select(container)
    root.selectAll("*").remove()

    if (!xDim || !yDim || !series.length) {
        root.append("div").attr("class", "souche-mini-empty").text("No data for chart.")
        return
    }

    const pad = { top: 28, right: 12, bottom: 36, left: 44 }
    const innerW = Math.max(40, width - pad.left - pad.right)
    const innerH = Math.max(40, height - pad.top - pad.bottom)

    const allRows = []
    series.forEach(function (s) {
        if (s.rows) allRows.push(s.rows)
    })

    const xDomain = opts.xDomain || combinedExtent(allRows, xDim)
    const yDomain = opts.yDomain || combinedExtent(allRows, yDim)
    const x = d3.scaleLinear().domain(xDomain).range([0, innerW])
    const y = d3.scaleLinear().domain(yDomain).range([innerH, 0])

    const wrap = root.append("div").attr("class", "souche-mini-chart-wrap")
    if (title) {
        wrap.append("div").attr("class", "souche-mini-title").text(title)
    }

    const svg = wrap.append("svg")
        .attr("class", "souche-mini-chart")
        .attr("width", width)
        .attr("height", height)

    const plot = svg.append("g")
        .attr("transform", "translate(" + pad.left + "," + pad.top + ")")

    plot.append("g")
        .attr("transform", "translate(0," + innerH + ")")
        .call(d3.axisBottom(x).ticks(4))
        .selectAll("text")
        .style("font-size", "9px")

    plot.append("g")
        .call(d3.axisLeft(y).ticks(4))
        .selectAll("text")
        .style("font-size", "9px")

    plot.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH + 30)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("font-weight", "600")
        .text(xDim)

    plot.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerH / 2)
        .attr("y", -34)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("font-weight", "600")
        .text(yDim)

    const legend = wrap.append("div").attr("class", "souche-mini-legend")
    series.forEach(function (s, idx) {
        const color = s.color || SOUCHE_SERIES_COLORS[idx % SOUCHE_SERIES_COLORS.length]
        const shape = s.shape || (idx === 0 ? "circle" : "star")
        const rows = (s.rows || []).filter(function (d) { return d.visibility !== false })
        const selectionStyleByRowId = s.selectionStyleByRowId && typeof s.selectionStyleByRowId.get === "function"
            ? s.selectionStyleByRowId
            : new Map()

        if (shape === "star") {
            plot.selectAll(".souche-star-" + idx)
                .data(rows)
                .join("path")
                .attr("class", "souche-star-" + idx)
                .attr("d", function (d) {
                    const cx = x(Number(d[xDim]))
                    const cy = y(Number(d[yDim]))
                    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null
                    return starPath(cx, cy, 5, 2.2)
                })
                .attr("fill", color)
                .attr("stroke", "#374151")
                .attr("stroke-width", 0.6)
                .attr("opacity", 0.85)
        } else {
            plot.selectAll(".souche-dot-" + idx)
                .data(rows)
                .join("circle")
                .attr("class", "souche-dot-" + idx + " comparison-point")
                .attr("data-row-id", function (d) { return d && d.__rowId != null ? d.__rowId : (d ? d.id : null) })
                .attr("cx", function (d) { return x(Number(d[xDim])) })
                .attr("cy", function (d) { return y(Number(d[yDim])) })
                .attr("r", function (d) {
                    const rowId = d && d.__rowId != null ? d.__rowId : (d ? d.id : null)
                    return selectionStyleByRowId.has(rowId) ? 4 : 2.8
                })
                .attr("fill", function (d) {
                    const rowId = d && d.__rowId != null ? d.__rowId : (d ? d.id : null)
                    const style = selectionStyleByRowId.get(rowId)
                    return style && style.color ? style.color : color
                })
                .attr("stroke", function (d) {
                    const rowId = d && d.__rowId != null ? d.__rowId : (d ? d.id : null)
                    const style = selectionStyleByRowId.get(rowId)
                    return style && style.color ? style.color : "#1e3a8a"
                })
                .attr("stroke-width", function (d) {
                    const rowId = d && d.__rowId != null ? d.__rowId : (d ? d.id : null)
                    return selectionStyleByRowId.has(rowId) ? 1.0 : 0.5
                })
                .attr("opacity", function (d) {
                    const rowId = d && d.__rowId != null ? d.__rowId : (d ? d.id : null)
                    return selectionStyleByRowId.has(rowId) ? 0.95 : 0.22
                })
        }

        const leg = legend.append("span").attr("class", "souche-mini-legend-item")
        leg.append("span")
            .attr("class", "souche-mini-legend-swatch")
            .style("background", color)
            .text(shape === "star" ? "\u2605" : "\u25CF")
        leg.append("span").text(s.label || ("Souche " + (idx + 1)))
    })
}

function buildSharedDomains(rows, yeastColumn, souches, xDim, yDim) {
    const rowIndex = buildSoucheRowIndex(rows, yeastColumn)
    const lists = (souches || []).map(function (souche) {
        return getRowsForSouche(rows, yeastColumn, souche, rowIndex)
    })
    return {
        xDomain: combinedExtent(lists, xDim),
        yDomain: combinedExtent(lists, yDim)
    }
}

module.exports = {
    MAX_SAVED_PAIR_COMPARISONS: MAX_SAVED_PAIR_COMPARISONS,
    MAX_OVERLAY_SOUCHES: MAX_OVERLAY_SOUCHES,
    SOUCHE_SERIES_COLORS: SOUCHE_SERIES_COLORS,
    MATCHING_INPUT_DIMS: MATCHING_INPUT_DIMS,
    createTabId: createTabId,
    buildSoucheRowIndex: buildSoucheRowIndex,
    getRowsForSouche: getRowsForSouche,
    getSoucheFromRow: getSoucheFromRow,
    buildSoucheComparisonDomainMap: buildSoucheComparisonDomainMap,
    buildSharedDomains: buildSharedDomains,
    computeComparisonDomainsAcrossSouches: computeComparisonDomainsAcrossSouches,
    getPairKey: getPairKey,
    getSelectionMembershipsForRow: getSelectionMembershipsForRow,
    getComparisonPointVisual: getComparisonPointVisual,
    makeExperimentConditionKey: makeExperimentConditionKey,
    buildExperimentConditionIndex: buildExperimentConditionIndex,
    createComparisonHighlightController: createComparisonHighlightController,
    drawSoucheComparisonChart: drawSoucheComparisonChart,
    renderSoucheMiniChart: renderSoucheMiniChart
}
