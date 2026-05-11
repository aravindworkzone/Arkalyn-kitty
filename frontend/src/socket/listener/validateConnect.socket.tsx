import { useEffect } from "react";
import { socket } from "../socket";

export default function ConnectSocket() {

    useEffect(() => {

        const onConnect = () => {
            console.log("socket connected");
        };

        const onDisconnect = () => {
            console.log("socket disconnected");
        };

        const onError = (err: any) => {
            console.log("socket error");
            console.log(err);
        };

        const handleAny = (
            event: string,
            ...args: any[]
        ) => {
            console.log("incoming", event, args);
        };

        socket.onAny(handleAny);

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("connect_error", onError);

        return () => {

            socket.offAny(handleAny);

            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("connect_error", onError);

            socket.disconnect();
        };

    }, []);

    return null;
}