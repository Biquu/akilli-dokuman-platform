'use client';

import { useFirebaseConnection } from '@/hooks/useFirebaseConnection';

export default function FirebaseTest() {
  const {
    connectionStatus,
    configStatus,
    error,
    isConnected,
    hasValidConfig,
    missingConfig,
    retryConnection
  } = useFirebaseConnection();

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '✅';
      case 'error':
        return '❌';
      case 'testing':
        return '🔄';
      default:
        return '⏳';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Firebase Connected Successfully!';
      case 'error':
        return `Firebase Connection Error: ${error?.message || 'Unknown error'}`;
      case 'testing':
        return 'Testing Firebase connection...';
      default:
        return 'Initializing...';
    }
  };

  return (
    <div className={`bg-white p-6 rounded-lg shadow-lg border-2 border-dashed mb-6 ${
      isConnected ? 'border-green-300 bg-green-50/30' : 
      connectionStatus === 'error' ? 'border-red-300 bg-red-50/30' : 
      'border-yellow-300 bg-yellow-50/30'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">🔥 Firebase Connection Status</h3>
        {connectionStatus === 'error' && (
          <button
            onClick={retryConnection}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
      
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{getStatusIcon()}</span>
          <p className={`font-semibold ${
            isConnected ? 'text-green-600' : 
            connectionStatus === 'error' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            {getStatusText()}
          </p>
        </div>
      </div>
      
      <div>
        <h4 className="font-semibold mb-2">Environment Configuration:</h4>
        
        {!hasValidConfig && (
          <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-800 font-medium text-sm">
              ⚠️ Missing configuration: {missingConfig.join(', ')}
            </p>
          </div>
        )}
        
        <div className="text-xs font-mono bg-gray-100 p-3 rounded max-h-32 overflow-y-auto">
          {Object.entries(configStatus).map(([key, value]) => (
            <div key={key} className="mb-1 flex items-center justify-between">
              <span className="text-blue-600 font-medium">{key}:</span>
              <div className="flex items-center space-x-2">
                <span className={value && value !== 'undefined' ? 'text-green-600' : 'text-red-600'}>
                  {value && value !== 'undefined' ? '✅' : '❌'}
                </span>
                {value && value !== 'undefined' && (
                  <span className="text-gray-600 text-xs">
                    ({typeof value === 'string' && value.length > 15 ? 
                      value.substring(0, 15) + '...' : value})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {isConnected && (
          <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded-lg">
            <p className="text-green-800 text-sm font-medium">
              🎉 Firebase services are ready! You can now upload files.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}