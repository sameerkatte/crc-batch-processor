import { useState, useEffect, useCallback } from 'react';
import {
  Box, Flex, Text, Badge, Card, Progress, Separator,
} from '@radix-ui/themes';
import {
  CheckCircledIcon, CrossCircledIcon, ReloadIcon, ArrowLeftIcon,
  ExternalLinkIcon,
} from '@radix-ui/react-icons';

const API_BASE = '/api';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function statusBadge(status) {
  switch (status) {
    case 'done': return <Badge size="2" color="green" variant="soft">Completed</Badge>;
    case 'done_with_errors': return <Badge size="2" color="orange" variant="soft">Done with errors</Badge>;
    case 'running': return <Badge size="2" color="purple" variant="soft"><ReloadIcon style={{ animation: 'spin 1s linear infinite', width: 12, height: 12 }} /> Running</Badge>;
    default: return <Badge size="2" color="gray" variant="soft">{status}</Badge>;
  }
}

function InfoRow({ label, value }) {
  return (
    <Flex align="center" py="2" style={{ borderBottom: '1px solid var(--border-card)' }}>
      <Text size="2" className="muted-text" style={{ width: 140, flexShrink: 0 }}>{label}</Text>
      <Text size="2" weight="medium">{value}</Text>
    </Flex>
  );
}

export default function JobDetail({ token, jobId, onBack }) {
  const [entry, setEntry] = useState(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [sheetUrl, setSheetUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/history/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEntry(data.entry);
        setLiveStatus(data.liveStatus);
        if (data.sheetUrl) setSheetUrl(data.sheetUrl);
      }
    } catch { /* */ }
    setLoading(false);
  }, [token, jobId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // Auto-refresh if running
  useEffect(() => {
    if (!entry || entry.status !== 'running') return;
    const interval = setInterval(fetchDetail, 8000);
    return () => clearInterval(interval);
  }, [entry?.status, fetchDetail]);

  if (loading) {
    return (
      <Box style={{ minHeight: '100vh' }}>
        <Flex align="center" justify="between" className="topbar" px="6" py="4">
          <Text size="5" weight="bold" className="heading-text">Job Details</Text>
        </Flex>
        <Flex align="center" justify="center" py="8" gap="2">
          <ReloadIcon style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-9)' }} />
          <Text size="2" className="muted-text">Loading...</Text>
        </Flex>
      </Box>
    );
  }

  if (!entry) {
    return (
      <Box style={{ minHeight: '100vh' }}>
        <Flex align="center" className="topbar" px="6" py="4" gap="3">
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-9)', display: 'flex' }}>
            <ArrowLeftIcon width={18} height={18} />
          </button>
          <Text size="5" weight="bold" className="heading-text">Job Not Found</Text>
        </Flex>
      </Box>
    );
  }

  const pct = liveStatus && liveStatus.total > 0
    ? Math.round((liveStatus.processed / liveStatus.total) * 100)
    : 0;

  return (
    <Box style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <Flex align="center" justify="between" className="topbar" px="6" py="4">
        <Flex align="center" gap="3">
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-9)', display: 'flex' }}>
            <ArrowLeftIcon width={18} height={18} />
          </button>
          <Flex direction="column" gap="0">
            <Text size="5" weight="bold" className="heading-text">
              {entry.sheetName}
            </Text>
            <Text size="2" className="muted-text">Job details and live status</Text>
          </Flex>
        </Flex>
        <Flex align="center" gap="3">
          {statusBadge(entry.status)}
          <button onClick={fetchDetail} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-9)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500 }}>
            <ReloadIcon width={14} height={14} /> Refresh
          </button>
        </Flex>
      </Flex>

      <Box px="6" py="5" style={{ maxWidth: 680 }}>
        <Flex direction="column" gap="5">

          {/* Info Card */}
          <Card className="main-card" style={{ padding: '24px 28px' }}>
            <Text size="3" weight="bold" style={{ marginBottom: 12, display: 'block' }}>Job Info</Text>
            <InfoRow label="Sheet Name" value={entry.sheetName} />
            <InfoRow label="Source File" value={entry.fileName} />
            <InfoRow label="Total Rows" value={entry.totalRows} />
            <InfoRow label="Uploaded By" value={entry.uploadedBy} />
            <InfoRow label="Uploaded At" value={formatDate(entry.uploadedAt)} />
            {entry.completedAt && <InfoRow label="Completed At" value={formatDate(entry.completedAt)} />}
            <InfoRow label="Trigger Result" value={entry.triggerResult || '—'} />
            {sheetUrl && (
              <Flex align="center" py="2" gap="3">
                <Text size="2" className="muted-text" style={{ width: 140, flexShrink: 0 }}>Sheet Link</Text>
                <a href={sheetUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--accent-9)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 500 }}>
                  Open in Google Sheets <ExternalLinkIcon width={14} height={14} />
                </a>
              </Flex>
            )}
          </Card>

          {/* Live Status Card */}
          {liveStatus && (
            <Card className="main-card" style={{ padding: '24px 28px' }}>
              <Flex align="center" justify="between" style={{ marginBottom: 16 }}>
                <Text size="3" weight="bold">Live Status</Text>
                {entry.status === 'running' && (
                  <Badge size="1" color="purple" variant="soft" style={{ gap: 4 }}>
                    <ReloadIcon style={{ animation: 'spin 1s linear infinite', width: 10, height: 10 }} />
                    Auto-refreshing
                  </Badge>
                )}
              </Flex>

              <Flex direction="column" gap="3">
                <Progress value={pct} max={100} size="2" />
                <Flex align="center" justify="between">
                  <Text size="1" className="muted-text">{liveStatus.processed} / {liveStatus.total} rows processed</Text>
                  <Text size="1" weight="medium" style={{ color: pct === 100 ? '#16a34a' : 'var(--accent-9)' }}>{pct}%</Text>
                </Flex>

                <Separator size="4" />

                <Flex gap="5" wrap="wrap">
                  <Flex align="center" gap="2">
                    <CheckCircledIcon style={{ color: '#16a34a' }} />
                    <Text size="2"><strong>{liveStatus.processed}</strong> processed</Text>
                  </Flex>
                  {liveStatus.errors > 0 && (
                    <Flex align="center" gap="2">
                      <CrossCircledIcon style={{ color: '#dc2626' }} />
                      <Text size="2"><strong>{liveStatus.errors}</strong> errors</Text>
                    </Flex>
                  )}
                  {liveStatus.unprocessed > 0 && (
                    <Flex align="center" gap="2">
                      <ReloadIcon style={{ color: 'var(--gray-9)' }} />
                      <Text size="2"><strong>{liveStatus.unprocessed}</strong> pending</Text>
                    </Flex>
                  )}
                </Flex>

                {liveStatus.done && (
                  <Box style={{
                    padding: '12px 16px', borderRadius: 12,
                    background: liveStatus.errors > 0 ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,106,0.08)',
                    border: `1px solid ${liveStatus.errors > 0 ? 'rgba(217,119,6,0.15)' : 'rgba(22,163,106,0.15)'}`,
                  }}>
                    <Text size="2" weight="medium" style={{ color: liveStatus.errors > 0 ? '#d97706' : '#16a34a' }}>
                      {liveStatus.errors > 0
                        ? `Completed with ${liveStatus.errors} error(s). Check column P in sheet.`
                        : 'All rows processed successfully. Ready for QC.'
                      }
                    </Text>
                  </Box>
                )}
              </Flex>
            </Card>
          )}
        </Flex>
      </Box>
    </Box>
  );
}
