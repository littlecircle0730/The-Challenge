import unittest
from unittest.mock import MagicMock
import json
from types import SimpleNamespace
from aioquic.h3.events import DatagramReceived

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from Nimble_Challenge/src/server import dataHandler

class TestDataHandler(unittest.TestCase):
    def setUp(self):
        self.session_id = 123
        self.mock_http = MagicMock()
        self.answer = b
        self.coord = SimpleNamespace()
        self.coord.current_ball_position = (100, 150)
        
        self.handler = dataHandler(
            session_id=self.session_id,
            http=self.mock_http,
            answer=self.answer,
            update_coordinate=self.coord
        )
        self.handler.current_ball_position = (100, 150)

    def test_offer_message_sends_answer(self):
        msg = {"type": "offer"}
        encoded = json.dumps(msg).encode("utf-8")
        event = DatagramReceived(data=encoded, flow_id=0)

        self.handler.h3_event_received(event)

        self.mock_http.send_datagram.assert_called_once_with(self.session_id, self.answer)

    def test_coord_message_computes_error(self):
        msg = {"type": "coord", "x": 90, "y": 140}
        encoded = json.dumps(msg).encode("utf-8")
        event = DatagramReceived(data=encoded, flow_id=0)

        self.handler.h3_event_received(event)
        print("###")