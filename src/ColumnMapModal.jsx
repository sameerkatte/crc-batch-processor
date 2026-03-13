import { useState, useMemo } from 'react';
import {
  Box, Flex, Text, Button, Select, Strong, Badge, Separator,
  Table, ScrollArea,
} from '@radix-ui/themes';
import { CheckCircledIcon, Cross2Icon, ArrowRightIcon } from '@radix-ui/react-icons';

// All sheet columns — mapped input columns + auto-filled output columns
const FULL_HEADER = [
  'DE_ID', 'DEName', 'Fathers Name', 'DOB', 'Permanant Address',
  'Result', 'NumberOfCases', 'Colour', 'QC Colour',
  'Reason', 'Case Link', 'Case category', 'Act', 'Section', 'Case status',
  'Case Link', '', 'Case Link', '', 'Reason', 'Case link'
];

export default function ColumnMapModal({ data, onConfirm, onCancel }) {
  const { headers, mapping: autoMapping, targets, sampleRows, totalDataRows } = data;

  // State: mapping from target column name → source column index
  const [mapping, setMapping] = useState(() => {
    const m = {};
    for (const t of targets) {
      m[t] = autoMapping[t] ?? -1;
    }
    return m;
  });

  const allMapped = useMemo(
    () => targets.every(t => mapping[t] !== -1 && mapping[t] !== undefined),
    [mapping, targets]
  );

  const handleChange = (target, value) => {
    setMapping(prev => ({ ...prev, [target]: Number(value) }));
  };

  // Preview: show all 21 columns — mapped ones with data, output ones empty
  const previewRows = useMemo(() => {
    return sampleRows.map(row =>
      FULL_HEADER.map((col, ci) => {
        // First 5 columns are the mapped input columns
        const target = targets[ci];
        if (target) {
          const idx = mapping[target];
          if (idx === -1 || idx === undefined) return '—';
          return row[idx] ?? '';
        }
        // Output columns — show empty (will be filled by CRC script)
        return '';
      })
    );
  }, [sampleRows, mapping, targets]);

  return (
    <Box
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Backdrop */}
      <Box
        onClick={onCancel}
        style={{
          position: 'absolute', inset: 0,
          background: 'var(--color-overlay)', backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <Box
        style={{
          position: 'relative', zIndex: 1,
          background: 'var(--color-panel-solid)',
          border: '1px solid var(--gray-6)',
          borderRadius: 'var(--radius-4)',
          padding: 24, width: '90vw', maxWidth: 820,
          maxHeight: '85vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,.3)',
        }}
      >
        <Flex justify="between" align="center" mb="3">
          <Text size="5" weight="bold">Verify Column Mapping</Text>
          <Button variant="ghost" color="gray" onClick={onCancel}>
            <Cross2Icon />
          </Button>
        </Flex>

        <Text size="2" className="muted-text" mb="4" as="p">
          {totalDataRows} rows detected. Review the auto-detected mapping below. Change any column using the dropdowns.
        </Text>

        <Separator size="4" mb="4" />

        {/* Mapping controls */}
        <Box mb="4">
          <Text size="2" weight="bold" mb="2" as="p">Column Mapping</Text>
          <Flex direction="column" gap="2">
            {targets.map(target => (
              <Flex key={target} align="center" gap="3">
                <Box style={{ width: 160, flexShrink: 0 }}>
                  <Badge
                    size="2"
                    color={mapping[target] !== -1 ? 'green' : 'red'}
                    variant="soft"
                  >
                    {target}
                  </Badge>
                </Box>

                <ArrowRightIcon style={{ flexShrink: 0, color: 'var(--gray-9)' }} />

                <Box style={{ flex: 1, maxWidth: 300 }}>
                  <Select.Root
                    value={String(mapping[target])}
                    onValueChange={val => handleChange(target, val)}
                  >
                    <Select.Trigger
                      style={{ width: '100%' }}
                      color={mapping[target] === -1 ? 'red' : undefined}
                    />
                    <Select.Content>
                      <Select.Item value="-1">— Not mapped —</Select.Item>
                      {headers.map((h, i) => (
                        <Select.Item key={i} value={String(i)}>
                          {h || `(Column ${i + 1})`}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Box>

                {mapping[target] !== -1 && (
                  <Text size="1" className="muted-text" style={{ flexShrink: 0 }}>
                    sample: <Strong>{String(sampleRows[0]?.[mapping[target]] ?? '')}</Strong>
                  </Text>
                )}
              </Flex>
            ))}
          </Flex>
        </Box>

        <Separator size="4" mb="4" />

        {/* Data preview table — all 21 columns */}
        <Box mb="4">
          <Text size="2" weight="bold" mb="2" as="p">
            Sheet Preview (first {previewRows.length} rows)
          </Text>
          <ScrollArea style={{ maxHeight: 240 }}>
            <Table.Root size="1" variant="surface" style={{ minWidth: 1200 }}>
              <Table.Header>
                <Table.Row>
                  {FULL_HEADER.map((col, i) => (
                    <Table.ColumnHeaderCell
                      key={i}
                      style={{
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                        background: i < targets.length ? undefined : 'var(--gray-3)',
                        color: i < targets.length ? undefined : 'var(--gray-9)',
                      }}
                    >
                      {col || `(Col ${String.fromCharCode(65 + i)})`}
                    </Table.ColumnHeaderCell>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {previewRows.map((row, ri) => (
                  <Table.Row key={ri}>
                    {row.map((cell, ci) => (
                      <Table.Cell
                        key={ci}
                        style={{
                          fontSize: 12,
                          maxWidth: 160,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          background: ci < targets.length ? undefined : 'var(--gray-2)',
                          color: ci >= targets.length ? 'var(--gray-8)' : undefined,
                        }}
                      >
                        {String(cell) || (ci >= targets.length ? '—' : '')}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </ScrollArea>
          <Text size="1" className="muted-text" mt="1" as="p">
            Greyed columns are output columns — filled automatically by the CRC script.
          </Text>
        </Box>

        {/* Actions */}
        <Flex justify="end" gap="3">
          <Button variant="soft" color="gray" onClick={onCancel}>Cancel</Button>
          <Button
            disabled={!allMapped}
            onClick={() => onConfirm(mapping)}
          >
            <CheckCircledIcon /> Confirm & Upload
          </Button>
        </Flex>

        {!allMapped && (
          <Text size="1" color="red" mt="2" as="p" align="right">
            All columns must be mapped before uploading.
          </Text>
        )}
      </Box>
    </Box>
  );
}
