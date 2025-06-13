from aioquic.asyncio import QuicConnectionProtocol, serve
from aioquic.h3.connection import H3_ALPN, H3Connection, Setting
from aioquic.h3.events import H3Event, HeadersReceived, WebTransportStreamDataReceived, DatagramReceived, DataReceived
from aioquic.quic.configuration import QuicConfiguration
from aioquic.quic.connection import stream_is_unidirectional
from aioquic.quic.events import ProtocolNegotiated, StreamReset, QuicEvent
from collections import defaultdict
from typing import Dict, Optional

import asyncio
from aiortc import RTCSessionDescription, RTCIceServer, RTCConfiguration, RTCIceCandidate
from aiortc import VideoStreamTrack, RTCPeerConnection
import signal
from av import VideoFrame
import cv2 as cv
import threading

import sys
import time
from types import SimpleNamespace
from collections import deque
import json
import queue 
import random
import numpy as np

# param
BIND_ADDRESS = '::1'
BIND_PORT = 8080

event = asyncio.Event()
thread = None 
global pc
global webTrans
    
class dataHandler:

    def __init__(self, session_id, http: H3Connection, update_coordinate) -> None:
        self._session_id = session_id
        self._http = http
        self.coord = update_coordinate
        self._stream_buffers = {}

    def h3_event_received(self, event: H3Event) -> None:
        global pc
        if isinstance(event, DatagramReceived):
            rawData = event.data.decode("utf-8")
            try:
                msg = json.loads(rawData)
                if "type" in msg and msg["type"] == 'coord':
                    print("### [Data Handler] receive message: ", msg["type"])
                    predicted_x, predicted_y = int(msg["x"]), int(msg["y"])
                    real_x, real_y = self.coord
                    err = ((real_x - predicted_x)**2 + (real_y - predicted_y)**2)**0.5
                    error_msg = {
                        "type": "error",
                        "value": err
                    }
                    error_json = json.dumps(error_msg)
                    encoded_error = error_json.encode("utf-8")
                    self._http.send_datagram(self._session_id, encoded_error)
            except Exception as e:
                print("Not expected data type:", e)

        if isinstance(event, WebTransportStreamDataReceived):
            if event.stream_id not in self._stream_buffers:
                self._stream_buffers[event.stream_id] = bytearray() 
            self._stream_buffers[event.stream_id].extend(event.data)
            
            if event.stream_ended:
                full_data = self._stream_buffers[event.stream_id].decode("utf-8")
                msg = {}
                try:
                    msg = json.loads(full_data)
                    if "type" in msg:
                        print("### [Stream Data Handler] receive message type: ", msg["type"])
                    else:
                        print("### [Stream Data Handler] receive", msg)
                except Exception as e:
                    print(f"Failed to load msg. Might Retry")
                
                if stream_is_unidirectional(event.stream_id):
                    print("### stream_is_unidirectional")
                    response_id = self._http.create_webtransport_stream(
                        self._session_id, is_unidirectional=True)
                else:
                    response_id = event.stream_id
                    
                # data process
                if "type" in msg:
                    if msg["type"] == 'offer':
                        offer = RTCSessionDescription(sdp=msg["sdp"], type=msg["type"])
                        asyncio.ensure_future(self._handle_offer(offer, response_id, event.stream_id))
                    elif msg["type"] == 'coord':
                        print("?????????")
                    #     predicted_x, predicted_y = msg["x"], msg["y"]
                    #     real_x, real_y = self.coord
                    #     err = ((real_x - predicted_x)**2 + (real_y - predicted_y)**2)**0.5
                self.stream_closed(event.stream_id)

    async def _handle_offer(self, offer, response_id, stream_id):
        global pc
        print("### [Handle Offer]")
                
        await pc.setRemoteDescription(offer)
        
        answer = await pc.createAnswer()
        try:
            await pc.setLocalDescription(answer)
            # a bug here, need to create one more time!!!
            answer = RTCSessionDescription(
                type=pc.localDescription.type, 
                sdp=pc.localDescription.sdp,
            )
            print("Local description set successfully.")
        except Exception as e:
            print(f"Failed to set local description: {e}")

        answer_json = json.dumps({
            "sdp": answer.sdp,
            "type": "answer",
        }).encode('utf-8')
        
        try:
            self._http._quic.send_stream_data(stream_id=response_id, data=answer_json, end_stream=True)
            print("### Answer sent Successfully")
        except Exception as e:
            print("### Answer sent Fail", e)

    def stream_closed(self, stream_id: int) -> None:
        try:
            del self._stream_buffers[stream_id]
        except KeyError:
            pass
    

# WebTransportProtocol handles the beginning of a WebTransport connection: it
# responses to an extended CONNECT method request, and routes the transport
# events to a relevant handler (in this example, dataHandler).
class WebTransportProtocol(QuicConnectionProtocol):

    def __init__(self, *args, answer=None, coord=None, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self._http: Optional[H3Connection] = None
        self._handler: Optional[dataHandler] = None
        self.coord = coord
        self.transport = None

    def quic_event_received(self, event: QuicEvent) -> None:
        if isinstance(event, ProtocolNegotiated):
            self._http = H3Connection(self._quic, enable_webtransport=True)
            # for candidate update
            global webTrans
            webTrans = self._http
        elif isinstance(event, StreamReset) and self._handler is not None:
            self._handler.stream_closed(event.stream_id)

        if self._http is not None:
            for h3_event in self._http.handle_event(event):
                self._h3_event_received(h3_event)

    def _h3_event_received(self, event: H3Event) -> None:
        if isinstance(event, HeadersReceived):
            headers = {}
            for header, value in event.headers:
                headers[header] = value
            if (headers.get(b":method") == b"CONNECT" and
                    headers.get(b":protocol") == b"webtransport"):
                self._handshake_webtransport(event.stream_id, headers)
            else:
                self._send_response(event.stream_id, 400, end_stream=True)

        if self._handler:
            self._handler.h3_event_received(event)

    def _handshake_webtransport(self,
                                stream_id: int,
                                request_headers: Dict[bytes, bytes]) -> None:
        authority = request_headers.get(b":authority")
        path = request_headers.get(b":path")
        if authority is None or path is None:
            # `:authority` and `:path` must be provided.
            self._send_response(stream_id, 400, end_stream=True)
            return
        if path == b"/data":
            assert(self._handler is None)
            self._handler = dataHandler(stream_id, self._http, self.coord)
            self._send_response(stream_id, 200)
        else:
            self._send_response(stream_id, 404, end_stream=True)

    def _send_response(self,
                       stream_id: int,
                       status_code: int,
                       end_stream=False) -> None:
        headers = [(b":status", str(status_code).encode())]
        if status_code == 200:
            headers.append((b"sec-webtransport-http3-draft", b"draft02"))
        self._http.send_headers(
            stream_id=stream_id, headers=headers, end_stream=end_stream)

class BouncingBallFrames(threading.Thread):
    def __init__(self, update_coordinate, frame_rate):
        super().__init__()
        
        self.update_coordinate = update_coordinate
        
        # canvas
        self.canvasW = 500
        self.canvasH = 500
        
        # ceter in the canvas
        self.x = self.canvasW // 2
        self.y = self.canvasH // 2
        self.radius = 40
        self.vx = random.random() * 10
        self.vy = random.random() * 10
        self.frame_interval = 1 / frame_rate
        
        self.q = queue.Queue()
        self.running = True
    
    def run(self):
        print("### [Bouncing Ball] start")
        while self.running:
            self.x += self.vx
            self.y += self.vy

            if self.x < self.radius or self.x > self.canvasW - self.radius:
                self.vx *= -1
            if self.y < self.radius or self.y > self.canvasH - self.radius:
                self.vy *= -1

            # update the ball position
            self.update_coordinate.current_ball_position = (self.x, self.y)

            frame = np.zeros((self.canvasH, self.canvasW, 3), dtype=np.uint8)
            cv.circle(frame, (int(self.x), int(self.y)), self.radius, (255, 255, 255), -1)

            video_frame = VideoFrame.from_ndarray(frame, format="bgr24")
            # video_frame.pts, video_frame.time_base = await self.next_timestamp() #aiortc.VideoStreamTrack
            
            self.q.put(video_frame)
            time.sleep(self.frame_interval)

    def dequeFrame(self):
        if not self.q:
            return None
        return self.q.popleft()

    def stopThread(self):
        self.running = False
    
class BallVideoTrack(VideoStreamTrack):
    def __init__(self, bouncing_thread, frame_rate):
        super().__init__() # VideoStreamTrack
        self.frame_interval = 1/frame_rate
        self.bouncing_thread = bouncing_thread
    
    async def recv(self) -> VideoFrame:
        await asyncio.sleep(self.frame_interval)
        await asyncio.sleep(self.frame_interval)
        try:
            video_frame = self.bouncing_thread.q.get_nowait()
        except queue.Empty:
            video_frame = np.zeros((500, 500, 3), dtype=np.uint8)
            video_frame = VideoFrame.from_ndarray(frame, format="bgr24")
        video_frame.pts, video_frame.time_base = await self.next_timestamp() #aiortc.VideoStreamTrack
        return video_frame

# stop gracefully    
def handle_sig():
    print("### [Handle Sig] Receive Signal to Stop")
    if thread is not None:
        thread.stopThread()
    event.set() 
      
async def main():    
    global thread
    global pc
    
    ice_servers = [
        RTCIceServer(urls=["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"])
    ]
    configurationRTC = RTCConfiguration(iceServers=ice_servers)
    pc = RTCPeerConnection(configurationRTC)
    
    @pc.on("icecandidate")
    def on_icecandidate(candidate):
        if candidate is None:
            print("### ICE not get candidate")
            print(event.candidate)
        else:
            print(f"New ICE candidate: {candidate}")
            
    @pc.on("signalingstatechange")
    async def on_signalingstatechange():
        print('Signaling state change:', pc.signalingState)
        if pc.signalingState == 'stable':
            print('ICE gathering complete')
            
    @pc.on('connectionstatechange')
    async def on_connectionstatechange():
        print('ICE Connection state change:', pc.connectionState)
        if pc.connectionState == 'connected':
            print('Peers successfully connected')
            
    @pc.on('iceconnectionstatechange')
    async def on_iceconnectionstatechange():
        print("ICE connection state is", pc.iceConnectionState)
        if pc.iceConnectionState == "failed":
            print("ICE Connection has failed, attempting to restart ICE")
            await pc.restartIce() 
    

    configuration = QuicConfiguration(
        alpn_protocols=H3_ALPN,
        is_client=False,
        max_datagram_frame_size=65536,
    )
    try:
        configuration.load_cert_chain("certificate.pem", "certificate.key") ## need permission for webTransport
    except Exception as e:
        print("Failed to load cert chain:", e)
    
    # actual location of the ball in real time 
    update_coordinate = SimpleNamespace()
    update_coordinate.current_ball_position = (0, 0)
    
    # threading
    thread = BouncingBallFrames(update_coordinate, frame_rate=30)
    thread.start()
    
    # vedioTrack via webRTC
    video_transceiver = pc.addTransceiver("video", direction="sendonly")
    video_track = BallVideoTrack(thread, frame_rate=30)
    video_transceiver.sender.replaceTrack(video_track)
    print("### Vedio Track - add track")
    
    await serve(
        BIND_ADDRESS,
        BIND_PORT,
        configuration=configuration,
        create_protocol=lambda *args, **kwargs: WebTransportProtocol(
            *args,
            answer=pc.localDescription,
            coord=update_coordinate,
            **kwargs
        )
    )
    print(f"### Server running at https://{BIND_ADDRESS}:{BIND_PORT}")
    
    # keep running
    await event.wait()

if __name__ == "__main__":
    # asyncio.run(main())
    loop = asyncio.get_event_loop()
    loop.add_signal_handler(signal.SIGINT, handle_sig)
    loop.add_signal_handler(signal.SIGTERM, handle_sig)
    loop.run_until_complete(main())