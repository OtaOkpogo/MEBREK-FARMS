import { useEffect, useState } from "react";

import {
  fetchAttendance,
  createAttendance,
  deleteAttendance,
} from "../services/attendanceService";


export default function Attendance() {

  const [attendance, setAttendance] =
    useState([]);

  const [formData, setFormData] =
    useState({

      workerName: "",
      role: "",
      status: "Present",

    });


  useEffect(() => {

    loadAttendance();

  }, []);


  const loadAttendance = async () => {

    try {

      const data =
        await fetchAttendance();

      setAttendance(data);

    } catch (err) {

      console.error(err);

    }
  };


  const handleSubmit =
    async (e) => {

    e.preventDefault();

    try {

      await createAttendance(
        formData
      );

      setFormData({

        workerName: "",
        role: "",
        status: "Present",

      });

      loadAttendance();

    } catch (err) {

      console.error(err);

    }
  };


  const handleDelete =
    async (id) => {

    try {

      await deleteAttendance(id);

      loadAttendance();

    } catch (err) {

      console.error(err);

    }
  };


  return (

    <div className="p-6">

      <h1
        className="
          text-3xl
          font-bold
          mb-6
        "
      >
        Farm Attendance 👨‍🌾
      </h1>


      {/* FORM */}

      <form
        onSubmit={handleSubmit}

        className="
          grid
          md:grid-cols-4
          gap-4
          mb-8
        "
      >

        <input
          type="text"
          placeholder="Worker Name"

          value={formData.workerName}

          onChange={(e) =>
            setFormData({

              ...formData,

              workerName:
                e.target.value,

            })
          }

          className="
            border
            p-3
            rounded-lg
          "

          required
        />


        <input
          type="text"
          placeholder="Role"

          value={formData.role}

          onChange={(e) =>
            setFormData({

              ...formData,

              role:
                e.target.value,

            })
          }

          className="
            border
            p-3
            rounded-lg
          "

          required
        />


        <select
          value={formData.status}

          onChange={(e) =>
            setFormData({

              ...formData,

              status:
                e.target.value,

            })
          }

          className="
            border
            p-3
            rounded-lg
          "
        >

          <option>
            Present
          </option>

          <option>
            Absent
          </option>

          <option>
            Late
          </option>

        </select>


        <button
          className="
            bg-green-700
            text-white
            rounded-lg
          "
        >
          Save Attendance
        </button>

      </form>


      {/* TABLE */}

      <div
        className="
          bg-white
          rounded-xl
          shadow
          overflow-x-auto
        "
      >

        <table className="w-full">

          <thead
            className="
              bg-green-700
              text-white
            "
          >

            <tr>

              <th className="p-3">
                Worker
              </th>

              <th>
                Role
              </th>

              <th>
                Status
              </th>

              <th>
                Date
              </th>

              <th>
                Action
              </th>

            </tr>

          </thead>


          <tbody>

            {attendance.map((item) => (

              <tr
                key={item._id}
                className="border-b"
              >

                <td className="p-3">
                  {item.workerName}
                </td>

                <td>
                  {item.role}
                </td>

                <td>

                  <span
                    className={`

                      px-3
                      py-1
                      rounded-full
                      text-white

                      ${
                        item.status === "Present"

                          ? "bg-green-600"

                          : item.status === "Late"

                          ? "bg-yellow-500"

                          : "bg-red-500"
                      }

                    `}
                  >

                    {item.status}

                  </span>

                </td>

                <td>

                  {new Date(
                    item.createdAt
                  ).toLocaleDateString()}

                </td>

                <td>

                  <button
                    onClick={() =>
                      handleDelete(
                        item._id
                      )
                    }

                    className="
                      bg-red-500
                      text-white
                      px-3
                      py-1
                      rounded
                    "
                  >
                    Delete
                  </button>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}
