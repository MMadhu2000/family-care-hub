import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { requireFamilyPermission, assertCareRecipientInFamily, assertAssigneeInFamily } from '@/lib/server/permissions';
import { ApiError,toErrorResponse } from '@/lib/server/errors';
import { validateJson } from '@/lib/server/validation';
import { parsePagination } from '@/lib/server/pagination';

const schema=z.object({family_id:z.string().uuid(),care_recipient_id:z.string().uuid(),title:z.string().trim().min(1).max(200),description:z.string().max(5000).nullable().optional(),status:z.enum(['PENDING','IN_PROGRESS','COMPLETED','CANCELLED']).optional(),priority:z.enum(['LOW','MEDIUM','HIGH','URGENT']).optional(),assigned_to:z.string().uuid().nullable().optional(),due_at:z.string().datetime().nullable().optional()}).strict();
export async function GET(request:Request){
 try{await requireAuthenticatedUser();const u=new URL(request.url),f=u.searchParams.get('family_id');if(!f||!z.string().uuid().safeParse(f).success)throw new ApiError(400,'INVALID_FAMILY_ID','A valid family_id is required.');
 await requireFamilyPermission(f,'view_family');const {page,pageSize}=parsePagination(u.searchParams),s=await createClient();
 const {data,error,count}=await s.from('tasks').select('id,family_id,care_recipient_id,title,description,status,priority,assigned_to,due_at,created_by,created_at,updated_at',{count:'exact'}).eq('family_id',f).order('created_at',{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
 if(error)throw new ApiError(500,'TASKS_FETCH_FAILED','Unable to load tasks.');return Response.json({data:{items:data??[],page,pageSize,total:count??0,totalPages:Math.ceil((count??0)/pageSize)}});
 }catch(e){return toErrorResponse(e);}
}
export async function POST(request:Request){
 try{const user=await requireAuthenticatedUser(),b=await validateJson(request,schema);await requireFamilyPermission(b.family_id,'manage_tasks');await assertCareRecipientInFamily(b.family_id,b.care_recipient_id);await assertAssigneeInFamily(b.family_id,b.assigned_to??null);
 const s=await createClient();const {data,error}=await s.from('tasks').insert({...b,description:b.description??null,status:b.status??'PENDING',priority:b.priority??'MEDIUM',assigned_to:b.assigned_to??null,due_at:b.due_at??null,created_by:user.id}).select().single();
 if(error||!data)throw new ApiError(500,'TASK_CREATE_FAILED','Unable to create task.');return Response.json({data},{status:201});
 }catch(e){return toErrorResponse(e);}
}
