// Custom Hook for Firebase Connection Testing
import { useState, useEffect } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { ref } from 'firebase/storage';

/**
 * Custom hook for testing and monitoring Firebase connection
 */
export function useFirebaseConnection() {
  const [connectionStatus, setConnectionStatus] = useState('testing');
  const [configStatus, setConfigStatus] = useState({});
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const testConnection = async () => {
      try {
        setConnectionStatus('testing');
        setError(null);
        
        // Check environment variables
        const config = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };
        
        setConfigStatus(config);
        
        // Test Firestore connection
        const testCollection = collection(db, 'connection-test');
        await getDocs(testCollection);
        
        // Test Storage connection
        const testStorageRef = ref(storage, 'connection-test');
        
        // If we get here, connection is successful
        setConnectionStatus('connected');
        setIsConnected(true);
        
      } catch (error) {
        console.error('Firebase connection test failed:', error);
        setConnectionStatus('error');
        setError(error);
        setIsConnected(false);
      }
    };

    testConnection();
  }, []);

  const retryConnection = () => {
    setConnectionStatus('testing');
    setError(null);
    // Re-run the effect
    window.location.reload();
  };

  // Check if all required config values are present
  const missingConfig = Object.entries(configStatus)
    .filter(([key, value]) => !value || value === 'undefined')
    .map(([key]) => key);

  const hasValidConfig = missingConfig.length === 0;

  return {
    connectionStatus,
    configStatus,
    error,
    isConnected,
    hasValidConfig,
    missingConfig,
    retryConnection
  };
}