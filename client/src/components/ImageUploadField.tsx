import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { uploadCompressedImage } from "@/lib/firebase-storage";
import { ImagePlus, Loader2 } from "lucide-react";

interface ImageUploadFieldProps {
  currentUrl: string | null | undefined;
  fallbackText: string;
  folder: string;
  onUploaded: (url: string) => void;
  testId?: string;
}

export function ImageUploadField({ currentUrl, fallbackText, folder, onUploaded, testId }: ImageUploadFieldProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await uploadCompressedImage(file, folder);
      onUploaded(url);
      toast({ title: "Imagem enviada", description: "A foto foi atualizada com sucesso." });
    } catch (err) {
      toast({
        title: "Erro ao enviar imagem",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarImage src={previewUrl || currentUrl || ""} />
        <AvatarFallback>{fallbackText}</AvatarFallback>
      </Avatar>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          data-testid={testId ? `input-${testId}` : undefined}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          data-testid={testId ? `button-${testId}` : undefined}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4 mr-2" />
          )}
          {uploading ? "Enviando..." : "Alterar foto"}
        </Button>
      </div>
    </div>
  );
}
