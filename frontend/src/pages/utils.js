export const minutesBetween = (a, b) =>
    a && b ? (new Date(b) - new Date(a)) / 60000 : 0;
  
export const formatHM = mins =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;


// const authFetch = async (url, options = {}) => {
//   const token = localStorage.getItem("token");

//   const res = await fetch(url, {
//     ...options,
//     headers: {
//       ...options.headers,
//       Authorization: `Bearer ${token}`,
//     }
//   });

//   if (res.status === 401) {
//     localStorage.clear();
//     window.location.reload();
//     throw new Error("Unauthorized");
//   }

//   return res.json();
// };
  
export const authFetch = async function (url, obj = {}) {
  if (!obj.headers) {
    obj.headers = {};
  }

  const token = localStorage.getItem("token");

  obj.headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, obj);

  if (res.status === 401) {
    localStorage.clear();
    window.location.reload();
    throw new Error("Unauthorized");
  }

  return res;
}