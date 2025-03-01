// src/services/exportService.js
export function initiateExport(data, config) {
    return new Promise((resolve, reject) => {
      try {
        const exportWorker = createExportWorker();
        
        exportWorker.onmessage = (event) => {
          if (event.data.type === 'complete') {
            resolve(event.data.file);
            exportWorker.terminate();
          } else if (event.data.type === 'error') {
            reject(new Error(event.data.error));
            exportWorker.terminate();
          }
        };
        
        exportWorker.onerror = (error) => {
          reject(error);
          exportWorker.terminate();
        };
        
        // Start the export process
        exportWorker.postMessage({ data, config });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  function createExportWorker() {
    if (typeof Worker !== 'undefined') {
      return new Worker(new URL('../workers/exportWorker.js', import.meta.url));
    }
    throw new Error('Web Workers not supported');
  }