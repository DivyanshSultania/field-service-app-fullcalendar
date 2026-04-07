import React, { useRef, useState, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import dayjs from 'dayjs';
import Modal from './Modal';
import RecurringShiftSettings from './RecurringShiftSettings'
import TaskMapInline from './TaskMapInline';
import { GOOGLE_MAPS_API_KEY, loadGoogleMapsApi } from '../utils/googleMaps';
import {authFetch} from './../pages/utils';
import { calculateTaskTravelData, getAssignedStaffIds } from '../utils/taskTravel';

// TODO: refresh on repeat create
// TODO: check why monday is selected, and it should apply from current week
// TODO: Once repeat is created then list down all the repeat task schedules in the repeat tab, allow to update from repeat tab for following
// Team & Staff
// Client details
// Timing
// Location
// Delete task
// TODO: add extra column in db task table for linking repeat tasks


// const GOOGLE_MAPS_API_KEY = 'AIzaSyDZzaPfNdYjTI0ahEmZTo7KftX9nSglOD4';

// // Helper: Google Maps API loader
// function loadGoogleMapsApi(apiKey) {
//   return new Promise((resolve, reject) => {
//     if (window.google && window.google.maps) return resolve(window.google.maps);
//     const script = document.createElement('script');
//     script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
//     script.async = true;
//     script.onload = () => resolve(window.google.maps);
//     script.onerror = (err) => {
//       console.error('Google Maps Load error');
//       console.error(err);
//       debugger;
//       reject(err);
//     }
//     document.body.appendChild(script);
//   });
// }

export default function CalendarView({
  filter = { type: 'staff', ids: [], hiddenDays: [] },
  onHiddenDaysChange,
  openTaskRequest,
  onOpenTaskHandled
}) {
  async function readJsonOrFallback(response, fallback) {
    try {
      return await response.json();
    } catch {
      return fallback;
    }
  }

  async function getResponseError(response, fallbackMessage) {
    const data = await readJsonOrFallback(response, {});
    return data?.error || fallbackMessage;
  }

  function showToast(msg, bgColor) {
    const div = document.createElement('div');
    div.innerText = msg || 'Unexpected error';
    div.style.position = 'fixed';
    div.style.bottom = '20px';
    div.style.left = '50%';
    div.style.transform = 'translateX(-50%)';
    div.style.background = bgColor || '#dc2626'; // Default error
    div.style.color = '#fff';
    div.style.padding = '10px 18px';
    div.style.borderRadius = '6px';
    div.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
    div.style.zIndex = '999999';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  }

  window.showToast = showToast;
  // All States

  // Global Calendar State
  const calendarRef = useRef(null);
  const calendarContainerRef = useRef(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [calendarHeight, setCalendarHeight] = useState(600);
  const [currentView, setCurrentView] = useState('timeGridWeek');
  const [currentRange, setCurrentRange] = useState({ start: null, end: null });
  const [dayDropdownOpen, setDayDropdownOpen] = useState(false);
  const dayDropdownRef = useRef(null);


  // DB Fetched Values
  const [teams, setTeams] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [clients, setClients] = useState([]);
  const [locations, setLocations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const taskFetchRequestIdsRef = useRef(new Map());
  const loadedMonthKeysRef = useRef(new Set());
  const pendingTaskFetchMonthsRef = useRef(new Set());
  /** Month-keyed task cache for the current browser session. */
  const tasksByMonthRef = useRef(new Map());

  // Temp States
  const [currentTask, setCurrentTask] = useState({});
  const [manageCleaners, setManageCleaners] = useState([]);
  const [showInlineTaskMap, setShowInlineTaskMap] = useState(false);

  // Manage Staff Modal States
  const [manageStaffModalSupervisor, setManageStaffModalSupervisor] = useState(null);
  const [manageStaffModalCleaners, setManageStaffModalCleaners] = useState([]);

  // Team selection Modal States
  const [selectedTeam, setSelectedTeam] = useState({});
  const [supervisorId, setSupervisorId] = useState(null);
  const [teamManageCleaners, setTeamManageCleaners] = useState([]);

  // Edit Task Modal States
  const [taskModalMainTab, setTaskModalMainTab] = useState('Shift Detail');
  const [taskModalEditTab, setTaskModalEditTab] = useState('Shift');
  const [editInstructions, setEditInstructions] = useState([]);
  const [editInstructionInput, setEditInstructionInput] = useState('');
  const [editInstructionInputRespType, setEditInstructionInputRespType] = useState('text');
  const [editingInstructionId, setEditingInstructionId] = useState(null);

  // Report tab / shift runtime states
  const [shiftTimerSeconds, setShiftTimerSeconds] = useState(0);
  const shiftTimerRef = useRef(null);
  const [reportEditMode, setReportEditMode] = useState(false);
  const [taskMessages, setTaskMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [travelInfo, setTravelInfo] = useState({ distance_km: null, duration_min: null, from_location: null });
  const [reportStaffTravelRows, setReportStaffTravelRows] = useState([]);
  const [reportStaffTravelLoading, setReportStaffTravelLoading] = useState(false);
  const [reportStaffTravelSaving, setReportStaffTravelSaving] = useState(false);
  const [reportStaffTravelError, setReportStaffTravelError] = useState('');
  const [reportTravelCalculating, setReportTravelCalculating] = useState(false);
  const [reportStaffTravelLoadedTaskId, setReportStaffTravelLoadedTaskId] = useState(null);

  // Calendar-level Details Modal (Images / Comments / Instructions Reply / Payments)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState('Images');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsImages, setDetailsImages] = useState([]);
  const [detailsComments, setDetailsComments] = useState([]);
  const [detailsInstructionReplies, setDetailsInstructionReplies] = useState([]);
  const [detailsPayments, setDetailsPayments] = useState([]);
  const [detailsReloadKey, setDetailsReloadKey] = useState(0);


  // Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [manageStaffModalOpen, setManageStaffModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Location Modal States
  const [locationSearchText, setLocationSearchText] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState([]);
  const [selectedLocationPlace, setSelectedLocationPlace] = useState(null);
  const [locationUnitNo, setLocationUnitNo] = useState('');
  const [locationComment, setlocationComment] = useState('');
  const [locationRadiusMeter, setLocationRadiusMeter] = useState(100);
  const [locationMapLoaded, setLocationMapLoaded] = useState(false);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const [locationLoadingDelete, setLocationLoadingDelete] = useState({});
  /** When set, confirming uses this saved location row unless the user edits fields (then a new location is created). */
  const [locationPickedExistingId, setLocationPickedExistingId] = useState(null);

  const VITE_KEY = import.meta.env.VITE_API_URL;
  const R2_PUBLIC_URL = 'https://pub-ac8edfc52ef04beba837f1804a4abf42.r2.dev';

  console.log('VITE_KEY', import.meta.env)

  const dayOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

  console.log('-------VITE_KEY-------', VITE_KEY);

  function getMonthKey(dateLike) {
    return dayjs(dateLike ?? undefined).startOf('month').format('YYYY-MM');
  }

  function getMonthRangeFromDate(dateLike) {
    const base = dateLike ? dayjs(dateLike) : dayjs();
    const monthStart = base.startOf('month');
    const monthEndExclusive = monthStart.add(1, 'month');
    return {
      from: monthStart.format('YYYY-MM-DD'),
      to: monthEndExclusive.format('YYYY-MM-DD')
    };
  }

  function getMonthKeysForRange(startLike, endLike) {
    const startMonth = dayjs(startLike ?? undefined).startOf('month');
    if (!startMonth.isValid()) return [];

    const endBoundary = endLike
      ? dayjs(endLike).subtract(1, 'millisecond')
      : startMonth;
    const endMonth = (endBoundary.isValid() ? endBoundary : startMonth).startOf('month');

    const monthKeys = [];
    let cursor = startMonth;
    while (cursor.isBefore(endMonth) || cursor.isSame(endMonth, 'month')) {
      monthKeys.push(cursor.format('YYYY-MM'));
      cursor = cursor.add(1, 'month');
    }

    return monthKeys;
  }

  function getReportTravelAssignedStaffIds(task) {
    if (!task || task.staff_id === 'STATIC-COVER-STAFF' || task.assignment_type === 'cover') {
      return [];
    }

    return getAssignedStaffIds(task);
  }

  function getCalendarStaffName(staffId) {
    return staffs.find(staff => staff.id === staffId)?.name || '';
  }

  function buildReportStaffTravelRows(task, travelRows = []) {
    const assignedStaffIds = getReportTravelAssignedStaffIds(task);
    const taskMemberNames = Array.isArray(task?.task_team_members_name) ? task.task_team_members_name : [];
    const taskMemberIds = Array.isArray(task?.task_team_members) ? task.task_team_members : [];
    const memberNameMap = new Map(taskMemberIds.map((staffId, index) => [staffId, taskMemberNames[index] || '']));
    const travelMap = new Map(
      (Array.isArray(travelRows) ? travelRows : [])
        .filter(row => row?.staff_id)
        .map(row => [row.staff_id, row])
    );

    return assignedStaffIds.map(staffId => {
      const isSupervisor = staffId === task?.staff_id;
      const sourceRow = travelMap.get(staffId) || {};
      const staffName = isSupervisor
        ? (task?.staff_name || getCalendarStaffName(staffId) || staffId)
        : (memberNameMap.get(staffId) || getCalendarStaffName(staffId) || staffId);

      return {
        staff_id: staffId,
        staff_name: staffName,
        role_label: isSupervisor ? 'Supervisor' : 'Cleaner',
        travel_distance: sourceRow.travel_distance ?? sourceRow.travel_dist ?? '',
        travel_duration: sourceRow.travel_duration ?? sourceRow.travel_time ?? '',
      };
    });
  }

  function getPrimaryTaskInstructionText(instructionList = []) {
    if (!Array.isArray(instructionList)) return '';

    const firstInstruction = instructionList.find(instruction => `${instruction?.ques || ''}`.trim());
    return firstInstruction ? `${firstInstruction.ques}`.trim() : '';
  }

  function syncTaskInstructionState(taskId, instructionList = []) {
    if (!taskId) return;

    const nextInstructionText = getPrimaryTaskInstructionText(instructionList);
    const applyInstructionText = (task) => (
      task?.id === taskId
        ? { ...task, task_instruction_text: nextInstructionText }
        : task
    );

    setCurrentTask(previousTask => (
      previousTask?.id === taskId
        ? { ...previousTask, task_instruction_text: nextInstructionText }
        : previousTask
    ));

    const nextCache = new Map(
      Array.from(tasksByMonthRef.current.entries()).map(([monthKey, monthTasks]) => ([
        monthKey,
        (Array.isArray(monthTasks) ? monthTasks : []).map(applyInstructionText),
      ]))
    );

    tasksByMonthRef.current = nextCache;

    if (nextCache.size > 0) {
      syncTasksFromMonthCache(nextCache);
      return;
    }

    setTasks(previousTasks => previousTasks.map(applyInstructionText));
  }

  async function attachInstructionTextToTasks(taskList) {
    const nextTasks = Array.isArray(taskList) ? taskList : [];
    const taskIds = [...new Set(nextTasks.map(task => task?.id).filter(Boolean))];

    if (taskIds.length === 0) {
      return nextTasks;
    }

    try {
      const response = await authFetch(`${VITE_KEY}/api/task_instructions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to load task instructions');
      }

      const instructionRows = await readJsonOrFallback(response, []);
      const instructionTextByTaskId = new Map();

      (Array.isArray(instructionRows) ? instructionRows : []).forEach((instruction) => {
        const instructionText = `${instruction?.ques || ''}`.trim();
        if (instruction?.task_id && instructionText && !instructionTextByTaskId.has(instruction.task_id)) {
          instructionTextByTaskId.set(instruction.task_id, instructionText);
        }
      });

      return nextTasks.map(task => ({
        ...task,
        task_instruction_text: instructionTextByTaskId.get(task.id) || '',
      }));
    } catch (error) {
      console.error('Failed to attach task instructions to tasks', error);
      return nextTasks.map(task => ({
        ...task,
        task_instruction_text: task?.task_instruction_text || '',
      }));
    }
  }

  function syncTasksFromMonthCache(nextCache = tasksByMonthRef.current) {
    const mergedTasks = [];
    const seenTaskIds = new Set();

    Array.from(nextCache.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([, monthTasks]) => {
        (Array.isArray(monthTasks) ? monthTasks : []).forEach((task) => {
          const dedupeKey = task?.id ?? `${task?.start_time || ''}-${task?.end_time || ''}-${task?.task_name || ''}`;
          if (seenTaskIds.has(dedupeKey)) return;
          seenTaskIds.add(dedupeKey);
          mergedTasks.push(task);
        });
      });

    mergedTasks.sort((a, b) => {
      const aTime = a?.start_time ? dayjs(a.start_time).valueOf() : 0;
      const bTime = b?.start_time ? dayjs(b.start_time).valueOf() : 0;
      return aTime - bTime;
    });

    setTasks(mergedTasks);
  }

  function updateTaskLoadingState(monthKey, isLoading) {
    if (!monthKey) return;
    if (isLoading) {
      pendingTaskFetchMonthsRef.current.add(monthKey);
    } else {
      pendingTaskFetchMonthsRef.current.delete(monthKey);
    }
    setTasksLoading(pendingTaskFetchMonthsRef.current.size > 0);
  }

  async function fetchTasksForMonth(dateLike, { force = false } = {}) {
    const monthKey = getMonthKey(dateLike);
    if (!force && loadedMonthKeysRef.current.has(monthKey)) {
      return;
    }

    const previousRequestId = taskFetchRequestIdsRef.current.get(monthKey) || 0;
    const requestId = previousRequestId + 1;
    taskFetchRequestIdsRef.current.set(monthKey, requestId);
    updateTaskLoadingState(monthKey, true);

    const { from, to } = getMonthRangeFromDate(dateLike);
    try {
      const res = await authFetch(`${VITE_KEY}/api/tasks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const taskResp = await res.json();
      const tasksWithInstructions = await attachInstructionTextToTasks(taskResp);
      if (taskFetchRequestIdsRef.current.get(monthKey) === requestId) {
        const nextCache = new Map(tasksByMonthRef.current);
        nextCache.set(monthKey, tasksWithInstructions);
        tasksByMonthRef.current = nextCache;
        loadedMonthKeysRef.current.add(monthKey);
        syncTasksFromMonthCache(nextCache);
      }
    } catch (err) {
      if (taskFetchRequestIdsRef.current.get(monthKey) === requestId) {
        loadedMonthKeysRef.current.delete(monthKey);
      }
      console.error('Failed to fetch tasks for month', err);
    } finally {
      if (taskFetchRequestIdsRef.current.get(monthKey) === requestId) {
        updateTaskLoadingState(monthKey, false);
      }
    }
  }

  function fetchTasksForVisibleRange(startLike, endLike, { force = false } = {}) {
    const monthKeys = getMonthKeysForRange(startLike, endLike);
    if (monthKeys.length === 0) return Promise.resolve();

    return Promise.all(
      monthKeys.map(monthKey => fetchTasksForMonth(`${monthKey}-01`, { force }))
    );
  }

  function refreshTasksForCurrentRange() {
    const range = getActiveRange();
    return fetchTasksForVisibleRange(range.start, range.end, { force: true });
  }

  // Fetch teams, staff, clients, locations
  useEffect(() => {
    authFetch(`${VITE_KEY}/api/teams`).then(r => r.json()).then(setTeams).catch(() => {});
    authFetch(`${VITE_KEY}/api/staff`).then(r => r.json()).then(setStaffs).catch(() => {});
    authFetch(`${VITE_KEY}/api/clients`).then(r => r.json()).then(setClients).catch(() => {});
    authFetch(`${VITE_KEY}/api/locations`).then(r => r.json()).then(setLocations).catch(() => {});
    authFetch(`${VITE_KEY}/api/team_members`).then(r => r.json()).then(setTeamMembers).catch(() => {});
    // fetchTasksForVisibleRange(new Date(), dayjs().add(1, 'day').toDate());

    // const listener = () => {
    //   refreshTasksForCurrentRange();
    // };
  
    // window.addEventListener("refreshCalendar", listener);
    // return () => window.removeEventListener("refreshCalendar", listener);
  }, []);

  useEffect(() => {
    if (!openTaskRequest?.taskId) {
      return;
    }

    let cancelled = false;

    async function openRequestedTask() {
      try {
        const response = await authFetch(`${VITE_KEY}/api/tasks/${openTaskRequest.taskId}`);
        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody?.error || 'Failed to open task');
        }

        const task = await response.json();
        if (cancelled || !task?.id) {
          return;
        }

        if (task.start_time) {
          await fetchTasksForMonth(task.start_time, { force: true });
          if (cancelled) {
            return;
          }
          const calendarApi = calendarRef.current?.getApi?.();
          if (calendarApi) {
            calendarApi.gotoDate(task.start_time);
          }
        }

        setCurrentTask({ ...task });
        openEditTaskModal(task);
      } catch (error) {
        console.error('Failed to open requested task', error);
        showToast(error.message || 'Failed to open task');
      } finally {
        if (!cancelled) {
          onOpenTaskHandled?.();
        }
      }
    }

    openRequestedTask();

    return () => {
      cancelled = true;
    };
  }, [openTaskRequest?.requestedAt, openTaskRequest?.taskId]);

  useEffect(() => {
    if (!editModalOpen || taskModalEditTab !== 'Report' || !currentTask?.id) {
      return;
    }

    loadReportStaffTravel(currentTask).catch((error) => {
      console.error('Report tab travel load failed', error);
    });
  }, [editModalOpen, taskModalEditTab, currentTask?.id]);

  useEffect(() => {
    const updateCalendarHeight = () => {
      const container = calendarContainerRef.current;
      if (!container) return;
      const { top } = container.getBoundingClientRect();
      const availableHeight = Math.max(420, Math.floor(window.innerHeight - top - 16));
      setCalendarHeight(prev => (prev === availableHeight ? prev : availableHeight));
    };

    updateCalendarHeight();
    window.addEventListener('resize', updateCalendarHeight);
    return () => window.removeEventListener('resize', updateCalendarHeight);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dayDropdownRef.current && !dayDropdownRef.current.contains(e.target)) {
        setDayDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleHiddenDay = (dayValue) => {
    const current = filter.hiddenDays || [];
    const exists = current.includes(dayValue);
    const next = exists
      ? current.filter(d => d !== dayValue)
      : [...current, dayValue];
    if (onHiddenDaysChange) {
      onHiddenDaysChange(next);
    }
  };

  const hiddenDaysLabel = () => {
    const current = filter.hiddenDays || [];
    if (!current.length) return 'No days hidden';
    if (current.length === 7) return 'All days hidden';
    const labels = dayOptions
      .filter(d => current.includes(d.value))
      .map(d => d.label);
    return labels.join(', ');
  };

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
      throw new Error(await getResponseError(response, 'Failed to update staff travel details'));
    }

    return readJsonOrFallback(response, []);
  }

  async function loadReportStaffTravel(task, options = {}) {
    const { force = false } = options;

    if (!task?.id) {
      setReportStaffTravelRows([]);
      setReportStaffTravelLoadedTaskId(null);
      setReportStaffTravelError('');
      return;
    }

    if (!force && reportStaffTravelLoadedTaskId === task.id) {
      return;
    }

    setReportStaffTravelLoading(true);
    setReportStaffTravelError('');

    try {
      const response = await authFetch(`${VITE_KEY}/api/task_staff_travel/task/${task.id}`);
      if (!response.ok) {
        throw new Error(await getResponseError(response, 'Failed to load staff travel'));
      }

      const rows = await readJsonOrFallback(response, []);
      const nextRows = buildReportStaffTravelRows(task, rows);

      setReportStaffTravelRows(nextRows);
      setReportStaffTravelLoadedTaskId(task.id);
      setCurrentTask(previousTask => (
        previousTask?.id === task.id
          ? { ...previousTask, task_staff_travel: rows }
          : previousTask
      ));
    } catch (error) {
      console.error('Failed to load report staff travel', error);
      setReportStaffTravelError(error.message || 'Failed to load staff travel');
    } finally {
      setReportStaffTravelLoading(false);
    }
  }

  function handleReportStaffTravelFieldChange(staffId, field, value) {
    setReportStaffTravelRows(previousRows => previousRows.map(row => (
      row.staff_id === staffId
        ? { ...row, [field]: value }
        : row
    )));
  }

  async function handleSaveReportStaffTravel() {
    if (!currentTask?.id) {
      return;
    }

    setReportStaffTravelSaving(true);
    setReportStaffTravelError('');

    try {
      const payload = reportStaffTravelRows.map(row => ({
        staff_id: row.staff_id,
        travel_distance: row.travel_distance === '' ? null : Number(row.travel_distance),
        travel_duration: row.travel_duration === '' ? null : Number(row.travel_duration),
      }));

      const savedRows = await persistTaskStaffTravel(currentTask.id, payload);
      const supervisorRow = savedRows.find(row => row?.staff_id === currentTask.staff_id) || null;
      const taskTravelPatch = {
        travel_dist: supervisorRow?.travel_distance ?? null,
        travel_duration: supervisorRow?.travel_duration ?? null,
      };

      let updatedTaskFields = {};
      if (currentTask?.staff_id && currentTask.staff_id !== 'STATIC-COVER-STAFF') {
        const response = await authFetch(`${VITE_KEY}/api/tasks/${currentTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskTravelPatch),
        });

        if (!response.ok) {
          throw new Error(await getResponseError(response, 'Failed to update task travel'));
        }

        updatedTaskFields = await readJsonOrFallback(response, {});
      }

      const nextTask = {
        ...currentTask,
        ...updatedTaskFields,
        ...taskTravelPatch,
        task_staff_travel: savedRows,
      };

      setCurrentTask(nextTask);
      setTravelInfo(previousTravel => ({
        ...previousTravel,
        distance_km: nextTask.travel_dist,
        duration_min: nextTask.travel_duration,
      }));
      setReportStaffTravelRows(buildReportStaffTravelRows(nextTask, savedRows));
      setReportStaffTravelLoadedTaskId(currentTask.id);
      showToast('Staff travel updated', '#16a34a');
    } catch (error) {
      console.error('Failed to save report staff travel', error);
      setReportStaffTravelError(error.message || 'Failed to update staff travel');
      showToast(error.message || 'Failed to update staff travel');
    } finally {
      setReportStaffTravelSaving(false);
    }
  }

  async function handleCalculateReportStaffTravel() {
    if (!currentTask?.id) {
      return;
    }

    setReportTravelCalculating(true);
    setReportStaffTravelError('');

    try {
      const result = await computeAndSaveTravelDistance(currentTask, true);
      if (result) {
        const nextTask = {
          ...(result.task || currentTask),
          task_staff_travel: result.staffTravelRecords || [],
        };
        setReportStaffTravelRows(buildReportStaffTravelRows(nextTask, result.staffTravelRecords || []));
        setReportStaffTravelLoadedTaskId(currentTask.id);
      }
    } finally {
      setReportTravelCalculating(false);
    }
  }

  async function syncTaskTravelDetails(task, options = {}) {
    const {
      persistTask = true,
      persistStaffTravel = true,
      supervisorOverride = null,
      updateState = true,
    } = options;

    const assignedStaffIds = task?.staff_id === 'STATIC-COVER-STAFF' || task?.assignment_type === 'cover'
      ? []
      : getAssignedStaffIds(task);
    const canCalculate = task?.start_time && task?.location_id && assignedStaffIds.length > 0;

    let supervisorTravel = null;
    let staffTravelRecords = assignedStaffIds.map(staffId => ({
      staff_id: staffId,
      travel_distance: null,
      travel_duration: null,
    }));

    if (canCalculate) {
      const calculatedTravel = await calculateTaskTravelData({
        task,
        tasks,
        locations,
      });
      supervisorTravel = calculatedTravel.supervisorTravel;
      staffTravelRecords = calculatedTravel.staffTravelRecords;
    }

    let nextSupervisorTravel = supervisorTravel;
    let nextStaffTravelRecords = staffTravelRecords;

    if (task?.staff_id && supervisorOverride) {
      nextSupervisorTravel = {
        travel_from: supervisorOverride.travel_from ?? supervisorTravel?.travel_from ?? null,
        travel_dist: supervisorOverride.travel_dist ?? null,
        travel_duration: supervisorOverride.travel_duration ?? null,
      };

      let supervisorRecordUpdated = false;
      nextStaffTravelRecords = staffTravelRecords.map(record => {
        if (record.staff_id !== task.staff_id) {
          return record;
        }

        supervisorRecordUpdated = true;
        return {
          ...record,
          from_location: nextSupervisorTravel.travel_from ?? record.from_location ?? null,
          travel_distance: nextSupervisorTravel.travel_dist ?? null,
          travel_duration: nextSupervisorTravel.travel_duration ?? null,
        };
      });

      if (!supervisorRecordUpdated) {
        nextStaffTravelRecords = [
          ...nextStaffTravelRecords,
          {
            staff_id: task.staff_id,
            from_location: nextSupervisorTravel.travel_from ?? null,
            travel_distance: nextSupervisorTravel.travel_dist ?? null,
            travel_duration: nextSupervisorTravel.travel_duration ?? null,
          },
        ];
      }
    }

    const nextTask = {
      ...task,
      travel_from: nextSupervisorTravel?.travel_from ?? null,
      travel_dist: nextSupervisorTravel?.travel_dist ?? null,
      travel_duration: nextSupervisorTravel?.travel_duration ?? null,
      task_staff_travel: nextStaffTravelRecords,
    };

    if (updateState) {
      setTravelInfo({
        distance_km: nextTask.travel_dist,
        duration_min: nextTask.travel_duration,
        from_location: nextTask.travel_from,
      });
      setCurrentTask(previousTask => ({
        ...previousTask,
        ...nextTask,
      }));
      setReportStaffTravelRows(buildReportStaffTravelRows(nextTask, nextStaffTravelRecords));
    }

    let persistedTask = nextTask;

    if (persistTask && task?.id) {
      const response = await authFetch(`${VITE_KEY}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextTask),
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, 'Failed to update task travel details'));
      }

      const updatedTask = await readJsonOrFallback(response, {});
      persistedTask = {
        ...nextTask,
        ...updatedTask,
        task_team_members: nextTask.task_team_members || [],
        task_team_members_name: nextTask.task_team_members_name || [],
        task_staff_travel: nextStaffTravelRecords,
      };
    }

    if (persistStaffTravel && task?.id) {
      await persistTaskStaffTravel(task.id, nextStaffTravelRecords);
    }

    return {
      task: persistedTask,
      supervisorTravel: nextSupervisorTravel,
      staffTravelRecords: nextStaffTravelRecords,
    };
  }

  async function syncAffectedTaskTravel(impactTasks = [], baseTaskList = tasks, focusedTaskId = null) {
    let workingTasks = baseTaskList.map(task => ({ ...task }));

    impactTasks.forEach(task => {
      if (task?.id) {
        workingTasks = replaceTaskInList(workingTasks, task);
      }
    });

    const affectedTasks = workingTasks
      .filter(candidate => impactTasks.some(impactTask => {
        if (!candidate?.id || !impactTask?.id) {
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

    let focusedTaskResult = null;

    for (const task of affectedTasks) {
      const syncedTask = await syncTaskTravelDetails(task, {
        persistTask: true,
        persistStaffTravel: true,
        updateState: task.id === focusedTaskId,
      });
      workingTasks = replaceTaskInList(workingTasks, syncedTask.task);
      if (task.id === focusedTaskId) {
        focusedTaskResult = syncedTask.task;
      }
    }

    return {
      tasks: workingTasks,
      focusedTask: focusedTaskResult,
    };
  }

  async function computeAndSaveTravelDistance(task, isBtnClick, options = {}) {
    const { skipSave = false } = options;
    if (!task || !task.staff_id || !task.start_time || !task.location_id) {
      if (isBtnClick) {
        showToast('Please make sure location, staff and start time are configured for this task.');
      }
      return null;
    }

    try {
      const { task: updatedTask, supervisorTravel, staffTravelRecords } = await syncTaskTravelDetails(task, {
        persistTask: !skipSave,
        persistStaffTravel: !skipSave,
        updateState: true,
      });

      if (!supervisorTravel && isBtnClick) {
        showToast('No previous shift found on the same day for the assigned supervisor.', '#0f172a');
      }

      return {
        travel_from: supervisorTravel?.travel_from ?? null,
        travel_dist: supervisorTravel?.travel_dist ?? null,
        travel_duration: supervisorTravel?.travel_duration ?? null,
        from_location: supervisorTravel?.travel_from ?? null,
        staffTravelRecords,
        task: updatedTask,
      };
    } catch (e) {
      console.error('Auto travel compute failed:', e);
      showToast(e.message || 'Error occurred');
      return null;
    }
  }

  // Helper: Determine if a color is "dark"
  const isDarkColor = (hex) => {
    if (!hex) return false;
    const c = hex.replace('#', '');
    const rgb = parseInt(c, 16);
    const r = (rgb >> 16) & 255;
    const g = (rgb >> 8) & 255;
    const b = rgb & 255;
    // Perceived luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    return luminance < 140;
  };

  const withAlpha = (hex, alpha = 1) => {
    if (!hex) return `rgba(0, 0, 0, ${alpha})`;
    const c = hex.replace('#', '');
    const normalized = c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c;
    const rgb = parseInt(normalized, 16);
    const r = (rgb >> 16) & 255;
    const g = (rgb >> 8) & 255;
    const b = rgb & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const escapeTooltipHtml = (value) => `${value ?? ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const buildTooltipRow = (label, value) => {
    const safeValue = `${value ?? ''}`.trim();
    if (!safeValue) return '';
    return `<div><strong>${label}:</strong> ${escapeTooltipHtml(safeValue)}</div>`;
  };

  const positionTaskTooltip = (anchorEl, tooltipEl) => {
    if (!anchorEl || !tooltipEl) return;

    const viewportPadding = 12;
    const tooltipOffset = 10;
    const anchorRect = anchorEl.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const spaceOnRight = window.innerWidth - anchorRect.right - viewportPadding;
    const spaceOnLeft = anchorRect.left - viewportPadding;

    let left = anchorRect.right + tooltipOffset;
    if (spaceOnRight < tooltipRect.width + tooltipOffset && spaceOnLeft >= tooltipRect.width + tooltipOffset) {
      left = anchorRect.left - tooltipRect.width - tooltipOffset;
    }

    const maxLeft = Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding);
    left = Math.min(Math.max(left, viewportPadding), maxLeft);

    const maxTop = Math.max(viewportPadding, window.innerHeight - tooltipRect.height - viewportPadding);
    const top = Math.min(Math.max(anchorRect.top, viewportPadding), maxTop);

    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;
  };

  function taskMatchesCurrentFilter(t) {
    if (!filter?.ids || filter.ids.length === 0) return true;

    if (filter.type === 'staff') {
      // Match supervisor assignment OR team-member assignment
      const memberIds = Array.isArray(t.task_team_members) ? t.task_team_members : [];
      return filter.ids.includes(t.staff_id) || memberIds.some(id => filter.ids.includes(id));
    }
    if (filter.type === 'client') return filter.ids.includes(t.client_id);
    if (filter.type === 'team') return filter.ids.includes(t.team_id);
    return true;
  }

  function getActiveRange() {
    // Prefer the range captured from FullCalendar, fallback to calendar api.
    if (currentRange?.start && currentRange?.end) {
      return { start: new Date(currentRange.start), end: new Date(currentRange.end) };
    }

    const api = calendarRef.current?.getApi?.();
    const view = api?.view;
    if (view?.activeStart && view?.activeEnd) {
      return { start: view.activeStart, end: view.activeEnd };
    }

    // Fallback: "today" day range
    const now = new Date();
    const s = new Date(now);
    s.setHours(0, 0, 0, 0);
    const e = new Date(s);
    e.setDate(e.getDate() + 1);
    return { start: s, end: e };
  }

  function isTaskInActiveRange(t, range) {
    if (!t?.start_time) return false;
    const ts = new Date(t.start_time);
    // Include tasks that start in [start, end)
    return ts >= range.start && ts < range.end;
  }

  function isTaskHiddenByWeekHiddenDays(t) {
    if (currentView !== 'timeGridWeek') return false;
    const hidden = filter?.hiddenDays || [];
    if (!hidden.length) return false;
    if (!t?.start_time) return false;
    const dow = new Date(t.start_time).getDay(); // 0..6
    return hidden.includes(dow);
  }

  function updateCalendarView() {
    let filteredTasks = tasks.filter(taskMatchesCurrentFilter);

    const ev = filteredTasks.map(t => {
      const supervisor = staffs.find(s => s.id === t.staff_id);
      const bgColor = supervisor?.color || '#7c3aed';

      // Determine accent border color based on task status
      let borderColor = '#60a5fa'; // not published: light blue
      const isInProgress = t.started_at && !t.stopped_at;
      const isFinished = t.started_at && t.stopped_at;

      if (isFinished) {
        borderColor = '#16a34a'; // finished: green
      } else if (isInProgress) {
        borderColor = '#f59e0b'; // in progress: orange
      } else if (t.publish) {
        borderColor = '#7c3aed'; // published: purple
      }

      // Tasks assigned to cover should always be red
      if (t.assignment_type === 'cover' || t.staff_id === 'STATIC-COVER-STAFF') {
        borderColor = '#dc2626';
      }
      let taskTitle = '';
      if (t.task_name) {
        taskTitle += t.task_name;
        taskTitle += '\n';
      }

      if (t.client_name) {
        taskTitle += t.client_name;
        taskTitle += '\n';
      }

      if (t.staff_name) {
        taskTitle += t.staff_name;
        taskTitle += ' (S)\n';
      }

      if (t.task_team_members_name?.length > 0) {
        t.task_team_members_name.forEach((staffName) => {
          taskTitle += staffName;
          taskTitle += ', ';
        });

        taskTitle = taskTitle.slice(0, -2);
      }

      return {
        id: t.id,
        // title: t.task_name + (t.staff_name ? '\n' + t.staff_name : ''),
        title: taskTitle,
        start: t.start_time,
        end: t.end_time,
        backgroundColor: bgColor,
        borderColor,
        borderWidth: 3,
        textColor: isDarkColor(bgColor) ? '#ffffff' : '#111827',
        extendedProps: { ...t, statusBorderColor: borderColor }
      };
    });
    setEvents(ev);
  }

  useEffect(() => {
    updateCalendarView();
  }, [
    tasks, 
    filter?.type,
    (filter?.ids || []).join(','),
    (filter?.hiddenDays || []).join(','),  
    staffs
  ]);

  function computePaymentsFromTasks(scopedTasks) {
    // Group by supervisor staff_id (consistent with tasks schema)
    const byStaff = new Map();
    for (const t of scopedTasks) {
      const paymentType = (t.payment_type || '').trim();
      const amountNum = t.payment_amount != null && t.payment_amount !== ''
        ? Number(t.payment_amount)
        : 0;

      if (!paymentType || !Number.isFinite(amountNum) || amountNum <= 0) {
        continue;
      }

      const staffId = t.staff_id || 'unknown';
      const staffName =
        staffs.find(s => s.id === staffId)?.name ||
        t.staff_name ||
        'Unknown';
      if (!byStaff.has(staffId)) {
        byStaff.set(staffId, { staffId, staffName, rows: [] });
      }

      const schedMinutes = t.start_time && t.end_time
        ? Math.max(0, Math.round((new Date(t.end_time) - new Date(t.start_time)) / 60000))
        : 0;

      const logMinutes = (t.started_at && t.stopped_at)
        ? Math.max(0, Math.round((new Date(t.stopped_at) - new Date(t.started_at)) / 60000))
        : 0;

      const clientName = t.client_name || clients.find(c => c.id === t.client_id)?.client_name || '';
      let title = `${t.task_name || ''}${clientName ? ` ${clientName}` : ''}${staffName ? ` - ${staffName} (S) ` : ''}`;
  
        if (t.task_team_members_name?.length > 0) {
          t.task_team_members_name.forEach((staffName) => {
            title += staffName;
            title += ', ';
          });
  
          title = title.slice(0, -2);
        }


      byStaff.get(staffId).rows.push({
        task_id: t.id,
        date: t.start_time,
        shift_name: title,
        sched_min: schedMinutes,
        log_min: logMinutes,
        payment_type: paymentType,
        amount: amountNum
      });
    }

    return Array.from(byStaff.values()).map(g => ({
      ...g,
      rows: g.rows.sort((a, b) => new Date(a.date) - new Date(b.date))
    })).sort((a, b) => (a.staffName || '').localeCompare(b.staffName || ''));
  }

  function formatMinutesAsHhMm(min) {
    const m = Math.max(0, Number(min) || 0);
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function openDetailsModal() {
    setDetailsTab('Images');
    setDetailsModalOpen(true);
  }

  useEffect(() => {
    if (!detailsModalOpen) return;
    let cancelled = false;

    const load = async () => {
      setDetailsLoading(true);
      setDetailsError('');

      try {
        const range = getActiveRange();
        const scopedTasks = tasks
          .filter(taskMatchesCurrentFilter)
          .filter(t => isTaskInActiveRange(t, range))
          .filter(t => !isTaskHiddenByWeekHiddenDays(t));

        const taskIds = scopedTasks.map(t => t.id).filter(Boolean);

        // Payments can be computed from scoped tasks directly.
        const payments = computePaymentsFromTasks(scopedTasks);

        if (taskIds.length === 0) {
          if (cancelled) return;
          setDetailsImages([]);
          setDetailsComments([]);
          setDetailsInstructionReplies([]);
          setDetailsPayments(payments);
          setDetailsLoading(false);
          return;
        }

        const [imagesRes, commentsRes, instRes] = await Promise.all([
          authFetch(`${VITE_KEY}/api/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskIds })
          }),
          authFetch(`${VITE_KEY}/api/task_comments/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskIds })
          }),
          authFetch(`${VITE_KEY}/api/task_instructions/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskIds })
          })
        ]);

        const imagesJson = await imagesRes.json().catch(() => []);

        let commentsJson = [];
        if (commentsRes.ok) {
          commentsJson = await commentsRes.json().catch(() => []);
        } else {
          // Fallback (in case backend bulk endpoint isn't deployed yet)
          const perTask = await Promise.all(
            taskIds.map(id =>
              authFetch(`${VITE_KEY}/api/task_comments/${id}`)
                .then(r => (r.ok ? r.json() : []))
                .catch(() => [])
            )
          );
          commentsJson = perTask.flat();
        }

        let instJson = [];
        if (instRes.ok) {
          instJson = await instRes.json().catch(() => []);
        } else {
          // Fallback (in case backend bulk endpoint isn't deployed yet)
          const perTask = await Promise.all(
            taskIds.map(id =>
              authFetch(`${VITE_KEY}/api/task_instructions/${id}`)
                .then(r => (r.ok ? r.json() : []))
                .catch(() => [])
            )
          );
          instJson = perTask.flat();
        }

        if (cancelled) return;
        setDetailsImages(Array.isArray(imagesJson) ? imagesJson : []);
        setDetailsComments(Array.isArray(commentsJson) ? commentsJson : []);
        setDetailsInstructionReplies(Array.isArray(instJson) ? instJson : []);
        setDetailsPayments(payments);
      } catch (e) {
        if (cancelled) return;
        console.error('Details modal load failed', e);
        setDetailsError(e?.message || 'Failed to load details');
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [
    detailsModalOpen,
    detailsReloadKey,
    currentView,
    currentRange?.start,
    currentRange?.end,
    tasks,
    filter?.type,
    (filter?.ids || []).join(','),
    (filter?.hiddenDays || []).join(',')
  ]);

  function DetailsModal() {
    if (!detailsModalOpen) return null;

    const range = getActiveRange();
    const scopedTasks = tasks
      .filter(taskMatchesCurrentFilter)
      .filter(t => isTaskInActiveRange(t, range))
      .filter(t => !isTaskHiddenByWeekHiddenDays(t));

    const tabs = ['Images', 'Comments', 'Instructions Reply', 'Payments'];

    const headerLine = () => {
      const start = dayjs(range.start).format('YYYY-MM-DD');
      const end = dayjs(new Date(range.end.getTime() - 1)).format('YYYY-MM-DD');
      const label = currentView === 'dayGridMonth'
        ? `Month view range: ${start} → ${end}`
        : currentView === 'timeGridDay'
          ? `Day: ${start}`
          : `Range: ${start} → ${end}`;

      const filterLabel = filter?.ids?.length
        ? `${filter.type}: ${filter.ids.length} selected`
        : 'No filter selected';

      const hiddenLabel =
        currentView === 'timeGridWeek' && (filter.hiddenDays || []).length
          ? `Hidden days: ${(filter.hiddenDays || []).length}`
          : null;

      return `${label} • ${filterLabel}${hiddenLabel ? ` • ${hiddenLabel}` : ''}`;
    };

    function groupRowsByTaskId(rows, key = 'task_id') {
      const map = new Map();
      for (const r of rows) {
        const tid = r?.[key];
        if (!tid) continue;
        if (!map.has(tid)) map.set(tid, []);
        map.get(tid).push(r);
      }
      return map;
    }

    const imagesByTask = groupRowsByTaskId(detailsImages, 'task_id');
    const commentsByTask = groupRowsByTaskId(detailsComments, 'task_id');
    const instructionsByTask = groupRowsByTaskId(detailsInstructionReplies, 'task_id');

    function renderTaskHeader(t) {
      const clientName = clients.find(c => c.id === t.client_id)?.client_name || t.client_name || '';
      const staffName = staffs.find(s => s.id === t.staff_id)?.name || t.staff_name || '';
      const when = t.start_time ? dayjs(t.start_time).format('YYYY-MM-DD hh:mm a') : '';
      const title = `${t.task_name || 'Shift'}${clientName ? ` • ${clientName}` : ''}`;
      let subtitle = `${when}${staffName ? ` • ${staffName} (S) ` : ''}`;

      if (t.task_team_members_name?.length > 0) {
        t.task_team_members_name.forEach((staffName) => {
          subtitle += staffName;
          subtitle += ', ';
        });

        subtitle = subtitle.slice(0, -2);
      }

      return (
        <div style={{ padding: '10px 12px', background: '#e0f2fe', fontStyle: 'italic' }}>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#334155' }}>{subtitle}</div>
        </div>
      );
    }

    function renderEmpty(msg) {
      return (
        <div style={{ padding: 16, color: '#6b7280', textAlign: 'center' }}>
          {msg}
        </div>
      );
    }

    return (
      <Modal open={detailsModalOpen} title="Calendar Details" onClose={() => setDetailsModalOpen(false)}>
        <div style={{ minWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {headerLine()}
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: 8,
            background: '#f9fafb',
            borderRadius: 8,
            padding: 6
          }}>
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setDetailsTab(tab)}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: detailsTab === tab ? '#e0f2fe' : 'transparent',
                  color: detailsTab === tab ? '#0c4a6e' : '#374151',
                  fontWeight: detailsTab === tab ? 600 : 500
                }}
              >
                {tab}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              className="btn"
              onClick={() => {
                setDetailsReloadKey(k => k + 1);
              }}
              style={{ alignSelf: 'center' }}
              type="button"
            >
              Refresh
            </button>
          </div>

          {detailsError && (
            <div style={{ background: '#fee2e2', color: '#7f1d1d', padding: 10, borderRadius: 8 }}>
              {detailsError}
            </div>
          )}

          {detailsLoading && (
            <div style={{ padding: 12, color: '#374151' }}>
              Loading...
            </div>
          )}

          {!detailsLoading && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              {detailsTab === 'Images' && (
                <div>
                  {scopedTasks.length === 0 && renderEmpty('No shifts in the current view range.')}
                  {scopedTasks.map(t => {
                    const rows = imagesByTask.get(t.id) || [];
                    if (rows.length === 0) return null;
                    return (
                      <div key={t.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                        {renderTaskHeader(t)}
                        <div style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          {rows.map(img => {
                            console.log('R2_PUBLIC_URL', R2_PUBLIC_URL);
                            debugger;
                            const url = `${R2_PUBLIC_URL}${img.images || img.url}`;
                            if (!url) return null;
                            return (
                              <div key={img.id || url} style={{ width: 260 }}>
                                <div style={{
                                  width: '100%',
                                  height: 160,
                                  borderRadius: 8,
                                  border: '1px solid #e5e7eb',
                                  overflow: 'hidden',
                                  background: '#f3f4f6'
                                }}>
                                  <img
                                    src={url}
                                    alt="uploaded"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, gap: 8 }}>
                                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                                    {img.created_at ? dayjs(img.created_at).format('YYYY-MM-DD HH:mm') : ''}
                                  </div>
                                  <a
                                    href={url}
                                    download
                                    style={{
                                      fontSize: 12,
                                      textDecoration: 'none',
                                      background: '#0ea5e9',
                                      color: '#fff',
                                      padding: '4px 8px',
                                      borderRadius: 6
                                    }}
                                  >
                                    Download
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {detailsImages.length === 0 && scopedTasks.length > 0 && renderEmpty('No images found for the shifts in this range.')}
                </div>
              )}

              {detailsTab === 'Comments' && (
                <div>
                  {scopedTasks.length === 0 && renderEmpty('No shifts in the current view range.')}
                  {scopedTasks.map(t => {
                    const rows = commentsByTask.get(t.id) || [];
                    if (rows.length === 0) return null;
                    return (
                      <div key={t.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                        {renderTaskHeader(t)}
                        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {rows
                            .slice()
                            .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
                            .map(c => (
                              <div
                                key={c.id}
                                style={{
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 8,
                                  padding: 10,
                                  background: '#fff'
                                }}
                              >
                                <div style={{ fontSize: 13, color: '#111827', whiteSpace: 'pre-wrap' }}>
                                  {c.comment || ''}
                                </div>
                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                                  {c.staff_id ? `Staff: ${staffs.find(s => s.id === c.staff_id)?.name || c.staff_id}` : ''}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                  {detailsComments.length === 0 && scopedTasks.length > 0 && renderEmpty('No comments found for the shifts in this range.')}
                </div>
              )}

              {detailsTab === 'Instructions Reply' && (
                <div>
                  {scopedTasks.length === 0 && renderEmpty('No shifts in the current view range.')}
                  {scopedTasks.map(t => {
                    const rows = instructionsByTask.get(t.id) || [];
                    if (rows.length === 0) return null;
                    return (
                      <div key={t.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                        {renderTaskHeader(t)}
                        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {rows.map(inst => (
                            <div
                              key={inst.id}
                              style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: 8,
                                padding: 10,
                                background: '#fff'
                              }}
                            >
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                {inst.ques || 'Question'}
                              </div>
                              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', color: '#111827' }}>
                                {inst.reply || '-'}
                              </div>
                              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                                {inst.replied_at ? dayjs(inst.replied_at).format('YYYY-MM-DD HH:mm') : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {detailsInstructionReplies.length === 0 && scopedTasks.length > 0 && renderEmpty('No instruction replies found for the shifts in this range.')}
                </div>
              )}

              {detailsTab === 'Payments' && (
                <div style={{ padding: 12 }}>
                  {detailsPayments.length === 0 && renderEmpty('No payments data in this range.')}
                  {detailsPayments.map(group => (
                    <div key={group.staffId} style={{ marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, color: '#111827', padding: '6px 0' }}>
                        {group.staffName}
                      </div>
                      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc' }}>
                              <th style={{ textAlign: 'left', padding: '8px 10px' }}>Date</th>
                              <th style={{ textAlign: 'left', padding: '8px 10px' }}>Shift Name</th>
                              <th style={{ textAlign: 'right', padding: '8px 10px' }}>Sch</th>
                              <th style={{ textAlign: 'right', padding: '8px 10px' }}>Log</th>
                              <th style={{ textAlign: 'left', padding: '8px 10px' }}>Type</th>
                              <th style={{ textAlign: 'right', padding: '8px 10px' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map(r => (
                              <tr key={r.task_id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                  {r.date ? dayjs(r.date).format('YYYY-MM-DD HH:mm') : ''}
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  {r.shift_name || ''}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatMinutesAsHhMm(r.sched_min)}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatMinutesAsHhMm(r.log_min)}
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  {r.payment_type || ''}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                  {Number(r.amount || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                            {group.rows.length === 0 && (
                              <tr>
                                <td colSpan={6} style={{ padding: 10, textAlign: 'center', color: '#6b7280' }}>
                                  No shifts.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" onClick={() => setDetailsModalOpen(false)} type="button">Close</button>
          </div>
        </div>
      </Modal>
    );
  }


  // Handlers
  // --- CALENDAR HANDLERS ---
  function handleEventClick(clickInfo) {
    debugger;
    const ev = clickInfo.event;
    const ext = ev.extendedProps || {};
    debugger;

    console.log('Before setCurrentTask:', ext);
    setCurrentTask({ ...ext });

    console.log('After setCurrentTask:', currentTask);

    openEditTaskModal(ext);
  }

  function handleDateSelect(selectInfo) {
    // console.log('selectInfo');
    // console.log(selectInfo);

    setCurrentTask({
      task_name: '',
      assignment_type: 'individual',
      staff_id: '',
      team_id: '',
      client_id: '',
      location_id: '',
      start_time: (selectInfo.start)?.toISOString(),
      end_time: (selectInfo.end)?.toISOString(),
      publish: false,
      isLocation: false,
      shift_instructions: '',
      color: '',
      created_at: '',
      started_at: '',
      stopped_at: '',
      travel_from: '',
      travel_dist: '',
      travel_duration: '',
      payment_type: '',
      payment_amount: '',
      payment_date: '',

      task_client_name: '',
      task_client_company: '',
      task_client_email: '',
      task_client_phone: '',
      task_client_abn: '',
      task_client_acn: '',
      task_client_instruction: '',
      task_client_information: '',
      task_client_property_information: '',
      end_lng: '',
      start_lat: '',
      start_lng: '',
      end_lat: '',
    });
    // setSelectedTeam({});
    // setSelectedLocation({});
    // handleCreateModalLoad();
    setCreateModalOpen(true);
    // setEditModalOpen(false);
  }

  function handleAssignmentTypeChange(type) {
    setCurrentTask(f => ({
      ...f,
      assignment_type: type,
      team_id: type === 'team' ? f.team_id : '',
    }));
  }

  async function handleCreateEvent() {
    // const taskStaffMembers = manageCleaners.map(id => ({ staff_id: id, team_id: null }));

    // debugger;
    const payload = {
      ...currentTask,
      assignment_type: currentTask.assignment_type,
      task_name: currentTask.task_name,
      staff_id: (currentTask.staff_id),
      team_id: currentTask.assignment_type === 'team' ? currentTask.team_id : null,
      client_id: currentTask.client_id || null,
      location_id: currentTask.location_id || null,
      start_time: currentTask.start_time,
      end_time: currentTask.end_time,
      color: currentTask.color,
      shift_instructions: currentTask.shift_instructions,
      publish: currentTask.publish ? 1 : 0,
      isLocation: !!currentTask.isLocation,
      task_team_members: currentTask.task_team_members
    };

    try {
      const travel = await computeAndSaveTravelDistance(currentTask, false, { skipSave: true });
      if (travel) {
        payload.travel_from = travel.travel_from;
        payload.travel_dist = travel.travel_dist;
        payload.travel_duration = travel.travel_duration;
      }

      const res = await authFetch(`${VITE_KEY}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const created = await res.json();

      if (created?.id) {
        await persistTaskStaffTravel(created.id, travel?.staffTravelRecords || []);
      }
  
      // Fetch enriched task (joins staff, client, location, team)
      const fullRes = await authFetch(`${VITE_KEY}/api/tasks/${created.id}`);
      const fullTask = await fullRes.json();

      let taskTitle = '';

      debugger;
      if (fullTask.task_name) {
        taskTitle += fullTask.task_name;
        taskTitle += '\n';
      }

      if (fullTask.client_name) {
        taskTitle += fullTask.client_name;
        taskTitle += '\n';
      }

      if (fullTask.staff_name) {
        taskTitle += fullTask.staff_name;
        taskTitle += ' (S)\n';
      }

      if (fullTask.task_team_members_name?.length > 0) {
        fullTask.task_team_members_name.forEach((staffName) => {
          taskTitle += staffName;
          taskTitle += ', ';
        });

        taskTitle = taskTitle.slice(0, -2);
      }
  
      // Add to FullCalendar
      const calApi = calendarRef.current.getApi();
      calApi.addEvent({
        id: fullTask.id,
        title: taskTitle,
        start: fullTask.start_time,
        end: fullTask.end_time,
        staff_id: fullTask.staff_id,
        backgroundColor: fullTask.color || '#7c3aed',
        extendedProps: { ...fullTask },
      });

      // Close and open edit modal
      setCreateModalOpen(false);
    } catch (e) {
      console.error('Create task error', e);
      showToast(typeof arguments[1] === 'string' ? arguments[1] : (arguments[0]?.message || 'Error occurred'));
    }
  }

  // Modals

  function openTeamSelectionModal() {
    if (currentTask.assignment_type === 'team' && currentTask.team_id) {
      teams.every(team => {
        if (currentTask.team_id === team.id) {
          setSelectedTeam({ ...team, supervisor_id: currentTask.staff_id });
          setSupervisorId(currentTask.staff_id);
          setTeamManageCleaners(currentTask.task_team_members);
          return false;
        }

        return true;
      });
      // useEffect(() => {
      // })

    }
    setTeamModalOpen(true);
  }

  function closeTeamSelectionModal() {
    setTeamModalOpen(false);
    setSelectedTeam({});
    setSupervisorId(null);
    setTeamManageCleaners([]);
  }

  // --- TEAM SELECTION MODAL ---
  function TeamSelectionModal() {
    // debugger;

    
    function handleTeamSelectedModalSave() {
      // TODO: save handle, update main state variables
      setTeamModalOpen(false);
      setCurrentTask(t => ({
        ...t, 
        staff_id: supervisorId, 
        team_id: selectedTeam.id,
        task_team_members: teamManageCleaners
      }))
      // setManageCleaners(teamManageCleaners);
    }


    return (
      <Modal open={teamModalOpen} title="Select Team" onClose={closeTeamSelectionModal}>
        <div style={{display:'flex', flexDirection:'column', gap:12, minWidth:340}}>
          <div>
            <strong>Teams</strong>
            <div>
              {(teams).map(team => (
                <label key={team.id} style={{display:'flex',alignItems:'center',gap:6}}>
                  <input type="radio"
                    checked={selectedTeam ? selectedTeam.id === team.id : false}
                    onChange={()=>{
                      setSelectedTeam(team);
                      setSupervisorId(team.supervisor_id);
                      setTeamManageCleaners(
                        teamMembers.filter(arr => {
                          if (arr.team_id == team.id) {
                            return true;
                          }

                          return false;
                        }).map(arr => arr.staff_id)
                      )
                      // setCurrentTask(f=>(
                      //   {
                      //     ...f, 
                      //     staff_id:team.supervisor_id,
                      //   }
                      // ))
                      // setManageCleaners(
                      //   teamMembers.filter(arr => {
                      //     if (arr.team_id == team.id) {
                      //       return true;
                      //     }

                      //     return false;
                      //   }).map(arr => arr.staff_id)
                      // );
                    }}
                  />
                  {team.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <strong>Supervisors</strong>
            <div>
              {staffs.filter(t => t.role === 'Supervisor').map(staff =>
                <label key={staff.id} style={{display:'flex',alignItems:'center',gap:6}}>
                  <input type="radio"
                    checked={staff.id === supervisorId}
                    onChange={()=>setSupervisorId(staff.id)}
                  />
                  {staff.name}
                </label>
              )}
            </div>
          </div>
          <div>
            <strong>Staff</strong>
            <div>
              {staffs.map(s => {
                const isSelected = teamManageCleaners.some(tm => tm === s.id);
                return (
                  <label key={s.id} style={{display:'flex',alignItems:'center',gap:6}}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => {
                        if (e.target.checked) {
                          // Add to manageCleaners if not present
                          setTeamManageCleaners(arr => [...new Set([...arr, s.id])]);
                        } else {
                          // Remove from manageCleaners
                          setTeamManageCleaners(arr => arr.filter(id => id !== s.id));
                        }
                      }}
                    />
                    {s.name}
                  </label>
                );
              })}
            </div>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className='btn' onClick={closeTeamSelectionModal}>Cancel</button>
            <button className='btn primary' onClick={handleTeamSelectedModalSave}>Select Team</button>
          </div>
        </div>
      </Modal>
    );
  }

  // Manage Staff Modal Opener
  function openManageStaffModal() {
    if (currentTask.staff_id || currentTask.task_team_members?.length > 0) {
      if (currentTask.staff_id) {
        setManageStaffModalSupervisor(currentTask.staff_id);
      }
  
      if (currentTask.task_team_members?.length > 0) {
        setManageStaffModalCleaners(currentTask.task_team_members);

      }
      // useEffect(() => {
      // })
    }

    setManageStaffModalOpen(true);
  }

  function closeManageStaffModal() {
    setManageStaffModalOpen(false);
    setManageStaffModalSupervisor(null);
    setManageStaffModalCleaners([]);
  }

  // --- Staff Selection Modal ---
  function ManageStaffModal() {
    if (!manageStaffModalOpen) {
      return null;
    }

    // if (currentTask.assignment_type) {
    //   setManageTab(currentTask.assignment_type);
    // }
    
    function onSaveManageStaffModal() {
      // TODO: on save: update all main variables
      setCurrentTask(t => ({
        ...t, 
        staff_id: manageStaffModalSupervisor,
        task_team_members: manageStaffModalCleaners
      }));
      
      // setManageCleaners(manageStaffModalCleaners);

      setManageStaffModalOpen(false);
    }

    return (
      <Modal open={manageStaffModalOpen} title={"Manage Staff Assignment"} onClose={closeManageStaffModal}>
        <div style={{minWidth:400, padding:10}}>
          {(
            <div>
              <div>
                <strong>Supervisors</strong>
                <div style={{marginBottom:8}}>
                  <select
                    value={manageStaffModalSupervisor || ""}
                    onChange={e=>setManageStaffModalSupervisor(e.target.value)}
                    style={{width:'100%'}}
                  >
                    <option value="">Select Supervisor</option>
                    {staffs.filter(s=>s.role==='Supervisor').map(s=>
                      <option key={s.id} value={s.id}>{s.name}</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <strong>Cleaners</strong>
                <div>
                  {staffs.map(s=>(
                    <label key={s.id} style={{display:'flex',alignItems:'center',gap:6}}>
                      <input
                        type="checkbox"
                        checked={manageStaffModalCleaners.includes(s.id)}
                        onChange={e => {
                          if (e.target.checked) setManageStaffModalCleaners(arr => [...arr, s.id]);
                          else setManageStaffModalCleaners(arr => arr.filter(id => id !== s.id));
                        }}
                      />{s.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
            <button className="btn" onClick={closeManageStaffModal} disabled={manageLoading}>Cancel</button>
            <button className="btn primary" onClick={onSaveManageStaffModal} disabled={manageLoading}>Save</button>
          </div>
        </div>
      </Modal>
    );
  }

  // --- LOCATION SELECTION MODAL ---

  function openLocationSelectionModal() {

    setLocationSearchText('');
    setLocationSearchResults([]);
    setSelectedLocationPlace(null);
    setLocationUnitNo('');
    setlocationComment('');
    setLocationRadiusMeter(100);
    setLocationLoadingDelete({});
    setLocationPickedExistingId(null);

    setLocationModalOpen(true);
  }

  function LocationSelectionModal() {
    const existingLocationMatches = useMemo(() => {
      const q = locationSearchText.trim().toLowerCase();
      if (!q) return [];
      return locations
        .filter(l =>
          (l.title && String(l.title).toLowerCase().includes(q)) ||
          (l.address && String(l.address).toLowerCase().includes(q))
        )
        .slice(0, 12);
    }, [locationSearchText, locations]);

    function buildPlaceFromSavedLocation(loc) {
      const lat = Number(loc.lat);
      const lng = Number(loc.lng);
      return {
        name: loc.title || '',
        formatted_address: loc.address || '',
        geometry: {
          location: {
            lat: () => lat,
            lng: () => lng
          }
        }
      };
    }

    function handleSelectExistingLocation(loc) {
      setLocationPickedExistingId(loc.id);
      setSelectedLocationPlace(buildPlaceFromSavedLocation(loc));
      setLocationUnitNo(loc.unit_no || '');
      setlocationComment(loc.comment || '');
      setLocationRadiusMeter(Number(loc.radius_meters) || 100);
      setLocationSearchText([loc.title, loc.address].filter(Boolean).join(' — '));
      setLocationSearchResults([]);
    }

    // Load Google Maps Places API
    useEffect(() => {
      if (!locationMapLoaded) {
        // debugger;
        loadGoogleMapsApi(GOOGLE_MAPS_API_KEY)
          .then(maps => {
            // debugger;
            setLocationMapLoaded(true)
          })
          .catch((err) => {
            debugger;;
            console.error('error while loading map', err);
          });
      }
    }, [locationMapLoaded]);

    // Update map marker/circle when place selected
    useEffect(() => {
      // debugger;
      if (locationMapLoaded && selectedLocationPlace && mapRef.current) {
        const maps = window.google.maps;
        const map = mapRef.current;
        if (markerRef.current) markerRef.current.setMap(null);
        if (circleRef.current) circleRef.current.setMap(null);
        const latlng = {lat: selectedLocationPlace.geometry.location.lat(), lng: selectedLocationPlace.geometry.location.lng()};
        markerRef.current = new maps.Marker({position:latlng, map});
        circleRef.current = new maps.Circle({
          map,
          center: latlng,
          radius: locationRadiusMeter,
          fillColor: '#1976d2',
          fillOpacity: 0.2,
          strokeColor: '#1976d2',
        });
        map.setCenter(latlng);
        map.setZoom(16);
      }
    }, [selectedLocationPlace, locationRadiusMeter, locationMapLoaded]);

    // Initialize map
    useEffect(() => {
      // debugger;
      if (locationMapLoaded && !mapRef.current && locationModalOpen) {
        const maps = window.google.maps;
        mapRef.current = new maps.Map(document.getElementById('location-map'), {
          center: {lat: -33.8688, lng: 151.2195},
          zoom: 13,
        });
      }
    }, [locationMapLoaded]);

    function handleSearch() {
      // debugger;
      if (!locationSearchText || !window.google || !window.google.maps) {
        return;
      }

      setLocationPickedExistingId(null);

      if (locationMapLoaded && !mapRef.current && locationModalOpen) {
        const maps = window.google.maps;
        mapRef.current = new maps.Map(document.getElementById('location-map'), {
          center: {lat: -33.8688, lng: 151.2195},
          zoom: 13,
        });
      }
      
      try {
        const service = new window.google.maps.places.PlacesService(mapRef.current);
        service.textSearch({query: locationSearchText}, (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            setLocationSearchResults(results);
          } else {
            console.error('Text search failed:', status);
            console.error('Text search failed:', results);
          }
        })
      } catch (err){
        debugger;
        console.error('Text search errored:', err);

      }

      
    }

    function handleSelectPlace(place) {
      setSelectedLocationPlace(place);
      setLocationSearchResults([]);
      setLocationPickedExistingId(null);
    }

    function handleLocationModalAdd(loc) {
      // setSelectedLocation(loc);
      setCurrentTask(f => ({
        ...f,
        location_id: loc.id,
      }));
      setLocationModalOpen(false);
    }

    function handleAddLocation() {
      if (locationPickedExistingId) {
        const existing = locations.find(l => l.id === locationPickedExistingId);
        if (existing) {
          handleLocationModalAdd(existing);
          return;
        }
      }

      const loc = {
        title: selectedLocationPlace?.name || '',
        address: selectedLocationPlace?.formatted_address || '',
        lat: selectedLocationPlace?.geometry.location.lat(),
        lng: selectedLocationPlace?.geometry.location.lng(),
        unit_no: locationUnitNo,
        radius_meters: locationRadiusMeter,
        comment: locationComment,
      };
    
      authFetch(`${VITE_KEY}/api/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loc),
      })
        .then(r => r.json())
        .then(newLoc => {
          handleLocationModalAdd(newLoc);
          return authFetch(`${VITE_KEY}/api/locations`);
        })
        .then(r => r.json())
        .then(setLocations)
        .catch(e => console.error('Add location error', e));
    }

    // --- Recent Locations Table ---
    // Sort by created_at DESC if available, else by array order (most recent first)
    let locationsSorted = [...locations];
    locationsSorted.sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      return 0;
    });
    const recentLocations = locationsSorted.slice(0, 10);

    async function handleDeleteLocation(locId) {
      setLocationLoadingDelete(ld => ({...ld, [locId]: true}));
      try {
        await authFetch(`${VITE_KEY}/api/locations/${locId}`, { method: 'DELETE' });
        // Refresh locations list
        authFetch(`${VITE_KEY}/api/locations`)
          .then(r => r.json())
          .then(setLocations)
          .catch(()=>{});
      } catch (e) {
        // ignore
      }
      setLocationLoadingDelete(ld => ({...ld, [locId]: false}));
    }

    useEffect(() => {
      if (locationModalOpen) {
        authFetch(`${VITE_KEY}/api/locations`)
          .then(r => r.json())
          .then(setLocations)
          .catch(e => console.error('Fetch locations error', e));
      }
    }, [locationModalOpen]);

    // if (!locationModalOpen) {
    //   return;
    // }

    return (
      <Modal open={locationModalOpen} title="Select Location" onClose={()=>setLocationModalOpen(false)}>
        <div style={{display:'flex', flexDirection:'column', gap:10, minWidth:400}}>
          <div>
            <input
              type="text"
              placeholder="Search saved locations or find a place"
              value={locationSearchText}
              onChange={e => {
                setLocationSearchText(e.target.value);
                setLocationPickedExistingId(null);
              }}
              style={{width:'70%'}}
            />
            <button className="btn" onClick={handleSearch} style={{marginLeft:8}}>Search maps</button>
          </div>
          {locationSearchText.trim() && existingLocationMatches.length > 0 && (
            <div style={{marginBottom:4}}>
              <div style={{fontSize:12, fontWeight:600, color:'#374151', marginBottom:6}}>Matching saved locations</div>
              <div style={{maxHeight:140, overflowY:'auto', border:'1px solid #bfdbfe', borderRadius:6, background:'#f8fafc'}}>
                {existingLocationMatches.map(loc => (
                  <div
                    key={loc.id}
                    role="button"
                    tabIndex={0}
                    style={{padding:'8px 10px', cursor:'pointer', borderBottom:'1px solid #e5e7eb'}}
                    onClick={() => handleSelectExistingLocation(loc)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') handleSelectExistingLocation(loc);
                    }}
                  >
                    <span style={{fontSize:11, fontWeight:700, color:'#1d4ed8', marginRight:8}}>Saved</span>
                    <span style={{fontWeight:500}}>{loc.title || '—'}</span>
                    <span style={{fontSize:12, color:'#64748b', display:'block'}}>{loc.address || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {locationPickedExistingId && (
            <div style={{fontSize:12, color:'#0369a1', background:'#e0f2fe', padding:'8px 10px', borderRadius:6, border:'1px solid #7dd3fc'}}>
              <strong>Saved location selected.</strong> Editing unit, comment, radius, or search text will create a <strong>new</strong> location for this task.
            </div>
          )}
          {locationSearchResults.length > 0 && (
            <div style={{maxHeight:120, overflowY:'auto', border:'1px solid #ddd', marginBottom:8}}>
              <div style={{fontSize:11, color:'#6b7280', padding:'4px 6px'}}>Map search results</div>
              {locationSearchResults.map((r, idx) => (
                <div
                  key={idx}
                  style={{padding:6, cursor:'pointer'}}
                  onClick={()=>handleSelectPlace(r)}
                >{r.name} <span style={{fontSize:11, color:'#888'}}>{r.formatted_address}</span></div>
              ))}
            </div>
          )}
          <div style={{display:'flex', gap:8}}>
            <input
              type="text"
              placeholder="Unit No"
              value={locationUnitNo}
              onChange={e => {
                setLocationUnitNo(e.target.value);
                setLocationPickedExistingId(null);
              }}
              style={{width:'30%'}}
            />
            <input
              type="text"
              placeholder="Location Comment"
              value={locationComment}
              onChange={e => {
                setlocationComment(e.target.value);
                setLocationPickedExistingId(null);
              }}
              style={{width:'60%'}}
            />
            <input
              type="number"
              min={10}
              max={1000}
              step={10}
              placeholder="Radius (m)"
              value={locationRadiusMeter}
              onChange={e => {
                setLocationRadiusMeter(Number(e.target.value));
                setLocationPickedExistingId(null);
              }}
              style={{width:'25%'}}
            />
          </div>
          <div id="location-map" style={{width:'100%',height:220,margin:'8px 0',border:'1px solid #bbb'}}></div>
          {/* Recent Locations Table */}
          <div style={{marginTop:16}}>
            <div style={{fontWeight:'bold', fontSize:16, marginBottom:6}}>Recent Locations (Last 10 Used)</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
                <thead>
                  <tr style={{background:'#eee'}}>
                    <th style={{padding:'6px 8px', textAlign:'left'}}>Unit No</th>
                    <th style={{padding:'6px 8px', textAlign:'left'}}>Address</th>
                    <th style={{padding:'6px 8px', textAlign:'left'}}>Radius (m)</th>
                    <th style={{padding:'6px 8px', textAlign:'left'}}>Comment</th>
                    <th style={{padding:'6px 8px', textAlign:'center'}}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLocations.map((loc, idx) => (
                    <tr key={loc.id}
                      style={{
                        background: idx % 2 === 0 ? '#f9f9f9' : '#fff'
                      }}
                    >
                      <td style={{padding:'6px 8px'}}>{loc.unit_no || '-'}</td>
                      <td style={{padding:'6px 8px'}}>{(loc.title + '\n' + loc.address) || '-'}</td>
                      <td style={{padding:'6px 8px'}}>{loc.radius_meters || '-'}</td>
                      <td style={{padding:'6px 8px'}}>{loc.comment || '-'}</td>
                      <td style={{padding:'6px 8px', textAlign:'center', minWidth:90}}>
                        <button
                          className="btn"
                          title="Use this location"
                          style={{background:'#16a34a', color:'#fff', padding:'2px 8px', borderRadius:4, marginRight:6, fontSize:18, border:'none', cursor:'pointer'}}
                          onClick={()=>handleLocationModalAdd(loc)}
                        >✅</button>
                        <button
                          className="btn"
                          title="Delete this location"
                          style={{background:'#dc2626', color:'#fff', padding:'2px 8px', borderRadius:4, fontSize:18, border:'none', cursor:'pointer'}}
                          disabled={locationLoadingDelete[loc.id]}
                          onClick={()=>handleDeleteLocation(loc.id)}
                        >❌</button>
                      </td>
                    </tr>
                  ))}
                  {recentLocations.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{padding:'8px', textAlign:'center', color:'#888'}}>No locations found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn" onClick={()=>setLocationModalOpen(false)}>Cancel</button>
            <button
              className="btn primary"
              onClick={handleAddLocation}
              disabled={!selectedLocationPlace}
            >
              {locationPickedExistingId ? 'Use this location' : 'Add location'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // --- TASK EDIT VIEW MODAL ---

  // --- Recurring Roster State ---
  const [recurringSettings, setRecurringSettings] = useState([]);
  const [childTasks, setChildTasks] = useState([]);
  // --- EditTaskModal with ManageModal integration ---

  function openEditTaskModal(taskObj) {

    setTaskModalMainTab('Shift Detail');
    setTaskModalEditTab('Shift');
    setShowInlineTaskMap(false);
    setReportStaffTravelRows([]);
    setReportStaffTravelLoading(false);
    setReportStaffTravelSaving(false);
    setReportStaffTravelError('');
    setReportTravelCalculating(false);
    setReportStaffTravelLoadedTaskId(null);

    
    setEditInstructionInput('');
    setEditInstructionInputRespType('text');
    setEditingInstructionId(null);
    
    // set current task and clear previous selcted modal variables
    // Load instructions for the currently selected task (if one exists)
    // Bring instructions for selected task
    debugger;
    // if (currentTask && currentTask.id) {
    if (taskObj && taskObj.id) {
      authFetch(`${VITE_KEY}/api/task_instructions/${taskObj.id}`)
        .then(r => r.json())
        .then(list => {
          const nextInstructions = Array.isArray(list) ? (list || []) : [];
          setEditInstructions(nextInstructions);
          syncTaskInstructionState(taskObj.id, nextInstructions);
        })
        .catch(() => {
          setEditInstructions([]);
          syncTaskInstructionState(taskObj.id, []);
        });

        authFetch(`${VITE_KEY}/api/task_comments/${taskObj.id}`)
        .then(r => r.json())
        .then(list => {
          if (Array.isArray(list)) {
            setTaskMessages(list || []);
          } else {
            setTaskMessages([]);
          }
        })
        .catch(() => setTaskMessages([]));
    } else {
      setEditInstructions([]);
      setTaskMessages([]);
    }

    // Shift Timer logic
    if (taskObj && taskObj.started_at && !taskObj.stopped_at) {
      const diff = Math.floor((Date.now() - new Date(taskObj.started_at).getTime()) / 1000);
      setShiftTimerSeconds(diff > 0 ? diff : 0);
      if (shiftTimerRef.current) clearInterval(shiftTimerRef.current);
      shiftTimerRef.current = setInterval(() => {
        setShiftTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      if (shiftTimerRef.current) clearInterval(shiftTimerRef.current);
      setShiftTimerSeconds(0);
    }

    setEditModalOpen(true);
  }

  function closeEditTaskModal() {
    setEditModalOpen(false);
    setReportStaffTravelRows([]);
    setReportStaffTravelLoading(false);
    setReportStaffTravelSaving(false);
    setReportStaffTravelError('');
    setReportTravelCalculating(false);
    setReportStaffTravelLoadedTaskId(null);
    // refreshTasksForCurrentRange().catch((err) => {
    //   console.error('Error Occurred in closeEditTaskModal', err);
    //   showToast(typeof arguments[1] === 'string' ? arguments[1] : (arguments[0]?.message || 'Error occurred'));
    // });
  }

  function EditTaskModal() {    
    if (!currentTask) {
      return null;
    }

    const reportTravelBusy = reportTravelCalculating || reportStaffTravelLoading || reportStaffTravelSaving;


    // Helper function for updating shift fields
    function handleShiftUpdate(changes) {
      const updated = {...currentTask, ...changes};
      setCurrentTask(updated);
      
    }

    async function handleSaveShiftModal() {
      setManageLoading(true);
      try {
        const response = await authFetch(`${VITE_KEY}/api/tasks/${currentTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentTask),
        });

        if (!response.ok) {
          throw new Error(await getResponseError(response, 'Failed to update shift'));
        }

        const updatedTask = await readJsonOrFallback(response, {});
        const mergedTask = {
          ...currentTask,
          ...updatedTask,
          task_team_members: currentTask.task_team_members || [],
          task_team_members_name: currentTask.task_team_members_name || [],
        };
        const previousTask = tasks.find(task => task.id === currentTask.id) || currentTask;
        const syncedTravel = await syncAffectedTaskTravel([previousTask, mergedTask], tasks, currentTask.id);

        if (syncedTravel.focusedTask) {
          setCurrentTask(syncedTravel.focusedTask);
        }
        setEditModalOpen(false);

        refreshTasksForCurrentRange().catch((err) => {
          console.error('Error Occurred in closeEditTaskModal', err);
          showToast(err.message || 'Error occurred');
        });
      } catch (err) {
        console.error('Update shift error', err);
        setEditModalOpen(false);
      } finally {
        setManageLoading(false);
      }
    }

    async function handleSaveTimeTracking() {
      if (!currentTask?.id) return;

      setManageLoading(true);
      try {
        const response = await authFetch(`${VITE_KEY}/api/tasks/${currentTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            started_at: currentTask.started_at || null,
            stopped_at: currentTask.stopped_at || null,
          }),
        });

        if (!response.ok) {
          throw new Error(await getResponseError(response, 'Failed to update time tracking'));
        }

        const updatedTask = await readJsonOrFallback(response, {});
        const mergedTask = {
          ...currentTask,
          ...updatedTask,
          task_team_members: currentTask.task_team_members || [],
          task_team_members_name: currentTask.task_team_members_name || [],
        };

        setCurrentTask(mergedTask);
        setTasks(prevTasks => replaceTaskInList(prevTasks, mergedTask));
        showToast('Time tracking updated', '#16a34a');
      } catch (err) {
        console.error('Update time tracking error', err);
        showToast(err.message || 'Failed to update time tracking');
      } finally {
        setManageLoading(false);
      }
    }

    // Instructions Handlers
    function instructionsResponseLabel(rt) {
      if (!rt) return '';
      if (rt === 'ok') return 'OK';
      if (rt === 'yesno') return 'Yes/No';
      return 'Text';
    }

    async function handleAddInstruction(e) {
      e.preventDefault();
      if (!currentTask || !currentTask.id) return;
      if (editInstructions.length >= 1) {
        showToast('Only one instruction is allowed for this shift.');
        return;
      }
      const payload = { task_id: currentTask.id, ques: editInstructionInput, resp_type: editInstructionInputRespType };
      try {
        const res = await authFetch(`${VITE_KEY}/api/task_instructions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const newInst = await res.json();
        const nextInstructions = [...editInstructions, newInst];
        setEditInstructions(nextInstructions);
        syncTaskInstructionState(currentTask.id, nextInstructions);
        setEditInstructionInput('');
        setEditInstructionInputRespType('text');
      } catch (err) {
        console.error('Add instruction error', err);
        showToast(typeof arguments[1] === 'string' ? arguments[1] : (arguments[0]?.message || 'Error occurred'));
      }
    }

    async function handleStartEditInstruction(id) {
      setEditingInstructionId(id);
    }

    function handleCancelEdit() {
      setEditingInstructionId(null);
      // reload from server to reset any temporary edits
      if (currentTask && currentTask.id) {
        debugger;
        authFetch(`${VITE_KEY}/api/task_instructions/${currentTask.id}`)
          .then(r => r.json())
          .then(list => {
            const nextInstructions = Array.isArray(list) ? (list || []) : [];
            setEditInstructions(nextInstructions);
            syncTaskInstructionState(currentTask.id, nextInstructions);
          })
          .catch(() => {});
      }
    }

    function handleEditField(id, field, value) {
      setEditInstructions(arr => arr.map(it => it.id === id ? { ...it, [field]: value } : it));
    }

    async function handleSaveEditedInstruction(id) {
      const inst = editInstructions.find(i => i.id === id);
      if (!inst) return;
      try {
        const res = await authFetch(`${VITE_KEY}/api/task_instructions/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inst)
        });
        const updated = await res.json();
        const nextInstructions = editInstructions.map(i => i.id === id ? updated : i);
        setEditInstructions(nextInstructions);
        syncTaskInstructionState(currentTask?.id, nextInstructions);
        setEditingInstructionId(null);
      } catch (err) {
        console.error('Update instruction error', err);
        showToast(typeof arguments[1] === 'string' ? arguments[1] : (arguments[0]?.message || 'Error occurred'));
      }
    }

    async function handleDeleteInstruction(id) {
      if (!confirm('Delete instruction?')) return;
      try {
        await authFetch(`${VITE_KEY}/api/task_instructions/${id}`, { method: 'DELETE' });
        const nextInstructions = editInstructions.filter(i => i.id !== id);
        setEditInstructions(nextInstructions);
        syncTaskInstructionState(currentTask?.id, nextInstructions);
      } catch (err) {
        console.error('Delete instruction error', err);
        showToast(typeof arguments[1] === 'string' ? arguments[1] : (arguments[0]?.message || 'Error occurred'));
      }
    }

    // const refreshCalendar = () => {
    //   // Trigger a global event to reload tasks everywhere
    //   window.dispatchEvent(new CustomEvent("refreshCalendar"));
    // };

    // Instructions Handlers Ends

    // ---- Manage Modal logic ----

    // Load recurring children for roster tab
    async function loadRecurringChildren(taskId) {
      const res = await authFetch(`${VITE_KEY}/api/recurring/${taskId}`);
      const data = await res.json();
      setRecurringSettings(data.row || []);
      setChildTasks(data.children || []);
    }

    useEffect(() => {
      if (editModalOpen && currentTask && currentTask.id) {
        loadRecurringChildren(currentTask.id);
      }
    }, [editModalOpen, currentTask && currentTask.id]);

    const getDateValue = (value) => (value ? dayjs(value).format('YYYY-MM-DD') : '');
    const getTimeValue = (value) => (value ? dayjs(value).format('HH:mm') : '');
    const buildIso = (dateText, timeText) => {
      if (!dateText || !timeText) return null;
      return dayjs(`${dateText}T${timeText}`).toISOString();
    };
    const readOnlyTimeTrackingInputStyle = {
      background: '#f9fafb',
      color: '#6b7280',
      cursor: 'not-allowed',
    };
    const scheduledMinutes = (currentTask.start_time && currentTask.end_time)
      ? Math.max(0, dayjs(currentTask.end_time).diff(dayjs(currentTask.start_time), 'minute'))
      : 0;
    const loggedMinutes = (currentTask.started_at && currentTask.stopped_at)
      ? Math.max(0, dayjs(currentTask.stopped_at).diff(dayjs(currentTask.started_at), 'minute'))
      : (currentTask.started_at ? Math.floor(shiftTimerSeconds / 60) : 0);
    const payMinutes = Math.min(scheduledMinutes, loggedMinutes);
    const formatMinutesAsHHMMSS = (mins) => {
      const safeMinutes = Math.max(0, Number(mins) || 0);
      const hours = Math.floor(safeMinutes / 60);
      const minutes = safeMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    };

    return (
      <Modal
        open={editModalOpen}
        title="Edit Shift"
        onClose={closeEditTaskModal}
        modalStyle={{ width: '80vw', maxWidth: '80vw' }}
      >
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {/* Top Tabs */}
          <div style={{
            display:'flex',
            justifyContent:'center',
            gap:24,
            background:'#f9fafb',
            borderRadius:8,
            padding:'8px 0'
          }}>
            {['Shift Detail','Repeat','Roster'].map(tab => (
              <button
                key={tab}
                onClick={() => setTaskModalMainTab(tab)}
                style={{
                  background: taskModalMainTab === tab ? '#eef2ff' : 'transparent',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 6,
                  fontWeight: taskModalMainTab === tab ? '600' : '500',
                  color: taskModalMainTab === tab ? '#4338ca' : '#374151',
                  cursor: 'pointer'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Main Content */}
          {taskModalMainTab === 'Shift Detail' && (
            <div style={{display:'flex', minHeight:400, gap:20}}>
              {/* Left Panel Tabs */}
              <div style={{
                width:'22%',
                background:'#f8fafc',
                borderRight:'1px solid #e5e7eb',
                display:'flex',
                flexDirection:'column',
                gap:12,
                padding:'16px 0'
              }}>
                {['Shift','Client','Instruction','Report'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setTaskModalEditTab(tab)}
                    style={{
                      background: taskModalEditTab === tab ? '#eef2ff' : 'transparent',
                      border: 'none',
                      borderLeft: taskModalEditTab === tab ? '3px solid #6366f1' : '3px solid transparent',
                      textAlign:'left',
                      padding:'10px 20px',
                      color: taskModalEditTab === tab ? '#4338ca' : '#374151',
                      fontWeight: taskModalEditTab === tab ? '600' : '500',
                      cursor:'pointer'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Right Panel Content */}
              <div style={{flex:1, padding:'8px 12px'}}>
                {taskModalEditTab === 'Shift' && (
                  <div style={{display:'flex', flexDirection:'column', gap:16}}>
                    {/* Assignment Mode */}
                    {currentTask.team_id ? (
                      <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:12, marginBottom:8}}>
                        <div style={{fontWeight:'bold', marginBottom:4}}>Team Assignment</div>
                        <div style={{marginBottom:6}}>
                          <span style={{fontWeight:500}}>Supervisor: </span>
                          {currentTask.staff_id ?
                            staffs.find(s => s.id === currentTask.staff_id)?.name || '-'
                            : '-'
                          }
                        </div>
                        <div style={{marginBottom:6}}>
                          <span style={{fontWeight:500}}>Team Members:</span>
                          <ul style={{margin:0, paddingLeft:18}}>
                            {/* {teamMembers.filter(tm=>tm.team_id===currentTask.team_id).map(tm=>{
                              const s = staff.find(st=>st.id===tm.staff_id);
                              if (!s) return null;
                              return <li key={s.id}>{s.name} <span style={{color:'#888',fontSize:11}}>({s.role})</span></li>;
                            })} */}

                            {currentTask.task_team_members?.length > 0
                            ? currentTask.task_team_members
                                .map(id => staffs.find(s => s.id === id)?.name || '')
                                .filter(name => name)
                                .join(', ')
                            : '-'}
                          </ul>
                        </div>
                        <button className="btn" onClick={openTeamSelectionModal}>Manage Team</button>
                      </div>
                    ) : (
                      <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:12, marginBottom:8}}>
                        <div style={{fontWeight:'bold', marginBottom:4}}>Individual Assignment</div>
                        <div style={{marginBottom:6}}>
                          <span style={{fontWeight:500}}>Supervisor: </span>
                          {staffs.find(s => s.id === (currentTask.staff_id))?.name || ''}
                        </div>
                        <div style={{marginBottom:6}}>
                          <span style={{fontWeight:500}}>Cleaner: </span>
                          {currentTask.task_team_members?.length > 0
                            ? currentTask.task_team_members
                                .map(id => staffs.find(s => s.id === id)?.name || '')
                                .filter(name => name)
                                .join(', ')
                            : '-'}
                        </div>
                        <button className="btn" onClick={openManageStaffModal}>Manage Staff</button>
                      </div>
                    )}

                    {/* Schedule Settings */}
                    <div style={{display:'flex', gap:16, alignItems:'flex-end'}}>
                      <label style={{flex:1}}>
                        Date
                        <input
                          type="date"
                          value={dayjs(currentTask.start_time).format('YYYY-MM-DD')}
                          onChange={e => {
                            const newDate = e.target.value;
                            const start = dayjs(newDate + 'T' + dayjs(currentTask.start_time).format('HH:mm')).toISOString();
                            const end = dayjs(newDate + 'T' + dayjs(currentTask.end_time).format('HH:mm')).toISOString();
                            handleShiftUpdate({ start_time: start, end_time: end });
                          }}
                          style={{width:'100%', marginTop:4}}
                        />
                      </label>
                      <label style={{flex:1}}>
                        Time
                        <input
                          type="time"
                          value={dayjs(currentTask.start_time).format('HH:mm')}
                          onChange={e => {
                            const date = dayjs(currentTask.start_time).format('YYYY-MM-DD');
                            const t = e.target.value;
                            const dur = dayjs(currentTask.end_time).diff(dayjs(currentTask.start_time), 'minute');
                            const start = dayjs(date + 'T' + t).toISOString();
                            const end = dayjs(date + 'T' + t).add(dur, 'minute').toISOString();
                            handleShiftUpdate({ start_time: start, end_time: end });
                          }}
                          style={{width:'100%', marginTop:4}}
                        />
                      </label>
                      <label style={{flex:1}}>
                        Duration (min)
                        <input
                          type="number"
                          min={10}
                          max={480}
                          value={dayjs(currentTask.end_time).diff(dayjs(currentTask.start_time), 'minute')}
                          onChange={e => {
                            const dur = Number(e.target.value);
                            const end = dayjs(currentTask.start_time).add(dur, 'minute').toISOString();
                            handleShiftUpdate({ end_time: end });
                          }}
                          style={{width:'100%', marginTop:4}}
                        />
                      </label>
                    </div>

                    {/* Location Settings */}
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span>Location:</span>
                      <button className="btn" onClick={openLocationSelectionModal} type="button">
                        {'Select Location'}
                      </button>
                    </div>
                    {currentTask.location_id && (() => {
                      const loc = locations.find(l => l.id === currentTask.location_id);
                      if (!loc) return null;
                      return (
                        <div style={{
                          background: '#fee2e2',
                          border: '1px solid #fecaca',
                          padding: '16px',
                          borderRadius: '8px',
                          marginTop: '8px'
                        }}>
                          <div style={{fontWeight: '600', color: '#b91c1c', marginBottom: '8px'}}>
                            • Current Location
                          </div>

                          <div style={{display:'flex', flexDirection:'column', gap:'4px', color:'#374151'}}>
                            <div><strong>Unit:</strong> {loc.unit_no || '-'}</div>
                            <div><strong>Location:</strong> {loc.title || '-'}</div>
                            <div><strong>Address:</strong> {loc.address || '-'}</div>
                            <div><strong>Accuracy:</strong> {loc.radius_meters ? `${loc.radius_meters} m` : '-'}</div>
                            <div><strong>Comment:</strong> {loc.comment || '-'}</div>
                          </div>
                        </div>
                      );
                    })()}
                    

                    {/* Publish / Geofencing Options */}
                    <div style={{marginTop:8, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
                      <label style={{display:'flex', alignItems:'center', gap:8}}>
                        <input
                          type="checkbox"
                          checked={!!currentTask.publish}
                          onChange={e => handleShiftUpdate({ publish: e.target.checked ? 1 : 0 })}
                        />
                        Publish
                      </label>
                      <label style={{display:'flex', alignItems:'center', gap:8}}>
                        <input
                          type="checkbox"
                          checked={!!currentTask.isLocation}
                          onChange={e => handleShiftUpdate({ isLocation: e.target.checked })}
                        />
                        Location
                      </label>
                    </div>



                  </div>
                )}

                {taskModalEditTab === 'Client' && (
                  <div style={{display:'flex', flexDirection:'column', gap:20}}>

                    {/* Header Section */}
                    <div style={{
                      background:'#eef2ff',
                      padding:'14px 18px',
                      borderRadius:8,
                      border:'1px solid #c7d2fe'
                    }}>
                      <div style={{fontWeight:600, color:'#4338ca', fontSize:16}}>
                        Client Assignment
                      </div>
                      <div style={{fontSize:13, color:'#6b7280', marginTop:4}}>
                        Choose a client template for this shift
                      </div>

                      <select
                        value={currentTask.client_id || ""}
                        onChange={e => {
                          const selected = clients.find(c => c.id === (e.target.value));
                          debugger;

                          if (selected) {
                            handleShiftUpdate({
                              client_id: selected.id,

                              task_client_name: selected.client_name || "",
                              task_client_phone: selected.phone || "",
                              task_client_email: selected.email || "",
                              task_client_company: selected.company || "",

                              task_client_abn: selected.abn || "",
                              task_client_acn: selected.acn || "",

                              task_client_instruction: selected.client_instruction || "",
                              task_client_information: selected.client_information || "",
                              task_client_property_information: selected.property_information || ""
                            });
                          }
                        }}
                        style={{
                          marginTop:12,
                          width:'100%',
                          padding:'10px',
                          borderRadius:6,
                          border:'1px solid #cbd5e1'
                        }}
                      >
                        <option value="">-- Select Client --</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.client_name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Warning Box */}
                    <div style={{
                      background:'#fef3c7',
                      border:'1px solid #fde68a',
                      padding:'12px 16px',
                      borderRadius:8,
                      color:'#92400e',
                      fontSize:14
                    }}>
                      <strong>Unsaved Changes Detected</strong><br/>
                      Your modifications are pending. Click Save Changes to apply them.
                    </div>

                    {/* Two-Column Client Fields */}
                    <div style={{
                      display:'grid',
                      gridTemplateColumns:'1fr 1fr',
                      gap:14
                    }}>
                      <label style={{display:'flex', flexDirection:'column'}}>
                        Client Name
                        <input
                          value={currentTask.task_client_name || ''}
                          onChange={e => handleShiftUpdate({ task_client_name: e.target.value })}
                          style={{marginTop:6, padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
                        />
                      </label>

                      <label style={{display:'flex', flexDirection:'column'}}>
                        Phone Number
                        <input
                          value={currentTask.task_client_phone || ''}
                          onChange={e => handleShiftUpdate({ task_client_phone: e.target.value })}
                          style={{marginTop:6, padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
                        />
                      </label>

                      <label style={{display:'flex', flexDirection:'column'}}>
                        Email Address
                        <input
                          value={currentTask.task_client_email || ''}
                          onChange={e => handleShiftUpdate({ task_client_email: e.target.value })}
                          style={{marginTop:6, padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
                        />
                      </label>

                      <label style={{display:'flex', flexDirection:'column'}}>
                        Company Name
                        <input
                          value={currentTask.task_client_company || ''}
                          onChange={e => handleShiftUpdate({ task_client_company: e.target.value })}
                          style={{marginTop:6, padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
                        />
                      </label>

                      <label style={{display:'flex', flexDirection:'column'}}>
                        ABN
                        <input
                          value={currentTask.task_client_abn || ''}
                          onChange={e => handleShiftUpdate({ task_client_abn: e.target.value })}
                          style={{marginTop:6, padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
                        />
                      </label>

                      <label style={{display:'flex', flexDirection:'column'}}>
                        ACN
                        <input
                          value={currentTask.task_client_acn || ''}
                          onChange={e => handleShiftUpdate({ task_client_acn: e.target.value })}
                          style={{marginTop:6, padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
                        />
                      </label>

                      <label style={{display:'flex', flexDirection:'column'}}>
                        Client Instructions
                        <textarea
                          value={currentTask.task_client_instruction || ''}
                          onChange={e => handleShiftUpdate({ task_client_instruction: e.target.value })}
                          rows={2}
                          style={{marginTop:6, padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
                        />
                      </label>

                      <label style={{display:'flex', flexDirection:'column'}}>
                        Client Information
                        <textarea
                          value={currentTask.task_client_information || ''}
                          onChange={e => handleShiftUpdate({ task_client_information: e.target.value })}
                          rows={2}
                          style={{marginTop:6, padding:'8px', borderRadius:6, border:'1px solid #d1d5db'}}
                        />
                      </label>
                    </div>

                    {/* Full Width Property Info */}
                    <label style={{display:'flex', flexDirection:'column'}}>
                      Property Information
                      <textarea
                        value={currentTask.task_client_property_information || ''}
                        onChange={e => handleShiftUpdate({ task_client_property_information: e.target.value })}
                        rows={3}
                        style={{
                          marginTop:6,
                          padding:'10px',
                          borderRadius:6,
                          border:'1px solid #d1d5db',
                          width:'100%'
                        }}
                      />
                    </label>

                  </div>
                )}

                {taskModalEditTab === 'Instruction' && (
                    <div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <strong>Instruction Management</strong>
                          <div style={{fontSize:13,color:'#6b7280'}}>Add and manage shift-specific instructions</div>
                        </div>
                        <div style={{fontSize:12,color:'#6b7280'}}>{editInstructions.length} instruction{editInstructions.length !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{marginTop:12}}>
                        <div style={{marginBottom:12}}>
                          <div style={{fontWeight:600, marginBottom:8}}>Existing Instructions</div>
                          <div style={{display:'flex',flexDirection:'column',gap:8}}>
                            {editInstructions.length === 0 && (
                              <div style={{color:'#888'}}>No instructions for this shift.</div>
                            )}
                            {editInstructions.map(inst => (
                              <div key={inst.id} style={{border:'1px solid #e6e6e6', padding:10, borderRadius:8, background:'#fff', display:'flex', flexDirection:'column', gap:8}}>
                                {editingInstructionId === inst.id ? (
                                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                                    <textarea value={inst.ques || ''} onChange={e=>handleEditField(inst.id, 'ques', e.target.value)} rows={2} style={{width:'100%',padding:8,borderRadius:6,border:'1px solid #d1d5db'}} />
                                    <div style={{display:'flex',gap:12,alignItems:'center'}}>
                                      <label style={{display:'flex',alignItems:'center',gap:6}}>
                                        <input type="radio" name={`resp_${inst.id}`} checked={inst.resp_type === 'ok'} onChange={()=>handleEditField(inst.id,'resp_type','ok')} /> OK
                                      </label>
                                      <label style={{display:'flex',alignItems:'center',gap:6}}>
                                        <input type="radio" name={`resp_${inst.id}`} checked={inst.resp_type === 'yesno'} onChange={()=>handleEditField(inst.id,'resp_type','yesno')} /> Yes/No
                                      </label>
                                      <label style={{display:'flex',alignItems:'center',gap:6}}>
                                        <input type="radio" name={`resp_${inst.id}`} checked={inst.resp_type === 'text'} onChange={()=>handleEditField(inst.id,'resp_type','text')} /> Text
                                      </label>
                                    </div>
                                    <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                                      <button className="btn" onClick={handleCancelEdit}>Cancel</button>
                                      <button className="btn primary" onClick={()=>handleSaveEditedInstruction(inst.id)}>Save</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                    <div style={{flex:1}}>
                                      <div style={{fontSize:12,color:'#6b7280',marginBottom:6}}>{inst.created_at || ''}</div>
                                      <div style={{padding:'10px',background:'#fafafa',borderRadius:6}}>{inst.ques}</div>
                                      <div style={{marginTop:6,fontSize:12,color:'#6b7280'}}>Response Type: <strong style={{marginLeft:6}}>{instructionsResponseLabel(inst.resp_type)}</strong></div>
                                    </div>
                                    <div style={{display:'flex',flexDirection:'column',gap:6,marginLeft:12}}>
                                      <button className="btn" onClick={()=>handleStartEditInstruction(inst.id)}>✏️ Edit</button>
                                      <button className="btn" onClick={()=>handleDeleteInstruction(inst.id)} style={{background:'#f8d7da',border:'1px solid #f5c6cb'}}>Delete</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {editInstructions.length === 0 ? (
                          <div style={{marginTop:12, padding:12, border:'1px solid #eaeaea', borderRadius:8, background:'#fff'}}>
                            <div style={{fontWeight:600, marginBottom:8}}>New Instruction</div>
                            <form onSubmit={handleAddInstruction}>
                              <textarea placeholder="Enter detailed instruction for this shift..." value={editInstructionInput} onChange={e=>setEditInstructionInput(e.target.value)} rows={4} style={{width:'100%',padding:10,borderRadius:8,border:'1px solid #bfc6ea'}} />

                              <div style={{marginTop:12}}>
                                <div style={{fontWeight:600, marginBottom:8}}>Response Type</div>
                                <div style={{display:'flex',gap:12,alignItems:'center'}}>
                                  <label style={{display:'flex',alignItems:'center',gap:6}}>
                                    <input type="radio" name="new_resp" checked={editInstructionInputRespType==='ok'} onChange={()=>setEditInstructionInputRespType('ok')} /> OK Confirmation
                                  </label>
                                  <label style={{display:'flex',alignItems:'center',gap:6}}>
                                    <input type="radio" name="new_resp" checked={editInstructionInputRespType==='yesno'} onChange={()=>setEditInstructionInputRespType('yesno')} /> Yes/No Question
                                  </label>
                                  <label style={{display:'flex',alignItems:'center',gap:6}}>
                                    <input type="radio" name="new_resp" checked={editInstructionInputRespType==='text'} onChange={()=>setEditInstructionInputRespType('text')} /> Text Response
                                  </label>
                                </div>
                              </div>

                              <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
                                <button className="btn primary" type="submit">Add Instruction</button>
                              </div>
                            </form>
                          </div>
                        ) : (
                          <div style={{marginTop:12, padding:12, border:'1px solid #eaeaea', borderRadius:8, background:'#f9fafb', color:'#6b7280'}}>
                            Only one instruction is allowed per shift. Edit or delete the existing instruction to replace it.
                          </div>
                        )}
                      </div>
                    </div>
                )}

                {taskModalEditTab === 'Report' && (
                  <div style={{display:'flex', flexDirection:'column', gap:12}}>

                    {/* Header */}
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div>
                        <h3 style={{margin:0}}>Shift Report</h3>
                        <div style={{fontSize:13,color:'#6b7280'}}>Track and adjust time entries</div>
                      </div>
                      <div style={{fontSize:12,color:'#6b7280'}}>
                        {currentTask && currentTask.id ? `Task: ${currentTask.task_name || currentTask.id}` : ''}
                      </div>
                    </div>

                    {/* Note */}
                    <div style={{background:'#f8fafc', padding:10, border:'1px solid #eef2ff', borderRadius:6, color:'#6b7280'}}>Note: Any change in this section will only affect the selected shift. Try Repeat for group change.</div>

                    {/* Scheduled Date & Time (editable) */}
                    {/* <div style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, background:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div>
                        <div style={{fontWeight:600, marginBottom:6}}>Date & Time</div>
                        {!reportEditMode ? (
                          <div style={{display:'flex', gap:24}}>
                            <div>
                              <div style={{fontSize:12,color:'#6b7280'}}>Date:</div>
                              <div>{currentTask && currentTask.start_time ? dayjs(currentTask.start_time).format('D MMMM YYYY') : '-'}</div>
                            </div>
                            <div>
                              <div style={{fontSize:12,color:'#6b7280'}}>Time:</div>
                              <div>{currentTask && currentTask.start_time ? `${dayjs(currentTask.start_time).format('HH:mm')} - ${dayjs(currentTask.end_time).format('HH:mm')}` : '-'}</div>
                            </div>
                          </div>
                        ) : (
                          <div style={{display:'flex', gap:12, alignItems:'flex-end'}}>
                            <label>
                              Date
                              <input type="date" value={currentTask && currentTask.start_time ? dayjs(currentTask.start_time).format('YYYY-MM-DD') : ''}
                                onChange={e=>{
                                  const d = e.target.value;
                                  if (!d) return;
                                  const startTime = currentTask.start_time ? dayjs(currentTask.start_time).format('HH:mm') : '09:00';
                                  const endTime = currentTask.end_time ? dayjs(currentTask.end_time).format('HH:mm') : '10:00';
                                  handleShiftUpdate({ start_time: dayjs(d + 'T' + startTime).toISOString(), end_time: dayjs(d + 'T' + endTime).toISOString() });
                                }}
                              />
                            </label>
                            <label>
                              Start Time
                              <input type="time" value={currentTask && currentTask.start_time ? dayjs(currentTask.start_time).format('HH:mm') : ''}
                                onChange={e=>{
                                  const t = e.target.value;
                                  if (!t) return;
                                  const date = currentTask.start_time ? dayjs(currentTask.start_time).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
                                  const dur = currentTask.start_time && currentTask.end_time ? dayjs(currentTask.end_time).diff(dayjs(currentTask.start_time), 'minute') : 60;
                                  const start = dayjs(date + 'T' + t);
                                  handleShiftUpdate({ start_time: start.toISOString(), end_time: start.add(dur, 'minute').toISOString() });
                                }}
                              />
                            </label>
                            <label>
                              End Time
                              <input type="time" value={currentTask && currentTask.end_time ? dayjs(currentTask.end_time).format('HH:mm') : ''}
                                onChange={e=>{
                                  const t = e.target.value;
                                  if (!t) return;
                                  const date = currentTask.end_time ? dayjs(currentTask.end_time).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
                                  const end = dayjs(date + 'T' + t);
                                  handleShiftUpdate({ end_time: end.toISOString() });
                                }}
                              />
                            </label>
                            <div style={{display:'flex', gap:8}}>
                              <button className="btn" onClick={()=>setReportEditMode(false)}>Cancel</button>
                              <button className="btn primary" onClick={handleSaveShiftModal}>Save</button>
                            </div>
                          </div>
                        )}
                      </div>
                      {!reportEditMode && (
                        <div>
                          <button className="btn" onClick={()=>setReportEditMode(true)}>✏️ Edit</button>
                        </div>
                      )}
                    </div> */}

                    
                    

                    {/* Time Tracking Section */}
                    <div style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, background:'#fff'}}>
                      <div style={{fontWeight:600, marginBottom:12}}>Time Tracking</div>
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:18}}>
                        <div>
                          <div style={{fontWeight:600, marginBottom:10}}>Scheduled</div>
                          <div style={{display:'grid', gridTemplateColumns:'70px 1fr 1fr', gap:10, alignItems:'center', marginBottom:10}}>
                            <label style={{display:'flex', alignItems:'center', gap:8}}>
                              <input type="radio" checked readOnly />
                              In
                            </label>
                            <input
                              type="date"
                              value={getDateValue(currentTask.start_time)}
                              disabled
                              style={readOnlyTimeTrackingInputStyle}
                            />
                            <input
                              type="time"
                              value={getTimeValue(currentTask.start_time)}
                              disabled
                              style={readOnlyTimeTrackingInputStyle}
                            />
                          </div>
                          <div style={{display:'grid', gridTemplateColumns:'70px 1fr 1fr', gap:10, alignItems:'center'}}>
                            <label style={{display:'flex', alignItems:'center', gap:8}}>
                              <input type="radio" checked readOnly />
                              Out
                            </label>
                            <input
                              type="date"
                              value={getDateValue(currentTask.end_time)}
                              disabled
                              style={readOnlyTimeTrackingInputStyle}
                            />
                            <input
                              type="time"
                              value={getTimeValue(currentTask.end_time)}
                              disabled
                              style={readOnlyTimeTrackingInputStyle}
                            />
                          </div>
                        </div>

                        <div>
                          <div style={{fontWeight:600, marginBottom:10}}>Logged</div>
                          <div style={{display:'grid', gridTemplateColumns:'70px 1fr 1fr', gap:10, alignItems:'center', marginBottom:10}}>
                            <label style={{display:'flex', alignItems:'center', gap:8}}>
                              <input type="radio" checked readOnly />
                              In
                            </label>
                            <input
                              type="date"
                              value={getDateValue(currentTask.started_at)}
                              onChange={(e) => {
                                const nextDate = e.target.value;
                                const nextTime = getTimeValue(currentTask.started_at) || '09:00';
                                const nextIso = buildIso(nextDate, nextTime);
                                if (nextIso) handleShiftUpdate({ started_at: nextIso });
                              }}
                            />
                            <input
                              type="time"
                              value={getTimeValue(currentTask.started_at)}
                              onChange={(e) => {
                                const nextDate = getDateValue(currentTask.started_at) || getDateValue(currentTask.start_time) || dayjs().format('YYYY-MM-DD');
                                const nextIso = buildIso(nextDate, e.target.value);
                                if (nextIso) handleShiftUpdate({ started_at: nextIso });
                              }}
                            />
                          </div>
                          <div style={{display:'grid', gridTemplateColumns:'70px 1fr 1fr', gap:10, alignItems:'center'}}>
                            <label style={{display:'flex', alignItems:'center', gap:8}}>
                              <input type="radio" checked readOnly />
                              Out
                            </label>
                            <input
                              type="date"
                              value={getDateValue(currentTask.stopped_at)}
                              onChange={(e) => {
                                const nextDate = e.target.value;
                                const nextTime = getTimeValue(currentTask.stopped_at) || '10:00';
                                const nextIso = buildIso(nextDate, nextTime);
                                if (nextIso) handleShiftUpdate({ stopped_at: nextIso });
                              }}
                            />
                            <input
                              type="time"
                              value={getTimeValue(currentTask.stopped_at)}
                              onChange={(e) => {
                                const nextDate = getDateValue(currentTask.stopped_at) || getDateValue(currentTask.started_at) || getDateValue(currentTask.start_time) || dayjs().format('YYYY-MM-DD');
                                const nextIso = buildIso(nextDate, e.target.value);
                                if (nextIso) handleShiftUpdate({ stopped_at: nextIso });
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:12, marginTop:14, alignItems:'end'}}>
                        <div>
                          <div style={{fontSize:12,color:'#6b7280'}}>Log Length</div>
                          <input value={formatMinutesAsHHMMSS(loggedMinutes)} readOnly />
                        </div>
                        <div>
                          <div style={{fontSize:12,color:'#6b7280'}}>Sch Length</div>
                          <input value={formatMinutesAsHHMMSS(scheduledMinutes)} readOnly />
                        </div>
                        <div>
                          <div style={{fontSize:12,color:'#6b7280'}}>Pay Length</div>
                          <input value={formatMinutesAsHHMMSS(payMinutes)} readOnly />
                        </div>
                        <button className="btn primary" onClick={handleSaveTimeTracking} disabled={manageLoading}>Update</button>
                      </div>
                    </div>

                    {/* Start Shift Section */}
                    <div style={{marginTop:8, borderRadius:8}}>
                      {/* Start: disabled when started_at or stopped_at. Stop (End Shift): disabled when stopped_at. */}
                      {(!currentTask.started_at && !currentTask.stopped_at) ? (
                        <div>
                          <button
                            className="btn primary"
                            disabled={!!currentTask.started_at || !!currentTask.stopped_at}
                            onClick={async ()=>{
                              // start shift locally and persist
                              const started = new Date().toISOString();
                              handleShiftUpdate({ started_at: started });
                              try {
                                await authFetch(`${VITE_KEY}/api/tasks/${currentTask.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...currentTask, started_at: started}) });
                              } catch(e){ console.error('start shift save error', e); }

                              // start timer UI
                              setShiftTimerSeconds(0);
                              if (shiftTimerRef.current) clearInterval(shiftTimerRef.current);
                              shiftTimerRef.current = setInterval(()=>{
                                setShiftTimerSeconds(s => s + 1);
                              }, 1000);
                            }}>▶ Start Shift</button>
                        </div>
                      ) : (currentTask.started_at && !currentTask.stopped_at) ? (
                        <div style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, background:'#fff'}}>
                          <div style={{fontWeight:600}}>Shift Started</div>
                          <div style={{fontSize:13,color:'#6b7280'}}>Shift started at {currentTask.started_at ? dayjs(currentTask.started_at).format('h:mm a') : '-'}</div>
                          <div style={{marginTop:8, display:'flex', gap:8}}>
                            <button className="btn" onClick={()=>{
                              // Pause: stop timer
                              if (shiftTimerRef.current) { clearInterval(shiftTimerRef.current); shiftTimerRef.current = null; }
                            }}>Pause</button>
                            <button
                              className="btn"
                              disabled={!!currentTask.stopped_at}
                              onClick={async ()=>{
                                // End shift: set stopped_at
                                const stopped = new Date().toISOString();
                                handleShiftUpdate({ stopped_at: stopped });
                                try {
                                  await authFetch(`${VITE_KEY}/api/tasks/${currentTask.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...currentTask, stopped_at: stopped}) });
                                } catch(e){ console.error('end shift save error', e); }
                                if (shiftTimerRef.current) { clearInterval(shiftTimerRef.current); shiftTimerRef.current = null; }
                              }}>End Shift</button>
                          </div>
                          <div style={{marginTop:10}}>
                            <div>Timer: <strong>{Math.floor(shiftTimerSeconds/3600)}:{String(Math.floor((shiftTimerSeconds%3600)/60)).padStart(2,'0')}:{String(shiftTimerSeconds%60).padStart(2,'0')}</strong></div>
                          </div>
                        </div>
                      ) : currentTask.stopped_at ? (
                        <div style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, background:'#f9fafb'}}>
                          <div style={{fontWeight:600, color:'#6b7280'}}>Shift completed</div>
                          <div style={{fontSize:13, color:'#6b7280', marginTop:4}}>Started at {currentTask.started_at ? dayjs(currentTask.started_at).format('h:mm a') : '-'}, ended at {dayjs(currentTask.stopped_at).format('h:mm a')}</div>
                          <div style={{marginTop:8}}>
                            <button className="btn primary" disabled>▶ Start Shift</button>
                            <span style={{marginLeft:8, fontSize:12, color:'#6b7280'}}>Start and End are disabled when shift is completed</span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {currentTask.location_id && !showInlineTaskMap && (
                      <button
                        className="btn"
                        style={{ marginTop: 10 }}
                        onClick={() => setShowInlineTaskMap(true)}
                      >
                        View Map
                      </button>
                    )}

                    {/* Travel Distance Section */}
                    <div style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, background:'#fff'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div style={{fontWeight:600}}>Travel Distance</div>
                        <div style={{display:'flex', gap:8}}>
                          <button className="btn" disabled={reportTravelBusy} onClick={handleCalculateReportStaffTravel}>🔄 Calculate</button>
                          <button className="btn" disabled={reportTravelBusy} onClick={()=>{
                            setTravelInfo({ distance_km: null, duration_min: null, from_location: null });
                          }}>Reset</button>
                        </div>
                      </div>

                      <div style={{display:'flex', gap:12, marginTop:10, alignItems:'end'}}>
                        <div style={{flex:1}}>From Location: {travelInfo.from_location ? (locations.find(l=>l.id===travelInfo.from_location)?.title || travelInfo.from_location) : (currentTask.travel_from ? (locations.find(l=>l.id===currentTask.travel_from)?.title || currentTask.travel_from) : 'No previous shift found on the same day')}</div>
                        <div style={{width:180}}>
                          <div style={{fontSize:12,color:'#6b7280'}}>Distance (km)</div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentTask.travel_dist ?? ''}
                            onChange={(e)=>handleShiftUpdate({ travel_dist: e.target.value })}
                          />
                        </div>
                        <div style={{width:180}}>
                          <div style={{fontSize:12,color:'#6b7280'}}>Duration (min)</div>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={currentTask.travel_duration ?? ''}
                            onChange={(e)=>handleShiftUpdate({ travel_duration: e.target.value })}
                          />
                        </div>
                        <button
                          className="btn primary"
                          disabled={reportTravelBusy}
                          onClick={async ()=>{
                            try {
                              setReportStaffTravelSaving(true);
                              setReportStaffTravelError('');
                              const syncedTravel = await syncTaskTravelDetails(currentTask, {
                                persistTask: true,
                                persistStaffTravel: true,
                                updateState: true,
                                supervisorOverride: {
                                  travel_from: currentTask.travel_from || null,
                                  travel_dist: currentTask.travel_dist === '' ? null : Number(currentTask.travel_dist),
                                  travel_duration: currentTask.travel_duration === '' ? null : Number(currentTask.travel_duration),
                                },
                              });
                              setCurrentTask(syncedTravel.task);
                              setReportStaffTravelRows(buildReportStaffTravelRows(syncedTravel.task, syncedTravel.staffTravelRecords));
                              setReportStaffTravelLoadedTaskId(currentTask.id);
                              showToast('Travel details updated', '#16a34a');
                            } catch (e) {
                              console.error('travel update error', e);
                              showToast('Failed to update travel details');
                            } finally {
                              setReportStaffTravelSaving(false);
                            }
                          }}
                        >
                          Save Travel
                        </button>
                      </div>

                      <div style={{marginTop:16, paddingTop:14, borderTop:'1px solid #eef2f7'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap'}}>
                          <div>
                            <div style={{fontWeight:600}}>Staff Travel</div>
                            <div style={{fontSize:12, color:'#6b7280'}}>
                              Loads only in the Report tab and updates `task_staff_travel` for this task.
                            </div>
                          </div>
                          <div style={{display:'flex', gap:8, alignItems:'center'}}>
                            {reportStaffTravelLoading && (
                              <span style={{fontSize:12, color:'#6b7280'}}>Loading staff travel...</span>
                            )}
                            {!reportStaffTravelLoading && reportStaffTravelSaving && (
                              <span style={{fontSize:12, color:'#6b7280'}}>Saving staff travel...</span>
                            )}
                            <button
                              className="btn"
                              disabled={reportTravelBusy}
                              onClick={() => loadReportStaffTravel(currentTask, { force: true })}
                            >
                              Refresh
                            </button>
                            <button
                              className="btn primary"
                              disabled={reportTravelBusy || reportStaffTravelRows.length === 0}
                              onClick={handleSaveReportStaffTravel}
                            >
                              Save Staff Travel
                            </button>
                          </div>
                        </div>

                        {reportStaffTravelError && (
                          <div style={{marginTop:10, padding:'8px 10px', borderRadius:6, background:'#fef2f2', border:'1px solid #fecaca', color:'#b91c1c', fontSize:12}}>
                            {reportStaffTravelError}
                          </div>
                        )}

                        {!reportStaffTravelLoading && reportStaffTravelRows.length === 0 && (
                          <div style={{marginTop:12, fontSize:13, color:'#6b7280'}}>
                            No assigned staff travel rows found for this task.
                          </div>
                        )}

                        {reportStaffTravelRows.length > 0 && (
                          <div style={{marginTop:12, overflowX:'auto'}}>
                            <table style={{width:'100%', borderCollapse:'collapse', minWidth:540}}>
                              <thead>
                                <tr style={{background:'#f8fafc'}}>
                                  <th style={{padding:'10px 12px', textAlign:'left', fontSize:12, color:'#475569'}}>Staff</th>
                                  <th style={{padding:'10px 12px', textAlign:'left', fontSize:12, color:'#475569'}}>Role</th>
                                  <th style={{padding:'10px 12px', textAlign:'left', fontSize:12, color:'#475569'}}>Distance (km)</th>
                                  <th style={{padding:'10px 12px', textAlign:'left', fontSize:12, color:'#475569'}}>Duration (min)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {reportStaffTravelRows.map(row => (
                                  <tr key={row.staff_id} style={{borderTop:'1px solid #e5e7eb'}}>
                                    <td style={{padding:'10px 12px', color:'#111827'}}>
                                      <div style={{fontWeight:600}}>{row.staff_name}</div>
                                    </td>
                                    <td style={{padding:'10px 12px', color:'#64748b', fontSize:13}}>{row.role_label}</td>
                                    <td style={{padding:'10px 12px'}}>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={row.travel_distance ?? ''}
                                        disabled={reportTravelBusy}
                                        onChange={(e) => handleReportStaffTravelFieldChange(row.staff_id, 'travel_distance', e.target.value)}
                                        style={{width:'100%'}}
                                      />
                                    </td>
                                    <td style={{padding:'10px 12px'}}>
                                      <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        value={row.travel_duration ?? ''}
                                        disabled={reportTravelBusy}
                                        onChange={(e) => handleReportStaffTravelFieldChange(row.staff_id, 'travel_duration', e.target.value)}
                                        style={{width:'100%'}}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                    {showInlineTaskMap && currentTask.location_id && (
                      <div style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, background:'#fff'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                          <div style={{fontWeight:600}}>Map View</div>
                          <button className="btn" onClick={() => setShowInlineTaskMap(false)}>Hide Map</button>
                        </div>
                        <TaskMapInline
                          assignedLocation={locations.find(l => l.id === currentTask.location_id)}
                          startLocation={{ lat: currentTask.start_lat, lng: currentTask.start_lng }}
                          stopLocation={{ lat: currentTask.end_lat, lng: currentTask.end_lng }}
                          radiusMeters={locations.find(l => l.id === currentTask.location_id)?.radius_meters}
                        />
                      </div>
                    )}

                    {/* Messages Section */}
                    <div style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, background:'#fff'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div style={{fontWeight:600}}>Messages</div>
                        <div>
                          <button className="btn" onClick={async ()=>{
                            // fetch all comments and filter
                            try {
                              const res = await authFetch(`${VITE_KEY}/api/task_comments/${currentTask.id}`);
                              const all = await res.json();
                              setTaskMessages(all);
                            } catch(e){ console.error('fetch comments', e); }
                          }}>⟳ Refresh</button>
                          <button className="btn" onClick={()=>{
                            setNewMessageText('');
                          }}>+</button>
                        </div>
                      </div>

                      <div style={{marginTop:8}}>
                        {taskMessages.length === 0 ? (
                          <div style={{padding:12, color:'#888'}}>No Messages Found</div>
                        ) : (
                          <table style={{width:'100%', borderCollapse:'collapse'}}>
                            <thead>
                              <tr style={{background:'#f3f4f6'}}>
                                <th style={{padding:8,textAlign:'left'}}>Messages</th>
                                <th style={{padding:8,textAlign:'left'}}>Created By</th>
                                <th style={{padding:8,textAlign:'left'}}>Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {taskMessages.map(m => (
                                <tr key={m.id}>
                                  <td style={{padding:8}}>{m.comment}</td>
                                  <td style={{padding:8}}>{(staffs.find(s=>s.id===m.staff_id)?.name) || 'Unknown'}</td>
                                  <td style={{padding:8}}>{m.created_at ? dayjs(m.created_at).format('D MMM YYYY HH:mm') : ''}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      <div style={{marginTop:8, display:'flex', gap:8, alignItems:'center'}}>
                        <select id="newMessageStaffSelect" defaultValue={currentTask?.staff_id || ''} style={{minWidth:160, padding:8, borderRadius:6, border:'1px solid #d1d5db'}}>
                          <option value="">-- Select Staff --</option>
                          {staffs.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>

                        <input value={newMessageText} onChange={e=>setNewMessageText(e.target.value)} placeholder="Enter message" style={{flex:1}} />
                        <button className="btn primary" onClick={async ()=>{
                          if (!newMessageText.trim()) return;
                          try {
                            const selectEl = document.getElementById('newMessageStaffSelect');
                            const selectedStaffId = selectEl ? selectEl.value : currentTask.staff_id;
                            const payload = { task_id: currentTask.id, comment: newMessageText.trim(), is_read: 0, staff_id: selectedStaffId || currentTask.staff_id };
                            const res = await authFetch(`${VITE_KEY}/api/task_comments`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
                            const created = await res.json();
                            setTaskMessages(arr => [...arr, created]);
                            setNewMessageText('');
                          } catch(e) { console.error('post message error', e); }
                        }}>Send</button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

          {taskModalMainTab === 'Repeat' && (
            <div style={{padding:'20px', textAlign:'center', color:'#6b7280'}}>
              <RecurringShiftSettings task={currentTask} onCreated={refreshTasksForCurrentRange} />

            </div>
          )}

          {taskModalMainTab === 'Roster' && (
            <div style={{padding:'20px'}}>
              {/* <h3 style={{marginBottom:12}}>Existing Recurring Patterns</h3> */}
              {/* {recurringSettings && recurringSettings.length > 0 ? (
                recurringSettings.map((rs) => (
                  <div className="roster-pattern-item" style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, marginBottom:12, background:'#fff', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                    <div style={{display:'flex', gap:12}}>
                      <input type="checkbox" />
                      <div>
                        <div style={{fontWeight:600}}>
                          {rs.days_display} — Every {rs.request_freq} week(s)
                        </div>
                        <div style={{fontSize:13, color:'#666'}}>
                          Next Shift: {rs.next_shift || '—'}
                        </div>
                        <div style={{fontSize:13, color:'#666'}}>
                          Future Shifts: {rs.future_count || 0}
                        </div>
                        <div style={{fontSize:12, color:'#999'}}>
                          Pattern ID: {rs.id}
                        </div>
                      </div>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', gap:6}}>
                      <button className="btn-small">Edit</button>
                      <button className="btn-small btn-danger">Delete</button>
                    </div>
                  </div>
                ))
              ) : (
                <div>No recurring patterns available.</div>
              )} */}

              <h3 style={{marginTop:24, marginBottom:12}}>Generated Recurring Shifts</h3>
              {childTasks && childTasks.length > 0 ? (
                childTasks.map((c) => (
                  <div className="shift-row" style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, marginBottom:12, background:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{display:'flex', gap:12, alignItems:'center'}}>
                      <div style={{width:10, height:10, borderRadius:5, background:'#4a90e2'}}></div>
                      <div>
                        <div style={{fontWeight:600}}>
                          {dayjs(c.start_time).format('dddd')} — {dayjs(c.start_time).format('D MMM YYYY')}
                        </div>
                        <div style={{fontSize:13, color:'#666'}}>
                          {dayjs(c.start_time).format('HH:mm')} – {dayjs(c.end_time).format('HH:mm')}
                        </div>
                      </div>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', gap:6}}>
                      <button
                        className="btn"
                        onClick={() => {
                          setCurrentTask(c);
                          openEditTaskModal(c);
                        }}
                      >
                        Edit
                      </button>
                      {/* <button className="btn-small btn-danger">Delete</button> */}
                    </div>
                  </div>
                ))
              ) : (
                <div>No generated recurring shifts.</div>
              )}
            </div>
          )}

          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
            {currentTask.staff_id !== 'STATIC-COVER-STAFF' && (
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={async () => {
                  if (!confirm('Cancel this task and assign it to Cover?')) return;

                  try {
                    const previousTask = tasks.find(task => task.id === currentTask.id) || currentTask;
                    await authFetch(`${VITE_KEY}/api/tasks/${currentTask.id}/assign-to-cover`, {
                      method: 'POST'
                    });
                    const coveredTask = {
                      ...currentTask,
                      assignment_type: 'cover',
                      staff_id: 'STATIC-COVER-STAFF',
                      team_id: null,
                      task_team_members: [],
                      task_team_members_name: [],
                      travel_from: null,
                      travel_dist: null,
                      travel_duration: null,
                    };
                    await syncAffectedTaskTravel([previousTask, coveredTask], tasks, currentTask.id);

                    showToast('Task cancelled and assigned to Cover', '#16a34a');
                    setEditModalOpen(false);
                    refreshTasksForCurrentRange().catch(() => {});
                  } catch (e) {
                    console.error(e);
                    showToast('Failed to cancel task');
                  }
                }}
              >
                Cancel Task
              </button>
            )}
            <button className="btn" onClick={closeEditTaskModal}>Close</button>
            <button className="btn primary" onClick={handleSaveShiftModal}>Save</button>

          </div>
          {TeamSelectionModal()}
          {ManageStaffModal()}
          {LocationSelectionModal()}
        </div>
      </Modal>
    );
  }

  function getCreateShiftAssignmentSummary() {
    const sup = currentTask.staff_id ? staffs.find(s => s.id === currentTask.staff_id) : null;
    const supervisorName = sup?.name || '';
    const members = Array.isArray(currentTask.task_team_members) ? currentTask.task_team_members : [];
    const cleanerNames = members
      .filter(id => id !== currentTask.staff_id)
      .map(id => staffs.find(s => s.id === id)?.name)
      .filter(Boolean);
    const supPart = supervisorName ? `${supervisorName} (S)` : '';
    const cleanPart = cleanerNames.length ? cleanerNames.join(', ') : '';
    const hasStaff = Boolean(supPart || cleanPart);
    if (currentTask.assignment_type === 'team' && currentTask.team_id) {
      const teamName = teams.find(t => t.id === currentTask.team_id)?.name;
      const bits = [teamName, supPart, cleanPart].filter(Boolean);
      return bits.length ? bits.join(' — ') : '';
    }
    if (!hasStaff) return '';
    return [supPart, cleanPart].filter(Boolean).join(', ');
  }

  function getCreateShiftLocationSummary() {
    if (!currentTask.location_id) return '';
    const loc = locations.find(l => l.id === currentTask.location_id);
    if (!loc) return '';
    const titleLine = [loc.title, loc.address].filter(Boolean).join(', ');
    const unitPart = loc.unit_no ? `Unit ${loc.unit_no}` : '';
    return [unitPart, titleLine].filter(Boolean).join(' — ');
  }

  // -- TASK Create Modal --
  function shiftModal() {
    const assignmentSummary = getCreateShiftAssignmentSummary();
    const locationSummary = getCreateShiftLocationSummary();

    return (
      <Modal open={createModalOpen} title="Create a new shift" onClose={()=>setCreateModalOpen(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:10,minWidth:420}}>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <span>Assignment Type:</span>
            <button
              className={currentTask.assignment_type==='individual'?'btn primary':'btn'}
              onClick={()=>handleAssignmentTypeChange('individual')}
              type="button"
            >Individual</button>
            <button
              className={currentTask.assignment_type==='team'?'btn primary':'btn'}
              onClick={()=>handleAssignmentTypeChange('team')}
              type="button"
            >Team</button>
          </div>
          {/* <label>
            Shift Name
            <input value={currentTask.task_name} onChange={e=>setCurrentTask(f=>({...f, task_name:e.target.value}))} style={{width:'100%',marginTop:4}} />
          </label> */}
          {currentTask.assignment_type==='team' && (
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span>Team:</span>
              <button className="btn" onClick={openTeamSelectionModal} type="button">
                {currentTask.team_id ? (teams.find(t=>t.id===currentTask.team_id)?.name || 'Selected') : 'Select Team'}
              </button>
              {assignmentSummary && (
                <span style={{fontSize:13,color:'#374151',flex:'1 1 200px',lineHeight:1.4}}>
                  {assignmentSummary}
                </span>
              )}
            </div>
          )}
          {currentTask.assignment_type==='individual' && (
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span>Staff:</span>
              <button className="btn" onClick={openManageStaffModal}>Manage Staff</button>
              {assignmentSummary && (
                <span style={{fontSize:13,color:'#374151',flex:'1 1 200px',lineHeight:1.4}}>
                  {assignmentSummary}
                </span>
              )}
            </div>
          )}
          <div style={{display:'flex',gap:8}}>
            <label style={{flex:2}}>
              Booking Date
              <input
                type="date"
                value={currentTask.start_time ? dayjs(currentTask.start_time).format('YYYY-MM-DD') : ''}
                onChange={e => {
                  // Update both start_time and end_time date part
                  setCurrentTask(f => {
                    const oldStart = dayjs(f.start_time || new Date());
                    const oldEnd = dayjs(f.end_time || new Date());
                    const date = e.target.value;
                    return {
                      ...f,
                      start_time: dayjs(date + 'T' + oldStart.format('HH:mm')).toISOString(),
                      end_time: dayjs(date + 'T' + oldEnd.format('HH:mm')).toISOString(),
                    };
                  });
                }}
                style={{width:'100%',marginTop:4}}
              />
            </label>
            <label style={{flex:1}}>
              Time
              <input
                type="time"
                value={currentTask.start_time ? dayjs(currentTask.start_time).format('HH:mm') : ''}
                onChange={e => {
                  setCurrentTask(f => {
                    const date = dayjs(f.start_time || new Date()).format('YYYY-MM-DD');
                    const t = e.target.value;
                    // duration
                    const dur = f.duration || 60;
                    return {
                      ...f,
                      start_time: dayjs(date + 'T' + t).toISOString(),
                      end_time: dayjs(date + 'T' + t).add(dur, 'minute').toISOString(),
                    };
                  });
                }}
                style={{width:'100%',marginTop:4}}
              />
            </label>
            {/* TODO: Check duration input issue */}
            <label style={{flex:1}}>
              Duration (min)
              <input
                type="number"
                min={10}
                max={480}
                // value={Math.round((currentTask.end_time - currentTask.start_time) / 60000)}
                value={
                  currentTask.start_time && currentTask.end_time
                    ? dayjs(currentTask.end_time).diff(dayjs(currentTask.start_time), "minute")
                    : 0
                }
                onChange={e => {
                  const dur = Number(e.target.value);
                  setCurrentTask(f => ({
                    ...f,
                    end_time: f.start_time
                      ? dayjs(f.start_time).add(dur, 'minute').toISOString()
                      : f.end_time,
                  }));
                }}
                style={{width:'100%',marginTop:4}}
              />
            </label>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span>Location:</span>
            <button className="btn" onClick={openLocationSelectionModal} type="button">
              {currentTask.location_id ? (locations.find(l=>l.id===currentTask.location_id)?.title || 'Selected') : 'Select Location'}
            </button>
            {locationSummary && (
              <span style={{fontSize:13,color:'#374151',flex:'1 1 200px',lineHeight:1.4}} title={locationSummary}>
                {locationSummary}
              </span>
            )}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {/* <label><input type="checkbox" checked={currentTask.include_location_details} onChange={e=>setCurrentTask(f=>({...f, include_location_details:e.target.checked}))}/> Include Location Details</label> */}
            <label><input type="checkbox" checked={currentTask.publish} onChange={e=>setCurrentTask(f=>({...f, publish:e.target.checked}))}/> Publish Event</label>
            <label><input type="checkbox" checked={!!currentTask.isLocation} onChange={e=>setCurrentTask(f=>({...f, isLocation:e.target.checked}))}/> Location</label>
          </div>
          <label>
            Shift Instructions
            <textarea
              value={currentTask.shift_instructions}
              onChange={e=>setCurrentTask(f=>({...f, shift_instructions:e.target.value}))}
              rows={3}
              style={{width:'100%',marginTop:4}}
            />
          </label>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn" onClick={()=>setCreateModalOpen(false)}>Cancel</button>
            <button className="btn primary" onClick={handleCreateEvent}>Create Event</button>
          </div>
        </div>
        {TeamSelectionModal()}
        {ManageStaffModal()}
        {LocationSelectionModal()}
      </Modal>
    )
  }

  // --- MAIN RENDER ---
  return (
    <>
      {manageLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          fontSize: '20px',
          color: '#fff',
          fontWeight: '600',
          backdropFilter: 'blur(2px)'
        }}>
          Loading...
        </div>
      )}
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13 }}>
          Hide days (week view only):
        </span>
        <div
          ref={dayDropdownRef}
          style={{ position: 'relative', minWidth: 240 }}
        >
          <button
            type="button"
            disabled={currentView !== 'timeGridWeek'}
            onClick={() => {
              if (currentView === 'timeGridWeek') {
                setDayDropdownOpen(open => !open);
              }
            }}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: currentView === 'timeGridWeek' ? '#ffffff' : '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 13,
              cursor: currentView === 'timeGridWeek' ? 'pointer' : 'not-allowed'
            }}
          >
            <span style={{ color: '#111827' }}>{hiddenDaysLabel()}</span>
            <span style={{ marginLeft: 8, fontSize: 10, color: '#6b7280' }}>▼</span>
          </button>
          {dayDropdownOpen && currentView === 'timeGridWeek' && (
            <div
              style={{
                position: 'absolute',
                top: '110%',
                left: 0,
                right: 0,
                maxHeight: 220,
                background: '#ffffff',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                boxShadow: '0 8px 20px rgba(15,23,42,0.12)',
                padding: '8px 0',
                zIndex: 1000,
                overflowY: 'auto'
              }}
            >
              {dayOptions.map(d => {
                const checked = (filter.hiddenDays || []).includes(d.value);
                return (
                  <label
                    key={d.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: 13,
                      background: checked ? '#eef2ff' : 'transparent'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleHiddenDay(d.value)}
                      style={{ margin: 0 }}
                    />
                    <span>{d.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1 }}>
        {/* <div style={{ flex: 1 }}> */}
        <div
          ref={calendarContainerRef}
          style={{
            width: '100%',
            minHeight: `${calendarHeight}px`,
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            position: 'relative'
          }}
        >
          {tasksLoading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(255,255,255,0.72)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20,
                fontWeight: 600,
                color: '#111827'
              }}
            >
              Loading tasks...
            </div>
          )}
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView='timeGridWeek'
            // dayCellContent={(arg) => {
            //   const date = arg.date;
            //   const d = String(date.getDate()).padStart(2, '0');
            //   const m = String(date.getMonth() + 1).padStart(2, '0');
            //   return `${d}/${m}`;
            // }}

            headerToolbar={{
              left: 'prev,next today createTask details publishTasks',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            customButtons={{
              createTask: {
                text: 'Create',
                click: () => {
                  let currentDate = new Date();
                  handleDateSelect({
                    start: currentDate,
                    end: new Date(currentDate.setHours(currentDate.getHours() + 1))
                  });
                }
              },
              details: {
                text: 'Details',
                click: () => {
                  openDetailsModal();
                }
              },
              publishTasks: {
                text: 'Publish',
                click: async () => {
                  try {
                    setManageLoading(true);

                    const range = getActiveRange();
                    const scopedTasks = tasks
                      .filter(taskMatchesCurrentFilter)
                      .filter(t => isTaskInActiveRange(t, range))
                      .filter(t => !isTaskHiddenByWeekHiddenDays(t));

                    const taskIds = scopedTasks
                      .filter(t => !t.publish)
                      .map(t => t.id)
                      .filter(Boolean);

                    if (taskIds.length === 0) {
                      showToast('No unpublished tasks in the current view to publish.', '#0f172a');
                      return;
                    }

                    const res = await authFetch(`${VITE_KEY}/api/publishtasks`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ taskIds })
                    });

                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      throw new Error(err?.error || 'Failed to publish tasks');
                    }

                    const data = await res.json().catch(() => ({}));
                    const updatedCount = typeof data?.updated === 'number' ? data.updated : taskIds.length;
                    showToast(`Published ${updatedCount} task(s).`, '#16a34a');

                    // Reload tasks so calendar reflects new publish state
                    refreshTasksForCurrentRange().catch(() => {});
                  } catch (e) {
                    console.error(e);
                    showToast(e.message || 'Failed to publish tasks');
                  } finally {
                    setManageLoading(false);
                  }
                }
              }
            }}
            selectable={true}
            selectMirror={true}
            select={handleDateSelect}
            eventClick={handleEventClick}
            events={events}
            editable={true}
            // eventDrop={handleEventDrop}
            // datesSet={arg => {
            //   debugger;
            //   setCurrentView(arg.view.type);
            //   setCurrentRange({ start: arg.start, end: arg.end });
            // }}
            datesSet={arg => {
              const newView = arg.view.type;
            
              setCurrentView(prev => {
                if (prev === newView) return prev;
                return newView;
              });
            
              setCurrentRange(prev => {
                const sameStart = prev?.start?.getTime?.() === arg.start.getTime();
                const sameEnd = prev?.end?.getTime?.() === arg.end.getTime();
            
                if (sameStart && sameEnd) return prev;
            
                return { start: arg.start, end: arg.end };
              });

              fetchTasksForVisibleRange(arg.start, arg.end).catch((err) => {
                console.error('Failed to fetch tasks for visible range', err);
              });
            }}
            hiddenDays={currentView === 'timeGridWeek' ? (filter.hiddenDays || []) : []}
            ref={calendarRef}

            expandRows={true}
            stickyHeaderDates={true}
            allDaySlot={true}

            /* Scroll to bottom by default */
            scrollTime="08:00:00"

            /* Increase hour height */
            // slotMinTime={'00:00:00'}
            // slotMaxTime={'24:00:00'}
            // slotDuration={'00:30:00'}
            // slotLabelInterval={'01:00:00'}

            /* Smaller task font */
            eventClassNames={() => 'custom-event-small'}

            // eventDidMount={(info) => {
            //   const task = info.event.extendedProps;
          
            //   info.el.title = `
            //     Task: ${task.task_name || ''}
            //     Client: ${task.client_name || ''}
            //     Staff: ${task.staff_name || ''}
            //   `;
            // }}

            eventDidMount={(info) => {
              const t = info.event.extendedProps;
              const cardColor = info.event.backgroundColor || '#7c3aed';
              const accentColor = t.statusBorderColor || info.event.borderColor || '#7c3aed';
              info.el.style.background = `linear-gradient(${cardColor}, ${cardColor}) padding-box, linear-gradient(135deg, ${withAlpha(accentColor, 0.5)}, ${accentColor}) border-box`;
              info.el.style.border = '4px solid transparent';
              info.el.style.borderRadius = '8px';
              info.el.style.borderRadius = '8px';
              info.el.style.boxShadow = `0 0 0 2px ${withAlpha(accentColor, 0.5)}`;
            
              const staffList = [
                t.staff_name ? `${t.staff_name} (S)` : null,
                ...(t.task_team_members_name || [])
              ].filter(Boolean).join(' ');

              const tooltip = document.createElement("div");
              tooltip.className = "task-tooltip";

              let locationAddress = locations.find(l => l.id === t.location_id)?.address || "";

              const m = dayjs(info.event.end).diff(dayjs(info.event.start), "minute");
              const length = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
              const shiftInstruction = t.task_instruction_text || '';
            
              tooltip.innerHTML = `
                <div class="tt-title">${escapeTooltipHtml(t.client_name || "")}</div>
                ${buildTooltipRow('Staff', staffList)}
                ${buildTooltipRow('Length', length)}
                ${buildTooltipRow('Location', locationAddress || t.location_title || "")}
                ${buildTooltipRow('Mobile', t.task_client_phone || "")}
                ${buildTooltipRow('Client Instruction', t.task_client_instruction || "")}
                ${buildTooltipRow('Shift Instruction', shiftInstruction)}
              `;

              const updateTooltipPosition = () => positionTaskTooltip(info.el, tooltip);

              const showTooltip = () => {
                if (!tooltip.isConnected) {
                  tooltip.style.visibility = 'hidden';
                  document.body.appendChild(tooltip);
                }

                updateTooltipPosition();
                tooltip.style.visibility = 'visible';
                window.addEventListener('resize', updateTooltipPosition);
                window.addEventListener('scroll', updateTooltipPosition, true);
              };

              const hideTooltip = () => {
                window.removeEventListener('resize', updateTooltipPosition);
                window.removeEventListener('scroll', updateTooltipPosition, true);
                tooltip.remove();
              };

              info.el.addEventListener("mouseenter", showTooltip);
              info.el.addEventListener("mouseleave", hideTooltip);
              info.el._taskTooltipCleanup = () => {
                hideTooltip();
                info.el.removeEventListener('mouseenter', showTooltip);
                info.el.removeEventListener('mouseleave', hideTooltip);
              };
            }}
            eventWillUnmount={(info) => {
              info.el._taskTooltipCleanup?.();
            }}

            dayHeaderContent={(arg) => {
              const date = arg.date;
              // debugger;
            
              const d = String(date.getDate()).padStart(2, '0');
              const m = String(date.getMonth() + 1).padStart(2, '0');
            
              const weekdayShort = date.toLocaleDateString('en-US', { weekday: 'short' });
            
              // 👉 Week / Day view → show "Mon 19/03"
              if (currentView === 'timeGridWeek' || currentView === 'timeGridDay') {
                return `${weekdayShort} ${d}/${m}`;
              }
            
              // 👉 Month view → show only weekday "Mon"
              return weekdayShort;
            }}
            height={calendarHeight} />
        </div>
        {EditTaskModal()}
        {shiftModal()}
        {DetailsModal()}
        {/* {LocationSelectionModal()} */}
      </div></>
  );


}
