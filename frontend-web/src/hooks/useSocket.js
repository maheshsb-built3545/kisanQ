import { useContext, useEffect } from 'react';
import { SocketContext } from '../context/SocketContext';
import { SOCKET_EVENTS } from '../constants/events';

export function useSocket(eventName, callback, centreId = null) {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }

  const { socket, isConnected } = context;

  useEffect(() => {
    if (!socket) return;

    if (centreId) {
      socket.emit(SOCKET_EVENTS.JOIN_CENTRE_QUEUE, centreId);
    }

    if (eventName && callback) {
      socket.on(eventName, callback);
    }

    return () => {
      if (eventName && callback) {
        socket.off(eventName, callback);
      }
      if (centreId) {
        socket.emit(SOCKET_EVENTS.LEAVE_CENTRE_QUEUE, centreId);
      }
    };
  }, [socket, eventName, callback, centreId]);

  return { socket, isConnected };
}
