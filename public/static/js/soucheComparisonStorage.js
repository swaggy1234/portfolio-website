/**
 * Souche comparison persistence (main app + comparison tab).
 * Saved pairs / opened tabs: sessionStorage only (reset each login).
 * Comparison payloads for new tabs: localStorage, keyed by vispromSessionId.
 */
const SAVED_PAIRS_KEY = 'visprom_saved_souche_pairs_v1'
const OPENED_TABS_KEY = 'visprom_souche_comparison_tabs_v1'
const COMPARISON_STATE_PREFIX = 'visprom_souche_comparison_state_'
const COMPARISON_STATE_INDEX_KEY = 'visprom_souche_comparison_state_index_v1'
const MAX_SAVED_PAIR_COMPARISONS = 4
const MAX_COMPARISON_STATES = 8

function getActiveSessionId() {
    if (typeof window !== 'undefined' && window.vispromSessionId) {
        return String(window.vispromSessionId)
    }
    return 'default'
}

function readJson(key, fallback, storage) {
    const store = storage || sessionStorage
    try {
        const raw = store.getItem(key)
        if (!raw) return fallback
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : fallback
    } catch (e) {
        return fallback
    }
}

function writeJson(key, value, storage) {
    const store = storage || sessionStorage
    try {
        store.setItem(key, JSON.stringify(value))
        return true
    } catch (e) {
        return false
    }
}

function readSavedSouchePairs() {
    return readJson(SAVED_PAIRS_KEY, [], sessionStorage)
}

function writeSavedSouchePairs(pairs) {
    return writeJson(SAVED_PAIRS_KEY, pairs || [], sessionStorage)
}

function readOpenedSoucheComparisonTabs() {
    return readJson(OPENED_TABS_KEY, [], sessionStorage)
}

function writeOpenedSoucheComparisonTabs(tabs) {
    return writeJson(OPENED_TABS_KEY, tabs || [], sessionStorage)
}

function getPairKey(xDim, yDim) {
    return String(xDim || '') + '|' + String(yDim || '')
}

function addSavedSouchePair(pair) {
    const pairs = readSavedSouchePairs()
    const key = getPairKey(pair.xDim, pair.yDim)
    if (pairs.some(function (p) { return getPairKey(p.xDim, p.yDim) === key })) {
        return { ok: false, reason: 'exists' }
    }
    if (pairs.length >= MAX_SAVED_PAIR_COMPARISONS) {
        return { ok: false, reason: 'limit' }
    }
    pairs.push({
        xDim: pair.xDim,
        yDim: pair.yDim,
        souchesToCompare: pair.souchesToCompare ? pair.souchesToCompare.slice() : [],
        savedAt: pair.savedAt || new Date().toISOString()
    })
    if (!writeSavedSouchePairs(pairs)) {
        return { ok: false, reason: 'storage' }
    }
    return { ok: true, pairs: pairs }
}

function comparisonStateKey(comparisonId, sessionId) {
    const sid = sessionId || getActiveSessionId()
    return COMPARISON_STATE_PREFIX + sid + '_' + comparisonId
}

function findComparisonStateById(comparisonId) {
    if (!comparisonId) return null
    const suffix = '_' + comparisonId
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.indexOf(COMPARISON_STATE_PREFIX) === 0 && key.slice(-suffix.length) === suffix) {
                const raw = localStorage.getItem(key)
                if (!raw) continue
                const parsed = JSON.parse(raw)
                if (parsed && parsed.xDim && parsed.yDim) return parsed
            }
        }
    } catch (e) { /* ignore */ }
    return null
}

function readComparisonStateIndex() {
    try {
        const raw = localStorage.getItem(COMPARISON_STATE_INDEX_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch (e) {
        return []
    }
}

function writeComparisonStateIndex(ids) {
    try {
        localStorage.setItem(COMPARISON_STATE_INDEX_KEY, JSON.stringify(ids || []))
        return true
    } catch (e) {
        return false
    }
}

function pruneOldComparisonStates() {
    const sessionId = getActiveSessionId()
    const prefix = COMPARISON_STATE_PREFIX + sessionId + '_'
    const ids = readComparisonStateIndex().filter(function (id) {
        return String(id).indexOf(sessionId + ':') === 0
    })
    while (ids.length > MAX_COMPARISON_STATES) {
        const oldest = ids.shift()
        if (oldest) {
            const comparisonId = oldest.slice(sessionId.length + 1)
            try {
                localStorage.removeItem(comparisonStateKey(comparisonId))
            } catch (e) { /* ignore */ }
        }
    }
    writeComparisonStateIndex(ids)
}

function writeComparisonState(comparisonId, state) {
    if (!comparisonId || !state) return false
    try {
        const text = JSON.stringify(state)
        localStorage.setItem(comparisonStateKey(comparisonId), text)
        const sessionId = getActiveSessionId()
        const indexKey = sessionId + ':' + comparisonId
        const ids = readComparisonStateIndex().filter(function (id) { return id !== indexKey })
        ids.push(indexKey)
        writeComparisonStateIndex(ids)
        pruneOldComparisonStates()
        return true
    } catch (e) {
        return false
    }
}

function readComparisonState(comparisonId, sessionIdOverride) {
    if (!comparisonId) return null
    if (sessionIdOverride && typeof window !== 'undefined') {
        window.vispromSessionId = sessionIdOverride
    }
    try {
        let raw = localStorage.getItem(comparisonStateKey(comparisonId, sessionIdOverride))
        if (!raw) {
            raw = localStorage.getItem(COMPARISON_STATE_PREFIX + comparisonId)
        }
        if (!raw) {
            raw = sessionStorage.getItem(comparisonId)
        }
        if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed && parsed.xDim && parsed.yDim) return parsed
        }
        return findComparisonStateById(comparisonId)
    } catch (e) {
        return findComparisonStateById(comparisonId)
    }
}

function removeComparisonState(comparisonId) {
    if (!comparisonId) return
    const sessionId = getActiveSessionId()
    const indexKey = sessionId + ':' + comparisonId
    try {
        localStorage.removeItem(comparisonStateKey(comparisonId))
        localStorage.removeItem(COMPARISON_STATE_PREFIX + comparisonId)
        sessionStorage.removeItem(comparisonId)
    } catch (e) { /* ignore */ }
    const ids = readComparisonStateIndex().filter(function (id) { return id !== indexKey })
    writeComparisonStateIndex(ids)
}

function clearAllComparisonStates() {
    const keysToRemove = []
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.indexOf(COMPARISON_STATE_PREFIX) === 0) {
                keysToRemove.push(key)
            }
        }
        keysToRemove.forEach(function (key) {
            localStorage.removeItem(key)
        })
        localStorage.removeItem(COMPARISON_STATE_INDEX_KEY)
    } catch (e) { /* ignore */ }
}

function clearSoucheComparisonSession() {
    try {
        sessionStorage.removeItem(SAVED_PAIRS_KEY)
        sessionStorage.removeItem(OPENED_TABS_KEY)
        localStorage.removeItem(SAVED_PAIRS_KEY)
        localStorage.removeItem(OPENED_TABS_KEY)
    } catch (e) { /* ignore */ }
    clearAllComparisonStates()
}

module.exports = {
    SAVED_PAIRS_KEY: SAVED_PAIRS_KEY,
    OPENED_TABS_KEY: OPENED_TABS_KEY,
    MAX_SAVED_PAIR_COMPARISONS: MAX_SAVED_PAIR_COMPARISONS,
    readSavedSouchePairs: readSavedSouchePairs,
    writeSavedSouchePairs: writeSavedSouchePairs,
    readOpenedSoucheComparisonTabs: readOpenedSoucheComparisonTabs,
    writeOpenedSoucheComparisonTabs: writeOpenedSoucheComparisonTabs,
    getPairKey: getPairKey,
    addSavedSouchePair: addSavedSouchePair,
    writeComparisonState: writeComparisonState,
    readComparisonState: readComparisonState,
    removeComparisonState: removeComparisonState,
    clearSoucheComparisonSession: clearSoucheComparisonSession,
    clearAllComparisonStates: clearAllComparisonStates
}
