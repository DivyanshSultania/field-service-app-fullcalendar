import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import ScheduleFilters from './ScheduleFilters';
import IndividualView from './IndividualView';
import GroupByStaff from './GroupByStaff';
import GroupByClient from './GroupByClient';
import { authFetch } from './utils';
import { attachTaskStaffTravelToTasks } from '../utils/taskTravel';

const VITE_KEY = import.meta.env.VITE_API_URL;

function getDefaultScheduleRange() {
  const today = dayjs().startOf('day');
  const upcomingSunday = today.day() === 0
    ? today
    : today.add(7 - today.day(), 'day');
  const nextWeekendEnd = upcomingSunday.add(7, 'day');

  return {
    from: today.format('YYYY-MM-DD'),
    to: nextWeekendEnd.format('YYYY-MM-DD'),
  };
}

function getEffectiveFilters(sourceFilters, defaultRange) {
  return {
    ...sourceFilters,
    from: sourceFilters?.from || defaultRange.from,
    to: sourceFilters?.to || defaultRange.to,
  };
}

function normalizeTask(task) {
  const scheduledMinutes = task?.start_time && task?.end_time
    ? Math.max(0, dayjs(task.end_time).diff(dayjs(task.start_time), 'minute'))
    : 0;
  const loggedMinutes = task?.started_at && task?.stopped_at
    ? Math.max(0, dayjs(task.stopped_at).diff(dayjs(task.started_at), 'minute'))
    : 0;

  const computedPay = Math.min(scheduledMinutes, loggedMinutes);
  const storedPay = task?.pay_length_minutes;
  const payMinutes = (storedPay != null && storedPay !== '' && Number.isFinite(Number(storedPay)))
    ? Math.max(0, Math.round(Number(storedPay)))
    : computedPay;

  return {
    ...task,
    log_start_time: task?.started_at || null,
    log_end_time: task?.stopped_at || null,
    scheduled_length_minutes: scheduledMinutes,
    log_length_minutes: loggedMinutes,
    pay_length_minutes: payMinutes,
    task_team_members: Array.isArray(task?.task_team_members) ? task.task_team_members : [],
    task_team_members_name: Array.isArray(task?.task_team_members_name) ? task.task_team_members_name : [],
    task_staff_travel: Array.isArray(task?.task_staff_travel) ? task.task_staff_travel : [],
  };
}

function taskMatchesFilters(task, filters) {
  if (filters.staffId) {
    const memberIds = Array.isArray(task?.task_team_members) ? task.task_team_members : [];
    const matchesStaff = task?.staff_id === filters.staffId || memberIds.includes(filters.staffId);
    if (!matchesStaff) {
      return false;
    }
  }

  if (filters.clientId && task?.client_id !== filters.clientId) {
    return false;
  }

  return true;
}

function showToast(message, backgroundColor = '#dc2626') {
  if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
    window.showToast(message, backgroundColor);
    return;
  }

  const toast = document.createElement('div');
  toast.innerText = message || 'Unexpected error';
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.background = backgroundColor;
  toast.style.color = '#fff';
  toast.style.padding = '10px 18px';
  toast.style.borderRadius = '6px';
  toast.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
  toast.style.zIndex = '999999';
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4000);
}

async function readJsonOrFallback(response, fallback) {
  try {
    return await response.json();
  } catch {
    return fallback;
  }
}

export default function Schedule({ onOpenTask }) {
  const [defaultRange] = useState(() => getDefaultScheduleRange());
  const [filters, setFilters] = useState(() => ({
    from: defaultRange.from,
    to: defaultRange.to,
    staffId: '',
    clientId: '',
    viewType: 'individual',
  }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    from: defaultRange.from,
    to: defaultRange.to,
    staffId: '',
    clientId: '',
    viewType: 'individual',
  }));
  const [tasks, setTasks] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [clients, setClients] = useState([]);
  const [teams, setTeams] = useState([]);
  const [locations, setLocations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadLookups() {
      try {
        const [
          staffRes,
          clientsRes,
          teamsRes,
          locationsRes,
          teamMembersRes,
        ] = await Promise.all([
          authFetch(`${VITE_KEY}/api/staff`),
          authFetch(`${VITE_KEY}/api/clients`),
          authFetch(`${VITE_KEY}/api/teams`),
          authFetch(`${VITE_KEY}/api/locations`),
          authFetch(`${VITE_KEY}/api/team_members`),
        ]);

        const [
          nextStaffs,
          nextClients,
          nextTeams,
          nextLocations,
          nextTeamMembers,
        ] = await Promise.all([
          readJsonOrFallback(staffRes, []),
          readJsonOrFallback(clientsRes, []),
          readJsonOrFallback(teamsRes, []),
          readJsonOrFallback(locationsRes, []),
          readJsonOrFallback(teamMembersRes, []),
        ]);

        if (cancelled) return;

        setStaffs(Array.isArray(nextStaffs) ? nextStaffs : []);
        setClients(Array.isArray(nextClients) ? nextClients : []);
        setTeams(Array.isArray(nextTeams) ? nextTeams : []);
        setLocations(Array.isArray(nextLocations) ? nextLocations : []);
        setTeamMembers(Array.isArray(nextTeamMembers) ? nextTeamMembers : []);
      } catch (error) {
        console.error('Failed to load schedule lookups', error);
      }
    }

    loadLookups();

    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchSchedule(nextFilters = filters) {
    const effectiveFilters = getEffectiveFilters(nextFilters, defaultRange);

    setFilters(prev => ({
      ...prev,
      from: effectiveFilters.from,
      to: effectiveFilters.to,
    }));
    setLoading(true);

    try {
      const params = new URLSearchParams({
        from: effectiveFilters.from,
        to: dayjs(effectiveFilters.to).add(1, 'day').format('YYYY-MM-DD'),
      });
      const response = await authFetch(`${VITE_KEY}/api/tasks?${params.toString()}`);

      if (!response.ok) {
        const errorBody = await readJsonOrFallback(response, {});
        throw new Error(errorBody?.error || 'Failed to load schedule');
      }

      const data = await readJsonOrFallback(response, []);
      const normalizedTasks = (Array.isArray(data) ? data : [])
        .map(normalizeTask)
        .filter(task => taskMatchesFilters(task, effectiveFilters))
        .sort((firstTask, secondTask) => {
          const firstStart = firstTask?.start_time ? dayjs(firstTask.start_time).valueOf() : 0;
          const secondStart = secondTask?.start_time ? dayjs(secondTask.start_time).valueOf() : 0;
          return firstStart - secondStart;
        });

      let nextTasks = normalizedTasks;

      if (normalizedTasks.length > 0) {
        const travelResponse = await authFetch(`${VITE_KEY}/api/task_staff_travel/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskIds: normalizedTasks.map(task => task.id).filter(Boolean),
          }),
        });

        if (travelResponse.ok) {
          const travelRows = await readJsonOrFallback(travelResponse, []);
          nextTasks = attachTaskStaffTravelToTasks(normalizedTasks, travelRows);
        }
      }

      setTasks(nextTasks);
      setAppliedFilters(effectiveFilters);
    } catch (error) {
      console.error('Failed to load schedule', error);
      setTasks([]);
      showToast(error.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSchedule({
      from: defaultRange.from,
      to: defaultRange.to,
      staffId: '',
      clientId: '',
      viewType: 'individual',
    });
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <ScheduleFilters
        filters={filters}
        setFilters={setFilters}
        onSearch={() => fetchSchedule(filters)}
        staffs={staffs}
        clients={clients}
      />

      <div style={{ flex: 1, padding: 20, overflow: 'auto', background: '#f8fafc' }}>
        {loading && (
          <div style={{ marginBottom: 16, color: '#475569', fontSize: 14 }}>
            Loading schedule...
          </div>
        )}

        {filters.viewType === 'individual' && (
          <IndividualView
            tasks={tasks}
            staffs={staffs}
            teams={teams}
            locations={locations}
            teamMembers={teamMembers}
            appliedFilters={appliedFilters}
            onTasksUpdated={() => fetchSchedule(appliedFilters)}
            onOpenTask={onOpenTask}
            showToast={showToast}
            loading={loading}
          />
        )}
        {filters.viewType === 'staff' && (
          <GroupByStaff
            tasks={tasks}
            appliedFilters={appliedFilters}
            showToast={showToast}
            loading={loading}
          />
        )}
        {filters.viewType === 'client' && (
          <GroupByClient
            tasks={tasks}
            appliedFilters={appliedFilters}
            showToast={showToast}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
