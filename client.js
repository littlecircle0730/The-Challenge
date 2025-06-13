import { getBallCoordinate, detectCircle, sendOverWebTransport, waitForAnswer, send_coord, waitForBouncingErr } from './utils.js';
import cv from 'opencv.js';

const servers = {
    iceServers: [
        {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

let transport, streamNumber, writer;
let pc, remoteVideo, offer, offerDescription;

async function connect() {
    const url = 'https://localhost:4433/data';
    try {
      var transportInner = new WebTransport(url);
      console.log('Initiating connection...');
    } catch (e) {
      console.log('Failed to create connection object. ' + e, 'error');
      return;
    }
  
    try {
      await transportInner.ready;
      console.log('Connection ready.');
    } catch (e) {
      console.log('Connection failed. ' + e, 'error');
      return;
    }
  
    transportInner.closed
        .then(() => {
          console.log('Connection closed normally.');
        })
        .catch(() => {
          console.log('Connection closed abruptly.', 'error');
        });
  
    globalThis.transport = transportInner;
    globalThis.streamNumber = 1;
    try {
        // stream writer
        globalThis.stream = await transportInner.createBidirectionalStream();
        globalThis.writer = stream.writable.getWriter();
        // datagrams writer
        globalThis.datagramWriter = transportInner.datagrams.writable.getWriter();
    } catch (e) {
      console.log('Sending datagrams not supported: ' + e, 'error');
      return;
    }
}

// Should be able to improve by binary search in Later
function findBallBoundaries() {
    const canvas = document.getElementById('canvasInput');
    const ctx = canvas.getContext('2d');
    const size = 40;

    canvas.width = 500;
    canvas.height = 500;
    
    ctx.drawImage(globalThis.remoteVideo, 0, 0, canvas.width, canvas.height);
    
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;

    const whiteThreshold = 200;  

    let left = canvas.width, right = 0, top = canvas.height, bottom = 0;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            let index = (y * canvas.width + x) * 4;
            let r = data[index]; 
            let g = data[index + 1];
            let b = data[index + 2];

            if (r > whiteThreshold && g > whiteThreshold && b > whiteThreshold) {
                left = Math.min(left, x);   
                right = Math.max(right, x);
                top = Math.min(top, y);   
                bottom = Math.max(bottom, y); 
            }
        }
    }
    // console.log(left, right, top, bottom)
    if (left === canvas.width && right === 0 && top === canvas.height && bottom === 0) {
        console.log("No ball found.");
        return null;
    }
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

async function main() {

    globalThis.pc = new RTCPeerConnection(servers);

    globalThis.dataChannel = globalThis.pc.createDataChannel("ballCoordinates");
    globalThis.remoteVideo = document.getElementById('remoteVideo');
    const videoTransceiver = globalThis.pc.addTransceiver("video", {
        direction: 'recvonly'
    });

    // Receive the video from the Srever (webRTC)
    const remoteStream = new MediaStream();
    // Pull tracks from remote stream
    globalThis.pc.addEventListener('track', (event) => {
        console.log("### new Track comming")
        if (event.track.kind == 'video') {
            // console.log("### new Track comming", event)
            globalThis.remoteVideo.srcObject = event.streams[0];
        }
    });

    globalThis.pc.oniceconnectionstatechange = () => {
        console.log("### ICE Connection state: ", globalThis.pc.iceConnectionState);
        if (globalThis.pc.iceConnectionState === "connected") {
            console.log("### WebRTC connection established successfully!");
        }
    };
    
    // connect webTransport
    await connect();

    // create offer
    globalThis.offerDescription = await globalThis.pc.createOffer();
    await globalThis.pc.setLocalDescription(globalThis.offerDescription);
    globalThis.offer = {
        sdp: globalThis.offerDescription.sdp,
        type: globalThis.offerDescription.type,
    };
    console.log("### Offer created", globalThis.offer)
    
    //send offer
    await sendOverWebTransport(globalThis.writer, globalThis.offer);
    await waitForAnswer(globalThis.stream, globalThis.pc);

    // parse & send the ball location
    globalThis.remoteVideo.addEventListener('loadeddata', () => {
        const canvas = document.getElementById('canvasInput');

        setInterval(() => {
        
            let src = cv.imread(canvas);
            let circles = new cv.Mat();
        
            // // detectCircle(cv, src, circles)
            // if (src && src.data) {
            //     cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
            //     cv.GaussianBlur(src, src, new cv.Size(5, 5), 0);
            //     cv.HoughCircles(src, circles, cv.HOUGH_GRADIENT, 1, 45, 200, 100, 0, 0);
            // } else {
            //     console.log("### No Image Src")
            // }
            // // send coord back
            // if (circles.cols > 0) {
            //     const coord = getBallCoordinate(circles);
            //     let jsonData = JSON.stringify(coord);
            //     console.log("### Sending data via datagram:", jsonData);
            //     send_coord(globalThis.datagramWriter, jsonData)
            // } else {
            //     console.log("skip ")
            // }
            const coord = findBallBoundaries()
            coord["type"] = "coord";
            console.log("coord", coord)
            send_coord(globalThis.datagramWriter, coord)

            src.delete(); //release cv 
            circles.delete();
        }, 100); //handle every 20ms
    });
    waitForBouncingErr(globalThis.transport);
}

main();

// document.getElementById('sendOffer').addEventListener('click', async () => {
//     // connect webTransport
//     await connect();

//     // create offer
//     globalThis.offer = {
//         sdp: globalThis.offerDescription.sdp,
//         type: globalThis.offerDescription.type,
//     };
//     console.log("### Offer created", globalThis.offer)
    
//     //send offer
//     await sendOfferOverWebTransport(globalThis.writer, globalThis.pc);

//     // listen to Ice candidate
//     globalThis.pc.onicecandidate = (event) => {
//         console.log("### event", event)
//         console.log("### event candidate", event.candidate)
//         if (event.candidate) {
//             globalThis.transport.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
//         }
//     };
// });

export { getBallCoordinate, sendOverWebTransport, waitForAnswer };