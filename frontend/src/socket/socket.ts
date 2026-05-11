import { io } from "socket.io-client";

console.log("ENV:", import.meta.env.VITE_SOCKET_URL);

export const socket = io(import.meta.env.VITE_SOCKET_URL, {
    withCredentials: true,
    autoConnect: false
});