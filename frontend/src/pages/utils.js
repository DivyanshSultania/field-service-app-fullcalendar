const token = localStorage.getItem("token");

export const minutesBetween = (a, b) =>
    a && b ? (new Date(b) - new Date(a)) / 60000 : 0;
  
export const formatHM = mins =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;


  
export const authFetch = function (url, obj) {
  if (!obj) {
    obj = {};
  }

  if (!obj.headers) {
    obj.headers = {};
  }

  obj.headers['Authorization'] = `Bearer ${token}`;

  return fetch(url, obj).then(r => {
    if (r.status === 401) {
      localStorage.clear();
      window.location.reload();
    }
    return r;
  });

}