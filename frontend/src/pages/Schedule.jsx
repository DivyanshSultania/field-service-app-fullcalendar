import React, { useState } from 'react';
import ScheduleFilters from './ScheduleFilters';
import IndividualView from './IndividualView';
import GroupByStaff from './GroupByStaff';
import GroupByClient from './GroupByClient';

const VITE_KEY = import.meta.env.VITE_API_URL;


export default function Schedule() {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    staffId: '',
    clientId: '',
    viewType: 'individual'
  });

  const [tasks, setTasks] = useState([]);

  const fetchSchedule = async () => {
    const params = new URLSearchParams(filters).toString();
    const res = await fetch(`${VITE_KEY}/api/taskschedule?${params}`);
    const data = await res.json();
    setTasks(data);
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <ScheduleFilters filters={filters} setFilters={setFilters} onSearch={fetchSchedule} />

      <div style={{ flex: 1, padding: 20 }}>
        {filters.viewType === 'individual' && <IndividualView tasks={tasks} />}
        {filters.viewType === 'staff' && <GroupByStaff tasks={tasks} />}
        {filters.viewType === 'client' && <GroupByClient tasks={tasks} />}
      </div>
    </div>
  );
}