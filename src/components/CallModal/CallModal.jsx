import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import './CallModal.css';

const CallModal = forwardRef(({ socket, currentUser }, ref) => {
    const [callState, setCallState] = useState(null); // 'incoming', 'outgoing', 'connected'
    const [callData, setCallData] = useState(null);
    const [callType, setCallType] = useState('video');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const iceCandidateQueueRef = useRef([]);
    const isRemoteDescriptionSetRef = useRef(false);

    const callStateRef = useRef(null);
    const callDataRef = useRef(null);
    
    // Explicit Debug logs for pure diagnostic visibility
    const [debugLogs, setDebugLogs] = useState([]);
    const addDebugLog = (msg) => {
        setDebugLogs(prev => [...prev.slice(-4), msg]); // Keep last 5 logs
        console.log("WEBRTC-DEBUG:", msg);
    };

    useEffect(() => {
         callStateRef.current = callState;
         callDataRef.current = callData;
    }, [callState, callData]);

    useImperativeHandle(ref, () => ({
        initiateCall: async (targetId, type, targetName) => {
            const stream = await setupMedia(type);
            if (!stream) return;
            setCallType(type);
            setCallData({ targetId, callerName: targetName, callId: null });
            setCallState('outgoing');

            const pc = createPeerConnection(targetId);
            addDebugLog("Creating Offer...");
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            addDebugLog("Offer sent.");

            socket.emit('call_user', { receiverId: targetId, callType: type, signalData: offer });
        }
    }));

    useEffect(() => {
        if (!socket) return;

        const onIncomingCall = (data) => {
            if (callStateRef.current) {
                socket.emit('call_rejected', { callId: data.callId });
                return;
            }
            setCallType(data.callType);
            setCallData(data); 
            setCallState('incoming');
        };

        const onCallAccepted = async (data) => {
            addDebugLog(`Received Call_Accepted`);
            if (peerConnectionRef.current) {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.signalData));
                isRemoteDescriptionSetRef.current = true;
                setCallState('connected');
                setCallData(prev => ({ ...prev, callId: data.callId }));
                
                addDebugLog(`Flushing ${iceCandidateQueueRef.current.length} Queued ICE...`);
                for (const candidate of iceCandidateQueueRef.current) {
                    try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) {}
                }
                iceCandidateQueueRef.current = [];
            }
        };

        const onWebrtcSignal = async (data) => {
            if (data.signalData?.type === 'candidate' && data.signalData.candidate) {
                if (peerConnectionRef.current && isRemoteDescriptionSetRef.current) {
                    try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.signalData.candidate)); } catch(e) {}
                } else {
                    iceCandidateQueueRef.current.push(data.signalData.candidate);
                }
            }
        };

        const cleanup = () => {
             if (localStreamRef.current) {
                 localStreamRef.current.getTracks().forEach(t => t.stop());
                 localStreamRef.current = null;
             }
             if (peerConnectionRef.current) {
                 peerConnectionRef.current.close();
                 peerConnectionRef.current = null;
             }
             remoteStreamRef.current = null;
             iceCandidateQueueRef.current = [];
             isRemoteDescriptionSetRef.current = false;
             setCallState(null);
             setCallData(null);
             setIsMuted(false);
             setIsVideoOff(false);
        };

        socket.on('incoming_call', onIncomingCall);
        socket.on('call_accepted', onCallAccepted);
        socket.on('webrtc_signal', onWebrtcSignal);
        socket.on('call_rejected', cleanup);
        socket.on('end_call', cleanup);
        socket.on('call_error', (data) => { alert(data.message); cleanup(); });

        return () => {
            socket.off('incoming_call', onIncomingCall);
            socket.off('call_accepted', onCallAccepted);
            socket.off('webrtc_signal', onWebrtcSignal);
            socket.off('call_rejected', cleanup);
            socket.off('end_call', cleanup);
            socket.off('call_error');
        };
    }, [socket]);

    useEffect(() => {
         if ((callState === 'connected' || callState === 'outgoing')) {
              if (localStreamRef.current && localVideoRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
                  localVideoRef.current.srcObject = localStreamRef.current;
              }
              if (remoteStreamRef.current && remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
                  remoteVideoRef.current.srcObject = remoteStreamRef.current;
                  remoteVideoRef.current.play().catch(e => console.log(e));
              }
         }
    });

    const setupMedia = async (type) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
            localStreamRef.current = stream;
            return stream;
        } catch (err) {
            alert('Không thể truy cập Camera hoặc Microphone.');
            return null;
        }
    };

    const createPeerConnection = (targetId) => {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        
        pc.onconnectionstatechange = () => {
            addDebugLog(`Conn State: ${pc.connectionState}`);
        };
        pc.oniceconnectionstatechange = () => {
            addDebugLog(`ICE State: ${pc.iceConnectionState}`);
        };

        if (localStreamRef.current) {
            addDebugLog(`Added Local Tracks: ${localStreamRef.current.getTracks().length}`);
            localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
        }

        pc.ontrack = (event) => {
            addDebugLog(`OnTrack triggered: ${event.streams.length} streams`);
            if (event.streams && event.streams[0]) {
                remoteStreamRef.current = event.streams[0];
                if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== event.streams[0]) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                    remoteVideoRef.current.play().catch(e => addDebugLog('Play Error: ' + e.message));
                }
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc_signal', { targetId, signalData: { type: 'candidate', candidate: event.candidate } });
            }
        };

        peerConnectionRef.current = pc;
        return pc;
    };

    const answerCall = async () => {
        const stream = await setupMedia(callType);
        if (!stream) return;

        addDebugLog(`AnswerCall initiated for ${callData.callerId}`);
        const pc = createPeerConnection(callData.callerId);
        await pc.setRemoteDescription(new RTCSessionDescription(callData.signalData));
        isRemoteDescriptionSetRef.current = true;
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        addDebugLog("Answer sent.");

        for (const candidate of iceCandidateQueueRef.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) {}
        }
        iceCandidateQueueRef.current = [];

        socket.emit('call_accepted', { callId: callData.callId, signalData: answer });
        setCallState('connected');
        setCallData(prev => ({ ...prev, targetId: callData.callerId })); 
    };

    const rejectCall = () => {
        socket.emit('call_rejected', { callId: callData.callId });
        setCallState(null);
        setCallData(null);
    };

    const endCall = () => {
        if (callData?.callId) {
             socket.emit('end_call', { callId: callData.callId });
        } else if (callState === 'outgoing') {
             socket.emit('end_call', { callId: 'temp', targetId: callData.targetId });
        }
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
        if (peerConnectionRef.current) peerConnectionRef.current.close();
        
        remoteStreamRef.current = null;
        iceCandidateQueueRef.current = [];
        isRemoteDescriptionSetRef.current = false;
        setCallState(null);
        setCallData(null);
        setIsMuted(false);
        setIsVideoOff(false);
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    if (!callState) return null;

    return (
        <div className="call-overlay">
            <div className={`call-container ${callState === 'incoming' ? 'small-modal' : 'fullscreen-modal'}`}>
                {callState === 'incoming' && (
                    <div className="incoming-call-box">
                       <div className="caller-info">
                           <div className="caller-avatar-huge">{callData?.callerName?.charAt(0) || 'U'}</div>
                           <h3>{callData?.callerName}</h3>
                           <p>Đang gọi {callType === 'video' ? 'Video' : 'Thoại'} cho bạn...</p>
                       </div>
                       <div className="call-actions">
                           <button className="btn-decline" onClick={rejectCall}>Từ chối</button>
                           <button className="btn-accept" onClick={answerCall}>Trả lời</button>
                       </div>
                    </div>
                )}

                {(callState === 'outgoing' || callState === 'connected') && (
                    <div className="active-call-box">
                        <div className="video-area" style={{position: 'relative'}}>
                             {/* Diagnostic overlay */}
                             <div style={{position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', color: '#00ff00', padding: '10px', fontSize: '12px', zIndex: 9999, borderRadius: '8px', textAlign: 'left', pointerEvents: 'none'}}>
                                 {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
                             </div>
                             {callType === 'video' ? (
                               <>
                                   <video 
                                       ref={(el) => {
                                           remoteVideoRef.current = el;
                                           if (el && remoteStreamRef.current && el.srcObject !== remoteStreamRef.current) {
                                               el.srcObject = remoteStreamRef.current;
                                           }
                                       }}
                                       autoPlay playsInline className="remote-video" 
                                   />
                                   <div className="local-video-wrapper">
                                       <video 
                                           ref={(el) => {
                                               localVideoRef.current = el;
                                               if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                                                   el.srcObject = localStreamRef.current;
                                               }
                                           }}
                                           autoPlay playsInline muted className="local-video" 
                                       />
                                   </div>
                                 </>
                           ) : (
                               <div className="voice-call-avatar">
                                  <div className="caller-avatar-epic">{callData?.callerName?.charAt(0) || 'U'}</div>
                                  <h2>{callData?.callerName}</h2>
                                  <p>{callState === 'outgoing' ? 'Đang đổ chuông...' : 'Đang trong cuộc gọi thoại 0:00'}</p>
                                    {/* Dummy video to keep stream active without displaying */}
                                    <video ref={(el) => {
                                           localVideoRef.current = el;
                                           if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                                               el.srcObject = localStreamRef.current;
                                           }
                                       }} autoPlay playsInline muted style={{display: 'none'}} />
                                 </div>
                           )}
                       </div>

                       <div className="call-controls">
                           <button className={`control-btn ${isMuted ? 'muted' : ''}`} onClick={toggleMute} title={isMuted ? "Mở Mic" : "Tắt Mic"} style={{fontWeight: 600, fontSize: '0.9rem'}}>
                               {isMuted ? 'BẬT MIC' : 'TẮT MIC'}
                           </button>
                           {callType === 'video' && (
                               <button className={`control-btn ${isVideoOff ? 'muted' : ''}`} onClick={toggleVideo} title={isVideoOff ? "Bật Cam" : "Tắt Cam"} style={{fontWeight: 600, fontSize: '0.9rem'}}>
                                   {isVideoOff ? 'BẬT CAM' : 'TẮT CAM'}
                               </button>
                           )}
                           <button className="control-btn end-call-btn" onClick={endCall} title="Kết thúc">
                                Kết thúc
                           </button>
                       </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default CallModal;
