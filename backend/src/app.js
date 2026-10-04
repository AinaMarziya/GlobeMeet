import "dotenv/config";
import express from "express";
import {createServer}  from "node:http";
import {Server} from "socket.io";
import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";
import cors from "cors";

import userRoutes from "./routes/user.routes.js";

const app = express();
const server =createServer(app);
const io = connectToSocket(server);

app.set("port", (process.env.PORT || 8000))
app.use(cors());
app.use(express.json({ limit: "40kb"}));
app.use(express.urlencoded({limit: "40kb", extented: true}));

app.use("/api/v1/users", userRoutes);

const start =  async () => {
    const connectionDb = await mongoose.connect("mongodb+srv://ainamarziya727_db_user:KhushiDB_2026Video@videoconference.c8kgvnu.mongodb.net/")
    
    console.log(`MONGO Connected DB Host:${connectionDb.connection.host} `)
    server.listen(app.get("port"), () =>{
        console.log("LISTENING ON PORT 8000")
    });
}
start();