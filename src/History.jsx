import { useState, useEffect, useCallback } from 'react';
import {
  Box, Flex, Text, Badge, Card, Progress, Separator,
} from '@radix-ui/themes';
import {
  ReloadIcon, ClockIcon, CheckCircledIcon, CrossCircledIcon,
} from '@radix-ui/react-icons';

const API_BASE = '/api';

function statusBadge(status) {
  switch (status) {
    case 'done':
      return <Badge size="1" color="green" variant="soft">Done</Badge>;
    case 'done_with_errors':
      return <Badge size="1" color="orange" variant="soft">Done (errors)</Badge>;
    case 'running':
      return <Badge size="1" color="purple" variant="soft"><ReloadIcon style={{ animation: 'spin 1s linear infinite', width: 10, height: 10 }} /> Running</Badge>;
    case 'cancelled':
      return <Badge size="1" color="red" variant="soft">Cancelled</Badge>;
    default:
      return <Badge size="1" color="gray" variant="soft">{status || 'unknown'}</Badge>;
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return '—';
  const ms = new Date(endIso) - new Date(startIso);
  if (ms < 0) return '—';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function History({ token, onViewLogs, logsMode }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setHistory(data.history || []);
    } catch { /* */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Auto-refresh in logs mode if any jobs are running
  useEffect(() => {
    if (!logsMode) return;
    const hasRunning = history.some(h => h.status === 'running');
    if (!hasRunning) return;
    const interval = setInterval(fetchHistory, 8000);
    return () => clearInterval(interval);
  }, [logsMode, history, fetchHistory]);

  return (
    <Box style={{ minHeight: '100vh' }}>
      <Flex align="center" justify="between" className="topbar" px="6" py="4">
        <Flex direction="column" gap="0">
          <Text size="5" weight="bold" className="heading-text">
            {logsMode ? 'Job Logs' : 'Upload History'}
          </Text>
          <Text size="2" className="muted-text">
            {logsMode
              ? 'Processing status and execution details for each job'
              : 'Record of all file uploads and their current status'}
          </Text>
        </Flex>
        <button
          onClick={fetchHistory}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--accent-9)', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 500,
          }}
        >
          <ReloadIcon width={14} height={14} /> Refresh
        </button>
      </Flex>

      <Box px="6" py="5" style={{ maxWidth: logsMode ? 720 : 880 }}>
        {loading && (
          <Flex align="center" gap="2" py="8" justify="center">
            <ReloadIcon style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-9)' }} />
            <Text size="2" className="muted-text">Loading...</Text>
          </Flex>
        )}

        {!loading && history.length === 0 && (
          <Card className="main-card" style={{ padding: 40, textAlign: 'center' }}>
            <ClockIcon width={32} height={32} style={{ color: 'var(--gray-7)', margin: '0 auto 12px' }} />
            <Text size="3" className="muted-text">{logsMode ? 'No job logs yet' : 'No uploads yet'}</Text>
          </Card>
        )}

        {/* ── UPLOAD HISTORY VIEW ── */}
        {!loading && history.length > 0 && !logsMode && (
          <Flex direction="column" gap="2">
            <Flex px="4" py="2" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Text size="1" className="muted-text" style={{ flex: '1 1 120px' }}>Sheet</Text>
              <Text size="1" className="muted-text" style={{ flex: '1 1 160px' }}>File</Text>
              <Text size="1" className="muted-text" style={{ flex: '0 0 60px', textAlign: 'center' }}>Rows</Text>
              <Text size="1" className="muted-text" style={{ flex: '0 0 130px' }}>Uploaded</Text>
              <Text size="1" className="muted-text" style={{ flex: '0 0 140px' }}>By</Text>
              <Text size="1" className="muted-text" style={{ flex: '0 0 100px' }}>Status</Text>
              <Text size="1" className="muted-text" style={{ flex: '0 0 70px' }}></Text>
            </Flex>

            {history.filter(h => h.type !== 'coupled').map((h) => (
              <Card key={h.id} className="main-card" style={{ padding: '14px 16px' }}>
                <Flex align="center">
                  <Text size="2" weight="medium" style={{ flex: '1 1 120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.sheetName}
                  </Text>
                  <Text size="1" className="muted-text" style={{ flex: '1 1 160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.fileName}
                  </Text>
                  <Text size="2" style={{ flex: '0 0 60px', textAlign: 'center' }}>
                    {h.totalRows}
                  </Text>
                  <Text size="1" className="muted-text" style={{ flex: '0 0 130px' }}>
                    {formatDate(h.uploadedAt)}
                  </Text>
                  <Text size="1" className="muted-text" style={{ flex: '0 0 140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.uploadedBy}
                  </Text>
                  <Box style={{ flex: '0 0 100px' }}>
                    {statusBadge(h.status)}
                  </Box>
                  <Box style={{ flex: '0 0 70px', textAlign: 'right' }}>
                    <button
                      onClick={() => onViewLogs(h.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--accent-9)', fontSize: 12, fontWeight: 500,
                        textDecoration: 'underline',
                      }}
                    >
                      View Logs
                    </button>
                  </Box>
                </Flex>
              </Card>
            ))}
          </Flex>
        )}

        {/* ── JOB LOGS VIEW (execution-focused) ── */}
        {!loading && history.length > 0 && logsMode && (
          <Flex direction="column" gap="3">
            {history.filter(h => h.type !== 'coupled').map((h) => {
              const pct = h.totalRows > 0 && h.processed != null
                ? Math.round((h.processed / h.totalRows) * 100)
                : (h.status === 'done' ? 100 : 0);
              const isRunning = h.status === 'running';
              const isDone = h.status === 'done' || h.status === 'done_with_errors';
              const duration = formatDuration(h.uploadedAt, h.completedAt);

              return (
                <Card key={h.id} className="main-card" style={{ padding: '20px 24px' }}>
                  <Flex direction="column" gap="3">
                    {/* Header: sheet name + status */}
                    <Flex align="center" justify="between">
                      <Flex align="center" gap="3">
                        <Text size="3" weight="bold">{h.sheetName}</Text>
                        {statusBadge(h.status)}
                      </Flex>
                      <button
                        onClick={() => onViewLogs(h.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--accent-9)', fontSize: 12, fontWeight: 500,
                          textDecoration: 'underline',
                        }}
                      >
                        Full Details
                      </button>
                    </Flex>

                    {/* Progress bar */}
                    <Progress value={pct} max={100} size="1" />

                    {/* Stats row */}
                    <Flex align="center" gap="4" wrap="wrap">
                      <Flex align="center" gap="1">
                        <Text size="1" className="muted-text">Rows:</Text>
                        <Text size="2" weight="medium">{h.totalRows}</Text>
                      </Flex>

                      {(isDone || isRunning) && h.processed != null && (
                        <Flex align="center" gap="1">
                          <CheckCircledIcon style={{ color: '#16a34a', width: 12, height: 12 }} />
                          <Text size="2" weight="medium" style={{ color: '#16a34a' }}>{h.processed}</Text>
                          <Text size="1" className="muted-text">processed</Text>
                        </Flex>
                      )}

                      {h.errors > 0 && (
                        <Flex align="center" gap="1">
                          <CrossCircledIcon style={{ color: '#dc2626', width: 12, height: 12 }} />
                          <Text size="2" weight="medium" style={{ color: '#dc2626' }}>{h.errors}</Text>
                          <Text size="1" className="muted-text">errors</Text>
                        </Flex>
                      )}

                      {isRunning && (
                        <Flex align="center" gap="1">
                          <ReloadIcon style={{ animation: 'spin 1s linear infinite', width: 12, height: 12, color: 'var(--accent-9)' }} />
                          <Text size="1" style={{ color: 'var(--accent-9)', fontWeight: 500 }}>Processing...</Text>
                        </Flex>
                      )}

                      <Text size="1" className="muted-text" style={{ marginLeft: 'auto' }}>
                        {isDone ? `Completed in ${duration}` : formatDate(h.uploadedAt)}
                      </Text>
                    </Flex>

                    {/* Trigger result — only show if it indicates a problem */}
                    {h.triggerResult && h.triggerResult !== 'JOB_STARTED' && h.triggerResult !== 'OK'
                      && !h.triggerResult.startsWith('STARTED') && (
                      <Text size="1" style={{ fontFamily: 'monospace', color: h.triggerResult.startsWith('TRIGGER_FAILED') ? '#dc2626' : 'var(--gray-9)', opacity: 0.8 }}>
                        Trigger: {h.triggerResult}
                      </Text>
                    )}
                  </Flex>
                </Card>
              );
            })}
          </Flex>
        )}
      </Box>
    </Box>
  );
}
