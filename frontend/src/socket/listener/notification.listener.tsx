import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { socket } from "../socket";
import { api } from "../../redux/api/base";
import { SOCKET_EVENTS } from "../event";

export default function NotificationListener() {
  const dispatch = useDispatch();

  useEffect(() => {
    const onNew = () => {
      dispatch(api.util.invalidateTags(["Notification"]));
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, onNew);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION_NEW, onNew);
    };
  }, [dispatch]);

  return null;
}
