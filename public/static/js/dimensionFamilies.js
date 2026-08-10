const d3 = require('d3')

const OTHER_FAMILY = 'Others'
const LEGACY_OTHER_FAMILY = 'Other'

const FAMILY_KEY_ALIASES = ['family', 'famille', 'group', 'category', 'groupe']
const DIM_KEY_ALIASES = [
    'dimension', 'variable', 'dim', 'column', 'nom variable', 'nom_variable', 'nom',
    'composé', 'compose', 'composé', 'compound', 'composant'
]

function normalizeKey(s) {
    return String(s || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
}

function detectColumns(headers) {
    const normalized = headers.map(function (h) {
        return { raw: h, norm: normalizeKey(h) }
    })
    let familyCol = null
    let dimCol = null
    for (let i = 0; i < normalized.length; i++) {
        const h = normalized[i]
        if (!familyCol) {
            for (let j = 0; j < FAMILY_KEY_ALIASES.length; j++) {
                const alias = FAMILY_KEY_ALIASES[j]
                if (h.norm === alias || h.norm.indexOf(alias) !== -1) {
                    familyCol = h.raw
                    break
                }
            }
        }
        if (!dimCol) {
            for (let j = 0; j < DIM_KEY_ALIASES.length; j++) {
                const alias = DIM_KEY_ALIASES[j]
                if (h.norm === alias || h.norm.indexOf(alias) !== -1) {
                    dimCol = h.raw
                    break
                }
            }
        }
    }
    if (!familyCol && headers.length >= 1) familyCol = headers[0]
    if (!dimCol && headers.length >= 2) dimCol = headers[1]
    return { familyCol: familyCol, dimCol: dimCol }
}

function rowsToFamilyMap(rows, familyCol, dimCol) {
    const map = {}
    let lastFam = ''
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        let fam = String(row[familyCol] != null ? row[familyCol] : '').trim()
        if (fam) lastFam = fam
        else fam = lastFam
        const dim = String(row[dimCol] != null ? row[dimCol] : '').trim()
        if (!fam || !dim) continue
        if (!map[fam]) map[fam] = []
        if (map[fam].indexOf(dim) === -1) map[fam].push(dim)
    }
    return map
}

function parseCSVText(text) {
    const rows = d3.csvParse(String(text || '').trim())
    if (!rows.length) return { map: {}, familyCol: null, dimCol: null }
    const headers = rows.columns
    const detected = detectColumns(headers)
    console.log('[Families] CSV columns detected:', detected.familyCol, detected.dimCol, headers)
    return {
        map: rowsToFamilyMap(rows, detected.familyCol, detected.dimCol),
        familyCol: detected.familyCol,
        dimCol: detected.dimCol
    }
}

function parseJSONText(text) {
    const data = JSON.parse(text)
    if (Array.isArray(data)) {
        const map = {}
        for (let i = 0; i < data.length; i++) {
            const entry = data[i]
            const fam = entry.family || entry.Family || entry.famille || entry.Famille || entry.group
            const dim = entry.dimension || entry.variable || entry.Dimension || entry.Variable
                || entry.dim || entry.composé || entry.Composé || entry.compose
            if (!fam || !dim) continue
            const f = String(fam).trim()
            const d = String(dim).trim()
            if (!map[f]) map[f] = []
            if (map[f].indexOf(d) === -1) map[f].push(d)
        }
        return { map: map, familyCol: 'family', dimCol: 'dimension' }
    }
    if (data && typeof data === 'object') {
        const map = {}
        Object.keys(data).forEach(function (k) {
            const dims = data[k]
            if (Array.isArray(dims)) map[k] = dims.slice()
        })
        return { map: map, familyCol: null, dimCol: null }
    }
    return { map: {}, familyCol: null, dimCol: null }
}

function parseXLSXBuffer(buffer) {
    const XLSX = require('xlsx')
    const wb = XLSX.read(buffer, { type: 'array' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return { map: {}, familyCol: null, dimCol: null }
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' })
    if (!rows.length) return { map: {}, familyCol: null, dimCol: null }
    const headers = Object.keys(rows[0])
    const detected = detectColumns(headers)
    console.log('[Families] XLSX columns detected:', detected.familyCol, detected.dimCol, headers)
    return {
        map: rowsToFamilyMap(rows, detected.familyCol, detected.dimCol),
        familyCol: detected.familyCol,
        dimCol: detected.dimCol
    }
}

function isOthersFamily(name) {
    return name === OTHER_FAMILY || name === LEGACY_OTHER_FAMILY
}

function hasUserFamilies(families) {
    return Object.keys(families || {}).some(function (k) {
        return !isOthersFamily(k)
    })
}

function syncOthersFamily(families, allDimensions) {
    if (!families || !hasUserFamilies(families)) {
        if (families) {
            delete families[OTHER_FAMILY]
            delete families[LEGACY_OTHER_FAMILY]
        }
        return
    }
    const assigned = new Set()
    Object.keys(families).forEach(function (familyName) {
        if (isOthersFamily(familyName)) return
        const list = families[familyName] || []
        for (let i = 0; i < list.length; i++) assigned.add(list[i])
    })
    const other = []
    const dims = allDimensions || []
    for (let i = 0; i < dims.length; i++) {
        if (!assigned.has(dims[i])) other.push(dims[i])
    }
    delete families[LEGACY_OTHER_FAMILY]
    families[OTHER_FAMILY] = other
}

function familiesForExport(families) {
    const out = {}
    Object.keys(families || {}).forEach(function (k) {
        if (!isOthersFamily(k)) out[k] = (families[k] || []).slice()
    })
    return out
}

function normalizeFamilyMap(familyMap, allDimensions) {
    const dimsSet = new Set(allDimensions || [])
    const unmatched = []
    const assigned = new Set()
    const families = {}

    Object.keys(familyMap || {}).forEach(function (familyName) {
        if (isOthersFamily(familyName)) return
        const list = familyMap[familyName] || []
        const valid = []
        for (let i = 0; i < list.length; i++) {
            const dim = list[i]
            if (dimsSet.has(dim)) {
                valid.push(dim)
                assigned.add(dim)
            } else if (dim) {
                unmatched.push(dim)
            }
        }
        if (valid.length) families[familyName] = valid
    })

    syncOthersFamily(families, allDimensions)

    const warnings = []
    if (unmatched.length) {
        warnings.push('Some variables in the family file were not found in the dataset: ' + unmatched.join(', '))
    }

    return { families: families, warnings: warnings, unmatched: unmatched }
}

function sortFamilyNames(names) {
    return names.slice().sort(function (a, b) {
        if (isOthersFamily(a)) return 1
        if (isOthersFamily(b)) return -1
        return a.localeCompare(b)
    })
}

function getVisibleDimensionsFromFamilies(families, expandedFamilies, allDimensions) {
    const visible = []
    const names = sortFamilyNames(Object.keys(families || {}))
    const expanded = expandedFamilies || new Set()
    if (!expanded.size) return visible
    for (let i = 0; i < names.length; i++) {
        const name = names[i]
        if (!expanded.has(name)) continue
        const dims = families[name] || []
        for (let j = 0; j < dims.length; j++) {
            const dim = dims[j]
            if (allDimensions.indexOf(dim) !== -1 && visible.indexOf(dim) === -1) {
                visible.push(dim)
            }
        }
    }
    return visible
}

function buildSplomFamilyLayout(families, expandedFamilies, allDimensions) {
    const names = sortFamilyNames(Object.keys(families || {}))
    const expanded = expandedFamilies || new Set()
    const groups = []
    const allFamilies = []
    for (let i = 0; i < names.length; i++) {
        const name = names[i]
        const dims = (families[name] || []).filter(function (d) {
            return allDimensions.indexOf(d) !== -1
        })
        allFamilies.push({ name: name, dimCount: dims.length })
        if (expanded.has(name) && dims.length) {
            groups.push({ name: name, dims: dims.slice() })
        }
    }
    return {
        groups: groups,
        allFamilies: allFamilies,
        expanded: Array.from(expanded)
    }
}

function parseFamilyMappingFile(file) {
    return new Promise(function (resolve, reject) {
        const name = (file && file.name ? file.name : '').toLowerCase()
        const reader = new FileReader()
        reader.onerror = function () { reject(new Error('Could not read file')) }

        if (name.endsWith('.json')) {
            reader.onload = function () {
                try {
                    const parsed = parseJSONText(reader.result)
                    resolve(parsed.map)
                } catch (e) {
                    reject(e)
                }
            }
            reader.readAsText(file)
            return
        }

        if (name.endsWith('.csv')) {
            reader.onload = function () {
                try {
                    resolve(parseCSVText(reader.result).map)
                } catch (e) {
                    reject(e)
                }
            }
            reader.readAsText(file)
            return
        }

        if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            reader.onload = function () {
                try {
                    resolve(parseXLSXBuffer(reader.result).map)
                } catch (e) {
                    reject(e)
                }
            }
            reader.readAsArrayBuffer(file)
            return
        }

        reject(new Error('Unsupported file type. Use .csv, .json, .xlsx, or .xls'))
    })
}

function exportFamilyMapJson(families) {
    return JSON.stringify(familiesForExport(families), null, 2)
}

function cloneFamilies(families) {
    const out = {}
    Object.keys(families || {}).forEach(function (k) {
        out[k] = (families[k] || []).slice()
    })
    return out
}

function getFamilyForDimension(families, dim) {
    const names = Object.keys(families || {})
    for (let i = 0; i < names.length; i++) {
        const name = names[i]
        if ((families[name] || []).indexOf(dim) !== -1) return name
    }
    return null
}

function removeDimensionFromAllFamilies(families, dim) {
    Object.keys(families).forEach(function (fname) {
        if (isOthersFamily(fname)) return
        families[fname] = (families[fname] || []).filter(function (d) { return d !== dim })
        if (!families[fname].length) delete families[fname]
    })
}

function assignDimensionToFamily(families, dim, familyName) {
    if (isOthersFamily(familyName)) return
    removeDimensionFromAllFamilies(families, dim)
    if (!families[familyName]) families[familyName] = []
    if (families[familyName].indexOf(dim) === -1) families[familyName].push(dim)
}

module.exports = {
    OTHER_FAMILY: OTHER_FAMILY,
    isOthersFamily: isOthersFamily,
    hasUserFamilies: hasUserFamilies,
    syncOthersFamily: syncOthersFamily,
    familiesForExport: familiesForExport,
    parseFamilyMappingFile: parseFamilyMappingFile,
    normalizeFamilyMap: normalizeFamilyMap,
    exportFamilyMapJson: exportFamilyMapJson,
    cloneFamilies: cloneFamilies,
    getFamilyForDimension: getFamilyForDimension,
    assignDimensionToFamily: assignDimensionToFamily,
    removeDimensionFromAllFamilies: removeDimensionFromAllFamilies,
    sortFamilyNames: sortFamilyNames,
    getVisibleDimensionsFromFamilies: getVisibleDimensionsFromFamilies,
    buildSplomFamilyLayout: buildSplomFamilyLayout
}
