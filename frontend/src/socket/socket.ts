import { io } from "socket.io-client";


console.log('ENV: ',import.meta.env.VITE_BACKEND_ORIGN);
export const socket = io(import.meta.env.VITE_BACKEND_ORIGN, {
    withCredentials: true,
    autoConnect: false
});