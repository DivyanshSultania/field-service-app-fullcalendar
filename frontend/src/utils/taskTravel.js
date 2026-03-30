import dayjs from 'dayjs';
import { GOOGLE_MAPS_API_KEY, loadGoogleMapsApi } from './googleMaps';

function isStaffAssignedToTask(task, staffId) {
  if (!task || !staffId) return false;
  const memberIds = Array.isArray(task.task_team_members) ? task.task_team_members : [];
  return task.staff_id === staffId || memberIds.includes(staffId);
}

function hasCoordinates(location) {
  return location?.lat != null
    && location?.lng != null
    && location.lat !== ''
    && location.lng !== '';
}

export function getAssignedStaffIds(task) {
  const memberIds = Array.isArray(task?.task_team_members) ? task.task_team_members : [];
  return Array.from(new Set([task?.staff_id, ...memberIds].filter(Boolean)));
}

export function getTaskStaffTravelRecord(task, staffId) {
  if (!staffId) return null;
  const records = Array.isArray(task?.task_staff_travel) ? task.task_staff_travel : [];
  return records.find(record => record?.staff_id === staffId) || null;
}

export function attachTaskStaffTravelToTasks(tasks, travelRows) {
  const rowsByTaskId = new Map();

  (Array.isArray(travelRows) ? travelRows : []).forEach(row => {
    if (!row?.task_id || !row?.staff_id) {
      return;
    }

    let taskMap = rowsByTaskId.get(row.task_id);
    if (!taskMap) {
      taskMap = new Map();
      rowsByTaskId.set(row.task_id, taskMap);
    }

    if (!taskMap.has(row.staff_id)) {
      taskMap.set(row.staff_id, row);
    }
  });

  return (Array.isArray(tasks) ? tasks : []).map(task => ({
    ...task,
    task_staff_travel: Array.from(rowsByTaskId.get(task.id)?.values?.() || []),
  }));
}

function findPreviousTaskForStaff(task, tasks, staffId) {
  if (!task?.start_time || !staffId) {
    return null;
  }

  const taskStart = dayjs(task.start_time);
  let previousTask = null;

  (Array.isArray(tasks) ? tasks : []).forEach(candidate => {
    if (!candidate?.start_time || candidate.id === task.id) {
      return;
    }

    if (!isStaffAssignedToTask(candidate, staffId)) {
      return;
    }

    const candidateStart = dayjs(candidate.start_time);
    if (!candidateStart.isSame(taskStart, 'day') || !candidateStart.isBefore(taskStart)) {
      return;
    }

    if (!previousTask || candidateStart.isAfter(dayjs(previousTask.start_time))) {
      previousTask = candidate;
    }
  });

  return previousTask;
}

export async function calculateTaskTravelData({ task, tasks = [], locations = [] }) {
  const staffIds = getAssignedStaffIds(task);
  const defaultRecords = staffIds.map(staffId => ({
    staff_id: staffId,
    travel_distance: null,
    travel_duration: null,
  }));

  if (!task?.start_time || !task?.location_id || staffIds.length === 0) {
    return {
      supervisorTravel: null,
      staffTravelRecords: defaultRecords,
    };
  }

  const destination = locations.find(location => location.id === task.location_id);
  if (!hasCoordinates(destination)) {
    return {
      supervisorTravel: null,
      staffTravelRecords: defaultRecords,
    };
  }

  let directionsService = null;
  const routeCache = new Map();

  const getRoute = async (origin, destinationLocation) => {
    const cacheKey = `${origin.id}:${destinationLocation.id}`;
    if (routeCache.has(cacheKey)) {
      return routeCache.get(cacheKey);
    }

    if (!directionsService) {
      await loadGoogleMapsApi(GOOGLE_MAPS_API_KEY);
      directionsService = new window.google.maps.DirectionsService();
    }

    const route = await new Promise((resolve, reject) => {
      directionsService.route({
        origin: { lat: Number(origin.lat), lng: Number(origin.lng) },
        destination: { lat: Number(destinationLocation.lat), lng: Number(destinationLocation.lng) },
        travelMode: 'DRIVING',
      }, (result, status) => {
        if (status === 'OK') {
          resolve(result);
          return;
        }

        reject(new Error(String(status || 'Route lookup failed')));
      });
    });

    routeCache.set(cacheKey, route);
    return route;
  };

  const staffTravelRecords = [];

  for (const staffId of staffIds) {
    const previousTask = findPreviousTaskForStaff(task, tasks, staffId);
    const origin = previousTask?.location_id
      ? locations.find(location => location.id === previousTask.location_id)
      : null;

    if (!previousTask || !hasCoordinates(origin)) {
      staffTravelRecords.push({
        staff_id: staffId,
        travel_distance: null,
        travel_duration: null,
      });
      continue;
    }

    try {
      const route = await getRoute(origin, destination);
      const leg = route?.routes?.[0]?.legs?.[0];

      if (!leg?.distance?.value || !leg?.duration?.value) {
        staffTravelRecords.push({
          staff_id: staffId,
          travel_distance: null,
          travel_duration: null,
        });
        continue;
      }

      staffTravelRecords.push({
        staff_id: staffId,
        from_location: previousTask.location_id,
        travel_distance: Number((leg.distance.value / 1000).toFixed(2)),
        travel_duration: Math.round(leg.duration.value / 60),
      });
    } catch {
      staffTravelRecords.push({
        staff_id: staffId,
        travel_distance: null,
        travel_duration: null,
      });
    }
  }

  const supervisorRecord = staffTravelRecords.find(record => record.staff_id === task.staff_id) || null;

  return {
    supervisorTravel: supervisorRecord
      ? {
          travel_from: supervisorRecord.from_location ?? null,
          travel_dist: supervisorRecord.travel_distance ?? null,
          travel_duration: supervisorRecord.travel_duration ?? null,
        }
      : null,
    staffTravelRecords,
  };
}
