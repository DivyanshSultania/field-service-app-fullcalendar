import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { formatHM } from './utils';
import { getTaskStaffTravelRecord } from '../utils/taskTravel';

const HOMEMAID_LOGO = 'https://pub-ac8edfc52ef04beba837f1804a4abf42.r2.dev/public/homemaid_logo.png';

function isCoverTask(task) {
  return task?.assignment_type === 'cover' || task?.staff_id === 'STATIC-COVER-STAFF';
}

function formatDateTime(value, pattern = 'DD MMM HH:mm') {
  if (!value) return '-';
  return dayjs(value).format(pattern);
}

function formatDistance(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0.00';
  return number.toFixed(2);
}

function parseDistance(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseMinutes(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function escapeCsv(value) {
  const text = value == null ? '' : String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAssignedStaffRows(task, appliedFilters) {
  const staffRows = [];
  const seenKeys = new Set();

  const pushRow = (staffId, staffName) => {
    const normalizedName = staffName || (isCoverTask(task) ? 'Cover' : 'Unknown');
    const dedupeKey = staffId || normalizedName;
    if (seenKeys.has(dedupeKey)) {
      return;
    }
    seenKeys.add(dedupeKey);

    if (appliedFilters?.staffId && staffId !== appliedFilters.staffId) {
      return;
    }

    const staffTravelRecord = getTaskStaffTravelRecord(task, staffId);
    const isSupervisorRow = staffId && staffId === task?.staff_id;

    staffRows.push({
      ...task,
      grouped_staff_id: staffId || normalizedName,
      grouped_staff_name: normalizedName,
      travel_dist_value: parseDistance(
        staffTravelRecord?.travel_distance ?? (isSupervisorRow ? task?.travel_dist : 0)
      ),
      travel_duration_value: parseMinutes(
        staffTravelRecord?.travel_duration ?? (isSupervisorRow ? task?.travel_duration : 0)
      ),
      scheduled_length_value: parseMinutes(task?.scheduled_length_minutes),
      log_length_value: parseMinutes(task?.log_length_minutes),
      pay_length_value: (() => {
        const p = task?.pay_length_minutes;
        if (p != null && p !== '' && Number.isFinite(Number(p))) {
          return Math.max(0, Math.round(Number(p)));
        }
        return Math.min(
          parseMinutes(task?.scheduled_length_minutes),
          parseMinutes(task?.log_length_minutes)
        );
      })(),
    });
  };

  if (task?.staff_id || task?.staff_name) {
    pushRow(task.staff_id || null, task.staff_name || null);
  }

  const memberIds = Array.isArray(task?.task_team_members) ? task.task_team_members : [];
  const memberNames = Array.isArray(task?.task_team_members_name) ? task.task_team_members_name : [];

  memberIds.forEach((memberId, index) => {
    pushRow(memberId, memberNames[index] || null);
  });

  if (!staffRows.length) {
    pushRow(task?.staff_id || null, task?.staff_name || null);
  }

  return staffRows;
}

function buildPdfHtml(groups, appliedFilters) {
  const pages = groups.map((group, index) => {
    const summary = group.summary;
    const detailRows = group.rows.map(row => `
      <tr>
        <td>${escapeHtml(formatDateTime(row.log_start_time))}</td>
        <td>${escapeHtml(formatDateTime(row.log_end_time))}</td>
        <td>${escapeHtml(formatHM(row.log_length_value))}</td>
        <td>${escapeHtml(formatHM(row.scheduled_length_value))}</td>
        <td>00:00</td>
        <td>${escapeHtml(formatHM(row.pay_length_value))}</td>
        <td>${escapeHtml(row.task_name || row.client_name || 'Untitled task')}</td>
        <td>${escapeHtml(formatDistance(row.travel_dist_value))}</td>
        <td>${escapeHtml(formatHM(row.travel_duration_value))}</td>
      </tr>
    `).join('');

    return `
      <section class="page ${index < groups.length - 1 ? 'page-break' : ''}">
        <div class="brand-header">
          <table>
            <tr>
              <td style="width: 180px;">
                <img src="${HOMEMAID_LOGO}" style="height:80px;" />
              </td>
              <td>
                <strong style="font-size:16px;font-weight:1000;">
                  Home Maid Commercial & Residential Cleaning
                </strong>
                <p>7/249 Shellharbour Road, Port Kembla NSW 2505</p>
                <p>Email : admin@homemaid.com.au<br />Website : homemaid.com.au</p>
              </td>
            </tr>
          </table>
        </div>

        <h3>${escapeHtml(group.staffName)}</h3>
        <div class="meta">
          Date range: ${escapeHtml(formatDateTime(appliedFilters?.from, 'DD MMM YYYY'))} to ${escapeHtml(formatDateTime(appliedFilters?.to, 'DD MMM YYYY'))}
        </div>

        <table class="summary-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Count</th>
              <th>Sch Length</th>
              <th>Log</th>
              <th>PayLength</th>
              <th>TrlDist.</th>
              <th>TrlTime</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(group.staffName)}</td>
              <td>${summary.count}</td>
              <td>${escapeHtml(formatHM(summary.scheduledMinutes))}</td>
              <td>${escapeHtml(formatHM(summary.logMinutes))}</td>
              <td>${escapeHtml(formatHM(summary.payMinutes))}</td>
              <td>${escapeHtml(formatDistance(summary.travelDistance))}</td>
              <td>${escapeHtml(formatHM(summary.travelMinutes))}</td>
            </tr>
          </tbody>
        </table>

        <table class="detail-table">
          <thead>
            <tr>
              <th>Log IN</th>
              <th>Log OUT</th>
              <th>Log Length</th>
              <th>Sch Length</th>
              <th>Break</th>
              <th>Pay Length</th>
              <th>Task / Client</th>
              <th>Trl Dist.</th>
              <th>Trl Time</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows}
          </tbody>
        </table>
      </section>
    `;
  }).join('');

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Roster PDF</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 24px;
          }
          .brand-header {
            background: #eaeaea;
            padding: 20px;
            margin-bottom: 18px;
          }
          .brand-header table {
            width: 100%;
            border-collapse: collapse;
          }
          .brand-header td {
            vertical-align: top;
          }
          .meta {
            margin-bottom: 12px;
            color: #475569;
            font-size: 13px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
          }
          th, td {
            border: 1px solid #dbe3ef;
            padding: 8px;
            text-align: left;
            font-size: 12px;
          }
          th {
            background: #e5e7eb;
          }
          .page-break {
            page-break-after: always;
          }
        </style>
      </head>
      <body>
        ${pages}
      </body>
    </html>
  `;
}

export default function GroupByStaff({
  tasks,
  appliedFilters,
  showToast,
  loading,
}) {
  const staffRows = useMemo(() => {
    return tasks
      .flatMap(task => getAssignedStaffRows(task, appliedFilters))
      .sort((firstRow, secondRow) => {
        const nameCompare = firstRow.grouped_staff_name.localeCompare(secondRow.grouped_staff_name);
        if (nameCompare !== 0) {
          return nameCompare;
        }

        const firstStart = firstRow?.start_time ? dayjs(firstRow.start_time).valueOf() : 0;
        const secondStart = secondRow?.start_time ? dayjs(secondRow.start_time).valueOf() : 0;
        return firstStart - secondStart;
      });
  }, [appliedFilters, tasks]);

  const groups = useMemo(() => {
    const groupedMap = new Map();

    staffRows.forEach(row => {
      const key = row.grouped_staff_id || row.grouped_staff_name;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          key,
          staffName: row.grouped_staff_name,
          rows: [],
        });
      }

      groupedMap.get(key).rows.push(row);
    });

    return Array.from(groupedMap.values())
      .map(group => {
        const summary = group.rows.reduce((accumulator, row) => ({
          count: accumulator.count + 1,
          scheduledMinutes: accumulator.scheduledMinutes + row.scheduled_length_value,
          logMinutes: accumulator.logMinutes + row.log_length_value,
          payMinutes: accumulator.payMinutes + row.pay_length_value,
          travelDistance: accumulator.travelDistance + row.travel_dist_value,
          travelMinutes: accumulator.travelMinutes + row.travel_duration_value,
        }), {
          count: 0,
          scheduledMinutes: 0,
          logMinutes: 0,
          payMinutes: 0,
          travelDistance: 0,
          travelMinutes: 0,
        });

        return {
          ...group,
          summary,
        };
      })
      .sort((firstGroup, secondGroup) => firstGroup.staffName.localeCompare(secondGroup.staffName));
  }, [staffRows]);

  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    setOpenGroups(previousOpenGroups => {
      const nextOpenGroups = {};
      groups.forEach((group, index) => {
        nextOpenGroups[group.key] = Object.prototype.hasOwnProperty.call(previousOpenGroups, group.key)
          ? previousOpenGroups[group.key]
          : index === 0;
      });
      return nextOpenGroups;
    });
  }, [groups]);

  function toggleGroup(groupKey) {
    setOpenGroups(previousOpenGroups => ({
      ...previousOpenGroups,
      [groupKey]: !previousOpenGroups[groupKey],
    }));
  }

  function handleExportCsv() {
    if (!staffRows.length) {
      showToast?.('There are no staff rows to export.', '#0f172a');
      return;
    }

    const headers = [
      'Staff',
      'Task',
      'Client',
      'Schedule Start',
      'Schedule End',
      'Log In',
      'Log Out',
      'Log Length',
      'Sch Length',
      'Break',
      'Pay Length',
      'Travel Distance',
      'Travel Time',
    ];

    const lines = staffRows.map(row => [
      row.grouped_staff_name,
      row.task_name || '',
      row.client_name || '',
      row.start_time ? dayjs(row.start_time).format('YYYY-MM-DD HH:mm') : '',
      row.end_time ? dayjs(row.end_time).format('YYYY-MM-DD HH:mm') : '',
      row.log_start_time ? dayjs(row.log_start_time).format('YYYY-MM-DD HH:mm') : '',
      row.log_end_time ? dayjs(row.log_end_time).format('YYYY-MM-DD HH:mm') : '',
      formatHM(row.log_length_value),
      formatHM(row.scheduled_length_value),
      '00:00',
      formatHM(row.pay_length_value),
      formatDistance(row.travel_dist_value),
      formatHM(row.travel_duration_value),
    ].map(escapeCsv).join(','));

    const csvContent = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `schedule-group-by-staff-${appliedFilters?.from || 'from'}-${appliedFilters?.to || 'to'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  function handlePrintPdf() {
    if (!groups.length) {
      showToast?.('There are no staff groups to print.', '#0f172a');
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
    if (!printWindow) {
      showToast?.('Pop-up blocked. Allow pop-ups to print the roster.', '#0f172a');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildPdfHtml(groups, appliedFilters));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
            Group By Staff
          </div>
          <div style={{ fontSize: 14, color: '#475569' }}>
            Range {formatDateTime(appliedFilters?.from, 'DD MMM YYYY')} to {formatDateTime(appliedFilters?.to, 'DD MMM YYYY')}
          </div>
          <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: '#334155' }}>
            Staff : {groups.length} Tasks : {staffRows.length}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={handleExportCsv} style={secondaryButtonStyle}>
            Export CSV
          </button>
          <button type="button" onClick={handlePrintPdf} style={secondaryButtonStyle}>
            Print PDF
          </button>
        </div>
      </div>

      <div
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid #dbe3ef',
          background: '#fff',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#334155' }}>
                <th style={headerCellStyle}></th>
                <th style={headerCellStyle}>Name</th>
                <th style={headerCellStyle}>Count</th>
                <th style={headerCellStyle}>Sch Length</th>
                <th style={headerCellStyle}>Log</th>
                <th style={headerCellStyle}>PayLength</th>
                <th style={headerCellStyle}>TrlDist.</th>
                <th style={headerCellStyle}>TrlTime</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => {
                const open = !!openGroups[group.key];
                return (
                  <React.Fragment key={group.key}>
                    <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={bodyCellStyle}>
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          style={toggleButtonStyle}
                          aria-label={open ? 'Collapse staff section' : 'Expand staff section'}
                        >
                          {open ? '▾' : '▸'}
                        </button>
                      </td>
                      <td style={{ ...bodyCellStyle, fontWeight: 600 }}>{group.staffName}</td>
                      <td style={bodyCellStyle}>{group.summary.count}</td>
                      <td style={bodyCellStyle}>{formatHM(group.summary.scheduledMinutes)}</td>
                      <td style={bodyCellStyle}>{formatHM(group.summary.logMinutes)}</td>
                      <td style={bodyCellStyle}>{formatHM(group.summary.payMinutes)}</td>
                      <td style={bodyCellStyle}>{formatDistance(group.summary.travelDistance)}</td>
                      <td style={bodyCellStyle}>{formatHM(group.summary.travelMinutes)}</td>
                    </tr>

                    {open && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0, background: '#fff' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#e5e7eb', color: '#475569' }}>
                                <th style={detailHeaderCellStyle}>Log IN</th>
                                <th style={detailHeaderCellStyle}>Log OUT</th>
                                <th style={detailHeaderCellStyle}>Log Length</th>
                                <th style={detailHeaderCellStyle}>Sch Length</th>
                                <th style={detailHeaderCellStyle}>Break</th>
                                <th style={detailHeaderCellStyle}>Pay Length</th>
                                <th style={detailHeaderCellStyle}>Task / Client</th>
                                <th style={detailHeaderCellStyle}>Trl Dist.</th>
                                <th style={detailHeaderCellStyle}>Trl Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.rows.map(row => (
                                <tr key={`${group.key}-${row.id}-${row.start_time || ''}`} style={{ borderTop: '1px solid #f1f5f9' }}>
                                  <td style={detailBodyCellStyle}>{formatDateTime(row.log_start_time)}</td>
                                  <td style={detailBodyCellStyle}>{formatDateTime(row.log_end_time)}</td>
                                  <td style={detailBodyCellStyle}>{formatHM(row.log_length_value)}</td>
                                  <td style={detailBodyCellStyle}>{formatHM(row.scheduled_length_value)}</td>
                                  <td style={detailBodyCellStyle}>00:00</td>
                                  <td style={detailBodyCellStyle}>{formatHM(row.pay_length_value)}</td>
                                  <td style={detailBodyCellStyle}>
                                    <div style={{ fontWeight: 500, color: '#1f2937' }}>
                                      {row.task_name || row.client_name || 'Untitled task'}
                                    </div>
                                    {row.client_name && row.task_name && row.client_name !== row.task_name && (
                                      <div style={{ marginTop: 2, color: '#64748b' }}>{row.client_name}</div>
                                    )}
                                  </td>
                                  <td style={detailBodyCellStyle}>{formatDistance(row.travel_dist_value)}</td>
                                  <td style={detailBodyCellStyle}>{formatHM(row.travel_duration_value)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {!groups.length && (
                <tr>
                  <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>
                    {loading ? 'Loading staff report...' : 'No staff rows found for the selected filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const headerCellStyle = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: 13,
  fontWeight: 700,
  color: '#475569',
};

const bodyCellStyle = {
  padding: '12px 14px',
  verticalAlign: 'top',
  color: '#334155',
  fontSize: 14,
};

const detailHeaderCellStyle = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 700,
  fontStyle: 'italic',
  color: '#475569',
};

const detailBodyCellStyle = {
  padding: '10px 12px',
  verticalAlign: 'top',
  color: '#334155',
  fontSize: 13,
};

const secondaryButtonStyle = {
  minHeight: 40,
  padding: '0 14px',
  borderRadius: 8,
  border: '1px solid #86efac',
  background: '#f0fdf4',
  color: '#16a34a',
  fontWeight: 600,
  cursor: 'pointer',
};

const toggleButtonStyle = {
  border: 'none',
  background: 'transparent',
  color: '#475569',
  fontSize: 18,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0,
};
