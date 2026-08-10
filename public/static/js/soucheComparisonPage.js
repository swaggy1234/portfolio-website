/**
 * Standalone Souche comparison page (opened in a new browser tab).
 */
const d3 = require('d3')
const datasetStore = require('./datasetStore.js')
const soucheComparison = require('./soucheComparison.js')
const soucheComparisonStorage = require('./soucheComparisonStorage.js')

let currentState = null
let currentRows = null
let selectionBroadcast = null
let activeSelectionLayerId = null
let matchTooltipEl = null

function ensureComparisonRowIds(rows) {
    if (!rows || !rows.length) return rows
    rows.forEach(function (row, idx) {
        if (row.__rowId == null && row.id == null) {
            row.__rowId = idx
            row.id = idx
        } else if (row.__rowId == null) {
            row.__rowId = row.id
        } else if (row.id == null) {
            row.id = row.__rowId
        }
    })
    return rows
}

function applySelectionLayersUpdate(selectionLayers) {
    if (!currentState || !currentRows) return
    currentState.selectionLayers = selectionLayers || []
    renderComparison(currentState, currentRows)
}

function setupSelectionSync(sessionId) {
    if (typeof BroadcastChannel === "undefined") return
    if (selectionBroadcast) {
        selectionBroadcast.close()
        selectionBroadcast = null
    }
    selectionBroadcast = new BroadcastChannel('visprom_souche_comparison')
    selectionBroadcast.onmessage = function (event) {
        const data = event && event.data
        if (!data || data.type !== 'visprom_comparison_selection_update') return
        if (sessionId && data.sessionId && data.sessionId !== sessionId) return
        applySelectionLayersUpdate(data.selectionLayers)
    }
}

function showError(message) {
    const root = document.getElementById('soucheComparisonRoot')
    if (!root) return
    root.innerHTML = ''
    const el = document.createElement('div')
    el.className = 'souche-page-error'
    el.textContent = message
    root.appendChild(el)
}

function setSaveStatus(message, isError) {
    const el = document.getElementById('soucheComparisonSaveStatus')
    if (!el) return
    el.textContent = message || ''
    el.style.color = isError ? '#b42318' : '#0b6b2e'
}

function resolveAllSouches(state, rows) {
    if (state.souchesToCompare && state.souchesToCompare.length) {
        return state.souchesToCompare.slice()
    }
    if (state.availableYeastTypes && state.availableYeastTypes.length) {
        return state.availableYeastTypes.slice()
    }
    if (!rows || !state.yeastColumn) return []
    const seen = new Set()
    const out = []
    rows.forEach(function (row) {
        const val = row[state.yeastColumn]
        if (val == null || val === '') return
        const key = String(val)
        if (!seen.has(key)) {
            seen.add(key)
            out.push(key)
        }
    })
    return out.sort()
}

function ensureMatchTooltip() {
    if (matchTooltipEl) return matchTooltipEl
    const el = document.createElement('div')
    el.id = 'comparison-match-tooltip'
    el.className = 'comparison-match-tooltip'
    el.style.display = 'none'
    document.body.appendChild(el)
    matchTooltipEl = el
    return el
}

function showMatchTooltip(text, event) {
    if (!text) return
    const el = ensureMatchTooltip()
    el.textContent = text
    el.style.display = 'block'
    positionMatchTooltip(event)
}

function positionMatchTooltip(event) {
    if (!matchTooltipEl || matchTooltipEl.style.display === 'none') return
    const pad = 12
    const maxW = 360
    matchTooltipEl.style.maxWidth = maxW + 'px'
    const rect = matchTooltipEl.getBoundingClientRect()
    let left = (event && event.clientX != null ? event.clientX : 0) + pad
    let top = (event && event.clientY != null ? event.clientY : 0) + pad
    if (left + rect.width > window.innerWidth - pad) {
        left = Math.max(pad, window.innerWidth - rect.width - pad)
    }
    if (top + rect.height > window.innerHeight - pad) {
        top = Math.max(pad, (event && event.clientY != null ? event.clientY : 0) - rect.height - pad)
    }
    matchTooltipEl.style.left = left + 'px'
    matchTooltipEl.style.top = top + 'px'
}

function hideMatchTooltip() {
    if (matchTooltipEl) matchTooltipEl.style.display = 'none'
}

function renderSelectionLegend(selectionLayers, onLayerActivate) {
    const legend = d3.select('#comparison-legend')
    if (legend.empty()) return
    legend.html('')

    legend.append('div')
        .attr('class', 'legend-title')
        .text('Selections (click to highlight matches)')

    if (!selectionLayers || !selectionLayers.length) {
        legend.append('div')
            .attr('class', 'legend-empty')
            .style('font-size', '12px')
            .style('color', '#6b7280')
            .text('No selection layers saved for this comparison.')
        return
    }

    selectionLayers.forEach(function (layer) {
        const row = legend.append('div')
            .attr('class', 'legend-row')
            .classed('is-active', activeSelectionLayerId === layer.id)
            .style('cursor', 'pointer')
            .on('click', function () {
                if (activeSelectionLayerId === layer.id) {
                    activeSelectionLayerId = null
                } else {
                    activeSelectionLayerId = layer.id
                }
                if (typeof onLayerActivate === 'function') {
                    onLayerActivate(activeSelectionLayerId
                        ? selectionLayers.find(function (l) { return l.id === activeSelectionLayerId })
                        : null)
                }
                legend.selectAll('.legend-row')
                    .classed('is-active', function () {
                        return d3.select(this).datum() && d3.select(this).datum().id === activeSelectionLayerId
                    })
            })
            .datum(layer)

        row.append('span')
            .attr('class', 'selection-chip')
            .style('display', 'inline-block')
            .style('width', '10px')
            .style('height', '10px')
            .style('border-radius', '50%')
            .style('background', layer.color && layer.color.charAt(0) === '#'
                ? layer.color.substr(0, 7)
                : (layer.color || '#888'))
            .style('border', '1px solid #111827')
            .style('margin-right', '5px')

        row.append('span')
            .text(layer.label || layer.cname || layer.id)
    })
}

function renderComparison(state, rows) {
    const xDim = state.xDim
    const yDim = state.yDim
    const yeastColumn = state.yeastColumn
    const selectionLayers = state.selectionLayers || []
    const allSouches = resolveAllSouches(state, rows)

    document.title = 'Souche Comparison: ' + xDim + ' vs ' + yDim

    const titleEl = document.getElementById('soucheComparisonTitle')
    const subtitleEl = document.getElementById('soucheComparisonSubtitle')
    const summaryEl = document.getElementById('comparison-summary')
    const metaEl = document.getElementById('soucheComparisonMeta')
    const chartHost = document.getElementById('soucheComparisonCharts')

    if (titleEl) titleEl.textContent = xDim + ' vs ' + yDim
    if (subtitleEl) {
        subtitleEl.textContent = xDim + ' vs ' + yDim + ' across all Souches (' + allSouches.length + ')'
    }
    if (summaryEl) {
        summaryEl.textContent = xDim + ' vs ' + yDim + ' across all Souches (' + allSouches.length + ')'
    }
    if (metaEl) {
        const parts = []
        if (state.datasetId) {
            const meta = datasetStore.getDatasetMetaById(state.datasetId)
            parts.push('Dataset: ' + (meta && meta.name ? meta.name : state.datasetId))
        }
        if (state.openedAt) parts.push('Opened: ' + state.openedAt)
        metaEl.textContent = parts.join(' · ')
    }

    console.log('[Comparison page state]', {
        xDim: xDim,
        yDim: yDim,
        yeastColumn: yeastColumn,
        souchesToCompare: allSouches,
        selectionLayerCount: selectionLayers.length
    })

    allSouches.forEach(function (souche) {
        console.log('[Comparison souche selections]', {
            souche: souche,
            layerCounts: selectionLayers.map(function (layer) {
                return {
                    layerId: layer.id,
                    label: layer.label || layer.cname || layer.id,
                    color: layer.color,
                    countForSouche: layer.selectionsBySouche && layer.selectionsBySouche[souche]
                        ? layer.selectionsBySouche[souche].length
                        : 0
                }
            })
        })
    })

    if (!chartHost) return

    chartHost.innerHTML = ''
    const chartW = Math.max(360, chartHost.clientWidth - 32)

    if (!allSouches.length) {
        chartHost.textContent = 'No Souche values to compare.'
        return
    }

    const domains = soucheComparison.computeComparisonDomainsAcrossSouches(
        rows,
        xDim,
        yDim,
        yeastColumn,
        allSouches
    )

    const conditionIndex = soucheComparison.buildExperimentConditionIndex(rows, yeastColumn, allSouches)
    const highlightController = soucheComparison.createComparisonHighlightController(conditionIndex, allSouches)
    const activeLayer = activeSelectionLayerId
        ? selectionLayers.find(function (layer) { return layer.id === activeSelectionLayerId })
        : null
    if (activeLayer) {
        highlightController.setActiveLayer(activeLayer)
    }

    renderSelectionLegend(selectionLayers, function (layer) {
        highlightController.setActiveLayer(layer)
        d3.selectAll('#comparison-legend .legend-row')
            .classed('is-active', function () {
                const d = d3.select(this).datum()
                return !!(layer && d && d.id === layer.id)
            })
    })

    const grid = document.createElement('div')
    grid.className = 'souche-page-chart-grid'
    chartHost.appendChild(grid)

    const count = allSouches.length
    const gap = 16
    const minCellW = 320
    let cols = Math.max(1, Math.floor((chartW + gap) / (minCellW + gap)))
    cols = Math.min(cols, count)
    const miniW = Math.max(minCellW, Math.floor((chartW - (cols - 1) * gap) / cols))
    const miniH = Math.max(280, Math.min(420, Math.round(miniW * 0.82)))

    allSouches.forEach(function (souche) {
        const cell = document.createElement('div')
        cell.className = 'souche-page-chart-cell'
        grid.appendChild(cell)

        const soucheRows = soucheComparison.getRowsForSouche(rows, yeastColumn, souche)
        soucheComparison.drawSoucheComparisonChart({
            container: cell,
            rows: soucheRows,
            souche: souche,
            xDim: xDim,
            yDim: yDim,
            selectionLayers: selectionLayers,
            xDomain: domains.xDomain,
            yDomain: domains.yDomain,
            width: miniW,
            height: miniH,
            highlightController: highlightController,
            onPointHover: function (row, soucheName, event) {
                const key = highlightController.setHoverFromRow(row)
                const text = highlightController.formatMatchTooltip(key, xDim, yDim)
                showMatchTooltip(text, event)
            },
            onPointLeave: function () {
                highlightController.clearHover()
                hideMatchTooltip()
            },
            onPointMove: function (row, soucheName, event) {
                positionMatchTooltip(event)
            }
        })
    })

    updateSaveButtonState(state)
}

function updateSaveButtonState(state) {
    const btn = document.getElementById('soucheComparisonSaveBtn')
    if (!btn || !state) return
    const saved = soucheComparisonStorage.readSavedSouchePairs()
    const key = soucheComparisonStorage.getPairKey(state.xDim, state.yDim)
    const exists = saved.some(function (p) {
        return soucheComparisonStorage.getPairKey(p.xDim, p.yDim) === key
    })
    btn.disabled = exists
    btn.textContent = exists ? 'Saved to provenance' : 'Save pair to provenance'
}

function saveCurrentPairToProvenance() {
    if (!currentState) return
    const result = soucheComparisonStorage.addSavedSouchePair({
        xDim: currentState.xDim,
        yDim: currentState.yDim,
        souchesToCompare: currentState.souchesToCompare || []
    })
    if (!result.ok) {
        if (result.reason === 'exists') {
            setSaveStatus('This pair is already saved in provenance.', true)
        } else if (result.reason === 'limit') {
            setSaveStatus('You can save up to ' + soucheComparisonStorage.MAX_SAVED_PAIR_COMPARISONS + ' pairs.', true)
        } else {
            setSaveStatus('Could not save pair. Free browser storage and try again.', true)
        }
        updateSaveButtonState(currentState)
        return
    }

    const payload = {
        type: 'visprom_save_souche_pair',
        xDim: currentState.xDim,
        yDim: currentState.yDim,
        souchesToCompare: (currentState.souchesToCompare || []).slice()
    }
    if (window.opener && !window.opener.closed) {
        try {
            window.opener.postMessage(payload, window.location.origin)
        } catch (e) {
            window.opener.postMessage(payload, '*')
        }
    }

    setSaveStatus('Saved ' + currentState.xDim + ' vs ' + currentState.yDim + ' to provenance.', false)
    updateSaveButtonState(currentState)
}

function readComparisonState(comparisonId, sessionId) {
    return soucheComparisonStorage.readComparisonState(comparisonId, sessionId)
}

function setupSaveButton() {
    const btn = document.getElementById('soucheComparisonSaveBtn')
    if (!btn || btn.__vispromBound) return
    btn.__vispromBound = true
    btn.addEventListener('click', saveCurrentPairToProvenance)
}

function boot() {
    console.log("[Souche comparison page script loaded]")
    console.log("[Souche comparison DOM ready]")
    setupSaveButton()
    const params = new URLSearchParams(window.location.search)
    const comparisonId = params.get('comparisonId')
    const sessionId = params.get('sessionId')
    console.log("[Souche comparison params]", { comparisonId: comparisonId, sessionId: sessionId })
    const rawState = comparisonId ? sessionStorage.getItem(comparisonId) : null
    const rawDataset = sessionStorage.getItem("visprom-current-dataset")
    console.log("[Souche comparison storage]", {
        hasState: !!rawState,
        hasDataset: !!rawDataset
    })
    if (!comparisonId) {
        showError('Missing comparison id. Open this page by double-clicking a SPLOM cell in VisProm.')
        return
    }

    if (sessionId) {
        window.vispromSessionId = sessionId
    }

    const state = readComparisonState(comparisonId, sessionId)
    if (!state) {
        showError('Comparison data was not found. Open a comparison from VisProm (double-click a SPLOM cell), or the data may have been cleared from browser storage.')
        return
    }

    datasetStore.loadRowsForComparison(state.datasetId, state)
        .then(function (rows) {
            if (!rows || !rows.length) {
                showError('Dataset is empty or could not be loaded.')
                return
            }
            ensureComparisonRowIds(rows)
            currentState = state
            currentRows = rows
            setupSelectionSync(sessionId)
            renderComparison(state, rows)
            window.addEventListener('resize', function () {
                if (currentState && currentRows) {
                    renderComparison(currentState, currentRows)
                }
            })
        })
        .catch(function (err) {
            showError(err && err.message ? err.message : 'Could not load dataset for comparison.')
        })
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
} else {
    boot()
}
