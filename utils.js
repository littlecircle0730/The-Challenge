export function getBallCoordinate(circles) {
    if (circles.cols == 0) { 
        return null;
    }
    //get ball center // There is only one ball
    let x = circles.data32F[0]; 
    let y = circles.data32F[1];
    let circleData = {
        x: x,
        y: y,
    };
    return circleData
}

export function detectCircle(src, circles) {
    if (src && src.data) {
        cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
        cv.HoughCircles(src, circles, cv.HOUGH_GRADIENT,
            1, 45, 75, 40, 0, 0);
    } else {
        console.log("### No Image Src")
    }
}

export async function sendOverWebTransport(writer, msg) {
    try {
        if (!writer) {
            console.error("### Writer is not available!");
            return;
        }

        if (writer.locked) {
            console.error("### Writer is locked, cannot send data.");
            return;
        }

        // Serialize the offer data into a JSON string
        const jsonStr = JSON.stringify(msg);
        
        // Encode the string to binary format (Uint8Array)
        const data = new TextEncoder('utf-8').encode(jsonStr);
        console.log(`MSG length: ${data.length}`);

        // Try sending the offer data through the writer
        await writer.write(data);
        await writer.close();
        console.log("### MSG sent successfully");

    } catch (error) {
        console.error("### Error while sending offer:", error);
    }
}


export async function waitForAnswer(stream, pc) {
    let buffer = new Uint8Array(0);  
    let reader = stream.readable.getReader();
    try {
        while (true) {
        console.log("### waiting for Answer");
        const { value, done } = await reader.read();
        if (done) {
            console.log("Stream DONE!");
            const text = new TextDecoder().decode(buffer, { stream: true });
            const data = JSON.parse(text);
            console.log("RECEIVE type:", data.type)

            if (data.type === "answer") {
                const answer = data
                console.log("Received SDP answer with Type:", answer.type);
                await pc.setRemoteDescription({ type: answer.type, sdp: answer.sdp });
                console.log("### Clinet receive remote description", pc.remoteDescription)
                // console.log("### Clinet receive remote description", JSON.stringify(pc.currentRemoteDescription))
                // console.log("### Clinet receive remote description", JSON.stringify(pc.currentLocalDescription))
                
            } else if(data.type === "candidate") {
                const candidateData = data;
                const candidate = new RTCIceCandidate(candidateData);
                pc.addIceCandidate(candidate)
                    .then(() => {
                        console.log('client add ICE candidate:', candidate);
                    })
                    .catch((error) => {
                        console.error('Error adding ICE candidate:', error);
                    });
            }
            buffer = new Uint8Array(0);
            console.log("Stream finished!");
            return;
        }
        // accu
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;
        console.log("### received new data from stream:", value, done);
      }
    } catch (e) {
        console.log('Error while reading: ' + e);
        console.log('    ' + e.message);
    }
}

export async function waitForBouncingErr() {
    const reader = transport.datagrams.readable.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
  
      const msg = new TextDecoder().decode(value);
      console.log('[Server Error]:', msg);
      
      const errorDisplay = document.getElementById('errorText');
      if (errorDisplay) {
        errorDisplay.textContent = `Error: ${msg}`;
      }
    }
}