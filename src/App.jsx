import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box, Flex, Text, Button, Card, Badge, Progress, Separator,
  Strong, Tooltip,
} from '@radix-ui/themes';
import {
  UploadIcon, CheckCircledIcon, CrossCircledIcon,
  ExternalLinkIcon, ReloadIcon, ExitIcon,
  FileTextIcon, SunIcon, MoonIcon, HomeIcon, PersonIcon,
  CounterClockwiseClockIcon, ReaderIcon, Link2Icon,
} from '@radix-ui/react-icons';
import Login from './Login';
import Admin from './Admin';
import History from './History';
import JobDetail from './JobDetail';
import ColumnMapModal from './ColumnMapModal';
import { useThemeMode } from './ThemeContext';

const API_BASE = '/api';
// Sheet URL is now dynamic per bucket — passed via user context

function timestamp() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function getYesterdayLabel() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() % 100}`;
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage, user, onLogout, token }) {
  const { mode, toggle } = useThemeMode();
  const [sheetUrl, setSheetUrl] = useState(null);

  useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/my-bucket`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => setSheetUrl(d.sheetUrl))
        .catch(() => {});
    }
  }, [user, token]);

  const navItems = [
    { id: 'main', icon: <HomeIcon width={18} height={18} />, label: 'Dashboard' },
    { id: 'history', icon: <CounterClockwiseClockIcon width={18} height={18} />, label: 'History' },
    { id: 'logs', icon: <ReaderIcon width={18} height={18} />, label: 'Logs' },
  ];

  if (user?.role === 'admin') {
    navItems.push({ id: 'admin', icon: <PersonIcon width={18} height={18} />, label: 'Users' });
  }

  return (
    <Flex
      direction="column"
      justify="between"
      className="sidebar"
      style={{
        width: 72,
        minHeight: '100vh',
        padding: '16px 0',
        alignItems: 'center',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 20,
      }}
    >
      {/* Top: Logo + Nav */}
      <Flex direction="column" align="center" gap="3">
        {/* HV Logo */}
        <Box style={{ padding: '4px 0 12px' }}>
          <img
            src="/image.png"
            alt="HV"
            style={{ width: 36, height: 36, objectFit: 'contain' }}
          />
        </Box>

        <Separator size="2" style={{ width: 32, opacity: 0.15 }} />

        {/* Nav items */}
        {navItems.map(item => (
          <Tooltip key={item.id} content={item.label} side="right">
            <button
              onClick={() => setPage(item.id)}
              style={{
                width: 42, height: 42,
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: page === item.id ? '#7c3aed' : 'transparent',
                color: page === item.id ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.15s',
              }}
            >
              {item.icon}
            </button>
          </Tooltip>
        ))}
      </Flex>

      {/* Bottom: Sheet link + Theme toggle + Logout */}
      <Flex direction="column" align="center" gap="1">
        {sheetUrl && (
          <Tooltip content="Open Spreadsheet" side="right">
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: 38, height: 38, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.5)',
                transition: 'color 0.15s',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            >
              <Link2Icon width={16} height={16} />
            </a>
          </Tooltip>
        )}

        <Tooltip content={mode === 'light' ? 'Dark mode' : 'Light mode'} side="right">
          <button
            onClick={toggle}
            style={{
              width: 38, height: 38, borderRadius: 10,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent',
              color: 'rgba(255,255,255,0.5)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
          >
            {mode === 'light' ? <MoonIcon width={16} height={16} /> : <SunIcon width={16} height={16} />}
          </button>
        </Tooltip>

        <Tooltip content="Sign out" side="right">
          <button
            onClick={onLogout}
            style={{
              width: 38, height: 38, borderRadius: 10,
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent',
              color: 'rgba(255,255,255,0.5)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
          >
            <ExitIcon width={16} height={16} />
          </button>
        </Tooltip>
      </Flex>
    </Flex>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  // Auth state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [page, setPage] = useState('main');
  const [authChecked, setAuthChecked] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);

  const viewJobLogs = useCallback((jobId) => {
    setSelectedJobId(jobId);
    setPage('job-detail');
  }, []);

  // Re-trigger state
  const [retriggerName, setRetriggerName] = useState('');

  // Column mapping preview state
  const [previewData, setPreviewData] = useState(null);

  // Upload state
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [logs, setLogs] = useState([]);
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState({ processed: 0, total: 0, errors: 0 });
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [tabNameInput, setTabNameInput] = useState(getYesterdayLabel());
  const pollRef = useRef(null);
  const pollStartRef = useRef(null);
  const logEndRef = useRef(null);
  const POLL_TIMEOUT_MS = 3 * 60 * 60 * 1000;

  // Check stored token
  useEffect(() => {
    const storedToken = localStorage.getItem('crc_token');
    const storedUser = localStorage.getItem('crc_user');
    if (storedToken && storedUser) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      }).then(res => {
        if (res.ok) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        } else {
          localStorage.removeItem('crc_token');
          localStorage.removeItem('crc_user');
        }
        setAuthChecked(true);
      }).catch(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const handleLogin = useCallback((userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    setPage('main');
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('crc_token');
    localStorage.removeItem('crc_user');
    setUser(null);
    setToken(null);
    setPage('main');
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const addLog = useCallback((icon, msg) => {
    setLogs(prev => {
      // Stop spinner on previous sync entries — only the newest active step should spin
      const updated = prev.map(l => l.icon === 'sync' ? { ...l, icon: 'ok' } : l);
      return [...updated, { time: timestamp(), icon, msg }];
    });
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (phase === 'uploading' || phase === 'polling') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleFileSelect = useCallback((e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  }, []);

  const startPolling = useCallback((name) => {
    // Clear any existing polling interval to prevent duplicates
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPhase('polling');
    pollStartRef.current = Date.now();
    let consecutiveErrors = 0;

    pollRef.current = setInterval(async () => {
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        addLog('warn', 'Polling timed out after 3 hours.');
        setPhase('error');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/status?sheet=${encodeURIComponent(name)}`, {
          headers: authHeaders(),
        });
        const data = await res.json();
        consecutiveErrors = 0;

        if (res.ok) {
          setProgress(data);
          const pct = data.total > 0 ? Math.round((data.processed / data.total) * 100) : 0;

          setLogs(prev => {
            const filtered = prev.filter(l => !l.msg.startsWith('Processing:'));
            return [
              ...filtered,
              { time: timestamp(), icon: 'sync', msg: `Processing: ${data.processed} / ${data.total} rows (${pct}%)` }
            ];
          });

          if (data.done) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            if (data.errors > 0) {
              addLog('warn', `${data.errors} rows have errors in column P`);
            }
            addLog('done', `Sheet "${name}" is ready for QC.`);
            setPhase('done');
          }
        }
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors >= 10) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          addLog('error', 'Lost connection to server.');
          setPhase('error');
        }
      }
    }, 5000);
  }, [addLog, authHeaders]);

  // Step 1: Parse file and show column mapping modal
  const handlePreview = useCallback(async () => {
    if (!file) return;

    const trimmedName = tabNameInput.trim();
    if (!trimmedName) { addLog('error', 'Sheet name cannot be empty.'); setPhase('error'); return; }
    if (/[*?:\\\[\]']/.test(trimmedName)) { addLog('error', 'Invalid sheet name characters (no * ? : \\ [ ] \' allowed).'); setPhase('error'); return; }
    if (trimmedName.length > 100) { addLog('error', 'Sheet name too long.'); setPhase('error'); return; }
    if (file.size > 10 * 1024 * 1024) { addLog('error', `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`); setPhase('error'); return; }

    setLogs([]);
    setPhase('uploading');
    setProgress({ processed: 0, total: 0, errors: 0 });
    addLog('file', `File: ${file.name}`);
    addLog('sync', 'Parsing file...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/preview`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();

      if (res.status === 401) { handleLogout(); return; }
      if (!res.ok) { addLog('error', data.error); setPhase('error'); return; }

      addLog('ok', `${data.totalDataRows} rows detected — verify column mapping`);
      setPreviewData(data);
      setPhase('mapping');
    } catch (err) {
      addLog('error', `Preview failed: ${err.message}`);
      setPhase('error');
    }
  }, [file, tabNameInput, addLog, authHeaders, handleLogout]);

  // Step 2: Upload with confirmed mapping
  const doUpload = useCallback(async (overwrite = false, confirmedMapping = null) => {
    if (!file) return;

    const trimmedName = tabNameInput.trim();

    if (!overwrite) {
      setPhase('uploading');
      addLog('sync', 'Uploading to Google Sheet...');
    } else {
      addLog('sync', `Overwriting sheet "${trimmedName}"...`);
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sheetName', trimmedName);
    if (overwrite) formData.append('overwrite', 'true');
    if (confirmedMapping) formData.append('columnMapping', JSON.stringify(confirmedMapping));

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();

      if (res.status === 401) { handleLogout(); return; }
      if (res.status === 409 && data.activeJob) {
        addLog('warn', `Job already running for "${data.sheetName}"${data.startedBy ? ` (started by ${data.startedBy})` : ''} — attaching to live status...`);
        setSheetUrl(data.sheetUrl);
        setSheetName(data.sheetName);
        setProgress({ processed: 0, total: data.totalRows, errors: 0 });
        startPolling(data.sheetName);
        return;
      }
      if (res.status === 409 && data.canOverwrite) {
        if (window.confirm(`Sheet "${data.sheetName}" exists. Overwrite?`)) return doUpload(true, confirmedMapping);
        addLog('warn', 'Cancelled.'); setPhase('idle'); return;
      }
      if (!res.ok) { addLog('error', data.error); setPhase('error'); return; }

      const cols = Object.entries(data.detected).map(([t, s]) => `${s} -> ${t}`).join(', ');
      addLog('ok', `Columns: ${cols}`);
      addLog('ok', `Sheet "${data.sheetName}" created`);
      addLog('ok', `${data.totalRows} rows written`);

      const triggerOk = data.triggerResult === 'JOB_STARTED' || data.triggerResult === 'OK'
        || data.triggerResult?.startsWith('STARTED');
      if (triggerOk) {
        addLog('ok', data.triggerResult?.startsWith('STARTED')
          ? 'CRC script triggered (running in background)'
          : 'CRC script triggered');
      } else {
        addLog('error', `Trigger failed: ${data.triggerResult}`);
        if (data.triggerResult && data.triggerResult.includes('API_KEY missing')) {
          addLog('warn', 'Fix: In Apps Script Editor → Project Settings → Script Properties → add "API_KEY" with the same value as your bucket\'s Apps Script API Key.');
        }
        setSheetUrl(data.sheetUrl);
        setPhase('error');
        return;
      }

      setSheetUrl(data.sheetUrl);
      setSheetName(data.sheetName);
      setProgress({ processed: 0, total: data.totalRows, errors: 0 });
      startPolling(data.sheetName);
    } catch (err) {
      addLog('error', `Upload failed: ${err.message}`);
      setPhase('error');
    }
  }, [file, tabNameInput, addLog, startPolling, authHeaders, handleLogout]);

  // Column mapping confirmed — proceed with upload
  const handleMappingConfirm = useCallback((mapping) => {
    setPreviewData(null);
    doUpload(false, mapping);
  }, [doUpload]);

  const handleMappingCancel = useCallback(() => {
    setPreviewData(null);
    setPhase('idle');
    setLogs([]);
  }, []);

  const handleUpload = useCallback(() => handlePreview(), [handlePreview]);

  const handleReset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setFile(null); setLogs([]); setPhase('idle');
    setProgress({ processed: 0, total: 0, errors: 0 });
    setSheetUrl(''); setSheetName('');
    setTabNameInput(getYesterdayLabel());
    setRetriggerName('');
    setPreviewData(null);
  }, []);

  const handleRetrigger = useCallback(async () => {
    const name = retriggerName.trim();
    if (!name) return;

    setLogs([]);
    setPhase('uploading');
    setProgress({ processed: 0, total: 0, errors: 0 });
    addLog('sync', `Re-triggering CRC on "${name}"...`);

    try {
      const res = await fetch(`${API_BASE}/trigger`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetName: name }),
      });
      const data = await res.json();

      if (res.status === 401) { handleLogout(); return; }
      if (res.status === 409 && data.activeJob) {
        addLog('warn', `Job already running for "${data.sheetName}"${data.startedBy ? ` (started by ${data.startedBy})` : ''} — attaching to live status...`);
        setSheetUrl(data.sheetUrl);
        setSheetName(data.sheetName);
        setProgress({ processed: 0, total: data.totalRows, errors: 0 });
        startPolling(data.sheetName);
        return;
      }
      if (!res.ok) { addLog('error', data.error); setPhase('error'); return; }

      addLog('ok', `Sheet "${data.sheetName}" found (${data.totalRows} rows)`);

      const triggerOk = data.triggerResult === 'JOB_STARTED' || data.triggerResult === 'OK'
        || data.triggerResult?.startsWith('STARTED');
      if (triggerOk) {
        addLog('ok', data.triggerResult?.startsWith('STARTED')
          ? 'CRC script triggered (running in background)'
          : 'CRC script triggered');
      } else {
        addLog('error', `Trigger failed: ${data.triggerResult}`);
        if (data.triggerResult && data.triggerResult.includes('API_KEY missing')) {
          addLog('warn', 'Fix: In Apps Script Editor → Project Settings → Script Properties → add "API_KEY" with the same value as your bucket\'s Apps Script API Key.');
        }
        setSheetUrl(data.sheetUrl);
        setPhase('error');
        return;
      }

      setSheetUrl(data.sheetUrl);
      setSheetName(data.sheetName);
      setProgress({ processed: 0, total: data.totalRows, errors: 0 });
      startPolling(data.sheetName);
    } catch (err) {
      addLog('error', `Trigger failed: ${err.message}`);
      setPhase('error');
    }
  }, [retriggerName, addLog, startPolling, authHeaders, handleLogout]);

  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  const logIcon = (type) => {
    const s = { flexShrink: 0, marginTop: 2 };
    switch (type) {
      case 'ok': return <CheckCircledIcon style={{ ...s, color: '#16a34a' }} />;
      case 'error': return <CrossCircledIcon style={{ ...s, color: '#dc2626' }} />;
      case 'warn': return <CrossCircledIcon style={{ ...s, color: '#d97706' }} />;
      case 'sync': return <ReloadIcon style={{ ...s, color: 'var(--accent-9)', animation: 'spin 1s linear infinite' }} />;
      case 'done': return <CheckCircledIcon style={{ ...s, color: 'var(--accent-9)' }} />;
      case 'file': return <FileTextIcon style={{ ...s, color: 'var(--gray-9)' }} />;
      default: return <Box style={{ width: 15, ...s }} />;
    }
  };

  // ── Auth gate ──
  if (!authChecked) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <ReloadIcon style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-9)', width: 24, height: 24 }} />
      </Flex>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // ── Admin page ──
  if (page === 'admin' && user.role === 'admin') {
    return (
      <Flex style={{ minHeight: '100vh' }}>
        <Sidebar page={page} setPage={setPage} user={user} onLogout={handleLogout} token={token} />
        <Box style={{ marginLeft: 72, flex: 1 }}>
          <Admin token={token} />
        </Box>
      </Flex>
    );
  }

  // ── History page ──
  if (page === 'history') {
    return (
      <Flex style={{ minHeight: '100vh' }}>
        <Sidebar page={page} setPage={setPage} user={user} onLogout={handleLogout} token={token} />
        <Box style={{ marginLeft: 72, flex: 1 }}>
          <History token={token} onViewLogs={viewJobLogs} />
        </Box>
      </Flex>
    );
  }

  // ── Job Detail / Logs page ──
  if (page === 'job-detail' && selectedJobId) {
    return (
      <Flex style={{ minHeight: '100vh' }}>
        <Sidebar page="logs" setPage={setPage} user={user} onLogout={handleLogout} token={token} />
        <Box style={{ marginLeft: 72, flex: 1 }}>
          <JobDetail token={token} jobId={selectedJobId} onBack={() => setPage('history')} />
        </Box>
      </Flex>
    );
  }

  // ── Logs page (shows history with details focus) ──
  if (page === 'logs') {
    return (
      <Flex style={{ minHeight: '100vh' }}>
        <Sidebar page={page} setPage={setPage} user={user} onLogout={handleLogout} token={token} />
        <Box style={{ marginLeft: 72, flex: 1 }}>
          <History token={token} onViewLogs={viewJobLogs} logsMode />
        </Box>
      </Flex>
    );
  }

  // ── Dashboard ──
  return (
    <Flex style={{ minHeight: '100vh' }}>
      <Sidebar page={page} setPage={setPage} user={user} onLogout={handleLogout} token={token} />

      {/* Column mapping modal */}
      {previewData && (
        <ColumnMapModal
          data={previewData}
          onConfirm={handleMappingConfirm}
          onCancel={handleMappingCancel}
        />
      )}

      <Box style={{ marginLeft: 72, flex: 1 }}>
        {/* Top bar */}
        <Flex
          align="center" justify="between" px="6" py="4"
          className="topbar"
        >
          <Flex direction="column" gap="0">
            <Text size="5" weight="bold" className="heading-text">
              CRC Batch Processor
            </Text>
            <Text size="2" className="muted-text">
              Upload rider data and run criminal risk checks via HyperVerge
            </Text>
          </Flex>

          <Flex align="center" gap="3">
            <Flex direction="column" align="end" gap="0">
              <Text size="2" weight="medium">{user.email}</Text>
              <Flex align="center" gap="2">
                <Badge size="1" variant="soft" color={user.role === 'admin' ? 'purple' : 'gray'}>
                  {user.role}
                </Badge>
                {user.bucketName && (
                  <Badge size="1" variant="outline" color="gray">
                    {user.bucketName}
                  </Badge>
                )}
              </Flex>
            </Flex>
          </Flex>
        </Flex>

        {/* Content */}
        <Box px="6" py="6" style={{ maxWidth: 720 }}>
          <Flex direction="column" gap="5">

            {/* Upload Card */}
            <Card className="main-card" style={{ padding: '32px' }}>
              <Flex direction="column" gap="5">
                <Flex direction="column" gap="1">
                  <Text size="4" weight="bold">Upload New File</Text>
                  <Text size="2" className="muted-text">
                    Upload an Excel or CSV file with rider details. Data is written to Google Sheets and CRC processing starts automatically.
                  </Text>
                </Flex>

                {/* Drop Zone */}
                <Box
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`drop-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                  onClick={() => document.getElementById('fileInput').click()}
                >
                  <input
                    id="fileInput" type="file" accept=".xlsx,.csv,.xls"
                    onChange={handleFileSelect} style={{ display: 'none' }}
                  />
                  {file ? (
                    <Flex align="center" justify="center" gap="3">
                      <FileTextIcon width={20} height={20} style={{ color: 'var(--accent-9)' }} />
                      <Text size="3" weight="medium">{file.name}</Text>
                      <Text size="1" className="muted-text">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </Text>
                    </Flex>
                  ) : (
                    <Flex direction="column" align="center" gap="2">
                      <Box className="upload-icon-wrap">
                        <UploadIcon width={22} height={22} style={{ color: 'var(--accent-9)' }} />
                      </Box>
                      <Text size="3" className="muted-text">
                        Drag & drop or <Strong style={{ color: 'var(--accent-9)', cursor: 'pointer' }}>browse</Strong>
                      </Text>
                      <Text size="1" className="muted-text" style={{ opacity: 0.7 }}>
                        .xlsx, .xls, .csv
                      </Text>
                    </Flex>
                  )}
                </Box>

                {/* Sheet name */}
                <Flex direction="column" gap="2">
                  <Text size="2" weight="medium" className="muted-text">Sheet Tab Name</Text>
                  <Flex align="center" gap="3">
                    <input
                      type="text"
                      value={tabNameInput}
                      onChange={(e) => setTabNameInput(e.target.value)}
                      disabled={phase === 'uploading' || phase === 'polling'}
                      placeholder={getYesterdayLabel()}
                      className="text-input"
                    />
                    {file && phase === 'idle' && (
                      <Button variant="ghost" size="1" color="gray" onClick={() => setFile(null)}>
                        Clear
                      </Button>
                    )}
                  </Flex>
                  <Text size="1" className="muted-text" style={{ opacity: 0.6 }}>
                    If a sheet with this name already exists, you will be asked to confirm before overwriting.
                  </Text>
                </Flex>

                {/* Upload Button */}
                <Button
                  size="3"
                  disabled={!file || phase === 'uploading' || phase === 'polling'}
                  onClick={handleUpload}
                  style={{ width: '100%', height: 48, borderRadius: 12, fontSize: 15, fontWeight: 600 }}
                >
                  {phase === 'uploading' ? (
                    <Flex align="center" gap="2">
                      <ReloadIcon style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Uploading...</span>
                    </Flex>
                  ) : 'Upload & Start Processing'}
                </Button>
              </Flex>
            </Card>

            {/* Re-run CRC Card */}
            {phase === 'idle' && (
              <Card className="main-card" style={{ padding: '24px 28px' }}>
                <Flex direction="column" gap="4">
                  <Flex direction="column" gap="1">
                    <Text size="3" weight="bold">Re-run on Existing Sheet</Text>
                    <Text size="2" className="muted-text">Re-trigger CRC processing on a sheet tab that already exists in the spreadsheet. Useful for retrying failed rows.</Text>
                  </Flex>
                  <Flex gap="3" align="end">
                    <Flex direction="column" gap="2" style={{ flex: 1 }}>
                      <Text size="2" weight="medium" className="muted-text">Sheet Tab Name</Text>
                      <input
                        type="text"
                        value={retriggerName}
                        onChange={(e) => setRetriggerName(e.target.value)}
                        placeholder={getYesterdayLabel()}
                        className="text-input"
                      />
                    </Flex>
                    <Button
                      size="3"
                      variant="outline"
                      disabled={!retriggerName.trim()}
                      onClick={handleRetrigger}
                      style={{ borderRadius: 12, height: 40, fontWeight: 600 }}
                    >
                      <ReloadIcon /> Run CRC
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            )}

            {/* Execution Log */}
            {logs.length > 0 && (
              <Card className="main-card" style={{ padding: '24px 28px' }}>
                <Flex direction="column" gap="4">
                  <Flex align="center" justify="between">
                    <Text size="3" weight="bold">Execution Log</Text>
                    {phase === 'polling' && (
                      <Badge size="1" color="purple" variant="soft" style={{ gap: 4 }}>
                        <ReloadIcon style={{ animation: 'spin 1s linear infinite', width: 10, height: 10 }} />
                        Live
                      </Badge>
                    )}
                  </Flex>

                  <Separator size="4" />

                  <Box className="log-panel">
                    {logs.map((log, i) => (
                      <Flex key={i} gap="3" align="start" py="1">
                        <Text size="1" className="log-time">{log.time}</Text>
                        {logIcon(log.icon)}
                        <Text size="2" style={{ fontFamily: 'inherit' }}>{log.msg}</Text>
                      </Flex>
                    ))}
                    <div ref={logEndRef} />
                  </Box>

                  {(phase === 'polling' || phase === 'done') && progress.total > 0 && (
                    <Flex direction="column" gap="2">
                      <Progress value={pct} max={100} size="2" />
                      <Flex align="center" justify="between">
                        <Text size="1" className="muted-text">
                          {progress.processed} / {progress.total} rows
                        </Text>
                        <Text size="1" weight="medium" style={{ color: pct === 100 ? '#16a34a' : 'var(--accent-9)' }}>
                          {pct}%
                        </Text>
                      </Flex>
                    </Flex>
                  )}
                </Flex>
              </Card>
            )}

            {/* Done Banner */}
            {phase === 'done' && (
              <Card className="banner-done" style={{ padding: '20px 24px' }}>
                <Flex align="center" justify="between">
                  <Flex align="center" gap="3">
                    <CheckCircledIcon width={20} height={20} style={{ color: '#16a34a' }} />
                    <Text size="3" weight="medium" style={{ color: '#15803d' }}>
                      Sheet "{sheetName}" is ready for QC
                    </Text>
                  </Flex>
                  {sheetUrl && (
                    <a href={sheetUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#15803d', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 500 }}>
                      Open Sheet <ExternalLinkIcon />
                    </a>
                  )}
                </Flex>
              </Card>
            )}

            {/* Error Banner */}
            {phase === 'error' && (
              <Card className="banner-error" style={{ padding: '20px 24px' }}>
                <Flex align="center" gap="3">
                  <CrossCircledIcon width={20} height={20} style={{ color: '#dc2626' }} />
                  <Text size="3" style={{ color: '#dc2626' }}>Something went wrong. See log above.</Text>
                </Flex>
              </Card>
            )}

            {/* Reset */}
            {(phase === 'done' || phase === 'error') && (
              <Button variant="soft" color="gray" size="3" onClick={handleReset} style={{ borderRadius: 12, alignSelf: 'flex-start' }}>
                <ReloadIcon /> Start New Upload
              </Button>
            )}

          </Flex>
        </Box>
      </Box>

    </Flex>
  );
}
