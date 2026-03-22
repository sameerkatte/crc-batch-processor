import { useState, useEffect, useCallback } from 'react';
import {
  Box, Flex, Text, Button, Card, Badge, Separator, Switch,
} from '@radix-ui/themes';
import { CrossCircledIcon, PersonIcon, CubeIcon, Pencil1Icon, PlayIcon, ReloadIcon } from '@radix-ui/react-icons';

const API_BASE = '/api';

const DEFAULT_HV_URL = 'https://ind-engine.thomas.hyperverge.co/v1/criminalRiskCheck';

// Reusable coupled CRC config fields
function CoupledConfigSection({ enabled, setEnabled, vals, set }) {
  return (
    <Flex direction="column" gap="3">
      <Separator size="4" />
      <Flex align="center" justify="between">
        <Flex direction="column" gap="0">
          <Text size="3" weight="bold">Coupled CRC</Text>
          <Text size="1" className="muted-text">CRC runs on client's end — fetch results from Metabase + Thomas API</Text>
        </Flex>
        <Switch checked={enabled} onCheckedChange={setEnabled} size="2" />
      </Flex>

      {enabled && (
        <Flex direction="column" gap="3" style={{ paddingLeft: 4 }}>
          {/* Metabase */}
          <Text size="2" weight="bold" style={{ color: 'var(--accent-9)' }}>Metabase</Text>
          <input type="text" placeholder="Metabase URL (e.g. https://metabase.company.com)"
            value={vals.metabaseUrl} onChange={(e) => set('metabaseUrl', e.target.value)}
            className="text-input" />
          <Flex gap="3" wrap="wrap">
            <input type="text" placeholder="Metabase username"
              value={vals.metabaseUser} onChange={(e) => set('metabaseUser', e.target.value)}
              className="text-input" style={{ flex: '1 1 180px' }} />
            <input type="password" placeholder="Metabase password"
              value={vals.metabasePassword} onChange={(e) => set('metabasePassword', e.target.value)}
              className="text-input" style={{ flex: '1 1 180px' }} />
          </Flex>
          <Flex gap="3" wrap="wrap">
            <Flex direction="column" gap="1" style={{ flex: '0 0 120px' }}>
              <Text size="1" className="muted-text">Database ID</Text>
              <input type="number" min="1" placeholder="1"
                value={vals.metabaseDatabaseId} onChange={(e) => set('metabaseDatabaseId', e.target.value)}
                className="text-input" />
            </Flex>
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="1" className="muted-text">SQL Query — use <code>{'{{DATE}}'}</code> for yesterday&apos;s date (YYYY-MM-DD)</Text>
            <textarea
              placeholder={"SELECT transactionId, requestId, name, fatherName, address\nFROM criminalRiskCheck\nWHERE DATE(created_at) = '{{DATE}}'"}
              value={vals.metabaseSql} onChange={(e) => set('metabaseSql', e.target.value)}
              className="text-input"
              style={{ minHeight: 90, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
            />
          </Flex>

          {/* Thomas Fetcher */}
          <Separator size="4" />
          <Text size="2" weight="bold" style={{ color: 'var(--accent-9)' }}>Thomas Fetcher API</Text>
          <Flex gap="3" wrap="wrap">
            <input type="text" placeholder="Client ID (e.g. yf9atv)"
              value={vals.fetcherClientId} onChange={(e) => set('fetcherClientId', e.target.value)}
              className="text-input" style={{ flex: '1 1 150px' }} />
            <input type="text" placeholder="App ID (e.g. 7pee9u)"
              value={vals.fetcherAppId} onChange={(e) => set('fetcherAppId', e.target.value)}
              className="text-input" style={{ flex: '1 1 150px' }} />
          </Flex>

          {/* Kuberan's Script */}
          <Separator size="4" />
          <Text size="2" weight="bold" style={{ color: 'var(--accent-9)' }}>Kuberan&apos;s Script</Text>
          <input type="text" placeholder="Apps Script Web App URL"
            value={vals.coupledAppsScriptUrl} onChange={(e) => set('coupledAppsScriptUrl', e.target.value)}
            className="text-input" />
          <Flex gap="3" wrap="wrap">
            <input type="text" placeholder="Apps Script API Key"
              value={vals.coupledAppsScriptApiKey} onChange={(e) => set('coupledAppsScriptApiKey', e.target.value)}
              className="text-input" style={{ flex: '1 1 180px' }} />
            <input type="text" placeholder="Google Spreadsheet ID"
              value={vals.coupledSpreadsheetId} onChange={(e) => set('coupledSpreadsheetId', e.target.value)}
              className="text-input" style={{ flex: '1 1 180px' }} />
          </Flex>

          {/* Schedule */}
          <Separator size="4" />
          <Text size="2" weight="bold" style={{ color: 'var(--accent-9)' }}>Schedule</Text>
          <Flex direction="column" gap="1">
            <Text size="1" className="muted-text">Cron expression — default <code>30 0 * * *</code> = 12:30 AM daily</Text>
            <input type="text" placeholder="30 0 * * *"
              value={vals.cronSchedule} onChange={(e) => set('cronSchedule', e.target.value)}
              className="text-input" style={{ fontFamily: 'monospace' }} />
          </Flex>

          {/* Slack */}
          <Separator size="4" />
          <Text size="2" weight="bold" style={{ color: 'var(--accent-9)' }}>Slack</Text>
          <input type="text" placeholder="Slack channel (e.g. #crc-qc) — token configured later"
            value={vals.slackChannel} onChange={(e) => set('slackChannel', e.target.value)}
            className="text-input" />
        </Flex>
      )}
    </Flex>
  );
}

// Build coupledConfig object from state
function buildCoupledConfig(enabled, vals) {
  if (!enabled) return null;
  return {
    enabled: true,
    metabaseUrl: vals.metabaseUrl,
    metabaseUser: vals.metabaseUser,
    metabasePassword: vals.metabasePassword,
    metabaseDatabaseId: Number(vals.metabaseDatabaseId) || 1,
    metabaseSql: vals.metabaseSql,
    fetcherClientId: vals.fetcherClientId,
    fetcherAppId: vals.fetcherAppId,
    coupledAppsScriptUrl: vals.coupledAppsScriptUrl,
    coupledAppsScriptApiKey: vals.coupledAppsScriptApiKey,
    coupledSpreadsheetId: vals.coupledSpreadsheetId,
    cronSchedule: vals.cronSchedule || '30 0 * * *',
    slackChannel: vals.slackChannel,
    slackToken: vals.slackToken || '',
  };
}

const EMPTY_COUPLED = {
  metabaseUrl: '', metabaseUser: '', metabasePassword: '',
  metabaseDatabaseId: '1', metabaseSql: '',
  fetcherClientId: '', fetcherAppId: '',
  coupledAppsScriptUrl: '', coupledAppsScriptApiKey: '', coupledSpreadsheetId: '',
  cronSchedule: '30 0 * * *', slackChannel: '', slackToken: '',
};

export default function Admin({ token }) {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add user form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newBucketId, setNewBucketId] = useState('default');
  const [addMsg, setAddMsg] = useState('');

  // Add bucket form
  const [bucketName, setBucketName] = useState('');
  const [bucketSheetId, setBucketSheetId] = useState('');
  const [bucketScriptUrl, setBucketScriptUrl] = useState('');
  const [bucketApiKey, setBucketApiKey] = useState('');
  const [bucketHvApiUrl, setBucketHvApiUrl] = useState(DEFAULT_HV_URL);
  const [bucketHvAppId, setBucketHvAppId] = useState('');
  const [bucketHvAppKey, setBucketHvAppKey] = useState('');
  const [bucketBatchSize, setBucketBatchSize] = useState('100');
  const [bucketQps, setBucketQps] = useState('15');
  const [bucketMaxRetries, setBucketMaxRetries] = useState('3');
  const [bucketMsg, setBucketMsg] = useState('');
  // Coupled — create form
  const [coupledEnabled, setCoupledEnabled] = useState(false);
  const [coupledVals, setCoupledVals] = useState({ ...EMPTY_COUPLED });
  const setCoupledField = (k, v) => setCoupledVals(prev => ({ ...prev, [k]: v }));

  // Edit bucket
  const [editingBucket, setEditingBucket] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSheetId, setEditSheetId] = useState('');
  const [editScriptUrl, setEditScriptUrl] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editHvApiUrl, setEditHvApiUrl] = useState('');
  const [editHvAppId, setEditHvAppId] = useState('');
  const [editHvAppKey, setEditHvAppKey] = useState('');
  const [editBatchSize, setEditBatchSize] = useState('100');
  const [editQps, setEditQps] = useState('15');
  const [editMaxRetries, setEditMaxRetries] = useState('3');
  // Coupled — edit form
  const [editCoupledEnabled, setEditCoupledEnabled] = useState(false);
  const [editCoupledVals, setEditCoupledVals] = useState({ ...EMPTY_COUPLED });
  const setEditCoupledField = (k, v) => setEditCoupledVals(prev => ({ ...prev, [k]: v }));

  // Run Now state
  const [runningNow, setRunningNow] = useState({});

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`, { headers });
      const data = await res.json();
      if (res.ok) { setUsers(data.users); setError(''); }
      else { setError(data.error); }
    } catch { setError('Failed to load users.'); }
  }, [token]);

  const fetchBuckets = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/buckets`, { headers });
      const data = await res.json();
      if (res.ok) setBuckets(data.buckets);
    } catch { /* */ }
  }, [token]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchBuckets()]);
    setLoading(false);
  }, [fetchUsers, fetchBuckets]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── User handlers ──

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddMsg('');
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: 'POST', headers,
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole, bucketId: newBucketId }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddMsg(data.message);
        setNewEmail(''); setNewPassword(''); setNewRole('user'); setNewBucketId('default');
        fetchUsers();
      } else { setAddMsg(data.error); }
    } catch { setAddMsg('Network error.'); }
  };

  const handleDelete = async (email) => {
    if (!window.confirm(`Remove user "${email}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (res.ok) fetchUsers();
      else alert(data.error);
    } catch { alert('Network error.'); }
  };

  const handleResetPassword = async (email) => {
    const newPw = window.prompt(`New password for ${email}:`);
    if (!newPw) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(email)}/password`, {
        method: 'PUT', headers, body: JSON.stringify({ password: newPw }),
      });
      const data = await res.json();
      alert(data.message || data.error);
    } catch { alert('Network error.'); }
  };

  const handleChangeBucket = async (email, bucketId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(email)}/bucket`, {
        method: 'PUT', headers, body: JSON.stringify({ bucketId }),
      });
      const data = await res.json();
      if (res.ok) fetchUsers();
      else alert(data.error);
    } catch { alert('Network error.'); }
  };

  // ── Bucket handlers ──

  const handleAddBucket = async (e) => {
    e.preventDefault();
    setBucketMsg('');
    try {
      const res = await fetch(`${API_BASE}/admin/buckets`, {
        method: 'POST', headers,
        body: JSON.stringify({
          name: bucketName,
          spreadsheetId: bucketSheetId,
          appsScriptUrl: bucketScriptUrl,
          appsScriptApiKey: bucketApiKey,
          hvApiUrl: bucketHvApiUrl,
          hvAppId: bucketHvAppId,
          hvAppKey: bucketHvAppKey,
          batchSize: bucketBatchSize,
          qps: bucketQps,
          maxRetries: bucketMaxRetries,
          coupledConfig: buildCoupledConfig(coupledEnabled, coupledVals),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBucketMsg(data.message);
        setBucketName(''); setBucketSheetId(''); setBucketScriptUrl(''); setBucketApiKey('');
        setBucketHvAppId(''); setBucketHvAppKey('');
        setBucketBatchSize('100'); setBucketQps('15'); setBucketMaxRetries('3');
        setCoupledEnabled(false); setCoupledVals({ ...EMPTY_COUPLED });
        fetchBuckets();
      } else { setBucketMsg(data.error); }
    } catch { setBucketMsg('Network error.'); }
  };

  const handleEditBucket = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/buckets/${editingBucket}`, {
        method: 'PUT', headers,
        body: JSON.stringify({
          name: editName,
          spreadsheetId: editSheetId,
          appsScriptUrl: editScriptUrl,
          appsScriptApiKey: editApiKey,
          hvApiUrl: editHvApiUrl,
          hvAppId: editHvAppId,
          hvAppKey: editHvAppKey,
          batchSize: editBatchSize,
          qps: editQps,
          maxRetries: editMaxRetries,
          coupledConfig: buildCoupledConfig(editCoupledEnabled, editCoupledVals),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditingBucket(null);
        fetchBuckets();
      } else { alert(data.error); }
    } catch { alert('Network error.'); }
  };

  const handleDeleteBucket = async (id) => {
    if (!window.confirm(`Delete bucket "${id}"? Users in it will be moved to Default.`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/buckets/${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (res.ok) { fetchBuckets(); fetchUsers(); }
      else alert(data.error);
    } catch { alert('Network error.'); }
  };

  const handleRunNow = async (bucketId) => {
    if (!window.confirm(`Run coupled CRC job for "${bucketId}" now (yesterday's data)?`)) return;
    setRunningNow(prev => ({ ...prev, [bucketId]: true }));
    try {
      const res = await fetch(`${API_BASE}/coupled/run/${bucketId}`, { method: 'POST', headers, body: '{}' });
      const data = await res.json();
      alert(data.message || data.error);
      fetchBuckets();
    } catch { alert('Network error.'); }
    finally { setRunningNow(prev => ({ ...prev, [bucketId]: false })); }
  };

  const startEdit = (b) => {
    setEditingBucket(b.id);
    setEditName(b.name);
    setEditSheetId(b.spreadsheetId);
    setEditScriptUrl(b.appsScriptUrl);
    setEditApiKey(b.appsScriptApiKey);
    setEditHvApiUrl(b.hvApiUrl || DEFAULT_HV_URL);
    setEditHvAppId(b.hvAppId || '');
    setEditHvAppKey(b.hvAppKey || '');
    setEditBatchSize(String(b.batchSize || 100));
    setEditQps(String(b.qps || 15));
    setEditMaxRetries(String(b.maxRetries || 3));
    const cc = b.coupledConfig;
    if (cc?.enabled) {
      setEditCoupledEnabled(true);
      setEditCoupledVals({
        metabaseUrl: cc.metabaseUrl || '',
        metabaseUser: cc.metabaseUser || '',
        metabasePassword: cc.metabasePassword || '',
        metabaseDatabaseId: String(cc.metabaseDatabaseId || 1),
        metabaseSql: cc.metabaseSql || '',
        fetcherClientId: cc.fetcherClientId || '',
        fetcherAppId: cc.fetcherAppId || '',
        coupledAppsScriptUrl: cc.coupledAppsScriptUrl || '',
        coupledAppsScriptApiKey: cc.coupledAppsScriptApiKey || '',
        coupledSpreadsheetId: cc.coupledSpreadsheetId || '',
        cronSchedule: cc.cronSchedule || '30 0 * * *',
        slackChannel: cc.slackChannel || '',
        slackToken: cc.slackToken || '',
      });
    } else {
      setEditCoupledEnabled(false);
      setEditCoupledVals({ ...EMPTY_COUPLED });
    }
  };

  const bucketNameById = (id) => {
    const b = buckets.find(b => b.id === id);
    return b ? b.name : id;
  };

  const tabStyle = (t) => ({
    padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontSize: 14, fontWeight: 600,
    background: tab === t ? 'var(--accent-9)' : 'transparent',
    color: tab === t ? '#fff' : 'var(--text-muted)',
    transition: 'all 0.15s',
  });

  const formatLastRun = (iso) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString();
  };

  return (
    <Box style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <Flex align="center" justify="between" className="topbar" px="6" py="4">
        <Flex direction="column" gap="0">
          <Text size="5" weight="bold" className="heading-text">Admin Panel</Text>
          <Text size="2" className="muted-text">Manage users and buckets</Text>
        </Flex>
        <Flex gap="2">
          <button style={tabStyle('users')} onClick={() => setTab('users')}>Users</button>
          <button style={tabStyle('buckets')} onClick={() => setTab('buckets')}>Buckets</button>
        </Flex>
      </Flex>

      <Box px="6" py="5" style={{ maxWidth: 720 }}>
        {loading && <Text size="2" className="muted-text">Loading...</Text>}
        {error && <Text size="2" style={{ color: '#dc2626' }}>{error}</Text>}

        {/* ── Users Tab ── */}
        {!loading && tab === 'users' && (
          <Flex direction="column" gap="5">
            <Card className="main-card" style={{ padding: '28px' }}>
              <form onSubmit={handleAddUser}>
                <Flex direction="column" gap="4">
                  <Text size="4" weight="bold">Add User</Text>
                  <Separator size="4" />
                  <Flex gap="3" wrap="wrap">
                    <input type="email" placeholder="Email address"
                      value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                      required className="text-input" style={{ flex: '1 1 200px' }} />
                    <input type="password" placeholder="Password"
                      value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      required minLength={4} className="text-input" style={{ flex: '1 1 140px' }} />
                  </Flex>
                  <Flex gap="3" wrap="wrap">
                    <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                      className="text-input" style={{ flex: '0 0 110px', cursor: 'pointer' }}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                    <select value={newBucketId} onChange={(e) => setNewBucketId(e.target.value)}
                      className="text-input" style={{ flex: '1 1 160px', cursor: 'pointer' }}>
                      {buckets.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                    </select>
                  </Flex>
                  <Flex align="center" gap="3">
                    <Button type="submit" size="2" style={{ borderRadius: 10 }}>Add User</Button>
                    {addMsg && (
                      <Text size="2" style={{ color: addMsg.includes('created') ? '#16a34a' : '#dc2626' }}>
                        {addMsg}
                      </Text>
                    )}
                  </Flex>
                </Flex>
              </form>
            </Card>

            <Card className="main-card" style={{ padding: '28px' }}>
              <Flex direction="column" gap="4">
                <Flex align="center" justify="between">
                  <Text size="4" weight="bold">Users</Text>
                  <Badge size="2" variant="surface" color="purple">{users.length}</Badge>
                </Flex>
                <Separator size="4" />
                {users.map((u) => (
                  <Flex key={u.email} align="center" justify="between" py="3" px="4" className="user-row">
                    <Flex align="center" gap="3">
                      <Box className="user-avatar" data-role={u.role}>
                        <PersonIcon style={{ color: u.role === 'admin' ? 'var(--accent-9)' : 'var(--gray-9)' }} />
                      </Box>
                      <Flex direction="column" gap="0">
                        <Text size="2" weight="medium">{u.email}</Text>
                        <Flex align="center" gap="2">
                          <Text size="1" className="muted-text">{u.role === 'admin' ? 'Admin' : 'User'}</Text>
                          <Text size="1" style={{ color: 'var(--accent-9)' }}>{bucketNameById(u.bucketId || 'default')}</Text>
                        </Flex>
                      </Flex>
                    </Flex>
                    <Flex gap="2" align="center">
                      <select value={u.bucketId || 'default'}
                        onChange={(e) => handleChangeBucket(u.email, e.target.value)}
                        className="text-input"
                        style={{ fontSize: 12, padding: '4px 8px', borderRadius: 8, width: 120 }}>
                        {buckets.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
                      </select>
                      <Button variant="ghost" size="1" color="gray"
                        onClick={() => handleResetPassword(u.email)} style={{ fontSize: 12 }}>
                        Reset PW
                      </Button>
                      <Button variant="ghost" size="1" color="red" onClick={() => handleDelete(u.email)}>
                        <CrossCircledIcon />
                      </Button>
                    </Flex>
                  </Flex>
                ))}
                {users.length === 0 && (
                  <Text size="2" className="muted-text" style={{ textAlign: 'center', padding: 20 }}>No users yet.</Text>
                )}
              </Flex>
            </Card>
          </Flex>
        )}

        {/* ── Buckets Tab ── */}
        {!loading && tab === 'buckets' && (
          <Flex direction="column" gap="5">
            {/* Create Bucket */}
            <Card className="main-card" style={{ padding: '28px' }}>
              <form onSubmit={handleAddBucket}>
                <Flex direction="column" gap="4">
                  <Text size="4" weight="bold">Create Bucket</Text>
                  <Separator size="4" />

                  <input type="text" placeholder="Bucket name (e.g. Swiggy, Zomato)"
                    value={bucketName} onChange={(e) => setBucketName(e.target.value)}
                    required className="text-input" />
                  <input type="text" placeholder="Google Spreadsheet ID"
                    value={bucketSheetId} onChange={(e) => setBucketSheetId(e.target.value)}
                    required className="text-input" />
                  <input type="text" placeholder="Apps Script Web App URL"
                    value={bucketScriptUrl} onChange={(e) => setBucketScriptUrl(e.target.value)}
                    required className="text-input" />
                  <input type="text" placeholder="Apps Script API Key"
                    value={bucketApiKey} onChange={(e) => setBucketApiKey(e.target.value)}
                    required className="text-input" />

                  <Separator size="4" />
                  <Text size="3" weight="bold">HyperVerge API Config</Text>
                  <input type="text" placeholder="HyperVerge API URL"
                    value={bucketHvApiUrl} onChange={(e) => setBucketHvApiUrl(e.target.value)}
                    className="text-input" />
                  <Flex gap="3" wrap="wrap">
                    <input type="text" placeholder="App ID"
                      value={bucketHvAppId} onChange={(e) => setBucketHvAppId(e.target.value)}
                      className="text-input" style={{ flex: '1 1 200px' }} />
                    <input type="text" placeholder="App Key"
                      value={bucketHvAppKey} onChange={(e) => setBucketHvAppKey(e.target.value)}
                      className="text-input" style={{ flex: '1 1 200px' }} />
                  </Flex>
                  <Flex gap="3" wrap="wrap">
                    <Flex direction="column" gap="1" style={{ flex: '1 1 100px' }}>
                      <Text size="1" className="muted-text">Batch Size</Text>
                      <input type="number" min="1" max="500" value={bucketBatchSize}
                        onChange={(e) => setBucketBatchSize(e.target.value)} className="text-input" />
                    </Flex>
                    <Flex direction="column" gap="1" style={{ flex: '1 1 100px' }}>
                      <Text size="1" className="muted-text">Rate Limit (QPS)</Text>
                      <input type="number" min="1" max="100" value={bucketQps}
                        onChange={(e) => setBucketQps(e.target.value)} className="text-input" />
                    </Flex>
                    <Flex direction="column" gap="1" style={{ flex: '1 1 100px' }}>
                      <Text size="1" className="muted-text">Max Retries</Text>
                      <input type="number" min="0" max="10" value={bucketMaxRetries}
                        onChange={(e) => setBucketMaxRetries(e.target.value)} className="text-input" />
                    </Flex>
                  </Flex>

                  <CoupledConfigSection
                    enabled={coupledEnabled} setEnabled={setCoupledEnabled}
                    vals={coupledVals} set={setCoupledField}
                  />

                  <Flex align="center" gap="3">
                    <Button type="submit" size="2" style={{ borderRadius: 10 }}>Create Bucket</Button>
                    {bucketMsg && (
                      <Text size="2" style={{ color: bucketMsg.includes('created') ? '#16a34a' : '#dc2626' }}>
                        {bucketMsg}
                      </Text>
                    )}
                  </Flex>
                </Flex>
              </form>
            </Card>

            {/* Buckets List */}
            <Card className="main-card" style={{ padding: '28px' }}>
              <Flex direction="column" gap="4">
                <Flex align="center" justify="between">
                  <Text size="4" weight="bold">Buckets</Text>
                  <Badge size="2" variant="surface" color="purple">{buckets.length}</Badge>
                </Flex>
                <Separator size="4" />

                {buckets.map(b => {
                  const usersInBucket = users.filter(u => (u.bucketId || 'default') === b.id).length;
                  const cc = b.coupledConfig;

                  if (editingBucket === b.id) {
                    return (
                      <Card key={b.id} style={{ padding: 16, background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: 12 }}>
                        <form onSubmit={handleEditBucket}>
                          <Flex direction="column" gap="3">
                            <Text size="2" weight="bold">Editing: {b.id}</Text>
                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                              placeholder="Name" className="text-input" required />
                            <input type="text" value={editSheetId} onChange={(e) => setEditSheetId(e.target.value)}
                              placeholder="Spreadsheet ID" className="text-input" required />
                            <input type="text" value={editScriptUrl} onChange={(e) => setEditScriptUrl(e.target.value)}
                              placeholder="Apps Script URL" className="text-input" required />
                            <input type="text" value={editApiKey} onChange={(e) => setEditApiKey(e.target.value)}
                              placeholder="API Key" className="text-input" required />

                            <Separator size="4" />
                            <Text size="2" weight="bold">HyperVerge API Config</Text>
                            <input type="text" value={editHvApiUrl} onChange={(e) => setEditHvApiUrl(e.target.value)}
                              placeholder="HyperVerge API URL" className="text-input" />
                            <Flex gap="3" wrap="wrap">
                              <input type="text" value={editHvAppId} onChange={(e) => setEditHvAppId(e.target.value)}
                                placeholder="App ID" className="text-input" style={{ flex: '1 1 150px' }} />
                              <input type="text" value={editHvAppKey} onChange={(e) => setEditHvAppKey(e.target.value)}
                                placeholder="App Key" className="text-input" style={{ flex: '1 1 150px' }} />
                            </Flex>
                            <Flex gap="3" wrap="wrap">
                              <Flex direction="column" gap="1" style={{ flex: '1 1 80px' }}>
                                <Text size="1" className="muted-text">Batch Size</Text>
                                <input type="number" min="1" max="500" value={editBatchSize}
                                  onChange={(e) => setEditBatchSize(e.target.value)} className="text-input" />
                              </Flex>
                              <Flex direction="column" gap="1" style={{ flex: '1 1 80px' }}>
                                <Text size="1" className="muted-text">QPS</Text>
                                <input type="number" min="1" max="100" value={editQps}
                                  onChange={(e) => setEditQps(e.target.value)} className="text-input" />
                              </Flex>
                              <Flex direction="column" gap="1" style={{ flex: '1 1 80px' }}>
                                <Text size="1" className="muted-text">Retries</Text>
                                <input type="number" min="0" max="10" value={editMaxRetries}
                                  onChange={(e) => setEditMaxRetries(e.target.value)} className="text-input" />
                              </Flex>
                            </Flex>

                            <CoupledConfigSection
                              enabled={editCoupledEnabled} setEnabled={setEditCoupledEnabled}
                              vals={editCoupledVals} set={setEditCoupledField}
                            />

                            <Flex gap="2">
                              <Button type="submit" size="1" style={{ borderRadius: 8 }}>Save</Button>
                              <Button type="button" variant="ghost" size="1" color="gray"
                                onClick={() => setEditingBucket(null)}>Cancel</Button>
                            </Flex>
                          </Flex>
                        </form>
                      </Card>
                    );
                  }

                  return (
                    <Flex key={b.id} align="start" justify="between" py="3" px="4" className="user-row">
                      <Flex align="center" gap="3">
                        <Box className="user-avatar">
                          <CubeIcon style={{ color: b.id === 'default' ? 'var(--accent-9)' : 'var(--gray-9)' }} />
                        </Box>
                        <Flex direction="column" gap="1">
                          <Flex align="center" gap="2" wrap="wrap">
                            <Text size="2" weight="medium">{b.name}</Text>
                            {b.id === 'default' && <Badge size="1" variant="soft" color="purple">Default</Badge>}
                            {cc?.enabled && <Badge size="1" variant="soft" color="orange">Coupled CRC</Badge>}
                          </Flex>
                          <Text size="1" className="muted-text" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.spreadsheetId}
                          </Text>
                          <Text size="1" className="muted-text">
                            {usersInBucket} user{usersInBucket !== 1 ? 's' : ''} &middot; QPS: {b.qps || 15} &middot; Batch: {b.batchSize || 100} &middot; Retries: {b.maxRetries || 3}
                          </Text>
                          {cc?.enabled && (
                            <Text size="1" className="muted-text">
                              Last run: {formatLastRun(cc.lastRunAt)}
                              {cc.lastRunStatus && ` · ${cc.lastRunStatus}`}
                              {cc.lastRunCount ? ` · ${cc.lastRunCount} records` : ''}
                              {cc.cronSchedule && ` · Cron: ${cc.cronSchedule}`}
                            </Text>
                          )}
                        </Flex>
                      </Flex>
                      <Flex gap="2" align="center" wrap="wrap" justify="end">
                        {cc?.enabled && (
                          <Button variant="ghost" size="1" color="orange"
                            onClick={() => handleRunNow(b.id)}
                            disabled={runningNow[b.id]}>
                            {runningNow[b.id] ? <ReloadIcon style={{ animation: 'spin 1s linear infinite' }} /> : <PlayIcon />}
                            {runningNow[b.id] ? 'Starting...' : 'Run Now'}
                          </Button>
                        )}
                        <Button variant="ghost" size="1" color="gray" onClick={() => startEdit(b)}>
                          <Pencil1Icon /> Edit
                        </Button>
                        {b.id !== 'default' && (
                          <Button variant="ghost" size="1" color="red" onClick={() => handleDeleteBucket(b.id)}>
                            <CrossCircledIcon />
                          </Button>
                        )}
                      </Flex>
                    </Flex>
                  );
                })}

                {buckets.length === 0 && (
                  <Text size="2" className="muted-text" style={{ textAlign: 'center', padding: 20 }}>No buckets yet.</Text>
                )}
              </Flex>
            </Card>
          </Flex>
        )}
      </Box>
    </Box>
  );
}
