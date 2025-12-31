import React, { useRef, useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import dayjs from 'dayjs';
import Modal from './Modal';
import RecurringShiftSettings from './RecurringShiftSettings'
import { GOOGLE_MAPS_API_KEY, loadGoogleMapsApi } from '../utils/googleMaps';

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

export default function CalendarView({filter = { type: 'staff', ids: [] }}) {
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
  const [manageLoading, setManageLoading] = useState(false);


  // DB Fetched Values
  const [teams, setTeams] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [clients, setClients] = useState([]);
  const [locations, setLocations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);

  // Temp States
  const [currentTask, setCurrentTask] = useState({});
  const [manageCleaners, setManageCleaners] = useState([]);

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


  // Fetch teams, staff, clients, locations
  useEffect(() => {
    fetch('http://localhost:4000/api/teams').then(r => r.json()).then(setTeams).catch(() => {});
    fetch('http://localhost:4000/api/staff').then(r => r.json()).then(setStaffs).catch(() => {});
    fetch('http://localhost:4000/api/clients').then(r => r.json()).then(setClients).catch(() => {});
    fetch('http://localhost:4000/api/locations').then(r => r.json()).then(setLocations).catch(() => {});
    fetch('http://localhost:4000/api/team_members').then(r => r.json()).then(setTeamMembers).catch(() => {});
    fetch('http://localhost:4000/api/tasks').then(r => r.json()).then(setTasks).catch(() => {});

    const listener = () => {
      // Reload tasks using your existing function
      fetch('http://localhost:4000/api/tasks').then(r => r.json()).then(setTasks).catch(() => {});
    };
  
    window.addEventListener("refreshCalendar", listener);
    return () => window.removeEventListener("refreshCalendar", listener);
  }, []);

  async function computeAndSaveTravelDistance(task, isBtnClick) {
    debugger;
    if (
      !task 
      || !task.staff_id 
      || !task.start_time 
      || !task.location_id 
      || (!isBtnClick && (task.travel_dist || task.travel_duration))) {
      if (isBtnClick) {
        showToast('Please make sure location, staff and start time are configured for this task.');
      }
      return;
    }
  
    const sameDay = tasks.filter(t =>
      ((t.staff_id === task.staff_id) || t.task_team_members.indexOf(task.staff_id) !== -1) &&
      t.start_time &&
      dayjs(t.start_time).isSame(dayjs(task.start_time), 'day') &&
      t.id !== task.id
    );
    if (sameDay.length === 0) {
      if (isBtnClick) {
        alert('No previous shift found on the same day');
      }
      return;
    }
  
    const prev = sameDay.sort((a, b) => new Date(b.start_time) - new Date(a.start_time))[0];
    if (!prev || !prev.location_id) { 
      if (isBtnClick) {
        alert('No location found for previous shift'); 
      }
      return; 
    }

    const fromLoc = locations.find(l => l.id === prev.location_id);
    const toLoc = locations.find(l => l.id === task.location_id);
    if (!fromLoc || !toLoc || !fromLoc.lat || !toLoc.lat) {
      if (isBtnClick) {  
        alert('Location coordinates missing');
      }
      return;
    }
  
    try {
      await loadGoogleMapsApi(GOOGLE_MAPS_API_KEY);
      const directionsService = new window.google.maps.DirectionsService();
      const resp = await new Promise((resolve, reject) => {
        directionsService.route({
          origin: { lat: Number(fromLoc.lat), lng: Number(fromLoc.lng) },
          destination: { lat: Number(toLoc.lat), lng: Number(toLoc.lng) },
          travelMode: 'DRIVING'
        }, (result, status) => {
          if (status === 'OK') resolve(result);
          else reject(status);
        });
      });
  
      const leg = resp.routes[0].legs[0];
      const distKm = (leg.distance.value / 1000).toFixed(2);
      const durMin = Math.round(leg.duration.value / 60);
  
      setTravelInfo({ distance_km: distKm, duration_min: durMin, from_location: prev.location_id });

      await fetch(`http://localhost:4000/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, travel_from: prev.location_id, travel_dist: distKm, travel_duration: durMin })
      });
    } catch (e) {
      console.error('Auto travel compute failed:', e);
      showToast(typeof arguments[1] === 'string' ? arguments[1] : (arguments[0]?.message || 'Error occurred'));
    }
  }

  function updateCalendarView() {
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
      const supervisor = staffs.find(s => s.id === t.staff_id);
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
  }

  useEffect(() => {
    updateCalendarView();
  }, [tasks, filter, staffs]);

  // Handlers
  // --- CALENDAR HANDLERS ---
  function handleEventClick(clickInfo) {
    // debugger;
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
      task_team_members: currentTask.task_team_members
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
      computeAndSaveTravelDistance(fullTask);
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

    setLocationModalOpen(true);
  }

  function LocationSelectionModal() {
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
      const loc = {
        title: selectedLocationPlace?.name || '',
        address: selectedLocationPlace?.formatted_address || '',
        lat: selectedLocationPlace?.geometry.location.lat(),
        lng: selectedLocationPlace?.geometry.location.lng(),
        unit_no: locationUnitNo,
        radius_meters: locationRadiusMeter,
        comment: locationComment,
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
      setLocationLoadingDelete(ld => ({...ld, [locId]: true}));
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
      setLocationLoadingDelete(ld => ({...ld, [locId]: false}));
    }

    useEffect(() => {
      if (locationModalOpen) {
        fetch('http://localhost:4000/api/locations')
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
              placeholder="Search location"
              value={locationSearchText}
              onChange={e => setLocationSearchText(e.target.value)}
              style={{width:'70%'}}
            />
            <button className="btn" onClick={handleSearch} style={{marginLeft:8}}>Search</button>
          </div>
          {locationSearchResults.length > 0 && (
            <div style={{maxHeight:120, overflowY:'auto', border:'1px solid #ddd', marginBottom:8}}>
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
              onChange={e=>setLocationUnitNo(e.target.value)}
              style={{width:'30%'}}
            />
            <input
              type="text"
              placeholder="Location Comment"
              value={locationComment}
              onChange={e=>setlocationComment(e.target.value)}
              style={{width:'60%'}}
            />
            <input
              type="number"
              min={10}
              max={1000}
              step={10}
              placeholder="Radius (m)"
              value={locationRadiusMeter}
              onChange={e=>setLocationRadiusMeter(Number(e.target.value))}
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
            <button className="btn primary" onClick={handleAddLocation} disabled={!selectedLocationPlace}>Add Location</button>
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

    
    setEditInstructionInput('');
    setEditInstructionInputRespType('text');
    setEditingInstructionId(null);
    
    // set current task and clear previous selcted modal variables
    // Load instructions for the currently selected task (if one exists)
    // Bring instructions for selected task
    debugger;
    // if (currentTask && currentTask.id) {
    if (taskObj && taskObj.id) {
      fetch(`http://localhost:4000/api/task_instructions/${taskObj.id}`)
        .then(r => r.json())
        .then(list => {
          if (Array.isArray(list)) {
            setEditInstructions(list || []);
          } else {
            setEditInstructions([]);
          }
        })
        .catch(() => setEditInstructions([]));

        fetch(`http://localhost:4000/api/task_comments/${taskObj.id}`)
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
    fetch('http://localhost:4000/api/tasks').then(r => r.json()).then(taskResp => {
      setTasks(taskResp);

      updateCalendarView();
    }).catch((err) => {
      console.error('Error Occurred in closeEditTaskModal', err);
      showToast(typeof arguments[1] === 'string' ? arguments[1] : (arguments[0]?.message || 'Error occurred'));
    });
  }

  function EditTaskModal() {
    if (!currentTask) {
      return null;
    }


    // Helper function for updating shift fields
    function handleShiftUpdate(changes) {
      const updated = {...currentTask, ...changes};
      setCurrentTask(updated);
      
    }

    function handleSaveShiftModal() {
      // debugger;
      setManageLoading(true);
      fetch(`http://localhost:4000/api/tasks/${currentTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentTask),
      }).then(res => {
        // debugger;
        setManageLoading(false);
        computeAndSaveTravelDistance(currentTask);
        setEditModalOpen(false);

        fetch('http://localhost:4000/api/tasks').then(r => r.json()).then(taskResp => {
          setTasks(taskResp);
    
          updateCalendarView();
        }).catch((err) => {
          console.error('Error Occurred in closeEditTaskModal', err);
          showToast(typeof arguments[1] === 'string' ? arguments[1] : (arguments[0]?.message || 'Error occurred'));
        });

        // TODO: Update event extra props
        // const calApi = calendarRef.current.getApi();

        // // Get the event by ID
        // const selectedEvent = calApi.getEventById(currentTask.id);

        // if (selectedEvent) {
        //   if (currentTask.title) selectedEvent.setProp('title', currentTask.title);
        //   if (currentTask.start) selectedEvent.setStart(currentTask.start);
        //   if (currentTask.end) selectedEvent.setEnd(currentTask.end);

        //   // Update custom properties
        //   // if (currentTask.staff_id) selectedEvent.setExtendedProp('staff_id', currentTask.staff_id);

        //   for (let currentTaskKey in currentTask) {
        //     selectedEvent.setExtendedProp(currentTaskKey, currentTask[currentTaskKey]);
        //   }

        //   if (currentTask.backgroundColor) selectedEvent.setProp('backgroundColor', currentTask.backgroundColor);
        // }

      }).catch(err => {
        console.error('Update shift error', err)
        setManageLoading(false);
        setEditModalOpen(false)
      });
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
      const payload = { task_id: currentTask.id, ques: editInstructionInput, resp_type: editInstructionInputRespType };
      try {
        const res = await fetch(`http://localhost:4000/api/task_instructions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const newInst = await res.json();
        setEditInstructions(arr => [...arr, newInst]);
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
        fetch(`http://localhost:4000/api/task_instructions/${currentTask.id}`)
          .then(r => r.json())
          .then(list => setEditInstructions(list || []))
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
        const res = await fetch(`http://localhost:4000/api/task_instructions/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inst)
        });
        const updated = await res.json();
        setEditInstructions(arr => arr.map(i => i.id === id ? updated : i));
        setEditingInstructionId(null);
      } catch (err) {
        console.error('Update instruction error', err);
        showToast(typeof arguments[1] === 'string' ? arguments[1] : (arguments[0]?.message || 'Error occurred'));
      }
    }

    async function handleDeleteInstruction(id) {
      if (!confirm('Delete instruction?')) return;
      try {
        await fetch(`http://localhost:4000/api/task_instructions/${id}`, { method: 'DELETE' });
        setEditInstructions(arr => arr.filter(i => i.id !== id));
      } catch (err) {
        console.error('Delete instruction error', err);
        showToast(typeof arguments[1] === 'string' ? arguments[1] : (arguments[0]?.message || 'Error occurred'));
      }
    }

    const refreshCalendar = () => {
      // Trigger a global event to reload tasks everywhere
      window.dispatchEvent(new CustomEvent("refreshCalendar"));
    };

    // Instructions Handlers Ends

    // ---- Manage Modal logic ----

    // Load recurring children for roster tab
    async function loadRecurringChildren(taskId) {
      const res = await fetch(`http://localhost:4000/api/recurring/${taskId}`);
      const data = await res.json();
      setRecurringSettings(data.row || []);
      setChildTasks(data.children || []);
    }

    useEffect(() => {
      if (editModalOpen && currentTask && currentTask.id) {
        loadRecurringChildren(currentTask.id);
      }
    }, [editModalOpen, currentTask && currentTask.id]);

    return (
      <Modal open={editModalOpen} title="Edit Shift" onClose={closeEditTaskModal}>
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
                    

                    {/* Publish Option */}
                    <div style={{marginTop:8}}>
                      <label style={{display:'flex', alignItems:'center', gap:8}}>
                        <input
                          type="checkbox"
                          checked={!!currentTask.publish}
                          onChange={e => handleShiftUpdate({ publish: e.target.checked ? 1 : 0 })}
                        />
                        Publish
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
                    <div style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, background:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
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
                    </div>

                    {/* Start Shift Section */}
                    <div style={{marginTop:8, borderRadius:8}}>
                      {(!currentTask.started_at && !currentTask.stopped_at) ? (
                        <div>
                          <button className="btn primary" onClick={async ()=>{
                            // start shift locally and persist
                            const started = new Date().toISOString();
                            handleShiftUpdate({ started_at: started });
                            try {
                              await fetch(`http://localhost:4000/api/tasks/${currentTask.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...currentTask, started_at: started}) });
                            } catch(e){ console.error('start shift save error', e); }

                            // start timer UI
                            setShiftTimerSeconds(0);
                            if (shiftTimerRef.current) clearInterval(shiftTimerRef.current);
                            shiftTimerRef.current = setInterval(()=>{
                              setShiftTimerSeconds(s => s + 1);
                            }, 1000);
                          }}>▶ Start Shift</button>
                        </div>
                      ) : (currentTask.started_at && !currentTask.stopped_at && (
                        <div style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, background:'#fff'}}>
                          <div style={{fontWeight:600}}>Shift Started</div>
                          <div style={{fontSize:13,color:'#6b7280'}}>Shift started at {currentTask.started_at ? dayjs(currentTask.started_at).format('h:mm a') : '-'}</div>
                          <div style={{marginTop:8, display:'flex', gap:8}}>
                            <button className="btn" onClick={()=>{
                              // Pause: stop timer
                              if (shiftTimerRef.current) { clearInterval(shiftTimerRef.current); shiftTimerRef.current = null; }
                            }}>Pause</button>
                            <button className="btn" onClick={async ()=>{
                              // End shift: set stopped_at
                              const stopped = new Date().toISOString();
                              handleShiftUpdate({ stopped_at: stopped });
                              try {
                                await fetch(`http://localhost:4000/api/tasks/${currentTask.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...currentTask, stopped_at: stopped}) });
                              } catch(e){ console.error('end shift save error', e); }
                              if (shiftTimerRef.current) { clearInterval(shiftTimerRef.current); shiftTimerRef.current = null; }
                            }}>End Shift</button>
                          </div>
                          <div style={{marginTop:10}}>
                            <div>Timer: <strong>{Math.floor(shiftTimerSeconds/3600)}:{String(Math.floor((shiftTimerSeconds%3600)/60)).padStart(2,'0')}:{String(shiftTimerSeconds%60).padStart(2,'0')}</strong></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    

                    {/* Time Tracking Section */}
                    <div style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, background:'#fff'}}>
                      <div style={{fontWeight:600, marginBottom:8}}>Time Tracking</div>
                      <div style={{display:'flex', gap:24}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,color:'#6b7280'}}>Scheduled</div>
                          <div>In: {currentTask.start_time ? dayjs(currentTask.start_time).format('D MMM YYYY, HH:mm') : '-'}</div>
                          <div>Out: {currentTask.end_time ? dayjs(currentTask.end_time).format('D MMM YYYY, HH:mm') : '-'}</div>
                          <div style={{marginTop:8}}>Sch Length: <strong>{currentTask.start_time && currentTask.end_time ? dayjs(currentTask.end_time).diff(dayjs(currentTask.start_time), 'hour', true).toFixed(2) : '0:00'}</strong></div>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,color:'#6b7280'}}>Logged</div>
                          <div>In: {currentTask.started_at ? dayjs(currentTask.started_at).format('D MMM YYYY, HH:mm') : 'N/A'}</div>
                          <div>Out: {currentTask.stopped_at ? dayjs(currentTask.stopped_at).format('D MMM YYYY, HH:mm') : 'N/A'}</div>
                          <div style={{marginTop:8}}>Log Length: <strong>{currentTask.started_at && currentTask.stopped_at ? dayjs(currentTask.stopped_at).diff(dayjs(currentTask.started_at), 'minute') + ' min' : (currentTask.started_at ? `${Math.floor(shiftTimerSeconds/60)} min` : '0 min')}</strong></div>
                          {/* <div>Pause Time: <strong>0:00</strong></div>
                          <div>Pay Length: <strong>0:00</strong></div> */}
                        </div>
                      </div>
                    </div>

                    {/* Travel Distance Section */}
                    <div style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, background:'#fff'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div style={{fontWeight:600}}>Travel Distance</div>
                        <div style={{display:'flex', gap:8}}>
                          <button className="btn" disabled={manageLoading} onClick={async () => {
                            setManageLoading(true);
                            await computeAndSaveTravelDistance(currentTask, true)
                            setManageLoading(false);
                          }
                          // async ()=>{
                          //   // compute travel info by finding previous task for same supervisor on same day
                          //   if (!currentTask || !currentTask.staff_id || !currentTask.start_time) return;
                          //   // find tasks in-state (we have `tasks` state)
                          //   const sameDay = tasks.filter(t => t.staff_id === currentTask.staff_id && t.start_time && dayjs(t.start_time).isSame(dayjs(currentTask.start_time), 'day') && t.id !== currentTask.id);
                          //   if (sameDay.length === 0) { alert('No previous shift found on the same day'); return; }
                          //   // pick the latest one before current task
                          //   const prev = sameDay.sort((a,b)=> new Date(b.start_time) - new Date(a.start_time))[0];
                          //   if (!prev || !prev.location_id) { alert('No location found for previous shift'); return; }

                          //   const fromLoc = locations.find(l => l.id === prev.location_id);
                          //   const toLoc = locations.find(l => l.id === currentTask.location_id);
                          //   if (!fromLoc || !toLoc || !fromLoc.lat || !toLoc.lat) { alert('Location coordinates missing'); return; }

                          //   try {
                          //     await loadGoogleMapsApi(GOOGLE_MAPS_API_KEY);
                          //     const directionsService = new window.google.maps.DirectionsService();
                          //     const resp = await new Promise((resolve, reject) => {
                          //       directionsService.route({
                          //         origin: {lat: Number(fromLoc.lat), lng: Number(fromLoc.lng)},
                          //         destination: {lat: Number(toLoc.lat), lng: Number(toLoc.lng)},
                          //         travelMode: 'DRIVING'
                          //       }, (result, status) => {
                          //         if (status === 'OK') resolve(result);
                          //         else reject(status);
                          //       });
                          //     });

                          //     const route = resp.routes[0];
                          //     const leg = route.legs[0];
                          //     const distMeters = leg.distance.value;
                          //     const durSec = leg.duration.value;
                          //     const distKm = (distMeters/1000).toFixed(2);
                          //     const durMin = Math.round(durSec/60);

                          //     setTravelInfo({ distance_km: distKm, duration_min: durMin, from_location: prev.location_id });

                          //     // persist to backend
                          //     await fetch(`http://localhost:4000/api/tasks/${currentTask.id}`, {
                          //       method:'PUT', headers:{'Content-Type':'application/json'},
                          //       body: JSON.stringify({ ...currentTask, travel_from: prev.location_id, travel_dist: Number(distKm), travel_duration: Number(durMin) })
                          //     });

                          //   } catch(e) {
                          //     console.error('Directions error', e);
                          //     alert('Could not compute route: '+String(e));
                          //   }

                          // }
                          
                          }>🔄 Calculate</button>
                          <button className="btn" onClick={()=>{
                            setTravelInfo({ distance_km: null, duration_min: null, from_location: null });
                          }}>Reset</button>
                        </div>
                      </div>

                      <div style={{display:'flex', gap:12, marginTop:10}}>
                        <div style={{flex:1}}>From Location: {travelInfo.from_location ? (locations.find(l=>l.id===travelInfo.from_location)?.title || travelInfo.from_location) : (currentTask.travel_from ? (locations.find(l=>l.id===currentTask.travel_from)?.title || currentTask.travel_from) : 'No previous shift found on the same day')}</div>
                        <div style={{width:160}}>Distance (km): {travelInfo.distance_km ?? (currentTask.travel_dist ?? '0')}</div>
                        <div style={{width:160}}>Duration (min): {travelInfo.duration_min ?? (currentTask.travel_duration ?? '0')}</div>
                      </div>
                    </div>

                    {/* Messages Section */}
                    <div style={{border:'1px solid #e6e6e6', padding:12, borderRadius:8, background:'#fff'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <div style={{fontWeight:600}}>Messages</div>
                        <div>
                          <button className="btn" onClick={async ()=>{
                            // fetch all comments and filter
                            try {
                              const res = await fetch(`http://localhost:4000/api/task_comments/${currentTask.id}`);
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
                            const res = await fetch('http://localhost:4000/api/task_comments', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
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
              <RecurringShiftSettings task={currentTask} onCreated={refreshCalendar} />
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

  // -- TASK Create Modal --
  function shiftModal() {

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
          <label>
            Shift Name
            <input value={currentTask.task_name} onChange={e=>setCurrentTask(f=>({...f, task_name:e.target.value}))} style={{width:'100%',marginTop:4}} />
          </label>
          {currentTask.assignment_type==='team' && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span>Team:</span>
              <button className="btn" onClick={openTeamSelectionModal} type="button">
                {currentTask.team_id ? (teams.find(t=>t.id===currentTask.team_id)?.name || 'Selected') : 'Select Team'}
              </button>
            </div>
          )}
          {currentTask.assignment_type==='individual' && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span>Staff:</span>
              <button className="btn" onClick={openManageStaffModal}>Manage Staff</button>
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
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span>Location:</span>
            <button className="btn" onClick={openLocationSelectionModal} type="button">
              {currentTask.location_id ? (locations.find(l=>l.id===currentTask.location_id)?.title || 'Selected') : 'Select Location'}
            </button>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {/* <label><input type="checkbox" checked={currentTask.include_location_details} onChange={e=>setCurrentTask(f=>({...f, include_location_details:e.target.checked}))}/> Include Location Details</label> */}
            <label><input type="checkbox" checked={currentTask.publish} onChange={e=>setCurrentTask(f=>({...f, publish:e.target.checked}))}/> Publish Event</label>
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
    <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ flex: 1 }}>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
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
                  let currentDate = new Date();
                  handleDateSelect({
                    start: currentDate,
                    end: new Date(currentDate.setHours(currentDate.getHours() + 1))
                  });
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
            ref={calendarRef}
            height="auto" />
        </div>
        {EditTaskModal()}
        {shiftModal()}
        {/* {LocationSelectionModal()} */}
      </div></>
  );


}