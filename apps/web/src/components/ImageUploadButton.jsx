
import React, { useRef, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const ImageUploadButton = ({ product, onUploadSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef(null);

  const imageUrl = product?.image && !imgError
    ? pb.files.getUrl(product, product.image)
    : null;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match('image.*')) {
      toast.error('El archivo debe ser una imagen (JPG, PNG, GIF, WEBP)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size (max 20MB)
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('La imagen es demasiado grande (Máx 20MB)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      await pb.collection('products').update(product.id, formData, { $autoCancel: false });
      toast.success('Imagen actualizada correctamente');
      setImgError(false);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error.message || 'Ocurrió un error al subir la imagen');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Thumbnail Preview */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted/20 border border-border flex-shrink-0 flex items-center justify-center relative group">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={product?.name || 'Producto'} 
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
        )}
        
        {/* Hover overlay for quick action if image exists */}
        {imageUrl && !isUploading && (
          <div 
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            onClick={handleButtonClick}
          >
            <Upload className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Upload Button & Hidden Input */}
      <div className="flex flex-col">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/jpeg, image/png, image/gif, image/webp"
          className="hidden"
        />
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={handleButtonClick}
          disabled={isUploading}
          className="h-8 text-xs border-border hover:bg-primary hover:text-primary-foreground hover:border-primary"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <Upload className="w-3 h-3 mr-2" />
              {imageUrl ? 'Cambiar' : 'Subir'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ImageUploadButton;
