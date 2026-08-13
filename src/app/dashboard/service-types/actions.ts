"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ServiceTypePattern } from "@/lib/supabase/types";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase
    .from("users")
    .select("church_id, is_church_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.church_id) throw new Error("No church on this account.");
  if (!profile.is_church_admin) throw new Error("Only your church's Admin can manage service types.");
  return { supabase, churchId: profile.church_id };
}

function readFields(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const patternType = (String(formData.get("pattern_type") || "weekly") as ServiceTypePattern) || "weekly";
  const weekdayRaw = String(formData.get("default_weekday") ?? "");
  const defaultWeekday = patternType === "weekly" && weekdayRaw !== "" ? Number(weekdayRaw) : null;
  const startTime = String(formData.get("default_start_time") || "").trim() || null;
  const location = String(formData.get("default_location") || "").trim() || null;
  return { name, patternType, defaultWeekday, startTime, location };
}

export async function createServiceType(formData: FormData) {
  const { supabase, churchId } = await requireAdmin();
  const { name, patternType, defaultWeekday, startTime, location } = readFields(formData);
  if (!name) throw new Error("Give the gathering a name.");

  const { error } = await supabase.from("service_types").insert({
    church_id: churchId,
    name,
    pattern_type: patternType,
    default_weekday: defaultWeekday,
    default_start_time: startTime,
    default_location: location,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/service-types");
}

export async function updateServiceType(id: string, formData: FormData) {
  const { supabase } = await requireAdmin();
  const { name, patternType, defaultWeekday, startTime, location } = readFields(formData);
  if (!name) throw new Error("Give the gathering a name.");

  const { error } = await supabase
    .from("service_types")
    .update({
      name,
      pattern_type: patternType,
      default_weekday: defaultWeekday,
      default_start_time: startTime,
      default_location: location,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/service-types");
}

export async function deleteServiceType(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("service_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/service-types");
}

export async function addOccurrenceDate(serviceTypeId: string, date: string, note: string) {
  const { supabase } = await requireAdmin();
  if (!date) throw new Error("Pick a date.");
  const { error } = await supabase
    .from("service_occurrences")
    .insert({ service_type_id: serviceTypeId, date, note: note.trim() || null });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/service-types");
}

export async function deleteOccurrence(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("service_occurrences").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/service-types");
}
