import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import getCroppedImg from '@/lib/cropImage';

interface ImageCropperProps {
  imageFile: File | null;
  onCropComplete: (croppedFile: File) => void;
  onCancel: () => void;
}

export function ImageCropper({ imageFile, onCropComplete, onCancel }: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageSrc(reader.result?.toString() || null));
      reader.readAsDataURL(imageFile);
    } else {
      setImageSrc(null);
    }
  }, [imageFile]);

  const handleCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (imageSrc && croppedAreaPixels) {
      try {
        const croppedImg = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
        if (croppedImg) {
          onCropComplete(croppedImg);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <Dialog open={!!imageFile} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md bg-card border-border sm:rounded-2xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">Crop Image</DialogTitle>
        <div className="relative w-full h-[60vh] bg-black">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
        </div>
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-muted-foreground">Zoom</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>
              CANCEL
            </Button>
            <Button className="flex-1 rounded-xl" onClick={handleConfirm}>
              CROP & SAVE
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
