import API from "./api";


// GET

export const fetchBirdHealth =
  async () => {

    const res =
      await API.get("/bird-health");

    return res.data;
  };


// CREATE

export const createBirdHealth =
  async (data) => {

    const res =
      await API.post(
        "/bird-health",
        data
      );

    return res.data;
  };
