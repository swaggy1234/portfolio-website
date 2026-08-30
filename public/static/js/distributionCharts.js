/**
 * 1D distribution overlays for SPLOM diagonals and the main-chart detail view.
 * Compare mode: one density curve per group (e.g. LMD13 vs LMD22), greyed under the dim label.
 */
const d3 = require('d3')

const DEFAULT_PALETTE = ['#1d4ed8', '#dc2626', '#059669', '#7c3aed']

function collectNumericValues(rows, dim) {
  const out = []
  if (!rows || !dim) return out
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.visibility === false) continue
    const n = Number(row[dim])
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

/** Simple Gaussian KDE → dens[samples] over [x0, x1]. O(n * samples). */
function kdeCurve(values, x0, x1, samples) {
  const n = values.length
  const steps = Math.max(16, samples || 48)
  if (!n || !Number.isFinite(x0) || !Number.isFinite(x1) || x1 <= x0) {
    return { xs: [], dens: [], peak: 0 }
  }
  const sorted = values.slice().sort(d3.ascending)
  const iqr = d3.quantile(sorted, 0.75) - d3.quantile(sorted, 0.25)
  const std = d3.deviation(sorted) || 1
  const span = x1 - x0
  let bw = 1.06 * Math.min(std, iqr / 1.34) * Math.pow(n, -0.2)
  if (!Number.isFinite(bw) || bw <= 0) bw = span / 20
  bw = Math.max(bw, span / 80)

  const xs = []
  const dens = []
  let peak = 0
  const inv = 1 / (bw * Math.sqrt(2 * Math.PI) * n)
  for (let s = 0; s <= steps; s++) {
    const x = x0 + (span * s) / steps
    let sum = 0
    for (let i = 0; i < n; i++) {
      const u = (x - values[i]) / bw
      sum += Math.exp(-0.5 * u * u)
    }
    const y = sum * inv
    xs.push(x)
    dens.push(y)
    if (y > peak) peak = y
  }
  return { xs: xs, dens: dens, peak: peak }
}

function resolveExtent(valuesList, domainHint) {
  if (domainHint && Array.isArray(domainHint) && domainHint.length >= 2 &&
      Number.isFinite(domainHint[0]) && Number.isFinite(domainHint[1]) &&
      domainHint[1] > domainHint[0]) {
    return [domainHint[0], domainHint[1]]
  }
  let min = Infinity
  let max = -Infinity
  for (let g = 0; g < valuesList.length; g++) {
    const vals = valuesList[g]
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] < min) min = vals[i]
      if (vals[i] > max) max = vals[i]
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1
    return [min - pad, max + pad]
  }
  const span = max - min
  return [min - span * 0.05, max + span * 0.05]
}

/**
 * @param {Array<{label:string, values:number[], color?:string}>} series
 * @param {{extent?:[number,number], samples?:number}} options
 */
function buildDistributionSeries(series, options) {
  const opts = options || {}
  const cleaned = (series || []).map(function (s) {
    return {
      label: s.label || 'group',
      values: (s.values || []).filter(Number.isFinite),
      color: s.color || null,
      lineStyle: s.lineStyle || null
    }
  }).filter(function (s) { return s.values.length >= 2 })

  const valuesList = cleaned.map(function (s) { return s.values })
  const extent = resolveExtent(valuesList, opts.extent)
  const samples = opts.samples || 48
  let peak = 0
  const curves = cleaned.map(function (s, i) {
    const curve = kdeCurve(s.values, extent[0], extent[1], samples)
    if (curve.peak > peak) peak = curve.peak
    return {
      label: s.label,
      color: s.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
      lineStyle: s.lineStyle || (i === 0 ? 'solid' : 'dotted'),
      xs: curve.xs,
      dens: curve.dens,
      peak: curve.peak,
      n: s.values.length
    }
  })
  return { extent: extent, peak: peak || 1, curves: curves }
}

function seriesFromRowGroups(groups, dim, domainHint) {
  const series = (groups || []).map(function (g) {
    return {
      label: g.label || 'group',
      values: collectNumericValues(g.rows, dim),
      color: g.color,
      lineStyle: g.lineStyle
    }
  })
  return buildDistributionSeries(series, { extent: domainHint, samples: 48 })
}

function strokeDashForLineStyle(lineStyle) {
  if (lineStyle === 'dotted' || lineStyle === 'dashed') return '3 4'
  return null
}

function resolveCompareLineStyle(curve, curveIndex) {
  if (curve.lineStyle) return curve.lineStyle
  return curveIndex === 0 ? 'solid' : 'dotted'
}

function renderDistributionCurve(parent, curve, x, y, options) {
  const opts = options || {}
  if (!curve || !curve.xs.length) return

  const lineStyle = resolveCompareLineStyle(curve, opts.curveIndex || 0)
  const strokeColor = opts.stroke || curve.color
  const dash = strokeDashForLineStyle(lineStyle)
  const y0 = opts.baselineY != null ? opts.baselineY : y(0)
  const pts = curve.xs.map(function (_, i) { return i })

  const line = d3.line()
    .x(function (_, i) { return x(curve.xs[i]) })
    .y(function (_, i) { return y(curve.dens[i]) })
    .curve(d3.curveBasis)

  if (!opts.lineOnly) {
    const area = d3.area()
      .x(function (_, i) { return x(curve.xs[i]) })
      .y0(y0)
      .y1(function (_, i) { return y(curve.dens[i]) })
      .curve(d3.curveBasis)
    parent.append('path')
      .datum(pts)
      .attr('d', area)
      .attr('fill', curve.color)
      .attr('fill-opacity', opts.fillOpacity != null ? opts.fillOpacity : 0.18)
      .attr('stroke', 'none')
  }

  parent.append('path')
    .datum(pts)
    .attr('d', line)
    .attr('fill', 'none')
    .attr('stroke', strokeColor)
    .attr('stroke-width', opts.strokeWidth != null ? opts.strokeWidth : 2)
    .attr('stroke-opacity', opts.strokeOpacity != null ? opts.strokeOpacity : 0.95)
    .attr('stroke-dasharray', dash)
    .attr('stroke-linecap', 'round')
}

/**
 * Mini diagonal: greyed area+line curves, dim label on top. Not selectable.
 */
function renderMiniDistribution(containerEl, model, dimLabel, options) {
  const opts = options || {}
  const el = typeof containerEl.node === 'function' ? containerEl.node() : containerEl
  if (!el) return
  const host = d3.select(el)
  host.selectAll('*').remove()

  const w = Math.max(24, opts.width || el.clientWidth || 72)
  const h = Math.max(24, opts.height || el.clientHeight || 72)
  const pad = Math.max(3, Math.floor(Math.min(w, h) * 0.08))

  host.style('position', 'relative')
    .style('cursor', opts.clickable ? 'pointer' : 'default')
    .style('overflow', 'hidden')

  const svg = host.append('svg')
    .attr('class', 'splom-diag-dist')
    .attr('width', w)
    .attr('height', h)
    .style('position', 'absolute')
    .style('inset', '0')
    .style('opacity', opts.bgOpacity != null ? opts.bgOpacity : 0.55)
    .style('pointer-events', 'none')

  const curves = (model && model.curves) || []
  const peak = (model && model.peak) || 1
  const extent = (model && model.extent) || [0, 1]
  const x = d3.scaleLinear().domain(extent).range([pad, w - pad])
  const y = d3.scaleLinear().domain([0, peak * 1.08]).range([h - pad, pad])

  const muted = !!opts.muted
  const neutralCompare = !!opts.neutralCompare
  const strokeOpacity = muted ? 0.55 : 0.75
  const strokeWidth = muted ? 1.05 : 1.25
  const neutralStroke = '#4b5563'

  curves.forEach(function (curve, curveIndex) {
    renderDistributionCurve(svg, curve, x, y, {
      curveIndex: curveIndex,
      stroke: neutralCompare ? neutralStroke : curve.color,
      lineOnly: neutralCompare,
      strokeWidth: strokeWidth,
      strokeOpacity: strokeOpacity,
      fillOpacity: muted ? 0.12 : 0.18,
      baselineY: h - pad
    })
  })

  host.append('span')
    .attr('class', 'splom-diag-label')
    .style('position', 'relative')
    .style('z-index', '1')
    .style('pointer-events', 'none')
    .style('font-size', '11px')
    .style('font-weight', '700')
    .style('color', '#374151')
    .style('text-shadow', '0 0 6px #f3f4f6, 0 0 3px #f3f4f6, 0 1px 0 #f9fafb')
    .text(dimLabel || '')
}

/**
 * Full main-chart distribution: axes, curves, legend. No brush/selection.
 */
function renderMainDistribution(svgSel, model, dimLabel, options) {
  const opts = options || {}
  const svg = svgSel
  if (!svg || svg.empty()) return

  const width = opts.width || Number(svg.attr('width')) || 640
  const height = opts.height || Number(svg.attr('height')) || 420
  const padL = 52
  const padR = 20
  const padT = 36
  const padB = 48

  svg.selectAll('*').remove()
  svg.attr('width', width).attr('height', height)
  svg.classed('distribution-view', true)

  const g = svg.append('g').attr('class', 'distribution-root')
  const curves = (model && model.curves) || []
  const peak = (model && model.peak) || 1
  const extent = (model && model.extent) || [0, 1]
  const neutralCompare = !!opts.neutralCompare
  const neutralStroke = '#374151'

  const x = d3.scaleLinear().domain(extent).range([padL, width - padR])
  const y = d3.scaleLinear().domain([0, peak * 1.1]).range([height - padB, padT])

  g.append('g')
    .attr('class', 'xAxis')
    .attr('transform', 'translate(0,' + (height - padB) + ')')
    .call(d3.axisBottom(x).ticks(6))
  g.append('g')
    .attr('class', 'yAxis')
    .attr('transform', 'translate(' + padL + ',0)')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.2~s')))

  g.append('text')
    .attr('class', 'xLabel')
    .attr('x', (padL + width - padR) / 2)
    .attr('y', height - 12)
    .attr('text-anchor', 'middle')
    .attr('fill', '#111827')
    .style('font-size', '13px')
    .style('font-weight', '600')
    .text(dimLabel || '')

  g.append('text')
    .attr('class', 'yLabel')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(padT + height - padB) / 2)
    .attr('y', 14)
    .attr('text-anchor', 'middle')
    .attr('fill', '#111827')
    .style('font-size', '12px')
    .text('Density')

  curves.forEach(function (curve, curveIndex) {
    renderDistributionCurve(g, curve, x, y, {
      curveIndex: curveIndex,
      stroke: neutralCompare ? neutralStroke : curve.color,
      lineOnly: neutralCompare,
      strokeWidth: neutralCompare ? 2.25 : 2.5,
      strokeOpacity: 0.95,
      fillOpacity: 0.18,
      baselineY: height - padB
    })
  })

  const legendPad = 8
  const rowH = 18
  const legendW = 150
  const legendH = legendPad * 2 + Math.max(1, curves.length) * rowH
  const legendX = Math.max(padL + 8, width - padR - legendW - 4)
  const legendY = padT

  const legend = g.append('g')
    .attr('class', 'distribution-legend')
    .attr('transform', 'translate(' + legendX + ',' + legendY + ')')
  legend.append('rect')
    .attr('width', legendW)
    .attr('height', legendH)
    .attr('rx', 4)
    .attr('fill', '#ffffff')
    .attr('fill-opacity', 0.92)
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', 1)
  curves.forEach(function (curve, i) {
    const row = legend.append('g')
      .attr('transform', 'translate(' + legendPad + ',' + (legendPad + i * rowH + 12) + ')')
    const legendStroke = neutralCompare ? neutralStroke : curve.color
    const lineStyle = resolveCompareLineStyle(curve, i)
    row.append('line')
      .attr('x1', 0).attr('x2', 22).attr('y1', 0).attr('y2', 0)
      .attr('stroke', legendStroke).attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
      .attr('stroke-dasharray', strokeDashForLineStyle(lineStyle))
    row.append('text')
      .attr('x', 28).attr('y', 4)
      .attr('fill', '#111827')
      .style('font-size', '12px')
      .style('font-weight', '600')
      .text(curve.label + ' (n=' + curve.n + ')')
  })

  g.append('text')
    .attr('class', 'distribution-hint')
    .attr('x', padL)
    .attr('y', 14)
    .attr('fill', '#6b7280')
    .style('font-size', '11px')
    .text('Distribution view — selection tools disabled')
}

module.exports = {
  collectNumericValues: collectNumericValues,
  kdeCurve: kdeCurve,
  buildDistributionSeries: buildDistributionSeries,
  seriesFromRowGroups: seriesFromRowGroups,
  renderMiniDistribution: renderMiniDistribution,
  renderMainDistribution: renderMainDistribution
}
