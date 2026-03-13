import { useState, useEffect, useCallback } from 'react';
import {
  Box, Flex, Text, Badge, Card,
} from '@radix-ui/themes';
import {
  ReloadIcon, ClockIcon,
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
    default:
      return <Badge size="1" color="gray" variant="soft">{status}</Badge>;
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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

  return (
    <Box style={{ minHeight: '100vh' }}>
      <Flex align="center" justify="between" className="topbar" px="6" py="4">
        <Flex direction="column" gap="0">
          <Text size="5" weight="bold" className="heading-text">{logsMode ? 'Job Logs' : 'Upload History'}</Text>
          <Text size="2" className="muted-text">{logsMode ? 'View detailed logs for each job' : 'Previous uploads and their statuses'}</Text>
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

      <Box px="6" py="5" style={{ maxWidth: 800 }}>
        {loading && (
          <Flex align="center" gap="2" py="8" justify="center">
            <ReloadIcon style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-9)' }} />
            <Text size="2" className="muted-text">Loading...</Text>
          </Flex>
        )}

        {!loading && history.length === 0 && (
          <Card className="main-card" style={{ padding: 40, textAlign: 'center' }}>
            <ClockIcon width={32} height={32} style={{ color: 'var(--gray-7)', margin: '0 auto 12px' }} />
            <Text size="3" className="muted-text">No uploads yet</Text>
          </Card>
        )}

        {!loading && history.length > 0 && (
          <Flex direction="column" gap="2">
            {/* Header row */}
            <Flex px="4" py="2" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Text size="1" className="muted-text" style={{ flex: '1 1 140px' }}>Sheet</Text>
              <Text size="1" className="muted-text" style={{ flex: '1 1 160px' }}>File</Text>
              <Text size="1" className="muted-text" style={{ flex: '0 0 60px', textAlign: 'center' }}>Rows</Text>
              <Text size="1" className="muted-text" style={{ flex: '0 0 120px' }}>Uploaded</Text>
              <Text size="1" className="muted-text" style={{ flex: '0 0 140px' }}>By</Text>
              <Text size="1" className="muted-text" style={{ flex: '0 0 110px' }}>Status</Text>
              <Text size="1" className="muted-text" style={{ flex: '0 0 60px' }}></Text>
            </Flex>

            {history.map((h) => (
              <Card key={h.id} className="main-card" style={{ padding: '14px 16px' }}>
                <Flex align="center">
                  <Text size="2" weight="medium" style={{ flex: '1 1 140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.sheetName}
                  </Text>
                  <Text size="1" className="muted-text" style={{ flex: '1 1 160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.fileName}
                  </Text>
                  <Text size="2" style={{ flex: '0 0 60px', textAlign: 'center' }}>
                    {h.totalRows}
                  </Text>
                  <Text size="1" className="muted-text" style={{ flex: '0 0 120px' }}>
                    {formatDate(h.uploadedAt)}
                  </Text>
                  <Text size="1" className="muted-text" style={{ flex: '0 0 140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.uploadedBy}
                  </Text>
                  <Box style={{ flex: '0 0 110px' }}>
                    {statusBadge(h.status)}
                  </Box>
                  <Box style={{ flex: '0 0 60px', textAlign: 'right' }}>
                    <button
                      onClick={() => onViewLogs(h.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--accent-9)', fontSize: 12, fontWeight: 500,
                        textDecoration: 'underline',
                      }}
                    >
                      Details
                    </button>
                  </Box>
                </Flex>
              </Card>
            ))}
          </Flex>
        )}
      </Box>
    </Box>
  );
}
