const d3 = require('d3');

const DEFAULT_DATASET_ID = 'builtin-aromopti-100';

const BUILTIN_DATASETS = [
    { id: 'builtin-aromopti-100', name: 'AromOpti-100', url: '/static/data/AromOpti-100.csv' },
    { id: 'builtin-aromopti-1000', name: 'AromOpti-1000', url: '/static/data/AromOpti-1000.csv' },
    { id: 'builtin-ynes-100', name: 'YNES-100', url: '/static/data/YNES-100.csv' },
    { id: 'builtin-fermentations-1000', name: 'Fermentations (1000 rows)', url: '/static/data/260115_5324_fermentations_1000.csv' },
    { id: 'builtin-fermentations-5324', name: 'Fermentations (~5324 rows, souche comparison)', url: '/static/data/260115_5324_fermentations.csv' },
];

const STORAGE_KEY = 'visprom_saved_datasets_v1';
const SELECTED_KEY = 'visprom_selected_dataset_v1';
const SESSION_DATASET_KEY = 'visprom_session_dataset_v1';
const CURRENT_DATASET_SNAPSHOT_KEY = 'visprom-current-dataset';
const MAX_COMPARISON_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const MAX_LOCAL_PERSIST_BYTES = 1.5 * 1024 * 1024;
const MAX_SAVED_DATASETS = 8;

function isQuotaError(err) {
    if (!err) return false;
    const name = err.name || '';
    const msg = String(err.message || err);
    return name === 'QuotaExceededError' ||
        name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        /setItem|quota|exceeded/i.test(msg);
}

function safeStorageSet(storage, key, value) {
    if (!storage) return false;
    try {
        storage.setItem(key, value);
        return true;
    } catch (err) {
        if (isQuotaError(err)) return false;
        throw err;
    }
}

function byteSize(text) {
    try {
        return new Blob([String(text || '')]).size;
    } catch (e) {
        return String(text || '').length;
    }
}

function parseDatasetText(rawText) {
    const text = String(rawText || '');
    const firstLine = (text.split(/\r?\n/).find((l) => l.trim().length > 0) || '');
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';
    const parser = delimiter === ';' ? d3.dsvFormat(';').parse : d3.csvParse;
    let rows = parser(text);
    rows = rows.map((row) => {
        let clean = {};
        Object.keys(row).forEach((key) => {
            clean[String(key).trim()] = String(row[key] == null ? '' : row[key]).trim();
        });
        return clean;
    });

    if (rows.length > 0) {
        const typeTokens = ['DOUBLE', 'FLOAT', 'INT', 'INTEGER', 'STRING'];
        const isTypeRow = Object.values(rows[0]).every((v) => typeTokens.includes(String(v).toUpperCase()));
        if (isTypeRow) {
            rows = rows.slice(1);
        }
    }
    return rows;
}

function rowsToCsv(rows) {
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const escape = (value) => {
        const v = String(value == null ? '' : value);
        if (/[",\n\r]/.test(v)) {
            return '"' + v.replace(/"/g, '""') + '"';
        }
        return v;
    };
    const lines = [cols.join(',')];
    for (const row of rows) {
        lines.push(cols.map((col) => escape(row[col])).join(','));
    }
    return lines.join('\n');
}

function normalizeUploadedCsv(rawText, fileName) {
    const rows = parseDatasetText(rawText);
    if (!rows.length) {
        throw new Error('Dataset is empty.');
    }

    const cols = Object.keys(rows[0]);
    if (cols.length < 2) {
        throw new Error('Dataset needs at least 2 columns.');
    }

    let numericCols = 0;
    for (const col of cols) {
        const sample = rows.slice(0, Math.min(25, rows.length)).map((r) => r[col]);
        const numeric = sample.filter((v) => v !== '' && !isNaN(Number(v))).length;
        if (sample.length > 0 && numeric / sample.length >= 0.8) {
            numericCols += 1;
        }
    }
    if (numericCols < 2) {
        throw new Error('Need at least 2 numeric columns for scatterplots.');
    }

    const displayName = String(fileName || 'Uploaded dataset')
        .replace(/\.(csv|txt|tsv)$/i, '')
        .trim() || 'Uploaded dataset';

    return {
        rows,
        csvText: rowsToCsv(rows),
        name: displayName,
    };
}

function readSavedDatasets() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function readSessionDataset() {
    try {
        const raw = sessionStorage.getItem(SESSION_DATASET_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && parsed.id && parsed.csvText ? parsed : null;
    } catch (e) {
        return null;
    }
}

function writeSavedDatasets(list) {
    let trimmed = (list || []).slice(-MAX_SAVED_DATASETS);
    while (trimmed.length >= 0) {
        const payload = JSON.stringify(trimmed);
        if (safeStorageSet(localStorage, STORAGE_KEY, payload)) {
            return { ok: true, saved: trimmed };
        }
        if (trimmed.length <= 1) break;
        trimmed = trimmed.slice(1);
    }
    return { ok: false, reason: 'quota' };
}

function getSelectedDatasetId() {
    try {
        const stored = localStorage.getItem(SELECTED_KEY);
        if (stored && isBuiltinDataset(stored)) return stored;
        if (stored && listSavedUploads().some(function (d) { return d.id === stored; })) return stored;
        if (stored) {
            console.warn('[Dataset] Unknown saved selection "' + stored + '"; using default.');
        }
        return DEFAULT_DATASET_ID;
    } catch (e) {
        return DEFAULT_DATASET_ID;
    }
}

function setSelectedDatasetId(id) {
    if (!safeStorageSet(localStorage, SELECTED_KEY, id)) {
        console.warn('[Dataset] Could not persist selected dataset id in localStorage.');
    }
}

function commitDatasetSwitch(newId) {
    setSelectedDatasetId(newId);
    if (typeof window.vispromSetLoading === 'function') {
        window.vispromSetLoading(true);
    }
    window.location.reload();
}

let datasetSwitchHandler = null;

function registerDatasetSwitchHandler(handler) {
    datasetSwitchHandler = handler;
}

function requestDatasetSwitch(newId, selectNode) {
    const currentId = getSelectedDatasetId();
    if (newId === currentId) {
        if (selectNode && selectNode.value != null) selectNode.value = currentId;
        else if (selectNode && typeof selectNode.refresh === 'function') selectNode.refresh();
        return;
    }

    const proceed = () => commitDatasetSwitch(newId);
    const cancel = () => {
        if (selectNode && selectNode.value != null) selectNode.value = currentId;
        else if (selectNode && typeof selectNode.refresh === 'function') selectNode.refresh();
    };

    if (typeof datasetSwitchHandler === 'function') {
        datasetSwitchHandler(proceed, cancel);
        return;
    }

    proceed();
}

function isBuiltinDataset(id) {
    return BUILTIN_DATASETS.some(function (d) { return d.id === id; });
}

function listSavedUploads() {
    const saved = readSavedDatasets().slice();
    const session = readSessionDataset();
    if (session && !saved.some(function (d) { return d.id === session.id; })) {
        saved.push({
            id: session.id,
            name: session.name,
            uploadedAt: session.uploadedAt,
            sessionOnly: true
        });
    }
    return saved;
}

function listAllDatasets() {
    return BUILTIN_DATASETS.concat(listSavedUploads());
}

function deleteSavedDataset(id) {
    if (!id || isBuiltinDataset(id)) {
        return { deleted: false, reason: 'builtin' };
    }

    let removed = false;
    const session = readSessionDataset();
    if (session && session.id === id) {
        try {
            sessionStorage.removeItem(SESSION_DATASET_KEY);
        } catch (e) { /* ignore */ }
        removed = true;
    }

    const before = readSavedDatasets();
    const after = before.filter(function (d) { return d && d.id !== id; });
    if (after.length !== before.length) {
        writeSavedDatasets(after);
        removed = true;
    }

    if (!removed) {
        return { deleted: false, reason: 'not_found' };
    }

    const wasSelected = getSelectedDatasetId() === id;
    if (wasSelected) {
        setSelectedDatasetId(DEFAULT_DATASET_ID);
        return { deleted: true, switched: true, newId: DEFAULT_DATASET_ID };
    }

    return { deleted: true, switched: false };
}

function saveUploadedDataset(name, csvText) {
    const entry = {
        id: 'upload-' + Date.now(),
        name: name,
        csvText: csvText,
        uploadedAt: new Date().toISOString(),
    };
    const size = byteSize(csvText);
    let sessionOnly = false;

    if (size <= MAX_LOCAL_PERSIST_BYTES) {
        const saved = readSavedDatasets().filter(function (d) { return d && d.id !== entry.id; });
        saved.push({
            id: entry.id,
            name: entry.name,
            csvText: entry.csvText,
            uploadedAt: entry.uploadedAt
        });
        const result = writeSavedDatasets(saved);
        if (!result.ok) sessionOnly = true;
    } else {
        sessionOnly = true;
    }

    if (sessionOnly) {
        if (!safeStorageSet(sessionStorage, SESSION_DATASET_KEY, JSON.stringify(entry))) {
            throw new Error(
                'Dataset is too large for browser storage in this tab. Try a smaller file or remove unused columns.'
            );
        }
        const metaOnly = readSavedDatasets().filter(function (d) { return d && d.id !== entry.id; });
        metaOnly.push({
            id: entry.id,
            name: entry.name,
            uploadedAt: entry.uploadedAt,
            sessionOnly: true
        });
        writeSavedDatasets(metaOnly);
    } else {
        try {
            sessionStorage.removeItem(SESSION_DATASET_KEY);
        } catch (e) { /* ignore */ }
    }

    setSelectedDatasetId(entry.id);
    return { id: entry.id, sessionOnly: sessionOnly, size: size };
}

function getDatasetMetaById(id) {
    const selectedId = id || getSelectedDatasetId();
    const builtin = BUILTIN_DATASETS.find(function (d) { return d.id === selectedId; });
    if (builtin) return { id: builtin.id, name: builtin.name };
    const session = readSessionDataset();
    if (session && session.id === selectedId) {
        return { id: session.id, name: session.name };
    }
    const saved = readSavedDatasets().find(function (d) { return d.id === selectedId; });
    if (saved) return { id: saved.id, name: saved.name || saved.id };
    return { id: selectedId, name: selectedId };
}

function rowsToStoragePlain(rows) {
    if (!rows || !rows.length) return [];
    return rows.map(function (row) {
        const out = {};
        Object.keys(row).forEach(function (key) {
            const value = row[key];
            if (value && typeof value === 'object' && typeof value.add === 'function') return;
            out[key] = value;
        });
        return out;
    });
}

function syncCurrentDatasetSnapshot(rows, datasetId) {
    const id = datasetId || getSelectedDatasetId();
    const meta = getDatasetMetaById(id);
    const payload = {
        id: id,
        name: meta.name,
        rows: rowsToStoragePlain(rows),
        syncedAt: new Date().toISOString()
    };
    const text = JSON.stringify(payload);
    if (byteSize(text) > MAX_COMPARISON_SNAPSHOT_BYTES) {
        return { ok: false, reason: 'too_large', size: byteSize(text) };
    }
    if (!safeStorageSet(localStorage, CURRENT_DATASET_SNAPSHOT_KEY, text)) {
        if (!safeStorageSet(sessionStorage, CURRENT_DATASET_SNAPSHOT_KEY, text)) {
            return { ok: false, reason: 'quota', size: byteSize(text) };
        }
    }
    return { ok: true, size: byteSize(text) };
}

function readCurrentDatasetSnapshot() {
    try {
        let raw = localStorage.getItem(CURRENT_DATASET_SNAPSHOT_KEY);
        if (!raw) raw = sessionStorage.getItem(CURRENT_DATASET_SNAPSHOT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && parsed.id && Array.isArray(parsed.rows) ? parsed : null;
    } catch (e) {
        return null;
    }
}

function removeStaleDatasetEntry(id) {
    if (!id) return;
    const saved = readSavedDatasets().filter(function (d) { return d && d.id !== id; });
    writeSavedDatasets(saved);
}

function fetchDatasetText(url) {
    const candidates = [];
    if (url) candidates.push(url);
    if (url && url.charAt(0) === '/') {
        candidates.push(url.replace(/^\//, ''));
    } else if (url && url.indexOf('static/') === 0) {
        candidates.push('/' + url);
    }

    function tryNext(index) {
        if (index >= candidates.length) {
            return Promise.reject(new Error('Could not fetch dataset file: ' + url));
        }
        const candidate = candidates[index];
        return d3.text(candidate).catch(function (fetchErr) {
            console.warn('[Dataset] fetch failed:', candidate, fetchErr && fetchErr.message ? fetchErr.message : fetchErr);
            return tryNext(index + 1);
        });
    }

    return tryNext(0);
}

function loadBuiltinDataset(builtin) {
    return fetchDatasetText(builtin.url).then(function (text) {
        return parseDatasetText(text);
    });
}

function builtinDatasetLoadError(builtin, err) {
    const detail = err && err.message ? err.message : String(err || 'unknown error');
    return new Error(
        'Could not load "' + builtin.name + '" (' + builtin.url + '). ' +
        'If this file is missing, add it under public/data/ or choose another dataset. ' +
        detail
    );
}

function loadRowsForComparison(datasetId, comparisonState) {
    if (comparisonState && Array.isArray(comparisonState.datasetRows) && comparisonState.datasetRows.length) {
        return Promise.resolve(comparisonState.datasetRows);
    }
    const snapshot = readCurrentDatasetSnapshot();
    if (snapshot && snapshot.id === datasetId && Array.isArray(snapshot.rows) && snapshot.rows.length) {
        return Promise.resolve(snapshot.rows);
    }
    return loadDatasetById(datasetId);
}

function loadDatasetById(id) {
    const selectedId = id || getSelectedDatasetId();
    const builtin = BUILTIN_DATASETS.find(function (d) { return d.id === selectedId; });
    if (builtin) {
        return loadBuiltinDataset(builtin).catch(function (err) {
            console.warn(
                '[Dataset] Builtin dataset unavailable:',
                selectedId,
                builtin.url,
                err && err.message ? err.message : err
            );
            throw builtinDatasetLoadError(builtin, err);
        });
    }

    const session = readSessionDataset();
    if (session && session.id === selectedId) {
        return Promise.resolve(parseDatasetText(session.csvText));
    }

    const saved = readSavedDatasets().find(function (d) { return d.id === selectedId; });
    if (saved && saved.csvText) {
        return Promise.resolve(parseDatasetText(saved.csvText));
    }

    if (saved && (saved.sessionOnly || !saved.csvText)) {
        console.warn(
            '[Dataset] Previously selected upload is not available in this browser tab:',
            selectedId,
            '— loading default dataset instead.'
        );
        removeStaleDatasetEntry(selectedId);
    } else if (selectedId) {
        console.warn(
            '[Dataset] Selected dataset id not found:',
            selectedId,
            '— loading default dataset instead.'
        );
    }

    const fallback = BUILTIN_DATASETS[0];
    setSelectedDatasetId(fallback.id);
    return loadBuiltinDataset(fallback);
}

function initDatasetSelector(mountNode) {
    const root = mountNode.append('div').attr('class', 'datasetSelector');

    const mainRow = root.append('div').attr('class', 'datasetSelector-main');

    mainRow.append('span')
        .attr('class', 'datasetSelector-label')
        .text('Dataset');

    const dropdownWrap = mainRow.append('div').attr('class', 'datasetDropdown');
    const dropdownToggle = dropdownWrap.append('button')
        .attr('type', 'button')
        .attr('class', 'datasetDropdown-toggle')
        .attr('id', 'datasetSelect')
        .attr('aria-haspopup', 'listbox')
        .attr('aria-expanded', 'false');
    dropdownToggle.append('span').attr('class', 'datasetDropdown-toggle-label').text('…');
    dropdownToggle.append('span').attr('class', 'datasetDropdown-chevron').text('▾');

    const dropdownMenu = dropdownWrap.append('div')
        .attr('class', 'datasetDropdown-menu')
        .attr('role', 'listbox');

    const uploadLabel = mainRow.append('label').attr('class', 'datasetUploadBtn').text('Upload CSV');
    const fileInput = uploadLabel.append('input')
        .attr('type', 'file')
        .attr('id', 'datasetUpload')
        .attr('accept', '.csv,.txt,.tsv,text/csv,text/plain');

    const status = root.append('div').attr('class', 'datasetStatus');

    let dropdownOpen = false;

    function formatDatasetLabel(d) {
        if (!d) return 'Dataset';
        let label = d.name + (d.uploadedAt ? ' (uploaded)' : '');
        if (d.sessionOnly) label += ' [session]';
        return label;
    }

    function setDropdownOpen(open) {
        dropdownOpen = !!open;
        dropdownMenu.classed('is-open', dropdownOpen);
        dropdownToggle.attr('aria-expanded', dropdownOpen ? 'true' : 'false');
    }

    function closeDropdown() {
        setDropdownOpen(false);
    }

    dropdownToggle.on('click', function () {
        d3.event.stopPropagation();
        setDropdownOpen(!dropdownOpen);
    });

    dropdownMenu.on('click', function () {
        d3.event.stopPropagation();
    });

    d3.select(document).on('click.datasetDropdown', function () {
        if (dropdownOpen) closeDropdown();
    });

    function refreshOptions() {
        const current = getSelectedDatasetId();
        const options = listAllDatasets();
        const currentEntry = options.find(function (d) { return d.id === current; }) || options[0];

        dropdownToggle.select('.datasetDropdown-toggle-label')
            .text(formatDatasetLabel(currentEntry));

        const items = dropdownMenu.selectAll('.datasetDropdown-item')
            .data(options, function (d) { return d.id; })
            .join('div')
            .attr('class', function (d) {
                let cls = 'datasetDropdown-item';
                if (d.id === current) cls += ' is-selected';
                if (!isBuiltinDataset(d.id)) cls += ' is-upload';
                return cls;
            })
            .attr('data-id', function (d) { return d.id; })
            .attr('role', 'option');

        items.selectAll('*').remove();

        items.append('button')
            .attr('type', 'button')
            .attr('class', 'datasetDropdown-label')
            .attr('title', function (d) { return formatDatasetLabel(d); })
            .text(function (d) { return formatDatasetLabel(d); })
            .on('click', function (d) {
                d3.event.stopPropagation();
                closeDropdown();
                if (d.id === current) return;
                requestDatasetSwitch(d.id, { refresh: refreshOptions });
            });

        items.filter(function (d) { return !isBuiltinDataset(d.id); })
            .append('button')
            .attr('type', 'button')
            .attr('class', 'datasetSavedDelete')
            .attr('title', 'Delete this saved dataset')
            .text('×')
            .on('click', function (d) {
                d3.event.stopPropagation();
                closeDropdown();
                handleDeleteDataset(d.id, d.name);
            });
    }

    function handleDeleteDataset(id, name) {
        const label = name || id || 'this dataset';
        if (!window.confirm('Delete saved dataset "' + label + '" from this browser?')) {
            return;
        }
        const result = deleteSavedDataset(id);
        if (!result.deleted) {
            status.text('Could not delete dataset.').style('color', '#b42318');
            return;
        }
        if (result.switched) {
            status.text('Deleted. Loading default dataset…').style('color', '#0b6b2e');
            commitDatasetSwitch(result.newId);
            return;
        }
        status.text('Deleted "' + label + '".').style('color', '#0b6b2e');
        refreshOptions();
    }

    refreshOptions();

    fileInput.on('change', function () {
        const file = this.files && this.files[0];
        if (!file) return;

        status.text('Uploading…').style('color', '#374151');
        const reader = new FileReader();
        reader.onload = function (evt) {
            try {
                const normalized = normalizeUploadedCsv(evt.target.result, file.name);
                const saved = saveUploadedDataset(normalized.name, normalized.csvText);
                if (saved.sessionOnly) {
                    status.text(
                        'Loaded for this browser session (file too large for permanent browser storage).'
                    ).style('color', '#0b6b2e');
                } else {
                    status.text('Upload saved. Loading…').style('color', '#0b6b2e');
                }
                requestDatasetSwitch(saved.id, null);
            } catch (err) {
                const msg = isQuotaError(err)
                    ? 'Browser storage is full. Clear site data for this page or use a smaller dataset.'
                    : (err.message || 'Upload failed.');
                status.text(msg).style('color', '#b42318');
                fileInput.property('value', '');
                console.error('[Dataset] upload failed:', err);
            }
        };
        reader.onerror = function () {
            status.text('Could not read file.').style('color', '#b42318');
            fileInput.property('value', '');
        };
        reader.readAsText(file);
    });
}

exports.BUILTIN_DATASETS = BUILTIN_DATASETS;
exports.DEFAULT_DATASET_ID = DEFAULT_DATASET_ID;
exports.parseDatasetText = parseDatasetText;
exports.loadDatasetById = loadDatasetById;
exports.loadRowsForComparison = loadRowsForComparison;
exports.syncCurrentDatasetSnapshot = syncCurrentDatasetSnapshot;
exports.readCurrentDatasetSnapshot = readCurrentDatasetSnapshot;
exports.rowsToStoragePlain = rowsToStoragePlain;
exports.getDatasetMetaById = getDatasetMetaById;
exports.byteSize = byteSize;
exports.MAX_COMPARISON_SNAPSHOT_BYTES = MAX_COMPARISON_SNAPSHOT_BYTES;
exports.getSelectedDatasetId = getSelectedDatasetId;
exports.registerDatasetSwitchHandler = registerDatasetSwitchHandler;
exports.initDatasetSelector = initDatasetSelector;
exports.deleteSavedDataset = deleteSavedDataset;
exports.listSavedUploads = listSavedUploads;
exports.isBuiltinDataset = isBuiltinDataset;
