export const minutesBetween = (a, b) =>
    a && b ? (new Date(b) - new Date(a)) / 60000 : 0;
  
  export const formatHM = mins =>
    `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;