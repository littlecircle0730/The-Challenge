import { getBallCoordinate, sendOfferOverWebTransport, waitForAnswer } from '../utils.js';
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

describe('getBallCoordinate', () => {
    it('returns circle center', () => {
      const mat = { cols: 1, data32F: [12.5, 456.9, 10] };
      expect(getBallCoordinate(mat)).toEqual({ x: 12.5, y: 456.9 });
    });

    it('returns circle center', () => {
        const mat = { cols: 1, data32F: [100, 1000, 0] };
        expect(getBallCoordinate(mat)).toEqual({ x: 100, y: 1000 });
      });
  
    it('returns null if no circle', () => {
      const mat = { cols: 0, data32F: [] };
      expect(getBallCoordinate(mat)).toBeNull();
    });
});

test('returns circle center', async() => {
  const mockWrite = jest.fn();
  const mockTransport = {
    datagrams: {
      writable: { getWriter: () => ({ write: mockWrite }) }
    }
  };
  await sendOfferOverWebTransport(mockTransport);
  expect(mockWrite).toHaveBeenCalled();
});

test('waitForAnswer & setRemoteDescription', async () => {
  const mockSetRemote = jest.fn();
  const mockAnswer = {
    type: 'answer', sdp: 'fakeSdp'
  };

  const fakeReader = {
    read: jest.fn()
      .mockResolvedValueOnce({ value: new TextEncoder('utf-8').encode(JSON.stringify(mockAnswer)), done: false })
      .mockResolvedValueOnce({ done: true })
  };

  const mockTransport = {
    datagrams: {
      readable: {
        getReader: () => fakeReader
      }
    }
  };

  const pc = {
    setRemoteDescription: mockSetRemote
  };

  await waitForAnswer(mockTransport, pc);

  expect(mockSetRemote).toHaveBeenCalledWith({ type: 'answer', sdp: 'fakeSdp' });
});