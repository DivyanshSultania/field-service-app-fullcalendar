import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Modal from '../components/Modal';
import { authFetch, formatHM } from './utils';
import { calculateTaskTravelData, getAssignedStaffIds } from '../utils/taskTravel';

const VITE_KEY = import.meta.env.VITE_API_URL;
const HOMEMAID_LOGO = 'https://pub-ac8edfc52ef04beba837f1804a4abf42.r2.dev/public/homemaid_logo.png';

function isCoverTask(task) {
  return task?.assignment_type === 'cover' || task?.staff_id === 'STATIC-COVER-STAFF';
}

function isSupervisorRole(staff) {
  return String(staff?.role || '').toLowerCase() === 'supervisor';
}

function getTaskStatusMeta(task) {
  if (isCoverTask(task)) {
    return {
      label: 'Cancelled',
      color: '#dc2626',
      background: '#fee2e2',
    };
  }

  if (task?.started_at && task?.stopped_at) {
    return {
      label: 'Completed',
      color: '#16a34a',
      background: '#dcfce7',
    };
  }

  if (task?.started_at && !task?.stopped_at) {
    return {
      label: 'In Progress',
      color: '#f59e0b',
      background: '#fef3c7',
    };
  }

  if (task?.publish) {
    return {
      label: 'Accepted',
      color: '#7c3aed',
      background: '#ede9fe',
    };
  }

  return {
    label: 'Scheduled',
    color: '#2563eb',
    background: '#dbeafe',
  };
}

function formatDateTime(value, pattern = 'DD MMM HH:mm') {
  if (!value) return '-';
  return dayjs(value).format(pattern);
}

function buildStaffLabel(task) {
  const names = [];

  if (task?.staff_name) {
    names.push(task.staff_name);
  }

  (task?.task_team_members_name || []).forEach(name => {
    if (name && !names.includes(name)) {
      names.push(name);
    }
  });

  if (names.length === 0 && isCoverTask(task)) {
    return 'Cover';
  }

  return names.length ? names.join(', ') : '-';
}

function buildShiftTitle(task) {
  return task?.task_name || task?.client_name || 'Untitled task';
}

function buildShiftSubtitle(task) {
  return [
    task?.task_name && task?.client_name && task.task_name !== task.client_name
      ? task.client_name
      : null,
    task?.location_title || null,
  ]
    .filter(Boolean)
    .join(' | ');
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

function buildPrintHtml(tasks, appliedFilters) {
  const rows = tasks.map((task, index) => {
    const status = getTaskStatusMeta(task);
    const scheduledLength = formatHM(task?.scheduled_length_minutes || 0);
    const loggedLength = formatHM(task?.log_length_minutes || 0);
    const logValue = task?.log_start_time
      ? `${formatDateTime(task.log_start_time)}${task?.log_end_time ? ` - ${formatDateTime(task.log_end_time, 'HH:mm')}` : ''}`
      : '...';

    return `
      <tr>
        <td>
          <div style="font-weight:700;">${index + 1}</div>
          <span style="display:inline-block;margin-top:6px;padding:4px 8px;border-radius:999px;background:${status.background};color:${status.color};font-size:11px;font-weight:700;text-transform:uppercase;">
            ${escapeHtml(status.label)}
          </span>
        </td>
        <td>
          <div style="font-weight:600;">${escapeHtml(buildShiftTitle(task))}</div>
          ${buildShiftSubtitle(task) ? `<div style="margin-top:4px;color:#64748b;font-size:12px;">${escapeHtml(buildShiftSubtitle(task))}</div>` : ''}
        </td>
        <td>${escapeHtml(buildStaffLabel(task))}</td>
        <td>${escapeHtml(formatDateTime(task?.start_time))}</td>
        <td>00:00</td>
        <td>${escapeHtml(logValue)}</td>
        <td>${escapeHtml(`${scheduledLength} / ${loggedLength}`)}</td>
      </tr>
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
          #header {
            background: #eaeaea;
            padding: 20px;
            margin-bottom: 20px;
          }
          #header table {
            width: 100%;
            border-collapse: collapse;
          }
          #header td {
            vertical-align: top;
          }
          h3 {
            margin: 0 0 12px 0;
          }
          .meta {
            margin-bottom: 16px;
            color: #475569;
            font-size: 13px;
          }
          table.report {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          table.report th,
          table.report td {
            border: 1px solid #dbe3ef;
            padding: 10px 8px;
            text-align: left;
          }
          table.report th {
            background: #f1f5f9;
          }
          @media print {
            body {
              padding: 16px;
            }
          }
        </style>
      </head>
      <body>
        <div id="header">
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

        <h3>Roster</h3>
        <div class="meta">
          Date range: ${escapeHtml(formatDateTime(appliedFilters?.from, 'DD MMM YYYY'))} to ${escapeHtml(formatDateTime(appliedFilters?.to, 'DD MMM YYYY'))}
        </div>

        <table class="report">
          <thead>
            <tr>
              <th>Status</th>
              <th>Shift</th>
              <th>Staff</th>
              <th>Sch</th>
              <th>Break</th>
              <th>Log</th>
              <th>Sch / Log Length</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

async function getResponseError(response, fallbackMessage) {
  try {
    const data = await response.json();
    return data?.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

async function readJsonOrFallback(response, fallback) {
  try {
    return await response.json();
  } catch {
    return fallback;
  }
}

export default function IndividualView({
  tasks,
  staffs,
  teams,
  locations,
  teamMembers,
  appliedFilters,
  onTasksUpdated,
  onOpenTask,
  showToast,
  loading,
}) {
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkTeamModalOpen, setBulkTeamModalOpen] = useState(false);
  const [bulkIndividualModalOpen, setBulkIndividualModalOpen] = useState(false);
  const [bulkSelectedTeam, setBulkSelectedTeam] = useState(null);
  const [bulkTeamSupervisorId, setBulkTeamSupervisorId] = useState('');
  const [bulkTeamMembers, setBulkTeamMembers] = useState([]);
  const [bulkIndividualSupervisorId, setBulkIndividualSupervisorId] = useState('');
  const [bulkIndividualCleaners, setBulkIndividualCleaners] = useState([]);
  const selectAllRef = useRef(null);

  useEffect(() => {
    setSelectedTaskIds(previousIds => previousIds.filter(id => tasks.some(task => task.id === id)));
  }, [tasks]);

  const cancelledCount = tasks.filter(task => isCoverTask(task)).length;
  const scheduledCount = tasks.length - cancelledCount;
  const allSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;
  const hasSelection = selectedTaskIds.length > 0;

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }

    selectAllRef.current.indeterminate = hasSelection && !allSelected;
  }, [allSelected, hasSelection]);

  const teamMembersByTeam = useMemo(() => {
    return teamMembers.reduce((map, member) => {
      if (!map[member.team_id]) {
        map[member.team_id] = [];
      }
      map[member.team_id].push(member.staff_id);
      return map;
    }, {});
  }, [teamMembers]);

  function getSampleSelectedTask() {
    return tasks.find(task => selectedTaskIds.includes(task.id)) || tasks[0] || null;
  }

  function getStaffName(staffId) {
    return staffs.find(staff => staff.id === staffId)?.name || '';
  }

  function getCleanerNames(memberIds) {
    return (memberIds || [])
      .map(memberId => getStaffName(memberId))
      .filter(Boolean);
  }

  function buildTaskTeamMemberNames(memberIds) {
    return getCleanerNames(memberIds);
  }

  function replaceTaskInList(taskList, nextTask) {
    return taskList.map(task => (
      task.id === nextTask.id
        ? { ...task, ...nextTask }
        : task
    ));
  }

  function getTaskDayKey(task) {
    return task?.start_time ? dayjs(task.start_time).format('YYYY-MM-DD') : '';
  }

  function tasksShareAssignedStaff(firstTask, secondTask) {
    const firstIds = new Set([
      firstTask?.staff_id,
      ...(Array.isArray(firstTask?.task_team_members) ? firstTask.task_team_members : []),
    ].filter(Boolean));
    const secondIds = new Set([
      secondTask?.staff_id,
      ...(Array.isArray(secondTask?.task_team_members) ? secondTask.task_team_members : []),
    ].filter(Boolean));

    for (const staffId of firstIds) {
      if (secondIds.has(staffId)) {
        return true;
      }
    }

    return false;
  }

  async function persistTaskStaffTravel(taskId, staffTravelRecords) {
    if (!taskId) {
      return [];
    }

    const response = await authFetch(`${VITE_KEY}/api/task_staff_travel/task/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Array.isArray(staffTravelRecords) ? staffTravelRecords : []),
    });

    if (!response.ok) {
      throw new Error(await getResponseError(response, 'Failed to update staff travel'));
    }

    return readJsonOrFallback(response, []);
  }

  async function syncTaskTravelDetails(task, taskListOverride) {
    const assignedStaffIds = isCoverTask(task) ? [] : getAssignedStaffIds(task);
    let supervisorTravel = null;
    let staffTravelRecords = [];

    if (task?.start_time && task?.location_id && assignedStaffIds.length > 0) {
      const calculatedTravel = await calculateTaskTravelData({
        task,
        tasks: taskListOverride,
        locations,
      });
      supervisorTravel = calculatedTravel.supervisorTravel;
      staffTravelRecords = calculatedTravel.staffTravelRecords;
    }

    const travelPatch = {
      travel_from: supervisorTravel?.travel_from ?? null,
      travel_dist: supervisorTravel?.travel_dist ?? null,
      travel_duration: supervisorTravel?.travel_duration ?? null,
    };

    const updatedTask = await updateTask(task.id, travelPatch);
    await persistTaskStaffTravel(task.id, staffTravelRecords);

    return {
      ...task,
      ...updatedTask,
      ...travelPatch,
      task_team_members: Array.isArray(task?.task_team_members) ? task.task_team_members : [],
      task_team_members_name: Array.isArray(task?.task_team_members_name) ? task.task_team_members_name : [],
      task_staff_travel: staffTravelRecords,
    };
  }

  function getBulkIndividualSummary() {
    const supervisorName = getStaffName(bulkIndividualSupervisorId);
    const cleanerNames = getCleanerNames(bulkIndividualCleaners);
    return [supervisorName, cleanerNames.join(', ')].filter(Boolean).join(' | ');
  }

  function getBulkTeamSummary() {
    const teamName = bulkSelectedTeam?.name || '';
    const supervisorName = getStaffName(bulkTeamSupervisorId);
    const cleanerNames = getCleanerNames(bulkTeamMembers);
    return [teamName, supervisorName, cleanerNames.join(', ')].filter(Boolean).join(' | ');
  }

  function openBulkTeamModal() {
    const sampleTask = getSampleSelectedTask();

    if (sampleTask?.team_id && !bulkSelectedTeam) {
      const sampleTeam = teams.find(team => team.id === sampleTask.team_id) || null;
      setBulkSelectedTeam(sampleTeam);
      setBulkTeamSupervisorId(sampleTask.staff_id || sampleTeam?.supervisor_id || '');
      setBulkTeamMembers(
        Array.isArray(sampleTask.task_team_members) && sampleTask.task_team_members.length
          ? sampleTask.task_team_members
          : (sampleTeam ? (teamMembersByTeam[sampleTeam.id] || []) : [])
      );
    } else if (!bulkSelectedTeam && teams.length > 0) {
      setBulkSelectedTeam(teams[0]);
      setBulkTeamSupervisorId(teams[0].supervisor_id || '');
      setBulkTeamMembers(teamMembersByTeam[teams[0].id] || []);
    }

    setBulkTeamModalOpen(true);
  }

  function closeBulkTeamModal() {
    setBulkTeamModalOpen(false);
  }

  function openBulkIndividualModal() {
    const sampleTask = getSampleSelectedTask();

    if (sampleTask && !bulkIndividualSupervisorId && bulkIndividualCleaners.length === 0) {
      setBulkIndividualSupervisorId(sampleTask.staff_id || '');
      setBulkIndividualCleaners(
        Array.isArray(sampleTask.task_team_members) ? sampleTask.task_team_members : []
      );
    }

    setBulkIndividualModalOpen(true);
  }

  function closeBulkIndividualModal() {
    setBulkIndividualModalOpen(false);
  }

  function toggleBulkTeamMember(memberId) {
    setBulkTeamMembers(previousMembers => (
      previousMembers.includes(memberId)
        ? previousMembers.filter(id => id !== memberId)
        : [...previousMembers, memberId]
    ));
  }

  function toggleBulkIndividualCleaner(memberId) {
    setBulkIndividualCleaners(previousMembers => (
      previousMembers.includes(memberId)
        ? previousMembers.filter(id => id !== memberId)
        : [...previousMembers, memberId]
    ));
  }

  function toggleTaskSelection(taskId) {
    setSelectedTaskIds(previousIds => (
      previousIds.includes(taskId)
        ? previousIds.filter(id => id !== taskId)
        : [...previousIds, taskId]
    ));
  }

  function handleSelectAll(event) {
    if (event.target.checked) {
      setSelectedTaskIds(tasks.map(task => task.id));
      return;
    }

    setSelectedTaskIds([]);
  }

  function handleBulkActionChange(event) {
    const nextAction = event.target.value;
    setBulkAction(nextAction);
    setBulkValue('');

    if (nextAction === 'individual') {
      openBulkIndividualModal();
    }

    if (nextAction === 'team') {
      openBulkTeamModal();
    }
  }

  function getBulkActionControl() {
    if (bulkAction === 'individual') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={openBulkIndividualModal} style={secondaryButtonStyle}>
            Manage Staff
          </button>
          {getBulkIndividualSummary() && (
            <span style={assignmentSummaryStyle}>{getBulkIndividualSummary()}</span>
          )}
        </div>
      );
    }

    if (bulkAction === 'team') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={openBulkTeamModal} style={secondaryButtonStyle}>
            Select Team
          </button>
          {getBulkTeamSummary() && (
            <span style={assignmentSummaryStyle}>{getBulkTeamSummary()}</span>
          )}
        </div>
      );
    }

    if (bulkAction === 'start_time') {
      return (
        <input
          type="time"
          value={bulkValue}
          onChange={event => setBulkValue(event.target.value)}
          style={controlStyle}
        />
      );
    }

    if (bulkAction === 'duration') {
      return (
        <input
          type="number"
          min="10"
          step="5"
          value={bulkValue}
          onChange={event => setBulkValue(event.target.value)}
          style={controlStyle}
          placeholder="Minutes"
        />
      );
    }

    if (bulkAction === 'location') {
      return (
        <select
          value={bulkValue}
          onChange={event => setBulkValue(event.target.value)}
          style={controlStyle}
        >
          <option value="">Select location</option>
          {locations.map(location => (
            <option key={location.id} value={location.id}>
              {location.title || location.address || 'Untitled location'}
            </option>
          ))}
        </select>
      );
    }

    if (bulkAction === 'drop') {
      return (
        <div style={{ color: '#475569', fontSize: 13 }}>
          Selected tasks will be assigned to Cover.
        </div>
      );
    }

    return null;
  }

  async function updateTask(taskId, payload) {
    const response = await authFetch(`${VITE_KEY}/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await getResponseError(response, 'Failed to update task'));
    }

    return readJsonOrFallback(response, {});
  }

  async function assignTaskToCover(taskId) {
    const response = await authFetch(`${VITE_KEY}/api/tasks/${taskId}/assign-to-cover`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(await getResponseError(response, 'Failed to assign task to cover'));
    }
  }

  async function handleApplyBulkChange() {
    if (!selectedTaskIds.length) {
      showToast('Select at least one task first.', '#0f172a');
      return;
    }

    if (!bulkAction) {
      showToast('Select a bulk change first.', '#0f172a');
      return;
    }

    if (bulkAction === 'individual' && !bulkIndividualSupervisorId && bulkIndividualCleaners.length === 0) {
      showToast('Select staff in the Individual modal.', '#0f172a');
      return;
    }

    if (bulkAction === 'team' && !bulkSelectedTeam?.id) {
      showToast('Select a team in the Team modal.', '#0f172a');
      return;
    }

    if (!['drop', 'individual', 'team'].includes(bulkAction) && !bulkValue) {
      showToast('Select a value for the bulk change.', '#0f172a');
      return;
    }

    const selectedTasks = tasks
      .filter(task => selectedTaskIds.includes(task.id))
      .sort((firstTask, secondTask) => {
        const firstStart = firstTask?.start_time ? dayjs(firstTask.start_time).valueOf() : 0;
        const secondStart = secondTask?.start_time ? dayjs(secondTask.start_time).valueOf() : 0;
        return firstStart - secondStart;
      });

    setBulkLoading(true);
    try {
      let workingTasks = tasks.map(task => ({ ...task }));
      const travelImpactTasks = [];

      for (const task of selectedTasks) {
        travelImpactTasks.push(task);

        if (bulkAction === 'drop') {
          await assignTaskToCover(task.id);
          const coveredTask = {
            ...task,
            assignment_type: 'cover',
            staff_id: 'STATIC-COVER-STAFF',
            team_id: null,
            task_team_members: [],
            task_team_members_name: [],
            travel_from: null,
            travel_dist: null,
            travel_duration: null,
            task_staff_travel: [],
          };
          workingTasks = replaceTaskInList(workingTasks, coveredTask);
          travelImpactTasks.push(coveredTask);
          continue;
        }

        let patch = null;

        if (bulkAction === 'individual') {
          patch = {
            assignment_type: 'individual',
            staff_id: bulkIndividualSupervisorId || null,
            team_id: null,
            task_team_members: bulkIndividualCleaners,
          };
        }

        if (bulkAction === 'team') {
          patch = {
            assignment_type: 'team',
            staff_id: bulkTeamSupervisorId || bulkSelectedTeam?.supervisor_id || null,
            team_id: bulkSelectedTeam?.id || null,
            task_team_members: bulkTeamMembers,
          };
        }

        if (bulkAction === 'start_time') {
          const duration = task?.scheduled_length_minutes || 60;
          const nextStart = dayjs(task.start_time)
            .hour(Number(bulkValue.split(':')[0] || 0))
            .minute(Number(bulkValue.split(':')[1] || 0))
            .second(0)
            .millisecond(0);

          patch = {
            start_time: nextStart.toISOString(),
            end_time: nextStart.add(duration, 'minute').toISOString(),
          };
        }

        if (bulkAction === 'duration') {
          const minutes = Math.max(10, Number(bulkValue) || 0);
          patch = {
            end_time: dayjs(task.start_time).add(minutes, 'minute').toISOString(),
          };
        }

        if (bulkAction === 'location') {
          patch = {
            location_id: bulkValue,
          };
        }

        if (!patch) {
          continue;
        }

        const updatedTask = await updateTask(task.id, patch);
        const nextTask = {
          ...task,
          ...updatedTask,
          ...(Object.prototype.hasOwnProperty.call(patch, 'assignment_type') ? { assignment_type: patch.assignment_type } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, 'staff_id') ? { staff_id: patch.staff_id } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, 'team_id') ? { team_id: patch.team_id } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, 'location_id') ? { location_id: patch.location_id } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, 'start_time') ? { start_time: patch.start_time } : {}),
          ...(Object.prototype.hasOwnProperty.call(patch, 'end_time') ? { end_time: patch.end_time } : {}),
          task_team_members: Object.prototype.hasOwnProperty.call(patch, 'task_team_members')
            ? (patch.task_team_members || [])
            : (Array.isArray(task?.task_team_members) ? task.task_team_members : []),
          task_team_members_name: Object.prototype.hasOwnProperty.call(patch, 'task_team_members')
            ? buildTaskTeamMemberNames(patch.task_team_members || [])
            : (Array.isArray(task?.task_team_members_name) ? task.task_team_members_name : []),
        };

        workingTasks = replaceTaskInList(workingTasks, nextTask);
        travelImpactTasks.push(nextTask);
      }

      const affectedTasks = workingTasks
        .filter(candidate => travelImpactTasks.some(impactTask => {
          if (!impactTask?.id || !candidate?.id) {
            return false;
          }

          if (candidate.id === impactTask.id) {
            return true;
          }

          if (getTaskDayKey(candidate) !== getTaskDayKey(impactTask)) {
            return false;
          }

          return tasksShareAssignedStaff(candidate, impactTask);
        }))
        .sort((firstTask, secondTask) => {
          const firstStart = firstTask?.start_time ? dayjs(firstTask.start_time).valueOf() : 0;
          const secondStart = secondTask?.start_time ? dayjs(secondTask.start_time).valueOf() : 0;
          return firstStart - secondStart;
        });

      for (const task of affectedTasks) {
        const syncedTask = await syncTaskTravelDetails(task, workingTasks);
        workingTasks = replaceTaskInList(workingTasks, syncedTask);
      }

      setSelectedTaskIds([]);
      showToast('Bulk change applied.', '#16a34a');
      await onTasksUpdated?.();
    } catch (error) {
      console.error('Bulk update failed', error);
      showToast(error.message || 'Bulk update failed');
    } finally {
      setBulkLoading(false);
    }
  }

  function handleExportCsv() {
    if (!tasks.length) {
      showToast('There are no tasks to export.', '#0f172a');
      return;
    }

    const headers = [
      'Status',
      'Task',
      'Client',
      'Staff',
      'Schedule Start',
      'Schedule End',
      'Duration',
      'Location',
      'Log Start',
      'Log End',
    ];

    const lines = tasks.map(task => {
      const status = getTaskStatusMeta(task);
      return [
        status.label,
        buildShiftTitle(task),
        task?.client_name || '',
        buildStaffLabel(task),
        task?.start_time ? dayjs(task.start_time).format('YYYY-MM-DD HH:mm') : '',
        task?.end_time ? dayjs(task.end_time).format('YYYY-MM-DD HH:mm') : '',
        formatHM(task?.scheduled_length_minutes || 0),
        task?.location_title || '',
        task?.log_start_time ? dayjs(task.log_start_time).format('YYYY-MM-DD HH:mm') : '',
        task?.log_end_time ? dayjs(task.log_end_time).format('YYYY-MM-DD HH:mm') : '',
      ].map(escapeCsv).join(',');
    });

    const csvContent = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `schedule-${appliedFilters?.from || 'from'}-${appliedFilters?.to || 'to'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  function handlePrintPdf() {
    if (!tasks.length) {
      showToast('There are no tasks to print.', '#0f172a');
      return;
    }

    const printWindow = window.open('PDF', '_blank', 'width=1200,height=900');
    debugger;
    if (!printWindow) {
      debugger;
      showToast('Pop-up blocked. Allow pop-ups to print the roster.', '#0f172a');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildPrintHtml(tasks, appliedFilters));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  async function handleOpenTask(taskId) {
    if (!onOpenTask) {
      showToast('Open task is unavailable from this view.', '#0f172a');
      return;
    }

    onOpenTask(taskId);
  }

  function BulkTeamSelectionModal() {
    return (
      <Modal open={bulkTeamModalOpen} title="Select Team" onClose={closeBulkTeamModal}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 340 }}>
          <div>
            <strong>Teams</strong>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {teams.map(team => (
                <label key={team.id} style={selectionRowStyle}>
                  <input
                    type="radio"
                    checked={bulkSelectedTeam?.id === team.id}
                    onChange={() => {
                      setBulkSelectedTeam(team);
                      setBulkTeamSupervisorId(team.supervisor_id || '');
                      setBulkTeamMembers(teamMembersByTeam[team.id] || []);
                    }}
                  />
                  {team.name}
                </label>
              ))}
              {!teams.length && (
                <div style={emptyStateStyle}>No teams available.</div>
              )}
            </div>
          </div>

          <div>
            <strong>Supervisors</strong>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {staffs.filter(isSupervisorRole).map(staff => (
                <label key={staff.id} style={selectionRowStyle}>
                  <input
                    type="radio"
                    checked={staff.id === bulkTeamSupervisorId}
                    onChange={() => setBulkTeamSupervisorId(staff.id)}
                  />
                  {staff.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <strong>Staff</strong>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
              {staffs.map(staff => (
                <label key={staff.id} style={selectionRowStyle}>
                  <input
                    type="checkbox"
                    checked={bulkTeamMembers.includes(staff.id)}
                    onChange={() => toggleBulkTeamMember(staff.id)}
                  />
                  {staff.name}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={closeBulkTeamModal} style={plainButtonStyle}>Cancel</button>
            <button type="button" onClick={closeBulkTeamModal} style={primaryButtonStyle}>Select Team</button>
          </div>
        </div>
      </Modal>
    );
  }

  function BulkIndividualSelectionModal() {
    return (
      <Modal open={bulkIndividualModalOpen} title="Manage Staff Assignment" onClose={closeBulkIndividualModal}>
        <div style={{ minWidth: 400, padding: 10 }}>
          <div>
            <strong>Supervisors</strong>
            <div style={{ marginTop: 8, marginBottom: 12 }}>
              <select
                value={bulkIndividualSupervisorId || ''}
                onChange={event => setBulkIndividualSupervisorId(event.target.value)}
                style={{ ...controlStyle, width: '100%' }}
              >
                <option value="">Select Supervisor</option>
                {staffs.filter(isSupervisorRole).map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <strong>Cleaners</strong>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
              {staffs.map(staff => (
                <label key={staff.id} style={selectionRowStyle}>
                  <input
                    type="checkbox"
                    checked={bulkIndividualCleaners.includes(staff.id)}
                    onChange={() => toggleBulkIndividualCleaner(staff.id)}
                  />
                  {staff.name}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={closeBulkIndividualModal} style={plainButtonStyle}>Cancel</button>
            <button type="button" onClick={closeBulkIndividualModal} style={primaryButtonStyle}>Save</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
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
              Schedule
            </div>
            <div style={{ fontSize: 14, color: '#475569' }}>
              Range {formatDateTime(appliedFilters?.from, 'DD MMM YYYY')} to {formatDateTime(appliedFilters?.to, 'DD MMM YYYY')}
            </div>
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: '#334155' }}>
              Cancelled : {cancelledCount} Schedule : {scheduledCount} Total : {tasks.length}
              {hasSelection ? ` Selected : ${selectedTaskIds.length}` : ''}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>Change Roster:</label>
            <select
              value={bulkAction}
              onChange={handleBulkActionChange}
              style={{ ...controlStyle, minWidth: 220 }}
              disabled={loading || bulkLoading}
            >
              <option value="">Select For Change</option>
              <option value="individual">Individual</option>
              <option value="team">Team</option>
              <option value="start_time">Start Time</option>
              <option value="duration">Duration</option>
              <option value="location">Location</option>
              <option value="drop">Drop</option>
            </select>
            {getBulkActionControl()}
            <button
              type="button"
              onClick={handleApplyBulkChange}
              disabled={loading || bulkLoading || !hasSelection || !bulkAction}
              style={secondaryButtonStyle}
            >
              {bulkLoading ? 'Applying...' : 'Apply'}
            </button>
            <button type="button" onClick={handlePrintPdf} style={secondaryButtonStyle}>
              Print PDF
            </button>
            <button type="button" onClick={handleExportCsv} style={secondaryButtonStyle}>
              Export CSV
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
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr style={{ background: '#e5e7eb', color: '#334155' }}>
                  <th style={headerCellStyle}>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleSelectAll}
                      disabled={!tasks.length}
                    />
                  </th>
                  <th style={headerCellStyle}>Shift</th>
                  <th style={headerCellStyle}>Staff</th>
                  <th style={headerCellStyle}>Sch</th>
                  <th style={headerCellStyle}>Break</th>
                  <th style={headerCellStyle}>Log</th>
                  <th style={headerCellStyle}>Sch / Log Length</th>
                  <th style={headerCellStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, index) => {
                  const status = getTaskStatusMeta(task);
                  const subtitle = buildShiftSubtitle(task);
                  const scheduledLength = formatHM(task?.scheduled_length_minutes || 0);
                  const loggedLength = formatHM(task?.log_length_minutes || 0);
                  const logValue = task?.log_start_time
                    ? `${formatDateTime(task.log_start_time)}${task?.log_end_time ? ` - ${formatDateTime(task.log_end_time, 'HH:mm')}` : ''}`
                    : '...';

                  return (
                    <tr
                      key={task.id}
                      style={{
                        borderTop: '1px solid #e5e7eb',
                        borderLeft: `4px solid ${status.color}`,
                        background: selectedTaskIds.includes(task.id) ? '#f8fafc' : '#fff',
                      }}
                    >
                      <td style={bodyCellStyle}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.includes(task.id)}
                            onChange={() => toggleTaskSelection(task.id)}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: '#111827' }}>{index + 1}</div>
                            <span
                              style={{
                                display: 'inline-flex',
                                marginTop: 6,
                                padding: '4px 8px',
                                borderRadius: 999,
                                background: status.background,
                                color: status.color,
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                              }}
                            >
                              {status.label}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={bodyCellStyle}>
                        <div style={{ fontWeight: 600, color: '#1f2937' }}>{buildShiftTitle(task)}</div>
                        {subtitle && (
                          <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
                            {subtitle}
                          </div>
                        )}
                      </td>
                      <td style={bodyCellStyle}>{buildStaffLabel(task)}</td>
                      <td style={bodyCellStyle}>{formatDateTime(task?.start_time)}</td>
                      <td style={bodyCellStyle}>00:00</td>
                      <td style={bodyCellStyle}>{logValue}</td>
                      <td style={bodyCellStyle}>{scheduledLength} / {loggedLength}</td>
                      <td style={bodyCellStyle}>
                        <button
                          type="button"
                          onClick={() => handleOpenTask(task.id)}
                          style={actionButtonStyle}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!tasks.length && (
                  <tr>
                    <td colSpan={8} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>
                      {loading ? 'Loading tasks...' : 'No tasks found for the selected filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <BulkTeamSelectionModal />
      <BulkIndividualSelectionModal />
    </>
  );
}

const headerCellStyle = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: 13,
  fontWeight: 700,
  fontStyle: 'italic',
  color: '#475569',
};

const bodyCellStyle = {
  padding: '12px 14px',
  verticalAlign: 'top',
  color: '#334155',
  fontSize: 14,
};

const controlStyle = {
  minHeight: 40,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
};

const assignmentSummaryStyle = {
  maxWidth: 320,
  fontSize: 13,
  color: '#475569',
  lineHeight: 1.4,
};

const selectionRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const emptyStateStyle = {
  color: '#64748b',
  fontSize: 13,
};

const plainButtonStyle = {
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#334155',
  fontWeight: 600,
  cursor: 'pointer',
};

const primaryButtonStyle = {
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 8,
  border: '1px solid #4f46e5',
  background: '#4f46e5',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
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

const actionButtonStyle = {
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid #fdba74',
  background: '#ffedd5',
  color: '#c2410c',
  fontWeight: 600,
  cursor: 'pointer',
};
