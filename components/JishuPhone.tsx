import React, { useState, useEffect } from 'react';

interface JishuPhoneProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const JishuPhone: React.FC<JishuPhoneProps> = ({ onSuccess, onCancel }) => {
  const [targetNumber, setTargetNumber] = useState('');
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    // Generate a random phone number format (e.g., "852-963")
    const p1 = Math.floor(Math.random() * 900) + 100;
    const p2 = Math.floor(Math.random() * 900) + 100;
    setTargetNumber(`${p1}-${p2}`);
  }, []);

  const handlePress = (num: string) => {
    if (input.length < 7) { 
       let next = input + num;
       if (next.length === 3 && targetNumber[3] === '-') next += '-';
       setInput(next);
    }
  };

  const handleClear = () => {
    setInput('');
  };

  const handleCall = () => {
    if (input === targetNumber) {
      onSuccess();
    } else {
      // Wrong number animation
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setInput('');
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
       <div className="relative bg-gray-900 border-4 border-blue-500 rounded-2xl w-full max-w-sm shadow-[0_0_50px_rgba(59,130,246,0.6)] overflow-hidden">
          
          {/* Header */}
          <div className="bg-blue-600 p-3 text-center">
             <h2 className="text-white font-bold text-lg tracking-widest animate-pulse">EMERGENCY CALL</h2>
             <p className="text-xs text-blue-200">自首用回線接続中...</p>
          </div>

          {/* Screen */}
          <div className="p-6 bg-gray-800">
             <div className="bg-[#9ea792] p-4 rounded shadow-inner border-4 border-gray-600 mb-6 font-mono relative">
                <div className="text-xs text-gray-700 font-bold mb-1">REQ: <span className="text-xl">{targetNumber}</span></div>
                <div className={`text-3xl font-bold text-black tracking-widest h-10 border-b-2 border-black/20 ${shake ? 'animate-shake text-red-600' : ''}`}>
                   {input}<span className="animate-blink">_</span>
                </div>
                {/* Scanlines */}
                <div className="absolute inset-0 pointer-events-none opacity-10" style={{backgroundImage: 'linear-gradient(transparent 50%, rgba(0,0,0,0.5) 50%)', backgroundSize: '100% 4px'}}></div>
             </div>

             {/* Keypad */}
             <div className="grid grid-cols-3 gap-3">
                {[1,2,3,4,5,6,7,8,9].map(n => (
                   <button 
                     key={n}
                     onClick={() => handlePress(n.toString())}
                     className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-2xl py-4 rounded shadow-[0_4px_0_#374151] active:translate-y-1 active:shadow-none transition-all"
                   >
                     {n}
                   </button>
                ))}
                <button 
                   onClick={handleClear}
                   className="bg-red-900 hover:bg-red-800 text-white font-bold text-sm py-4 rounded shadow-[0_4px_0_#7f1d1d] active:translate-y-1 active:shadow-none"
                >
                  CLR
                </button>
                <button 
                   onClick={() => handlePress('0')}
                   className="bg-gray-700 hover:bg-gray-600 text-white font-bold text-2xl py-4 rounded shadow-[0_4px_0_#374151] active:translate-y-1 active:shadow-none"
                >
                  0
                </button>
                <button 
                   onClick={handleCall}
                   className="bg-green-600 hover:bg-green-500 text-white font-bold text-sm py-4 rounded shadow-[0_4px_0_#15803d] active:translate-y-1 active:shadow-none"
                >
                  CALL
                </button>
             </div>
          </div>

          {/* Cancel Button */}
          <button 
             onClick={onCancel}
             className="absolute top-2 right-2 text-white/50 hover:text-white"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
       </div>
       
       <style>{`
         @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
         }
         .animate-shake { animation: shake 0.2s ease-in-out infinite; }
         .animate-blink { animation: blink 1s step-end infinite; }
         @keyframes blink { 50% { opacity: 0; } }
       `}</style>
    </div>
  );
};