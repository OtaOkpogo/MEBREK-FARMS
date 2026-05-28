import API from "./api";


// ================= GET =================

export const fetchAttendance =
  async () => {

    const res =
      await API.get(
        "/attendance"
      );

    return res.data;
  };


// ================= CREATE =================

export const createAttendance =
  async (data) => {

    const res =
      await API.post(
        "/attendance",
        data
      );

    return res.data;
  };


// ================= DELETE =================

export const deleteAttendance =
  async (id) => {

    const res =
      await API.delete(
        `/attendance/${id}`
      );

    return res.data;
  };
