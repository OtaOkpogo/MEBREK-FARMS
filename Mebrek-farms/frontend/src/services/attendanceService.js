import API from "./api";

export const fetchAttendance = async () => {
  const res = await API.get("/attendance");
  return res.data;
};

export const fetchAttendanceWorkers = async () => {
  const res = await API.get("/attendance/workers");
  return res.data;
};

export const createAttendance = async (data) => {
  const res = await API.post("/attendance", data);
  return res.data;
};

export const updateAttendance = async (id, data) => {
  const res = await API.put(`/attendance/${id}`, data);
  return res.data;
};

export const deleteAttendance = async (id) => {
  const res = await API.delete(`/attendance/${id}`);
  return res.data;
};

export const restoreAttendance = async (id) => {
  const res = await API.put(`/attendance/${id}/restore`);
  return res.data;
};
