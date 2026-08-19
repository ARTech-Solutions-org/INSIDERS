import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';

interface InstaPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentLink: string;
}

export function InstaPayModal({ isOpen, onClose, paymentLink }: InstaPayModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      dir="rtl"
    >
      <div 
        className="relative w-full max-w-sm overflow-hidden bg-white shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir="ltr"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            InstaPay Payment
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 transition-colors rounded-full hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center p-8 space-y-6">
          <div className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl">
            <QRCodeSVG 
              value={paymentLink} 
              size={200} 
              level="H" 
              includeMargin={true}
              className="w-full h-auto"
            />
          </div>
          
          <p className="max-w-[250px] text-center text-sm font-medium leading-relaxed text-gray-600">
            Scan the code using the InstaPay app to complete the payment.
          </p>
        </div>
      </div>
    </div>
  );
}
