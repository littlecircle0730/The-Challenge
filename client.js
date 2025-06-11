import { getBallCoordinate, detectCircle, sendOverWebTransport, waitForAnswer } from './utils.js';
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
    const url = 'https://localhost:8080/data';
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
    } catch (e) {
      console.log('Sending datagrams not supported: ' + e, 'error');
      return;
    }

    document.getElementById('sendOffer').disabled = true;
}

async function main() {
    let iceConnectionStateQueue = [];

    globalThis.pc = new RTCPeerConnection(servers);

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

    // while (iceConnectionStateQueue.length > 0) {
    //     let event = iceConnectionStateQueue.shift();
    //     console.log("### event candidate", event.candidate)
    //     if (globalThis.writer.closed) {
    //         globalThis.stream = await globalThis.transport.createBidirectionalStream();
    //         globalThis.writer = globalThis.stream.writable.getWriter();
    //     }
    //     sendOverWebTransport(globalThis.writer, { type: 'candidate', candidate: event.candidate });
    // }

    // // parse & send the ball location
    // globalThis.remoteVideo.addEventListener('loadeddata', () => {
    //     const canvas = document.getElementById('canvasInput');
    //     const ctx = canvas.getContext('2d');

    //     setInterval(async () => {
    //         ctx.drawImage(globalThis.remoteVideo, 0, 0, canvas.width, canvas.height);
        
    //         let src = cv.imread('canvasInput');
    //         let circles = new cv.Mat();
        
    //         // detectCircle(cv, src, circles)
    //         if (src && src.data) {
    //             cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
    //             cv.HoughCircles(src, circles, cv.HOUGH_GRADIENT,
    //                 1, 45, 75, 40, 0, 0);
    //         } else {
    //             console.log("### No Image Src")
    //         }
            
    //         // send coord back
    //         const coord = getBallCoordinate(circles);
    //         let jsonData = JSON.stringify(coord);
    //         let encodedJSON = new TextEncoder().encode(jsonData);;
    //         if (globalThis.writer.closed) {
    //             globalThis.stream = await globalThis.transport.createBidirectionalStream();
    //             globalThis.writer = globalThis.stream.writable.getWriter();
    //         }
    //         sendOverWebTransport(globalThis.writer, encodedJSON);

    //         src.delete(); //release cv 
    //         circles.delete();

    //     }, 20); //handle every 20ms
    // });
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