import connection  from "mongoose"
import {Server } from "socket.io"
import * as deepl from "deepl-node"


let connections= {}
let messages = {}
let timeOnline = {}
let userLanguages = {}
const deeplClient = new deepl.DeepLClient(
    process.env.DEEPL_AUTH_KEY
);
const sourceLanguageMap = {
    en: "EN",
    hi: "HI",
    ur: "UR",
    fr: "FR",
    es: "ES"
};

const targetLanguageMap = {
    en: "EN-US",
    hi: "HI",
    ur: "UR",
    fr: "FR",
    es: "ES"
};
const translateMessage = async (
    message,
    fromLanguage,
    toLanguage
) => {

    if (!message || message.trim() === "") {
        return "";
    }

    if (fromLanguage === toLanguage) {
        return message;
    }

    try {

        const sourceLanguage =
            sourceLanguageMap[fromLanguage];

        const targetLanguage =
            targetLanguageMap[toLanguage];

        console.log(
            `Translating ${sourceLanguage} → ${targetLanguage}`
        );

        const result = await deeplClient.translateText(
            message,
            sourceLanguage,
            targetLanguage
        );

        console.log(
            "Translation result:",
            result.text
        );

        return result.text;

    } catch (error) {

        console.error(
            "Translation error:",
            error.message
        );

        return message;
    }
};

export const connectToSocket = (server) => {
    const io= new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials:true

        }
    });
    
    io.on("connection" , (socket)=> {
        socket.on("set-language", (language) => {
            userLanguages[socket.id] = language;

            console.log(
                "User language:",
                socket.id,
                language
            );  
        });
        console.log("Somethong Connected");

        socket.on("join-call", async (path) => {
//             console.log("JOIN CALL");
// console.log("Socket ID:", socket.id);
// console.log("ROOM PATH:", path);

    if (connections[path] === undefined) {
        connections[path] = [];
    }

    connections[path].push(socket.id);
    timeOnline[socket.id] = new Date();


    // Tell everyone that a new user joined
    for (let a = 0; a < connections[path].length; a++) {

        io.to(connections[path][a]).emit(
            "user-joined",
            socket.id,
            connections[path]
        );
    }


    // Send previous chat messages to the new user
    if (messages[path] !== undefined) {

        for (let a = 0; a < messages[path].length; a++) {

            const oldMessage = messages[path][a];


            // Language selected by the new user
            const receiverLanguage =
                userLanguages[socket.id] || "en";


            // Translate old message for the new user
            const translatedMessage =
                await translateMessage(
                    oldMessage.data,
                    oldMessage.senderLanguage,
                    receiverLanguage
                );


            // Send translated old message
            io.to(socket.id).emit(
                "chat-message",
                {
                    original: oldMessage.data,
                    translated: translatedMessage
                },
                oldMessage.sender,
                oldMessage["socket-id-sender"]
            );
        }
    }
});
        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        })

        socket.on("chat-message", async (data, sender) => {

    // Find which meeting room this user belongs to
    const [matchingRoom, found] = Object.entries(connections)
        .reduce(([room, isFound], [roomKey, roomValue]) => {

            if (!isFound && roomValue.includes(socket.id)) {
                return [roomKey, true];
            }

            return [room, isFound];

        }, ['', false]);


    // If user is not in any room, stop
    if (!found) {
        return;
    }


    // Create messages array for this room if it doesn't exist
    if (messages[matchingRoom] === undefined) {
        messages[matchingRoom] = [];
    }


    // Language of the person who sent the message
    const senderLanguage =
        userLanguages[socket.id] || "en";


    // Save the ORIGINAL message
    messages[matchingRoom].push({
        sender: sender,
        data: data,
        "socket-id-sender": socket.id,
        senderLanguage: senderLanguage
    });


    console.log(
        "Message:",
        matchingRoom,
        ":",
        sender,
        data,
        "Language:",
        senderLanguage
    );


    // ------------------------------------------------
    // Find all different languages in this meeting
    // ------------------------------------------------

    const languages = new Set();

    connections[matchingRoom].forEach((userId) => {

        const language =
            userLanguages[userId] || "en";

        languages.add(language);
    });


    // ------------------------------------------------
    // Translate the message ONCE for each language
    // ------------------------------------------------

    const translations = {};

    for (const language of languages) {

        // If the receiver uses the same language
        // as the sender, translation is unnecessary.
        if (language === senderLanguage) {

            translations[language] = data;

        } else {

            translations[language] =
                await translateMessage(
                    data,
                    senderLanguage,
                    language
                );
        }
    }


    // ------------------------------------------------
    // Send the correct translation to each user
    // ------------------------------------------------

    connections[matchingRoom].forEach((userId) => {

    const receiverLanguage =
                    userLanguages[userId] || "en";

                // If this is the sender
                if (userId === socket.id) {

                    io.to(userId).emit(
                        "chat-message",
                        {
                            original: data,
                            translated: data
                        },
                        sender,
                        socket.id
                    );

                    return;
                }

                // For other users, send translated message
                const translatedMessage =
                    translations[receiverLanguage];

                io.to(userId).emit(
                    "chat-message",
                    {
                        original: data,
                        translated: translatedMessage
                    },
                    sender,
                    socket.id
                );
            });

});

        socket.on("disconnect", () => {
            var diffTime = Math.abs(timeOnline[socket.id] - new Date())

            var key

            for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {
                for (let a = 0; a < v.length; ++a) {
                    if (v[a] === socket.id) {
                        key = k

                        for (let a = 0; a < connections[key].length; ++a) {
                            io.to(connections[key][a]).emit('user-left', socket.id)
                        }

                         var index = connections[key].indexOf(socket.id)

                        connections[key].splice(index, 1)

                        if (connections[key].length === 0) {
                            delete connections[key]
                        }
                    }
                }
            }
            delete userLanguages[socket.id];
        })
    })
}