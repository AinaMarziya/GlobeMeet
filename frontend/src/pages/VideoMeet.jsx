import React, { useState,useEffect, useRef } from 'react'
import io from "socket.io-client";
import Button from "@mui/material/Button";
import styles from "../styles/videoComponent.module.css";
import VideocamIcon from '@mui/icons-material/Videocam';
import {Badge,IconButton,TextField, Select,MenuItem,InputLabel,FormControl} from '@mui/material';
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import CallEndIcon from '@mui/icons-material/CallEnd'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare'
import ChatIcon from '@mui/icons-material/Chat'

const server_url = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

var connections = {};
const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302"}
    ]
}
 
export default function videoMeetComponent() {
    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoref = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);

    let [audioAvailable, setAudioAvailable] = useState(true);

    let [video, setVideo] = useState([]);

    let [audio, setAudio] = useState();

    let [screen, setScreen] = useState();

    let [showModal, setModal] = useState(true);

    let [screenAvailable, setScreenAvailable] = useState();

    let [messages, setMessages] = useState([])

    let [message, setMessage] = useState("");
    
    let [newMessages, setNewMessages] = useState(3);

    let [askForUsername, setAskForUsername] = useState(true);

    let [username, setUsername] = useState("");

    let [language, setLanguage] = useState("en");

    const videoRef = useRef([])

    let [videos, setVideos] = useState([])

    let getDislayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .then((stream) => { })
                    .catch((e) => console.log(e))
            }
        }
    }

    
    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoPermission) {
                setVideoAvailable(true);
                console.log('Video permission granted');
            } else {
                setVideoAvailable(false);
                console.log('Video permission denied');
            }

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (audioPermission) {
                setAudioAvailable(true);
                console.log('Audio permission granted');
            } else {
                setAudioAvailable(false);
                console.log('Audio permission denied');
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });
                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoref.current) {
                        localVideoref.current.srcObject = userMediaStream;
                    }
                }
            }
        } catch (error) {
            console.log(error);
        }
    };
    useEffect(() => {
        console.log("HELLO")
        getPermissions();

    },[])

    //get user medis succes
    let getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer().then((description) => {
                console.log(description)
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            //todo blacksilence
            let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            for (let id in connections) {
                connections[id].addStream(window.localStream)

                connections[id].createOffer().then((description) => {
                    connections[id].setLocalDescription(description)
                        .then(() => {
                            socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                        })
                        .catch(e => console.log(e))
                })
            }
        })
    }

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
    }, [screen])

    let getDislayMediaSuccess = (stream) => {
        console.log("HERE")
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream
        localVideoref.current.srcObject = stream

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            connections[id].addStream(window.localStream)

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            })
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false)

            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()])
            window.localStream = blackSilence()
            localVideoref.current.srcObject = window.localStream

            getUserMedia()

        })
    }

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator()
        let dst = oscillator.connect(ctx.createMediaStreamDestination())
        oscillator.start()
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }
    

    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height })
        canvas.getContext('2d').fillRect(0, 0, width, height)
        let stream = canvas.captureStream()
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoref.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { }
        }
    }
    let connect = () => {
        setAskForUsername(false);
        getMedia();
    }

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
            console.log("SET STATE HAS ", video, audio);

        }


    }, [video, audio])
    let handleAudio = () => {
        setAudio(!audio)
        // getUserMedia();
    }

    let handleVideo = () => {
        setVideo(!video);
        // getUserMedia();
    }

     let handleScreen = () => {
        setScreen(!screen);
    }
    let handleEndCall = () => {
        try {
            let tracks = localVideoref.current.srcObject.getTracks()
            tracks.forEach(track => track.stop())
        } catch (e) { }
        window.location.href = "/home"
    }


    //TODO 
    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message)

        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then((description) => {
                            connections[fromId].setLocalDescription(description).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': connections[fromId].localDescription }))
                            }).catch(e => console.log(e))
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e))
            }
        }
    }
    
    //TODO addMessage
let addMessage = (data, sender, socketIdSender) => {

    setMessages((messages) => [
        ...messages,
        {
            sender: sender,
            original: data.original,
            translated: data.translated
        }
    ]);

    if (socketIdSender !== socketIdRef.current) {
        setNewMessages((prevNewMessages) => prevNewMessages + 1);
    }
};


    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false })

        socketRef.current.on('signal', gotMessageFromServer)

        socketRef.current.on('connect', () => {

        socketIdRef.current = socketRef.current.id;

        socketRef.current.emit("set-language", language);

        socketRef.current.emit('join-call', window.location.href);

            socketRef.current.on('chat-message', addMessage)

            socketRef.current.on('user-left', (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
            })

            socketRef.current.on('user-joined', (id, clients) => {
                clients.forEach((socketListId) => {

                    if(socketListId=== socketRef.current.id) return;

                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)
                    // Wait for their ice candidate       
                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null) {
                            socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }))
                        }
                    }

                    // Wait for their video stream
                    connections[socketListId].onaddstream = (event) => {
                        console.log("BEFORE:", videoRef.current);
                        console.log("FINDING ID: ", socketListId);

                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);

                        if (videoExists) {
                            console.log("FOUND EXISTING");

                            // Update the stream of the existing video
                            setVideos(videos => {
                                const updatedVideos = videos.map(video =>
                                    video.socketId === socketListId ? { ...video, stream: event.stream } : video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        } else {
                            // Create a new video
                            console.log("CREATING NEW");
                            let newVideo = {
                                socketId: socketListId,
                                stream: event.stream,
                                autoplay: true,
                                playsinline: true
                            };

                            setVideos(videos => {
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            });
                        }
                    };


                    // Add the local video stream
                    if (window.localStream !== undefined && window.localStream !== null) {
                        connections[socketListId].addStream(window.localStream)
                    } else {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()])
                        window.localStream = blackSilence()
                        connections[socketListId].addStream(window.localStream)
                    }
                })

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue

                        try {
                            connections[id2].addStream(window.localStream)
                        } catch (e) { }

                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => {
                                    socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connections[id2].localDescription }))
                                })
                                .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    }

    let openChat = () => {
        setModal(true);
        setNewMessages(0);
    }
    let closeChat = () => {
        setModal(false);
    }
    let handleMessage = (e) => {
        setMessage(e.target.value);
    }

    let sendMessage = () => {
        console.log(socketRef.current);
        socketRef.current.emit('chat-message', message, username)
        setMessage("");

        //this.setState({ message: "", sender: username })
    }

    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        connectToSocketServer();

    }

    return (
    <div>

        {askForUsername ? (
            // =========================
            // LOBBY SCREEN
            // =========================
            <div>
                <h2>Enter into Lobby</h2>

                <TextField
                    id="outlined-basic"
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    variant="outlined"
                />
                <FormControl fullWidth style={{ marginTop: "20px" }}>
                <InputLabel>Language</InputLabel>

                <Select
                    value={language}
                    label="Language"
                    onChange={(e) => setLanguage(e.target.value)}
                >
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="hi">Hindi</MenuItem>
                    <MenuItem value="ur">Urdu</MenuItem>
                    <MenuItem value="fr">French</MenuItem>
                    <MenuItem value="es">Spanish</MenuItem>
                </Select>
            </FormControl>

                <Button
                    variant="contained"
                    onClick={connect}
                >
                    Connect
                </Button>
            </div>

        ) : (

            // =========================
            // VIDEO MEETING SCREEN
            // =========================
            <div className={styles.meetVideoContainer}>

                {/* =========================
                    OTHER USERS' VIDEOS
                ========================= */}
                <div className={styles.conferenceView}>

                    {videos.map((video) => (
                        <div
    className={styles.videoCard}
    key={video.socketId}
>
    <video
        data-socket={video.socketId}
        ref={(ref) => {
    if (
        ref &&
        video.stream &&
        ref.srcObject !== video.stream
    ) {
        ref.srcObject = video.stream;
    }
}}
        autoPlay
        playsInline
    />
</div>
                    ))}

                </div>


                {/* =========================
                    MY VIDEO
                ========================= */}
                <video
                    className={styles.meetUserVideo}
                    ref={localVideoref}
                    autoPlay
                    muted
                    playsInline
                ></video>


                {/* =========================
                    BOTTOM BUTTONS
                ========================= */}
                <div className={styles.buttonContainers}>

                    {/* Camera */}
                    <IconButton
                        onClick={handleVideo}
                        style={{ color: "white" }}
                    >
                        {video === true
                            ? <VideocamIcon />
                            : <VideocamOffIcon />
                        }
                    </IconButton>


                    {/* End Call */}
                    <IconButton
                        onClick={handleEndCall}
                        style={{ color: "red" }}
                    >
                        <CallEndIcon />
                    </IconButton>


                    {/* Microphone */}
                    <IconButton
                        onClick={handleAudio}
                        style={{ color: "white" }}
                    >
                        {audio === true
                            ? <MicIcon />
                            : <MicOffIcon />
                        }
                    </IconButton>


                    {/* Screen Share */}
                    {screenAvailable === true ? (
                        <IconButton
                            onClick={handleScreen}
                            style={{ color: "white" }}
                        >
                            {screen === true
                                ? <StopScreenShareIcon />
                                : <ScreenShareIcon />
                            }
                        </IconButton>
                    ) : (
                        <></>
                    )}


                    {/* Chat */}
                    <Badge
                        badgeContent={newMessages}
                        max={999}
                        color="orange"
                    >
                        <IconButton
                            onClick={() => setModal(!showModal)}
                            style={{ color: "white" }}
                        >
                            <ChatIcon />
                        </IconButton>
                    </Badge>

                </div>


                {/* =========================
                    CHAT WINDOW
                ========================= */}

                {showModal && (
                    <div className={styles.chatContainer}>

                        <h1>Chat</h1>
                        <div className={styles.chattingDisplay}>

{messages.length !== 0 ? (
    messages.map((item, index) => (
        <div
            className={styles.messageCard}
            key={index}
        >
            <p className={styles.messageSender}>
                {item.sender}
            </p>

            <p className={styles.messageText}>
                <strong>Original:</strong>{" "}
                {item.original ?? item.data ?? ""}
            </p>

            {item.translated &&
                item.translated !==
                    (item.original ?? item.data) && (
                    <p className={styles.messageText}>
                        <strong>Translation:</strong>{" "}
                        {item.translated}
                    </p>
                )}
        </div>
    ))
) : (
    <p>No Messages Yet</p>
)}


                            </div>


                        {/* Messages */}
                        
                            <div className={styles.chatInputArea}>

                                <TextField
                                    value={message}
                                    onChange={handleMessage}
                                    placeholder="Enter your chat"
                                    fullWidth
                                />

                                <Button
                                    variant="contained"
                                    onClick={sendMessage}
                                >
                                    SEND
                                </Button>

                            </div>

                    </div>
                )}

            </div>
        )}

    </div>
);
}
