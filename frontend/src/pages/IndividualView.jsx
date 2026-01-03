import { minutesBetween, formatHM } from './utils';
import React, { useState } from 'react';

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

export default function IndividualView({ tasks }) {
  const [openGroups, setOpenGroups] = useState({});

  const grouped = tasks.reduce((acc, t) => {
    const dateKey = t.start_time?.split(' ')[0] || 'Unknown';
    acc[dateKey] = acc[dateKey] || [];
    acc[dateKey].push(t);
    return acc;
  }, {});

  const toggle = key =>
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div>
      {Object.entries(grouped).map(([date, rows]) => {
        const sch = rows.reduce((a, r) => a + minutesBetween(r.start_time, r.end_time), 0);
        const log = rows.reduce((a, r) => a + minutesBetween(r.log_start_time, r.log_end_time), 0);
        const open = openGroups[date];

        return (
          <div key={date} style={{ border: '1px solid #e5e7eb', marginBottom: 12 }}>
            <div
              onClick={() => toggle(date)}
              style={{
                cursor: 'pointer',
                padding: '10px 12px',
                background: '#f3f4f6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <strong>{formatDateTime(date)}</strong>
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
                  {rows.map(t => (
                    <tr key={t.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px 12px' }}>{t.staff_name || 'Cover'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {formatDateTime(t.start_time)} → {formatDateTime(t.end_time)}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {t.log_start_time
                          ? `${formatDateTime(t.log_start_time)} → ${formatDateTime(t.log_end_time)}`
                          : '-'}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {formatHM(minutesBetween(t.log_start_time, t.log_end_time))}
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