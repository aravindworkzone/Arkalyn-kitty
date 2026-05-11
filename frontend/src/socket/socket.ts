import { io } from "socket.io-client";

console.log("ENV:", import.meta.env.VITE_BACKEND_ORIGIN);

export const socket = io(import.meta.env.VITE_BACKEND_ORIGIN, {
    withCredentials: true,
    autoConnect: false
});