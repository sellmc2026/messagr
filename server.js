const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const webpush = require("web-push");


/* ========================================
   WEB PUSH
   ======================================== */

const VAPID_PUBLIC_KEY =
    process.env.VAPID_PUBLIC_KEY;

const VAPID_PRIVATE_KEY =
    process.env.VAPID_PRIVATE_KEY;


if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {

    console.error(
        "ERROR: VAPID keys are missing."
    );

} else {

    webpush.setVapidDetails(
        "mailto:notifications@example.com",
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );

}


/* ========================================
   SERVER-SIDE ROOM STORAGE
   ======================================== */

const dataDirectory =
    path.join(__dirname, "data");

const roomsFile =
    path.join(dataDirectory, "rooms.json");

let roomsDatabase = {};

try {

    fs.mkdirSync(
        dataDirectory,
        {
            recursive: true
        }
    );

    if (
        fs.existsSync(
            roomsFile
        )
    ) {

        const savedData =
            fs.readFileSync(
                roomsFile,
                "utf8"
            );

        roomsDatabase =
            JSON.parse(
                savedData
            ) || {};

    }

} catch (error) {

    console.error(
        "Could not load room database:",
        error
    );

    roomsDatabase = {};

}


let databaseWriteQueue =
    Promise.resolve();


function getServerRoom(
    roomCode
) {

    if (
        !roomsDatabase[roomCode]
    ) {

        roomsDatabase[roomCode] = {

            roomCode:
                roomCode,

            messages:
                [],

            updatedAt:
                Date.now()

        };

    }


    if (
        !Array.isArray(
            roomsDatabase[roomCode].messages
        )
    ) {

        roomsDatabase[roomCode].messages =
            [];

    }


    return roomsDatabase[roomCode];

}


function saveServerDatabase() {

    const snapshot =
        JSON.stringify(
            roomsDatabase,
            null,
            2
        );


    databaseWriteQueue =
        databaseWriteQueue
            .then(
                () =>
                    fs.promises.writeFile(
                        roomsFile,
                        snapshot,
                        "utf8"
                    )
            )
            .catch(
                error => {

                    console.error(
                        "Could not save room database:",
                        error
                    );

                }
            );


    return databaseWriteQueue;

}


async function saveMessageToServerRoom(
    roomCode,
    messageData
) {

    const room =
        getServerRoom(
            roomCode
        );


    room.messages.push(
        messageData
    );


    room.updatedAt =
        Date.now();


    await saveServerDatabase();

}


/* ========================================
   PUSH SUBSCRIPTIONS
   ======================================== */

const pushSubscriptions =
    new Map();


/* ========================================
   CREATE HTTP SERVER
   ======================================== */

const server =
    http.createServer(
        async (
            request,
            response
        ) => {

            /* ========================================
               VAPID PUBLIC KEY
               ======================================== */

            if (
                request.url ===
                "/api/vapid-public-key"
            ) {

                response.writeHead(
                    200,
                    {
                        "Content-Type":
                            "text/plain"
                    }
                );

                response.end(
                    VAPID_PUBLIC_KEY ||
                    ""
                );

                return;

            }


            /* ========================================
               SAVE PUSH SUBSCRIPTION
               ======================================== */

            if (
                request.url ===
                    "/api/save-subscription" &&
                request.method ===
                    "POST"
            ) {

                let body =
                    "";


                request.on(
                    "data",
                    chunk => {

                        body +=
                            chunk.toString();

                    }
                );


                request.on(
                    "end",
                    () => {

                        try {

                            const data =
                                JSON.parse(
                                    body
                                );


                            if (
                                !data.subscription ||
                                !data.subscription.endpoint
                            ) {

                                response.writeHead(
                                    400,
                                    {
                                        "Content-Type":
                                            "application/json"
                                    }
                                );

                                response.end(
                                    JSON.stringify(
                                        {
                                            success:
                                                false
                                        }
                                    )
                                );

                                return;

                            }


                            pushSubscriptions.set(
                                data.subscription.endpoint,
                                {
                                    subscription:
                                        data.subscription,

                                    socketId:
                                        data.socketId,

                                    room:
                                        data.room
                                }
                            );


                            response.writeHead(
                                200,
                                {
                                    "Content-Type":
                                        "application/json"
                                }
                            );


                            response.end(
                                JSON.stringify(
                                    {
                                        success:
                                            true
                                    }
                                )
                            );

                        } catch (error) {

                            console.error(
                                "Could not save push subscription:",
                                error
                            );


                            response.writeHead(
                                400,
                                {
                                    "Content-Type":
                                        "application/json"
                                }
                            );


                            response.end(
                                JSON.stringify(
                                    {
                                        success:
                                            false
                                    }
                                )
                            );

                        }

                    }
                );


                return;

            }


            /* ========================================
               SERVE STATIC FILES
               ======================================== */

            let filePath =
                request.url.split("?")[0];


            if (
                filePath ===
                "/"
            ) {

                filePath =
                    "/index.html";

            }


            const publicDirectory =
                path.join(
                    __dirname,
                    "public"
                );


            const requestedPath =
                path.join(
                    publicDirectory,
                    filePath
                );


            if (
                !requestedPath.startsWith(
                    publicDirectory
                )
            ) {

                response.writeHead(
                    403
                );

                response.end(
                    "Forbidden"
                );

                return;

            }


            try {

                const file =
                    await fs.promises.readFile(
                        requestedPath
                    );


                const extension =
                    path.extname(
                        requestedPath
                    ).toLowerCase();


                const contentTypes = {

                    ".html":
                        "text/html",

                    ".js":
                        "application/javascript",

                    ".css":
                        "text/css",

                    ".json":
                        "application/json",

                    ".png":
                        "image/png",

                    ".jpg":
                        "image/jpeg",

                    ".jpeg":
                        "image/jpeg",

                    ".gif":
                        "image/gif",

                    ".webp":
                        "image/webp",

                    ".svg":
                        "image/svg+xml",

                    ".mp3":
                        "audio/mpeg",

                    ".wav":
                        "audio/wav",

                    ".ico":
                        "image/x-icon"

                };


                response.writeHead(
                    200,
                    {
                        "Content-Type":
                            contentTypes[
                                extension
                            ] ||
                            "application/octet-stream"
                    }
                );


                response.end(
                    file
                );


            } catch (error) {

                response.writeHead(
                    404
                );

                response.end(
                    "Not found"
                );

            }

        }
    );


/* ========================================
   SOCKET.IO
   ======================================== */

const io =
    new Server(
        server,
        {
            cors:
                {
                    origin:
                        "*"
                },

            maxHttpBufferSize:
                10 * 1024 * 1024
        }
    );


/* ========================================
   SOCKET CONNECTION
   ======================================== */

io.on(
    "connection",
    socket => {

        console.log(
            "User connected:",
            socket.id
        );


        socket.username =
            "user";

        socket.currentRoom =
            null;


        /* ========================================
           JOIN ROOM
           ======================================== */

        socket.on(
            "joinRoom",
            data => {

                let username;
                let roomCode;


                if (
                    typeof data ===
                    "string"
                ) {

                    roomCode =
                        data;

                    username =
                        "user";

                } else {

                    username =
                        data &&
                        data.username
                            ? String(
                                data.username
                            ).trim()
                            : "user";

                    roomCode =
                        data &&
                        data.code
                           ? String(
                              data.code
                           ).trim()
                           : "";

                }


                if (
                    !roomCode
                ) {

                    return;

                }


                if (
                    socket.currentRoom
                ) {

                    socket.leave(
                        socket.currentRoom
                    );

                }


                socket.username =
                    username ||
                    "user";


                socket.currentRoom =
                    roomCode;


                socket.join(
                    roomCode
                );


                getServerRoom(
                    roomCode
                );


                socket.emit(
                    "joinedRoom",
                    roomCode
                );


                socket.to(
                    roomCode
                ).emit(
                    "userJoined",
                    socket.username
                );


                console.log(
                    socket.username +
                    " joined room " +
                    roomCode
                );

            }
        );


        /* ========================================
           GET SERVER ROOM HISTORY
           ======================================== */

        socket.on(
            "getRoomHistory",
            (
                roomCode,
                callback
            ) => {

                if (
                    typeof roomCode !==
                        "string" ||
                    socket.currentRoom !==
                        roomCode
                ) {

                    if (
                        typeof callback ===
                        "function"
                    ) {

                        callback(
                            {
                                success:
                                    false,

                                messages:
                                    []
                            }
                        );

                    }

                    return;

                }


                const room =
                    getServerRoom(
                        roomCode
                    );


                if (
                    typeof callback ===
                    "function"
                ) {

                    callback(
                        {
                            success:
                                true,

                            messages:
                                room.messages
                        }
                    );

                }

            }
        );


        /* ========================================
           SEND TEXT MESSAGE
           ======================================== */

        socket.on(
            "sendMessage",
            async message => {

                if (
                    !socket.currentRoom
                ) {

                    return;

                }


                if (
                    typeof message !==
                    "string"
                ) {

                    return;

                }


                message =
                    message.trim();


                if (
                    !message
                ) {

                    return;

                }


                const messageData = {

                    type:
                        "text",

                    text:
                        message,

                    username:
                        socket.username,

                    timestamp:
                        Date.now()

                };


                await saveMessageToServerRoom(
                    socket.currentRoom,
                    messageData
                );


                io.to(
                    socket.currentRoom
                ).emit(
                    "receiveMessage",
                    {
                        sender:
                            socket.id,

                        username:
                            socket.username,

                        text:
                            message
                    }
                );


                if (
                    !VAPID_PUBLIC_KEY ||
                    !VAPID_PRIVATE_KEY
                ) {

                    return;

                }


                for (
                    const [
                        endpoint,
                        saved
                    ]
                    of pushSubscriptions
                ) {

                    if (
                        saved.room !==
                        socket.currentRoom
                    ) {

                        continue;

                    }


                    if (
                        saved.socketId ===
                        socket.id
                    ) {

                        continue;

                    }


                    try {

                        await webpush.sendNotification(
                            saved.subscription,

                            JSON.stringify(
                                {
                                    username:
                                        socket.username,

                                    text:
                                        message
                                }
                            )
                        );


                    } catch (
                        error
                    ) {

                        console.error(
                            "Push notification failed:",
                            error.statusCode,
                            error.message
                        );


                        if (
                            error.statusCode ===
                                404 ||
                            error.statusCode ===
                                410
                        ) {

                            pushSubscriptions.delete(
                                endpoint
                            );

                        }

                    }

                }

            }
        );


        /* ========================================
           SEND IMAGE
           ======================================== */

        socket.on(
            "sendImage",
            async data => {

                if (
                    !socket.currentRoom
                ) {

                    return;

                }


                if (
                    !data ||
                    typeof data !==
                        "object"
                ) {

                    return;

                }


                if (
                    !data.image ||
                    !data.type
                ) {

                    return;

                }


                /*
                   Only allow image MIME types
                   or image URLs.
                */

                const validMimeType =
                    typeof data.type ===
                        "string" &&
                    data.type.startsWith(
                        "image/"
                    );


                const validUrl =
                    data.type ===
                        "image/url";


                if (
                    !validMimeType &&
                    !validUrl
                ) {

                    return;

                }


                if (
                    typeof data.image !==
                    "string"
                ) {

                    return;

                }


                /*
                   Prevent extremely large
                   messages from being stored.
                */

                if (
                    data.image.length >
                    8 * 1024 * 1024
                ) {

                    return;

                }


                const imageData = {

                    type:
                        "image",

                    image:
                        data.image,

                    mimeType:
                        data.type,

                    username:
                        socket.username,

                    timestamp:
                        Date.now()

                };


                await saveMessageToServerRoom(
                    socket.currentRoom,
                    imageData
                );


                io.to(
                    socket.currentRoom
                ).emit(
                    "receiveImage",
                    {
                        sender:
                            socket.id,

                        username:
                            socket.username,

                        image:
                            data.image,

                        type:
                            data.type
                    }
                );

            }
        );


        /* ========================================
           DISCONNECT
           ======================================== */

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "User disconnected:",
                    socket.id
                );


                for (
                    const [
                        endpoint,
                        saved
                    ]
                    of pushSubscriptions
                ) {

                    if (
                        saved.socketId ===
                        socket.id
                    ) {

                        pushSubscriptions.delete(
                            endpoint
                        );

                    }

                }

            }
        );

    }
);


/* ========================================
   START SERVER
   ======================================== */

const PORT =
    process.env.PORT ||
    3000;


server.listen(
    PORT,
    () => {

        console.log(
            "Messagr server running on port " +
            PORT
        );

    }
);
