import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { buildTelemedicineRoom } from '../../services/healthRecords';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function TelemedicineRoom({ appointment, user, role = 'patient', locked = false, lockedMessage = '' }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [remoteOnline, setRemoteOnline] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');

  const room = appointment ? buildTelemedicineRoom(appointment) : null;
  const roomStatus = joined ? (remoteOnline ? 'Connected' : 'Waiting for participant') : 'Not joined';
  const identity = {
    id: user?.id,
    name: user?.name || (role === 'doctor' ? 'Doctor' : 'Patient'),
    role,
  };

  const stopLocalMedia = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  };

  const closePeer = () => {
    peerRef.current?.close();
    peerRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setRemoteOnline(false);
  };

  const getSocketBaseUrl = () => {
    const configured = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;
    if (configured) return configured.replace(/\/$/, '');
    return window.location.origin;
  };

  const createPeer = () => {
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    localStreamRef.current?.getTracks().forEach((track) => peer.addTrack(track, localStreamRef.current));
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (remoteVideoRef.current && stream) remoteVideoRef.current.srcObject = stream;
      setRemoteOnline(true);
    };
    peer.onicecandidate = (event) => {
      if (event.candidate && room) {
        socketRef.current?.emit('telemedicine:signal', {
          appointmentId: appointment.id,
          signal: { candidate: event.candidate },
        });
      }
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setRemoteOnline(true);
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') setRemoteOnline(false);
    };
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'connected') setRemoteOnline(true);
      if (peer.iceConnectionState === 'failed' || peer.iceConnectionState === 'disconnected') setRemoteOnline(false);
    };
    peerRef.current = peer;
    return peer;
  };

  const startCall = async () => {
    if (!appointment || locked || connecting || joined) return;

    const isSecureContext = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecureContext) {
      toast.error('Live audio/video requires HTTPS or localhost. Deploy with HTTPS to enable microphone access.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Camera and microphone are not available in this browser.');
      return;
    }

    setConnecting(true);
    setCallEnded(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const socketBaseUrl = getSocketBaseUrl();
      const socket = io(socketBaseUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: { token: localStorage.getItem('token') },
        withCredentials: true,
      });
      socketRef.current = socket;
      createPeer();

      socket.on('connect', () => {
        socket.emit('telemedicine:join', { appointmentId: appointment.id, user: identity });
        setJoined(true);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connect error:', error);
        toast.error('Live call server connection failed. Refresh and try again.');
        endCall();
      });

      socket.on('telemedicine:peer-joined', async () => {
        setRemoteOnline(true);
        const peer = peerRef.current || createPeer();
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('telemedicine:signal', {
          appointmentId: appointment.id,
          signal: { description: peer.localDescription },
        });
      });

      socket.on('telemedicine:signal', async ({ signal, from }) => {
        if (!signal || from === socket.id) return;
        const peer = peerRef.current || createPeer();
        if (signal.description) {
          await peer.setRemoteDescription(signal.description);
          if (signal.description.type === 'offer') {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit('telemedicine:signal', {
              appointmentId: appointment.id,
              signal: { description: peer.localDescription },
            });
          }
        }
        if (signal.candidate) {
          try {
            await peer.addIceCandidate(signal.candidate);
          } catch (error) {
            console.warn('ICE candidate ignored:', error);
          }
        }
      });

      socket.on('telemedicine:chat', (payload) => {
        setMessages((current) => [...current, payload]);
      });

      socket.on('telemedicine:system', (payload) => {
        setMessages((current) => [...current, { ...payload, system: true }]);
      });

      socket.on('telemedicine:peer-left', () => setRemoteOnline(false));

      socket.on('telemedicine:call-ended', ({ by }) => {
        toast(`${by?.name || 'Participant'} ended the call.`);
        setCallEnded(true);
        setJoined(false);
        closePeer();
        stopLocalMedia();
        socket.disconnect();
      });
    } catch (error) {
      toast.error(error.name === 'NotAllowedError' ? 'Allow camera and microphone access to join the video call.' : 'Could not start video call.');
      stopLocalMedia();
    } finally {
      setConnecting(false);
    }
  };

  const endCall = () => {
    if (appointment) {
      socketRef.current?.emit('telemedicine:end-call', { appointmentId: appointment.id, user: identity });
    }
    setCallEnded(true);
    setJoined(false);
    closePeer();
    stopLocalMedia();
    socketRef.current?.disconnect();
  };

  const sendMessage = (event) => {
    event.preventDefault();
    const clean = message.trim();
    if (!clean || !appointment) return;
    socketRef.current?.emit('telemedicine:chat', {
      appointmentId: appointment.id,
      message: clean,
      user: identity,
    });
    setMessage('');
  };

  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  };

  const toggleCamera = () => {
    const next = !cameraOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = !next; });
    setCameraOff(next);
  };

  useEffect(() => () => {
    closePeer();
    stopLocalMedia();
    socketRef.current?.disconnect();
  }, []);

  return (
    <section className="card">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-bold">Live Video Consultation</h2>
          <p className="mt-1 text-sm text-gray-500">
            {appointment ? `Room: ${room.roomId}` : 'Select an appointment to open a room.'}
          </p>
        </div>
        <span className={`badge w-fit ${joined ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {roomStatus}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="aspect-video overflow-hidden rounded-xl bg-slate-950">
          <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover">
            <track kind="captions" srcLang="en" label="Captions" default />
          </video>
          {!joined && (
            <div className="flex h-full -mt-[56.25%] items-center justify-center text-center text-white">
              <div>
                <p className="font-semibold">{locked ? 'Video room locked' : 'Camera preview'}</p>
                <p className="mt-1 text-xs text-slate-300">{locked ? lockedMessage : 'Press Join Call to allow camera and microphone.'}</p>
              </div>
            </div>
          )}
        </div>
        <div className="aspect-video overflow-hidden rounded-xl bg-slate-900">
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover">
            <track kind="captions" srcLang="en" label="Captions" default />
          </video>
          {!remoteOnline && (
            <div className="flex h-full -mt-[56.25%] items-center justify-center text-center text-white">
              <div>
                <p className="font-semibold">Remote participant</p>
                <p className="mt-1 text-xs text-slate-300">{joined ? 'Waiting for the other side to join.' : 'Join the call to connect.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={!appointment || locked || connecting || joined} onClick={startCall}>
          {connecting ? 'Connecting...' : 'Join Call'}
        </button>
        <button type="button" className="btn-secondary" disabled={!joined} onClick={toggleMute}>{muted ? 'Unmute Mic' : 'Mute Mic'}</button>
        <button type="button" className="btn-secondary" disabled={!joined} onClick={toggleCamera}>{cameraOff ? 'Turn Camera On' : 'Turn Camera Off'}</button>
        <button type="button" className="btn-danger" disabled={!joined && callEnded} onClick={endCall}>End Call</button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div className="rounded-lg border border-gray-100 p-4 dark:border-gray-800">
          <h3 className="font-semibold">Live Messages</h3>
          <div className="mt-3 h-44 space-y-2 overflow-y-auto rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
            {messages.map((item, index) => (
              <div key={item.id || index} className={item.system ? 'text-center text-xs text-gray-500' : ''}>
                {item.system ? item.text : (
                  <>
                    <span className="font-semibold">{item.user?.name || 'Participant'}: </span>
                    <span>{item.text}</span>
                  </>
                )}
              </div>
            ))}
            {!messages.length && <p className="text-gray-500">No messages yet.</p>}
          </div>
          <form className="mt-3 flex gap-2" onSubmit={sendMessage}>
            <input className="input" value={message} disabled={!joined} onChange={(event) => setMessage(event.target.value)} placeholder="Type a message..." />
            <button type="submit" className="btn-primary" disabled={!joined || !message.trim()}>Send</button>
          </form>
        </div>
        <div className="rounded-lg border border-gray-100 p-4 text-sm dark:border-gray-800">
          <h3 className="font-semibold">Call Status</h3>
          <p className="mt-2 text-gray-500">Camera and microphone are live only after joining. End Call stops your tracks and closes the shared room for both sides.</p>
          {locked && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-800">{lockedMessage}</p>}
          {callEnded && <p className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">Call ended.</p>}
        </div>
      </div>
    </section>
  );
}
