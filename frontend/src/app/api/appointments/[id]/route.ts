import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission,assertCareRecipientInFamily } from '@/lib/server/permissions';
import { ApiError,toErrorResponse } from '@/lib/server/errors';
import { validateJson } from '@/lib/server/validation';

const COLUMNS='id,family_id,care_recipient_id,title,provider_name,location,scheduled_at,status,notes,created_by,created_at,updated_at';
const patchSchema=z.object({care_recipient_id:z.uuid().optional(),title:z.string().trim().min(1).max(200).optional(),provider_name:z.string().max(200).nullable().optional(),location:z.string().max(500).nullable().optional(),scheduled_at:z.string().datetime().optional(),status:z.enum(['SCHEDULED','COMPLETED','CANCELLED']).optional(),notes:z.string().max(5000).nullable().optional()}).strict();
type Ctx={params:Promise<{id:string}>};

function assertValidId(id:string){
 if(!z.uuid().safeParse(id).success)throw new ApiError(400,'INVALID_ID','Invalid appointment ID.');
}

async function loadAppointment(id:string){
 const supabase=await createClient();
 const {data,error}=await supabase.from('appointments').select('id,family_id,care_recipient_id').eq('id',id).maybeSingle();
 if(error)throw new ApiError(500,'APPOINTMENT_LOOKUP_FAILED','Unable to load appointment.');
 if(!data)throw new ApiError(404,'APPOINTMENT_NOT_FOUND','Appointment was not found.');
 return data;
}

export async function PATCH(request:Request,context:Ctx){
 try{
  await requireAuthenticatedUser();
  const {id}=await context.params;assertValidId(id);
  const appointment=await loadAppointment(id);
  await requireFamilyPermission(appointment.family_id,'manage_appointments');
  const body=await validateJson(request,patchSchema);
  if(Object.keys(body).length===0)throw new ApiError(400,'NO_FIELDS','No editable fields were provided.');
  if(body.care_recipient_id)await assertCareRecipientInFamily(appointment.family_id,body.care_recipient_id);
  const updates={...body,updated_at:new Date().toISOString()};
  const supabase=await createClient();
  const {data,error}=await supabase.from('appointments').update(updates).eq('id',id).select(COLUMNS).maybeSingle();
  if(error)throw new ApiError(500,'APPOINTMENT_UPDATE_FAILED','Unable to update appointment.');
  if(!data)throw new ApiError(404,'APPOINTMENT_NOT_FOUND','Appointment was not found.');
  return Response.json({data});
 }catch(e){return toErrorResponse(e);}
}

export async function DELETE(_request:Request,context:Ctx){
 try{
  await requireAuthenticatedUser();
  const {id}=await context.params;assertValidId(id);
  const appointment=await loadAppointment(id);
  await requireFamilyPermission(appointment.family_id,'delete_appointments');
  const supabase=await createClient();
  const {data,error}=await supabase.from('appointments').delete().eq('id',id).select('id');
  if(error)throw new ApiError(500,'APPOINTMENT_DELETE_FAILED','Unable to delete appointment.');
  if(!data||data.length===0)throw new ApiError(404,'APPOINTMENT_NOT_FOUND','Appointment was not found.');
  return Response.json({data:{deleted:true}});
 }catch(e){return toErrorResponse(e);}
}
