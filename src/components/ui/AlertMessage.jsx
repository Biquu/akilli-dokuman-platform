'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export function AlertMessage({ 
  type = 'success', 
  message, 
  duration = 5000,
  onClose 
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!isVisible || !message) return null;

  const alertStyles = {
    success: {
      className: 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 text-green-800',
      icon: <CheckCircle2 className="h-4 w-4 text-green-600" />
    },
    error: {
      className: 'border-red-200 bg-gradient-to-r from-red-50 to-orange-50 text-red-800',
      icon: <AlertCircle className="h-4 w-4 text-red-600" />
    },
    warning: {
      className: 'border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50 text-yellow-800',
      icon: <AlertCircle className="h-4 w-4 text-yellow-600" />
    },
    info: {
      className: 'border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800',
      icon: <AlertCircle className="h-4 w-4 text-blue-600" />
    }
  };

  const style = alertStyles[type] || alertStyles.success;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-right-2">
      <Alert className={`${style.className} shadow-lg border-2 rounded-2xl backdrop-blur-sm`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            {style.icon}
          </div>
          <AlertDescription className="flex-1 text-sm font-medium">
            {message}
          </AlertDescription>
          <button
            onClick={() => {
              setIsVisible(false);
              onClose?.();
            }}
            className="flex-shrink-0 p-1 hover:bg-black/10 rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </Alert>
    </div>
  );
}

export default AlertMessage;
