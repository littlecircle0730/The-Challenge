# Nimble Programming Challenge Submission

## Overview

This project demonstrates a WebRTC + WebTransport system for real-time video streaming, image processing, and feedback loop via datagrams. The system consists of a **client** (browser-based web app) and a **server** (Python backend), communicating over WebTransport for signaling and control data, and WebRTC for video delivery.


## Architecture

1. **WebTransport as Signaling**  
   WebTransport is used as the signaling channel to exchange the WebRTC SDP **offer** and **answer** between client and server.

2. **WebRTC for Video Streaming**  
   Once signaling is complete, a peer connection is established using WebRTC. The server streams H.264-encoded frames of a bouncing ball to the client in real time.

3. **Datagrams for Lightweight Data Exchange**  
   WebTransport datagrams are used to send:
   - Client-to-server: Ball center coordinates (x, y)
   - Server-to-client: Real-time position error


## Client Behavior

- Displays video frames streamed via WebRTC.
- Uses canvas to analyze each video frame to estimate the bounding box of the ball.
- Calculates the ball's center `(x, y)` based on detected boundaries.
- Sends `(x, y)` coordinates to the server using **WebTransport datagrams**.
- Receives and displays error feedback from the server in real time.

**Note:** Currently the ball detection algorithm performs full-frame scanning. This can be optimized using binary search or region narrowing techniques for better performance.


## Server Behavior

- Hosts the web app and listens for WebTransport connections.
- Receives the WebRTC SDP offer and responds with an answer.
- Spawns a worker thread or subprocess to:
  - Simulate a bouncing ball on a 2D canvas.
  - Generate video frames at a configurable frame rate.
- Streams frames via WebRTC with **H.264 encoding**.
- Receives detected coordinates from the client.
- Compares them to the actual simulated position and computes the real-time error.
- Sends the error back to the client via WebTransport datagrams.

---

## Detection Approaches

- **Pixel-level Canvas Analysis:** Simplified fallback approach used in the current implementation for reliable submission under resource constraints.
- The OpenCV code is still included and can be re-enabled.
- **OpenCV (cv2):** Initially used for detecting the ball, worked on first run but faced delays—possibly due to CPU load or image copy latency.


## Deployment
Kubernetes deployment is still a work in progress. For now, the application is designed to be run locally by following the steps below.

## Local RUN
Server: `python server.py`
Client: `npx vite`
Client page on: https://localhost:5173/

## For webTransport app on browser
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --origin-to-force-quic-on=localhost:4433 \
  --ignore-certificate-errors-spki-list=pJ2BdYvZEgR3Tbli8/mA+lwu+sGiJAjeBrkY3NMVpCk= \
  --user-data-dir=/tmp/chrome-wt-profile \
  https://localhost:5173

## For Docker:
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --origin-to-force-quic-on=localhost:4433 \
  --ignore-certificate-errors-spki-list=pJ2BdYvZEgR3Tbli8/mA+lwu+sGiJAjeBrkY3NMVpCk= \
  --user-data-dir=/tmp/chrome-wt-profile \
  https://localhost:443


### Docker

- `Dockerfile.server`: Builds the Python backend with WebRTC and WebTransport support.
- `Dockerfile.client`: Builds the Vite-based frontend for WebRTC + WebTransport interaction.

### Kubernetes

- Provided basic manifest YAML files:
  - `server-deployment.yaml`
  - `client-deployment.yaml`
- **Note:** These are a work in progress and not fully tested. The server and client can also be run locally using Docker Compose.


# Test
python -m unittest Nimble_Challenge/src/tests/test_server.py


<!-- # for credential for webTransport
brew install mkcert
mkcert -install  
mkcert localhost -->

<!-- npm install --save-dev jest babel-jest @babel/preset-env jest-environment-jsdom
npm install --save-dev identity-obj-proxy
npm install --save-dev yargs-parser
pip install opencv-python
pip install aioquic
pip install aiortc -->
