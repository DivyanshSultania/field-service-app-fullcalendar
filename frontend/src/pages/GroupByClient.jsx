import { minutesBetween, formatHM } from './utils';
import React, { useEffect, useState } from 'react';

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export default function GroupByClient({ tasks }) {
  const [openGroups, setOpenGroups] = useState({});

  const grouped = tasks.reduce((acc, t) => {
    const key = t.client_name || 'Unknown';
    acc[key] = acc[key] || [];
    acc[key].push(t);
    return acc;
  }, {});

  const toggle = key =>
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div>
      {Object.entries(grouped).map(([client, rows]) => {
        const sch = rows.reduce((a, r) => a + minutesBetween(r.start_time, r.end_time), 0);
        const log = rows.reduce((a, r) => a + minutesBetween(r.log_start_time, r.log_end_time), 0);
        const open = openGroups[client];

        return (
          <div key={client} style={{ border: '1px solid #e5e7eb', marginBottom: 12 }}>
            <div
              onClick={() => toggle(client)}
              style={{
                cursor: 'pointer',
                padding: '10px 12px',
                background: '#f9fafb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <strong>{client}</strong>
              <span>
                {rows.length} shifts | Sch {formatHM(sch)} | Log {formatHM(log)}{' '}
                {open ? '▲' : '▼'}
              </span>
            </div>

            {open && (
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px' }}>Staff</th>
                    <th style={{ padding: '8px 12px' }}>Scheduled</th>
                    <th style={{ padding: '8px 12px' }}>Logged</th>
                    <th style={{ padding: '8px 12px' }}>Log Length</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px 12px' }}>{r.staff_name}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {formatDateTime(r.start_time)} → {formatDateTime(r.end_time)}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {r.log_start_time
                          ? `${formatDateTime(r.log_start_time)} → ${formatDateTime(r.log_end_time)}`
                          : '-'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {formatHM(minutesBetween(r.log_start_time, r.log_end_time))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}