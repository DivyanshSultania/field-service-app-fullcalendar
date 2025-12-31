import React, { useRef, useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import dayjs from 'dayjs';
import Modal from './Modal';

// Helper: Google Maps API loader
function loadGoogleMapsApi(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve(window.google.maps);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export default function CalendarView({tasks = [], filter = { type: 'staff', ids: [] }}) {
  const calendarRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [selectedRange, setSelectedRange] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState(null);
  // const [manageModalContext, setManageModalContext] = useState('edit'); // 'edit' or 'create'
  const [teams, setTeams] = useState([]);
  const [staff, setStaff] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [clients, setClients] = useState([]);
  const [locations, setLocations] = useState([]);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [manageCleaners, setManageCleaners] = useState([]);
  const [mainTab, setMainTab] = useState('Shift Detail');
  const [manageTeamId, setManageTeamId] = useState('');
  // const [manageTeamMembers, setManageTeamMembers] = useState([]);
  const [manageTeamSupervisor, setManageTeamSupervisor] = useState('');
  const [manageTeamsList, setManageTeamsList] = useState([]);

  const [form, setForm] = useState({
    assignment_type: 'individual',
    task_name: '',
    staff_id: '',
    team_id: '',
    client_id: '',
    location_id: '',
    start_time: '',
    end_time: '',
    color: '#7c3aed',
    shift_instructions: '',
    publish: false,
    include_location_details: false,
    duration: 60, // mins
  });
  const [selectedTeam, setSelectedTeam] = useState({});
  const [selectedLocation, setSelectedLocation] = useState({});
  // const [selectedStaff, setSelectedStaff] = useState([]);
  // const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedTab, setSelectedTab] = useState('Shift');
  const [editTask, setEditTask] = useState(null);
  const [editTabs, setEditTabs] = useState('Shift');
  const [editInstructions, setEditInstructions] = useState([]);
  const [editInstructionInput, setEditInstructionInput] = useState('');
  const [editClient, setEditClient] = useState({});
  const [editReport, setEditReport] = useState({});
  const [editRepeat, setEditRepeat] = useState({});
  const [manageTeamStaffList, setManageTeamStaffList] = useState([]);
  const [manageSupervisor, setManageSupervisor] = useState('');
  const [manageTab, setManageTab] = useState('staff'); // 'staff' or 'team'
  const [manageLoading, setManageLoading] = useState(false);

  // Google Maps API Key (replace with your own if needed)
  const GOOGLE_MAPS_API_KEY = 'AIzaSyD-PLACEHOLDER'; // <-- Insert a valid API key here.

  // Fetch teams, staff, clients, locations
  useEffect(() => {
    fetch('http://localhost:4000/api/teams').then(r => r.json()).then(setTeams).catch(() => {});
    fetch('http://localhost:4000/api/staff').then(r => r.json()).then(setStaff).catch(() => {});
    fetch('http://localhost:4000/api/clients').then(r => r.json()).then(setClients).catch(() => {});
    fetch('http://localhost:4000/api/locations').then(r => r.json()).then(setLocations).catch(() => {});
    fetch('http://localhost:4000/api/team_members').then(r => r.json()).then(setTeamMembers).catch(() => {});
  }, []);

  useEffect(() => {
    let filteredTasks = tasks;

    if (filter.ids.length > 0) {
      if (filter.type === 'staff') {
        filteredTasks = tasks.filter(t => filter.ids.includes(t.staff_id));
      } else if (filter.type === 'client') {
        filteredTasks = tasks.filter(t => filter.ids.includes(t.client_id));
      } else if (filter.type === 'team') {
        filteredTasks = tasks.filter(t => filter.ids.includes(t.team_id));
      }
    }

    const ev = filteredTasks.map(t => {
      const supervisor = staff.find(s => s.id === t.staff_id);
      return {
        id: t.id,
        title: t.task_name + (t.staff_name ? '\n' + t.staff_name : ''),
        start: t.start_time,
        end: t.end_time,
        backgroundColor: supervisor?.color || '#7c3aed',
        borderColor: supervisor?.color || '#7c3aed',
        textColor: '#fff',
        extendedProps: { ...t }
      };
    });
    setEvents(ev);
  }, [tasks, filter, staff]);

  // useEffect(() => {
  //   // map tasks to fullcalendar events
  //   const ev = (tasks || []).map(t => ({
  //     id: t.id,
  //     title: t.task_name + (t.staff_name ? '\n' + t.staff_name : ''),
  //     start: t.start_time,
  //     end: t.end_time,
  //     backgroundColor: t.color || '#7c3aed',
  //     extendedProps: {...t}
  //   }));
  //   setEvents(ev);
  // }, [tasks]);

  // --- CALENDAR HANDLERS ---
  function handleDateSelect(selectInfo) {
    setSelectedRange(selectInfo);
    setForm({
      assignment_type: 'individual',
      task_name: '',
      staff_id: '',
      team_id: '',
      client_id: '',
      location_id: '',
      start_time: selectInfo.startStr,
      end_time: selectInfo.endStr,
      color: '#7c3aed',
      shift_instructions: '',
      publish: false,
      include_location_details: false,
      duration: 60,
    });
    setSelectedTeam({});
    setSelectedLocation({});
    handleCreateModalLoad();
    setCreateModalOpen(true);
    setEditModalOpen(false);
  }

  function handleEventClick(clickInfo) {
    const ev = clickInfo.event;
    const ext = ev.extendedProps || {};

    debugger;
    setEditTaskId(ext.id);
    setEditTask(ext);
    setEditTabs('Shift');
    setEditInstructionInput('');
    setEditModalOpen(true);
    setCreateModalOpen(false);
    // fetch instructions for this task
    fetch(`http://localhost:4000/api/task_instructions?task_id=${ev.id}`)
      .then(r => r.json())
      .then(insts => setEditInstructions(insts.filter(i => i.task_id === ev.id)))
      .catch(() => setEditInstructions([]));
    // fetch client for this task if any
    if (ext.client_id) {
      fetch(`http://localhost:4000/api/clients/${ext.client_id}`)
        .then(r => r.json())
        .then(setEditClient)
        .catch(() => setEditClient({}));
    } else setEditClient({});
    // fetch report fields (simulate)
    setEditReport({
      started_at: ext.started_at || '',
      stopped_at: ext.stopped_at || '',
      travel_dist: ext.travel_dist || '',
      travel_duration: ext.travel_duration || '',
      messages: '',
    });
    setEditRepeat({});
  }

  function handleEventDrop(changeInfo) {
    // event drag/drop -> update in backend (not implemented persistently here)
    const ev = changeInfo.event;
    // Simple PUT request could be implemented. For demo we just log.
    console.log('dropped', ev.id, ev.startStr, ev.endStr);
  }

  // --- CREATE MODAL LOGIC ---
  function handleAssignmentTypeChange(type) {
    setForm(f => ({
      ...f,
      assignment_type: type,
      staff_id: type === 'individual' ? f.staff_id : '',
      team_id: type === 'team' ? f.team_id : '',
    }));
  }

  // Save manage modal
  async function handleManageModalSave() {
    setManageLoading(true);

    if (manageTab === 'staff') {
      // Multiple cleaners + supervisor
      const taskStaffMembers = manageCleaners.map(id => ({ staff_id: id, team_id: null }));
      const payload = {
        staff_id: manageSupervisor,
        team_id: null,
        task_team_members: taskStaffMembers,
      };
      if (manageSupervisor) payload.team_supervisor = manageSupervisor;

      if (editTaskId) {
        await fetch(`http://localhost:4000/api/tasks/${editTaskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      
        // Update UI
        setEditTask(et => ({
          ...et,
          team_id: null,
          staff_id: manageSupervisor,
          staff_name: 
          manageSupervisor
              ? manageTeamStaffList.find(s => s.id === manageSupervisor)?.name || ''
              : '',
          team_supervisor: manageSupervisor || et.team_supervisor,
          task_team_members: manageCleaners
        }));
      }
    
    } else {
      if (editTaskId) {
        // Team assignment: update team_id, supervisor, and task_team_members
        // Get all staff of selected team
        const teamStaff = teamMembers.filter(tm => tm.team_id === manageTeamId).map(tm => ({ staff_id: tm.staff_id, team_id: manageTeamId }));
        const payload = {
          team_id: manageTeamId,
          staff_id: manageTeamSupervisor || et.team_supervisor,
          team_supervisor: manageTeamSupervisor || et.team_supervisor,
          task_team_members: teamStaff,
        };
        // Also update team_supervisor if present
        if (manageTeamSupervisor) payload.team_supervisor = manageTeamSupervisor;
        await fetch(`http://localhost:4000/api/tasks/${editTaskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        // Update UI
        setEditTask(et => ({
          ...et,
          team_id: manageTeamId,
          staff_id: manageTeamSupervisor || et.team_supervisor,
          team_supervisor: manageTeamSupervisor || et.team_supervisor,
          task_team_members: manageCleaners,
          // staff_name: manageCleaners,
          // For display: update staff_name(s) if needed
        }));
      }

    }
    setManageModalOpen(false);
    setManageLoading(false);
  }

  function handleSelectTeam() {
    fetch('http://localhost:4000/api/teams')
      .then(r => r.json())
      .then(setTeams)
      .catch(e => console.error('Team fetch error', e));
    setTeamModalOpen(true);
  }

  function handleTeamModalSelect() {
    setForm(f => ({
      ...f,
      team_id: selectedTeam.id || '',
      staff_id: '', // clear staff for team assignment
    }));
    setTeamModalOpen(false);
  }

  function handleLocationSelect() {
    fetch('http://localhost:4000/api/locations')
      .then(r => r.json())
      .then(setLocations)
      .catch(e => console.error('Location fetch error', e));
    setLocationModalOpen(true);
  }

  function handleLocationModalAdd(loc) {
    setSelectedLocation(loc);
    setForm(f => ({
      ...f,
      location_id: loc.id,
    }));
    setLocationModalOpen(false);
  }

  function handleCreateModalCancel() {
    setCreateModalOpen(false);
  }

  async function handleCreateEvent() {
    setEditTaskId(null);
    const taskStaffMembers = manageCleaners.map(id => ({ staff_id: id, team_id: null }));

    // debugger;
    const payload = {
      assignment_type: form.assignment_type,
      task_name: form.task_name,
      staff_id: form.assignment_type === 'individual' ? (form.staff_id ||manageSupervisor || manageTeamSupervisor) : null,
      team_id: form.assignment_type === 'team' ? form.team_id : null,
      client_id: form.client_id || null,
      location_id: form.location_id || null,
      start_time: form.start_time,
      end_time: form.end_time,
      color: form.color,
      shift_instructions: form.shift_instructions,
      publish: form.publish ? 1 : 0,
      task_team_members: taskStaffMembers
    };
  
    try {
      const res = await fetch('http://localhost:4000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const created = await res.json();
  
      // Fetch enriched task (joins staff, client, location, team)
      const fullRes = await fetch(`http://localhost:4000/api/tasks/${created.id}`);
      const fullTask = await fullRes.json();
  
      // Add to FullCalendar
      const calApi = calendarRef.current.getApi();
      calApi.addEvent({
        id: fullTask.id,
        title: fullTask.task_name + (fullTask.staff_name ? '\n' + fullTask.staff_name : ''),
        start: fullTask.start_time,
        end: fullTask.end_time,
        staff_id: fullTask.staff_id,
        backgroundColor: fullTask.color || '#7c3aed',
        extendedProps: { ...fullTask },
      });
  
      // Close and open edit modal
      setCreateModalOpen(false);
      setEditTaskId(fullTask.id);
      setEditTask(fullTask);
      setEditTabs('Shift');
      setEditModalOpen(true);
    } catch (e) {
      console.error('Create task error', e);
    }
  }

  function handleCreateModalLoad() {
    setSelectedTeam({})
    setSelectedLocation({})
    setSelectedTab('Shift')
    setEditTask(null)
    setEditTabs('Shift')
    setEditInstructions([])
    setEditInstructionInput('')
    setEditClient({})
    setEditReport({})
    setEditRepeat({})
    setManageTeamStaffList([])
    setManageSupervisor('')
    setManageLoading(false)
    setEditTaskId(null)
    setManageModalOpen(false);
    setMainTab('Shift Detail');
    setManageTeamId('');
    setTeamMembers([]);
    setManageTeamSupervisor('');
    setManageTeamsList([]);

    fetch('http://localhost:4000/api/teams')
      .then(r => r.json())
      .then(setManageTeamsList).catch(()=>{});
    fetch('http://localhost:4000/api/team_members')
      .then(r => r.json())
      .then(setTeamMembers).catch(()=>{});
    fetch('http://localhost:4000/api/staff')
      .then(r => r.json())
      .then(setManageTeamStaffList).catch(()=>{});
  }

  function openManageModalCreate() {
    setManageTab('staff'); // always staff mode for create
    setEditTask(null)
    

    fetch('http://localhost:4000/api/staff')
      .then(r => r.json())
      .then(setManageTeamStaffList)
      .catch(() => {});
    setManageModalOpen(true);
  }

  // Open manage modal and prepopulate fields
  function openManageModalEdit() {
    if (editTask?.team_id) {
      setManageTab('team');
      setManageTeamId(editTask.team_id);
      setManageTeamSupervisor(editTask.team_supervisor || editTask.staff_id || '');
      // fetch teams, members, staff for team assignment
      fetch('http://localhost:4000/api/teams')
        .then(r => r.json())
        .then(setManageTeamsList).catch(()=>{});
      fetch('http://localhost:4000/api/team_members')
        .then(r => r.json())
        .then(setTeamMembers).catch(()=>{});
      fetch('http://localhost:4000/api/staff')
        .then(r => r.json())
        .then(setManageTeamStaffList).catch(()=>{});
    } else {
      setManageTab('staff');
      setManageSupervisor(editTask?.staff_id || editTask?.team_supervisor || '');
      setManageCleaners(editTask?.task_team_members ? editTask.task_team_members : []);
      fetch('http://localhost:4000/api/staff')
        .then(r => r.json())
        .then(setManageTeamStaffList).catch(()=>{});
    }
    setManageModalOpen(true);
  }

  // Manage modal component
  function ManageModal() {
    if (!manageModalOpen) return null;
    return (
      <Modal open={manageModalOpen} title={manageTab === 'team' ? "Manage Team Assignment" : "Manage Staff Assignment"} onClose={()=>setManageModalOpen(false)}>
        <div style={{minWidth:400, padding:10}}>
          {manageTab === 'staff' && (
            <div>
              <div>
                <strong>Supervisors</strong>
                <div style={{marginBottom:8}}>
                  <select
                    value={manageSupervisor}
                    onChange={e=>setManageSupervisor(e.target.value)}
                    style={{width:'100%'}}
                  >
                    <option value="">Select Supervisor</option>
                    {manageTeamStaffList.filter(s=>s.role==='Supervisor').map(s=>
                      <option key={s.id} value={s.id}>{s.name}</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <strong>Cleaners</strong>
                <div>
                  {manageTeamStaffList.map(s=>(
                    <label key={s.id} style={{display:'flex',alignItems:'center',gap:6}}>
                      <input
                        type="checkbox"
                        checked={manageCleaners.includes(s.id)}
                        onChange={e => {
                          if (e.target.checked) setManageCleaners(arr => [...arr, s.id]);
                          else setManageCleaners(arr => arr.filter(id => id !== s.id));
                        }}
                      />{s.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          {manageTab === 'team' && (
            <div>
              <div>
                <strong>Teams</strong>
                <div>
                  {manageTeamsList.map(team => (
                    <label key={team.id} style={{display:'flex',alignItems:'center',gap:6}}>
                      <input
                        type="radio"
                        checked={manageTeamId === team.id}
                        onChange={()=>{
                          setManageTeamId(team.id);
                          setManageTeamSupervisor(team.supervisor_id);
                        }}
                      />{team.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <strong>Supervisor</strong>
                <div style={{marginBottom:8}}>
                  <select
                    value={manageTeamSupervisor}
                    onChange={e=>setManageTeamSupervisor(e.target.value)}
                    style={{width:'100%'}}
                  >
                    <option value="">Select Supervisor</option>
                    {manageTeamsList
                      .filter(t=>t.id===manageTeamId)
                      .map(t=>manageTeamStaffList.filter(s=>s.role==='Supervisor' || s.role==='manager').map(s=>
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div>
                <strong>Team Members</strong>
                <div>
                  {teamMembers
                    .filter(tm=>tm.team_id===manageTeamId)
                    .map(tm=>{
                      const s = manageTeamStaffList.find(st=>st.id===tm.staff_id);
                      if (!s) return null;
                      return <div key={s.id}>{s.name} <span style={{color:'#888',fontSize:11}}>({s.role})</span></div>;
                    })}
                </div>
              </div>
            </div>
          )}
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
            <button className="btn" onClick={()=>setManageModalOpen(false)} disabled={manageLoading}>Cancel</button>
            <button className="btn primary" onClick={handleManageModalSave} disabled={manageLoading}>Save</button>
          </div>
        </div>
      </Modal>
    );
  }

  // --- TEAM SELECTION MODAL ---
  function TeamSelectionModal() {
    // teams, supervisors, staff
    fetch('http://localhost:4000/api/teams').then(r => r.json()).then(setTeams).catch(() => {});

    debugger;

    return (
      <Modal open={teamModalOpen} title="Select Team" onClose={()=>setTeamModalOpen(false)}>
        <div style={{display:'flex', flexDirection:'column', gap:12, minWidth:340}}>
          <div>
            <strong>Teams</strong>
            <div>
              {(teams).map(team => (
                <label key={team.id} style={{display:'flex',alignItems:'center',gap:6}}>
                  <input type="radio"
                    checked={selectedTeam.id === team.id}
                    onChange={()=>{setSelectedTeam(team); setManageSupervisor(team.supervisor_id); setManageCleaners(
                      teamMembers.filter(arr => {
                        if (arr.team_id == team.id) return true;
                        return false;
                      }).map(arr => arr.staff_id)
                    );}}
                  />
                  {team.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <strong>Supervisors</strong>
            <div>
              {teams.filter(t => t.id === selectedTeam.id).map(team =>
                <label key={team.supervisor_id} style={{display:'flex',alignItems:'center',gap:6}}>
                  <input type="radio"
                    checked={manageSupervisor === team.supervisor_id}
                    onChange={()=>setManageSupervisor(team.supervisor_id)}
                  />
                  {staff.find(s=>s.id===team.supervisor_id)?.name || '-'}
                </label>
              )}
            </div>
          </div>
          <div>
            <strong>Staff</strong>
            <div>
              {staff.map(s => {
                const isSelected = teamMembers.some(tm => tm.team_id === selectedTeam.id && tm.staff_id === s.id);
                return (
                  <label key={s.id} style={{display:'flex',alignItems:'center',gap:6}}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => {
                        if (e.target.checked) {
                          // Add to manageCleaners if not present
                          setManageCleaners(arr => [...new Set([...arr, s.id])]);
                        } else {
                          // Remove from manageCleaners
                          setManageCleaners(arr => arr.filter(id => id !== s.id));
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
            <button className='btn' onClick={()=>setTeamModalOpen(false)}>Cancel</button>
            <button className='btn primary' onClick={handleTeamModalSelect}>Select Team</button>
          </div>
        </div>
      </Modal>
    );
  }

  // --- LOCATION SELECTION MODAL ---
  function LocationSelectionModal() {
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [unitNo, setUnitNo] = useState('');
    const [comment, setComment] = useState('');
    const [radius, setRadius] = useState(100);
    const [mapLoaded, setMapLoaded] = useState(false);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const circleRef = useRef(null);
    const [loadingDelete, setLoadingDelete] = useState({});

    // Load Google Maps Places API
    // useEffect(() => {
    //   if (!mapLoaded) {
    //     loadGoogleMapsApi(GOOGLE_MAPS_API_KEY)
    //       .then(maps => setMapLoaded(true))
    //       .catch(() => {});
    //   }
    // }, [mapLoaded]);

    // Update map marker/circle when place selected
    useEffect(() => {
      if (mapLoaded && selectedPlace && mapRef.current) {
        const maps = window.google.maps;
        const map = mapRef.current;
        if (markerRef.current) markerRef.current.setMap(null);
        if (circleRef.current) circleRef.current.setMap(null);
        const latlng = {lat: selectedPlace.geometry.location.lat(), lng: selectedPlace.geometry.location.lng()};
        markerRef.current = new maps.Marker({position:latlng, map});
        circleRef.current = new maps.Circle({
          map,
          center: latlng,
          radius: radius,
          fillColor: '#1976d2',
          fillOpacity: 0.2,
          strokeColor: '#1976d2',
        });
        map.setCenter(latlng);
        map.setZoom(16);
      }
    }, [selectedPlace, radius, mapLoaded]);

    // Initialize map
    useEffect(() => {
      if (mapLoaded && !mapRef.current) {
        const maps = window.google.maps;
        mapRef.current = new maps.Map(document.getElementById('location-map'), {
          center: {lat: -33.8688, lng: 151.2195},
          zoom: 13,
        });
      }
    }, [mapLoaded]);

    function handleSearch() {
      if (!search || !window.google || !window.google.maps) return;
      const service = new window.google.maps.places.PlacesService(mapRef.current);
      service.textSearch({query: search}, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          setSearchResults(results);
        }
      });
    }

    function handleSelectPlace(place) {
      setSelectedPlace(place);
      setSearchResults([]);
    }

    function handleAddLocation() {
      const loc = {
        title: selectedPlace?.name || '',
        address: selectedPlace?.formatted_address || '',
        lat: selectedPlace?.geometry.location.lat(),
        lng: selectedPlace?.geometry.location.lng(),
        unit_no: unitNo,
        radius_meters: radius,
        comment: comment,
      };
    
      fetch('http://localhost:4000/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loc),
      })
        .then(r => r.json())
        .then(newLoc => {
          handleLocationModalAdd(newLoc);
          return fetch('http://localhost:4000/api/locations');
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
      setLoadingDelete(ld => ({...ld, [locId]: true}));
      try {
        await fetch(`http://localhost:4000/api/locations/${locId}`, { method: 'DELETE' });
        // Refresh locations list
        fetch('http://localhost:4000/api/locations')
          .then(r => r.json())
          .then(setLocations)
          .catch(()=>{});
      } catch (e) {
        // ignore
      }
      setLoadingDelete(ld => ({...ld, [locId]: false}));
    }

    useEffect(() => {
      if (locationModalOpen) {
        fetch('http://localhost:4000/api/locations')
          .then(r => r.json())
          .then(setLocations)
          .catch(e => console.error('Fetch locations error', e));
      }
    }, [locationModalOpen]);

    useEffect(() => {
      if (!editModalOpen && !createModalOpen) {
        fetch('http://localhost:4000/api/tasks')
          .then(r => r.json())
          .then(data => {
            const ev = data.map(t => {
              const supervisor = staff.find(s => s.id === t.staff_id);


              return {
                id: t.id,
                title: t.task_name + (t.staff_name ? '\n' + t.staff_name : ''),
                start: t.start_time,
                end: t.end_time,
                backgroundColor: supervisor?.color || '#7c3aed',
                borderColor: supervisor?.color || '#7c3aed',
                textColor: '#fff',
                extendedProps: { ...t },
              }
            }
              
          );
            setEvents(ev);
          })
          .catch(e => console.error('Task refresh error', e));
      }
    }, [editModalOpen, createModalOpen]);

    return (
      <Modal open={locationModalOpen} title="Select Location" onClose={()=>setLocationModalOpen(false)}>
        <div style={{display:'flex', flexDirection:'column', gap:10, minWidth:400}}>
          <div>
            <input
              type="text"
              placeholder="Search location"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{width:'70%'}}
            />
            <button className="btn" onClick={handleSearch} style={{marginLeft:8}}>Search</button>
          </div>
          {searchResults.length > 0 && (
            <div style={{maxHeight:120, overflowY:'auto', border:'1px solid #ddd', marginBottom:8}}>
              {searchResults.map((r, idx) => (
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
              value={unitNo}
              onChange={e=>setUnitNo(e.target.value)}
              style={{width:'30%'}}
            />
            <input
              type="text"
              placeholder="Location Comment"
              value={comment}
              onChange={e=>setComment(e.target.value)}
              style={{width:'60%'}}
            />
            <input
              type="number"
              min={10}
              max={1000}
              step={10}
              placeholder="Radius (m)"
              value={radius}
              onChange={e=>setRadius(Number(e.target.value))}
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
                      <td style={{padding:'6px 8px'}}>{loc.address || loc.title || '-'}</td>
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
                          disabled={loadingDelete[loc.id]}
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
            <button className="btn primary" onClick={handleAddLocation} disabled={!selectedPlace}>Add Location</button>
          </div>
        </div>
      </Modal>
    );
  }

  // --- TASK EDIT VIEW MODAL ---
  // --- EditTaskModal with ManageModal integration ---
  function EditTaskModal() {
    if (!editTask) return null;

    // setEditTaskId(editTask.id);

    // Helper function for updating shift fields and PUT to backend
    function handleShiftUpdate(changes) {
      const updated = {...editTask, ...changes};
      setEditTask(updated);
      fetch(`http://localhost:4000/api/tasks/${editTaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      }).catch(err => console.error('Update shift error', err));
    }

    debugger;
    // ---- Manage Modal logic ----

    return (
      <Modal open={editModalOpen} title="Edit Shift" onClose={() => setEditModalOpen(false)}>
        <div style={{minWidth:720, display:'flex', flexDirection:'column', gap:10}}>
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
                onClick={() => setMainTab(tab)}
                style={{
                  background: mainTab === tab ? '#eef2ff' : 'transparent',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 6,
                  fontWeight: mainTab === tab ? '600' : '500',
                  color: mainTab === tab ? '#4338ca' : '#374151',
                  cursor: 'pointer'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Main Content */}
          {mainTab === 'Shift Detail' && (
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
                    onClick={() => setEditTabs(tab)}
                    style={{
                      background: editTabs === tab ? '#eef2ff' : 'transparent',
                      border: 'none',
                      borderLeft: editTabs === tab ? '3px solid #6366f1' : '3px solid transparent',
                      textAlign:'left',
                      padding:'10px 20px',
                      color: editTabs === tab ? '#4338ca' : '#374151',
                      fontWeight: editTabs === tab ? '600' : '500',
                      cursor:'pointer'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Right Panel Content */}
              <div style={{flex:1, padding:'8px 12px'}}>
                {editTabs === 'Shift' && (
                  <div style={{display:'flex', flexDirection:'column', gap:16}}>
                    {/* Assignment Mode */}
                    {editTask.team_id ? (
                      <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:12, marginBottom:8}}>
                        <div style={{fontWeight:'bold', marginBottom:4}}>Team Assignment</div>
                        <div style={{marginBottom:6}}>
                          <span style={{fontWeight:500}}>Supervisor: </span>
                          {editTask.staff_id || editTask.team_supervisor || '-'}
                        </div>
                        <div style={{marginBottom:6}}>
                          <span style={{fontWeight:500}}>Team Members:</span>
                          <ul style={{margin:0, paddingLeft:18}}>
                            {/* {teamMembers.filter(tm=>tm.team_id===editTask.team_id).map(tm=>{
                              const s = staff.find(st=>st.id===tm.staff_id);
                              if (!s) return null;
                              return <li key={s.id}>{s.name} <span style={{color:'#888',fontSize:11}}>({s.role})</span></li>;
                            })} */}

                            {editTask?.task_team_members?.length > 0
                            ? editTask.task_team_members
                                .map(id => staff.find(s => s.id === id)?.name || '')
                                .filter(name => name)
                                .join(', ')
                            : '-'}
                          </ul>
                        </div>
                        <button className="btn" onClick={openManageModalEdit}>Manage Team</button>
                      </div>
                    ) : (
                      <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:12, marginBottom:8}}>
                        <div style={{fontWeight:'bold', marginBottom:4}}>Individual Assignment</div>
                        <div style={{marginBottom:6}}>
                          <span style={{fontWeight:500}}>Supervisor: </span>
                          {staff.find(s => s.id === (editTask.staff_id || editTask.team_supervisor))?.name || ''}
                        </div>
                        <div style={{marginBottom:6}}>
                          <span style={{fontWeight:500}}>Cleaner: </span>
                          {editTask?.task_team_members?.length > 0
                            ? editTask.task_team_members
                                .map(id => staff.find(s => s.id === id)?.name || '')
                                .filter(name => name)
                                .join(', ')
                            : '-'}
                        </div>
                        <button className="btn" onClick={openManageModalEdit}>Manage Staff</button>
                      </div>
                    )}

                    {/* Schedule Settings */}
                    <div style={{display:'flex', gap:16, alignItems:'flex-end'}}>
                      <label style={{flex:1}}>
                        Date
                        <input
                          type="date"
                          value={dayjs(editTask.start_time).format('YYYY-MM-DD')}
                          onChange={e => {
                            const newDate = e.target.value;
                            const start = dayjs(newDate + 'T' + dayjs(editTask.start_time).format('HH:mm')).toISOString();
                            const end = dayjs(newDate + 'T' + dayjs(editTask.end_time).format('HH:mm')).toISOString();
                            handleShiftUpdate({ start_time: start, end_time: end });
                          }}
                          style={{width:'100%', marginTop:4}}
                        />
                      </label>
                      <label style={{flex:1}}>
                        Time
                        <input
                          type="time"
                          value={dayjs(editTask.start_time).format('HH:mm')}
                          onChange={e => {
                            const date = dayjs(editTask.start_time).format('YYYY-MM-DD');
                            const t = e.target.value;
                            const dur = dayjs(editTask.end_time).diff(dayjs(editTask.start_time), 'minute');
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
                          value={dayjs(editTask.end_time).diff(dayjs(editTask.start_time), 'minute')}
                          onChange={e => {
                            const dur = Number(e.target.value);
                            const end = dayjs(editTask.start_time).add(dur, 'minute').toISOString();
                            handleShiftUpdate({ end_time: end });
                          }}
                          style={{width:'100%', marginTop:4}}
                        />
                      </label>
                    </div>

                    {/* Location Settings */}
                    <div style={{display:'flex', gap:16}}>
                      <label style={{flex:1}}>
                        Location
                        <input
                          type="text"
                          value={editTask.location_title || ''}
                          onChange={e => handleShiftUpdate({ location_title: e.target.value })}
                          style={{width:'100%', marginTop:4}}
                        />
                      </label>
                      <label style={{flex:2}}>
                        Address
                        <input
                          type="text"
                          value={editTask.location_address || ''}
                          onChange={e => handleShiftUpdate({ location_address: e.target.value })}
                          style={{width:'100%', marginTop:4}}
                        />
                      </label>
                    </div>

                    {/* Publish Option */}
                    <div style={{marginTop:8}}>
                      <label style={{display:'flex', alignItems:'center', gap:8}}>
                        <input
                          type="checkbox"
                          checked={!!editTask.publish}
                          onChange={e => handleShiftUpdate({ publish: e.target.checked ? 1 : 0 })}
                        />
                        Publish
                      </label>
                    </div>
                  </div>
                )}

                {editTabs === 'Client' && (
                  <div style={{display:'grid',gap:10}}>
                    <label>Client Name<input value={editClient.client_name||''} readOnly style={{marginLeft:6}}/></label>
                    <label>Company<input value={editClient.company||''} readOnly style={{marginLeft:6}}/></label>
                    <label>ABN<input value={editClient.abn||''} readOnly style={{marginLeft:6}}/></label>
                    <label>Email<input value={editClient.email||''} readOnly style={{marginLeft:6}}/></label>
                    <label>Phone<input value={editClient.phone||''} readOnly style={{marginLeft:6}}/></label>
                  </div>
                )}

                {editTabs === 'Instruction' && (
                  <div>
                    <div>
                      <strong>Instructions:</strong>
                      <ul>
                        {editInstructions.map(i => (
                          <li key={i.id}>{i.ques} <span style={{color:'#888',fontSize:11}}>{i.resp_type}</span></li>
                        ))}
                      </ul>
                      <form onSubmit={e=>{
                        e.preventDefault();
                        fetch('http://localhost:4000/api/task_instructions',{
                          method:'POST',
                          headers:{'Content-Type':'application/json'},
                          body:JSON.stringify({task_id:editTaskId, ques:editInstructionInput, resp_type:'text'}),
                        })
                          .then(r=>r.json())
                          .then(newInst=>{
                            setEditInstructions(arr=>[...arr,newInst]);
                            setEditInstructionInput('');
                          });
                      }}>
                        <input
                          value={editInstructionInput}
                          onChange={e=>setEditInstructionInput(e.target.value)}
                          placeholder="Add instruction"
                          style={{width:'70%'}}
                        />
                        <button className="btn" type="submit" style={{marginLeft:8}}>Add</button>
                      </form>
                    </div>
                  </div>
                )}

                {editTabs === 'Report' && (
                  <div style={{display:'grid',gap:10}}>
                    <label>Shift Started At<input type="datetime-local" value={editReport.started_at||''} readOnly style={{marginLeft:6}}/></label>
                    <label>Shift Stopped At<input type="datetime-local" value={editReport.stopped_at||''} readOnly style={{marginLeft:6}}/></label>
                    <label>Travel Distance (km)<input type="number" value={editReport.travel_dist||''} readOnly style={{marginLeft:6}}/></label>
                    <label>Travel Duration (min)<input type="number" value={editReport.travel_duration||''} readOnly style={{marginLeft:6}}/></label>
                    <label>Messages<textarea style={{width:'100%'}} value={editReport.messages||''} readOnly /></label>
                  </div>
                )}
              </div>
            </div>
          )}

          {mainTab === 'Repeat' && (
            <div style={{padding:'20px', textAlign:'center', color:'#6b7280'}}>
              Repeat configuration coming soon.
            </div>
          )}

          {mainTab === 'Roster' && (
            <div style={{padding:'20px', textAlign:'center', color:'#6b7280'}}>
              Roster overview coming soon.
            </div>
          )}

          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
            <button className="btn" onClick={() => setEditModalOpen(false)}>Close</button>
          </div>
          {/* Manage Modal */}
          {ManageModal()}
        </div>
      </Modal>
    );
  }

  // --- MAIN RENDER ---
  return (
    <div style={{display:'flex', flex:1}}>
      <div style={{flex:1}}>
        <FullCalendar
          plugins={[ dayGridPlugin, timeGridPlugin, interactionPlugin ]}
          initialView='timeGridWeek'
          headerToolbar={{
            left: 'prev,next today createTask',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          customButtons={{
            createTask: {
              text: 'Create',
              click: () => {
                handleCreateModalLoad();
                // open create modal
                setCreateModalOpen(true);
                setEditModalOpen(false);
              }
            }
          }}
          selectable={true}
          selectMirror={true}
          select={handleDateSelect}
          eventClick={handleEventClick}
          events={events}
          editable={true}
          eventDrop={handleEventDrop}
          ref={calendarRef}
          height="auto"
        />
      </div>

      {/* Create Shift Modal */}
      <Modal open={createModalOpen} title="Create a new shift" onClose={handleCreateModalCancel}>
        <div style={{display:'flex',flexDirection:'column',gap:10,minWidth:420}}>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <span>Assignment Type:</span>
            <button
              className={form.assignment_type==='individual'?'btn primary':'btn'}
              onClick={()=>handleAssignmentTypeChange('individual')}
              type="button"
            >Individual</button>
            <button
              className={form.assignment_type==='team'?'btn primary':'btn'}
              onClick={()=>handleAssignmentTypeChange('team')}
              type="button"
            >Team</button>
          </div>
          <label>
            Shift Name
            <input value={form.task_name} onChange={e=>setForm(f=>({...f, task_name:e.target.value}))} style={{width:'100%',marginTop:4}} />
          </label>
          {form.assignment_type==='team' && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span>Team:</span>
              <button className="btn" onClick={handleSelectTeam} type="button">
                {form.team_id ? (teams.find(t=>t.id===form.team_id)?.name || 'Selected') : 'Select Team'}
              </button>
            </div>
          )}
          {form.assignment_type==='individual' && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span>Staff:</span>
              <button className="btn" onClick={openManageModalCreate}>Manage Staff</button>
            </div>
          )}
          <div style={{display:'flex',gap:8}}>
            <label style={{flex:2}}>
              Booking Date
              <input
                type="date"
                value={form.start_time ? dayjs(form.start_time).format('YYYY-MM-DD') : ''}
                onChange={e => {
                  // Update both start_time and end_time date part
                  setForm(f => {
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
                value={form.start_time ? dayjs(form.start_time).format('HH:mm') : ''}
                onChange={e => {
                  setForm(f => {
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
            <label style={{flex:1}}>
              Duration (min)
              <input
                type="number"
                min={10}
                max={480}
                value={form.duration}
                onChange={e => {
                  const dur = Number(e.target.value);
                  setForm(f => ({
                    ...f,
                    duration: dur,
                    end_time: f.start_time
                      ? dayjs(f.start_time).add(dur, 'minute').toISOString()
                      : f.end_time,
                  }));
                }}
                style={{width:'100%',marginTop:4}}
              />
            </label>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span>Location:</span>
            <button className="btn" onClick={handleLocationSelect} type="button">
              {form.location_id ? (locations.find(l=>l.id===form.location_id)?.title || 'Selected') : 'Select Location'}
            </button>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <label><input type="checkbox" checked={form.include_location_details} onChange={e=>setForm(f=>({...f, include_location_details:e.target.checked}))}/> Include Location Details</label>
            <label><input type="checkbox" checked={form.publish} onChange={e=>setForm(f=>({...f, publish:e.target.checked}))}/> Publish Event</label>
          </div>
          <label>
            Shift Instructions
            <textarea
              value={form.shift_instructions}
              onChange={e=>setForm(f=>({...f, shift_instructions:e.target.value}))}
              rows={3}
              style={{width:'100%',marginTop:4}}
            />
          </label>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn" onClick={handleCreateModalCancel}>Cancel</button>
            <button className="btn primary" onClick={handleCreateEvent}>Create Event</button>
          </div>
        </div>
        {TeamSelectionModal()}
        {LocationSelectionModal()}
      </Modal>

      {/* // Edit Task Modal */}
      {EditTaskModal()}
      {ManageModal()}
    </div>
  );
}
