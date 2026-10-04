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

const translateMessage = async (
    message,
    fromLanguage,
    toLanguage
) => {

    // No translation needed
    if (fromLanguage === toLanguage) {
        return message;
    }

    try {

        const result = await deeplClient.translateText(
            message,
            fromLanguage,
            toLanguage
        );

        return result.text;

    } catch (error) {

        console.error(
            "Translation error:",
            error.message
        );

        // If translation fails,
        // return the original message
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

            // Language in which the original sender sent the message
            const senderLanguage =
                oldMessage.senderLanguage || "en";

            // Language selected by the new user
            const receiverLanguage =
                userLanguages[socket.id] || "en";


            // Translate old message for the new user
            const translatedMessage =
                await translateMessage(
                    oldMessage.data,
                    senderLanguage,
                    receiverLanguage
                );


            // Send translated old message
            io.to(socket.id).emit(
                "chat-message",
                translatedMessage,
                oldMessage.sender,
                oldMessage["socket-id-sender"]
            );
        }
    }
});
        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        })

        socket.on("chat-message", (data, sender) => {

            const [matchingRoom, found] = Object.entries(connections)
            .reduce(([room, isFound], [roomKey, roomValue]) => {

                if(!isFound && roomValue.includes(socket.id)){
                    return [roomKey, true];
                }

                return [room, isFound];
            }, ['', false]);

            if(found === true){
                if(messages[matchingRoom] === undefined){
                    messages[matchingRoom] = []
                }

                messages[matchingRoom].push({'sender': sender, "data" : data , "socket-id-sender": socket.id, senderLanguage: userLanguages[socket.id] || "en"})
                console.log("message", matchingRoom, ":" , sender, data)

                connections[matchingRoom].forEach(async (elem) => {

                const receiverLanguage = userLanguages[elem] || "en";

                const translatedMessage = await translateMessage(
                    data,
                    userLanguages[socket.id] || "en",
                    receiverLanguage
                );

                io.to(elem).emit(
                    "chat-message",
                    translatedMessage,
                    sender,
                    socket.id
                );
            });
                        }
        })

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