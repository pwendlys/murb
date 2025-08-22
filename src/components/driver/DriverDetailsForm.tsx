
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type DriverDetails = {
  id?: string;
  user_id: string;
  driver_license: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_plate: string;
  vehicle_color: string;
  vehicle_type: "car" | "moto";
};

interface DriverDetailsFormProps {
  userId: string;
  onSubmitted?: () => void;
}

const emptyDetails: Omit<DriverDetails, "user_id"> = {
  driver_license: "",
  vehicle_brand: "",
  vehicle_model: "",
  vehicle_plate: "",
  vehicle_color: "",
  vehicle_type: "car",
};

export default function DriverDetailsForm({ userId, onSubmitted }: DriverDetailsFormProps) {
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<Omit<DriverDetails, "user_id">>(emptyDetails);

  useEffect(() => {
    // Carrega detalhes existentes, se houver
    const load = async () => {
      const sb = supabase as any; // contorna tipagem até o types do Supabase incluir driver_details
      const { data, error } = await sb
        .from("driver_details")
        .select("id, driver_license, vehicle_brand, vehicle_model, vehicle_plate, vehicle_color, vehicle_type")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        // Se não existir registro, deixamos o formulário vazio
        console.log("DriverDetailsForm load details:", error.message ?? error);
        return;
      }
      if (data) {
        setDetails({
          driver_license: data.driver_license ?? "",
          vehicle_brand: data.vehicle_brand ?? "",
          vehicle_model: data.vehicle_model ?? "",
          vehicle_plate: data.vehicle_plate ?? "",
          vehicle_color: data.vehicle_color ?? "",
          vehicle_type: (data.vehicle_type as "car" | "moto") ?? "car",
        });
      }
    };

    if (userId) {
      load();
    }
  }, [userId]);

  const handleChange = (field: keyof Omit<DriverDetails, "user_id">, value: string) => {
    setDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const sb = supabase as any; // contorna tipagem até o types do Supabase incluir driver_details

    const { data: existing, error: fetchErr } = await sb
      .from("driver_details")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    // Se houve um erro diferente de "não encontrado", aborta
    if (fetchErr && fetchErr.code && fetchErr.code !== "PGRST116") {
      console.error("Erro buscando driver_details:", fetchErr);
      toast.error("Erro ao salvar dados do motorista");
      setSaving(false);
      return;
    }

    if (existing?.id) {
      const { error } = await sb
        .from("driver_details")
        .update({
          driver_license: details.driver_license || null,
          vehicle_brand: details.vehicle_brand || null,
          vehicle_model: details.vehicle_model || null,
          vehicle_plate: details.vehicle_plate || null,
          vehicle_color: details.vehicle_color || null,
          vehicle_type: details.vehicle_type,
        })
        .eq("id", existing.id);

      if (error) {
        console.error("Erro atualizando driver_details:", error);
        toast.error("Falha ao atualizar dados do motorista");
        setSaving(false);
        return;
      }
    } else {
      const { error } = await sb.from("driver_details").insert({
        user_id: userId,
        driver_license: details.driver_license || null,
        vehicle_brand: details.vehicle_brand || null,
        vehicle_model: details.vehicle_model || null,
        vehicle_plate: details.vehicle_plate || null,
        vehicle_color: details.vehicle_color || null,
        vehicle_type: details.vehicle_type,
      });

      if (error) {
        console.error("Erro inserindo driver_details:", error);
        toast.error("Falha ao salvar dados do motorista");
        setSaving(false);
        return;
      }
    }

    toast.success("Dados do motorista salvos");
    setSaving(false);
    onSubmitted?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="driver_license">CNH</Label>
          <Input
            id="driver_license"
            value={details.driver_license}
            onChange={(e) => handleChange("driver_license", e.target.value)}
            placeholder="Número da CNH"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicle_plate">Placa</Label>
          <Input
            id="vehicle_plate"
            value={details.vehicle_plate}
            onChange={(e) => handleChange("vehicle_plate", e.target.value)}
            placeholder="ABC1D23"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicle_brand">Marca</Label>
          <Input
            id="vehicle_brand"
            value={details.vehicle_brand}
            onChange={(e) => handleChange("vehicle_brand", e.target.value)}
            placeholder="Ex.: Honda, Toyota..."
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicle_model">Modelo</Label>
          <Input
            id="vehicle_model"
            value={details.vehicle_model}
            onChange={(e) => handleChange("vehicle_model", e.target.value)}
            placeholder="Ex.: CG 160, Corolla..."
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicle_color">Cor</Label>
          <Input
            id="vehicle_color"
            value={details.vehicle_color}
            onChange={(e) => handleChange("vehicle_color", e.target.value)}
            placeholder="Ex.: Prata"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Tipo de veículo</Label>
          <Select
            value={details.vehicle_type}
            onValueChange={(v) => handleChange("vehicle_type", v as "car" | "moto")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="car">Carro</SelectItem>
              <SelectItem value="moto">Moto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar dados"}
        </Button>
      </div>
    </form>
  );
}
