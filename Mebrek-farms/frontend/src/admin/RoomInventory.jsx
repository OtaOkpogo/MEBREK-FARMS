import { useEffect, useState } from "react";

import {
  getRooms,
} from "../services/roomInventoryService";

export default function RoomInventory() {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const loadRooms = async () => {
    try {
      const data = await getRooms();

      setRooms(data);

      if (data.length && !selectedRoom) {
        setSelectedRoom(data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  return (
    <div className="p-6">

    </div>
  );
}
