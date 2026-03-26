import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, File, X, Download, Image, FileText, Film, Music, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const getFileIcon = (type) => {
  if (type?.startsWith('image/')) return Image;
  if (type?.startsWith('video/')) return Film;
  if (type?.startsWith('audio/')) return Music;
  if (type?.includes('pdf')) return FileText;
  return File;
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export default function FileUpload({ files = [], onFilesChange, currentUserEmail }) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (fileList) => {
    setUploading(true);
    const newFiles = [];

    try {
      for (const file of fileList) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        newFiles.push({
          name: file.name,
          url: file_url,
          type: file.type,
          size: file.size,
          uploaded_by: currentUserEmail,
          uploaded_at: new Date().toISOString()
        });
      }

      onFilesChange([...files, ...newFiles]);
    } catch (error) {
      console.error('File upload failed:', error);
      alert('Failų įkėlimas nepavyko. Bandykite dar kartą.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(Array.from(e.target.files));
    }
  };

  const handleRemoveFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50",
          uploading && "opacity-50 pointer-events-none"
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          onChange={handleChange}
          className="hidden"
          id="file-upload"
          disabled={uploading}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center gap-3"
        >
          {uploading ? (
            <>
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              <p className="text-sm text-slate-600">Įkeliami failai...</p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Spustelėkite arba nuvilkite failus čia
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Palaikomi visi failų tipai
                </p>
              </div>
            </>
          )}
        </label>
      </div>

      {/* Files list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">Įkelti failai ({files.length})</h4>
          <div className="space-y-2">
            {files.map((file, index) => {
              const FileIcon = getFileIcon(file.type);
              return (
                <Card key={index} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <FileIcon className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{formatFileSize(file.size)}</span>
                        {file.uploaded_by && (
                          <>
                            <span>•</span>
                            <span>{file.uploaded_by}</span>
                          </>
                        )}
                        {file.uploaded_at && (
                          <>
                            <span>•</span>
                            <span>{format(new Date(file.uploaded_at), 'yyyy-MM-dd HH:mm')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        asChild
                      >
                        <a href={file.url} target="_blank" rel="noopener noreferrer" download>
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-red-100"
                        onClick={() => handleRemoveFile(index)}
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}