
import React from 'react';
import { UploadedFile } from '../types';

interface FileCardProps {
  file: UploadedFile;
  onRemove: (id: string) => void;
}

const FileCard: React.FC<FileCardProps> = ({ file, onRemove }) => {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
          <span className="text-lg">📄</span>
        </div>
        <div className="overflow-hidden">
          <p className="text-sm font-medium text-gray-700 truncate max-w-[150px]">{file.name}</p>
          <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
        </div>
      </div>
      <button 
        onClick={() => onRemove(file.id)}
        className="text-gray-400 hover:text-red-500 p-2 transition-colors"
      >
        <span className="text-lg">✕</span>
      </button>
    </div>
  );
};

export default FileCard;
