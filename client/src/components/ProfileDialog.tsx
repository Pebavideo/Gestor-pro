import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogScrollArea, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploadField } from "@/components/ImageUploadField";
import { UserCog } from "lucide-react";

export function ProfileDialog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setCnpjCpf(user.cnpjCpf || "");
      setCompanyName(user.companyName || "");
    }
  }, [open, user]);

  async function handlePhotoUploaded(url: string) {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.id), { profileImageUrl: url, updatedAt: new Date() });
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao salvar foto", variant: "destructive" });
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.id), { firstName, lastName, cnpjCpf, companyName, updatedAt: new Date() });
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      toast({ title: "Perfil atualizado", description: "Seus dados foram salvos." });
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2" data-testid="button-open-profile">
          <UserCog className="h-4 w-4" />
          Meu Perfil
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
        </DialogHeader>
        <DialogScrollArea>
          <div className="space-y-3 pb-4">
            <ImageUploadField
              currentUrl={user?.profileImageUrl}
              fallbackText={(firstName || user?.email || "U").slice(0, 1).toUpperCase()}
              folder="profile"
              onUploaded={handlePhotoUploaded}
              testId="profile-photo"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="profile-first-name">Nome</Label>
                <Input
                  id="profile-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Seu nome"
                  data-testid="input-profile-first-name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="profile-last-name">Sobrenome</Label>
                <Input
                  id="profile-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Seu sobrenome"
                  data-testid="input-profile-last-name"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-email">E-mail</Label>
              <Input
                id="profile-email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
                data-testid="input-profile-email"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-cnpj-cpf">CNPJ / CPF</Label>
              <Input
                id="profile-cnpj-cpf"
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(e.target.value)}
                placeholder="00.000.000/0001-00 ou 000.000.000-00"
                data-testid="input-profile-cnpj-cpf"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-company-name">Nome da Empresa</Label>
              <Input
                id="profile-company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Nome da empresa ou razao social"
                data-testid="input-profile-company-name"
              />
            </div>
          </div>
        </DialogScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-profile">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-profile">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
