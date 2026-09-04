/* =====================================================================
   CSV ⇄ JSON Converter — app.js
   Hand-written CSV parser/serializer (RFC-4180-ish: quoted fields may
   contain commas, newlines and doubled "" escaped quotes) plus a JSON
   ⇄ CSV reverse mode. Classic script (no modules). Depends on window.WUS.
   ===================================================================== */
(function () {
  'use strict';

  var WUS = window.WUS;
  var STORE_KEY = 'csvjson.state';

  /* ----------------------------- DOM refs ---------------------------- */
  var input        = document.getElementById('input');
  var outputCode   = document.getElementById('outputCode');
  var emptyState   = document.getElementById('emptyState');
  var inputTitle   = document.getElementById('inputTitle');
  var outputTitle  = document.getElementById('outputTitle');

  var modeCsvToJson = document.getElementById('modeCsvToJson');
  var modeJsonToCsv = document.getElementById('modeJsonToCsv');
  var csvOptions     = document.getElementById('csvOptions');
  var shapeObjects   = document.getElementById('shapeObjects');
  var shapeArrays     = document.getElementById('shapeArrays');
  var typeInferEl     = document.getElementById('typeInfer');
  var hasHeaderEl      = document.getElementById('hasHeader');

  var statusBadge = document.getElementById('statusBadge');
  var statusText  = document.getElementById('statusText');

  var inputStats  = document.getElementById('inputStats');
  var outputStats = document.getElementById('outputStats');

  var errorPanel = document.getElementById('errorPanel');
  var errorMsg   = document.getElementById('errorMsg');

  var statsBar = document.getElementById('statsBar');
  var statRows = document.getElementById('statRows');
  var statCols = document.getElementById('statCols');
  var statSize = document.getElementById('statSize');

  var fileInput = document.getElementById('fileInput');

  /* mode: 'c2j' (CSV -> JSON) or 'j2c' (JSON -> CSV) */
  var mode = 'c2j';
  /* shape: 'objects' or 'arrays' — only relevant for c2j output */
  var shape = 'objects';
  var lastOutput = '';

  /* =================================================================
     CSV PARSER — text -> array of arrays of strings.
     Handles: quoted fields, embedded commas/newlines inside quotes,
     doubled "" as an escaped quote, \r\n and \n line endings, and a
     trailing-newline-free final row.
     ================================================================= */
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var len = text.length;

    function pushField() { row.push(field); field = ''; }
    function pushRow() { pushField(); rows.push(row); row = []; }

    while (i < len) {
      var ch = text.charAt(i);
      if (inQuotes) {
        if (ch === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      } else {
        if (ch === '"') { inQuotes = true; i++; continue; }
        if (ch === ',') { pushField(); i++; continue; }
        if (ch === '\r') { i++; continue; } // normalize CRLF
        if (ch === '\n') { pushRow(); i++; continue; }
        field += ch; i++; continue;
      }
    }
    // Final field/row (if the text didn't end with a newline, or was empty).
    if (field.length > 0 || row.length > 0 || rows.length === 0) {
      pushRow();
    }
    // Drop a single trailing all-empty row produced by a final newline.
    if (rows.length > 1) {
      var last = rows[rows.length - 1];
      if (last.length === 1 && last[0] === '') rows.pop();
    }
    return rows;
  }

  /* =================================================================
     CSV SERIALIZER — array of arrays -> CSV text.
     Quotes a field iff it contains a comma, quote, newline, or leading/
     trailing whitespace; doubles internal quotes.
     ================================================================= */
  function needsQuoting(s) {
    return /[",\n\r]/.test(s) || /^\s|\s$/.test(s);
  }
  function csvField(v) {
    var s = v === null || v === undefined ? '' : String(v);
    if (needsQuoting(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function serializeCSV(rows) {
    return rows.map(function (r) { return r.map(csvField).join(','); }).join('\r\n');
  }

  /* =================================================================
     TYPE INFERENCE — string cell -> number / boolean / null / string
     ================================================================= */
  var NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
  function inferType(raw) {
    var s = raw.trim();
    if (s === '') return '';
    if (/^null$/i.test(s)) return null;
    if (/^true$/i.test(s)) return true;
    if (/^false$/i.test(s)) return false;
    if (NUM_RE.test(s) && !/^0\d+$/.test(s.replace(/^[+-]/, ''))) {
      var n = Number(s);
      if (!isNaN(n) && isFinite(n)) return n;
    }
    return raw;
  }

  /* =================================================================
     CSV -> JSON
     ================================================================= */
  function csvToJson(text, opts) {
    var rows = parseCSV(text).filter(function (r, idx, arr) {
      // Drop completely blank rows (single empty field) except keep intentional data.
      return !(r.length === 1 && r[0] === '' && arr.length > 1);
    });
    if (rows.length === 0) throw new Error('No rows found in CSV input.');

    var header = null;
    var dataRows = rows;
    if (opts.hasHeader) {
      header = rows[0];
      dataRows = rows.slice(1);
    }

    function cell(raw) { return opts.typeInfer ? inferType(raw) : raw; }

    var result;
    if (opts.shape === 'objects') {
      if (!header) {
        // Synthesize column1..N headers when there is no header row.
        var maxLen = 0;
        dataRows.forEach(function (r) { if (r.length > maxLen) maxLen = r.length; });
        header = [];
        for (var c = 0; c < maxLen; c++) header.push('column' + (c + 1));
      }
      result = dataRows.map(function (r) {
        var obj = {};
        header.forEach(function (key, idx) {
          obj[key || ('column' + (idx + 1))] = cell(r[idx] !== undefined ? r[idx] : '');
        });
        return obj;
      });
    } else {
      var out = [];
      if (header) out.push(header.slice());
      dataRows.forEach(function (r) {
        out.push(r.map(function (v) { return cell(v); }));
      });
      result = out;
    }
    return { value: result, rowCount: dataRows.length, colCount: header ? header.length : (rows[0] ? rows[0].length : 0) };
  }

  /* =================================================================
     JSON -> CSV (array of flat objects, or array of arrays)
     ================================================================= */
  function jsonToCsv(text) {
    var value = JSON.parse(text);
    if (!Array.isArray(value)) throw new Error('JSON input must be an array (of objects or arrays).');
    if (value.length === 0) return { text: '', rowCount: 0, colCount: 0 };

    var isObjectArray = value.every(function (v) { return v && typeof v === 'object' && !Array.isArray(v); });
    var isArrayArray = value.every(function (v) { return Array.isArray(v); });

    if (isObjectArray) {
      var keys = [];
      var seen = {};
      value.forEach(function (obj) {
        Object.keys(obj).forEach(function (k) {
          if (!seen[k]) { seen[k] = true; keys.push(k); }
        });
      });
      var rows = [keys];
      value.forEach(function (obj) {
        rows.push(keys.map(function (k) {
          var v = obj[k];
          if (v === undefined || v === null) return '';
          if (typeof v === 'object') return JSON.stringify(v);
          return String(v);
        }));
      });
      return { text: serializeCSV(rows), rowCount: value.length, colCount: keys.length };
    }

    if (isArrayArray) {
      var maxCols = 0;
      value.forEach(function (r) { if (r.length > maxCols) maxCols = r.length; });
      var rows2 = value.map(function (r) {
        var out = r.map(function (v) {
          if (v === undefined || v === null) return '';
          if (typeof v === 'object') return JSON.stringify(v);
          return String(v);
        });
        while (out.length < maxCols) out.push('');
        return out;
      });
      return { text: serializeCSV(rows2), rowCount: value.length, colCount: maxCols };
    }

    throw new Error('Expected an array of flat objects (or an array of arrays) — mixed arrays are not supported.');
  }

  /* =================================================================
     JSON syntax highlighting (reused for JSON output rendering)
     ================================================================= */
  function highlightJson(jsonText) {
    var re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],:])/g;
    var out = '', lastIndex = 0, m;
    while ((m = re.exec(jsonText)) !== null) {
      if (m.index > lastIndex) out += WUS.escapeHtml(jsonText.slice(lastIndex, m.index));
      lastIndex = re.lastIndex;
      if (m[1] !== undefined) {
        var isKey = m[2] !== undefined;
        out += '<span class="' + (isKey ? 'tok-key' : 'tok-string') + '">' + WUS.escapeHtml(m[1]) + '</span>';
        if (isKey) out += '<span class="tok-punct">' + WUS.escapeHtml(m[2]) + '</span>';
      } else if (m[3] !== undefined) {
        out += '<span class="tok-boolean">' + m[3] + '</span>';
      } else if (m[4] !== undefined) {
        out += '<span class="tok-null">' + m[4] + '</span>';
      } else if (m[5] !== undefined) {
        out += '<span class="tok-number">' + WUS.escapeHtml(m[5]) + '</span>';
      } else if (m[6] !== undefined) {
        var cls = (m[6] === '{' || m[6] === '}' || m[6] === '[' || m[6] === ']') ? 'tok-brace' : 'tok-punct';
        out += '<span class="' + cls + '">' + WUS.escapeHtml(m[6]) + '</span>';
      }
    }
    if (lastIndex < jsonText.length) out += WUS.escapeHtml(jsonText.slice(lastIndex));
    return out;
  }

  /* =================================================================
     UI helpers
     ================================================================= */
  function humanBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }
  function byteLength(str) {
    try { return new Blob([str]).size; } catch (e) { return new TextEncoder().encode(str).length; }
  }

  function setStatus(state, text) {
    statusBadge.classList.remove('is-valid', 'is-error');
    if (state === 'valid') statusBadge.classList.add('is-valid');
    else if (state === 'error') statusBadge.classList.add('is-error');
    statusText.textContent = text;
  }

  function showError(err) {
    errorMsg.textContent = err && err.message ? err.message : String(err);
    errorPanel.hidden = false;
    statsBar.hidden = true;
    setStatus('error', 'Invalid');
  }
  function clearError() { errorPanel.hidden = true; }

  function renderOutput(text, isJson, rowCount, colCount) {
    lastOutput = text;
    if (isJson) outputCode.innerHTML = highlightJson(text);
    else outputCode.textContent = text;
    emptyState.classList.add('is-hidden');

    var bytes = byteLength(text);
    outputStats.textContent = text.split('\n').length + ' lines · ' + humanBytes(bytes);

    statRows.textContent = rowCount.toLocaleString();
    statCols.textContent = colCount.toLocaleString();
    statSize.textContent = humanBytes(bytes);
    statsBar.hidden = false;
  }

  function clearOutput() {
    lastOutput = '';
    outputCode.textContent = '';
    emptyState.classList.remove('is-hidden');
    outputStats.textContent = '';
    statsBar.hidden = true;
  }

  function updateInputMeta() {
    var len = input.value.length;
    inputStats.textContent = len.toLocaleString() + (len === 1 ? ' char' : ' chars');
  }

  /* =================================================================
     MODE / SHAPE switching
     ================================================================= */
  function setMode(next) {
    mode = next;
    modeCsvToJson.classList.toggle('is-active', mode === 'c2j');
    modeCsvToJson.setAttribute('aria-selected', mode === 'c2j' ? 'true' : 'false');
    modeJsonToCsv.classList.toggle('is-active', mode === 'j2c');
    modeJsonToCsv.setAttribute('aria-selected', mode === 'j2c' ? 'true' : 'false');
    csvOptions.hidden = mode !== 'c2j';

    if (mode === 'c2j') {
      inputTitle.textContent = 'CSV Input';
      outputTitle.textContent = 'JSON Output';
      input.placeholder = 'name,age,active\nAda,36,true\nGrace,85,false';
    } else {
      inputTitle.textContent = 'JSON Input';
      outputTitle.textContent = 'CSV Output';
      input.placeholder = '[\n  { "name": "Ada", "age": 36, "active": true },\n  { "name": "Grace", "age": 85, "active": false }\n]';
    }
    clearOutput();
    clearError();
    setStatus('', 'Ready');
  }

  function setShape(next) {
    shape = next;
    shapeObjects.classList.toggle('is-active', shape === 'objects');
    shapeObjects.setAttribute('aria-selected', shape === 'objects' ? 'true' : 'false');
    shapeArrays.classList.toggle('is-active', shape === 'arrays');
    shapeArrays.setAttribute('aria-selected', shape === 'arrays' ? 'true' : 'false');
  }

  /* =================================================================
     CORE ACTION
     ================================================================= */
  function convert() {
    var text = input.value;
    if (!text || !text.trim()) { WUS.toast('Nothing to convert — input is empty', 'error'); return; }

    try {
      if (mode === 'c2j') {
        var res = csvToJson(text, { shape: shape, typeInfer: typeInferEl.checked, hasHeader: hasHeaderEl.checked });
        var pretty = JSON.stringify(res.value, null, 2);
        clearError();
        renderOutput(pretty, true, res.rowCount, res.colCount);
        setStatus('valid', 'Converted');
      } else {
        var res2 = jsonToCsv(text);
        clearError();
        renderOutput(res2.text, false, res2.rowCount, res2.colCount);
        setStatus('valid', 'Converted');
      }
      WUS.toast('Converted ✓');
    } catch (err) {
      showError(err);
      WUS.toast('Conversion failed — see error panel', 'error');
    }
    persist();
  }

  function copyOutput() {
    if (!lastOutput) { WUS.toast('No output to copy yet', 'error'); return; }
    WUS.copy(lastOutput, 'Output copied to clipboard');
  }

  function downloadOutput() {
    if (!lastOutput) { WUS.toast('Nothing to download — convert first', 'error'); return; }
    var ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    if (mode === 'c2j') WUS.download('data-' + ts + '.json', lastOutput, 'application/json;charset=utf-8');
    else WUS.download('data-' + ts + '.csv', lastOutput, 'text/csv;charset=utf-8');
    WUS.toast('Downloaded');
  }

  function clearAll() {
    input.value = '';
    clearOutput();
    clearError();
    setStatus('', 'Ready');
    updateInputMeta();
    WUS.store.remove(STORE_KEY);
    input.focus();
  }

  /* -------------------------- File upload --------------------------- */
  function triggerUpload() { fileInput.click(); }

  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    WUS.readFile(file).then(function (content) {
      var isJsonFile = /\.json$/i.test(file.name);
      setMode(isJsonFile ? 'j2c' : 'c2j');
      input.value = content;
      updateInputMeta();
      WUS.toast('Loaded ' + file.name);
      convert();
    }).catch(function () {
      WUS.toast('Could not read file', 'error');
    });
    fileInput.value = '';
  });

  /* ----------------------------- Sample ----------------------------- */
  var SAMPLE_CSV = 'name,age,active,notes\n' +
    '"Ada Lovelace",36,true,"First published algorithm, 1843"\n' +
    '"Grace Hopper",85,false,"Compiler pioneer"\n' +
    'Charles Babbage,,true,"Designed the Analytical Engine"';

  var SAMPLE_JSON = JSON.stringify([
    { name: 'Ada Lovelace', age: 36, active: true, notes: 'First published algorithm, 1843' },
    { name: 'Grace Hopper', age: 85, active: false, notes: 'Compiler pioneer' },
    { name: 'Charles Babbage', age: null, active: true, notes: 'Designed the Analytical Engine' }
  ], null, 2);

  function loadSample() {
    input.value = mode === 'c2j' ? SAMPLE_CSV : SAMPLE_JSON;
    updateInputMeta();
    convert();
    WUS.toast('Sample loaded');
  }

  /* =================================================================
     PERSISTENCE
     ================================================================= */
  function persist() {
    WUS.store.set(STORE_KEY, {
      input: input.value,
      mode: mode,
      shape: shape,
      typeInfer: typeInferEl.checked,
      hasHeader: hasHeaderEl.checked
    });
  }
  var persistDebounced = WUS.debounce(persist, 400);

  function restore() {
    var saved = WUS.store.get(STORE_KEY, null);
    if (!saved) { setMode('c2j'); setShape('objects'); return; }
    setMode(saved.mode === 'j2c' ? 'j2c' : 'c2j');
    setShape(saved.shape === 'arrays' ? 'arrays' : 'objects');
    if (typeof saved.typeInfer === 'boolean') typeInferEl.checked = saved.typeInfer;
    if (typeof saved.hasHeader === 'boolean') hasHeaderEl.checked = saved.hasHeader;
    if (typeof saved.input === 'string') input.value = saved.input;
    updateInputMeta();
    if (input.value.trim()) {
      try { convert(); } catch (e) { /* leave output empty */ }
    }
  }

  /* =================================================================
     SHORTCUTS HELP MODAL
     ================================================================= */
  var helpBackdrop = document.getElementById('helpBackdrop');
  var helpClose    = document.getElementById('helpClose');
  var shortcutRows = document.getElementById('shortcutRows');

  var SHORTCUTS = [
    { keys: ['mod', '⏎'], desc: 'Convert' },
    { keys: ['mod', 'S'], desc: 'Download output' },
    { keys: ['?'], desc: 'Show this help' },
    { keys: ['Esc'], desc: 'Close dialog' }
  ];

  function buildShortcutTable() {
    var html = '';
    SHORTCUTS.forEach(function (s) {
      var kbds = s.keys.map(function (k) { return '<kbd>' + WUS.escapeHtml(k) + '</kbd>'; }).join('');
      html += '<tr><td>' + WUS.escapeHtml(s.desc) + '</td><td>' + kbds + '</td></tr>';
    });
    shortcutRows.innerHTML = html;
  }

  function openHelp() { helpBackdrop.hidden = false; helpClose.focus(); }
  function closeHelp() { helpBackdrop.hidden = true; }

  helpClose.addEventListener('click', closeHelp);
  helpBackdrop.addEventListener('click', function (e) { if (e.target === helpBackdrop) closeHelp(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !helpBackdrop.hidden) closeHelp(); });

  var helpBtns = document.querySelectorAll('[data-shortcut-help]');
  for (var i = 0; i < helpBtns.length; i++) helpBtns[i].addEventListener('click', openHelp);

  /* =================================================================
     WIRING
     ================================================================= */
  modeCsvToJson.addEventListener('click', function () { setMode('c2j'); persist(); });
  modeJsonToCsv.addEventListener('click', function () { setMode('j2c'); persist(); });
  shapeObjects.addEventListener('click', function () { setShape('objects'); persist(); if (lastOutput) convert(); });
  shapeArrays.addEventListener('click', function () { setShape('arrays'); persist(); if (lastOutput) convert(); });
  typeInferEl.addEventListener('change', function () { persist(); if (lastOutput) convert(); });
  hasHeaderEl.addEventListener('change', function () { persist(); if (lastOutput) convert(); });

  document.getElementById('btnConvert').addEventListener('click', convert);
  document.getElementById('btnCopy').addEventListener('click', copyOutput);
  document.getElementById('btnDownload').addEventListener('click', downloadOutput);
  document.getElementById('btnUpload').addEventListener('click', triggerUpload);
  document.getElementById('btnSample').addEventListener('click', loadSample);
  document.getElementById('btnClear').addEventListener('click', clearAll);
  document.getElementById('btnSampleEmpty').addEventListener('click', loadSample);

  input.addEventListener('input', function () { updateInputMeta(); persistDebounced(); });
  input.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); convert(); }
  });

  WUS.registerShortcut('mod+enter', function () { convert(); }, 'Convert');
  WUS.registerShortcut('mod+s', function () { downloadOutput(); }, 'Download output');
  WUS.registerShortcut('?', function () { openHelp(); }, 'Show shortcuts');

  /* =================================================================
     INIT
     ================================================================= */
  buildShortcutTable();
  updateInputMeta();
  restore();
})();
