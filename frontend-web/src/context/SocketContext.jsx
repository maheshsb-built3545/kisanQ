import { createContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '../constants/events';
import { useAuth } from '../hooks/useAuth';

export const SocketContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(API_BASE, {
      auth: { token: token || localStorage.getItem('kq_token') },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    newSocket.on(SOCKET_EVENTS.CONNECT, () => setIsConnected(true));
    newSocket.on(SOCKET_EVENTS.DISCONNECT, () => setIsConnected(false));
    newSocket.on(SOCKET_EVENTS.CONNECT_ERROR, () => setIsConnected(false));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
