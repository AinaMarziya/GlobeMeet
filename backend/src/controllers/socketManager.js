import connection  from "mongoose"
import {Server } from "socket.io"


let connections= {}
let messages = {}
let timeOnline = {}
let userLanguages = {}
const translateMessage = async (message, fromLanguage, toLanguage) => {

    // For now, we are NOT connecting a translation API.
    // This is only our temporary function.

    if (fromLanguage === toLanguage) {
        return message;
    }

    console.log(
        `Translation needed: ${fromLanguage} → ${toLanguage}`
    );

    // Temporary: return original message
    return message;
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

        socket.on("join-call", (path) => {
            if(connections[path] === undefined){
                connections[path] = [];
            }
                connections[path].push(socket.id)
                timeOnline[socket.id] = new Date();

                // connetions[path].forEach(elem => {
                //     io.to(elem)
                // })

                for(let a=0; a<connections[path].length; a++){
                    io.to(connections[path][a]).emit("user-joined",socket.id, connections[path] )
                }

                if(messages[path] !== undefined){
                    for(let a=0; a<messages[path].length; a++){
                        io.to(socket.id).emit("chat-message",
                            messages[path][a]['data'],
                            messages[path][a]['sender'],
                            messages[path][a]['socket-id-sender'])
                    }
                }
        })
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