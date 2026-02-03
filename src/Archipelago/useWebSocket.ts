
import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: any) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { 
    url, 
    reconnectInterval = 5000,
    maxReconnectAttempts = 10
  } = options;
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectingRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const optionsRef = useRef(options);

  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const connect = useCallback(() => {
    if (isConnectingRef.current) {
      console.log('Already connecting, skipping...');
      return;
    }
    
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.log('Socket already open, skipping...');
      return;
    }

    console.log(`Connecting to WebSocket: ${url}`);
    isConnectingRef.current = true;
    
    // Clean up any existing socket
    if (socketRef.current) {
      // Remove all event listeners first
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      
      // Only close if not already closing/closed
      if (socketRef.current.readyState === WebSocket.OPEN || 
          socketRef.current.readyState === WebSocket.CONNECTING) {
        socketRef.current.close(1000, 'Reconnecting');
      }
      socketRef.current = null;
    }

    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        isConnectingRef.current = false;
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        optionsRef.current.onOpen?.();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          optionsRef.current.onMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      socket.onerror = (event) => {
        console.error('❌ WebSocket error event triggered');
        // Don't set isConnectingRef to false here - let onclose handle it
        optionsRef.current.onError?.(event);
      };

      socket.onclose = (event) => {
        console.log(`🔌 WebSocket closed (code: ${event.code}, reason: ${event.reason || 'no reason'})`);
        socketRef.current = null;
        isConnectingRef.current = false;
        setIsConnected(false);
        
        optionsRef.current.onClose?.(event);
        
        // Auto-reconnect if not a normal closure and we haven't exceeded max attempts
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`🔄 Reconnecting in ${reconnectInterval}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          // Clear any existing timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (event.code !== 1000) {
          console.log(`❌ Max reconnection attempts (${maxReconnectAttempts}) reached`);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      isConnectingRef.current = false;
      setIsConnected(false);
      
      // Retry on error
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    }
  }, [url, reconnectInterval, maxReconnectAttempts]); // Removed onMessage, onOpen, etc from dependencies

  const disconnect = useCallback(() => {
    console.log('Manual disconnect requested');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
    
    if (socketRef.current) {
      // Remove listeners
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      
      socketRef.current.close(1000, 'Manual disconnect');
      socketRef.current = null;
    }
    
    isConnectingRef.current = false;
    setIsConnected(false);
  }, [maxReconnectAttempts]);

  const send = useCallback((data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('Error sending message:', error);
        return false;
      }
    } else {
      console.log('Cannot send - WebSocket not open. State:', socketRef.current?.readyState);
      return false;
    }
  }, []);

  useEffect(() => {
    console.log('useWebSocket hook mounted or URL changed, connecting...');
    connect();
    
    return () => {
      console.log('useWebSocket hook unmounting or URL changing, cleaning up...');
      disconnect();
    };
  }, [connect, disconnect, url]);

  return {
    isConnected,
    socket: socketRef.current,
    send,
    connect,
    disconnect
  };
}