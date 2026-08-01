import React, { useRef, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';

export const MessageLog: React.FC = () => {
  const messages = useGameStore((state) => state.messages);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="message-log" ref={logContainerRef}>
      {messages.map((msg, index) => (
        <div key={index} className="log-line">
          {msg}
        </div>
      ))}
    </div>
  );
};
