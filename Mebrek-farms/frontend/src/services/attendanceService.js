import API from "./api";

// ============================================================
// PERSONAL ATTENDANCE
// ============================================================

export const fetchMyAttendance = async () => {
  const res = await API.get("/attendance/mine");
  return res.data;
};

export const checkIn = async () => {
  const res = await API.post("/attendance/check-in", {});
  return res.data;
};

export const checkOut = async () => {
  const res = await API.patch("/attendance/check-out", {});
  return res.data;
};

// ============================================================
// ATTENDANCE ADMINISTRATION
// ============================================================

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

// ============================================================
// DELETED ATTENDANCE
// ============================================================

export const fetchDeletedAttendance = async () => {
  const res = await API.get("/attendance/deleted");
  return res.data;
};

export const restoreAttendance = async (id) => {
  const res = await API.put(`/attendance/${id}/restore`);
  return res.data;
};
