import API from "./api";

// Enroll or replace a worker's face template.
// Superadmin authorization must be enforced by the backend.
export const enrollWorkerFace = async (data) => {
  const res = await API.post("/face-attendance/enroll", data);
  return res.data;
};

// Remove a worker's enrolled face template.
export const removeWorkerFace = async (workerId) => {
  const res = await API.delete(
    `/face-attendance/enroll/${workerId}`
  );
  return res.data;
};

// Submit a captured face descriptor for server-side matching.
// The backend must validate the descriptor and authorize the action.
export const recognizeWorkerFace = async (data) => {
  const res = await API.post("/face-attendance/recognize", data);
  return res.data;
};
