
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import DriverDetailsForm from "./DriverDetailsForm";
import { toast } from "sonner";
import { Profile } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";

export default function DriverOnboardingGate() {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hasDetails, setHasDetails] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

  // Carrega user, profile e detalhes do motorista
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        console.log("DriverOnboardingGate getUser error:", userErr.message);
        setLoading(false);
        return;
      }

      const id = userData.user?.id ?? null;
      setUserId(id);

      if (!id) {
        setProfile(null);
        setHasDetails(false);
        setOpen(false);
        setLoading(false);
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, phone, user_type, avatar_url, is_active, created_at, updated_at")
        .eq("id", id)
        .limit(1)
        .single();

      if (profErr) {
        console.error("Erro carregando perfil:", profErr);
        setLoading(false);
        return;
      }

if (!mounted) return;

      if (!prof) {
        setLoading(false);
        return;
      }

      const castProfile: Profile = {
        ...prof,
        user_type: prof.user_type as Profile["user_type"],
      };
      setProfile(castProfile);

      if (castProfile.user_type !== "driver") {
        // Não é motorista, não precisa abrir nada
        setHasDetails(true);
        setOpen(false);
        setLoading(false);
        return;
      }

      const sb = supabase as any; // Temporary typing workaround
      const { data: det, error: detErr } = await sb
        .from("driver_details")
        .select("id")
        .eq("user_id", id)
        .limit(1)
        .maybeSingle();

      if (detErr && (!detErr.code || detErr.code !== "PGRST116")) {
        console.error("Erro carregando driver_details:", detErr);
      }

      const exists = !!det?.id;
      setHasDetails(exists);
      // Abrimos o modal se for motorista e:
      // - não tem detalhes (precisa preencher), ou
      // - está inativo (aguardando aprovação), manteremos o modal com mensagem
      const shouldOpen = castProfile.user_type === "driver" && (!exists || !castProfile.is_active);
      setOpen(shouldOpen);

      setLoading(false);
    };

    load();

    // Reagir a mudanças de auth (logout/login)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
      // Recarrega tudo em mudanças significativas
      load();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Real-time subscription for profile changes (approval status)
  useEffect(() => {
    if (!userId || !profile?.user_type || profile.user_type !== 'driver') return;

    console.log('Setting up realtime subscription for profile changes for driver:', userId);

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          console.log('Profile updated via realtime:', payload);
          const updatedProfile = payload.new as any;
          if (updatedProfile && updatedProfile.is_active !== profile.is_active) {
            const castUpdatedProfile: Profile = {
              ...updatedProfile,
              user_type: updatedProfile.user_type as Profile["user_type"],
            };
            setProfile(castUpdatedProfile);
            
            // If driver was approved, close the modal
            if (castUpdatedProfile.is_active && hasDetails) {
              setOpen(false);
              toast.success("Conta aprovada! Bem-vindo ao RideBuddy.");
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [userId, profile?.is_active, profile?.user_type, hasDetails]);

  const awaitingApproval = useMemo(() => {
    return profile?.user_type === "driver" && hasDetails && profile?.is_active === false;
  }, [profile, hasDetails]);

  const blockClose = useMemo(() => {
    // Bloqueia fechar o modal enquanto for motorista sem detalhes.
    // Se já tem detalhes mas está aguardando aprovação, também mantemos aberto para comunicar o status.
    return profile?.user_type === "driver" && (!hasDetails || profile?.is_active === false);
  }, [profile, hasDetails]);

  const handleSubmitted = async () => {
    setHasDetails(true);
    toast.success("Dados do mototaxista enviados. Aguarde aprovação do administrador.");
    // Recarregar perfil para refletir is_active atual (provavelmente continua false até admin aprovar)
    if (userId) {
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, user_type, avatar_url, is_active, created_at, updated_at")
        .eq("id", userId)
        .limit(1)
        .single();
      if (!error && prof) {
        setProfile({ ...prof, user_type: prof.user_type as Profile["user_type"] });
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logout realizado com sucesso");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error("Erro ao fazer logout");
    }
  };

  if (loading) return null;

  // Se não está aberto (não motorista ou já aprovado), não renderiza nada
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Evita fechar quando bloqueado
        if (!blockClose) setOpen(v);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {awaitingApproval ? "Conta de mototaxista aguardando aprovação" : "Complete seu cadastro de mototaxista"}
          </DialogTitle>
          <DialogDescription>
            {awaitingApproval
              ? "Recebemos seus dados. Um administrador precisa aprovar sua conta de mototaxista antes de você começar a dirigir."
              : "Informe seus dados de mototaxista para concluir o cadastro."}
          </DialogDescription>
        </DialogHeader>

        {!hasDetails && userId ? (
          <DriverDetailsForm userId={userId} onSubmitted={handleSubmitted} />
        ) : null}

        {awaitingApproval ? (
          <div className="space-y-4">
            <div className="rounded-md border p-4 text-sm">
              Sua conta está pendente de aprovação. Assim que for aprovada, esta mensagem desaparecerá automaticamente.
            </div>
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sair da conta
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
