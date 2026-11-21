import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission,assertCareRecipientInFamily,assertAssigneeInFamily } from '@/lib/server/permissions';
import { ApiError,toErrorResponse } from '@/lib/server/errors';
import { validateJson } from '@/lib/server/validation';

const patchSchema=z.object({title:z.string().trim().min(1).max(200).optional(),description:z.string().max(5000).nullable().optional(),status:z.enum(['PENDING','IN_PROGRESS','COMPLETED','CANCELLED']).optional(),priority:z.enum(['LOW','MEDIUM','HIGH','URGENT']).optional(),care_recipient_id:z.string().uuid().optional(),assigned_to:z.string().uuid().nullable().optional(),due_at:z.string().datetime().nullable().optional()}).strict().refine(v=>Object.keys(v).length>0);
type Ctx={params:Promise<{id:string}>};
export async function PATCH(request:Request,context:Ctx){
 try{await requireAuthenticatedUser();const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)throw new ApiError(400,'INVALID_ID','Invalid task ID.');
 const body=await validateJson(request,patchSchema),s=await createClient();const {data:existing,error:lookup}=await s.from('tasks').select('family_id,care_recipient_id').eq('id',id).maybeSingle();
 if(lookup||!existing)throw new ApiError(404,'TASK_NOT_FOUND','Task not found.');await requireFamilyPermission(existing.family_id,'manage_tasks');
 if(body.care_recipient_id)await assertCareRecipientInFamily(existing.family_id,body.care_recipient_id);if('assigned_to'in body)await assertAssigneeInFamily(existing.family_id,body.assigned_to??null);
 const {data,error}=await s.from('tasks').update(body).eq('id',id).select().single();if(error||!data)throw new ApiError(500,'TASK_UPDATE_FAILED','Unable to update task.');return Response.json({data});
 }catch(e){return toErrorResponse(e);}
}
export async function DELETE(_request:Request,context:Ctx){
 try{await requireAuthenticatedUser();const {id}=await context.params;if(!z.string().uuid().safeParse(id).success)throw new ApiError(400,'INVALID_ID','Invalid task ID.');
 const s=await createClient(),{data:task,error:lookup}=await s.from('tasks').select('family_id').eq('id',id).maybeSingle();if(lookup||!task)throw new ApiError(404,'TASK_NOT_FOUND','Task not found.');
 await requireFamilyPermission(task.family_id,'delete_tasks');const {error}=await s.from('tasks').delete().eq('id',id);if(error)throw new ApiError(500,'TASK_DELETE_FAILED','Unable to delete task.');return Response.json({data:{deleted:true}});
 }catch(e){return toErrorResponse(e);}
}
