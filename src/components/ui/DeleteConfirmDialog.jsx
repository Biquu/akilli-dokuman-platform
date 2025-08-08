'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Trash2, FileText } from 'lucide-react';

export function DeleteConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  fileName, 
  fileType,
  isLoading = false 
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-neutral-950 text-neutral-100 border border-neutral-800">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-neutral-900 rounded-xl shadow-lg border border-neutral-800">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-neutral-100">
              Dosya Silme Onayı
            </DialogTitle>
          </div>
          <DialogDescription className="text-neutral-400 mt-2">
            Bu dosyayı kalıcı olarak silmek istediğinizden emin misiniz?
          </DialogDescription>
        </DialogHeader>
        
        <div className="rounded-2xl p-4 border border-neutral-800 bg-neutral-900">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-neutral-800 rounded-xl shadow-lg border border-neutral-700">
              <FileText className="h-5 w-5 text-neutral-200" />
            </div>
            <div>
              <p className="font-semibold text-neutral-100">{fileName}</p>
              <p className="text-sm text-neutral-400">{fileType}</p>
            </div>
          </div>
          
          <div className="mt-3 p-3 border border-red-400/30 bg-neutral-900 rounded-xl">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-300">
                  Bu işlem geri alınamaz!
                </p>
                <p className="text-xs text-red-400 mt-1">
                  Dosya Storage'dan ve Firestore'dan kalıcı olarak silinecektir.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 bg-neutral-900 text-neutral-100 border border-neutral-700 hover:bg-neutral-800 transition-all duration-300"
          >
            İptal
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white border border-red-600 hover:border-red-500 transition-all duration-300 shadow-lg"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Siliniyor...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Trash2 className="h-4 w-4" />
                <span>Dosyayı Sil</span>
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteConfirmDialog;
