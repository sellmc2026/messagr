const socket = io();


/* ========================================
   LOCAL MESSAGR DATABASE
   ======================================== */

let messagrDB = null;

const databaseRequest =
    indexedDB.open("MessagrDB", 1);


databaseRequest.onupgradeneeded =
    function(event) {

        const db =
            event.target.result;


        if (
            !db.objectStoreNames.contains("rooms")
        ) {

            db.createObjectStore(
                "rooms",
                {
                    keyPath: "roomCode"
                }
            );

        }

    };


databaseRequest.onsuccess =
    function(event) {

        messagrDB =
            event.target.result;


        console.log(
            "Messagr local database ready."
        );


        loadSavedRooms();

    };


databaseRequest.onerror =
    function(event) {

        console.error(
            "Could not open Messagr database:",
            event.target.error
        );

    };


/* ========================================
   ELEMENTS
   ======================================== */

const buttonClickSound = new Audio('button-click.mp3');
const messageSentSound = new Audio('message-sent.mp3');

const codeBox =
    document.getElementById("codeBox");


const copyCodeButton =
    document.getElementById("copyCodeButton");


const generateButton =
    document.getElementById("generateButton");


const codeInput =
    document.getElementById("codeInput");


const joinButton =
    document.getElementById("joinButton");


const status =
    document.getElementById("status");


const chat =
    document.getElementById("chat");


const messageInput =
    document.getElementById("messageInput");


const sendButton =
    document.getElementById("sendButton");


const messages =
    document.getElementById("messages");


const muteButton =
    document.getElementById("muteButton");


const muteIcon =
    document.getElementById("muteIcon");


const imageInput =
    document.getElementById("imageInput");


const imageButton =
    document.getElementById("imageButton");


const mainProfileButton =
    document.getElementById("profileButton");


const saveChatButton =
    document.getElementById("saveChatButton");


const savedRooms =
    document.getElementById("savedRooms");


/* ========================================
   CURRENT ROOM
   ======================================== */

let currentRoomCode =
    null;


/* ========================================
   SAVED USERNAME
   ======================================== */

const savedUsername =
    localStorage.getItem(
        "messagrUsername"
    );


/* ========================================
   IMAGE UPLOAD STATE
   ======================================== */

let imageUploadInProgress =
    false;


let imageUploadTimeout =
    null;


let currentImageLoadingMessage =
    null;


/* ========================================
   MUTE / UNMUTE
   ======================================== */

let muted =
    false;


const audio =
    new Audio("chatSound.mp3");


if (muteButton) {

    muteButton.addEventListener(
        "click",
        function() {

            muted =
                !muted;


            if (muted) {

                if (muteIcon) {

                    muteIcon.src =
                        "mute.png";

                }

            } else {

                if (muteIcon) {

                    muteIcon.src =
                        "unmute.png";

                }

            }

        }
    );

}


/* ========================================
   DATABASE HELPERS
   ======================================== */

function getRoomFromDatabase(
    roomCode
) {

    return new Promise(
        function(resolve, reject) {

            if (!messagrDB) {

                resolve(null);

                return;

            }


            const transaction =
                messagrDB.transaction(
                    ["rooms"],
                    "readonly"
                );


            const store =
                transaction.objectStore(
                    "rooms"
                );


            const request =
                store.get(roomCode);


            request.onsuccess =
                function() {

                    resolve(
                        request.result || null
                    );

                };


            request.onerror =
                function() {

                    reject(
                        request.error
                    );

                };

        }
    );

}


function saveRoomToDatabase(
    room
) {

    return new Promise(
        function(resolve, reject) {

            if (!messagrDB) {

                resolve();

                return;

            }


            const transaction =
                messagrDB.transaction(
                    ["rooms"],
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    "rooms"
                );


            const request =
                store.put(room);


            request.onsuccess =
                function() {

                    resolve();

                };


            request.onerror =
                function() {

                    reject(
                        request.error
                    );

                };

        }
    );

}


/* ========================================
   GET SAVED ROOM CODES
   ======================================== */

function getSavedRoomCodes() {

    return JSON.parse(
        localStorage.getItem(
            "messagrSavedChats"
        ) || "[]"
    );

}


/* ========================================
   SET SAVED ROOM CODES
   ======================================== */

function setSavedRoomCodes(
    rooms
) {

    localStorage.setItem(
        "messagrSavedChats",
        JSON.stringify(rooms)
    );

}


/* ========================================
   CHECK IF ROOM IS SAVED
   ======================================== */

function isRoomSaved(
    roomCode
) {

    return getSavedRoomCodes()
        .includes(roomCode);

}


/* ========================================
   UPDATE SAVE CHAT BUTTON
   ======================================== */

function updateSaveChatButton() {

    if (
        !saveChatButton
    ) {

        return;

    }


    if (
        !currentRoomCode
    ) {

        saveChatButton.style.display =
            "none";

        return;

    }


    saveChatButton.style.display =
        "block";


    if (
        isRoomSaved(currentRoomCode)
    ) {

        saveChatButton.textContent =
            "Delete Chat";


        saveChatButton.classList.add(
            "delete"
        );

    } else {

        saveChatButton.textContent =
            "Save Chat";


        saveChatButton.classList.remove(
            "delete"
        );

    }

}


/* ========================================
   SAVE CHAT BUTTON
   ======================================== */

if (saveChatButton) {

    saveChatButton.addEventListener(
        "click",
        async function() {

            if (
                !currentRoomCode
            ) {

                return;

            }


            const roomCode =
                currentRoomCode;


            const savedRoomsList =
                getSavedRoomCodes();


            /* ========================================
               DELETE SAVED CHAT
               ======================================== */

            if (
                savedRoomsList.includes(
                    roomCode
                )
            ) {

                const newRooms =
                    savedRoomsList.filter(
                        function(code) {

                            return code !== roomCode;

                        }
                    );


                setSavedRoomCodes(
                    newRooms
                );


                updateSaveChatButton();

                loadSavedRooms();


                if (status) {

                    status.textContent =
                        "Chat removed from saved rooms";

                }


                return;

            }


            /* ========================================
               SAVE CHAT
               ======================================== */

            savedRoomsList.push(
                roomCode
            );


            setSavedRoomCodes(
                savedRoomsList
            );


            /* ========================================
               MAKE SURE CURRENT CHAT IS SAVED
               ======================================== */

            await saveCurrentRoom();


            updateSaveChatButton();

            loadSavedRooms();


            if (status) {

                status.textContent =
                    "Chat saved.";

            }

        }
    );

}


/* ========================================
   SAVE CURRENT ROOM
   ======================================== */

async function saveCurrentRoom() {

    if (
        !currentRoomCode
    ) {

        return;

    }


    const roomCode =
        currentRoomCode;


    const room =
        await getRoomFromDatabase(
            roomCode
        );


    const roomData = {

        roomCode:
            roomCode,

        messages:
            room && Array.isArray(room.messages)
                ? room.messages
                : [],

        updatedAt:
            Date.now()

    };


    await saveRoomToDatabase(
        roomData
    );

}


/* ========================================
   SAVE MESSAGE TO CURRENT ROOM
   ======================================== */

async function saveMessageToCurrentRoom(
    messageData
) {

    if (
        !currentRoomCode
    ) {

        return;

    }


    try {

        let room =
            await getRoomFromDatabase(
                currentRoomCode
            );


        if (!room) {

            room = {

                roomCode:
                    currentRoomCode,

                messages:
                    [],

                updatedAt:
                    Date.now()

            };

        }


        if (
            !Array.isArray(
                room.messages
            )
        ) {

            room.messages =
                [];

        }


        room.messages.push(
            messageData
        );


        room.updatedAt =
            Date.now();


        await saveRoomToDatabase(
            room
        );

    } catch (error) {

        console.error(
            "Could not save message:",
            error
        );

    }

}


/* ========================================
   CREATE MESSAGE ELEMENT
   ======================================== */

function createTextMessageElement(data) {

    const message =
        document.createElement("div");

    message.classList.add(
        "message"
    );

    if (data.mine) {

        message.classList.add(
            "messageMine"
        );

    } else {

        message.classList.add(
            "messageOther"
        );
    }


    const messageInfo =
        document.createElement("div");

    messageInfo.classList.add(
        "messageInfo"
    );

    messageInfo.textContent =
        new Date(
            data.timestamp
        ).toLocaleString();


    const text =
        document.createElement("div");

    if (data.mine) {

        text.textContent =
            "[" +
            data.text +
            "]";

    } else {

        text.textContent =
            "[" +
            data.username +
            ": " +
            data.text +
            "]";
    }


    message.appendChild(
        messageInfo
    );

    message.appendChild(
        text
    );


    return message;
}


/* ========================================
   CREATE IMAGE MESSAGE ELEMENT
   ======================================== */

function createImageMessageElement(
    data
) {

    const container =
        document.createElement("div");

    container.classList.add(
        "messageContainer"
    );

    const messageInfo =
        document.createElement("div");

    messageInfo.classList.add(
        "messageInfo"
    );

    const username =
        document.createElement("strong");

    username.textContent =
        data.username || "user";

    const time =
        document.createElement("span");

    time.textContent =
        new Date(
            data.timestamp
        ).toLocaleString();

    messageInfo.appendChild(
        username
    );

    messageInfo.appendChild(
        time
    );

    const message =
        document.createElement("div");

    message.classList.add(
        "message"
    );

    if (
        data.mine
    ) {

        message.classList.add(
            "messageMine"
        );

    } else {

        message.classList.add(
            "messageOther"
        );

    }

    const image =
        document.createElement("img");

    image.src =
        data.image;

    image.alt =
        "Image sent by " +
        (
            data.username ||
            "user"
        );

    image.style.maxWidth =
        "250px";

    image.style.maxHeight =
        "250px";

    image.style.width =
        "auto";

    image.style.height =
        "auto";

    image.style.borderRadius =
        "8px";

    image.style.display =
        "block";

    image.style.objectFit =
        "contain";

    message.appendChild(
        image
    );

    container.appendChild(
        messageInfo
    );

    container.appendChild(
        message
    );

    return container;
}


/* ========================================
   CREATE SYSTEM MESSAGE
   ======================================== */

function createSystemMessageElement(
    text
) {

    const message =
        document.createElement("div");


    message.classList.add(
        "systemMessage"
    );


    message.textContent =
        text;


    return message;

}


/* ========================================
   SYNC ROOM FROM SERVER
   ======================================== */

function getRoomHistoryFromServer(roomCode) {

    return new Promise(
        function(resolve) {

            if (
                !socket.connected
            ) {

                resolve(null);

                return;

            }


            let finished =
                false;


            const timeout =
                setTimeout(
                    function() {

                        if (
                            finished
                        ) {

                            return;

                        }


                        finished =
                            true;


                        resolve(
                            null
                        );

                    },
                    7000
                );


            socket.emit(
                "getRoomHistory",
                roomCode,

                function(response) {

                    if (
                        finished
                    ) {

                        return;

                    }


                    finished =
                        true;


                    clearTimeout(
                        timeout
                    );


                    if (
                        !response ||
                        !response.success ||
                        !Array.isArray(
                            response.messages
                        )
                    ) {

                        resolve(
                            null
                        );

                        return;

                    }


                    resolve(
                        response.messages
                    );

                }
            );

        }
    );

}


async function syncRoomFromServer(
    roomCode
) {

    const serverMessages =
        await getRoomHistoryFromServer(
            roomCode
        );


    if (
        !Array.isArray(
            serverMessages
        )
    ) {

        return false;

    }


    const username =
        (
            localStorage.getItem(
                "messagrUsername"
            ) || ""
        ).trim();


    const localMessages =
        serverMessages.map(
            function(data) {

                return {

                    ...data,

                    mine:
                        data.username ===
                        username

                };

            }
        );


    await saveRoomToDatabase(
        {
            roomCode:
                roomCode,

            messages:
                localMessages,

            updatedAt:
                Date.now()

        }
    );


    return true;

}


/* ========================================
   LOAD ROOM CHAT
   ======================================== */

async function loadRoomChat(
    roomCode
) {

    if (
        !messages
    ) {

        return;

    }


    /* ========================================
       CLEAR OLD CHAT FIRST
       ======================================== */

    messages.innerHTML =
        "";


    try {

        const room =
            await getRoomFromDatabase(
                roomCode
            );


        if (
            !room ||
            !Array.isArray(
                room.messages
            )
        ) {

            return;

        }


        room.messages.forEach(
            function(data) {

                let element =
                    null;


                if (
                    data.type === "image"
                ) {

                    element =
                        createImageMessageElement(
                            data
                        );

                } else if (
                    data.type === "system"
                ) {

                    element =
                        createSystemMessageElement(
                            data.text
                        );

                } else {

                    element =
                        createTextMessageElement(
                            data
                        );

                }


                if (element) {

                    messages.appendChild(
                        element
                    );

                }

            }
        );


        messages.scrollTop =
            messages.scrollHeight;


    } catch (error) {

        console.error(
            "Could not load room chat:",
            error
        );

    }

}


/* ========================================
   SWITCH TO ROOM
   ======================================== */

async function switchToRoom(
    roomCode
) {

    const newRoomCode =
        roomCode
            .trim()
            .toUpperCase();


    if (
        !isValidRoomCode(
            newRoomCode
        )
    ) {

        return;

    }


    /* ========================================
       SET CURRENT ROOM
       ======================================== */

    currentRoomCode =
        newRoomCode;


    /* ========================================
       CLEAR CHAT IMMEDIATELY
       ======================================== */

    if (messages) {

        messages.innerHTML =
            "";

    }


    /* ========================================
       UPDATE INPUT
       ======================================== */

    if (codeInput) {

        codeInput.value =
            newRoomCode;

    }


    /* ========================================
       UPDATE BUTTON
       ======================================== */

    updateJoinButton();

    updateSaveChatButton();


    /* ========================================
       LOAD SAVED CHAT
       ======================================== */

    await loadRoomChat(
        newRoomCode
    );

}


/* ========================================
   LOAD SAVED ROOMS
   ======================================== */

async function loadSavedRooms() {

    if (
        !savedRooms
    ) {

        return;

    }


    const roomCodes =
        getSavedRoomCodes();


    savedRooms.innerHTML =
        "";


    if (
        roomCodes.length === 0
    ) {

        return;

    }


    for (
        const roomCode of roomCodes
    ) {

        const room =
            await getRoomFromDatabase(
                roomCode
            );


        const savedRoom =
            document.createElement("div");


        savedRoom.classList.add(
            "savedRoom"
        );


        const roomButton =
            document.createElement("button");


        roomButton.classList.add(
            "savedRoomButton"
        );


        roomButton.textContent =
            roomCode;


        roomButton.addEventListener(
            "click",
            function() {

                joinSavedRoom(
                    roomCode
                );

            }
        );


        const editButton =
            document.createElement("button");


        editButton.classList.add(
            "editRoomButton"
        );


        const editImage =
            document.createElement("img");


        editImage.src =
            "edit.png";


        editImage.alt =
            "Edit";


        editButton.appendChild(
            editImage
        );


        editButton.addEventListener(
            "click",
            function(event) {

                event.stopPropagation();


                const newName =
                    prompt(
                        "Enter a name for this saved chat:",
                        room?.name || roomCode
                    );


                if (
                    newName === null
                ) {

                    return;

                }


                const trimmedName =
                    newName.trim();


                if (
                    trimmedName.length === 0
                ) {

                    return;

                }


                renameSavedRoom(
                    roomCode,
                    trimmedName
                );

            }
        );


        savedRoom.appendChild(
            roomButton
        );


        savedRoom.appendChild(
            editButton
        );


        savedRooms.appendChild(
            savedRoom
        );

    }

}


/* ========================================
   RENAME SAVED ROOM
   ======================================== */

async function renameSavedRoom(
    roomCode,
    name
) {

    try {

        let room =
            await getRoomFromDatabase(
                roomCode
            );


        if (!room) {

            room = {

                roomCode:
                    roomCode,

                messages:
                    [],

                updatedAt:
                    Date.now()

            };

        }


        room.name =
            name;


        room.updatedAt =
            Date.now();


        await saveRoomToDatabase(
            room
        );


        loadSavedRooms();


    } catch (error) {

        console.error(
            "Could not rename saved room:",
            error
        );

    }

}


/* ========================================
   JOIN SAVED ROOM
   ======================================== */

function joinSavedRoom(
    roomCode
) {

    if (
        !socket.connected
    ) {

        status.textContent =
            "Connecting to server...";


        socket.connect();


        return;

    }


    const username =
        (
            localStorage.getItem(
                "messagrUsername"
            ) || ""
        ).trim();


    if (
        username.length === 0
    ) {

        status.textContent =
            "Please set a username first.";

        return;

    }


    if (
        username.length > 8
    ) {

        status.textContent =
            "Username must be 8 characters or less.";

        return;

    }


    /* ========================================
       LOAD LOCAL CHAT BEFORE JOINING
       ======================================== */

    switchToRoom(
        roomCode
    );


    status.textContent =
        "Joining " +
        roomCode +
        "...";


    localStorage.setItem(
        "messagrUsername",
        username
    );


    socket.emit(
        "joinRoom",
        {
            code:
                roomCode,

            username:
                username
        }
    );

}


/* ========================================
   PROFILE BUTTON
   ======================================== */

if (mainProfileButton) {

    mainProfileButton.addEventListener(
        "click",
        function() {

            window.location.href =
                "messagr-profile.html";

        }
    );

}


/* ========================================
   ROOM CODE
   ======================================== */

const roomCodeCharacters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


function isValidRoomCode(
    code
) {

    return /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(
        code
    );

}


function generateCode() {

    let code =
        "";


    for (
        let i = 0;
        i < 8;
        i++
    ) {

        code +=
            roomCodeCharacters[
                Math.floor(
                    Math.random() *
                    roomCodeCharacters.length
                )
            ];

    }


    return (
        code.substring(0, 4)
        + "-"
        + code.substring(4)
    );

}


/* ========================================
   UPDATE JOIN BUTTON
   ======================================== */

function updateJoinButton() {

    if (
        !codeInput ||
        !joinButton
    ) {

        return;

    }


    const code =
        codeInput.value
            .trim()
            .toUpperCase();


    if (
        isValidRoomCode(code)
    ) {

        joinButton.style.backgroundColor =
            "#4DA6FF";


        joinButton.style.borderColor =
            "#000000";

    } else {

        joinButton.style.backgroundColor =
            "#BEFF8F";


        joinButton.style.borderColor =
            "#000000";

    }

}


/* ========================================
   GENERATE NEW ROOM CODE
   ======================================== */

function generateNewRoomCode() {

    const code =
        generateCode();


    if (codeInput) {

        codeInput.value =
            code;

    }


    if (codeBox) {

        codeBox.textContent =
            code;

    }


    updateJoinButton();


    if (status) {

        status.textContent =
            "New room code generated.";

    }


    if (codeInput) {

        codeInput.focus();

    }

}


/* ========================================
   GENERATE BUTTON
   ======================================== */

if (generateButton) {

    generateButton.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            generateNewRoomCode();

        }
    );

}


/* ========================================
   FORMAT ROOM CODE WHILE TYPING
   ======================================== */

if (codeInput) {

    codeInput.addEventListener(
        "input",
        function() {

            let value =
                codeInput.value
                    .toUpperCase();


            value =
                value.replace(
                    /[^A-Z2-9]/g,
                    ""
                );


            value =
                value.replace(
                    /[IO01]/g,
                    ""
                );


            value =
                value.substring(
                    0,
                    8
                );


            if (
                value.length > 4
            ) {

                value =
                    value.substring(0, 4)
                    + "-"
                    + value.substring(4);

            }


            codeInput.value =
                value;


            updateJoinButton();


            if (
                isValidRoomCode(value)
            ) {

                updateSaveChatButton();

            }

        }
    );

}


/* ========================================
   INITIAL JOIN BUTTON STATE
   ======================================== */

updateJoinButton();


/* ========================================
   COPY ROOM CODE
   ======================================== */

if (copyCodeButton) {

    copyCodeButton.addEventListener(
        "click",
        async function() {

            if (!codeBox) {

                return;

            }


            const code =
                codeBox.textContent;


            if (
                !code ||
                code === "----"
            ) {

                return;

            }


            try {

                await navigator.clipboard.writeText(
                    code
                );


                copyCodeButton.textContent =
                    "COPIED!";


                setTimeout(
                    function() {

                        copyCodeButton.textContent =
                            "COPY ROOM CODE";

                    },
                    1000
                );

            } catch (error) {

                console.error(
                    "Could not copy code:",
                    error
                );

            }

        }
    );

}


/* ========================================
   JOIN ROOM
   ======================================== */

if (joinButton) {

    joinButton.addEventListener(
        "click",
        async function() {

            /* ========================================
               GET USERNAME
               ======================================== */

            const username =
                (
                    localStorage.getItem(
                        "messagrUsername"
                    ) || ""
                ).trim();


            /* ========================================
               GET ROOM CODE
               ======================================== */

            const code =
                codeInput.value
                    .trim()
                    .toUpperCase();


            /* ========================================
               CHECK USERNAME
               ======================================== */

            if (
                username.length === 0
            ) {

                status.textContent =
                    "Please set a username on the welcome page first.";

                return;

            }


            if (
                username.length > 8
            ) {

                status.textContent =
                    "Username must be 8 characters or less.";

                return;

            }


            /* ========================================
               CHECK ROOM CODE
               ======================================== */

            if (
                !isValidRoomCode(code)
            ) {

                status.textContent =
                    "Please enter a valid room code.";

                codeInput.focus();

                updateJoinButton();

                return;

            }


            /* ========================================
               CHECK SOCKET CONNECTION
               ======================================== */

            if (
                !socket.connected
            ) {

                status.textContent =
                    "Connecting to server...";


                socket.connect();

                return;

            }


            /* ========================================
               SWITCH LOCAL CHAT
               ======================================== */

            await switchToRoom(
                code
            );


            /* ========================================
               SHOW JOINING STATUS
               ======================================== */

            status.textContent =
                "Joining " +
                code +
                "...";


            /* ========================================
               SAVE USERNAME
               ======================================== */

            localStorage.setItem(
                "messagrUsername",
                username
            );


            /* ========================================
               JOIN ROOM
               ======================================== */

            socket.emit(
                "joinRoom",
                {
                    code:
                        code,

                    username:
                        username
                }
            );

        }
    );

}


/* ========================================
   SUCCESSFULLY JOINED ROOM
   ======================================== */

socket.on(
    "joinedRoom",
    async function(code) {

        console.log(
            "Successfully joined room:",
            code
        );


        /* ========================================
           SET CURRENT ROOM
           ======================================== */

        currentRoomCode =
            code
                .trim()
                .toUpperCase();


        /* ========================================
           UPDATE ROOM CODE
           ======================================== */

        if (codeInput) {

            codeInput.value =
                currentRoomCode;

        }


        /* ========================================
           UPDATE STATUS
           ======================================== */

        if (status) {

            status.textContent =
                "Connected to " +
                currentRoomCode;

        }


        /* ========================================
           SHOW CHAT
           ======================================== */

      if (chat) {

            chat.style.setProperty(
               "display",
               "flex",
               "important"
            );
         
      }


        /* ========================================
           SYNC SERVER CHAT HISTORY
           ======================================== */

        const serverHistoryLoaded =
            await syncRoomFromServer(
                currentRoomCode
            );


        /* ========================================
           LOAD THIS ROOM'S SAVED CHAT
           ======================================== */

        await loadRoomChat(
            currentRoomCode
        );


        if (
            !serverHistoryLoaded &&
            status
        ) {

            status.textContent =
                "Connected to " +
                currentRoomCode +
                " (server history unavailable)";

        }


        /* ========================================
           UPDATE SAVE BUTTON
           ======================================== */

        updateSaveChatButton();


        /* ========================================
           FOCUS MESSAGE INPUT
           ======================================== */

        if (messageInput) {

            messageInput.focus();

        }


        /* ========================================
           ENABLE PUSH NOTIFICATIONS
           ======================================== */

        try {

            await registerNotificationSystem(
                currentRoomCode
            );

        } catch (error) {

            console.error(
                "Notification setup failed:",
                error
            );

        }

    }
);


/* ========================================
   BROWSER PUSH NOTIFICATIONS
   ======================================== */

function urlBase64ToUint8Array(
    base64String
) {

    const padding =
        "=".repeat(
            (
                4 -
                base64String.length % 4
            ) % 4
        );


    const base64 =
        (
            base64String +
            padding
        )
        .replace(
            /-/g,
            "+"
        )
        .replace(
            /_/g,
            "/"
        );


    const rawData =
        window.atob(base64);


    const outputArray =
        new Uint8Array(
            rawData.length
        );


    for (
        let i = 0;
        i < rawData.length;
        ++i
    ) {

        outputArray[i] =
            rawData.charCodeAt(i);

    }


    return outputArray;

}


async function registerNotificationSystem(
    roomCode
) {

    if (
        !("serviceWorker" in navigator)
    ) {

        console.log(
            "Service workers are not supported."
        );

        return;

    }


    if (
        !("PushManager" in window)
    ) {

        console.log(
            "Push notifications are not supported."
        );

        return;

    }


    try {

        const registration =
            await navigator.serviceWorker.register(
                "/sw.js"
            );


        console.log(
            "Service worker registered."
        );


        const permission =
            await Notification.requestPermission();


        if (
            permission !== "granted"
        ) {

            console.log(
                "Notification permission was not granted."
            );

            return;

        }


        const keyResponse =
            await fetch(
                "/api/vapid-public-key"
            );


        if (
            !keyResponse.ok
        ) {

            throw new Error(
                "Could not get VAPID public key."
            );

        }


        const publicKey =
            await keyResponse.text();


        if (
            !publicKey
        ) {

            throw new Error(
                "VAPID public key is empty."
            );

        }


        let subscription =
            await registration
                .pushManager
                .getSubscription();


        if (
            !subscription
        ) {

            subscription =
                await registration
                    .pushManager
                    .subscribe(
                        {
                            userVisibleOnly:
                                true,

                            applicationServerKey:
                                urlBase64ToUint8Array(
                                    publicKey
                                )
                        }
                    );

        }


        const saveResponse =
            await fetch(
                "/api/save-subscription",
                {
                    method:
                        "POST",

                    headers:
                        {
                            "Content-Type":
                                "application/json"
                        },

                    body:
                        JSON.stringify(
                            {
                                subscription:
                                    subscription,

                                socketId:
                                    socket.id,

                                room:
                                    roomCode
                            }
                        )
                }
            );


        if (
            !saveResponse.ok
        ) {

            throw new Error(
                "Server rejected push subscription."
            );

        }


        console.log(
            "Push notifications enabled!"
        );


    } catch (error) {

        console.error(
            "Notification setup failed:",
            error
        );

    }

}


/* ========================================
   SEND TEXT MESSAGE
   ======================================== */

function sendMessage() {

    if (imageUploadInProgress) {
        return;
    }

    if (!messageInput) {
        return;
    }

    const text =
        messageInput.value.trim();

    if (text.length === 0) {
        return;
    }

    if (!socket.connected) {

        if (status) {
            status.textContent =
                "Not connected to server.";
        }

        return;
    }

    const isImageUrl =
        /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(text);

    if (isImageUrl) {

        socket.emit(
            "sendImage",
            {
                image: text,
                type: "image/url"
            }
        );

    } else {

        socket.emit(
            "sendMessage",
            text
        );

    }

    messageSentSound.currentTime = 0;

    messageSentSound
        .play()
        .catch(function() {});

    messageInput.value = "";
}


/* ========================================
   ENTER TO SEND
   ======================================== */

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        function(event) {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );

}


/* ========================================
   IMAGE BUTTON
   ======================================== */

if (imageButton) {

    imageButton.addEventListener(
        "click",
        function() {

            if (
                imageUploadInProgress
            ) {

                return;

            }


            if (imageInput) {

                imageInput.click();

            }

        }
    );

}


/* ========================================
   IMAGE SELECTED
   ======================================== */

if (imageInput) {

    imageInput.addEventListener(
        "change",
        function() {

            const file =
                imageInput.files[0];


            if (!file) {

                return;

            }


            if (
                !file.type.startsWith("image/")
            ) {

                alert(
                    "Please select an image."
                );

                imageInput.value =
                    "";

                return;

            }


            if (
                file.size >
                4 * 1024 * 1024
            ) {

                alert(
                    "Image must be 4 MB or smaller."
                );

                imageInput.value =
                    "";

                return;

            }


            if (
                !socket.connected
            ) {

                alert(
                    "You are not connected to a room."
                );

                imageInput.value =
                    "";

                return;

            }


            if (
                imageUploadInProgress
            ) {

                return;

            }


            imageUploadInProgress =
                true;


            if (messageInput) {

                messageInput.disabled =
                    true;

            }


            if (sendButton) {

                sendButton.disabled =
                    true;

            }


            if (imageButton) {

                imageButton.disabled =
                    true;

            }


            const preview =
                new Image();


            preview.onload =
                function() {

                    let width =
                        preview.naturalWidth;


                    let height =
                        preview.naturalHeight;


                    const maxWidth =
                        250;


                    const maxHeight =
                        250;


                    if (
                        width > maxWidth
                    ) {

                        const ratio =
                            maxWidth / width;


                        width =
                            maxWidth;


                        height =
                            height * ratio;

                    }


                    if (
                        height > maxHeight
                    ) {

                        const ratio =
                            maxHeight / height;


                        height =
                            maxHeight;


                        width =
                            width * ratio;

                    }


                    const loadingMessage =
                        document.createElement("div");


                    loadingMessage.classList.add(
                        "message",
                        "messageMine",
                        "imageLoadingMessage"
                    );


                    loadingMessage.style.width =
                        width + "px";


                    loadingMessage.style.height =
                        height + "px";


                    loadingMessage.style.backgroundColor =
                        "#555555";


                    loadingMessage.style.display =
                        "flex";


                    loadingMessage.style.alignItems =
                        "center";


                    loadingMessage.style.justifyContent =
                        "center";


                    loadingMessage.style.padding =
                        "0";


                    const spinner =
                        document.createElement("div");


                    spinner.classList.add(
                        "imageLoadingSpinner"
                    );


                    spinner.textContent =
                        "⟳";


                    spinner.style.color =
                        "#ffffff";


                    spinner.style.fontSize =
                        "40px";


                    spinner.style.lineHeight =
                        "1";


                    spinner.style.animation =
                        "imageSpinner 1s linear infinite";


                    loadingMessage.appendChild(
                        spinner
                    );


                    if (messages) {

                        messages.appendChild(
                            loadingMessage
                        );


                        messages.scrollTop =
                            messages.scrollHeight;

                    }


                    currentImageLoadingMessage =
                        loadingMessage;


                    imageUploadTimeout =
                        setTimeout(
                            function() {

                                if (
                                    !imageUploadInProgress
                                ) {

                                    return;

                                }


                                imageUploadInProgress =
                                    false;


                                if (
                                    currentImageLoadingMessage
                                ) {

                                    currentImageLoadingMessage.remove();

                                    currentImageLoadingMessage =
                                        null;

                                }


                                if (messageInput) {

                                    messageInput.disabled =
                                        false;

                                }


                                if (sendButton) {

                                    sendButton.disabled =
                                        false;

                                }


                                if (imageButton) {

                                    imageButton.disabled =
                                        false;

                                }


                                showUploadError();


                                imageInput.value =
                                    "";

                            },
                            7000
                        );


                    const reader =
                        new FileReader();


                    reader.onload =
                        function() {

                            if (
                                !imageUploadInProgress
                            ) {

                                return;

                            }


                            socket.emit(
                                "sendImage",
                                {
                                    image:
                                        reader.result,

                                    type:
                                        file.type
                                }
                            );

                        };


                    reader.onerror =
                        function() {

                            if (
                                imageUploadTimeout
                            ) {

                                clearTimeout(
                                    imageUploadTimeout
                                );

                                imageUploadTimeout =
                                    null;

                            }


                            imageUploadInProgress =
                                false;


                            if (
                                currentImageLoadingMessage
                            ) {

                                currentImageLoadingMessage.remove();

                                currentImageLoadingMessage =
                                    null;

                            }


                            if (messageInput) {

                                messageInput.disabled =
                                    false;

                            }


                            if (sendButton) {

                                sendButton.disabled =
                                    false;

                            }


                            if (imageButton) {

                                imageButton.disabled =
                                    false;

                            }


                            showUploadError();

                        };


                    reader.readAsDataURL(
                        file
                    );

                };


            preview.onerror =
                function() {

                    imageUploadInProgress =
                        false;


                    if (messageInput) {

                        messageInput.disabled =
                            false;

                    }


                    if (sendButton) {

                        sendButton.disabled =
                            false;

                    }


                    if (imageButton) {

                        imageButton.disabled =
                            false;

                    }


                    showUploadError();

                };


            preview.src =
                URL.createObjectURL(file);


            imageInput.value =
                "";

        }
    );

}


/* ========================================
   UPLOAD ERROR
   ======================================== */

function showUploadError() {

    const error =
        document.createElement("div");


    error.classList.add(
        "uploadError"
    );


    error.textContent =
        "Error: Could not send file";


    document.body.appendChild(
        error
    );


    setTimeout(
        function() {

            error.classList.add(
                "hide"
            );


            setTimeout(
                function() {

                    error.remove();

                },
                300
            );

        },
        3000
    );

}


/* ========================================
   RECEIVE TEXT MESSAGE
   ======================================== */

socket.on(
    "receiveMessage",
    async function(data) {

        if (
            !currentRoomCode
        ) {

            return;

        }


        const isMine =
            data.sender === socket.id;


        const messageData = {

            type:
                "text",

            text:
                data.text,

            username:
                data.username || "user",

            mine:
                isMine,

            timestamp:
                Date.now()

        };


        const message =
            createTextMessageElement(
                messageData
            );


        if (messages) {

            messages.appendChild(
                message
            );


            messages.scrollTop =
                messages.scrollHeight;

        }


        /* ========================================
           SAVE TO THIS ROOM ONLY
           ======================================== */

        await saveMessageToCurrentRoom(
            messageData
        );


        if (
            !isMine &&
            !muted
        ) {

            audio.currentTime =
                0;


            audio.play().catch(
                function() {}
            );

        }

    }
);


/* ========================================
   RECEIVE IMAGE
   ======================================== */

socket.on(
    "receiveImage",
    async function(data) {

        if (
            !data ||
            !data.image ||
            !currentRoomCode
        ) {

            return;

        }


        const isMine =
            data.sender === socket.id;


        if (
            isMine
        ) {

            if (
                imageUploadTimeout
            ) {

                clearTimeout(
                    imageUploadTimeout
                );

                imageUploadTimeout =
                    null;

            }


            imageUploadInProgress =
                false;


            if (
                currentImageLoadingMessage
            ) {

                currentImageLoadingMessage.remove();

                currentImageLoadingMessage =
                    null;

            }


            if (messageInput) {

                messageInput.disabled =
                    false;

            }


            if (sendButton) {

                sendButton.disabled =
                    false;

            }


            if (imageButton) {

                imageButton.disabled =
                    false;

            }

        }


        const imageData = {

            type:
                "image",

            image:
                data.image,

            username:
                data.username || "user",

            mine:
                isMine,

            timestamp:
                Date.now()

        };


        const message =
            createImageMessageElement(
                imageData
            );


        if (messages) {

            messages.appendChild(
                message
            );


            messages.scrollTop =
                messages.scrollHeight;

        }


        /* ========================================
           SAVE IMAGE TO THIS ROOM ONLY
           ======================================== */

        await saveMessageToCurrentRoom(
            imageData
        );


        if (
            !isMine &&
            !muted
        ) {

            audio.currentTime =
                0;


            audio.play().catch(
                function() {}
            );

        }

    }
);


/* ========================================
   USER JOINED
   ======================================== */

socket.on(
    "userJoined",
    async function(username) {

        if (
            !currentRoomCode
        ) {

            return;

        }


        const text =
            username +
            " joined the room.";


        const message =
            createSystemMessageElement(
                text
            );


        if (messages) {

            messages.appendChild(
                message
            );


            messages.scrollTop =
                messages.scrollHeight;

        }


        await saveMessageToCurrentRoom(
            {
                type:
                    "system",

                text:
                    text,

                timestamp:
                    Date.now()

            }
        );

    }
);


/* ========================================
   CONNECTION STATUS
   ======================================== */

socket.on(
    "connect",
    function() {

        console.log(
            "Connected to server:",
            socket.id
        );

    }
);


socket.on(
    "disconnect",
    function() {

        console.log(
            "Disconnected from server."
        );


        if (
            imageUploadInProgress
        ) {

            if (
                imageUploadTimeout
            ) {

                clearTimeout(
                    imageUploadTimeout
                );

                imageUploadTimeout =
                    null;

            }


            imageUploadInProgress =
                false;


            if (
                currentImageLoadingMessage
            ) {

                currentImageLoadingMessage.remove();

                currentImageLoadingMessage =
                    null;

            }


            if (messageInput) {

                messageInput.disabled =
                    false;

            }


            if (sendButton) {

                sendButton.disabled =
                    false;

            }


            if (imageButton) {

                imageButton.disabled =
                    false;

            }

        }

    }
);




document.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
        buttonClickSound.currentTime = 0;
        buttonClickSound.play();
    });
});


